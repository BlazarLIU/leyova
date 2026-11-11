import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../../lib/db.js'
import { sendOk, sendError } from '../../lib/http.js'
import { requireAuth, requireRole } from '../../lib/guard.js'
import { writeAuditLog } from '../../lib/audit.js'

export async function agencyProjectsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/agency/projects ── 获取代播项目合同列表
  app.get('/api/v1/agency/projects', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1

    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `
          SELECT 
            p.id,
            p.tenant_id AS "tenantId",
            p.client_id AS "clientId",
            c.name AS "clientName",
            c.brand_name AS "brandName",
            p.name,
            p.platform_code AS "platformCode",
            sp.platform_name AS "platformName",
            p.contract_start::text AS "contractStart",
            p.contract_end::text AS "contractEnd",
            p.billing_model AS "billingModel",
            p.flat_fee::float AS "flatFee",
            p.commission_tiers AS "commissionTiers",
            p.gmv_target::float AS "gmvTarget",
            p.play_hours_target::float AS "playHoursTarget",
            p.status,
            p.created_at AS "createdAt",
            COUNT(DISTINCT s.id)::int AS "sessionCount",
            COALESCE(SUM(s.gmv), 0)::float AS "totalActualGmv"
          FROM public.agency_projects p
          JOIN public.agency_clients c ON p.client_id = c.id
          LEFT JOIN public.system_platform_configs sp ON p.platform_code = sp.platform_code
          LEFT JOIN public.live_sessions s ON p.id = s.project_id
          WHERE p.tenant_id = $1
          GROUP BY p.id, c.name, c.brand_name, sp.platform_name
          ORDER BY p.created_at DESC
          `,
          [tenantId]
        )
      )

      return sendOk(reply, rows)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch agency projects')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/agency/projects ── 创建代播项目合同
  app.post('/api/v1/agency/projects', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1
    const {
      clientId,
      name,
      platformCode,
      contractStart,
      contractEnd,
      billingModel = 'monthly_flat',
      flatFee = 0,
      commissionTiers = [],
      gmvTarget,
      playHoursTarget,
    } = request.body as any

    if (!clientId || !name) {
      return sendError(reply, 400, 'clientId 与项目名称 name 为必填项')
    }

    try {
      const outcome = await withRlsContext(request, async (client) => {
        const clientRes = await client.query(
          'SELECT id FROM public.agency_clients WHERE id = $1 AND tenant_id = $2',
          [Number(clientId), tenantId]
        )
        if (clientRes.rows.length === 0) {
          return { notFound: true as const }
        }
        const { rows } = await client.query(
          `
          INSERT INTO public.agency_projects (
            tenant_id, client_id, name, platform_code, contract_start, contract_end,
            billing_model, flat_fee, commission_tiers, gmv_target, play_hours_target
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
          `,
          [
            tenantId,
            clientId,
            name,
            platformCode || null,
            contractStart || null,
            contractEnd || null,
            billingModel,
            flatFee,
            JSON.stringify(commissionTiers),
            gmvTarget || null,
            playHoursTarget || null,
          ]
        )
        await writeAuditLog(client, {
          request,
          action: 'agency.project.create',
          resourceType: 'agency_projects',
          resourceId: rows[0].id,
          afterData: rows[0],
        })
        return { row: rows[0] }
      })

      if ('notFound' in outcome && outcome.notFound) {
        return sendError(reply, 404, '品牌客户不存在或无权限')
      }
      return sendOk(reply, outcome.row, '代播项目创建成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create agency project')
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/agency/projects/:id/dashboard ── 项目专项看板
  app.get('/api/v1/agency/projects/:id/dashboard', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1
    const { id } = request.params as { id: string }

    try {
      const dashboard = await withRlsContext(request, async (client) => {
        // 1. 项目基础信息（PG RLS 自动校验租户、平台与 brand_viewer 项目边界）
        const projectRes = await client.query(
          `
          SELECT 
            p.*,
            c.name AS "clientName",
            c.brand_name AS "brandName"
          FROM public.agency_projects p
          JOIN public.agency_clients c ON p.client_id = c.id
          WHERE p.id = $1 AND p.tenant_id = $2
          `,
          [Number(id), tenantId]
        )

        if (projectRes.rows.length === 0) {
          return null
        }
        const project = projectRes.rows[0]

        // 2. 场次汇总与 GMV
        const sessionStats = await client.query(
          `
          SELECT 
            COUNT(*)::int AS "sessionCount",
            COALESCE(SUM(gmv), 0)::float AS "actualGmv",
            COALESCE(SUM(duration_min), 0)::float / 60.0 AS "actualHours",
            COALESCE(SUM(orders), 0)::int AS "orderCount"
          FROM public.live_sessions
          WHERE project_id = $1
          `,
          [Number(id)]
        )

        // 3. 坑位与代垫推广费汇总
        const feeStats = await client.query(
          `
          SELECT 
            COALESCE(SUM(amount), 0)::float AS "totalFees"
          FROM public.agency_slot_fees
          WHERE project_id = $1 AND tenant_id = $2
          `,
          [Number(id), tenantId]
        )

        // 4. 主播排期
        const anchorAssignments = await client.query(
          `
          SELECT 
            a.id AS "anchorId",
            a.name AS "anchorName",
            assign.role,
            assign.start_date::text AS "startDate",
            assign.end_date::text AS "endDate"
          FROM public.agency_anchor_assignments assign
          JOIN public.anchors a ON assign.anchor_id = a.id
          WHERE assign.project_id = $1 AND assign.tenant_id = $2
          `,
          [Number(id), tenantId]
        )

        const actualGmv = sessionStats.rows[0]?.actualGmv || 0
        const targetGmv = project.gmv_target ? Number(project.gmv_target) : 0
        const gmvCompletionRate = targetGmv > 0 ? (actualGmv / targetGmv) * 100 : 0

        return {
          project,
          stats: {
            sessionCount: sessionStats.rows[0]?.sessionCount || 0,
            actualGmv,
            actualHours: Number((sessionStats.rows[0]?.actualHours || 0).toFixed(1)),
            orderCount: sessionStats.rows[0]?.orderCount || 0,
            totalSlotFees: feeStats.rows[0]?.totalFees || 0,
            gmvCompletionRate: Number(gmvCompletionRate.toFixed(2)),
          },
          anchors: anchorAssignments.rows,
        }
      })

      if (!dashboard) {
        return sendError(reply, 404, '项目不存在或无权限')
      }
      return sendOk(reply, dashboard)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch project dashboard')
      return sendError(reply, 500, err.message)
    }
  })
}

