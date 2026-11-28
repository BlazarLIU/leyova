/**
 * knowledge/embedding.ts — 文本向量化
 *
 * 复用 OpenAI 兼容 /embeddings 端点（豆包、通义、OpenAI 均可）。
 * 约定：
 *   - 未配置模型时返回 null，调用方必须降级为关键词检索，不允许报错中断；
 *   - 维度由首次调用结果确定并写回集合配置，换模型必须新建索引版本；
 *   - 只使用显式配置或已加密保存的密钥，不偷读环境变量。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { loadIntegrationCredential } from '../integrations/credentials.js'
import { assertEndpointAllowed } from '../integrations/connectors.js'

export interface EmbeddingConfig {
  apiBase: string
  apiKey: string
  model: string
  dim: number
}

export interface EmbeddingResult {
  vectors: number[][]
  model: string
  dim: number
  degraded: boolean
  reason?: string
}

/**
 * 读取集合上的 embedding 配置。
 * 模型来自集合 config（非敏感），地址与密钥按 provider 从连接器读取：
 *   - openai_compatible：地址在连接 config.baseUrl，密钥在加密凭证表；
 *   - doubao / dashscope：地址取连接器默认值，密钥在加密凭证表。
 */
export async function loadEmbeddingConfig(
  db: DbExecutor | undefined,
  tenantId: number,
  collectionCode: string
): Promise<EmbeddingConfig | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<{
    model: string
    dim: number
    api_base: string
    provider: string
  }>(
    `SELECT coalesce(embedding_model, '') AS model,
            coalesce(embedding_dim, 0) AS dim,
            coalesce(config->>'embeddingApiBase', '') AS api_base,
            coalesce(config->>'embeddingProvider', '') AS provider
       FROM public.kb_collections
      WHERE tenant_id = $1 AND code = $2
      LIMIT 1`,
    [tenantId, collectionCode]
  ).catch(() => ({ rows: [] as any[] }))

  const row = rows[0]
  if (!row || !row.provider || !row.model) return null

  const credential = await loadIntegrationCredential(executor, tenantId, row.provider)
  const apiKey = credential?.secrets.apiKey
  if (!apiKey) return null

  // 地址优先级：集合显式配置 → 连接器自身 config.baseUrl → 内置预设地址
  let apiBase = String(row.api_base || '').replace(/\/+$/, '')
  if (!apiBase) {
    const { rows: connRows } = await executor.query<{ base_url: string }>(
      `SELECT coalesce(config->>'baseUrl', '') AS base_url
         FROM public.integration_connections
        WHERE tenant_id = $1 AND platform = $2
        LIMIT 1`,
      [tenantId, row.provider]
    ).catch(() => ({ rows: [] as any[] }))
    apiBase = String(connRows[0]?.base_url || '').replace(/\/+$/, '')
  }
  if (!apiBase) {
    const { getConnector } = await import('../integrations/connectors.js')
    apiBase = String(getConnector(row.provider)?.defaultConfig.baseUrl || '').replace(/\/+$/, '')
  }
  if (!apiBase) return null

  return {
    apiBase,
    apiKey,
    model: String(row.model),
    dim: Number(row.dim) || 0,
  }
}

async function requestEmbeddings(
  cfg: EmbeddingConfig,
  inputs: string[],
  timeoutMs = 20000
): Promise<{ vectors: number[][]; dim: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${cfg.apiBase}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model: cfg.model, input: inputs }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`embeddings HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = (await res.json()) as any
    const rows: any[] = Array.isArray(data?.data) ? data.data : []
    const vectors = rows
      .sort((a, b) => Number(a?.index ?? 0) - Number(b?.index ?? 0))
      .map((item) => (Array.isArray(item?.embedding) ? item.embedding.map(Number) : []))
    const dim = vectors[0]?.length || 0
    if (vectors.length !== inputs.length || dim === 0) throw new Error('embeddings 返回维度或数量不匹配')
    return { vectors, dim }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 批量向量化。失败或未配置都返回 degraded=true，调用方走关键词检索。
 */
export async function embedTexts(inputs: string[], cfg: EmbeddingConfig | null): Promise<EmbeddingResult> {
  const texts = inputs.map((item) => String(item ?? '').trim())
  if (texts.length === 0) return { vectors: [], model: '', dim: 0, degraded: false }
  if (!cfg) {
    return { vectors: [], model: '', dim: 0, degraded: true, reason: 'embedding_not_configured' }
  }
  const rejected = assertEndpointAllowed(cfg.apiBase)
  if (rejected) {
    return { vectors: [], model: cfg.model, dim: 0, degraded: true, reason: rejected }
  }
  try {
    const { vectors, dim } = await requestEmbeddings(cfg, texts)
    return {
      vectors,
      model: cfg.model,
      dim,
      degraded: false,
    }
  } catch (err) {
    return {
      vectors: [],
      model: cfg.model,
      dim: 0,
      degraded: true,
      reason: (err as Error)?.message || String(err),
    }
  }
}

/** pgvector 字面量：[0.1,0.2,...] */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => (Number.isFinite(v) ? Number(v.toFixed(6)) : 0)).join(',')}]`
}

export interface EmbeddingTestInput {
  tenantId: number
  provider: string
  apiBase?: string
  model: string
  apiKey?: string
}

export interface EmbeddingTestResult {
  ok: boolean
  provider: string
  model: string
  dim: number
  latencyMs: number
  baseUrlHost: string
  error?: string
}

/** 使用草稿配置或已加密存储的凭证对 /embeddings 做真实探活测试 */
export async function testEmbeddingConnection(
  input: EmbeddingTestInput,
  db?: DbExecutor
): Promise<EmbeddingTestResult> {
  const executor = db || getPool()
  const provider = String(input.provider || '').trim()
  const model = String(input.model || '').trim()
  const started = Date.now()

  if (!provider) {
    return { ok: false, provider, model, dim: 0, latencyMs: 0, baseUrlHost: '', error: '请选择模型供应商' }
  }
  if (!model) {
    return { ok: false, provider, model, dim: 0, latencyMs: 0, baseUrlHost: '', error: '请填写向量模型 ID' }
  }

  let apiBase = String(input.apiBase || '').trim().replace(/\/+$/, '')
  if (!apiBase) {
    const { rows: connRows } = await executor.query<{ base_url: string }>(
      `SELECT coalesce(config->>'baseUrl', '') AS base_url
         FROM public.integration_connections
        WHERE tenant_id = $1 AND platform = $2
        LIMIT 1`,
      [input.tenantId, provider]
    ).catch(() => ({ rows: [] as any[] }))
    apiBase = String(connRows[0]?.base_url || '').trim().replace(/\/+$/, '')
  }
  if (!apiBase) {
    const { getConnector } = await import('../integrations/connectors.js')
    apiBase = String(getConnector(provider)?.defaultConfig.baseUrl || '').trim().replace(/\/+$/, '')
  }
  if (!apiBase) {
    return { ok: false, provider, model, dim: 0, latencyMs: 0, baseUrlHost: '', error: '请填写 API Base URL' }
  }

  let baseUrlHost = ''
  try {
    baseUrlHost = new URL(apiBase).host
  } catch {
    return { ok: false, provider, model, dim: 0, latencyMs: 0, baseUrlHost: '', error: 'API Base URL 格式不合法' }
  }

  const rejected = assertEndpointAllowed(apiBase)
  if (rejected) {
    return { ok: false, provider, model, dim: 0, latencyMs: 0, baseUrlHost, error: rejected }
  }

  let apiKey = String(input.apiKey || '').trim()
  if (!apiKey) {
    const credential = await loadIntegrationCredential(executor, input.tenantId, provider)
    apiKey = credential?.secrets.apiKey || ''
  }
  if (!apiKey) {
    return {
      ok: false,
      provider,
      model,
      dim: 0,
      latencyMs: 0,
      baseUrlHost,
      error: '未配置 API Key，请先输入密钥或保存凭证',
    }
  }

  try {
    const { dim } = await requestEmbeddings({ apiBase, apiKey, model, dim: 0 }, ['向量模型连通性测试'], 15000)
    return {
      ok: true,
      provider,
      model,
      dim,
      latencyMs: Date.now() - started,
      baseUrlHost,
    }
  } catch (err) {
    return {
      ok: false,
      provider,
      model,
      dim: 0,
      latencyMs: Date.now() - started,
      baseUrlHost,
      error: (err as Error)?.message || String(err),
    }
  }
}