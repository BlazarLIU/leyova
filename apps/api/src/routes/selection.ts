import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { effectivePlatforms } from '../lib/platform-scope.js'
import {
  getCategories,
  recommend,
  getRecommendations,
  getRecommendationDetail,
  adoptRecommendation,
} from '../services/selection-service.js'

export async function selectionRoutes(app: FastifyInstance) {
  // ── GET /api/v1/selection/categories ──
  app.get('/api/v1/selection/categories', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const withSignals = q.withSignals === 'true'
      const data = await withRlsContext(request, async (client) => {
        return getCategories(client, withSignals)
      })
      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch categories')
      return sendError(reply, 500, err.message || '获取类目失败')
    }
  })

  // ── POST /api/v1/selection/recommend ──
  app.post('/api/v1/selection/recommend', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const body = (request.body || {}) as {
        categoryCode?: string
        platformCode?: string
        shopId?: number
        city?: string
        lookbackDays?: number
        persist?: boolean
      }

      if (!body.categoryCode) {
        return sendError(reply, 400, '缺少必须参数 categoryCode')
      }

      const user = request.user as { id?: number; tenantId?: number } | undefined

      const data = await withRlsContext(request, async (client, scope) => {
        if (effectivePlatforms(body.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { forbidden: true as const }
        }
        return recommend(
          client,
          {
            categoryCode: body.categoryCode!,
            platformCode: body.platformCode,
            shopId: body.shopId,
            city: body.city || '全国',
            lookbackDays: body.lookbackDays || 30,
            persist: body.persist !== false,
          },
          user,
        )
      })
      if ('forbidden' in data) return sendError(reply, 403, '无权访问该平台数据')

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to generate selection recommendation')
      return sendError(reply, 500, err.message || '选品推荐生成失败')
    }
  })

  // ── GET /api/v1/selection/recommendations ──
  app.get('/api/v1/selection/recommendations', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const q = request.query as {
        page?: string
        pageSize?: string
        categoryCode?: string
        status?: string
        platformCode?: string
      }

      const user = request.user as { tenantId?: number } | undefined

      const data = await withRlsContext(request, async (client, scope) => {
        const eff = effectivePlatforms(q.platformCode, scope.allowedPlatforms)
        return getRecommendations(
          client,
          {
            page: q.page ? parseInt(q.page, 10) : 1,
            pageSize: q.pageSize ? parseInt(q.pageSize, 10) : 10,
            categoryCode: q.categoryCode,
            status: q.status,
            platformCodes: eff,
          },
          user,
        )
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch selection recommendations')
      return sendError(reply, 500, err.message || '获取选品历史失败')
    }
  })

  // ── GET /api/v1/selection/recommendations/:id ──
  app.get('/api/v1/selection/recommendations/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const id = parseInt(params.id, 10)
      if (isNaN(id)) {
        return sendError(reply, 400, '无效的 recommendation ID')
      }

      const data = await withRlsContext(request, async (client, scope) => {
        return getRecommendationDetail(client, id, effectivePlatforms(undefined, scope.allowedPlatforms))
      })

      if (!data) {
        return sendError(reply, 404, '选品推荐记录不存在')
      }

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch selection detail')
      return sendError(reply, 500, err.message || '获取选品详情失败')
    }
  })

  // ── POST /api/v1/selection/recommendations/:id/adopt ──
  app.post('/api/v1/selection/recommendations/:id/adopt', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const params = request.params as { id: string }
      const id = parseInt(params.id, 10)
      if (isNaN(id)) {
        return sendError(reply, 400, '无效的 recommendation ID')
      }

      const user = request.user as { id?: number } | undefined

      const data = await withRlsContext(request, async (client, scope) => {
        const detail = await getRecommendationDetail(client, id)
        if (!detail) return { notFound: true as const }
        if (effectivePlatforms(detail.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { forbidden: true as const }
        }
        return adoptRecommendation(client, id, user)
      })

      if ('notFound' in data) return sendError(reply, 404, '选品推荐记录不存在')
      if ('forbidden' in data) return sendError(reply, 403, '无权访问该平台数据')
      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to adopt recommendation')
      return sendError(reply, 500, err.message || '采纳选品推荐失败')
    }
  })
}
