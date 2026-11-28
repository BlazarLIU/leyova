import { useState, useEffect } from 'react'
import { Clock, Play, Pause, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAiOpsSession } from '@/contexts/AiOpsSessionContext'
import { fetchSessionPlanningSlots, type SessionSlotItem } from '@/services/ai-ops-data'

export function AiOpsPrompterPage() {
  const { selectedSessionId, currentSession } = useAiOpsSession()
  const [slots, setSlots] = useState<SessionSlotItem[]>([])
  const [activeSlotSeq, setActiveSlotSeq] = useState(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchSessionPlanningSlots(selectedSessionId).then((res) => {
      setSlots(res)
      setActiveSlotSeq(1)
      setLoading(false)
    })
  }, [selectedSessionId])

  const current = slots.find(s => s.seq === activeSlotSeq) || slots[0] || {
    seq: 1,
    skuId: 'SKU-NONE',
    skuTitle: '暂无排品',
    roleLabel: '未设定',
    minutes: 10,
    hook: '请在货盘排品表中添加本场主推商品',
    cue: '中控等待上架',
    price: 0,
  }

  const handleNextSlot = () => {
    if (slots.length === 0) return
    const nextSeq = activeSlotSeq < slots.length ? activeSlotSeq + 1 : 1
    setActiveSlotSeq(nextSeq)
  }

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 2 · 场次台
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Session #{selectedSessionId} · {currentSession?.title || '现场大字提词'}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            现场提词卡与时点指令
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            主播大字卡、口播话术机制提醒与后台中控指令严格同步，杜绝错漏执行。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
              isPlaying ? "bg-orbit-warning/20 text-status-warning border border-orbit-warning/30" : "bg-orbit-success/20 text-status-success border border-orbit-success/30"
            )}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? '暂停节奏计时' : '继续开播推进'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12 text-status-ai">
          <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        /* 提词大字卡 */
        <div className="rounded-3xl border border-orbit-accent/30 bg-gradient-to-br from-orbit-ink via-orbit-ink to-orbit-accent/15 p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-orbit-danger animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-status-ai">
                当前讲解：第 {current.seq} 品 · {current.roleLabel}
              </span>
            </div>
            <span className="font-mono text-2xl font-black text-status-warning">
              05:24 / 0{current.minutes || 8}:00
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            {current.skuTitle}
          </h2>

          <div className="p-5 rounded-2xl bg-black/40 border border-orbit-success/30 mb-6">
            <span className="text-xs font-bold text-status-ai uppercase tracking-widest block mb-1">🔥 核心逼单钩子 & 机制话术：</span>
            <p className="text-lg sm:text-2xl font-bold text-status-warning leading-snug">
              "{current.hook || current.mechanism || '限时直播秒杀，现场加赠专享福利！'}"
            </p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-orbit-ink/80 border border-[var(--border)] text-xs">
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <Clock className="w-4 h-4 text-status-ai" />
              <span>中控即时指令：<strong className="text-white">{current.cue || '中控上架链接并弹窗提醒'}</strong></span>
            </div>
            <button
              onClick={handleNextSlot}
              className="px-4 py-1.5 rounded-lg bg-orbit-success hover:bg-orbit-success text-white font-medium flex items-center gap-1"
            >
              <span>切入下一品 ({activeSlotSeq < slots.length ? activeSlotSeq + 1 : 1}/{slots.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
