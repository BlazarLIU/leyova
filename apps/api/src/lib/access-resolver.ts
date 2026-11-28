/**
 * access-resolver.ts — 统一权限解析器
 *
 * 取代原来分散的 `getUserAllowedPlatforms` + `role_modules` 两套独立读取逻辑。
 *
 * 2026-11-14（S3）：取消「代运营 / 品牌自播 / 全功能」三种工作模式，权限模型归一。
 *
 * 解析优先级（从高到低）：
 *   1. user_module_overrides      用户级 grant / revoke，最高优先级
 *   2. role_module_grants         角色级显式 allow / deny
 *   3. role_modules               角色默认 allow 列表（向后兼容）
 *   4. platform_capability_matrix 平台能力过滤（只会「减」不会「加」）
 *
 * 最终可见模块 = (角色基线 ∪ 用户 grant) − 用户 revoke − 平台不适用
 */

import { getPool, type DbExecutor } from './db.js'

export interface ResolvedAccess {
  /** 数据可见范围 */
  dataScope: 'self' | 'team' | 'org' | 'all'
  /** 该用户可见模块（未按平台过滤） */
  modules: Set<string>
  /** 平台 code → 该平台下可用的模块集合 */
  modulesByPlatform: Map<string, Set<string>>
  /** 该用户可见的平台（null = 全部） */
  platforms: Set<string> | null
  /** 全局停用的模块（对所有角色含超管都不可见，仅超管可在模块管理页开关） */
  disabledModules: Set<string>
}

interface ResolveInput {
  userId: number
  role: string
  userType?: string | null
  tenantId?: number | null
}

/**
 * 解析用户的完整访问权限。
 * 只读查询，可安全并发调用。
 */
export async function resolveAccess(
  input: ResolveInput,
  pool?: DbExecutor,
): Promise<ResolvedAccess> {
  const p = pool || getPool()

  // ── 1. 数据范围 ──
  const userRow = await p.query(
    `SELECT data_scope FROM public.users WHERE id = $1`,
    [input.userId],
  )
  const dataScope = (userRow.rows[0]?.data_scope || 'self') as ResolvedAccess['dataScope']

  // ── 2. 角色基线模块（统一自 sys_role_permission，保留旧表兼容回退） ──
  let grantRows: Array<{ module_code: string; effect: string }> = []
  const permRes = await p.query(
    `SELECT substring(resource from 8) AS module_code, effect 
       FROM public.sys_role_permission 
      WHERE role_code = $1 AND resource LIKE 'module:%'`,
    [input.role],
  )

  if (permRes.rows.length > 0) {
    grantRows = permRes.rows
  } else {
    const grantRes = await p.query(
      `SELECT module_code, effect FROM public.role_module_grants WHERE role_code = $1`,
      [input.role],
    )
    if (grantRes.rows.length > 0) {
      grantRows = grantRes.rows
    } else {
      const fallback = await p.query(
        `SELECT module_code FROM public.role_modules WHERE role_code = $1`,
        [input.role],
      )
      grantRows = fallback.rows.map((r: any) => ({ module_code: r.module_code, effect: 'allow' }))
    }
  }

  const baseline = new Set<string>()
  const denied = new Set<string>()

  for (const r of grantRows) {
    if (r.effect === 'allow') baseline.add(r.module_code)
    else if (r.effect === 'deny') denied.add(r.module_code)
  }

  // ── 3. 用户级覆盖（最高优先级） ──
  const overrideRes = await p.query(
    `SELECT module_code, effect FROM public.user_module_overrides WHERE user_id = $1`,
    [input.userId],
  )
  for (const r of overrideRes.rows) {
    if (r.effect === 'grant') baseline.add(r.module_code)
    else if (r.effect === 'revoke') denied.add(r.module_code)
  }

  const effectiveModules = new Set([...baseline].filter((m) => !denied.has(m)))

  // ── 3.5 模块热插拔：全局停用模块对所有角色（含超管）一律不可见 ──
  //   注意：仅影响「可见性/访问」，不影响数据表与 AI 运营子系统的直接数据引用。
  const disabledRes = await p.query(
    `SELECT code FROM public.system_modules WHERE is_enabled = false`,
  )
  const disabledModules = new Set<string>(disabledRes.rows.map((r: any) => r.code))
  for (const m of disabledModules) effectiveModules.delete(m)

  // ── 4. 平台能力过滤 ──
  const platforms = await resolvePlatformsForUser(p, input)

  // platforms 为 null 表示「全部启用平台」，须展开为实际列表
  let platformList: string[]
  if (platforms === null) {
    const all = await p.query(
      `SELECT platform_code FROM public.system_platform_configs WHERE is_enabled = true`,
    )
    platformList = all.rows.map((r: any) => r.platform_code)
  } else {
    platformList = Array.from(platforms)
  }

  // 平台能力矩阵是「业务语义」而非「权限」：货架电商平台未必有直播场次概念，
  // 对 super_admin 同样不适用。所有角色走同一套过滤。
  const modulesByPlatform = new Map<string, Set<string>>()
  for (const code of platformList) {
    modulesByPlatform.set(code, new Set(effectiveModules))
  }

  if (platformList.length > 0) {
    const capRes = await p.query(
      `SELECT platform_code, module_code, is_applicable
         FROM public.platform_capability_matrix
        WHERE platform_code = ANY($1::text[])`,
      [platformList],
    )
    for (const r of capRes.rows) {
      if (r.is_applicable === false) {
        modulesByPlatform.get(r.platform_code)?.delete(r.module_code)
      }
    }
  }

  return { dataScope, modules: effectiveModules, modulesByPlatform, platforms, disabledModules }
}

/**
 * 解析用户可见平台（null = 全部）。
 * 同时供 RLS 作用域（guard.getUserAllowedPlatforms）复用，避免两套逻辑分叉。
 */
export async function resolvePlatformsForUser(
  p: DbExecutor,
  input: ResolveInput,
): Promise<Set<string> | null> {
  if (input.role === 'super_admin') return null

  if (input.userType === 'brand_viewer') {
    // 品牌方查看者：其可见平台由品牌门户授权表决定（表已随 S3 删除则退化为空集）
    const exists = await p.query(
      `SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='brand_viewer_permissions'`,
    )
    if (exists.rows.length === 0) return new Set<string>()
    const res = await p.query(
      `SELECT DISTINCT platform_code FROM public.brand_viewer_permissions WHERE user_id = $1`,
      [input.userId],
    )
    return new Set(res.rows.map((r: any) => r.platform_code))
  }

  // 用户级显式平台授权优先：管理员在用户上勾选的平台即最终可见范围，可收窄角色基线。
  // 之前与角色授权取并集，导致角色默认全平台时用户配置永远不生效。
  const userRes = await p.query(
    `SELECT upp.platform_code,
            (spc.platform_code IS NOT NULL) AS is_enabled
       FROM public.user_platform_permissions upp
       LEFT JOIN public.system_platform_configs spc
         ON spc.platform_code = upp.platform_code AND spc.is_enabled = true
      WHERE upp.user_id = $1`,
    [input.userId],
  )
  if (userRes.rows.length > 0) {
    return new Set(
      userRes.rows.filter((r: any) => r.is_enabled).map((r: any) => r.platform_code),
    )
  }

  // 用户未单独配置时使用角色基线；角色也没有平台授权则返回空集（fail-closed，不再默认给全部）
  const res = await p.query(
    `SELECT platform_code FROM (
       SELECT substring(resource from 10) AS platform_code
         FROM public.sys_role_permission
        WHERE role_code = $1 AND resource LIKE 'platform:%' AND effect = 'allow'
       UNION
       SELECT platform_code FROM public.role_platform_permissions rpp
         JOIN public.roles r ON r.id = rpp.role_id WHERE r.code = $1
     ) allowed
     WHERE EXISTS (
       SELECT 1 FROM public.system_platform_configs spc
        WHERE spc.platform_code = allowed.platform_code AND spc.is_enabled = true
     )`,
    [input.role],
  )
  return new Set(res.rows.map((r: any) => r.platform_code))
}

/** 判断某模块在某平台是否对该用户可用 */
export function canAccessModule(
  access: ResolvedAccess,
  platformCode: string | null | undefined,
  moduleCode: string,
): boolean {
  if (!access.modules.has(moduleCode)) return false
  if (!platformCode) return true
  const set = access.modulesByPlatform.get(platformCode)
  if (!set) return false
  return set.has(moduleCode)
}
