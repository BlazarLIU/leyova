/**
 * auth-hook.ts — 全局鉴权钩子
 *
 * 修复背景：P0 建了二维权限矩阵（role_platform_permissions），但
 * apps/api/src/index.ts 从未注册任何 preHandler 注入 request.user，
 * 导致 resolveScope() 在 role 为空时直接返回 null（= 不限平台），
 * 权限矩阵在运行时完全失效。
 *
 * 本钩子做两件事：
 *   1. 解析 session cookie，把用户挂到 request.user
 *   2. 对受保护前缀的请求做登录校验（白名单除外）
 *
 * 注意：这里**不**做 401 拦截以外的业务判断，业务侧仍可调 requireAuth，
 * 保证向后兼容（现有 handler 都自己调 requireAuth）。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { env } from '../config/env.js'
import { getPool } from './db.js'
import { findSessionUser, type AuthUser } from './guard.js'
import { checkModuleAccess } from './module-guard.js'
import { resolveAccess } from './access-resolver.js'

/** 无需登录即可访问的路径前缀 */
const PUBLIC_PREFIXES = [
  '/api/v1/health',
  '/api/v1/ready',
  '/api/v1/metrics',       // 匿名放行由 metrics 路由内部校验 token/会话
  '/api/v1/auth/login',
  '/api/v1/auth/me',       // 未登录时返回 401 由 handler 自己处理
  '/api/v1/setup',         // 首次初始化：由安装凭证在路由内校验
  '/docs',
  '/openapi',
]

/** 无需登录即可访问的 web 资源（前端构建产物由 vite 提供，不经过本 API） */
function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p))
}

/** 需要强制登录的 API 前缀（其余如 /api/v1/health 等保持开放） */
const PROTECTED_PREFIXES = ['/api/v1/']

function isProtected(path: string): boolean {
  if (!path.startsWith('/api/v1/')) return false
  return PROTECTED_PREFIXES.some((p) => path.startsWith(p)) && !isPublic(path)
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}

export function registerAuthHook(app: FastifyInstance): void {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // 1) 尽力解析用户（即使未登录也不报错，交给后面的强制校验）
    const token = request.cookies?.[env.SESSION_COOKIE_NAME]
    if (token) {
      try {
        const user = await findSessionUser(getPool(), token)
        if (user) {
          request.user = user
          ;(request as any).userRole = user.role
        }
      } catch (err) {
        request.log.warn({ err }, '[auth-hook] session lookup failed')
      }
    }

    // 2) 受保护路径必须有用户
    if (isProtected(request.url) && !request.user) {
      reply.code(401).send({
        success: false,
        message: '未登录或会话已过期，请重新登录',
      })
      return reply
    }

    // 3) 模块权限守卫（P0-D-1）
    //    审计发现：canAccessModule() 此前全仓 0 调用，后端完全没有模块校验。
    //    这里按 URL 前缀 → 模块的映射统一校验，fail-closed。
    if (request.user) {
      try {
        const access = await resolveAccess({
          userId: request.user.id,
          role: request.user.role,
          userType: (request.user as any).userType,
          tenantId: (request.user as any).tenantId,
        })
        const guard = checkModuleAccess(request, access)
        if (!guard.ok) {
          reply.code(guard.status || 403).send({
            success: false,
            message: guard.reason || '无权访问该模块',
            module: guard.module,
          })
          return reply
        }
      } catch (err) {
        // 解析失败按 fail-closed 处理，但仅对非超管
        request.log.warn({ err }, '[auth-hook] module guard failed')
        if (request.user.role !== 'super_admin') {
          reply.code(403).send({ success: false, message: '权限校验失败' })
          return reply
        }
      }
    }

    // 4) 全局 fail-closed 写保护：brand_viewer 为品牌方只读视角，禁止非账号安全类的写操作
    const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
    if (request.user?.userType === 'brand_viewer' && WRITE_METHODS.includes(request.method)) {
      const cleanPath = request.url.split('?')[0]
      const allowedBrandMutations = ['/api/v1/auth/logout', '/api/v1/auth/change-password']
      if (!allowedBrandMutations.includes(cleanPath)) {
        reply.code(403).send({
          success: false,
          message: '品牌方只读视角禁止执行修改或写入操作',
        })
        return reply
      }
    }
  })
}
