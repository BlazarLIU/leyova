import { useEffect, useState, useMemo, Fragment } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { cn } from '@/utils/cn'
import {
  DollarSign, ShoppingCart, RotateCcw, Search, ArrowUpDown,
  ChevronDown, ChevronRight, Package,
  AlertTriangle, Calendar, Monitor,
} from 'lucide-react'

// ─── Types ───
interface Session {
  id: number
  room_id: number
  title?: string
  room_name?: string
  business_date: string
  anchor_name?: string
}

interface SkuItem {
  id: number
  product_id: number
  sku_name: string
  sku_image: string
  payment_amount: number
  sold_count: number
  buyer_count: number
  order_count: number
}

interface ProductItem {
  id: number
  session_id: number | null
  room_id: number
  business_date: string
  product_order: number
  product_name: string
  product_id: string
  product_image: string
  payment_amount: number
  sold_count: number
  buyer_count: number
  order_count: number
  pre_sale_orders: number
  pre_sale_amount: number
  exposure_users: number
  click_users: number
  exposure_click_rate: number
  click_deal_rate: number
  refund_users: number
  refund_amount: number
  refund_orders: number
  skus: SkuItem[]
}

type SortKey = 'payment_amount' | 'sold_count' | 'buyer_count' | 'exposure_users' | 'click_users' | 'exposure_click_rate' | 'click_deal_rate' | 'product_order'
type SortDir = 'asc' | 'desc'

// ─── Constants ───
const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay },
})

const stagger = (index: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay: index * 0.04 },
})

// ─── Helpers ───
function toNum(v: any): number {
  const n = typeof v === 'number' ? v : Number(v)
  return isNaN(n) ? 0 : n
}

function formatCurrency(value: any): string {
  const n = toNum(value)
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
}

function formatNumber(value: any): string {
  const n = toNum(value)
  return n.toLocaleString()
}

function formatPercent(value: any): string {
  const n = toNum(value)
  return `${(n * 100).toFixed(2)}%`
}

// ─── Sub-components ───

/** 1. Session Filter Bar */
function SessionFilter({
  sessions,
  selectedRoomId,
  selectedDate,
  onRoomChange,
  onDateChange,
  loading,
}: {
  sessions: Session[]
  selectedRoomId: string
  selectedDate: string
  onRoomChange: (v: string) => void
  onDateChange: (v: string) => void
  loading: boolean
}) {
  // Deduplicate rooms and dates
  const rooms = useMemo(() => {
    const map = new Map<number, string>()
    sessions.forEach((s) => map.set(s.room_id, s.room_name ?? ''))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [sessions])

  const dates = useMemo(() => {
    const set = new Set<string>()
    sessions.forEach((s) => set.add(s.business_date))
    return Array.from(set).sort()
  }, [sessions])

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 直播间 */}
      <div className="relative">
        <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <select
          value={selectedRoomId}
          onChange={(e) => onRoomChange(e.target.value)}
          disabled={loading}
          className="appearance-none bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50 min-w-[130px] disabled:opacity-50"
        >
          <option value="">全部直播间</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* 日期 */}
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <select
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={loading}
          className="appearance-none bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50 min-w-[140px] disabled:opacity-50"
        >
          <option value="">全部日期</option>
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  )
}

/** 2. Overview Cards */
function OverviewCards({ products }: { products: ProductItem[] }) {
  const totals = useMemo(() => {
    const paymentAmount = products.reduce((sum, p) => sum + toNum(p.payment_amount), 0)
    const soldCount = products.reduce((sum, p) => sum + (p.sold_count || 0), 0)
    const refundAmount = products.reduce((sum, p) => sum + toNum(p.refund_amount), 0)
    const refundUsers = products.reduce((sum, p) => sum + (p.refund_users || 0), 0)
    const buyerCount = products.reduce((sum, p) => sum + (p.buyer_count || 0), 0)
    return { paymentAmount, soldCount, refundAmount, refundUsers, buyerCount }
  }, [products])

  const cards = [
    {
      label: '支付金额',
      value: formatCurrency(totals.paymentAmount),
      icon: DollarSign,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/15',
    },
    {
      label: '售出件数',
      value: formatNumber(totals.soldCount),
      icon: ShoppingCart,
      color: 'text-orbit-info',
      bgColor: 'bg-orbit-info/15',
    },
    {
      label: '退款金额',
      value: formatCurrency(totals.refundAmount),
      icon: RotateCcw,
      color: 'text-red-400',
      bgColor: 'bg-red-500/15',
      sub: `退款用户 ${formatNumber(totals.refundUsers)}`,
    },
    {
      label: '购买用户',
      value: formatNumber(totals.buyerCount),
      icon: Package,
      color: 'text-orbit-primary',
      bgColor: 'bg-orbit-primary/15',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div key={card.label} {...fadeUp(0.05 + i * 0.05)}>
          <Card>
            <CardBody>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[var(--text-muted)] text-xs font-medium">{card.label}</span>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', card.bgColor)}>
                  <card.icon className={cn('w-4 h-4', card.color)} />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)] truncate">
                {card.value}
              </div>
              {card.sub && (
                <p className="text-xs text-[var(--text-muted)] mt-1">{card.sub}</p>
              )}
            </CardBody>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

/** 3. Sortable table header */
function SortHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  currentSort: { key: SortKey; dir: SortDir } | null
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = currentSort?.key === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        'inline-flex items-center gap-1 font-medium text-xs transition-colors',
        'hover:text-[var(--text-primary)] cursor-pointer',
        active ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]',
        className,
      )}
    >
      {label}
      <ArrowUpDown className={cn('w-3.5 h-3.5 transition-colors', active && 'text-orbit-primary')} />
    </button>
  )
}

/** 4. SKU Expandable Row */
function SkuSubTable({ skus }: { skus: SkuItem[] }) {
  if (skus.length === 0) {
    return (
      <tr>
        <td colSpan={9} className="py-6 text-center">
          <p className="text-[var(--text-muted)] text-sm">暂无 SKU 数据</p>
        </td>
      </tr>
    )
  }

  return (
    <>
      {skus.map((sku, si) => (
        <motion.tr
          key={sku.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: si * 0.03 }}
          className="bg-orbit-surface2/30 border-b border-orbit-border/30 last:border-0"
        >
          <td className="py-2.5 pl-12 pr-4">
            <div className="flex items-center gap-2.5">
              {sku.sku_image ? (
                <img
                  src={sku.sku_image}
                  alt=""
                  className="w-8 h-8 rounded object-cover bg-[var(--surface3)]"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-[var(--surface3)] flex items-center justify-center">
                  <Package className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              )}
              <span className="text-sm text-[var(--text-secondary)]">{sku.sku_name}</span>
            </div>
          </td>
          <td className="py-2.5 px-3 text-right text-sm text-[var(--text-primary)] font-medium tabular-nums">
            {formatCurrency(sku.payment_amount)}
          </td>
          <td className="py-2.5 px-3 text-right text-sm text-[var(--text-secondary)] tabular-nums">
            {formatNumber(sku.sold_count)}
          </td>
          <td className="py-2.5 px-3 text-right text-sm text-[var(--text-secondary)] tabular-nums">
            {formatNumber(sku.buyer_count)}
          </td>
          <td className="py-2.5 px-3 text-right text-sm text-[var(--text-secondary)] tabular-nums">
            {formatNumber(sku.order_count)}
          </td>
          <td colSpan={4} />
        </motion.tr>
      ))}
    </>
  )
}

/** 5. Product Table */
function ProductTable({
  products,
  search,
  sort,
  onSort,
  sortDir,
}: {
  products: ProductItem[]
  search: string
  sort: SortKey | null
  onSort: (key: SortKey) => void
  sortDir: SortDir
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => p.product_name.toLowerCase().includes(q))
    }
    return list
  }, [products, search])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = a[sort]
      const bVal = b[sort]
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [filtered, sort, sortDir])

  if (sorted.length === 0) {
    return (
      <motion.div {...fadeUp(0.2)}>
        <Card>
          <CardHeader title="商品明细" subtitle={`共 ${products.length} 个商品`} />
          <CardBody>
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="w-10 h-10 text-[var(--text-muted)] mb-3" />
              <p className="text-[var(--text-muted)] text-sm">
                {search.trim() ? '未搜索到匹配的商品' : '暂无商品数据'}
              </p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    )
  }

  const currentSort = sort ? { key: sort, dir: sortDir } : null

  return (
    <motion.div {...fadeUp(0.2)}>
      <Card>
        <CardHeader
          title="商品明细"
          subtitle={`共 ${sorted.length} 个商品`}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orbit-border">
                  <th className="text-left text-[var(--text-muted)] font-medium py-3 px-4 w-10" />
                  <th className="text-left text-[var(--text-muted)] font-medium py-3 pr-4 min-w-[180px]">
                    <SortHeader label="商品名称" sortKey="product_order" currentSort={currentSort} onSort={onSort} />
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-3">
                    <SortHeader label="支付金额" sortKey="payment_amount" currentSort={currentSort} onSort={onSort} />
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-3">
                    <SortHeader label="售出件数" sortKey="sold_count" currentSort={currentSort} onSort={onSort} />
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-3">
                    <SortHeader label="购买用户" sortKey="buyer_count" currentSort={currentSort} onSort={onSort} />
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-3">
                    <SortHeader label="曝光用户" sortKey="exposure_users" currentSort={currentSort} onSort={onSort} />
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-3">
                    <SortHeader label="点击用户" sortKey="click_users" currentSort={currentSort} onSort={onSort} />
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-3">
                    <SortHeader label="曝光点击率" sortKey="exposure_click_rate" currentSort={currentSort} onSort={onSort} />
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-3">
                    <SortHeader label="点击成交率" sortKey="click_deal_rate" currentSort={currentSort} onSort={onSort} />
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 pl-3 pr-4 min-w-[100px]">
                    <span className="text-xs">退款</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((product, i) => {
                  const isExpanded = expandedId === product.id
                  return (
                    <Fragment key={product.id}>
                      <motion.tr
                        {...stagger(i)}
                        onClick={() => setExpandedId(isExpanded ? null : product.id)}
                        className={cn(
                          'border-b border-orbit-border/50 transition-colors cursor-pointer',
                          isExpanded ? 'bg-orbit-primary/5' : 'hover:bg-orbit-surface2/50',
                        )}
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            {product.product_image ? (
                              <img
                                src={product.product_image}
                                alt=""
                                className="w-9 h-9 rounded-lg object-cover bg-[var(--surface3)] flex-shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-[var(--surface3)] flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-[var(--text-muted)]" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm text-[var(--text-secondary)] max-w-[360px]">
                                {product.product_name}
                              </p>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                排序 {product.product_order}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-[var(--text-primary)] font-medium tabular-nums">
                          {formatCurrency(product.payment_amount)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-[var(--text-secondary)] tabular-nums">
                          {formatNumber(product.sold_count)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-[var(--text-secondary)] tabular-nums">
                          {formatNumber(product.buyer_count)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-[var(--text-secondary)] tabular-nums">
                          {formatNumber(product.exposure_users)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-[var(--text-secondary)] tabular-nums">
                          {formatNumber(product.click_users)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-sm text-[var(--text-secondary)] tabular-nums">
                            {formatPercent(product.exposure_click_rate)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-sm tabular-nums"
                            style={{ color: toNum(product.click_deal_rate) > 0.05 ? '#34d399' : '#f87171' }}
                          >
                            {formatPercent(product.click_deal_rate)}
                          </span>
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs text-red-400 tabular-nums">
                              {formatCurrency(product.refund_amount)}
                            </span>
                            <span className="text-xs text-[var(--text-muted)] tabular-nums">
                              {formatNumber(product.refund_orders)} 笔
                            </span>
                          </div>
                        </td>
                      </motion.tr>

                      {/* Expanded SKU rows */}
                      {isExpanded && (
                        <SkuSubTable skus={product.skus} />
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

/** Loading skeleton */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Overview cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
            <div className="h-3 w-16 bg-[var(--surface3)] rounded mb-3" />
            <div className="h-7 w-28 bg-[var(--surface3)] rounded mb-2" />
            <div className="h-3 w-20 bg-[var(--surface3)] rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface animate-pulse">
        <div className="px-5 pt-5 pb-2">
          <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
          <div className="h-3 w-32 bg-[var(--surface3)] rounded" />
        </div>
        <div className="p-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('h-14 px-4 flex items-center gap-4', i % 2 === 0 ? 'bg-orbit-surface' : 'bg-orbit-surface2/30')}>
              <div className="w-9 h-9 rounded-lg bg-[var(--surface3)] shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 bg-[var(--surface3)] rounded" />
                <div className="h-2 w-20 bg-[var(--surface3)] rounded" />
              </div>
              <div className="h-4 w-20 bg-[var(--surface3)] rounded" />
              <div className="h-4 w-16 bg-[var(--surface3)] rounded" />
              <div className="h-4 w-16 bg-[var(--surface3)] rounded" />
              <div className="h-4 w-16 bg-[var(--surface3)] rounded" />
              <div className="h-4 w-16 bg-[var(--surface3)] rounded" />
              <div className="h-4 w-16 bg-[var(--surface3)] rounded" />
              <div className="h-4 w-16 bg-[var(--surface3)] rounded" />
              <div className="h-4 w-20 bg-[var(--surface3)] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page Component ───
export function ProductAnalysisPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Filters
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  // Search & Sort
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Load sessions on mount
  useEffect(() => {
    api.get<Session[]>('/api/v1/review/sessions')
      .then((data) => {
        const raw = Array.isArray(data) ? data : (data as any)?.sessions ?? []
        // Map API response (uses 'title' for room name) to Session type
        const list: Session[] = raw.map((s: any) => ({
          id: s.id,
          room_id: s.room_id,
          title: s.title,
          room_name: s.title || s.anchor_name || '',
          business_date: s.business_date || s.date,
          anchor_name: s.anchor_name,
        }))
        setSessions(list)
      })
      .catch(() => {})
  }, [])

  // Load products when filters change
  useEffect(() => {
    if (!selectedRoomId || !selectedDate) {
      setProducts([])
      setLoading(false)
      setError(false)
      return
    }

    setLoading(true)
    setError(false)

    const params: Record<string, string | number | undefined> = {}
    params.room_id = Number(selectedRoomId)
    params.date = selectedDate

    api.get<ProductItem[]>('/api/v1/review/products', params)
      .then((data) => {
        const list = Array.isArray(data) ? data : (data as any)?.products ?? []
        setProducts(list)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [selectedRoomId, selectedDate])

  // Toggle sort
  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">商品分析</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">直播间商品表现明细及 SKU 维度分析</p>
          </div>
          <SessionFilter
            sessions={sessions}
            selectedRoomId={selectedRoomId}
            selectedDate={selectedDate}
            onRoomChange={setSelectedRoomId}
            onDateChange={setSelectedDate}
            loading={loading}
          />
        </div>
      </motion.div>

      {/* Search bar */}
      <motion.div {...fadeUp(0.05)}>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索商品名称..."
            className="w-full bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-orbit-primary/50 transition-colors"
          />
        </div>
      </motion.div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <motion.div {...fadeUp(0.1)}>
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="w-10 h-10 text-[var(--text-muted)] mb-3" />
                <p className="text-[var(--text-muted)] text-sm">加载失败，请稍后重试</p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ) : products.length === 0 ? (
        <>
          <OverviewCards products={[]} />
          <motion.div {...fadeUp(0.2)}>
            <Card>
              <CardHeader title="商品明细" />
              <CardBody>
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="w-10 h-10 text-[var(--text-muted)] mb-3" />
                  <p className="text-[var(--text-muted)] text-sm">暂无商品数据</p>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </>
      ) : (
        <>
          <OverviewCards products={products} />
          <ProductTable
            products={products}
            search={search}
            sort={sort}
            onSort={handleSort}
            sortDir={sortDir}
          />
        </>
      )}
    </div>
  )
}