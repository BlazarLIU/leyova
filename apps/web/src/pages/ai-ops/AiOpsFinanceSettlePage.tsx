import { useEffect, useState } from 'react'
import { Receipt, CheckCircle2, AlertCircle, Lock, RefreshCw } from 'lucide-react'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

interface GlVoucher {
  id: number
  voucherNo: string
  bizDate: string
  period: string
  voucherType: string
  platformCode: string
  platformName: string
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  status: string
  summary: string
}

interface GlVoucherList {
  total: number
  items: GlVoucher[]
}

interface SettleGroup {
  key: string
  period: string
  platformName: string
  voucherCount: number
  totalDebit: number
  totalCredit: number
  unbalanced: number
}

export function AiOpsFinanceSettlePage() {
  const [vouchers, setVouchers] = useState<GlVoucher[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get<GlVoucherList>('/finance/gl-vouchers', { limit: 200 })
      .then((res) => {
        if (cancelled) return
        setVouchers(res?.items ?? [])
        setTotal(res?.total ?? 0)
      })
      .catch((err) => {
        if (cancelled) return
        setVouchers([])
        setTotal(0)
        setError(err?.message || '结算分录数据加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [retry])

  const groups: SettleGroup[] = Object.values(
    vouchers.reduce<Record<string, SettleGroup>>((acc, v) => {
      const key = `${v.period}::${v.platformCode || 'unknown'}`
      if (!acc[key]) {
        acc[key] = {
          key,
          period: v.period,
          platformName: v.platformName || v.platformCode || '未标注平台',
          voucherCount: 0,
          totalDebit: 0,
          totalCredit: 0,
          unbalanced: 0,
        }
      }
      acc[key].voucherCount += 1
      acc[key].totalDebit += Number(v.totalDebit) || 0
      acc[key].totalCredit += Number(v.totalCredit) || 0
      if (!v.isBalanced) acc[key].unbalanced += 1
      return acc
    }, {}),
  ).sort((a, b) => (a.period === b.period ? b.totalDebit - a.totalDebit : b.period.localeCompare(a.period)))

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-orbit-warning/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-warning/20 text-status-warning border border-orbit-warning/30 flex items-center gap-1">
              <Lock className="w-3 h-3 text-status-warning" />
              <span>机密财务板块 · 仅限财务与超管访问</span>
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">结算分录级对账</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            全渠道结算对账分录
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            数据源为会计总账凭证（fact_gl_voucher）。借贷是否平衡为账面真实状态，不补零、不估算。
          </p>
        </div>

        <button
          onClick={() => setRetry((n) => n + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orbit-ink hover:bg-orbit-ink/85 border border-[var(--border)] text-xs font-semibold text-orbit-snow/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          <span>刷新</span>
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orbit-warning border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-orbit-danger/30 bg-orbit-danger/10 px-4 py-3 text-xs text-status-danger flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-orbit-ink/40 p-10 flex flex-col items-center text-center gap-3">
          <Receipt className="w-10 h-10 text-[var(--text-muted)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">暂无结算总账分录</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-xl leading-relaxed">
            当前账期内没有会计凭证。待结算分录生成后（订单/退款/平台费/物流费入账），此处自动按平台与账期汇总。
          </p>
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-status-warning" />
              <h3 className="text-sm font-bold text-white">结算批次核销台账</h3>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              共 {total} 张凭证 · 借贷不平需财务复核
            </span>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {groups.map((g) => {
              const balanced = g.unbalanced === 0
              return (
                <div
                  key={g.key}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-orbit-ink/20"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80 border border-[var(--border)]">
                        {g.period}
                      </span>
                      <span className="text-sm font-bold text-white">{g.platformName}</span>
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        {g.voucherCount} 张凭证
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      借方合计:{' '}
                      <span className="font-mono text-[var(--text-secondary)]">
                        ¥{g.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>{' '}
                      · 贷方合计:{' '}
                      <span className="font-mono text-[var(--text-secondary)]">
                        ¥{g.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-[var(--text-muted)] block">借贷差额</span>
                      <span
                        className={cn(
                          'text-xs font-mono font-bold',
                          balanced ? 'text-status-success' : 'text-status-danger',
                        )}
                      >
                        {balanced
                          ? '¥0.00 (平衡)'
                          : `¥${(g.totalDebit - g.totalCredit).toFixed(2)}`}
                      </span>
                    </div>

                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border',
                        balanced
                          ? 'bg-orbit-success/10 text-status-success border-orbit-success/20'
                          : 'bg-orbit-danger/10 text-status-danger border-orbit-danger/20',
                      )}
                    >
                      {balanced ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>借贷平衡</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{g.unbalanced} 张不平</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}