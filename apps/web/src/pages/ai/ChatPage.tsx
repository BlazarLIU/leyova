import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, ChevronDown,
  Copy, ThumbsUp, ThumbsDown, RefreshCw, Paperclip,
  Plus, Search, MessageSquare, Menu, X, Trash2,
  Brain, ListTodo, Users, Wrench, FileText, ShieldAlert,
} from 'lucide-react'
import { api, ApiError } from '@/services/api'
import { Avatar } from '@/components/ui'
import { cn } from '@/utils/cn'
import type { ChatMessage, Conversation } from '@/types'

const suggestions = [
  '查一下现在的整体 GMV',
  '主播业绩排行',
  '渠道投放效果分析',
  '查看待处理异常预警',
  '互动留存数据分析',
]

const models = ['claude-sonnet-4-6', 'claude-opus-4-8', 'gpt-4o'] as const
type Model = typeof models[number]

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<p key={i} className="font-semibold text-slate-100 mt-3 mb-1">{line.slice(2, -2)}</p>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="ml-4 text-slate-300 list-disc marker:text-orbit-primary">
          {formatInline(line.slice(2))}
        </li>
      )
    } else if (line.startsWith('| ') && line.includes('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].match(/^\|[-| :]+\|$/)) {
          rows.push(lines[i].split('|').filter(Boolean).map(c => c.trim()))
        }
        i++
      }
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-2 rounded-lg border border-orbit-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-orbit-border bg-orbit-surface2">
                {rows[0]?.map((h, j) => (
                  <th key={j} className="px-3 py-2 text-left font-semibold text-slate-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, j) => (
                <tr key={j} className="border-b border-orbit-border last:border-0 hover:bg-white/2">
                  {row.map((cell, k) => (
                    <td key={k} className="px-3 py-2 text-slate-400">{formatInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />)
    } else {
      elements.push(<p key={i} className="text-slate-300 leading-relaxed">{formatInline(line)}</p>)
    }
    i++
  }

  return <div className="text-sm space-y-0.5">{elements}</div>
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-slate-100">{part.slice(2, -2)}</strong>
      : part
  )
}

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
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {date && <span className="text-[11px] text-slate-500">· {date}</span>}
      </div>
      <div className="border-t border-orbit-border pt-3">
        {loading ? (
          <div className="space-y-2 py-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-3 rounded bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : content ? (
          <MarkdownMessage content={content} />
        ) : (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
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
      'group relative w-full text-left px-4 py-3 transition-colors hover:bg-white/5 border-b border-orbit-border/50 cursor-pointer',
      isActive && 'bg-orbit-primary/10 border-l-2 border-l-orbit-primary'
    )} onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className={cn(
            'w-4 h-4 flex-shrink-0',
            isActive ? 'text-orbit-primary-light' : 'text-slate-600'
          )} />
          <span className={cn(
            'text-sm truncate',
            isActive ? 'text-slate-100 font-semibold' : 'text-slate-300'
          )}>
            {conv.title}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-slate-600">{conv.timestamp}</span>
          {conv.unread && <span className="w-2 h-2 rounded-full bg-orbit-primary flex-shrink-0" />}
        </div>
      </div>
      {conv.ownerName && (
        <p className="text-[11px] text-orbit-accent-light font-medium mt-1 truncate pl-6">
          @{conv.ownerName}
        </p>
      )}
      <p className="text-[12px] text-slate-500 mt-1 truncate pl-6">{conv.lastMessage}</p>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
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
  const [model, setModel] = useState<Model>('claude-sonnet-4-6')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showConvList, setShowConvList] = useState(false)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // DeerFlow run 开关：深度思考 / 计划模式 / 子代理
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [planMode, setPlanMode] = useState(false)
  const [subagentEnabled, setSubagentEnabled] = useState(false)
  // 本轮流式过程中的工具调用指示条
  const [activeTools, setActiveTools] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

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
      const response = await api.streamPost('/api/ai/chat/stream', {
        message: content,
        conversationId: selectedConvId,
        thinkingEnabled,
        planMode,
        subagentEnabled,
      })

      if (!response.ok || !response.body) {
        throw new ApiError(`HTTP ${response.status}`, response.status)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullReply = ''
      let nextConversationId = selectedConvId
      let done = false

      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''

        for (const chunk of chunks) {
          const line = chunk.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          const payload = line.slice(6).trim()
          if (!payload) continue

          try {
            const data = JSON.parse(payload) as
              | { type: 'conversation'; conversationId: string }
              | { type: 'token'; content: string }
              | { type: 'tool_call'; tool: string }
              | { type: 'done'; provider: string; conversationId: string }
              | { type: 'error'; message: string }

            if (data.type === 'conversation') {
              nextConversationId = data.conversationId
              setSelectedConvId(data.conversationId)
            } else if (data.type === 'token') {
              fullReply += data.content
              upsertAssistantMessage(fullReply)
            } else if (data.type === 'tool_call') {
              // 工具调用指示条（去重累积）
              setActiveTools(prev => prev.includes(data.tool) ? prev : [...prev, data.tool])
            } else if (data.type === 'done') {
              nextConversationId = data.conversationId
              if (fullReply) {
                upsertAssistantMessage(fullReply)
                finalizeAssistantMessage()
              }
              setActiveTools([])
            } else if (data.type === 'error') {
              setActiveTools([])
              throw new Error(data.message)
            }
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }

      if (!fullReply) {
        throw new Error('Empty reply')
      }

      if (nextConversationId && nextConversationId !== selectedConvId) {
        setSelectedConvId(nextConversationId)
      }

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
    <div className="flex flex-1 overflow-hidden bg-orbit-bg">
      <div className="w-72 border-r border-orbit-border flex-shrink-0 hidden md:flex flex-col bg-orbit-surface">
        <div className="h-14 border-b border-orbit-border px-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-200">历史会话</h2>
          <button onClick={handleNewChat} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <input placeholder="搜索会话..." className="flex-1 bg-transparent text-slate-300 placeholder-slate-600 outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-xs text-slate-500">
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
                    'w-full text-left px-4 py-3 transition-colors hover:bg-white/5 rounded-lg border-b border-orbit-border/50',
                    !selectedConvId && 'bg-orbit-primary/10 border-l-2 border-l-orbit-primary rounded-none'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-orbit-primary-light" />
                    <span className={cn('text-sm', !selectedConvId ? 'text-slate-100 font-semibold' : 'text-slate-300')}>
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
                <h2 className="text-sm font-semibold text-slate-200">历史会话</h2>
                <button onClick={() => setShowConvList(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs">
                  <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <input placeholder="搜索会话..." className="flex-1 bg-transparent text-slate-300 placeholder-slate-600 outline-none" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="px-2 py-1">
                  <button onClick={handleNewChat} className="w-full text-left px-4 py-3 transition-colors hover:bg-white/5 rounded-lg text-sm text-slate-300 flex items-center gap-2">
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="h-14 border-b border-orbit-border px-4 flex items-center gap-3 bg-orbit-surface/60 backdrop-blur-xl flex-shrink-0">
          <button onClick={() => setShowConvList(true)} className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors">
            <Menu className="w-4 h-4" />
          </button>

          <div className="w-7 h-7 rounded-lg bg-orbit-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-orbit-primary-light" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{currentConvName}</p>
            <p className="text-[11px] text-slate-500 hidden sm:block">leyova 直播电商 AI 运营助手</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* 报告查看：日报 / 巡检（点击弹窗展示全部记录，最新在上） */}
            <button
              onClick={() => openReportPanel('daily')}
              title="查看全部经营日报"
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors bg-orbit-surface2 border-orbit-border text-slate-500 hover:text-slate-300"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">日报</span>
            </button>
            <button
              onClick={() => openReportPanel('patrol')}
              title="查看全部巡检记录"
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors bg-orbit-surface2 border-orbit-border text-slate-500 hover:text-slate-300"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">巡检</span>
            </button>
            {/* DeerFlow run 开关：深度思考 / 计划模式 / 子代理 */}
            {[
              { label: '深度思考', Icon: Brain, active: thinkingEnabled, onToggle: () => setThinkingEnabled(v => !v) },
              { label: '计划模式', Icon: ListTodo, active: planMode, onToggle: () => setPlanMode(v => !v) },
              { label: '子代理', Icon: Users, active: subagentEnabled, onToggle: () => setSubagentEnabled(v => !v) },
            ].map(({ label, Icon, active, onToggle }) => (
              <button
                key={label}
                onClick={onToggle}
                title={label}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors',
                  active
                    ? 'bg-orbit-primary/15 border-orbit-primary/40 text-orbit-primary-light'
                    : 'bg-orbit-surface2 border-orbit-border text-slate-500 hover:text-slate-300'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
            <div className="relative">
              <button onClick={() => setShowModelPicker(o => !o)} className="hidden flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-orbit-surface2 px-2.5 py-1.5 rounded-lg border border-orbit-border transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-orbit-accent animate-pulse" />
                <span className="hidden sm:inline">{model}</span>
                <span className="sm:hidden">Model</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {showModelPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute right-0 top-full mt-1 bg-orbit-surface2 border border-orbit-border rounded-xl shadow-2xl z-50 overflow-hidden min-w-48">
                      {models.map(m => (
                        <button
                          key={m}
                          onClick={() => { setModel(m); setShowModelPicker(false) }}
                          className={cn('w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-white/5', m === model ? 'text-orbit-primary-light font-medium' : 'text-slate-400')}
                        >
                          {m}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orbit-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-orbit-primary-light" />
              </div>
              <h2 className="text-xl font-semibold text-slate-200 mb-2">leyova 直播电商 AI 运营助手</h2>
              <p className="text-sm text-slate-500 mb-8 max-w-md">您可以向我询问关于直播电商运营数据的任何问题，我将为您提供智能分析</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="text-left text-sm text-slate-400 bg-orbit-surface2 border border-orbit-border rounded-xl px-4 py-3 hover:bg-white/5 hover:text-slate-200 transition-colors"
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
                  <span className="text-[11px] text-slate-600">{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1">
                      {[Copy, ThumbsUp, ThumbsDown, RefreshCw].map((Icon, i) => (
                        <button key={i} className="p-1 text-slate-700 hover:text-slate-400 transition-colors rounded">
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
              <div className="flex items-center gap-2 bg-orbit-surface2 border border-orbit-border rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-slate-400">
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
            <button className="text-slate-500 hover:text-slate-300 transition-colors mb-0.5 hidden sm:block">
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
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed max-h-32 overflow-y-auto"
              style={{ minHeight: '20px' }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className={cn(
                'p-2 rounded-xl transition-all flex-shrink-0',
                input.trim() && !isTyping
                  ? 'bg-orbit-primary text-white hover:bg-orbit-primary-light shadow-sm shadow-orbit-primary/30'
                  : 'bg-orbit-surface3 text-slate-600'
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-700 text-center mt-2 hidden sm:block">
            按 <kbd className="px-1 py-0.5 bg-orbit-surface3 rounded text-slate-500 text-[10px]">Enter</kbd> 发送，{' '}
            <kbd className="px-1 py-0.5 bg-orbit-surface3 rounded text-slate-500 text-[10px]">Shift+Enter</kbd> 换行
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
                  <h3 className="text-base font-semibold text-slate-200">
                    {reportPanel === 'daily' ? '经营日报' : '巡检记录'}
                  </h3>
                  <span className="text-xs text-slate-500">共 {reportList.length} 条 · 最新在上</span>
                </div>
                <button
                  onClick={() => setReportPanel(null)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {reportListLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : reportList.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">暂无记录</p>
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
