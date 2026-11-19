import React, { useState, useEffect, useRef } from 'react'
import { Search, Sparkles, ArrowRight, X, FileText } from 'lucide-react'

interface SearchItem {
  id: string
  title: string
  category: string
  url: string
  keywords: string[]
}

const SEARCH_DIRECTORY: SearchItem[] = [
  { id: 'cockpit', title: '运营驾驶舱 (业绩排行榜/净利)', category: '总览', url: '/overview/cockpit', keywords: ['驾驶舱', '排行', '总览', '大盘', 'gmv'] },
  { id: 'selection', title: 'AI 全品类选品与排盘', category: '运营工具', url: '/ai-ops/assortment/selection', keywords: ['选品', '排盘', '多因子', '品类', '热度'] },
  { id: 'schedule', title: 'AI 智能排班建议', category: '主播赋能', url: '/ai-ops/people/schedule-recommend', keywords: ['排班', '主播', '调度', '时段', '早场', '晚场'] },
  { id: 'omni', title: '全渠道跨平台大盘', category: '业务大盘', url: '/omnichannel/dashboard', keywords: ['全渠道', '多平台', '微信', '淘宝', '快手', '抖音'] },
  { id: 'chat', title: 'AI 助手 (Agentic BI)', category: 'AI 赋能', url: '/ai-ops/chat', keywords: ['ai', '助手', '问答', '归因', '波动', '预测'] },
  { id: 'anchors', title: '主播能力与表现矩阵', category: '主播赋能', url: '/anchors/list', keywords: ['主播', '能力', '评分', '达人'] },
]

export const GlobalSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 快捷键 Cmd/Ctrl + K 监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  const filteredItems = query.trim()
    ? SEARCH_DIRECTORY.filter((it) => {
        const q = query.toLowerCase()
        return (
          it.title.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q) ||
          it.keywords.some((k) => k.toLowerCase().includes(q))
        )
      })
    : SEARCH_DIRECTORY.slice(0, 6)

  const handleSelect = (url: string) => {
    setIsOpen(false)
    window.location.href = url
  }

  const handleAskAi = () => {
    setIsOpen(false)
    window.location.href = `/ai/chat?q=${encodeURIComponent(query)}`
  }

  return (
    <>
      {/* 触发搜索栏小组件（嵌入 Topbar） */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-10 w-full items-center gap-2.5 rounded-full border border-transparent bg-[var(--surface2)] px-4 text-[12.5px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface3)] hover:text-[var(--text-secondary)]"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">搜索页面、数据或向 AI 提问...</span>
        <span className="truncate sm:hidden">搜索...</span>
        <kbd className="ml-auto hidden shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-subtle)] sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      {/* 搜索模态框 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-orbit-ink/45 p-4 pt-20 backdrop-blur-[2px]">
          <div className="w-full max-w-xl overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_-24px_rgba(23,23,23,0.4)]">
            {/* 搜索输入框 */}
            <div className="flex items-center gap-3 border-b border-[var(--border)] p-4">
              <Search className="h-[18px] w-[18px] shrink-0 text-[var(--text-subtle)]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="输入功能名称、页面关键词，或直接向 AI 提问..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                }}
                className="w-full bg-transparent text-[13.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-subtle)]"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-[8px] p-1 text-[var(--text-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* AI 快捷提问项 —— 荧光绿仅用于 AI 语义 */}
            {query.trim() && (
              <div
                onClick={handleAskAi}
                className="flex cursor-pointer items-center justify-between border-b border-[var(--border)] bg-orbit-accent/25 px-4 py-3 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-orbit-accent/35"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orbit-accent-deep" />
                  <span>
                    向 <strong>AI 助手</strong>提问：<span className="font-semibold">“{query}”</span>
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </div>
            )}

            {/* 匹配结果列表 */}
            <div className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto p-2 text-[12.5px]">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-[var(--text-muted)]">
                  没有找到匹配的模块或数据，可直接点击上方呼出 AI 分析
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.url)}
                    className="group flex cursor-pointer items-center justify-between rounded-[10px] p-3 transition-colors hover:bg-[var(--hover-bg)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-[9px] bg-[var(--surface2)] p-2 text-[var(--text-muted)] transition-colors group-hover:bg-orbit-primary group-hover:text-white">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-subtle)]">{item.category}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-subtle)] transition-colors group-hover:text-orbit-primary" />
                  </div>
                ))
              )}
            </div>

            {/* 底部快捷键提示 */}
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface2)] px-4 py-2.5 text-[11px] text-[var(--text-subtle)]">
              <div className="flex items-center gap-3">
                <span>按 <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[var(--text-muted)]">ESC</kbd> 退出</span>
                <span>按 <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[var(--text-muted)]">Enter</kbd> 跳转</span>
              </div>
              <span>全平台电商与 MCN 代运营系统</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
