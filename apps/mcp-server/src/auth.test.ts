import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildSignaturePayload, parseAuth, signPayload } from './auth.js'

function fakeReq(headers: Record<string, string>): any {
  return { headers }
}

test('signature payload covers user, tenant, scope and timestamp', () => {
  const payload = buildSignaturePayload({
    userId: 7,
    tenantId: 2,
    scopeType: 'store',
    scopeId: 'store:1001',
    ts: 1700000000,
  })
  assert.equal(payload, 'leyova-mcp-uid:7:tid:2:scope:store:store:1001:ts:1700000000')
  assert.notEqual(signPayload('s', payload), signPayload('s', payload.replace('tid:2', 'tid:3')))
  assert.notEqual(signPayload('s', payload), signPayload('s', payload.replace('store:1001', 'store:1002')))
})

test('production rejects requests without signature', async () => {
  const prevEnv = process.env.NODE_ENV
  const prevToken = process.env.LEYOVA_MCP_TOKEN
  process.env.NODE_ENV = 'production'
  process.env.LEYOVA_MCP_TOKEN = 'test-token'
  try {
    const res = await parseAuth(
      fakeReq({ authorization: 'Bearer test-token', 'x-leyova-user-id': '7', 'x-leyova-tenant-id': '2' })
    )
    assert.ok('error' in res)
    assert.equal(res.status, 401)
  } finally {
    process.env.NODE_ENV = prevEnv
    process.env.LEYOVA_MCP_TOKEN = prevToken
  }
})

test('legacy uid-only signature is rejected', async () => {
  const prevEnv = process.env.NODE_ENV
  const prevToken = process.env.LEYOVA_MCP_TOKEN
  const prevSecret = process.env.LEYOVA_MCP_SIGNING_SECRET
  process.env.NODE_ENV = 'test'
  process.env.LEYOVA_MCP_TOKEN = 'test-token'
  process.env.LEYOVA_MCP_SIGNING_SECRET = 'test-secret'
  try {
    const legacy = signPayload('test-secret', 'leyova-mcp-uid:7')
    const res = await parseAuth(
      fakeReq({
        authorization: 'Bearer test-token',
        'x-leyova-user-id': '7',
        'x-leyova-tenant-id': '2',
        'x-leyova-scope-type': 'tenant',
        'x-leyova-scope-id': 'tenant:2',
        'x-leyova-ts': String(Math.floor(Date.now() / 1000)),
        'x-leyova-user-sig': legacy,
      })
    )
    assert.ok('error' in res)
    assert.equal(res.status, 403)
  } finally {
    process.env.NODE_ENV = prevEnv
    process.env.LEYOVA_MCP_TOKEN = prevToken
    process.env.LEYOVA_MCP_SIGNING_SECRET = prevSecret
  }
})

test('expired timestamp is rejected before any data access', async () => {
  const prevEnv = process.env.NODE_ENV
  const prevToken = process.env.LEYOVA_MCP_TOKEN
  const prevSecret = process.env.LEYOVA_MCP_SIGNING_SECRET
  process.env.NODE_ENV = 'test'
  process.env.LEYOVA_MCP_TOKEN = 'test-token'
  process.env.LEYOVA_MCP_SIGNING_SECRET = 'test-secret'
  try {
    const ts = Math.floor(Date.now() / 1000) - 3600
    const sig = signPayload(
      'test-secret',
      buildSignaturePayload({ userId: 7, tenantId: 2, scopeType: 'tenant', scopeId: 'tenant:2', ts })
    )
    const res = await parseAuth(
      fakeReq({
        authorization: 'Bearer test-token',
        'x-leyova-user-id': '7',
        'x-leyova-tenant-id': '2',
        'x-leyova-scope-type': 'tenant',
        'x-leyova-scope-id': 'tenant:2',
        'x-leyova-ts': String(ts),
        'x-leyova-user-sig': sig,
      })
    )
    assert.ok('error' in res)
    assert.equal(res.status, 401)
  } finally {
    process.env.NODE_ENV = prevEnv
    process.env.LEYOVA_MCP_TOKEN = prevToken
    process.env.LEYOVA_MCP_SIGNING_SECRET = prevSecret
  }
})
