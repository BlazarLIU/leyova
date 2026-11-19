import { useState } from 'react'
import { Receipt, CheckCircle2, AlertCircle, Lock } from 'lucide-react'
import { cn } from '@/utils/cn'

export function AiOpsFinanceSettlePage() {
  const [batches] = useState([
    {
      id: 'SETTLE-202611-001',
      channel: '抖音电商',
      period: '2026-11-01 ~ 2026-11-10',
      platformAmount: 485200.0,
      systemAmount: 485200.0,
      diff: 0.0,
      status: 'balanced',
      locked: true,
    },
    {
      id: 'SETTLE-202611-002',
      channel: '快手电商',
      period: '2026-11-01 ~ 2026-11-10',
      platformAmount: 182300.0,
      systemAmount: 182650.0,
      diff: -350.0,
      status: 'discrepancy',
      locked: false,
    },
    {
      id: 'SETTLE-202611-003',
      channel: '淘系平台 (万相台)',
      period: '2026-11-01 ~ 2026-11-10',
      platformAmount: 324100.0,
      systemAmount: 324100.0,
      diff: 0.0,
      status: 'balanced',
      locked: true,
    },
    {
      id: 'SETTLE-202611-004',
      channel: '微信视频号品牌店',
      period: '2026-11-01 ~ 2026-11-10',
      platformAmount: 70940.0,
      systemAmount: 70940.0,
      diff: 0.0,
      status: 'balanced',
      locked: true,
    },
  ])

  return (
    <div className="flex-1 bg-[#0b0f19] text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-amber-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>机密财务板块 · 仅限财务与超管访问</span>
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">结算分录级对账</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            全渠道结算对账分录
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            订单层金额 ≠ 结算层金额。实现分录级自动对账核销，差异 100% 可下钻到具体退款单与扣罚项。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">结算批次核销台账</h3>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono">差异大于 100 元需财务审批后平账</span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {batches.map((batch) => (
            <div key={batch.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-orbit-ink/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80 border border-[var(--border)]">
                    {batch.id}
                  </span>
                  <span className="text-sm font-bold text-white">{batch.channel}</span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">账期: {batch.period}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  平台对账单: <span className="font-mono text-[var(--text-secondary)]">¥{batch.platformAmount.toLocaleString()}</span> ·
                  系统账面已确认: <span className="font-mono text-[var(--text-secondary)]">¥{batch.systemAmount.toLocaleString()}</span>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-[var(--text-muted)] block">对账差异</span>
                  <span className={cn(
                    "text-xs font-mono font-bold",
                    batch.diff === 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {batch.diff === 0 ? '¥0.00 (无差异)' : `-¥${Math.abs(batch.diff).toFixed(2)}`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border",
                    batch.status === 'balanced'
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  )}>
                    {batch.status === 'balanced' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>已平账锁定</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>存在差异待查</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
