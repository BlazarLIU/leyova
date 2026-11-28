import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, RefreshCw, Ban, Activity, CheckCircle2, XCircle,
  Loader2, Cpu, Clock, Database, Sparkles, AlertTriangle, BookOpen, Brain, Bot, Eye,
} from 'lucide-react'
import { api } from '@/services/api'
import { Card, CardHeader, CardBody, Badge } from '@/components/ui'
import { cn } from '@/utils/cn'

type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'completed' | string

interface RunEvent {
  runId: string
  seq: number
  type: string
  payload: Record<string, any>
  createdAt?: string
}

interface RunDetail {
  run: Record<string, any>
  steps: Array<Record<string, any>>
  evidence: Array<Record<string, any>>
  claims: Array<Record<string, any>>
  citations: Array<Record<string, any>>
  memories: Array<Record<string, any>>
  events: RunEvent[]
}

const TERMINAL: RunStatus[] = ['succeeded', 'failed', 'cancelled', 'completed']

const STATUS_META: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  queued: { label: '排队中', variant: 'neutral' },
  running: { label: '执行中', variant: 'info' },
  succeeded: { label: '成功', variant: 'success' },
  completed: { label: '完成', variant: 'success' },
  failed: { label: '失败', variant: 'danger' },
  cancelled: { label: '已取消', variant: 'warning' },
}

const EVENT_META: Record<string, { label: string; color: string; icon: any }> = {
  'run.started': { label: 'Run 启动', color: 'bg-orbit-primary', icon: Activity },
  'intent.detected': { label: '意图识别', color: 'bg-status-info', icon: Sparkles },
  'llm.fallback': { label: '模型降级', color: 'bg-status-warning', icon: AlertTriangle },
  'plan.ready': { label: '计划就绪', color: 'bg-status-info', icon: Cpu },
  'citations.retrieved': { label: '知识召回', color: 'bg-orbit-accent', icon: BookOpen },
  'memory.applied': { label: '记忆应用', color: 'bg-orbit-primary', icon: Brain },
  'agent.routed': { label: '域路由', color: 'bg-orbit-accent', icon: Bot },
  'shadow.suggested': { label: '影子建议', color: 'bg-orbit-accent', icon: Eye },
  'step.started': { label: '步骤开始', color: 'bg-status-info', icon: Loader2 },
  'step.completed': { label: '步骤完成', color: 'bg-status-success', icon: CheckCircle2 },
  'answer.delta': { label: '生成回答', color: 'bg-orbit-accent', icon: Sparkles },
  'run.completed': { label: 'Run 完成', color: 'bg-status-success', icon: CheckCircle2 },
  'run.failed': { label: 'Run 失败', color: 'bg-status-danger', icon: XCircle },
  'run.cancelled': { label: 'Run 取消', color: 'bg-status-warning', icon: Ban },
}

const MEMORY_SCOPE_LABEL: Record<string, string> = {
  session: '会话摘要',
  personal: '个人偏好',
  role: '角色记忆',
  org: '组织术语',
}

function fmtTime(value?: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

function summarize(event: RunEvent): string {
  const p = event.payload || {}
  switch (event.type) {
    case 'intent.detected':
      return `${p.intent || '-'} · ${p.source || '-'} · ${Math.round(Number(p.confidence || 0) * 100)}%`
    case 'llm.fallback':
      return String(p.reason || '已回落规则')
    case 'plan.ready':
      return `${p.intent || '-'} · ${Array.isArray(p.calls) ? p.calls.length : 0} 个工具调用`
    case 'citations.retrieved':
      if (!p.configured) return '未配置知识库，跳过召回'
      return `${p.count ?? 0} 条引用${p.needsKnowledge && !p.count ? ' · 未命中知识依据' : ''}`
    case 'memory.applied':
      return `${p.count ?? 0} 条记忆${Array.isArray(p.scopes) && p.scopes.length ? ` · ${p.scopes.join('/')}` : ''}`
    case 'agent.routed':
      return `${p.from || '-'} → ${p.to || '-'}${p.reason ? ` · ${p.reason}` : ''}`
    case 'shadow.suggested':
      return `${p.agentKey || '-'} · ${p.suggestionType || 'general'}（待人工采纳）`
    case 'step.started':
      return `${p.tool || '-'}（第 ${p.seq ?? '-'} 步）`
    case 'step.completed':
      return `${p.tool || '-'} · ${p.rowCount ?? 0} 行 · ${p.durationMs ?? 0}ms`
    case 'answer.delta':
      return String(p.delta || '').slice(0, 120)
    case 'run.failed':
      return String(p.message || '执行失败')
    case 'run.completed':
      return `${p.stepCount ?? '-'} 个步骤 / ${p.citationCount ?? 0} 条引用 / ${p.memoryCount ?? 0} 条记忆`
    default:
      return ''
  }
}

export function AiOpsRunDetailPage() {
  const { runId = '' } = useParams<{ runId: string }>()
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setInterval> | null = null
    setLoading(true)
    setError('')

    const tick = async () => {
      try {
        const data = await api.get<RunDetail>(`/assistant/runs/${runId}`)
        if (stopped) return
        setDetail(data)
        if (TERMINAL.includes(data.run?.status)) {
          if (timer) clearInterval(timer)
        }
      } catch (err: any) {
        if (!stopped) setError(err?.message || '加载 Run 失败')
      } finally {
        if (!stopped) setLoading(false)
      }
    }

    tick()
    timer = setInterval(tick, 1500)
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
    }
  }, [runId, refreshKey])

  const run = detail?.run || {}
  const status: RunStatus = run.status || 'queued'
  const statusMeta = STATUS_META[status] || { label: status, variant: 'neutral' as const }
  const terminal = TERMINAL.includes(status)

  const events = useMemo(
    () => [...(detail?.events || [])].sort((a, b) => a.seq - b.seq),
    [detail]
  )

  const handleCancel = async () => {
    if (!confirm('确定取消该 Run？已完成的步骤会保留。')) return
    setCancelling(true)
    try {
      await api.post(`/assistant/runs/${runId}/cancel`)
      setRefreshKey((v) => v + 1)
    } catch (err: any) {
      setError(err?.message || '取消失败')
    } finally {
      setCancelling(false)
    }
  }

  const refresh = () => setRefreshKey((v) => v + 1)

  return (
    <div className="flex-1 overflow-y-auto bg-orbit-bg p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/ai-ops/chat"
          className="p-2 rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            Run 时间线
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            {run.fallback_used && <Badge variant="warning">已降级</Badge>}
          </h1>
          <p className="text-xs font-mono text-[var(--text-muted)] truncate">{runId}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            刷新
          </button>
          {!terminal && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-status-danger/40 bg-status-danger/10 text-status-danger hover:bg-status-danger/20 transition-colors disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              {cancelling ? '取消中…' : '取消 Run'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {loading && !detail ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中…
        </div>
      ) : !detail ? (
        <p className="text-sm text-[var(--text-muted)]">未找到该 Run</p>
      ) : (
        <>
          <Card>
            <CardBody className="space-y-3">
              <p className="text-base font-medium text-[var(--text-primary)]">{run.question || '—'}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Agent</p>
                  <p className="font-mono text-[var(--text-secondary)]">{run.agent_key || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">触发方式</p>
                  <p className="text-[var(--text-secondary)]">{run.trigger_type || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Token</p>
                  <p className="text-[var(--text-secondary)]">
                    {run.tokens_used ?? 0} / {run.token_budget ?? 60000}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">成本</p>
                  <p className="text-[var(--text-secondary)]">¥{Number(run.cost_cny || 0).toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">尝试次数</p>
                  <p className="text-[var(--text-secondary)]">{run.attempts ?? 0} / 5</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">开始</p>
                  <p className="text-[var(--text-secondary)]">{fmtTime(run.started_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">结束</p>
                  <p className="text-[var(--text-secondary)]">{fmtTime(run.finished_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">耗时</p>
                  <p className="text-[var(--text-secondary)]">{run.duration_ms ? `${run.duration_ms} ms` : '—'}</p>
                </div>
              </div>
              {run.error && (
                <div className="rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
                  {run.error}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card>
              <CardHeader title="事件时间线" subtitle={`${events.length} 条事件 · 每 1.5s 自动刷新`} />
              <CardBody>
                {events.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">暂无事件</p>
                ) : (
                  <ol className="relative border-l border-orbit-border ml-2 space-y-4 pl-5">
                    {events.map((event) => {
                      const meta = EVENT_META[event.type] || { label: event.type, color: 'bg-orbit-border', icon: Activity }
                      const Icon = meta.icon
                      return (
                        <motion.li key={event.seq} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="relative">
                          <span className={cn('absolute -left-[27px] top-1 w-3 h-3 rounded-full ring-2 ring-orbit-bg', meta.color)} />
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Icon className="w-3.5 h-3.5" />
                            <span className="text-[var(--text-secondary)] font-medium">{meta.label}</span>
                            <span className="font-mono">#{event.seq}</span>
                            <span className="ml-auto">{fmtTime(event.createdAt)}</span>
                          </div>
                          {summarize(event) && (
                            <p className="mt-1 text-xs text-[var(--text-secondary)] break-words">{summarize(event)}</p>
                          )}
                          {event.type !== 'answer.delta' && (
                            <details className="mt-1">
                              <summary className="text-[11px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]">
                                查看载荷
                              </summary>
                              <pre className="mt-1 max-h-40 overflow-auto rounded bg-orbit-ink p-2 text-[11px] text-[var(--text-muted)]">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
                            </details>
                          )}
                        </motion.li>
                      )
                    })}
                  </ol>
                )}
              </CardBody>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader title="执行步骤" subtitle={`${detail.steps.length} 个步骤`} />
                <CardBody className="space-y-2">
                  {detail.steps.length === 0 && <p className="text-sm text-[var(--text-muted)]">暂无步骤</p>}
                  {detail.steps.map((step) => (
                    <div key={step.seq} className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-[var(--text-muted)]">#{step.seq}</span>
                        <span className="font-mono text-[var(--text-secondary)]">{step.tool}</span>
                        <Badge variant={step.status === 'success' ? 'success' : 'danger'}>
                          {step.status === 'success' ? '成功' : step.status || '失败'}
                        </Badge>
                        <span className="ml-auto text-[var(--text-muted)]">
                          {step.row_count ?? 0} 行 · {step.duration_ms ?? 0} ms
                        </span>
                      </div>
                      {step.error && <p className="mt-1 text-xs text-status-danger">{step.error}</p>}
                      <details className="mt-1">
                        <summary className="text-[11px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]">
                          输入 / 输出
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded bg-orbit-bg p-2 text-[11px] text-[var(--text-muted)]">
                          {JSON.stringify({ input: step.input, output: step.output_ref }, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="结论" subtitle={`${detail.claims.length} 条`} />
                <CardBody className="space-y-2">
                  {detail.claims.length === 0 && <p className="text-sm text-[var(--text-muted)]">暂无结论</p>}
                  {detail.claims[0]?.headline && (
                    <p className="text-sm font-medium text-[var(--text-primary)]">{detail.claims[0].headline}</p>
                  )}
                  {detail.claims.map((claim) => (
                    <p key={claim.seq} className="text-sm text-[var(--text-secondary)]">
                      <span className="text-xs text-[var(--text-muted)] mr-2">#{claim.seq}</span>
                      {claim.text}
                    </p>
                  ))}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="证据" subtitle={`${detail.evidence.length} 条`} />
                <CardBody>
                  {detail.evidence.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">暂无证据</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-orbit-border text-left text-[var(--text-muted)]">
                            <th className="py-2 pr-3">指标</th>
                            <th className="py-2 pr-3">值</th>
                            <th className="py-2 pr-3">口径</th>
                            <th className="py-2 pr-3">时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.evidence.map((ev) => (
                            <tr key={ev.evidence_key} className="border-b border-orbit-border/60 last:border-0">
                              <td className="py-2 pr-3 text-[var(--text-secondary)]">
                                <Database className="w-3 h-3 inline mr-1 text-[var(--text-muted)]" />
                                {ev.label || ev.metric || ev.evidence_key}
                              </td>
                              <td className="py-2 pr-3 text-[var(--text-primary)] font-mono">
                                {ev.value ?? '-'}{ev.unit || ''}
                              </td>
                              <td className="py-2 pr-3 text-[var(--text-muted)]">{ev.scope || '-'}</td>
                              <td className="py-2 pr-3 text-[var(--text-muted)]">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {ev.time_range || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="引用" subtitle={`${detail.citations.length} 条知识来源`} />
                <CardBody className="space-y-2">
                  {detail.citations.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">本次未召回知识库引用</p>
                  ) : (
                    detail.citations.map((citation) => (
                      <div
                        key={citation.seq}
                        className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-[var(--text-muted)]">#{citation.seq}</span>
                          <BookOpen className="w-3.5 h-3.5 text-orbit-accent" />
                          <span className="text-[var(--text-secondary)] font-medium truncate">
                            {citation.document_name || '未命名文档'}
                          </span>
                          {Number(citation.score) > 0 && (
                            <span className="ml-auto text-[var(--text-muted)]">
                              相关度 {Math.round(Number(citation.score) * 100)}%
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)] break-words">
                          {citation.snippet}
                        </p>
                        {citation.chunk_id && (
                          <p className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">
                            chunk {citation.chunk_id}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="记忆" subtitle={`${detail.memories.length} 条已应用记忆`} />
                <CardBody className="space-y-2">
                  {detail.memories.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">本次未命中可用记忆</p>
                  ) : (
                    detail.memories.map((memory) => (
                      <div
                        key={memory.id || memory.memoryKey}
                        className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <Brain className="w-3.5 h-3.5 text-orbit-primary" />
                          <span className="text-[var(--text-secondary)] font-medium">
                            {MEMORY_SCOPE_LABEL[memory.scope] || memory.scope}
                          </span>
                          <span className="ml-auto font-mono text-[var(--text-muted)]">
                            {memory.memoryKey}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)] break-words">
                          {memory.content}
                        </p>
                      </div>
                    ))
                  )}
                  <p className="text-[11px] text-[var(--text-muted)]">
                    记忆仅作偏好与术语参考，数据结论以工具取数与事实层为准。
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AiOpsRunDetailPage
