import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Store, ShoppingCart, Users, Percent, TrendingUp, Package, AlertTriangle, Info,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface ShopMetrics {
  shopId: number
  shopName: string
  shopType: string | null
  payAmount: number
  payBuyerCount: number
  payOrderCount: number
  avgOrderValue: number
  payConversionRate: number | null
  visitors: number
  pageViews: number
  itemCount: number
  activeItemCount: number
  sellThroughRate: number | null
  refundAmount: number
  refundRate: number
  caliber: { amountType: string; amountTypeName: string; displayNote: string } | null
}

const SHOP_TYPE_LABEL: Record<string, string> = {
  taobao_personal: '淘宝个人店',
  taobao_enterprise: '淘宝企业店',
  tmall: '天猫店',
}

/** 百分比显示：固定 2 位小数（后端可能返回 1，实际表示 1.00%） */
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(2) + '%'
}

function fmt(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}

export function TaobaoShopBoardPage() {
  const { currentPlatform, currentShop } = usePlatform()
  const [data, setData] = useState<ShopMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); setData(null); return }
    setLoading(true)
    setError(null)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const d = await api.get<ShopMetrics>(`/taobao/shop/${currentShop.id}/metrics`, {
        from: fd.toISOString().slice(0, 10), to,
      })
      setData(d)
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, days])

  useEffect(() => { load() }, [load])

  const isTmall = currentPlatform?.platform_code === 'tmall'

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              {isTmall ? '天猫' : '淘宝'}店铺经营
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {currentShop ? `${currentShop.name}` : '未选择店铺'}
              {data?.shopType && <span className="ml-2 text-[var(--text-muted)]">({SHOP_TYPE_LABEL[data.shopType] || data.shopType})</span>}
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
              >近 {d} 天</button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 口径说明 —— 这是淘系最关键的设计 */}
      {data?.caliber && (
        <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <span className="font-medium">当前口径：{data.caliber.amountTypeName}（{data.caliber.amountType}）</span>
            <p className="mt-1 text-cyan-400/70">{data.caliber.displayNote}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
      )}

      {!currentShop?.id ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Store className="mx-auto h-10 w-10 text-[var(--text-primary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">当前平台下暂无店铺</p>
            <p className="mt-1 text-xs text-[var(--text-primary)]">请先在「多平台接入」导入数据</p>
          </div>
        </CardBody></Card>
      ) : loading ? (
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">加载中…</div>
      ) : data ? (
        <>
          {/* 核心指标 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={ShoppingCart} label="支付金额" value={fmt(data.payAmount)} unit="元" />
            <Metric icon={Users} label="支付买家数" value={String(data.payBuyerCount)} unit="人" />
            <Metric icon={Percent} label="支付转化率" value={fmtPct(data.payConversionRate)} />
            <Metric icon={ShoppingCart} label="客单价" value={fmt(data.avgOrderValue)} unit="元" />
            <Metric icon={TrendingUp} label="访客数" value={String(data.visitors)} unit="人" />
            <Metric icon={Package} label="商品动销率" value={fmtPct(data.sellThroughRate)} />
            <Metric icon={Package} label="动销商品数" value={`${data.activeItemCount} / ${data.itemCount}`} />
            <Metric
              icon={Percent}
              label="退款率"
              value={fmtPct(data.refundRate)}
              warn={data.refundRate > 10}
            />
          </motion.div>

          {/* 父子订单说明 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" /> 订单结构
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-[var(--border)] bg-orbit-ink/40 p-3">
                    <div className="text-xs text-[var(--text-muted)]">支付订单数（父订单）</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{data.payOrderCount}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">一次付款计一单</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-orbit-ink/40 p-3">
                    <div className="text-xs text-[var(--text-muted)]">动销 SKU 数</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{data.activeItemCount}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">商品×SKU 明细粒度</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-orbit-ink/40 p-3">
                    <div className="text-xs text-[var(--text-muted)]">退款金额</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{fmt(data.refundAmount)}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">未从支付金额中扣除</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {data.payAmount === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              该店铺在选定周期内暂无交易数据。淘宝/天猫需从「生意参谋 → 自助取数」导出后，通过「多平台接入」导入。
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function Metric({ icon: Icon, label, value, unit, warn }: {
  icon: any; label: string; value: string; unit?: string; warn?: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-orbit-ink/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`text-lg font-semibold ${warn ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>{value}</span>
        {unit && <span className="text-[11px] text-[var(--text-muted)]">{unit}</span>}
        {warn && <Badge variant="danger">偏高</Badge>}
      </div>
    </div>
  )
}
