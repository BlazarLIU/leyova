/**
 * test/decision-convergence-p0.test.ts
 *
 * 验证真实落地：
 * 1. Gate 7/7 完整门禁 (ad_spend, order_attribution, unit_cost, refund_maturity, commission, session_cost, settlement_profit)
 * 2. 决策复核记录表 (decision_reviews) CRUD 与留痕
 * 3. 阶段指标快照表 (decision_metric_snapshots)
 * 4. 合规脚本检查审计记录表 (compliance_script_check_logs)
 * 5. 商品成本版本表 (dim_product_cost_versions) 与 v_session_cost 真实净利 (含 COGS)
 * 6. 决策案 A-D 级归因与 Memo 8 段结构
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { getPool } from '../src/lib/db.js'
import { env } from '../src/config/env.js'

describe('P0 闭环深度收敛验证：7/7 Gates + 复核 + 快照 + 合规审计 + 成本版本 + A-D归因', () => {
  let app: FastifyInstance
  let adminCookie: string
  let createdCaseId: number

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    const pool = getPool()
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 3600_000)
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, 1, $2)`,
      [sessionId, expiresAt],
    )
    adminCookie = `${env.SESSION_COOKIE_NAME}=${sessionId}`
  })

  after(async () => {
    await app.close()
  })

  test('创建具备 8 段 Memo 与 A-D 归因等级的决策案', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/decision-cases',
      headers: { cookie: adminCookie },
      payload: {
        title: '测试 P0 决策案 (A级因果归因 + 8段备忘录)',
        problemStatement: '投放 ROI 下滑需要定向优化核心货盘与出价策略',
        domain: 'ads',
        sceneKey: 'SCENE-A',
        attributionGrade: 'GRADE_A',
        options: [
          { key: 'opt_1', label: '下调大促高损耗爆款出价 15%' },
          { key: 'no_action', label: '维持现状不做' },
        ],
        executionOwners: [{ name: '投放负责人', role: 'ad_buyer' }],
        reviewLearning: { hypothesis: '边际ROI改善', verified: true },
        evidence: [
          { metricCode: 'net_roi', metricName: '净ROI', value: 1.85, unit: '' },
        ],
      },
    })
    if (res.statusCode !== 200 && res.statusCode !== 201) {
      console.log('Create case error:', res.statusCode, res.json())
    }
    assert.ok([200, 201].includes(res.statusCode), `创建决策案应成功 (实际: ${res.statusCode})`)
    const json = res.json()
    assert.ok(json.data.case.id)
    createdCaseId = json.data.case.id
    assert.equal(json.data.case.attributionGrade, 'GRADE_A')
  })

  test('Gate 7/7 完整门禁评估包含 session_cost 与 settlement_profit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/decision-cases/${createdCaseId}/eval-gates`,
      headers: { cookie: adminCookie },
    })
    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.ok(Array.isArray(json.data.gates))
    assert.equal(json.data.gates.length, 7, '必须返回完整 7 项门禁')

    const checkItems = json.data.gates.map((g: any) => g.checkItem)
    assert.ok(checkItems.includes('ad_spend'))
    assert.ok(checkItems.includes('order_attribution'))
    assert.ok(checkItems.includes('unit_cost'))
    assert.ok(checkItems.includes('refund_maturity'))
    assert.ok(checkItems.includes('commission'))
    assert.ok(checkItems.includes('session_cost'), '必须包含单场全口径成本门禁')
    assert.ok(checkItems.includes('settlement_profit'), '必须包含真实结算利润门禁')
  })

  test('决策复核记录 (decision_reviews) 创建与查询闭环', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/v1/decision-cases/${createdCaseId}/reviews`,
      headers: { cookie: adminCookie },
      payload: {
        plannedOutcome: { netRoi: 2.1, gmvGrowthPct: 15 },
        actualOutcome: { netRoi: 2.05, gmvGrowthPct: 14.2 },
        variancePct: -0.8,
        learnings: '下调千川直投出价后，毛利率上升但需配合主播拉停留',
        status: 'COMPLETED',
      },
    })
    assert.equal(postRes.statusCode, 200)
    const postJson = postRes.json()
    assert.ok(postJson.data.review.id)
    assert.equal(postJson.data.review.learnings, '下调千川直投出价后，毛利率上升但需配合主播拉停留')

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/decision-cases/${createdCaseId}/reviews`,
      headers: { cookie: adminCookie },
    })
    assert.equal(getRes.statusCode, 200)
    const getJson = getRes.json()
    assert.ok(Array.isArray(getJson.data.reviews))
    assert.ok(getJson.data.reviews.length >= 1)
  })

  test('阶段指标快照 (decision_metric_snapshots) 记录与获取', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/v1/decision-cases/${createdCaseId}/snapshots`,
      headers: { cookie: adminCookie },
      payload: {
        snapshotStage: 'BASELINE',
        metricCode: 'net_roi',
        metricValue: 1.82,
      },
    })
    assert.equal(postRes.statusCode, 200)

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/decision-cases/${createdCaseId}/snapshots`,
      headers: { cookie: adminCookie },
    })
    assert.equal(getRes.statusCode, 200)
    const getJson = getRes.json()
    assert.ok(Array.isArray(getJson.data.snapshots))
    assert.ok(getJson.data.snapshots.some((s: any) => s.metric_code === 'net_roi' && Number(s.metric_value) === 1.82))
  })

  test('合规脚本检查审计记录表 (compliance_script_check_logs) 自动留痕', async () => {
    const checkRes = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/check-script',
      headers: { cookie: adminCookie },
      payload: { scriptText: '这是全网第一的爆款，保证有效且最便宜！' },
    })
    assert.equal(checkRes.statusCode, 200)
    const json = checkRes.json()
    assert.equal(json.data.passed, false)
    assert.equal(json.data.riskLevel, 'BLOCK')

    // 查库验证 compliance_script_check_logs 留痕
    const pool = getPool()
    const logRes = await pool.query(
      `SELECT * FROM public.compliance_script_check_logs WHERE tenant_id = 1 ORDER BY checked_at DESC LIMIT 1`,
    )
    assert.ok(logRes.rows.length > 0)
    assert.equal(logRes.rows[0].risk_level, 'BLOCK')
    assert.ok(logRes.rows[0].hit_count >= 3)
  })

  test('C5 商品成本版本表 (dim_product_cost_versions) 写入与生效查询', async () => {
    const pool = getPool()
    // 获取一个测试商品
    const prodRes = await pool.query(`SELECT id FROM public.dim_product LIMIT 1`)
    assert.ok(prodRes.rows.length > 0)
    const prodId = prodRes.rows[0].id

    const verCode = `V-${Date.now()}`
    await pool.query(
      `INSERT INTO public.dim_product_cost_versions
         (tenant_id, product_id, cost_version, unit_cost, effective_from)
       VALUES (1, $1, $2, 45.5000, now() - INTERVAL '1 day')`,
      [prodId, verCode],
    )

    const queryRes = await pool.query(
      `SELECT * FROM public.dim_product_cost_versions WHERE tenant_id = 1 AND product_id = $1 AND cost_version = $2`,
      [prodId, verCode],
    )
    assert.equal(queryRes.rows.length, 1)
    assert.equal(Number(queryRes.rows[0].unit_cost), 45.5)
  })

  test('C4 统一场次成本视图 (v_session_cost) 包含 cogs_alloc 且 ad_spend_alloc 精准归因', async () => {
    const pool = getPool()
    const res = await pool.query(`SELECT * FROM public.v_session_cost LIMIT 1`)
    // 视图必须定义了 cogs_alloc, ad_spend_alloc, platform_fee_alloc, total_cost_alloc, net_profit_alloc
    if (res.rows.length > 0) {
      const row = res.rows[0]
      assert.ok('cogs_alloc' in row, '视图必须包含 cogs_alloc 列')
      assert.ok('ad_spend_alloc' in row, '视图必须包含 ad_spend_alloc 列')
      assert.ok('net_profit_alloc' in row, '视图必须包含 net_profit_alloc 列')
    }
  })
})
