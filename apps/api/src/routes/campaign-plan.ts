import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import {
  getPlanTemplates,
  generateCampaignPlan,
  getCampaignPlanDetail,
  updateCampaignPlanStatus,
  dispatchCampaignPlan,
  type DispatchPlanOptions,
} from '../services/campaign-plan-service.js'

export async function campaignPlanRoutes(app: FastifyInstance) {
  // ── GET /api/v1/campaign-plan/templates ──
  app.get('/api/v1/campaign-plan/templates', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        return getPlanTemplates(client)
      })
      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch campaign plan templates')
      return sendError(reply, 500, err.message || '获取方案模板失败')
    }
  })

  // ── POST /api/v1/campaign-plan/generate ──
  app.post('/api/v1/campaign-plan/generate', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const body = (request.body || {}) as {
        shopId?: number
        categoryCode?: string
        templateCode?: string
        sourceRecommendationId?: number
        targetGmv?: number
      }

      if (!body.shopId) {
        return sendError(reply, 400, '缺少必须参数 shopId')
      }

      const user = request.user as { id?: number; tenantId?: number } | undefined

      const data = await withRlsContext(request, async (client) => {
        return generateCampaignPlan(
          client,
          {
            shopId: body.shopId!,
            categoryCode: body.categoryCode,
            templateCode: body.templateCode,
            sourceRecommendationId: body.sourceRecommendationId,
            targetGmv: body.targetGmv,
          },
          user,
        )
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to generate campaign plan')
      return sendError(reply, 500, err.message || '生成运营方案失败')
    }
  })

  // ── GET /api/v1/campaign-plan/plans/:id ──
  app.get('/api/v1/campaign-plan/plans/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const id = parseInt(params.id, 10)
      if (isNaN(id)) {
        return sendError(reply, 400, '无效的方案 ID')
      }

      const data = await withRlsContext(request, async (client) => {
        return getCampaignPlanDetail(client, id)
      })

      if (!data) {
        return sendError(reply, 404, '运营方案不存在')
      }

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch campaign plan detail')
      return sendError(reply, 500, err.message || '获取方案详情失败')
    }
  })

  // ── PATCH /api/v1/campaign-plan/plans/:id ──
  app.patch('/api/v1/campaign-plan/plans/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const id = parseInt(params.id, 10)
      if (isNaN(id)) {
        return sendError(reply, 400, '无效的方案 ID')
      }

      const body = (request.body || {}) as {
        status?: 'approved' | 'rejected'
      }

      if (!body.status || !['approved', 'rejected'].includes(body.status)) {
        return sendError(reply, 400, 'status 必须为 approved 或 rejected')
      }

      const user = request.user as { id?: number } | undefined

      const data = await withRlsContext(request, async (client) => {
        return updateCampaignPlanStatus(client, id, body.status!, user)
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to update campaign plan status')
      return sendError(reply, 500, err.message || '更新方案状态失败')
    }
  })

  // ── POST /api/v1/campaign-plan/plans/:id/dispatch ── 运营方案审批后自动拆解下发
  app.post(
    '/api/v1/campaign-plan/plans/:id/dispatch',
    { preHandler: [requireRole(['super_admin', 'ops_director'])] },
    async (request, reply) => {
      try {
        const params = request.params as { id: string }
        const id = parseInt(params.id, 10)
        if (isNaN(id)) {
          return sendError(reply, 400, '无效的方案 ID')
        }

        const options = (request.body || {}) as DispatchPlanOptions
        const user = request.user as { id?: number; tenantId?: number } | undefined

        const data = await withRlsContext(request, async (client) => {
          return dispatchCampaignPlan(client, id, options, user)
        })

        return sendOk(reply, data)
      } catch (err: any) {
        request.log.error({ err }, 'Failed to dispatch campaign plan')
        return sendError(reply, 400, err.message || '方案拆解下发失败')
      }
    },
  )
}
