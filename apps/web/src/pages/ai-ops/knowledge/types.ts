/**
 * 本地知识平台共享类型与常量映射
 */

export interface CollectionItem {
  id: string
  code: string
  name: string
  domain: string
  description: string
  embeddingModel: string
  embeddingDim: number
  chunkSize: number
  chunkOverlap: number
  status?: string
  documentCount: number
  chunkCount: number
  config?: Record<string, unknown>
  updatedAt?: string
}

export interface KnowledgeStats {
  collections: number
  documents: number
  chunks: number
  embeddedChunks: number
  failedJobs: number
  bannedWords: number
}

export interface DocumentItem {
  id: string
  collectionId?: string
  title: string
  collectionCode: string
  collectionName?: string
  sourceType?: string
  sourceRef?: string
  docVersion?: number
  status: string
  chunkCount: number
  businessKey: string
  createdAt: string
  updatedAt?: string
}

export interface DocumentChunk {
  id: string
  seq: number
  content: string
  tokenCount: number
  pageNo: number | null
  startMs: number | null
  endMs: number | null
}

export interface DocumentDetail extends DocumentItem {
  fullContent: string
  chunks: DocumentChunk[]
}

export interface IngestJob {
  id: string
  status: string
  stage: string
  progress: number
  chunkCount: number
  error: string | null
  collectionCode: string
  documentTitle: string | null
  createdAt: string
  finishedAt?: string | null
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
  retrieval: string
}

export interface ChunkTrail {
  chunkId: string
  content: string
  documentId: string
  documentName: string
  collectionCode: string
  docVersion: number
  pageNo: number | null
  startMs: number | null
  endMs: number | null
}

export interface BannedWord {
  id: string
  word: string
  category: string
  severity: string
  action: string
  platform: string
  enabled: boolean
  wordVersion: number
}

export interface DefaultBannedRule {
  id?: string
  word: string
  category: string
  severity: string
  action: string
  platform: string
}

export interface ScanResult {
  blocked: boolean
  matched: Array<{
    word: string
    category: string
    severity: string
    action: string
    start?: number
    end?: number
    excerpt?: string
  }>
  ruleCount?: number
}

export interface NoticeMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

export const BUILTIN_COLLECTION_CODES = new Set(['products', 'scripts', 'banned_words', 'replays'])

export const DOMAIN_LABEL: Record<string, string> = {
  product: '商品',
  script: '脚本',
  banned: '违禁词',
  replay: '回放',
  document: '通用',
}

export const CATEGORY_LABEL: Record<string, string> = {
  absolute: '极限词',
  medical: '医疗功效',
  financial: '金融承诺',
  platform: '平台禁用',
  politics: '涉政敏感',
  other: '其他',
}

export const SEVERITY_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
}

export const ACTION_LABEL: Record<string, string> = {
  block: '阻断',
  warn: '告警',
  rewrite: '改写',
}

export const PLATFORM_LABEL: Record<string, string> = {
  all: '全平台',
  douyin: '抖音',
  kuaishou: '快手',
  wechat_video: '微信视频号',
}

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  text: '手动文本',
  file: '文件上传',
  asr: '语音转写',
  url: '网页链接',
  structured: '结构化',
}

export const INPUT_CLS =
  'w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:border-orbit-primary/60 focus:outline-none'

export const SELECT_CLS =
  'rounded-lg border border-orbit-border bg-orbit-ink px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-orbit-primary/60 focus:outline-none'

export function formatTime(iso?: string | null): string {
  if (!iso) return '—'
  return String(iso).slice(0, 19).replace('T', ' ')
}
