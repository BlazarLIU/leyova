/**
 * caliber.ts — 口径配置路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { requireRole } from '../lib/guard.js'
import {
  listCaliberConfig,
  listAmountTypes,
  getDefaultCaliber,
  checkComparability,
} from '../platform/caliber.js'

export async function caliberRoutes(app: FastifyInstance) {
  // ── GET /api/v1/caliber ── 全部口径配置
  app.get('/api/v1/caliber', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [configs, types] = await Promise.all([listCaliberConfig(), listAmountTypes()])
      return sendOk(reply, { configs, amountTypes: types })
    } catch (err) {
      return sendError(reply, 500, '获取口径配置失败')
    }
  })

  // ── GET /api/v1/caliber/:platform ── 单平台默认口径
  app.get('/api/v1/caliber/:platform', async (request: FastifyRequest<{
    Params: { platform: string }
    Querystring: { metric?: string }
  }>, reply: FastifyReply) => {
    try {
      const metric = request.query.metric || 'gmv'
      const info = await getDefaultCaliber(request.params.platform, metric)
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
      const result = await checkComparability(platformCodes, metric)
      return sendOk(reply, result, result.comparable ? '口径可对比' : '口径不可对比，请查看建议')
    } catch (err) {
      return sendError(reply, 500, '口径校验失败')
    }
  })
}
