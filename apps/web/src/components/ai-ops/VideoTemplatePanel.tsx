/**
 * VideoTemplatePanel.tsx — F.1 模板中心 + 项目装配
 *
 * 与「切片队列」并列：切片队列面向直播回放选段；
 * 本面板面向 8 类模板的槽位填充、装配与渲染质检。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clapperboard, Layers, PlayCircle, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

interface TemplateItem {
  id: string
  code: string
  name: string
  category: string
  type: string
  aspect: string
  minDurationSec: number
  maxDurationSec: number
  description: string
  status: string
  grayRatio: number
  versionCount: number
  latestVersion: number | null
}

interface TemplateSlot {
  key: string
  label?: string
  type: string
  required?: boolean
  maxLength?: number
  countMin?: number
  countMax?: number
  options?: string[]
}

interface TemplateDetail extends TemplateItem {
  versions: Array<{
    id: string
    version: number
    status: string
    isCanary: boolean
    dsl: { slots?: TemplateSlot[]; duration?: { min: number; max: number } }
  }>
}

interface ProjectItem {
  id: string
  title: string
  templateName: string
  status: string
  shotCount: number
  latestJobStatus: string | null
  createdAt: string
}

interface RenderJob {
  id: string
  status: string
  stage: string
  progress: number
  gatePassed: boolean | null
  gateResult: { passed?: boolean; blockers?: string[]; checks?: Array<{ key: string; label: string; passed: boolean; detail: string }> }
  output: { outputPath: string; durationMs: number } | null
}

interface ProjectDetail {
  id: string
  title: string
  status: string
  aspect: string
  shots: Array<{ id: string; seq: number; shotType: string; title: string; scriptText: string; durationMs: number }>
  renderJobs: RenderJob[]
}

const CATEGORY_LABEL: Record<string, string> = {
  live_highlight: '直播高光',
  product_seed: '商品种草',
  talking_head: '口播讲解',
  image_text: '图文成片',
  batch_mashup: '批量混剪',
  review_compare: '测评对比',
  tutorial_steps: '教程步骤',
  report_teaser: '战报预告',
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  ready: '待渲染',
  rendering: '渲染中',
  rendered: '已出片',
  failed: '失败',
  archived: '已归档',
  queued: '排队中',
  running: '执行中',
  succeeded: '成功',
}

function emptyValue(slot: TemplateSlot): string | number {
  if (slot.type === 'number') return 0
  if (slot.type === 'json') return '{}'
  return ''
}

export function VideoTemplatePanel() {
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [detail, setDetail] = useState<TemplateDetail | null>(null)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [values, setValues] = useState<Record<string, string | number>>({})
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(false)

  const latestVersion = useMemo(() => {
    if (!detail) return null
    const published = detail.versions.filter((item) => item.status === 'published')
    return published.sort((a, b) => b.version - a.version)[0] || detail.versions[0] || null
  }, [detail])

  const slots = latestVersion?.dsl?.slots || []

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    const res = await api.get<any>('/video/templates').catch(() => null)
    if (res) setTemplates(Array.isArray(res.items) ? res.items : [])
    setLoading(false)
  }, [])

  const loadProjects = useCallback(async () => {
    const res = await api.get<any>('/video/projects', { limit: 30 }).catch(() => null)
    if (res) setProjects(Array.isArray(res.items) ? res.items : [])
  }, [])

  const selectTemplate = useCallback(async (templateId: string) => {
    setMessage('')
    const res = await api.get<TemplateDetail>(`/video/templates/${templateId}`).catch(() => null)
    if (!res) return
    setDetail(res)
    setTitle(`${res.name} · ${new Date().toLocaleDateString('zh-CN')}`)
    const published = res.versions.filter((item) => item.status === 'published').sort((a, b) => b.version - a.version)[0]
    const templateSlots = published?.dsl?.slots || []
    setValues(Object.fromEntries(templateSlots.map((slot) => [slot.key, emptyValue(slot)])))
  }, [])

  useEffect(() => {
    void loadTemplates()
    void loadProjects()
  }, [loadTemplates, loadProjects])

  const updateValue = (key: string, value: string | number) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const buildSlotValues = (): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const slot of slots) {
      const raw = values[slot.key]
      if (raw === undefined || raw === '') continue
      if (slot.type === 'number') {
        result[slot.key] = Number(raw)
      } else if (slot.type === 'text_list' || slot.type === 'image_list' || slot.type === 'video_list') {
        result[slot.key] = String(raw).split('\n').map((item) => item.trim()).filter(Boolean)
      } else if (slot.type === 'json') {
        try {
          result[slot.key] = JSON.parse(String(raw))
        } catch {
          throw new Error(`槽位「${slot.label || slot.key}」不是合法 JSON`)
        }
      } else {
        result[slot.key] = String(raw).trim()
      }
    }
    return result
  }

  const handleAssemble = async () => {
    if (!detail || busy) return
    setBusy('assemble')
    setMessage('')
    try {
      const slotValues = buildSlotValues()
      const res = await api.post<any>('/video/projects', {
        templateId: detail.id,
        title: title.trim() || detail.name,
        slotValues,
      })
      setMessage(`装配完成：${res.shotCount} 个镜头，模板版本 v${res.templateVersion}`)
      await loadProjects()
      await openProject(res.id)
    } catch (err: any) {
      setMessage(err?.message || '装配失败')
    } finally {
      setBusy('')
    }
  }

  const openProject = async (projectId: string) => {
    const res = await api.get<ProjectDetail>(`/video/projects/${projectId}`).catch(() => null)
    if (res) setProject(res)
  }

  const handleRender = async () => {
    if (!project || busy) return
    setBusy('render')
    setMessage('')
    try {
      const res = await api.post<any>(`/video/projects/${project.id}/render`, {})
      setMessage(`渲染任务已入队：${res.jobId}，正在渲染…`)
      await openProject(project.id)
      await loadProjects()

      // Worker 异步渲染：轮询任务状态直到终态（成功/失败/取消）
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        const job = await api.get<any>(`/video/render-jobs/${res.jobId}`).catch(() => null)
        if (!job) break
        if (['succeeded', 'failed', 'cancelled'].includes(job.status)) {
          setMessage(
            job.status === 'succeeded'
              ? `渲染完成：${job.output?.outputPath || res.jobId}`
              : `渲染${job.status === 'cancelled' ? '已取消' : '失败'}：${job.error || '质检未通过'}`
          )
          break
        }
      }
      await openProject(project.id)
      await loadProjects()
    } catch (err: any) {
      setMessage(err?.message || '渲染预检未通过')
      await openProject(project.id)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader
          title="模板中心"
          subtitle="8 类模板，按槽位填充即可装配"
          actions={
            <Button size="sm" variant="outline" onClick={() => void loadTemplates()}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
            </Button>
          }
        />
        <CardBody className="space-y-1">
          {templates.map((item) => (
            <button
              key={item.id}
              onClick={() => void selectTemplate(item.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                detail?.id === item.id
                  ? 'border-status-ai bg-orbit-surface2/60'
                  : 'border-orbit-border bg-orbit-ink/40 hover:bg-orbit-surface2/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Clapperboard className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-primary)]">{item.name}</span>
                <Badge variant={item.status === 'active' ? 'success' : 'warning'}>{item.status}</Badge>
                <span className="ml-auto text-[10px] text-[var(--text-subtle)]">v{item.latestVersion ?? '-'}</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {CATEGORY_LABEL[item.category] || item.category} · {item.aspect} · {item.minDurationSec}–{item.maxDurationSec}s · 灰度 {item.grayRatio}%
              </p>
            </button>
          ))}
        </CardBody>
      </Card>

      <div className="space-y-4">
        {message && <p className="text-xs text-[var(--text-muted)]">{message}</p>}

        {detail ? (
          <Card>
            <CardHeader
              title={`${detail.name} · 槽位装配`}
              subtitle={detail.description || `最新版本 v${latestVersion?.version ?? '-'}，缺必选槽将被拒绝`}
              actions={<Badge variant="info">{detail.versions.length} 个版本</Badge>}
            />
            <CardBody className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-[var(--text-muted)]">项目标题</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              {slots.map((slot) => (
                <div key={slot.key}>
                  <label className="mb-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <span>{slot.label || slot.key}</span>
                    <span className="font-mono text-[10px] text-[var(--text-subtle)]">{slot.key}</span>
                    {slot.required && <Badge variant="danger">必填</Badge>}
                    {(slot.countMin != null || slot.countMax != null) && (
                      <span className="text-[10px] text-[var(--text-subtle)]">
                        {slot.countMin ?? 0}–{slot.countMax ?? '∞'} 条
                      </span>
                    )}
                  </label>
                  {slot.type === 'select' ? (
                    <select
                      value={String(values[slot.key] ?? '')}
                      onChange={(event) => updateValue(slot.key, event.target.value)}
                      className="w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-sm text-[var(--text-primary)]"
                    >
                      <option value="">未选择</option>
                      {(slot.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : slot.type === 'text_list' || slot.type === 'image_list' || slot.type === 'video_list' || slot.type === 'json' ? (
                    <textarea
                      rows={slot.type === 'json' ? 4 : 3}
                      value={String(values[slot.key] ?? '')}
                      onChange={(event) => updateValue(slot.key, event.target.value)}
                      placeholder={slot.type === 'json' ? '{"key": "value"}' : '每行一条'}
                      className="w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
                    />
                  ) : (
                    <input
                      type={slot.type === 'number' ? 'number' : 'text'}
                      value={values[slot.key] ?? ''}
                      onChange={(event) => updateValue(slot.key, event.target.value)}
                      maxLength={slot.maxLength}
                      className="w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" disabled={busy === 'assemble'} onClick={handleAssemble}>
                  <Layers className="mr-1 h-3.5 w-3.5" />{busy === 'assemble' ? '装配中…' : '装配项目'}
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <p className="text-xs text-[var(--text-muted)]">从左侧选择一个模板开始装配。</p>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="装配项目" subtitle="点击项目查看分镜与渲染任务" actions={<Badge variant="info">{projects.length} 个</Badge>} />
          <CardBody className="space-y-1">
            {projects.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">暂无项目</p>
            ) : (
              projects.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void openProject(item.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    project?.id === item.id
                      ? 'border-status-ai bg-orbit-surface2/60'
                      : 'border-orbit-border bg-orbit-ink/40 hover:bg-orbit-surface2/40'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-sm text-[var(--text-primary)]">{item.title}</span>
                    <Badge variant={item.status === 'rendered' ? 'success' : item.status === 'failed' ? 'danger' : 'info'}>
                      {STATUS_LABEL[item.status] || item.status}
                    </Badge>
                    <span className="text-[var(--text-muted)]">{item.templateName} · {item.shotCount} 镜头</span>
                    <span className="ml-auto text-[var(--text-subtle)]">{String(item.createdAt).slice(0, 19).replace('T', ' ')}</span>
                  </div>
                </button>
              ))
            )}
          </CardBody>
        </Card>

        {project && (
          <Card>
            <CardHeader
              title={project.title}
              subtitle={`${project.aspect} · ${STATUS_LABEL[project.status] || project.status}`}
              actions={
                <Button size="sm" variant="primary" disabled={busy === 'render'} onClick={handleRender}>
                  <PlayCircle className="mr-1 h-3.5 w-3.5" />{busy === 'render' ? '预检中…' : '发起渲染'}
                </Button>
              }
            />
            <CardBody className="space-y-2">
              <div className="space-y-1">
                {project.shots.map((shot) => (
                  <div key={shot.id} className="flex flex-wrap items-center gap-2 rounded border border-orbit-border px-3 py-1.5 text-[11px]">
                    <Badge variant="info">{shot.seq + 1}</Badge>
                    <span className="text-[var(--text-primary)]">{shot.title}</span>
                    <span className="text-[var(--text-muted)]">{shot.shotType}</span>
                    <span className="truncate text-[var(--text-subtle)] max-w-[50%]">{shot.scriptText}</span>
                    <span className="ml-auto text-[var(--text-subtle)]">{(shot.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                ))}
              </div>
              {project.renderJobs.length > 0 && (
                <div className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    最近渲染：{STATUS_LABEL[project.renderJobs[0].status] || project.renderJobs[0].status}
                    {project.renderJobs[0].gateResult?.blockers?.length
                      ? ` · 拦截项：${project.renderJobs[0].gateResult.blockers.join('、')}`
                      : ''}
                  </p>
                  {(project.renderJobs[0].gateResult?.checks || []).map((check) => (
                    <div key={check.key} className="mt-1 flex items-center gap-2 text-[11px]">
                      <Badge variant={check.passed ? 'success' : 'danger'}>{check.passed ? '通过' : '拦截'}</Badge>
                      <span className="text-[var(--text-primary)]">{check.label}</span>
                      <span className="text-[var(--text-subtle)]">{check.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
