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
      <div className={cn('flex items-center gap-2 rounded-[10px] border border-orbit-border bg-orbit-surface2 px-3 py-1.5 text-xs text-[var(--text-muted)]', className)}>
        <span className="h-2 w-2 animate-ping rounded-full bg-orbit-primary" />
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
    <div className={cn('relative inline-block text-left', className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-[10px] border border-orbit-border bg-orbit-surface px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-orbit-border2 hover:bg-orbit-surface2"
      >
        <span className="flex items-center gap-1.5">
          {currentSession?.status === 'live' ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orbit-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orbit-primary" />
            </span>
          ) : currentSession?.status === 'scheduled' ? (
            <span className="inline-flex h-2 w-2 rounded-full bg-orbit-info" />
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-orbit-border2" />
          )}
          <span className="font-mono font-bold text-orbit-primary dark:text-orbit-primary-light">
            #{currentSession?.id || '—'}
          </span>
        </span>

        <div className="flex max-w-[160px] flex-col text-left sm:max-w-[220px]">
          <span className="truncate text-[11px] font-semibold leading-tight text-[var(--text-primary)]">
            {currentSession?.title || '未选定场次'}
          </span>
          <span className="truncate text-[10px] text-[var(--text-muted)]">
            {currentSession?.roomName} · {currentSession?.anchorName}
          </span>
        </div>

        <ChevronDown className={cn('ml-0.5 h-3.5 w-3.5 text-[var(--text-subtle)] transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-[14px] border border-orbit-border bg-orbit-surface p-3 shadow-[0_24px_60px_-24px_rgba(23,23,23,0.4)] sm:left-0 sm:right-auto sm:w-96">
          <div className="mb-2 flex items-center justify-between border-b border-orbit-border pb-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Radio className="h-3.5 w-3.5 text-orbit-primary" />
              <span>选择全系统贯穿场次 (Session)</span>
            </span>
            <span className="font-mono text-[10px] text-[var(--text-subtle)]">共 {sessionList.length} 场历史记录</span>
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-subtle)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索场次 ID、直播间、主播..."
              className="w-full rounded-[9px] border border-orbit-border bg-orbit-surface2 py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:border-orbit-primary/50 focus:outline-none"
            />
          </div>

          <div className="max-h-64 divide-y divide-orbit-border/60 space-y-1 overflow-y-auto pr-1">
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
                    'flex w-full items-center justify-between gap-2 rounded-[10px] p-2.5 pt-2 text-left text-xs transition-colors',
                    isSelected
                      ? 'border border-orbit-primary/30 bg-orbit-primary/[0.08] font-medium text-orbit-primary dark:text-orbit-primary-light'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-orbit-primary dark:text-orbit-primary-light">#{sess.id}</span>
                      <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">{sess.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                      <span>{sess.roomName}</span>
                      <span>•</span>
                      <span>主播: {sess.anchorName}</span>
                      <span>•</span>
                      <span>{sess.date}</span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right">
                    <span
                      className={cn(
                        'rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase',
                        sess.status === 'live'
                          ? 'border border-orbit-danger/25 bg-orbit-danger/10 text-orbit-danger'
                          : sess.status === 'scheduled'
                          ? 'border border-orbit-info/25 bg-orbit-info/10 text-orbit-info'
                          : 'bg-orbit-surface3 text-[var(--text-muted)]'
                      )}
                    >
                      {sess.status === 'live' ? '正在直播' : sess.status === 'scheduled' ? '计划开播' : '已完播'}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-orbit-primary" />}
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
