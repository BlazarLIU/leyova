/**
 * ai/llm/index.ts — LLM Provider 工厂与运行时配置
 *
 * 根据数据库配置（超管界面可选 OpenAI / Anthropic 兼容）动态选择驱动；
 * 配置变更后无需重启，最多 10s 缓存内自动生效。
 */

import type { LlmProvider, LlmHealth } from './provider.js'
import {
  resolveLlmConfig,
  normalizeLlmEndpoint,
  type ResolvedLlmConfig,
  type LlmConfigInput,
} from './config-store.js'
import { OpenAiCompatibleProvider } from './openai-compatible.js'
import { AnthropicCompatibleProvider } from './anthropic-compatible.js'

export * from './provider.js'
export * from './config-store.js'
export { OpenAiCompatibleProvider } from './openai-compatible.js'
export { AnthropicCompatibleProvider } from './anthropic-compatible.js'

type ProviderConfig = Pick<ResolvedLlmConfig, 'enabled' | 'protocol' | 'apiBase' | 'apiKey' | 'model'>

export function buildLlmProvider(config: ProviderConfig): LlmProvider {
  return config.protocol === 'anthropic'
    ? new AnthropicCompatibleProvider({
        enabled: config.enabled,
        apiBase: config.apiBase,
        apiKey: config.apiKey,
        defaultModel: config.model,
      })
    : new OpenAiCompatibleProvider({
        enabled: config.enabled,
        apiBase: config.apiBase,
        apiKey: config.apiKey,
        defaultModel: config.model,
      })
}

let providerCache: { key: string; provider: LlmProvider } | null = null

export async function getLlmProvider(force = false): Promise<{ config: ResolvedLlmConfig; provider: LlmProvider }> {
  const config = await resolveLlmConfig(force)
  const key = [
    config.enabled ? '1' : '0',
    config.protocol,
    config.apiBase,
    config.model,
    config.apiKey,
  ].join('|')

  if (!force && providerCache && providerCache.key === key) {
    return { config, provider: providerCache.provider }
  }

  const provider = buildLlmProvider(config)
  providerCache = { key, provider }
  return { config, provider }
}

/** 使用草稿配置做真实探活（不落库） */
export async function testLlmConfig(input: LlmConfigInput): Promise<LlmHealth> {
  const base = await resolveLlmConfig()
  const { protocol, apiBase, model } = normalizeLlmEndpoint({
    protocol: input.protocol || base.protocol,
    apiBase: input.apiBase || base.apiBase,
    model: input.model || base.model,
  })
  const apiKey = input.apiKey?.trim() || base.apiKey
  if (!apiKey) throw new Error('请先填写 API Key')

  const provider = buildLlmProvider({ enabled: true, protocol, apiBase, apiKey, model })
  return provider.healthCheck(true)
}
