/**
 * caliber.ts — 口径配置路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import {
  listCaliberConfig,
  listAmountTypes,
  getDefaultCaliber,
  checkComparability,
} from '../platform/caliber.js'
import { listMetricDefinitions } from '../services/metrics-caliber.js'

export async function caliberRoutes(app: FastifyInstance) {
  // ── GET /api/v1/caliber ── 全部口径配置
  app.get('/api/v1/caliber', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const data = await withRlsContext(request, async (client) => {
        const [configs, types] = await Promise.all([
          listCaliberConfig(client),
          listAmountTypes(client),
        ])
        return { configs, amountTypes: types }
      })
      return sendOk(reply, data)
    } catch (err) {
      return sendError(reply, 500, '获取口径配置失败')
    }
  })

  // ── GET /api/v1/caliber/metrics ── 统一指标口径定义目录（metric_definition）
  app.get('/api/v1/caliber/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const metrics = await withRlsContext(request, (client) =>
        listMetricDefinitions(client, { role: user.role, userType: user.userType }),
      )
      return sendOk(reply, { metrics })
    } catch (err) {
      return sendError(reply, 500, '获取指标口径定义失败')
    }
  })

  // ── GET /api/v1/caliber/:platform ── 单平台默认口径
  app.get('/api/v1/caliber/:platform', async (request: FastifyRequest<{
    Params: { platform: string }
    Querystring: { metric?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const metric = request.query.metric || 'gmv'
      const info = await withRlsContext(request, (client) =>
        getDefaultCaliber(request.params.platform, metric, client),
      )
      if (!info) return sendError(reply, 404, `平台 ${request.params.platform} 未配置 ${metric} 口径`)
      return sendOk(reply, info)
    } catch (err) {
      return sendError(reply, 500, '获取平台口径失败')
    }
  })

  // ── POST /api/v1/caliber/check ── 跨平台对比口径校验
  app.post<{
    Body: { platformCodes: string[]; metric?: string }
  }>('/api/v1/caliber/check', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance'])] }, async (request, reply) => {
    try {
      const { platformCodes, metric = 'gmv' } = request.body || ({} as any)
      if (!Array.isArray(platformCodes) || platformCodes.length === 0) {
        return sendError(reply, 400, '缺少 platformCodes')
      }
      const result = await withRlsContext(request, (client) =>
        checkComparability(platformCodes, metric, client),
      )
      return sendOk(reply, result, result.comparable ? '口径可对比' : '口径不可对比，请查看建议')
    } catch (err) {
      return sendError(reply, 500, '口径校验失败')
    }
  })
}
