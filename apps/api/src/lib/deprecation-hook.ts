import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getPool } from './db.js'

/**
 * 废弃路由或 30 天观察期路由前缀清单
 */
export const DEPRECATED_PREFIXES = [
  '/api/v1/ai/',
  '/api/v1/overview/',
  '/api/v1/workbench/',
  '/api/v1/omnichannel/',
  '/api/v1/general-ledger/',
  '/api/v1/fulfillment/',
  '/api/v1/after-sales/',
  '/api/v1/kol/',
  '/api/v1/customer-service/',
  '/api/v1/search-keywords/',
  '/api/v1/campaign-plan/',
  '/api/v1/custom-fields/',
  '/api/v1/content/',
  '/api/v1/media/',
  '/api/v1/video/',
  '/api/v1/director/',
  '/api/v1/hrbp/',
  '/api/v1/bi/',
  '/api/v1/review/',
]

export function isDeprecatedRoute(url: string): boolean {
  return DEPRECATED_PREFIXES.some((prefix) => url.startsWith(prefix))
}

export function registerDeprecationHook(app: FastifyInstance): void {
  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.raw.url || request.url || ''
    if (!isDeprecatedRoute(url)) return

    // 1. 注入 RFC 7234 废弃告警响应头
    reply.header(
      'Warning',
      '299 - "This API route is deprecated and scheduled for archival. Please migrate to /api/v1/assistant/* or /api/v1/decision-cases/*."'
    )
    reply.header('X-Deprecation-Notice', 'Scheduled for archive after 30-day observation period')

    // 2. 旁路异步落库（完全非阻塞，不影响主响应）
    const user = (request as any).user
    const pool = getPool()
    const path = url.split('?')[0]
    const method = request.method
    const ip = request.ip || (request.headers['x-forwarded-for'] as string) || null
    const userAgent = request.headers['user-agent'] || null
    const tenantId = user?.tenantId ?? null
    const userId = user?.id ?? null
    const userRole = user?.role ?? null

    pool.query(
      `INSERT INTO public.sys_deprecation_access_logs
         (tenant_id, user_id, user_role, method, route_path, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, userId, userRole, method, path, userAgent, ip]
    ).catch(() => {
      // 审计日志写入异常静默，绝不影响业务主请求
    })
  })
}
