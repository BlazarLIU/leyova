/**
 * ai/llm/provider.ts — 模型 Provider 抽象接口
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmTraceContext {
  runId?: string | null
  tenantId?: number | null
  conversationId?: string | number | null
  operationName?: string
  stepSeq?: number
  /** 命中的模型档位（Profile） */
  profileKey?: string
  /** 本次调用是否为降级后的备用模型 */
  isFallback?: boolean
}

export interface CompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  /** 审计血缘：写入 ai_v2_llm_call 的 run / conversation / 业务操作名 */
  trace?: LlmTraceContext
}

export interface CompletionResult {
  reply: string
  model: string
  inputTokens: number
  outputTokens: number
  costCny: number
  durationMs: number
}

export type LlmProtocol = 'openai' | 'anthropic'

export interface LlmHealth {
  protocol: LlmProtocol
  available: boolean
  baseUrlHost: string
  model: string
  /** 模型是否在服务端模型列表中；null 表示服务端不提供列表接口 */
  modelPresent: boolean | null
  latencyMs: number
  checkedAt: string
  /** 命中 60s 缓存 */
  cached: boolean
  error?: string
}

export interface LlmProvider {
  readonly protocol: LlmProtocol
  isAvailable(): boolean
  chat(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult | null>
  /** 真 token 流式；每收到一段增量调用 onDelta。未实现时可省略。 */
  chatStream?(
    messages: ChatMessage[],
    options: CompletionOptions | undefined,
    onDelta: (delta: string) => void
  ): Promise<CompletionResult | null>
  generateObject<T>(prompt: string, schemaDescription: string, options?: CompletionOptions): Promise<T | null>
  /** 真实探活（带缓存）；force=true 跳过缓存 */
  healthCheck(force?: boolean): Promise<LlmHealth>
}

/**
 * 拒绝本地 / 内网地址，确保只使用公网大模型服务。
 */
export function isLocalOrPrivateHost(apiBase: string): boolean {
  try {
    const host = new URL(apiBase).hostname.toLowerCase()
    if (!host) return true
    if (['localhost', '0.0.0.0', '::1', '[::1]'].includes(host)) return true
    if (host.endsWith('.local') || host.endsWith('.internal')) return true
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true
    // 云元数据服务 / 链路本地地址
    if (/^169\.254\./.test(host)) return true
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true
    // IPv6 链路本地 / 唯一本地地址
    if (/^\[?(fe80|fc|fd)/i.test(host)) return true
    const m = host.match(/^172\.(\d+)\./)
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true
    return false
  } catch {
    return true
  }
}
