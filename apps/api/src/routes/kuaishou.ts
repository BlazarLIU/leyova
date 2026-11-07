/**
 * kuaishou.ts — 快手专属路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
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
  // ── GET /api/v1/kuaishou/shop/:id/traffic-split ── 公私域拆分
  app.get('/api/v1/kuaishou/shop/:id/traffic-split', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>, reply: FastifyReply) => {
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getKsTrafficSplit(shopId, r.from, r.to)
      return sendOk(reply, data)
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
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getKsIndirectGmv(shopId, r.from, r.to)
      return sendOk(reply, data)
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
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getKsFansTeam(shopId, r.from, r.to)
      return sendOk(reply, data)
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
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const r = defaultRange(request.query.from, request.query.to)
      const data = await getKsAdRoi(shopId, r.from, r.to)
      return sendOk(reply, data)
    } catch (err: any) {
      return sendError(reply, 500, `获取 ROI 分析失败：${err?.message || err}`)
    }
  })
}
