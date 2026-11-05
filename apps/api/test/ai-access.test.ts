import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AuthUser } from '../src/lib/guard.js'
import {
  isAdminRole,
  buildSessionsQuery,
  assertConversationOwnership,
} from '../src/lib/ai-access.js'

const admin: AuthUser = { id: 1, username: 'admin', realName: '管理员', role: 'super_admin' }
const staff: AuthUser = { id: 3, username: 'luozh', realName: '罗真恒', role: 'ops_staff' }

// ── isAdminRole ──
test('isAdminRole: 仅 super_admin 判定为管理员', () => {
  assert.equal(isAdminRole('super_admin'), true)
  assert.equal(isAdminRole('ops_staff'), false)
  assert.equal(isAdminRole('ops_director'), false)
  assert.equal(isAdminRole('controller'), false)
  assert.equal(isAdminRole(''), false)
})

// ── buildSessionsQuery ──
test('buildSessionsQuery: 管理员不过滤 user_id 并关联会话拥有人', () => {
  const q = buildSessionsQuery(true, 5)
  assert.equal(q.params.length, 0)
  assert.ok(q.text.includes('LEFT JOIN users'), '应关联 users 表')
  assert.ok(q.text.includes('owner_name'), '应输出拥有人姓名')
  assert.ok(!q.text.includes('user_id = $'), '不应按 user_id 过滤')
})

test('buildSessionsQuery: 普通用户严格按 user_id 过滤', () => {
  const q = buildSessionsQuery(false, staff.id)
  assert.deepEqual(q.params, [staff.id])
  assert.ok(q.text.includes(' WHERE user_id = $1'))
  assert.ok(!q.text.includes('LEFT JOIN users'), '不关联别的用户')
})

// ── assertConversationOwnership ──
test('归属校验: 管理员一律放行且不查库', async () => {
  const calls: unknown[] = []
  const pool = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params })
      return { rows: [] }
    },
  }
  const r = await assertConversationOwnership(pool, 'any-conv', admin)
  assert.deepEqual(r, { ok: true })
  assert.equal(calls.length, 0, '管理员不应发起归属查询')
})

test('归属校验: 普通用户会话归属自己', async () => {
  const pool = { query: async () => ({ rows: [{ user_id: staff.id }] }) }
  const r = await assertConversationOwnership(pool, 'c-1', staff)
  assert.deepEqual(r, { ok: true })
})

test('归属校验: 普通用户访问他人会话被拒', async () => {
  const pool = { query: async () => ({ rows: [{ user_id: 999 }] }) }
  const r = await assertConversationOwnership(pool, 'c-other', staff)
  assert.deepEqual(r, { ok: false })
})

test('归属校验: 会话不存在返回不可访问', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  const r = await assertConversationOwnership(pool, 'does-not-exist', staff)
  assert.deepEqual(r, { ok: false })
})

test('归属校验: 查询异常安全返回不可访问', async () => {
  const pool = {
    query: async () => {
      throw new Error('boom')
    },
  }
  const r = await assertConversationOwnership(pool, 'c-1', staff)
  assert.deepEqual(r, { ok: false })
})
