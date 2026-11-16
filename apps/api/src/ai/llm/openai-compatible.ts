/**
 * ai/llm/openai-compatible.ts — 通用 OpenAI 兼容模型驱动
 * 
 * 单一实现对接 DeepSeek、Qwen 通义千问、豆包、Ollama 与自建 vLLM。
 */

import { env } from '../../config/env.js'
import type { LlmProvider, ChatMessage, CompletionOptions, CompletionResult } from './provider.js'
import { estimateTokens, calculateCallCost } from './cost.js'

export class OpenAiCompatibleProvider implements LlmProvider {
  private apiBase: string
  private apiKey: string
  private defaultModel: string
  private timeoutMs: number

  constructor(custom?: { apiBase?: string; apiKey?: string; defaultModel?: string; timeoutMs?: number }) {
    this.apiBase = custom?.apiBase || process.env.LLM_API_BASE || 'http://127.0.0.1:11434/v1'
    this.apiKey = custom?.apiKey || process.env.LLM_API_KEY || ''
    this.defaultModel = custom?.defaultModel || process.env.LLM_MODEL || 'deepseek-chat'
    this.timeoutMs = custom?.timeoutMs || 60000
  }

  isAvailable(): boolean {
    // 只有显式开启并配置了基础环境时才启用外部 LLM
    return Boolean(env.AI_ENABLED && this.apiBase && (this.apiKey || this.apiBase.includes('localhost') || this.apiBase.includes('127.0.0.1')))
  }

  async chat(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult | null> {
    if (!this.isAvailable()) return null

    const model = options?.model || this.defaultModel
    const startTime = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options?.timeoutMs || this.timeoutMs)

    try {
      const res = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 2000,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.warn(`[llm] provider call failed (${res.status}): ${errText.slice(0, 200)}`)
        return null
      }

      const data = (await res.json()) as any
      const reply = data?.choices?.[0]?.message?.content || ''
      const durationMs = Date.now() - startTime

      const inputTokens = data?.usage?.prompt_tokens || messages.reduce((s, m) => s + estimateTokens(m.content), 0)
      const outputTokens = data?.usage?.completion_tokens || estimateTokens(reply)
      const costCny = calculateCallCost(model, inputTokens, outputTokens)

      return {
        reply,
        model,
        inputTokens,
        outputTokens,
        costCny,
        durationMs,
      }
    } catch (err) {
      console.warn('[llm] provider request error:', (err as Error)?.message || err)
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
      // 清除可能带有的 markdown ```json 标记
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

export const defaultLlmProvider = new OpenAiCompatibleProvider()
