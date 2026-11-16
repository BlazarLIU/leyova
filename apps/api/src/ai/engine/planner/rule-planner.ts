/**
 * ai/engine/planner/rule-planner.ts — 确定性规则规划器
 * 
 * 技术参照：SuperSonic 规则解析器
 * 作用：
 *   在无需 LLM 或 LLM 离线/不可用时，基于 Schema Mapper 生成符合 PlanSchema 的高精度执行计划。
 *   支持 S1 (问数) ~ S6 (复盘) 完整业务场景。
 */

import { mapQuestionToSchema, type ResolvedSchema } from './schema-mapper.js'
import type { Plan, ToolCallPlan } from '../../contract/plan.js'

export interface PlannerOptions {
  question: string
  mode?: string
  timeRange?: { from: string; to: string }
  filters?: { platform?: string; shopId?: number; channel?: string }
  platformCode?: string
  role?: string
}

function defaultRange(): { from: string; to: string } {
  const d = new Date()
  const to = d.toISOString().slice(0, 10)
  d.setDate(d.getDate() - 6)
  const from = d.toISOString().slice(0, 10)
  return { from, to }
}

function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const f = new Date(range.from)
  const t = new Date(range.to)
  const diffDays = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1)

  const prevTo = new Date(f)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - diffDays + 1)

  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  }
}

/**
 * 规则规划主函数
 */
export async function planByRules(opts: PlannerOptions): Promise<Plan> {
  const mapped: ResolvedSchema = await mapQuestionToSchema(opts.question)
  const range = opts.timeRange || defaultRange()
  const prev = previousRange(range)
  const mergedFilters = { ...mapped.filters, ...(opts.filters || {}) }
  if (opts.platformCode) mergedFilters.platform = opts.platformCode

  // 模式决策：请求显式传入优先，否则采纳 Schema Mapper 识别结果
  let intent = mapped.intent
  if (opts.mode) {
    if (opts.mode === 'S1_query') intent = 'query'
    else if (opts.mode === 'S2_attribution') intent = 'attribute'
    else if (opts.mode === 'S3_compare') intent = 'compare'
    else if (opts.mode === 'S4_anomaly') intent = 'anomaly'
    else if (opts.mode === 'S5_forecast') intent = 'forecast'
    else if (opts.mode === 'S6_review') intent = 'review'
  }

  const calls: ToolCallPlan[] = []
  const metrics = mapped.metrics.length > 0 ? mapped.metrics : ['gmv']
  const primaryMetric = metrics[0]

  switch (intent) {
    case 'attribute': {
      // S2 归因：周期对比 + 下钻
      calls.push({
        tool: 'compare_periods',
        args: {
          metrics: metrics.length >= 2 ? metrics : ['gmv', 'paid_order_count', 'refund_amount'],
          base: range,
          compare: prev,
          filters: mergedFilters,
        },
        purpose: '核算本期与上期关键指标差异与变化率',
      })
      calls.push({
        tool: 'drill_down',
        args: {
          metric: primaryMetric,
          dimension: mapped.dimensions[0] || 'channel',
          timeRange: range,
          compareRange: prev,
          filters: mergedFilters,
          topN: 5,
        },
        purpose: `下钻分析各渠道对 ${primaryMetric} 波动的贡献度`,
      })
      break
    }

    case 'compare': {
      // S3 对比：多平台/多主体同周期对比
      calls.push({
        tool: 'query_metric',
        args: {
          metrics,
          dimensions: mapped.dimensions.length > 0 ? mapped.dimensions : ['platform_name'],
          timeRange: range,
          filters: mergedFilters,
          orderBy: { metric: primaryMetric, direction: 'desc' },
        },
        purpose: `按维度对比 ${metrics.join(', ')}`,
      })
      break
    }

    case 'anomaly': {
      // S4 异常探测：Z-score 偏离分析
      calls.push({
        tool: 'detect_anomalies',
        args: {
          metric: primaryMetric,
          timeRange: range,
          filters: mergedFilters,
          sensitivity: 2,
        },
        purpose: `探测 ${primaryMetric} 历史异动与极端值时点`,
      })
      calls.push({
        tool: 'query_metric',
        args: {
          metrics: [primaryMetric],
          dimensions: ['date'],
          timeRange: range,
          filters: mergedFilters,
          granularity: 'day',
        },
        purpose: '拉取日度时序辅助定位',
      })
      break
    }

    case 'forecast': {
      // S5 趋势外推：拉取历史时序 + 趋势拟合
      calls.push({
        tool: 'query_metric',
        args: {
          metrics: [primaryMetric],
          dimensions: ['date'],
          timeRange: range,
          filters: mergedFilters,
          granularity: 'day',
        },
        purpose: '拉取历史观察期日度序列',
      })
      calls.push({
        tool: 'forecast_trend',
        args: {
          metric: primaryMetric,
          timeRange: range,
          horizon: 7,
          filters: mergedFilters,
        },
        purpose: `外推未来 7 天 ${primaryMetric} 走势`,
      })
      break
    }

    case 'review': {
      // S6 场次/经营全面复盘
      calls.push({
        tool: 'query_metric',
        args: {
          metrics: ['gmv', 'paid_order_count', 'paid_buyer_count', 'refund_amount', 'refund_rate', 'avg_order_value'],
          dimensions: ['platform_name'],
          timeRange: range,
          filters: mergedFilters,
          orderBy: { metric: 'gmv', direction: 'desc' },
        },
        purpose: '综合盘点各平台核心产销与履约退款指标',
      })
      break
    }

    case 'query':
    default: {
      // S1 通用问数：修复 D1，若提问了特定指标则查该指标；若多指标则按维度全量展现
      const targetMetrics = metrics.length === 1 && metrics[0] === 'gmv'
        ? ['gmv', 'paid_order_count', 'paid_buyer_count', 'refund_rate', 'avg_order_value']
        : metrics

      const dims = mapped.dimensions.length > 0 ? mapped.dimensions : ['platform_name']
      calls.push({
        tool: 'query_metric',
        args: {
          metrics: targetMetrics,
          dimensions: dims,
          timeRange: range,
          filters: mergedFilters,
          orderBy: { metric: targetMetrics[0], direction: 'desc' },
        },
        purpose: `按 ${dims.join(', ')} 统计 ${targetMetrics.join(', ')}`,
      })
      break
    }
  }

  return {
    intent,
    question_rewrite: mapped.questionRewrite,
    resolved: {
      metrics,
      dimensions: mapped.dimensions,
      unresolved_terms: mapped.unresolvedTerms,
    },
    time_range: range,
    needs_clarification: false,
    calls,
    engine: 'rule',
  }
}
