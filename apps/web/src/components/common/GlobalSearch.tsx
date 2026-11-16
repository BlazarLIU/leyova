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
  { id: 'weather', title: '天气 AI 穿搭与智能选品', category: 'AI 赋能', url: '/ai/weather', keywords: ['天气', '穿搭', '选品', '气象', '话术', '降温'] },
  { id: 'schedule', title: 'AI 智能排班建议', category: '主播赋能', url: '/anchors/schedule-recommend', keywords: ['排班', '主播', '调度', '时段', '早场', '晚场'] },
  { id: 'omni', title: '全渠道跨平台大盘', category: '业务大盘', url: '/omnichannel/dashboard', keywords: ['全渠道', '多平台', '京东', '拼多多', '淘宝', '快手', '抖音'] },
  { id: 'chat', title: 'AI 助手 (Agentic BI)', category: 'AI 赋能', url: '/ai/chat', keywords: ['ai', '助手', '问答', '归因', '波动', '预测'] },
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100/70 hover:bg-gray-100 text-gray-400 hover:text-gray-600 border border-gray-200/50 text-xs transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">全局搜索功能、数据或向 AI 提问...</span>
        <span className="inline sm:hidden">搜索...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 shadow-2xs">
          ⌘K
        </kbd>
      </button>

      {/* 搜索模态框 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden space-y-0">
            {/* 搜索输入框 */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="输入功能名称、页面关键词，或直接向 AI 提问..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                }}
                className="w-full text-sm outline-hidden text-gray-900 placeholder:text-gray-400"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI 快捷提问项 */}
            {query.trim() && (
              <div
                onClick={handleAskAi}
                className="p-3 bg-blue-50/60 hover:bg-blue-50 border-b border-blue-100 flex items-center justify-between cursor-pointer transition-colors text-xs text-blue-700"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>
                    向 <strong>AI 助手</strong>提问：<span className="font-semibold text-gray-900">"{query}"</span>
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
              </div>
            )}

            {/* 匹配结果列表 */}
            <div className="max-h-80 overflow-y-auto p-2 text-xs divide-y divide-gray-50">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  没有找到匹配的模块或数据，可直接点击上方呼出 AI 分析
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.url)}
                    className="p-3 rounded-xl hover:bg-gray-50 flex items-center justify-between cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-blue-50 text-gray-500 group-hover:text-blue-600 transition-colors">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-gray-400">{item.category}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                ))
              )}
            </div>

            {/* 底部快捷键提示 */}
            <div className="p-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
              <div className="flex items-center gap-3">
                <span>按 <kbd className="px-1 py-0.5 bg-white rounded border text-gray-600">ESC</kbd> 退出</span>
                <span>按 <kbd className="px-1 py-0.5 bg-white rounded border text-gray-600">Enter</kbd> 跳转</span>
              </div>
              <span>全平台电商与 MCN 代运营系统</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
