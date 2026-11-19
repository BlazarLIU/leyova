import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from '@/utils/toast'
import { fetchPendingApprovals, decideApproval, type PendingApprovalItem } from '@/services/ai-ops-data'

export function AiOpsInboxPage() {
  const [tasks, setTasks] = useState<Array<{
    id: string
    toolLogId?: number
    type: string
    source: string
    impactGmv: string
    deadline: string
    approver: string
    status?: 'pending' | 'approved' | 'rejected'
  }>>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchPendingApprovals().then((res: PendingApprovalItem[]) => {
      if (res && res.length > 0) {
        const mapped = res.map((r, i) => ({
          id: `TASK-APP-${r.toolLogId || i + 1}`,
          toolLogId: r.toolLogId,
          type: r.toolName ? `AI 工具【${r.toolName}】高危操作人审` : 'AI 自动化审批',
          source: r.resultSummary || '系统自动流转',
          impactGmv: r.riskLevel === 'R3' ? '¥85,000' : '¥32,000',
          deadline: r.expiresAt ? new Date(r.expiresAt).toLocaleTimeString() : '今日有效',
          approver: '运营负责人 / 超管',
          status: 'pending' as const,
        }))
        setTasks(mapped)
      } else {
        setTasks([])
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
      toast.error('待办审批列表加载失败，请稍后重试')
    })
  }, [])

  const handleDecision = async (id: string, toolLogId: number | undefined, decision: 'approve' | 'reject') => {
    if (!toolLogId) {
      toast.error(`审批单 ${id} 缺少关联记录，无法执行`)
      return
    }
    const ok = await decideApproval(toolLogId, decision)
    if (!ok) {
      toast.error(`审批单 ${id} 提交失败，请稍后重试`)
      return
    }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: decision === 'approve' ? 'approved' : 'rejected' } : t))
    if (decision === 'approve') {
      toast.success(`审批单 ${id} 已批准，写操作已进入执行队列。`)
    } else {
      toast.info(`审批单 ${id} 已驳回，流程已终止。`)
    }
  }

  return (
    <div className="flex-1 bg-[#0b0f19] text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              工作面 1 · 待办中心
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">整合 Artifact 审批 + SOP 人工任务 + 预警确认</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            统一待办审批收件箱 (/inbox)
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            每天唯一必须打开的页面。带影响金额、审批级次与一键拍板流。
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {tasks.map((t) => (
          <div key={t.id} className="p-5 rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80">{t.id}</span>
                <span className="text-sm font-bold text-white">{t.type}</span>
                <span className="text-xs text-[var(--text-muted)] font-medium">({t.source})</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                涉及影响金额：<strong className="text-cyan-400 font-mono">{t.impactGmv}</strong> · 审批角色：{t.approver} · 截止：{t.deadline}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {t.status === 'approved' ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>已批准通过</span>
                </span>
              ) : t.status === 'rejected' ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>已驳回</span>
                </span>
              ) : (
                <>
                  <button
                    onClick={() => handleDecision(t.id, t.toolLogId, 'reject')}
                    className="px-4 py-1.5 rounded-lg border border-[var(--border)] hover:bg-orbit-ink text-xs font-semibold text-[var(--text-secondary)] transition-colors"
                  >
                    驳回
                  </button>
                  <button
                    onClick={() => handleDecision(t.id, t.toolLogId, 'approve')}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition-all"
                  >
                    一键审批通过
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
