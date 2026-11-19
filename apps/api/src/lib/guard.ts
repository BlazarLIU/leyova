import type { FastifyReply, FastifyRequest } from 'fastify'
import { sendError } from './http.js'
import { env } from '../config/env.js'
import { getPool } from './db.js'

export type RoleCode =
  | 'super_admin'
  | 'ops_director'
  | 'ops_staff'
  | 'ad_buyer'
  | 'controller'
  | 'video_editor'
  | 'cs_agent'
  | 'hrbp'

export const AD_SPEND_ROLES: RoleCode[] = ['super_admin', 'ops_director', 'ad_buyer']

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
 * 敏感成本与利润数据访问判断（P0-D-2）
 *
 * 改造前：`['super_admin','admin'].includes(role)` —— 硬编码角色白名单，
 *        导致投手/运营/HRBP 看不到任何成本，无法评估一场直播赚没赚。
 *
 * 改造后：改为**模块授权**（cost_visibility），粒度到人。
 *   同步态版本：仅按角色判断（供 AI orchestrator 等无 DB 上下文场景使用）。
 *   异步态请用 `canAccessCostAsync(userId, role, userType)` 走 user_module_overrides。
 *
 * 默认授权见迁移 144：super_admin / admin / ad_buyer / operator /
 *   ops_staff / ops_director / hrbp
 */
const COST_VISIBILITY_ROLES = new Set([
  'super_admin', 'ops_director', 'ops_staff', 'ad_buyer', 'hrbp',
])

export function canAccessCost(
  user: { role?: string | null; userType?: string | null } | null | undefined
): boolean {
  if (!user || !user.role || user.userType === 'brand_viewer') return false
  return COST_VISIBILITY_ROLES.has(user.role)
}

/**
 * 成本可见性（精确版，走模块授权，支持粒度到人）
 *
 * 与同步版的区别：本函数会读 `user_module_overrides`，
 * 因此管理员可以在「角色与模块权限」页给单个投手单独开关成本可见性。
 *
 * 使用场景：HTTP 路由（有 request 上下文、可查库）
 * 不使用场景：AI orchestrator 等纯计算链路（用同步版即可）
 */
export async function canAccessCostAsync(
  userId: number | null | undefined,
  role: string | null | undefined,
  userType: string | null | undefined,
  pool?: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
): Promise<boolean> {
  if (!userId || !role || userType === 'brand_viewer') return false

  // 超管恒定可见
  if (role === 'super_admin') return true

  try {
    const p = pool || getPool()
    const res = await p.query(
      `SELECT effect FROM public.user_module_overrides
        WHERE user_id = $1 AND module_code = 'cost_visibility'`,
      [userId],
    )
    // 用户级覆盖优先
    if (res.rows.length > 0) {
      return res.rows[0].effect === 'grant'
    }
  } catch {
    // 查询失败降级到角色判断（fail-open 仅限此处：成本可见性不是安全边界）
  }

  return COST_VISIBILITY_ROLES.has(role)
}

/**
 * 投流消耗与归因 ROI 访问判断：投放专员与核心管理/财务角色可见（成本与毛利明细仍受 canAccessCost 控制）
 */
export function canAccessAdSpend(
  user: { role?: string | null; userType?: string | null } | null | undefined
): boolean {
  if (!user || !user.role || user.userType === 'brand_viewer') return false
  return AD_SPEND_ROLES.includes(user.role as RoleCode)
}

/**
 * 角色管理层级校验：防止普通管理员（admin）越权创建、提权或修改超级管理员（super_admin）账号
 */
export function canManageTargetUser(
  actorRole: string,
  _targetCurrentRole?: string | null,
  _targetNewRole?: string | null
): boolean {
  // 组织收敛后仅 super_admin 具备账号管理权限
  if (actorRole !== 'super_admin') return false
  return true
}

/**
 * Fail-closed 获取当前用户的合法可见平台集合：
 * - 未登录用户：返回空 Set（不可见任何平台）
 * - brand_viewer：S3 起代运营相关表已下线，品牌方查看者若无独立授权表则返回空 Set
 * - super_admin（非 brand_viewer）：返回 null 表示全平台可见
 * - 其余角色：读取 role_platform_permissions 与 user_platform_permissions 并集；
 *   无配置则退化为全部启用平台
 */
export async function getUserAllowedPlatforms(
  pool: any,
  user: AuthUser | null | undefined
): Promise<Set<string> | null> {
  if (!user || !user.id) {
    return new Set<string>()
  }

  if (user.userType === 'brand_viewer') {
    // S3：brand_viewer_permissions 已随代运营域下线；表不存在时安全返回空集
    const exists = (await pool.query(
      `SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='brand_viewer_permissions'`,
    )) as { rows: unknown[] }
    if (exists.rows.length === 0) {
      return new Set<string>()
    }
    const res = (await pool.query(
      `SELECT DISTINCT platform_code FROM public.brand_viewer_permissions WHERE user_id = $1`,
      [user.id],
    )) as { rows: Array<{ platform_code: string }> }
    return new Set(res.rows.map((r) => r.platform_code))
  }

  if (user.role === 'super_admin') {
    return null
  }

  const res = (await pool.query(
    `SELECT substring(resource from 10) AS platform_code
     FROM public.sys_role_permission
     WHERE role_code = $1 AND resource LIKE 'platform:%' AND effect = 'allow'
     UNION
     SELECT platform_code
     FROM public.role_platform_permissions rpp
     JOIN public.roles r ON r.id = rpp.role_id
     WHERE r.code = $1
     UNION
     SELECT platform_code
     FROM public.user_platform_permissions
     WHERE user_id = $2`,
    [user.role, user.id]
  )) as { rows: Array<{ platform_code: string }> }

  const set = new Set(res.rows.map((r) => r.platform_code))
  if (set.size === 0) {
    const all = (await pool.query(
      `SELECT platform_code FROM public.system_platform_configs WHERE is_enabled = true`,
    )) as { rows: Array<{ platform_code: string }> }
    return new Set(all.rows.map((r) => r.platform_code))
  }
  return set
}
