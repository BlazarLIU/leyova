/**
 * ai/engine/reporter/template.ts — 确定性结构化表达器 (Template Reporter)
 * 
 * 作用：
 *   基于 Plan、执行步骤和证据包，合成符合 ClaimPacketSchema 的结构化断言。
 *   严格要求每一个带有业务数值的句子，必须绑定产生该数值的 evidence_ids。
 */

import type { Plan } from '../../contract/plan.js'
import type { EvidencePacket, EvidenceItem } from '../../contract/evidence.js'
import type { ClaimPacket, ClaimItem } from '../../contract/claim.js'
import type { ExecutedStep } from '../executor.js'

function formatMoney(num: number): string {
  if (Math.abs(num) >= 100000000) return `${(num / 100000000).toFixed(2)} 亿元`
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(2)} 万元`
  return `${num.toFixed(2)} 元`
}

/**
 * 模板表达器主函数
 */
export function synthesizeTemplateReport(
  plan: Plan,
  steps: ExecutedStep[],
  evidence: EvidencePacket
): ClaimPacket {
  const claims: ClaimItem[] = []
  const risks: string[] = []
  const actions: string[] = []
  const caveats: string[] = []

  let headline = '数据分析完成'

  switch (plan.intent) {
    case 'attribute': {
      // S2 归因
      const compStep = steps.find((s) => s.toolName === 'compare_periods')
      if (compStep && Array.isArray(compStep.output?.changes)) {
        for (const c of compStep.output.changes) {
          // 查找该 metric 对应的证据项
          const evBase = evidence.items.find((e) => e.metric === c.metric && e.scope === '本期')
          const evComp = evidence.items.find((e) => e.metric === c.metric && e.scope === '上期')
          const evDiff = evidence.items.find((e) => e.metric === `${c.metric}_diff`)
          const evAbsDiff = evidence.items.find((e) => e.metric === `${c.metric}_abs_diff`)
          const evPct = evidence.items.find((e) => e.metric === `${c.metric}_changePct`)

          const citedIds: string[] = []
          if (evBase) citedIds.push(evBase.id)
          if (evComp) citedIds.push(evComp.id)
          if (evDiff) citedIds.push(evDiff.id)
          if (evAbsDiff) citedIds.push(evAbsDiff.id)
          if (evPct) citedIds.push(evPct.id)

          const direction = c.diff >= 0 ? '增长' : '下降'
          const diffText = `${Math.abs(c.diff).toFixed(2)} 元`
          const pctText = typeof c.changePct === 'number' ? ` (${c.changePct >= 0 ? '+' : ''}${c.changePct.toFixed(2)}%)` : ''

          const text = `${c.label}本期为 ${c.base.toFixed(2)} 元，上期为 ${c.compare.toFixed(2)} 元，${direction} ${diffText}${pctText}`
          claims.push({
            text,
            evidence_ids: citedIds,
            kind: 'derived',
          })

          if (c.metric === 'gmv') {
            headline = `周期 GMV ${direction} ${diffText}${pctText}`
            if (c.diff < 0) {
              risks.push(`GMV 较上期下降 ${diffText}，需核查各渠道流量及转化率异常`)
              actions.push('调取下钻渠道贡献，定向扶持核心下滑店铺与场次')
            }
          }
        }
      }

      // 渠道下钻贡献
      const drillStep = steps.find((s) => s.toolName === 'drill_down')
      if (drillStep && Array.isArray(drillStep.output?.contributions)) {
        for (const item of drillStep.output.contributions.slice(0, 3)) {
          const evItem = evidence.items.find((e) => e.scope === `渠道:${item.value}` && e.kind === 'fact')
          const evShare = evidence.items.find((e) => e.scope === `渠道:${item.value}` && e.kind === 'derived')
          const cited = [evItem?.id, evShare?.id].filter(Boolean) as string[]

          claims.push({
            text: `渠道「${item.value}」贡献值为 ${Number(item.current).toFixed(2)} 元，占比 ${Number(item.share).toFixed(2)}%`,
            evidence_ids: cited,
            kind: 'derived',
          })
        }
      }
      break
    }

    case 'forecast': {
      // S5 趋势外推
      const fcStep = steps.find((s) => s.toolName === 'forecast_trend')
      if (fcStep && fcStep.output) {
        const fc = fcStep.output.forecast || []
        const slope = fcStep.output.slope
        const r2 = fcStep.output.r2

        const evTotal = evidence.items.find((e) => e.metric.endsWith('_forecast_total'))
        const evSlope = evidence.items.find((e) => e.metric === 'trend_slope')
        const evR2 = evidence.items.find((e) => e.metric === 'trend_r2')
        const evHorizon = evidence.items.find((e) => e.metric === 'forecast_horizon')

        const cited: string[] = [evTotal?.id, evSlope?.id, evR2?.id, evHorizon?.id].filter(Boolean) as string[]

        if (evTotal && evTotal.clamp_flag === 'bottom_clamped_to_zero') {
          caveats.push('历史走势斜率为负且降幅剧烈，外推预测触发零值保护截断，请结合促销档期做人工修正。')
        }

        const totalVal = evTotal ? evTotal.value : fc.reduce((s: number, x: any) => s + x.value, 0)
        headline = `未来 ${fc.length} 天 GMV 预测合计 ${formatMoney(totalVal)}`
        
        claims.push({
          text: `未来 ${fc.length} 天 GMV 预测合计为 ${totalVal.toFixed(2)} 元，趋势斜率 ${slope}，拟合度 R²=${r2}`,
          evidence_ids: cited,
          kind: 'derived',
        })

        if (r2 < 0.5) {
          risks.push('历史时序波动剧烈，R² 拟合优度较低，建议仅作为动态参考')
        }
        actions.push('按预测中位线制定库存调拨，对薄弱时段增加投流测试')
      }
      break
    }

    case 'anomaly': {
      // S4 异常探测
      const anStep = steps.find((s) => s.toolName === 'detect_anomalies')
      if (anStep && anStep.output) {
        const anomalies = anStep.output.anomalies || []
        if (anomalies.length === 0) {
          headline = '未探测到显著偏离均值的异常波动'
          claims.push({
            text: '在指定周期内，核心指标运行平稳，未探测到显著离群波动点',
            evidence_ids: [],
            kind: 'judgement',
          })
        } else {
          headline = `探测到 ${anomalies.length} 处指标异常点`
          for (const an of anomalies.slice(0, 3)) {
            const evPoint = evidence.items.find((e) => e.time_range === an.date && e.kind === 'fact')
            const evZ = evidence.items.find((e) => e.time_range === an.date && e.kind === 'model_param')
            const cited = [evPoint?.id, evZ?.id].filter(Boolean) as string[]

            claims.push({
              text: `${an.date} 观测值 ${Number(an.value).toFixed(2)} 元，偏离均值 ${Number(an.zScore).toFixed(2)} 个标准差`,
              evidence_ids: cited,
              kind: 'derived',
            })
          }
          risks.push('异常点可能受大促脉冲、直播断流或投放预算突变影响')
          actions.push('针对异常日期的排期与投流回执进行专项复核')
        }
      }
      break
    }

    case 'review':
    case 'compare':
    case 'query':
    default: {
      // S1 / S3 / S6 问数与盘点
      const queryStep = steps.find((s) => s.toolName === 'query_metric')
      if (queryStep && Array.isArray(queryStep.output?.rows) && queryStep.output.rows.length > 0) {
        const rows = queryStep.output.rows
        const metrics: string[] = queryStep.input?.metrics || (queryStep.output as any)?.metrics || ['gmv']

        // 挑选核心指标制作结论
        const topRow = rows[0]
        const topEntity = topRow.platform_name || topRow.channel || topRow.shop || topRow.date || '整体'
        
        const citedFirst: string[] = []
        for (const m of metrics) {
          const ev = evidence.items.find((e) => e.metric === m && (e.scope === topEntity || e.scope === '全部'))
          if (ev) citedFirst.push(ev.id)
        }

        headline = `${topEntity} ${metrics.map((m: string) => `${m}: ${topRow[m] ?? '-'}`).join('，')}`

        for (const row of rows.slice(0, 5)) {
          const scopeLabel = row.platform_name || row.channel || row.shop || row.date || '全部'
          for (const m of metrics) {
            const ev = evidence.items.find((e) => e.metric === m && e.scope === scopeLabel)
            if (ev && typeof row[m] === 'number') {
              claims.push({
                text: `${scopeLabel} ${ev.label}为 ${Number(row[m]).toFixed(2)} ${ev.unit}`,
                evidence_ids: [ev.id],
                kind: 'fact',
              })
            }
          }
        }

        actions.push('监控核心指标日度波动，根据各渠道表现分配资源')
      } else {
        headline = '未查询到符合筛选条件的数据'
        claims.push({
          text: '当前时间区间或过滤条件下暂无业务明细记录',
          evidence_ids: [],
          kind: 'judgement',
        })
      }
      break
    }
  }

  return {
    headline,
    claims,
    risks,
    actions,
    caveats,
    engine: plan.engine,
    verdict: 'verified',
  }
}
