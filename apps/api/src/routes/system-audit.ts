import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canManageTargetUser, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { getAutomationHealthSnapshot, runAutomationCatchup } from '../jobs/boss.js'

/**
 * system 域拆分（P2-1）：审计日志 + 自动化运维健康态（方案 A）
 * 原属 routes/system.ts，2026-11-17 拆出；2026-11-25 切换为 pg-boss 业务化健康接口。
 */
export async function systemAuditRoutes(app: FastifyInstance) {

  // ── GET /api/v1/system/audit-logs ── 安全审计日志查询
  app.get('/api/v1/system/audit-logs', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    try {
      const q = request.query as {
        page?: string
        pageSize?: string
        action?: string
        resourceType?: string
        actorUserId?: string
        from?: string
        to?: string
      }
      const page = Math.max(1, parseInt(q.page || '1', 10) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '30', 10) || 30))
      const offset = (page - 1) * pageSize

      const conditions: string[] = []
      const params: any[] = []
      let idx = 1

      if (q.action) {
        conditions.push(`al.action ILIKE $${idx++}`)
        params.push(`%${q.action.trim()}%`)
      }
      if (q.resourceType) {
        conditions.push(`al.resource_type = $${idx++}`)
        params.push(q.resourceType.trim())
      }
      if (q.actorUserId) {
        conditions.push(`al.actor_user_id = $${idx++}`)
        params.push(parseInt(q.actorUserId, 10))
      }
      if (q.from) {
        conditions.push(`al.created_at >= $${idx++}::timestamptz`)
        params.push(q.from)
      }
      if (q.to) {
        conditions.push(`al.created_at <= $${idx++}::timestamptz`)
        params.push(q.to)
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const data = await withRlsContext(request, async (client) => {
        const countRes = await client.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM public.audit_logs al ${whereSql}`,
          params
        )
        const listRes = await client.query(
          `SELECT
             al.id::text AS id,
             al.actor_user_id AS "actorUserId",
             u.username AS "actorUsername",
             u.real_name AS "actorRealName",
             u.role AS "actorRole",
             al.action,
             al.resource_type AS "resourceType",
             al.resource_id AS "resourceId",
             al.before_data AS "beforeData",
             al.after_data AS "afterData",
             al.ip_address AS "ipAddress",
             al.user_agent AS "userAgent",
             al.created_at::text AS "createdAt"
           FROM public.audit_logs al
           LEFT JOIN public.users u ON u.id = al.actor_user_id
           ${whereSql}
           ORDER BY al.created_at DESC, al.id DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, pageSize, offset]
        )
        return {
          total: countRes.rows[0]?.total ?? 0,
          items: listRes.rows,
          page,
          pageSize,
        }
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'system/audit-logs query failed')
      return sendError(reply, 500, '获取审计日志失败')
    }
  })

  // ── GET /api/v1/system/automation-health ── 业务化自动同步/汇总健康状态（方案 A，替代底层队列中心）
  app.get('/api/v1/system/automation-health', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const snapshot = await withRlsContext(request, async (client) => getAutomationHealthSnapshot(client))
      return sendOk(reply, snapshot)
    } catch (err: any) {
      request.log.error({ err }, 'system/automation-health query failed')
      return sendError(reply, 500, '获取自动同步健康状态失败')
    }
  })

  // ── POST /api/v1/system/automation-catchup ── 一键补齐昨日数据汇总与同步（零运维自助补偿）
  app.post(
    '/api/v1/system/automation-catchup',
    { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] },
    async (request, reply) => {
      try {
        const result = await runAutomationCatchup(true)
        await withRlsContext(request, (client) =>
          writeAuditLog(client, {
            request,
            action: 'RUN_AUTOMATION_CATCHUP',
            resourceType: 'automation',
            resourceId: result.targetDate,
            afterData: result,
          }),
        )
        return sendOk(reply, result, '昨日经营数据自动同步与汇总补齐完成')
      } catch (err: any) {
        request.log.error({ err }, 'system/automation-catchup failed')
        return sendError(reply, 500, '数据补齐执行失败')
      }
    },
  )

  // ── GET /api/v1/system/deprecation-logs ── 30 天废弃路由下线观测审计查询
  app.get('/api/v1/system/deprecation-logs', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    try {
      const q = request.query as { limit?: string; offset?: string }
      const limit = Math.min(100, Math.max(1, parseInt(q.limit || '50', 10) || 50))
      const offset = Math.max(0, parseInt(q.offset || '0', 10) || 0)

      const result = await withRlsContext(request, async (client) => {
        // 1. 最近 30 天统计汇总
        const statsRes = await client.query(
          `SELECT
             COUNT(*)::int AS "totalHits",
             COUNT(DISTINCT route_path)::int AS "uniqueRoutesCount",
             MIN(accessed_at) AS "earliestLog",
             MAX(accessed_at) AS "latestLog"
           FROM public.sys_deprecation_access_logs
           WHERE accessed_at >= now() - INTERVAL '30 days'`
        )

        // 2. 按路由聚合频次统计
        const routeAggRes = await client.query(
          `SELECT
             route_path AS "routePath",
             method,
             COUNT(*)::int AS "hitCount",
             MAX(accessed_at) AS "lastAccessedAt"
           FROM public.sys_deprecation_access_logs
           WHERE accessed_at >= now() - INTERVAL '30 days'
           GROUP BY route_path, method
           ORDER BY "hitCount" DESC`
        )

        // 3. 最近明细
        const logsRes = await client.query(
          `SELECT
             id, tenant_id AS "tenantId", user_id AS "userId", user_role AS "userRole",
             method, route_path AS "routePath", ip_address AS "ipAddress",
             user_agent AS "userAgent", accessed_at AS "accessedAt"
           FROM public.sys_deprecation_access_logs
           ORDER BY accessed_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        )

        return {
          summary: statsRes.rows[0] || { totalHits: 0, uniqueRoutesCount: 0 },
          routeStats: routeAggRes.rows,
          logs: logsRes.rows,
        }
      })

      return sendOk(reply, result)
    } catch (err: any) {
      request.log.error({ err }, 'system/deprecation-logs query failed')
      return sendError(reply, 500, '查询废弃路由访问日志失败')
    }
  })
}
