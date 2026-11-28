/**
 * KnowledgePlatformSection.tsx — 本地知识与合规运维工作台
 *
 * 三大功能分区：
 *   1. 知识库与文档管理中心（集合 CRUD、多格式文件上传、手动录入、搜索筛选、在线编辑与重向量化）；
 *   2. 违禁词规则中心（单条/批量导入、启停 Switch、动作调整、内置兜底词库与实时扫描）；
 *   3. 检索测试与作业监控（混合检索测试、降级标识、切片回溯与入库流水线监控）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Database, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { api } from '@/services/api'
import { DocumentsWorkspace } from './knowledge/DocumentsWorkspace'
import { BannedWordsWorkspace } from './knowledge/BannedWordsWorkspace'
import { RetrieveAndJobsWorkspace } from './knowledge/RetrieveAndJobsWorkspace'
import type {
  BannedWord,
  CollectionItem,
  DocumentItem,
  IngestJob,
  KnowledgeStats,
  NoticeMessage,
} from './knowledge/types'

const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } }

export function KnowledgePlatformSection() {
  const [activeTab, setActiveTab] = useState<'documents' | 'banned' | 'retrieve'>('documents')
  const [collections, setCollections] = useState<CollectionItem[]>([])
  const [stats, setStats] = useState<KnowledgeStats | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [jobs, setJobs] = useState<IngestJob[]>([])
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([])
  const [defaultBannedCount, setDefaultBannedCount] = useState<number>(0)

  const [docFilterCollection, setDocFilterCollection] = useState('')
  const [docFilterStatus, setDocFilterStatus] = useState('')
  const [docSearch, setDocSearch] = useState('')

  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<NoticeMessage | null>(null)

  const filtersRef = useRef({ collection: '', status: '', search: '' })
  filtersRef.current = {
    collection: docFilterCollection,
    status: docFilterStatus,
    search: docSearch,
  }

  const loadDocuments = useCallback(async (colCode: string, status: string, search: string) => {
    const res = await api
      .get<{ items: DocumentItem[] }>('/kb/documents', {
        collectionCode: colCode || undefined,
        status: status || undefined,
        search: search.trim() || undefined,
        limit: 100,
      })
      .catch(() => null)
    if (res) setDocuments(res.items || [])
  }, [])

  const loadAll = useCallback(async () => {
    const { collection, status, search } = filtersRef.current
    setLoading(true)
    const [cols, st, docs, jobList, words] = await Promise.all([
      api.get<{ items: CollectionItem[] }>('/kb/collections').catch(() => null),
      api.get<KnowledgeStats>('/kb/stats').catch(() => null),
      api
        .get<{ items: DocumentItem[] }>('/kb/documents', {
          collectionCode: collection || undefined,
          status: status || undefined,
          search: search.trim() || undefined,
          limit: 100,
        })
        .catch(() => null),
      api.get<{ items: IngestJob[] }>('/kb/ingest-jobs').catch(() => null),
      api.get<{ items: BannedWord[]; defaultCount?: number }>('/kb/banned-words').catch(() => null),
    ])
    if (cols) setCollections(cols.items || [])
    if (st) setStats(st)
    if (docs) setDocuments(docs.items || [])
    if (jobList) setJobs(jobList.items || [])
    if (words) {
      setBannedWords(words.items || [])
      if (typeof words.defaultCount === 'number') setDefaultBannedCount(words.defaultCount)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleCollectionFilterChange = (val: string) => {
    setDocFilterCollection(val)
    void loadDocuments(val, docFilterStatus, docSearch)
  }

  const handleStatusFilterChange = (val: string) => {
    setDocFilterStatus(val)
    void loadDocuments(docFilterCollection, val, docSearch)
  }

  const handleSearchDocs = async () => {
    await loadDocuments(docFilterCollection, docFilterStatus, docSearch)
  }

  return (
    <motion.div {...fadeIn} className="space-y-5 pb-6">
      {/* 操作通知条 */}
      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs ${
            notice.type === 'error'
              ? 'border-orbit-danger/40 bg-orbit-danger/10 text-status-danger'
              : notice.type === 'success'
                ? 'border-orbit-success/40 bg-orbit-success/10 text-status-success'
                : 'border-orbit-border bg-orbit-surface2 text-[var(--text-secondary)]'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded p-0.5 opacity-75 hover:opacity-100"
            aria-label="关闭提示"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 顶部概览与统计指标 */}
      <Card>
        <CardHeader
          title="本地知识与合规运维工作台"
          subtitle="pgvector 混合检索 + DFA/ACF 违禁词规则引擎；支持多格式文件解析入库、在线修订与切片回溯。"
          actions={
            <Button size="sm" variant="outline" loading={loading} onClick={() => void loadAll()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {loading ? '刷新中…' : '刷新数据'}
            </Button>
          }
        />
        {stats && (
          <CardBody>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-6">
              {[
                ['知识集合', stats.collections],
                ['文档总数', stats.documents],
                ['切片总数', stats.chunks],
                ['已向量化', stats.embeddedChunks],
                ['失败任务', stats.failedJobs],
                ['自定义违禁词', stats.bannedWords],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                  <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{value as number}</p>
                </div>
              ))}
            </div>
          </CardBody>
        )}
      </Card>

      {/* 三大工作台分区 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="documents" className="gap-1.5">
            <Database className="h-3.5 w-3.5" />
            知识库与文档管理
          </TabsTrigger>
          <TabsTrigger value="banned" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            违禁词规则中心
          </TabsTrigger>
          <TabsTrigger value="retrieve" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            检索测试与作业监控
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentsWorkspace
            collections={collections}
            documents={documents}
            docFilterCollection={docFilterCollection}
            docFilterStatus={docFilterStatus}
            docSearch={docSearch}
            onDocFilterCollectionChange={handleCollectionFilterChange}
            onDocFilterStatusChange={handleStatusFilterChange}
            onDocSearchChange={setDocSearch}
            onSearchDocs={handleSearchDocs}
            onReloadAll={loadAll}
            onNotify={setNotice}
          />
        </TabsContent>

        <TabsContent value="banned">
          <BannedWordsWorkspace
            bannedWords={bannedWords}
            defaultCount={defaultBannedCount}
            onReloadAll={loadAll}
            onNotify={setNotice}
          />
        </TabsContent>

        <TabsContent value="retrieve">
          <RetrieveAndJobsWorkspace collections={collections} jobs={jobs} onNotify={setNotice} />
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
        <RefreshCw className="h-3 w-3" />
        <span>在「系统配置与 AI → AI 模型」变更向量模型后，可通过「查看/编辑 → 保存并重新向量化」刷新切片向量，避免跨模型向量混用。</span>
      </div>
    </motion.div>
  )
}
