/**
 * access-control.ts — 账号访问控制（S2 账号体系重构）
 *
 * 提供「平台 × 模块」权限的管理端点（S3 起取消工作模式）：
 *   GET    /api/v1/access/me                当前账号解析后的完整权限
 *   GET    /api/v1/access/roles/:code/grants 查看某角色在三种模式下的模块授权
 *   PUT    /api/v1/access/roles/:code/grants 更新某角色的模块授权（按模式）
 *   GET    /api/v1/access/users/:id/overrides 查看用户级覆盖
 *   PUT    /api/v1/access/users/:id/overrides 更新用户级覆盖
 *   GET    /api/v1/access/capability-matrix   平台能力矩阵
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { resolveAccess } from '../lib/access-resolver.js'

const ADMIN_ROLES = ['super_admin']

export async function accessControlRoutes(app: FastifyInstance) {
  // ── GET /api/v1/access/me ── 当前账号完整权限
  app.get('/api/v1/access/me', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user
    try {
      const access = await withRlsContext(request, (client) =>
        resolveAccess(
          {
            userId: user.id,
            role: user.role,
            userType: user.userType,
            tenantId: user.tenantId,
          },
          client,
        ),
      )
      return sendOk(reply, {
        dataScope: access.dataScope,
        modules: Array.from(access.modules).sort(),
        modulesByPlatform: Object.fromEntries(
          Array.from(access.modulesByPlatform.entries()).map(([k, v]) => [k, Array.from(v).sort()]),
        ),
        platforms: access.platforms === null ? null : Array.from(access.platforms).sort(),
      })
    } catch (err) {
      request.log.warn({ err }, 'access/me failed')
      return sendError(reply, 500, '获取权限失败')
    }
  })

  // ── GET /api/v1/access/roles/:code/grants ── 角色模块授权
  app.get('/api/v1/access/roles/:code/grants', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.params as { code: string }
    try {
      const res = await withRlsContext(request, (client) =>
        client.query(
          `SELECT module_code, effect
             FROM public.role_module_grants
            WHERE role_code = $1
            ORDER BY module_code`,
          [code],
        ),
      )
      const allow: string[] = []
      const deny: string[] = []
      for (const r of res.rows) {
        ;(r.effect === 'deny' ? deny : allow).push(r.module_code)
      }
      return sendOk(reply, { allow, deny })
    } catch (err) {
      request.log.warn({ err }, 'access/roles grants failed')
      return sendError(reply, 500, '获取角色授权失败')
    }
  })

  // ── PUT /api/v1/access/roles/:code/grants ── 更新角色模块授权（全量替换）
  app.put('/api/v1/access/roles/:code/grants', { preHandler: [requireRole(ADMIN_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.params as { code: string }
    const body = (request.body || {}) as {
      modules?: string[]
      effect?: 'allow' | 'deny'
    }

    if (!Array.isArray(body.modules)) {
      return sendError(reply, 400, 'modules 必须是字符串数组')
    }
    const effect = body.effect === 'deny' ? 'deny' : 'allow'

    try {
      const result = await withRlsContext(request, async (client) => {
        const before = await client.query(
          `SELECT module_code FROM public.role_module_grants
            WHERE role_code = $1 AND effect = $2 ORDER BY module_code`,
          [code, effect],
        )

        await client.query(
          `DELETE FROM public.role_module_grants WHERE role_code = $1 AND effect = $2`,
          [code, effect],
        )

        if (body.modules!.length > 0) {
          await client.query(
            `INSERT INTO public.role_module_grants (role_code, module_code, effect)
             SELECT $1, unnest($2::varchar[]), $3
             ON CONFLICT (role_code, module_code)
             DO UPDATE SET effect = EXCLUDED.effect`,
            [code, body.modules, effect],
          )
        }

        return {
          before: before.rows.map((r: any) => r.module_code),
          after: [...body.modules!].sort(),
          effect,
        }
      })

      await withRlsContext(request, (client) => writeAuditLog(client, {
        request,
        action: 'access.role_grants.update',
        resourceType: 'role_module_grants',
        resourceId: `${code}:${effect}`,
        afterData: result,
      }))

      return sendOk(reply, result, '角色授权已更新')
    } catch (err) {
      request.log.warn({ err }, 'access/roles grants update failed')
      return sendError(reply, 500, '更新角色授权失败')
    }
  })

  // ── GET /api/v1/access/users/:id/overrides ── 用户级模块覆盖
  app.get('/api/v1/access/users/:id/overrides', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const uid = Number(id)
    if (!Number.isFinite(uid)) return sendError(reply, 400, '用户 ID 非法')

    try {
      const res = await withRlsContext(request, (client) =>
        client.query(
          `SELECT module_code, effect, note, created_at
             FROM public.user_module_overrides WHERE user_id = $1 ORDER BY module_code`,
          [uid],
        ),
      )
      return sendOk(reply, {
        grants: res.rows.filter((r: any) => r.effect === 'grant').map((r: any) => r.module_code),
        revokes: res.rows.filter((r: any) => r.effect === 'revoke').map((r: any) => r.module_code),
        detail: res.rows,
      })
    } catch (err) {
      request.log.warn({ err }, 'access/users overrides failed')
      return sendError(reply, 500, '获取用户覆盖失败')
    }
  })

  // ── PUT /api/v1/access/users/:id/overrides ── 更新用户级覆盖（全量替换）
  app.put('/api/v1/access/users/:id/overrides', { preHandler: [requireRole(ADMIN_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const uid = Number(id)
    if (!Number.isFinite(uid)) return sendError(reply, 400, '用户 ID 非法')

    const body = (request.body || {}) as { grants?: string[]; revokes?: string[] }
    const grants = Array.isArray(body.grants) ? body.grants : []
    const revokes = Array.isArray(body.revokes) ? body.revokes : []

    if (grants.length > 0 && revokes.length > 0) {
      const both = grants.filter((m) => revokes.includes(m))
      if (both.length > 0) {
        return sendError(reply, 400, `模块不能同时出现在 grant 与 revoke 中：${both.join(', ')}`)
      }
    }

    try {
      const operator = (request as any).user
      const result = await withRlsContext(request, async (client) => {
        const before = await client.query(
          `SELECT module_code, effect FROM public.user_module_overrides WHERE user_id = $1`,
          [uid],
        )
        await client.query(`DELETE FROM public.user_module_overrides WHERE user_id = $1`, [uid])

        for (const [effect, list] of [['grant', grants], ['revoke', revokes]] as const) {
          if (list.length === 0) continue
          await client.query(
            `INSERT INTO public.user_module_overrides (user_id, module_code, effect, granted_by)
             SELECT $1, unnest($2::varchar[]), $3, $4
             ON CONFLICT (user_id, module_code) DO UPDATE SET effect = EXCLUDED.effect`,
            [uid, list, effect, operator?.id ?? null],
          )
        }

        return {
          before: before.rows.map((r: any) => `${r.module_code}:${r.effect}`),
          after: [...grants.map((m) => `${m}:grant`), ...revokes.map((m) => `${m}:revoke`)].sort(),
        }
      })

      await withRlsContext(request, (client) => writeAuditLog(client, {
        request,
        action: 'access.user_overrides.update',
        resourceType: 'user_module_overrides',
        resourceId: String(uid),
        afterData: result,
      }))

      return sendOk(reply, result, '用户模块覆盖已更新')
    } catch (err) {
      request.log.warn({ err }, 'access/users overrides update failed')
      return sendError(reply, 500, '更新用户覆盖失败')
    }
  })

  // ── GET /api/v1/access/capability-matrix ── 平台能力矩阵
  app.get('/api/v1/access/capability-matrix', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const res = await withRlsContext(request, (client) =>
        client.query(
          `SELECT m.platform_code, p.platform_name, p.category, p.is_enabled,
                  m.module_code, m.is_applicable, m.needs_dedicated_page, m.note
             FROM public.platform_capability_matrix m
             JOIN public.system_platform_configs p ON p.platform_code = m.platform_code
            ORDER BY p.sort_order, m.module_code`,
        ),
      )
      return sendOk(reply, res.rows)
    } catch (err) {
      request.log.warn({ err }, 'access/capability-matrix failed')
      return sendError(reply, 500, '获取平台能力矩阵失败')
    }
  })
}
