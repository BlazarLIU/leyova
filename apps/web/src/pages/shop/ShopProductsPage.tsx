import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, ArrowRight, Info, TrendingUp, Boxes, ShoppingBag, Lock } from 'lucide-react'
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

interface ShopSkuSalesItem {
  productId: number
  spuCode: string
  skuCode: string
  productName: string
  category: string
  platformSkuId: string
  soldQty: number
  orderCount: number
  paidAmount: number
  discountAllocated: number
  avgUnitPrice: number
  retailPrice: number
  unitCost: number | null
  estimatedCost: number | null
  estimatedProfit: number | null
  marginRatePct: number | null
}

interface ShopSkuSalesResponse {
  costMasked: boolean
  summary: {
    totalSkuCount: number
    totalSoldQty: number
    totalPaidAmount: number
    totalDiscountAllocated: number
  }
  items: ShopSkuSalesItem[]
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
 * 商品结构与 SKU 销售映射页
 *
 * 结合 `/omnichannel/shop/:id/products`（canonical_order_items 聚合的 SKU 级销量/实付/分摊优惠/脱敏毛利）、
 * `/inventory/products`（主商品与平台 SKU 映射库存）及 `/omnichannel/shop/:id`（渠道贡献与日成交），
 * 完整呈现店铺商品结构视角。
 */
export function ShopProductsPage() {
  const { currentPlatform, currentShop } = usePlatform()
  const navigate = useNavigate()
  const [data, setData] = useState<ShopDetail | null>(null)
  const [skuSales, setSkuSales] = useState<ShopSkuSalesResponse | null>(null)
  const [products, setProducts] = useState<InventoryProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    const platformCode = currentPlatform?.platform_code
    if (!currentShop?.id && !platformCode) {
      setLoading(false)
      setData(null)
      setSkuSales(null)
      setProducts([])
      return
    }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fromD = new Date()
      fromD.setDate(fromD.getDate() - days + 1)
      const from = fromD.toISOString().slice(0, 10)
      const [shopRes, skuRes, prodRes] = await Promise.all([
        currentShop?.id
          ? api.get<ShopDetail>(`/omnichannel/shop/${currentShop.id}`, { from, to }).catch(() => null)
          : Promise.resolve(null),
        currentShop?.id
          ? api.get<ShopSkuSalesResponse>(`/omnichannel/shop/${currentShop.id}/products`, { from, to }).catch(() => null)
          : Promise.resolve(null),
        platformCode
          ? api.get<InventoryProductRow[]>('/inventory/products', { platformCode }).catch(() => [])
          : Promise.resolve([]),
      ])
      setData(shopRes)
      setSkuSales(skuRes)
      setProducts(Array.isArray(prodRes) ? prodRes : [])
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, currentPlatform?.platform_code, days])

  useEffect(() => { load() }, [load])

  const hasTradeData = !!data && (data.trade.gmv > 0 || data.channels.length > 0)
  const hasSkuSales = !!skuSales && skuSales.items.length > 0
  const hasProducts = products.length > 0
  const lowStockCount = products.filter((p) => p.isLowStock).length

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">商品与 SKU 结构分析</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {currentShop ? `${currentShop.name} · ${currentPlatform?.platform_name || ''}` : (currentPlatform?.platform_name || '未选择店铺')}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded px-3 py-1.5 text-xs transition ${
                  days === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
          已打通 <code>canonical_order_items</code>（SKU 级子订单明细销量/实付/优惠分摊）与
          <code>dim_product</code> / <code>dim_sku_mapping</code>（主商品与库存映射），下方同时保留店铺渠道结构供对照。
        </div>
      </div>

      {!currentShop?.id && !hasProducts ? (
        <Card><CardBody><Empty text="当前平台下暂无在营店铺与商品映射" onGo={() => navigate('/data/ingest')} /></CardBody></Card>
      ) : loading ? (
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">加载中…</div>
      ) : !hasTradeData && !hasProducts && !hasSkuSales ? (
        <Card><CardBody><Empty text="该店铺在选定周期内暂无商品与成交数据" onGo={() => navigate('/data/ingest')} /></CardBody></Card>
      ) : (
        <>
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-4">
            <Stat label="在售动销 SKU / 总映射" value={`${skuSales?.summary.totalSkuCount || 0} / ${products.length}`} unit="个" />
            <Stat label="SKU 实付总额（明细）" value={(skuSales?.summary.totalPaidAmount || 0).toFixed(2)} unit="元" />
            <Stat label="低库存预警 SKU" value={String(lowStockCount)} unit="个" />
            <Stat label="店铺成交 / 客单" value={data ? `¥${data.trade.gmv.toFixed(0)} / ¥${data.trade.avgOrderValue.toFixed(0)}` : '¥0'} unit="" />
          </motion.div>

          {hasSkuSales && skuSales && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-emerald-400" /> 商品 SKU 销量与盈利排行（来自交易明细）
                    </div>
                    {skuSales.costMasked && (
                      <Badge variant="neutral">
                        <Lock className="h-3 w-3" /> 成本与估算毛利已按权限脱敏
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                          <th className="py-2 pr-3">商品 / SPU</th>
                          <th className="py-2 pr-3">内部 SKU / 平台 SKU</th>
                          <th className="py-2 pr-3 text-right">销售件数</th>
                          <th className="py-2 pr-3 text-right">订单数</th>
                          <th className="py-2 pr-3 text-right">实付成交额</th>
                          <th className="py-2 pr-3 text-right">分摊优惠</th>
                          <th className="py-2 pr-3 text-right">成交均价</th>
                          <th className="py-2 text-right">估算毛利 / 毛利率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skuSales.items.map((item) => (
                          <tr key={`${item.skuCode}-${item.platformSkuId}`} className="border-b border-[var(--border)] text-[var(--text-secondary)] hover:bg-orbit-ink/30">
                            <td className="py-2.5 pr-3">
                              <div className="font-medium text-[var(--text-primary)]">{item.productName}</div>
                              <div className="font-mono text-[11px] text-[var(--text-muted)]">{item.spuCode || '—'} · {item.category}</div>
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-xs">
                              <div className="text-cyan-300">{item.skuCode}</div>
                              <div className="text-[11px] text-[var(--text-muted)]">{item.platformSkuId || '—'}</div>
                            </td>
                            <td className="py-2.5 pr-3 text-right font-mono">{item.soldQty.toFixed(0)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono">{item.orderCount}</td>
                            <td className="py-2.5 pr-3 text-right font-mono text-[var(--text-primary)]">¥{item.paidAmount.toFixed(2)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono text-amber-300">¥{item.discountAllocated.toFixed(2)}</td>
                            <td className="py-2.5 pr-3 text-right font-mono">¥{item.avgUnitPrice.toFixed(2)}</td>
                            <td className="py-2.5 text-right font-mono">
                              {skuSales.costMasked || item.estimatedProfit === null ? (
                                <span className="text-xs text-[var(--text-muted)]">已脱敏</span>
                              ) : (
                                <span className={item.estimatedProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'}>
                                  ¥{item.estimatedProfit.toFixed(2)} ({item.marginRatePct?.toFixed(1)}%)
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {hasProducts && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-cyan-400" /> 平台主商品与 SKU 映射库存
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/ops/inventory')}>
                      前往商品库存中心 <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
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
                            <tr key={p.id} className="border-b border-[var(--border)] text-[var(--text-secondary)] hover:bg-orbit-ink/30">
                              <td className="py-2.5 pr-3">
                                <div className="font-medium text-[var(--text-primary)]">{p.productName}</div>
                                <div className="font-mono text-[11px] text-[var(--text-muted)]">{p.spuCode}</div>
                              </td>
                              <td className="py-2.5 pr-3 font-mono text-xs text-cyan-300">{p.skuCode}</td>
                              <td className="py-2.5 pr-3 text-xs text-[var(--text-muted)]">{p.category}</td>
                              <td className="py-2.5 pr-3 text-right font-mono">¥{p.retailPrice.toFixed(2)}</td>
                              <td className="py-2.5 pr-3 text-right font-mono">
                                <span className={p.isLowStock ? 'text-rose-400 font-semibold' : 'text-[var(--text-secondary)]'}>
                                  {p.availableQty}
                                </span>
                                <span className="text-[var(--text-muted)]"> / {p.safetyStock}</span>
                              </td>
                              <td className="py-2.5 pr-3 text-xs text-[var(--text-muted)]">
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
                      <div className="py-8 text-center text-xs text-[var(--text-muted)]">暂无渠道数据</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
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
                                <tr key={c.channel_name} className="border-b border-[var(--border)] text-[var(--text-secondary)] hover:bg-orbit-ink/30">
                                  <td className="py-2 pr-3 text-[var(--text-secondary)]">{c.channel_name}</td>
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
                          <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                            <th className="py-2 pr-3">日期</th>
                            <th className="py-2 pr-3 text-right">成交金额</th>
                            <th className="py-2 pr-3 text-right">订单数</th>
                            <th className="py-2 text-right">客单价</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.daily.slice().reverse().map((d) => (
                            <tr key={d.biz_date} className="border-b border-[var(--border)] text-[var(--text-secondary)]">
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
    <div className="rounded-xl border border-[var(--border)] bg-orbit-ink/40 p-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-lg font-semibold text-[var(--text-primary)]">{value}</span>
        <span className="text-[11px] text-[var(--text-muted)]">{unit}</span>
      </div>
    </div>
  )
}

function Empty({ text, onGo }: { text: string; onGo: () => void }) {
  return (
    <div className="py-14 text-center">
      <Package className="mx-auto h-10 w-10 text-[var(--text-primary)]" />
      <p className="mt-3 text-sm text-[var(--text-muted)]">{text}</p>
      <Button className="mt-4" onClick={onGo}>
        去导入数据 <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  )
}
