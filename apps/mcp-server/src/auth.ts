import crypto from 'node:crypto'
import type { IncomingMessage } from 'node:http'

import { pool } from './db.js'

const SIGNATURE_TTL_SECONDS = 300

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

export function buildSignaturePayload(p: {
  userId: number
  tenantId: number
  scopeType: string
  scopeId: string
  ts: number
}): string {
  return `leyova-mcp-uid:${p.userId}:tid:${p.tenantId}:scope:${p.scopeType}:${p.scopeId}:ts:${p.ts}`
}

export function signPayload(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

async function isScopeAuthorized(
  userId: number,
  tenantId: number,
  scopeType: string,
  scopeId: string
): Promise<boolean> {
  if (scopeType === 'user') return scopeId === `user:${userId}`
  if (scopeType === 'tenant') return scopeId === `tenant:${tenantId}` || scopeId === String(tenantId)
  if (scopeType === 'shop' || scopeType === 'store') {
    const shopId = Number(scopeId.replace(/^(shop|store):/, ''))
    if (!Number.isInteger(shopId) || shopId <= 0) return false
    const { rows } = await pool.query(
      'SELECT 1 FROM public.user_platform_permissions WHERE user_id = $1 AND $2 = ANY(shop_scope) LIMIT 1',
      [userId, shopId]
    )
    return rows.length > 0
  }
  return false
}

export async function parseAuth(
  req: IncomingMessage
): Promise<
  | { userId: number; role: string; tenantId: number; scopeType: string; scopeId: string }
  | { error: string; status: number }
> {
  const configuredToken = process.env.LEYOVA_MCP_TOKEN || ''
  if (process.env.NODE_ENV === 'production' && !configuredToken) {
    return { status: 500, error: 'LEYOVA_MCP_TOKEN not configured' }
  }
  if (configuredToken) {
    const authHeader = String(req.headers.authorization || '')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token || !timingSafeEqualStr(token, configuredToken)) {
      return { status: 401, error: 'Unauthorized' }
    }
  }

  const userId = parseInt(req.headers['x-leyova-user-id'] as string, 10)
  if (!Number.isInteger(userId) || userId <= 0) {
    return { status: 401, error: 'Missing or invalid X-Leyova-User-Id header' }
  }

  const reqTenantId = parseInt(req.headers['x-leyova-tenant-id'] as string, 10)
  const scopeType = (req.headers['x-leyova-scope-type'] as string) || 'user'
  const scopeId = (req.headers['x-leyova-scope-id'] as string) || `user:${userId}`

  const requireSig =
    process.env.NODE_ENV === 'production' || process.env.LEYOVA_MCP_REQUIRE_SIG === 'true'
  const sigHeader = String(req.headers['x-leyova-user-sig'] || '').trim()
  const tsHeader = String(req.headers['x-leyova-ts'] || '').trim()
  const hmacSecret = process.env.LEYOVA_MCP_SIGNING_SECRET || configuredToken

  if (requireSig && (!sigHeader || !tsHeader)) {
    return { status: 401, error: 'Missing X-Leyova-User-Sig or X-Leyova-Ts header' }
  }

  if (sigHeader) {
    if (!hmacSecret) {
      return { status: 500, error: 'MCP signing secret not configured' }
    }
    if (!Number.isInteger(reqTenantId) || reqTenantId <= 0) {
      return { status: 401, error: 'Signed requests require a valid X-Leyova-Tenant-Id header' }
    }
    const ts = Number(tsHeader)
    if (!Number.isFinite(ts)) {
      return { status: 401, error: 'Missing or invalid X-Leyova-Ts header' }
    }
    const nowSec = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSec - ts) > SIGNATURE_TTL_SECONDS) {
      return { status: 401, error: 'Signature expired' }
    }
    // 仅接受覆盖 user + tenant + scope + 时间戳的完整签名，不再兼容仅签 uid 的旧格式
    const payload = buildSignaturePayload({ userId, tenantId: reqTenantId, scopeType, scopeId, ts })
    const expected = signPayload(hmacSecret, payload)
    if (!timingSafeEqualStr(sigHeader.toLowerCase(), expected)) {
      return { status: 403, error: 'Invalid X-Leyova-User-Sig (HMAC mismatch across user, tenant, scope and ts)' }
    }
  }

  const { rows } = await pool.query<{ role: string; tenant_id?: number }>(
    'SELECT role, tenant_id FROM users WHERE id = $1 AND status = 1 LIMIT 1',
    [userId]
  )
  if (rows.length === 0) {
    return { status: 401, error: 'Unknown or disabled user' }
  }

  const userTenant = rows[0].tenant_id
  if (!Number.isInteger(userTenant) || Number(userTenant) <= 0) {
    return { status: 403, error: 'Fail-closed: user has no valid tenant assigned' }
  }
  if (Number.isInteger(reqTenantId) && reqTenantId > 0 && reqTenantId !== Number(userTenant)) {
    return { status: 403, error: 'Tenant does not match authenticated user' }
  }
  if (!(await isScopeAuthorized(userId, Number(userTenant), scopeType, scopeId))) {
    return { status: 403, error: `Scope not authorized: ${scopeType}:${scopeId}` }
  }

  return { userId, role: rows[0].role, tenantId: Number(userTenant), scopeType, scopeId }
}
