import test from 'node:test'
import assert from 'node:assert/strict'
import { getPool, withRlsContext } from '../src/lib/db.js'
import { UnifiedDataPipelineService } from '../src/services/data-pipeline.js'
import { PlatformAdapterService } from '../src/services/platform-adapter.js'

test('P3-2 & P3-3: 统一数据管道 (UnifiedDataPipelineService) 与平台配置化 (PlatformAdapterService)', async (t) => {
  const pool = getPool()

  // ──────────────────────────────────────────────────────────────────────────
  // 1. UnifiedDataPipelineService 管道能力
  // ──────────────────────────────────────────────────────────────────────────

  await t.test('getTemplates 返回 7 大平台标准规范与必要字段', () => {
    const allTemplates = UnifiedDataPipelineService.getTemplates()
    assert.ok(allTemplates.length >= 6, '应覆盖至少 6 大核心电商平台')

    const dy = UnifiedDataPipelineService.getTemplates('douyin')[0]
    assert.ok(dy, '抖音模板应存在')
    assert.equal(dy.dataType, 'trade')
    assert.ok(dy.requiredColumns.some((c) => c.key === 'order_id'))
    assert.ok(dy.requiredColumns.some((c) => c.key === 'paid_amount'))
  })

  await t.test('parseCsvPreview 结构化解析 CSV 表头与字段映射', () => {
    const csvContent = `主订单编号,买家实付金额,订单状态,下单时间\nDY9901,199.50,PAID,2026-11-16 12:00:00\nDY9902,89.00,PAID,2026-11-16 12:05:00`
    const preview = UnifiedDataPipelineService.parseCsvPreview(csvContent, 'douyin')

    assert.equal(preview.headers.length, 4)
    assert.equal(preview.totalRows, 2)
    assert.equal(preview.rows.length, 2)
    assert.equal(preview.rows[0].order_id, 'DY9901')
    assert.equal(preview.rows[0].paid_amount, '199.50')
  })

  await t.test('stageBatchRows 高速暂存、哨兵去重与隔离区流转', async () => {
    const client = await pool.connect()
    let testBatchId = 0
    try {
      // 准备批次主记录
      const batchNo = `BATCH-P3-${Date.now()}`
      const bRes = await client.query(
        `INSERT INTO public.import_batches (
           batch_no, source_platform, store_id, dataset_type, source_channel, status, total_raw_rows
         ) VALUES ($1, 'douyin', 1, 'orders', 'manual_file', 'staged', 0)
         RETURNING id`,
        [batchNo],
      )
      testBatchId = Number(bRes.rows[0].id)
      const batchIdStr = String(testBatchId)

      const orderA = `ORD-P3-${Date.now()}-A`
      const orderB = `ORD-P3-${Date.now()}-B`

      // 首次暂存：2 条均成功
      const firstRes = await UnifiedDataPipelineService.stageBatchRows(
        client,
        batchIdStr,
        [
          { sourceOrderId: orderA, orderStatus: 'PAID', paidAmount: 120.00, orderDate: '2026-11-16' },
          { sourceOrderId: orderB, orderStatus: 'PAID', paidAmount: 88.50, orderDate: '2026-11-16' },
        ],
        'douyin',
      )
      assert.equal(firstRes.stagedCount, 2)
      assert.equal(firstRes.dedupSkipped, 0)
      assert.equal(firstRes.quarantinedCount, 0)

      // 重复暂存 orderA：命中哨兵去重，自动隔离
      const dupRes = await UnifiedDataPipelineService.stageBatchRows(
        client,
        batchIdStr,
        [
          { sourceOrderId: orderA, orderStatus: 'PAID', paidAmount: 120.00, orderDate: '2026-11-16' },
        ],
        'douyin',
      )
      assert.equal(dupRes.stagedCount, 0)
      assert.equal(dupRes.dedupSkipped, 1)
      assert.equal(dupRes.quarantinedCount, 1)

      // 验证隔离区记录
      const qRes = await client.query(
        `SELECT rule_code, raw_payload FROM public.dq_quarantine WHERE batch_id = $1`,
        [testBatchId],
      )
      assert.equal(qRes.rows.length, 1)
      assert.equal(qRes.rows[0].rule_code, 'RULE_BATCH_KEY_UNIQUE')
      assert.ok(JSON.stringify(qRes.rows[0].raw_payload).includes(orderA))
    } finally {
      if (testBatchId) {
        const batchIdStr = String(testBatchId)
        await client.query(`DELETE FROM public.stg_order_import WHERE batch_id = $1`, [batchIdStr])
        await client.query(`DELETE FROM public.dq_quarantine WHERE batch_id = $1`, [batchIdStr])
        await client.query(`DELETE FROM public.import_batches WHERE id = $1`, [testBatchId])
      }
      client.release()
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PlatformAdapterService 平台配置化
  // ──────────────────────────────────────────────────────────────────────────

  await t.test('PlatformAdapterService 获取店铺指标聚合与特征增强', async () => {
    const client = await pool.connect()
    try {
      // 查找一个真实有效的店铺
      const shopRes = await client.query(
        `SELECT id, platform_code FROM public.dim_shop WHERE platform_code = 'douyin' LIMIT 1`,
      )
      if (shopRes.rows.length === 0) return

      const shop = shopRes.rows[0]

      // 1. 正常查询
      const res = await PlatformAdapterService.getShopMetrics(
        client,
        shop.id,
        'douyin',
        { from: '2026-10-01', to: '2026-11-16' },
        true,
      )
      assert.equal(res.ok, true)
      if (res.ok) {
        assert.ok(res.trade !== undefined)
        assert.ok(res.traffic !== undefined)
        assert.ok(res.adSummary !== undefined)
      }

      // 2. 跨平台越权校验：用 douyin 店铺查 kuaishou 平台应拒绝
      const crossRes = await PlatformAdapterService.getShopMetrics(
        client,
        shop.id,
        'kuaishou',
        { from: '2026-10-01', to: '2026-11-16' },
        true,
      )
      assert.equal(crossRes.ok, false)
      assert.equal(crossRes.statusCode, 400)
    } finally {
      client.release()
    }
  })

  await t.test('PlatformAdapterService 广告投放成本脱敏', async () => {
    const client = await pool.connect()
    try {
      const shopRes = await client.query(
        `SELECT id FROM public.dim_shop WHERE platform_code = 'douyin' LIMIT 1`,
      )
      if (shopRes.rows.length === 0) return
      const shopId = shopRes.rows[0].id

      // allowAd = false 时，ad_spend 必须为 null 脱敏
      const maskedRes = await PlatformAdapterService.getShopMetrics(
        client,
        shopId,
        'douyin',
        { from: '2026-10-01', to: '2026-11-16' },
        false,
      )
      assert.equal(maskedRes.ok, true)
      if (maskedRes.ok) {
        assert.equal(maskedRes.adSummary.total_ad_spend, null)
        assert.equal(maskedRes.adSummary.total_attributed_gmv, null)
      }
    } finally {
      client.release()
    }
  })
})
