/**
 * query/query-builder.ts — 参数化 SQL 构建器（白名单 + 权限范围约束）
 */

import { SYSTEM_METRICS, SYSTEM_DIMENSIONS } from '../catalog/index.js'
import type { FactSource, QueryScope, MetricAccessOptions } from '../catalog/types.js'
import type { QueryMetricInput } from './types.js'
import { canAccessAdSpend } from '../lib/guard.js'

export function resolveFactSource(metrics: string[]): FactSource {
  for (const m of metrics) {
    const def = SYSTEM_METRICS[m]
    if (def?.factTable === 'ad') return 'ad'
    if (def?.factTable === 'traffic') return 'traffic'
  }
  return 'trade'
}

export function getFactTableName(source: FactSource): string {
  switch (source) {
    case 'trade':
      // 必须走默认成交口径视图，杜绝同一业务键多 amount_type 并存引发 2.4x 放大
      return 'v_fact_trade_default'
    case 'traffic':
      return 'fact_traffic_daily'
    case 'ad':
      return 'fact_ad_spend_daily'
    case 'content':
      return 'fact_content_daily'
    default:
      return 'v_fact_trade_default'
  }
}

export function buildSafeQuery(
  input: QueryMetricInput,
  scope?: QueryScope,
  access?: MetricAccessOptions,
): { sql: string; params: any[]; metrics: string[]; dimensions: string[] } {
  const validMetrics = (input.metrics || []).filter((m) => m in SYSTEM_METRICS)
  if (validMetrics.length === 0) {
    throw new Error(`未指定合法指标。可用指标: ${Object.keys(SYSTEM_METRICS).join(', ')}`)
  }

  // 敏感指标鉴权检查（投流与ROI）
  const hasAdMetric = validMetrics.some((m) => SYSTEM_METRICS[m].factTable === 'ad')
  if (hasAdMetric && access && !canAccessAdSpend({ role: access.role, userType: access.userType })) {
    throw new Error('当前角色无权查询商业化投流与 ROI 敏感数据')
  }

  const validDimensions = (input.dimensions || []).filter((d) => d in SYSTEM_DIMENSIONS)
  const source = resolveFactSource(validMetrics)
  const tableName = getFactTableName(source)

  const selectCols: string[] = []
  const groupCols: string[] = []

  // 1. 维度投影
  for (const dim of validDimensions) {
    const def = SYSTEM_DIMENSIONS[dim]
    selectCols.push(`${def.expr} AS "${dim}"`)
    groupCols.push(def.expr)
  }

  // 2. 指标投影
  for (const met of validMetrics) {
    const def = SYSTEM_METRICS[met]
    selectCols.push(`${def.expr} AS "${met}"`)
  }

  // 3. WHERE 过滤条件与参数化
  const conditions: string[] = []
  const params: any[] = []
  let paramIdx = 1

  // 日期范围过滤
  if (input.startDate) {
    conditions.push(`f.biz_date >= $${paramIdx++}::date`)
    params.push(input.startDate)
  }
  if (input.endDate) {
    conditions.push(`f.biz_date <= $${paramIdx++}::date`)
    params.push(input.endDate)
  }

  // 平台过滤（交集验证）
  let targetPlatforms = input.platforms
  if (scope?.allowedPlatforms) {
    targetPlatforms = targetPlatforms
      ? targetPlatforms.filter((p) => scope.allowedPlatforms!.includes(p))
      : scope.allowedPlatforms
  }
  if (targetPlatforms && targetPlatforms.length > 0) {
    conditions.push(`f.platform_code = ANY($${paramIdx++}::text[])`)
    params.push(targetPlatforms)
  }

  // 店铺过滤
  let targetShopIds = input.shopIds
  if (scope?.allowedShopIds) {
    targetShopIds = targetShopIds
      ? targetShopIds.filter((s) => scope.allowedShopIds!.includes(s))
      : scope.allowedShopIds
  }
  if (targetShopIds && targetShopIds.length > 0) {
    conditions.push(`f.shop_id = ANY($${paramIdx++}::bigint[])`)
    params.push(targetShopIds)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const groupByClause = groupCols.length > 0 ? `GROUP BY ${groupCols.join(', ')}` : ''
  const orderByClause = validDimensions.length > 0 ? `ORDER BY "${validDimensions[0]}" ASC` : ''

  let limitClause = ''
  if (input.limit && input.limit > 0) {
    limitClause = `LIMIT $${paramIdx++}`
    params.push(input.limit)
    if (input.offset && input.offset > 0) {
      limitClause += ` OFFSET $${paramIdx++}`
      params.push(input.offset)
    }
  }

  const sql = `
    SELECT ${selectCols.join(', ')}
    FROM ${tableName} f
    ${whereClause}
    ${groupByClause}
    ${orderByClause}
    ${limitClause}
  `.trim()

  return { sql, params, metrics: validMetrics, dimensions: validDimensions }
}
