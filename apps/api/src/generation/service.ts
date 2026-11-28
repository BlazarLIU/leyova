/**
 * generation/service.ts — 生成链路与审核
 *
 * 流程（顺序不可调换）：
 *   1. 取模板与实际使用版本（支持灰度）
 *   2. 知识召回（W9 本地平台优先，外部兜底）
 *   3. 渲染模板 → 调用模型网关
 *   4. 生成后立刻过违禁词 DFA 闸门：block 直接落 blocked，不允许进审核
 *   5. 落草稿（含引用、合规命中、成本、耗时）
 *   6. 人工采纳后才写入 script_library
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { generate } from '../ai/llm/gateway.js'
import { searchKnowledge } from '../knowledge/service.js'
import { scanBannedWords } from '../knowledge/service.js'
import {
  getTemplate,
  getVersion,
  missingVariables,
  pickVersion,
  renderTemplate,
} from './prompts.js'

export interface GenerateInput {
  tenantId: number
  templateKey: string
  variables: Record<string, unknown>
  platform?: string
  businessKey?: string
  title?: string
  userId?: number | null
  role?: string
  /** 强制使用指定版本（缺省按灰度策略选择） */
  version?: number
  db?: DbExecutor
  /** 测试注入：替换模型调用（默认走网关） */
  generateFn?: typeof generate
}

export interface GenerateResult {
  draftId: string
  templateKey: string
  templateVersion: number
  isCanary: boolean
  title: string
  content: string
  citations: Array<{ chunkId: string; documentName: string; snippet: string; score: number }>
  compliance: {
    blocked: boolean
    hits: Array<{ word: string; category: string; severity: string; action: string }>
    ruleCount: number
  }
  status: string
  model: string
  tokensUsed: number
  costCny: number
  latencyMs: number
  degraded: boolean
  degradedReason?: string
}

const MAX_KNOWLEDGE_SNIPPET = 600
const MAX_CITATIONS = 6

function buildKnowledgeBlock(hits: Array<{ documentName: string; content: string; score: number }>): string {
  if (hits.length === 0) return '（无可用知识片段，请仅依据商品信息生成，不要编造参数）'
  return hits
    .map((hit, index) => `[${index + 1}] 《${hit.documentName}》：${hit.content.slice(0, MAX_KNOWLEDGE_SNIPPET)}`)
    .join('\n')
}

/** 生成主流程 */
export async function generateDraft(input: GenerateInput): Promise<GenerateResult> {
  const executor = input.db || getPool()
  const template = await getTemplate(input.tenantId, input.templateKey, executor)
  if (!template) throw new Error(`提示词模板不存在：${input.templateKey}`)
  if (template.status !== 'active') throw new Error('模板已归档，无法生成')

  const missing = missingVariables(template, input.variables)
  if (missing.length > 0) throw new Error(`缺少必填变量：${missing.join('、')}`)

  const seed = String(input.businessKey || input.variables.product || input.templateKey)
  const picked = input.version
    ? { version: input.version, isCanary: false }
    : pickVersion(template, seed)

  const version = await getVersion(input.tenantId, input.templateKey, picked.version, executor)
  if (!version) throw new Error(`提示词版本不存在：v${picked.version}`)

  // 1) 知识召回
  const queryParts = [
    String(input.variables.product || ''),
    String(input.variables.audience || ''),
    template.name,
  ].filter(Boolean)
  const retrieval = await searchKnowledge({
    tenantId: input.tenantId,
    query: queryParts.join(' '),
    role: input.role,
    topK: MAX_CITATIONS,
    db: executor,
  }).catch(() => ({ hits: [] as any[], mode: 'keyword' as const, degraded: true, tookMs: 0 }))

  const citations = retrieval.hits.map((hit) => ({
    chunkId: hit.chunkId,
    documentName: hit.documentName,
    snippet: hit.content.slice(0, 300),
    score: Number(hit.score) || 0,
  }))

  // 2) 渲染与调用
  const variables = { ...input.variables, knowledge: buildKnowledgeBlock(retrieval.hits) }
  const systemPrompt = renderTemplate(version.systemPrompt, variables)
  const userPrompt = renderTemplate(version.userTemplate, variables)

  const started = Date.now()
  const runGenerate = input.generateFn || generate
  const gateway = await runGenerate(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { tenantId: input.tenantId, temperature: 0.4, maxTokens: 1600, db: executor }
  )

  const latencyMs = Date.now() - started
  const content = gateway.result?.reply?.trim() || ''
  const degraded = Boolean(gateway.usedFallback)
  // 模型不可用时不允许产出空草稿进审核队列：直接报错，避免「空内容被采纳」
  if (!content) {
    throw new Error(
      gateway.reason === 'not_configured' || gateway.reason === 'all_profiles_failed'
        ? '模型不可用，未生成内容：请先在「系统配置 → AI 模型」或「集成中心」配置可用模型'
        : '模型返回为空，请稍后重试'
    )
  }

  // 3) 合规闸门（即使生成降级也要扫描，避免空内容绕过）
  const compliance = await scanBannedWords({
    tenantId: input.tenantId,
    text: content,
    platform: input.platform || template.platform,
    db: executor,
  })
  const blocked = compliance.blocked
  const status = blocked ? 'blocked' : 'pending_review'

  const title = String(input.title || `${template.name} · ${String(input.variables.product || seed)}`).slice(0, 255)

  const { rows } = await executor.query<{ id: string }>(
    `INSERT INTO public.ai_generation_drafts
       (tenant_id, template_id, template_key, template_version, scene, platform, business_key,
        title, content, inputs, citations, compliance, status, model, tokens_used, cost_cny,
        latency_ms, degraded, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15, $16, $17, $18, $19)
     RETURNING id`,
    [
      input.tenantId,
      template.id,
      input.templateKey,
      picked.version,
      template.scene,
      input.platform || template.platform,
      String(input.businessKey || '').slice(0, 120),
      title,
      content,
      JSON.stringify(input.variables),
      JSON.stringify(citations),
      JSON.stringify({
        blocked,
        hits: compliance.matched.map((m) => ({
          word: m.word,
          category: m.category,
          severity: m.severity,
          action: m.action,
        })),
        ruleCount: compliance.ruleCount,
        scannedAt: new Date().toISOString(),
      }),
      status,
      gateway.result?.model || '',
      (gateway.result?.inputTokens || 0) + (gateway.result?.outputTokens || 0),
      gateway.result?.costCny || 0,
      latencyMs,
      degraded,
      input.userId ?? null,
    ]
  )

  return {
    draftId: rows[0].id,
    templateKey: input.templateKey,
    templateVersion: picked.version,
    isCanary: picked.isCanary,
    title,
    content,
    citations,
    compliance: {
      blocked,
      hits: compliance.matched.map((m) => ({
        word: m.word,
        category: m.category,
        severity: m.severity,
        action: m.action,
      })),
      ruleCount: compliance.ruleCount,
    },
    status,
    model: gateway.result?.model || '',
    tokensUsed: (gateway.result?.inputTokens || 0) + (gateway.result?.outputTokens || 0),
    costCny: gateway.result?.costCny || 0,
    latencyMs,
    degraded,
    degradedReason: gateway.reason || gateway.fallbackReason,
  }
}

export interface DraftView {
  id: string
  templateKey: string
  templateVersion: number
  scene: string
  platform: string
  businessKey: string
  title: string
  content: string
  citations: unknown[]
  compliance: Record<string, unknown>
  status: string
  reviewNote: string
  model: string
  tokensUsed: number
  costCny: number
  latencyMs: number
  degraded: boolean
  finalScriptId: number | null
  createdAt: string
}

export async function listDrafts(
  tenantId: number,
  options: { status?: string; templateKey?: string; limit?: number } = {},
  db?: DbExecutor
): Promise<DraftView[]> {
  const executor = db || getPool()
  const limit = Math.min(100, Math.max(1, options.limit || 30))
  const params: unknown[] = [tenantId]
  let where = 'tenant_id = $1'
  if (options.status) {
    params.push(options.status)
    where += ` AND status = $${params.length}`
  }
  if (options.templateKey) {
    params.push(options.templateKey)
    where += ` AND template_key = $${params.length}`
  }
  params.push(limit)

  const { rows } = await executor.query<any>(
    `SELECT id, template_key, template_version, scene, platform, business_key, title, content,
            citations, compliance, status, review_note, model, tokens_used, cost_cny,
            latency_ms, degraded, final_script_id, created_at
       FROM public.ai_generation_drafts
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params
  )

  return rows.map((row) => ({
    id: row.id,
    templateKey: row.template_key,
    templateVersion: Number(row.template_version) || 0,
    scene: row.scene,
    platform: row.platform,
    businessKey: row.business_key,
    title: row.title,
    content: row.content,
    citations: Array.isArray(row.citations) ? row.citations : [],
    compliance: (row.compliance || {}) as Record<string, unknown>,
    status: row.status,
    reviewNote: row.review_note,
    model: row.model,
    tokensUsed: Number(row.tokens_used) || 0,
    costCny: Number(row.cost_cny) || 0,
    latencyMs: Number(row.latency_ms) || 0,
    degraded: Boolean(row.degraded),
    finalScriptId: row.final_script_id ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

export interface ReviewInput {
  tenantId: number
  draftId: string
  decision: 'approve' | 'reject'
  note?: string
  userId?: number | null
  /** 采纳时是否同步写入 script_library（默认 true） */
  writeToLibrary?: boolean
  db?: DbExecutor
}

export interface ReviewResult {
  draftId: string
  status: string
  scriptId: number | null
}

/**
 * 人工审核：
 *   - blocked 草稿禁止采纳（合规硬闸门，不允许人工绕过）；
 *   - 采纳可选写入 script_library，形成从生成到话术库的闭环。
 */
export async function reviewDraft(input: ReviewInput): Promise<ReviewResult> {
  const executor = input.db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT id, status, title, content, business_key FROM public.ai_generation_drafts
      WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [input.tenantId, input.draftId]
  )
  const draft = rows[0]
  if (!draft) throw new Error('草稿不存在')
  if (draft.status === 'blocked') throw new Error('该草稿命中合规阻断词，不可采纳，请重新生成')

  let scriptId: number | null = null
  const nextStatus = input.decision === 'approve' ? 'approved' : 'rejected'

  if (input.decision === 'approve' && input.writeToLibrary !== false) {
    // script_library 无 tenant_id 列，沿用既有全局话术库
    const inserted = await executor.query<{ id: number }>(
      `INSERT INTO public.script_library (title, category, content, use_count, likes)
       VALUES ($1, $2, $3, 0, 0) RETURNING id`,
      [draft.title, 'AI生成', draft.content]
    )
    scriptId = Number(inserted.rows[0]?.id) || null
  }

  await executor.query(
    `UPDATE public.ai_generation_drafts
        SET status = $3,
            review_note = $4,
            reviewed_by = $5,
            reviewed_at = now(),
            final_script_id = $6,
            updated_at = now()
      WHERE tenant_id = $1 AND id = $2`,
    [input.tenantId, input.draftId, nextStatus, String(input.note || '').slice(0, 500), input.userId ?? null, scriptId]
  )

  return { draftId: input.draftId, status: nextStatus, scriptId }
}

/** 采纳率统计：approved / (approved + rejected)，blocked 不计入分母 */
export async function generationStats(tenantId: number, db?: DbExecutor) {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT
       count(*) FILTER (WHERE status = 'pending_review') AS pending,
       count(*) FILTER (WHERE status = 'approved') AS approved,
       count(*) FILTER (WHERE status = 'rejected') AS rejected,
       count(*) FILTER (WHERE status = 'blocked') AS blocked,
       count(*) AS total,
       coalesce(avg(latency_ms) FILTER (WHERE status <> 'blocked'), 0) AS avg_latency,
       coalesce(sum(cost_cny), 0) AS total_cost
     FROM public.ai_generation_drafts WHERE tenant_id = $1`,
    [tenantId]
  )
  const row = rows[0] || {}
  const approved = Number(row.approved) || 0
  const rejected = Number(row.rejected) || 0
  const decided = approved + rejected
  return {
    pending: Number(row.pending) || 0,
    approved,
    rejected,
    blocked: Number(row.blocked) || 0,
    total: Number(row.total) || 0,
    adoptionRate: decided > 0 ? Number((approved / decided).toFixed(4)) : 0,
    avgLatencyMs: Math.round(Number(row.avg_latency) || 0),
    totalCostCny: Number(Number(row.total_cost || 0).toFixed(6)),
  }
}