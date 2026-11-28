/**
 * 统一指标口径服务
 *
 * 1. 集中计算退款率等易产生跨模块口径漂移的衍生指标，避免各路由各自写百分比公式与小数位规则。
 * 2. 读取 `metric_definition` 与 `system_config`，使语义层与 AI 结论阈值以数据库配置为单一事实源。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { canAccessAdSpend } from '../lib/guard.js'

export interface MetricDefinitionRecord {
  id: number
  code: string
  name: string
  unit: string
  category: string
  formula: string | null
  description: string | null
  supportedPlatforms: string[]
  isAdditive: boolean
  extra: Record<string, any>
}

export interface MetricCatalogAccess {
  role?: string | null
  userType?: string | null
}

/**
 * 金额口径退款率 = refund_amount / gmv * 100
 */
export function computeRefundRatePct(
  refundAmount: number,
  gmv: number,
  decimals = 2,
): number {
  const safeRefund = Number(refundAmount || 0)
  const safeGmv = Number(gmv || 0)
  if (!Number.isFinite(safeRefund) || !Number.isFinite(safeGmv) || safeGmv <= 0) {
    return 0
  }
  return Number(((safeRefund / safeGmv) * 100).toFixed(decimals))
}

/**
 * 订单口径退款率（按成单口径计算）= refund_orders / total_orders * 100
 */
export function computeOrderRefundRatePct(
  refundOrders: number,
  totalOrders: number,
  decimals = 2,
): number {
  const safeRefundOrders = Number(refundOrders || 0)
  const safeTotalOrders = Number(totalOrders || 0)
  if (!Number.isFinite(safeRefundOrders) || !Number.isFinite(safeTotalOrders) || safeTotalOrders <= 0) {
    return 0
  }
  return Number(((safeRefundOrders / safeTotalOrders) * 100).toFixed(decimals))
}

/**
 * 读取数据库 `metric_definition` 指标口径目录，并按角色过滤敏感分类（如 ad）。
 */
export async function listMetricDefinitions(
  executor?: DbExecutor,
  access?: MetricCatalogAccess,
): Promise<MetricDefinitionRecord[]> {
  const db = executor || getPool()
  const { rows } = await db.query(
    `SELECT id, metric_code, name, unit, category, formula, description,
            supported_platforms, is_additive, extra
       FROM metric_definition
      ORDER BY id ASC`,
  )

  const allowAd = access ? canAccessAdSpend(access) : true
  return rows
    .filter((r: any) => allowAd || r.category !== 'ad')
    .map((r: any) => ({
      id: Number(r.id),
      code: r.metric_code,
      name: r.name,
      unit: r.unit || '',
      category: r.category || 'trade',
      formula: r.formula ?? null,
      description: r.description ?? null,
      supportedPlatforms: Array.isArray(r.supported_platforms) ? r.supported_platforms : [],
      isAdditive: Boolean(r.is_additive),
      extra: (r.extra && typeof r.extra === 'object') ? r.extra : {},
    }))
}

/**
 * 从 `system_config` 读取全局退款率预警水位（默认 10%）。
 */
export async function getRefundRateWarningPct(
  executor?: DbExecutor,
  defaultValue = 10,
): Promise<number> {
  const db = executor || getPool()
  try {
    const { rows } = await db.query(
      `SELECT config_value
         FROM system_config
        WHERE config_key = 'refund_rate_warning_pct'
        LIMIT 1`,
    )
    const raw = rows[0]?.config_value
    const parsed = raw !== undefined && raw !== null ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
  } catch {
    return defaultValue
  }
}

