/**
 * xiaohongshu.ts — 小红书专属路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import {
  getXhsNoteBoard,
  getXhsSearchAnalysis,
  getXhsConversionFunnel,
  getXhsOnOffsite,
  getXhsAips,
} from '../platform/xhs-analytics.js'

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

export async function xiaohongshuRoutes(app: FastifyInstance) {
  async function runOptionalXhsQuery<T>(
    request: FastifyRequest<{ Querystring: { shopId?: string } }>,
    reply: FastifyReply,
    fn: (shopId: number | null, client: any) => Promise<T>,
  ) {
    const user = await requireAuth(request, reply)
    if (!user) return
    const result = await withRlsContext(request, async (client) => {
      let shopId: number | null = null
      if (request.query.shopId) {
        const check = await assertShopPlatform(client, request.query.shopId, 'xiaohongshu')
        if (!check.ok || !check.shop) return { shopError: check }
        shopId = check.shop.id
      }
      return { data: await fn(shopId, client) }
    })
    if ('shopError' in result && result.shopError) {
      return sendError(reply, result.shopError.statusCode || 400, result.shopError.message || '店铺校验失败')
    }
    return sendOk(reply, result.data)
  }

  // ── GET /api/v1/xiaohongshu/notes ── 笔记经营看板
  app.get('/api/v1/xiaohongshu/notes', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; shopId?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runOptionalXhsQuery(request, reply, (shopId, client) => getXhsNoteBoard(shopId, r.from, r.to, client))
    } catch (err: any) {
      request.log.error({ err }, 'xhs note board failed')
      return sendError(reply, 500, `获取笔记看板失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/xiaohongshu/search ── 搜索分析
  app.get('/api/v1/xiaohongshu/search', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; shopId?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runOptionalXhsQuery(request, reply, (shopId, client) => getXhsSearchAnalysis(shopId, r.from, r.to, client))
    } catch (err: any) {
      return sendError(reply, 500, `获取搜索分析失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/xiaohongshu/funnel ── 种草转化链路
  app.get('/api/v1/xiaohongshu/funnel', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; shopId?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runOptionalXhsQuery(request, reply, (shopId, client) => getXhsConversionFunnel(shopId, r.from, r.to, client))
    } catch (err: any) {
      return sendError(reply, 500, `获取转化链路失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/xiaohongshu/on-offsite ── 站内外成交
  app.get('/api/v1/xiaohongshu/on-offsite', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; shopId?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      return await runOptionalXhsQuery(request, reply, (shopId, client) => getXhsOnOffsite(shopId, r.from, r.to, client))
    } catch (err: any) {
      return sendError(reply, 500, `获取站内外拆分失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/xiaohongshu/aips ── AIPS 人群资产
  app.get('/api/v1/xiaohongshu/aips', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const data = await getXhsAips()
      return sendOk(reply, data)
    } catch (err) {
      return sendError(reply, 500, '获取 AIPS 说明失败')
    }
  })
}
