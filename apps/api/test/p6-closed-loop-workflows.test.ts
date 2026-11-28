/**
 * test/p6-closed-loop-workflows.test.ts
 *
 * 验证 P6 闭环补口：
 * 1. 投流计划实体 ad_plan 与回执表（计划预算 vs 实际消耗 vs 净 ROI 三列可比）
 * 2. 排班去伪（真实聚合主播历史分时段 GMV，结构化 evidence，无 28 万伪数据）
 * 3. 排品库存校验（库存不足警告/严格模式阻断）
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { getPool } from '../src/lib/db.js'
import { buildApp } from '../src/app.js'
import { env } from '../src/config/env.js'

describe('P6 业务闭环补口：投流计划、排班去伪与排品库存校验', () => {
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
  // 1. 投流计划实体与三列可比对账
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/net-roi/ad-plans 包含三列可比字段 (预算 vs 实际 vs 净ROI)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/net-roi/ad-plans',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(Array.isArray(json.data))
    assert.ok(json.data.length >= 1, '必须返回投流计划数据')

    const first = json.data[0]
    assert.ok(first.plan_no, '必须有计划编号')
    assert.ok(first.planned_budget !== undefined, '必须包含 planned_budget (计划预算)')
    assert.ok(first.actual_spend !== undefined, '必须包含 actual_spend (实际消耗)')
    assert.ok(first.net_roi !== undefined, '必须包含 net_roi (净成交 ROI)')
    assert.ok(first.budget_utilization_pct !== undefined, '必须包含预算使用率')
  })

  let createdPlanId: number | undefined
  const testPlanNo = `TEST-AD-${Date.now()}`

  test('POST /api/v1/net-roi/ad-plans 创建全新投流计划', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/net-roi/ad-plans',
      headers: { cookie: adminCookie },
      payload: {
        planNo: testPlanNo,
        planName: '双11超级爆款拉新放量计划',
        shopId: 1,
        platformCode: 'douyin',
        adToolCode: 'qianchuan',
        planDate: '2026-11-20',
        plannedBudget: 10000,
        targetRoi: 2.8,
        preHeatRatio: 0.25,
        livePeakRatio: 0.55,
        tailPushRatio: 0.20,
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.plan_no, testPlanNo)
    assert.equal(Number(json.data.planned_budget), 10000)
    assert.equal(Number(json.data.target_roi), 2.8)
    createdPlanId = json.data.id
  })

  test('POST /api/v1/net-roi/ad-plans/:id/receipt 回传实际消耗回执并更新状态', async () => {
    assert.ok(createdPlanId, 'createdPlanId 必须存在')

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/net-roi/ad-plans/${createdPlanId}/receipt`,
      headers: { cookie: adminCookie },
      payload: {
        bizDate: '2026-11-20',
        actualSpend: 7500,
        actualGmv: 24000,
        netGmv: 21500,
        attributedOrders: 420,
        note: '千川智能托管放量完成，ROI 达到预期',
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(Number(json.data.actual_spend), 7500)
    assert.equal(Number(json.data.net_gmv), 21500)

    // 重新查询该计划，验证三列可比对账数据
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/v1/net-roi/ad-plans?status=active`,
      headers: { cookie: adminCookie },
    })
    const checkJson = checkRes.json()
    const target = checkJson.data.find((p: any) => p.plan_id === createdPlanId)
    assert.ok(target, '新录入回执的计划必须在列表中')
    assert.equal(Number(target.planned_budget), 10000)
    assert.equal(Number(target.actual_spend), 7500)
    assert.equal(Number(target.net_roi), 2.87) // 21500 / 7500 = 2.8666 -> 2.87
    assert.equal(Number(target.budget_utilization_pct), 75)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 2. 排班去伪：真实历史聚合与结构化 evidence
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/schedule/recommendations 返回基于真实历史的 evidence，无 28万伪数据', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/schedule/recommendations',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(Array.isArray(json.data.schedule))
    assert.equal(json.data.schedule.length, 4)

    for (const item of json.data.schedule) {
      assert.ok(item.slotKey)
      assert.ok(item.leadAnchor.id)
      assert.ok(item.leadAnchor.name)
      assert.ok(item.supportAnchor.id)
      assert.notEqual(item.leadAnchor.id, item.supportAnchor.id, '主副播不可为同一个人')

      // 验证核心去伪要求：真实 expectedGmv，且带有结构化 evidence
      assert.ok(typeof item.expectedGmv === 'number')
      assert.notEqual(item.expectedGmv, 280000, '必须杜绝 280000 写死假兜底数值')
      assert.ok(item.evidence, '必须附带结构化推导依据 evidence')
      assert.ok(typeof item.evidence.slotSessions === 'number')
      assert.ok(typeof item.evidence.slotAvgGmv === 'number')
      assert.ok(item.evidence.rankInSlot >= 1)
      assert.ok(item.aiReason.includes('真实') || item.aiReason.includes('综合能力'))
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 3. 排品库存校验：健康度检测与严格模式阻断
  // ──────────────────────────────────────────────────────────────────────────

  test('POST /api/v1/ops/session-plans 排品返回商品库存健康度校验结果', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ops/session-plans',
      headers: { cookie: adminCookie },
      payload: {
        roomId: 1,
        anchorId: 1,
        date: '2026-11-25',
        notes: '换季首场排品',
        products: {
          a: { code: 'PROD_FAKE_NON_EXIST', price: 99 },
        },
      },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(json.data.stockValidation)
    assert.equal(json.data.stockValidation.passed, false)
    assert.ok(json.data.stockValidation.warnings.length > 0)
    assert.ok(json.data.stockValidation.warnings[0].includes('未找到登记档案'))
  })

  test('POST /api/v1/ops/session-plans 严格模式阻断缺货/未登记商品', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ops/session-plans',
      headers: { cookie: adminCookie },
      payload: {
        roomId: 1,
        anchorId: 1,
        date: '2026-11-26',
        strictStock: true,
        products: {
          a: { code: 'PROD_FAKE_NON_EXIST', price: 99 },
        },
      },
    })

    assert.equal(res.statusCode, 400)
    const json = res.json()
    assert.ok(json.error.includes('阻断'))
    assert.ok(json.stockValidation)
    assert.equal(json.stockValidation.items[0].status, 'unregistered')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 4. AI 运营方案审批后下游自动拆解（Master Plan §5.2 #8）
  // ──────────────────────────────────────────────────────────────────────────

  let testCampaignPlanId: number | undefined
  let testCampaignPlanNo: string | undefined

  test('POST /api/v1/campaign-plan/plans/:id/dispatch 未审批方案禁止下发拆解', async () => {
    // 1. 先生成一份测试运营方案（默认 pending）
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/v1/campaign-plan/generate',
      headers: { cookie: adminCookie },
      payload: {
        shopId: 1,
        categoryCode: 'APPAREL',
        targetGmv: 80000,
      },
    })
    assert.equal(genRes.statusCode, 200)
    const genJson = genRes.json()
    assert.equal(genJson.success, true)
    testCampaignPlanId = genJson.data.id
    testCampaignPlanNo = genJson.data.planNo
    assert.ok(testCampaignPlanId)

    // 2. 尝试在 pending 状态下发拆解，必须被拦截 400
    const dispRes = await app.inject({
      method: 'POST',
      url: `/api/v1/campaign-plan/plans/${testCampaignPlanId}/dispatch`,
      headers: { cookie: adminCookie },
      payload: {
        sessionId: 1,
      },
    })
    assert.equal(dispRes.statusCode, 400)
    const dispJson = dispRes.json()
    assert.ok(dispJson.message.includes('审批通过') || dispJson.message.includes('approved'))
  })

  test('POST /api/v1/campaign-plan/plans/:id/dispatch 已审批方案自动拆解下发至话术库、排品计划与投流计划', async () => {
    assert.ok(testCampaignPlanId, 'testCampaignPlanId 必须存在')

    // 1. 审批通过
    const appRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/campaign-plan/plans/${testCampaignPlanId}`,
      headers: { cookie: adminCookie },
      payload: { status: 'approved' },
    })
    assert.equal(appRes.statusCode, 200)
    const appJson = appRes.json()
    assert.equal(appJson.data.approval_status, 'approved')

    // 2. 执行自动拆解下发
    const dispRes = await app.inject({
      method: 'POST',
      url: `/api/v1/campaign-plan/plans/${testCampaignPlanId}/dispatch`,
      headers: { cookie: adminCookie },
      payload: {
        sessionId: 1,
        adBudget: 12000,
      },
    })
    assert.equal(dispRes.statusCode, 200)
    const dispJson = dispRes.json()
    assert.equal(dispJson.success, true)
    const summary = dispJson.data

    // 校验下游 1: 话术库注入
    assert.ok(summary.scripts)
    assert.ok(summary.scripts.count >= 4, '必须拆解并下发 4 类核心话术（开场、憋单、推介、紧迫感）')
    assert.ok(summary.scripts.items.some((s: any) => s.category === 'opening'))
    assert.ok(summary.scripts.items.some((s: any) => s.category === 'pitch'))

    // 校验下游 2: 排品计划注入
    assert.ok(summary.sessionPlan)
    assert.ok(summary.sessionPlan.planId)
    assert.ok(summary.sessionPlan.productsCount >= 2, '排品必须包含主推/利润货盘商品')
    assert.ok(summary.sessionPlan.products.some((p: any) => p.groupLetter === 'A'))

    // 校验下游 3: 投流计划实体化
    assert.ok(summary.adPlan)
    assert.equal(summary.adPlan.plannedBudget, 12000)
    assert.equal(summary.adPlan.status, 'approved')
    assert.equal(summary.adPlan.adToolCode, 'qianchuan')

    // 3. 校验数据库持久化与 campaign_plan 状态
    const pool = getPool()
    const cpRes = await pool.query(
      `SELECT dispatched_at, dispatched_by, dispatch_summary FROM campaign_plan WHERE id = $1`,
      [testCampaignPlanId],
    )
    assert.ok(cpRes.rows[0].dispatched_at, 'dispatched_at 必须已记录')
    assert.ok(cpRes.rows[0].dispatch_summary.scripts, 'dispatch_summary 必须持久化')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 5. session_id 全链路穿透查询（Master Plan §5.2 #1）
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/sessions/:id/full-trace 聚合场次、人货场、排品、投流、真实财务PnL与履约售后SLA', async () => {
    // 1. 非法/不存在场次返回 404
    const notFoundRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions/99999999/full-trace',
      headers: { cookie: adminCookie },
    })
    assert.equal(notFoundRes.statusCode, 404)

    // 2. 查询合法场次 (id = 1)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions/1/full-trace',
      headers: { cookie: adminCookie },
    })
    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    const data = json.data

    // 领域 1: 场次基础信息
    assert.ok(data.session)
    assert.equal(data.session.id, 1)
    assert.ok(data.session.title)
    assert.ok(data.session.date)
    assert.ok(data.session.roomName)
    assert.ok(data.session.shopName)

    // 领域 2: 岗位人员分工
    assert.ok(data.staff)
    assert.ok(data.staff.anchor)
    assert.ok(Array.isArray(data.staff.assignments))

    // 领域 3: 排品货盘清单
    assert.ok(data.assortment)
    assert.ok(typeof data.assortment.productsCount === 'number')
    assert.ok(Array.isArray(data.assortment.products))
    assert.ok(data.assortment.products.length >= 1, '由于先前下发拆解至 session 1，必须有排品商品')

    // 领域 4: 投流计划与对账
    assert.ok(data.adPlans)
    assert.ok(Array.isArray(data.adPlans.plans))
    assert.ok(data.adPlans.plans.length >= 1, '必须包含拆解关联的投流计划')

    // 领域 5: 财务真实 PnL（严格遵循断点：缺成本项返回 null，严禁假 0）
    assert.ok(data.pnl)
    assert.ok(typeof data.pnl.gmv === 'number')
    assert.ok(typeof data.pnl.netRevenue === 'number')
    assert.ok(typeof data.pnl.isComplete === 'boolean')
    assert.ok(Array.isArray(data.pnl.missingCosts))
    if (!data.pnl.isComplete) {
      assert.equal(data.pnl.netProfit, null, '缺项时 netProfit 必须为 null')
    }

    // 领域 6: 履约与售后 SLA 风险
    assert.ok(data.fulfillment)
    assert.ok(typeof data.fulfillment.totalWaybills === 'number')
    assert.ok(typeof data.fulfillment.delayedCount === 'number')
    assert.ok(data.afterSales)
    assert.ok(typeof data.afterSales.totalTickets === 'number')
    assert.ok(typeof data.afterSales.pendingAuditCount === 'number')
  })
})
