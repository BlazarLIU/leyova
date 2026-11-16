/**
 * query/primitives.ts — 系统级 5 大核心取数原语实现
 *
 * 1. queryMetric: 单指标/多指标区间聚合查询
 * 2. comparePeriods: 同比 / 环比分析与差异率计算
 * 3. drillDown: 单指标多维下钻排行
 * 4. detectAnomalies: 异常波动自动打标检测
 * 5. forecastTrend: 基于历史时序的移动平滑趋势预测
 */

import type { DbExecutor } from '../lib/db.js'
import { getPool } from '../lib/db.js'
import type { QueryScope, MetricAccessOptions } from '../catalog/types.js'
import { SYSTEM_METRICS } from '../catalog/index.js'
import { buildSafeQuery, resolveFactSource, getFactTableName } from './query-builder.js'
import type {
  QueryMetricInput,
  ComparePeriodsInput,
  DrillDownInput,
  DetectAnomaliesInput,
  ForecastTrendInput,
  MetricQueryResult,
} from './types.js'

/**
 * 原语 1: queryMetric
 */
export async function queryMetric(
  executor: DbExecutor | undefined,
  input: QueryMetricInput,
  scope?: QueryScope,
  access?: MetricAccessOptions,
): Promise<MetricQueryResult> {
  const db = executor || getPool()
  const { sql, params, metrics, dimensions } = buildSafeQuery(input, scope, access)
  const { rows } = await db.query(sql, params)
  return {
    metrics,
    dimensions,
    count: rows.length,
    rows,
  }
}

/**
 * 原语 2: comparePeriods
 */
export async function comparePeriods(
  executor: DbExecutor | undefined,
  input: ComparePeriodsInput,
  scope?: QueryScope,
  access?: MetricAccessOptions,
): Promise<{
  current: Record<string, number>
  previous: Record<string, number>
  changePct: Record<string, number>
}> {
  const currentRes = await queryMetric(
    executor,
    {
      metrics: input.metrics,
      startDate: input.currentStartDate,
      endDate: input.currentEndDate,
      platforms: input.platforms,
      shopIds: input.shopIds,
    },
    scope,
    access,
  )

  const previousRes = await queryMetric(
    executor,
    {
      metrics: input.metrics,
      startDate: input.previousStartDate,
      endDate: input.previousEndDate,
      platforms: input.platforms,
      shopIds: input.shopIds,
    },
    scope,
    access,
  )

  const current = (currentRes.rows[0] as Record<string, any>) || {}
  const previous = (previousRes.rows[0] as Record<string, any>) || {}

  const currentValues: Record<string, number> = {}
  const previousValues: Record<string, number> = {}
  const changePct: Record<string, number> = {}

  for (const met of input.metrics) {
    const curVal = Number(current[met] || 0)
    const prevVal = Number(previous[met] || 0)
    currentValues[met] = curVal
    previousValues[met] = prevVal

    if (prevVal === 0) {
      changePct[met] = curVal === 0 ? 0 : 100
    } else {
      changePct[met] = Number((((curVal - prevVal) / prevVal) * 100).toFixed(2))
    }
  }

  return {
    current: currentValues,
    previous: previousValues,
    changePct,
  }
}

/**
 * 原语 3: drillDown
 */
export async function drillDown(
  executor: DbExecutor | undefined,
  input: DrillDownInput,
  scope?: QueryScope,
  access?: MetricAccessOptions,
): Promise<{
  metric: string
  dimension: string
  items: Array<{ key: string | number; value: number; sharePct?: number }>
}> {
  const res = await queryMetric(
    executor,
    {
      metrics: [input.metric],
      dimensions: [input.dimension],
      startDate: input.startDate,
      endDate: input.endDate,
      platforms: input.platforms,
      shopIds: input.shopIds,
      limit: input.limit || 20,
    },
    scope,
    access,
  )

  let total = 0
  const items = res.rows.map((row: any) => {
    const val = Number(row[input.metric] || 0)
    total += val
    return {
      key: row[input.dimension],
      value: val,
    }
  })

  // 按值从大到小排序并算占比
  items.sort((a, b) => b.value - a.value)
  const itemsWithShare = items.map((item) => ({
    ...item,
    sharePct: total > 0 ? Number(((item.value / total) * 100).toFixed(2)) : 0,
  }))

  return {
    metric: input.metric,
    dimension: input.dimension,
    items: itemsWithShare,
  }
}

/**
 * 原语 4: detectAnomalies
 */
export async function detectAnomalies(
  executor: DbExecutor | undefined,
  input: DetectAnomaliesInput,
  scope?: QueryScope,
  access?: MetricAccessOptions,
): Promise<
  Array<{
    date: string
    value: number
    mean: number
    diffPct: number
    isAnomaly: boolean
    direction: 'up' | 'down' | 'normal'
  }>
> {
  const res = await queryMetric(
    executor,
    {
      metrics: [input.metric],
      dimensions: ['date'],
      startDate: input.startDate,
      endDate: input.endDate,
      platforms: input.platforms,
      shopIds: input.shopIds,
    },
    scope,
    access,
  )

  const rows = res.rows.map((r: any) => ({
    date: String(r.date).slice(0, 10),
    value: Number(r[input.metric] || 0),
  }))

  if (rows.length === 0) return []

  const sum = rows.reduce((acc, cur) => acc + cur.value, 0)
  const mean = sum / rows.length
  const threshold = input.thresholdPct || 25

  return rows.map((r) => {
    const diffPct = mean > 0 ? Number((((r.value - mean) / mean) * 100).toFixed(2)) : 0
    const isAnomaly = Math.abs(diffPct) >= threshold
    const direction = diffPct > threshold ? 'up' : diffPct < -threshold ? 'down' : 'normal'
    return {
      date: r.date,
      value: r.value,
      mean: Number(mean.toFixed(2)),
      diffPct,
      isAnomaly,
      direction,
    }
  })
}

/**
 * 原语 5: forecastTrend
 */
export async function forecastTrend(
  executor: DbExecutor | undefined,
  input: ForecastTrendInput,
  scope?: QueryScope,
  access?: MetricAccessOptions,
): Promise<{
  history: Array<{ date: string; value: number }>
  forecast: Array<{ date: string; forecastValue: number }>
}> {
  const res = await queryMetric(
    executor,
    {
      metrics: [input.metric],
      dimensions: ['date'],
      startDate: input.startDate,
      endDate: input.endDate,
      platforms: input.platforms,
      shopIds: input.shopIds,
    },
    scope,
    access,
  )

  const history = res.rows.map((r: any) => ({
    date: String(r.date).slice(0, 10),
    value: Number(r[input.metric] || 0),
  }))

  if (history.length === 0) {
    return { history: [], forecast: [] }
  }

  // 移动平均简单外推
  const recentWindow = history.slice(-7)
  const avg = recentWindow.reduce((a, b) => a + b.value, 0) / (recentWindow.length || 1)
  const lastDate = new Date(history[history.length - 1].date)
  const periods = input.periods || 7

  const forecast: Array<{ date: string; forecastValue: number }> = []
  for (let i = 1; i <= periods; i++) {
    const nextDate = new Date(lastDate)
    nextDate.setDate(lastDate.getDate() + i)
    forecast.push({
      date: nextDate.toISOString().slice(0, 10),
      forecastValue: Number(avg.toFixed(2)),
    })
  }

  return { history, forecast }
}
