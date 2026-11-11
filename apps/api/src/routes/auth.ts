import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { sendError, sendOk } from '../lib/http.js'
import { getPool } from '../lib/db.js'

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours (default)
const REMEMBER_ME_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

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

    if (!user) {
      return sendError(reply, 401, '用户名或密码不正确')
    }

    // Verify password
    if (user.password_hash) {
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) {
        return sendError(reply, 401, '用户名或密码不正确')
      }
    }

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
    const cookieOpts: Record<string, any> = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
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