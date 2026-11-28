/**
 * workbench.ts — 角色工作台与权限申请（W2.5）
 *
 *   GET  /api/v1/workbench/me                     当前账号的专属工作台（已按权限过滤）
 *   GET  /api/v1/permission-requests/mine         我的权限申请
 *   POST /api/v1/permission-requests              申请某个模块（同一模块只允许一个待审）
 *   GET  /api/v1/permission-requests              待审列表（管理员）
 *   POST /api/v1/permission-requests/:id/approve  通过 → 写 user_module_overrides(grant)
 *   POST /api/v1/permission-requests/:id/reject   驳回
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { tenantIdOf } from '../lib/tenant-context.js'
import { z } from 'zod'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { resolveAccess } from '../lib/access-resolver.js'
import { getWorkbenchForUser } from '../services/workbench.js'

const REVIEW_ROLES = ['super_admin', 'ops_director']

const createRequestSchema = z.object({
  moduleCode: z.string().trim().min(1, 'moduleCode 不能为空'),
  reason: z.string().trim().max(500).optional(),
})

const reviewSchema = z.object({
  note: z.string().trim().max(500).optional(),
})

type AuthUserLike = {
  id: number
  role: string
  userType?: string | null
  tenantId?: number | null
}

export async function workbenchRoutes(app: FastifyInstance) {
  // ── GET /api/v1/workbench/me ── 当前账号工作台
  app.get('/api/v1/workbench/me', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserLike
    try {
      const payload = await getWorkbenchForUser({
        userId: user.id,
        role: user.role,
        userType: user.userType,
        tenantId: user.tenantId,
      })
      return sendOk(reply, payload)
    } catch (err) {
      request.log.warn({ err }, 'workbench/me failed')
      return sendError(reply, 500, '获取工作台失败')
    }
  })

  // ── GET /api/v1/permission-requests/mine ── 我的申请
  app.get('/api/v1/permission-requests/mine', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserLike
    try {
      const res = await withRlsContext(request, (client) =>
        client.query(
          `SELECT r.id, r.module_code, m.name AS module_name, r.reason, r.status,
                  r.review_note, r.created_at, r.reviewed_at
             FROM public.permission_requests r
             LEFT JOIN public.system_modules m ON m.code = r.module_code
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC
            LIMIT 100`,
          [user.id],
        ),
      )
      return sendOk(reply, res.rows)
    } catch (err) {
      request.log.warn({ err }, 'permission-requests/mine failed')
      return sendError(reply, 500, '获取权限申请失败')
    }
  })

  // ── POST /api/v1/permission-requests ── 申请模块权限
  app.post('/api/v1/permission-requests', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserLike
    const parsed = createRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendError(reply, 400, parsed.error.issues[0]?.message || '参数非法')
    }
    const { moduleCode, reason } = parsed.data

    try {
      const access = await resolveAccess({
        userId: user.id,
        role: user.role,
        userType: user.userType,
        tenantId: user.tenantId,
      })
      if (access.modules.has(moduleCode)) {
        return sendError(reply, 400, '当前账号已拥有该模块权限')
      }

      const moduleRes = await withRlsContext(request, (client) =>
        client.query(
          `SELECT code, name FROM public.system_modules WHERE code = $1 AND is_enabled = true`,
          [moduleCode],
        ),
      )
      if (moduleRes.rows.length === 0) {
        return sendError(reply, 400, '模块不存在或已停用')
      }

      const tenantId = tenantIdOf(user)
      const inserted = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO public.permission_requests (tenant_id, user_id, module_code, reason)
           VALUES ($1, $2, $3, $4)
           RETURNING id, module_code, reason, status, created_at`,
          [tenantId, user.id, moduleCode, reason ?? null],
        ),
      )

      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          action: 'permission.request.create',
          resourceType: 'permission_requests',
          resourceId: inserted.rows[0].id,
          afterData: { moduleCode, reason: reason ?? null },
        }),
      )

      return sendOk(reply, inserted.rows[0], '权限申请已提交')
    } catch (err: any) {
      if (err?.code === '23505') {
        return sendError(reply, 409, '该模块已有一条待审申请，请等待审批')
      }
      request.log.warn({ err }, 'permission-requests create failed')
      return sendError(reply, 500, '提交权限申请失败')
    }
  })

  // ── GET /api/v1/permission-requests ── 待审列表（管理员）
  app.get('/api/v1/permission-requests', { preHandler: [requireRole(REVIEW_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserLike
    const status = ((request.query as any)?.status as string | undefined) || 'pending'
    if (!['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(status)) {
      return sendError(reply, 400, 'status 非法')
    }

    try {
      const res = await withRlsContext(request, (client) =>
        client.query(
          `SELECT r.id, r.user_id, u.username, u.real_name AS user_name, u.role AS user_role,
                  r.module_code, m.name AS module_name, r.reason, r.status,
                  r.reviewed_by, ru.real_name AS reviewer_name, r.reviewed_at,
                  r.review_note, r.created_at
             FROM public.permission_requests r
             JOIN public.users u ON u.id = r.user_id
             LEFT JOIN public.system_modules m ON m.code = r.module_code
             LEFT JOIN public.users ru ON ru.id = r.reviewed_by
            WHERE r.tenant_id = $1
              AND ($2 = 'all' OR r.status = $2)
            ORDER BY r.created_at DESC
            LIMIT 200`,
          [tenantIdOf(user), status],
        ),
      )
      return sendOk(reply, res.rows)
    } catch (err) {
      request.log.warn({ err }, 'permission-requests list failed')
      return sendError(reply, 500, '获取待审申请失败')
    }
  })

  // ── POST /api/v1/permission-requests/:id/approve ── 通过
  app.post('/api/v1/permission-requests/:id/approve', { preHandler: [requireRole(REVIEW_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserLike
    const { id } = request.params as { id: string }
    const note = reviewSchema.safeParse(request.body ?? {}).success
      ? reviewSchema.parse(request.body ?? {}).note
      : undefined

    try {
      const outcome = await withRlsContext(request, async (client) => {
        const rowRes = await client.query(
          `SELECT id, user_id, module_code, status, tenant_id
             FROM public.permission_requests
            WHERE id = $1 AND tenant_id = $2
            FOR UPDATE`,
          [id, tenantIdOf(user)],
        )
        const row = rowRes.rows[0]
        if (!row) return { error: 'not_found' as const }
        if (row.status !== 'pending') return { error: 'not_pending' as const }

        await client.query(
          `INSERT INTO public.user_module_overrides (user_id, module_code, effect, granted_by)
           VALUES ($1, $2, 'grant', $3)
           ON CONFLICT (user_id, module_code)
           DO UPDATE SET effect = 'grant', granted_by = EXCLUDED.granted_by`,
          [row.user_id, row.module_code, user.id],
        )

        await client.query(
          `UPDATE public.permission_requests
              SET status = 'approved', reviewed_by = $1, reviewed_at = now(), review_note = $2
            WHERE id = $3`,
          [user.id, note ?? null, id],
        )

        await writeAuditLog(client, {
          request,
          action: 'permission.request.approve',
          resourceType: 'permission_requests',
          resourceId: id,
          beforeData: { status: row.status },
          afterData: { status: 'approved', moduleCode: row.module_code, targetUserId: row.user_id },
        })

        return { ok: true as const, moduleCode: row.module_code }
      })

      if ('error' in outcome) {
        return outcome.error === 'not_found'
          ? sendError(reply, 404, '申请不存在')
          : sendError(reply, 409, '该申请已处理，不能重复审批')
      }

      return sendOk(reply, outcome, '已通过，权限立即生效')
    } catch (err) {
      request.log.warn({ err }, 'permission-requests approve failed')
      return sendError(reply, 500, '审批失败')
    }
  })

  // ── POST /api/v1/permission-requests/:id/reject ── 驳回
  app.post('/api/v1/permission-requests/:id/reject', { preHandler: [requireRole(REVIEW_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserLike
    const { id } = request.params as { id: string }
    const parsed = reviewSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return sendError(reply, 400, parsed.error.issues[0]?.message || '参数非法')
    }

    try {
      const outcome = await withRlsContext(request, async (client) => {
        const rowRes = await client.query(
          `SELECT id, status FROM public.permission_requests
            WHERE id = $1 AND tenant_id = $2
            FOR UPDATE`,
          [id, tenantIdOf(user)],
        )
        const row = rowRes.rows[0]
        if (!row) return { error: 'not_found' as const }
        if (row.status !== 'pending') return { error: 'not_pending' as const }

        await client.query(
          `UPDATE public.permission_requests
              SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), review_note = $2
            WHERE id = $3`,
          [user.id, parsed.data.note ?? null, id],
        )

        await writeAuditLog(client, {
          request,
          action: 'permission.request.reject',
          resourceType: 'permission_requests',
          resourceId: id,
          beforeData: { status: row.status },
          afterData: { status: 'rejected', note: parsed.data.note ?? null },
        })

        return { ok: true as const }
      })

      if ('error' in outcome) {
        return outcome.error === 'not_found'
          ? sendError(reply, 404, '申请不存在')
          : sendError(reply, 409, '该申请已处理，不能重复审批')
      }

      return sendOk(reply, outcome, '已驳回')
    } catch (err) {
      request.log.warn({ err }, 'permission-requests reject failed')
      return sendError(reply, 500, '审批失败')
    }
  })
}
