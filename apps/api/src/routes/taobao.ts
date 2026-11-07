/**
 * taobao.ts — 淘宝/天猫专属路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
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
  // ── GET /api/v1/taobao/shop/:id/metrics ── 店铺经营指标
  app.get('/api/v1/taobao/shop/:id/metrics', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getTaobaoShopMetrics(shopId, r.from, r.to)
      if (!data) return sendError(reply, 404, '店铺不存在')
      return sendOk(reply, data)
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
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const limit = parseInt(request.query.limit || '50', 10) || 50
      const data = await getTaobaoProductStructure(shopId, r.from, r.to, limit)
      return sendOk(reply, { range: r, products: data, count: data.length })
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
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getTaobaoChannelSplit(shopId, r.from, r.to)
      return sendOk(reply, { range: r, channels: data })
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
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getTaobaoAdReconciliation(shopId, r.from, r.to)
      return sendOk(reply, { range: r, ...data })
    } catch (err: any) {
      return sendError(reply, 500, `获取投放对账失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/taobao/shop/:id/dsr ── DSR 与体验分
  app.get('/api/v1/taobao/shop/:id/dsr', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const data = await getTaobaoDsrStatus(shopId)
      return sendOk(reply, data)
    } catch (err: any) {
      return sendError(reply, 500, `获取 DSR 失败：${err?.message || err}`)
    }
  })
}
