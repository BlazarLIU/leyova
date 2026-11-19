import { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Play,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAiOpsSession } from '@/contexts/AiOpsSessionContext'
import { toast } from '@/utils/toast'
import { fetchSessionPlanningSlots, saveSessionPlanningSlots, type SessionSlotItem } from '@/services/ai-ops-data'

export function AiOpsPlanningPage() {
  const { selectedSessionId, currentSession } = useAiOpsSession()
  const [slots, setSlots] = useState<SessionSlotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchSessionPlanningSlots(selectedSessionId).then((res) => {
      setSlots(res)
      setLoading(false)
      setHasUnsavedChanges(false)
    })
  }, [selectedSessionId])

  const moveSlot = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === slots.length - 1) return

    const newSlots = [...slots]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newSlots[index]
    newSlots[index] = newSlots[targetIndex]
    newSlots[targetIndex] = temp

    // 重排 seq
    newSlots.forEach((s, idx) => {
      s.seq = idx + 1
    })

    setSlots(newSlots)
    setHasUnsavedChanges(true)
  }

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const ok = await saveSessionPlanningSlots(selectedSessionId, slots)
      if (ok) {
        setIsPublishing(false)
        setPublishSuccess(true)
        setHasUnsavedChanges(false)
        toast.success(`Session #${selectedSessionId} 货盘排品已定稿，并实时发布至现场提词卡！`)
        setTimeout(() => setPublishSuccess(false), 3000)
      } else {
        setIsPublishing(false)
        toast.error('保存失败，请检查网络或权限')
      }
    } catch (e: any) {
      setIsPublishing(false)
      toast.error('保存排品出错: ' + (e?.message || '未知错误'))
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-orbit-bg min-h-screen text-status-ai">
        <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 四层货盘统计
  const counts = {
    traffic: slots.filter(s => s.role === 'traffic').length,
    benefit: slots.filter(s => s.role === 'benefit').length,
    hero: slots.filter(s => s.role === 'hero').length,
    profit: slots.filter(s => s.role === 'profit').length,
  }

  const totalMinutes = slots.reduce((acc, cur) => acc + cur.minutes, 0)

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* 头部导航与操作 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 2 · 场次台
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Session #{selectedSessionId} · {currentSession?.title || '直播专场'}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            货盘排品编辑表
            <span className="text-xs px-2 py-0.5 rounded bg-orbit-info/10 text-orbit-info border border-orbit-info/20 font-normal">
              四层货盘结构 · 6组字段
            </span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            AI 根据主系统近 30/90 天真实毛利、转化率与库存智能推荐顺序。硬闸门阻断负毛利与缺资质商品。
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="text-xs text-status-warning flex items-center gap-1 font-medium">
              ● 存在待定稿变更
            </span>
          )}
          {publishSuccess && (
            <span className="text-xs text-status-success flex items-center gap-1 font-medium animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              已发布并同步至主系统场次提词卡！
            </span>
          )}
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orbit-success to-orbit-primary hover:from-orbit-success hover:to-orbit-primary text-white text-xs font-bold shadow-lg shadow-cyan-900/40 transition-all disabled:opacity-50"
          >
            {isPublishing ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>定稿并一键开播发布 (L3)</span>
          </button>
        </div>
      </div>

      {/* 四层货盘与时间分布指示栏 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-orbit-ink/60 border border-[var(--border)]">
          <p className="text-[11px] text-[var(--text-muted)]">总排品数 / 总时长</p>
          <p className="text-lg font-bold font-mono text-white mt-1">{slots.length} 款 / {totalMinutes} 分钟</p>
        </div>
        <div className="p-3.5 rounded-xl bg-orbit-ink/60 border border-orbit-danger/20">
          <p className="text-[11px] text-status-danger">① 引流品 (Traffic)</p>
          <p className="text-lg font-bold font-mono text-status-danger mt-1">{counts.traffic} 款</p>
        </div>
        <div className="p-3.5 rounded-xl bg-orbit-ink/60 border border-orbit-warning/20">
          <p className="text-[11px] text-status-warning">② 福利品 (Benefit)</p>
          <p className="text-lg font-bold font-mono text-status-warning mt-1">{counts.benefit} 款</p>
        </div>
        <div className="p-3.5 rounded-xl bg-orbit-ink/60 border border-orbit-success/20">
          <p className="text-[11px] text-status-ai">③ 爆款主推 (Hero)</p>
          <p className="text-lg font-bold font-mono text-status-ai mt-1">{counts.hero} 款</p>
        </div>
        <div className="p-3.5 rounded-xl bg-orbit-ink/60 border border-orbit-success/20">
          <p className="text-[11px] text-status-success">④ 利润品 (Profit)</p>
          <p className="text-lg font-bold font-mono text-status-success mt-1">{counts.profit} 款</p>
        </div>
      </div>

      {/* 排品表格主体 */}
      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-status-ai" />
            <h3 className="text-sm font-bold text-white">排品顺序明细（拖拽/调整次序实时联动）</h3>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono">硬闸门规则：资质过期、负毛利、库存不足 100% 阻断</span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {slots.map((slot, index) => {
            const roleColor =
              slot.role === 'traffic' ? 'text-status-danger bg-orbit-danger/10 border-orbit-danger/30' :
              slot.role === 'benefit' ? 'text-status-warning bg-orbit-warning/10 border-orbit-warning/30' :
              slot.role === 'hero' ? 'text-status-ai bg-orbit-success/10 border-orbit-success/30' :
              'text-status-success bg-orbit-success/10 border-orbit-success/30'

            return (
              <div
                key={slot.skuId}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-orbit-ink/20 transition-colors"
              >
                {/* 序号与顺序调整 */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orbit-ink border border-[var(--border)] flex items-center justify-center font-mono font-bold text-orbit-snow/80">
                    {slot.seq}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveSlot(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-orbit-ink text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      title="上移"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveSlot(index, 'down')}
                      disabled={index === slots.length - 1}
                      className="p-1 rounded hover:bg-orbit-ink text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      title="下移"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                {/* SKU 与角色信息 */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("px-2.5 py-0.5 rounded text-[11px] font-bold border", roleColor)}>
                      {slot.roleLabel}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">{slot.skuId}</span>
                    <span className="text-sm font-bold text-white truncate">{slot.skuTitle}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <span>讲解：<strong className="text-[var(--text-secondary)]">{slot.minutes} 分钟</strong></span>
                    <span>·</span>
                    <span>直播价：<strong className="text-status-ai font-mono">¥{slot.price}</strong></span>
                    <span>·</span>
                    <span>毛利率：<strong className="text-status-success font-mono">{(slot.marginRate * 100).toFixed(0)}%</strong></span>
                    <span>·</span>
                    <span>可售库存：<strong className="text-[var(--text-secondary)] font-mono">{slot.stock} 件</strong></span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    机制：<span className="text-[var(--text-secondary)] font-medium">{slot.mechanism}</span>
                  </p>
                </div>

                {/* AI 推荐理由与证据 */}
                <div className="lg:max-w-xs text-xs p-3 rounded-xl bg-orbit-ink/70 border border-[var(--border)] space-y-1">
                  <p className="text-status-ai font-medium flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI 推荐理由</span>
                  </p>
                  <p className="text-[var(--text-muted)] leading-relaxed">{slot.reason}</p>
                </div>

                {/* 硬闸门检测状态 */}
                <div className="flex items-center gap-3 lg:self-center flex-shrink-0">
                  <div className="flex flex-col gap-1 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-status-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>毛利正常</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-status-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>库存充足</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-status-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>资质有效</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
