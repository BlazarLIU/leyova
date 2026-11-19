import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Package, Megaphone, Star, Info } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface ProductRow {
  skuCode: string
  payAmount: number
  refundAmount: number
  quantity: number
  orderCount: number
  avgPrice: number
}

interface ChannelRow {
  level1: string
  level2: string
  gmv: number
  visitors: number
  share: number
}

interface DsrStatus {
  dsr: { descriptionMatch: number | null; serviceAttitude: number | null; logisticsService: number | null }
  window: string
  onlyRefundAutonomy: boolean
  threshold: number
  note: string
}

function fmtMoney(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}

export function TaobaoProductChannelPage() {
  const { currentShop } = usePlatform()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [dsr, setDsr] = useState<DsrStatus | null>(null)
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
      const [p, c, d] = await Promise.all([
        api.get<{ products: ProductRow[] }>(`/taobao/shop/${currentShop.id}/products`, { from, to }).catch(() => null),
        api.get<{ channels: ChannelRow[] }>(`/taobao/shop/${currentShop.id}/channels`, { from, to }).catch(() => null),
        api.get<DsrStatus>(`/taobao/shop/${currentShop.id}/dsr`).catch(() => null),
      ])
      setProducts(p?.products || [])
      setChannels(c?.channels || [])
      setDsr(d)
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, days])

  useEffect(() => { load() }, [load])

  const hasProducts = products.length > 0
  const hasChannels = channels.length > 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">商品与渠道结构</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {currentShop ? currentShop.name : '未选择店铺'} · 父子订单明细与淘系三级渠道
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded px-3 py-1.5 text-xs transition ${days === d ? 'bg-orbit-success/20 text-status-ai' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}>近 {d} 天</button>
            ))}
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">加载中…</div>
      ) : (
        <>
          {/* 商品结构（父子订单） */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" /> 商品结构（SKU 粒度）
                  <span className="text-xs font-normal text-[var(--text-muted)]">数据源：父子订单明细表</span>
                </div>
              </CardHeader>
              <CardBody>
                {!hasProducts ? (
                  <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                    暂无商品明细数据。淘系的父子订单结构（父订单=一次付款，子订单=商品×SKU）
                    需从生意参谋「交易-订单明细」导出后导入。
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                          <th className="py-2 pr-3">SKU 编码</th>
                          <th className="py-2 pr-3 text-right">成交金额</th>
                          <th className="py-2 pr-3 text-right">退款金额</th>
                          <th className="py-2 pr-3 text-right">销量</th>
                          <th className="py-2 pr-3 text-right">子订单数</th>
                          <th className="py-2 text-right">平均单价</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={p.skuCode} className="border-b border-[var(--border)] text-[var(--text-secondary)] hover:bg-orbit-ink/30">
                            <td className="py-2 pr-3 font-mono text-xs text-[var(--text-secondary)]">{p.skuCode}</td>
                            <td className="py-2 pr-3 text-right font-mono">{fmtMoney(p.payAmount)}</td>
                            <td className="py-2 pr-3 text-right font-mono text-status-danger">
                              {p.refundAmount > 0 ? fmtMoney(p.refundAmount) : '-'}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{p.quantity}</td>
                            <td className="py-2 pr-3 text-right font-mono">{p.orderCount}</td>
                            <td className="py-2 text-right font-mono">{p.payAmount > 0 ? p.avgPrice.toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* 淘系三级渠道 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" /> 淘系三级渠道结构
                  <span className="text-xs font-normal text-[var(--text-muted)]">自然搜索 / 推荐 / 私域 / 内容</span>
                </div>
              </CardHeader>
              <CardBody>
                {!hasChannels ? (
                  <div className="py-10 text-center text-xs text-[var(--text-muted)]">暂无渠道数据</div>
                ) : (
                  <div className="space-y-2">
                    {channels.map((c) => (
                      <div key={`${c.level1}-${c.level2}`} className="flex items-center gap-3">
                        <div className="w-32 shrink-0">
                          <div className="text-sm text-[var(--text-secondary)]">{c.level1}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{c.level2}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-baseline justify-between">
                            <span className="font-mono text-xs text-[var(--text-muted)]">{fmtMoney(c.gmv)} 元</span>
                            <span className="text-xs text-status-ai">{c.share}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-orbit-ink">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-orbit-success to-orbit-success"
                              style={{ width: `${Math.max(c.share, 1)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* DSR */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" /> DSR 与仅退款自主权
                  {dsr && !dsr.onlyRefundAutonomy && <Badge variant="neutral">待接入</Badge>}
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: '描述相符', v: dsr?.dsr.descriptionMatch },
                    { label: '服务态度', v: dsr?.dsr.serviceAttitude },
                    { label: '物流服务', v: dsr?.dsr.logisticsService },
                  ].map((d) => (
                    <div key={d.label} className="rounded-lg border border-[var(--border)] bg-orbit-ink/40 p-3">
                      <div className="text-xs text-[var(--text-muted)]">{d.label}</div>
                      <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                        {d.v !== null && d.v !== undefined ? d.v.toFixed(2) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-orbit-ink/40 px-3 py-2 text-xs">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                  <div>
                    <span className="text-[var(--text-secondary)]">统计窗口：{dsr?.window || '最近 180 天滚动'}</span>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                      {dsr?.note || `店铺综合体验分 ≥ ${dsr?.threshold || 4.8} 时，平台不主动介入收货后仅退款`}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-[var(--text-primary)]">
                  说明：DSR 三项评分需从生意参谋「服务-评价分析」导出后接入，当前无数据源。
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}
