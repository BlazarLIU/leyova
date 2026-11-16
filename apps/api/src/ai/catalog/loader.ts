/**
 * ai/catalog/loader.ts — 指标目录真值源加载器与同义词索引
 * 
 * 功能：
 *   1. 优先从 PostgreSQL `metric_catalog` 视图动态读取，带 60s 内存 TTL 缓存。
 *   2. 维护同义词全文索引表，赋能 Schema Mapper 毫秒级命中。
 *   3. 权限守卫：过滤当前用户无权访问的指标类别（如 ad 分类）。
 */

import { getPool, type DbExecutor } from '../../lib/db.js'
import { canAccessAdSpend } from '../../lib/guard.js'
import { SYSTEM_METRICS, SYSTEM_DIMENSIONS } from '../../catalog/index.js'
import type { MetricDefinition } from '../../catalog/types.js'

export interface CatalogMetricItem extends MetricDefinition {
  synonyms: string[]
  platformScope?: string[]
}

interface CacheState {
  metrics: Record<string, CatalogMetricItem>
  synonymIndex: Map<string, string> // lowerSynonym -> metric_code
  lastLoadedAt: number
}

let cache: CacheState | null = null
const CACHE_TTL_MS = 60_000 // 1 分钟缓存

/**
 * 刷新并构建本地同义词倒排索引
 */
function buildSynonymIndex(metrics: Record<string, CatalogMetricItem>): Map<string, string> {
  const index = new Map<string, string>()

  for (const m of Object.values(metrics)) {
    // 自身 code 与 label
    index.set(m.code.toLowerCase(), m.code)
    index.set(m.name.toLowerCase(), m.code)

    if (Array.isArray(m.synonyms)) {
      for (const syn of m.synonyms) {
        if (syn && typeof syn === 'string') {
          index.set(syn.trim().toLowerCase(), m.code)
        }
      }
    }
  }

  return index
}

/**
 * 默认静态指标初始库
 */
function getDefaultCatalog(): Record<string, CatalogMetricItem> {
  const res: Record<string, CatalogMetricItem> = {}
  for (const [code, def] of Object.entries(SYSTEM_METRICS)) {
    res[code] = {
      ...def,
      synonyms: [code, def.name],
    }
  }
  // 注入关键业务同义词
  if (res.gmv) res.gmv.synonyms.push('成交额', '销售额', '销售总额', '流水', '卖了多少钱')
  if (res.pay_amount) res.pay_amount.synonyms.push('实付', '买家实付', '实收金额')
  if (res.net_sales) res.net_sales.synonyms.push('净销售额', '净销售', '实际成交', '剔退成交')
  if (res.paid_order_count) res.paid_order_count.synonyms.push('订单量', '单量', '总单数', '销售单数')
  if (res.paid_buyer_count) res.paid_buyer_count.synonyms.push('买家数', '购买人数', '客户数')
  if (res.avg_order_value) res.avg_order_value.synonyms.push('aov', 'AOV', '笔单价')
  if (res.refund_rate) res.refund_rate.synonyms.push('退款率', '退货率', '退单率')
  if (res.gpm) res.gpm.synonyms.push('GPM', '千次成交', '千次展现成交', '千次展现gmv')
  if (res.ad_spend) res.ad_spend.synonyms.push('广告花费', '投放金额', '投放成本', '投流花费', '千川花费')
  if (res.roi) res.roi.synonyms.push('ROI', '投产比', '综合投产比')
  if (res.net_roi) res.net_roi.synonyms.push('净ROI', '净利润投产比')

  return res
}

/**
 * 获取系统全量指标目录（热加载或走缓存）
 */
export async function getMetricCatalog(executor?: DbExecutor): Promise<Record<string, CatalogMetricItem>> {
  const now = Date.now()
  if (cache && now - cache.lastLoadedAt < CACHE_TTL_MS) {
    return cache.metrics
  }

  const pool = executor || getPool()
  try {
    const { rows } = await pool.query(`
      SELECT 
        metric_code, name, unit, category, formula, description, fact_table, 
        is_additive, synonyms, supported_platforms, status
      FROM public.metric_catalog
      WHERE status = 'active'
    `)

    if (rows.length > 0) {
      const metrics: Record<string, CatalogMetricItem> = {}
      for (const r of rows) {
        metrics[r.metric_code] = {
          code: r.metric_code,
          name: r.name,
          unit: r.unit || '',
          category: r.category || 'trade',
          expr: r.formula,
          factTable: r.fact_table || 'trade',
          isAdditive: Boolean(r.is_additive),
          description: r.description || '',
          synonyms: Array.isArray(r.synonyms) ? r.synonyms : [],
          platformScope: Array.isArray(r.supported_platforms) ? r.supported_platforms : [],
        }
      }
      cache = {
        metrics,
        synonymIndex: buildSynonymIndex(metrics),
        lastLoadedAt: now,
      }
      return metrics
    }
  } catch (err) {
    // 降级使用静态配置
  }

  const defaultCatalog = getDefaultCatalog()
  cache = {
    metrics: defaultCatalog,
    synonymIndex: buildSynonymIndex(defaultCatalog),
    lastLoadedAt: now,
  }
  return defaultCatalog
}

/**
 * 快速查询同义词索引
 */
export async function resolveMetricBySynonym(term: string): Promise<CatalogMetricItem | undefined> {
  await getMetricCatalog()
  if (!cache) return undefined
  const clean = term.trim().toLowerCase()
  const code = cache.synonymIndex.get(clean)
  return code ? cache.metrics[code] : undefined
}

/**
 * 权限过滤指标列表
 */
export async function listAuthorizedMetrics(access?: { role?: string; userType?: string }): Promise<CatalogMetricItem[]> {
  const catalog = await getMetricCatalog()
  const allowAd = access ? canAccessAdSpend({ role: access.role, userType: access.userType }) : true
  return Object.values(catalog).filter((m) => allowAd || m.category !== 'ad')
}
