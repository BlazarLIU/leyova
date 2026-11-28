import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { tenantIdOf } from '../lib/tenant-context.js'
import { canManageTargetUser, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

/**
 * system 域拆分（P2-1）：账号 / 角色与模块权限
 * 原属 routes/system.ts，2026-11-17 拆出。
 */
export async function systemUsersRoutes(app: FastifyInstance) {
  // ── GET /api/v1/system/users ──
  app.get('/api/v1/system/users', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const result = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          `SELECT id, username, real_name AS "realName", role, user_type AS "userType",
                  tenant_id AS "tenantId", anchor_id AS "anchorId", status,
                  last_login_at AS "lastLogin", created_at AS "createdAt"
           FROM users
           WHERE ($1 = 'super_admin' OR tenant_id = $2)
           ORDER BY id`,
          [actor.role, tenantIdOf(actor)],
        )
        const out = []
        for (const row of rows) {
          const { rows: mods } = await client.query(
            'SELECT module_code FROM role_modules WHERE role_code = $1',
            [row.role],
          )
          out.push({ ...row, modules: mods.map((m: any) => m.module_code) })
        }
        return out
      })
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'system/users list failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/system/users ──
  app.post('/api/v1/system/users', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const body = request.body as {
        username?: string; realName?: string; role?: string; status?: number; modules?: string[]
        password?: string; anchorId?: number | null; tenantId?: number | null; userType?: string
      }
      const username = (body.username || '').trim()
      if (!username || username.length > 50) {
        return sendError(reply, 400, '用户名不能为空且长度不能超过 50 个字符')
      }
      const { env } = await import('../config/env.js')
      const password = body.password || env.DEFAULT_USER_PASSWORD
      if (!password) {
        return sendError(reply, 400, '密码不能为空')
      }
      // 角色白名单与 roles 表一致（2026-11-18 组织收敛：admin/employee/brand_viewer/operator 已删）
      const role = body.role || 'ops_staff'
      const validRoles = ['super_admin', 'ops_director', 'ops_staff', 'ad_buyer', 'hrbp', 'controller']
      if (!validRoles.includes(role)) {
        return sendError(reply, 400, '角色不合法，可选角色：系统管理员(super_admin)、运营总监(ops_director)、运营专员(ops_staff)、投放专员(ad_buyer)、短视频运营(video_editor)、HRBP(hrbp)、客服后端(cs_agent)、中控(controller)')
      }
      if (!canManageTargetUser(actor.role, undefined, role)) {
        return sendError(reply, 403, '仅超级管理员可创建 super_admin 账号')
      }
      const hash = bcrypt.hashSync(password, 10)
      const tenantId = actor.role === 'super_admin' && body.tenantId ? body.tenantId : tenantIdOf(actor)
      const userType = body.userType === 'brand_viewer' ? 'brand_viewer' : 'agency_staff'

      const out = await withRlsContext(request, async (client) => {
        const { rows: existing } = await client.query(
          'SELECT 1 FROM users WHERE username = $1',
          [username],
        )
        if (existing.length > 0) {
          return { errStatus: 409 as const, errMsg: '用户名已存在' }
        }

        const { rows } = await client.query(
          `INSERT INTO users (username, password_hash, real_name, role, status, tenant_id, user_type, anchor_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, username, real_name AS "realName", role, status, tenant_id AS "tenantId", user_type AS "userType", anchor_id AS "anchorId", created_at AS "createdAt"`,
          [username, hash, body.realName || '新用户', role, body.status ?? 1, tenantId, userType, body.anchorId ?? null],
        )
        if (rows.length === 0) return { errStatus: 500 as const, errMsg: '创建失败' }

        if (body.modules && body.modules.length > 0 && canManageTargetUser(actor.role, role, role)) {
          for (const mc of body.modules) {
            await client.query(
              'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [role, mc],
            )
          }
        }
        await writeAuditLog(client, {
          request,
          action: 'system.user.create',
          resourceType: 'users',
          resourceId: rows[0].id,
          afterData: rows[0],
        })
        return { row: rows[0] }
      })

      if ('errStatus' in out && out.errStatus !== undefined) return sendError(reply, out.errStatus, out.errMsg)
      return sendOk(reply, out.row)
    } catch (err) {
      request.log.warn({ err }, 'system/users create failed')
      return sendError(reply, 500, '创建失败，请检查输入后重试')
    }
  })

  // ── PUT /api/v1/system/users/:id ──
  app.put('/api/v1/system/users/:id', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const { id } = request.params as { id: string }
      const targetId = parseInt(id)
      const body = request.body as {
        realName?: string; role?: string; status?: number; modules?: string[]
      }

      const out = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query(
          'SELECT id, username, real_name AS "realName", role, status, tenant_id AS "tenantId", user_type AS "userType", anchor_id AS "anchorId" FROM users WHERE id = $1',
          [targetId],
        )
        if (beforeRes.rows.length === 0) {
          return { errStatus: 404 as const, errMsg: '目标用户不存在' }
        }
        const beforeUser = beforeRes.rows[0]
        if (!canManageTargetUser(actor.role, beforeUser.role, body.role)) {
          return { errStatus: 403 as const, errMsg: '无权修改 super_admin 账号或将账号提权为 super_admin' }
        }

        await client.query(
          `UPDATE users SET real_name = COALESCE($1, real_name), role = COALESCE($2, role),
           status = COALESCE($3, status), updated_at = NOW() WHERE id = $4`,
          [body.realName, body.role, body.status, targetId],
        )
        if (body.role && body.modules && canManageTargetUser(actor.role, body.role, body.role)) {
          await client.query('DELETE FROM role_modules WHERE role_code = $1', [body.role])
          for (const mc of (body.modules || [])) {
            await client.query(
              'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [body.role, mc],
            )
          }
        }
        const afterRes = await client.query(
          'SELECT id, username, real_name AS "realName", role, status, tenant_id AS "tenantId", user_type AS "userType", anchor_id AS "anchorId" FROM users WHERE id = $1',
          [targetId],
        )
        await writeAuditLog(client, {
          request,
          action: 'system.user.update',
          resourceType: 'users',
          resourceId: targetId,
          beforeData: beforeUser,
          afterData: afterRes.rows[0] ?? null,
        })
        return { updated: true }
      })

      if ('errStatus' in out && out.errStatus !== undefined) return sendError(reply, out.errStatus, out.errMsg)
      return sendOk(reply, { updated: true })
    } catch (err) {
      request.log.warn({ err }, 'system/users update failed')
      return sendError(reply, 500, '更新用户失败')
    }
  })

  // ── DELETE /api/v1/system/users/:id ──
  app.delete('/api/v1/system/users/:id', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const { id } = request.params as { id: string }
      const targetId = parseInt(id)
      if (targetId === actor.id) {
        return sendError(reply, 400, '不能删除当前登录账号')
      }

      const out = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query(
          'SELECT id, username, real_name AS "realName", role, status, tenant_id AS "tenantId", user_type AS "userType" FROM users WHERE id = $1',
          [targetId],
        )
        if (beforeRes.rows.length === 0) {
          return { errStatus: 404 as const, errMsg: '目标用户不存在' }
        }
        if (!canManageTargetUser(actor.role, beforeRes.rows[0].role)) {
          return { errStatus: 403 as const, errMsg: '仅超级管理员可删除 super_admin 账号' }
        }
        const result = await client.query('DELETE FROM users WHERE id = $1', [targetId])
        if ((result.rowCount ?? 0) > 0) {
          await writeAuditLog(client, {
            request,
            action: 'system.user.delete',
            resourceType: 'users',
            resourceId: targetId,
            beforeData: beforeRes.rows[0],
          })
        }
        return { deleted: (result.rowCount ?? 0) > 0 }
      })

      if ('errStatus' in out && out.errStatus !== undefined) return sendError(reply, out.errStatus, out.errMsg)
      return sendOk(reply, { deleted: out.deleted })
    } catch (err) {
      request.log.warn({ err }, 'system/users delete failed')
      return sendError(reply, 500, '删除用户失败')
    }
  })

}
