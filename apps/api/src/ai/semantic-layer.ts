/**
 * semantic-layer.ts — 指标语义层（AI 助手与 BI 共用的唯一取数入口）
 *
 * 对齐计划 5.1 / 8.4：
 *   - 只暴露受控的原语：list_metrics / list_dimensions / query_metric /
 *     compare_periods / drill_down / detect_anomalies / forecast_trend
 *   - **不生成自由 SQL**：metric_code / dimension_code 必须在注册表中，
 *     否则抛错。维度与指标都来自白名单，过滤值一律参数化。
 *   - 强制注入数据权限（平台范围），越权返回空集而非报错。
 *
 * 这是「让大模型算数」与「让数据库算数」的分界线：
 * LLM 只决定「要什么指标、按什么维度、什么时间范围」，
 * 所有数值由 PostgreSQL 聚合产生。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { canAccessAdSpend } from '../lib/guard.js'
import { listMetricDefinitions } from '../services/metrics-caliber.js'

export interface MetricAccessOptions {
  role?: string | null
  userType?: string | null
  allowAdSpend?: boolean
}

function isAdAccessAllowed(access?: MetricAccessOptions): boolean {
  if (!access) return true
  if (access.allowAdSpend !== undefined) return Boolean(access.allowAdSpend)
  if (access.role !== undefined || access.userType !== undefined) {
    return canAccessAdSpend({ role: access.role, userType: access.userType })
  }
  return true
}

// ---------------------------------------------------------------------------
// 注册表
// ---------------------------------------------------------------------------

/** 指标所属事实表 */
export type FactSource = 'trade' | 'traffic' | 'ad' | 'content'

/** 可用指标：code → 表达式（仅限已注册，禁止外部传入） */
export interface MetricDef {
  code: string
  label: string
  unit: string
  /** SQL 聚合表达式，基于别名 f（事实表） */
  expr: string
  /** 指标分类 */
  category: string
  /** 是否可加总（比率类不可） */
  additive: boolean
  /** 该指标来自哪张事实表，决定查询时 FROM 哪张表 */
  source: FactSource
}

export const METRIC_REGISTRY: Record<string, MetricDef> = {
  gmv: {
    code: 'gmv', label: '成交总额', unit: '元',
    expr: 'COALESCE(SUM(f.gmv), 0)::numeric', category: 'trade', additive: true, source: 'trade',
  },
  pay_amount: {
    code: 'pay_amount', label: '买家实付金额', unit: '元',
    expr: 'COALESCE(SUM(f.pay_amount), 0)::numeric', category: 'trade', additive: true, source: 'trade',
  },
  paid_order_count: {
    code: 'paid_order_count', label: '支付订单数', unit: '单',
    expr: 'COALESCE(SUM(f.paid_order_count), 0)::int', category: 'trade', additive: true, source: 'trade',
  },
  paid_buyer_count: {
    code: 'paid_buyer_count', label: '支付买家数', unit: '人',
    expr: 'COALESCE(SUM(f.paid_buyer_count), 0)::int', category: 'trade', additive: true, source: 'trade',
  },
  refund_amount: {
    code: 'refund_amount', label: '退款金额', unit: '元',
    expr: 'COALESCE(SUM(f.refund_amount), 0)::numeric', category: 'aftersale', additive: true, source: 'trade',
  },
  refund_count: {
    code: 'refund_count', label: '退款订单数', unit: '单',
    expr: 'COALESCE(SUM(f.refund_count), 0)::int', category: 'aftersale', additive: true, source: 'trade',
  },
  net_sales: {
    code: 'net_sales', label: '净销售额', unit: '元',
    expr: '(COALESCE(SUM(f.gmv), 0) - COALESCE(SUM(f.refund_amount), 0))::numeric',
    category: 'trade', additive: true, source: 'trade',
  },
  refund_rate: {
    code: 'refund_rate', label: '退款率', unit: '%',
    expr: 'CASE WHEN SUM(f.gmv) > 0 THEN ROUND(SUM(f.refund_amount) / SUM(f.gmv) * 100, 2) ELSE 0 END',
    category: 'aftersale', additive: false,
    source: 'trade',
  },
  avg_order_value: {
    code: 'avg_order_value', label: '客单价', unit: '元',
    expr: 'CASE WHEN SUM(f.paid_order_count) > 0 THEN ROUND(SUM(f.gmv) / SUM(f.paid_order_count), 2) ELSE 0 END',
    category: 'trade', additive: false,
    source: 'trade',
  },
  buyer_order_ratio: {
    code: 'buyer_order_ratio', label: '人均订单数', unit: '单/人',
    expr: 'CASE WHEN SUM(f.paid_buyer_count) > 0 THEN ROUND(SUM(f.paid_order_count)::numeric / SUM(f.paid_buyer_count), 2) ELSE 0 END',
    category: 'trade', additive: false,
    source: 'trade',
  },
  // ── 流量指标（fact_traffic_daily）──
  impressions: {
    code: 'impressions', label: '展现量', unit: '次',
    expr: 'COALESCE(SUM(f.impressions), 0)::bigint', category: 'traffic', additive: true, source: 'traffic',
  },
  clicks: {
    code: 'clicks', label: '点击量', unit: '次',
    expr: 'COALESCE(SUM(f.clicks), 0)::bigint', category: 'traffic', additive: true, source: 'traffic',
  },
  visitors: {
    code: 'visitors', label: '访客数', unit: '人',
    expr: 'COALESCE(SUM(f.visitors), 0)::bigint', category: 'traffic', additive: true, source: 'traffic',
  },
  ctr: {
    code: 'ctr', label: '点击率', unit: '%',
    expr: 'CASE WHEN SUM(f.impressions) > 0 THEN ROUND(SUM(f.clicks)::numeric / SUM(f.impressions) * 100, 2) ELSE 0 END',
    category: 'traffic', additive: false, source: 'traffic',
  },
  avg_stay: {
    code: 'avg_stay', label: '平均停留时长', unit: '秒',
    expr: 'CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(f.avg_stay_seconds), 0) ELSE 0 END',
    category: 'traffic', additive: false, source: 'traffic',
  },
  gpm: {
    code: 'gpm', label: '千次展现成交', unit: '元',
    expr: 'CASE WHEN SUM(f.impressions) > 0 THEN ROUND(COALESCE(SUM(tr.gmv), 0)::numeric / SUM(f.impressions) * 1000, 2) ELSE 0 END',
    category: 'traffic', additive: false, source: 'traffic',
  },

  // ── 投放指标（fact_ad_spend_daily）──
  ad_spend: {
    code: 'ad_spend', label: '投放花费', unit: '元',
    expr: 'COALESCE(SUM(f.ad_spend), 0)::numeric', category: 'ad', additive: true, source: 'ad',
  },
  ad_gmv: {
    code: 'ad_gmv', label: '投放成交额', unit: '元',
    expr: 'COALESCE(SUM(f.attributed_gross_gmv), 0)::numeric', category: 'ad', additive: true, source: 'ad',
  },
  ad_roi: {
    code: 'ad_roi', label: '投放 ROI', unit: '',
    expr: 'CASE WHEN SUM(f.ad_spend) > 0 THEN ROUND(SUM(f.attributed_gross_gmv) / SUM(f.ad_spend), 2) ELSE 0 END',
    category: 'ad', additive: false, source: 'ad',
  },
  roi: {
    code: 'roi', label: '综合投产比 (ROI)', unit: '',
    expr: 'CASE WHEN SUM(f.ad_spend) > 0 THEN ROUND(SUM(f.attributed_gross_gmv) / SUM(f.ad_spend), 2) ELSE 0 END',
    category: 'ad', additive: false, source: 'ad',
  },
  net_roi: {
    code: 'net_roi', label: '净利润投产比 (Net ROI)', unit: '',
    expr: 'CASE WHEN SUM(f.ad_spend) > 0 THEN ROUND((SUM(f.attributed_gross_gmv) - SUM(f.attributed_orders)) / SUM(f.ad_spend), 2) ELSE 0 END',
    category: 'ad', additive: false, source: 'ad',
  },
  ad_impressions: {
    code: 'ad_impressions', label: '投放展现', unit: '次',
    expr: 'COALESCE(SUM(f.impressions), 0)::bigint', category: 'ad', additive: true, source: 'ad',
  },
  ad_clicks: {
    code: 'ad_clicks', label: '投放点击', unit: '次',
    expr: 'COALESCE(SUM(f.clicks), 0)::bigint', category: 'ad', additive: true, source: 'ad',
  },
  ad_cvr: {
    code: 'ad_cvr', label: '投放转化数', unit: '次',
    expr: 'COALESCE(SUM(f.attributed_orders), 0)::int', category: 'ad', additive: true, source: 'ad',
  },

  // ── 内容指标（fact_content_daily）──
  content_views: {
    code: 'content_views', label: '内容播放量', unit: '次',
    expr: 'COALESCE(SUM(f.views), 0)::bigint', category: 'content', additive: true, source: 'content',
  },
  content_likes: {
    code: 'content_likes', label: '内容点赞数', unit: '个',
    expr: 'COALESCE(SUM(f.likes), 0)::bigint', category: 'content', additive: true, source: 'content',
  },
  content_comments: {
    code: 'content_comments', label: '内容评论数', unit: '条',
    expr: 'COALESCE(SUM(f.comments), 0)::int', category: 'content', additive: true, source: 'content',
  },
  content_shares: {
    code: 'content_shares', label: '内容分享数', unit: '次',
    expr: 'COALESCE(SUM(f.shares), 0)::int', category: 'content', additive: true, source: 'content',
  },
  content_collects: {
    code: 'content_collects', label: '内容收藏数', unit: '个',
    expr: 'COALESCE(SUM(f.collects), 0)::int', category: 'content', additive: true, source: 'content',
  },
  content_attributed_gmv: {
    code: 'content_attributed_gmv', label: '内容引流成交', unit: '元',
    expr: 'COALESCE(SUM(f.attributed_gmv), 0)::numeric', category: 'content', additive: true, source: 'content',
  },
}

/** 可用维度：code → { 列名, 连接要求 } */

/** 可用维度：code → { 列名, 连接要求 } */
export interface DimensionDef {
  code: string
  label: string
  /** 分组表达式 */
  expr: string
  /** 需要的额外 JOIN（空串表示不需要） */
  join?: string
}

export const DIMENSION_REGISTRY: Record<string, DimensionDef> = {
  date: {
    code: 'date', label: '日期',
    expr: 'f.biz_date',
  },
  platform: {
    code: 'platform', label: '平台',
    expr: 'f.platform_code',
    join: 'LEFT JOIN system_platform_configs p ON p.platform_code = f.platform_code',
  },
  platform_name: {
    code: 'platform_name', label: '平台名称',
    expr: 'p.platform_name',
    join: 'LEFT JOIN system_platform_configs p ON p.platform_code = f.platform_code',
  },
  shop: {
    code: 'shop', label: '店铺',
    expr: 's.shop_name',
    join: 'LEFT JOIN dim_shop s ON s.id = f.shop_id',
  },
  channel: {
    code: 'channel', label: '渠道',
    expr: 'f.channel_name',
  },
  source: {
    code: 'source', label: '数据来源',
    expr: 'f.source',
  },
}

/** 时间粒度 */
export type Granularity = 'day' | 'week' | 'month' | 'total'

const GRANULARITY_SQL: Record<Granularity, string> = {
  day: 'f.biz_date',
  week: "date_trunc('week', f.biz_date)::date",
  month: "date_trunc('month', f.biz_date)::date",
  total: "'ALL'::text",
}

// ---------------------------------------------------------------------------
// 权限
// ---------------------------------------------------------------------------

export interface ScopeContext {
  role?: string
  allowedPlatforms?: string[] | null // null = 全部
}

/** 解析用户可访问平台；admin/super_admin 返回 null 表示不限 */
export async function resolveScope(pool: DbExecutor, role?: string): Promise<string[] | null> {
  if (!role || role === 'super_admin') return null
  const { rows } = await pool.query(
    `SELECT rpp.platform_code
       FROM role_platform_permissions rpp
       JOIN roles r ON r.id = rpp.role_id
      WHERE r.code = $1`,
    [role],
  )
  return rows.map((r: any) => r.platform_code)
}

// ---------------------------------------------------------------------------
// 原语工具
// ---------------------------------------------------------------------------

export interface QueryMetricInput {
  metrics: string[]
  dimensions?: string[]
  filters?: {
    platform?: string
    shopId?: number
    channel?: string
    source?: string
  }
  timeRange: { from: string; to: string }
  granularity?: Granularity
  orderBy?: { metric: string; direction?: 'asc' | 'desc' }
  limit?: number
}

export interface QueryMetricResult {
  columns: string[]
  sourceTable?: string
  crossTableNotice?: string
  rows: Array<Record<string, any>>
  sql_snapshot: string
  params_snapshot: any[]
  rowCount: number
}

/** 事实表名映射 */
const FACT_TABLE: Record<FactSource, string> = {
  trade: 'fact_trade_daily',
  traffic: 'fact_traffic_daily',
  ad: 'fact_ad_spend_daily',
  content: 'fact_content_daily',
}

/**
 * 根据所选指标推断应查询的事实表。
 * 若指标来自多张表，选「主表」：优先 trade > traffic > ad > content，
 * 跨表指标组合会在下方单独处理（返回跨表提示）。
 */
function resolveSourceTable(metrics: string[]): FactSource {
  const sources = new Set<FactSource>()
  for (const m of metrics) {
    const def = METRIC_REGISTRY[m]
    if (def) sources.add(def.source)
  }
  const priority: FactSource[] = ['trade', 'traffic', 'ad', 'content']
  for (const p of priority) {
    if (sources.has(p)) return p
  }
  return 'trade'
}

/** 校验并构建查询；所有标识符来自白名单，值全部参数化 */
export function buildMetricQuery(
  input: QueryMetricInput,
  scope: string[] | null,
  access?: MetricAccessOptions,
): { sql: string; params: any[] } {
  const metrics = (input.metrics || []).filter((m) => m in METRIC_REGISTRY)
  if (metrics.length === 0) {
    throw new Error(
      `未识别的指标：${(input.metrics || []).join(', ')}。可用指标：${Object.keys(METRIC_REGISTRY).join(', ')}`,
    )
  }
  if (!isAdAccessAllowed(access) && metrics.some((m) => METRIC_REGISTRY[m].source === 'ad')) {
    throw new Error('当前角色无权查询投流消耗与 ROI 敏感指标')
  }
  const dims = (input.dimensions || []).filter((d) => d in DIMENSION_REGISTRY)
  const unknownDims = (input.dimensions || []).filter((d) => !(d in DIMENSION_REGISTRY))
  if (unknownDims.length > 0) {
    throw new Error(
      `未识别的维度：${unknownDims.join(', ')}。可用维度：${Object.keys(DIMENSION_REGISTRY).join(', ')}`,
    )
  }

  const primarySource = resolveSourceTable(metrics)
  const fromTable = FACT_TABLE[primarySource]

  const granularity: Granularity = input.granularity || (dims.includes('date') ? 'day' : 'total')

  const selectParts: string[] = []
  const groupParts: string[] = []

  // 维度
  for (const d of dims) {
    const def = DIMENSION_REGISTRY[d]
    const expr = (d === 'channel' && primarySource === 'ad') ? 'f.ad_tool_code' : def.expr
    selectParts.push(`${expr} AS ${d}`)
    groupParts.push(expr)
  }
  if (dims.includes('date') || granularity !== 'total') {
    const g = GRANULARITY_SQL[granularity]
    if (!dims.includes('date')) {
      selectParts.unshift(`${g} AS period`)
      groupParts.unshift(g)
    }
  }

  // 指标
  for (const m of metrics) {
    const def = METRIC_REGISTRY[m]
    selectParts.push(`${def.expr} AS ${m}`)
  }

  // 表与 JOIN
  const joins = new Set<string>()
  for (const d of dims) {
    const j = DIMENSION_REGISTRY[d].join
    if (j) joins.add(j)
  }
  if (metrics.includes('gpm')) {
    joins.add('LEFT JOIN v_fact_trade_default tr ON tr.biz_date = f.biz_date AND tr.platform_code = f.platform_code AND tr.shop_id = f.shop_id')
  }

  // WHERE
  const conds: string[] = []
  const params: any[] = []
  let i = 1
  conds.push(`f.biz_date BETWEEN $${i++}::date AND $${i++}::date`)
  params.push(input.timeRange.from, input.timeRange.to)

  if (scope) {
    if (scope.length === 0) {
      conds.push('false')
    } else {
      conds.push(`f.platform_code = ANY($${i++}::text[])`)
      params.push(scope)
    }
  }

  const fl = input.filters || {}
  if (fl.platform) {
    conds.push(`f.platform_code = $${i++}`)
    params.push(fl.platform)
  }
  if (fl.shopId) {
    conds.push(`f.shop_id = $${i++}`)
    params.push(fl.shopId)
  }
  if (fl.channel) {
    const channelCol = primarySource === 'ad' ? 'f.ad_tool_code' : 'f.channel_name'
    conds.push(`${channelCol} = $${i++}`)
    params.push(fl.channel)
  }
  if (fl.source) {
    conds.push(`f.source = $${i++}`)
    params.push(fl.source)
  }

  // ORDER BY
  let orderSql = ''
  if (input.orderBy && input.orderBy.metric in METRIC_REGISTRY) {
    const dir = input.orderBy.direction === 'asc' ? 'ASC' : 'DESC'
    orderSql = `ORDER BY ${input.orderBy.metric} ${dir}`
  } else if (dims.includes('date') || granularity !== 'total') {
    orderSql = `ORDER BY 1 ASC`
  }

  const limit = Math.min(Math.max(input.limit || 500, 1), 2000)

  // 按指标来源选择事实表
  const sourceFacts = new Set(metrics.map((m) => METRIC_REGISTRY[m].source))
  const crossTable = sourceFacts.size > 1

  // 跨表查询：只保留主表指标，避免不存在的列导致 SQL 报错
  let finalSelectParts = selectParts
  if (crossTable) {
    finalSelectParts = []
    for (const d of dims) {
      finalSelectParts.push(`${DIMENSION_REGISTRY[d].expr} AS ${d}`)
    }
    if (dims.includes('date') || granularity !== 'total') {
      const g = GRANULARITY_SQL[granularity]
      if (!dims.includes('date')) finalSelectParts.unshift(`${g} AS period`)
    }
    for (const m of metrics) {
      if (METRIC_REGISTRY[m].source === primarySource) {
        finalSelectParts.push(`${METRIC_REGISTRY[m].expr} AS ${m}`)
      }
    }
  }

  const sql = `
    SELECT ${finalSelectParts.join(',\n           ')}
      FROM ${fromTable} f
      ${Array.from(joins).join('\n      ')}
     WHERE ${conds.join('\n       AND ')}
     ${groupParts.length ? `GROUP BY ${groupParts.join(', ')}` : ''}
     ${orderSql}
     LIMIT ${limit}`

  return { sql, params }
}

/** 把 pg 返回的 date/Date 对象统一成 YYYY-MM-DD 字符串 */
function toDateStr(v: any): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ''
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v)
  // 已是 YYYY-MM-DD 开头则截取
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 执行受控取数 */
export async function queryMetric(
  input: QueryMetricInput,
  scope: string[] | null,
  pool?: DbExecutor,
  access?: MetricAccessOptions,
): Promise<QueryMetricResult> {
  const p = pool || getPool()
  const { sql, params } = buildMetricQuery(input, scope, access)
  const { rows } = await p.query(sql, params)
  const dims = (input.dimensions || []).filter((d) => d in DIMENSION_REGISTRY)
  const validMetrics = (input.metrics || []).filter((m) => m in METRIC_REGISTRY)
  const columns = [...dims, ...validMetrics]

  // 来源表信息（供调用方判断本次实际落在哪张事实表）
  const sourceFacts = new Set(validMetrics.map((m) => METRIC_REGISTRY[m].source))
  const crossTable = sourceFacts.size > 1
  const primarySource = resolveSourceTable(validMetrics)
  const fromTable = FACT_TABLE[primarySource]
  return {
    columns,
    sourceTable: fromTable,
    crossTableNotice: crossTable
      ? `所选指标跨多张事实表（${Array.from(sourceFacts).join(', ')}），本次仅查询 ${primarySource} 表。如需跨表分析，请分多次调用。`
      : undefined,
    rows: rows.map((r: any) => {
      const out: Record<string, any> = {}
      for (const k of Object.keys(r)) {
        const v = r[k]
        if (k === 'date' || k === 'period' || k === 'biz_date') {
          out[k] = toDateStr(v)
        } else if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
          out[k] = Number(v)
        } else {
          out[k] = v
        }
      }
      return out
    }),
    sql_snapshot: sql.replace(/\s+/g, ' ').trim(),
    params_snapshot: params,
    rowCount: rows.length,
  }
}

/** 对比两个时间段（同环比） */
export async function comparePeriods(
  input: {
    metrics: string[]
    dimensions?: string[]
    base: { from: string; to: string }
    compare: { from: string; to: string }
    filters?: QueryMetricInput['filters']
  },
  scope: string[] | null,
  pool?: DbExecutor,
  access?: MetricAccessOptions,
): Promise<{
  base: QueryMetricResult
  compare: QueryMetricResult
  changes: Array<Record<string, any>>
}> {
  const p = pool || getPool()
  const base = await queryMetric(
    { ...input, timeRange: input.base, granularity: 'total' },
    scope, p, access,
  )
  const compare = await queryMetric(
    { ...input, timeRange: input.compare, granularity: 'total' },
    scope, p, access,
  )

  const changes = input.metrics
    .filter((m) => m in METRIC_REGISTRY)
    .map((m) => {
      const b = Number(base.rows[0]?.[m] ?? 0)
      const c = Number(compare.rows[0]?.[m] ?? 0)
      const diff = b - c
      const pct = c === 0 ? null : (diff / Math.abs(c)) * 100
      return {
        metric: m,
        label: METRIC_REGISTRY[m].label,
        base: b,
        compare: c,
        diff: Number(diff.toFixed(2)),
        changePct: pct === null ? null : Number(pct.toFixed(2)),
      }
    })

  return { base, compare, changes }
}

/** 归因下钻：找出各维度值对差异的贡献 */
export async function drillDown(
  input: {
    metric: string
    dimension: string
    timeRange: { from: string; to: string }
    compareRange?: { from: string; to: string }
    filters?: QueryMetricInput['filters']
    topN?: number
  },
  scope: string[] | null,
  pool?: DbExecutor,
  access?: MetricAccessOptions,
): Promise<{
  dimension: string
  metric: string
  contributions: Array<{ value: string; current: number; previous: number | null; diff: number; share: number }>
}> {
  const p = pool || getPool()
  if (!(input.metric in METRIC_REGISTRY)) throw new Error(`未识别的指标：${input.metric}`)
  if (!(input.dimension in DIMENSION_REGISTRY)) throw new Error(`未识别的维度：${input.dimension}`)

  const cur = await queryMetric(
    {
      metrics: [input.metric],
      dimensions: [input.dimension],
      timeRange: input.timeRange,
      filters: input.filters,
      granularity: 'total',
    },
    scope, p, access,
  )

  let prevMap = new Map<string, number>()
  if (input.compareRange) {
    const prev = await queryMetric(
      {
        metrics: [input.metric],
        dimensions: [input.dimension],
        timeRange: input.compareRange,
        filters: input.filters,
        granularity: 'total',
      },
      scope, p, access,
    )
    for (const r of prev.rows) {
      prevMap.set(String(r[input.dimension]), Number(r[input.metric] || 0))
    }
  }

  const items = cur.rows.map((r: any) => {
    const key = String(r[input.dimension])
    const current = Number(r[input.metric] || 0)
    const previous = input.compareRange ? (prevMap.get(key) ?? 0) : null
    return {
      value: key,
      current,
      previous,
      diff: previous === null ? 0 : current - previous,
    }
  })

  const totalDiff = items.reduce((s, x) => s + Math.abs(x.diff), 0) || 1
  const withShare = items
    .map((x) => ({ ...x, share: Number(((x.diff / totalDiff) * 100).toFixed(2)) }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, input.topN || 10)

  return { dimension: input.dimension, metric: input.metric, contributions: withShare }
}

/** 异常检测：基于历史均值与标准差的 Z-Score */
export async function detectAnomalies(
  input: {
    metric: string
    timeRange: { from: string; to: string }
    filters?: QueryMetricInput['filters']
    sensitivity?: number
  },
  scope: string[] | null,
  pool?: DbExecutor,
  access?: MetricAccessOptions,
): Promise<{
  metric: string
  mean: number
  stddev: number
  threshold: number
  anomalies: Array<{ date: string; value: number; zScore: number; direction: 'high' | 'low' }>
}> {
  const p = pool || getPool()
  if (!(input.metric in METRIC_REGISTRY)) throw new Error(`未识别的指标：${input.metric}`)

  const series = await queryMetric(
    {
      metrics: [input.metric],
      dimensions: ['date'],
      timeRange: input.timeRange,
      filters: input.filters,
      granularity: 'day',
    },
    scope, p, access,
  )

  const values = series.rows.map((r: any) => ({ date: toDateStr(r.date), v: Number(r[input.metric] || 0) }))
  if (values.length < 3) {
    return {
      metric: input.metric, mean: 0, stddev: 0,
      threshold: input.sensitivity ?? 2, anomalies: [],
    }
  }

  const mean = values.reduce((s, x) => s + x.v, 0) / values.length
  const variance = values.reduce((s, x) => s + (x.v - mean) ** 2, 0) / values.length
  const stddev = Math.sqrt(variance)
  const threshold = input.sensitivity ?? 2

  const anomalies = values
    .map((x) => ({ date: x.date, value: x.v, zScore: stddev === 0 ? 0 : (x.v - mean) / stddev }))
    .filter((x) => Math.abs(x.zScore) >= threshold)
    .map((x) => ({ ...x, zScore: Number(x.zScore.toFixed(2)), direction: (x.zScore > 0 ? 'high' : 'low') as 'high' | 'low' }))

  return {
    metric: input.metric,
    mean: Number(mean.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    threshold,
    anomalies,
  }
}

/** 趋势预测：线性回归 + 简单季节性忽略，输出未来 N 天与置信区间 */
export async function forecastTrend(
  input: {
    metric: string
    timeRange: { from: string; to: string }
    horizon?: number
    filters?: QueryMetricInput['filters']
  },
  scope: string[] | null,
  pool?: DbExecutor,
  access?: MetricAccessOptions,
): Promise<{
  metric: string
  history: Array<{ date: string; value: number }>
  forecast: Array<{ date: string; value: number; lower: number; upper: number }>
  slope: number
  r2: number
}> {
  const p = pool || getPool()
  if (!(input.metric in METRIC_REGISTRY)) throw new Error(`未识别的指标：${input.metric}`)

  const series = await queryMetric(
    {
      metrics: [input.metric],
      dimensions: ['date'],
      timeRange: input.timeRange,
      filters: input.filters,
      granularity: 'day',
    },
    scope, p, access,
  )

  const hist = series.rows.map((r: any) => ({ date: toDateStr(r.date), value: Number(r[input.metric] || 0) }))
  const horizon = Math.min(input.horizon || 7, 90)

  if (hist.length < 2) {
    return { metric: input.metric, history: hist, forecast: [], slope: 0, r2: 0 }
  }

  // 最小二乘线性回归 y = a + b*x
  const n = hist.length
  const xs = hist.map((_, i) => i)
  const ys = hist.map((h) => h.value)
  const sumX = xs.reduce((s, v) => s + v, 0)
  const sumY = ys.reduce((s, v) => s + v, 0)
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0)
  const sumXX = xs.reduce((s, v) => s + v * v, 0)
  const denom = n * sumXX - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // R²
  const meanY = sumY / n
  const ssTot = ys.reduce((s, v) => s + (v - meanY) ** 2, 0)
  const ssRes = ys.reduce((s, v, i) => s + (v - (intercept + slope * i)) ** 2, 0)
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  // 残差标准差作为置信区间宽度
  const residualStd = Math.sqrt(ssRes / Math.max(n - 2, 1))

  const lastDate = new Date(hist[hist.length - 1].date)
  const forecast: Array<{ date: string; value: number; lower: number; upper: number }> = []
  for (let k = 1; k <= horizon; k++) {
    const d = new Date(lastDate)
    d.setDate(d.getDate() + k)
    const pred = intercept + slope * (n - 1 + k)
    const width = 1.96 * residualStd * Math.sqrt(1 + 1 / n)
    forecast.push({
      date: d.toISOString().slice(0, 10),
      value: Number(Math.max(pred, 0).toFixed(2)),
      lower: Number(Math.max(pred - width, 0).toFixed(2)),
      upper: Number(Math.max(pred + width, 0).toFixed(2)),
    })
  }

  return {
    metric: input.metric,
    history: hist,
    forecast,
    slope: Number(slope.toFixed(4)),
    r2: Number(r2.toFixed(4)),
  }
}

/** 元数据：供 LLM 了解可用指标与维度 */
export function listMetrics(access?: MetricAccessOptions) {
  const allowAd = isAdAccessAllowed(access)
  return Object.values(METRIC_REGISTRY)
    .filter((m) => allowAd || m.source !== 'ad')
    .map((m) => ({
      code: m.code, label: m.label, unit: m.unit, category: m.category, additive: m.additive,
    }))
}

/**
 * 结合数据库 `metric_definition` 与语义层白名单返回完整指标目录（支持口径描述与多平台范围）。
 */
export async function listMetricsFromCatalog(
  pool?: DbExecutor,
  access?: MetricAccessOptions,
) {
  const base = listMetrics(access)
  try {
    const dbDefs = await listMetricDefinitions(pool, access)
    if (dbDefs.length === 0) return base
    const byCode = new Map(dbDefs.map((d) => [d.code, d]))
    return base.map((m) => {
      const def = byCode.get(m.code)
      return {
        ...m,
        label: def?.name || m.label,
        unit: def?.unit ?? m.unit,
        category: def?.category || m.category,
        additive: def ? def.isAdditive : m.additive,
        formula: def?.formula ?? null,
        description: def?.description ?? null,
        supportedPlatforms: def?.supportedPlatforms ?? [],
        extra: def?.extra ?? {},
      }
    })
  } catch {
    return base
  }
}

export function listDimensions() {
  return Object.values(DIMENSION_REGISTRY).map((d) => ({ code: d.code, label: d.label }))
}
