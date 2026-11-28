/**
 * ai/run/format.ts — 分析结果 → Markdown 的统一渲染
 *
 * 旧 /ai/chat 路由与新的 Run Engine 共用同一套渲染，避免两处格式漂移。
 */

export interface FormattableConclusion {
  headline: string
  findings?: string[]
  risks?: string[]
  actions?: string[]
}

export interface FormattableVerification {
  passed: boolean
  checkedNumbers: number
  matched: number
  unmatched?: string[]
}

export function formatAnalysisToMarkdown(result: {
  conclusion: FormattableConclusion
  verification: FormattableVerification
}): string {
  const { conclusion, verification } = result
  const lines: string[] = []

  lines.push(`### 💡 核心结论\n**${conclusion.headline}**\n`)

  if (conclusion.findings && conclusion.findings.length > 0) {
    lines.push('#### 📊 关键业务指标')
    for (const f of conclusion.findings) {
      lines.push(`- ${f}`)
    }
    lines.push('')
  }

  if (conclusion.risks && conclusion.risks.length > 0) {
    lines.push('#### ⚠️ 风险与异动识别')
    for (const r of conclusion.risks) {
      lines.push(`- ${r}`)
    }
    lines.push('')
  }

  if (conclusion.actions && conclusion.actions.length > 0) {
    lines.push('#### 🎯 经营决策建议')
    for (const a of conclusion.actions) {
      lines.push(`1. ${a}`)
    }
    lines.push('')
  }

  const verifyText = verification.passed
    ? `🛡️ **数据真实性核验**：全量 ${verification.checkedNumbers} 个核心数据指标 100% 溯源通过（零大模型幻觉计算）`
    : `🛡️ **数据真实性核验**：${verification.matched}/${verification.checkedNumbers} 个指标已核验`
  lines.push(`> [!NOTE]\n> ${verifyText}\n`)

  return lines.join('\n')
}
