import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { sendError, sendOk } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { writeAuditLog } from '../lib/audit.js'
import { resolveAccess } from '../lib/access-resolver.js'

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours (default)
const REMEMBER_ME_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000

const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>()

function attemptKey(ip: string, username: string): string {
  return `${ip || 'unknown'}:${username.toLowerCase()}`
}

interface DbUser {
  id: number
  username: string
  password_hash: string
  real_name: string
  role: string
  user_type?: string
  tenant_id?: number
  anchor_id?: number | null
  status: number
}

interface DbPermission {
  code: string
}

export async function authRoutes(app: FastifyInstance) {
  // ── POST /api/v1/auth/login ──
  app.post('/api/v1/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 },
          rememberMe: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { username, password, rememberMe } = request.body as {
      username: string; password: string; rememberMe?: boolean
    }
    const pool = getPool()
    const key = attemptKey(request.ip, username.trim())
    const rec = failedLoginAttempts.get(key)
    const nowMs = Date.now()
    if (rec && rec.lockedUntil > nowMs) {
      const retryMin = Math.ceil((rec.lockedUntil - nowMs) / 60000)
      return sendError(reply, 429, `连续失败次数过多，账号已临时锁定，请 ${retryMin} 分钟后再试`)
    }

    let user: DbUser | null = null
    try {
      const result = await pool.query<DbUser>(
        'SELECT id, username, password_hash, real_name, role, user_type, tenant_id, anchor_id, status FROM users WHERE username = $1 AND status = 1',
        [username]
      )
      user = result.rows[0] ?? null
    } catch (err) {
      app.log.warn({ err }, 'Database query failed for login')
      return sendError(reply, 500, '服务器错误，请稍后重试')
    }

    const recordFailure = async (reason: string) => {
      const current = failedLoginAttempts.get(key)
      const isExpiredLock = Boolean(current && current.lockedUntil > 0 && current.lockedUntil <= nowMs)
      const nextCount = (isExpiredLock ? 0 : current?.count || 0) + 1
      const lockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? nowMs + LOCKOUT_WINDOW_MS : 0
      failedLoginAttempts.set(key, { count: nextCount, lockedUntil })
      if (lockedUntil > 0) {
        await writeAuditLog(pool, {
          request,
          actorUserId: user?.id ?? null,
          action: 'auth.login.lockout',
          resourceType: 'users',
          resourceId: user?.id ?? username,
          afterData: { username, ip: request.ip, reason, attempts: nextCount },
        }).catch(() => {})
      }
    }

    if (!user || !user.password_hash) {
      await recordFailure('user_not_found_or_empty_hash')
      return sendError(reply, 401, '用户名或密码不正确')
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      await recordFailure('invalid_password')
      return sendError(reply, 401, '用户名或密码不正确')
    }

    failedLoginAttempts.delete(key)

    // Create session
    const sessionId = crypto.randomUUID()
    const sessionDuration = rememberMe ? REMEMBER_ME_AGE : SESSION_MAX_AGE
    const expiresAt = new Date(Date.now() + sessionDuration)
    
    try {
      const pool2 = getPool()
      await pool2.query(
        'INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
        [sessionId, user.id, expiresAt]
      )
    } catch (err) {
      app.log.warn({ err }, 'Failed to persist session')
    }

    // Set cookie — session cookie (no maxAge) by default, deleted on browser close
    // If "rememberMe" is checked, persist for 7 days
    const forwardedProto = String(request.headers['x-forwarded-proto'] || '')
    const isHttps = request.protocol === 'https' || forwardedProto.split(',')[0]?.trim() === 'https'
    const cookieOpts: Record<string, any> = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
    }
    if (rememberMe) {
      cookieOpts.maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
    }
    reply.setCookie(env.SESSION_COOKIE_NAME, sessionId, cookieOpts)

    // Build user info
    const userInfo = {
      id: user.id,
      username: user.username,
      realName: user.real_name,
      role: user.role,
      userType: user.user_type || 'agency_staff',
      tenantId: user.tenant_id ?? 1,
      anchorId: user.anchor_id ? Number(user.anchor_id) : undefined,
    }

    return sendOk(reply, { user: userInfo })
  })

  // ── POST /api/v1/auth/logout ──
  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[env.SESSION_COOKIE_NAME]
    if (token) {
      try {
        const pool2 = getPool()
        await pool2.query('DELETE FROM user_sessions WHERE id = $1', [token])
      } catch { /* ignore */ }
    }
    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' })
    return sendOk(reply, { loggedOut: true })
  })

  // ── GET /api/v1/auth/me ──
  app.get('/api/v1/auth/me', async (request, reply) => {
    const token = request.cookies[env.SESSION_COOKIE_NAME]
    if (!token) {
      return sendError(reply, 401, '未登录')
    }

    try {
      const pool2 = getPool()
      const result = await pool2.query<{
        id: number
        username: string
        real_name: string
        role: string
        user_type?: string
        tenant_id?: number
        anchor_id?: number | null
      }>(
        `SELECT u.id, u.username, u.real_name, u.role, u.user_type, u.tenant_id, u.anchor_id
         FROM user_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > NOW() AND u.status = 1`,
        [token]
      )

      const user = result.rows[0]
      if (!user) {
        reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' })
        return sendError(reply, 401, '会话已过期，请重新登录')
      }

      // S2/S3：返回「平台 × 模块」解析后的完整权限（已取消工作模式）
      const access = await resolveAccess(
        {
          userId: user.id,
          role: user.role,
          userType: user.user_type,
          tenantId: user.tenant_id,
        },
        pool2,
      )

      return sendOk(reply, {
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          role: user.role,
          userType: user.user_type || 'agency_staff',
          tenantId: user.tenant_id ?? 1,
          anchorId: user.anchor_id ? Number(user.anchor_id) : undefined,
        },
        access: {
          dataScope: access.dataScope,
          modules: Array.from(access.modules).sort(),
          modulesByPlatform: Object.fromEntries(
            Array.from(access.modulesByPlatform.entries()).map(([k, v]) => [k, Array.from(v).sort()]),
          ),
          platforms: access.platforms === null ? null : Array.from(access.platforms).sort(),
        },
      })
    } catch (err) {
      app.log.warn({ err }, 'Session query failed')
      return sendError(reply, 500, '服务器错误')
    }
  })

  // ── POST /api/v1/auth/change-password ──
  app.post('/api/v1/auth/change-password', {
    schema: {
      body: {
        type: 'object',
        required: ['oldPassword', 'newPassword'],
        properties: {
          oldPassword: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const token = request.cookies[env.SESSION_COOKIE_NAME]
    if (!token) {
      return sendError(reply, 401, '未登录')
    }

    const { oldPassword, newPassword } = request.body as { oldPassword: string; newPassword: string }

    try {
      const pool2 = getPool()
      
      // Get user from session
      const userResult = await pool2.query<{ id: number; password_hash: string }>(
        `SELECT u.id, u.password_hash
         FROM user_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > NOW()`,
        [token]
      )
      
      const user = userResult.rows[0]
      if (!user) {
        return sendError(reply, 401, '会话已过期')
      }

      // Verify old password
      const valid = await bcrypt.compare(oldPassword, user.password_hash)
      if (!valid) {
        return sendError(reply, 400, '原密码不正确')
      }

      // Update password
      const newHash = await bcrypt.hash(newPassword, 10)
      await pool2.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id])

      return sendOk(reply, { changed: true })
    } catch (err) {
      app.log.warn({ err }, 'Password change failed')
      return sendError(reply, 500, '修改密码失败')
    }
  })
}