/**
 * sync-job.ts — 官方 OpenAPI 增量同步编排
 *
 * 职责：
 *   1. 维护增量水印（每平台每店铺每数据类型一份）
 *   2. 调用 PlatformAdapter 拉取标准事实记录
 *   3. 幂等写入事实表（fact_trade_daily / fact_traffic_daily）
 *   4. 全流程写入 ingest_sync_jobs 供前端任务监控
 *
 * 设计约束：
 *   - 未配置 API 授权的店铺（auth_status = 'manual_only'）直接跳过，返回 skipped 原因
 *   - 适配器未实现 fetch 时同样跳过，不报错
 *   - 水印仅在任务成功后才推进，失败可重试且不会重复入库
 */

import type { Pool } from 'pg'
import { platformRegistry } from '../platform/index.js'
import type { StandardTradeRecord, StandardTrafficRecord } from '../platform/types.js'

export type SyncDataType = 'trade' | 'traffic'

export interface SyncJobResult {
  jobId: number | null
  platformCode: string
  shopId: number
  dataType: SyncDataType
  status: 'completed' | 'skipped' | 'failed'
  fetchedRows: number
  insertedRows: number
  watermarkFrom: string | null
  watermarkTo: string | null
  reason?: string
  error?: string
  durationMs: number
}

/** 默认增量起点：昨天（含） */
function defaultWatermark(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 读取某平台某店铺某数据类型的当前水印。
 * 来源：ingest_sync_jobs 中该 (platform, shop, type) 最近一条 completed 记录的 watermark_to
 */
export async function getWatermark(
  pool: Pool,
  platformCode: string,
  shopId: number,
  dataType: SyncDataType,
): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT watermark_to
       FROM ingest_sync_jobs
      WHERE platform_code = $1
        AND shop_id = $2
        AND job_type = $3
        AND status = 'completed'
        AND watermark_to IS NOT NULL
      ORDER BY completed_at DESC NULLS LAST, id DESC
      LIMIT 1`,
    [platformCode, shopId, `api_sync_${dataType}`],
  )
  return rows.length > 0 ? rows[0].watermark_to : null
}

/** 写入交易事实行（幂等：ON CONFLICT 覆盖同 shop + biz_date + channel） */
async function upsertTradeRows(
  pool: Pool,
  records: StandardTradeRecord[],
  jobId: number,
): Promise<number> {
  let inserted = 0
  for (const r of records) {
    await pool.query(
      `INSERT INTO fact_trade_daily
         (biz_date, platform_code, shop_id, channel_name, amount_type,
          gmv, pay_amount, paid_order_count, paid_buyer_count,
          refund_amount, refund_count, source, extra)
       VALUES ($1::date, $2, $3, $4, 'gross_paid', $5, $6, $7, $8, $9, $10, 'api', $11)
       ON CONFLICT (biz_date, platform_code, shop_id, channel_name, amount_type)
       DO UPDATE SET
         gmv              = EXCLUDED.gmv,
         pay_amount       = EXCLUDED.pay_amount,
         paid_order_count = EXCLUDED.paid_order_count,
         paid_buyer_count = EXCLUDED.paid_buyer_count,
         refund_amount    = EXCLUDED.refund_amount,
         refund_count     = EXCLUDED.refund_count,
         source           = EXCLUDED.source,
         extra            = EXCLUDED.extra`,
      [
        r.bizDate,
        r.platformCode,
        r.shopId,
        r.channelName || '默认渠道',
        r.gmv ?? 0,
        r.payAmount ?? 0,
        r.paidOrderCount ?? 0,
        r.paidBuyerCount ?? 0,
        r.refundAmount ?? 0,
        r.refundCount ?? 0,
        JSON.stringify({ ...(r.extra || {}), sync_job_id: jobId }),
      ],
    )
    inserted++
  }
  return inserted
}

/** 写入流量事实行 */
async function upsertTrafficRows(
  pool: Pool,
  records: StandardTrafficRecord[],
  jobId: number,
): Promise<number> {
  let inserted = 0
  for (const r of records) {
    await pool.query(
      `INSERT INTO fact_traffic_daily
         (biz_date, platform_code, shop_id, channel_name,
          impressions, clicks, visitors, avg_stay_seconds, source, extra)
       VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, 'api', $9)
       ON CONFLICT (biz_date, platform_code, shop_id, channel_name)
       DO UPDATE SET
         impressions      = EXCLUDED.impressions,
         clicks           = EXCLUDED.clicks,
         visitors         = EXCLUDED.visitors,
         avg_stay_seconds = EXCLUDED.avg_stay_seconds,
         source           = EXCLUDED.source,
         extra            = EXCLUDED.extra`,
      [
        r.bizDate,
        r.platformCode,
        r.shopId,
        r.channelName || '默认渠道',
        r.impressions ?? 0,
        r.clicks ?? 0,
        r.visitors ?? 0,
        r.avgStaySeconds ?? 0,
        JSON.stringify({ ...(r.extra || {}), sync_job_id: jobId }),
      ],
    )
    inserted++
  }
  return inserted
}

/**
 * 执行单次平台同步任务。
 *
 * @param sinceOverride 显式指定起始日期，不传则读取水印/默认昨天
 */
export async function runSyncJob(
  pool: Pool,
  platformCode: string,
  shopId: number,
  dataType: SyncDataType,
  sinceOverride?: string,
): Promise<SyncJobResult> {
  const startedAt = Date.now()
  const base: Omit<SyncJobResult, 'status' | 'durationMs'> = {
    jobId: null,
    platformCode,
    shopId,
    dataType,
    fetchedRows: 0,
    insertedRows: 0,
    watermarkFrom: null,
    watermarkTo: null,
  }

  const adapter = platformRegistry.get(platformCode)
  if (!adapter) {
    return { ...base, status: 'failed', error: `未注册的平台适配器: ${platformCode}`, durationMs: Date.now() - startedAt }
  }

  // ── 校验店铺授权状态 ──
  const shopRes = await pool.query(
    `SELECT auth_status FROM dim_shop WHERE id = $1 AND platform_code = $2`,
    [shopId, platformCode],
  )
  if (shopRes.rows.length === 0) {
    return { ...base, status: 'failed', error: `店铺不存在或不属于平台 ${platformCode}`, durationMs: Date.now() - startedAt }
  }
  const authStatus: string = shopRes.rows[0].auth_status

  // ── 校验适配器能力 ──
  const fetcher = dataType === 'trade' ? adapter.fetchTradeData : adapter.fetchTrafficData
  if (typeof fetcher !== 'function') {
    return {
      ...base,
      status: 'skipped',
      reason: `平台 ${platformCode} 适配器未实现 ${dataType} 拉取，请走手动上传通道`,
      durationMs: Date.now() - startedAt,
    }
  }
  if (authStatus !== 'authorized') {
    return {
      ...base,
      status: 'skipped',
      reason: `店铺授权状态为 ${authStatus}，跳过 API 同步（可使用手动上传导入数据）`,
      durationMs: Date.now() - startedAt,
    }
  }

  // ── 水位 ──
  const stored = await getWatermark(pool, platformCode, shopId, dataType)
  const watermarkFrom = sinceOverride || stored || defaultWatermark()
  const watermarkTo = todayString()
  base.watermarkFrom = watermarkFrom
  base.watermarkTo = watermarkTo

  if (watermarkFrom > watermarkTo) {
    return { ...base, status: 'skipped', reason: '水位已是最新，无需同步', durationMs: Date.now() - startedAt }
  }

  // ── 创建任务记录 ──
  const jobIns = await pool.query(
    `INSERT INTO ingest_sync_jobs
       (platform_code, shop_id, job_type, status, watermark_from, watermark_to, started_at)
     VALUES ($1, $2, $3, 'running', $4, $5, now())
     RETURNING id`,
    [platformCode, shopId, `api_sync_${dataType}`, watermarkFrom, watermarkTo],
  )
  const jobId: number = jobIns.rows[0].id

  try {
    let records: Array<StandardTradeRecord | StandardTrafficRecord> = []
    if (dataType === 'trade') {
      records = await adapter.fetchTradeData!(shopId, watermarkFrom)
    } else {
      records = await adapter.fetchTrafficData!(shopId, watermarkFrom)
    }

    const valid = (records || []).filter(
      (r) => r.bizDate >= watermarkFrom && r.bizDate <= watermarkTo,
    )

    let inserted = 0
    if (dataType === 'trade') {
      inserted = await upsertTradeRows(pool, valid as StandardTradeRecord[], jobId)
    } else {
      inserted = await upsertTrafficRows(pool, valid as StandardTrafficRecord[], jobId)
    }

    await pool.query(
      `UPDATE ingest_sync_jobs
          SET status = 'completed', input_rows = $1, success_rows = $2, completed_at = now()
        WHERE id = $3`,
      [records.length, inserted, jobId],
    )

    return { ...base, jobId, status: 'completed', fetchedRows: records.length, insertedRows: inserted, durationMs: Date.now() - startedAt }
  } catch (err: any) {
    const msg = err?.message || String(err)
    await pool.query(
      `UPDATE ingest_sync_jobs
          SET status = 'failed', error_summary = $1, completed_at = now()
        WHERE id = $2`,
      [msg.slice(0, 1000), jobId],
    )
    return { ...base, jobId, status: 'failed', error: msg, durationMs: Date.now() - startedAt }
  }
}

/** 批量同步：一个平台下所有已授权店铺 */
export async function runPlatformSync(
  pool: Pool,
  platformCode: string,
  dataType: SyncDataType,
  sinceOverride?: string,
): Promise<SyncJobResult[]> {
  const { rows } = await pool.query(
    `SELECT id FROM dim_shop WHERE platform_code = $1 AND status = 'active' ORDER BY id`,
    [platformCode],
  )
  const results: SyncJobResult[] = []
  for (const r of rows) {
    results.push(await runSyncJob(pool, platformCode, r.id, dataType, sinceOverride))
  }
  return results
}

/** 全平台批量同步（供 cron 调用） */
export async function runAllPlatformsSync(
  pool: Pool,
  dataType: SyncDataType,
  sinceOverride?: string,
): Promise<SyncJobResult[]> {
  const { rows } = await pool.query(
    `SELECT platform_code FROM system_platform_configs WHERE is_enabled = true ORDER BY sort_order`,
  )
  const results: SyncJobResult[] = []
  for (const r of rows) {
    const batch = await runPlatformSync(pool, r.platform_code, dataType, sinceOverride)
    results.push(...batch)
  }
  return results
}
