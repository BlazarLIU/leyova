/**
 * jd.ts — 京东专属路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { canAccessCost, requireAuth } from '../lib/guard.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import {
  getJdModeBreakdown,
  getJdStoreRating,
  getJdFulfillment,
  getJdCaliber,
} from '../platform/jd-analytics.js'

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

export async function jdRoutes(app: FastifyInstance) {
  const pool = getPool()

  async function validateOptionalShop(request: FastifyRequest<{ Querystring: { shopId?: string } }>, reply: FastifyReply): Promise<boolean> {
    if (!request.query.shopId) return true
    const check = await assertShopPlatform(pool, request.query.shopId, 'jd')
    if (!check.ok) {
      sendError(reply, check.statusCode || 400, check.message || '店铺校验失败')
      return false
    }
    return true
  }

  // ── GET /api/v1/jd/mode-breakdown ── 自营 vs POP 拆分
  app.get('/api/v1/jd/mode-breakdown', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; platforms?: string; shopId?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!(await validateOptionalShop(request, reply))) return
    try {
      const r = defaultRange(request.query.from, request.query.to)
      const platforms = request.query.platforms
        ? request.query.platforms.split(',').filter(Boolean)
        : ['jd']
      const data = await getJdModeBreakdown(r.from, r.to, platforms)
      if (!canAccessCost(user) && data && typeof data === 'object' && 'selfOperated' in data && (data as any).selfOperated) {
        ;(data as any).selfOperated = { ...(data as any).selfOperated, grossMargin: null, marginRate: null }
      }
      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'jd mode breakdown failed')
      return sendError(reply, 500, `获取模式拆分失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/jd/store-rating ── 店铺星级与履约
  app.get('/api/v1/jd/store-rating', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; platforms?: string; shopId?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!(await validateOptionalShop(request, reply))) return
    try {
      const r = defaultRange(request.query.from, request.query.to)
      const platforms = request.query.platforms
        ? request.query.platforms.split(',').filter(Boolean)
        : ['jd']
      const data = await getJdStoreRating(r.from, r.to, platforms)
      return sendOk(reply, data)
    } catch (err: any) {
      return sendError(reply, 500, `获取店铺星级失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/jd/fulfillment ── 履约时效监控
  app.get('/api/v1/jd/fulfillment', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; platforms?: string; shopId?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!(await validateOptionalShop(request, reply))) return
    try {
      const r = defaultRange(request.query.from, request.query.to)
      const platforms = request.query.platforms
        ? request.query.platforms.split(',').filter(Boolean)
        : ['jd']
      const data = await getJdFulfillment(r.from, r.to, platforms)
      return sendOk(reply, data)
    } catch (err: any) {
      return sendError(reply, 500, `获取履约数据失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/jd/caliber ── 京东口径说明
  app.get('/api/v1/jd/caliber', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const data = await getJdCaliber('jd')
      return sendOk(reply, data)
    } catch (err) {
      return sendError(reply, 500, '获取口径说明失败')
    }
  })
}
