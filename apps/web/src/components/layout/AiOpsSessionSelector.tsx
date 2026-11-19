import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Radio, Check, Search } from 'lucide-react'
import { useAiOpsSession } from '@/contexts/AiOpsSessionContext'
import { cn } from '@/utils/cn'

export function AiOpsSessionSelector({ className }: { className?: string }) {
  const { currentSession, sessionList, selectedSessionId, selectSession, loading } = useAiOpsSession()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (loading && !currentSession) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400", className)}>
        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
        <span>加载场次数据...</span>
      </div>
    )
  }

  const filtered = sessionList.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.title.toLowerCase().includes(q) ||
      s.roomName.toLowerCase().includes(q) ||
      s.anchorName.toLowerCase().includes(q) ||
      String(s.id).includes(q)
    )
  })

  return (
    <div className={cn("relative inline-block text-left", className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-slate-900/80 hover:bg-slate-850 backdrop-blur-md text-xs transition-all shadow-md hover:border-cyan-500/50"
      >
        <span className="flex items-center gap-1.5">
          {currentSession?.status === 'live' ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
          ) : currentSession?.status === 'scheduled' ? (
            <span className="inline-flex rounded-full h-2 w-2 bg-blue-400" />
          ) : (
            <span className="inline-flex rounded-full h-2 w-2 bg-slate-500" />
          )}
          <span className="font-mono text-cyan-300 font-bold">#{currentSession?.id || '—'}</span>
        </span>

        <div className="flex flex-col text-left max-w-[160px] sm:max-w-[220px]">
          <span className="truncate text-slate-200 font-semibold text-[11px] leading-tight">
            {currentSession?.title || '未选定场次'}
          </span>
          <span className="text-[10px] text-slate-400 truncate">
            {currentSession?.roomName} · {currentSession?.anchorName}
          </span>
        </div>

        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ml-0.5", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 border border-slate-700/80 backdrop-blur-2xl shadow-2xl p-3 z-50 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>选择全系统贯穿场次 (Session)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">共 {sessionList.length} 场历史记录</span>
          </div>

          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索场次 ID、直播间、主播..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-800/40">
            {filtered.slice(0, 30).map((sess) => {
              const isSelected = sess.id === selectedSessionId
              return (
                <button
                  key={sess.id}
                  onClick={() => {
                    selectSession(sess.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all pt-2",
                    isSelected
                      ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 font-medium"
                      : "hover:bg-slate-800/60 text-slate-300"
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-cyan-400 text-[11px]">#{sess.id}</span>
                      <span className="font-medium text-white truncate text-[12px]">{sess.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{sess.roomName}</span>
                      <span>•</span>
                      <span>主播: {sess.anchorName}</span>
                      <span>•</span>
                      <span>{sess.date}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                        sess.status === 'live'
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : sess.status === 'scheduled'
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-slate-800 text-slate-400"
                      )}
                    >
                      {sess.status === 'live' ? '正在直播' : sess.status === 'scheduled' ? '计划开播' : '已完播'}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
