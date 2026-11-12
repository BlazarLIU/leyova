import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Store, ShoppingCart, Users, Undo2, Wallet, Percent, TrendingUp,
  ArrowRight, AlertTriangle, Megaphone,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface ShopDetail {
  shop: { id: number; shop_name: string; platform_code: string; auth_status: string }
  range: { from: string; to: string }
  trade: {
    gmv: number; payAmount: number; paidOrderCount: number; paidBuyerCount: number
    refundAmount: number; refundRate: number; avgOrderValue: number
  }
  traffic: { impressions: number; clicks: number; visitors: number; ctr: number }
  channels: Array<{ channel_name: string; gmv: number; orders: number }>
  daily: Array<{ biz_date: string; gmv: number; orders: number }>
}

function fmt(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}

export function ShopOverviewPage() {
  const { currentPlatform, currentShop } = usePlatform()
  const navigate = useNavigate()
  const [data, setData] = useState<ShopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) {
      setLoading(false)
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fromD = new Date()
      fromD.setDate(fromD.getDate() - days + 1)
      const from = fromD.toISOString().slice(0, 10)
      const d = await api.get<ShopDetail>(`/omnichannel/shop/${currentShop.id}`, { from, to })
      setData(d)
    } catch (e: any) {
      setError(e?.message || '加载店铺数据失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, days])

  useEffect(() => { load() }, [load])

  const isContentMode = currentPlatform?.capabilities?.supportsContent && !currentPlatform?.capabilities?.supportsLive
  const title = '店铺经营看板'

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {currentShop ? `${currentShop.name} · ${currentPlatform?.platform_name || ''}` : '未选择店铺'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isContentMode && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/shop/xiaohongshu/notes')}>
                笔记内容看板 <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
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
        </div>
      </motion.div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
      )}

      {!currentShop?.id ? (
        <Card>
          <CardBody>
            <div className="py-14 text-center">
              <Store className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">当前平台下暂无在营店铺</p>
              <p className="mt-1 text-xs text-slate-600">请先在「多平台接入」中导入该平台的经营数据</p>
              <Button className="mt-4" onClick={() => navigate('/data/ingest')}>
                去导入数据 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : data && (data.trade.gmv > 0 || data.daily.length > 0) ? (
        <>
          {/* 核心指标 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={ShoppingCart} label="成交金额" value={fmt(data.trade.gmv)} unit="元" />
            <MetricCard icon={Store} label="支付订单数" value={String(data.trade.paidOrderCount)} unit="单" />
            <MetricCard icon={Users} label="支付买家数" value={String(data.trade.paidBuyerCount)} unit="人" />
            <MetricCard icon={Wallet} label="客单价" value={fmt(data.trade.avgOrderValue)} unit="元" />
            <MetricCard icon={Undo2} label="退款金额" value={fmt(data.trade.refundAmount)} unit="元" warn={data.trade.refundRate > 10} />
            <MetricCard icon={Percent} label="退款率" value={data.trade.refundRate + '%'} warn={data.trade.refundRate > 10} />
            <MetricCard icon={TrendingUp} label="展现量" value={fmt(data.traffic.impressions)} unit="次" />
            <MetricCard icon={Megaphone} label="点击率" value={data.traffic.ctr + '%'} />
          </motion.div>

          {/* 日趋势 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>成交趋势</CardHeader>
              <CardBody>
                {data.daily.length === 0 ? (
                  <EmptyHint />
                ) : (
                  <div className="flex h-40 items-end gap-1">
                    {data.daily.map((d) => {
                      const max = Math.max(...data.daily.map((x) => x.gmv), 1)
                      return (
                        <div key={d.biz_date} className="group relative flex-1">
                          <div
                            className="rounded-t bg-gradient-to-t from-cyan-600/60 to-cyan-400/80 transition-all hover:from-cyan-500 hover:to-cyan-300"
                            style={{ height: `${Math.max((d.gmv / max) * 140, 2)}px` }}
                          />
                          <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-slate-200 ring-1 ring-slate-700 group-hover:block">
                            {d.biz_date}<br />{fmt(d.gmv)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* 渠道结构 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>流量渠道结构</CardHeader>
              <CardBody>
                {data.channels.length === 0 ? (
                  <EmptyHint />
                ) : (
                  <div className="space-y-2">
                    {data.channels.map((c, i) => {
                      const max = data.channels[0]?.gmv || 1
                      return (
                        <div key={c.channel_name} className="flex items-center gap-3">
                          <span className="w-5 text-xs text-slate-500">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm text-slate-200">{c.channel_name}</span>
                              <span className="shrink-0 font-mono text-xs text-slate-400">
                                {fmt(c.gmv)} 元 / {c.orders} 单
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400"
                                style={{ width: `${Math.max((c.gmv / max) * 100, 1)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>
        </>
      ) : (
        <Card>
          <CardBody>
            <div className="py-14 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-amber-500/60" />
              <p className="mt-3 text-sm text-slate-400">该店铺在选定周期内暂无经营数据</p>
              <p className="mt-1 text-xs text-slate-600">近 {days} 天��没有导入记录</p>
              <Button className="mt-4" onClick={() => navigate('/data/ingest')}>
                去导入数据 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon, label, value, unit, warn,
}: { icon: any; label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={cn('text-lg font-semibold', warn ? 'text-rose-400' : 'text-slate-100')}>{value}</span>
        {unit && <span className="text-[11px] text-slate-500">{unit}</span>}
        {warn && <Badge variant="danger">偏高</Badge>}
      </div>
    </div>
  )
}

function EmptyHint() {
  return <div className="py-10 text-center text-xs text-slate-500">暂无数据</div>
}
