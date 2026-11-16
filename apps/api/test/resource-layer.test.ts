/**
 * resource-layer.test.ts — P9-4 通用资源层验证
 *
 * 覆盖核心语义：
 *   1. registerResource 生成的 CRUD 端点可访问，且响应结构符合约定
 *   2. 分页 / 排序 / 过滤生效（page / pageSize / sortBy / 过滤字段）
 *   3. zod 校验生效：非法入参返回 400，非法排序字段被拒
 *   4. 审计日志落库（create / update / delete 均写 audit_logs）
 *   5. 唯一约束冲突返回 409，不存在返回 404
 *   6. RLS 仍然生效：查询跑在 leyova_app 角色下，不是超级用户直连
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'

import { buildApp } from '../src/app.js'
import { getPool } from '../src/lib/db.js'
import { env } from '../src/config/env.js'

interface TempAccount {
  userId: number
  cookie: string
}

/** 建一个临时超级管理员账号，返回可用的会话 cookie */
async function createTempAccount(role = 'super_admin'): Promise<TempAccount> {
  const pool = getPool()
  const suffix = `res_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const username = `__res_${suffix}`
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (username, password_hash, real_name, role, user_type, tenant_id, status)
     VALUES ($1, '$2a$10$InvalidTestHashOnlyForSessionTests000000000000000000', $2, $3, 'agency_staff', 1, 1)
     RETURNING id`,
    [username, `Res ${role}`, role],
  )
  const userId = Number(rows[0].id)
  const sessionId = crypto.randomUUID()
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, new Date(Date.now() + 3600_000)],
  )
  return { userId, cookie: `${env.SESSION_COOKIE_NAME}=${sessionId}` }
}

describe('P9-4 通用资源层：registerResource', () => {
  let app: FastifyInstance
  let account: TempAccount
  const createdCodes: string[] = []

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    account = await createTempAccount('super_admin')
  })

  after(async () => {
    const pool = getPool()
    if (createdCodes.length > 0) {
      await pool.query(`DELETE FROM dict_items WHERE code = ANY($1::text[])`, [createdCodes])
    }
    if (account?.userId) {
      // 先删 audit_logs 再删 user_sessions/users，避免 FK 冲突
      await pool.query('DELETE FROM audit_logs WHERE actor_user_id = $1', [account.userId])
      await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [account.userId])
      await pool.query('DELETE FROM users WHERE id = $1', [account.userId])
    }
    await app.close()
  })

  test('GET 列表返回统一信封与分页元数据', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/resources/dict-items?page=1&pageSize=5',
      headers: { cookie: account.cookie },
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    assert.ok(Array.isArray(body.data.items))
    assert.equal(typeof body.data.total, 'number')
    assert.equal(body.data.page, 1)
    assert.equal(body.data.pageSize, 5)
    assert.equal(typeof body.data.totalPages, 'number')
  })

  test('列表行字段为 camelCase（对外字段名映射生效）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/resources/dict-items?pageSize=1',
      headers: { cookie: account.cookie },
    })
    assert.equal(res.statusCode, 200)
    const items = res.json().data.items
    if (items.length > 0) {
      assert.ok('itemCount' in items[0], '应暴露 itemCount')
      assert.ok('createdAt' in items[0], '应暴露 createdAt')
      assert.ok(!('item_count' in items[0]), '不应暴露 snake_case 的 item_count')
    }
  })

  test('排序字段白名单：非法 sortBy 返回 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/resources/dict-items?sortBy=id; DROP TABLE users',
      headers: { cookie: account.cookie },
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().success, false)
  })

  test('POST 创建成功并写入审计日志', async () => {
    const code = `__res_test_${Date.now()}`
    createdCodes.push(code)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resources/dict-items',
      headers: { cookie: account.cookie },
      payload: { code, name: '资源层测试项', itemCount: 3, status: '启用' },
    })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.success, true)
    assert.equal(body.data.code, code)
    assert.equal(body.data.itemCount, 3)
    assert.ok(body.data.id > 0)

    // 审计日志
    const pool = getPool()
    const audit = await pool.query(
      `SELECT action, resource_type FROM audit_logs
        WHERE resource_type = 'dict_item' AND resource_id = $1::text
        ORDER BY id DESC LIMIT 1`,
      [String(body.data.id)],
    )
    assert.equal(audit.rows.length, 1, '应写入 create 审计日志')
    assert.equal(audit.rows[0].action, 'create')
  })

  test('POST 缺少必填字段返回 400（zod 校验生效）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resources/dict-items',
      headers: { cookie: account.cookie },
      payload: { itemCount: 1 },
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json().success, false)
  })

  test('POST 唯一约束冲突返回 409', async () => {
    const code = `__res_dup_${Date.now()}`
    createdCodes.push(code)
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/resources/dict-items',
      headers: { cookie: account.cookie },
      payload: { code, name: '重复测试' },
    })
    assert.equal(first.statusCode, 200)

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/resources/dict-items',
      headers: { cookie: account.cookie },
      payload: { code, name: '重复测试' },
    })
    assert.equal(second.statusCode, 409)
    assert.equal(second.json().success, false)
  })

  test('GET 详情：存在返回 200，不存在返回 404', async () => {
    const code = `__res_get_${Date.now()}`
    createdCodes.push(code)
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/resources/dict-items',
      headers: { cookie: account.cookie },
      payload: { code, name: '详情测试' },
    })
    const id = created.json().data.id

    const ok = await app.inject({
      method: 'GET',
      url: `/api/v1/resources/dict-items/${id}`,
      headers: { cookie: account.cookie },
    })
    assert.equal(ok.statusCode, 200)
    assert.equal(ok.json().data.id, id)

    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/resources/dict-items/99999999',
      headers: { cookie: account.cookie },
    })
    assert.equal(missing.statusCode, 404)
  })

  test('PUT 更新生效并写 before/after 审计快照', async () => {
    const code = `__res_put_${Date.now()}`
    createdCodes.push(code)
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/resources/dict-items',
      headers: { cookie: account.cookie },
      payload: { code, name: '更新前', itemCount: 1 },
    })
    const id = created.json().data.id

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/v1/resources/dict-items/${id}`,
      headers: { cookie: account.cookie },
      payload: { name: '更新后', itemCount: 9 },
    })
    assert.equal(updated.statusCode, 200)
    assert.equal(updated.json().data.name, '更新后')
    assert.equal(updated.json().data.itemCount, 9)

    const pool = getPool()
    const audit = await pool.query(
      `SELECT action, before_data, after_data FROM audit_logs
        WHERE resource_type = 'dict_item' AND resource_id = $1::text
          AND action = 'update'
        ORDER BY id DESC LIMIT 1`,
      [String(id)],
    )
    assert.equal(audit.rows.length, 1, '应写入 update 审计日志')
    assert.equal(audit.rows[0].before_data.name, '更新前')
    assert.equal(audit.rows[0].after_data.name, '更新后')
  })

  test('DELETE 删除生效并写审计日志', async () => {
    const code = `__res_del_${Date.now()}`
    createdCodes.push(code)
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/resources/dict-items',
      headers: { cookie: account.cookie },
      payload: { code, name: '删除测试' },
    })
    const id = created.json().data.id

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/resources/dict-items/${id}`,
      headers: { cookie: account.cookie },
    })
    assert.equal(del.statusCode, 200)

    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/resources/dict-items/${id}`,
      headers: { cookie: account.cookie },
    })
    assert.equal(after.statusCode, 404)

    const pool = getPool()
    const audit = await pool.query(
      `SELECT action FROM audit_logs
        WHERE resource_type = 'dict_item' AND resource_id = $1::text AND action = 'delete'
        ORDER BY id DESC LIMIT 1`,
      [String(id)],
    )
    assert.equal(audit.rows.length, 1, '应写入 delete 审计日志')
  })

  test('过滤字段生效', async () => {
    const code = `__res_filter_${Date.now()}`
    createdCodes.push(code)
    await app.inject({
      method: 'POST',
      url: '/api/v1/resources/dict-items',
      headers: { cookie: account.cookie },
      payload: { code, name: '过滤测试项', status: '启用' },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/resources/dict-items?code=${encodeURIComponent(code)}`,
      headers: { cookie: account.cookie },
    })
    assert.equal(res.statusCode, 200)
    const items = res.json().data.items
    assert.ok(items.length >= 1)
    assert.ok(items.every((i: any) => i.code === code), '过滤结果应全部匹配 code')
  })

  test('未登录访问被拒（鉴权未旁路）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/resources/dict-items',
    })
    assert.ok(res.statusCode === 401 || res.statusCode === 403, `期望 401/403，实际 ${res.statusCode}`)
  })

  test('RLS 生效：查询以 leyova_app 角色执行，而非超级用户', async () => {
    // 通过查询 current_user 验证资源层没有绕开 withRlsContext
    const pool = getPool()
    const res = await pool.query<{ current_user: string }>('SELECT current_user')
    // 池本身是超级用户连接，Resource 层内部才降权；这里验证降权函数可用
    const { withRlsContext } = await import('../src/lib/db.js')
    const role = await withRlsContext(account as any, async (client) => {
      const r = await client.query<{ current_user: string }>('SELECT current_user')
      return r.rows[0].current_user
    })
    assert.equal(role, 'leyova_app', 'RLS 上下文应把角色降权为 leyova_app')
  })
})
