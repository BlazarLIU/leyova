/**
 * query/types.ts — 取数原语输入与输出类型契约
 */

import type { FactSource, Granularity, QueryScope, MetricAccessOptions } from '../catalog/types.js'

export interface QueryMetricInput {
  metrics: string[]
  dimensions?: string[]
  startDate?: string
  endDate?: string
  platforms?: string[]
  shopIds?: number[]
  granularity?: Granularity
  limit?: number
  offset?: number
}

export interface ComparePeriodsInput {
  metrics: string[]
  currentStartDate: string
  currentEndDate: string
  previousStartDate: string
  previousEndDate: string
  platforms?: string[]
  shopIds?: number[]
}

export interface DrillDownInput {
  metric: string
  dimension: string
  startDate?: string
  endDate?: string
  platforms?: string[]
  shopIds?: number[]
  limit?: number
}

export interface DetectAnomaliesInput {
  metric: string
  dimension?: string
  startDate?: string
  endDate?: string
  thresholdPct?: number // 异常波动比例阈值，如 20 表示波动超过 20% 告警
  platforms?: string[]
  shopIds?: number[]
}

export interface ForecastTrendInput {
  metric: string
  startDate?: string
  endDate?: string
  periods?: number // 预测未来期数（默认 7 天）
  platforms?: string[]
  shopIds?: number[]
}

export interface MetricQueryResult<T = any> {
  metrics: string[]
  dimensions: string[]
  count: number
  rows: T[]
  meta?: Record<string, any>
}
