/**
 * ai/llm/anthropic-compatible.ts — Anthropic Messages API 兼容驱动
 *
 * 对接 DeepSeek Anthropic 兼容端点（https://api.deepseek.com/anthropic）
 * 以及其他 Anthropic Messages 兼容服务。
 * 禁止本地/内网地址，避免回落到本地大模型。
 */

import { env } from '../../config/env.js'
import type {
  LlmProvider,
  LlmProtocol,
  LlmHealth,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
} from './provider.js'
import { isLocalOrPrivateHost } from './provider.js'
import { estimateTokens, calculateCallCost } from './cost.js'
import { recordLlmCall } from './call-log.js'
import { readSseStream } from './sse.js'

const HEALTH_TTL_MS = 60_000
const ANTHROPIC_VERSION = '2023-06-01'

export class AnthropicCompatibleProvider implements LlmProvider {
  readonly protocol: LlmProtocol = 'anthropic'
  private apiBase: string
  private apiKey: string
  private defaultModel: string
  private timeoutMs: number
  private enabled: boolean
  private healthTimeoutMs: number
  private healthCache: { at: number; value: LlmHealth } | null = null

  constructor(custom?: {
    apiBase?: string
    apiKey?: string
    defaultModel?: string
    timeoutMs?: number
    enabled?: boolean
    healthTimeoutMs?: number
  }) {
    this.apiBase = (custom?.apiBase || env.LLM_API_BASE || '').replace(/\/+$/, '')
    this.apiKey = custom?.apiKey || env.LLM_API_KEY || ''
    this.defaultModel = custom?.defaultModel || env.LLM_MODEL || ''
    this.timeoutMs = custom?.timeoutMs || env.LLM_TIMEOUT_MS || 60000
    this.enabled = custom?.enabled ?? env.AI_ENABLED
    this.healthTimeoutMs = custom?.healthTimeoutMs || env.LLM_HEALTH_TIMEOUT_MS
  }

  isAvailable(): boolean {
    return Boolean(
      this.enabled &&
        this.apiKey &&
        this.apiBase &&
        !isLocalOrPrivateHost(this.apiBase)
    )
  }

  private messagesUrl(): string {
    return this.apiBase.endsWith('/v1') ? `${this.apiBase}/messages` : `${this.apiBase}/v1/messages`
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    }
  }

  async healthCheck(force = false): Promise<LlmHealth> {
    const now = Date.now()
    if (!force && this.healthCache && now - this.healthCache.at < HEALTH_TTL_MS) {
      return { ...this.healthCache.value, cached: true }
    }

    const started = now
    let host = ''
    try {
      host = new URL(this.apiBase).host
    } catch {
      host = ''
    }

    const base: Omit<LlmHealth, 'available' | 'latencyMs' | 'checkedAt' | 'cached'> = {
      protocol: this.protocol,
      baseUrlHost: host,
      model: this.defaultModel,
      modelPresent: null,
    }

    let result: LlmHealth
    if (!this.enabled) {
      result = { ...base, available: false, latencyMs: 0, checkedAt: new Date().toISOString(), cached: false, error: 'AI_ENABLED=false' }
    } else if (!this.apiBase) {
      result = { ...base, available: false, latencyMs: 0, checkedAt: new Date().toISOString(), cached: false, error: 'LLM_API_BASE 未配置' }
    } else if (!this.apiKey) {
      result = { ...base, available: false, latencyMs: 0, checkedAt: new Date().toISOString(), cached: false, error: 'LLM_API_KEY 未配置' }
    } else if (isLocalOrPrivateHost(this.apiBase)) {
      result = { ...base, available: false, latencyMs: 0, checkedAt: new Date().toISOString(), cached: false, error: '拒绝本地/内网地址' }
    } else {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.healthTimeoutMs)
      try {
        // Anthropic 无稳定的 /models，使用 1 token 最小请求探活
        const res = await fetch(this.messagesUrl(), {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            model: this.defaultModel,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          const modelMissing = /model.*(not found|not exist|invalid)/i.test(errText)
          result = {
            ...base,
            modelPresent: modelMissing ? false : null,
            available: false,
            latencyMs: Date.now() - started,
            checkedAt: new Date().toISOString(),
            cached: false,
            error: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
          }
        } else {
          result = {
            ...base,
            modelPresent: true,
            available: true,
            latencyMs: Date.now() - started,
            checkedAt: new Date().toISOString(),
            cached: false,
          }
        }
      } catch (err) {
        result = {
          ...base,
          available: false,
          latencyMs: Date.now() - started,
          checkedAt: new Date().toISOString(),
          cached: false,
          error: (err as Error)?.message || String(err),
        }
      } finally {
        clearTimeout(timer)
      }
    }

    this.healthCache = { at: now, value: result }
    return result
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult | null> {
    const model = options?.model || this.defaultModel
    const promptChars = messages.reduce((s, m) => s + (m.content?.length || 0), 0)

    if (!this.isAvailable()) {
      await recordLlmCall({
        ...options?.trace,
        provider: 'anthropic-compatible',
        model,
        status: 'skipped',
        error: 'LLM disabled or not configured (AI_ENABLED / LLM_API_KEY / public base url)',
        promptChars,
      })
      return null
    }

    // Anthropic 的系统提示走顶层 system 字段
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content)
    const dialogue = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const startTime = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options?.timeoutMs || this.timeoutMs)

    try {
      const res = await fetch(this.messagesUrl(), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model,
          system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
          messages: dialogue,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 2000,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.warn(`[llm] anthropic call failed (${res.status}): ${errText.slice(0, 200)}`)
        await recordLlmCall({
          ...options?.trace,
          provider: 'anthropic-compatible',
          model,
          status: 'error',
          error: `HTTP ${res.status}: ${errText.slice(0, 500)}`,
          latencyMs: Date.now() - startTime,
          promptChars,
        })
        return null
      }

      const data = (await res.json()) as any
      const reply = Array.isArray(data?.content)
        ? data.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text || '').join('')
        : ''
      const durationMs = Date.now() - startTime

      const inputTokens = data?.usage?.input_tokens || messages.reduce((s, m) => s + estimateTokens(m.content), 0)
      const outputTokens = data?.usage?.output_tokens || estimateTokens(reply)
      const costCny = calculateCallCost(model, inputTokens, outputTokens)

      await recordLlmCall({
        ...options?.trace,
        provider: 'anthropic-compatible',
        model,
        status: 'success',
        inputTokens,
        outputTokens,
        costCny,
        latencyMs: durationMs,
        finishReason: data?.stop_reason || 'stop',
        promptChars,
        completionChars: reply.length,
      })

      return { reply, model, inputTokens, outputTokens, costCny, durationMs }
    } catch (err) {
      const message = (err as Error)?.message || String(err)
      console.warn('[llm] anthropic request error:', message)
      await recordLlmCall({
        ...options?.trace,
        provider: 'anthropic-compatible',
        model,
        status: 'error',
        error: message,
        latencyMs: Date.now() - startTime,
        promptChars,
      })
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 真 token 流式（Anthropic Messages SSE）。
   * 返回 null 表示调用失败（未产生可用内容）。
   */
  async chatStream(
    messages: ChatMessage[],
    options: CompletionOptions | undefined,
    onDelta: (delta: string) => void
  ): Promise<CompletionResult | null> {
    const model = options?.model || this.defaultModel
    const promptChars = messages.reduce((s, m) => s + (m.content?.length || 0), 0)

    if (!this.isAvailable()) {
      await recordLlmCall({
        ...options?.trace,
        provider: 'anthropic-compatible',
        model,
        status: 'skipped',
        error: 'LLM disabled or not configured (AI_ENABLED / LLM_API_KEY / public base url)',
        promptChars,
      })
      return null
    }

    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content)
    const dialogue = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const startTime = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options?.timeoutMs || this.timeoutMs)

    try {
      const res = await fetch(this.messagesUrl(), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model,
          system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
          messages: dialogue,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 2000,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        await recordLlmCall({
          ...options?.trace,
          provider: 'anthropic-compatible',
          model,
          status: 'error',
          error: `HTTP ${res.status}: ${errText.slice(0, 500)}`,
          latencyMs: Date.now() - startTime,
          promptChars,
        })
        return null
      }

      let reply = ''
      let usageIn = 0
      let usageOut = 0
      let finishReason = 'stop'

      await readSseStream(res, (data) => {
        try {
          const evt = JSON.parse(data) as any
          if (evt?.type === 'content_block_delta' && typeof evt?.delta?.text === 'string') {
            reply += evt.delta.text
            onDelta(evt.delta.text)
          } else if (evt?.type === 'message_start') {
            usageIn = Number(evt?.message?.usage?.input_tokens) || usageIn
          } else if (evt?.type === 'message_delta') {
            usageOut = Number(evt?.usage?.output_tokens) || usageOut
            if (evt?.delta?.stop_reason) finishReason = String(evt.delta.stop_reason)
          }
        } catch {
          // 忽略无法解析的行
        }
      })

      const inputTokens = usageIn || messages.reduce((s, m) => s + estimateTokens(m.content), 0)
      const outputTokens = usageOut || estimateTokens(reply)
      const costCny = calculateCallCost(model, inputTokens, outputTokens)
      const durationMs = Date.now() - startTime

      await recordLlmCall({
        ...options?.trace,
        provider: 'anthropic-compatible',
        model,
        status: 'success',
        inputTokens,
        outputTokens,
        costCny,
        latencyMs: durationMs,
        finishReason,
        promptChars,
        completionChars: reply.length,
      })

      return { reply, model, inputTokens, outputTokens, costCny, durationMs }
    } catch (err) {
      const message = (err as Error)?.message || String(err)
      await recordLlmCall({
        ...options?.trace,
        provider: 'anthropic-compatible',
        model,
        status: 'error',
        error: message,
        latencyMs: Date.now() - startTime,
        promptChars,
      })
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async generateObject<T>(prompt: string, schemaDescription: string, options?: CompletionOptions): Promise<T | null> {
    if (!this.isAvailable()) return null

    const systemPrompt = `你是一个精确的系统分析器。请严格根据要求生成纯 JSON 对象，不要使用任何 markdown 代码块标记，不要输出解释性文本。\nSchema 约定：\n${schemaDescription}`
    const result = await this.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      { ...options, temperature: 0.1 }
    )

    if (!result || !result.reply) return null

    try {
      let clean = result.reply.trim()
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim()
      }
      return JSON.parse(clean) as T
    } catch (err) {
      console.warn('[llm] failed to parse structured JSON from reply:', (err as Error)?.message)
      return null
    }
  }
}
