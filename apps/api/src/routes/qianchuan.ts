/**
 * routes/qianchuan.ts — 千川投放数据同步与 R3 预算审批
 *
 * 接口面：
 *   POST   /api/v1/qianchuan/sync/manual           人工导入报表
 *   POST   /api/v1/qianchuan/sync/api              尝试 API 拉取（未实现时明确报错）
 *   GET    /api/v1/qianchuan/sync-runs             同步批次
 *   GET    /api/v1/qianchuan/overview              投放概览
 *   GET    /api/v1/qianchuan/budget-requests       预算申请列表
 *   POST   /api/v1/qianchuan/budget-requests       提交预算变更（R3）
 *   POST   /api/v1/qianchuan/budget-requests/:id/review  审批
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAuth } from '../lib/guard.js'
import { tenantIdOf } from '../lib/tenant-context.js'
import { resolveAccess } from '../lib/access-resolver.js'
import { effectivePlatforms } from '../lib/platform-scope.js'
import {
  adSpendOverview,
  createBudgetRequest,
  listBudgetRequests,
  listSyncRuns,
  reviewBudgetRequest,
  syncFromQianchuanApi,
  syncManualAdSpend,
} from '../qianchuan/service.js'

const MANAGER_ROLES = ['super_admin', 'ops_director']

const manualSyncSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
})

const apiSyncSchema = z.object({
  bizDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bizDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const budgetCreateSchema = z.object({
  planId: z.number().int().positive(),
  requestedBudget: z.number().positive(),
  reason: z.string().max(500).optional(),
})

const budgetReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
})

function isManager(role: string): boolean {
  return MANAGER_ROLES.includes(role)
}

async function allowedPlatformsFor(user: any): Promise<string[] | null> {
  const access = await resolveAccess({ userId: user.id, role: user.role, userType: user.userType, tenantId: user.tenantId })
  return access.platforms === null ? null : Array.from(access.platforms)
}

export async function qianchuanRoutes(app: FastifyInstance) {
  // ── 千川 ──
  app.post('/api/v1/qianchuan/sync/manual', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权导入投放数据')

    const parsed = manualSyncSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    const result = await syncManualAdSpend({
      tenantId: tenantIdOf(user),
      rows: parsed.data.rows,
      userId: user.id,
    })
    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'qianchuan.sync.manual',
        resourceType: 'qianchuan_sync_runs',
        resourceId: result.runId,
        afterData: { rowCount: result.rowCount, inserted: result.inserted, updated: result.updated, status: result.status },
      })
    )
    if (result.status === 'failed') return sendError(reply, 400, result.error || '导入失败')
    return sendOk(reply, result)
  })

  app.post('/api/v1/qianchuan/sync/api', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权同步投放数据')

    const parsed = apiSyncSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    const result = await syncFromQianchuanApi({
      tenantId: tenantIdOf(user),
      ...parsed.data,
      userId: user.id,
    })
    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'qianchuan.sync.api',
        resourceType: 'qianchuan_sync_runs',
        resourceId: result.runId,
        afterData: { status: result.status, error: result.error },
      })
    )
    if (result.status === 'failed') return sendError(reply, 400, result.error || '同步失败')
    return sendOk(reply, result)
  })

  app.get('/api/v1/qianchuan/sync-runs', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const items = await listSyncRuns(tenantIdOf(user))
    return sendOk(reply, { items, total: items.length })
  })

  app.get('/api/v1/qianchuan/overview', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    return sendOk(reply, await adSpendOverview(tenantIdOf(user), {
      days: Number(query.days) || 7,
      includeDemo: query.includeDemo === 'true',
      platformCodes: await allowedPlatformsFor(user),
    }))
  })

  app.get('/api/v1/qianchuan/budget-requests', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const items = await listBudgetRequests(tenantIdOf(user))
    return sendOk(reply, { items, total: items.length })
  })

  app.post('/api/v1/qianchuan/budget-requests', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权提交预算变更')

    const parsed = budgetCreateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const created = await createBudgetRequest({
        tenantId: tenantIdOf(user),
        ...parsed.data,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'qianchuan.budget.request',
          resourceType: 'qianchuan_budget_requests',
          resourceId: created.id,
          afterData: { planId: created.planId, currentBudget: created.currentBudget, requestedBudget: created.requestedBudget },
        })
      )
      return sendOk(reply, created)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '提交失败')
    }
  })

  app.post('/api/v1/qianchuan/budget-requests/:id/review', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权审批预算变更')

    const { id } = request.params as { id: string }
    const parsed = budgetReviewSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const result = await reviewBudgetRequest({
        tenantId: tenantIdOf(user),
        requestId: id,
        ...parsed.data,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: `qianchuan.budget.${parsed.data.decision}`,
          resourceType: 'qianchuan_budget_requests',
          resourceId: id,
          afterData: result,
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '审批失败')
    }
  })
}
