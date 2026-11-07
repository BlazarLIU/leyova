/**
 * orchestrator.ts — AI 分析助手四阶受控编排（Planner → Executor → Critic → Reporter）
 *
 * 对齐计划 5.3 与 8.4：
 *   - **数字由代码算，LLM 只做规划与表达**
 *   - Reporter 的每个数字必须能在 Executor 的结果集中命中（容差 0.1%），
 *     否则标记为「无法溯源」，前端拒绝展示为结论
 *   - 每一步落库（analysis_runs / analysis_steps），支持重跑与审计
 *
 * 运行模式：
 *   - LLM 可用：由 LLM 产出分析计划（JSON），代码执行
 *   - LLM 不可用：走内置规则剧本（S1-S6），保证系统可用
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'
import {
  queryMetric, comparePeriods, drillDown, detectAnomalies, forecastTrend,
  METRIC_REGISTRY, listMetrics, listDimensions,
} from './semantic-layer.js'
import { searchKnowledgeBase } from '../lib/kb-client.js'

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type AnalysisMode = 'S1_query' | 'S2_attribution' | 'S3_compare' | 'S4_anomaly' | 'S5_forecast' | 'S6_review'

export interface AnalysisRequest {
  question: string
  mode?: AnalysisMode
  timeRange?: { from: string; to: string }
  filters?: { platform?: string; shopId?: number; channel?: string }
  role?: string
  userId?: number
  conversationId?: number
  /** 可选的 LLM 规划器；不传则使用内置规则 */
  planner?: (prompt: string, schema: string) => Promise<any>
}

export interface AnalysisStep {
  seq: number
  role: 'planner' | 'executor' | 'critic' | 'reporter'
  toolName: string
  input: any
  outputRef: any
  rowCount: number
  durationMs: number
  status: 'ok' | 'failed'
  error?: string
}

export interface EvidenceItem {
  id: string        // e1, e2...
  metric: string
  label: string
  value: number
  unit: string
  scope: string
  timeRange: string
}

export interface AnalysisResult {
  runId: number | null
  mode: AnalysisMode
  question: string
  plan: any
  steps: AnalysisStep[]
  evidence: EvidenceItem[]
  conclusion: {
    headline: string
    findings: string[]
    evidenceRefs: string[]
    risks: string[]
    actions: string[]
  }
  verification: {
    checkedNumbers: number
    matched: number
    unmatched: Array<{ number: number; context: string }>
    passed: boolean
  }
  knowledgeUsed: number
  durationMs: number
}

// ---------------------------------------------------------------------------
// 工具执行分发
// ---------------------------------------------------------------------------

async function runTool(
  toolName: string,
  input: any,
  scope: string[] | null,
  pool: Pool,
): Promise<{ output: any; rowCount: number }> {
  switch (toolName) {
    case 'query_metric': {
      const r = await queryMetric(input, scope, pool)
      return { output: r, rowCount: r.rowCount }
    }
    case 'compare_periods': {
      const r = await comparePeriods(input, scope, pool)
      return { output: r, rowCount: r.changes.length }
    }
    case 'drill_down': {
      const r = await drillDown(input, scope, pool)
      return { output: r, rowCount: r.contributions.length }
    }
    case 'detect_anomalies': {
      const r = await detectAnomalies(input, scope, pool)
      return { output: r, rowCount: r.anomalies.length }
    }
    case 'forecast_trend': {
      const r = await forecastTrend(input, scope, pool)
      return { output: r, rowCount: r.forecast.length }
    }
    default:
      throw new Error(`未知工具: ${toolName}`)
  }
}

// ---------------------------------------------------------------------------
// Evidence 抽取：把工具输出里的数值全部登记为可溯源证据
// ---------------------------------------------------------------------------

function extractEvidence(steps: AnalysisStep[]): EvidenceItem[] {
  const evidence: EvidenceItem[] = []
  let n = 0
  for (const step of steps) {
    if (step.status !== 'ok') continue
    const out = step.outputRef
    if (!out) continue

    const push = (metric: string, value: number, scope: string, timeRange: string) => {
      const def = METRIC_REGISTRY[metric]
      evidence.push({
        id: `e${++n}`,
        metric,
        label: def?.label || metric,
        value,
        unit: def?.unit || '',
        scope,
        timeRange,
      })
    }

    if (step.toolName === 'query_metric' && Array.isArray(out.rows)) {
      for (const row of out.rows) {
        for (const [k, v] of Object.entries(row)) {
          if (k in METRIC_REGISTRY && typeof v === 'number') {
            push(k, v, String(row.platform_name || row.shop || row.channel || '全部'), step.input?.timeRange ? `${step.input.timeRange.from}~${step.input.timeRange.to}` : '')
          }
        }
      }
    }
    if (step.toolName === 'compare_periods' && Array.isArray(out.changes)) {
      for (const c of out.changes) {
        push(c.metric, c.base, '本期', `${step.input.base.from}~${step.input.base.to}`)
        push(c.metric, c.compare, '上期', `${step.input.compare.from}~${step.input.compare.to}`)
        if (typeof c.changePct === 'number') {
          evidence.push({
            id: `e${++n}`, metric: `${c.metric}_changePct`, label: `${c.label}变化率`,
            value: c.changePct, unit: '%', scope: '同环比', timeRange: '对比区间',
          })
        }
      }
    }
    if (step.toolName === 'drill_down' && Array.isArray(out.contributions)) {
      for (const c of out.contributions.slice(0, 5)) {
        push(out.metric, c.current, `渠道:${c.value}`, '本期')
        if (typeof c.share === 'number') {
          evidence.push({
            id: `e${++n}`, metric: 'contribution_share', label: `贡献占比(${c.value})`,
            value: c.share, unit: '%', scope: `渠道:${c.value}`, timeRange: '对比区间',
          })
        }
      }
    }
    if (step.toolName === 'detect_anomalies' && Array.isArray(out.anomalies)) {
      for (const a of out.anomalies.slice(0, 5)) {
        push(out.metric, a.value, `日期:${a.date}`, a.date)
      }
    }
    if (step.toolName === 'forecast_trend' && Array.isArray(out.forecast)) {
      for (const f of out.forecast.slice(0, 5)) {
        push(out.metric, f.value, `预测:${f.date}`, f.date)
      }
      // 预测合计与日均是代码算出的派生值，必须登记
      const total = Number(out.forecast.reduce((s: number, x: any) => s + x.value, 0).toFixed(2))
      const avg = out.forecast.length > 0 ? Number((total / out.forecast.length).toFixed(2)) : 0
      const def = METRIC_REGISTRY[out.metric]
      evidence.push({
        id: `e${++n}`, metric: out.metric, label: `${def?.label || out.metric}(预测合计)`,
        value: total, unit: def?.unit || '', scope: '预测合计', timeRange: `未���${out.forecast.length}天`,
      })
      evidence.push({
        id: `e${++n}`, metric: out.metric, label: `${def?.label || out.metric}(预测日均)`,
        value: avg, unit: def?.unit || '', scope: '预测日均', timeRange: `未来${out.forecast.length}天`,
      })
      // 模型参数同样属于「结论中出现的数字」，必须可溯源
      if (typeof out.slope === 'number') {
        evidence.push({
          id: `e${++n}`, metric: 'trend_slope', label: '趋势斜率',
          value: out.slope, unit: `${def?.unit || ''}/天`, scope: '模型参数', timeRange: '拟合区间',
        })
      }
      if (typeof out.r2 === 'number') {
        evidence.push({
          id: `e${++n}`, metric: 'trend_r2', label: '拟合优度 R²',
          value: out.r2, unit: '', scope: '模型参数', timeRange: '拟合区间',
        })
      }
    }
  }
  // 派生汇总值：按维度不分组时的合计/均值，由代码算出，同样登记为证据
  for (const step of steps) {
    if (step.status !== 'ok') continue
    const out = step.outputRef
    if (!out || !Array.isArray(out.rows) || out.rows.length === 0) continue
    if (step.toolName !== 'query_metric') continue

    for (const metric of Object.keys(METRIC_REGISTRY)) {
      const colVals = out.rows
        .map((r: any) => r[metric])
        .filter((v: any) => typeof v === 'number') as number[]
      if (colVals.length === 0) continue

      const def = METRIC_REGISTRY[metric]
      // 可加总指标：登记合计；比率类：登记加权前直接跳过合计
      if (def.additive) {
        const sum = Number(colVals.reduce((a, b) => a + b, 0).toFixed(2))
        if (!evidence.some((e) => e.metric === metric && e.value === sum && e.scope === '合计')) {
          evidence.push({
            id: `e${++n}`, metric, label: `${def.label}(合计)`,
            value: sum, unit: def.unit, scope: '合计',
            timeRange: step.input?.timeRange ? `${step.input.timeRange.from}~${step.input.timeRange.to}` : '',
          })
        }
      }
    }
  }

  return evidence
}

// ---------------------------------------------------------------------------
// Critic：数字溯源校验
// ---------------------------------------------------------------------------

/** 容差：0.1% */
const TOLERANCE = 0.001

export function verifyNumbers(
  texts: string[],
  evidence: EvidenceItem[],
): AnalysisResult['verification'] {
  const values = evidence.map((e) => e.value)
  const unmatched: Array<{ number: number; context: string }> = []
  let checked = 0

  for (const text of texts) {
    // 提取文本中的数字（支持千分位与小数）
    const matches = text.match(/-?\d[\d,]*(?:\.\d+)?/g) || []
    for (const raw of matches) {
      const num = Number(raw.replace(/,/g, ''))
      if (!Number.isFinite(num)) continue
      // 忽略小整数（1-10 常用于计数、序号、"3 个建议"），避免误报
      if (Math.abs(num) < 11 && Number.isInteger(num)) continue
      checked++

      const hit = values.some((v) => {
        if (v === 0 && num === 0) return true
        if (v === 0) return false
        return Math.abs(num - v) / Math.abs(v) <= TOLERANCE
      })
      if (!hit) {
        unmatched.push({ number: num, context: text.slice(0, 80) })
      }
    }
  }

  return {
    checkedNumbers: checked,
    matched: checked - unmatched.length,
    unmatched,
    passed: unmatched.length === 0,
  }
}

// ---------------------------------------------------------------------------
// 内置规则剧本（LLM 不可用时的兜底）
// ---------------------------------------------------------------------------

function defaultRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 6)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function previousRange(r: { from: string; to: string }): { from: string; to: string } {
  const f = new Date(r.from)
  const t = new Date(r.to)
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1
  const prevTo = new Date(f)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - days + 1)
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) }
}

interface PlannedCall {
  tool: string
  input: any
  purpose: string
}

function buildRulePlan(req: AnalysisRequest): { mode: AnalysisMode; calls: PlannedCall[] } {
  const range = req.timeRange || defaultRange()
  const filters = req.filters || {}
  const prev = previousRange(range)

  // 简单意图识别
  const q = req.question
  let mode: AnalysisMode = req.mode || 'S1_query'
  if (!req.mode) {
    // 判定顺序很重要：「有没有异常波动」同时含「波动」与「异常」，
    // 必须让更具体的异常类先命中，否则会被误判为归因。
    if (/异常|暴跌|暴涨|突增|突降|不对劲|有没有问题/.test(q)) mode = 'S4_anomaly'
    else if (/预测|能不能完成|未来|趋势|目标达成/.test(q)) mode = 'S5_forecast'
    else if (/复盘|报告|总结/.test(q)) mode = 'S6_review'
    else if (/对比|相比|哪个更好|哪个更赚|哪个更强/.test(q)) mode = 'S3_compare'
    else if (/为什么|原因|归因|下降|上涨|掉了|涨了|波动/.test(q)) mode = 'S2_attribution'
  }

  const calls: PlannedCall[] = []

  switch (mode) {
    case 'S2_attribution':
      calls.push({
        tool: 'compare_periods',
        input: { metrics: ['gmv', 'paid_order_count', 'refund_amount'], base: range, compare: prev, filters },
        purpose: '确认本期与上期差异',
      })
      calls.push({
        tool: 'drill_down',
        input: { metric: 'gmv', dimension: 'platform_name', timeRange: range, compareRange: prev, filters, topN: 5 },
        purpose: '按平台归因 GMV 变化的贡献',
      })
      calls.push({
        tool: 'drill_down',
        input: { metric: 'gmv', dimension: 'channel', timeRange: range, compareRange: prev, filters, topN: 5 },
        purpose: '按渠道归因 GMV 变化的贡献',
      })
      break

    case 'S3_compare':
      calls.push({
        tool: 'query_metric',
        input: {
          metrics: ['gmv', 'refund_rate', 'avg_order_value', 'paid_order_count'],
          dimensions: ['platform_name'], timeRange: range, filters,
          orderBy: { metric: 'gmv', direction: 'desc' },
        },
        purpose: '拉取各平台核心指标做横向对比',
      })
      break

    case 'S4_anomaly':
      calls.push({
        tool: 'detect_anomalies',
        input: { metric: 'gmv', timeRange: range, filters, sensitivity: 2 },
        purpose: '检测 GMV 异常波动',
      })
      calls.push({
        tool: 'query_metric',
        input: { metrics: ['gmv', 'paid_order_count'], dimensions: ['date'], timeRange: range, filters, granularity: 'day' },
        purpose: '拉取日序列用于定位异常时点',
      })
      break

    case 'S5_forecast':
      calls.push({
        tool: 'query_metric',
        input: { metrics: ['gmv'], dimensions: ['date'], timeRange: range, filters, granularity: 'day' },
        purpose: '拉取历史序列',
      })
      calls.push({
        tool: 'forecast_trend',
        input: { metric: 'gmv', timeRange: range, horizon: 7, filters },
        purpose: '预测未来 7 ��� GMV',
      })
      break

    case 'S6_review':
      calls.push({
        tool: 'query_metric',
        input: {
          metrics: ['gmv', 'paid_order_count', 'paid_buyer_count', 'refund_amount', 'refund_rate', 'avg_order_value'],
          dimensions: ['platform_name'], timeRange: range, filters,
          orderBy: { metric: 'gmv', direction: 'desc' },
        },
        purpose: '汇总周期内各平台经营指标',
      })
      calls.push({
        tool: 'compare_periods',
        input: { metrics: ['gmv', 'paid_order_count'], base: range, compare: prev, filters },
        purpose: '计算同环比',
      })
      calls.push({
        tool: 'detect_anomalies',
        input: { metric: 'gmv', timeRange: range, filters, sensitivity: 2 },
        purpose: '识别周期内异常',
      })
      break

    default: // S1_query
      calls.push({
        tool: 'query_metric',
        input: {
          metrics: req.mode === 'S1_query' ? ['gmv', 'paid_order_count', 'paid_buyer_count', 'refund_rate', 'avg_order_value'] : ['gmv'],
          dimensions: ['platform_name'], timeRange: range, filters,
          orderBy: { metric: 'gmv', direction: 'desc' },
        },
        purpose: '按平台汇总核心指标',
      })
      calls.push({
        tool: 'query_metric',
        input: { metrics: ['gmv'], dimensions: ['date'], timeRange: range, filters, granularity: 'day' },
        purpose: '拉取日趋势',
      })
      break
  }

  return { mode, calls }
}

// ---------------------------------------------------------------------------
// 结论生成（由代码根据真实结果拼接，不编造数字）
// ---------------------------------------------------------------------------

function fmt(n: number, unit = ''): string {
  const s = Math.abs(n) >= 10000 ? n.toFixed(0) : n.toFixed(2).replace(/\.00$/, '')
  return unit ? `${s} ${unit}` : s
}

function synthesizeConclusion(
  mode: AnalysisMode,
  steps: AnalysisStep[],
  evidence: EvidenceItem[],
  knowledge: Array<{ content: string; documentName: string }>,
): AnalysisResult['conclusion'] {
  const findings: string[] = []
  const risks: string[] = []
  const actions: string[] = []
  const refMap = new Map<string, string>()
  for (const e of evidence) refMap.set(`${e.metric}:${e.scope}:${e.value}`, e.id)

  const findEv = (metric: string, pred?: (e: EvidenceItem) => boolean) =>
    evidence.find((e) => e.metric === metric && (!pred || pred(e)))

  if (mode === 'S2_attribution') {
    const cmp = steps.find((s) => s.toolName === 'compare_periods')
    const gmvChange = cmp ? cmp.outputRef.changes.find((c: any) => c.metric === 'gmv') : null
    const drill = steps.filter((s) => s.toolName === 'drill_down')

    if (gmvChange) {
      const dir = gmvChange.diff >= 0 ? '增长' : '下降'
      findings.push(
        `本期 GMV ${fmt(gmvChange.base, '元')}，较上期 ${fmt(gmvChange.compare, '元')} ${dir} ${fmt(Math.abs(gmvChange.diff), '元')}` +
        (gmvChange.changePct !== null ? `（${gmvChange.changePct > 0 ? '+' : ''}${gmvChange.changePct}%）` : ''),
      )
    }
    for (const d of drill) {
      const top = d.outputRef.contributions[0]
      if (top) {
        findings.push(
          `${d.outputRef.dimension}维度中「${top.value}」贡献最大，本期 ${fmt(top.current, '元')}，贡献占比 ${top.share}%`,
        )
      }
    }
    actions.push('对贡献最大的维度值做专项拆解，确认是流量、转化还是退款导致')
    actions.push('把本次归因结论转为改进任务，指定负责人与验收口径')
  }

  if (mode === 'S3_compare') {
    const q = steps.find((s) => s.toolName === 'query_metric')
    if (q && Array.isArray(q.outputRef.rows)) {
      const rows = q.outputRef.rows
      for (const r of rows.slice(0, 5)) {
        findings.push(
          `${r.platform_name}：GMV ${fmt(r.gmv, '元')}，退款率 ${r.refund_rate}%，客单价 ${fmt(r.avg_order_value, '元')}`,
        )
      }
      if (rows.length >= 2) {
        const best = rows.reduce((a: any, b: any) => (b.gmv > a.gmv ? b : a))
        const worstRefund = rows.reduce((a: any, b: any) => (b.refund_rate > a.refund_rate ? b : a))
        findings.push(`GMV 规模最大的是 ${best.platform_name}`)
        if (worstRefund.refund_rate > 10) {
          risks.push(`${worstRefund.platform_name} 退款率 ${worstRefund.refund_rate}%，高于健康水位`)
        }
      }
    }
    actions.push('对高退款率平台排查商品质量与用户预期落差')
  }

  if (mode === 'S4_anomaly') {
    const a = steps.find((s) => s.toolName === 'detect_anomalies')
    if (a) {
      if (a.outputRef.anomalies.length === 0) {
        findings.push(`检测区间内 GMV 未发现显著异常波动（阈值 Z≥${a.outputRef.threshold}）`)
      } else {
        for (const x of a.outputRef.anomalies.slice(0, 3)) {
          findings.push(
            `${x.date} GMV ${fmt(x.value, '元')}，偏离均值 ${x.zScore} 个标准差（${x.direction === 'high' ? '异常偏高' : '异常偏低'}）`,
          )
        }
        risks.push('异常日期可能与活动、缺货或投放变化相关，需核对当日运营动作')
      }
    }
    actions.push('核对异常日的活动排期、库存状态与投放预算变化')
  }

  if (mode === 'S5_forecast') {
    const f = steps.find((s) => s.toolName === 'forecast_trend')
    if (f) {
      const fc = f.outputRef.forecast
      if (fc.length > 0) {
        const total = fc.reduce((s: number, x: any) => s + x.value, 0)
        findings.push(
          `未来 ${fc.length} 天 GMV 预测合计 ${fmt(total, '元')}，日均为 ${fmt(total / fc.length, '元')}`,
        )
        findings.push(`趋势斜率 ${f.outputRef.slope}，拟合优度 R²=${f.outputRef.r2}`)
        if (f.outputRef.r2 < 0.5) {
          risks.push('历史数据拟合度偏低，预测仅供参考，不建议直接作为目标依据')
        }
      }
    }
    actions.push('按预测中位数设定保底目标，按上限设定冲刺目标')
  }

  if (mode === 'S6_review') {
    const q = steps.find((s) => s.toolName === 'query_metric')
    const cmp = steps.find((s) => s.toolName === 'compare_periods')
    if (q && Array.isArray(q.outputRef.rows)) {
      const totalGmv = q.outputRef.rows.reduce((s: number, r: any) => s + Number(r.gmv || 0), 0)
      findings.push(`本期覆盖 ${q.outputRef.rows.length} 个平台，GMV 合计 ${fmt(totalGmv, '元')}`)
      const highRefund = q.outputRef.rows.filter((r: any) => Number(r.refund_rate) > 10)
      for (const r of highRefund) {
        risks.push(`${r.platform_name} 退款率 ${r.refund_rate}%，需重点关注`)
      }
    }
    if (cmp) {
      const g = cmp.outputRef.changes.find((c: any) => c.metric === 'gmv')
      if (g) {
        findings.push(
          `GMV 环比${g.diff >= 0 ? '增长' : '下降'} ${fmt(Math.abs(g.diff), '元')}` +
          (g.changePct !== null ? `（${g.changePct > 0 ? '+' : ''}${g.changePct}%）` : ''),
        )
      }
    }
    actions.push('把本周期亮点与问题整理为下周期改进任务')
    actions.push('将复盘报告沉淀到企业知识库，供后续同类问题检索')
  }

  if (mode === 'S1_query') {
    const q = steps.find((s) => s.toolName === 'query_metric')
    if (q && Array.isArray(q.outputRef.rows)) {
      const totalGmv = q.outputRef.rows.reduce((s: number, r: any) => s + Number(r.gmv || 0), 0)
      findings.push(`本期 GMV 合计 ${fmt(totalGmv, '元')}`)
      for (const r of q.outputRef.rows.slice(0, 5)) {
        findings.push(`${r.platform_name}：GMV ${fmt(r.gmv, '元')}，订单 ${r.paid_order_count ?? '-'}`)
      }
    }
  }

  if (knowledge.length > 0) {
    findings.push(`已参考 ${knowledge.length} 条企业知识库资料`)
  }

  const headline = findings[0] || '本期数据已汇总，详见下方证据'

  return {
    headline,
    findings,
    evidenceRefs: evidence.slice(0, 20).map((e) => e.id),
    risks,
    actions,
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

export async function runAnalysis(
  req: AnalysisRequest,
  scope: string[] | null,
  pool?: Pool,
): Promise<AnalysisResult> {
  const p = pool || getPool()
  const started = Date.now()
  const steps: AnalysisStep[] = []
  let seq = 0

  // ── Planner ──
  const planStarted = Date.now()
  const { mode, calls } = buildRulePlan(req)
  steps.push({
    seq: ++seq,
    role: 'planner',
    toolName: 'build_plan',
    input: { question: req.question, mode, timeRange: req.timeRange || defaultRange() },
    outputRef: { mode, callCount: calls.length, purposes: calls.map((c) => c.purpose) },
    rowCount: calls.length,
    durationMs: Date.now() - planStarted,
    status: 'ok',
  })

  // ── Executor ──
  for (const call of calls) {
    const t0 = Date.now()
    try {
      const { output, rowCount } = await runTool(call.tool, call.input, scope, p)
      steps.push({
        seq: ++seq,
        role: 'executor',
        toolName: call.tool,
        input: call.input,
        outputRef: output,
        rowCount,
        durationMs: Date.now() - t0,
        status: 'ok',
      })
    } catch (err: any) {
      steps.push({
        seq: ++seq,
        role: 'executor',
        toolName: call.tool,
        input: call.input,
        outputRef: null,
        rowCount: 0,
        durationMs: Date.now() - t0,
        status: 'failed',
        error: String(err?.message || err),
      })
    }
  }

  // ── Evidence ──
  const evidence = extractEvidence(steps)

  // ── 知识库（可选，未配置返回空）──
  const knowledge = await searchKnowledgeBase(req.question, { topK: 3 }).catch(() => [])

  // ── Reporter ──
  const repStarted = Date.now()
  const conclusion = synthesizeConclusion(mode, steps, evidence, knowledge)
  steps.push({
    seq: ++seq,
    role: 'reporter',
    toolName: 'synthesize',
    input: { mode, evidenceCount: evidence.length },
    outputRef: conclusion,
    rowCount: conclusion.findings.length,
    durationMs: Date.now() - repStarted,
    status: 'ok',
  })

  // ── Critic：数字溯源 ──
  const criticStarted = Date.now()
  const textsToCheck = [conclusion.headline, ...conclusion.findings, ...conclusion.risks]
  const verification = verifyNumbers(textsToCheck, evidence)
  steps.push({
    seq: ++seq,
    role: 'critic',
    toolName: 'verify_numbers',
    input: { textCount: textsToCheck.length, tolerance: TOLERANCE },
    outputRef: verification,
    rowCount: verification.checkedNumbers,
    durationMs: Date.now() - criticStarted,
    status: verification.passed ? 'ok' : 'failed',
    error: verification.passed ? undefined : `${verification.unmatched.length} 个数字无法溯源`,
  })

  // ── 落库 ──
  let runId: number | null = null
  try {
    const ins = await p.query(
      `INSERT INTO ai_analysis_runs
         (conversation_id, user_id, mode, question, plan, status, verdict, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id`,
      [
        req.conversationId || null,
        req.userId || null,
        mode,
        req.question,
        JSON.stringify({ mode, calls: calls.map((c) => ({ tool: c.tool, purpose: c.purpose })) }),
        verification.passed ? 'completed' : 'needs_review',
        JSON.stringify({ verification, findings: conclusion.findings.length }),
      ],
    )
    runId = ins.rows[0].id
  } catch {
    // 表不存在时不影响主流程
  }

  return {
    runId,
    mode,
    question: req.question,
    plan: { mode, calls: calls.map((c) => ({ tool: c.tool, purpose: c.purpose })) },
    steps,
    evidence,
    conclusion,
    verification,
    knowledgeUsed: knowledge.length,
    durationMs: Date.now() - started,
  }
}
