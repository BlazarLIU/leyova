/**
 * ai/llm/call-log.ts — LLM 调用流水落库（ai_v2_llm_call）
 *
 * 每一次模型调用（成功 / 失败 / 跳过）都写入统一流水，
 * 保证成本、耗时、token、错误与 run/conversation 血缘可查。
 */

import { getPool, type DbExecutor } from '../../lib/db.js'
import { requireTenantId } from '../../lib/tenant-context.js'

export interface LlmTraceContext {
  runId?: string | null
  tenantId?: number | null
  conversationId?: string | number | null
  operationName?: string
  stepSeq?: number
  profileKey?: string
  isFallback?: boolean
}

export interface LlmCallRecord extends LlmTraceContext {
  provider: string
  model: string
  status: 'success' | 'error' | 'skipped'
  inputTokens?: number
  outputTokens?: number
  costCny?: number
  latencyMs?: number
  finishReason?: string
  error?: string
  promptChars?: number
  completionChars?: number
}

/**
 * 落库失败不影响主链路（LLM 调用本身不因审计失败而中断）。
 */
export async function recordLlmCall(rec: LlmCallRecord, executor?: DbExecutor): Promise<void> {
  try {
    const pool = executor || getPool()
    await pool.query(
      `INSERT INTO public.ai_v2_llm_call
        (run_id, tenant_id, conversation_id, step_seq, operation_name, provider, request_model,
         input_tokens, output_tokens, cost_cny, latency_ms, finish_reason, status, error,
         prompt_chars, completion_chars, profile_key, is_fallback)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        rec.runId || null,
        requireTenantId(rec.tenantId, 'ai.llm.call-log'),
        rec.conversationId != null ? String(rec.conversationId) : null,
        rec.stepSeq ?? 1,
        rec.operationName || 'llm.chat',
        rec.provider,
        rec.model || 'unknown',
        rec.inputTokens ?? 0,
        rec.outputTokens ?? 0,
        rec.costCny ?? 0,
        rec.latencyMs ?? 0,
        rec.finishReason || (rec.status === 'success' ? 'stop' : 'error'),
        rec.status,
        rec.error ? rec.error.slice(0, 2000) : null,
        rec.promptChars ?? 0,
        rec.completionChars ?? 0,
        rec.profileKey || null,
        Boolean(rec.isFallback),
      ]
    )
  } catch (err) {
    console.warn('[llm] failed to persist ai_v2_llm_call:', (err as Error)?.message || err)
  }
}
