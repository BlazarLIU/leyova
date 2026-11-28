/**
 * kuaishou.ts — 快手专属路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canAccessAdSpend, requireAuth } from '../lib/guard.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import {
  getKsTrafficSplit,
  getKsIndirectGmv,
  getKsFansTeam,
  getKsAdRoi,
} from '../platform/kuaishou-analytics.js'

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

export async function kuaishouRoutes(app: FastifyInstance) {
  async function runKsShopQuery<T>(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    fn: (shopId: number, client: any) => Promise<T>,
    requireAdSpend = false,
  ) {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (requireAdSpend && !canAccessAdSpend(user)) {
      return sendError(reply, 403, '当前角色无权查看磁力金牛投放 ROI 数据')
    }
    const result = await withRlsContext(request, async (client) => {
      const check = await assertShopPlatform(client, request.params.id, 'kuaishou')
      if (!check.ok || !check.shop) return { shopError: check }
      return { data: await fn(check.shop.id, client) }
    })
    if ('shopError' in result && result.shopError) {
      return sendError(reply, result.shopError.statusCode || 400, result.shopError.message || '店铺校验失败')
    }
    return sendOk(reply, result.data)
  }

  // ── GET /api/v1/kuaishou/shop/:id/traffic-split ── 公私域拆分
  app.get('/api/v1/kuaishou/shop/:id/traffic-split', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runKsShopQuery(request, reply, (shopId, client) => getKsTrafficSplit(shopId, r.from, r.to, client))
    } catch (err: any) {
      request.log.error({ err }, 'ks traffic split failed')
      return sendError(reply, 500, `获取公私域拆分失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/kuaishou/shop/:id/indirect-gmv ── 间接成交
  app.get('/api/v1/kuaishou/shop/:id/indirect-gmv', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runKsShopQuery(request, reply, (shopId, client) => getKsIndirectGmv(shopId, r.from, r.to, client))
    } catch (err: any) {
      return sendError(reply, 500, `获取间接成交失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/kuaishou/shop/:id/fans ── 粉丝团
  app.get('/api/v1/kuaishou/shop/:id/fans', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runKsShopQuery(request, reply, (shopId, client) => getKsFansTeam(shopId, r.from, r.to, client))
    } catch (err: any) {
      return sendError(reply, 500, `获取粉丝团数据失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/kuaishou/shop/:id/ad-roi ── 磁力金牛多口径 ROI
  app.get('/api/v1/kuaishou/shop/:id/ad-roi', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runKsShopQuery(request, reply, (shopId, client) => getKsAdRoi(shopId, r.from, r.to, client), true)
    } catch (err: any) {
      return sendError(reply, 500, `获取 ROI 分析失败：${err?.message || err}`)
    }
  })
}
