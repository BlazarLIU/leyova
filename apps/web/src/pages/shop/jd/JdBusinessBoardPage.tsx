import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Store, Package, AlertTriangle, Info, Wallet, Clock } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface ModeBreakdown {
  range: { from: string; to: string }
  modes: Array<{
    businessMode: string
    businessModeName: string
    shopCount: number
    amount: number
    amountLabel: string
    orderCount: number
    grossMargin: number | null
    avgSettleDays: number | null
    note: string
  }>
  warning: string
}

interface CaliberNote {
  amountType: string
  amountTypeName: string
  displayNote: string
  attributionWindowHours: number | null
  isComparable: boolean
}

function fmt(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}

export function JdBusinessBoardPage() {
  const [data, setData] = useState<ModeBreakdown | null>(null)
  const [caliber, setCaliber] = useState<CaliberNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const from = fd.toISOString().slice(0, 10)
      const [d, c] = await Promise.all([
        api.get<ModeBreakdown>('/jd/mode-breakdown', { from, to }),
        api.get<CaliberNote>('/jd/caliber').catch(() => null),
      ])
      setData(d)
      setCaliber(c)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const selfMode = data?.modes.find((m) => m.businessMode === 'self_operated')
  const popModes = data?.modes.filter((m) => m.businessMode !== 'self_operated') || []
  const hasBoth = !!selfMode && popModes.length > 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">京东经营看板</h1>
            <p className="mt-1 text-sm text-slate-400">
              自营与 POP 双轨经营 · 两种模式口径不同，不可相加
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

      {/* 口径说明 */}
      {caliber && (
        <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <span className="font-medium">
              当前口径：{caliber.amountTypeName}（{caliber.amountType}）
              {caliber.attributionWindowHours && ` · 归因窗口 ${caliber.attributionWindowHours / 24} 天`}
            </span>
            <p className="mt-1 text-cyan-400/70">{caliber.displayNote}</p>
          </div>
        </div>
      )}

      {/* 跨模式警告 */}
      {hasBoth && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <span className="font-medium">自营与 POP 不可相加</span>
            <p className="mt-1 text-rose-400/80">
              自营的「供货金额」是京东向供货商采购的结算额，POP 的「成交金额」是消费者支付额。
              两者量级与含义完全不同，<strong className="text-rose-300">加总会产生错误结论</strong>。
              下面分开展示。
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !data || data.modes.length === 0 ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Store className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">暂无京东店铺数据</p>
            <p className="mt-1 text-xs text-slate-600">
              需在「平台与渠道管理」中为京东店铺设置 business_mode（自营 / POP-SOP / POP-FBP）
            </p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 自营区块 */}
          {selfMode && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> 自营采销
                    <Badge variant="warning">供应商视角</Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Stat label="供货金额（采销额）" value={fmt(selfMode.amount)} unit="元" highlight="amber" />
                    <Stat label="采销单数" value={String(selfMode.orderCount)} unit="单" />
                    <Stat label="毛利额" value={selfMode.grossMargin !== null ? fmt(selfMode.grossMargin) : '—'} unit="元" />
                    <Stat label="平均账期" value={selfMode.avgSettleDays !== null ? String(selfMode.avgSettleDays) : '—'} unit="天" />
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{selfMode.note}</p>
                  <div className="mt-2 text-[11px] text-slate-600">
                    涉及 {selfMode.shopCount} 个店铺 · 毛利口径 = (零售价 - 供货价) × 数量
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* POP 区块 */}
          {popModes.length > 0 && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" /> POP 店铺
                    <Badge variant="info">商家视角</Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {popModes.map((m) => (
                      <div key={m.businessMode} className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{m.businessModeName}</span>
                          <span className="text-xs text-slate-500">{m.shopCount} 个店铺</span>
                          <div className="ml-auto flex items-baseline gap-1">
                            <span className="text-lg font-semibold text-slate-100">{fmt(m.amount)}</span>
                            <span className="text-[11px] text-slate-500">元</span>
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {m.amountLabel} · {m.orderCount} 单
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{m.note}</p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* 汇总说明 */}
          <div className="flex items-start gap-2 rounded-lg border border-slate-700/60 bg-slate-800/20 p-3 text-xs text-slate-400">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {data.warning}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, unit, highlight }: {
  label: string; value: string; unit: string; highlight?: 'amber'
}) {
  return (
    <div className={`rounded-lg border p-3 ${
      highlight === 'amber' ? 'border-amber-600/40 bg-amber-500/5' : 'border-slate-700/60 bg-slate-800/40'
    }`}>
      <div className={`text-xs ${highlight === 'amber' ? 'text-amber-400' : 'text-slate-400'}`}>{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`text-lg font-semibold ${
          highlight === 'amber' ? 'text-amber-300' : 'text-slate-100'
        }`}>{value}</span>
        <span className="text-[11px] text-slate-500">{unit}</span>
      </div>
    </div>
  )
}
