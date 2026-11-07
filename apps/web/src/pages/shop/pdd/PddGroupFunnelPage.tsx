import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, TrendingDown, CheckCircle, XCircle, Info, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface GroupFunnel {
  range: { from: string; to: string }
  paid: { orders: number; amount: number }
  waiting: { groups: number; amount: number }
  grouped: { groups: number; amount: number }
  expired: { groups: number; amount: number }
  groupSuccessRate: number | null
  lossAmount: number
  avgGroupSize: number | null
}

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(2) + '%'
}

export function PddGroupFunnelPage() {
  const { currentShop } = usePlatform()
  const [data, setData] = useState<GroupFunnel | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); setData(null); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const d = await api.get<GroupFunnel>(`/pdd/shop/${currentShop.id}/group-funnel`, {
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

  const hasData = !!data && data.paid.orders > 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">成团转化分析</h1>
            <p className="mt-1 text-sm text-slate-400">
              {currentShop ? currentShop.name : '未选择店铺'} · 拼多多独有的「团」机制
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

      {/* 概念说明 */}
      <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">为什么拼多多的「支付」不等于「成交」？</span>
          <p className="mt-1 text-cyan-400/70">
            用户支付后进入「待成团」状态，需达到成团人数（典型 2 人团）才进入标准订单流程。
            未成团的会自动退款，中间存在成团损耗。
            <strong className="text-cyan-300">拼多多售后指标的分母是「已成团订单数」，不是支付订单数。</strong>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">该店铺在选定周期内暂无拼团数据</p>
            <p className="mt-1 text-xs text-slate-600">需从拼多多商家后台导出订单数据（含成团状态）</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 漏斗可视化 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>成团漏斗</CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {/* 支付 */}
                  <FunnelRow
                    label="发起拼团（支付）"
                    count={data!.paid.orders}
                    amount={data!.paid.amount}
                    maxCount={data!.paid.orders}
                    color="bg-slate-600"
                  />
                  <ArrowDown />
                  {/* 待成团 */}
                  <FunnelRow
                    label="待成团中"
                    count={data!.waiting.groups}
                    amount={data!.waiting.amount}
                    maxCount={data!.paid.orders}
                    color="bg-amber-600"
                  />
                  <ArrowDown />
                  <div className="grid grid-cols-2 gap-3">
                    {/* 已成团 */}
                    <div className="rounded-lg border border-emerald-600/40 bg-emerald-500/5 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle className="h-3.5 w-3.5" /> 已成团
                      </div>
                      <div className="mt-1.5 text-xl font-semibold text-emerald-300">{data!.grouped.groups}</div>
                      <div className="mt-1 text-[11px] text-emerald-500/70">{fmt(data!.grouped.amount)} 元</div>
                    </div>
                    {/* 过期 */}
                    <div className="rounded-lg border border-rose-600/40 bg-rose-500/5 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-rose-400">
                        <XCircle className="h-3.5 w-3.5" /> 拼团过期
                      </div>
                      <div className="mt-1.5 text-xl font-semibold text-rose-300">{data!.expired.groups}</div>
                      <div className="mt-1 text-[11px] text-rose-500/70">{fmt(data!.expired.amount)} 元</div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 关键指标 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-400">成团成功率</div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className={`text-lg font-semibold ${
                  (data!.groupSuccessRate ?? 100) < 85 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {fmtPct(data!.groupSuccessRate)}
                </span>
                {(data!.groupSuccessRate ?? 100) < 85 && <Badge variant="danger">偏低</Badge>}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">已成团 / (已成团 + 过期)</div>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <TrendingDown className="h-3 w-3" /> 成团损耗金额
              </div>
              <div className="mt-1.5 text-lg font-semibold text-rose-400">{fmt(data!.lossAmount)} <span className="text-xs text-slate-500">元</span></div>
              <div className="mt-1 text-[11px] text-slate-500">过期拼团自动退款的总额</div>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-400">平均成团人数</div>
              <div className="mt-1.5 text-lg font-semibold text-slate-100">{data!.avgGroupSize ?? '—'}</div>
              <div className="mt-1 text-[11px] text-slate-500">典型为 2 人团</div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}

function ArrowDown() {
  return (
    <div className="flex justify-center">
      <ArrowRight className="h-4 w-4 rotate-90 text-slate-600" />
    </div>
  )
}

function FunnelRow({ label, count, amount, maxCount, color }: {
  label: string; count: number; amount: number; maxCount: number; color: string
}) {
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 2) : 2
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{count} 团 / {fmt(amount)} 元</span>
      </div>
      <div className="mt-1 h-6 overflow-hidden rounded bg-slate-800">
        <div className={`h-full ${color} transition-all`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
