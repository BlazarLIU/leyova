import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  X,
  Send,
  Loader2,
  BookOpen,
  Brain,
  ClipboardCheck,
  ExternalLink,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { api, ApiError } from '@/services/api'
import { toast } from '@/utils/toast'
import { cn } from '@/utils/cn'
import { MarkdownMessage } from '@/components/ai/MarkdownMessage'

export type CopilotPage = 'live' | 'review' | 'ads'

interface PageMeta {
  label: string
  domain: 'live' | 'ads'
  quickPrompts: string[]
}

const PAGE_META: Record<CopilotPage, PageMeta> = {
  live: {
    label: '场中盯盘',
    domain: 'live',
    quickPrompts: ['本场当前最大风险是什么？', '距离目标差额还差多少？', '现在最该调整的一个动作是什么？'],
  },
  review: {
    label: '单场复盘',
    domain: 'live',
    quickPrompts: ['本场未达成目标的主因是什么？', '哪个环节最值得优先改进？', '给我 3 条明日可执行动作'],
  },
  ads: {
    label: '投放协同',
    domain: 'ads',
    quickPrompts: ['当前投放 ROI 是否健康？', '是否应该调整预算？给出依据', '哪些投放计划需要立即熔断？'],
  },
}

interface Citation {
  seq: number
  document_name?: string | null
  snippet?: string | null
  score?: number | string | null
}

interface MemoryItem {
  memoryKey?: string
  scope?: string
  content?: string
}

interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  citations?: Citation[]
  memories?: MemoryItem[]
  runId?: string
}

interface RunDetail {
  citations?: Citation[]
  memories?: MemoryItem[]
}

interface MemoryRecord {
  id: string
  scope: string
  memory_key: string
  content: string
  status: string
  source_type?: string
  created_at?: string
}

const MEMORY_SCOPE_LABEL: Record<string, string> = {
  session: '会话摘要',
  personal: '个人偏好',
  role: '角色记忆',
  org: '组织术语',
}

interface EmbeddedCopilotProps {
  page: CopilotPage
  sessionId?: number | null
  contextLabel?: string
  date?: string
}

const pageFallbackDate = () => new Date().toISOString().slice(0, 10)

export function EmbeddedCopilot({ page, sessionId, contextLabel, date }: EmbeddedCopilotProps) {
  const meta = PAGE_META[page]
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [creatingCase, setCreatingCase] = useState(false)
  const [caseInfo, setCaseInfo] = useState<{ id: number | string; caseNo?: string } | null>(null)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memoryItems, setMemoryItems] = useState<MemoryRecord[]>([])
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [memoryDraft, setMemoryDraft] = useState('')
  const [memorySaving, setMemorySaving] = useState(false)
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, streaming])

  const contextLine = [
    `页面：${meta.label}`,
    sessionId ? `场次：Session #${sessionId}` : null,
    contextLabel ? `对象：${contextLabel}` : null,
    date ? `日期：${date}` : null,
  ]
    .filter(Boolean)
    .join('；')

  const buildMessage = (text: string) =>
    `【本页上下文】${contextLine}。\n` +
    '【范围约束】只回答与本页业务相关的问题；若本页数据不足，请明确说明「数据不足」，不要跨页臆造。\n' +
    `【用户问题】${text}`

  const updateAssistant = useCallback((id: string, patch: Partial<CopilotMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const streamRun = useCallback(
    async (runId: string, assistantId: string): Promise<string> => {
      const controller = new AbortController()
      abortRef.current = controller
      let full = ''
      let cursor = 0
      let terminal = false
      let retries = 0

      while (!terminal && retries < 4) {
        const response = await fetch(`/api/v1/assistant/runs/${runId}/events?cursor=${cursor}`, {
          credentials: 'include',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          throw new ApiError(`HTTP ${response.status}`, response.status)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let streamDone = false

        while (!streamDone) {
          const { value, done } = await reader.read()
          streamDone = done
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
          const frames = buffer.split('\n\n')
          buffer = frames.pop() || ''

          for (const frame of frames) {
            const line = frame.split('\n').find((l) => l.startsWith('data: '))
            if (!line) continue
            const payload = line.slice(6).trim()
            if (!payload) continue

            let event: Record<string, any>
            try {
              event = JSON.parse(payload)
            } catch {
              continue
            }
            if (typeof event.seq === 'number') cursor = Math.max(cursor, event.seq)

            if (event.type === 'answer.delta') {
              full += String(event.content || '')
              updateAssistant(assistantId, { content: full })
            } else if (event.type === 'run.completed' || event.type === 'run.cancelled') {
              terminal = true
            } else if (event.type === 'run.failed') {
              throw new Error(String(event.message || '生成回复失败'))
            }
          }
        }

        if (!terminal) {
          retries += 1
          await new Promise((resolve) => setTimeout(resolve, 800))
        }
      }

      if (!full) throw new Error('副驾未返回内容')
      return full
    },
    [updateAssistant]
  )

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    const userId = `u-${Date.now()}`
    const assistantId = `a-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content },
      { id: assistantId, role: 'assistant', content: '', pending: true },
    ])
    setInput('')
    setStreaming(true)
    setCaseInfo(null)

    try {
      const started = await api.post<{ runId: string; conversationId: string }>('/assistant/runs', {
        message: buildMessage(content),
        conversationId,
        idempotencyKey: `copilot-${page}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })
      setConversationId(started.conversationId)

      const reply = await streamRun(started.runId, assistantId)
      const detail = await api.get<RunDetail>(`/assistant/runs/${started.runId}`).catch(() => null)

      if (!mountedRef.current) return
      updateAssistant(assistantId, {
        content: reply,
        pending: false,
        citations: detail?.citations || [],
        memories: detail?.memories || [],
        runId: started.runId,
      })
    } catch (err) {
      if (!mountedRef.current) return
      const aborted = (err as Error)?.name === 'AbortError'
      const message = aborted
        ? '本次生成已取消。'
        : `副驾暂不可用：${(err as Error)?.message || '请稍后重试'}`
      updateAssistant(assistantId, { content: message, pending: false })
    } finally {
      if (mountedRef.current) setStreaming(false)
      abortRef.current = null
    }
  }

  const loadMemories = useCallback(async () => {
    setMemoryLoading(true)
    try {
      const res = await api.get<{ items: MemoryRecord[] }>('/assistant/memories', { limit: 100 })
      setMemoryItems(res.items || [])
    } catch (err) {
      toast.error(`加载记忆失败：${(err as Error)?.message || '请稍后重试'}`)
    } finally {
      setMemoryLoading(false)
    }
  }, [])

  const openMemories = () => {
    setMemoryOpen(true)
    void loadMemories()
  }

  const handleSaveMemory = async () => {
    const content = memoryDraft.trim()
    if (!content || memorySaving) return
    setMemorySaving(true)
    try {
      const res = await api.post<{ id: string; action: string }>('/assistant/memories', { content })
      setMemoryDraft('')
      toast.success(res.action === 'pending_conflict' ? '与现有记忆冲突，已提交待确认' : '已记住这条偏好')
      await loadMemories()
    } catch (err) {
      toast.error(`保存记忆失败：${(err as Error)?.message || '请稍后重试'}`)
    } finally {
      setMemorySaving(false)
    }
  }

  const handleDeleteMemory = async (id: string) => {
    if (deletingMemoryId) return
    setDeletingMemoryId(id)
    try {
      await api.delete(`/assistant/memories/${id}`)
      setMemoryItems((prev) => prev.filter((m) => m.id !== id))
      toast.success('记忆已删除')
    } catch (err) {
      toast.error(`删除记忆失败：${(err as Error)?.message || '请稍后重试'}`)
    } finally {
      setDeletingMemoryId(null)
    }
  }

  const latestAnswer = [...messages].reverse().find((m) => m.role === 'assistant' && m.content && !m.pending)

  const handleCreateCase = async () => {
    if (!latestAnswer || creatingCase) return
    setCreatingCase(true)
    try {
      const title = `${meta.label}副驾建议 · ${
        sessionId ? `Session #${sessionId}` : date || pageFallbackDate()
      }`.slice(0, 200)
      const res = await api.post<{ case: { id: number; caseNo?: string }; created: boolean }>(
        '/decision-cases',
        {
          title,
          problemStatement: latestAnswer.content.slice(0, 2000),
          domain: meta.domain,
          evidence: [],
          options: [
            { key: 'act', label: '按副驾建议执行', riskLevel: 'R2' },
            { key: 'no_action', label: '暂不执行（维持现状）', riskLevel: 'R1' },
          ],
          chosenOption: 'act',
          expectedImpact: {},
          riskLevel: 'R2',
          measureAfterDays: 3,
          submit: true,
        }
      )
      const created = res?.case
      setCaseInfo({ id: created?.id, caseNo: created?.caseNo })
      toast.success(res?.created === false ? '已存在同指纹决策案，已直接关联' : '决策案已创建并进入审批')
    } catch (err) {
      toast.error(`生成决策案失败：${(err as Error)?.message || '请稍后重试'}`)
    } finally {
      setCreatingCase(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/3 z-40 flex items-center gap-1.5 rounded-l-xl bg-orbit-primary px-2.5 py-3 text-orbit-snow shadow-lg shadow-orbit-primary/30 transition-all hover:bg-orbit-primary-dark"
          title="打开本页 AI 副驾"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-[11px] font-bold [writing-mode:vertical-rl]">AI 副驾</span>
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
          <aside className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[420px] flex-col border-l border-orbit-border bg-orbit-surface shadow-2xl">
            {memoryOpen && (
              <div className="absolute inset-0 z-20 flex flex-col bg-orbit-surface">
                <div className="flex items-center justify-between border-b border-orbit-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orbit-primary/15">
                      <Brain className="h-4 w-4 text-orbit-primary-light" />
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">我的记忆</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void loadMemories()}
                      title="刷新"
                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                    >
                      <RefreshCw className={cn('h-4 w-4', memoryLoading && 'animate-spin')} />
                    </button>
                    <button
                      onClick={() => setMemoryOpen(false)}
                      title="返回对话"
                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    仅你本人可见；组织术语只读，角色记忆需审核。数字与经营结论以工具取数、事实层为准，不走记忆。
                  </p>
                  {memoryLoading && memoryItems.length === 0 ? (
                    <div className="flex items-center gap-1.5 py-6 text-xs text-[var(--text-muted)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-orbit-primary-light" />
                      <span>正在加载记忆…</span>
                    </div>
                  ) : memoryItems.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[var(--text-muted)]">还没有记忆，可在下方添加一条长期偏好</p>
                  ) : (
                    memoryItems.map((memory) => {
                      const deletable = memory.scope === 'personal' || memory.scope === 'session'
                      return (
                        <div
                          key={memory.id}
                          className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="rounded bg-orbit-primary/10 px-1.5 py-0.5 font-bold text-orbit-primary-light">
                              {MEMORY_SCOPE_LABEL[memory.scope] || memory.scope}
                            </span>
                            {memory.status === 'pending' && (
                              <span className="rounded bg-status-warning/10 px-1.5 py-0.5 font-bold text-status-warning">
                                待确认
                              </span>
                            )}
                            {deletable && (
                              <button
                                onClick={() => void handleDeleteMemory(memory.id)}
                                disabled={deletingMemoryId === memory.id}
                                title="删除这条记忆"
                                className="ml-auto rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-50"
                              >
                                {deletingMemoryId === memory.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[var(--text-secondary)] break-words">
                            {memory.content}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="border-t border-orbit-border p-3">
                  <textarea
                    value={memoryDraft}
                    onChange={(e) => setMemoryDraft(e.target.value)}
                    rows={2}
                    placeholder="补充一条长期偏好，例如：以后回答尽量简短"
                    className="w-full resize-none rounded-lg border border-orbit-border bg-orbit-surface2 px-3 py-2 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary/50"
                  />
                  <button
                    onClick={() => void handleSaveMemory()}
                    disabled={!memoryDraft.trim() || memorySaving}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-orbit-primary px-3 py-2 text-xs font-bold text-orbit-snow transition-all hover:bg-orbit-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {memorySaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    记住这条偏好
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-start justify-between gap-3 border-b border-orbit-border px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orbit-primary/15">
                    <Sparkles className="h-4 w-4 text-orbit-primary-light" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">本页 AI 副驾</h2>
                  <span className="rounded bg-orbit-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-orbit-primary-light">
                    {meta.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]" title={contextLine}>
                  {contextLine}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  onClick={openMemories}
                  title="记忆管理"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                >
                  <Brain className="h-4 w-4" />
                </button>
                <Link
                  to="/ai-ops/chat"
                  title="打开完整副驾"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                  title="收起"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--text-muted)]">
                    已自动带入当前页面、场次与时间窗，仅回答本页问题；回答会标注知识引用与已应用记忆。
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {meta.quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        disabled={streaming}
                        className="rounded-xl border border-orbit-border bg-orbit-surface2 px-3 py-2.5 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                  <div
                    className={cn(
                      'h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center',
                      msg.role === 'assistant' ? 'bg-orbit-primary text-orbit-snow' : 'bg-orbit-surface3 text-[var(--text-muted)]'
                    )}
                  >
                    {msg.role === 'assistant' ? <Sparkles className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">我</span>}
                  </div>

                  <div className={cn('min-w-0 max-w-[330px]', msg.role === 'user' && 'flex flex-col items-end')}>
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2',
                        msg.role === 'user'
                          ? 'rounded-tr-sm bg-orbit-primary text-orbit-snow'
                          : 'rounded-tl-sm border border-orbit-border bg-orbit-surface2'
                      )}
                    >
                      {msg.role === 'user' ? (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      ) : msg.content ? (
                        <MarkdownMessage content={msg.content} />
                      ) : (
                        <div className="flex items-center gap-1.5 py-0.5 text-xs text-[var(--text-muted)]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-orbit-primary-light" />
                          <span>正在分析本页数据…</span>
                        </div>
                      )}
                    </div>

                    {msg.role === 'assistant' && (msg.citations?.length || msg.memories?.length) ? (
                      <div className="mt-1.5 w-full space-y-1">
                        {!!msg.citations?.length && (
                          <details className="rounded-lg border border-orbit-border/70 bg-orbit-ink/40 px-2 py-1.5">
                            <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-orbit-accent-light">
                              <BookOpen className="h-3 w-3" />
                              <span>{msg.citations.length} 条知识引用</span>
                            </summary>
                            <ul className="mt-1 space-y-1">
                              {msg.citations.map((c) => (
                                <li key={c.seq} className="text-[11px] text-[var(--text-muted)]">
                                  #{c.seq} 《{c.document_name || '未命名文档'}》
                                  {Number(c.score) > 0 ? ` · 相关度 ${Math.round(Number(c.score) * 100)}%` : ''}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {!!msg.memories?.length && (
                          <details className="rounded-lg border border-orbit-border/70 bg-orbit-ink/40 px-2 py-1.5">
                            <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-orbit-primary-light">
                              <Brain className="h-3 w-3" />
                              <span>{msg.memories.length} 条已应用记忆</span>
                            </summary>
                            <ul className="mt-1 space-y-1">
                              {msg.memories.map((m, i) => (
                                <li key={`${m.memoryKey || i}`} className="text-[11px] text-[var(--text-muted)]">
                                  [{m.scope || 'memory'}] {m.content || m.memoryKey || ''}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ) : null}

                    {msg.role === 'assistant' && msg.runId && (
                      <Link
                        to={`/ai-ops/runs/${msg.runId}`}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <ClipboardCheck className="h-3 w-3" />
                        查看 Run 时间线
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {latestAnswer && (
              <div className="border-t border-orbit-border px-4 py-2">
                {caseInfo ? (
                  <Link
                    to="/ai-ops/governance/cases"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-orbit-success/30 bg-orbit-success/10 px-3 py-2 text-xs font-bold text-status-success"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {caseInfo.caseNo ? `决策案 ${caseInfo.caseNo} 已生成` : '决策案已生成，前往查看'}
                  </Link>
                ) : (
                  <button
                    onClick={handleCreateCase}
                    disabled={creatingCase || streaming}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-orbit-success to-orbit-accent px-3 py-2 text-xs font-bold text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingCase ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                    一键生成决策案（提交审批）
                  </button>
                )}
              </div>
            )}

            <div className="border-t border-orbit-border p-3">
              <div className="flex items-end gap-2 rounded-xl border border-orbit-border bg-orbit-surface2 px-3 py-2 focus-within:border-orbit-primary/50">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  placeholder={`只问${meta.label}相关问题…`}
                  className="max-h-28 flex-1 resize-none bg-transparent text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none"
                  style={{ minHeight: '20px' }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || streaming}
                  className={cn(
                    'flex-shrink-0 rounded-lg p-1.5 transition-all',
                    input.trim() && !streaming
                      ? 'bg-orbit-primary text-white hover:bg-orbit-primary-light'
                      : 'bg-orbit-surface3 text-[var(--text-muted)]'
                  )}
                >
                  {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-[var(--text-subtle)]">
                Enter 发送 · Shift+Enter 换行 · 回答引用可展开溯源
              </p>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
