/**
 * module-guard.ts — 全局模块权限守卫（P0-D-1）
 *
 * 背景（审计 02 发现）：
 *   `canAccessModule()` 全仓 **0 调用**，47 个路由文件无一处做模块校验。
 *   后端只有 `requireRole([硬编码数组])` 这一层，与 `role_module_grants` 完全脱钩
 *   → 管理员在「角色与模块权限」页改任何东西，对后端零影响。
 *
 * 本模块提供**按 URL 前缀映射模块**的集中式守卫：
 *   - 零侵入：不需要给 349 个路由逐个加 config，只维护一张前缀映射表
 *   - fail-closed：未在映射表中声明且非白名单的路径 → 拒绝（避免漏配变越权）
 *   - 与 platform_capability_matrix 联动：非该平台适用模块 → 403
 *
 * 优先级：PUBLIC（无需登录） > EXEMPT（登录即可） > MODULE_MAP（需模块授权）
 */

import type { FastifyRequest } from 'fastify'
import { canAccessModule, resolveAccess, type ResolvedAccess } from './access-resolver.js'

/**
 * URL 前缀 → 所需模块
 * 顺序敏感：先匹配到的生效，因此更具体的前缀必须放在更宽泛的前面
 */
const MODULE_MAP: Array<{ prefix: string; module: string }> = [
  // ── 更具体的必须先声明 ──
  { prefix: '/api/v1/review/overview',   module: 'review_overview' },
  { prefix: '/api/v1/review/channels',   module: 'review_channels' },
  { prefix: '/api/v1/review/anchors',    module: 'review_anchors' },
  { prefix: '/api/v1/review/funnel',     module: 'review_funnel' },
  { prefix: '/api/v1/review/closed-loop', module: 'review_closed_loop' },
  // review 兜底：其余 /review/* 端点（products / short-videos / related-issues 等）
  { prefix: '/api/v1/review',            module: 'review' },
  // 大促活动：归 system_promotions（operator/admin 均有）
  { prefix: '/api/v1/promotions',        module: 'system_promotions' },
  { prefix: '/api/v1/ops/session-plans', module: 'session_products' },
  { prefix: '/api/v1/ops/script-library', module: 'ops' },
  { prefix: '/api/v1/ops/capabilities',  module: 'ops' },
  { prefix: '/api/v1/ops/issue-library', module: 'ops' },
  { prefix: '/api/v1/ops/goal-tracking', module: 'ops' },
  { prefix: '/api/v1/ops/room-health',   module: 'ops' },
  { prefix: '/api/v1/net-roi',           module: 'net_roi' },
  { prefix: '/api/v1/search-keywords',   module: 'search_seo' },
  { prefix: '/api/v1/members',           module: 'members' },
  { prefix: '/api/v1/fulfillment',       module: 'fulfillment' },
  { prefix: '/api/v1/after-sales',       module: 'after_sales' },
  { prefix: '/api/v1/customer-service',  module: 'customer_service' },
  { prefix: '/api/v1/cs',                module: 'customer_service' },
  { prefix: '/api/v1/kol',               module: 'kol' },
  { prefix: '/api/v1/inventory',         module: 'product_center' },
  { prefix: '/api/v1/campaign-plan',     module: 'ai' },
  { prefix: '/api/v1/selection',         module: 'ai' },
  { prefix: '/api/v1/compliance',        module: 'compliance' },
  { prefix: '/api/v1/content',           module: 'content' },
  // 人工登记的直播数据（中控账号专用）：归 live_data 而非 data。
  // 中控只被授予 live_data / live_registration / personal_achievement 三个模块，
  // 若走 /api/v1/data → data，中控连自己登记的数据都读不到（403）。
  { prefix: '/api/v1/data/live',         module: 'live_data' },
  { prefix: '/api/v1/data',              module: 'data' },
  { prefix: '/api/v1/ingest',            module: 'data' },
  { prefix: '/api/v1/governance',        module: 'data' },
  // 本人的排班与请假：登录即可（与 /access/me 同性质，不需要 session 模块权限）
  // P1-B24：主播（employee）没有 session 模块，但必须能看自己排班、自己请假
  { prefix: '/api/v1/schedule/my',       module: '__self__' },
  { prefix: '/api/v1/schedule',          module: 'session' },
  { prefix: '/api/v1/sessions',          module: 'session' },
  { prefix: '/api/v1/livereg',           module: 'live_registration' },
  { prefix: '/api/v1/anchors',           module: 'anchor' },
  { prefix: '/api/v1/training',          module: 'anchor' },
  { prefix: '/api/v1/attendance',        module: 'personal_achievement' },
  // 场次列表：前端「场次管理」页（/overview/sessions）走此接口。
  // 中控需要看「今天播什么、谁播」，故归 session 而非 overview，
  // 否则中控有 session 模块却读不到场次列表（403）。
  { prefix: '/api/v1/overview/sessions',  module: 'session' },
  { prefix: '/api/v1/overview',          module: 'overview' },
  { prefix: '/api/v1/omnichannel',       module: 'overview' },
  { prefix: '/api/v1/bi',                module: 'bi' },
  { prefix: '/api/v1/analysis',          module: 'bi' },
  { prefix: '/api/v1/caliber',           module: 'bi' },
  { prefix: '/api/v1/ai',                module: 'ai' },
  { prefix: '/api/v1/kb',                module: 'system_ai' },
  { prefix: '/api/v1/personnel',         module: 'system_personnel_ops' },
  // 告警规则查询是运营日常（看告警），归 overview；写操作由 requireRole 二次校验
  { prefix: '/api/v1/alerts',            module: 'overview' },
  { prefix: '/api/v1/maintenance',       module: 'overview' },
  { prefix: '/api/v1/dict',              module: 'system_dict' },
  { prefix: '/api/v1/platforms',         module: 'system_users' },
  // /system/* 是混合容器：具体业务功能必须先声明，否则会落到 system_users
  { prefix: '/api/v1/system/competitors', module: 'system_competitors' },
  { prefix: '/api/v1/system/promotions',  module: 'system_promotions' },
  { prefix: '/api/v1/system/tasks',       module: 'system_tasks' },
  { prefix: '/api/v1/system/alerts',      module: 'system_alerts' },
  { prefix: '/api/v1/system/compliance',  module: 'compliance' },
  { prefix: '/api/v1/system/multi-room',  module: 'system_multiroom' },
  { prefix: '/api/v1/system/rooms',       module: 'system_rooms' },
  { prefix: '/api/v1/system/personnel',   module: 'system_personnel_ops' },
  { prefix: '/api/v1/system/dict',        module: 'system_dict' },
  { prefix: '/api/v1/system/audit-logs',  module: 'audit_logs' },
  { prefix: '/api/v1/system/config',            module: 'system_config' },
  { prefix: '/api/v1/system/module-parameters', module: 'system_config' },
  // 兜底：其余 /system/*（users / roles / modules 等）归系统管理
  { prefix: '/api/v1/system',            module: 'system_users' },
  // /access/me 是「查自己的权限」，登录即可；下面更具体的规则先匹配
  // 注意：具体前缀必须在宽泛前缀之前
  { prefix: '/api/v1/access/me',         module: '__self__' },
  { prefix: '/api/v1/access/work-mode',  module: '__self__' },
  { prefix: '/api/v1/access',            module: 'system_users' },
  { prefix: '/api/v1/hrbp',              module: 'anchor' },
  // 平台专属分析：归到该平台的复盘能力
  { prefix: '/api/v1/douyin',            module: 'review' },
  { prefix: '/api/v1/kuaishou',          module: 'review' },
  { prefix: '/api/v1/taobao',            module: 'review' },
  { prefix: '/api/v1/xiaohongshu',       module: 'review' },
  { prefix: '/api/v1/insights',          module: 'review' },
]

/**
 * 登录即可访问、无需模块授权的路径（系统级能力，非业务模块）
 */
const EXEMPT_PREFIXES = [
  '/api/v1/auth/',        // 登录/登出/改密
  '/api/v1/health',
  '/api/v1/ready',
  '/api/v1/system/modules', // 前端需要拿模块清单渲染
  '/api/v1/system/roles',   // 前端需要拿角色清单
]

/** 无需登录（由 auth-hook 已处理，这里再做一次保护） */
const PUBLIC_PREFIXES = [
  '/api/v1/health',
  '/api/v1/ready',
  '/api/v1/auth/login',
  '/api/v1/auth/me',
  '/docs',
  '/openapi',
]

export interface ModuleGuardResult {
  ok: boolean
  /** 未通过时的 HTTP 状态码 */
  status?: 401 | 403
  /** 未通过原因 */
  reason?: string
  /** 命中的模块（排查用） */
  module?: string
}

/** 判断路径是否公开 */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p))
}

/** 判断路径是否豁免模块校验 */
function isExempt(path: string): boolean {
  return EXEMPT_PREFIXES.some((p) => path.startsWith(p))
}

/** 解析路径所需的模块 */
export function resolveRequiredModule(path: string): string | null {
  for (const m of MODULE_MAP) {
    if (path.startsWith(m.prefix)) return m.module
  }
  return null
}

/**
 * 校验请求是否可通过模块守卫
 *
 * @param request Fastify 请求（需已注入 request.user）
 * @param access  已解析的权限（调用方负责获取，避免重复查库）
 */
export function checkModuleAccess(
  request: FastifyRequest,
  access: ResolvedAccess | null,
): ModuleGuardResult {
  const path = (request.raw?.url || request.url || '').split('?')[0]

  if (isPublicPath(path)) return { ok: true }

  // 未登录：由 auth-hook / requireAuth 处理，这里放行避免重复 401
  const user = (request as any).user
  if (!user) return { ok: true }

  if (isExempt(path)) return { ok: true }

  const required = resolveRequiredModule(path)

  // 特殊值：仅需登录，不需要模块授权（如 /access/me 查自己的权限）
  if (required === '__self__') return { ok: true, module: '__self__' }

  // 品牌方只读视角：其可见范围由 RLS（品牌项目隔离）+ auth-hook 的写保护共同约束，
  // 模块守卫对其放行，避免与既有只读策略冲突。
  const utype = (user as any).userType
  if (utype === 'brand_viewer') {
    return { ok: true, module: required ?? undefined }
  }

  // 管理角色放宽：ops_director 在真实组织中本就该看全部业务数据，
  // 模块授权对它们的作用是「约束到某个平台/子域」，不是「限制能否看经营数据」。
  // 注：真正的写操作权限仍由各路由的 requireRole 二次校验。
  const role = (user as any).role
  if (role === 'ops_director' || role === 'super_admin') {
    return { ok: true, module: required ?? undefined }
  }

  // fail-closed：/api/v1/ 下未声明的路径 → 拒绝
  // 理由：漏配映射表就变成越权，比误拦更危险
  if (!required) {
    if (path.startsWith('/api/v1/')) {
      return {
        ok: false,
        status: 403,
        reason: `路径 ${path} 未在模块映射表中声明，按 fail-closed 拒绝。请在 module-guard.ts 的 MODULE_MAP 中补充`,
      }
    }
    return { ok: true }
  }

  if (!access) {
    return { ok: false, status: 403, reason: '无法解析权限上下文', module: required }
  }

  // 平台维度：从 query / header 推导当前平台（无则不限）
  const platformCode =
    (request.query as any)?.platform ||
    (request.headers['x-leyova-platform'] as string | undefined) ||
    null

  if (!canAccessModule(access, platformCode, required)) {
    return {
      ok: false,
      status: 403,
      reason: platformCode
        ? `当前账号在平台「${platformCode}」无权访问模块「${required}」`
        : `当前账号无权访问模块「${required}」`,
      module: required,
    }
  }

  return { ok: true, module: required }
}

/** 供路由内部按需二次校验（如写操作） */
export async function requireModuleAccess(
  request: FastifyRequest,
  moduleCode: string,
): Promise<boolean> {
  const user = (request as any).user
  if (!user) return false
  if (user.role === 'super_admin') return true

  const access = await resolveAccess({
    userId: user.id,
    role: user.role,
    userType: user.userType,
    tenantId: user.tenantId,
  })

  const platformCode =
    (request.query as any)?.platform ||
    (request.headers['x-leyova-platform'] as string | undefined) ||
    null

  return canAccessModule(access, platformCode, moduleCode)
}

/** 仅供审计/排查：导出映射表 */
export function getModuleMapForAudit(): ReadonlyArray<{ prefix: string; module: string }> {
  return MODULE_MAP
}
