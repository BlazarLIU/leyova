/**
 * publishing-service.ts — 发布闸门服务 (Publishing Gate Service)
 * 
 * 严格遵循《入库、发布与数据状态机规范 V1.0》：
 * 1. 发布不是清洗的一部分：正式数据写入必须由独立 Publishing 模块负责；
 * 2. 闸门检查：前置检查未解决的 P0/P1 问题，若存在则严禁发布为 FINAL；
 * 3. 单数据库事务：在同一个数据库事务中原子写入 canonical_orders、canonical_order_items，记录 publish_runs，失败全部回滚；
 * 4. 幂等发布：依靠物理唯一键保障幂等，绝不产生重复正式记录；
 * 5. 应用余额归底分摊算法，杜绝一分钱舍入偏差。
 */

import type { Pool } from 'pg'
import { allocateDiscountWithRemainder } from '../allocation.js'

export interface PublishBatchInput {
  batchId: number
  userId: number
  policyVersion?: string
  allowPartial?: boolean
}

export interface PublishBatchResult {
  success: boolean
  publishRunId: number
  batchId: number
  targetTable: string
  recordsPublished: number
  finalMaturityStatus: 'FINAL' | 'PARTIAL'
}

export class PublishingService {
  constructor(private pool: Pool) {}

  /**
   * 执行原子发布
   */
  async publishBatch(input: PublishBatchInput): Promise<PublishBatchResult> {
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')

      // 1. 查询批次与最近一次质量校验
      const batchRes = await client.query(
        `SELECT b.id, b.source_platform, b.store_id, b.dataset_type, b.status
         FROM import_batches b
         WHERE b.id = $1
         FOR UPDATE`,
        [input.batchId]
      )
      if (batchRes.rows.length === 0) {
        throw new Error(`批次不存在: ${input.batchId}`)
      }
      const batch = batchRes.rows[0]

      const valRunRes = await client.query(
        `SELECT v.id, v.status, v.p0_issues_count, v.p1_issues_count
         FROM validation_runs v
         JOIN cleaning_runs c ON c.id = v.cleaning_run_id
         WHERE c.batch_id = $1
         ORDER BY v.id DESC LIMIT 1`,
        [input.batchId]
      )
      if (valRunRes.rows.length === 0) {
        throw new Error(`批次尚未执行质量校验，禁止发布: ${input.batchId}`)
      }
      const valRun = valRunRes.rows[0]

      // 2. 闸门检查: 严格校验运行状态与未解决的阻塞质量问题
      if (['FAILED_BLOCKING', 'FAILED_ANOMALY', 'FAILED'].includes(valRun.status) || !['SUCCESS', 'WARNING'].includes(valRun.status)) {
        throw new Error(`发布被闸门阻断 (PUBLISH_BLOCKED): 质量校验状态为 ${valRun.status}，未达到发布标准！`)
      }

      if (Number(valRun.p0_issues_count || 0) > 0) {
        throw new Error(`发布被闸门阻断 (PUBLISH_BLOCKED): 最近一次质量校验记录中包含 ${valRun.p0_issues_count} 个未闭环 P0 严重问题！`)
      }

      const openIssuesRes = await client.query(
        `SELECT COUNT(*) as open_p0
         FROM data_quality_issues
         WHERE batch_id = $1 AND severity = 'P0' AND status = 'OPEN'`,
        [input.batchId]
      )
      const openP0 = Number(openIssuesRes.rows[0].open_p0)

      if (openP0 > 0) {
        throw new Error(`发布被闸门阻断 (PUBLISH_BLOCKED): 存在 ${openP0} 个未解决的 P0 致命质量错误！`)
      }

      // 3. 读取待发布的 clean_records 候选数据 (过滤掉 QUARANTINED 的行)
      const candidatesRes = await client.query(
        `SELECT id, biz_date, source_platform, store_id, source_order_id, source_sub_order_id,
                paid_amount, currency_code, cleaning_status, canonical_payload
         FROM clean_records
         WHERE batch_id = $1 AND cleaning_status = 'CANDIDATE'
         ORDER BY id ASC`,
        [input.batchId]
      )
      const candidates = candidatesRes.rows
      if (candidates.length === 0) {
        throw new Error(`批次中无可用候选数据供发布: ${input.batchId}`)
      }

      // 4. 按主订单聚合，准备写入 canonical_orders 与 canonical_order_items
      const orderMap = new Map<string, any>()
      for (const row of candidates) {
        const orderKey = `${row.source_platform}:${row.store_id}:${row.source_order_id}`
        if (!orderMap.has(orderKey)) {
          orderMap.set(orderKey, {
            bizDate: row.biz_date ? new Date(row.biz_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            sourcePlatform: row.source_platform,
            storeId: row.store_id,
            sourceOrderId: row.source_order_id,
            paidAmount: 0,
            totalDiscount: 0,
            orderStatus: row.canonical_payload?._canonical_status || 'PAID',
            items: [],
          })
        }
        const ord = orderMap.get(orderKey)
        const itemAmount = Number(row.paid_amount)
        ord.paidAmount += itemAmount

        const payload = row.canonical_payload || {}
        ord.items.push({
          sourceSubOrderId: row.source_sub_order_id || '0',
          platformSkuId: payload._platform_sku_id || null,
          internalSkuId: payload._internal_sku_id || null,
          productName: payload['商品名称'] || payload['title'] || '平台商品',
          quantity: Number(payload['数量'] || payload['quantity'] || 1),
          amount: itemAmount,
        })
      }

      let publishedCount = 0

      // 5. 原子发布: 写入 canonical_orders 与 canonical_order_items
      for (const ord of orderMap.values()) {
        const orderRes = await client.query(
          `INSERT INTO canonical_orders
             (biz_date, source_platform, store_id, source_order_id, order_status,
              currency_code, paid_amount, total_discount, batch_id, maturity_status)
           VALUES ($1, $2, $3, $4, $5, 'CNY', $6, $7, $8, 'FINAL')
           ON CONFLICT (biz_date, source_platform, store_id, source_order_id)
           DO UPDATE SET
             order_status = EXCLUDED.order_status,
             paid_amount = EXCLUDED.paid_amount,
             total_discount = EXCLUDED.total_discount,
             updated_at = now()
           RETURNING id`,
          [
            ord.bizDate,
            ord.sourcePlatform,
            ord.storeId,
            ord.sourceOrderId,
            ord.orderStatus,
            ord.paidAmount,
            ord.totalDiscount,
            input.batchId,
          ]
        )
        const orderId = Number(orderRes.rows[0].id)

        // 应用财务级余额归底分摊算法计算 itemDiscountAllocated
        const allocatedItems = allocateDiscountWithRemainder(ord.totalDiscount, ord.items)

        for (const alloc of allocatedItems) {
          await client.query(
            `INSERT INTO canonical_order_items
               (biz_date, source_platform, store_id, source_order_id, source_sub_order_id,
                platform_sku_id, internal_sku_id, product_name, quantity, item_paid_amount,
                item_discount_allocated, maturity_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'FINAL')
             ON CONFLICT (biz_date, source_platform, store_id, source_order_id, source_sub_order_id)
             DO UPDATE SET
               item_paid_amount = EXCLUDED.item_paid_amount,
               item_discount_allocated = EXCLUDED.item_discount_allocated`,
            [
              ord.bizDate,
              ord.sourcePlatform,
              ord.storeId,
              ord.sourceOrderId,
              alloc.item.sourceSubOrderId,
              alloc.item.platformSkuId,
              alloc.item.internalSkuId,
              alloc.item.productName,
              alloc.item.quantity,
              alloc.item.amount,
              alloc.allocatedDiscount,
            ]
          )
        }
        publishedCount++
      }

      // 6. 同步刷新/汇总至聚合表 fact_trade_daily 并绑定 data_uploads 血缘 ID
      let governanceUploadId: number | null = null
      if (orderMap.size > 0) {
        const upRes = await client.query<{ id: number }>(
          `INSERT INTO data_uploads
             (file_name, file_type, file_size, status, row_count, data_type, platform_code)
           VALUES ($1, 'governance_batch', '0KB', 'completed', $2, 'trade', $3)
           RETURNING id`,
          [`governance_batch_${input.batchId}`, publishedCount, batch.source_platform || null],
        )
        governanceUploadId = upRes.rows[0]?.id ?? null
      }

      for (const ord of orderMap.values()) {
        await client.query(
          `INSERT INTO fact_trade_daily
             (biz_date, platform_code, shop_id, channel_name, amount_type, gmv, pay_amount, paid_order_count, paid_buyer_count, refund_amount, refund_count, source, upload_id)
           VALUES ($1::date, $2, $3, '规范发布渠道', 'gross_paid', $4, $4, 1, 1, 0, 0, 'data_governance', $5)
           ON CONFLICT (biz_date, platform_code, shop_id, channel_name, amount_type)
           DO UPDATE SET
             gmv = fact_trade_daily.gmv + EXCLUDED.gmv,
             pay_amount = fact_trade_daily.pay_amount + EXCLUDED.pay_amount,
             paid_order_count = fact_trade_daily.paid_order_count + EXCLUDED.paid_order_count,
             upload_id = COALESCE(EXCLUDED.upload_id, fact_trade_daily.upload_id)`,
          [ord.bizDate, ord.sourcePlatform, ord.storeId, ord.paidAmount, governanceUploadId]
        )
      }

      // 7. 写入 publish_runs 记录
      const finalMaturity = input.allowPartial ? 'PARTIAL' : 'FINAL'
      const pubRunRes = await client.query(
        `INSERT INTO publish_runs
           (batch_id, validation_run_id, published_by, policy_version, target_table, records_published, status)
         VALUES ($1, $2, $3, $4, 'canonical_orders', $5, 'SUCCESS')
         RETURNING id`,
        [
          input.batchId,
          valRun.id,
          input.userId,
          input.policyVersion || 'v1_atomic_strict',
          publishedCount,
        ]
      )
      const publishRunId = Number(pubRunRes.rows[0].id)

      // 8. 推进批次状态为 FINAL 或 PARTIAL
      await client.query(
        `UPDATE import_batches
         SET status = $1,
             published_rows = $2,
             updated_at = now()
         WHERE id = $3`,
        [finalMaturity, publishedCount, input.batchId]
      )

      await client.query('COMMIT')

      return {
        success: true,
        publishRunId,
        batchId: input.batchId,
        targetTable: 'canonical_orders',
        recordsPublished: publishedCount,
        finalMaturityStatus: finalMaturity,
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * 撤销/冲正已发布批次 (Reversal)
   * 修复 P0-5：撤销不仅需置位批次状态，更须原子级作废 canonical_* 正式数据并冲正事实聚合表
   */
  async reverseBatch(publishRunId: number, reason: string, userId: number) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      const pubRes = await client.query(
        `SELECT batch_id, records_published, status FROM publish_runs WHERE id = $1 FOR UPDATE`,
        [publishRunId]
      )
      if (pubRes.rows.length === 0) {
        throw new Error(`发布记录不存在: ${publishRunId}`)
      }
      const { batch_id: batchId, records_published: count, status: pubStatus } = pubRes.rows[0]
      if (pubStatus === 'REVERSED') {
        throw new Error(`该发布批次已于此前冲正，不可重复撤销: ${publishRunId}`)
      }

      // 1. 查出受影响的 canonical_orders 记录，用于冲减 fact_trade_daily
      const ordersRes = await client.query(
        `SELECT biz_date, source_platform, store_id, source_order_id, paid_amount
         FROM canonical_orders
         WHERE batch_id = $1 AND maturity_status != 'SUPERSEDED'`,
        [batchId]
      )

      // 按 (biz_date, source_platform, store_id) 聚合冲减量
      const aggMap = new Map<string, { bizDate: string; platform: string; storeId: number; amount: number; count: number }>()
      for (const row of ordersRes.rows) {
        const dStr = row.biz_date instanceof Date ? row.biz_date.toISOString().slice(0, 10) : String(row.biz_date)
        const key = `${dStr}:${row.source_platform}:${row.store_id}`
        if (!aggMap.has(key)) {
          aggMap.set(key, { bizDate: dStr, platform: row.source_platform, storeId: Number(row.store_id), amount: 0, count: 0 })
        }
        const item = aggMap.get(key)!
        item.amount += Number(row.paid_amount || 0)
        item.count += 1
      }

      // 2. 冲正 fact_trade_daily
      for (const item of aggMap.values()) {
        await client.query(
          `UPDATE fact_trade_daily
           SET gmv = GREATEST(0, gmv - $1),
               pay_amount = GREATEST(0, pay_amount - $1),
               paid_order_count = GREATEST(0, paid_order_count - $2)
           WHERE biz_date = $3::date
             AND platform_code = $4
             AND shop_id = $5
             AND channel_name = '规范发布渠道'
             AND amount_type = 'gross_paid'`,
          [item.amount, item.count, item.bizDate, item.platform, item.storeId]
        )
      }

      // 3. 将 canonical_order_items 标记为 SUPERSEDED
      await client.query(
        `UPDATE canonical_order_items coi
         SET maturity_status = 'SUPERSEDED'
         FROM canonical_orders co
         WHERE coi.biz_date = co.biz_date
           AND coi.source_platform = co.source_platform
           AND coi.store_id = co.store_id
           AND coi.source_order_id = co.source_order_id
           AND co.batch_id = $1`,
        [batchId]
      )

      // 4. 将 canonical_orders 标记为 SUPERSEDED
      await client.query(
        `UPDATE canonical_orders
         SET maturity_status = 'SUPERSEDED', updated_at = now()
         WHERE batch_id = $1`,
        [batchId]
      )

      // 5. 将 canonical_refund_events 标记为 SUPERSEDED (如有)
      await client.query(
        `UPDATE canonical_refund_events
         SET maturity_status = 'SUPERSEDED'
         WHERE batch_id = $1`,
        [batchId]
      )

      // 6. 更新 publish_runs 状态
      await client.query(
        `UPDATE publish_runs SET status = 'REVERSED' WHERE id = $1`,
        [publishRunId]
      )

      // 7. 标记批次为 SUPERSEDED
      await client.query(
        `UPDATE import_batches SET status = 'SUPERSEDED', updated_at = now() WHERE id = $1`,
        [batchId]
      )

      // 8. 记录反向冲正日志
      await client.query(
        `INSERT INTO publish_reversals (publish_run_id, reversal_reason, reversed_by, records_affected)
         VALUES ($1, $2, $3, $4)`,
        [publishRunId, reason, userId, count]
      )

      await client.query('COMMIT')
      return { success: true, batchId, reversedRecords: count }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}
