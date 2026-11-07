import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, ArrowRight, AlertTriangle, TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface ChannelRow {
  channel_name: string
  gmv: number
  orders: number
}

interface ShopDetail {
  shop: { id: number; shop_name: string }
  trade: { gmv: number; paidOrderCount: number; avgOrderValue: number; refundRate: number }
  channels: ChannelRow[]
  daily: Array<{ biz_date: string; gmv: number; orders: number }>
}

/**
 * 商品结构分析页
 *
 * 说明：当前语义层与事实表尚无商品（SKU）粒度数据，
 * 本页先基于现有的渠道/日粒度数据做「结构视角」分析，
 * 并在页面明示数据粒度限制，不做假数据填充。
 */
export function ShopProductsPage() {
  const { currentPlatform, currentShop } = usePlatform()
  const navigate = useNavigate()
  const [data, setData] = useState<ShopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); setData(null); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fromD = new Date()
      fromD.setDate(fromD.getDate() - days + 1)
      const d = await api.get<ShopDetail>(`/omnichannel/shop/${currentShop.id}`, {
        from: fromD.toISOString().slice(0, 10), to,
      })
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, days])

  useEffect(() => { load() }, [load])

  const hasData = !!data && (data.trade.gmv > 0 || data.channels.length > 0)

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">商品结构分析</h1>
            <p className="mt-1 text-sm text-slate-400">
              {currentShop ? `${currentShop.name} · ${currentPlatform?.platform_name || ''}` : '未选择店铺'}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded px-3 py-1.5 text-xs transition ${
                  days === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                近 {d} 天
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 数据粒度说明：如实告知限制，不假装有 SKU 数据 */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          当前事实表按「店铺 × 日期 × 渠道」粒度汇总，<strong>尚未采集到商品/SKU 级明细</strong>。
          下方展示的是店铺维度的结构视角；商品级分析需在导入时提供含商品 ID 的数据源。
        </div>
      </div>

      {!currentShop?.id ? (
        <Card><CardBody><Empty text="当前平台下暂无在营店铺" onGo={() => navigate('/data/ingest')} /></CardBody></Card>
      ) : loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody><Empty text="该店铺在选定周期内暂无数据" onGo={() => navigate('/data/ingest')} /></CardBody></Card>
      ) : (
        <>
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-3">
            <Stat label="店铺成交金额" value={data!.trade.gmv.toFixed(2)} unit="元" />
            <Stat label="支付订单数" value={String(data!.trade.paidOrderCount)} unit="单" />
            <Stat label="客单价" value={data!.trade.avgOrderValue.toFixed(2)} unit="元" />
          </motion.div>

          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" /> 渠道贡献结构（商品明细的替代视角）
                </div>
              </CardHeader>
              <CardBody>
                {data!.channels.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">暂无渠道数据</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                          <th className="py-2 pr-3">渠道</th>
                          <th className="py-2 pr-3 text-right">成交金额</th>
                          <th className="py-2 pr-3 text-right">订单数</th>
                          <th className="py-2 pr-3 text-right">占比</th>
                          <th className="py-2 text-right">单均价值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.channels.map((c) => {
                          const total = data!.trade.gmv || 1
                          return (
                            <tr key={c.channel_name} className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/30">
                              <td className="py-2 pr-3 text-slate-200">{c.channel_name}</td>
                              <td className="py-2 pr-3 text-right font-mono">{c.gmv.toFixed(2)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{c.orders}</td>
                              <td className="py-2 pr-3 text-right text-cyan-400">
                                {((c.gmv / total) * 100).toFixed(2)}%
                              </td>
                              <td className="py-2 text-right font-mono">
                                {c.orders > 0 ? (c.gmv / c.orders).toFixed(2) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          <motion.div {...fadeIn}>
            <Card>
              <CardHeader><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> 日成交明细</div></CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                        <th className="py-2 pr-3">日期</th>
                        <th className="py-2 pr-3 text-right">成交金额</th>
                        <th className="py-2 pr-3 text-right">订单数</th>
                        <th className="py-2 text-right">客单价</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.daily.slice().reverse().map((d) => (
                        <tr key={d.biz_date} className="border-b border-slate-800/60 text-slate-300">
                          <td className="py-2 pr-3 font-mono text-xs">{String(d.biz_date).slice(0, 10)}</td>
                          <td className="py-2 pr-3 text-right font-mono">{d.gmv.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-right font-mono">{d.orders}</td>
                          <td className="py-2 text-right font-mono">
                            {d.orders > 0 ? (d.gmv / d.orders).toFixed(2) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-lg font-semibold text-slate-100">{value}</span>
        <span className="text-[11px] text-slate-500">{unit}</span>
      </div>
    </div>
  )
}

function Empty({ text, onGo }: { text: string; onGo: () => void }) {
  return (
    <div className="py-14 text-center">
      <Package className="mx-auto h-10 w-10 text-slate-600" />
      <p className="mt-3 text-sm text-slate-400">{text}</p>
      <Button className="mt-4" onClick={onGo}>
        去导入数据 <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  )
}
