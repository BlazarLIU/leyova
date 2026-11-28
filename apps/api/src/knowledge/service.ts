/**
 * knowledge/service.ts — 知识平台核心服务
 *
 * 职责：
 *   1. 集合 / 文档 / 切片 CRUD（全部带租户隔离）。
 *   2. 入库管道：清洗 → 分块 → embedding → 切片落库 → 索引版本。
 *   3. 混合检索：向量（pgvector）优先，不可用时退化为关键词（pg_trgm）；
 *      违禁词走规则库，不参与向量排序。
 *   4. 引用回溯：返回的 chunkId 即本地 kb_chunks.id，可挂到 ai_v2_citation。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { loadIntegrationCredential } from '../integrations/credentials.js'
import { embedTexts, loadEmbeddingConfig, toVectorLiteral } from './embedding.js'
import { cleanText, contentFingerprint, splitText, splitTranscript, type TranscriptSegment } from './chunking.js'
import { buildAutomaton, DEFAULT_BANNED_RULES, type BannedWordRule } from './banned-words.js'

const EMBED_BATCH = 32

export interface CollectionView {
  id: string
  code: string
  name: string
  domain: string
  description: string
  embeddingModel: string
  embeddingDim: number
  chunkSize: number
  chunkOverlap: number
  status: string
  documentCount: number
  chunkCount: number
  config: Record<string, unknown>
  updatedAt: string
}

interface CollectionRow {
  id: string
  code: string
  name: string
  domain: string
  description: string
  embedding_model: string
  embedding_dim: number
  chunk_size: number
  chunk_overlap: number
  status: string
  document_count: number
  chunk_count: number
  config: Record<string, unknown>
  updated_at: string
}

function mapCollection(row: CollectionRow): CollectionView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    domain: row.domain,
    description: row.description,
    embeddingModel: row.embedding_model,
    embeddingDim: Number(row.embedding_dim) || 0,
    chunkSize: Number(row.chunk_size) || 800,
    chunkOverlap: Number(row.chunk_overlap) || 100,
    status: row.status,
    documentCount: Number(row.document_count) || 0,
    chunkCount: Number(row.chunk_count) || 0,
    config: (row.config || {}) as Record<string, unknown>,
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

export async function listCollections(tenantId: number, db?: DbExecutor): Promise<CollectionView[]> {
  const executor = db || getPool()
  const { rows } = await executor.query<CollectionRow>(
    `SELECT id, code, name, domain, description, embedding_model, embedding_dim,
            chunk_size, chunk_overlap, status, document_count, chunk_count, config, updated_at
       FROM public.kb_collections
      WHERE tenant_id = $1
      ORDER BY domain, code`,
    [tenantId]
  )
  return rows.map(mapCollection)
}

export async function getCollectionByCode(
  tenantId: number,
  code: string,
  db?: DbExecutor
): Promise<CollectionRow | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<CollectionRow>(
    `SELECT id, code, name, domain, description, embedding_model, embedding_dim,
            chunk_size, chunk_overlap, status, document_count, chunk_count, config, updated_at
       FROM public.kb_collections
      WHERE tenant_id = $1 AND code = $2
      LIMIT 1`,
    [tenantId, code]
  )
  return rows[0] || null
}

export const BUILTIN_COLLECTION_CODES = new Set(['products', 'scripts', 'banned_words', 'replays'])

/** 判断是否为确定性规则集合（如违禁词库：走 DFA 自动机，不支持向量检索模型） */
export function isRuleOnlyCollection(code: string, domain?: string): boolean {
  return code === 'banned_words' || domain === 'banned'
}

export interface CreateCollectionInput {
  tenantId: number
  code: string
  name: string
  domain?: 'product' | 'script' | 'banned' | 'replay' | 'document'
  description?: string
  chunkSize?: number
  chunkOverlap?: number
  userId?: number | null
}

/** 新建知识集合（自定义分类） */
export async function createCollection(input: CreateCollectionInput, db?: DbExecutor): Promise<CollectionView> {
  const executor = db || getPool()
  const code = input.code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  if (!code) throw new Error('集合编码不能为空')
  const name = input.name.trim()
  if (!name) throw new Error('集合名称不能为空')

  const chunkSize = Math.min(4000, Math.max(100, Number(input.chunkSize) || 800))
  const rawOverlap = input.chunkOverlap !== undefined ? Number(input.chunkOverlap) : 100
  const chunkOverlap = Math.min(chunkSize - 1, Math.max(0, Number.isFinite(rawOverlap) ? rawOverlap : 100))
  const domain = input.domain || 'document'

  const existing = await getCollectionByCode(input.tenantId, code, executor)
  if (existing) throw new Error(`集合编码 "${code}" 已存在`)

  const { rows } = await executor.query<CollectionRow>(
    `INSERT INTO public.kb_collections
       (tenant_id, code, name, domain, description, chunk_size, chunk_overlap, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, code, name, domain, description, embedding_model, embedding_dim,
               chunk_size, chunk_overlap, status, document_count, chunk_count, config, updated_at`,
    [
      input.tenantId,
      code,
      name.slice(0, 120),
      domain,
      String(input.description || '').slice(0, 2000),
      chunkSize,
      chunkOverlap,
      input.userId ?? null,
    ]
  )
  return mapCollection(rows[0])
}

export interface UpdateCollectionInput {
  tenantId: number
  code: string
  name?: string
  domain?: 'product' | 'script' | 'banned' | 'replay' | 'document'
  embeddingProvider?: string
  embeddingApiBase?: string
  embeddingModel?: string
  chunkSize?: number
  chunkOverlap?: number
  description?: string
}

/** 更新集合配置；换模型时维度清零并要求重建索引版本 */
export async function updateCollection(input: UpdateCollectionInput, db?: DbExecutor): Promise<CollectionView | null> {
  const executor = db || getPool()
  const existing = await getCollectionByCode(input.tenantId, input.code, executor)
  if (!existing) return null

  const targetDomain = input.domain || existing.domain
  const ruleOnly = isRuleOnlyCollection(existing.code, targetDomain)

  const nextModel = ruleOnly
    ? ''
    : (input.embeddingModel !== undefined ? input.embeddingModel.trim() : existing.embedding_model)
  const modelChanged = nextModel !== existing.embedding_model || ruleOnly

  const config = { ...(existing.config || {}) } as Record<string, unknown>
  if (ruleOnly) {
    delete config.embeddingProvider
    delete config.embeddingApiBase
  } else {
    if (input.embeddingProvider !== undefined) config.embeddingProvider = input.embeddingProvider.trim()
    if (input.embeddingApiBase !== undefined) config.embeddingApiBase = input.embeddingApiBase.trim().replace(/\/+$/, '')
  }

  const nextChunkSize = Math.min(4000, Math.max(100, Number(input.chunkSize) || existing.chunk_size))
  const rawOverlap = input.chunkOverlap !== undefined ? Number(input.chunkOverlap) : existing.chunk_overlap
  const nextChunkOverlap = Math.min(nextChunkSize - 1, Math.max(0, Number.isFinite(rawOverlap) ? rawOverlap : 100))

  const { rows } = await executor.query<CollectionRow>(
    `UPDATE public.kb_collections
        SET name = $3,
            domain = $4,
            embedding_model = $5,
            embedding_dim = CASE WHEN $6 THEN 0 ELSE embedding_dim END,
            chunk_size = $7,
            chunk_overlap = $8,
            description = $9,
            config = $10::jsonb,
            updated_at = now()
      WHERE tenant_id = $1 AND code = $2
      RETURNING id, code, name, domain, description, embedding_model, embedding_dim,
                chunk_size, chunk_overlap, status, document_count, chunk_count, config, updated_at`,
    [
      input.tenantId,
      input.code,
      input.name !== undefined && input.name.trim() ? input.name.trim().slice(0, 120) : existing.name,
      targetDomain,
      nextModel,
      modelChanged,
      nextChunkSize,
      nextChunkOverlap,
      input.description !== undefined ? String(input.description) : existing.description,
      JSON.stringify(config),
    ]
  )
  return rows[0] ? mapCollection(rows[0]) : null
}

/** 删除自定义知识集合（内置基础集合受保护） */
export async function deleteCollection(tenantId: number, code: string, db?: DbExecutor): Promise<boolean> {
  if (BUILTIN_COLLECTION_CODES.has(code)) {
    throw new Error('系统内置基础集合不可删除')
  }
  const executor = db || getPool()
  const { rowCount } = await executor.query(
    `DELETE FROM public.kb_collections WHERE tenant_id = $1 AND code = $2`,
    [tenantId, code]
  )
  return (rowCount || 0) > 0
}

export interface DocumentView {
  id: string
  collectionId: string
  collectionCode: string
  collectionName?: string
  title: string
  sourceType: string
  sourceRef: string
  docVersion: number
  status: string
  chunkCount: number
  businessKey: string
  meta: Record<string, unknown>
  createdAt: string
  updatedAt?: string
}

/** 列表查询：按集合、状态或关键词过滤，默认最近 100 条 */
export async function listDocuments(
  tenantId: number,
  options: { collectionCode?: string; status?: string; search?: string; limit?: number } = {},
  db?: DbExecutor
): Promise<DocumentView[]> {
  const executor = db || getPool()
  const limit = Math.min(200, Math.max(1, options.limit || 100))
  const params: unknown[] = [tenantId]
  let where = 'd.tenant_id = $1'
  if (options.collectionCode) {
    params.push(options.collectionCode)
    where += ` AND c.code = $${params.length}`
  }
  if (options.status) {
    params.push(options.status)
    where += ` AND d.status = $${params.length}`
  }
  if (options.search && options.search.trim()) {
    params.push(`%${options.search.trim()}%`)
    where += ` AND (d.title ILIKE $${params.length} OR d.business_key ILIKE $${params.length} OR d.source_ref ILIKE $${params.length})`
  }
  params.push(limit)

  const { rows } = await executor.query<{
    id: string
    collection_id: string
    collection_code: string
    collection_name: string
    title: string
    source_type: string
    source_ref: string
    doc_version: number
    status: string
    chunk_count: number
    business_key: string
    meta: Record<string, unknown>
    created_at: string
    updated_at: string
  }>(
    `SELECT d.id, d.collection_id, c.code AS collection_code, c.name AS collection_name,
            d.title, d.source_type, d.source_ref, d.doc_version, d.status,
            d.chunk_count, d.business_key, d.meta, d.created_at, d.updated_at
       FROM public.kb_documents d
       JOIN public.kb_collections c ON c.id = d.collection_id
      WHERE ${where}
      ORDER BY d.updated_at DESC, d.created_at DESC
      LIMIT $${params.length}`,
    params
  )

  return rows.map((row) => ({
    id: row.id,
    collectionId: row.collection_id,
    collectionCode: row.collection_code,
    collectionName: row.collection_name,
    title: row.title,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    docVersion: Number(row.doc_version) || 1,
    status: row.status,
    chunkCount: Number(row.chunk_count) || 0,
    businessKey: row.business_key,
    meta: (row.meta || {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }))
}

/** 读取单篇文档详情及其全量切片（附拼接后的原始全文） */
export async function getDocumentDetail(
  tenantId: number,
  documentId: string,
  db?: DbExecutor
): Promise<{
  id: string
  collectionCode: string
  collectionName: string
  title: string
  sourceType: string
  sourceRef: string
  docVersion: number
  status: string
  chunkCount: number
  businessKey: string
  createdAt: string
  updatedAt: string
  fullContent: string
  chunks: Array<{
    id: string
    seq: number
    content: string
    tokenCount: number
    pageNo: number | null
    startMs: number | null
    endMs: number | null
  }>
} | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT d.*, c.code AS collection_code, c.name AS collection_name
       FROM public.kb_documents d
       JOIN public.kb_collections c ON c.id = d.collection_id
      WHERE d.tenant_id = $1 AND d.id = $2
      LIMIT 1`,
    [tenantId, documentId]
  )
  const doc = rows[0]
  if (!doc) return null

  const { rows: chunkRows } = await executor.query<any>(
    `SELECT id, seq, content, token_count, page_no, start_ms, end_ms
       FROM public.kb_chunks
      WHERE tenant_id = $1 AND document_id = $2
      ORDER BY seq ASC`,
    [tenantId, documentId]
  )

  const rawTextMeta = typeof doc.meta?.rawContent === 'string' ? doc.meta.rawContent : ''
  const fullContent = rawTextMeta || chunkRows.map((c) => c.content).join('\n\n')

  return {
    id: String(doc.id),
    collectionCode: doc.collection_code,
    collectionName: doc.collection_name,
    title: doc.title,
    sourceType: doc.source_type,
    sourceRef: doc.source_ref,
    docVersion: Number(doc.doc_version) || 1,
    status: doc.status,
    chunkCount: Number(doc.chunk_count) || 0,
    businessKey: doc.business_key || '',
    createdAt: new Date(doc.created_at).toISOString(),
    updatedAt: new Date(doc.updated_at).toISOString(),
    fullContent,
    chunks: chunkRows.map((c) => ({
      id: String(c.id),
      seq: Number(c.seq),
      content: c.content,
      tokenCount: Number(c.token_count) || 0,
      pageNo: c.page_no,
      startMs: c.start_ms,
      endMs: c.end_ms,
    })),
  }
}

export interface IngestInput {
  tenantId: number
  collectionCode: string
  title: string
  content?: string
  segments?: TranscriptSegment[]
  sourceType?: 'text' | 'url' | 'file' | 'asr' | 'structured'
  sourceRef?: string
  businessKey?: string
  tags?: Record<string, unknown>
  userId?: number | null
  db?: DbExecutor
}

export interface IngestResult {
  jobId: string
  documentId: string
  chunkCount: number
  embedded: number
  embeddingDegraded: boolean
  embeddingReason?: string
  indexVersion: number
}

/**
 * 公共管道：分块 → 向量化（可降级）→ 清理旧切片并落库 → 刷新集合计数与索引版本
 */
async function executeChunkEmbedAndIndex(params: {
  executor: DbExecutor
  tenantId: number
  collection: CollectionRow
  collectionCode: string
  documentId: string
  jobId: string
  cleanedText: string
  fingerprint: string
  segments?: TranscriptSegment[]
  businessKey?: string
  tags?: Record<string, unknown>
}): Promise<IngestResult> {
  const { executor, tenantId, collection, collectionCode, documentId, jobId, cleanedText, fingerprint } = params
  try {
    // 2. 分块
    const chunks = params.segments && params.segments.length > 0
      ? splitTranscript(params.segments, { chunkSize: collection.chunk_size })
      : splitText(cleanedText, { chunkSize: collection.chunk_size, chunkOverlap: collection.chunk_overlap })

    if (chunks.length === 0) throw new Error('分块结果为空')

    // 3. 向量化（可降级）
    const embeddingCfg = await loadEmbeddingConfig(executor, tenantId, collectionCode)
    await executor.query(`UPDATE public.kb_ingest_jobs SET stage = 'embed', progress = 50 WHERE id = $1`, [jobId])

    const vectors: number[][] = new Array(chunks.length).fill(null).map(() => [])
    let embeddingDegraded = embeddingCfg === null
    let embeddingReason: string | undefined
    let dim = Number(collection.embedding_dim) || 0
    let model = collection.embedding_model

    if (embeddingCfg) {
      for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
        const batch = chunks.slice(start, start + EMBED_BATCH)
        const result = await embedTexts(batch.map((c) => c.content), embeddingCfg)
        if (result.degraded) {
          embeddingDegraded = true
          embeddingReason = result.reason
          break
        }
        for (let i = 0; i < batch.length; i += 1) {
          vectors[start + i] = result.vectors[i] || []
        }
        dim = result.dim || dim
        model = result.model || model
      }
    } else {
      embeddingReason = 'embedding_not_configured'
    }

    const embedded = vectors.filter((v) => v.length > 0).length

    // 4. 清理旧切片并写入新切片（支持编辑更新时缩减切片数量）
    await executor.query(`UPDATE public.kb_ingest_jobs SET stage = 'index', progress = 80 WHERE id = $1`, [jobId])
    await executor.query(`DELETE FROM public.kb_chunks WHERE tenant_id = $1 AND document_id = $2`, [tenantId, documentId])

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]
      const vector = vectors[i]?.length ? vectors[i] : null
      await executor.query(
        `INSERT INTO public.kb_chunks
           (tenant_id, collection_id, document_id, seq, content, token_count, embedding, embedding_model,
            start_ms, end_ms, page_no, tags, index_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9, $10, $11, $12::jsonb, 1)`,
        [
          tenantId,
          collection.id,
          documentId,
          chunk.seq,
          chunk.content,
          chunk.tokenCount,
          vector ? toVectorLiteral(vector) : null,
          vector ? model : '',
          chunk.startMs ?? null,
          chunk.endMs ?? null,
          chunk.pageNo ?? null,
          JSON.stringify({ ...params.tags, businessKey: params.businessKey || '' }),
        ]
      )
    }

    // 5. 文档与集合计数、索引版本
    await executor.query(
      `UPDATE public.kb_documents
          SET status = 'ready', chunk_count = $2, content_hash = $3, updated_at = now()
        WHERE id = $1`,
      [documentId, chunks.length, fingerprint]
    )
    await executor.query(
      `UPDATE public.kb_collections
          SET document_count = (SELECT count(*) FROM public.kb_documents WHERE collection_id = $1 AND status = 'ready'),
              chunk_count = (SELECT count(*) FROM public.kb_chunks WHERE collection_id = $1),
              embedding_dim = CASE WHEN $2 > 0 THEN $2 ELSE embedding_dim END,
              updated_at = now()
        WHERE id = $1`,
      [collection.id, dim]
    )

    const versionRow = await executor.query<{ version: number }>(
      `SELECT coalesce(max(version), 0) + 1 AS version
         FROM public.kb_index_versions WHERE collection_id = $1`,
      [collection.id]
    )
    const indexVersion = Number(versionRow.rows[0]?.version) || 1
    await executor.query(
      `INSERT INTO public.kb_index_versions
         (tenant_id, collection_id, version, embedding_model, embedding_dim, chunk_count, status, built_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', now())
       ON CONFLICT (collection_id, version) DO NOTHING`,
      [tenantId, collection.id, indexVersion, model, dim, chunks.length]
    )

    await executor.query(
      `UPDATE public.kb_ingest_jobs
          SET status = 'succeeded', stage = 'done', progress = 100,
              chunk_count = $2, finished_at = now()
        WHERE id = $1`,
      [jobId, chunks.length]
    )

    return {
      jobId,
      documentId,
      chunkCount: chunks.length,
      embedded,
      embeddingDegraded,
      embeddingReason,
      indexVersion,
    }
  } catch (err) {
    const message = (err as Error)?.message || String(err)
    await executor.query(
      `UPDATE public.kb_ingest_jobs
          SET status = 'failed', stage = 'failed', error = $2, finished_at = now(), attempts = attempts + 1
        WHERE id = $1`,
      [jobId, message.slice(0, 1000)]
    )
    await executor.query(
      `UPDATE public.kb_documents SET status = 'failed', updated_at = now() WHERE id = $1`,
      [documentId]
    )
    throw err
  }
}

/**
 * 入库主流程（同步执行，任务状态可查）：
 * queued → parse → clean → chunk → embed → index → done
 * embedding 不可用时仍完成入库（关键词检索可用），并在结果里标注降级原因。
 */
export async function ingestDocument(input: IngestInput, db?: DbExecutor): Promise<IngestResult> {
  const executor = db || getPool()
  const collection = await getCollectionByCode(input.tenantId, input.collectionCode, executor)
  if (!collection) throw new Error(`知识集合不存在：${input.collectionCode}`)

  const rawText = input.content
    ? input.content
    : Array.isArray(input.segments)
      ? input.segments.map((seg) => `${seg.speaker ? `【${seg.speaker}】` : ''}${seg.text}`).join('\n')
      : ''
  const cleaned = cleanText(rawText)
  if (!cleaned) throw new Error('文档内容为空')

  // 1. 建任务与文档
  const job = await executor.query<{ id: string }>(
    `INSERT INTO public.kb_ingest_jobs (tenant_id, collection_id, status, stage, progress, created_by, started_at)
     VALUES ($1, $2, 'running', 'parse', 10, $3, now())
     RETURNING id`,
    [input.tenantId, collection.id, input.userId ?? null]
  )
  const jobId = job.rows[0].id

  const fingerprint = contentFingerprint(cleaned)
  const doc = await executor.query<{ id: string }>(
    `INSERT INTO public.kb_documents
       (tenant_id, collection_id, title, source_type, source_ref, content_hash, status, business_key, meta, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'indexing', $7, $8::jsonb, $9)
     RETURNING id`,
    [
      input.tenantId,
      collection.id,
      String(input.title || '未命名文档').slice(0, 255),
      input.sourceType || (input.segments ? 'asr' : 'text'),
      String(input.sourceRef || '').slice(0, 500),
      fingerprint,
      String(input.businessKey || '').slice(0, 120),
      JSON.stringify({ ...(input.tags || {}), rawContent: cleaned }),
      input.userId ?? null,
    ]
  )
  const documentId = doc.rows[0].id

  await executor.query(`UPDATE public.kb_ingest_jobs SET document_id = $2, stage = 'chunk', progress = 30 WHERE id = $1`, [jobId, documentId])

  return executeChunkEmbedAndIndex({
    executor,
    tenantId: input.tenantId,
    collection,
    collectionCode: input.collectionCode,
    documentId,
    jobId,
    cleanedText: cleaned,
    fingerprint,
    segments: input.segments,
    businessKey: input.businessKey,
    tags: input.tags,
  })
}

export interface UpdateDocumentInput {
  tenantId: number
  documentId: string
  collectionCode?: string
  title?: string
  content?: string
  businessKey?: string
  userId?: number | null
}

/** 更新已有文档（支持更换所属集合、修改标题/业务键/正文并自动重切片向量化） */
export async function updateDocument(input: UpdateDocumentInput, db?: DbExecutor): Promise<IngestResult & { docVersion: number }> {
  const executor = db || getPool()
  const existingRes = await executor.query<any>(
    `SELECT d.*, c.code AS collection_code
       FROM public.kb_documents d
       JOIN public.kb_collections c ON c.id = d.collection_id
      WHERE d.tenant_id = $1 AND d.id = $2
      LIMIT 1`,
    [input.tenantId, input.documentId]
  )
  const existing = existingRes.rows[0]
  if (!existing) throw new Error('文档不存在')

  const targetCode = input.collectionCode || existing.collection_code
  const collection = await getCollectionByCode(input.tenantId, targetCode, executor)
  if (!collection) throw new Error(`知识集合不存在：${targetCode}`)

  const nextTitle = input.title !== undefined && input.title.trim() ? input.title.trim().slice(0, 255) : existing.title
  const nextBusinessKey = input.businessKey !== undefined ? input.businessKey.trim().slice(0, 120) : (existing.business_key || '')

  let cleaned = ''
  if (input.content !== undefined) {
    cleaned = cleanText(input.content)
    if (!cleaned) throw new Error('文档内容不能为空')
  } else if (typeof existing.meta?.rawContent === 'string' && existing.meta.rawContent.trim()) {
    cleaned = cleanText(existing.meta.rawContent)
  } else {
    const chunkRows = await executor.query<{ content: string }>(
      `SELECT content FROM public.kb_chunks WHERE tenant_id = $1 AND document_id = $2 ORDER BY seq ASC`,
      [input.tenantId, input.documentId]
    )
    cleaned = cleanText(chunkRows.rows.map((r) => r.content).join('\n\n'))
    if (!cleaned) throw new Error('文档正文为空，请补充正文内容')
  }

  const fingerprint = contentFingerprint(cleaned)
  const nextMeta = { ...(existing.meta || {}), rawContent: cleaned }
  const nextVersion = (Number(existing.doc_version) || 1) + 1

  await executor.query(
    `UPDATE public.kb_documents
        SET collection_id = $3,
            title = $4,
            business_key = $5,
            content_hash = $6,
            doc_version = $7,
            meta = $8::jsonb,
            status = 'indexing',
            updated_at = now()
      WHERE tenant_id = $1 AND id = $2`,
    [input.tenantId, input.documentId, collection.id, nextTitle, nextBusinessKey, fingerprint, nextVersion, JSON.stringify(nextMeta)]
  )

  const job = await executor.query<{ id: string }>(
    `INSERT INTO public.kb_ingest_jobs (tenant_id, collection_id, document_id, status, stage, progress, created_by, started_at)
     VALUES ($1, $2, $3, 'running', 'chunk', 30, $4, now())
     RETURNING id`,
    [input.tenantId, collection.id, input.documentId, input.userId ?? null]
  )
  const jobId = job.rows[0].id

  const res = await executeChunkEmbedAndIndex({
    executor,
    tenantId: input.tenantId,
    collection,
    collectionCode: targetCode,
    documentId: input.documentId,
    jobId,
    cleanedText: cleaned,
    fingerprint,
    businessKey: nextBusinessKey,
  })

  // 如果更换了所属集合，顺带刷新旧集合计数
  if (collection.id !== existing.collection_id) {
    await executor.query(
      `UPDATE public.kb_collections
          SET document_count = (SELECT count(*) FROM public.kb_documents WHERE collection_id = $1 AND status = 'ready'),
              chunk_count = (SELECT count(*) FROM public.kb_chunks WHERE collection_id = $1),
              updated_at = now()
        WHERE id = $1`,
      [existing.collection_id]
    )
  }

  return { ...res, docVersion: nextVersion }
}

export interface SearchHit {
  chunkId: string
  documentId: string
  documentName: string
  collectionCode: string
  content: string
  score: number
  startMs: number | null
  endMs: number | null
  pageNo: number | null
  tags: Record<string, unknown>
  retrieval: 'vector' | 'keyword'
}

export interface SearchResult {
  hits: SearchHit[]
  mode: 'vector' | 'keyword' | 'hybrid'
  degraded: boolean
  degradedReason?: string
  tookMs: number
}

/**
 * 混合检索：
 *   - 有向量配置 → 向量近邻（cosine）+ 关键词补位；
 *   - 无向量 → 关键词（pg_trgm similarity）；
 *   - 永远按 tenant_id 过滤，并按集合 ACL 收敛角色可见范围。
 */
export async function searchKnowledge(input: {
  tenantId: number
  query: string
  collectionCodes?: string[]
  role?: string
  topK?: number
  minScore?: number
  filters?: { businessKey?: string; startMsLte?: number }
  db?: DbExecutor
}): Promise<SearchResult> {
  const executor = input.db || getPool()
  const started = Date.now()
  const query = String(input.query || '').trim()
  const topK = Math.min(20, Math.max(1, input.topK || 6))
  const minScore = Number(input.minScore ?? 0)

  if (!query) return { hits: [], mode: 'keyword', degraded: false, tookMs: 0 }

  const codes = (input.collectionCodes && input.collectionCodes.length > 0)
    ? input.collectionCodes.map((c) => String(c).slice(0, 64))
    : null

  function buildFilter(startParam: number): { clause: string; params: unknown[] } {
    const params: unknown[] = []
    let clause = ''
    if (input.role) {
      params.push(input.role)
      clause += ` AND NOT EXISTS (
          SELECT 1 FROM public.kb_acl a
           WHERE a.collection_id = c.id AND a.role_code = $${startParam + params.length - 1} AND a.effect = 'deny'
        )`
    }
    if (codes) {
      params.push(codes)
      clause += ` AND c.code = ANY($${startParam + params.length - 1}::text[])`
    }
    if (input.filters?.businessKey) {
      params.push(input.filters.businessKey)
      clause += ` AND d.business_key = $${startParam + params.length - 1}`
    }
    if (typeof input.filters?.startMsLte === 'number') {
      params.push(input.filters.startMsLte)
      clause += ` AND ch.start_ms <= $${startParam + params.length - 1}`
    }
    return { clause, params }
  }

  // 1) 向量检索
  let hits: SearchHit[] = []
  let mode: SearchResult['mode'] = 'keyword'
  let degraded = false
  let degradedReason: string | undefined

  const collectionRefs = codes && codes.length > 0
    ? codes
    : (await listCollections(input.tenantId, executor))
        .filter((c) => !isRuleOnlyCollection(c.code, c.domain))
        .map((c) => c.code)

  let embeddingCfg: Awaited<ReturnType<typeof loadEmbeddingConfig>> = null
  for (const code of collectionRefs) {
    if (isRuleOnlyCollection(code)) continue
    const cfg = await loadEmbeddingConfig(executor, input.tenantId, code)
    if (cfg) {
      embeddingCfg = cfg
      break
    }
  }

  if (embeddingCfg) {
    const embedded = await embedTexts([query], embeddingCfg)
    if (!embedded.degraded && embedded.vectors[0]?.length) {
      // 向量 SQL 的占位：$1 tenant、$2 topK、$3 向量字面量，过滤条件从 $4 起
      const filter = buildFilter(4)
      const vectorLiteral = toVectorLiteral(embedded.vectors[0])
      const { rows } = await executor.query<any>(
        `SELECT ch.id, ch.document_id, d.title, c.code AS collection_code, ch.content,
                1 - (ch.embedding <=> $3::vector) AS score,
                ch.start_ms, ch.end_ms, ch.page_no, ch.tags
           FROM public.kb_chunks ch
           JOIN public.kb_documents d ON d.id = ch.document_id
           JOIN public.kb_collections c ON c.id = ch.collection_id
          WHERE ch.tenant_id = $1
            AND ch.embedding IS NOT NULL
            AND d.status = 'ready'
            ${filter.clause}
          ORDER BY ch.embedding <=> $3::vector
          LIMIT $2`,
        [input.tenantId, topK, vectorLiteral, ...filter.params]
      ).catch((err) => {
        console.warn('[kb] vector search failed:', (err as Error)?.message || err)
        return { rows: [] as any[] }
      })

      hits = rows
        .filter((row) => Number(row.score) >= minScore)
        .map((row) => ({
          chunkId: String(row.id),
          documentId: String(row.document_id),
          documentName: row.title,
          collectionCode: row.collection_code,
          content: row.content,
          score: Number(row.score) || 0,
          startMs: row.start_ms,
          endMs: row.end_ms,
          pageNo: row.page_no,
          tags: (row.tags || {}) as Record<string, unknown>,
          retrieval: 'vector' as const,
        }))
      mode = 'vector'
    } else {
      degraded = true
      degradedReason = embedded.reason || 'embedding_failed'
    }
  } else {
    degraded = true
    degradedReason = 'embedding_not_configured'
  }

  // 2) 关键词兜底 / 补位
  if (hits.length < topK) {
    const existing = new Set(hits.map((h) => h.chunkId))
    // 关键词 SQL 占位：$1 tenant、$2 query、$3 topK，过滤条件从 $4 起
    const filter = buildFilter(4)
    const { rows } = await executor.query<any>(
      `SELECT ch.id, ch.document_id, d.title, c.code AS collection_code, ch.content,
              CASE WHEN ch.content ILIKE '%' || $2 || '%'
                   THEN GREATEST(similarity(ch.content, $2), 0.2)
                   ELSE similarity(ch.content, $2)
              END AS score,
              ch.start_ms, ch.end_ms, ch.page_no, ch.tags
         FROM public.kb_chunks ch
         JOIN public.kb_documents d ON d.id = ch.document_id
         JOIN public.kb_collections c ON c.id = ch.collection_id
        WHERE ch.tenant_id = $1
          AND d.status = 'ready'
          AND (ch.content ILIKE '%' || $2 || '%' OR similarity(ch.content, $2) > 0.1)
          ${filter.clause}
        ORDER BY score DESC
        LIMIT $3`,
      [input.tenantId, query, topK, ...filter.params]
    ).catch(() => ({ rows: [] as any[] }))

    for (const row of rows) {
      if (existing.has(String(row.id))) continue
      hits.push({
        chunkId: String(row.id),
        documentId: String(row.document_id),
        documentName: row.title,
        collectionCode: row.collection_code,
        content: row.content,
        score: Number(row.score) || 0,
        startMs: row.start_ms,
        endMs: row.end_ms,
        pageNo: row.page_no,
        tags: (row.tags || {}) as Record<string, unknown>,
        retrieval: 'keyword',
      })
      if (hits.length >= topK) break
    }
    if (mode === 'vector' && hits.some((h) => h.retrieval === 'keyword')) mode = 'hybrid'
  }

  hits = hits.slice(0, topK)
  return { hits, mode, degraded, degradedReason, tookMs: Date.now() - started }
}

// ── 违禁词 ──

export async function loadBannedRules(
  tenantId: number,
  platform = 'all',
  db?: DbExecutor
): Promise<BannedWordRule[]> {
  const executor = db || getPool()
  const { rows } = await executor.query<{
    id: string
    word: string
    normalized: string
    category: string
    severity: string
    action: string
    platform: string
    word_version: number
  }>(
    `SELECT id, word, normalized, category, severity, action, platform, word_version
       FROM public.kb_banned_words
      WHERE tenant_id = $1 AND enabled = TRUE AND (platform = 'all' OR platform = $2)
      ORDER BY id`,
    [tenantId, platform || 'all']
  ).catch(() => ({ rows: [] as any[] }))

  const custom: BannedWordRule[] = rows.map((row) => ({
    id: String(row.id),
    word: row.word,
    normalized: row.normalized,
    category: row.category,
    severity: row.severity as BannedWordRule['severity'],
    action: row.action as BannedWordRule['action'],
    platform: row.platform,
    wordVersion: Number(row.word_version) || 1,
  }))

  // 自定义优先：同词面覆盖内置规则
  const customKeys = new Set(custom.map((r) => r.normalized))
  const defaults = DEFAULT_BANNED_RULES.filter((r) => !customKeys.has(r.normalized))
  return [...custom, ...defaults]
}

export async function scanBannedWords(input: {
  tenantId: number
  text: string
  platform?: string
  db?: DbExecutor
}) {
  const rules = await loadBannedRules(input.tenantId, input.platform || 'all', input.db)
  const automaton = buildAutomaton(rules)
  const result = automaton.scan(input.text, { platform: input.platform })
  return { ...result, ruleCount: rules.length }
}

export async function listBannedWords(
  tenantId: number,
  db?: DbExecutor
): Promise<Array<{ id: string; word: string; category: string; severity: string; action: string; platform: string; enabled: boolean; wordVersion: number }>> {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT id, word, category, severity, action, platform, enabled, word_version
       FROM public.kb_banned_words
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 500`,
    [tenantId]
  )
  return rows.map((row) => ({
    id: String(row.id),
    word: row.word,
    category: row.category,
    severity: row.severity,
    action: row.action,
    platform: row.platform,
    enabled: Boolean(row.enabled),
    wordVersion: Number(row.word_version) || 1,
  }))
}

export async function upsertBannedWord(input: {
  tenantId: number
  word: string
  category?: string
  severity?: string
  action?: string
  platform?: string
  enabled?: boolean
  db?: DbExecutor
}): Promise<{ id: string; word: string; wordVersion: number }> {
  const executor = input.db || getPool()
  const word = String(input.word || '').trim().slice(0, 64)
  if (!word) throw new Error('违禁词不能为空')
  const normalized = word.toLowerCase()
  const { rows } = await executor.query<{ id: string; word: string; word_version: number }>(
    `INSERT INTO public.kb_banned_words
       (tenant_id, word, normalized, category, severity, action, platform, enabled, word_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
     ON CONFLICT (tenant_id, normalized, platform) DO UPDATE
       SET category = EXCLUDED.category,
           severity = EXCLUDED.severity,
           action = EXCLUDED.action,
           enabled = EXCLUDED.enabled,
           word_version = public.kb_banned_words.word_version + 1,
           effective_from = now()
     RETURNING id, word, word_version`,
    [
      input.tenantId,
      word,
      normalized,
      input.category || 'absolute',
      input.severity || 'high',
      input.action || 'block',
      input.platform || 'all',
      input.enabled !== false,
    ]
  )
  return { id: rows[0].id, word: rows[0].word, wordVersion: Number(rows[0].word_version) || 1 }
}

export async function updateBannedWord(input: {
  tenantId: number
  id: string
  category?: string
  severity?: string
  action?: string
  platform?: string
  enabled?: boolean
}, db?: DbExecutor): Promise<{ id: string; word: string; enabled: boolean } | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `UPDATE public.kb_banned_words
        SET category = COALESCE($3, category),
            severity = COALESCE($4, severity),
            action = COALESCE($5, action),
            platform = COALESCE($6, platform),
            enabled = COALESCE($7, enabled),
            word_version = word_version + 1
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, word, enabled`,
    [
      input.tenantId,
      input.id,
      input.category ?? null,
      input.severity ?? null,
      input.action ?? null,
      input.platform ?? null,
      input.enabled ?? null,
    ]
  )
  return rows[0] ? { id: String(rows[0].id), word: rows[0].word, enabled: Boolean(rows[0].enabled) } : null
}

export async function deleteBannedWord(tenantId: number, id: string, db?: DbExecutor): Promise<boolean> {
  const executor = db || getPool()
  const { rowCount } = await executor.query(
    `DELETE FROM public.kb_banned_words WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  )
  return (rowCount || 0) > 0
}

// ── 引用回溯 ──

export async function getChunkTrail(
  tenantId: number,
  chunkId: string,
  db?: DbExecutor
): Promise<{
  chunkId: string
  content: string
  documentId: string
  documentName: string
  collectionCode: string
  docVersion: number
  pageNo: number | null
  startMs: number | null
  endMs: number | null
} | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT ch.id, ch.content, ch.document_id, ch.page_no, ch.start_ms, ch.end_ms,
            d.title, d.doc_version, c.code AS collection_code
       FROM public.kb_chunks ch
       JOIN public.kb_documents d ON d.id = ch.document_id
       JOIN public.kb_collections c ON c.id = ch.collection_id
      WHERE ch.tenant_id = $1 AND ch.id = $2
      LIMIT 1`,
    [tenantId, chunkId]
  )
  const row = rows[0]
  if (!row) return null
  return {
    chunkId: String(row.id),
    content: row.content,
    documentId: String(row.document_id),
    documentName: row.title,
    collectionCode: row.collection_code,
    docVersion: Number(row.doc_version) || 1,
    pageNo: row.page_no,
    startMs: row.start_ms,
    endMs: row.end_ms,
  }
}

/** 统计：知识平台健康度（供管理页展示） */
export async function knowledgeStats(tenantId: number, db?: DbExecutor) {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT
       (SELECT count(*) FROM public.kb_collections WHERE tenant_id = $1 AND status = 'active') AS collections,
       (SELECT count(*) FROM public.kb_documents WHERE tenant_id = $1 AND status = 'ready') AS documents,
       (SELECT count(*) FROM public.kb_chunks WHERE tenant_id = $1) AS chunks,
       (SELECT count(*) FROM public.kb_chunks WHERE tenant_id = $1 AND embedding IS NOT NULL) AS embedded_chunks,
       (SELECT count(*) FROM public.kb_ingest_jobs WHERE tenant_id = $1 AND status = 'failed') AS failed_jobs,
       (SELECT count(*) FROM public.kb_banned_words WHERE tenant_id = $1 AND enabled = TRUE) AS banned_words`,
    [tenantId]
  )
  const row = rows[0] || {}
  return {
    collections: Number(row.collections) || 0,
    documents: Number(row.documents) || 0,
    chunks: Number(row.chunks) || 0,
    embeddedChunks: Number(row.embedded_chunks) || 0,
    failedJobs: Number(row.failed_jobs) || 0,
    bannedWords: Number(row.banned_words) || 0,
  }
}