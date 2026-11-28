/**
 * ai/llm/gateway.ts — 统一模型网关
 *
 * 职责：
 *   1. Profile 路由：按 ai_model_profile.priority 主用 → 备用降级。
 *   2. 超时控制：每个 Profile 独立 timeout，主用失败自动切备用。
 *   3. SSRF 防护：内网 / loopback / 元数据地址一律拒绝，绝不发起请求。
 *   4. Run 级 Token 预算：ai_v2_run.token_budget（默认 60k），超限直接拒绝。
 *   5. 成本与降级落库：ai_v2_llm_call 记录 profile_key / is_fallback，
 *      ai_v2_run 累加 tokens_used / cost_cny / fallback_used。
 *   6. 降级结果回传 usedFallback / fallbackReason，供事件流与 UI 展示。
 */

import { getPool, type DbExecutor } from '../../lib/db.js'
import { requireTenantId } from '../../lib/tenant-context.js'
import { decryptCredential } from '../../modules/data-governance/security.js'
import { buildLlmProvider } from './index.js'
import { resolveLlmConfig } from './config-store.js'
import { isLocalOrPrivateHost } from './provider.js'
import type {
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  LlmProtocol,
} from './provider.js'
import { estimateTokens } from './cost.js'

export interface ModelProfile {
  key: string
  name: string
  protocol: LlmProtocol
  apiBase: string
  apiKey: string
  model: string
  timeoutMs: number
  maxTokens: number
  isFallback: boolean
}

export interface GatewayOptions extends CompletionOptions {
  tenantId?: number
  /** 关联 Run：用于预算校验与用量/成本累加 */
  runId?: string | null
  db?: DbExecutor
}

export interface GatewayAttempt {
  profileKey: string
  model: string
  ok: boolean
  error?: string
}

export type GatewayFailureReason =
  | 'not_configured'
  | 'run_token_budget_exceeded'
  | 'all_profiles_failed'
  | 'stream_failed_after_partial'

export interface GatewayResult {
  ok: boolean
  result: CompletionResult | null
  usedFallback: boolean
  fallbackReason?: string
  attempts: GatewayAttempt[]
  reason?: GatewayFailureReason
}

export interface GatewayObjectResult<T> {
  ok: boolean
  data: T | null
  usedFallback: boolean
  fallbackReason?: string
  attempts: GatewayAttempt[]
  reason?: GatewayFailureReason
}

export interface GatewayStreamResult extends GatewayResult {
  reply: string
  emitted: boolean
}

interface ProfileRow {
  profile_key: string
  name: string
  protocol: string
  api_base: string
  api_key_enc: string | null
  model: string
  timeout_ms: number
  max_output_tokens: number
  is_fallback: boolean
}

/**
 * 读取生效 Profile；表为空或读取失败时回落到单行 llm_provider_config / env 组合。
 * 内网地址直接跳过（SSRF fail-closed）。
 */
export async function loadModelProfiles(
  db: DbExecutor | undefined,
  tenantId: number
): Promise<ModelProfile[]> {
  const executor = db || getPool()
  const baseConfig = await resolveLlmConfig()
  const profiles: ModelProfile[] = []

  try {
    const { rows } = await executor.query<ProfileRow>(
      `SELECT profile_key, name, protocol, api_base, api_key_enc, model,
              timeout_ms, max_output_tokens, is_fallback
         FROM public.ai_model_profile
        WHERE tenant_id = $1 AND is_enabled = TRUE
        ORDER BY is_fallback ASC, priority ASC, id ASC`,
      [tenantId]
    )
    for (const row of rows) {
      if (!row.api_base || isLocalOrPrivateHost(row.api_base)) continue
      profiles.push({
        key: row.profile_key,
        name: row.name,
        protocol: row.protocol === 'anthropic' ? 'anthropic' : 'openai',
        apiBase: row.api_base.replace(/\/+$/, ''),
        apiKey: row.api_key_enc ? decryptCredential(row.api_key_enc) : baseConfig.apiKey,
        model: row.model,
        timeoutMs: Number(row.timeout_ms) || 60000,
        maxTokens: Number(row.max_output_tokens) || 2000,
        isFallback: Boolean(row.is_fallback),
      })
    }
  } catch (err) {
    console.warn('[gateway] profile load failed, fallback to provider config:', (err as Error)?.message || err)
  }

  if (profiles.length === 0 && baseConfig.apiBase && !isLocalOrPrivateHost(baseConfig.apiBase)) {
    profiles.push({
      key: 'default',
      name: '默认模型',
      protocol: baseConfig.protocol,
      apiBase: baseConfig.apiBase,
      apiKey: baseConfig.apiKey,
      model: baseConfig.model,
      timeoutMs: 60000,
      maxTokens: 2000,
      isFallback: false,
    })
  }

  return profiles
}

interface RunBudget {
  budget: number
  used: number
}

async function loadRunBudget(db: DbExecutor, runId: string): Promise<RunBudget | null> {
  try {
    const { rows } = await db.query<{ token_budget: number; tokens_used: number }>(
      `SELECT token_budget, tokens_used FROM public.ai_v2_run WHERE id = $1`,
      [runId]
    )
    if (!rows[0]) return null
    return {
      budget: Number(rows[0].token_budget) || 60000,
      used: Number(rows[0].tokens_used) || 0,
    }
  } catch {
    return null
  }
}

async function recordRunUsage(
  db: DbExecutor,
  runId: string,
  tokens: number,
  costCny: number,
  usedFallback: boolean
): Promise<void> {
  try {
    await db.query(
      `UPDATE public.ai_v2_run
          SET tokens_used = tokens_used + $2,
              cost_cny = cost_cny + $3,
              fallback_used = fallback_used OR $4,
              updated_at = now()
        WHERE id = $1`,
      [runId, Math.max(0, Math.round(tokens)), Math.max(0, costCny), usedFallback]
    )
  } catch (err) {
    console.warn('[gateway] run usage update failed:', (err as Error)?.message || err)
  }
}

function promptTokenEstimate(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0)
}

function buildProvider(profile: ModelProfile) {
  return buildLlmProvider({
    enabled: true,
    protocol: profile.protocol,
    apiBase: profile.apiBase,
    apiKey: profile.apiKey,
    model: profile.model,
  })
}

/**
 * 统一文本生成入口（非流式）。
 */
export async function generate(
  messages: ChatMessage[],
  options: GatewayOptions = {}
): Promise<GatewayResult> {
  const db = options.db || getPool()
  const tenantId = requireTenantId(options.tenantId, 'ai.llm.gateway')
  const attempts: GatewayAttempt[] = []
  const profiles = await loadModelProfiles(db, tenantId)
  if (profiles.length === 0) {
    return { ok: false, result: null, usedFallback: false, attempts, reason: 'not_configured' }
  }

  let budget: RunBudget | null = null
  if (options.runId) {
    budget = await loadRunBudget(db, options.runId)
    if (budget) {
      const need = promptTokenEstimate(messages)
      if (budget.used + need > budget.budget) {
        return {
          ok: false,
          result: null,
          usedFallback: false,
          attempts,
          reason: 'run_token_budget_exceeded',
          fallbackReason: `Run Token 预算已用 ${budget.used}/${budget.budget}`,
        }
      }
    }
  }

  for (let i = 0; i < profiles.length; i += 1) {
    const profile = profiles[i]
    const provider = buildProvider(profile)
    if (!provider.isAvailable()) {
      attempts.push({ profileKey: profile.key, model: profile.model, ok: false, error: 'provider not available' })
      continue
    }

    const remaining = budget ? Math.max(1, budget.budget - budget.used) : undefined
    const result = await provider.chat(messages, {
      ...options,
      timeoutMs: options.timeoutMs ?? profile.timeoutMs,
      maxTokens: Math.min(options.maxTokens ?? profile.maxTokens, remaining ?? Number.MAX_SAFE_INTEGER),
      trace: {
        ...options.trace,
        runId: options.runId ?? options.trace?.runId ?? null,
        tenantId,
        profileKey: profile.key,
        isFallback: i > 0,
      },
    })

    if (result) {
      attempts.push({ profileKey: profile.key, model: profile.model, ok: true })
      if (options.runId) {
        await recordRunUsage(db, options.runId, result.inputTokens + result.outputTokens, result.costCny, i > 0)
      }
      return {
        ok: true,
        result,
        usedFallback: i > 0,
        fallbackReason: i > 0 ? `主模型不可用，已降级到 ${profile.key}` : undefined,
        attempts,
      }
    }
    attempts.push({ profileKey: profile.key, model: profile.model, ok: false, error: 'call returned null' })
  }

  return {
    ok: false,
    result: null,
    usedFallback: attempts.length > 1,
    attempts,
    reason: 'all_profiles_failed',
  }
}

/**
 * 结构化对象生成（内部走文本 + JSON 解析）。
 */
export async function generateObject<T>(
  prompt: string,
  schemaDescription: string,
  options: GatewayOptions = {}
): Promise<GatewayObjectResult<T>> {
  const db = options.db || getPool()
  const tenantId = requireTenantId(options.tenantId, 'ai.llm.gateway')
  const attempts: GatewayAttempt[] = []
  const profiles = await loadModelProfiles(db, tenantId)
  if (profiles.length === 0) {
    return { ok: false, data: null, usedFallback: false, attempts, reason: 'not_configured' }
  }

  let budget: RunBudget | null = null
  if (options.runId) {
    budget = await loadRunBudget(db, options.runId)
    if (budget) {
      const need = estimateTokens(prompt) + 200
      if (budget.used + need > budget.budget) {
        return {
          ok: false,
          data: null,
          usedFallback: false,
          attempts,
          reason: 'run_token_budget_exceeded',
          fallbackReason: `Run Token 预算已用 ${budget.used}/${budget.budget}`,
        }
      }
    }
  }

  for (let i = 0; i < profiles.length; i += 1) {
    const profile = profiles[i]
    const provider = buildProvider(profile)
    if (!provider.isAvailable()) {
      attempts.push({ profileKey: profile.key, model: profile.model, ok: false, error: 'provider not available' })
      continue
    }

    const systemPrompt = `你是一个精确的系统分析器。请严格根据要求生成纯 JSON 对象，不要使用任何 markdown 代码块标记，不要输出解释性文本。\nSchema 约定：\n${schemaDescription}`
    const remaining = budget ? Math.max(1, budget.budget - budget.used) : undefined
    const result = await provider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      {
        ...options,
        temperature: 0.1,
        timeoutMs: options.timeoutMs ?? profile.timeoutMs,
        maxTokens: Math.min(options.maxTokens ?? profile.maxTokens, remaining ?? Number.MAX_SAFE_INTEGER),
        trace: {
          ...options.trace,
          runId: options.runId ?? options.trace?.runId ?? null,
          tenantId,
          profileKey: profile.key,
          isFallback: i > 0,
        },
      }
    )

    if (result?.reply) {
      let clean = result.reply.trim()
      try {
        if (clean.startsWith('```')) {
          clean = clean.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim()
        }
        const data = JSON.parse(clean) as T
        attempts.push({ profileKey: profile.key, model: profile.model, ok: true })
        if (options.runId) {
          await recordRunUsage(db, options.runId, result.inputTokens + result.outputTokens, result.costCny, i > 0)
        }
        return {
          ok: true,
          data,
          usedFallback: i > 0,
          fallbackReason: i > 0 ? `主模型不可用，已降级到 ${profile.key}` : undefined,
          attempts,
        }
      } catch (err) {
        attempts.push({
          profileKey: profile.key,
          model: profile.model,
          ok: false,
          error: `JSON 解析失败：${(err as Error)?.message || err}`,
        })
        continue
      }
    }

    attempts.push({ profileKey: profile.key, model: profile.model, ok: false, error: 'chat returned null' })
  }

  return {
    ok: false,
    data: null,
    usedFallback: attempts.length > 1,
    attempts,
    reason: 'all_profiles_failed',
  }
}

/**
 * 真流式生成入口。若 Profile 驱动未实现 chatStream，则退化为一次性 chat。
 * 已产出部分内容后失败，不再切换备用，直接返回部分结果并标记原因。
 */
export async function streamChat(
  messages: ChatMessage[],
  options: GatewayOptions,
  onDelta: (delta: string) => void
): Promise<GatewayStreamResult> {
  const db = options.db || getPool()
  const tenantId = requireTenantId(options.tenantId, 'ai.llm.gateway')
  const attempts: GatewayAttempt[] = []
  const profiles = await loadModelProfiles(db, tenantId)
  if (profiles.length === 0) {
    return {
      ok: false, result: null, usedFallback: false, attempts,
      reason: 'not_configured', reply: '', emitted: false,
    }
  }

  let budget: RunBudget | null = null
  if (options.runId) {
    budget = await loadRunBudget(db, options.runId)
    if (budget) {
      const need = promptTokenEstimate(messages)
      if (budget.used + need > budget.budget) {
        return {
          ok: false, result: null, usedFallback: false, attempts,
          reason: 'run_token_budget_exceeded', reply: '', emitted: false,
          fallbackReason: `Run Token 预算已用 ${budget.used}/${budget.budget}`,
        }
      }
    }
  }

  for (let i = 0; i < profiles.length; i += 1) {
    const profile = profiles[i]
    const provider = buildProvider(profile)
    if (!provider.isAvailable()) {
      attempts.push({ profileKey: profile.key, model: profile.model, ok: false, error: 'provider not available' })
      continue
    }

    let emitted = false
    const emit = (delta: string): void => {
      if (!delta) return
      emitted = true
      onDelta(delta)
    }

    const remaining = budget ? Math.max(1, budget.budget - budget.used) : undefined
    const callOptions: CompletionOptions = {
      ...options,
      timeoutMs: options.timeoutMs ?? profile.timeoutMs,
      maxTokens: Math.min(options.maxTokens ?? profile.maxTokens, remaining ?? Number.MAX_SAFE_INTEGER),
      trace: {
        ...options.trace,
        runId: options.runId ?? options.trace?.runId ?? null,
        tenantId,
        profileKey: profile.key,
        isFallback: i > 0,
      },
    }

    const result = provider.chatStream
      ? await provider.chatStream(messages, callOptions, emit)
      : await provider.chat(messages, callOptions).then((r) => {
          if (r?.reply) emit(r.reply)
          return r
        })

    if (result) {
      attempts.push({ profileKey: profile.key, model: profile.model, ok: true })
      if (options.runId) {
        await recordRunUsage(db, options.runId, result.inputTokens + result.outputTokens, result.costCny, i > 0)
      }
      return {
        ok: true,
        result,
        usedFallback: i > 0,
        fallbackReason: i > 0 ? `主模型不可用，已降级到 ${profile.key}` : undefined,
        attempts,
        reply: result.reply,
        emitted: true,
      }
    }

    attempts.push({ profileKey: profile.key, model: profile.model, ok: false, error: 'stream call returned null' })
    if (emitted) {
      return {
        ok: false, result: null, usedFallback: i > 0, attempts,
        reason: 'stream_failed_after_partial', reply: '', emitted: true,
        fallbackReason: '流式输出中断，已保留部分内容',
      }
    }
  }

  return {
    ok: false,
    result: null,
    usedFallback: attempts.length > 1,
    attempts,
    reason: 'all_profiles_failed',
    reply: '',
    emitted: false,
  }
}
