/**
 * platform-metrics.ts — 平台专属指标注册（阶段 D1）
 *
 * 把各平台独有的指标注册进语义层，让 AI 助手能回答平台特有问题：
 *   - 快手：间接成交、关注页/发现页成交、粉丝团入团率
 *   - 拼多多：成团成功率、成团损耗、结算金额、净成交
 *   - 淘宝/天猫：支付转化率、动销率、父子订单
 *   - 京东：供货金额、毛利、COD 占比
 *   - 小红书：笔记阅读率、互动率、搜索占比、站外成交
 *
 * 设计：
 *   - 这些指标只对特定平台有效，查询时若平台不匹配则返回空
 *   - 每张平台扩展表单独作为一个 FactSource
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'

/** 平台扩展事实表 */
export type PlatformFactSource =
  | 'pdd_group'
  | 'xhs_note'
  | 'jd_po'
  | 'ks_fans'
  | 'taobao_order'

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
  // ── 拼多多：成团 ──
  group_success_rate: {
    code: 'group_success_rate', label: '成团成功率', unit: '%',
    expr: `CASE WHEN COUNT(*) FILTER (WHERE status IN ('grouped','expired')) > 0
            THEN ROUND(COUNT(*) FILTER (WHERE status = 'grouped')::numeric
                 / COUNT(*) FILTER (WHERE status IN ('grouped','expired')) * 100, 2)
            ELSE 0 END`,
    source: 'pdd_group', platformScope: ['pdd'], additive: false,
    description: '已成团数 / (已成团数 + 过期数)',
  },
  group_expired_amount: {
    code: 'group_expired_amount', label: '成团损耗金额', unit: '元',
    expr: `COALESCE(SUM(refund_amount) FILTER (WHERE status = 'expired'), 0)::numeric`,
    source: 'pdd_group', platformScope: ['pdd'], additive: true,
    description: '过期拼团自动退款的总额',
  },
  group_avg_size: {
    code: 'group_avg_size', label: '平均成团人数', unit: '人',
    expr: `COALESCE(AVG(NULLIF(group_size_actual, 0)), 0)::numeric`,
    source: 'pdd_group', platformScope: ['pdd'], additive: false,
  },

  // ── 小红书：笔记 ──
  note_read_rate: {
    code: 'note_read_rate', label: '笔记阅读率', unit: '%',
    expr: `CASE WHEN SUM(impressions) > 0
            THEN ROUND(SUM(reads)::numeric / SUM(impressions) * 100, 2) ELSE 0 END`,
    source: 'xhs_note', platformScope: ['xiaohongshu'], additive: false,
    description: '总阅读 / 总曝光',
  },
  note_engagement_rate: {
    code: 'note_engagement_rate', label: '笔记互动率', unit: '%',
    expr: `CASE WHEN SUM(reads) > 0
            THEN ROUND((SUM(likes) + SUM(collects) + SUM(comments) + SUM(shares))::numeric
                 / SUM(reads) * 100, 2) ELSE 0 END`,
    source: 'xhs_note', platformScope: ['xiaohongshu'], additive: false,
  },
  note_search_share: {
    code: 'note_search_share', label: '搜索曝光占比', unit: '%',
    expr: `CASE WHEN SUM(impressions) > 0
            THEN ROUND(SUM(search_impressions)::numeric / SUM(impressions) * 100, 2) ELSE 0 END`,
    source: 'xhs_note', platformScope: ['xiaohongshu'], additive: false,
    description: '搜索曝光 / 总曝光，小红书独立维度',
  },
  note_reads: {
    code: 'note_reads', label: '笔记阅读量', unit: '次',
    expr: `COALESCE(SUM(reads), 0)::bigint`,
    source: 'xhs_note', platformScope: ['xiaohongshu'], additive: true,
  },
  note_collects: {
    code: 'note_collects', label: '笔记收藏量', unit: '次',
    expr: `COALESCE(SUM(collects), 0)::bigint`,
    source: 'xhs_note', platformScope: ['xiaohongshu'], additive: true,
  },
  note_onsite_gmv: {
    code: 'note_onsite_gmv', label: '笔记站内成交', unit: '元',
    expr: `COALESCE(SUM(onsite_gmv), 0)::numeric`,
    source: 'xhs_note', platformScope: ['xiaohongshu'], additive: true,
  },
  note_offsite_gmv: {
    code: 'note_offsite_gmv', label: '笔记站外成交', unit: '元',
    expr: `COALESCE(SUM(offsite_gmv), 0)::numeric`,
    source: 'xhs_note', platformScope: ['xiaohongshu'], additive: true,
    description: '红猫/红京/红美广告挂链跳转外部平台成交',
  },

  // ── 京东：采销 ──
  jd_supply_amount: {
    code: 'jd_supply_amount', label: '供货金额', unit: '元',
    expr: `COALESCE(SUM(settle_amount), 0)::numeric`,
    source: 'jd_po', platformScope: ['jd'], additive: true,
    description: '自营采销的供货结算额，不等于零售成交额',
  },
  jd_gross_margin: {
    code: 'jd_gross_margin', label: '毛利额', unit: '元',
    expr: `COALESCE(SUM(gross_margin), 0)::numeric`,
    source: 'jd_po', platformScope: ['jd'], additive: true,
  },
  jd_margin_rate: {
    code: 'jd_margin_rate', label: '毛利率', unit: '%',
    expr: `CASE WHEN SUM(retail_price * quantity) > 0
            THEN ROUND(SUM(gross_margin) / SUM(retail_price * quantity) * 100, 2) ELSE 0 END`,
    source: 'jd_po', platformScope: ['jd'], additive: false,
  },

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

  // ── 淘宝/天猫：父子订单 ──
  taobao_sku_count: {
    code: 'taobao_sku_count', label: '动销 SKU 数', unit: '个',
    expr: `COUNT(DISTINCT sku_code)`,
    source: 'taobao_order', platformScope: ['taobao', 'tmall'], additive: false,
  },
  taobao_avg_sku_price: {
    code: 'taobao_avg_sku_price', label: 'SKU 平均单价', unit: '元',
    expr: `CASE WHEN SUM(quantity) > 0
            THEN ROUND(SUM(pay_amount) / SUM(quantity), 2) ELSE 0 END`,
    source: 'taobao_order', platformScope: ['taobao', 'tmall'], additive: false,
  },
  taobao_parent_orders: {
    code: 'taobao_parent_orders', label: '父订单数', unit: '单',
    expr: `COUNT(DISTINCT parent_order_id)`,
    source: 'taobao_order', platformScope: ['taobao', 'tmall'], additive: false,
    description: '父订单=一次付款，子订单=商品×SKU 明细',
  },
}

/** 平台扩展表名映射 */
export const PLATFORM_FACT_TABLE: Record<PlatformFactSource, string> = {
  pdd_group: 'pdd_group_buy',
  xhs_note: 'xhs_note',
  jd_po: 'jd_purchase_order',
  ks_fans: 'kuaishou_fans_ops',
  taobao_order: 'taobao_order_hierarchy',
}

/** 判断指标是否适用于该平台 */
export function isPlatformMetricApplicable(code: string, platformCode: string): boolean {
  const def = PLATFORM_METRIC_REGISTRY[code]
  if (!def) return false
  return def.platformScope.includes(platformCode)
}

/** 列出某平台可用的专属指标 */
export function listPlatformMetrics(platformCode: string): PlatformMetricDef[] {
  return Object.values(PLATFORM_METRIC_REGISTRY)
    .filter((m) => m.platformScope.includes(platformCode))
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
  pool?: Pool,
): Promise<PlatformQueryResult> {
  const p = pool || getPool()
  const warnings: string[] = []

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
    sql += ` AND platform_code = ${params.length}`
  }

  if (input.shopId) {
    params.push(input.shopId)
    sql += ` AND shop_id = ${params.length}`
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
