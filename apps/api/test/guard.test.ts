import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { requireAuth, findSessionUser } from '../src/lib/guard.js'

// ── findSessionUser：会话命中的 DB 判定 ──
test('findSessionUser: 命中有效会话返回用户', async () => {
  const pool = {
    query: async () => ({ rows: [{ id: 7, username: 'luozh', real_name: '罗真恒', role: 'ops_staff' }] }),
  }
  const user = await findSessionUser(pool, 'token-1')
  assert.deepEqual(user, { id: 7, username: 'luozh', realName: '罗真恒', role: 'ops_staff', userType: undefined, tenantId: undefined, anchorId: undefined })
})

test('findSessionUser: 无命中（过期/账号停用/会话不存在）返回 null', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  assert.equal(await findSessionUser(pool, 'stale-token'), null)
})

test('findSessionUser: 查询异常向上抛出(交由 requireAuth 归为 500)', async () => {
  const pool = {
    query: async () => {
      throw new Error('db down')
    },
  }
  await assert.rejects(findSessionUser(pool, 'token-1'))
})

// ── requireAuth：未登录（无 cookie）分支 ──
test('requireAuth: 无会话 cookie 返回 401「未登录」且业务返回 null', async () => {
  let captured: any = null
  const reply = {
    code: (_c: number) => ({ send: (obj: any) => { captured = obj } }),
    send: (_obj: any) => undefined,
  } as unknown as FastifyReply
  const request = { cookies: {} } as FastifyRequest

  const user = await requireAuth(request, reply)
  assert.equal(user, null)
  assert.ok(captured)
  assert.equal(captured.success, false)
  assert.equal(captured.message, '未登录')
})
