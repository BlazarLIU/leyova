import { useState, useEffect } from 'react'
import {
  Lock,
  Download,
  ShieldCheck,
  Receipt,
} from 'lucide-react'
import { useAiOpsSession } from '@/contexts/AiOpsSessionContext'
import { toast } from '@/utils/toast'
import { fetchFinancePnlData, exportPnlCsv, type FinancePnlData } from '@/services/ai-ops-data'

export function AiOpsFinancePnlPage() {
  const { selectedSessionId, currentSession } = useAiOpsSession()
  const [data, setData] = useState<FinancePnlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetchFinancePnlData(selectedSessionId).then((res) => {
      setData(res)
      setLoading(false)
    })
  }, [selectedSessionId, retry])

  const handleExport = () => {
    if (!data) return
    exportPnlCsv(data, selectedSessionId)
    toast.success(`已下载 Session #${selectedSessionId} 财务 P&L 快照 CSV。`)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#0b0f19] min-h-screen text-amber-400">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#0b0f19] min-h-screen">
        <div className="max-w-md w-full rounded-2xl border border-[var(--border)] bg-orbit-ink/60 p-8 text-center space-y-3">
          <Receipt className="w-10 h-10 mx-auto text-[var(--text-muted)]" />
          <h2 className="text-lg font-semibold text-[var(--text-secondary)]">暂无该场次财务数据</h2>
          <p className="text-sm text-[var(--text-muted)]">请选择有结算数据的场次，或稍后重试。</p>
          <button
            onClick={() => setRetry((n) => n + 1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orbit-ink hover:bg-orbit-ink/85 text-orbit-snow/80 text-sm"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-[#0b0f19] text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* 头部安全与权限提示 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-amber-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>机密财务板块 · 仅限运营总监、HRBP 与超管访问</span>
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Session #{selectedSessionId} · {currentSession?.title || '直播专场'} · T+15 已成熟结算分录
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            利润与单位经济 P&L 瀑布
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-normal">
              CM3 边际贡献率: {data.cm3Rate || '—'}
            </span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            严格遵循三口径分列（支付/结算，永不混算）。仅展示后端已归因的投流、平台服务费与达人佣金；缺失成本项不补零。
          </p>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orbit-ink hover:bg-orbit-ink/85 border border-[var(--border)] text-xs font-semibold text-orbit-snow/80 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出 P&L 报表</span>
        </button>
      </div>

      {/* 成本缺失提示 */}
      {!data.isComplete && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          {data.costMasked
            ? '当前账号无成本明细查看权限，净利润暂不可计算。'
            : `成本项缺失（${data.missingCosts.join('、') || '未知'}），净利润暂不可计算，系统不会用比例估算填充。`}
        </div>
      )}

      {/* 三口径金额卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">下单 GMV (amount_order)</p>
          <p className="text-xl font-bold font-mono text-[var(--text-secondary)] mt-1">{data.orderGmv != null ? `¥${(data.orderGmv / 10000).toFixed(2)}w` : '—'}</p>
          <span className="text-[10px] text-[var(--text-muted)]">后端暂未提供该口径</span>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">支付 GMV (amount_paid)</p>
          <p className="text-xl font-bold font-mono text-cyan-400 mt-1">¥{(data.payGmv / 10000).toFixed(2)}w</p>
          <span className="text-[10px] text-cyan-500">含后续退款 (T+0)</span>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-amber-500/30 backdrop-blur-xl shadow-[0_0_15px_rgba(245,158,11,0.1)]">
          <p className="text-xs text-amber-300">结算 GMV (amount_settle)</p>
          <p className="text-2xl font-extrabold font-mono text-amber-400 mt-1">¥{(data.settleGmv / 10000).toFixed(2)}w</p>
          <span className="text-[10px] text-amber-500">唯一结算真值 (T+15成熟)</span>
        </div>

        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-emerald-500/30 backdrop-blur-xl">
          <p className="text-xs text-emerald-300">经营净利润 (Net Profit)</p>
          <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">{data.netProfit != null ? `¥${(data.netProfit / 10000).toFixed(2)}w` : '—'}</p>
          <span className="text-[10px] text-emerald-500">成本项齐全时计算</span>
        </div>
      </div>

      {/* P&L 瀑布分解表 */}
      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">单品/单店经营成本分录瀑布 (P&L Waterfall)</h3>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>三口径分列 · 汇损关税入账</span>
          </span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {data.waterfall.map((item, index) => (
            <div key={index} className="p-4 px-6 flex items-center justify-between gap-4 hover:bg-orbit-ink/20 transition-colors">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-[var(--text-secondary)]">{item.item}</p>
                <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
              </div>

              <div className="text-right flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">占比 (基准结算)</span>
                  <span className="text-xs font-mono font-medium text-[var(--text-muted)]">{item.rate}</span>
                </div>
                <div className="w-28 text-right font-mono font-bold text-sm">
                  {item.isCost ? (
                    <span className="text-rose-400">-¥{Math.abs(item.amount).toLocaleString()}</span>
                  ) : (
                    <span className="text-emerald-400">+¥{item.amount.toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 净利结算底行 */}
          <div className="p-5 px-6 bg-orbit-ink/60 flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-emerald-400">最终经营净利 (EBITDA贡献)</p>
              <p className="text-xs text-[var(--text-muted)]">仅按后端已归因成本计算，缺失项不估算</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold font-mono text-emerald-400">{data.netProfit != null ? `¥${data.netProfit.toLocaleString()}` : '—'}</span>
              <span className="text-xs text-emerald-500 block">CM3 利润率: {data.cm3Rate || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
