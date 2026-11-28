/**
 * ai/run/knowledge.ts — 知识库召回与引用
 *
 * 职责：
 *   1. 复用 kb-client 检索企业知识库（RAGFlow / MaxKB），不在此重复实现向量检索。
 *   2. 强制租户隔离：带租户标记的片段必须与当前 Run 租户一致，不一致直接丢弃。
 *   3. 片段只作为「引用数据」展示，不拼接进指令上下文，避免文档内容被当成指令执行。
 *   4. 未配置知识库时静默返回空结果，主链路不受影响。
 */

import { getKbConfig, searchKnowledgeBase, type KnowledgeChunk } from '../../lib/kb-client.js'
import { searchKnowledge as searchLocalKnowledge } from '../../knowledge/service.js'

export interface Citation {
  seq: number
  chunkId: string
  documentId: string
  documentName: string
  snippet: string
  score: number
  tenantId: number
  /** 本地知识平台回溯字段：有值时可直接定位到 kb_chunks */
  localChunkId?: string
  collectionId?: string
  docVersion?: number
  pageNo?: number | null
  startMs?: number | null
}

export interface KnowledgeRetrieval {
  /** 知识库是否已配置（provider/baseUrl/apiKey 齐全） */
  configured: boolean
  citations: Citation[]
}

const MAX_CHUNKS = 8
const MAX_SNIPPET_LENGTH = 500

/** 片段清洗：去控制字符、压缩空白、截断，避免脏数据破坏展示与日志 */
export function sanitizeSnippet(text: unknown, maxLength = MAX_SNIPPET_LENGTH): string {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/**
 * 租户过滤：
 *   - 片段带 tenantId / tenant_id 且与当前租户不一致 → 丢弃（跨租户 0）
 *   - 未标注租户 → 视为当前部署范围内的公共知识，保留
 */
export function filterChunksByTenant(
  chunks: KnowledgeChunk[],
  tenantId: number
): KnowledgeChunk[] {
  return chunks.filter((chunk) => {
    const meta = chunk.metadata || {}
    const raw = meta.tenantId ?? meta.tenant_id
    if (raw === undefined || raw === null || raw === '') return true
    return Number(raw) === tenantId
  })
}

/** 去重 + 按相似度排序 + 截断，并生成稳定引用序号 */
export function toCitations(chunks: KnowledgeChunk[], tenantId: number): Citation[] {
  const seen = new Set<string>()
  const unique: KnowledgeChunk[] = []
  for (const chunk of chunks) {
    const key = chunk.chunkId || `${chunk.documentId}:${sanitizeSnippet(chunk.content, 80)}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(chunk)
  }

  return unique
    .sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0))
    .slice(0, MAX_CHUNKS)
    .map((chunk, index) => ({
      seq: index + 1,
      chunkId: String(chunk.chunkId || '').slice(0, 128),
      documentId: String(chunk.documentId || '').slice(0, 128),
      documentName: sanitizeSnippet(chunk.documentName || '未命名文档', 255),
      snippet: sanitizeSnippet(chunk.content),
      score: Number(chunk.similarity || 0),
      tenantId,
    }))
}

const KNOWLEDGE_HINTS = [
  'sop', '流程', '规则', '话术', '制度', '规范', '政策', '标准', '指南', '手册',
  '怎么', '如何', '怎样', '要求', '方法', '权益', '售后', '培训',
]

/** 是否属于「应当有知识依据」的问题，用于无引用时标注，而不误伤取数类回答 */
export function needsKnowledge(question: string): boolean {
  const q = String(question || '').toLowerCase()
  if (!q) return false
  return KNOWLEDGE_HINTS.some((hint) => q.includes(hint))
}

/**
 * 召回知识片段。
 * 顺序：本地知识平台（pgvector/关键词）→ 外部 RAGFlow/MaxKB → 空。
 * 任一步异常都在内部降级，不阻断主链路。
 */
export async function retrieveKnowledge(
  question: string,
  options: { tenantId: number; topK?: number; role?: string }
): Promise<KnowledgeRetrieval> {
  const topK = options.topK ?? 6

  // 1) 本地知识平台优先：命中即可完整回溯到 kb_chunks
  try {
    const local = await searchLocalKnowledge({
      tenantId: options.tenantId,
      query: question,
      role: options.role,
      topK,
    })
    if (local.hits.length > 0) {
      return {
        configured: true,
        citations: local.hits.map((hit, index) => ({
          seq: index + 1,
          chunkId: hit.chunkId,
          documentId: hit.documentId,
          documentName: hit.documentName,
          snippet: sanitizeSnippet(hit.content),
          score: Number(hit.score) || 0,
          tenantId: options.tenantId,
          localChunkId: hit.chunkId,
          docVersion: undefined,
          pageNo: hit.pageNo,
          startMs: hit.startMs,
        })),
      }
    }
  } catch {
    // 本地平台不可用时继续尝试外部知识库
  }

  // 2) 外部知识库
  const cfg = await getKbConfig()
  const configured = cfg.provider !== 'none' && !!cfg.baseUrl && !!cfg.apiKey
  if (!configured) return { configured: false, citations: [] }

  const chunks = await searchKnowledgeBase(question, { topK: options.topK ?? cfg.topK })
  const filtered = filterChunksByTenant(chunks, options.tenantId)
  return { configured: true, citations: toCitations(filtered, options.tenantId) }
}

/** 在回答末尾追加引用来源；没有引用时不改动原文 */
export function appendCitationsToMarkdown(markdown: string, citations: Citation[]): string {
  if (citations.length === 0) return markdown
  const lines: string[] = ['', '#### 📚 参考来源']
  for (const c of citations) {
    const score = c.score > 0 ? `（相关度 ${Math.round(c.score * 100)}%）` : ''
    lines.push(`${c.seq}. 《${c.documentName}》${score}：${c.snippet}`)
  }
  return `${markdown.trimEnd()}\n${lines.join('\n')}\n`
}
