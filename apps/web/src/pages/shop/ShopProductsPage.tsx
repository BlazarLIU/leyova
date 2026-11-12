import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, ArrowRight, Info, TrendingUp, Boxes } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
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

interface SkuMappingItem {
  id: number
  platformCode: string
  shopId: number | null
  shopName: string | null
  platformItemId: string
  platformSkuId: string
}

interface InventoryProductRow {
  id: number
  spuCode: string
  skuCode: string
  productName: string
  category: string
  brandName: string
  retailPrice: number
  onHandQty: number
  lockedQty: number
  inTransitQty: number
  availableQty: number
  safetyStock: number
  isLowStock: boolean
  skuMappings: SkuMappingItem[]
}

/**
 * 商品结构与 SKU 映射页
 *
 * 结合 `/inventory/products`（主商品与平台 SKU 映射库存）和 `/omnichannel/shop/:id`（店铺渠道/日粒度成交），
 * 真实呈现当前平台与店铺关联的商品明细及渠道结构，不做假数据填充。
 */
export function ShopProductsPage() {
  const { currentPlatform, currentShop } = usePlatform()
  const navigate = useNavigate()
  const [data, setData] = useState<ShopDetail | null>(null)
  const [products, setProducts] = useState<InventoryProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    const platformCode = currentPlatform?.platform_code
    if (!currentShop?.id && !platformCode) {
      setLoading(false)
      setData(null)
      setProducts([])
      return
    }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fromD = new Date()
      fromD.setDate(fromD.getDate() - days + 1)
      const [shopRes, prodRes] = await Promise.all([
        currentShop?.id
          ? api.get<ShopDetail>(`/omnichannel/shop/${currentShop.id}`, {
              from: fromD.toISOString().slice(0, 10),
              to,
            }).catch(() => null)
          : Promise.resolve(null),
        platformCode
          ? api.get<InventoryProductRow[]>('/inventory/products', { platformCode }).catch(() => [])
          : Promise.resolve([]),
      ])
      setData(shopRes)
      setProducts(Array.isArray(prodRes) ? prodRes : [])
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, currentPlatform?.platform_code, days])

  useEffect(() => { load() }, [load])

  const hasTradeData = !!data && (data.trade.gmv > 0 || data.channels.length > 0)
  const hasProducts = products.length > 0
  const lowStockCount = products.filter((p) => p.isLowStock).length

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">商品与 SKU 结构分析</h1>
            <p className="mt-1 text-sm text-slate-400">
              {currentShop ? `${currentShop.name} · ${currentPlatform?.platform_name || ''}` : (currentPlatform?.platform_name || '未选择店铺')}
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

      <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          已关联当前平台主商品目录与 SKU 映射库存（来自 <code>dim_product</code> / <code>dim_sku_mapping</code>）；
          成交事实表按「店铺 × 日期 × 渠道」统计，下方同步保留渠道贡献结构供对照。
        </div>
      </div>

      {!currentShop?.id && !hasProducts ? (
        <Card><CardBody><Empty text="当前平台下暂无在营店铺与商品映射" onGo={() => navigate('/data/ingest')} /></CardBody></Card>
      ) : loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !hasTradeData && !hasProducts ? (
        <Card><CardBody><Empty text="该店铺在选定周期内暂无商品与成交数据" onGo={() => navigate('/data/ingest')} /></CardBody></Card>
      ) : (
        <>
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-4">
            <Stat label="平台关联 SKU" value={String(products.length)} unit="个" />
            <Stat label="低库存预警 SKU" value={String(lowStockCount)} unit="个" />
            <Stat label="店铺成交金额" value={data ? data.trade.gmv.toFixed(2) : '0.00'} unit="元" />
            <Stat label="支付订单 / 客单" value={data ? `${data.trade.paidOrderCount} / ¥${data.trade.avgOrderValue.toFixed(0)}` : '0'} unit="" />
          </motion.div>

          {hasProducts && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-cyan-400" /> 平台主商品与 SKU 映射库存
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
                      前往商品库存中心 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                          <th className="py-2 pr-3">商品名称 / SPU</th>
                          <th className="py-2 pr-3">SKU 编码</th>
                          <th className="py-2 pr-3">品类</th>
                          <th className="py-2 pr-3 text-right">零售价</th>
                          <th className="py-2 pr-3 text-right">可用 / 安全库存</th>
                          <th className="py-2 pr-3">平台映射 ID</th>
                          <th className="py-2 text-right">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => {
                          const platMaps = p.skuMappings.filter(
                            (m) => m.platformCode === currentPlatform?.platform_code,
                          )
                          return (
                            <tr key={p.id} className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/30">
                              <td className="py-2.5 pr-3">
                                <div className="font-medium text-slate-100">{p.productName}</div>
                                <div className="font-mono text-[11px] text-slate-500">{p.spuCode}</div>
                              </td>
                              <td className="py-2.5 pr-3 font-mono text-xs text-cyan-300">{p.skuCode}</td>
                              <td className="py-2.5 pr-3 text-xs text-slate-400">{p.category}</td>
                              <td className="py-2.5 pr-3 text-right font-mono">¥{p.retailPrice.toFixed(2)}</td>
                              <td className="py-2.5 pr-3 text-right font-mono">
                                <span className={p.isLowStock ? 'text-rose-400 font-semibold' : 'text-slate-200'}>
                                  {p.availableQty}
                                </span>
                                <span className="text-slate-500"> / {p.safetyStock}</span>
                              </td>
                              <td className="py-2.5 pr-3 text-xs text-slate-400">
                                {platMaps.length > 0 ? (
                                  <div className="space-y-0.5 font-mono text-[11px]">
                                    {platMaps.map((m) => (
                                      <div key={m.id}>
                                        {m.platformItemId} / {m.platformSkuId}
                                      </div>
                                    ))}
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="py-2.5 text-right">
                                <Badge variant={p.isLowStock ? 'danger' : 'success'}>
                                  {p.isLowStock ? '低库存预警' : '库存充足'}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {hasTradeData && data && (
            <>
              <motion.div {...fadeIn}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" /> 渠道贡献结构
                    </div>
                  </CardHeader>
                  <CardBody>
                    {data.channels.length === 0 ? (
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
                            {data.channels.map((c) => {
                              const total = data.trade.gmv || 1
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
                          {data.daily.slice().reverse().map((d) => (
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
