/**
 * 全站唯一角色字典（P0-2）
 *
 * 与数据库 `roles` 表保持一致：2026-11-24 组织收敛后仅存 6 个角色。
 * 任何页面 / 权限守卫都必须从这里取角色码，禁止再写 'admin' / 'operator' /
 * 'finance' / 'employee' 等 DB 中不存在的幽灵角色。
 * 需要其他岗位的用户去「角色管理」页自建。
 */

export const ROLE_CODES = [
  'super_admin',
  'ops_director',
  'ops_staff',
  'ad_buyer',
  'controller',
  'hrbp',
] as const

export type RoleCode = (typeof ROLE_CODES)[number]

export const ROLE_LABELS: Record<RoleCode, string> = {
  super_admin: '👑 系统管理员',
  ops_director: '🧭 运营总监',
  ops_staff: '📋 运营专员',
  ad_buyer: '🎯 投放专员',
  controller: '🎛️ 直播中控',
  hrbp: '👥 HRBP',
}

export const ROLE_BADGE_VARIANTS: Record<RoleCode, 'danger' | 'warning' | 'success' | 'info' | 'neutral'> = {
  super_admin: 'danger',
  ops_director: 'warning',
  ops_staff: 'info',
  ad_buyer: 'info',
  controller: 'neutral',
  hrbp: 'success',
}

/** 账号创建 / 编辑下拉可选项（顺序固定） */
export const ROLE_OPTIONS = ROLE_CODES.map((code) => ({
  code,
  label: ROLE_LABELS[code],
}))

/** 可进入 AI 运营系统分支的岗位 */
export const AI_OPS_ROLES: RoleCode[] = [
  'super_admin',
  'ops_director',
  'ops_staff',
  'ad_buyer',
  'controller',
  'hrbp',
]

/**
 * 财务机密板块（P&L / 结算对账 / 人效财务计算）
 *
 * 组织决策：系统不设独立财务角色；财务口径对运营总监与 HRBP（人效核算）开放。
 */
export const FINANCE_ROLES: RoleCode[] = ['super_admin', 'ops_director', 'hrbp']

export function isRoleCode(value: string | null | undefined): value is RoleCode {
  return !!value && (ROLE_CODES as readonly string[]).includes(value)
}

export function roleLabel(code: string | null | undefined): string {
  if (!code) return ''
  return (ROLE_LABELS as Record<string, string>)[code] || code
}
