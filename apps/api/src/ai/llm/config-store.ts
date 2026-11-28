/**
 * ai/llm/config-store.ts — 运行时模型配置（DB 优先，env 兜底）
 *
 * 超管可在界面选择 OpenAI / Anthropic 兼容协议并配置 Base URL、模型与密钥；
 * 保存后无需重启即可生效。密钥使用 AES-256-GCM 加密存储，接口只返回脱敏值。
 */

import { getPool } from '../../lib/db.js'
import { env } from '../../config/env.js'
import {
  decryptCredential,
  encryptCredential,
  maskCredential,
} from '../../modules/data-governance/security.js'
import { isLocalOrPrivateHost, type LlmProtocol } from './provider.js'

const CACHE_TTL_MS = 10_000

export interface ResolvedLlmConfig {
  enabled: boolean
  protocol: LlmProtocol
  apiBase: string
  apiKey: string
  model: string
  source: 'database' | 'env'
  hasStoredApiKey: boolean
  updatedAt?: string
}

export interface PublicLlmConfig {
  enabled: boolean
  protocol: LlmProtocol
  apiBase: string
  model: string
  hasApiKey: boolean
  apiKeyMasked: string
  keySource: 'database' | 'env'
  source: 'database' | 'env'
  updatedAt?: string
}

let cache: { at: number; value: ResolvedLlmConfig } | null = null

function envConfig(): ResolvedLlmConfig {
  return {
    enabled: env.AI_ENABLED,
    protocol: env.LLM_PROTOCOL,
    apiBase: env.LLM_API_BASE.replace(/\/+$/, ''),
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    source: 'env',
    hasStoredApiKey: false,
  }
}

export async function resolveLlmConfig(force = false): Promise<ResolvedLlmConfig> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value

  let value = envConfig()
  try {
    const { rows } = await getPool().query(
      `SELECT enabled, protocol, api_base, api_key_enc, model, updated_at
         FROM public.llm_provider_config
        WHERE id = 1`
    )
    const row = rows[0]
    if (row) {
      value = {
        enabled: Boolean(row.enabled),
        protocol: row.protocol === 'anthropic' ? 'anthropic' : 'openai',
        apiBase: String(row.api_base || '').replace(/\/+$/, ''),
        apiKey: row.api_key_enc ? decryptCredential(row.api_key_enc) : env.LLM_API_KEY,
        model: String(row.model || env.LLM_MODEL),
        source: 'database',
        hasStoredApiKey: Boolean(row.api_key_enc),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      }
    }
  } catch (err) {
    console.warn('[llm] config load failed, fallback to env:', (err as Error)?.message || err)
  }

  cache = { at: Date.now(), value }
  return value
}

export async function getPublicLlmConfig(): Promise<PublicLlmConfig> {
  const cfg = await resolveLlmConfig(true)
  return {
    enabled: cfg.enabled,
    protocol: cfg.protocol,
    apiBase: cfg.apiBase,
    model: cfg.model,
    hasApiKey: Boolean(cfg.apiKey),
    apiKeyMasked: maskCredential(cfg.apiKey),
    keySource: cfg.hasStoredApiKey ? 'database' : 'env',
    source: cfg.source,
    updatedAt: cfg.updatedAt,
  }
}

export interface LlmConfigInput {
  enabled?: boolean
  protocol?: string
  apiBase?: string
  model?: string
  apiKey?: string
  clearApiKey?: boolean
}

export function normalizeLlmEndpoint(input: LlmConfigInput): {
  protocol: LlmProtocol
  apiBase: string
  model: string
} {
  const protocol: LlmProtocol = input.protocol === 'anthropic' ? 'anthropic' : 'openai'
  const apiBase = String(input.apiBase || '').trim().replace(/\/+$/, '')
  const model = String(input.model || '').trim()

  let url: URL
  try {
    url = new URL(apiBase)
  } catch {
    throw new Error('API Base URL 不合法')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('API Base URL 必须是 http/https 地址')
  }
  if (isLocalOrPrivateHost(apiBase)) {
    throw new Error('禁止使用本地/内网地址，请填写公网大模型服务')
  }
  if (!model) throw new Error('模型 ID 不能为空')

  return { protocol, apiBase, model }
}

export async function saveLlmConfig(input: LlmConfigInput, userId?: number | null): Promise<PublicLlmConfig> {
  const { protocol, apiBase, model } = normalizeLlmEndpoint(input)
  const enabled = input.enabled !== false

  let keyEnc: string | null = null
  if (input.clearApiKey) {
    keyEnc = ''
  } else if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    keyEnc = encryptCredential(input.apiKey.trim())
  }

  const pool = getPool()
  if (keyEnc === null) {
    await pool.query(
      `INSERT INTO public.llm_provider_config (id, enabled, protocol, api_base, api_key_enc, model, updated_by)
       VALUES (1, $1, $2, $3, '', $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET enabled = $1, protocol = $2, api_base = $3, model = $4, updated_by = $5, updated_at = now()`,
      [enabled, protocol, apiBase, model, userId ?? null]
    )
  } else {
    await pool.query(
      `INSERT INTO public.llm_provider_config (id, enabled, protocol, api_base, api_key_enc, model, updated_by)
       VALUES (1, $1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
         SET enabled = $1, protocol = $2, api_base = $3, api_key_enc = $4, model = $5,
             updated_by = $6, updated_at = now()`,
      [enabled, protocol, apiBase, keyEnc, model, userId ?? null]
    )
  }

  cache = null
  return getPublicLlmConfig()
}
