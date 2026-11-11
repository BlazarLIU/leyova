import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../../lib/db.js'
import { sendOk, sendError } from '../../lib/http.js'
import { requireAuth } from '../../lib/guard.js'

export async function agencyPortalRoutes(app: FastifyInstance) {
  // ── GET /api/v1/portal/dashboard ── 品牌自播专属看板数据
  app.get('/api/v1/portal/dashboard', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1
    const { projectId } = request.query as { projectId?: string }

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        // 获取该用户的品牌授权配置
        let allowedProjectIds: number[] = []
        let canViewCost = false
        let clientId: number | null = null

        if (user.userType === 'brand_viewer') {
          const permRes = await client.query(
            'SELECT client_id, project_ids, can_view_cost FROM public.brand_viewer_permissions WHERE user_id = $1 AND tenant_id = $2',
            [user.id, tenantId]
          )
          if (permRes.rows.length === 0) {
            return { status: 403 as const, message: '未分配任何品牌客户权限' }
          }
          clientId = permRes.rows[0].client_id
          allowedProjectIds = permRes.rows[0].project_ids || []
          canViewCost = Boolean(permRes.rows[0].can_view_cost)

          // 若明确分配的 project_ids 为空数组，严禁回退为查看该客户下全部项目
          if (allowedProjectIds.length === 0) {
            return {
              status: 200 as const,
              data: {
                projects: [],
                canViewCost,
                stats: { totalGmv: 0, sessionCount: 0, totalHours: 0, orderCount: 0 },
                recentSessions: [],
                bills: [],
              },
            }
          }
        } else if (scope.userType !== 'agency_staff' || !['super_admin', 'admin', 'ops_director', 'finance'].includes(user.role)) {
          return { status: 403 as const, message: '无权访问品牌门户看板' }
        }

        // 确定可查的项目列表（同时受 PG RLS p_agency_projects_select 保护）
        const projectConditions: string[] = ['p.tenant_id = $1']
        const projectParams: any[] = [tenantId]
        let pIdx = 2

        if (clientId) {
          projectConditions.push(`p.client_id = $${pIdx++}`)
          projectParams.push(clientId)
        }
        if (user.userType === 'brand_viewer') {
          projectConditions.push(`p.id = ANY($${pIdx++})`)
          projectParams.push(allowedProjectIds)
        }
        if (projectId) {
          projectConditions.push(`p.id = $${pIdx++}`)
          projectParams.push(Number(projectId))
        }

        const projectsRes = await client.query(
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
          return {
            status: 200 as const,
            data: {
              projects: [],
              canViewCost,
              stats: { totalGmv: 0, sessionCount: 0, totalHours: 0, orderCount: 0 },
              recentSessions: [],
              bills: [],
            },
          }
        }

        // 统计场次与 GMV
        const statsRes = await client.query(
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
        const sessionsRes = await client.query(
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
        const billsRes = await client.query(
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

        return {
          status: 200 as const,
          data: {
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
          },
        }
      })

      if (outcome.status !== 200) {
        return sendError(reply, outcome.status, outcome.message)
      }
      return sendOk(reply, outcome.data)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch portal dashboard')
      return sendError(reply, 500, err.message)
    }
  })
}

