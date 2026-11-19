import { useState, useEffect } from 'react'
import { UserCheck, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toast } from '@/utils/toast'
import { api } from '@/services/api'

interface SchedulePlanItem {
  id: string
  slotKey: string
  slotName: string
  trait: string
  recommendedAnchor: string
  supportAnchor?: string
  expectedGmv: number
  matchScore: number
  reason: string
  applied: boolean
}

export function AiOpsScheduleRecommendPage() {
  const [plans, setPlans] = useState<SchedulePlanItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadRecommendations = async (): Promise<boolean> => {
    setLoading(true)
    try {
      const res: any = await api.get('/schedule/recommendations')
      const schedule = res?.data?.schedule || res?.schedule || []
      if (Array.isArray(schedule) && schedule.length > 0) {
        setPlans(schedule.map((s: any, idx: number) => ({
          id: `REC-${s.slotKey.toUpperCase()}-${idx + 1}`,
          slotKey: s.slotKey,
          slotName: s.slotName,
          trait: s.trait,
          recommendedAnchor: `${s.leadAnchor?.name || '签约主播'} (主讲)`,
          supportAnchor: s.supportAnchor?.name ? `${s.supportAnchor.name} (助播)` : undefined,
          expectedGmv: s.expectedGmv || 0,
          matchScore: Math.round(s.leadAnchor?.score || 85),
          reason: s.aiReason || '根据主播人效模型与该时段货盘风格画像匹配。',
          applied: false,
        })))
      } else {
        setPlans([])
      }
      return true
    } catch {
      setPlans([])
      toast.error('排班推荐加载失败，请稍后重试')
      return false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecommendations()
  }, [])

  const handleApply = async (id: string, plan: SchedulePlanItem) => {
    try {
      await api.post('/schedule/apply-recommendation', {
        date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        slotKey: plan.slotKey,
        platformCode: 'douyin',
      })
    } catch (err) {
      toast.error(`采纳推荐方案失败：${(err as Error).message || '请稍后重试'}`)
      return
    }
    setPlans(prev => prev.map(p => p.id === id ? { ...p, applied: true } : p))
    toast.success(`已采纳推荐方案 ${id}，已同步至排班。`)
  }

  const handleRecalculate = async () => {
    const ok = await loadRecommendations()
    if (ok) toast.success('已根据最新主播绩效与场次动销重新运算排班推荐。')
  }

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 4 · 人效与排班
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">HRBP 与运营协同专区</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            AI 智能排班推荐
            <span className="text-xs px-2 py-0.5 rounded bg-orbit-success/10 text-status-success border border-orbit-success/20 font-normal">
              时段×货盘×主播 三维匹配
            </span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            根据场次规划货盘品类与历史时段承接数据，智能匹配最适主播并生成排班草案。
          </p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orbit-ink hover:bg-orbit-ink/85 border border-[var(--border)] text-xs font-semibold text-orbit-snow/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-status-ai", loading && "animate-spin")} />
          <span>重新运算排班推荐</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-status-ai">
          <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[var(--border)] bg-orbit-ink/60 text-orbit-snow/60">
          暂无排班推荐数据
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className={cn(
                "p-6 rounded-2xl border backdrop-blur-xl transition-all shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4",
                p.applied
                  ? "border-orbit-success/30 bg-orbit-success/15"
                  : "border-[var(--border)] bg-orbit-ink/60 hover:border-orbit-success/30"
              )}
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80">
                    {p.id}
                  </span>
                  <span className="text-sm font-bold text-white">{p.slotName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-success/10 text-status-ai border border-orbit-success/20 font-mono">
                    匹配度 {p.matchScore}%
                  </span>
                  {p.expectedGmv > 0 && (
                    <span className="text-xs font-mono text-status-success font-semibold">
                      预估产出: ¥{p.expectedGmv.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] font-medium">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-status-ai" />
                    <span>首发主讲：<strong className="text-white">{p.recommendedAnchor}</strong></span>
                  </div>
                  {p.supportAnchor && (
                    <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs">
                      <span>副播搭配：{p.supportAnchor}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-3xl">
                  {p.reason}
                </p>
              </div>

              <div className="flex-shrink-0">
                {p.applied ? (
                  <span className="px-4 py-2 rounded-xl text-xs font-semibold bg-orbit-success/10 text-status-success border border-orbit-success/30 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>已应用至主系统排班</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleApply(p.id, p)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orbit-success to-orbit-primary hover:from-orbit-success hover:to-orbit-primary text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition-all"
                  >
                    采纳并更新排班
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
