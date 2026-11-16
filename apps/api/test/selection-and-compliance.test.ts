/**
 * selection-and-compliance.test.ts — AI 选品、12 模块运营方案与合规风控巡检集成测试
 * 覆盖 FINAL-PLAN Phase 2 与 Phase 3 的核心 API 行为与业务断言
 */

import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { getPool } from '../src/lib/db.js'

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

describe('AI 选品、运营方案与合规风控巡检 (FINAL-PLAN Phase 2 & 3)', () => {
  let app: FastifyInstance
  const createdUserIds: number[] = []
  let adminUser: TempAccount

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    adminUser = await createTempAccount('super_admin')
    createdUserIds.push(adminUser.userId)
  })

  after(async () => {
    const pool = getPool()
    if (createdUserIds.length > 0) {
      await pool.query(
        `DELETE FROM user_sessions WHERE user_id = ANY($1::int[])`,
        [createdUserIds],
      )
      await pool.query(
        `DELETE FROM users WHERE id = ANY($1::int[])`,
        [createdUserIds],
      )
    }
    await app.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 2: AI 选品多因子与 12 模块运营方案
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/selection/categories 返回 30 个全品类定义且支持 withSignals 聚合', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/selection/categories?withSignals=true',
      headers: { cookie: adminUser.cookie },
    })

    const json = res.json()
    if (res.statusCode !== 200) {
      console.error('POST /selection/recommend error:', json)
    }
    assert.equal(res.statusCode, 200)
    assert.equal(json.success, true)
    assert.ok(Array.isArray(json.data))
    assert.ok(json.data.length >= 30, `预期类目数 >= 30，实测 ${json.data.length}`)

    const first = json.data[0]
    assert.ok(first.code)
    assert.ok(first.name)
    assert.ok(first.weather_sensitivity)
  })

  let createdRecId: number | undefined

  test('POST /api/v1/selection/recommend 生成多因子选品推荐', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/selection/recommend',
      headers: { cookie: adminUser.cookie },
      payload: {
        categoryCode: 'APPAREL_OUTDOOR',
        platformCode: 'douyin',
        shopId: 1,
        city: '杭州',
        lookbackDays: 30,
        persist: true,
      },
    })

    const json = res.json()
    if (res.statusCode !== 200) {
      console.error('POST /selection/recommend error:', json)
    }
    assert.equal(res.statusCode, 200)
    assert.equal(json.success, true)
    assert.ok(json.data.recommendationNo)
    assert.equal(json.data.categoryCode, 'APPAREL_OUTDOOR')
    assert.ok(json.data.items.length > 0)
    assert.ok(json.data.weather)

    createdRecId = json.data.id
  })

  test('GET /api/v1/selection/recommendations 列表与详情获取', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/selection/recommendations',
      headers: { cookie: adminUser.cookie },
    })

    assert.equal(listRes.statusCode, 200)
    const listJson = listRes.json()
    assert.equal(listJson.success, true)
    assert.ok(listJson.data.total >= 1)

    if (createdRecId) {
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/selection/recommendations/${createdRecId}`,
        headers: { cookie: adminUser.cookie },
      })
      assert.equal(detailRes.statusCode, 200)
      const detailJson = detailRes.json()
      assert.equal(detailJson.success, true)
      assert.equal(String(detailJson.data.id), String(createdRecId))
    }
  })

  let createdPlanId: number | undefined

  test('POST /api/v1/campaign-plan/generate 生成 12 模块全域运营方案', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/campaign-plan/generate',
      headers: { cookie: adminUser.cookie },
      payload: {
        planName: '双11全域女装大促作战方案',
        campaignType: 'double11',
        platformCode: 'douyin',
        shopId: 1,
        categoryCode: 'APPAREL_OUTDOOR',
        startDate: '2026-11-15',
        endDate: '2026-11-20',
        targetGmv: 500000,
        maxAdBudget: 80000,
        sourceRecommendationId: createdRecId,
      },
    })

    const json = res.json()
    if (res.statusCode !== 200) {
      console.error('POST /campaign-plan/generate error:', json)
    }
    assert.equal(res.statusCode, 200)
    assert.equal(json.success, true)
    assert.ok(json.data.planNo)
    assert.ok(json.data.planPayload.modules.m1_positioning)
    assert.ok(json.data.planPayload.modules.m10_compliance_checklist)
    assert.equal(json.data.planPayload.modules.m10_compliance_checklist.status, 'PASSED')
    assert.ok(!json.data.planPayload.modules.m5_scripts.pitch.includes('顶级'))
    assert.ok(!json.data.planPayload.modules.m5_scripts.urgency.includes('全网首发'))
    assert.ok(json.data.planPayload.modules.m12_post_session_review)

    // 测试合规扫描器识别违禁用语并标记 FAILED
    const { checkTextCompliance } = await import('../src/services/campaign-plan-service.js')
    const badCheck = checkTextCompliance(['顶级微米级材质', '全网首发独家现货'])
    assert.equal(badCheck.passed, false)
    assert.ok(badCheck.violations.length >= 2)
    assert.ok(badCheck.violations.some((v) => v.includes('顶级')))
    assert.ok(badCheck.violations.some((v) => v.includes('全网首发')))

    createdPlanId = json.data.id
  })

  test('PATCH /api/v1/campaign-plan/plans/:id 方案状态流转与审批', async () => {
    if (!createdPlanId) return

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/campaign-plan/plans/${createdPlanId}`,
      headers: { cookie: adminUser.cookie },
      payload: {
        status: 'approved',
      },
    })

    const json = res.json()
    if (res.statusCode !== 200) {
      console.error('PATCH /campaign-plan/plans error:', json)
    }
    assert.equal(res.statusCode, 200)
    assert.equal(json.success, true)
    assert.equal(json.data.approval_status, 'approved')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 3: 平台规则巡检雷达、变更差量与合规风控
  // ──────────────────────────────────────────────────────────────────────────

  test('GET /api/v1/compliance/rules 规则列表筛选与快照获取', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/rules',
      headers: { cookie: adminUser.cookie },
    })

    const json = res.json()
    if (res.statusCode !== 200) {
      console.error('POST /selection/recommend error:', json)
    }
    assert.equal(res.statusCode, 200)
    assert.equal(json.success, true)
    assert.ok(json.data.total >= 5, `预期规则数 >= 5，实测 ${json.data.total}`)
  })

  test('POST /api/v1/compliance/rules/manual 人工补录兜底规则（线下通知）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/rules/manual',
      headers: { cookie: adminUser.cookie },
      payload: {
        platformCode: 'douyin',
        externalId: `DY-MANUAL-${Date.now()}`,
        title: '抖音电商关于生鲜食品48小时直发履约考核新规通知',
        category: '履约与售后',
        sourceUrl: 'https://school.jinritemai.com/rules/manual-entry',
        contentText: '自2026年12月1日起对生鲜类目实行48小时急速直发，超时每单赔付10元。',
        severity: 'high',
        operationalImpact: '要求排班运营将生鲜冷链选品发货预警阈值提前。',
      },
    })

    const json = res.json()
    if (res.statusCode !== 200) {
      console.error('POST /selection/recommend error:', json)
    }
    assert.equal(res.statusCode, 200)
    assert.equal(json.success, true)
    assert.ok(json.data.snapshotId)
    assert.ok(json.data.contentHash)
  })

  test('GET /api/v1/compliance/changes 变更流与未读计数获取', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/changes',
      headers: { cookie: adminUser.cookie },
    })

    const json = res.json()
    if (res.statusCode !== 200) {
      console.error('POST /selection/recommend error:', json)
    }
    assert.equal(res.statusCode, 200)
    assert.equal(json.success, true)
    assert.ok(json.data.total >= 1)
  })

  test('POST /api/v1/compliance/changes/:id/ack 确认已读标记', async () => {
    const changesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/changes',
      headers: { cookie: adminUser.cookie },
    })
    const changeId = changesRes.json().data.items?.[0]?.id

    if (changeId) {
      const ackRes = await app.inject({
        method: 'POST',
        url: `/api/v1/compliance/changes/${changeId}/ack`,
        headers: { cookie: adminUser.cookie },
      })

      assert.equal(ackRes.statusCode, 200)
      const ackJson = ackRes.json()
      assert.equal(ackJson.success, true)
      assert.equal(ackJson.data.is_read, true)
    }
  })

  test('GET /api/v1/compliance/reminders 大促活动报名提醒', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/reminders',
      headers: { cookie: adminUser.cookie },
    })

    const json = res.json()
    if (res.statusCode !== 200) {
      console.error('POST /selection/recommend error:', json)
    }
    assert.equal(res.statusCode, 200)
    assert.equal(json.success, true)
    assert.ok(Array.isArray(json.data))
    // jd/pdd 平台移除后（2026-11-14），京东秒杀日提醒随之删除，剩余提醒 >= 2
    assert.ok(json.data.length >= 2)
  })

  test('POST /api/v1/compliance/scan 巡检扫描与防并发幂等性', async () => {
    const scan1 = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/scan',
      headers: { cookie: adminUser.cookie },
      payload: {},
    })

    assert.equal(scan1.statusCode, 200)
    const json1 = scan1.json()
    assert.equal(json1.success, true)
    assert.equal(json1.data.locked, true)
    // 采集器随平台精简为 4 个（taobao/douyin/kuaishou/xiaohongshu），jd/pdd 已于 2026-11-14 移除
    assert.ok(json1.data.scannedCount >= 4)

    // 第二次扫描：指纹相同，newCount 与 revisedCount 应均为 0 (完全幂等)
    const scan2 = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/scan',
      headers: { cookie: adminUser.cookie },
      payload: {},
    })

    assert.equal(scan2.statusCode, 200)
    const json2 = scan2.json()
    assert.equal(json2.success, true)
    assert.equal(json2.data.locked, true)
    assert.equal(json2.data.newCount, 0)
    assert.equal(json2.data.revisedCount, 0)
  })
})
