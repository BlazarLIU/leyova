/**
 * catalog/types.ts — 系统级指标与维度类型契约定义
 */

export type FactSource = 'trade' | 'traffic' | 'ad' | 'content' | 'session'

export type Granularity = 'hour' | 'day' | 'week' | 'month' | 'total'

export interface MetricDefinition {
  code: string
  name: string
  unit: string
  category: 'trade' | 'traffic' | 'ad' | 'aftersale' | 'content'
  expr: string
  factTable: FactSource
  isAdditive: boolean
  caliber?: string
  version?: string
  status?: string
  description?: string
  extra?: Record<string, any>
}

export interface DimensionDefinition {
  code: string
  name: string
  expr: string
  description?: string
}

export interface QueryScope {
  tenantId?: number
  allowedPlatforms?: string[] | null // null 表示全平台 (管理员)
  allowedShopIds?: number[] | null   // null 表示全店铺 (管理员)
}

export interface MetricAccessOptions {
  role?: string | null
  userType?: string | null
  allowAdSpend?: boolean
}
