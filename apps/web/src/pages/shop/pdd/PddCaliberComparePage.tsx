import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Layers, Info, TrendingDown, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface CaliberCompare {
  range: { from: string; to: string }
  grossPaid: { amount: number; orders: number; note: string }
  grossSettled: { amount: number; orders: number; note: string }
  netSettled: { amount: number; orders: number; note: string }
  diffs: { settledVsPaid: number | null; netVsPaid: number | null }
}

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%'
}

export function PddCaliberComparePage() {
  const { currentShop } = usePlatform()
  const [data, setData] = useState<CaliberCompare | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); setData(null); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const d = await api.get<CaliberCompare>(`/pdd/shop/${currentShop.id}/caliber-compare`, {
        from: fd.toISOString().slice(0, 10), to,
      })
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, days])

  useEffect(() => { load() }, [load])

  const hasData = !!data && (data.grossPaid.amount > 0 || data.grossSettled.amount > 0 || data.netSettled.amount > 0)

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">三口径对账</h1>
            <p className="mt-1 text-sm text-slate-400">
              {currentShop ? currentShop.name : '未选择店铺'} · 交易额 / 结算金额 / 净成交
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded px-3 py-1.5 text-xs transition ${
                  days === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}>近 {d} 天</button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 三口径概念说明 */}
      <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">拼多多为什么有三套 GMV？</span>
          <p className="mt-1 text-cyan-400/70">
            交易额是「已成团订单的支付金额」；结算金额扣掉退款；净成交再扣掉秒退订单（支付后 1 小时内且当日 23:59:59 前退款、商家未发货）。
            投放侧还有「结算投产比」（结算金额 / 花费）。<strong className="text-cyan-300">只存一个 GMV 一定是错的。</strong>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Layers className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">该店铺在选定周期内暂无数据</p>
            <p className="mt-1 text-xs text-slate-600">需导入拼多多商家后台的交易数据与结算数据</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 三口径卡片 */}
          <motion.div {...fadeIn} className="grid gap-4 sm:grid-cols-3">
            <CaliberCard
              title="交易额"
              code="gross_paid"
              amount={data!.grossPaid.amount}
              orders={data!.grossPaid.orders}
              note={data!.grossPaid.note}
              tone="cyan"
              isDefault
            />
            <CaliberCard
              title="结算金额"
              code="gross_settled"
              amount={data!.grossSettled.amount}
              orders={data!.grossSettled.orders}
              note={data!.grossSettled.note}
              tone="emerald"
              diff={data!.diffs.settledVsPaid}
            />
            <CaliberCard
              title="净成交"
              code="net_settled"
              amount={data!.netSettled.amount}
              orders={data!.netSettled.orders}
              note={data!.netSettled.note}
              tone="amber"
              diff={data!.diffs.netVsPaid}
            />
          </motion.div>

          {/* 差异分析 */}
          {(data!.diffs.settledVsPaid !== null || data!.diffs.netVsPaid !== null) && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> 口径差异分析
                  </div>
                </CardHeader>
                <CardBody className="space-y-2">
                  {data!.diffs.settledVsPaid !== null && (
                    <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm">
                      <span className="text-slate-300">结算金额 vs 交易额</span>
                      <span className={`font-mono font-medium ${
                        data!.diffs.settledVsPaid < -10 ? 'text-rose-400' : 'text-slate-200'
                      }`}>{fmtPct(data!.diffs.settledVsPaid)}</span>
                    </div>
                  )}
                  {data!.diffs.netVsPaid !== null && (
                    <div className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2 text-sm">
                      <span className="text-slate-300">净成交 vs 交易额</span>
                      <span className={`font-mono font-medium ${
                        data!.diffs.netVsPaid < -10 ? 'text-rose-400' : 'text-slate-200'
                      }`}>{fmtPct(data!.diffs.netVsPaid)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-400/80">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    差异主要来自退款。若「结算金额 vs 交易额」差异超过 10%，说明退款占比偏高，建议结合售后分析排查。
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

function CaliberCard({ title, code, amount, orders, note, tone, isDefault, diff }: {
  title: string
  code: string
  amount: number
  orders: number
  note: string
  tone: 'cyan' | 'emerald' | 'amber'
  isDefault?: boolean
  diff?: number | null
}) {
  const toneMap = {
    cyan: 'border-cyan-600/40 bg-cyan-500/5 text-cyan-300',
    emerald: 'border-emerald-600/40 bg-emerald-500/5 text-emerald-300',
    amber: 'border-amber-600/40 bg-amber-500/5 text-amber-300',
  }
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        {isDefault && <Badge variant="info">默认</Badge>}
      </div>
      <div className="mt-2 text-2xl font-semibold">{fmt(amount)}</div>
      <div className="mt-0.5 text-[11px] opacity-70">{orders} 单 · {code}</div>
      {diff !== null && diff !== undefined && (
        <div className="mt-1.5 text-[11px] opacity-80">
          较交易额 {fmtPct(diff)}
        </div>
      )}
      <p className="mt-2 border-t border-current/10 pt-2 text-[11px] opacity-70 leading-relaxed">{note}</p>
    </div>
  )
}
