import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Undo2, Info, Users, Megaphone } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface RefundAnalysis {
  range: { from: string; to: string }
  denominator: { groupedOrders: number; note: string }
  refund: { amount: number; orders: number; rate: number | null }
  groupSample: { groupedGroups: number; note: string }
  onlyRefund: { available: boolean; note: string }
  caliber: { amountType: string; amountTypeName: string; displayNote: string } | null
}

interface StoreHealth {
  tiers: {
    navigator: { available: boolean; note: string }
    growthLevel: { available: boolean; note: string }
    experienceStar: { available: boolean; note: string }
  }
  ads: {
    adSpend: number
    adGmv: number
    roi: number | null
    settledRoi: number | null
    note: string
  }
}

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(2) + '%'
}

export function PddRefundAnalysisPage() {
  const { currentShop } = usePlatform()
  const [refund, setRefund] = useState<RefundAnalysis | null>(null)
  const [health, setHealth] = useState<StoreHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const from = fd.toISOString().slice(0, 10)
      const [r, h] = await Promise.all([
        api.get<RefundAnalysis>(`/pdd/shop/${currentShop.id}/refund`, { from, to }).catch(() => null),
        api.get<StoreHealth>(`/pdd/shop/${currentShop.id}/health`, { from, to }).catch(() => null),
      ])
      setRefund(r)
      setHealth(h)
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, days])

  useEffect(() => { load() }, [load])

  const hasData = !!refund && refund.denominator.groupedOrders > 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">售后与店铺健康</h1>
            <p className="mt-1 text-sm text-slate-400">
              {currentShop ? currentShop.name : '未选择店铺'} · 仅退款与三套考核体系
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

      {/* 分母口径说明 */}
      <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">拼多多售后指标的分母是「已成团订单数」，不是支付订单数</span>
          <p className="mt-1 text-cyan-400/70">
            用户支付后进入「待成团」，未成团会自动退款。因此退款率必须在已成团订单上计算，否则会严重虚高。
            这是拼多多与其他平台最大的口径差异。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Undo2 className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">该店铺暂无售后数据</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 退款核心指标 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
              <div className="text-xs text-slate-400">退款金额</div>
              <div className="mt-1.5 text-xl font-semibold text-slate-100">{fmt(refund!.refund.amount)}</div>
              <div className="mt-1 text-[11px] text-slate-500">元</div>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
              <div className="text-xs text-slate-400">退款订单数</div>
              <div className="mt-1.5 text-xl font-semibold text-slate-100">{refund!.refund.orders}</div>
              <div className="mt-1 text-[11px] text-slate-500">单</div>
            </div>
            <div className={`rounded-xl border p-4 ${
              (refund!.refund.rate ?? 0) > 10
                ? 'border-rose-600/40 bg-rose-500/5'
                : 'border-slate-700/60 bg-slate-800/40'
            }`}>
              <div className="text-xs text-slate-400">退款率</div>
              <div className={`mt-1.5 flex items-baseline gap-2 ${
                (refund!.refund.rate ?? 0) > 10 ? 'text-rose-400' : 'text-slate-100'
              }`}>
                <span className="text-xl font-semibold">{fmtPct(refund!.refund.rate)}</span>
                {(refund!.refund.rate ?? 0) > 10 && <Badge variant="danger">偏高</Badge>}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                分母 {refund!.denominator.groupedOrders} 已成团订单
              </div>
            </div>
          </motion.div>

          {/* 仅退款专项 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Undo2 className="h-4 w-4" /> 仅退款专项
                  {!refund!.onlyRefund.available && <Badge variant="neutral">待接入</Badge>}
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-xs leading-relaxed text-slate-400">{refund!.onlyRefund.note}</p>
                <div className="mt-2 rounded-lg bg-slate-800/40 px-3 py-2 text-[11px] text-slate-500">
                  拼多多是「仅退款」规则的首创者（2021 年推出），且仅退款流程适用于所有订单。
                  仅退款占比是拼多多最关键的售后指标，需从商家后台「售后服务指标」导出
                  （含介入率 / 纠纷退款率 / 品质退款率）。
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 店铺健康三套体系 */}
          {health && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> 店铺健康（三套体系并存）
                  </div>
                </CardHeader>
                <CardBody className="space-y-2">
                  {[
                    { key: 'navigator' as const, label: '店铺领航员' },
                    { key: 'growthLevel' as const, label: '成长层级' },
                    { key: 'experienceStar' as const, label: '综合体验星级' },
                  ].map((t) => {
                    const v = health.tiers[t.key]
                    return (
                      <div key={t.key} className="flex items-start gap-3 rounded-lg bg-slate-800/40 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-300">{t.label}</span>
                            <Badge variant={v.available ? 'success' : 'neutral'}>
                              {v.available ? '已接入' : '待接入'}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">{v.note}</p>
                        </div>
                      </div>
                    )
                  })}
                  <p className="pt-1 text-[11px] text-slate-600">
                    注：拼多多的三套体系（领航员 / 成长层级 / 体验星级）并行存在且互相影响，
                    与京东的单套「店铺星级」不同，导入时需分别处理。
                  </p>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* 投放 */}
          {health && health.ads.adSpend > 0 && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4" /> 商品推广 ROI
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
                      <div className="text-xs text-slate-400">花费</div>
                      <div className="mt-1 text-lg font-semibold text-slate-100">{fmt(health.ads.adSpend)}</div>
                    </div>
                    <div className="rounded-lg border border-cyan-600/40 bg-cyan-500/5 p-3">
                      <div className="text-xs text-cyan-400">成交金额</div>
                      <div className="mt-1 text-lg font-semibold text-cyan-300">{fmt(health.ads.adGmv)}</div>
                    </div>
                    <div className="rounded-lg border border-cyan-600/40 bg-cyan-500/5 p-3">
                      <div className="text-xs text-cyan-400">投产比</div>
                      <div className="mt-1 text-lg font-semibold text-cyan-300">
                        {health.ads.roi !== null ? health.ads.roi.toFixed(2) : '—'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-600/40 bg-emerald-500/5 p-3">
                      <div className="text-xs text-emerald-400">结算投产比</div>
                      <div className="mt-1 text-lg font-semibold text-emerald-300">
                        {health.ads.settledRoi !== null ? health.ads.settledRoi.toFixed(2) : '—'}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{health.ads.note}</p>
                </CardBody>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
