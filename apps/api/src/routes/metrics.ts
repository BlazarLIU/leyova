import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  metricsRegistry,
  collectDynamicDatabaseMetrics,
} from '../lib/metrics.js'
import { env } from '../config/env.js'

/**
 * Prometheus 抓取鉴权（P0-3）
 *
 * 审计发现 `/api/v1/metrics` 匿名可读，暴露调用量、错误率与业务计数。
 * 规则：
 *   - 已登录会话可访问；
 *   - 配置 METRICS_TOKEN 后，抓取端可用 `Authorization: Bearer <token>`
 *     或 `X-Metrics-Token` 免登录访问；
 *   - 两者皆无 → 401。
 */
function hasValidMetricsToken(request: FastifyRequest): boolean {
  if (!env.METRICS_TOKEN) return false
  const authHeader = request.headers.authorization
  const provided = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.headers['x-metrics-token']
  if (typeof provided !== 'string' || provided.length === 0) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(env.METRICS_TOKEN)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function metricsRoutes(app: FastifyInstance) {
  const handler = async (request: FastifyRequest, reply: any) => {
    if (!request.user && !hasValidMetricsToken(request)) {
      return reply.code(401).send({
        success: false,
        message: '指标端点需要登录或有效抓取令牌',
      })
    }
    collectDynamicDatabaseMetrics()
    const metricsData = await metricsRegistry.metrics()
    return reply
      .header('Content-Type', metricsRegistry.contentType)
      .send(metricsData)
  }

  // Standard root Prometheus scrape endpoint
  app.get('/metrics', handler)

  // API v1 namespaced scrape endpoint
  app.get('/api/v1/metrics', handler)
}
