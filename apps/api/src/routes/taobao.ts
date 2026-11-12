/**
 * taobao.ts — 淘宝/天猫专属路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canAccessAdSpend, requireAuth } from '../lib/guard.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import {
  getTaobaoShopMetrics,
  getTaobaoProductStructure,
  getTaobaoChannelSplit,
  getTaobaoAdReconciliation,
  getTaobaoDsrStatus,
} from '../platform/taobao-analytics.js'

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

export async function taobaoRoutes(app: FastifyInstance) {
  async function runTaobaoShopQuery<T>(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    fn: (shopId: number, client: any) => Promise<T>,
    requireAdSpend = false,
  ) {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (requireAdSpend && !canAccessAdSpend(user)) {
      return sendError(reply, 403, '当前角色无权查看万相台投放消耗对账数据')
    }
    const result = await withRlsContext(request, async (client) => {
      const check = await assertShopPlatform(client, request.params.id, ['taobao', 'tmall'])
      if (!check.ok || !check.shop) return { shopError: check }
      const data = await fn(check.shop.id, client)
      return { data }
    })
    if ('shopError' in result && result.shopError) {
      return sendError(reply, result.shopError.statusCode || 400, result.shopError.message || '店铺校验失败')
    }
    if (result.data === null) return sendError(reply, 404, '店铺不存在')
    return sendOk(reply, result.data)
  }

  // ── GET /api/v1/taobao/shop/:id/metrics ── 店铺经营指标
  app.get('/api/v1/taobao/shop/:id/metrics', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runTaobaoShopQuery(request, reply, (shopId, client) => getTaobaoShopMetrics(shopId, r.from, r.to, client))
    } catch (err: any) {
      request.log.error({ err }, 'taobao shop metrics failed')
      return sendError(reply, 500, `获取店铺指标失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/taobao/shop/:id/products ── 商品结构
  app.get('/api/v1/taobao/shop/:id/products', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string; limit?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      const limit = parseInt(request.query.limit || '50', 10) || 50
      return await runTaobaoShopQuery(request, reply, async (shopId, client) => {
        const products = await getTaobaoProductStructure(shopId, r.from, r.to, limit, client)
        return { range: r, products, count: products.length }
      })
    } catch (err: any) {
      return sendError(reply, 500, `获取商品结构失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/taobao/shop/:id/channels ── 淘系三级渠道
  app.get('/api/v1/taobao/shop/:id/channels', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runTaobaoShopQuery(request, reply, async (shopId, client) => {
        const channels = await getTaobaoChannelSplit(shopId, r.from, r.to, client)
        return { range: r, channels }
      })
    } catch (err: any) {
      return sendError(reply, 500, `获取渠道结构失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/taobao/shop/:id/ad-reconciliation ── 万相台双源对账
  app.get('/api/v1/taobao/shop/:id/ad-reconciliation', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runTaobaoShopQuery(request, reply, async (shopId, client) => {
        const data = await getTaobaoAdReconciliation(shopId, r.from, r.to, client)
        return { range: r, ...data }
      }, true)
    } catch (err: any) {
      return sendError(reply, 500, `获取投放对账失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/taobao/shop/:id/dsr ── DSR 与体验分
  app.get('/api/v1/taobao/shop/:id/dsr', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      return await runTaobaoShopQuery(request, reply, (shopId, client) => getTaobaoDsrStatus(shopId, client))
    } catch (err: any) {
      return sendError(reply, 500, `获取 DSR 失败：${err?.message || err}`)
    }
  })
}
