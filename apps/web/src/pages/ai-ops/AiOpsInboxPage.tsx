import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from '@/utils/toast'
import { fetchPendingApprovals, decideApproval, type PendingApprovalItem } from '@/services/ai-ops-data'

type TaskState = PendingApprovalItem & { decided?: 'approved' | 'rejected' }

export function AiOpsInboxPage() {
  const [tasks, setTasks] = useState<TaskState[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchPendingApprovals()
      .then((res) => setTasks(res))
      .catch(() => toast.error('待办审批列表加载失败，请稍后重试'))
      .finally(() => setLoading(false))
  }, [])

  const handleDecision = async (task: TaskState, decision: 'approve' | 'reject') => {
    const ok = await decideApproval(task.caseId, decision)
    if (!ok) {
      toast.error(`决策案 ${task.caseNo} 提交失败，请稍后重试`)
      return
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, decided: decision === 'approve' ? 'approved' : 'rejected' } : t)),
    )
    if (decision === 'approve') toast.success(`决策案 ${task.caseNo} 已批准，可继续执行并入库度量。`)
    else toast.info(`决策案 ${task.caseNo} 已驳回。`)
  }

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 1 · 待办中心
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">决策案审批 · 影响金额取自预期影响</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            统一待办审批收件箱 (/inbox)
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            每天唯一必须打开的页面。带真实影响金额、风险级次与一键拍板流。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-status-ai">
          <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-10 rounded-2xl border border-[var(--border)] bg-orbit-ink/60 text-center text-sm text-[var(--text-muted)]">
          暂无待审批决策案。复盘生成的决策案会进入这里。
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((t) => (
            <div key={t.id} className="p-5 rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80">{t.caseNo}</span>
                  <span className="text-sm font-bold text-white">{t.type}</span>
                  <span className="text-[11px] font-bold text-status-warning border border-orbit-warning/30 bg-orbit-warning/10 px-2 py-0.5 rounded">
                    {t.riskLevel}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{t.source}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  涉及影响金额：
                  <strong className="text-status-ai font-mono">
                    {t.impactGmv != null ? `¥${t.impactGmv.toLocaleString()}` : '未量化'}
                  </strong>
                  <span className="ml-2 text-[var(--text-subtle)]">{t.impactNote}</span>
                  {' · '}审批角色：{t.approver} · 度量日：{t.deadline}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {t.decided === 'approved' ? (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-status-success bg-orbit-success/10 border border-orbit-success/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>已批准通过</span>
                  </span>
                ) : t.decided === 'rejected' ? (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-status-danger bg-orbit-danger/10 border border-orbit-danger/20 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>已驳回</span>
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleDecision(t, 'reject')}
                      className="px-4 py-1.5 rounded-lg border border-[var(--border)] hover:bg-orbit-ink text-xs font-semibold text-[var(--text-secondary)] transition-colors"
                    >
                      驳回
                    </button>
                    <button
                      onClick={() => handleDecision(t, 'approve')}
                      className="px-4 py-1.5 rounded-lg bg-orbit-success hover:bg-orbit-success text-white text-xs font-bold shadow-md shadow-cyan-900/30 transition-all"
                    >
                      一键审批通过
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
