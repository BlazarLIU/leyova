/**
 * assortment.ts — 排品推荐路由（P3）
 *
 * 老大原话：「排品的逻辑是根据直播带货的 GMV销量、库存、短视频数据、点击转化等数据来」
 *
 * 提供基于真实业务数据的排品推荐，替代原先按价格带模拟打分的选品逻辑。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'
import { computeAssortment } from '../services/assortment-engine.js'

const ASSORTMENT_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']

export async function assortmentRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/assortment/recommend
   *
   * Query:
   *   days         统计窗口（默认 30，范围 7-180）
   *   categoryCode 类目筛选（可选）
   *   topN         每组推荐数（默认 3，范围 1-10）
   *
   * 返回：候选商品打分 + T/B/P 分组建议 + 数据充分性标记。
   */
  app.get('/api/v1/assortment/recommend', { preHandler: [requireRole(ASSORTMENT_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { days?: string; categoryCode?: string; topN?: string }
    const days = Number(q.days) || 30
    const topN = Number(q.topN) || 3
    const categoryCode = q.categoryCode?.trim() || undefined

    try {
      const result = await withRlsContext(request, (client) =>
        computeAssortment(client, { days, topN, categoryCode }),
      )
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'assortment/recommend failed')
      return sendError(reply, 500, '计算排品推荐失败')
    }
  })

  /**
   * GET /api/v1/assortment/explain/:productId
   *
   * 返回单个商品的排品因子明细（用于「为什么推荐/不推荐它」的 Drill-down）。
   */
  app.get('/api/v1/assortment/explain/:productId', { preHandler: [requireRole(ASSORTMENT_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { productId } = request.params as { productId: string }
    const q = request.query as { days?: string }
    const days = Number(q.days) || 30
    const id = Number(productId)
    if (!Number.isInteger(id) || id <= 0) {
      return sendError(reply, 400, '无效的商品 ID')
    }

    try {
      const result = await withRlsContext(request, (client) =>
        computeAssortment(client, { days, topN: 1 }),
      )
      const found = result.candidates.find((c) => c.productId === id)
      if (!found) {
        return sendError(reply, 404, '商品不存在或未上架')
      }
      return sendOk(reply, found)
    } catch (err) {
      request.log.warn({ err }, 'assortment/explain failed')
      return sendError(reply, 500, '获取商品排品明细失败')
    }
  })
}
