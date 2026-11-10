import type { FastifyInstance } from 'fastify'
import { getPool } from '../../lib/db.js'
import { sendOk, sendError } from '../../lib/http.js'
import { requireAuth } from '../../lib/guard.js'

export async function agencyPortalRoutes(app: FastifyInstance) {
  // ── GET /api/v1/portal/dashboard ── 甲方专属看板数据
  app.get('/api/v1/portal/dashboard', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    const user = (request as any).user
    const tenantId = user?.tenant_id || 1
    const { projectId } = request.query as { projectId?: string }

    try {
      // 获取该用户的品牌授权配置
      let allowedProjectIds: number[] = []
      let canViewCost = false
      let clientId: number | null = null

      if (user.user_type === 'brand_viewer') {
        const permRes = await pool.query(
          'SELECT client_id, project_ids, can_view_cost FROM public.brand_viewer_permissions WHERE user_id = $1',
          [user.id]
        )
        if (permRes.rows.length === 0) {
          return sendError(reply, 403, '未分配任何品牌客户权限')
        }
        clientId = permRes.rows[0].client_id
        allowedProjectIds = permRes.rows[0].project_ids || []
        canViewCost = permRes.rows[0].can_view_cost
      }

      // 确定可查的项目列表
      const projectConditions: string[] = ['p.tenant_id = $1']
      const projectParams: any[] = [tenantId]
      let pIdx = 2

      if (clientId) {
        projectConditions.push(`p.client_id = $${pIdx++}`)
        projectParams.push(clientId)
      }
      if (allowedProjectIds.length > 0) {
        projectConditions.push(`p.id = ANY($${pIdx++})`)
        projectParams.push(allowedProjectIds)
      }
      if (projectId) {
        projectConditions.push(`p.id = $${pIdx++}`)
        projectParams.push(Number(projectId))
      }

      const projectsRes = await pool.query(
        `
        SELECT 
          p.id,
          p.name,
          p.platform_code AS "platformCode",
          sp.platform_name AS "platformName",
          c.brand_name AS "brandName",
          p.gmv_target::float AS "gmvTarget",
          p.play_hours_target::float AS "playHoursTarget",
          p.status
        FROM public.agency_projects p
        JOIN public.agency_clients c ON p.client_id = c.id
        LEFT JOIN public.system_platform_configs sp ON p.platform_code = sp.platform_code
        WHERE ${projectConditions.join(' AND ')}
        `,
        projectParams
      )

      const projects = projectsRes.rows
      const pIds = projects.map((p) => p.id)

      if (pIds.length === 0) {
        return sendOk(reply, {
          projects: [],
          stats: { totalGmv: 0, sessionCount: 0, totalHours: 0, orderCount: 0 },
          recentSessions: [],
          bills: [],
        })
      }

      // 统计场次与 GMV
      const statsRes = await pool.query(
        `
        SELECT 
          COUNT(*)::int AS "sessionCount",
          COALESCE(SUM(gmv), 0)::float AS "totalGmv",
          COALESCE(SUM(duration_min), 0)::float / 60.0 AS "totalHours",
          COALESCE(SUM(orders), 0)::int AS "orderCount"
        FROM public.live_sessions
        WHERE project_id = ANY($1)
        `,
        [pIds]
      )

      // 最近场次
      const sessionsRes = await pool.query(
        `
        SELECT 
          s.id,
          s.project_id AS "projectId",
          p.name AS "projectName",
          s.date::text AS "date",
          s.title,
          a.name AS "anchorName",
          s.duration_min AS "durationMin",
          s.gmv::float AS "gmv",
          s.orders,
          s.status
        FROM public.live_sessions s
        JOIN public.agency_projects p ON s.project_id = p.id
        LEFT JOIN public.anchors a ON s.anchor_id = a.id
        WHERE s.project_id = ANY($1)
        ORDER BY s.date DESC, s.id DESC
        LIMIT 10
        `,
        [pIds]
      )

      // 已出具的账单（仅展示 sent / confirmed / paid）
      const billsRes = await pool.query(
        `
        SELECT 
          b.id,
          b.period_month AS "periodMonth",
          b.total_gmv::float AS "totalGmv",
          b.total_payable::float AS "totalPayable",
          b.status,
          b.pdf_url AS "pdfUrl",
          b.sent_at AS "sentAt"
        FROM public.agency_settlement_bills b
        WHERE b.project_id = ANY($1) AND b.status IN ('sent', 'confirmed', 'paid')
        ORDER BY b.period_month DESC
        `,
        [pIds]
      )

      return sendOk(reply, {
        projects,
        canViewCost,
        stats: {
          sessionCount: statsRes.rows[0]?.sessionCount || 0,
          totalGmv: statsRes.rows[0]?.totalGmv || 0,
          totalHours: Number((statsRes.rows[0]?.totalHours || 0).toFixed(1)),
          orderCount: statsRes.rows[0]?.orderCount || 0,
        },
        recentSessions: sessionsRes.rows,
        bills: billsRes.rows,
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch portal dashboard')
      return sendError(reply, 500, err.message)
    }
  })
}

