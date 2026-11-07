/**
 * pdd.ts — 拼多多专属路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import {
  getPddGroupFunnel,
  getPddCaliberCompare,
  getPddRefundAnalysis,
  getPddStoreHealth,
} from '../platform/pdd-analytics.js'

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

export async function pddRoutes(app: FastifyInstance) {
  // ── GET /api/v1/pdd/shop/:id/group-funnel ── 成团漏斗
  app.get('/api/v1/pdd/shop/:id/group-funnel', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getPddGroupFunnel(shopId, r.from, r.to)
      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'pdd group funnel failed')
      return sendError(reply, 500, `获取成团漏斗失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/pdd/shop/:id/caliber-compare ── 三口径对账
  app.get('/api/v1/pdd/shop/:id/caliber-compare', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getPddCaliberCompare(shopId, r.from, r.to)
      return sendOk(reply, data)
    } catch (err: any) {
      return sendError(reply, 500, `获取口径对账失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/pdd/shop/:id/refund ── 仅退款与售后
  app.get('/api/v1/pdd/shop/:id/refund', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getPddRefundAnalysis(shopId, r.from, r.to)
      return sendOk(reply, data)
    } catch (err: any) {
      return sendError(reply, 500, `获取售后分析失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/pdd/shop/:id/health ── 店铺健康度 + 投放
  app.get('/api/v1/pdd/shop/:id/health', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getPddStoreHealth(shopId, r.from, r.to)
      return sendOk(reply, data)
    } catch (err: any) {
      return sendError(reply, 500, `获取店铺健康度失败：${err?.message || err}`)
    }
  })
}
