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
import { computeRefundRatePct, computeOrderRefundRatePct } from '../src/services/metrics-caliber.js'
import { computeAfterSaleSla } from '../src/routes/after-sales.js'
import { evaluateWaybillSla } from '../src/routes/fulfillment.js'

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

  // P0-D-1 模块守卫生效后：临时账号必须显式获得角色授权，
  // 否则 resolveAccess 会因 grants 表无记录而回退到 role_modules（这里是空）。
  // 把该角色的 role_module_grants 复制到 user_module_overrides，模拟「正常由管理员授权的账号」。
  await pool.query(
    `INSERT INTO public.user_module_overrides (user_id, module_code, effect)
     SELECT $1, module_code, 'grant'
       FROM public.role_module_grants
      WHERE role_code = $2 AND effect = 'allow'
     ON CONFLICT (user_id, module_code) DO NOTHING`,
    [userId, role],
  )
  // 同时把该角色的平台授权复制到 user_platform_permissions
  await pool.query(
    `INSERT INTO public.user_platform_permissions (user_id, platform_code)
     SELECT $1, rpp.platform_code
       FROM public.role_platform_permissions rpp
       JOIN public.roles r ON r.id = rpp.role_id
      WHERE r.code = $2
     ON CONFLICT DO NOTHING`,
    [userId, role],
  ).catch(() => { /* 表可能无唯一约束，忽略 */ })

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
  let hrbpUser: TempAccount
  let opsDirectorUser: TempAccount
  let employeeUser: TempAccount

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    adBuyer = await createTempAccount('ad_buyer', 'agency_staff', 1)
    operatorUser = await createTempAccount('ops_staff', 'agency_staff', 1)
    brandViewer = await createTempAccount('cs_agent', 'brand_viewer', 1)
    // S4：系统不设独立 finance 角色，成本权限对照改用运营总监
    financeUser = await createTempAccount('super_admin', 'agency_staff', 1)
    adminUser = await createTempAccount('super_admin', 'agency_staff', 1)
    hrbpUser = await createTempAccount('hrbp', 'agency_staff', 1)
    opsDirectorUser = await createTempAccount('ops_director', 'agency_staff', 1)
    employeeUser = await createTempAccount('video_editor', 'agency_staff', 1)
    createdUserIds.push(
      adBuyer.userId,
      operatorUser.userId,
      brandViewer.userId,
      financeUser.userId,
      adminUser.userId,
      hrbpUser.userId,
      opsDirectorUser.userId,
      employeeUser.userId,
    )
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
    const res = await app.inject({ method: 'GET', url: '/api/v1/net-roi/overview' })
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

  test('ad_buyer 允许访问投流/关键词/Net-ROI 看板，但禁止访问成本台账 (/costs)', async () => {
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
    // S4：成本台账已下线。P0-D-1 模块守卫生效后，未在映射表声明的路径
    // 按 fail-closed 返回 403（安全上优于 404：不泄露端点是否存在）
    assert.ok([403, 404].includes(costsRes.statusCode), `期望 403 或 404，实测 ${costsRes.statusCode}`)
  })

  test('operator 可访问 Net-ROI（P0-D-2 老大要求运营评估成本），且允许访问退款分析与抖音店铺指标，跨平台店铺越权返回 400', async () => {
    // P0-D-2：老大明确要求「投手、运营、HRBP 需要评估成本」，
    // 因此 operator 现在有 net_roi 模块 + cost_visibility 授权，可见成本字段。
    const netRoiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/net-roi/overview',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(netRoiRes.statusCode, 200)
    assert.equal(netRoiRes.json().data.costMasked, false)

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

  test('brand_viewer 无显式成本授权时禁止查看 Net-ROI，且写接口均被拒绝返回 403', async () => {
    const roiRes = await app.inject({
      method: 'GET',
      url: '/api/v1/net-roi/overview',
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

  test('大促 5 层试算对非成本权限角色脱敏成本，对 admin 返回真实净毛利', async () => {
    const simPayload = {
      retailPrice: 200,
      costPrice: 80,
      platformFeeRate: 0.05,
      rules: [
        { ruleLayer: 1, ruleName: '官方立减', discountMode: 'rate', discountValue: 0.85, merchantCostRatio: 1, platformCostRatio: 0 },
      ],
    }

    // P0-D-2 后所有能访问大促的角色都默认有 cost_visibility，
    // 因此用「用户级 revoke」主动制造脱敏对照组 —— 这同时验证了
    // user_module_overrides 优先级高于角色授权（S2 设计的核心机制）。
    const pool0 = getPool()
    await pool0.query(
      `INSERT INTO public.user_module_overrides (user_id, module_code, effect)
       VALUES ($1, 'cost_visibility', 'revoke')
       ON CONFLICT (user_id, module_code) DO UPDATE SET effect='revoke'`,
      [operatorUser.userId],
    )
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

    // 还原：清掉 revoke，恢复角色默认
    await pool0.query(
      `DELETE FROM public.user_module_overrides WHERE user_id=$1 AND module_code='cost_visibility'`,
      [operatorUser.userId],
    )

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

    // S4：成本台账端点已下线；守卫 fail-closed 返回 403
    const finCosts = await app.inject({
      method: 'GET',
      url: '/api/v1/costs',
      headers: { cookie: financeUser.cookie },
    })
    assert.ok([403, 404].includes(finCosts.statusCode), `期望 403 或 404，实测 ${finCosts.statusCode}`)
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
          { role: 'ops_staff' },
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

  test('Round 2 修复验证：/bi/refund 返回真实指标，/net-roi/overview 含归因窗口与经营模式维度', async () => {
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
      payload: { roleCode: 'video_editor', moduleCodes: ['overview'] },
    })
    assert.equal(forbiddenRolePut.statusCode, 403)

    const rolesBeforeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/system/roles',
      headers: { cookie: adminUser.cookie },
    })
    assert.equal(rolesBeforeRes.statusCode, 200)
    const rolesList = rolesBeforeRes.json().data as Array<{ code: string; modules: string[] }>
    const targetRole = rolesList.find((r) => r.code === 'video_editor')
    assert.ok(targetRole, 'employee role must exist')
    const originalModules = [...(targetRole?.modules || [])]

    try {
      const nextModules = Array.from(new Set([...originalModules, 'personal_achievement']))
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/system/roles/modules',
        headers: { cookie: adminUser.cookie },
        payload: { roleCode: 'video_editor', moduleCodes: nextModules },
      })
      assert.equal(putRes.statusCode, 200)
      assert.equal(putRes.json().data.updated, true)
    } finally {
      await app.inject({
        method: 'PUT',
        url: '/api/v1/system/roles/modules',
        headers: { cookie: adminUser.cookie },
        payload: { roleCode: 'video_editor', moduleCodes: originalModules },
      })
    }
  })

  test('中期架构优化：口径目录 / 退款率函数 / 配置化 SLA', async () => {
    // 1. 口径接口鉴权与 metric_definition 目录权限过滤
    const caliberUnauth = await app.inject({ method: 'GET', url: '/api/v1/caliber' })
    assert.equal(caliberUnauth.statusCode, 401)

    const metricsOpRes = await app.inject({
      method: 'GET',
      url: '/api/v1/caliber/metrics',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(metricsOpRes.statusCode, 200)
    const opMetricCodes = (metricsOpRes.json().data.metrics as Array<{ code: string }>).map((m) => m.code)
    assert.ok(opMetricCodes.includes('refund_rate'))
    assert.equal(opMetricCodes.includes('ad_spend'), false)

    const metricsFinRes = await app.inject({
      method: 'GET',
      url: '/api/v1/caliber/metrics',
      headers: { cookie: financeUser.cookie },
    })
    assert.equal(metricsFinRes.statusCode, 200)
    const finMetricCodes = (metricsFinRes.json().data.metrics as Array<{ code: string }>).map((m) => m.code)
    assert.ok(finMetricCodes.includes('ad_spend'))

    const analysisMetricsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/analysis/metrics',
      headers: { cookie: financeUser.cookie },
    })
    assert.equal(analysisMetricsRes.statusCode, 200)
    const refundDef = (analysisMetricsRes.json().data.metrics as Array<any>).find((m) => m.code === 'refund_rate')
    assert.ok(refundDef && Array.isArray(refundDef.supportedPlatforms) && refundDef.supportedPlatforms.includes('taobao'))

    // 2. 统一退款率公式与 DB 配置化 SLA 逻辑
    assert.equal(computeRefundRatePct(150, 1000, 2), 15)
    assert.equal(computeRefundRatePct(100, 0, 2), 0)
    assert.equal(computeOrderRefundRatePct(3, 40, 2), 7.5)

    const appliedAt = new Date('2026-11-10T00:00:00Z')
    const afterSaleFromDbRule = computeAfterSaleSla('douyin', 'return_refund', 4.9, appliedAt, [
      { sla_type: 'aftersale_only_refund_audit', threshold_hours: 24, autonomy_min_score: null },
      { sla_type: 'aftersale_return_audit', threshold_hours: 48, autonomy_min_score: null },
    ])
    assert.equal(afterSaleFromDbRule.auditDeadlineAt.getTime() - appliedAt.getTime(), 48 * 3600 * 1000)
    assert.equal(afterSaleFromDbRule.autonomyProtected, false)

    const presalePaidAt = new Date('2026-11-01T00:00:00Z')
    const waybillSla = evaluateWaybillSla(
      {
        platformCode: 'taobao',
        orderAmount: 200,
        isCustomPresale: true,
        paidAt: presalePaidAt,
        shippedAt: new Date('2026-11-06T01:00:00Z'), // 121h > 120h
      },
      [
        {
          platform_code: 'taobao',
          sla_type: 'ship',
          sla_name: '常规发货',
          threshold_hours: 48,
          pickup_threshold_hours: 24,
          penalty_fixed_amount: '3.00',
          penalty_rate: '0',
          penalty_min_amount: '0',
          penalty_max_amount: '0',
          autonomy_min_score: null,
          penalty_note: '',
        },
        {
          platform_code: 'taobao',
          sla_type: 'ship_presale',
          sla_name: '预售发货',
          threshold_hours: 120,
          pickup_threshold_hours: 24,
          penalty_fixed_amount: '3.00',
          penalty_rate: '0',
          penalty_min_amount: '0',
          penalty_max_amount: '0',
          autonomy_min_score: null,
          penalty_note: '',
        },
      ],
    )
    assert.equal(waybillSla.isShipDelayed, true)
    assert.equal(waybillSla.estimatedPenaltyAmount, 3)
  })

  test('长期演进与端点一致性：SKU 级订单明细销售聚合脱敏 & 补全闭环接口', async () => {
    const skuFinRes = await app.inject({
      method: 'GET',
      url: '/api/v1/omnichannel/shop/1/products',
      headers: { cookie: financeUser.cookie },
    })
    assert.equal(skuFinRes.statusCode, 200)
    const skuFin = skuFinRes.json().data
    assert.equal(skuFin.costMasked, false)
    assert.ok(skuFin.items.length > 0)
    assert.ok(skuFin.summary.totalPaidAmount > 0)
    assert.notEqual(skuFin.items[0].estimatedProfit, null)

    // P0-D-2 后 operator 已有 cost_visibility，脱敏对照改用 employee
    const skuOpRes = await app.inject({
      method: 'GET',
      url: '/api/v1/omnichannel/shop/1/products',
      headers: { cookie: employeeUser.cookie },
    })
    assert.equal(skuOpRes.statusCode, 200)
    const skuOp = skuOpRes.json().data
    assert.equal(skuOp.costMasked, true)
    assert.ok(skuOp.items.length > 0)
    assert.equal(skuOp.items[0].unitCost, null)
    assert.equal(skuOp.items[0].estimatedProfit, null)

    const skuForbiddenRes = await app.inject({
      method: 'GET',
      url: '/api/v1/omnichannel/shop/1/products',
      headers: { cookie: brandViewer.cookie },
    })
    assert.ok(
      skuForbiddenRes.statusCode === 403 || skuForbiddenRes.statusCode === 404,
      `未授权店铺应被 RLS/RBAC 拒绝，实际状态码 ${skuForbiddenRes.statusCode}`,
    )

    // 端点一致性补齐验证 (/overview/sessions, /review/related-issues, POST competitors/tasks)
    const sessionsUnauth = await app.inject({ method: 'GET', url: '/api/v1/overview/sessions' })
    assert.equal(sessionsUnauth.statusCode, 401)
    const sessionsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/overview/sessions',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(sessionsRes.statusCode, 200)
    assert.ok(Array.isArray(sessionsRes.json().data.sessions))

    const issuesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/review/related-issues',
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(issuesRes.statusCode, 200)
    assert.ok(Array.isArray(issuesRes.json().data))

    const compForbidden = await app.inject({
      method: 'POST',
      url: '/api/v1/system/competitors',
      headers: { cookie: brandViewer.cookie },
      payload: { brand: '不应创建', industry: '服饰' },
    })
    assert.equal(compForbidden.statusCode, 403)

    const compCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/system/competitors',
      headers: { cookie: operatorUser.cookie },
      payload: { brand: `UT_COMP_${Date.now()}`, industry: '运动服饰' },
    })
    assert.equal(compCreate.statusCode, 201)
    const createdCompId = compCreate.json().data.id

    const taskCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/system/tasks',
      headers: { cookie: operatorUser.cookie },
      payload: { title: `UT_TASK_${Date.now()}`, priority: 'high' },
    })
    assert.equal(taskCreate.statusCode, 201)
    const createdTaskId = taskCreate.json().data.task.id

    const pool = getPool()
    await pool.query('DELETE FROM competitor_brands WHERE id = $1', [createdCompId])
    await pool.query('DELETE FROM improvement_tasks WHERE id = $1', [createdTaskId])
  })

  test('工程清理与独立模块准入：废弃别名返回 404，人员/直播间接口对 HRBP 与运营总监可用', async () => {
    for (const deadPath of ['/api/v1/bi/roi', '/api/v1/system/inventory', '/api/v1/ops/goals', '/api/v1/anchors/training']) {
      const res = await app.inject({
        method: 'GET',
        url: deadPath,
        headers: { cookie: adminUser.cookie },
      })
      assert.equal(res.statusCode, 404, `已清理路由 ${deadPath} 应返回 404`)
    }

    for (const livePath of ['/api/v1/inventory/products', '/api/v1/ops/goal-tracking', '/api/v1/training/plans']) {
      const res = await app.inject({
        method: 'GET',
        url: livePath,
        headers: { cookie: adminUser.cookie },
      })
      assert.equal(res.statusCode, 200, `规范路由 ${livePath} 应返回 200`)
    }

    const hrbpAnchorsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/personnel/anchors',
      headers: { cookie: hrbpUser.cookie },
    })
    assert.equal(hrbpAnchorsRes.statusCode, 200)
    assert.ok(Array.isArray(hrbpAnchorsRes.json().data))

    const hrbpManagersRes = await app.inject({
      method: 'GET',
      url: '/api/v1/personnel/managers',
      headers: { cookie: hrbpUser.cookie },
    })
    assert.equal(hrbpManagersRes.statusCode, 200)

    const opsDirRoomsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/system/rooms',
      headers: { cookie: opsDirectorUser.cookie },
    })
    assert.equal(opsDirRoomsRes.statusCode, 200)
    assert.ok(Array.isArray(opsDirRoomsRes.json().data))
  })
})
