/**
 * manual-mapper.ts — 手动上传 → 标准事实表 的字段映射与落库
 *
 * 职责：
 *   1. 把任意平台后台导出的「一行一天」经营数据，按列别名映射为标准事实行
 *   2. 经过清洗引擎处理后的干净行，写入 fact_trade_daily / fact_traffic_daily
 *   3. 记录 ingest_sync_jobs（job_type = 'manual_upload'）
 *
 * 设计约束：
 *   - 所有通路都产出「标准事实行」，落库前经过同一套校验
 *   - 无法识别平台/店铺时拒绝落库，避免脏数据污染事实表
 */

import type { Pool } from 'pg'

/** 标准交易字段 → 候选列名（按优先级，支持模糊包含匹配） */
export const TRADE_COLUMN_ALIASES: Record<string, string[]> = {
  biz_date: ['统计日期', '日期', 'biz_date', '日期(自然日)', '生意参谋日期', '报表日期'],
  channel_name: ['渠道名称', '渠道', '流量渠道', 'channel', 'channel_name'],
  gmv: ['成交总额', '成交金额', 'gmv', '交易额', '下单金额', '支付金额', '商品成交金额'],
  pay_amount: ['买家实付金额', '实付金额', '实际支付金额', 'pay_amount', '付款金额', '商家实收金额'],
  paid_order_count: ['支付订单数', '支付子订单数', '成交订单数', '订单数', 'pay_order_count', '订单量'],
  paid_buyer_count: ['支付买家数', '买家数', '成交人数', '支付人数', 'buyer_count'],
  refund_amount: ['退款金额', '退款总额', '售后退款金额', 'refund_amount', '退货退款金额'],
  refund_count: ['退款订单数', '退款笔数', '退款单数', 'refund_count'],
}

/** 标准流量字段 → 候选列名 */
export const TRAFFIC_COLUMN_ALIASES: Record<string, string[]> = {
  biz_date: TRADE_COLUMN_ALIASES.biz_date,
  channel_name: TRADE_COLUMN_ALIASES.channel_name,
  impressions: ['展现量', '曝光量', '展现次数', '曝光次数', 'impressions', '商品展现量'],
  clicks: ['点击量', '点击次数', 'clicks', '商品点击量'],
  visitors: ['访客数', '访问人数', '进店人数', 'visitors', 'uv', '直播间观看人数'],
  avg_stay_seconds: ['平均停留时长', '停留时长', 'avg_stay_seconds'],
}

/** 在行对象上按别名列表找值 */
function pick(row: Record<string, any>, aliases: string[]): { key: string; value: any } | null {
  for (const a of aliases) {
    if (a in row && row[a] !== null && row[a] !== undefined && row[a] !== '') {
      return { key: a, value: row[a] }
    }
  }
  for (const a of aliases) {
    const hit = Object.keys(row).find((k) => k.includes(a))
    if (hit && row[hit] !== null && row[hit] !== undefined && row[hit] !== '') {
      return { key: hit, value: row[hit] }
    }
  }
  return null
}

function toNumber(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  const s = String(v).replace(/[¥$,\s￥%]/g, '').trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** Excel 日期序列号 → YYYY-MM-DD（1900 日期系统，序列号 1 = 1900-01-01） */
function excelSerialToDate(n: number): string | null {
  if (!Number.isFinite(n) || n < 1 || n > 2958465) return null
  // Excel 误把 1900 当闰年，序列号 > 60 需减 1 天
  const ms = Math.round((n - (n > 60 ? 25569 : 25568)) * 86400000)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * 归一化日期：支持 2026-11-07 / 2026/11/07 / 2026年11月7日 / 20261107
 * 以及 Excel 导出的日期序列号（如 46331）。
 */
export function normalizeDate(v: any): string | null {
  if (v === null || v === undefined || v === '') return null

  // 纯数字 → 可能是 Excel 序列号，也可能是 20261107 这种紧凑格式
  if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v).trim())) {
    const n = Number(v)
    const compact = String(Math.trunc(n))
    if (compact.length === 8 && compact.startsWith('20')) {
      const y = compact.slice(0, 4)
      const mo = compact.slice(4, 6)
      const d = compact.slice(6, 8)
      return `${y}-${mo}-${d}`
    }
    return excelSerialToDate(n)
  }

  const s = String(v).trim()
  // 2026-11-07 / 2026/11/07 / 2026年11月7日
  let m = s.match(/^(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // 20261107
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export interface MappedRow {
  bizDate: string
  channelName: string
  /** 通用渠道编码（来自 platform_source_mapping 映射） */
  sourceCode: string | null
  values: Record<string, number>
}

export interface MapResult {
  rows: MappedRow[]
  rejected: Array<{ rowIndex: number; reason: string; raw: Record<string, any> }>
  mapping: Record<string, string | null>
}

/**
 * 把清洗后的原始行映射为标准交易/流量行。
 * defaultBizDate 用于文件中无日期列时的兜底。
 */
export function mapRowsToStandard(
  rawRows: Record<string, any>[],
  dataType: 'trade' | 'traffic',
  defaultBizDate?: string,
): MapResult {
  const aliases = dataType === 'trade' ? TRADE_COLUMN_ALIASES : TRAFFIC_COLUMN_ALIASES
  const rows: MappedRow[] = []
  const rejected: MapResult['rejected'] = []
  const mapping: Record<string, string | null> = {}

  rawRows.forEach((row, idx) => {
    const dateHit = pick(row, aliases.biz_date)
    const bizDate = normalizeDate(dateHit?.value) || defaultBizDate || null
    if (!bizDate) {
      rejected.push({ rowIndex: idx, reason: '无法识别业务日期（缺少日期列且未提供默认日期）', raw: row })
      return
    }

    const channelHit = pick(row, aliases.channel_name)
    const channelName = channelHit ? String(channelHit.value).trim() || '默认渠道' : '默认渠道'

    const values: Record<string, number> = {}
    for (const field of Object.keys(aliases)) {
      if (field === 'biz_date' || field === 'channel_name') continue
      const hit = pick(row, aliases[field])
      if (hit) {
        mapping[field] = hit.key
        values[field] = toNumber(hit.value)
      } else {
        if (!(field in mapping)) mapping[field] = null
        values[field] = 0
      }
    }

    if (dateHit) mapping.biz_date = dateHit.key
    mapping.channel_name = channelHit?.key ?? null

    rows.push({ bizDate, channelName, sourceCode: null, values })
  })

  return { rows, rejected, mapping }
}

export interface ManualIngestResult {
  jobId: number
  insertedRows: number
  rejectedRows: number
  mapping: Record<string, string | null>
  sampleRejections: MapResult['rejected']
}

/**
 * 落库：清洗后的行 → 事实表 + ingest_sync_jobs 记录
 */
export async function ingestManualFacts(
  pool: Pool,
  params: {
    platformCode: string
    shopId: number
    dataType: 'trade' | 'traffic'
    rows: Record<string, any>[]
    defaultBizDate?: string
    cleanRuleSetId?: number | null
    uploadId?: number | null
  },
): Promise<ManualIngestResult> {
  const { platformCode, shopId, dataType, rows, defaultBizDate, cleanRuleSetId, uploadId } = params
  const startedAt = Date.now()

  const jobIns = await pool.query(
    `INSERT INTO ingest_sync_jobs
       (platform_code, shop_id, job_type, status, clean_rule_set_id, input_rows, started_at)
     VALUES ($1, $2, 'manual_upload', 'running', $3, $4, now())
     RETURNING id`,
    [platformCode, shopId, cleanRuleSetId ?? null, rows.length],
  )
  const jobId: number = jobIns.rows[0].id

  // 读取该平台的默认成交口径（京东含COD、快手含间接成交等）
  let amountType = 'gross_paid'
  try {
    const calRes = await pool.query(
      `SELECT amount_type FROM platform_caliber_config
        WHERE platform_code = $1 AND metric_code = 'gmv'
        ORDER BY is_default DESC LIMIT 1`,
      [platformCode],
    )
    if (calRes.rows.length > 0) amountType = calRes.rows[0].amount_type
  } catch {
    // 表不存在时用默认值
  }

  try {
    const mapped = mapRowsToStandard(rows, dataType, defaultBizDate)

    // 渠道名 → 通用渠道编码映射（来自 platform_source_mapping）
    try {
      const { rows: mapRows } = await pool.query(
        `SELECT raw_source, source_code, match_type
           FROM platform_source_mapping
          WHERE platform_code = ANY($1::text[])
          ORDER BY priority DESC`,
        [[platformCode, platformCode === 'tmall' ? 'taobao' : platformCode]],
      )
      const exact = new Map<string, string>()
      const contains: Array<{ raw: string; code: string }> = []
      for (const m of mapRows) {
        if (m.match_type === 'exact') exact.set(m.raw_source, m.source_code)
        else contains.push({ raw: m.raw_source, code: m.source_code })
      }
      for (const row of mapped.rows) {
        const ch = row.channelName
        if (exact.has(ch)) {
          row.sourceCode = exact.get(ch)!
        } else {
          const hit = contains.find((c) => ch.includes(c.raw) || c.raw.includes(ch))
          if (hit) row.sourceCode = hit.code
        }
      }
    } catch {
      // 映射表不存在时忽略，sourceCode 保持 null
    }

    const bizDates = mapped.rows.map((r) => r.bizDate).sort()
    const watermarkFrom = bizDates[0] ?? null
    const watermarkTo = bizDates[bizDates.length - 1] ?? null

    let inserted = 0
    for (const r of mapped.rows) {
      if (dataType === 'trade') {
        // amount_type 取该平台的默认口径（如京东 offline_cod_included、快手 indirect_included）
        await pool.query(
          `INSERT INTO fact_trade_daily
             (biz_date, platform_code, shop_id, channel_name, source_code,
              gmv, pay_amount, paid_order_count, paid_buyer_count,
              refund_amount, refund_count, source, upload_id, extra, amount_type)
           VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual', $12, $13, $14)
           ON CONFLICT (biz_date, platform_code, shop_id, channel_name, amount_type)
           DO UPDATE SET
             source_code       = EXCLUDED.source_code,
             gmv               = EXCLUDED.gmv,
             pay_amount        = EXCLUDED.pay_amount,
             paid_order_count  = EXCLUDED.paid_order_count,
             paid_buyer_count  = EXCLUDED.paid_buyer_count,
             refund_amount     = EXCLUDED.refund_amount,
             refund_count      = EXCLUDED.refund_count,
             source            = EXCLUDED.source,
             upload_id         = EXCLUDED.upload_id,
             extra             = EXCLUDED.extra`,
          [
            r.bizDate,                       // $1
            platformCode,                    // $2
            shopId,                          // $3
            r.channelName,                   // $4
            r.sourceCode ?? null,            // $5
            r.values.gmv ?? 0,               // $6
            r.values.pay_amount ?? 0,        // $7
            Math.round(r.values.paid_order_count ?? 0),  // $8
            Math.round(r.values.paid_buyer_count ?? 0),  // $9
            r.values.refund_amount ?? 0,     // $10
            Math.round(r.values.refund_count ?? 0),      // $11
            uploadId ?? null,                // $12
            JSON.stringify({ mapping: mapped.mapping, ingest_job_id: jobId }), // $13
            amountType,                      // $14
          ],
        )
      } else {
        await pool.query(
          `INSERT INTO fact_traffic_daily
             (biz_date, platform_code, shop_id, channel_name, source_code,
              impressions, clicks, visitors, avg_stay_seconds, source, upload_id, extra)
           VALUES ($1::date, $2, $3, $4, $11, $5, $6, $7, $8, 'manual', $9, $10)
           ON CONFLICT (biz_date, platform_code, shop_id, channel_name)
           DO UPDATE SET
             impressions       = EXCLUDED.impressions,
             clicks            = EXCLUDED.clicks,
             visitors          = EXCLUDED.visitors,
             avg_stay_seconds  = EXCLUDED.avg_stay_seconds,
             source            = EXCLUDED.source,
             upload_id         = EXCLUDED.upload_id,
             extra             = EXCLUDED.extra`,
          [
            r.bizDate, platformCode, shopId, r.channelName,
            Math.round(r.values.impressions ?? 0),
            Math.round(r.values.clicks ?? 0),
            Math.round(r.values.visitors ?? 0),
            Math.round(r.values.avg_stay_seconds ?? 0),
            uploadId ?? null,
            JSON.stringify({ mapping: mapped.mapping, ingest_job_id: jobId }),
            r.sourceCode ?? null,  // $11
          ],
        )
      }
      inserted++
    }

    await pool.query(
      `UPDATE ingest_sync_jobs
          SET status = 'completed', success_rows = $1, dropped_rows = $2,
              watermark_from = $3, watermark_to = $4, completed_at = now()
        WHERE id = $5`,
      [inserted, mapped.rejected.length, watermarkFrom, watermarkTo, jobId],
    )

    return {
      jobId,
      insertedRows: inserted,
      rejectedRows: mapped.rejected.length,
      mapping: mapped.mapping,
      sampleRejections: mapped.rejected.slice(0, 20),
    }
  } catch (err: any) {
    await pool.query(
      `UPDATE ingest_sync_jobs SET status = 'failed', error_summary = $1, completed_at = now() WHERE id = $2`,
      [String(err?.message || err).slice(0, 1000), jobId],
    )
    throw err
  }
}
