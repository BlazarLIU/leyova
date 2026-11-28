import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Send,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAiOpsSession } from '@/contexts/AiOpsSessionContext'
import { toast } from '@/utils/toast'
import { fetchSessionReviewReport, submitReviewActionItems, type ReviewReportData } from '@/services/ai-ops-data'
import { EmbeddedCopilot } from '@/components/ai/EmbeddedCopilot'

const wan = (n: number | null | undefined) => (n == null ? '—' : `¥${(n / 10000).toFixed(2)}w`)

export function AiOpsReviewPage() {
  const { selectedSessionId } = useAiOpsSession()
  const [report, setReport] = useState<ReviewReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionSynced, setActionSynced] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchSessionReviewReport(selectedSessionId).then((res) => {
      setReport(res)
      setLoading(false)
    })
  }, [selectedSessionId])

  const handleSyncActions = async () => {
    if (!report) return
    const res = await submitReviewActionItems(report.sessionId)
    if (res.ok) {
      setActionSynced(true)
      toast.success(res.message)
      setTimeout(() => setActionSynced(false), 3000)
    } else {
      toast.error(res.message || '行动项下达失败，请重试')
    }
  }

  if (loading || !report) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-orbit-bg min-h-screen text-status-ai">
        <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sumAttributions = report.attributions.reduce((acc, cur) => acc + cur.delta, 0)
  const isMathClosed = report.mathClosed
  const achievementPct =
    report.payGmv != null && report.targetGmv ? (report.payGmv / report.targetGmv) * 100 : null

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* 头部导航与操作 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 2 · 场次台
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">归因引擎 · 确定性漏斗分解</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            单场复盘归因报告
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded border font-normal',
                isMathClosed
                  ? 'bg-orbit-success/10 text-status-success border-orbit-success/20'
                  : 'bg-orbit-warning/10 text-status-warning border-orbit-warning/20',
              )}
            >
              {isMathClosed ? '闭环数学检验 verified' : '归因数据不足'}
            </span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {report.sessionTitle}（主播：{report.anchor} · {report.date}）
          </p>
        </div>

        <div className="flex items-center gap-3">
          {actionSynced && (
            <span className="text-xs text-status-success flex items-center gap-1 font-medium animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              决策案已生成
            </span>
          )}
          <button
            onClick={handleSyncActions}
            disabled={report.insufficient || report.actionItems.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orbit-success to-orbit-success text-white text-xs font-bold shadow-lg shadow-cyan-900/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>行动项生成决策案 (闭环)</span>
          </button>
        </div>
      </div>

      {report.insufficient && (
        <div className="rounded-2xl border border-orbit-warning/40 bg-orbit-warning/10 p-5">
          <div className="flex items-center gap-2 text-status-warning font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>数据不足，无法给出可信归因（不做兜底估算）</span>
          </div>
          <ul className="mt-2 list-disc pl-6 text-xs text-[var(--text-secondary)] space-y-1">
            {report.insufficientReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {report.dataQualityWarnings && report.dataQualityWarnings.length > 0 && (
        <div className="rounded-2xl border border-orbit-warning/30 bg-orbit-warning/[0.06] p-4 text-xs text-[var(--text-secondary)]">
          <span className="font-bold text-status-warning">口径提示：</span>
          {report.dataQualityWarnings.join('；')}
        </div>
      )}

      {/* 金额与目标差额卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">下单 GMV（口径未接入）</p>
          <p className="text-xl font-bold font-mono text-[var(--text-secondary)] mt-1">—</p>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-orbit-success/30 backdrop-blur-xl shadow-[0_0_15px_rgba(6,182,212,0.1)]">
          <p className="text-xs text-status-ai">支付 GMV (amount_paid)</p>
          <p className="text-2xl font-extrabold font-mono text-status-ai mt-1">{wan(report.payGmv)}</p>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">预估结算 GMV（扣退款）</p>
          <p className="text-xl font-bold font-mono text-[var(--text-secondary)] mt-1">{wan(report.settleGmv)}</p>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-orbit-danger/30 backdrop-blur-xl">
          <p className="text-xs text-status-danger">目标差额 (Delta GMV)</p>
          <p className="text-xl font-bold font-mono text-status-danger mt-1">
            {report.deltaGmv == null ? '未设目标' : `${report.deltaGmv >= 0 ? '+' : '-'}${wan(Math.abs(report.deltaGmv))}`}
            {achievementPct != null && (
              <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                (目标 {wan(report.targetGmv)} · 达成 {achievementPct.toFixed(1)}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 归因分解 */}
      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-status-ai" />
              <span>三段归因分解（流量 × 转化 × 客单，支付口径）</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              目标隐含访客按历史基线反推，三项之和严格等于目标差额，禁止固定占比。分项可相互抵消，占比可能超过 100%。
            </p>
          </div>
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1 border',
              isMathClosed
                ? 'bg-orbit-success/10 text-status-success border-orbit-success/30'
                : 'bg-orbit-danger/10 text-status-danger border-orbit-danger/30',
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              归因和 ¥{Math.round(sumAttributions).toLocaleString()} / 差额{' '}
              {report.deltaGmv == null ? '—' : `¥${Math.round(report.deltaGmv).toLocaleString()}`}（误差{' '}
              {(report.mathErrorRatio * 100).toFixed(2)}%）
            </span>
          </span>
        </div>

        {report.attributions.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-orbit-surface2 p-6 text-center text-sm text-[var(--text-muted)]">
            数据不足，未生成归因项。
            {report.baseline == null && '（缺同范围历史基线）'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {report.attributions.map((attr) => {
              const isNegative = attr.delta < 0
              return (
                <div
                  key={attr.stage}
                  className={cn(
                    'p-4 rounded-xl border flex flex-col justify-between gap-3 backdrop-blur-md',
                    isNegative ? 'border-[var(--border)] bg-orbit-ink/60' : 'border-orbit-success/20 bg-orbit-success/15',
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{attr.stageName}</span>
                      <span className={cn('text-xs font-mono font-bold', isNegative ? 'text-status-danger' : 'text-status-success')}>
                        {isNegative ? '-' : '+'}¥{Math.abs(attr.delta).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] mb-2">
                      <span>解释度贡献：</span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        {Math.abs(attr.share) <= 1
                          ? `${(attr.share * 100).toFixed(1)}%`
                          : `反向抵消 ${Math.abs(attr.share).toFixed(1)}×`}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed border-t border-[var(--border)] pt-2">
                      {attr.diagnosis}
                    </p>
                  </div>

                  <div className="text-[10px] font-mono bg-orbit-ink p-2 rounded border border-[var(--border)] text-orbit-snow/70">
                    <span className="text-status-ai font-semibold block mb-0.5">证据来源：</span>
                    {attr.evidence}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {report.refund && (
          <div className="rounded-xl border border-orbit-warning/30 bg-orbit-warning/[0.06] p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-status-warning">退款影响（单独列示，不计入支付差额）</span>
              <span className="font-mono text-[var(--text-secondary)]">
                实际退款 ¥{report.refund.actualRefund.toLocaleString()} · 退款率 {(report.refund.actualRefundRate * 100).toFixed(2)}% ·
                较基线影响 {report.refund.delta >= 0 ? '+' : '-'}¥{Math.abs(report.refund.delta).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-[var(--text-muted)]">{report.refund.note}</p>
          </div>
        )}
      </div>

      {/* 行动项 */}
      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-status-success" />
            <span>明日可执行行动项（生成后进入决策案审批）</span>
          </h3>
          <span className="text-xs text-[var(--text-muted)]">已自动分配责任岗位与验收指标</span>
        </div>

        {report.actionItems.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">无可执行行动项</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {report.actionItems.map((act) => (
              <div key={act.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orbit-ink text-orbit-snow/80">
                      {act.id}
                    </span>
                    <span className="text-xs font-bold text-status-ai">{act.who}</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">截止：{act.when}</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">{act.what}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <span className="text-[var(--text-muted)] block">验收目标</span>
                    <span className="text-status-success font-mono font-medium">{act.targetMetric}</span>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orbit-success/10 text-status-ai border border-orbit-success/30">
                    度量日自动验证
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EmbeddedCopilot
        page="review"
        sessionId={report.sessionId}
        contextLabel={report.sessionTitle}
        date={report.date}
      />
    </div>
  )
}
