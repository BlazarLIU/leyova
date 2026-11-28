/**
 * kb-client.ts — 外部企业知识库客户端（RAGFlow / MaxKB 兼容）
 *
 * 设计原则（对齐计划 3.2）：
 *   1. **不自研底层引擎**：文档解析、切片、向量化、检索全部由外部知识库负责
 *   2. **不内嵌服务**：本系统不部署、不打包 RAGFlow/MaxKB，只作为 HTTP 客户端
 *   3. **优雅降级**：未配置或服务不可达时，AI 助手主链路完全不受影响
 *   4. **使用者自部署**：部署 leyova 的人填写自己部署的 RAGFlow 地址即可接入
 *
 * 配置来源优先级：数据库 ai_config 表 > 环境变量
 *   kb.provider      = 'ragflow' | 'maxkb' | 'none'
 *   kb.baseUrl       = http://192.168.1.10:9380
 *   kb.apiKey        = ragflow-xxxxx
 *   kb.datasetIds    = ds_1,ds_2  （可选，默认检索全部可访问数据集）
 */

import { getPool } from './db.js'
import { logger } from './logger.js'

export type KbProvider = 'ragflow' | 'maxkb' | 'none'

export interface KbConfig {
  provider: KbProvider
  baseUrl: string
  apiKey: string
  datasetIds: string[]
  topK: number
  similarityThreshold: number
}

export interface KnowledgeChunk {
  chunkId: string
  documentId: string
  documentName: string
  content: string
  similarity: number
  metadata?: Record<string, any>
}

const CONFIG_KEYS = {
  provider: 'kb.provider',
  baseUrl: 'kb.baseUrl',
  apiKey: 'kb.apiKey',
  datasetIds: 'kb.datasetIds',
  topK: 'kb.topK',
  similarityThreshold: 'kb.similarityThreshold',
} as const

const configCache = new Map<string, { value: string; expiresAt: number }>()
const CACHE_TTL_MS = 30_000

/** 配置变更后主动失效缓存，避免读到旧值 */
export function invalidateKbConfigCache(): void {
  configCache.clear()
}

/** 从 ai_config 表读取配置，带 30s 内存缓存 */
async function readConfigValues(): Promise<Record<string, string>> {
  const now = Date.now()
  const cached = configCache.get('__all__')
  if (cached && cached.expiresAt > now) {
    return JSON.parse(cached.value)
  }
  try {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT config_key, config_value FROM ai_config WHERE config_key LIKE 'kb.%'`,
    )
    const map: Record<string, string> = {}
    for (const r of rows) map[r.config_key] = r.config_value
    configCache.set('__all__', { value: JSON.stringify(map), expiresAt: now + CACHE_TTL_MS })
    return map
  } catch {
    return {}
  }
}

/** 解析当前知识库配置；env 作为兜底 */
export async function getKbConfig(): Promise<KbConfig> {
  const db = await readConfigValues()

  const provider = (db[CONFIG_KEYS.provider] || process.env.LEYOVA_KB_PROVIDER || 'none') as KbProvider
  const baseUrl = (db[CONFIG_KEYS.baseUrl] || process.env.LEYOVA_KB_BASE_URL || '').replace(/\/+$/, '')
  const apiKey = db[CONFIG_KEYS.apiKey] || process.env.LEYOVA_KB_API_KEY || ''
  const dsRaw = db[CONFIG_KEYS.datasetIds] || process.env.LEYOVA_KB_DATASET_IDS || ''
  const topK = parseInt(db[CONFIG_KEYS.topK] || '5', 10) || 5
  const similarityThreshold = parseFloat(db[CONFIG_KEYS.similarityThreshold] || '0.2') || 0.2

  const datasetIds = dsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return { provider, baseUrl, apiKey, datasetIds, topK, similarityThreshold }
}

/** 知识库是否可用（配置齐全） */
export async function isKbConfigured(): Promise<boolean> {
  const cfg = await getKbConfig()
  return cfg.provider !== 'none' && !!cfg.baseUrl && !!cfg.apiKey
}

function authHeaders(cfg: KbConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  }
}

// ---------------------------------------------------------------------------
// RAGFlow 实现
// ---------------------------------------------------------------------------

interface RagflowRetrievalResult {
  code?: number
  message?: string
  data?: {
    chunks?: Array<{
      id?: string
      content?: string
      content_ltks?: string
      document_id?: string
      document_keyword?: string
      docnm_kwd?: string
      similarity?: number
      vector_similarity?: number
      term_similarity?: number
      [k: string]: any
    }>
    total?: number
  }
}

async function searchRagflow(
  cfg: KbConfig,
  query: string,
  options: { datasetIds?: string[]; topK?: number; similarityThreshold?: number },
): Promise<KnowledgeChunk[]> {
  const datasetIds = options.datasetIds?.length ? options.datasetIds : cfg.datasetIds
  const topK = options.topK ?? cfg.topK
  const threshold = options.similarityThreshold ?? cfg.similarityThreshold

  const payload: Record<string, any> = {
    question: query,
    page_size: topK,
    similarity_threshold: threshold,
  }
  if (datasetIds.length > 0) payload.dataset_ids = datasetIds

  const res = await fetch(`${cfg.baseUrl}/api/v1/retrieval`, {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`RAGFlow 检索失败: HTTP ${res.status}`)
  }

  const json = (await res.json()) as RagflowRetrievalResult
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(`RAGFlow 返回错误: ${json.message || json.code}`)
  }

  const chunks = json.data?.chunks || []
  return chunks.map((c) => ({
    chunkId: c.id || '',
    documentId: c.document_id || '',
    documentName: c.docnm_kwd || c.document_keyword || '',
    content: c.content || '',
    similarity: Number(c.similarity ?? c.vector_similarity ?? 0),
    metadata: {
      vectorSimilarity: c.vector_similarity,
      termSimilarity: c.term_similarity,
    },
  }))
}

// ---------------------------------------------------------------------------
// MaxKB 实现（备选方案，API 更简单）
// ---------------------------------------------------------------------------

interface MaxKbResult {
  code?: number
  message?: string
  data?: Array<{
    id?: string
    document_id?: string
    title?: string
    content?: string
    similarity?: number
    [k: string]: any
  }>
}

async function searchMaxkb(
  cfg: KbConfig,
  query: string,
  options: { datasetIds?: string[]; topK?: number },
): Promise<KnowledgeChunk[]> {
  const datasetIds = options.datasetIds?.length ? options.datasetIds : cfg.datasetIds
  const topK = options.topK ?? cfg.topK
  const datasetId = datasetIds[0]
  if (!datasetId) throw new Error('MaxKB 需要指定 datasetId')

  const res = await fetch(`${cfg.baseUrl}/api/dataset/${datasetId}/hit_test`, {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify({ query_text: query, top_number: topK }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) throw new Error(`MaxKB 检索失败: HTTP ${res.status}`)
  const json = (await res.json()) as MaxKbResult
  const items = json.data || []

  return items.map((c) => ({
    chunkId: c.id || '',
    documentId: c.document_id || '',
    documentName: c.title || '',
    content: c.content || '',
    similarity: Number(c.similarity ?? 0),
  }))
}

// ---------------------------------------------------------------------------
// 对外统一接口
// ---------------------------------------------------------------------------

export interface SearchOptions {
  datasetIds?: string[]
  topK?: number
  similarityThreshold?: number
}

/**
 * 检索知识库。未配置或不可达时返回空数组，不抛错。
 * AI 助手据此判断是否把知识作为上下文注入。
 */
export async function searchKnowledgeBase(
  query: string,
  options: SearchOptions = {},
): Promise<KnowledgeChunk[]> {
  const cfg = await getKbConfig()
  if (cfg.provider === 'none' || !cfg.baseUrl || !cfg.apiKey) {
    return []
  }

  try {
    if (cfg.provider === 'ragflow') {
      return await searchRagflow(cfg, query, options)
    }
    if (cfg.provider === 'maxkb') {
      return await searchMaxkb(cfg, query, options)
    }
    return []
  } catch (err: any) {
    logger.warn({ err: err?.message, provider: cfg.provider }, '[kb] 检索失败，已降级为无知识上下文')
    return []
  }
}

/**
 * 严格检索：异常向上抛出，供「连通性测试」区分
 *   - 连不上 → 抛错（真实失败）
 *   - 连上但无结果 → 返回空数组（正常）
 */
export async function searchKnowledgeBaseStrict(
  query: string,
  options: SearchOptions = {},
): Promise<KnowledgeChunk[]> {
  const cfg = await getKbConfig()
  if (cfg.provider === 'none') throw new Error('未启用企业知识库（provider=none）')
  if (!cfg.baseUrl) throw new Error('未填写知识库地址')
  if (!cfg.apiKey) throw new Error('未填写 API Key')

  if (cfg.provider === 'ragflow') return await searchRagflow(cfg, query, options)
  if (cfg.provider === 'maxkb') return await searchMaxkb(cfg, query, options)
  return []
}

/**
 * 把 AI 生成的报告/复盘沉淀到知识库。
 * 未配置时返回 null，调用方静默跳过。
 */
export async function uploadToKnowledgeBase(
  title: string,
  content: string,
  metadata: Record<string, any> = {},
): Promise<{ documentId: string } | null> {
  const cfg = await getKbConfig()
  if (cfg.provider === 'none' || !cfg.baseUrl || !cfg.apiKey) return null

  try {
    if (cfg.provider === 'ragflow') {
      const datasetId = cfg.datasetIds[0]
      if (!datasetId) {
        logger.warn('[kb] RAGFlow 未配置 datasetIds，跳过文档沉淀')
        return null
      }
      const res = await fetch(`${cfg.baseUrl}/api/v1/datasets/${datasetId}/documents`, {
        method: 'POST',
        headers: authHeaders(cfg),
        body: JSON.stringify({
          name: title,
          content,
          meta_fields: metadata,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as any
      const docId = json?.data?.id || json?.data?.[0]?.id || ''
      return { documentId: String(docId) }
    }
    return null
  } catch (err: any) {
    logger.warn({ err: err?.message }, '[kb] 文档沉淀失败')
    return null
  }
}

export interface UploadResult {
  ok: boolean
  /** 未配置知识库 */
  notConfigured: boolean
  documentId: string | null
  error?: string
}

/**
 * 严格版文档沉淀：区分三种情况
 *   - 未配置 → notConfigured=true
 *   - 配置了但请求失败 → notConfigured=false, error 有值
 *   - 成功 ��� ok=true
 * 供需要「如实告知用户」的场景（如复盘报告沉淀）使用。
 */
export async function uploadToKnowledgeBaseStrict(
  title: string,
  content: string,
  metadata: Record<string, any> = {},
): Promise<UploadResult> {
  const cfg = await getKbConfig()
  if (cfg.provider === 'none' || !cfg.baseUrl || !cfg.apiKey) {
    return { ok: false, notConfigured: true, documentId: null }
  }

  try {
    if (cfg.provider === 'ragflow') {
      const datasetId = cfg.datasetIds[0]
      if (!datasetId) {
        return { ok: false, notConfigured: false, documentId: null, error: '已配置 RAGFlow 但未指定 datasetIds' }
      }
      const res = await fetch(`${cfg.baseUrl}/api/v1/datasets/${datasetId}/documents`, {
        method: 'POST',
        headers: authHeaders(cfg),
        body: JSON.stringify({ name: title, content, meta_fields: metadata }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          ok: false, notConfigured: false, documentId: null,
          error: `RAGFlow 返回 HTTP ${res.status}：${text.slice(0, 200)}`,
        }
      }
      const json = (await res.json()) as any
      const docId = json?.data?.id || json?.data?.[0]?.id || ''
      return { ok: true, notConfigured: false, documentId: String(docId) || null }
    }
    // MaxKB 暂未实现写入
    return { ok: false, notConfigured: false, documentId: null, error: `当前 provider=${cfg.provider} 暂不支持文档写入` }
  } catch (err: any) {
    return {
      ok: false, notConfigured: false, documentId: null,
      error: `请求知识库失败：${err?.message || err}`,
    }
  }
}

/** 连通性测试（供前端配置页使用） */
export async function testKnowledgeBaseConnection(): Promise<{
  ok: boolean
  provider: KbProvider
  message: string
  latencyMs?: number
  sampleCount?: number
}> {
  const cfg = await getKbConfig()
  if (cfg.provider === 'none') {
    return { ok: false, provider: cfg.provider, message: '未启用企业知识库（provider=none）' }
  }
  if (!cfg.baseUrl) {
    return { ok: false, provider: cfg.provider, message: '未填写知识库地址' }
  }
  if (!cfg.apiKey) {
    return { ok: false, provider: cfg.provider, message: '未填写 API Key' }
  }

  const started = Date.now()
  try {
    // 使用严格版：连不上必须抛错，而不是伪装成「0 条结果」
    const chunks = await searchKnowledgeBaseStrict('连通性测试', { topK: 1 })
    return {
      ok: true,
      provider: cfg.provider,
      message: `连接正常，返回 ${chunks.length} 条检索结果`,
      latencyMs: Date.now() - started,
      sampleCount: chunks.length,
    }
  } catch (err: any) {
    return {
      ok: false,
      provider: cfg.provider,
      message: `连接失败：${err?.message || err}`,
      latencyMs: Date.now() - started,
    }
  }
}
