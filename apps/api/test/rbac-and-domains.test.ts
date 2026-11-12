/**
 * rbac-and-domains.test.ts — Fastify.inject() 端到端 HTTP 集成与 RBAC 权限回归测试
 *
 * 覆盖：
 *  1. 健康与就绪探针 (/api/v1/health, /api/v1/ready)
 *  2. 认证拦截、防爆破锁定 (5 次错误 -> 429)
 *  3. ad_buyer / operator / brand_viewer / finance 角色二维越权矩阵 (ROI、成本、内容、大促试算)
 *  4. 跨平台越权守卫 (/taobao/shop/1/metrics 拒绝 douyin 店铺返回 400)
 *  5. MCP fail-closed 鉴权与 HMAC 签名校验
 *  6. 语义层 buildMetricQuery 投流指标角色隔离
 */

import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { getPool } from '../src/lib/db.js'
import { signMcpUserId, timingSafeTokenEqual, verifyMcpUserSig } from '../src/lib/mcp-auth.js'
import { buildMetricQuery } from '../src/ai/semantic-layer.js'

interface TempAccount {
  userId: number
  username: string
  sessionId: string
  cookie: string
}

async function createTempAccount(
  role: string,
  userType: string = 'agency_staff',
  tenantId: number = 1,
): Promise<TempAccount> {
  const pool = getPool()
  const suffix = `${role}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const username = `__t_${suffix}`
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (username, password_hash, real_name, role, user_type, tenant_id, status)
     VALUES ($1, '$2a$10$InvalidTestHashOnlyForSessionTests000000000000000000', $2, $3, $4, $5, 1)
     RETURNING id`,
    [username, `Test ${role}`, role, userType, tenantId],
  )
  const userId = Number(rows[0].id)
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 3600_000)
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, expiresAt],
  )
  return {
    userId,
    username,
    sessionId,
    cookie: `${env.SESSION_COOKIE_NAME}=${sessionId}`,
  }
}

describe('HTTP API & RBAC 回归测试', () => {
  let app: FastifyInstance
  const createdUserIds: number[] = []
  const bruteForceUser = `__test_lockout_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`

  let adBuyer: TempAccount
  let operatorUser: TempAccount
  let brandViewer: TempAccount
  let financeUser: TempAccount

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    adBuyer = await createTempAccount('ad_buyer', 'agency_staff', 1)
    operatorUser = await createTempAccount('operator', 'agency_staff', 1)
    brandViewer = await createTempAccount('brand_viewer', 'brand_viewer', 1)
    financeUser = await createTempAccount('finance', 'agency_staff', 1)
    createdUserIds.push(adBuyer.userId, operatorUser.userId, brandViewer.userId, financeUser.userId)
  })

  after(async () => {
    const pool = getPool()
    if (createdUserIds.length > 0) {
      await pool.query(`DELETE FROM audit_logs WHERE actor_user_id = ANY($1::int[])`, [createdUserIds])
      await pool.query(`DELETE FROM user_sessions WHERE user_id = ANY($1::int[])`, [createdUserIds])
      await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [createdUserIds])
    }
    await pool.query(`DELETE FROM audit_logs WHERE resource_id = $1`, [bruteForceUser])
    await app.close()
  })

  test('健康检查与就绪探针返回 200', async () => {
    const healthRes = await app.inject({ method: 'GET', url: '/api/v1/health' })
    assert.equal(healthRes.statusCode, 200)
    const healthBody = healthRes.json()
    assert.equal(healthBody.success, true)
    assert.equal(healthBody.data.ok, true)
    assert.equal(healthBody.data.db, 'connected')

    const readyRes = await app.inject({ method: 'GET', url: '/api/v1/ready' })
    assert.equal(readyRes.statusCode, 200)
    const readyBody = readyRes.json()
    assert.equal(readyBody.success, true)
    assert.equal(readyBody.data.schemaReady, true)
  })

  test('未登录请求被全局鉴权拦截返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/bi/roi' })
    assert.equal(res.statusCode, 401)
  })

  test('连续 5 次错误密码登录触发防爆破临时锁定并返回 429', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: bruteForceUser, password: 'wrong-password' },
      })
      assert.equal(res.statusCode, 401)
    }

    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: bruteForceUser, password: 'wrong-password' },
    })
    assert.equal(lockedRes.statusCode, 429)
  })

  test('ad_buyer 允许访问投流/关键词/ROI 看板，但禁止访问成本台账 (/costs)', async () => {
    const roiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bi/roi',
      headers: { cookie: adBuyer.cookie },
    })
    assert.equal(roiRes.statusCode, 200)
    assert.equal(roiRes.json().success, true)

    const netRoiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/net-roi/overview',
      headers: { cookie: adBuyer.cookie },
    })
    assert.equal(netRoiRes.statusCode, 200)
    assert.equal(netRoiRes.json().success, true)

    const kwRes = await app.inject({
      method: 'GET',
      url: '/api/v1/search-keywords',
      headers: { cookie: adBuyer.cookie },
    })
    assert.equal(kwRes.statusCode, 200)
    assert.equal(kwRes.json().success, true)

    const costsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/costs',
      headers: { cookie: adBuyer.cookie },
    })
    assert.equal(costsRes.statusCode, 403)
  })

  test('operator 禁止访问 BI ROI 与 Net-ROI，允许访问退款分析与抖音店铺指标，跨平台店铺越权返回 400', async () => {
    const roiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bi/roi',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(roiRes.statusCode, 403)

    const netRoiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/net-roi/overview',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(netRoiRes.statusCode, 403)

    const refundRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bi/refund',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(refundRes.statusCode, 200)
    assert.equal(refundRes.json().success, true)

    const douyinShopRes = await app.inject({
      method: 'GET',
      url: '/api/v1/douyin/shop/1/metrics',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(douyinShopRes.statusCode, 200)
    assert.equal(douyinShopRes.json().success, true)

    const mismatchRes = await app.inject({
      method: 'GET',
      url: '/api/v1/taobao/shop/1/metrics',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(mismatchRes.statusCode, 400)
  })

  test('brand_viewer 无显式成本授权时禁止查看 BI ROI，且写接口均被拒绝返回 403', async () => {
    const roiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bi/roi',
      headers: { cookie: brandViewer.cookie },
    })
    assert.equal(roiRes.statusCode, 403)

    const schedGetRes = await app.inject({
      method: 'GET',
      url: '/api/v1/content/schedules',
      headers: { cookie: brandViewer.cookie },
    })
    assert.equal(schedGetRes.statusCode, 200)

    const schedPostRes = await app.inject({
      method: 'POST',
      url: '/api/v1/content/schedules',
      headers: { cookie: brandViewer.cookie },
      payload: { title: '非法写入测试', platformCode: 'douyin' },
    })
    assert.equal(schedPostRes.statusCode, 403)

    const compGetRes = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/events',
      headers: { cookie: brandViewer.cookie },
    })
    assert.equal(compGetRes.statusCode, 200)

    const promoPostRes = await app.inject({
      method: 'POST',
      url: '/api/v1/promotions/rules',
      headers: { cookie: brandViewer.cookie },
      payload: { platformCode: 'douyin', ruleLayer: 1, ruleName: '未授权规则', discountMode: 'rate', discountValue: 0.9 },
    })
    assert.equal(promoPostRes.statusCode, 403)
  })

  test('大促 5 层试算对非财务角色脱敏成本，对 finance 返回真实净毛利', async () => {
    const simPayload = {
      retailPrice: 200,
      costPrice: 80,
      platformFeeRate: 0.05,
      rules: [
        { ruleLayer: 1, ruleName: '官方立减', discountMode: 'rate', discountValue: 0.85, merchantCostRatio: 1, platformCostRatio: 0 },
      ],
    }

    const opRes = await app.inject({
      method: 'POST',
      url: '/api/v1/promotions/simulate',
      headers: { cookie: operatorUser.cookie },
      payload: simPayload,
    })
    assert.equal(opRes.statusCode, 200)
    const opData = opRes.json().data
    assert.equal(opData.costMasked, true)
    assert.equal(opData.costPrice, null)
    assert.equal(opData.netMargin, null)

    const finRes = await app.inject({
      method: 'POST',
      url: '/api/v1/promotions/simulate',
      headers: { cookie: financeUser.cookie },
      payload: simPayload,
    })
    assert.equal(finRes.statusCode, 200)
    const finData = finRes.json().data
    assert.equal(finData.costMasked, false)
    assert.equal(finData.costPrice, 80)
    assert.equal(typeof finData.netMargin, 'number')

    const finCosts = await app.inject({
      method: 'GET',
      url: '/api/v1/costs',
      headers: { cookie: financeUser.cookie },
    })
    assert.equal(finCosts.statusCode, 200)
  })

  test('MCP fail-closed 鉴权：缺失或无效 X-Leyova-User-Id 返回 401，无效 HMAC 签名返回 403', async () => {
    const missingIdRes = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${env.LEYOVA_MCP_TOKEN}`,
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    assert.equal(missingIdRes.statusCode, 401)

    const badSigRes = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${env.LEYOVA_MCP_TOKEN}`,
        'x-leyova-user-id': String(adBuyer.userId),
        'x-leyova-user-sig': '0'.repeat(64),
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    assert.equal(badSigRes.statusCode, 403)
  })

  test('语义层 buildMetricQuery 对无权限角色阻断投流指标并校验 MCP HMAC 工具函数', () => {
    assert.throws(
      () =>
        buildMetricQuery(
          { metrics: ['ad_spend'], timeRange: { from: '2026-11-01', to: '2026-11-11' } },
          null,
          { role: 'operator' },
        ),
      /无权查询投流消耗与 ROI 敏感指标/,
    )

    const q = buildMetricQuery(
      { metrics: ['ad_spend'], timeRange: { from: '2026-11-01', to: '2026-11-11' } },
      null,
      { role: 'ad_buyer' },
    )
    assert.ok(q.sql.includes('fact_ad_daily'))

    const sig = signMcpUserId(42, 'unit-test-secret')
    assert.equal(verifyMcpUserSig(42, sig, 'unit-test-secret'), true)
    assert.equal(verifyMcpUserSig(43, sig, 'unit-test-secret'), false)
    assert.equal(verifyMcpUserSig(42, sig, 'wrong-secret'), false)
    assert.equal(timingSafeTokenEqual('abc123', 'abc123'), true)
    assert.equal(timingSafeTokenEqual('abc123', 'abc124'), false)
  })
})
