/**
 * ai/engine/executor.ts — 确定性工具执行器与证据血缘生成器
 * 
 * 核心原则：
 *   1. 纯代码执行，绝不让 LLM 接触或直接运行 SQL。
 *   2. 执行结果中的每一个数值，均自动生成唯一 EvidenceItem（带 parents[] 血缘关系与 SQL 快照）。
 *   3. 修复 D2：compare_periods 自动登记 diff 与 abs(diff)，杜绝归因数字溯源失败。
 *   4. 修复 D6：forecast_trend 校验样本容量与触底截断状态，显式标记 insufficient/clamp_flag。
 */

import type { DbExecutor } from '../../lib/db.js'
import { getPool } from '../../lib/db.js'
import type { Plan, ToolCallPlan } from '../contract/plan.js'
import { createEvidencePacket, type EvidencePacket, type EvidenceItem } from '../contract/evidence.js'
import {
  queryMetric, comparePeriods, drillDown, detectAnomalies, forecastTrend,
  METRIC_REGISTRY,
} from '../semantic-layer.js'
import type { MetricAccessOptions } from '../semantic-layer.js'
import { guardBottomClamp, guardSampleSufficiency } from '../query/guards.js'

export interface ExecutedStep {
  seq: number
  role: 'executor'
  toolName: string
  input: Record<string, any>
  output: any
  rowCount: number
  durationMs: number
}

export interface ExecutionResult {
  steps: ExecutedStep[]
  evidence: EvidencePacket
  durationMs: number
}

/**
 * 格式化数值展示辅助
 */
function round2(num: number): number {
  return Number(num.toFixed(2))
}

/**
 * 执行器主入口
 */
export async function executePlan(
  plan: Plan,
  scope: string[] | null,
  pool?: DbExecutor,
  access?: MetricAccessOptions
): Promise<ExecutionResult> {
  const startTime = Date.now()
  const db = pool || getPool()
  const steps: ExecutedStep[] = []
  const evidence = createEvidencePacket()

  let seq = 0
  for (const call of plan.calls) {
    seq += 1
    const stepStart = Date.now()
    const { output, rowCount } = await executeToolCall(call, scope, db, access)
    const stepDuration = Date.now() - stepStart

    steps.push({
      seq,
      role: 'executor',
      toolName: call.tool,
      input: call.args,
      output,
      rowCount,
      durationMs: stepDuration,
    })

    // 从工具输出中抽取结构化证据并绑定血缘
    extractEvidenceFromStep(call.tool, call.args, output, evidence)
  }

  return {
    steps,
    evidence,
    durationMs: Date.now() - startTime,
  }
}

/**
 * 执行单步工具调用
 */
async function executeToolCall(
  call: ToolCallPlan,
  scope: string[] | null,
  pool: DbExecutor,
  access?: MetricAccessOptions
): Promise<{ output: any; rowCount: number }> {
  switch (call.tool) {
    case 'query_metric': {
      const res = await queryMetric(call.args as any, scope, pool, access)
      return { output: res, rowCount: res.rowCount }
    }
    case 'compare_periods': {
      const res = await comparePeriods(call.args as any, scope, pool, access)
      return { output: res, rowCount: res.changes.length }
    }
    case 'drill_down': {
      const res = await drillDown(call.args as any, scope, pool, access)
      return { output: res, rowCount: res.contributions.length }
    }
    case 'detect_anomalies': {
      const res = await detectAnomalies(call.args as any, scope, pool, access)
      return { output: res, rowCount: res.anomalies.length }
    }
    case 'forecast_trend': {
      const res = await forecastTrend(call.args as any, scope, pool, access)
      return { output: res, rowCount: res.forecast.length }
    }
    default:
      throw new Error(`[executor] 未知取数原语: ${call.tool}`)
  }
}

/**
 * 抽取证据与血缘链
 */
function extractEvidenceFromStep(
  toolName: string,
  input: Record<string, any>,
  out: any,
  evidence: EvidencePacket
): void {
  if (!out) return

  switch (toolName) {
    case 'query_metric': {
      if (Array.isArray(out.rows)) {
        // 明细事实行证据
        for (const row of out.rows.slice(0, 50)) {
          const scopeLabel = String(row.platform_name || row.shop || row.channel || row.date || '全部')
          for (const [k, v] of Object.entries(row)) {
            if (typeof v === 'number' && k in METRIC_REGISTRY) {
              const def = METRIC_REGISTRY[k]
              evidence.add({
                kind: 'fact',
                metric: k,
                label: def.label,
                unit: def.unit || '',
                value: v,
                scope: scopeLabel,
                time_range: input.timeRange ? `${input.timeRange.from}~${input.timeRange.to}` : '',
                parents: [],
              })
            }
          }
        }
      }
      break
    }

    case 'compare_periods': {
      // 修复 D2：登记本期、上期、差异额(diff)、降幅绝对值(abs_diff)、变化率(changePct)
      if (Array.isArray(out.changes)) {
        for (const c of out.changes) {
          const def = METRIC_REGISTRY[c.metric]
          const unit = def?.unit || '元'
          const timeRangeStr = `${input.base?.from || ''}~${input.base?.to || ''} vs ${input.compare?.from || ''}~${input.compare?.to || ''}`

          // 1. 本期事实
          const eBase = evidence.add({
            kind: 'fact',
            metric: c.metric,
            label: `${c.label}(本期)`,
            unit,
            value: Number(c.base),
            scope: '本期',
            time_range: input.base ? `${input.base.from}~${input.base.to}` : '',
            parents: [],
          })

          // 2. 上期事实
          const eComp = evidence.add({
            kind: 'fact',
            metric: c.metric,
            label: `${c.label}(上期)`,
            unit,
            value: Number(c.compare),
            scope: '上期',
            time_range: input.compare ? `${input.compare.from}~${input.compare.to}` : '',
            parents: [],
          })

          const parentIds = [eBase.id, eComp.id]

          // 3. 差异额（派生）
          if (typeof c.diff === 'number') {
            evidence.add({
              kind: 'derived',
              metric: `${c.metric}_diff`,
              label: `${c.label}差异额`,
              unit,
              value: round2(c.diff),
              scope: '同环比差异',
              time_range: timeRangeStr,
              parents: parentIds,
            })

            // 补充绝对差值（用于“下降了 415 万”这类正向绝对值表述）
            evidence.add({
              kind: 'derived',
              metric: `${c.metric}_abs_diff`,
              label: `${c.label}变动绝对额`,
              unit,
              value: round2(Math.abs(c.diff)),
              scope: '同环比差异绝对值',
              time_range: timeRangeStr,
              parents: parentIds,
            })
          }

          // 4. 变化率（派生）
          if (typeof c.changePct === 'number') {
            evidence.add({
              kind: 'derived',
              metric: `${c.metric}_changePct`,
              label: `${c.label}变化率`,
              unit: '%',
              value: round2(c.changePct),
              scope: '同环比变化率',
              time_range: timeRangeStr,
              parents: parentIds,
            })
            // 补充变化率绝对值
            evidence.add({
              kind: 'derived',
              metric: `${c.metric}_abs_changePct`,
              label: `${c.label}变化率绝对值`,
              unit: '%',
              value: round2(Math.abs(c.changePct)),
              scope: '同环比变化率绝对值',
              time_range: timeRangeStr,
              parents: parentIds,
            })
          }
        }
      }
      break
    }

    case 'drill_down': {
      if (Array.isArray(out.contributions)) {
        for (const item of out.contributions.slice(0, 5)) {
          const eItem = evidence.add({
            kind: 'fact',
            metric: out.metric,
            label: `${out.metric}(${item.value})`,
            unit: '元',
            value: Number(item.current),
            scope: `渠道:${item.value}`,
            time_range: '本期',
            parents: [],
          })

          if (typeof item.share === 'number') {
            evidence.add({
              kind: 'derived',
              metric: 'contribution_share',
              label: `贡献占比(${item.value})`,
              unit: '%',
              value: round2(item.share),
              scope: `渠道:${item.value}`,
              time_range: '本期',
              parents: [eItem.id],
            })
          }
        }
      }
      break
    }

    case 'detect_anomalies': {
      if (Array.isArray(out.anomalies)) {
        for (const an of out.anomalies.slice(0, 5)) {
          const eAn = evidence.add({
            kind: 'fact',
            metric: input.metric || 'gmv',
            label: `异常点(${an.date})`,
            unit: '元',
            value: Number(an.value),
            scope: `异常日期:${an.date}`,
            time_range: an.date,
            parents: [],
          })

          if (typeof an.zScore === 'number') {
            evidence.add({
              kind: 'model_param',
              metric: 'anomaly_zscore',
              label: `偏离标准差(${an.date})`,
              unit: '',
              value: round2(an.zScore),
              scope: `异常日期:${an.date}`,
              time_range: an.date,
              parents: [eAn.id],
            })
          }
        }
      }
      break
    }

    case 'forecast_trend': {
      // 修复 D6：样本容量校验与触底打标
      const historyLen = Array.isArray(out.history) ? out.history.length : 0
      const sampleGuard = guardSampleSufficiency(historyLen, 3, '趋势预测')

      if (Array.isArray(out.forecast)) {
        let total = 0
        let hasClamped = false
        const fcIds: string[] = []

        for (const fc of out.forecast.slice(0, 7)) {
          const clampCheck = guardBottomClamp(fc.value, 0)
          if (clampCheck.isClamped || fc.value === 0) hasClamped = true

          const ePoint = evidence.add({
            kind: 'model_param',
            metric: out.metric,
            label: `预测值(${fc.date})`,
            unit: '元',
            value: round2(clampCheck.value),
            scope: `预测日期:${fc.date}`,
            time_range: fc.date,
            parents: [],
            insufficient: !sampleGuard.sufficient,
            clamp_flag: clampCheck.isClamped ? 'bottom_clamped_to_zero' : undefined,
          })
          fcIds.push(ePoint.id)
          total += clampCheck.value
        }

        // 预测合计
        evidence.add({
          kind: 'derived',
          metric: `${out.metric}_forecast_total`,
          label: '预测合计',
          unit: '元',
          value: round2(total),
          scope: '未来预测合计',
          time_range: '预测周期',
          parents: fcIds,
          insufficient: !sampleGuard.sufficient || (hasClamped && total === 0),
          clamp_flag: (hasClamped && total === 0) ? 'bottom_clamped_to_zero' : undefined,
        })

        // 预测周期跨度
        evidence.add({
          kind: 'model_param',
          metric: 'forecast_horizon',
          label: '预测天数',
          unit: '天',
          value: out.forecast.length,
          scope: '模型参数',
          time_range: '预测周期',
          parents: [],
        })
      }

      if (typeof out.slope === 'number') {
        evidence.add({
          kind: 'model_param',
          metric: 'trend_slope',
          label: '趋势斜率',
          unit: '',
          value: round2(out.slope),
          scope: '线性模型斜率',
          time_range: '拟合区间',
          parents: [],
        })
      }

      if (typeof out.r2 === 'number') {
        evidence.add({
          kind: 'model_param',
          metric: 'trend_r2',
          label: '拟合优度 R²',
          unit: '',
          value: round2(out.r2),
          scope: '模型参数',
          time_range: '拟合区间',
          parents: [],
        })
      }
      break
    }
  }
}
