/**
 * test/channel-pricing-and-reservation.test.ts
 *
 * 验证 Master Plan §5.2 核心领域能力：
 * 1. #9 Channel 级价格与库存配额（不同平台不同价、不同独占配额）
 * 2. #10 库存预留防超卖机制（原子悲观锁、核销出库、超时释放）
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { getPool } from '../src/lib/db.js'
import { buildApp } from '../src/app.js'
import { env } from '../src/config/env.js'

describe('P7 核心领域能力：Channel 级价格与库存配额 + 库存预留防超卖', () => {
  let app: FastifyInstance
  let adminSessionId: string
  let adminCookie: string

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
  })

  after(async () => {
    const pool = getPool()
    if (adminSessionId) {
      await pool.query(`DELETE FROM user_sessions WHERE id = $1`, [adminSessionId])
    }
    await app.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Channel 级定价与库存分配 (Master Plan §5.2 #9)
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/inventory/channel-listings 返回渠道专属定价与配额', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory/channel-listings',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(Array.isArray(json.data))
    assert.ok(json.data.length >= 2, '必须返回种子渠道定价与配额数据')

    const first = json.data[0]
    assert.ok(first.id)
    assert.ok(first.productId)
    assert.ok(first.platformCode)
    assert.ok(first.channelSkuId)
    assert.ok(typeof first.channelPrice === 'number')
    assert.ok(typeof first.allocatedStock === 'number')
    assert.ok(typeof first.reservedStock === 'number')
    assert.ok(typeof first.availableChannelStock === 'number')
    assert.equal(first.availableChannelStock, first.allocatedStock - first.reservedStock)
  })

  let createdListingId: number | undefined
  const testChannelSkuId = `SKU-DY-P7-${Date.now()}`

  test('POST /api/v1/inventory/channel-listings 绑定并配置渠道独立定价与配额', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/channel-listings',
      headers: { cookie: adminCookie },
      payload: {
        productId: 1,
        platformCode: 'douyin',
        shopId: 1,
        channelSkuId: testChannelSkuId,
        channelPrice: 89.90,
        allocatedStock: 600,
        safetyStock: 25,
        isActive: true,
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.channel_sku_id, testChannelSkuId)
    assert.equal(Number(json.data.channel_price), 89.90)
    assert.equal(Number(json.data.allocated_stock), 600)
    createdListingId = json.data.id
  })

  test('PUT /api/v1/inventory/channel-listings/:id 调整渠道售价与配额', async () => {
    assert.ok(createdListingId)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/inventory/channel-listings/${createdListingId}`,
      headers: { cookie: adminCookie },
      payload: {
        channelPrice: 85.00,
        allocatedStock: 550,
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(Number(json.data.channel_price), 85.00)
    assert.equal(Number(json.data.allocated_stock), 550)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 2. 库存预留防超卖（Master Plan §5.2 #10）
  // ──────────────────────────────────────────────────────────────────────────

  const testOrderNo = `ORD-P7-${Date.now()}`
  let reservedNo: string | undefined

  test('POST /api/v1/inventory/reservations/reserve 可用库存不足时严格拒绝', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations/reserve',
      headers: { cookie: adminCookie },
      payload: {
        orderNo: `${testOrderNo}-OVER`,
        productId: 1,
        platformCode: 'douyin',
        shopId: 1,
        reservedQty: 9999999, // 极大数量
      },
    })

    assert.equal(res.statusCode, 400)
    const json = res.json()
    assert.ok(json.error.includes('不足'))
    assert.ok(json.shortage)
  })

  test('POST /api/v1/inventory/reservations/reserve 正常预留原子锁定库存并生成预留单', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations/reserve',
      headers: { cookie: adminCookie },
      payload: {
        orderNo: testOrderNo,
        productId: 1,
        platformCode: 'douyin',
        shopId: 1,
        reservedQty: 5,
        ttlMinutes: 20,
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    const rsv = json.data
    assert.ok(rsv.reservation_no)
    assert.equal(rsv.order_no, testOrderNo)
    assert.equal(Number(rsv.reserved_qty), 5)
    assert.equal(rsv.status, 'reserved')
    assert.ok(rsv.expires_at)
    reservedNo = rsv.reservation_no

    // 检查重复下单防抖（同订单商品不可重复发起未释放预留）
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations/reserve',
      headers: { cookie: adminCookie },
      payload: {
        orderNo: testOrderNo,
        productId: 1,
        platformCode: 'douyin',
        shopId: 1,
        reservedQty: 5,
      },
    })
    assert.equal(dupRes.statusCode, 409)
  })

  test('GET /api/v1/inventory/reservations 查询预留单状态与明细', async () => {
    assert.ok(reservedNo)

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/inventory/reservations?orderNo=${testOrderNo}`,
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(json.data.length >= 1)
    const rsv = json.data[0]
    assert.equal(rsv.reservationNo, reservedNo)
    assert.equal(rsv.status, 'reserved')
    assert.equal(rsv.reservedQty, 5)
  })

  test('POST /api/v1/inventory/reservations/:reservationNo/commit 支付成功核销出库', async () => {
    assert.ok(reservedNo)

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/inventory/reservations/${reservedNo}/commit`,
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.status, 'committed')
    assert.ok(json.data.committed_at)

    // 重复核销阻断
    const dupRes = await app.inject({
      method: 'POST',
      url: `/api/v1/inventory/reservations/${reservedNo}/commit`,
      headers: { cookie: adminCookie },
    })
    assert.equal(dupRes.statusCode, 400)
    assert.ok(dupRes.json().message.includes('不可重复核销'))
  })

  test('POST /api/v1/inventory/reservations/:reservationNo/release 订单取消或超时释放锁定库存', async () => {
    // 1. 创建另一个预留单测试释放流程
    const cancelOrderNo = `ORD-CANCEL-${Date.now()}`
    const rsvRes = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/reservations/reserve',
      headers: { cookie: adminCookie },
      payload: {
        orderNo: cancelOrderNo,
        productId: 1,
        platformCode: 'douyin',
        shopId: 1,
        reservedQty: 3,
      },
    })
    assert.equal(rsvRes.statusCode, 200)
    const cancelRsvNo = rsvRes.json().data.reservation_no
    assert.ok(cancelRsvNo)

    // 2. 释放预留
    const relRes = await app.inject({
      method: 'POST',
      url: `/api/v1/inventory/reservations/${cancelRsvNo}/release`,
      headers: { cookie: adminCookie },
      payload: {
        reason: '买家主动取消订单',
      },
    })
    assert.equal(relRes.statusCode, 200)
    const relJson = relRes.json()
    assert.equal(relJson.data.status, 'released')
    assert.equal(relJson.data.release_reason, '买家主动取消订单')
    assert.ok(relJson.data.released_at)

    // 3. 重复释放阻断
    const dupRel = await app.inject({
      method: 'POST',
      url: `/api/v1/inventory/reservations/${cancelRsvNo}/release`,
      headers: { cookie: adminCookie },
    })
    assert.equal(dupRel.statusCode, 400)
  })
})
