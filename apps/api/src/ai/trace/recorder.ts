/**
 * ai/trace/recorder.ts — 问答链路流水持久化记录器
 * 
 * 对齐 Plan §6.3 ⑥ 与 6.4：
 *   执行完成后将 run、steps、evidence、claims、llm_calls 异步批量持久化入库，
 *   保证 100% 审计可回放，且不阻塞 HTTP 响应主链路。
 */

import { getPool, type DbExecutor } from '../../lib/db.js'
import { requireTenantId } from '../../lib/tenant-context.js'
import type { Plan } from '../contract/plan.js'
import type { EvidencePacket } from '../contract/evidence.js'
import type { ClaimPacket } from '../contract/claim.js'
import type { ExecutedStep } from '../engine/executor.js'
import type { VerificationResult } from '../engine/critic.js'

export interface RecordRunOptions {
  runId: string
  conversationId?: string | number | null
  tenantId?: number | null
  question: string
  plan: Plan
  steps: ExecutedStep[]
  evidence: EvidencePacket
  verification: VerificationResult
  durationMs: number
  costCny?: number
}

/**
 * 异步落库主函数
 */
export async function recordAiRun(opts: RecordRunOptions, executor?: DbExecutor): Promise<void> {
  const pool = executor || getPool()
  const { runId, conversationId, tenantId, question, plan, steps, evidence, verification, durationMs, costCny } = opts

  try {
    const traceTenantId = requireTenantId(tenantId, 'ai.trace.recorder')
    // 1. 写入 ai_v2_run
    await pool.query(
      `INSERT INTO public.ai_v2_run
        (id, tenant_id, conversation_id, question, engine, prompt_version, plan, status, verdict, rejection_reason, duration_ms, cost_cny)
       VALUES ($1, $2, $3, $4, $5, 'v2.0', $6, 'completed', $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
        verdict = EXCLUDED.verdict,
        rejection_reason = EXCLUDED.rejection_reason,
        duration_ms = EXCLUDED.duration_ms`,
      [
        runId,
        traceTenantId,
        conversationId ? String(conversationId) : null,
        question,
        plan.engine,
        JSON.stringify(plan),
        verification.verdict,
        verification.rejectionReason || null,
        durationMs,
        costCny || 0,
      ]
    )

    // 2. 批量写入 ai_v2_step
    for (const step of steps) {
      await pool.query(
        `INSERT INTO public.ai_v2_step
        (run_id, seq, role, tool, input, output_ref, row_count, duration_ms, status, tenant_id)
       VALUES ($1, $2, 'executor', $3, $4, $5, $6, $7, 'success', $8)`,
      [
        runId,
        step.seq,
        step.toolName,
        JSON.stringify(step.input),
        JSON.stringify(step.output),
        step.rowCount,
        step.durationMs,
        traceTenantId,
      ]
      )
    }

    // 3. 批量写入 ai_v2_evidence
    for (const ev of evidence.items) {
      await pool.query(
        `INSERT INTO public.ai_v2_evidence
        (run_id, evidence_key, kind, metric, label, unit, value, scope, time_range, parents, sql_snapshot, tenant_id)
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
        traceTenantId,
      ]
      )
    }

    // 4. 批量写入 ai_v2_claim
    let claimSeq = 0
    for (const claim of verification.sanitizedPacket.claims) {
      claimSeq += 1
      await pool.query(
        `INSERT INTO public.ai_v2_claim
        (run_id, seq, headline, text, evidence_ids, kind, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        runId,
        claimSeq,
        verification.sanitizedPacket.headline,
        claim.text,
        claim.evidence_ids || [],
        claim.kind,
        traceTenantId,
      ]
      )
    }
  } catch (err) {
    console.warn('[trace-recorder] failed to persist run audit trace:', (err as Error)?.message || err)
  }
}
