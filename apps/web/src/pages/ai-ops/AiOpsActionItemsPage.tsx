import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Check } from 'lucide-react'
import { toast } from '@/utils/toast'
import { fetchImprovementTasksList, updateImprovementTaskStatus, type ImprovementTaskItem } from '@/services/ai-ops-data'

export function AiOpsActionItemsPage() {
  const [items, setItems] = useState<ImprovementTaskItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchImprovementTasksList().then((res) => {
      setItems(res)
      setLoading(false)
    })
  }, [])

  const handleMarkVerified = async (item: ImprovementTaskItem) => {
    if (!item.numericId) {
      toast.error(`改进任务【${item.id}】缺少记录 ID，无法提交`)
      return
    }
    const ok = await updateImprovementTaskStatus(item.numericId, 'verified_pass')
    if (!ok) {
      toast.error(`改进任务【${item.id}】提交失败，请稍后重试`)
      return
    }
    setItems(prev => prev.map(t => t.id === item.id ? { ...t, status: 'verified_pass' } : t))
    toast.success(`改进任务【${item.id}】已提交闭环验收。`)
  }

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 2 · 场次闭环
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">反 ERP 判据第 3 条：有闭环</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            复盘行动项下场验证看板
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            动作做完不结束，下一场自动检验实际效果。行动项未闭环则阻断下场无责发布。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12 text-status-ai">
          <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <div key={it.id} className="p-5 rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80">
                    {it.id}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">源自：{it.sessionSource}</span>
                  <span className="text-xs font-bold text-status-ai">责任人：{it.owner}</span>
                </div>
                <p className="text-sm font-semibold text-white">{it.content}</p>
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-3">
                  <span>验收目标：<strong className="text-status-success font-mono">{it.target}</strong></span>
                  <span>·</span>
                  <span>验证场次：<strong className="text-status-ai">{it.nextSessionVerify}</strong></span>
                </p>
                {it.actualOutcome && (
                  <p className="text-xs text-status-success font-medium pt-1">
                    ✓ {it.actualOutcome}
                  </p>
                )}
              </div>

              <div className="flex-shrink-0 flex items-center gap-2">
                {it.status === 'verified_pass' ? (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orbit-success/10 text-status-success border border-orbit-success/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>已闭环验证达标</span>
                  </span>
                ) : (
                  <>
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orbit-warning/10 text-status-warning border border-orbit-warning/20 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>本场进行中待验证</span>
                    </span>
                    <button
                      onClick={() => handleMarkVerified(it)}
                      className="px-3 py-1.5 rounded-xl bg-orbit-ink hover:bg-orbit-success/15 text-orbit-snow/80 hover:text-status-success border border-[var(--border)] hover:border-orbit-success/40 text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Check className="w-3 h-3" />
                      <span>标记已闭环</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
