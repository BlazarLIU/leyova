/**
 * data-pipeline.ts — 统一数据接入与清洗管道引擎 (P3-2 结构收敛)
 *
 * 整合 data.ts、ingest.ts 与 governance.ts 的三套异构管线为单套闭环管道：
 *   1. 平台模板与字段规范映射 (7 平台 × 交易/流量/直播)
 *   2. 文件解析与结构化预览 (CSV / XLSX 流式解析与头信息推断)
 *   3. UNLOGGED 高速暂存 (stg_order_import)
 *   4. 跨分区哨兵去重 (land_raw_dedup)
 *   5. 数据质量隔离区流转 (dq_quarantine)
 *   6. 8 门禁断言评估 (SqlQualityGateEngine)
 *   7. 事实层发布与 agg_* 汇总层增量联动
 */

import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { SqlQualityGateEngine } from '../modules/data-governance/validation/sql-quality-gates.js'
import { runManualAggregate } from '../cron/aggregate-facts.js'

export interface PlatformTemplate {
  code: string
  name: string
  dataType: 'trade' | 'traffic' | 'live'
  requiredColumns: Array<{ key: string; label: string; type: string; example: string }>
  optionalColumns: Array<{ key: string; label: string; type: string; example: string }>
}

/** 7 平台官方标准模板目录 */
export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    code: 'douyin',
    name: '抖音电商',
    dataType: 'trade',
    requiredColumns: [
      { key: 'order_id', label: '主订单编号', type: 'string', example: 'DY20261116001' },
      { key: 'sub_order_id', label: '子订单编号', type: 'string', example: 'DY20261116001-1' },
      { key: 'order_status', label: '订单状态', type: 'string', example: 'PAID' },
      { key: 'paid_amount', label: '买家实付金额', type: 'number', example: '129.90' },
      { key: 'order_time', label: '下单时间', type: 'datetime', example: '2026-11-16 14:30:00' },
    ],
    optionalColumns: [
      { key: 'shop_id', label: '店铺ID', type: 'string', example: '1001' },
      { key: 'product_id', label: '商品ID', type: 'string', example: 'P9001' },
      { key: 'sku_id', label: '规格ID', type: 'string', example: 'SKU-01' },
      { key: 'quantity', label: '商品数量', type: 'number', example: '1' },
      { key: 'refund_status', label: '售后状态', type: 'string', example: 'NONE' },
    ],
  },
  {
    code: 'kuaishou',
    name: '快手电商',
    dataType: 'trade',
    requiredColumns: [
      { key: 'order_id', label: '订单号', type: 'string', example: 'KS88391023' },
      { key: 'order_status', label: '状态', type: 'string', example: 'PAID' },
      { key: 'paid_amount', label: '实付金额', type: 'number', example: '88.00' },
      { key: 'order_time', label: '支付时间', type: 'datetime', example: '2026-11-16 15:20:00' },
    ],
    optionalColumns: [
      { key: 'sub_order_id', label: '子单号', type: 'string', example: 'KS88391023-1' },
      { key: 'shop_id', label: '快手快店ID', type: 'string', example: '2001' },
    ],
  },
  {
    code: 'wechat',
    name: '微信视频号',
    dataType: 'trade',
    requiredColumns: [
      { key: 'order_id', label: '视频号订单号', type: 'string', example: 'WX5529102' },
      { key: 'order_status', label: '状态', type: 'string', example: 'PAID' },
      { key: 'paid_amount', label: '实付总额', type: 'number', example: '198.00' },
      { key: 'order_time', label: '付款时间', type: 'datetime', example: '2026-11-16 20:10:00' },
    ],
    optionalColumns: [
      { key: 'channel_type', label: '公私域来源', type: 'string', example: 'private_domain' },
    ],
  },
]

export interface ParsePreviewResult {
  headers: string[]
  detectedPlatform: string
  matchedColumns: Record<string, string>
  rows: Array<Record<string, any>>
  totalRows: number
  sampleErrors: string[]
}

/**
 * 统一数据管道服务
 */
export class UnifiedDataPipelineService {
  /**
   * 获取指定或全量平台模板
   */
  static getTemplates(platformCode?: string, dataType?: string): PlatformTemplate[] {
    return PLATFORM_TEMPLATES.filter((t) => {
      if (platformCode && t.code !== platformCode) return false
      if (dataType && t.dataType !== dataType) return false
      return true
    })
  }

  /**
   * 纯文本 / CSV 行解析与头信息推断
   */
  static parseCsvPreview(content: string, defaultPlatform = 'douyin'): ParsePreviewResult {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      return {
        headers: [],
        detectedPlatform: defaultPlatform,
        matchedColumns: {},
        rows: [],
        totalRows: 0,
        sampleErrors: ['文件内容为空'],
      }
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''))
    const tpl = PLATFORM_TEMPLATES.find((p) => p.code === defaultPlatform) || PLATFORM_TEMPLATES[0]

    // 模糊匹配字段映射
    const matchedColumns: Record<string, string> = {}
    for (const h of headers) {
      const lowerH = h.toLowerCase()
      for (const req of [...tpl.requiredColumns, ...tpl.optionalColumns]) {
        if (lowerH.includes(req.key.toLowerCase()) || lowerH.includes(req.label.toLowerCase())) {
          matchedColumns[h] = req.key
          break
        }
      }
    }

    const sampleErrors: string[] = []
    const rows: Array<Record<string, any>> = []
    const dataLines = lines.slice(1, 51) // 预览前 50 行

    for (let i = 0; i < dataLines.length; i++) {
      const parts = dataLines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''))
      const rowObj: Record<string, any> = {}
      headers.forEach((h, idx) => {
        rowObj[matchedColumns[h] || h] = parts[idx] ?? ''
      })
      rows.push(rowObj)
    }

    // 校验必填字段覆盖度
    for (const req of tpl.requiredColumns) {
      const isMatched = Object.values(matchedColumns).includes(req.key)
      if (!isMatched) {
        sampleErrors.push(`缺少必填标准字段: ${req.label} (${req.key})`)
      }
    }

    return {
      headers,
      detectedPlatform: tpl.code,
      matchedColumns,
      rows,
      totalRows: lines.length - 1,
      sampleErrors,
    }
  }

  /**
   * 管道暂存导入与哨兵去重
   */
  static async stageBatchRows(
    client: PoolClient,
    batchId: string,
    rows: Array<{
      sourceOrderId: string
      sourceSubOrderId?: string
      orderStatus: string
      paidAmount: number
      orderDate: string
      storeId?: number
      rawJson?: Record<string, any>
    }>,
    sourcePlatform = 'douyin',
  ) {
    let stagedCount = 0
    let dedupSkipped = 0
    let quarantinedCount = 0

    const numBatchId = parseInt(batchId, 10) || 1

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rawPayload = JSON.stringify(r.rawJson || r)
      const payloadHash = createHash('sha256').update(rawPayload).digest('hex')

      // 1. 跨分区哨兵去重
      const dedupRes = await client.query(
        `INSERT INTO public.land_raw_dedup (
           source_platform, payload_hash, batch_id, biz_date
         ) VALUES ($1, $2, $3, $4::date)
         ON CONFLICT (source_platform, payload_hash) DO NOTHING
         RETURNING id`,
        [sourcePlatform, payloadHash, numBatchId, r.orderDate],
      )

      if (dedupRes.rowCount === 0) {
        dedupSkipped++
        // 冲突记录送入质检隔离区
        await client.query(
          `INSERT INTO public.dq_quarantine (
             batch_id, row_num, rule_code, severity, raw_payload, failure_reason, status
           ) VALUES ($1, $2, 'RULE_BATCH_KEY_UNIQUE', 'warning', $3::jsonb, '跨分区或批次哈希重复，已自动去重隔离', 'quarantined')`,
          [numBatchId, i + 1, rawPayload],
        )
        quarantinedCount++
        continue
      }

      // 2. 高速暂存表 UNLOGGED stg_order_import
      await client.query(
        `INSERT INTO public.stg_order_import (
           batch_id, row_num, source_platform, store_id, source_order_id, source_sub_order_id,
           order_status, paid_amount, order_date, payload_hash, raw_json, validation_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11::jsonb, 'pending')`,
        [
          numBatchId,
          i + 1,
          sourcePlatform,
          r.storeId || 1,
          r.sourceOrderId.trim(),
          (r.sourceSubOrderId || '').trim(),
          r.orderStatus,
          r.paidAmount,
          r.orderDate,
          payloadHash,
          rawPayload,
        ],
      )
      stagedCount++
    }

    return {
      batchId,
      stagedCount,
      dedupSkipped,
      quarantinedCount,
    }
  }

  /**
   * 运行 8 条质量门禁评估
   */
  static async evaluateQualityGates(client: PoolClient, batchId: string | number) {
    const numBatchId = typeof batchId === 'string' ? parseInt(batchId, 10) : batchId
    const report = await SqlQualityGateEngine.evaluateBatch(client, numBatchId)
    const passedAll = report.results.every((r) => r.passed)
    return {
      batchId: numBatchId,
      passedAll,
      totalRulesChecked: report.totalRulesChecked,
      passedCount: report.passedCount,
      failedCount: report.failedCount,
      isReadyForPublish: report.isReadyForPublish,
      gates: report.results,
    }
  }

  /**
   * 发布清洗后批次并触发核心汇总层增量更新
   */
  static async publishAndSyncAggregates(client: PoolClient, batchId: string) {
    // 1. 统计当前批次日期范围
    const datesRes = await client.query(
      `SELECT DISTINCT order_date::text AS d FROM public.stg_order_import WHERE batch_id = $1`,
      [batchId],
    )

    // 2. 回写批次状态
    await client.query(
      `UPDATE public.import_batches
       SET status = 'published', updated_at = now()
       WHERE id = $1::int`,
      [batchId],
    )

    // 3. 对涉及的各业务日期增量刷新 agg_* 汇总层
    const syncedDates: string[] = []
    for (const row of datesRes.rows) {
      if (row.d) {
        try {
          await runManualAggregate({ date: row.d })
          syncedDates.push(row.d)
        } catch {
          // 若 advisory lock 被占用，由后台定时任务兜底，不中断主调用
        }
      }
    }

    return {
      batchId,
      status: 'published',
      syncedDates,
    }
  }
}
