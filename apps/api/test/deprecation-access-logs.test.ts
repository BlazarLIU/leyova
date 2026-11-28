import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { getPool, closePool } from '../src/lib/db.js'
import { env } from '../src/config/env.js'

describe('30 天废弃路由下线观测与告警测试', () => {
  let app: FastifyInstance
  let adminCookie: string
  const testSessionId = crypto.randomUUID()

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    const pool = getPool()
    const expiresAt = new Date(Date.now() + 3600_000)
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, 1, $2)`,
      [testSessionId, expiresAt],
    )
    adminCookie = `${env.SESSION_COOKIE_NAME}=${testSessionId}`
  })

  after(async () => {
    const pool = getPool()
    await pool.query(`DELETE FROM user_sessions WHERE id = $1`, [testSessionId])
    await app.close()
    await closePool()
  })

  test('请求废弃路由时返回 Warning 299 响应头并记录到 sys_deprecation_access_logs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/sessions',
      headers: {
        cookie: adminCookie,
        'user-agent': 'Jest-Deprecation-Test-Agent/1.0',
      },
    })

    assert.equal(res.statusCode, 200)
    assert.ok(res.headers.warning?.includes('299'))
    assert.ok(res.headers['x-deprecation-notice'])

    // 等待异步落库完成（最多等待 300ms）
    await new Promise((r) => setTimeout(r, 200))

    const pool = getPool()
    const logRes = await pool.query(
      `SELECT method, route_path, user_agent, user_role FROM public.sys_deprecation_access_logs
       WHERE route_path = '/api/v1/ai/sessions' AND user_agent = 'Jest-Deprecation-Test-Agent/1.0'
       ORDER BY id DESC LIMIT 1`,
    )

    assert.equal(logRes.rows.length, 1)
    assert.equal(logRes.rows[0].method, 'GET')
    assert.equal(logRes.rows[0].route_path, '/api/v1/ai/sessions')
    assert.equal(logRes.rows[0].user_role, 'super_admin')
  })

  test('管理员可通过 GET /api/v1/system/deprecation-logs 查询最近 30 天废弃路由下线观测汇总', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/system/deprecation-logs?limit=10',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.payload)
    assert.equal(body.success, true)
    assert.ok(body.data.summary)
    assert.ok(body.data.summary.totalHits >= 1)
    assert.ok(Array.isArray(body.data.routeStats))
    assert.ok(Array.isArray(body.data.logs))
    assert.ok(body.data.logs.some((l: any) => l.routePath === '/api/v1/ai/sessions'))
  })
})
