import type { FastifyReply, FastifyRequest } from 'fastify'
import { sendError } from './http.js'
import { env } from '../config/env.js'
import { getPool } from './db.js'

export interface AuthUser {
  id: number
  username: string
  realName: string
  role: string
  userType?: string
  tenantId?: number
  anchorId?: number
}

/**
 * Require authentication. Returns the user or null (and sends error response).
 */
/**
 * Require authentication. Returns the user or null (and sends error response).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthUser | null> {
  const token = request.cookies[env.SESSION_COOKIE_NAME]
  if (!token) {
    sendError(reply, 401, '未登录')
    return null
  }

  try {
    const user = await findSessionUser(getPool(), token)
    if (!user) {
      sendError(reply, 401, '会话已过期，请重新登录')
      return null
    }
    return user
  } catch (err) {
    request.log.warn({ err }, 'requireAuth query failed')
    sendError(reply, 500, '服务器错误')
    return null
  }
}

/**
 * 查询有效会话对应的用户。命中返回用户；无命中（过期/账号停用/会话不存在）返回 null；查询异常向上抛（由 requireAuth 归为 500）。
 * pool 参数可注入，便于单元测试。
 */
export async function findSessionUser(pool: any, token: string): Promise<AuthUser | null> {
  const result = await pool.query(
    `SELECT u.id, u.username, u.real_name, u.role, u.user_type, u.tenant_id, u.anchor_id
     FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW() AND u.status = 1`,
    [token]
  ) as { rows: Array<{ id: number; username: string; real_name: string; role: string; user_type?: string; tenant_id?: number; anchor_id?: number }> }

  const row = result.rows[0]
  if (!row) return null

  return {
    id: row.id,
    username: row.username,
    realName: row.real_name,
    role: row.role,
    userType: row.user_type,
    tenantId: row.tenant_id,
    anchorId: row.anchor_id ? Number(row.anchor_id) : undefined,
  }
}

/**
 * 校验用户是否属于指定角色之一（super_admin 拥有全局最高权限，永远放行）
 */
export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    if (user.role === 'super_admin') {
      return
    }

    if (!allowedRoles.includes(user.role)) {
      sendError(reply, 403, '当前角色无权访问该功能')
      return
    }
  }
}

/**
 * 敏感成本与利润数据访问判断：仅系统管理员、管理员、财务专员可见（排除只读品牌方）
 */
export function canAccessCost(user: AuthUser): boolean {
  if (!user || user.userType === 'brand_viewer') return false
  return ['super_admin', 'admin', 'finance'].includes(user.role)
}

/**
 * 角色管理层级校验：防止普通管理员（admin）越权创建、提权或修改超级管理员（super_admin）账号
 */
export function canManageTargetUser(
  actorRole: string,
  targetCurrentRole?: string | null,
  targetNewRole?: string | null
): boolean {
  if (actorRole === 'super_admin') return true
  if (actorRole !== 'admin') return false
  if (targetCurrentRole === 'super_admin') return false
  if (targetNewRole === 'super_admin') return false
  return true
}

/**
 * Fail-closed 获取当前用户的合法可见平台集合：
 * - 未登录用户：返回空 Set（不可见任何平台）
 * - brand_viewer：仅限其授权 agency_projects 关联的平台
 * - super_admin（非 brand_viewer）：返回 null 表示全平台可见
 * - 其余角色：读取 role_platform_permissions 与 user_platform_permissions 并集；无配置则返回空 Set
 */
export async function getUserAllowedPlatforms(
  pool: any,
  user: AuthUser | null | undefined
): Promise<Set<string> | null> {
  if (!user || !user.id) {
    return new Set<string>()
  }

  if (user.userType === 'brand_viewer') {
    const tenantId = user.tenantId || 1
    const res = (await pool.query(
      `SELECT DISTINCT p.platform_code
       FROM public.brand_viewer_permissions bvp
       JOIN public.agency_projects p
         ON p.tenant_id = bvp.tenant_id
        AND p.id = ANY(bvp.project_ids)
       WHERE bvp.user_id = $1 AND bvp.tenant_id = $2`,
      [user.id, tenantId]
    )) as { rows: Array<{ platform_code: string }> }
    return new Set(res.rows.map((r) => r.platform_code))
  }

  if (user.role === 'super_admin') {
    return null
  }

  const res = (await pool.query(
    `SELECT platform_code
     FROM public.role_platform_permissions rpp
     JOIN public.roles r ON r.id = rpp.role_id
     WHERE r.code = $1
     UNION
     SELECT platform_code
     FROM public.user_platform_permissions
     WHERE user_id = $2`,
    [user.role, user.id]
  )) as { rows: Array<{ platform_code: string }> }

  return new Set(res.rows.map((r) => r.platform_code))
}

/**
 * Check if user has the required permission.
 */
export async function hasPermission(
  userId: number,
  permissionCode: string,
  pool: any = getPool()
): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS cnt
       FROM users u
       JOIN role_permissions rp ON rp.role_id = (SELECT id FROM roles WHERE code = u.role)
       JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = $1 AND p.code = $2`,
      [userId, permissionCode]
    ) as { rows: Array<{ cnt: number }> }
    return result.rows[0]?.cnt > 0
  } catch {
    return false
  }
}

/**
 * Require a specific permission. Returns true if authorized.
 */
export async function requirePermission(
  request: FastifyRequest,
  reply: FastifyReply,
  permissionCode: string
): Promise<boolean> {
  const user = await requireAuth(request, reply)
  if (!user) return false

  const ok = await hasPermission(user.id, permissionCode)
  if (!ok) {
    sendError(reply, 403, '无权限执行此操作')
    return false
  }
  return true
}