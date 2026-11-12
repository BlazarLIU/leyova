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
  let adminUser: TempAccount

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    adBuyer = await createTempAccount('ad_buyer', 'agency_staff', 1)
    operatorUser = await createTempAccount('operator', 'agency_staff', 1)
    brandViewer = await createTempAccount('brand_viewer', 'brand_viewer', 1)
    financeUser = await createTempAccount('finance', 'agency_staff', 1)
    adminUser = await createTempAccount('admin', 'agency_staff', 1)
    createdUserIds.push(adBuyer.userId, operatorUser.userId, brandViewer.userId, financeUser.userId, adminUser.userId)
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

  test('MCP fail-closed 鉴权：缺失或无效 X-Leyova-User-Id 返回 401，无效 HMAC 签名返回 403，合法 HMAC 放行', async () => {
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

    if (env.LEYOVA_MCP_REQUIRE_SIG) {
      const missingSigRes = await app.inject({
        method: 'POST',
        url: '/mcp',
        headers: {
          authorization: `Bearer ${env.LEYOVA_MCP_TOKEN}`,
          'x-leyova-user-id': String(adBuyer.userId),
        },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      })
      assert.equal(missingSigRes.statusCode, 403)
    }

    const secret = env.LEYOVA_MCP_SIGNING_SECRET || env.LEYOVA_MCP_TOKEN || ''
    const validSig = signMcpUserId(adBuyer.userId, secret)
    const okRes = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${env.LEYOVA_MCP_TOKEN}`,
        accept: 'application/json, text/event-stream',
        'x-leyova-user-id': String(adBuyer.userId),
        'x-leyova-user-sig': validSig,
      },
      payload: {
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'leyova-test', version: '1.0.0' },
        },
      },
    })
    assert.equal(okRes.statusCode, 200)
    assert.ok(okRes.body.includes('leyova-mcp'))
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
    assert.ok(q.sql.includes('fact_ad_spend_daily'))

    const sig = signMcpUserId(42, 'unit-test-secret')
    assert.equal(verifyMcpUserSig(42, sig, 'unit-test-secret'), true)
    assert.equal(verifyMcpUserSig(43, sig, 'unit-test-secret'), false)
    assert.equal(verifyMcpUserSig(42, sig, 'wrong-secret'), false)
    assert.equal(timingSafeTokenEqual('abc123', 'abc123'), true)
    assert.equal(timingSafeTokenEqual('abc123', 'abc124'), false)
  })

  test('Round 2 修复验证：/bi/roi 与 /bi/refund 返回真实指标，/net-roi/overview 含归因窗口与经营模式维度', async () => {
    const roiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bi/roi?period=30d',
      headers: { cookie: adBuyer.cookie },
    })
    assert.equal(roiRes.statusCode, 200)
    const roiData = roiRes.json().data
    assert.equal(typeof roiData.overall_roi, 'number')
    assert.ok(Array.isArray(roiData.channels))
    assert.ok(Array.isArray(roiData.chartData))

    const refundRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bi/refund?period=30d',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(refundRes.statusCode, 200)
    const refundData = refundRes.json().data
    assert.equal(typeof refundData.total_refund, 'number')
    assert.equal(typeof refundData.refund_rate, 'number')
    assert.ok(Array.isArray(refundData.reasons))
    assert.ok(Array.isArray(refundData.records))

    const netRoiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/net-roi/overview',
      headers: { cookie: adBuyer.cookie },
    })
    assert.equal(netRoiRes.statusCode, 200)
    const netRoiData = netRoiRes.json().data
    assert.ok(Array.isArray(netRoiData.byAttributionWindow))
    assert.ok(Array.isArray(netRoiData.byBusinessMode))

    const winDictRes = await app.inject({
      method: 'GET',
      url: '/api/v1/net-roi/attribution-windows',
      headers: { cookie: adBuyer.cookie },
    })
    assert.equal(winDictRes.statusCode, 200)
    assert.ok(Array.isArray(winDictRes.json().data))

    const promoRulesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/promotions/rules',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(promoRulesRes.statusCode, 200)
    assert.ok(Array.isArray(promoRulesRes.json().data))
  })

  test('Round 2 全路由 RLS 转换后冒烟与角色模块权限配置闭环', async () => {
    const rlsPaths = [
      '/api/v1/after-sales/overview',
      '/api/v1/fulfillment/overview',
      '/api/v1/jd/mode-breakdown',
      '/api/v1/alerts/rules',
      '/api/v1/review/overview',
      '/api/v1/ai/sessions',
      '/api/v1/system/modules',
    ]
    for (const url of rlsPaths) {
      const res = await app.inject({
        method: 'GET',
        url,
        headers: { cookie: operatorUser.cookie },
      })
      assert.equal(res.statusCode, 200, `${url} should return 200 under RLS context`)
      assert.equal(res.json().success, true)
    }

    const forbiddenRolePut = await app.inject({
      method: 'PUT',
      url: '/api/v1/system/roles/modules',
      headers: { cookie: operatorUser.cookie },
      payload: { roleCode: 'employee', moduleCodes: ['overview'] },
    })
    assert.equal(forbiddenRolePut.statusCode, 403)

    const rolesBeforeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/system/roles',
      headers: { cookie: adminUser.cookie },
    })
    assert.equal(rolesBeforeRes.statusCode, 200)
    const rolesList = rolesBeforeRes.json().data as Array<{ code: string; modules: string[] }>
    const targetRole = rolesList.find((r) => r.code === 'employee')
    assert.ok(targetRole, 'employee role must exist')
    const originalModules = [...(targetRole?.modules || [])]

    try {
      const nextModules = Array.from(new Set([...originalModules, 'personal_achievement']))
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/system/roles/modules',
        headers: { cookie: adminUser.cookie },
        payload: { roleCode: 'employee', moduleCodes: nextModules },
      })
      assert.equal(putRes.statusCode, 200)
      assert.equal(putRes.json().data.updated, true)
    } finally {
      await app.inject({
        method: 'PUT',
        url: '/api/v1/system/roles/modules',
        headers: { cookie: adminUser.cookie },
        payload: { roleCode: 'employee', moduleCodes: originalModules },
      })
    }
  })
})
