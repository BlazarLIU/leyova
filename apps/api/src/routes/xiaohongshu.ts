/**
 * xiaohongshu.ts — 小红书专属路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
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
  // ── GET /api/v1/xiaohongshu/notes ── 笔记经营看板
  app.get('/api/v1/xiaohongshu/notes', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; shopId?: string }
  }>, reply: FastifyReply) => {
    try {
      const r = defaultRange(request.query.from, request.query.to)
      const shopId = request.query.shopId ? parseInt(request.query.shopId, 10) : null
      const data = await getXhsNoteBoard(shopId, r.from, r.to)
      return sendOk(reply, data)
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
      const shopId = request.query.shopId ? parseInt(request.query.shopId, 10) : null
      const data = await getXhsSearchAnalysis(shopId, r.from, r.to)
      return sendOk(reply, data)
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
      const shopId = request.query.shopId ? parseInt(request.query.shopId, 10) : null
      const data = await getXhsConversionFunnel(shopId, r.from, r.to)
      return sendOk(reply, data)
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
      const shopId = request.query.shopId ? parseInt(request.query.shopId, 10) : null
      const data = await getXhsOnOffsite(shopId, r.from, r.to)
      return sendOk(reply, data)
    } catch (err: any) {
      return sendError(reply, 500, `获取站内外拆分失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/xiaohongshu/aips ── AIPS 人群资产
  app.get('/api/v1/xiaohongshu/aips', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await getXhsAips()
      return sendOk(reply, data)
    } catch (err) {
      return sendError(reply, 500, '获取 AIPS 说明失败')
    }
  })
}
