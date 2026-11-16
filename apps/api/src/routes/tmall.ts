/**
 * tmall.ts — 天猫专属路由
 *
 * 填补审计发现的天猫缺口（此前 0 专属路由，全复用淘宝）：
 *   1. 品牌 × 场次（天猫以品牌自播为主，不同于淘宝的店铺维度）
 *   2. 五层抵扣规则（天猫独有）
 *   3. 大促 vs 日常对比（天猫直播与大促强绑定）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import {
  getTmallBrandSessions,
  getTmallPromotionLayers,
  getTmallPromoCompare,
} from '../platform/tmall-analytics.js'

function defaultRange(from?: string, to?: string) {
  const t = new Date()
  const toDate = to || t.toISOString().slice(0, 10)
  const f = from || (() => {
    const d = new Date(toDate)
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })()
  return { from: f, to: toDate }
}

export async function tmallRoutes(app: FastifyInstance) {
  // ── GET /api/v1/tmall/brands ── 品牌 × 场次
  app.get<{ Querystring: { from?: string; to?: string; shopId?: string } }>(
    '/api/v1/tmall/brands',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { from, to } = defaultRange(request.query.from, request.query.to)
      const shopId = request.query.shopId ? Number(request.query.shopId) : undefined
      try {
        const data = await withRlsContext(request, (client) =>
          getTmallBrandSessions(from, to, client, shopId),
        )
        return sendOk(reply, data)
      } catch (err) {
        request.log.warn({ err }, 'tmall/brands failed')
        return sendError(reply, 500, '获取天猫品牌场次数据失败')
      }
    },
  )

  // ── GET /api/v1/tmall/promotion-layers ── 五层抵扣
  app.get(
    '/api/v1/tmall/promotion-layers',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const data = await withRlsContext(request, (client) =>
          getTmallPromotionLayers(client),
        )
        return sendOk(reply, data)
      } catch (err) {
        request.log.warn({ err }, 'tmall/promotion-layers failed')
        return sendError(reply, 500, '获取天猫抵扣规则失败')
      }
    },
  )

  // ── GET /api/v1/tmall/promo-compare ── 大促 vs 日常
  app.get<{ Querystring: { from?: string; to?: string; shopId?: string } }>(
    '/api/v1/tmall/promo-compare',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { from, to } = defaultRange(request.query.from, request.query.to)
      const shopId = request.query.shopId ? Number(request.query.shopId) : undefined
      try {
        const data = await withRlsContext(request, (client) =>
          getTmallPromoCompare(from, to, client, shopId),
        )
        return sendOk(reply, data)
      } catch (err) {
        request.log.warn({ err }, 'tmall/promo-compare failed')
        return sendError(reply, 500, '获取天猫大促对比数据失败')
      }
    },
  )

  // ── GET /api/v1/tmall/shop/:id/overview ── 单店总览
  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
    '/api/v1/tmall/shop/:id/overview',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { from, to } = defaultRange(request.query.from, request.query.to)
      const result = await withRlsContext(request, async (client) => {
        const check = await assertShopPlatform(client, request.params.id, 'tmall')
        if (!check.ok || !check.shop) return { shopError: check }
        const shopId = check.shop.id
        const [brands, promo] = await Promise.all([
          getTmallBrandSessions(from, to, client, shopId),
          getTmallPromoCompare(from, to, client, shopId),
        ])
        return {
          data: {
            shop: { id: shopId, name: check.shop.shop_name },
            range: { from, to },
            brandSessions: brands.summary,
            promoCompare: promo.summary,
          },
        }
      })
      if ('shopError' in result && result.shopError) {
        return sendError(reply, result.shopError.statusCode || 400, result.shopError.message || '店铺校验失败')
      }
      return sendOk(reply, (result as any).data)
    },
  )
}
