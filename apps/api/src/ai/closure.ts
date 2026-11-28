/**
 * closure.ts — 分析闭环（P5）
 *
 * 对齐计划第八章「可行动」要求与里程碑 P5：
 *   - 一键把分析结论转为改进任务（写入 improvement_tasks，保留来源追溯）
 *   - 一键把复盘报告沉淀到企业知识库（未配置时明确返回未沉淀，不假装成功）
 *   - 生成结构化复盘报告（Markdown）
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { uploadToKnowledgeBaseStrict } from '../lib/kb-client.js'
import { resolveScope } from './semantic-layer.js'
import { runAnalysis, type AnalysisMode } from './orchestrator.js'

// ---------------------------------------------------------------------------
// 一键转改进任务
// ---------------------------------------------------------------------------

export interface ConvertToTaskInput {
  runId?: number
  title: string
  description?: string
  assignee?: string
  priority?: 'high' | 'medium' | 'low'
  dueDate?: string
  /** 来源分析的问题，便于追溯 */
  sourceQuestion?: string
}

export interface ConvertedTask {
  id: number
  title: string
  assignee: string
  priority: string
  dueDate: string
  source: string
  sourceId: string | null
}

/** 把一条行动建议转成改进任务 */
export async function convertFindingsToTasks(
  input: ConvertToTaskInput,
  pool?: DbExecutor,
): Promise<ConvertedTask> {
  const p = pool || getPool()
  const priority = input.priority || 'medium'
  const dueDate = input.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const sourceId = input.runId ? `analysis_run:${input.runId}` : null
  const description = [
    input.description || '',
    input.sourceQuestion ? `\n\n来源分析问题：${input.sourceQuestion}` : '',
    input.runId ? `\n分析记录：/ai/workbench (run #${input.runId})` : '',
  ].join('').trim()

  const { rows } = await p.query(
    `INSERT INTO improvement_tasks
       (title, description, assignee, priority, source, source_id, due_date, status, progress)
     VALUES ($1, $2, $3, $4, 'ai_analysis', $5, $6::date, 'pending', 0)
     RETURNING id, title, assignee, priority, due_date, source, source_id`,
    [input.title.slice(0, 200), description, input.assignee || '运营团队', priority, sourceId, dueDate],
  )

  const t = rows[0]
  return {
    id: t.id,
    title: t.title,
    assignee: t.assignee,
    priority: t.priority,
    dueDate: t.due_date,
    source: t.source,
    sourceId: t.source_id,
  }
}

/** 批量把分析结论的所有行动建议转为任务 */
export async function convertAllActions(
  actions: string[],
  meta: { runId?: number; sourceQuestion?: string; assignee?: string; priority?: 'high' | 'medium' | 'low' },
  pool?: DbExecutor,
): Promise<ConvertedTask[]> {
  const out: ConvertedTask[] = []
  for (const a of actions) {
    if (!a || a.trim().length === 0) continue
    out.push(
      await convertFindingsToTasks(
        {
          runId: meta.runId,
          title: a.length > 100 ? a.slice(0, 97) + '…' : a,
          description: a,
          assignee: meta.assignee,
          priority: meta.priority,
          sourceQuestion: meta.sourceQuestion,
        },
        pool,
      ),
    )
  }
  return out
}

// ---------------------------------------------------------------------------
// 复盘报告生成
// ---------------------------------------------------------------------------

export interface ReviewReport {
  title: string
  markdown: string
  range: { from: string; to: string }
  runId: string | number | null
  verificationPassed: boolean
  assets: {
    findings: number
    risks: number
    actions: number
    evidence: number
  }
}

/** 生成结构化复盘报告（Markdown），数字全部来自语义层 */
export async function generateReviewReport(
  input: {
    timeRange: { from: string; to: string }
    role?: string
    userId?: number
    filters?: { platform?: string; shopId?: number }
  },
  pool?: DbExecutor,
): Promise<ReviewReport> {
  const p = pool || getPool()
  const scope = await resolveScope(p, input.role)

  const result = await runAnalysis(
    {
      question: '生成本期经营复盘报告',
      mode: 'S6_review' as AnalysisMode,
      timeRange: input.timeRange,
      filters: input.filters,
      role: input.role,
      userId: input.userId,
    },
    scope,
    p,
  )

  const { from, to } = input.timeRange
  const lines: string[] = []

  lines.push(`# 经营复盘报告（${from} ~ ${to}）`)
  lines.push('')
  lines.push(`> 生成时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`)
  lines.push(`> 数据口径：以下所有数字均来自系统事实表，可在「数据凭证」中逐条核对`)
  lines.push(`> 数字溯源：${result.verification.passed ? '✅ 全部通过' : `⚠️ ${result.verification.unmatched.length} 个未命中`}`)
  lines.push('')

  lines.push('## 一、核心结论')
  lines.push('')
  lines.push(`**${result.conclusion.headline}**`)
  lines.push('')

  lines.push('## 二、主要发现')
  lines.push('')
  for (const f of result.conclusion.findings) lines.push(`- ${f}`)
  lines.push('')

  if (result.conclusion.risks.length > 0) {
    lines.push('## 三、风险提示')
    lines.push('')
    for (const r of result.conclusion.risks) lines.push(`- ⚠️ ${r}`)
    lines.push('')
  }

  if (result.conclusion.actions.length > 0) {
    lines.push('## 四、行动建议')
    lines.push('')
    result.conclusion.actions.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
    lines.push('')
  }

  lines.push('## 五、数据凭证')
  lines.push('')
  lines.push('| 编号 | 指标 | 数值 | 单位 | 范围 |')
  lines.push('| --- | --- | ---: | --- | --- |')
  for (const e of result.evidence) {
    lines.push(`| ${e.id} | ${e.label} | ${e.value} | ${e.unit} | ${e.scope} |`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*本报告由系统自动生成，分析建议仅供参考，不构成财务结论。*')

  return {
    title: `经营复盘报告 ${from}~${to}`,
    markdown: lines.join('\n'),
    range: input.timeRange,
    runId: result.runId,
    verificationPassed: result.verification.passed,
    assets: {
      findings: result.conclusion.findings.length,
      risks: result.conclusion.risks.length,
      actions: result.conclusion.actions.length,
      evidence: result.evidence.length,
    },
  }
}

// ---------------------------------------------------------------------------
// 沉淀到知识库
// ---------------------------------------------------------------------------

export interface ArchiveResult {
  archived: boolean
  documentId: string | null
  reason?: string
}

/** 把复盘报告推送到企业知识库；未配置时明确告知，不假装成功 */
export async function archiveReportToKb(
  title: string,
  markdown: string,
  metadata: Record<string, any> = {},
): Promise<ArchiveResult> {
  const res = await uploadToKnowledgeBaseStrict(title, markdown, {
    ...metadata,
    source: 'leyova_ai_review',
    generatedAt: new Date().toISOString(),
  })

  if (res.notConfigured) {
    return {
      archived: false,
      documentId: null,
      reason: '企业知识库未配置（provider=none 或缺少地址/Key），报告未沉淀。可在「内容中心配置」中接入 RAGFlow/MaxKB 后重试。',
    }
  }
  if (!res.ok) {
    return {
      archived: false,
      documentId: null,
      reason: `知识库已配置但沉淀失败：${res.error || '未知错误'}`,
    }
  }
  return { archived: true, documentId: res.documentId }
}
