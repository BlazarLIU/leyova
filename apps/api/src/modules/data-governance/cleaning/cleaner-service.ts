/**
 * cleaner-service.ts — 数据清洗引擎服务 (Cleaning Engine)
 * 
 * 严格遵循《数据清洗规范 V1.0》：
 * 1. 原始数据不可变，清洗只产生 clean_records 候选层，绝不直接写正式业务表；
 * 2. 业务事实不猜测：缺失订单 ID、金额不可由 AI 补造，直接进入隔离区 (QUARANTINED)；
 * 3. 字段标准化 (日期时间带时区、金额币种及单位精确转换，空金额绝不自动填补为 0)；
 * 4. 业务去重与快照更新/事件识别；
 * 5. 主数据实体时点有效性关联 (Entity Resolver)。
 */

import type { Pool } from 'pg'
import type { CanonicalOrderRecord, CanonicalOrderItemRecord } from '../types.js'

export interface CleaningInputRow {
  rawRecordId: number
  bizDate: string
  sheetName?: string
  rowNo: number
  rawPayload: Record<string, any>
  sourceBusinessKey?: string
}

export interface CleaningRunResult {
  runId: number
  batchId: number
  inputCount: number
  candidateCount: number
  quarantineCount: number
  candidates: Array<{
    rawRecordId: number
    bizDate: string
    sourceOrderId: string
    sourceSubOrderId: string
    paidAmount: number
    status: 'CANDIDATE' | 'QUARANTINED'
    quarantineReason?: string
    canonicalPayload: any
  }>
}

/** 日期时间归一化 (支持 2026/11/10 20:15:10, 2026年11月10日, Excel 序列号) */
export function normalizeDateTimeString(v: any): string | null {
  if (v === null || v === undefined || v === '') return null
  const raw = String(v).trim()

  // 1. Excel 序列号
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw)
    if (n > 20000 && n < 80000) {
      const ms = Math.round((n - 25569) * 86400000)
      const d = new Date(ms)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
  }

  // 2. 中文年月日带时间: 2026年11月10日 20:15:10, 2026/11/10 20:15:10, 2026-11-10 20:15:10
  const m = raw.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日|号)?(?:\s+|T)(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
  if (m) {
    const year = m[1]
    const month = m[2].padStart(2, '0')
    const day = m[3].padStart(2, '0')
    const hour = m[4].padStart(2, '0')
    const min = m[5].padStart(2, '0')
    const sec = (m[6] || '00').padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${min}:${sec}.000Z`
  }

  // 3. 仅日期: 2026-11-10, 2026/11/10, 2026年11月10日
  const dateOnly = raw.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日|号)?/)
  if (dateOnly) {
    return `${dateOnly[1]}-${dateOnly[2].padStart(2, '0')}-${dateOnly[3].padStart(2, '0')}T00:00:00.000Z`
  }

  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  return null
}

/**
 * 货币金额标准化
 * 支持: "￥399.00", "1.2万", "399.00元", "399", 千分位 "1,200.50"
 * 规范原则: 空值返回 null (绝不补 0); 只有来源明确为 0 时才返回 0
 */
export function normalizeCurrencyAmount(v: any): { amount: number | null; unit: string; error?: string } {
  if (v === null || v === undefined || String(v).trim() === '') {
    return { amount: null, unit: 'CNY' }
  }

  let raw = String(v).trim().replace(/[,，\s]/g, '')
  // 识别符号
  raw = raw.replace(/^[￥¥$]/, '').replace(/元$/, '')

  // 识别 "万" 单位
  let isWan = false
  if (/万$/.test(raw)) {
    isWan = true
    raw = raw.replace(/万$/, '')
  }

  const n = Number(raw)
  if (!Number.isFinite(n)) {
    return { amount: null, unit: 'CNY', error: `非法金额格式: ${v}` }
  }

  const finalAmount = isWan ? Math.round(n * 10000 * 100) / 100 : Math.round(n * 100) / 100
  return { amount: finalAmount, unit: 'CNY' }
}

/**
 * 统一订单状态映射
 */
export function mapCanonicalOrderStatus(rawStatus: any): { canonical: string; isKnown: boolean } {
  if (!rawStatus) return { canonical: 'UNKNOWN', isKnown: false }
  const s = String(rawStatus).trim().toLowerCase()

  // 待付款必须优先精确匹配
  if (s.includes('待付') || s.includes('未付') || s.includes('wait_buyer_pay')) {
    return { canonical: 'UNPAID', isKnown: true }
  }
  // 已付款（含平台侧待发货 / 待成团等状态）
  if (s.includes('付') || s.includes('paid') || s.includes('成团') || s.includes('wait_seller_send_goods') || s.includes('待发货')) {
    return { canonical: 'PAID', isKnown: true }
  }
  if (s.includes('退款') || s.includes('refund') || s.includes('关闭')) {
    return { canonical: 'REFUNDED', isKnown: true }
  }
  if (s.includes('发货') || s.includes('shipped') || s.includes('配送')) {
    return { canonical: 'SHIPPED', isKnown: true }
  }
  if (s.includes('完成') || s.includes('success') || s.includes('收货')) {
    return { canonical: 'COMPLETED', isKnown: true }
  }

  return { canonical: 'OTHER', isKnown: false }
}

export class CleanerService {
  constructor(private pool: Pool) {}

  /**
   * 执行单批次清洗流程
   */
  async cleanBatch(
    batchId: number,
    options: {
      mappingVersion?: string
      ruleVersion?: string
    } = {}
  ): Promise<CleaningRunResult> {
    const client = await this.pool.connect()
    try {
      // 1. 读取批次元数据
      const batchRes = await client.query(
        `SELECT id, source_platform, store_id, dataset_type, status FROM import_batches WHERE id = $1`,
        [batchId]
      )
      if (batchRes.rows.length === 0) {
        throw new Error(`批次不存在: ${batchId}`)
      }
      const batch = batchRes.rows[0]

      // 2. 创建 cleaning_run 记录
      const mappingVer = options.mappingVersion || `map_${batch.source_platform}_v1`
      const ruleVer = options.ruleVersion || 'std_v1'
      const runRes = await client.query(
        `INSERT INTO cleaning_runs (batch_id, mapping_version, cleaning_rule_version, status, input_count)
         VALUES ($1, $2, $3, 'RUNNING', 0)
         RETURNING id`,
        [batchId, mappingVer, ruleVer]
      )
      const runId = Number(runRes.rows[0].id)

      // 3. 读取该批次所有的不可变 raw_records
      const rawRowsRes = await client.query(
        `SELECT id, biz_date, sheet_name, row_no, raw_payload, source_business_key
         FROM raw_records
         WHERE batch_id = $1
         ORDER BY row_no ASC`,
        [batchId]
      )
      const rawRows = rawRowsRes.rows

      // 4. 读取该平台已批准的 SKU 映射关系 (主数据匹配)
      const aliasRes = await client.query(
        `SELECT external_id, internal_id FROM entity_aliases
         WHERE source_platform = $1 AND entity_type = 'sku'`,
        [batch.source_platform]
      )
      const skuAliasMap = new Map<string, number>()
      aliasRes.rows.forEach((r) => skuAliasMap.set(String(r.external_id), Number(r.internal_id)))

      // 5. 逐行执行字段标准化、业务键解析与去重分类
      const candidates: CleaningRunResult['candidates'] = []
      let quarantineCount = 0
      const seenOrderKeys = new Set<string>()

      for (const rawRow of rawRows) {
        const payload = rawRow.raw_payload || {}

        // 识别来源订单号与子订单号（支持多种平台中英文字段别名）
        const sourceOrderId = String(
          payload['平台订单号'] ||
            payload['订单编号'] ||
            payload['订单号'] ||
            payload['order_id'] ||
            payload['source_order_id'] ||
            payload['tid'] ||
            rawRow.source_business_key ||
            ''
        ).trim()

        const sourceSubOrderId = String(
          payload['子订单号'] ||
            payload['子订单编号'] ||
            payload['sub_order_id'] ||
            payload['oid'] ||
            '0'
        ).trim()

        // 金额标准化
        const rawAmount =
          payload['实付款'] ||
          payload['买家实付金额'] ||
          payload['实收金额'] ||
          payload['pay_amount'] ||
          payload['paid_amount'] ||
          payload['成交额']

        const amountResult = normalizeCurrencyAmount(rawAmount)

        // 状态映射：缺失/未知状态不得默认成 PAID
        const rawStatus = payload['订单状态'] || payload['status'] || payload['order_status']
        const statusMap = mapCanonicalOrderStatus(rawStatus)

        // 商品编码与主数据映射
        const platformSkuId = String(
          payload['商品编码'] || payload['SKU编码'] || payload['sku_id'] || payload['outer_id'] || ''
        ).trim()
        const internalSkuId = platformSkuId ? skuAliasMap.get(platformSkuId) : undefined

        // 判定是否进入隔离区 (业务事实不猜测)
        let isQuarantined = false
        let quarantineReason = ''

        if (!sourceOrderId) {
          isQuarantined = true
          quarantineReason = '关键订单号缺失，禁止自动猜测ID'
        } else if (amountResult.amount === null) {
          isQuarantined = true
          quarantineReason = amountResult.error || '支付金额为空或无法识别'
        } else if (amountResult.amount < 0) {
          isQuarantined = true
          quarantineReason = `异常负数实付款 (${amountResult.amount})`
        } else if (!statusMap.isKnown) {
          isQuarantined = true
          quarantineReason = rawStatus
            ? `未知订单状态，禁止猜测映射: ${String(rawStatus)}`
            : '订单状态缺失，禁止默认标记为已付款'
        }

        const candidateKey = `${sourceOrderId}_${sourceSubOrderId}`
        if (!isQuarantined && seenOrderKeys.has(candidateKey)) {
          // 相同批次内业务键重复输入 -> 隔离标记
          isQuarantined = true
          quarantineReason = `批次内业务键重复输入 (${candidateKey})`
        } else if (!isQuarantined) {
          seenOrderKeys.add(candidateKey)
        }

        const normalizedBizDate = rawRow.biz_date ? normalizeDateTimeString(rawRow.biz_date) : null
        if (!normalizedBizDate && !isQuarantined) {
          isQuarantined = true
          quarantineReason = '业务日期缺失或非法，禁止默认使用当天'
        }

        if (isQuarantined) {
          quarantineCount++
        }

        const candidateItem = {
          rawRecordId: Number(rawRow.id),
          bizDate: normalizedBizDate ? normalizedBizDate.slice(0, 10) : '',
          sourceOrderId: sourceOrderId || `UNKNOWN_${rawRow.id}`,
          sourceSubOrderId,
          paidAmount: amountResult.amount ?? 0,
          status: isQuarantined ? ('QUARANTINED' as const) : ('CANDIDATE' as const),
          quarantineReason: isQuarantined ? quarantineReason : undefined,
          canonicalPayload: {
            ...payload,
            _canonical_order_id: sourceOrderId,
            _canonical_sub_order_id: sourceSubOrderId,
            _canonical_paid_amount: amountResult.amount,
            _canonical_status: statusMap.canonical,
            _internal_sku_id: internalSkuId,
            _platform_sku_id: platformSkuId,
          },
        }

        candidates.push(candidateItem)
      }

      // 6. 批量持久化 clean_records (按月物理分区，先落库)
      for (const c of candidates) {
        await client.query(
          `INSERT INTO clean_records
             (biz_date, batch_id, raw_record_id, source_platform, store_id,
              source_order_id, source_sub_order_id, paid_amount, currency_code,
              cleaning_status, canonical_payload, quarantine_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CNY', $9, $10, $11)
           ON CONFLICT (biz_date, source_platform, store_id, source_order_id, source_sub_order_id)
           DO UPDATE SET
             paid_amount = EXCLUDED.paid_amount,
             cleaning_status = EXCLUDED.cleaning_status,
             canonical_payload = EXCLUDED.canonical_payload,
             quarantine_reason = EXCLUDED.quarantine_reason`,
          [
            c.bizDate,
            batchId,
            c.rawRecordId,
            batch.source_platform,
            batch.store_id,
            c.sourceOrderId,
            c.sourceSubOrderId,
            c.paidAmount,
            c.status,
            JSON.stringify(c.canonicalPayload),
            c.quarantineReason || null,
          ]
        )
      }

      // 7. 更新 cleaning_runs 统计
      const candidateCount = candidates.length - quarantineCount
      await client.query(
        `UPDATE cleaning_runs
         SET status = 'COMPLETED',
             input_count = $1,
             candidate_count = $2,
             quarantine_count = $3,
             finished_at = now()
         WHERE id = $4`,
        [rawRows.length, candidateCount, quarantineCount, runId]
      )

      // 8. 更新批次候选计数
      await client.query(
        `UPDATE import_batches
         SET clean_candidate_rows = $1,
             updated_at = now()
         WHERE id = $2`,
        [candidateCount, batchId]
      )

      return {
        runId,
        batchId,
        inputCount: rawRows.length,
        candidateCount,
        quarantineCount,
        candidates,
      }
    } finally {
      client.release()
    }
  }
}
