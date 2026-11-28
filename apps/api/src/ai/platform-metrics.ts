/**
 * platform-metrics.ts — 平台专属指标注册（阶段 D1）
 *
 * 把各平台独有的指标注册进语义层，让 AI 助手能回答平台特有问题：
 *   - 抖音：短视频引流、三池调度
 *   - 快手：间接成交、关注页/发现页成交、粉丝团入团率
 *   - 视频号：公私域转化、社交裂变
 *
 * 设计：
 *   - 这些指标只对特定平台有效，查询时若平台不匹配则返回空
 *   - 每张平台扩展表单独作为一个 FactSource
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { canAccessCost } from '../lib/guard.js'

// 成本敏感指标集合：当前没有需要按平台单独脱敏的成本类指标
const COST_SENSITIVE_PLATFORM_METRICS = new Set<string>([])

export interface PlatformAccessOptions {
  role?: string | null
  userType?: string | null
  allowCost?: boolean
}

function isCostAccessAllowed(access?: PlatformAccessOptions): boolean {
  if (!access) return true
  if (access.allowCost !== undefined) return Boolean(access.allowCost)
  if (access.role !== undefined || access.userType !== undefined) {
    return canAccessCost({ role: access.role, userType: access.userType })
  }
  return true
}

/** 平台扩展事实表 */
export type PlatformFactSource =
  | 'ks_fans'

export interface PlatformMetricDef {
  code: string
  label: string
  unit: string
  expr: string
  source: PlatformFactSource
  /** 只对该平台有效 */
  platformScope: string[]
  additive: boolean
  description?: string
}

export const PLATFORM_METRIC_REGISTRY: Record<string, PlatformMetricDef> = {
  // ── 快手：私域 ──
  ks_private_gmv: {
    code: 'ks_private_gmv', label: '关注页成交(私域)', unit: '元',
    expr: `COALESCE(SUM(follow_page_gmv), 0)::numeric`,
    source: 'ks_fans', platformScope: ['kuaishou'], additive: true,
  },
  ks_public_gmv: {
    code: 'ks_public_gmv', label: '发现页成交(公域)', unit: '元',
    expr: `COALESCE(SUM(discover_page_gmv), 0)::numeric`,
    source: 'ks_fans', platformScope: ['kuaishou'], additive: true,
  },
  ks_private_ratio: {
    code: 'ks_private_ratio', label: '私域成交占比', unit: '%',
    expr: `CASE WHEN SUM(follow_page_gmv + discover_page_gmv + other_gmv) > 0
            THEN ROUND(SUM(follow_page_gmv)::numeric
                 / SUM(follow_page_gmv + discover_page_gmv + other_gmv) * 100, 2) ELSE 0 END`,
    source: 'ks_fans', platformScope: ['kuaishou'], additive: false,
    description: '快手最关键的经营健康度指标',
  },
  ks_indirect_gmv: {
    code: 'ks_indirect_gmv', label: '间接成交金额', unit: '元',
    expr: `COALESCE(SUM(indirect_gmv), 0)::numeric`,
    source: 'ks_fans', platformScope: ['kuaishou'], additive: true,
    description: '点击广告未直接转化，当天内经其他渠道再次触达成交（快手独有）',
  },
  ks_indirect_ratio: {
    code: 'ks_indirect_ratio', label: '间接成交占比', unit: '%',
    expr: `CASE WHEN SUM(direct_gmv + indirect_gmv) > 0
            THEN ROUND(SUM(indirect_gmv)::numeric / SUM(direct_gmv + indirect_gmv) * 100, 2) ELSE 0 END`,
    source: 'ks_fans', platformScope: ['kuaishou'], additive: false,
  },
  ks_fans_team_joiners: {
    code: 'ks_fans_team_joiners', label: '粉丝团新增', unit: '人',
    expr: `COALESCE(SUM(fans_team_joiners), 0)::int`,
    source: 'ks_fans', platformScope: ['kuaishou'], additive: true,
  },
  ks_fans_join_rate: {
    code: 'ks_fans_join_rate', label: '入团率', unit: '%',
    expr: `CASE WHEN SUM(new_followers) > 0
            THEN ROUND(SUM(fans_team_joiners)::numeric / SUM(new_followers) * 100, 2) ELSE 0 END`,
    source: 'ks_fans', platformScope: ['kuaishou'], additive: false,
  },
}

/** 平台扩展表名映射 */
export const PLATFORM_FACT_TABLE: Record<PlatformFactSource, string> = {
  ks_fans: 'kuaishou_fans_ops',
}

/** 判断指标是否适用于该平台 */
export function isPlatformMetricApplicable(code: string, platformCode: string): boolean {
  const def = PLATFORM_METRIC_REGISTRY[code]
  if (!def) return false
  return def.platformScope.includes(platformCode)
}

/** 列出某平台可用的专属指标 */
export function listPlatformMetrics(platformCode: string, access?: PlatformAccessOptions): PlatformMetricDef[] {
  const allowCost = isCostAccessAllowed(access)
  return Object.values(PLATFORM_METRIC_REGISTRY)
    .filter((m) => m.platformScope.includes(platformCode) && (allowCost || !COST_SENSITIVE_PLATFORM_METRICS.has(m.code)))
}

export interface PlatformQueryInput {
  metrics: string[]
  timeRange: { from: string; to: string }
  platformCode: string
  shopId?: number
}

export interface PlatformQueryResult {
  platformCode: string
  sourceTable: string
  columns: string[]
  rows: Array<Record<string, any>>
  sqlSnapshot: string
  warnings: string[]
}

/**
 * 查询平台专属指标。
 * 只允许查询该平台适用的指标，不适用则跳过并给出警告。
 */
export async function queryPlatformMetrics(
  input: PlatformQueryInput,
  pool?: DbExecutor,
  access?: PlatformAccessOptions,
): Promise<PlatformQueryResult> {
  const p = pool || getPool()
  const warnings: string[] = []
  const allowCost = isCostAccessAllowed(access)

  const applicable = input.metrics.filter((m) => {
    const def = PLATFORM_METRIC_REGISTRY[m]
    if (!def) {
      warnings.push(`未识别的平台指标：${m}`)
      return false
    }
    if (!def.platformScope.includes(input.platformCode)) {
      warnings.push(`指标 ${m}(${def.label}) 不适用于平台 ${input.platformCode}，已跳过`)
      return false
    }
    if (!allowCost && COST_SENSITIVE_PLATFORM_METRICS.has(m)) {
      warnings.push(`指标 ${m}(${def.label}) 涉及成本/毛利敏感数据，当前角色无权查看`)
      return false
    }
    return true
  })

  if (applicable.length === 0) {
    return {
      platformCode: input.platformCode,
      sourceTable: '',
      columns: [],
      rows: [],
      sqlSnapshot: '',
      warnings,
    }
  }

  // 同一次查询的指标必须来自同一张表
  const sources = new Set(applicable.map((m) => PLATFORM_METRIC_REGISTRY[m].source))
  const primarySource = Array.from(sources)[0]
  if (sources.size > 1) {
    warnings.push(`所选指标跨多张平台表，本次仅查询 ${primarySource}`)
  }

  const sameSource = applicable.filter((m) => PLATFORM_METRIC_REGISTRY[m].source === primarySource)
  const table = PLATFORM_FACT_TABLE[primarySource]

  const selectParts = sameSource.map((m) => {
    const def = PLATFORM_METRIC_REGISTRY[m]
    return `${def.expr} AS ${m}`
  })

  // 平台扩展表本身就是平台专属的，部分表没有 platform_code 字段
  const TABLES_WITH_PLATFORM_CODE: PlatformFactSource[] = []

  const params: any[] = [input.timeRange.from, input.timeRange.to]
  let sql = `SELECT ${selectParts.join(',\n           ')}
      FROM ${table}
     WHERE biz_date BETWEEN $1::date AND $2::date`

  if (TABLES_WITH_PLATFORM_CODE.includes(primarySource)) {
    params.push(input.platformCode)
    sql += ` AND platform_code = $${params.length}`
  }

  if (input.shopId) {
    params.push(input.shopId)
    sql += ` AND shop_id = $${params.length}`
  }

  const { rows } = await p.query(sql, params)

  const out = rows.map((r: any) => {
    const o: Record<string, any> = {}
    for (const k of Object.keys(r)) {
      const v = r[k]
      o[k] = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v
    }
    return o
  })

  return {
    platformCode: input.platformCode,
    sourceTable: table,
    columns: sameSource,
    rows: out,
    sqlSnapshot: sql.replace(/\s+/g, ' ').trim(),
    warnings,
  }
}
