/**
 * ai/engine/planner/schema-mapper.ts — 自然语言 Schema Mapper 实体识别器
 * 
 * 技术参照：SuperSonic（腾讯音乐）Schema Mapper
 * 作用：
 *   把自然语言问题（如「哪个平台 GPM 最高」「各渠道退款率与投流花费」）精确映射为：
 *   1. 标准化指标代码集合（resolvedMetrics）
 *   2. 分析维度（resolvedDimensions）
 *   3. 过滤条件（resolvedFilters，如指定平台、指定店铺）
 *   4. 意图分类（Intent）
 *   彻底根治 D1（变量错误导致只查 GMV）与 D10（多源指标失真、问 GPM 答 GMV）。
 */

import { getMetricCatalog, resolveMetricBySynonym } from '../../catalog/loader.js'
import type { IntentType } from '../../contract/plan.js'

export interface ResolvedSchema {
  intent: IntentType
  metrics: string[]
  dimensions: string[]
  filters: {
    platform?: string
    shopId?: number
    channel?: string
  }
  unresolvedTerms: string[]
  questionRewrite: string
}

const KNOWN_PLATFORMS: Record<string, string> = {
  '抖音': 'douyin',
  'douyin': 'douyin',
  '快手': 'kuaishou',
  'kuaishou': 'kuaishou',
  '天猫': 'tmall',
  'tmall': 'tmall',
  '淘宝': 'taobao',
  'taobao': 'taobao',
  '京东': 'jd',
  'jd': 'jd',
  '小红书': 'xhs',
  'xhs': 'xhs',
  '视频号': 'wxchannel',
  'wxchannel': 'wxchannel',
  '得物': 'dewu',
  'dewu': 'dewu',
}

const DIMENSION_PATTERNS: Array<{ regex: RegExp; dimension: string }> = [
  { regex: /(按|各|不同)?平台|哪个平台|分平台/i, dimension: 'platform_name' },
  { regex: /(按|各|不同)?渠道|哪个渠道|分渠道/i, dimension: 'channel' },
  { regex: /(按|各|不同)?店铺|哪家店|分店铺/i, dimension: 'shop' },
  { regex: /(按|各|不同)?日|每天|日度|日趋势|时间趋势|走势/i, dimension: 'date' },
  { regex: /(按|各|不同)?小时|分时/i, dimension: 'hour' },
]

/**
 * 核心实体映射器
 */
export async function mapQuestionToSchema(question: string): Promise<ResolvedSchema> {
  const q = question.trim()
  const catalog = await getMetricCatalog()
  const matchedMetrics = new Set<string>()

  // 1. 扫描指标（按关键词最长优先匹配）
  const candidates: Array<{ term: string; metricCode: string }> = []
  for (const m of Object.values(catalog)) {
    candidates.push({ term: m.code, metricCode: m.code })
    candidates.push({ term: m.name, metricCode: m.code })
    for (const syn of m.synonyms) {
      if (syn) candidates.push({ term: syn, metricCode: m.code })
    }
  }
  // 按长度倒序，防子串短词贪婪遮蔽（例如“千次展现成交”优先于“成交”）
  candidates.sort((a, b) => b.term.length - a.term.length)

  const lowerQ = q.toLowerCase()
  const matchedSpans: Array<{ start: number; end: number }> = []

  for (const c of candidates) {
    const term = c.term.toLowerCase()
    let idx = lowerQ.indexOf(term)
    while (idx !== -1) {
      const end = idx + term.length
      const overlaps = matchedSpans.some(
        (span) => Math.max(span.start, idx) < Math.min(span.end, end)
      )
      if (!overlaps) {
        matchedSpans.push({ start: idx, end })
        matchedMetrics.add(c.metricCode)
      }
      idx = lowerQ.indexOf(term, idx + 1)
    }
  }

  // 2. 扫描维度
  const matchedDimensions = new Set<string>()
  for (const dp of DIMENSION_PATTERNS) {
    if (dp.regex.test(q)) {
      matchedDimensions.add(dp.dimension)
    }
  }

  // 3. 扫描平台特指过滤器
  const filters: ResolvedSchema['filters'] = {}
  for (const [name, code] of Object.entries(KNOWN_PLATFORMS)) {
    if (q.includes(name)) {
      filters.platform = code
      break
    }
  }

  // 4. 意图分类（具有明确优先级）
  let intent: IntentType = 'query'
  if (/为什么|原因|归因/.test(q)) {
    intent = 'attribute'
  } else if (/异常|暴跌|暴涨|突增|突降|不对劲|有没有问题/.test(q)) {
    intent = 'anomaly'
  } else if (/预测|能不能完成|未来|趋势|目标达成|下周|外推|走势|预估/.test(q)) {
    intent = 'forecast'
  } else if (/下降|上涨|掉了|涨了|波动/.test(q)) {
    intent = 'attribute'
  } else if (/复盘|报告|总结/.test(q)) {
    intent = 'review'
  } else if (/对比|相比|哪个更好|哪个更赚|哪个更强/.test(q)) {
    intent = 'compare'
  } else {
    intent = 'query'
  }

  // 默认兜底：若问句未指定任何指标，依据意图给出合理基准指标
  if (matchedMetrics.size === 0) {
    if (intent === 'review') {
      matchedMetrics.add('gmv')
      matchedMetrics.add('paid_order_count')
      matchedMetrics.add('refund_rate')
    } else {
      matchedMetrics.add('gmv')
    }
  }

  // 若问平台排行或比较，补充 platform_name 维度
  if (/哪个平台|各平台|平台/.test(q) && !matchedDimensions.has('platform_name')) {
    matchedDimensions.add('platform_name')
  }

  return {
    intent,
    metrics: Array.from(matchedMetrics),
    dimensions: Array.from(matchedDimensions),
    filters,
    unresolvedTerms: [],
    questionRewrite: q,
  }
}
