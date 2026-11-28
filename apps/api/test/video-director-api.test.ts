/**
 * video-director-api.test.ts — F.1/F.2 路由联调
 *
 * 覆盖：
 *   1. 8 类模板种子可读；
 *   2. 缺必选槽位装配返回 400；
 *   3. 合法装配生成镜头计划，渲染预检 + 成片质检闭环；
 *   4. 编导选题评分 / 简报 / 脚本合规 / 分镜生成。
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'

import { buildApp } from '../src/app.js'
import { getPool } from '../src/lib/db.js'
import { env } from '../src/config/env.js'

async function createSuperAdmin(): Promise<{ userId: number; cookie: string }> {
  const pool = getPool()
  const suffix = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (username, password_hash, real_name, role, user_type, tenant_id, status)
     VALUES ($1, '$2a$10$InvalidTestHashOnlyForSessionTests000000000000000000', $2, 'super_admin', 'internal', 1, 1)
     RETURNING id`,
    [`__f14_${suffix}`, 'F14 Test Admin'],
  )
  const userId = Number(rows[0].id)
  const sessionId = crypto.randomUUID()
  await pool.query(`INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`, [
    sessionId,
    userId,
    new Date(Date.now() + 3600_000),
  ])
  return { userId, cookie: `${env.SESSION_COOKIE_NAME}=${sessionId}` }
}

describe('F.1/F.2 视频模板层与编导工作台', () => {
  let app: FastifyInstance
  let userId = 0
  let cookie = ''
  const createdProjectIds: string[] = []
  const createdIdeaIds: string[] = []
  const createdBriefIds: string[] = []

  before(async () => {
    app = await buildApp()
    await app.ready()
    const account = await createSuperAdmin()
    userId = account.userId
    cookie = account.cookie
  })

  after(async () => {
    const pool = getPool()
    for (const id of createdProjectIds) {
      await pool.query('DELETE FROM public.video_projects WHERE id = $1', [id]).catch(() => {})
    }
    for (const id of createdBriefIds) {
      await pool.query('DELETE FROM public.content_briefs WHERE id = $1', [id]).catch(() => {})
    }
    for (const id of createdIdeaIds) {
      await pool.query('DELETE FROM public.content_ideas WHERE id = $1', [id]).catch(() => {})
    }
    // audit_logs.actor_user_id 是 NO ACTION 外键，必须先删审计记录，否则下面删用户会静默失败并残留
    await pool.query('DELETE FROM public.audit_logs WHERE actor_user_id = $1', [userId]).catch(() => {})
    await pool.query('DELETE FROM public.user_sessions WHERE user_id = $1', [userId]).catch(() => {})
    await pool.query('DELETE FROM public.users WHERE id = $1', [userId]).catch(() => {})
    await app.close()
  })

  test('模板列表包含 8 类种子模板', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/video/templates',
      headers: { cookie },
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    const categories = new Set(body.data.items.map((item: any) => item.category))
    for (const category of [
      'live_highlight', 'product_seed', 'talking_head', 'image_text',
      'batch_mashup', 'review_compare', 'tutorial_steps', 'report_teaser',
    ]) {
      assert.ok(categories.has(category), `缺少模板类别 ${category}`)
    }
  })

  test('缺必选槽位装配返回 400', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/video/templates', headers: { cookie } })
    const template = list.json().data.items.find((item: any) => item.code === 'product_seed_v1')
    assert.ok(template)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/video/projects',
      headers: { cookie },
      payload: {
        templateId: template.id,
        title: '缺槽位测试',
        slotValues: { hook: '这个真香' },
      },
    })
    assert.equal(res.statusCode, 400)
    assert.match(res.json().message, /缺少必选槽位/)
  })

  test('合法装配 → 渲染预检 → 成片质检闭环', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/video/templates', headers: { cookie } })
    const template = list.json().data.items.find((item: any) => item.code === 'product_seed_v1')

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/video/projects',
      headers: { cookie },
      payload: {
        templateId: template.id,
        title: '保温杯种草',
        slotValues: {
          hook: '冬天喝水这件小事',
          selling_points: ['保温 12 小时', '一键开盖', '内胆易清洗'],
          product_images: ['a.png', 'b.png', 'c.png'],
          cta: '点击了解',
        },
      },
    })
    assert.equal(create.statusCode, 200)
    const projectId = create.json().data.id
    createdProjectIds.push(projectId)
    assert.ok(create.json().data.shotCount >= 3)

    const render = await app.inject({
      method: 'POST',
      url: `/api/v1/video/projects/${projectId}/render`,
      headers: { cookie },
      payload: {},
    })
    assert.equal(render.statusCode, 200)
    const jobId = render.json().data.jobId

    const output = await app.inject({
      method: 'PATCH',
      url: `/api/v1/video/render-jobs/${jobId}/output`,
      headers: { cookie },
      payload: {
        outputPath: 'render/2026/test.mp4',
        durationMs: 20_000,
        width: 1080,
        height: 1920,
        loudness: -14,
        subtitleSegments: [{ startMs: 0, endMs: 3000, text: '冬天喝水这件小事' }],
        logoPresent: true,
        aiLabelPresent: true,
      },
    })
    assert.equal(output.statusCode, 200)
    assert.equal(output.json().data.passed, true)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/video/projects/${projectId}`,
      headers: { cookie },
    })
    assert.equal(detail.json().data.status, 'rendered')
    assert.equal(detail.json().data.renderJobs[0].status, 'succeeded')
  })

  test('质检不通过不产出成片', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/video/templates', headers: { cookie } })
    const template = list.json().data.items.find((item: any) => item.code === 'product_seed_v1')
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/video/projects',
      headers: { cookie },
      payload: {
        templateId: template.id,
        title: '质检失败测试',
        slotValues: {
          hook: '测试钩子',
          selling_points: ['卖点一', '卖点二', '卖点三'],
          product_images: ['a.png', 'b.png', 'c.png'],
          cta: '点击了解',
        },
      },
    })
    const projectId = create.json().data.id
    createdProjectIds.push(projectId)

    const render = await app.inject({
      method: 'POST',
      url: `/api/v1/video/projects/${projectId}/render`,
      headers: { cookie },
      payload: {},
    })
    const jobId = render.json().data.jobId

    const output = await app.inject({
      method: 'PATCH',
      url: `/api/v1/video/render-jobs/${jobId}/output`,
      headers: { cookie },
      payload: {
        outputPath: 'render/2026/bad.mp4',
        durationMs: 5_000,
        width: 640,
        height: 360,
        subtitleSegments: [],
        logoPresent: false,
        aiLabelPresent: false,
        hasBlackFrame: true,
      },
    })
    assert.equal(output.statusCode, 200)
    assert.equal(output.json().data.passed, false)
    assert.ok(output.json().data.gateResult.blockers.includes('时长'))

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/video/projects/${projectId}`,
      headers: { cookie },
    })
    assert.equal(detail.json().data.status, 'failed')
    assert.equal(detail.json().data.renderJobs[0].output, null)
  })

  test('编导：选题评分 → 简报 → 脚本合规 → 分镜', async () => {
    const ideaRes = await app.inject({
      method: 'POST',
      url: '/api/v1/director/ideas',
      headers: { cookie },
      payload: { title: '冬季保温杯场景种草', category: '家居', platformCode: 'douyin' },
    })
    assert.equal(ideaRes.statusCode, 200)
    const ideaId = ideaRes.json().data.id
    createdIdeaIds.push(ideaId)

    const scoreRes = await app.inject({
      method: 'POST',
      url: `/api/v1/director/ideas/${ideaId}/score`,
      headers: { cookie },
      payload: { days: 30 },
    })
    assert.equal(scoreRes.statusCode, 200)
    const score = scoreRes.json().data
    assert.equal(score.factors.length, 5)
    assert.ok(Array.isArray(score.missing))

    const briefRes = await app.inject({
      method: 'POST',
      url: '/api/v1/director/briefs',
      headers: { cookie },
      payload: {
        ideaId,
        title: '保温杯冬季短视频',
        objective: '提升收藏与进店',
        audience: '通勤上班族',
        keyPoints: ['保温 12 小时', '一键开盖'],
      },
    })
    assert.equal(briefRes.statusCode, 200)
    const briefId = briefRes.json().data.id
    createdBriefIds.push(briefId)

    const scriptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/director/briefs/${briefId}/scripts`,
      headers: { cookie },
      payload: {
        hook: '冬天喝水这件小事',
        body: ['保温 12 小时', '一键开盖不烫手'],
        cta: '点击了解',
      },
    })
    assert.equal(scriptRes.statusCode, 200)
    const scriptId = scriptRes.json().data.id
    assert.equal(scriptRes.json().data.complianceStatus, 'passed')

    const storyboardRes = await app.inject({
      method: 'POST',
      url: `/api/v1/director/scripts/${scriptId}/storyboard`,
      headers: { cookie },
      payload: {},
    })
    assert.equal(storyboardRes.statusCode, 200)
    assert.ok(storyboardRes.json().data.shots.length >= 3)

    const overview = await app.inject({
      method: 'GET',
      url: '/api/v1/director/overview',
      headers: { cookie },
    })
    assert.equal(overview.statusCode, 200)
    assert.ok(Array.isArray(overview.json().data.ideas))
    assert.ok(overview.json().data.assets.templateCount >= 8)
  })
})
