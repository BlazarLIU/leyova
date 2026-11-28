/**
 * ai/run/engine.ts — 可恢复的 Assistant Run Engine
 *
 * 状态机：queued → running → succeeded | failed | cancelled
 * 核心保证：
 *   1. 幂等：同一 idempotencyKey 只会创建一个 Run。
 *   2. 断点恢复：每一步执行完即写 checkpoint（plan + 已完成 steps），崩溃后续跑不重复取数。
 *   3. 事件无丢：事件 seq 由 run.cursor 原子分配并落库，SSE 断线按 cursor 补发。
 *   4. fail-closed：Agent 工具白名单 / 风险上限不通过直接终止，不做降级放行。
 */

import crypto from 'node:crypto'
import { getPool, type DbExecutor } from '../../lib/db.js'
import type { Plan } from '../contract/plan.js'
import { createEvidencePacket } from '../contract/evidence.js'
import { planByRules } from '../engine/planner/rule-planner.js'
import { executeToolCall, extractEvidenceFromStep, type ExecutedStep } from '../engine/executor.js'
import { synthesizeTemplateReport } from '../engine/reporter/template.js'
import { verifyClaimPacket } from '../engine/critic.js'
import { getTool } from '../tool-registry.js'
import { appendRunEvent, listRunEvents, type RunEvent } from './events.js'
import { checkToolAllowed, getAgentConfig } from './agent-config.js'
import { detectIntent, type IntentResult } from './intent.js'
import { resolveToolPolicy } from '../policy.js'
import { formatAnalysisToMarkdown } from './format.js'
import {
  retrieveKnowledge,
  needsKnowledge,
  appendCitationsToMarkdown,
  type Citation,
} from './knowledge.js'
import {
  retrieveMemories,
  appendMemorySection,
  buildSessionSummary,
  extractPreferenceCandidate,
  writeMemory,
  type MemoryContextItem,
} from './memory.js'
import { routeAgentKey } from './agent-router.js'
import { QUEUE_NAMES, sendJob } from '../../jobs/boss.js'

export interface CreateRunInput {
  question: string
  userId?: number | null
  tenantId?: number | null
  conversationId?: string | number | null
  agentKey?: string
  triggerType?: string
  idempotencyKey?: string
}

export interface CreatedRun {
  runId: string
  conversationId: string | null
  status: string
  created: boolean
}

interface RunRow {
  id: string
  tenant_id: number
  conversation_id: string | null
  question: string
  user_id: number | null
  agent_key: string
  trigger_type: string
  status: string
  attempts: number
  checkpoint: RunCheckpoint | null
}

interface RunCheckpoint {
  plan?: Plan
  steps?: ExecutedStep[]
  intent?: IntentResult
  citations?: Citation[]
  knowledgeConfigured?: boolean
  memories?: MemoryContextItem[]
  agentKey?: string
}

export interface RunDetail {
  run: Record<string, unknown>
  steps: Array<Record<string, unknown>>
  evidence: Array<Record<string, unknown>>
  claims: Array<Record<string, unknown>>
  citations: Array<Record<string, unknown>>
  memories: Array<Record<string, unknown>>
  events: RunEvent[]
}

const TERMINAL = ['succeeded', 'failed', 'cancelled', 'completed']

function newRunId(): string {
  return `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

export async function createAssistantRun(
  input: CreateRunInput,
  db?: DbExecutor
): Promise<CreatedRun> {
  const executor = db || getPool()
  const question = String(input.question || '').trim()
  if (!question) throw new Error('问题不能为空')

  if (!input.tenantId || !Number.isInteger(input.tenantId) || input.tenantId <= 0) {
    throw new Error('[TENANT_SECURITY_FAIL_CLOSED] 缺少有效租户上下文 tenantId，系统拒绝执行非受信任务')
  }
  const tenantId = input.tenantId
  const conversationId = input.conversationId != null ? String(input.conversationId) : null
  const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).slice(0, 160) : null

  if (idempotencyKey) {
    const existing = await executor.query<{ id: string; status: string; conversation_id: string | null }>(
      `SELECT id, status, conversation_id FROM public.ai_v2_run WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey]
    )
    if (existing.rows[0]) {
      return {
        runId: existing.rows[0].id,
        conversationId: existing.rows[0].conversation_id,
        status: existing.rows[0].status,
        created: false,
      }
    }
  }

  const runId = newRunId()
  try {
    await executor.query(
      `INSERT INTO public.ai_v2_run
         (id, tenant_id, conversation_id, question, user_id, agent_key,
          trigger_type, idempotency_key, engine, status, prompt_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'rule', 'queued', 'w4.0')`,
      [
        runId,
        tenantId,
        conversationId,
        question,
        input.userId ?? null,
        input.agentKey || 'business_analyst',
        input.triggerType || 'chat',
        idempotencyKey,
      ]
    )
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === '23505' && idempotencyKey) {
      const existing = await executor.query<{ id: string; status: string; conversation_id: string | null }>(
        `SELECT id, status, conversation_id FROM public.ai_v2_run WHERE idempotency_key = $1 LIMIT 1`,
        [idempotencyKey]
      )
      if (existing.rows[0]) {
        return {
          runId: existing.rows[0].id,
          conversationId: existing.rows[0].conversation_id,
          status: existing.rows[0].status,
          created: false,
        }
      }
    }
    throw err
  }

  return { runId, conversationId, status: 'queued', created: true }
}

/** 原子认领 Run；已终态或心跳新鲜的 Run 不会被重复执行 */
async function claimRun(db: DbExecutor, runId: string): Promise<RunRow | null> {
  const { rows } = await db.query<RunRow>(
    `UPDATE public.ai_v2_run
        SET status = 'running',
            attempts = attempts + 1,
            started_at = COALESCE(started_at, now()),
            updated_at = now(),
            error = NULL
      WHERE id = $1
        AND cancel_requested = FALSE
        AND attempts < 5
        AND (status = 'queued'
             OR (status = 'running' AND updated_at < now() - INTERVAL '45 seconds'))
      RETURNING id, tenant_id, conversation_id, question, user_id, agent_key,
                trigger_type, status, attempts, checkpoint`,
    [runId]
  )
  return rows[0] || null
}

async function saveCheckpoint(db: DbExecutor, runId: string, checkpoint: RunCheckpoint): Promise<void> {
  await db.query(
    `UPDATE public.ai_v2_run SET checkpoint = $2::jsonb, updated_at = now() WHERE id = $1`,
    [runId, JSON.stringify(checkpoint)]
  )
}

async function markFailed(db: DbExecutor, runId: string, message: string, durationMs: number): Promise<void> {
  await db.query(
    `UPDATE public.ai_v2_run
        SET status = 'failed', error = $2, duration_ms = $3, finished_at = now(), updated_at = now()
      WHERE id = $1`,
    [runId, message.slice(0, 2000), durationMs]
  )
  await appendRunEvent(db, runId, 'run.failed', { message }, 1).catch(() => undefined)
}

async function markCancelled(db: DbExecutor, runId: string, durationMs: number): Promise<void> {
  await db.query(
    `UPDATE public.ai_v2_run
        SET status = 'cancelled', duration_ms = $2, finished_at = now(), updated_at = now()
      WHERE id = $1`,
    [runId, durationMs]
  )
  await appendRunEvent(db, runId, 'run.cancelled', { message: '用户取消' }, 1).catch(() => undefined)
}

async function persistStep(
  db: DbExecutor,
  runId: string,
  tenantId: number,
  step: ExecutedStep,
  status: 'success' | 'failed' = 'success',
  error?: string
): Promise<void> {
  await db.query(
    `INSERT INTO public.ai_v2_step
       (run_id, seq, role, tool, input, output_ref, row_count, duration_ms, status, error, tenant_id)
     VALUES ($1, $2, 'executor', $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10)
     ON CONFLICT (run_id, seq) DO UPDATE SET
       tool = EXCLUDED.tool,
       input = EXCLUDED.input,
       output_ref = EXCLUDED.output_ref,
       row_count = EXCLUDED.row_count,
       duration_ms = EXCLUDED.duration_ms,
       status = EXCLUDED.status,
       error = EXCLUDED.error`,
    [
      runId,
      step.seq,
      step.toolName,
      JSON.stringify(step.input),
      JSON.stringify(step.output ?? {}),
      step.rowCount,
      step.durationMs,
      status,
      error || null,
      tenantId,
    ]
  )
}

async function persistResult(
  db: DbExecutor,
  runId: string,
  tenantId: number,
  steps: ExecutedStep[],
  evidence: ReturnType<typeof createEvidencePacket>,
  verification: ReturnType<typeof verifyClaimPacket>
): Promise<void> {
  // 续跑时整体覆盖，保证不残留上一轮的半成品
  await db.query(`DELETE FROM public.ai_v2_evidence WHERE run_id = $1`, [runId])
  await db.query(`DELETE FROM public.ai_v2_claim WHERE run_id = $1`, [runId])

  for (const step of steps) {
    await persistStep(db, runId, tenantId, step)
  }

  for (const ev of evidence.items) {
    await db.query(
      `INSERT INTO public.ai_v2_evidence
         (run_id, evidence_key, kind, metric, label, unit, value, scope, time_range,
          parents, sql_snapshot, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        runId,
        ev.id,
        ev.kind,
        ev.metric,
        ev.label,
        ev.unit,
        ev.value,
        ev.scope,
        ev.time_range,
        ev.parents || [],
        ev.sql_snapshot || null,
        tenantId,
      ]
    )
  }

  let seq = 0
  for (const claim of verification.sanitizedPacket.claims) {
    seq += 1
    await db.query(
      `INSERT INTO public.ai_v2_claim
         (run_id, seq, headline, text, evidence_ids, kind, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        runId,
        seq,
        verification.sanitizedPacket.headline,
        claim.text,
        claim.evidence_ids || [],
        claim.kind,
        tenantId,
      ]
    )
  }
}

async function persistCitations(
  db: DbExecutor,
  runId: string,
  tenantId: number,
  citations: Citation[]
): Promise<void> {
  // 续跑整体覆盖，避免残留上一轮引用
  await db.query(`DELETE FROM public.ai_v2_citation WHERE run_id = $1`, [runId])
  for (const citation of citations) {
    await db.query(
      `INSERT INTO public.ai_v2_citation
         (run_id, seq, chunk_id, document_id, document_name, snippet, score, tenant_id,
          local_chunk_id, doc_version, page_no, start_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        runId,
        citation.seq,
        citation.chunkId,
        citation.documentId,
        citation.documentName,
        citation.snippet,
        citation.score,
        tenantId,
        citation.localChunkId || null,
        citation.docVersion ?? null,
        citation.pageNo ?? null,
        citation.startMs ?? null,
      ]
    )
  }
}

async function roleOfUser(db: DbExecutor, userId: number | null): Promise<string> {
  if (!userId) return 'ops_staff'
  try {
    const { rows } = await db.query<{ role: string }>(
      `SELECT role FROM public.users WHERE id = $1 LIMIT 1`,
      [userId]
    )
    return rows[0]?.role || 'ops_staff'
  } catch {
    return 'ops_staff'
  }
}

/**
 * 执行（或续跑）一个 Run。返回 skipped=true 表示已被其它执行者认领或已终态。
 */
export async function executeAssistantRun(
  runId: string,
  db?: DbExecutor
): Promise<{ ok: boolean; skipped?: boolean; status?: string }> {
  const pool = db || getPool()
  const startedAt = Date.now()

  const row = await claimRun(pool, runId)
  if (!row) {
    const current = await pool.query<{ status: string }>(
      `SELECT status FROM public.ai_v2_run WHERE id = $1`,
      [runId]
    )
    return {
      ok: TERMINAL.includes(current.rows[0]?.status || ''),
      skipped: true,
      status: current.rows[0]?.status,
    }
  }

  const tenantId = row.tenant_id
  try {
    // 域 Agent 路由：调用方未显式指定时，按问题关键词选择域 Agent（可解释、零成本）
    const routed = routeAgentKey(row.question, row.agent_key)
    const agentSwitched = routed.agentKey !== row.agent_key
    const agentKey = routed.agentKey
    if (agentSwitched) {
      await pool.query(
        `UPDATE public.ai_v2_run SET agent_key = $2, updated_at = now() WHERE id = $1`,
        [runId, agentKey]
      )
    }

    const agent = await getAgentConfig(pool, agentKey, tenantId)
    if (agent && !agent.isEnabled) {
      throw new Error(`Agent ${agentKey} 已停用`)
    }

    await appendRunEvent(
      pool,
      runId,
      'run.started',
      { agentKey, question: row.question, attempt: row.attempts },
      tenantId
    )

    if (agentSwitched) {
      await appendRunEvent(
        pool,
        runId,
        'agent.routed',
        { from: row.agent_key, to: agentKey, reason: routed.reason, score: routed.score },
        tenantId
      )
    }

    const checkpoint: RunCheckpoint = row.checkpoint || {}
    let plan = checkpoint.plan
    const role = await roleOfUser(pool, row.user_id)

    if (!plan) {
      // Main Assistant 意图路由：规则优先，低置信才请 LLM；降级原因写入事件流
      const intent = await detectIntent(row.question, { tenantId, runId })
      checkpoint.intent = intent
      await appendRunEvent(
        pool,
        runId,
        'intent.detected',
        {
          intent: intent.intent,
          source: intent.source,
          confidence: intent.confidence,
          reason: intent.reason,
          agentKey: row.agent_key,
        },
        tenantId
      )
      if (intent.usedFallback) {
        await appendRunEvent(
          pool,
          runId,
          'llm.fallback',
          { stage: 'intent', reason: intent.fallbackReason || 'LLM 不可用，已回落规则' },
          tenantId
        )
      }

      plan = await planByRules({ question: row.question, role })
      checkpoint.plan = plan
      await saveCheckpoint(pool, runId, checkpoint)
      await appendRunEvent(
        pool,
        runId,
        'plan.ready',
        {
          intent: plan.intent,
          questionRewrite: plan.question_rewrite,
          timeRange: plan.time_range,
          calls: plan.calls.map((c) => ({ tool: c.tool, purpose: c.purpose })),
        },
        tenantId
      )
    }

    // 知识召回：首次执行检索一次并写入 checkpoint；续跑直接复用，避免重复请求外部知识库
    let citations: Citation[] = checkpoint.citations || []
    let knowledgeConfigured = checkpoint.knowledgeConfigured ?? false
    if (checkpoint.citations === undefined) {
      const retrieval = await retrieveKnowledge(row.question, {
        tenantId,
        role: await roleOfUser(pool, row.user_id ?? null),
      })
      citations = retrieval.citations
      knowledgeConfigured = retrieval.configured
      checkpoint.citations = citations
      checkpoint.knowledgeConfigured = knowledgeConfigured
      await saveCheckpoint(pool, runId, checkpoint)
      await appendRunEvent(
        pool,
        runId,
        'citations.retrieved',
        {
          configured: retrieval.configured,
          count: citations.length,
          needsKnowledge: needsKnowledge(row.question),
          tenantId,
          sources: citations.map((c) => ({
            seq: c.seq,
            documentName: c.documentName,
            score: c.score,
          })),
        },
        tenantId
      )
    }

    // 记忆召回：先按租户 + 可见范围过滤，再关键词匹配；续跑复用 checkpoint，避免重复读取
    let memories: MemoryContextItem[] = checkpoint.memories || []
    if (checkpoint.memories === undefined) {
      memories = await retrieveMemories(
        row.question,
        {
          tenantId,
          userId: row.user_id,
          role,
          conversationId: row.conversation_id,
        },
        pool
      )
      checkpoint.memories = memories
      await saveCheckpoint(pool, runId, checkpoint)
      await appendRunEvent(
        pool,
        runId,
        'memory.applied',
        {
          count: memories.length,
          scopes: Array.from(new Set(memories.map((m) => m.scope))),
          keys: memories.map((m) => m.memoryKey),
        },
        tenantId
      )
    }

    const steps: ExecutedStep[] = checkpoint.steps ? [...checkpoint.steps] : []
    const evidence = createEvidencePacket()
    // 续跑：按已完成步骤回放证据血缘
    for (const step of steps) {
      extractEvidenceFromStep(step.toolName, step.input, step.output, evidence)
    }

    for (let index = steps.length; index < plan.calls.length; index += 1) {
      const cancel = await pool.query<{ cancel_requested: boolean }>(
        `SELECT cancel_requested FROM public.ai_v2_run WHERE id = $1`,
        [runId]
      )
      if (cancel.rows[0]?.cancel_requested) {
        await markCancelled(pool, runId, Date.now() - startedAt)
        return { ok: false, status: 'cancelled' }
      }

      const call = plan.calls[index]
      const seq = index + 1
      const toolDef = getTool(call.tool)
      // Policy Engine 统一裁决：Run Engine 只允许自动执行 R0/R1 只读动作
      const policy = await resolveToolPolicy(pool, tenantId, {
        name: call.tool,
        riskLevel: toolDef?.riskLevel || 'read_only',
      })
      if (policy.effect !== 'allow') {
        throw new Error(`工具被拒绝：${policy.reason}`)
      }
      const agentPolicy = checkToolAllowed(agent, {
        name: call.tool,
        riskLevel: toolDef?.riskLevel || 'read_only',
      })
      if (!agentPolicy.allowed) {
        throw new Error(`工具被拒绝：${agentPolicy.reason}`)
      }

      await appendRunEvent(
        pool,
        runId,
        'step.started',
        { seq, tool: call.tool, purpose: call.purpose },
        tenantId
      )

      const stepStart = Date.now()
      try {
        const { output, rowCount } = await executeToolCall(call, null, pool)
        const step: ExecutedStep = {
          seq,
          role: 'executor',
          toolName: call.tool,
          input: call.args,
          output,
          rowCount,
          durationMs: Date.now() - stepStart,
        }
        steps.push(step)
        extractEvidenceFromStep(call.tool, call.args, output, evidence)
        await persistStep(pool, runId, tenantId, step)
        await saveCheckpoint(pool, runId, { ...checkpoint, plan, steps })
        await appendRunEvent(
          pool,
          runId,
          'step.completed',
          { seq, tool: call.tool, rowCount, durationMs: step.durationMs, status: 'success' },
          tenantId
        )
      } catch (stepErr) {
        const message = (stepErr as Error)?.message || String(stepErr)
        await persistStep(
          pool,
          runId,
          tenantId,
          {
            seq,
            role: 'executor',
            toolName: call.tool,
            input: call.args,
            output: null,
            rowCount: 0,
            durationMs: Date.now() - stepStart,
          },
          'failed',
          message
        )
        await appendRunEvent(
          pool,
          runId,
          'step.completed',
          { seq, tool: call.tool, status: 'failed', error: message },
          tenantId
        )
        throw stepErr
      }
    }

    const cancelBeforeReport = await pool.query<{ cancel_requested: boolean }>(
      `SELECT cancel_requested FROM public.ai_v2_run WHERE id = $1`,
      [runId]
    )
    if (cancelBeforeReport.rows[0]?.cancel_requested) {
      await markCancelled(pool, runId, Date.now() - startedAt)
      return { ok: false, status: 'cancelled' }
    }

    const draft = synthesizeTemplateReport(plan, steps, evidence)
    const verification = verifyClaimPacket(draft, evidence)
    const sanitized = verification.sanitizedPacket
    let markdown = formatAnalysisToMarkdown({
      conclusion: {
        headline: sanitized.headline,
        findings: sanitized.claims.map((c) => c.text),
        risks: sanitized.risks,
        actions: sanitized.actions,
      },
      verification: {
        passed: verification.passed,
        checkedNumbers: verification.checkedCount,
        matched: verification.matchedCount,
        unmatched: verification.unmatchedItems,
      },
    })
    markdown = appendMemorySection(markdown, memories)
    markdown = appendCitationsToMarkdown(markdown, citations)
    if (knowledgeConfigured && citations.length === 0 && needsKnowledge(row.question)) {
      markdown +=
        '\n> ⚠️ 本次未从知识库检索到可用依据，以上结论仅基于结构化数据；请补充知识文档后重试。\n'
    }

    await persistResult(pool, runId, tenantId, steps, evidence, verification)
    await persistCitations(pool, runId, tenantId, citations)

    await appendRunEvent(pool, runId, 'answer.delta', { content: markdown }, tenantId)

    const durationMs = Date.now() - startedAt
    await pool.query(
      `UPDATE public.ai_v2_run
          SET status = 'succeeded',
              engine = $2,
              verdict = $3,
              rejection_reason = $4,
              duration_ms = $5,
              finished_at = now(),
              updated_at = now()
        WHERE id = $1`,
      [
        runId,
        plan.engine,
        verification.verdict,
        verification.rejectionReason || null,
        durationMs,
      ]
    )

    if (row.conversation_id) {
      await pool
        .query(
          `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
          [row.conversation_id, markdown]
        )
        .catch(() => undefined)
      await pool
        .query(`UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`, [row.conversation_id])
        .catch(() => undefined)
    }

    await appendRunEvent(
      pool,
      runId,
      'run.completed',
      {
        verdict: verification.verdict,
        headline: sanitized.headline,
        durationMs,
        stepCount: steps.length,
        citationCount: citations.length,
        memoryCount: memories.length,
      },
      tenantId
    )

    // 记忆写入是旁路能力：失败只丢日志，不影响已完成的 Run
    try {
      if (row.conversation_id) {
        await writeMemory(pool, {
          tenantId,
          scope: 'session',
          ownerUserId: row.user_id,
          memoryKey: `session:${row.conversation_id}`,
          content: buildSessionSummary(
            row.question,
            sanitized.headline,
            sanitized.claims.map((c) => c.text)
          ),
          confidence: 0.6,
          sourceType: 'run',
          sourceId: runId,
          status: 'active',
          retentionClass: 'session_7d',
          createdBy: row.user_id,
        })
      }
      // 用户明确表达「记住/以后/习惯」时才生成个人偏好候选，默认 pending 等确认
      const candidate = extractPreferenceCandidate(row.question)
      if (candidate && row.user_id) {
        await writeMemory(pool, {
          tenantId,
          scope: 'personal',
          ownerUserId: row.user_id,
          memoryKey: candidate.memoryKey,
          content: candidate.content,
          confidence: 0.5,
          sourceType: 'conversation',
          sourceId: runId,
          status: 'pending',
          createdBy: row.user_id,
        })
      }
    } catch {
      // ignore：记忆写入失败不改变 Run 状态
    }

    return { ok: true, status: 'succeeded' }
  } catch (err) {
    const message = (err as Error)?.message || String(err)
    await markFailed(pool, runId, message, Date.now() - startedAt)
    return { ok: false, status: 'failed' }
  }
}

/** 入队 assistant.run（pg-boss 兜底执行 / 崩溃恢复） */
export async function enqueueAssistantRun(runId: string, _db?: DbExecutor): Promise<void> {
  await sendJob(
    QUEUE_NAMES.ASSISTANT_RUN,
    { runId },
    {
      singletonKey: runId,
      retryLimit: 3,
      retryBackoff: true,
      expireInSeconds: 300,
    },
  )
}

/** 扫描心跳超时的 queued/running Run，重新入队（Worker 定时调用） */
export async function resumeStaleRuns(limit = 5): Promise<number> {
  const pool = getPool()
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM public.ai_v2_run
      WHERE status IN ('queued', 'running')
        AND cancel_requested = FALSE
        AND attempts < 5
        AND updated_at < now() - INTERVAL '45 seconds'
      ORDER BY created_at ASC
      LIMIT $1`,
    [limit]
  )
  for (const row of rows) {
    await enqueueAssistantRun(row.id, pool)
  }
  return rows.length
}

export async function cancelAssistantRun(runId: string, db?: DbExecutor): Promise<boolean> {
  const executor = db || getPool()
  const { rows } = await executor.query<{ status: string }>(
    `UPDATE public.ai_v2_run
        SET status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
            cancel_requested = TRUE,
            finished_at = CASE WHEN status = 'queued' THEN now() ELSE finished_at END,
            updated_at = now()
      WHERE id = $1 AND status IN ('queued', 'running')
      RETURNING status`,
    [runId]
  )
  if (!rows[0]) return false
  if (rows[0].status === 'cancelled') {
    await appendRunEvent(executor, runId, 'run.cancelled', { message: '用户取消' }, 1).catch(() => undefined)
  }
  return true
}

export async function getRunDetail(runId: string, db?: DbExecutor): Promise<RunDetail | null> {
  const executor = db || getPool()
  const run = await executor.query(`SELECT * FROM public.ai_v2_run WHERE id = $1 LIMIT 1`, [runId])
  if (!run.rows[0]) return null

  const checkpoint = (run.rows[0] as { checkpoint?: RunCheckpoint | null }).checkpoint
  const memories = Array.isArray(checkpoint?.memories) ? checkpoint.memories : []

  const [steps, evidence, claims, citations, events] = await Promise.all([
    executor.query(
      `SELECT seq, role, tool, input, output_ref, row_count, duration_ms, status, error, created_at
         FROM public.ai_v2_step WHERE run_id = $1 ORDER BY seq ASC`,
      [runId]
    ),
    executor.query(
      `SELECT evidence_key, kind, metric, label, unit, value, scope, time_range, parents
         FROM public.ai_v2_evidence WHERE run_id = $1 ORDER BY id ASC`,
      [runId]
    ),
    executor.query(
      `SELECT seq, headline, text, evidence_ids, kind
         FROM public.ai_v2_claim WHERE run_id = $1 ORDER BY seq ASC`,
      [runId]
    ),
    executor.query(
      `SELECT seq, chunk_id, document_id, document_name, snippet, score,
              local_chunk_id, doc_version, page_no, start_ms
         FROM public.ai_v2_citation WHERE run_id = $1 ORDER BY seq ASC`,
      [runId]
    ),
    listRunEvents(executor, runId, 0, 1000),
  ])

  return {
    run: run.rows[0],
    steps: steps.rows,
    evidence: evidence.rows,
    claims: claims.rows,
    citations: citations.rows,
    memories: memories as unknown as Array<Record<string, unknown>>,
    events,
  }
}
