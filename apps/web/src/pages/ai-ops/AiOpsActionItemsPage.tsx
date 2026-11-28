import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Check, ListTodo, ArrowRight } from 'lucide-react'
import { toast } from '@/utils/toast'
import {
  fetchImprovementTasksList,
  updateImprovementTaskStatus,
  fetchDecisionCases,
  type ImprovementTaskItem,
  type DecisionCaseItem,
} from '@/services/ai-ops-data'

const TRACKING_STATUS: Record<string, string> = {
  EXECUTING: '执行中',
  AWAITING_REVIEW: '待复核',
  REVIEWED: '已复核',
  ARCHIVED: '已归档',
}

const TRACKING_SET = new Set(['EXECUTING', 'AWAITING_REVIEW', 'REVIEWED', 'ARCHIVED'])

export function AiOpsActionItemsPage() {
  const [items, setItems] = useState<ImprovementTaskItem[]>([])
  const [cases, setCases] = useState<DecisionCaseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchImprovementTasksList(), fetchDecisionCases('all')]).then(([res, caseRes]) => {
      setItems(res)
      setCases(caseRes.filter((c) => TRACKING_SET.has(c.status)))
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
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              治理 · 决策追踪 (Tracking)
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">反 ERP 判据第 3 条：有闭环</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            决策追踪与行动项验证
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            执行人、预期与实际、归因等级、金额状态全部取库内真实字段；行动项未闭环则阻断下场无责发布。
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-status-ai" />
            决策案追踪
          </h2>
          <a href="/ai-ops/governance/cases" className="text-[11.5px] font-semibold text-status-ai hover:underline flex items-center gap-1">
            进入调查与决策
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
        {cases.length === 0 ? (
          <div className="p-8 rounded-2xl border border-[var(--border)] bg-orbit-ink/60 text-center text-sm text-[var(--text-muted)]">
            暂无执行中 / 待复核 / 已归档的决策案
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-[var(--text-subtle)] border-b border-[var(--border)]">
                  <th className="px-4 py-2.5 font-semibold">决策案</th>
                  <th className="px-4 py-2.5 font-semibold">执行人</th>
                  <th className="px-4 py-2.5 font-semibold">预期</th>
                  <th className="px-4 py-2.5 font-semibold">实际</th>
                  <th className="px-4 py-2.5 font-semibold">归因等级</th>
                  <th className="px-4 py-2.5 font-semibold">金额状态</th>
                  <th className="px-4 py-2.5 font-semibold">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {cases.map((c) => {
                  const impact = c.expectedImpact || {}
                  const expected = impact.metricCode
                    ? `${impact.metricCode}: ${impact.from} → ${impact.to}${impact.unit || ''}`
                    : '未填写'
                  const actual = c.outcome?.actual != null
                    ? `${c.outcome.actual}（${c.outcome.samples ?? 0} 场）`
                    : c.outcomeStatus === 'pending' ? '待度量' : c.outcomeStatus
                  return (
                    <tr key={c.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[var(--text-secondary)]">{c.caseNo}</span>
                          <span className="text-[10px] text-[var(--text-subtle)]">{c.domain}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] font-semibold line-clamp-1">{c.title}</p>
                      </td>
                      <td className="px-4 py-3">{c.ownerName || '未指定'}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{expected}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{actual}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{c.attributionGrade}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">{c.amountState}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10.5px] font-bold border border-[var(--border)] bg-orbit-surface2">
                          {TRACKING_STATUS[c.status] || c.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">改进任务闭环</h2>
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
      </section>
    </div>
  )
}
