import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Send, Sparkles, ChevronDown,
  Copy, ThumbsUp, ThumbsDown, RefreshCw, Paperclip,
  Plus, Search, MessageSquare, Menu, X, Trash2,
  Wrench, FileText, ShieldAlert, Activity,
} from 'lucide-react'
import { api, ApiError } from '@/services/api'
import { fetchAssistantCapabilities, type AssistantCapabilities } from '@/services/ai-ops-data'
import { Avatar } from '@/components/ui'
import { MarkdownMessage } from '@/components/ai/MarkdownMessage'
import { cn } from '@/utils/cn'
import type { ChatMessage, Conversation } from '@/types'

const suggestions = [
  '查一下现在的整体 GMV',
  '主播业绩排行',
  '渠道投放效果分析',
  '查看待处理异常预警',
  '互动留存数据分析',
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-orbit-primary"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
        />
      ))}
    </div>
  )
}

function InfoModule({
  title,
  date,
  loading,
  content,
  emptyLabel,
  Icon,
}: {
  title: string
  date?: string
  loading: boolean
  content: string | null
  emptyLabel: string
  Icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <section className="bg-orbit-surface2 border border-orbit-border rounded-2xl px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-orbit-primary-light flex-shrink-0" />
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{title}</h3>
        {date && <span className="text-[11px] text-[var(--text-muted)]">· {date}</span>}
      </div>
      <div className="border-t border-orbit-border pt-3">
        {loading ? (
          <div className="space-y-2 py-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-3 rounded bg-[var(--hover-bg3)] animate-pulse" />
            ))}
          </div>
        ) : content ? (
          <MarkdownMessage content={content} />
        ) : (
          <p className="text-sm text-[var(--text-muted)]">{emptyLabel}</p>
        )}
      </div>
    </section>
  )
}

function ConversationItem({
  conv,
  isActive,
  onSelect,
  onDelete,
}: {
  conv: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div className={cn(
      'group relative w-full text-left px-4 py-3 transition-colors hover:bg-[var(--hover-bg)] border-b border-orbit-border/50 cursor-pointer',
      isActive && 'bg-orbit-primary/10 border-l-2 border-l-orbit-primary'
    )} onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className={cn(
            'w-4 h-4 flex-shrink-0',
            isActive ? 'text-orbit-primary-light' : 'text-[var(--text-primary)]'
          )} />
          <span className={cn(
            'text-sm truncate',
            isActive ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'
          )}>
            {conv.title}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-[var(--text-primary)]">{conv.timestamp}</span>
          {conv.unread && <span className="w-2 h-2 rounded-full bg-orbit-primary flex-shrink-0" />}
        </div>
      </div>
      {conv.ownerName && (
        <p className="text-[11px] text-orbit-accent-light font-medium mt-1 truncate pl-6">
          @{conv.ownerName}
        </p>
      )}
      <p className="text-[12px] text-[var(--text-muted)] mt-1 truncate pl-6">{conv.lastMessage}</p>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-orbit-danger/20 text-[var(--text-muted)] hover:text-status-danger transition-all"
        title="删除会话"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [lastRunId, setLastRunId] = useState('')
  const [model, setModel] = useState('')
  const [modelOptions, setModelOptions] = useState<AssistantCapabilities['llm']['models']>([])
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showConvList, setShowConvList] = useState(false)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // 本轮流式过程中的工具调用指示条
  const [activeTools, setActiveTools] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // 模型清单由后端 /assistant/capabilities 下发，避免前端硬编码
  useEffect(() => {
    let cancelled = false
    fetchAssistantCapabilities()
      .then((caps) => {
        if (cancelled) return
        const options = caps.llm.models
        setModelOptions(options)
        const preferred = options.find((m) => m.available && m.default) || options.find((m) => m.available) || options[0]
        if (preferred) setModel(preferred.id)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // 报告弹窗：leyova 日报 / 巡检记录（点击顶部按钮查看全部记录，最新在上）
  const [reportPanel, setReportPanel] = useState<'daily' | 'patrol' | null>(null)
  const [reportList, setReportList] = useState<Array<{ title: string; date: string; content: string | null; createdAt: string }>>([])
  const [reportListLoading, setReportListLoading] = useState(false)

  const openReportPanel = useCallback(async (kind: 'daily' | 'patrol') => {
    setReportPanel(kind)
    setReportListLoading(true)
    try {
      const endpoint = kind === 'daily'
        ? '/api/v1/overview/daily-reports'
        : '/api/v1/overview/patrol-records'
      const list = await api.get<any[]>(endpoint)
      setReportList(Array.isArray(list) ? list : [])
    } catch {
      setReportList([])
    } finally {
      setReportListLoading(false)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    api.get<any[]>('/api/ai/sessions')
      .then(res => {
        if (Array.isArray(res) && res.length > 0) {
          setConversations(res.map((c: any) => ({
            id: String(c.id),
            title: c.title || '',
            lastMessage: c.lastMessage || '',
            timestamp: c.updated_at
              ? new Date(c.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
              : '',
            ownerName: c.owner_name || '',
          })))
        }
      })
      .catch(() => { /* 静默处理 */ })
      .finally(() => setLoading(false))
  }, [])

  const upsertAssistantMessage = (content: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last && last.role === 'assistant' && last.timestamp === '__streaming__') {
        return [...prev.slice(0, -1), { ...last, content }]
      }
      return [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: '__streaming__',
      }]
    })
  }

  const finalizeAssistantMessage = () => {
    setMessages(prev => prev.map(msg => (
      msg.role === 'assistant' && msg.timestamp === '__streaming__'
        ? { ...msg, timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
        : msg
    )))
  }

  const handleSend = async (text?: string) => {
    const content = text || input.trim()
    if (!content || isTyping) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(m => [...m, userMsg])
    setInput('')
    setIsTyping(true)
    setActiveTools([])

    try {
      const started = await api.post<{ runId: string; conversationId: string; status: string }>(
        '/api/v1/assistant/runs',
        {
          message: content,
          conversationId: selectedConvId || undefined,
          idempotencyKey: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        }
      )

      setSelectedConvId(started.conversationId)
      setLastRunId(started.runId)

      let fullReply = ''
      let cursor = 0
      let terminal = false
      let retries = 0

      // 断线重连：以 cursor 续传，保证事件不丢
      while (!terminal && retries < 5) {
        const response = await fetch(
          `/api/v1/assistant/runs/${started.runId}/events?cursor=${cursor}`,
          { credentials: 'include', headers: { Accept: 'text/event-stream' } }
        )

        if (!response.ok || !response.body) {
          throw new ApiError(`HTTP ${response.status}`, response.status)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let streamDone = false

        while (!streamDone) {
          const { value, done: finished } = await reader.read()
          streamDone = finished
          buffer += decoder.decode(value || new Uint8Array(), { stream: !finished })

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

            if (event.type === 'intent.detected') {
              const label = `意图: ${event.intent} (${event.source})`
              setActiveTools(prev => prev.includes(label) ? prev : [...prev, label])
            } else if (event.type === 'llm.fallback') {
              setActiveTools(prev => [...prev, `模型降级: ${event.reason || '已回落规则'}`])
            } else if (event.type === 'plan.ready') {
              const label = `planner: ${event.intent || '构建受控分析计划'}`
              setActiveTools(prev => prev.includes(label) ? prev : [...prev, label])
            } else if (event.type === 'step.started') {
              const label = `${event.tool}: ${event.purpose || '受控取数'}`
              setActiveTools(prev => prev.includes(label) ? prev : [...prev, label])
            } else if (event.type === 'step.completed' && event.status === 'failed') {
              setActiveTools(prev => [...prev, `${event.tool}: 执行失败`])
            } else if (event.type === 'answer.delta') {
              fullReply += String(event.content || '')
              upsertAssistantMessage(fullReply)
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

      if (!fullReply) {
        throw new Error('Empty reply')
      }

      upsertAssistantMessage(fullReply)
      finalizeAssistantMessage()
      setActiveTools([])

      await api.get<any[]>('/api/ai/sessions').then(res => {
        if (Array.isArray(res)) {
          setConversations(res.map((c: any) => ({
            id: String(c.id),
            title: c.title || '',
            lastMessage: c.lastMessage || '',
            timestamp: c.updated_at
              ? new Date(c.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
              : '',
            ownerName: c.owner_name || '',
          })))
        }
      }).catch(() => {})
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined
      if (status === 403) {
        setSelectedConvId(null)
        setMessages([])
        return
      }
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `感谢您的提问：**"${content}"**\n\n这是 AI 助手的离线回复。当前流式服务不可用，稍后将自动恢复在线分析能力。\n\n**当前可用的分析能力：**\n- GMV、UV、转化率等核心指标查询\n- 异常数据自动检测与预警\n- 多维度数据对比与趋势分析\n- 运营建议与优化方案`,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(m => [...m, aiMsg])
    } finally {
      setIsTyping(false)
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setSelectedConvId(null)
    setShowConvList(false)
  }

  useEffect(() => {
    if (!selectedConvId) return
    setLoading(true)
    api.get<ChatMessage[]>(`/api/ai/messages/${selectedConvId}`)
      .then(res => {
        if (Array.isArray(res)) {
          setMessages(res.map((msg: any, i: number) => ({
            id: msg.id?.toString() || String(i),
            role: msg.role,
            content: msg.content || '',
            timestamp: msg.created_at
              ? new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              : '',
          })))
        }
      })
      .catch((err: unknown) => {
        const status = err instanceof ApiError ? err.status : undefined
        if (status === 403) {
          setSelectedConvId(null)
        }
        setMessages([])
      })
      .finally(() => setLoading(false))
  }, [selectedConvId])

  const handleSelectConv = (id: string) => {
    setSelectedConvId(id)
    setShowConvList(false)
  }

  const handleDeleteConv = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm('确定要删除此会话吗？')) return
    try {
      await api.delete(`/api/ai/sessions/${id}`)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (selectedConvId === id) {
        setSelectedConvId(null)
        setMessages([])
      }
    } catch {
      // 静默处理
    }
  }

  const currentConvName = selectedConvId
    ? conversations.find(c => c.id === selectedConvId)?.title
    : '新对话'

  return (
    <div className="flex flex-1 min-h-0 h-full overflow-hidden bg-orbit-bg">
      <div className="w-72 border-r border-orbit-border flex-shrink-0 hidden md:flex flex-col bg-orbit-surface h-full min-h-0">
        <div className="h-14 border-b border-orbit-border px-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">历史会话</h2>
          <button onClick={handleNewChat} className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
            <input placeholder="搜索会话..." className="flex-1 bg-transparent text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <div className="w-2 h-2 rounded-full bg-orbit-accent animate-pulse" />
                加载中...
              </div>
            </div>
          ) : (
            <>
              <div className="px-2 py-1">
                <button
                  onClick={handleNewChat}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors hover:bg-[var(--hover-bg)] rounded-lg border-b border-orbit-border/50',
                    !selectedConvId && 'bg-orbit-primary/10 border-l-2 border-l-orbit-primary rounded-none'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-orbit-primary-light" />
                    <span className={cn('text-sm', !selectedConvId ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]')}>
                      新对话
                    </span>
                  </div>
                </button>
              </div>
              {conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isActive={selectedConvId === conv.id}
                  onSelect={() => handleSelectConv(conv.id)}
                  onDelete={() => handleDeleteConv(conv.id)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showConvList && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setShowConvList(false)} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed left-0 top-0 bottom-0 w-72 z-30 bg-orbit-surface border-r border-orbit-border md:hidden flex flex-col">
              <div className="h-14 border-b border-orbit-border px-4 flex items-center justify-between flex-shrink-0">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)]">历史会话</h2>
                <button onClick={() => setShowConvList(false)} className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs">
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                  <input placeholder="搜索会话..." className="flex-1 bg-transparent text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="px-2 py-1">
                  <button onClick={handleNewChat} className="w-full text-left px-4 py-3 transition-colors hover:bg-[var(--hover-bg)] rounded-lg text-sm text-[var(--text-secondary)] flex items-center gap-2">
                    <Plus className="w-4 h-4 text-orbit-primary-light" />
                    新对话
                  </button>
                </div>
                {conversations.map(conv => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={selectedConvId === conv.id}
                    onSelect={() => handleSelectConv(conv.id)}
                    onDelete={() => handleDeleteConv(conv.id)}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="h-14 border-b border-orbit-border px-4 flex items-center gap-3 bg-orbit-surface/60 backdrop-blur-xl flex-shrink-0">
          <button onClick={() => setShowConvList(true)} className="md:hidden p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <Menu className="w-4 h-4" />
          </button>

          <div className="w-7 h-7 rounded-lg bg-orbit-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-orbit-primary-light" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-secondary)] truncate">{currentConvName}</p>
            <p className="text-[11px] text-[var(--text-muted)] hidden sm:block">leyova 直播电商 AI 运营助手</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {lastRunId && (
              <Link
                to={`/ai-ops/runs/${lastRunId}`}
                title="查看本次 Run 时间线"
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors bg-orbit-surface2 border-orbit-border text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Run 详情</span>
              </Link>
            )}
            {/* 报告查看：日报 / 巡检（点击弹窗展示全部记录，最新在上） */}
            <button
              onClick={() => openReportPanel('daily')}
              title="查看全部经营日报"
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors bg-orbit-surface2 border-orbit-border text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">日报</span>
            </button>
            <button
              onClick={() => openReportPanel('patrol')}
              title="查看全部巡检记录"
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors bg-orbit-surface2 border-orbit-border text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">巡检</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowModelPicker(o => !o)} className="hidden flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-orbit-surface2 px-2.5 py-1.5 rounded-lg border border-orbit-border transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-orbit-accent animate-pulse" />
                <span className="hidden sm:inline">{model || '模型未配置'}</span>
                <span className="sm:hidden">Model</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {showModelPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute right-0 top-full mt-1 bg-orbit-surface2 border border-orbit-border rounded-xl shadow-2xl z-50 overflow-hidden min-w-48">
                      {modelOptions.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.id); setShowModelPicker(false) }}
                          className={cn('w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-[var(--hover-bg)]', m.id === model ? 'text-orbit-primary-light font-medium' : 'text-[var(--text-muted)]')}
                        >
                          {m.label || m.id}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orbit-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-orbit-primary-light" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-secondary)] mb-2">leyova 直播电商 AI 运营助手</h2>
              <p className="text-sm text-[var(--text-muted)] mb-8 max-w-md">您可以向我询问关于直播电商运营数据的任何问题，我将为您提供智能分析</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="text-left text-sm text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border rounded-xl px-4 py-3 hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
              {msg.role === 'assistant' ? (
                <div className="w-8 h-8 rounded-lg bg-orbit-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              ) : (
                <Avatar initials="我" size="sm" className="mt-0.5 flex-shrink-0" />
              )}

              <div className={cn('max-w-2xl min-w-0', msg.role === 'user' && 'items-end flex flex-col')}>
                <div className={cn(
                  'rounded-2xl px-4 py-3',
                  msg.role === 'user'
                    ? 'bg-orbit-primary text-white rounded-tr-sm'
                    : 'bg-orbit-surface2 border border-orbit-border rounded-tl-sm'
                )}>
                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <MarkdownMessage content={msg.content} />
                  )}
                </div>
                <div className={cn('flex items-center gap-2 mt-1.5', msg.role === 'user' && 'flex-row-reverse')}>
                  <span className="text-[11px] text-[var(--text-primary)]">{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1">
                      {[Copy, ThumbsUp, ThumbsDown, RefreshCw].map((Icon, i) => (
                        <button key={i} className="p-1 text-[var(--text-primary)] hover:text-[var(--text-muted)] transition-colors rounded">
                          <Icon className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {activeTools.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-orbit-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-center gap-2 bg-orbit-surface2 border border-orbit-border rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-[var(--text-muted)]">
                <Wrench className="w-3.5 h-3.5 text-orbit-primary-light animate-pulse" />
                <span>正在调用工具：{activeTools.join('、')}</span>
              </div>
            </motion.div>
          )}

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-orbit-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-orbit-surface2 border border-orbit-border rounded-2xl rounded-tl-sm px-4 py-3">
                <TypingIndicator />
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-orbit-border p-4 bg-orbit-surface/60 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-end gap-3 bg-orbit-surface2 border border-orbit-border rounded-2xl px-4 py-3 focus-within:border-orbit-primary/50 transition-colors">
            <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-0.5 hidden sm:block">
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="输入您的问题，如：本场 GMV 是多少？"
              rows={1}
              className="flex-1 bg-transparent text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none resize-none leading-relaxed max-h-32 overflow-y-auto"
              style={{ minHeight: '20px' }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className={cn(
                'p-2 rounded-xl transition-all flex-shrink-0',
                input.trim() && !isTyping
                  ? 'bg-orbit-primary text-white hover:bg-orbit-primary-light shadow-sm shadow-orbit-primary/30'
                  : 'bg-orbit-surface3 text-[var(--text-primary)]'
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-primary)] text-center mt-2 hidden sm:block">
            按 <kbd className="px-1 py-0.5 bg-orbit-surface3 rounded text-[var(--text-muted)] text-[10px]">Enter</kbd> 发送，{' '}
            <kbd className="px-1 py-0.5 bg-orbit-surface3 rounded text-[var(--text-muted)] text-[10px]">Shift+Enter</kbd> 换行
          </p>
        </div>

        {/* 报告弹窗：经营日报 / 巡检记录（最新在上） */}
        {reportPanel && (
          <div className="fixed inset-0 z-[60] flex justify-center items-start p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setReportPanel(null)} />
            <div className="relative z-10 w-full max-w-3xl max-h-[85vh] flex flex-col bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-orbit-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  {reportPanel === 'daily'
                    ? <FileText className="w-4 h-4 text-orbit-primary-light" />
                    : <ShieldAlert className="w-4 h-4 text-orbit-primary-light" />}
                  <h3 className="text-base font-semibold text-[var(--text-secondary)]">
                    {reportPanel === 'daily' ? '经营日报' : '巡检记录'}
                  </h3>
                  <span className="text-xs text-[var(--text-muted)]">共 {reportList.length} 条 · 最新在上</span>
                </div>
                <button
                  onClick={() => setReportPanel(null)}
                  className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {reportListLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-12 rounded-lg bg-[var(--hover-bg3)] animate-pulse" />
                    ))}
                  </div>
                ) : reportList.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)] text-center py-10">暂无记录</p>
                ) : (
                  reportList.map((rec) => (
                    <InfoModule
                      key={`${rec.title}-${rec.createdAt}`}
                      title={rec.date || '记录'}
                      date={rec.createdAt ? new Date(rec.createdAt).toLocaleString() : undefined}
                      loading={false}
                      content={rec.content}
                      emptyLabel="无内容"
                      Icon={reportPanel === 'daily' ? FileText : ShieldAlert}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
