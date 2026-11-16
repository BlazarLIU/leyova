/**
 * douyin.ts — 抖音专属分析路由（与其他五大平台路由架构对齐 + shop/platform 越权守卫）
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { sendError, sendOk } from '../lib/http.js'
import { canAccessAdSpend, requireAuth } from '../lib/guard.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import { PlatformAdapterService } from '../services/platform-adapter.js'

function defaultRange(from?: string, to?: string) {
  const t = new Date()
  const toDate = to || t.toISOString().slice(0, 10)
  const f =
    from ||
    (() => {
      const d = new Date(toDate)
      d.setDate(d.getDate() - 29)
      return d.toISOString().slice(0, 10)
    })()
  return { from: f, to: toDate }
}

export async function douyinRoutes(app: FastifyInstance) {
  // ── GET /api/v1/douyin/shop/:id/metrics ── 抖音店铺核心经营指标
  app.get(
    '/api/v1/douyin/shop/:id/metrics',
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Querystring: { from?: string; to?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const user = await requireAuth(request, reply)
      if (!user) return

      try {
        const range = defaultRange(request.query.from, request.query.to)
        const allowAd = canAccessAdSpend(user)

        const outcome = await withRlsContext(request, async (client) => {
          return PlatformAdapterService.getShopMetrics(client, request.params.id, 'douyin', range, allowAd)
        })

        if (!outcome.ok) {
          return sendError(reply, outcome.statusCode, outcome.message)
        }
        return sendOk(reply, {
          shop: outcome.shop,
          range,
          trade: outcome.trade,
          traffic: outcome.traffic,
          adSummary: outcome.adSummary,
        })
      } catch (err: any) {
        request.log.error({ err }, 'douyin shop metrics failed')
        return sendError(reply, 500, `获取抖音店铺指标失败：${err?.message || err}`)
      }
    },
  )

  // ── GET /api/v1/douyin/shop/:id/channels ── 抖音渠道结构与投流消耗
  app.get(
    '/api/v1/douyin/shop/:id/channels',
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Querystring: { from?: string; to?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const user = await requireAuth(request, reply)
      if (!user) return

      try {
        const range = defaultRange(request.query.from, request.query.to)
        const allowAd = canAccessAdSpend(user)

        const outcome = await withRlsContext(request, async (client) => {
          const check = await assertShopPlatform(client, request.params.id, 'douyin')
          if (!check.ok || !check.shop) {
            return { errorStatus: check.statusCode || 400, errorMsg: check.message || '店铺校验失败' }
          }

          const { rows } = await client.query(
            `SELECT channel_name,
                    COALESCE(SUM(impressions), 0)::bigint AS impressions,
                    COALESCE(SUM(viewers), 0)::bigint AS viewers,
                    COALESCE(SUM(order_count), 0)::int AS order_count,
                    COALESCE(SUM(payment_amount), 0)::float8 AS payment_amount,
                    COALESCE(SUM(ad_cost_bound), 0)::float8 AS ad_cost_bound,
                    COALESCE(SUM(ad_cost_promoted), 0)::float8 AS ad_cost_promoted
             FROM douyin_channel_daily_metrics
             WHERE business_date >= $1::date AND business_date <= $2::date
             GROUP BY channel_name
             ORDER BY payment_amount DESC`,
            [range.from, range.to],
          )
          return { shop: check.shop, rows }
        })

        if ('errorStatus' in outcome && outcome.errorStatus !== undefined) {
          return sendError(reply, outcome.errorStatus, outcome.errorMsg)
        }
        return sendOk(reply, {
          shop: outcome.shop,
          range,
          channels: outcome.rows.map((r: any) => ({
            channelName: r.channel_name,
            impressions: Number(r.impressions) || 0,
            viewers: Number(r.viewers) || 0,
            orderCount: Number(r.order_count) || 0,
            paymentAmount: Number(r.payment_amount) || 0,
            adCostBound: allowAd ? Number(r.ad_cost_bound) || 0 : null,
            adCostPromoted: allowAd ? Number(r.ad_cost_promoted) || 0 : null,
          })),
        })
      } catch (err: any) {
        request.log.error({ err }, 'douyin shop channels failed')
        return sendError(reply, 500, `获取抖音渠道指标失败：${err?.message || err}`)
      }
    },
  )

  // ── GET /api/v1/douyin/shop/:id/anchors ── 抖音主播日表现榜单
  app.get(
    '/api/v1/douyin/shop/:id/anchors',
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Querystring: { from?: string; to?: string; limit?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const user = await requireAuth(request, reply)
      if (!user) return

      try {
        const range = defaultRange(request.query.from, request.query.to)
        const limit = Math.min(Math.max(parseInt(request.query.limit || '20', 10) || 20, 1), 100)

        const outcome = await withRlsContext(request, async (client) => {
          const check = await assertShopPlatform(client, request.params.id, 'douyin')
          if (!check.ok || !check.shop) {
            return { errorStatus: check.statusCode || 400, errorMsg: check.message || '店铺校验失败' }
          }

          const { rows } = await client.query(
            `SELECT anchor_name,
                    MAX(account_name) AS account_name,
                    COALESCE(SUM(payment_amount), 0)::float8 AS payment_amount,
                    COALESCE(AVG(uv_value), 0)::float8 AS avg_uv_value,
                    COALESCE(AVG(interaction_rate), 0)::float8 AS avg_interaction_rate,
                    COALESCE(SUM(new_followers), 0)::int AS new_followers
             FROM douyin_anchor_daily_metrics
             WHERE business_date >= $1::date AND business_date <= $2::date
             GROUP BY anchor_name
             ORDER BY payment_amount DESC
             LIMIT $3`,
            [range.from, range.to, limit],
          )
          return { shop: check.shop, rows }
        })

        if ('errorStatus' in outcome && outcome.errorStatus !== undefined) {
          return sendError(reply, outcome.errorStatus, outcome.errorMsg)
        }
        return sendOk(reply, { shop: outcome.shop, range, anchors: outcome.rows })
      } catch (err: any) {
        request.log.error({ err }, 'douyin shop anchors failed')
        return sendError(reply, 500, `获取抖音主播排行失败：${err?.message || err}`)
      }
    },
  )
}
