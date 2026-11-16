/**
 * test/gl-rma-customfields.test.ts
 *
 * 验证 Master Plan §5.2 核心领域能力：
 * 1. #11 总账/凭证层与凭证链（复式记账、借贷平衡、单场净利穿透核算）
 * 2. #12 订单/退款事件流与行级 RMA（状态留痕、行级退换、质检联动入库回仓）
 * 3. #13 自定义字段机制（元数据定义、动态验证、无侵入表扩展）
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { getPool } from '../src/lib/db.js'
import { buildApp } from '../src/app.js'
import { env } from '../src/config/env.js'

describe('P7 核心领域能力：总账凭证链 + 订单事件流与行级RMA + 自定义字段引擎', () => {
  let app: FastifyInstance
  let adminSessionId: string
  let adminCookie: string
  let testSessionId: number
  let testShopId: number
  let testProductId: number

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    const pool = getPool()
    adminSessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 3600_000)
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, 1, $2)`,
      [adminSessionId, expiresAt],
    )
    adminCookie = `${env.SESSION_COOKIE_NAME}=${adminSessionId}`

    const sessRes = await pool.query(`SELECT id FROM live_sessions ORDER BY id LIMIT 1`)
    testSessionId = Number(sessRes.rows[0]?.id || 101)

    const shopRes = await pool.query(`SELECT id FROM dim_shop LIMIT 1`)
    testShopId = Number(shopRes.rows[0]?.id || 1)

    const prodRes = await pool.query(`SELECT id FROM dim_product LIMIT 1`)
    testProductId = Number(prodRes.rows[0]?.id || 1)
  })

  after(async () => {
    const pool = getPool()
    if (adminSessionId) {
      await pool.query(`DELETE FROM user_sessions WHERE id = $1`, [adminSessionId])
    }
    await app.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 1. 总账会计科目与复式记账凭证 (Master Plan §5.2 #11)
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/finance/accounting-subjects 返回标准会计科目字典', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/accounting-subjects',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(Array.isArray(json.data))
    const codes = json.data.map((s: any) => s.account_code)
    assert.ok(codes.includes('1001'), '应包含货币资金科目')
    assert.ok(codes.includes('1122'), '应包含应收账款科目')
    assert.ok(codes.includes('5001'), '应包含主营业务收入')
    assert.ok(codes.includes('5401'), '应包含主营业务成本')
    assert.ok(codes.includes('5601'), '应包含投流费用')
  })

  test('GET /api/v1/finance/gl-vouchers 返回总账凭证列表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/gl-vouchers',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(json.data.total >= 1)
    const first = json.data.items[0]
    assert.ok(first.voucherNo)
    assert.equal(first.isBalanced, true, '种子凭证必须借贷平衡')
    assert.equal(first.totalDebit, first.totalCredit)
  })

  test('POST /api/v1/finance/gl-vouchers 拒绝借贷不平的凭证并提示差额', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/gl-vouchers',
      headers: { cookie: adminCookie },
      payload: {
        bizDate: '2026-11-16',
        voucherType: 'manual_adjust',
        summary: '借贷不平衡测试凭证',
        entries: [
          { accountCode: '5603', direction: 'debit', amount: 500, remark: '仓储费' },
          { accountCode: '1001', direction: 'credit', amount: 480, remark: '银行扣款' },
        ],
      },
    })

    assert.equal(res.statusCode, 400)
    const json = res.json()
    assert.equal(json.success, false)
    assert.match(json.message, /凭证借贷不平衡/)
  })

  test('POST /api/v1/finance/gl-vouchers 成功创建合规复式借贷凭证', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/gl-vouchers',
      headers: { cookie: adminCookie },
      payload: {
        voucherNo: `VOU-TEST-${Date.now().toString().slice(-6)}`,
        bizDate: '2026-11-16',
        voucherType: 'logistics_fee',
        shopId: testShopId,
        sessionId: testSessionId,
        refType: 'live_session',
        refId: String(testSessionId),
        summary: '场次末端顺丰快递履约费划扣',
        entries: [
          { accountCode: '5603', direction: 'debit', amount: 320.50, remark: '快递面单费' },
          { accountCode: '1001', direction: 'credit', amount: 320.50, remark: '企业网银划付' },
        ],
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(Number(json.data.total_debit), 320.50)
    assert.equal(Number(json.data.total_credit), 320.50)
    assert.equal(json.data.is_balanced, true)
  })

  test('GET /api/v1/finance/sessions/:sessionId/voucher-chain 返回单场真实净利完整凭证链', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/finance/sessions/${testSessionId}/voucher-chain`,
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.hasVoucherChain, true)
    assert.ok(json.data.vouchers.length >= 1)
    assert.ok(json.data.entries.length >= 2)
    assert.ok(json.data.reconciliation)
    assert.ok(json.data.reconciliation.isFullyBalanced)
    assert.ok(typeof json.data.reconciliation.reconciledNetProfit === 'number')
  })

  test('GET /api/v1/finance/trial-balance 计算全账套试算平衡表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/trial-balance',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.isBalanced, true, '全账套必须试算平衡')
    assert.equal(json.data.trialDiff, 0)
    assert.ok(json.data.accounts.length >= 5)
  })

  test('GET /api/v1/sessions/:id/full-trace 包含 accounting 凭证链', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${testSessionId}/full-trace`,
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(json.data.accounting, '全链路穿透中应挂载财务凭证链')
    assert.equal(json.data.accounting.hasVoucherChain, true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 2. 订单生命周期事件流与行级 RMA (Master Plan §5.2 #12)
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/after-sales/rma-items 返回行级 RMA 明细', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/after-sales/rma-items',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(json.data.total >= 1)
    const item = json.data.items[0]
    assert.ok(item.rmaNo)
    assert.ok(item.orderId)
    assert.ok(item.subOrderId)
    assert.ok(item.rmaType)
  })

  test('POST /api/v1/after-sales/rma-items 创建行级售后申请并写入事件流', async () => {
    const orderNo = `ORD-TEST-${Date.now().toString().slice(-6)}`
    const subOrderNo = `${orderNo}-01`

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/after-sales/rma-items',
      headers: { cookie: adminCookie },
      payload: {
        sourcePlatform: 'douyin',
        storeId: testShopId,
        sourceOrderId: orderNo,
        sourceSubOrderId: subOrderNo,
        internalSkuId: testProductId,
        productName: '测试保暖冲锋衣',
        rmaType: 'return_and_refund',
        returnQuantity: 2,
        refundAmount: 518.00,
        reasonCategory: 'quality_issue',
        reasonDetail: '衣服走线脱开',
        returnTrackingNo: 'SF8899112233',
        returnLogisticsCompany: '顺丰速运',
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(json.data.rma_no)
    assert.equal(Number(json.data.return_quantity), 2)
    assert.equal(json.data.status, 'pending')

    // 验证事件流时间轴
    const tlRes = await app.inject({
      method: 'GET',
      url: `/api/v1/orders/${orderNo}/timeline`,
      headers: { cookie: adminCookie },
    })

    assert.equal(tlRes.statusCode, 200)
    const tlJson = tlRes.json()
    assert.equal(tlJson.data.orderId, orderNo)
    assert.ok(tlJson.data.events.some((e: any) => e.eventType === 'rma_created'))
    assert.ok(tlJson.data.rmaItems.length >= 1)
  })

  test('PUT /api/v1/after-sales/rma-items/:id/status 审核通过质检并自动入库回仓', async () => {
    const pool = getPool()
    // 获取当前在库库存
    const stockBeforeRes = await pool.query(
      `SELECT on_hand_qty FROM fact_inventory_stock WHERE product_id = $1 AND warehouse_code = 'MAIN_WH'`,
      [testProductId],
    )
    const beforeOnHand = Number(stockBeforeRes.rows[0]?.on_hand_qty || 0)

    // 查询最新待处理的 RMA
    const rmaListRes = await pool.query(
      `SELECT id, internal_sku_id, return_quantity FROM fact_order_rma_item WHERE status = 'pending' ORDER BY id DESC LIMIT 1`,
    )
    assert.ok(rmaListRes.rows.length > 0)
    const rmaId = rmaListRes.rows[0].id
    const qty = Number(rmaListRes.rows[0].return_quantity)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/after-sales/rma-items/${rmaId}/status`,
      headers: { cookie: adminCookie },
      payload: {
        status: 'completed',
        inspectionStatus: 'passed',
        restockStatus: 'restocked_to_warehouse',
        warehouseCode: 'MAIN_WH',
        remark: '退件外包装完好吊牌齐全，验收回仓',
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.status, 'completed')
    assert.equal(json.data.inspection_status, 'passed')
    assert.equal(json.data.restock_status, 'restocked_to_warehouse')

    // 验证库存自动增加与流水记账
    const stockAfterRes = await pool.query(
      `SELECT on_hand_qty FROM fact_inventory_stock WHERE product_id = $1 AND warehouse_code = 'MAIN_WH'`,
      [testProductId],
    )
    const afterOnHand = Number(stockAfterRes.rows[0]?.on_hand_qty || 0)
    assert.equal(afterOnHand, beforeOnHand + qty, '质检入库应增加实物在库')

    const ledgerRes = await pool.query(
      `SELECT * FROM fact_inventory_ledger WHERE change_type = 'return_in' ORDER BY id DESC LIMIT 1`,
    )
    assert.ok(ledgerRes.rows.length > 0)
    assert.equal(Number(ledgerRes.rows[0].delta_qty), qty)
  })

  test('POST /api/v1/orders/:orderId/events 记录订单状态节点', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/ORD-TEST-FLOW-001/events',
      headers: { cookie: adminCookie },
      payload: {
        sourcePlatform: 'douyin',
        storeId: testShopId,
        eventType: 'shipped',
        fromStatus: 'WAIT_SHIP',
        toStatus: 'SHIPPED',
        operatorName: '仓储系统自动扫描',
        payload: { carrier: 'SF', trackingNo: 'SF1099220011' },
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.event_type, 'shipped')
    assert.equal(json.data.source_order_id, 'ORD-TEST-FLOW-001')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 3. 自定义字段机制 (Master Plan §5.2 #13)
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/system/custom-fields/definitions 查询预置自定义字段', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/system/custom-fields/definitions?entityType=live_session',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(Array.isArray(json.data))
    const keys = json.data.map((d: any) => d.fieldKey)
    assert.ok(keys.includes('douyin_room_level'), '应包含抖音直播间评级')
  })

  test('POST & PUT /api/v1/system/custom-fields/definitions 管理元定义', async () => {
    const key = `test_prop_${Date.now().toString().slice(-4)}`
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/system/custom-fields/definitions',
      headers: { cookie: adminCookie },
      payload: {
        entityType: 'product',
        fieldKey: key,
        fieldLabel: '商品适用温标',
        dataType: 'string',
        platformCode: 'douyin',
        isRequired: false,
        defaultValue: '-10℃ ~ 5℃',
        description: '户外保暖服装推荐温度区间',
      },
    })

    assert.equal(createRes.statusCode, 200)
    const createJson = createRes.json()
    assert.equal(createJson.success, true)
    const defId = createJson.data.id

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/system/custom-fields/definitions/${defId}`,
      headers: { cookie: adminCookie },
      payload: {
        fieldLabel: '适用极端温标',
        defaultValue: '-20℃ ~ 0℃',
      },
    })

    assert.equal(updateRes.statusCode, 200)
    const updateJson = updateRes.json()
    assert.equal(updateJson.data.field_label, '适用极端温标')
  })

  test('POST /api/v1/system/custom-fields/values/batch-save 校验并保存字段值，同步 host entity JSONB', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/system/custom-fields/values/batch-save',
      headers: { cookie: adminCookie },
      payload: {
        entityType: 'live_session',
        entityId: String(testSessionId),
        values: {
          douyin_room_level: 'S',
          streamer_dress_code: '红色羽绒服 + 滑雪护目镜',
        },
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.savedFields.douyin_room_level, 'S')

    // 验证 GET 读取
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/system/custom-fields/values?entityType=live_session&entityId=${testSessionId}`,
      headers: { cookie: adminCookie },
    })

    assert.equal(getRes.statusCode, 200)
    const getJson = getRes.json()
    assert.equal(getJson.data.values.douyin_room_level, 'S')
    assert.equal(getJson.data.values.streamer_dress_code, '红色羽绒服 + 滑雪护目镜')

    // 验证同步到了 live_sessions 表自身的 custom_fields JSONB 字段
    const pool = getPool()
    const sessRes = await pool.query(
      `SELECT custom_fields FROM live_sessions WHERE id = $1`,
      [testSessionId],
    )
    const cf = sessRes.rows[0]?.custom_fields || {}
    assert.equal(cf.douyin_room_level, 'S')
  })

  test('POST /api/v1/system/custom-fields/values/batch-save 阻断非法选项', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/system/custom-fields/values/batch-save',
      headers: { cookie: adminCookie },
      payload: {
        entityType: 'live_session',
        entityId: String(testSessionId),
        values: {
          douyin_room_level: 'INVALID_LEVEL_Z',
        },
      },
    })

    assert.equal(res.statusCode, 400)
    const json = res.json()
    assert.equal(json.success, false)
    assert.match(json.message, /选项无效/)
  })
})
