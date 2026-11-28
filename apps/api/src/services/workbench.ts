/**
 * workbench.ts — 角色工作台（W2.5）
 *
 * 工作台是「配置驱动」的：库里存布局（role_workbenches + workbench_widgets），
 * 服务端按用户真实权限过滤后返回，前端只渲染服务端给的 widget，不自行判断。
 *
 * 过滤规则（L1/L3/L4 在数据侧的统一表达）：
 *   1. widget 必须 enabled；
 *   2. module_code 为空 → 公共 widget（如「我的排班」），保留；
 *   3. module_code 已授权 → 保留；
 *   4. ai_* 子模块：拥有父模块 ai 时视为已授权（兼容旧角色）。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { resolveAccess, type ResolvedAccess } from '../lib/access-resolver.js'
import { requireTenantId } from '../lib/tenant-context.js'

export interface WorkbenchWidget {
  id: string
  widgetKey: string
  title: string
  description: string | null
  moduleCode: string | null
  route: string | null
  permission: string | null
  widgetType: 'link' | 'metric' | 'action' | 'list' | 'ai'
  size: 'sm' | 'md' | 'lg' | 'full'
  sortOrder: number
  config: Record<string, unknown>
}

export interface WorkbenchPayload {
  /** 命中的角色工作台；未配置时为 null，前端展示模块入口兜底 */
  workbench: {
    roleKey: string
    variant: string
    name: string
    description: string | null
  } | null
  dataScope: ResolvedAccess['dataScope']
  modules: string[]
  platforms: string[] | null
  widgets: WorkbenchWidget[]
}

export interface WorkbenchUser {
  userId: number
  role: string
  userType?: string | null
  tenantId?: number | null
}

/** widget 是否对当前权限可见 */
export function isWidgetVisible(access: ResolvedAccess, moduleCode: string | null): boolean {
  if (!moduleCode) return true
  if (access.modules.has(moduleCode)) return true
  if (moduleCode.startsWith('ai_') && access.modules.has('ai')) return true
  return false
}

export async function getWorkbenchForUser(
  user: WorkbenchUser,
  executor?: DbExecutor,
): Promise<WorkbenchPayload> {
  const pool = executor || getPool()
  const access = await resolveAccess(user, pool)
  const tenantId = requireTenantId(user.tenantId, 'services.workbench')

  const wbRes = await pool.query(
    `SELECT id, role_key, variant, name, description
       FROM public.role_workbenches
      WHERE tenant_id = $1 AND role_key = $2 AND is_default = true
      ORDER BY (variant = 'default') DESC, created_at ASC
      LIMIT 1`,
    [tenantId, user.role],
  )

  const wb = wbRes.rows[0]
  if (!wb) {
    return {
      workbench: null,
      dataScope: access.dataScope,
      modules: Array.from(access.modules).sort(),
      platforms: access.platforms === null ? null : Array.from(access.platforms).sort(),
      widgets: [],
    }
  }

  const widgetRes = await pool.query(
    `SELECT id, widget_key, title, description, module_code, route, permission,
            widget_type, size, sort_order, config
       FROM public.workbench_widgets
      WHERE workbench_id = $1 AND enabled = true
      ORDER BY sort_order ASC, title ASC`,
    [wb.id],
  )

  const widgets: WorkbenchWidget[] = widgetRes.rows
    .filter((r: any) => isWidgetVisible(access, r.module_code))
    .map((r: any) => ({
      id: r.id,
      widgetKey: r.widget_key,
      title: r.title,
      description: r.description,
      moduleCode: r.module_code,
      route: r.route,
      permission: r.permission,
      widgetType: r.widget_type,
      size: r.size,
      sortOrder: r.sort_order,
      config: r.config || {},
    }))

  return {
    workbench: {
      roleKey: wb.role_key,
      variant: wb.variant,
      name: wb.name,
      description: wb.description,
    },
    dataScope: access.dataScope,
    modules: Array.from(access.modules).sort(),
    platforms: access.platforms === null ? null : Array.from(access.platforms).sort(),
    widgets,
  }
}
