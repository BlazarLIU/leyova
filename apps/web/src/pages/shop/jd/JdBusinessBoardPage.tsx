import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Store, Package, AlertTriangle, Info, Wallet, Clock, Receipt, Lock } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface FeeSummary {
  grossMarginGuarantee: number | null
  rebate: number | null
  tcFreight: number | null
  labelFee: number | null
  qualityDeposit: number | null
  commission: number | null
  netFeeImpact: number | null
}

interface ModeBreakdown {
  range: { from: string; to: string }
  costMasked?: boolean
  modes: Array<{
    businessMode: string
    businessModeName: string
    shopCount: number
    amount: number
    amountLabel: string
    orderCount: number
    grossMargin: number | null
    avgSettleDays: number | null
    feeSummary?: FeeSummary | null
    note: string
  }>
  warning: string
}

interface SettlementFeeResponse {
  range: { from: string; to: string }
  costMasked: boolean
  items: Array<{
    id: number
    shopId: number
    shopName: string
    businessMode: string
    businessModeName: string
    bizMonth: string
    feeCode: string
    feeName: string
    direction: 'deduct' | 'rebate'
    amount: number | null
    note: string
  }>
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
  const [fees, setFees] = useState<SettlementFeeResponse | null>(null)
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
      const [d, f, c] = await Promise.all([
        api.get<ModeBreakdown>('/jd/mode-breakdown', { from, to }),
        api.get<SettlementFeeResponse>('/jd/settlement-fees', { from, to }).catch(() => null),
        api.get<CaliberNote>('/jd/caliber').catch(() => null),
      ])
      setData(d)
      setFees(f)
      setCaliber(c)
    } catch {
      setData(null)
      setFees(null)
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
                    {data.costMasked && <Badge variant="neutral">成本/费用已脱敏</Badge>}
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Stat label="供货金额（采销额）" value={fmt(selfMode.amount)} unit="元" highlight="amber" />
                    <Stat label="采销单数" value={String(selfMode.orderCount)} unit="单" />
                    <Stat label="毛利额" value={selfMode.grossMargin !== null ? fmt(selfMode.grossMargin) : '已脱敏'} unit={selfMode.grossMargin !== null ? '元' : ''} />
                    <Stat label="平均账期" value={selfMode.avgSettleDays !== null ? String(selfMode.avgSettleDays) : '—'} unit="天" />
                  </div>
                  {selfMode.feeSummary && !data.costMasked && (
                    <div className="mt-4 grid gap-2 rounded-lg border border-slate-700/60 bg-slate-800/30 p-3 text-xs sm:grid-cols-6">
                      <div><span className="text-slate-500">毛保补差</span><div className="mt-1 font-mono text-rose-300">-¥{fmt(selfMode.feeSummary.grossMarginGuarantee || 0)}</div></div>
                      <div><span className="text-slate-500">季度返点</span><div className="mt-1 font-mono text-emerald-300">+¥{fmt(selfMode.feeSummary.rebate || 0)}</div></div>
                      <div><span className="text-slate-500">TC 运费</span><div className="mt-1 font-mono text-slate-200">-¥{fmt(selfMode.feeSummary.tcFreight || 0)}</div></div>
                      <div><span className="text-slate-500">贴码费</span><div className="mt-1 font-mono text-slate-200">-¥{fmt(selfMode.feeSummary.labelFee || 0)}</div></div>
                      <div><span className="text-slate-500">质保金</span><div className="mt-1 font-mono text-slate-200">-¥{fmt(selfMode.feeSummary.qualityDeposit || 0)}</div></div>
                      <div>
                        <span className="text-slate-500">费用净影响</span>
                        <div className={`mt-1 font-mono font-semibold ${(selfMode.feeSummary.netFeeImpact || 0) >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {(selfMode.feeSummary.netFeeImpact || 0) >= 0 ? '+' : ''}¥{fmt(selfMode.feeSummary.netFeeImpact || 0)}
                        </div>
                      </div>
                    </div>
                  )}
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
                        {m.feeSummary && !data.costMasked && (
                          <div className="mt-2 flex flex-wrap gap-4 border-t border-slate-700/50 pt-2 text-[11px] text-slate-400">
                            <span>平台佣金：<strong className="font-mono text-rose-300">-¥{fmt(m.feeSummary.commission || 0)}</strong></span>
                            <span>仓配履约费：<strong className="font-mono text-slate-200">-¥{fmt(m.feeSummary.tcFreight || 0)}</strong></span>
                            <span>费用净影响：<strong className="font-mono text-amber-300">¥{fmt(m.feeSummary.netFeeImpact || 0)}</strong></span>
                          </div>
                        )}
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{m.note}</p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* 精细化结算费用对账表 */}
          {fees && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-cyan-400" /> 自营 vs POP 结算费用对账明细
                  </div>
                </CardHeader>
                <CardBody>
                  {fees.costMasked ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 p-4 text-xs text-slate-400">
                      <Lock className="h-4 w-4 text-slate-500" />
                      当前角色无成本与结算扣费权限，毛保/返点/佣金等金额字段已自动脱敏。
                    </div>
                  ) : fees.items.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">选定周期内暂无费用对账记录</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                            <th className="py-2 pr-3">账期</th>
                            <th className="py-2 pr-3">模式</th>
                            <th className="py-2 pr-3">店铺</th>
                            <th className="py-2 pr-3">费用科目</th>
                            <th className="py-2 pr-3">方向</th>
                            <th className="py-2 pr-3 text-right">金额 (元)</th>
                            <th className="py-2">核对说明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fees.items.map((item) => (
                            <tr key={item.id} className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/30">
                              <td className="py-2 pr-3 font-mono text-xs">{item.bizMonth}</td>
                              <td className="py-2 pr-3 text-xs">{item.businessModeName}</td>
                              <td className="py-2 pr-3 text-xs text-slate-200">{item.shopName}</td>
                              <td className="py-2 pr-3 text-xs font-medium text-slate-100">{item.feeName}</td>
                              <td className="py-2 pr-3">
                                <Badge variant={item.direction === 'rebate' ? 'success' : 'warning'}>
                                  {item.direction === 'rebate' ? '返利 (+)' : '扣费 (-)'}
                                </Badge>
                              </td>
                              <td className={`py-2 pr-3 text-right font-mono ${item.direction === 'rebate' ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {item.amount !== null ? `${item.direction === 'rebate' ? '+' : '-'}${item.amount.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2 text-xs text-slate-500">{item.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
