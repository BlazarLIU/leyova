/**
 * ai/llm/provider.ts — 模型 Provider 抽象接口
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

export interface CompletionResult {
  reply: string
  model: string
  inputTokens: number
  outputTokens: number
  costCny: number
  durationMs: number
}

export interface LlmProvider {
  isAvailable(): boolean
  chat(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult | null>
  generateObject<T>(prompt: string, schemaDescription: string, options?: CompletionOptions): Promise<T | null>
}
