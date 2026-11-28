/**
 * 检索测试与异步入库作业监控：混合检索（相似度/降级标识/切片回溯）与入库流水线状态
 */

import { useState } from 'react'
import { Activity, Eye, Search } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { api } from '@/services/api'
import {
  INPUT_CLS,
  SELECT_CLS,
  formatTime,
  type ChunkTrail,
  type CollectionItem,
  type IngestJob,
  type NoticeMessage,
  type SearchHit,
} from './types'

interface RetrieveAndJobsWorkspaceProps {
  collections: CollectionItem[]
  jobs: IngestJob[]
  onNotify: (msg: NoticeMessage) => void
}

export function RetrieveAndJobsWorkspace({ collections, jobs, onNotify }: RetrieveAndJobsWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCollection, setSelectedCollection] = useState('')
  const [businessKey, setBusinessKey] = useState('')
  const [topK, setTopK] = useState(5)
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<{
    hits: SearchHit[]
    mode: string
    degraded: boolean
    degradedReason?: string
    tookMs: number
  } | null>(null)

  // 引用回溯弹窗
  const [trailOpen, setTrailOpen] = useState(false)
  const [trailLoading, setTrailLoading] = useState(false)
  const [trail, setTrail] = useState<ChunkTrail | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim() || searching) return
    setSearching(true)
    try {
      const res = await api.post<any>('/kb/retrieve', {
        query: searchQuery.trim(),
        collectionCodes: selectedCollection ? [selectedCollection] : undefined,
        topK,
        businessKey: businessKey.trim() || undefined,
      })
      setSearchResult(res)
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '混合检索失败' })
    } finally {
      setSearching(false)
    }
  }

  const openChunkTrail = async (chunkId: string) => {
    setTrailOpen(true)
    setTrailLoading(true)
    setTrail(null)
    try {
      const res = await api.get<ChunkTrail>(`/kb/chunks/${chunkId}`)
      setTrail(res)
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '读取切片引用详情失败' })
      setTrailOpen(false)
    } finally {
      setTrailLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 混合检索测试 */}
      <Card>
        <CardHeader
          title="混合检索测试"
          subtitle="pgvector 向量检索 + pg_trgm 关键词混合召回；向量不可用时自动降级并显示原因，支持逐条回溯原始切片。"
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              placeholder="输入查询语句，例如：防风保暖卖点、羽绒服充绒量…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSearch()
              }}
              className={`${INPUT_CLS} min-w-[240px] flex-1`}
            />
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">全部集合</option>
              {collections.map((col) => (
                <option key={col.id} value={col.code}>
                  {col.name}
                </option>
              ))}
            </select>
            <input
              placeholder="业务键过滤（可选）"
              value={businessKey}
              onChange={(e) => setBusinessKey(e.target.value)}
              className="w-40 rounded-lg border border-orbit-border bg-orbit-ink px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-subtle)]"
            />
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value) || 5)}
              className={SELECT_CLS}
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
            <Button
              size="sm"
              variant="primary"
              loading={searching}
              disabled={!searchQuery.trim()}
              onClick={() => void handleSearch()}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              运行检索
            </Button>
          </div>

          {searchResult && (
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={searchResult.degraded ? 'warning' : 'success'}>
                  检索模式：{searchResult.mode}
                </Badge>
                <span className="text-[var(--text-muted)]">耗时 {searchResult.tookMs} ms</span>
                <span className="text-[var(--text-muted)]">命中 {searchResult.hits.length} 条切片</span>
                {searchResult.degraded && (
                  <span className="text-[11px] text-status-warning">
                    已降级为关键词检索（{searchResult.degradedReason || '未配置向量或模型不可用'}）
                  </span>
                )}
              </div>

              {searchResult.hits.length === 0 ? (
                <p className="rounded-lg border border-orbit-border bg-orbit-ink/30 px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                  没有命中相关切片，请尝试调整关键词或切换集合。
                </p>
              ) : (
                <div className="space-y-2">
                  {searchResult.hits.map((hit) => (
                    <div key={hit.chunkId} className="rounded-lg border border-orbit-border bg-orbit-ink/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-[var(--text-primary)]">{hit.documentName}</span>
                          <Badge variant="info">{hit.collectionCode}</Badge>
                          <Badge variant="success">相似度 {Math.round(hit.score * 100)}%</Badge>
                          <Badge variant="neutral">{hit.retrieval}</Badge>
                          {hit.pageNo !== null && (
                            <span className="text-[11px] text-[var(--text-muted)]">第 {hit.pageNo} 页</span>
                          )}
                          {hit.startMs !== null && (
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {Math.floor(hit.startMs / 1000)}s–{Math.floor((hit.endMs ?? hit.startMs) / 1000)}s
                            </span>
                          )}
                        </div>
                        <Button size="xs" variant="outline" onClick={() => void openChunkTrail(hit.chunkId)}>
                          <Eye className="mr-1 h-3 w-3" />
                          切片回溯
                        </Button>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
                        {hit.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 异步入库作业流水线监控 */}
      <Card>
        <CardHeader
          title="入库作业流水线监控"
          subtitle="追踪文档清洗、分块与向量化作业状态（queued → running → succeeded / failed）。"
          actions={
            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Activity className="h-3.5 w-3.5 text-status-ai" />
              最近 {jobs.length} 条记录
            </span>
          }
        />
        <CardBody>
          <div className="overflow-x-auto rounded-lg border border-orbit-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-orbit-border bg-orbit-surface2/60 text-[11px] text-[var(--text-muted)]">
                  <th className="px-3 py-2 font-semibold">状态</th>
                  <th className="px-3 py-2 font-semibold">集合</th>
                  <th className="px-3 py-2 font-semibold">文档标题</th>
                  <th className="px-3 py-2 font-semibold">阶段与进度</th>
                  <th className="px-3 py-2 font-semibold">切片数</th>
                  <th className="px-3 py-2 font-semibold">创建时间</th>
                  <th className="px-3 py-2 font-semibold">错误信息</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orbit-border/60">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">
                      暂无入库作业记录
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-orbit-surface2/30">
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            job.status === 'succeeded'
                              ? 'success'
                              : job.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{job.collectionCode}</td>
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                        {job.documentTitle || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            {job.stage} · {job.progress}%
                          </span>
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-orbit-surface3">
                            <div
                              className={`h-full ${job.status === 'failed' ? 'bg-orbit-danger' : 'bg-orbit-primary'}`}
                              style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{job.chunkCount}</td>
                      <td className="px-3 py-2 text-[11px] text-[var(--text-subtle)]">{formatTime(job.createdAt)}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-[11px] text-status-danger">
                        {job.error || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* 切片引用回溯弹窗 */}
      <Dialog open={trailOpen} onOpenChange={setTrailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>切片引用回溯详情</DialogTitle>
            <DialogDescription>核对被 AI 检索命中的本地切片原文、所属文档版本及定位信息。</DialogDescription>
          </DialogHeader>
          {trailLoading ? (
            <p className="py-6 text-center text-xs text-[var(--text-muted)]">正在加载切片原文…</p>
          ) : trail ? (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--text-primary)]">{trail.documentName}</span>
                <Badge variant="info">{trail.collectionCode}</Badge>
                <Badge variant="neutral">v{trail.docVersion}</Badge>
                {trail.pageNo !== null && <span className="text-[var(--text-muted)]">第 {trail.pageNo} 页</span>}
                {trail.startMs !== null && (
                  <span className="text-[var(--text-muted)]">
                    {Math.floor(trail.startMs / 1000)}s–{Math.floor((trail.endMs ?? trail.startMs) / 1000)}s
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-orbit-border bg-orbit-ink/50 p-3">
                <p className="whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]">{trail.content}</p>
              </div>
              <p className="text-[11px] text-[var(--text-subtle)]">
                Chunk ID: <code>{trail.chunkId}</code> · Document ID: <code>{trail.documentId}</code>
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTrailOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
