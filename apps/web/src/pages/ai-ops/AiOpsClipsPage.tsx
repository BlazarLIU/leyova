/**
 * AiOpsClipsPage.tsx — W11 切片队列
 *
 * 流程：上传源视频 → 转写（人工 SRT / Whisper）→ 高光分析 → 渲染切片 → 导出剪映草稿
 * 所有产物通过受控下载端点访问，不暴露磁盘路径。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Upload, Scissors, Sparkles, FileVideo, Download, RefreshCw, CheckCircle2, XCircle, Film, LayoutTemplate,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { VideoTemplatePanel } from '@/components/ai-ops/VideoTemplatePanel'
import { api } from '@/services/api'

interface MediaAsset {
  id: string
  title: string
  mimeType: string
  sizeBytes: number
  durationMs: number
  width: number | null
  height: number | null
  hasAudio: boolean
  status: string
  businessKey: string
  transcriptProvider: string | null
  segmentCount: number
  highlightCount: number
  clipCount: number
  createdAt: string
}

interface Highlight {
  id: string
  startMs: number
  endMs: number
  durationMs: number
  score: number
  title: string
  reason: string
  status: string
}

interface Clip {
  id: string
  highlightId: string
  status: string
  stage: string
  progress: number
  title: string
  score: number
  durationMs: number
  sizeBytes: number
  error: string
  videoUrl: string
  coverUrl: string
  subtitleUrl: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  uploaded: '已上传',
  transcribing: '转写中',
  transcribed: '已转写',
  analysing: '分析中',
  analysed: '已分析',
  failed: '失败',
}

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${bytes}B`
}

export function AiOpsClipsPage() {
  const [tab, setTab] = useState<'clips' | 'templates'>('clips')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [activeAsset, setActiveAsset] = useState('')
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')

  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadBusinessKey, setUploadBusinessKey] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [transcriptText, setTranscriptText] = useState('')
  const [transcribing, setTranscribing] = useState(false)

  const loadAssets = useCallback(async () => {
    setLoading(true)
    const res = await api.get<any>('/media/assets', { limit: 30 }).catch(() => null)
    if (res) setAssets(Array.isArray(res.items) ? res.items : [])
    setLoading(false)
  }, [])

  const loadAssetDetail = useCallback(async (assetId: string) => {
    if (!assetId) return
    const [hl, cl] = await Promise.all([
      api.get<any>(`/media/assets/${assetId}/highlights`).catch(() => null),
      api.get<any>(`/media/assets/${assetId}/clips`).catch(() => null),
    ])
    if (hl) setHighlights(Array.isArray(hl.items) ? hl.items : [])
    if (cl) setClips(Array.isArray(cl.items) ? cl.items : [])
  }, [])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  const selectAsset = async (assetId: string) => {
    setActiveAsset(assetId)
    setMessage('')
    await loadAssetDetail(assetId)
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || uploading) return
    setUploading(true)
    setMessage('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('title', uploadTitle.trim() || file.name)
      if (uploadBusinessKey.trim()) form.append('businessKey', uploadBusinessKey.trim())
      const res = await api.upload<any>('/media/assets', form)
      setMessage(`上传成功：${formatDuration(res.durationMs)} · ${res.width}x${res.height} · ${formatSize(res.sizeBytes)}`)
      setUploadTitle('')
      setUploadBusinessKey('')
      if (fileRef.current) fileRef.current.value = ''
      await loadAssets()
      await selectAsset(res.assetId)
    } catch (err: any) {
      setMessage(err?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleTranscribe = async () => {
    if (!activeAsset || transcribing) return
    if (!transcriptText.trim()) {
      setMessage('请粘贴 SRT 或 [mm:ss] 时间轴转写稿')
      return
    }
    setTranscribing(true)
    setMessage('')
    try {
      const res = await api.post<any>(`/media/assets/${activeAsset}/transcribe`, {
        provider: 'manual',
        manualContent: transcriptText,
      })
      setMessage(`转写完成：${res.segmentCount} 段`)
      await loadAssets()
      await loadAssetDetail(activeAsset)
    } catch (err: any) {
      setMessage(err?.message || '转写失败')
    } finally {
      setTranscribing(false)
    }
  }

  const handleAnalyse = async () => {
    if (!activeAsset || busy) return
    setBusy('analyse')
    setMessage('')
    try {
      const res = await api.post<any>(`/media/assets/${activeAsset}/analyse`, { maxCount: 5 })
      setMessage(`高光分析完成：${res.highlightCount} 条候选`)
      await loadAssetDetail(activeAsset)
      await loadAssets()
    } catch (err: any) {
      setMessage(err?.message || '高光分析失败')
    } finally {
      setBusy('')
    }
  }

  const handleRender = async () => {
    if (!activeAsset || busy) return
    setBusy('render')
    setMessage('渲染中，单条切片通常需要数十秒…')
    try {
      const res = await api.post<any>(`/media/assets/${activeAsset}/render`, { burnSubtitle: true })
      setMessage(`渲染完成：成功 ${res.rendered} 条，失败 ${res.failed} 条`)
      await loadAssetDetail(activeAsset)
      await loadAssets()
    } catch (err: any) {
      setMessage(err?.message || '渲染失败')
    } finally {
      setBusy('')
    }
  }

  const handleExportDraft = async () => {
    if (!activeAsset || busy) return
    setBusy('export')
    setMessage('')
    try {
      const res = await api.post<any>(`/media/assets/${activeAsset}/export-draft`, {})
      setMessage(`剪映草稿已导出：${res.clipCount} 条切片，总时长 ${formatDuration(res.totalDurationMs)}`)
    } catch (err: any) {
      setMessage(err?.message || '导出失败')
    } finally {
      setBusy('')
    }
  }

  const handleIngestKnowledge = async () => {
    if (!activeAsset || busy) return
    setBusy('ingest')
    setMessage('')
    try {
      const res = await api.post<any>(`/media/assets/${activeAsset}/ingest-knowledge`, {})
      setMessage(`已写入知识库回放集合：${res.chunkCount} 个切片`)
    } catch (err: any) {
      setMessage(err?.message || '写入知识库失败')
    } finally {
      setBusy('')
    }
  }

  const current = assets.find((item) => item.id === activeAsset) || null

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <motion.div {...fadeIn} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 3 · 内容与切片
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">ASR → 高光 → 渲染</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">切片队列</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            上传直播回放，自动转写与高光评分，渲染竖屏切片并导出剪映草稿。
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadAssets()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />{loading ? '加载中…' : '刷新'}
        </Button>
      </motion.div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tab === 'clips' ? 'primary' : 'outline'} onClick={() => setTab('clips')}>
          <Scissors className="mr-1 h-3.5 w-3.5" />切片队列
        </Button>
        <Button size="sm" variant={tab === 'templates' ? 'primary' : 'outline'} onClick={() => setTab('templates')}>
          <LayoutTemplate className="mr-1 h-3.5 w-3.5" />模板与装配
        </Button>
      </div>

      {tab === 'clips' ? (
        <>
      {message && <p className="text-xs text-[var(--text-muted)]">{message}</p>}

      {/* 上传 */}
      <Card>
        <CardHeader title="上传源视频" subtitle="支持 mp4/mov/mkv/webm 与常见音频；流式落盘，不占内存。" />
        <CardBody className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="video/*,audio/*"
              className="flex-1 min-w-[240px] rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-xs text-[var(--text-primary)]"
            />
            <input
              placeholder="标题（可选）"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="min-w-[160px] rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <input
              placeholder="业务键（如 SPU，可选）"
              value={uploadBusinessKey}
              onChange={(e) => setUploadBusinessKey(e.target.value)}
              className="min-w-[160px] rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <Button size="sm" variant="primary" disabled={uploading} onClick={handleUpload}>
              <Upload className="mr-1 h-3.5 w-3.5" />{uploading ? '上传中…' : '上传'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 素材列表 */}
      <Card>
        <CardHeader title="素材" subtitle="点击选择素材后执行转写、分析与渲染。" actions={<Badge variant="info">{assets.length} 个</Badge>} />
        <CardBody className="space-y-1">
          {assets.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">暂无素材，先上传一个视频</p>
          ) : (
            assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => void selectAsset(asset.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  activeAsset === asset.id
                    ? 'border-status-ai bg-orbit-surface2/60'
                    : 'border-orbit-border bg-orbit-ink/40 hover:bg-orbit-surface2/40'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <FileVideo className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-primary)]">{asset.title}</span>
                  <Badge variant={asset.status === 'failed' ? 'danger' : asset.status === 'analysed' ? 'success' : 'info'}>
                    {STATUS_LABEL[asset.status] || asset.status}
                  </Badge>
                  <span className="text-[var(--text-muted)]">
                    {formatDuration(asset.durationMs)} · {asset.width ?? '?'}x{asset.height ?? '?'} · {formatSize(asset.sizeBytes)}
                  </span>
                  {asset.transcriptProvider && <Badge variant="success">转写 {asset.segmentCount} 段</Badge>}
                  {asset.highlightCount > 0 && <Badge variant="info">高光 {asset.highlightCount}</Badge>}
                  {asset.clipCount > 0 && <Badge variant="success">切片 {asset.clipCount}</Badge>}
                  <span className="ml-auto text-[var(--text-subtle)]">{String(asset.createdAt).slice(0, 19).replace('T', ' ')}</span>
                </div>
              </button>
            ))
          )}
        </CardBody>
      </Card>

      {current && (
        <>
          {/* 转写 */}
          <Card>
            <CardHeader
              title="转写"
              subtitle="粘贴 SRT 或 [mm:ss] 时间轴；配置 Whisper 后可切换自动转写。"
            />
            <CardBody className="space-y-2">
              <textarea
                rows={6}
                placeholder={'1\n00:00:00,000 --> 00:00:08,000\n欢迎来到直播间…'}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                className="w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" disabled={transcribing} onClick={handleTranscribe}>
                  {transcribing ? '转写中…' : '提交转写'}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === 'analyse'} onClick={handleAnalyse}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" />{busy === 'analyse' ? '分析中…' : '高光分析'}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === 'render'} onClick={handleRender}>
                  <Scissors className="mr-1 h-3.5 w-3.5" />{busy === 'render' ? '渲染中…' : '渲染切片'}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === 'export'} onClick={handleExportDraft}>
                  <Film className="mr-1 h-3.5 w-3.5" />{busy === 'export' ? '导出中…' : '导出剪映草稿'}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === 'ingest'} onClick={handleIngestKnowledge}>
                  {busy === 'ingest' ? '写入中…' : '写入知识库'}
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* 高光候选 */}
          <Card>
            <CardHeader title="高光候选" subtitle="规则打分：关键词 / 语速密度 / 时长 / 位置；重叠窗口自动去重。" />
            <CardBody className="space-y-1">
              {highlights.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">暂无候选，先完成转写并执行高光分析</p>
              ) : (
                highlights.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-2 rounded border border-orbit-border px-3 py-2 text-[11px]">
                    <Badge variant={item.score >= 70 ? 'success' : item.score >= 40 ? 'warning' : 'info'}>
                      {item.score.toFixed(1)}
                    </Badge>
                    <span className="text-sm text-[var(--text-primary)]">{item.title}</span>
                    <span className="text-[var(--text-muted)]">
                      {formatDuration(item.startMs)}–{formatDuration(item.endMs)}（{formatDuration(item.durationMs)}）
                    </span>
                    <Badge variant={item.status === 'rendered' ? 'success' : item.status === 'failed' ? 'danger' : 'info'}>
                      {item.status}
                    </Badge>
                    <span className="ml-auto max-w-[45%] truncate text-[var(--text-subtle)]">{item.reason}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* 切片产物 */}
          <Card>
            <CardHeader title="切片产物" subtitle="竖屏 1080x1920，含烧录字幕与封面；下载需登录。" actions={<Badge variant="info">{clips.length} 条</Badge>} />
            <CardBody className="space-y-2">
              {clips.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">暂无切片，执行渲染后生成</p>
              ) : (
                clips.map((clip) => (
                  <div key={clip.id} className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {clip.status === 'succeeded' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-status-danger" />
                      )}
                      <span className="text-sm text-[var(--text-primary)]">{clip.title || '未命名切片'}</span>
                      <Badge variant={clip.status === 'succeeded' ? 'success' : 'danger'}>{clip.status}</Badge>
                      <span className="text-[var(--text-muted)]">
                        {formatDuration(clip.durationMs)} · {formatSize(clip.sizeBytes)}
                      </span>
                      {clip.score > 0 && <Badge variant="info">{clip.score.toFixed(1)} 分</Badge>}
                      <span className="ml-auto text-[var(--text-subtle)]">{String(clip.createdAt).slice(0, 19).replace('T', ' ')}</span>
                    </div>
                    {clip.error && <p className="mt-1 text-[11px] text-status-danger">{clip.error}</p>}
                    {clip.status === 'succeeded' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {clip.videoUrl && (
                          <a href={clip.videoUrl} target="_blank" rel="noreferrer" className="text-[11px] text-status-ai hover:underline">
                            <Download className="mr-1 inline h-3 w-3" />下载视频
                          </a>
                        )}
                        {clip.coverUrl && (
                          <a href={clip.coverUrl} target="_blank" rel="noreferrer" className="text-[11px] text-status-ai hover:underline">
                            封面
                          </a>
                        )}
                        {clip.subtitleUrl && (
                          <a href={clip.subtitleUrl} target="_blank" rel="noreferrer" className="text-[11px] text-status-ai hover:underline">
                            字幕
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </>
      )}
        </>
      ) : (
        <VideoTemplatePanel />
      )}
    </div>
  )
}