import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Store, ShoppingCart, Users, Undo2, Wallet, Percent,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface OverviewResp {
  range: { from: string; to: string }
  current: {
    gmv: number; payAmount: number; paidOrderCount: number; paidBuyerCount: number
    refundAmount: number; refundRate: number; netSales: number; avgOrderValue: number
  }
  previous: { gmv: number; payAmount: number; paidOrderCount: number; paidBuyerCount: number; refundAmount: number }
  growth: Record<string, number | null>
}

interface PlatformRow {
  platform_code: string; platform_name: string; category: string
  gmv: number; pay_amount: number; paid_order_count: number; paid_buyer_count: number
  refund_amount: number; refund_rate: number; avg_order_value: number
  shop_count: number; gmv_share: number
}

interface ShopRow {
  shop_id: number; shop_name: string; platform_code: string; platform_name: string
  gmv: number; paid_order_count: number; refund_amount: number; refund_rate: number
}

interface TrendRow {
  biz_date: string; gmv: number; pay_amount: number; paid_order_count: number; refund_amount: number
}

const CATEGORY_LABEL: Record<string, string> = { live: '直播', shelf: '货架', content: '内容' }

function fmtMoney(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}

function Growth({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-slate-500">—</span>
  }
  const up = value >= 0
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium', up ? 'text-emerald-400' : 'text-rose-400')}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

export function OmniDashboardPage() {
  const { currentPlatform } = usePlatform()
  const [overview, setOverview] = useState<OverviewResp | null>(null)
  const [platforms, setPlatforms] = useState<PlatformRow[]>([])
  const [shops, setShops] = useState<ShopRow[]>([])
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fromD = new Date()
      fromD.setDate(fromD.getDate() - days + 1)
      const from = fromD.toISOString().slice(0, 10)

      const [ov, pf, sh, tr] = await Promise.all([
        api.get<OverviewResp>('/omnichannel/overview', { from, to }),
        api.get<{ platforms: PlatformRow[] }>('/omnichannel/platforms', { from, to }),
        api.get<ShopRow[]>('/omnichannel/shops', { from, to, limit: 10 }),
        api.get<TrendRow[]>('/omnichannel/trend', { from, to }),
      ])
      setOverview(ov)
      setPlatforms(pf.platforms || [])
      setShops(sh || [])
      setTrend(tr || [])
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const maxTrend = Math.max(...trend.map((t) => t.gmv), 1)

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">全渠道经营大盘</h1>
            <p className="mt-1 text-sm text-slate-400">
              跨平台经营汇总 · 当前视图 {currentPlatform?.platform_name || '全部平台'}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'rounded px-3 py-1.5 text-xs transition',
                  days === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200',
                )}
              >
                近 {d} 天
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : (
        <>
          {/* 核心指标 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={ShoppingCart} label="GMV" value={fmtMoney(overview?.current.gmv || 0)}
              growth={overview?.growth.gmv}
            />
            <MetricCard
              icon={Store} label="支付订单数" value={String(overview?.current.paidOrderCount || 0)}
              growth={overview?.growth.paidOrderCount}
            />
            <MetricCard
              icon={Users} label="支付买家数" value={String(overview?.current.paidBuyerCount || 0)}
              growth={overview?.growth.paidBuyerCount}
            />
            <MetricCard
              icon={Undo2} label="退款金额" value={fmtMoney(overview?.current.refundAmount || 0)}
              growth={overview?.growth.refundAmount}
            />
            <MetricCard icon={Wallet} label="净销售额" value={fmtMoney(overview?.current.netSales || 0)} />
            <MetricCard icon={Percent} label="退款率" value={(overview?.current.refundRate || 0) + '%'} />
            <MetricCard icon={ShoppingCart} label="客单价" value={fmtMoney(overview?.current.avgOrderValue || 0)} />
            <MetricCard icon={Store} label="在营店铺" value={String(platforms.reduce((s, p) => s + p.shop_count, 0))} />
          </motion.div>

          {/* 趋势图 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>GMV 日趋势</CardHeader>
              <CardBody>
                {trend.length === 0 ? (
                  <EmptyHint />
                ) : (
                  <div className="flex h-40 items-end gap-1">
                    {trend.map((t) => (
                      <div key={t.biz_date} className="group relative flex-1">
                        <div
                          className="rounded-t bg-gradient-to-t from-cyan-600/60 to-cyan-400/80 transition-all hover:from-cyan-500 hover:to-cyan-300"
                          style={{ height: `${Math.max((t.gmv / maxTrend) * 140, 2)}px` }}
                        />
                        <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-slate-200 ring-1 ring-slate-700 group-hover:block">
                          {t.biz_date}<br />{fmtMoney(t.gmv)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* 平台对比 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>平台经营对比</CardHeader>
              <CardBody>
                {platforms.length === 0 ? (
                  <EmptyHint />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                          <th className="py-2 pr-3">平台</th>
                          <th className="py-2 pr-3">类型</th>
                          <th className="py-2 pr-3 text-right">GMV</th>
                          <th className="py-2 pr-3 text-right">占比</th>
                          <th className="py-2 pr-3 text-right">订单</th>
                          <th className="py-2 pr-3 text-right">买家</th>
                          <th className="py-2 pr-3 text-right">退款率</th>
                          <th className="py-2 pr-3 text-right">客单价</th>
                          <th className="py-2 text-right">店铺</th>
                        </tr>
                      </thead>
                      <tbody>
                        {platforms.map((p) => (
                          <tr key={p.platform_code} className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/30">
                            <td className="py-2 pr-3 font-medium text-slate-200">{p.platform_name}</td>
                            <td className="py-2 pr-3">
                              <Badge variant={p.category === 'live' ? 'info' : p.category === 'shelf' ? 'success' : 'warning'}>
                                {CATEGORY_LABEL[p.category] || p.category}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{fmtMoney(p.gmv)}</td>
                            <td className="py-2 pr-3 text-right">
                              <span className="text-cyan-400">{p.gmv_share.toFixed(1)}%</span>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{p.paid_order_count}</td>
                            <td className="py-2 pr-3 text-right font-mono">{p.paid_buyer_count}</td>
                            <td className={cn('py-2 pr-3 text-right font-mono', p.refund_rate > 10 ? 'text-rose-400' : 'text-slate-300')}>
                              {p.refund_rate}%
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{fmtMoney(p.avg_order_value)}</td>
                            <td className="py-2 text-right">{p.shop_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* 店铺排行 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>店铺 GMV 排行 TOP 10</CardHeader>
              <CardBody>
                {shops.length === 0 ? (
                  <EmptyHint />
                ) : (
                  <div className="space-y-2">
                    {shops.map((s, i) => {
                      const max = shops[0]?.gmv || 1
                      return (
                        <div key={s.shop_id} className="flex items-center gap-3">
                          <span className="w-5 text-xs text-slate-500">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm text-slate-200">{s.shop_name}</span>
                              <span className="shrink-0 font-mono text-xs text-slate-400">{fmtMoney(s.gmv)}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400"
                                style={{ width: `${Math.max((s.gmv / max) * 100, 1)}%` }}
                              />
                            </div>
                          </div>
                          <Badge variant="neutral">{s.platform_name}</Badge>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon, label, value, growth,
}: {
  icon: any; label: string; value: string; growth?: number | null
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="text-lg font-semibold text-slate-100">{value}</span>
        {growth !== undefined && <Growth value={growth} />}
      </div>
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="py-10 text-center text-xs text-slate-500">
      暂无数据 · 请先通过「数据管理 → 多平台接入」导入各平台经营数据
    </div>
  )
}
