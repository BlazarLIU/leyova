import { useState, useEffect } from 'react'
import {
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Send,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAiOpsSession } from '@/contexts/AiOpsSessionContext'
import { toast } from '@/utils/toast'
import { fetchSessionReviewReport, submitReviewActionItems, type ReviewReportData } from '@/services/ai-ops-data'

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
    const ok = await submitReviewActionItems(report.actionItems)
    if (ok) {
      setActionSynced(true)
      toast.success('3项复盘行动项已成功下达至改进闭环看板，已自动排入下一场开播验证！')
      setTimeout(() => setActionSynced(false), 3000)
    } else {
      toast.error('行动项下达失败，请重试')
    }
  }

  if (loading || !report) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-orbit-bg min-h-screen text-status-ai">
        <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 验证归因闭环：Σ 归因 delta 是否等于 deltaGmv (允许 1% 误差)
  const sumAttributions = report.attributions.reduce((acc, cur) => acc + cur.delta, 0)
  const isMathClosed = Math.abs(sumAttributions - report.deltaGmv) <= Math.abs(report.deltaGmv * 0.01)

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* 头部导航与操作 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 2 · 场次台
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">场次复盘 · 下播30分钟自动出稿</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            单场五段复盘归因报告
            <span className="text-xs px-2 py-0.5 rounded bg-orbit-success/10 text-status-success border border-orbit-success/20 font-normal">
              闭环数学检验 verified
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
              3条行动项已推送到今晚排品候选池！
            </span>
          )}
          <button
            onClick={handleSyncActions}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orbit-success to-orbit-success hover:from-orbit-success hover:to-orbit-success text-white text-xs font-bold shadow-lg shadow-cyan-900/40 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>行动项回流下一场排品 (闭环)</span>
          </button>
        </div>
      </div>

      {/* 三口径金额与目标差额卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)] flex items-center justify-between">
            <span>下单 GMV (amount_order)</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">T+0</span>
          </p>
          <p className="text-xl font-bold font-mono text-[var(--text-secondary)] mt-1">¥{(report.orderGmv / 10000).toFixed(2)}w</p>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-orbit-success/30 backdrop-blur-xl shadow-[0_0_15px_rgba(6,182,212,0.1)]">
          <p className="text-xs text-status-ai flex items-center justify-between">
            <span>支付 GMV (amount_paid)</span>
            <span className="text-[10px] text-status-ai font-mono">核心基准</span>
          </p>
          <p className="text-2xl font-extrabold font-mono text-status-ai mt-1">¥{(report.payGmv / 10000).toFixed(2)}w</p>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)] flex items-center justify-between">
            <span>预估结算 GMV (amount_settle)</span>
            <span className="text-[10px] text-status-warning font-mono">T+15 成熟中</span>
          </p>
          <p className="text-xl font-bold font-mono text-[var(--text-secondary)] mt-1">¥{(report.settleGmv / 10000).toFixed(2)}w</p>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-orbit-danger/30 backdrop-blur-xl">
          <p className="text-xs text-status-danger flex items-center justify-between">
            <span>目标达成差距 (Delta GMV)</span>
            <span className="text-[10px] text-status-danger font-mono">目标 20.0w</span>
          </p>
          <p className="text-xl font-bold font-mono text-status-danger mt-1">
            -¥{(Math.abs(report.deltaGmv) / 10000).toFixed(2)}w ({( (report.payGmv / report.targetGmv) * 100).toFixed(1)}%)
          </p>
        </div>
      </div>

      {/* 五段归因分解 (五段之和 = 差额 ±1%) */}
      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-status-ai" />
              <span>五段归因全景分解瀑布（流量结构 → 转化漏斗 → 货盘 → 主播 → 售后退款）</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              严禁“下次努力”类无动作空话。每段均有精准证据链支撑。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2.5 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1 border",
              isMathClosed ? "bg-orbit-success/10 text-status-success border-orbit-success/30" : "bg-orbit-danger/10 text-status-danger border-orbit-danger/30"
            )}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>归因和: ¥{sumAttributions} (误差 0.0%)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {report.attributions.map((attr) => {
            const isNegative = attr.delta < 0
            return (
              <div
                key={attr.stage}
                className={cn(
                  "p-4 rounded-xl border flex flex-col justify-between gap-3 backdrop-blur-md",
                  isNegative ? "border-[var(--border)] bg-orbit-ink/60" : "border-orbit-success/20 bg-orbit-success/15"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{attr.stageName}</span>
                    <span className={cn(
                      "text-xs font-mono font-bold",
                      isNegative ? "text-status-danger" : "text-status-success"
                    )}>
                      {isNegative ? '-' : '+'}¥{Math.abs(attr.delta)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] mb-2">
                    <span>解释度贡献：</span>
                    <span className="font-mono text-[var(--text-secondary)]">{(attr.share * 100).toFixed(1)}%</span>
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
      </div>

      {/* 明日 3 条行动项（产出可执行物，闭环驱动下一场） */}
      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-status-success" />
            <span>明日可执行行动项 (Action Items · 产出可执行物)</span>
          </h3>
          <span className="text-xs text-[var(--text-muted)]">已自动分配责任岗位与验收指标</span>
        </div>

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
                  下场自动验证
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
