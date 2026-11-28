import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Package,
  AlertTriangle,
  Plus,
  ArrowUpDown,
  RefreshCw,
  Layers,
  Tag,
  ShieldCheck,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'

interface SkuMapping {
  id: number
  platformCode: string
  shopId: number
  shopName: string
  platformItemId: string
  platformSkuId: string
}

interface ProductItem {
  id: number
  spuCode: string
  skuCode: string
  productName: string
  category: string
  brandName: string
  unitCost: number
  retailPrice: number
  warehouseCode: string
  warehouseName: string
  onHandQty: number
  lockedQty: number
  inTransitQty: number
  availableQty: number
  safetyStock: number
  isLowStock: boolean
  stockValue: number
  skuMappings: SkuMapping[]
}

interface Overview {
  totalSkus: number
  totalSpus: number
  totalOnHand: number
  totalLocked: number
  totalInTransit: number
  totalAvailable: number
  lowStockCount: number
  totalStockValue: number
}

interface LedgerRow {
  id: number
  sku_code: string
  product_name: string
  warehouse_code: string
  change_type: string
  delta_qty: number
  before_on_hand: number
  after_on_hand: number
  ref_type: string
  ref_id: string
  operator_name?: string
  remark: string
  created_at: string
}

export interface ChannelListingItem {
  id: number
  productId: number
  skuCode: string
  productName: string
  baseRetailPrice: number
  platformCode: string
  platformName: string
  shopId: number
  shopName: string
  channelSkuId: string
  channelPrice: number
  allocatedStock: number
  reservedStock: number
  availableChannelStock: number
  safetyStock: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ReservationItem {
  id: number
  reservationNo: string
  orderNo: string
  productId: number
  skuCode: string
  productName: string
  platformCode: string
  platformName: string
  shopId: number
  shopName: string
  warehouseCode: string
  reservedQty: number
  status: 'reserved' | 'committed' | 'released'
  expiresAt: string
  committedAt?: string
  releasedAt?: string
  releaseReason?: string
  createdAt: string
  updatedAt: string
}

const CHANGE_TYPE_LABELS: Record<
  string,
  { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }
> = {
  inbound: { label: '采购入库', variant: 'success' },
  return_in: { label: '退货入库', variant: 'info' },
  outbound: { label: '发货出库', variant: 'danger' },
  lock: { label: '下单锁库', variant: 'warning' },
  unlock: { label: '释放锁库', variant: 'neutral' },
  adjust: { label: '盘点调账', variant: 'info' },
}

export function InventoryCenterPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'channels' | 'reservations' | 'ledger'>('products')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<ProductItem | null>(null)
  const [selectedListing, setSelectedListing] = useState<ChannelListingItem | null>(null)
  const [listingEditPrice, setListingEditPrice] = useState('')
  const [listingEditAlloc, setListingEditAlloc] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [newForm, setNewForm] = useState({
    spuCode: '',
    skuCode: '',
    productName: '',
    category: '户外服饰',
    unitCost: '80',
    retailPrice: '259',
    safetyStock: '30',
    initialQty: '100',
  })

  const [adjustForm, setAdjustForm] = useState<{
    changeType: 'inbound' | 'outbound' | 'lock' | 'unlock' | 'adjust' | 'return_in'
    qty: string
    remark: string
  }>({
    changeType: 'inbound',
    qty: '20',
    remark: '',
  })

  const loadOverview = useCallback(async () => {
    try {
      const ov = await api.get<Overview>('/inventory/overview')
      setOverview(ov)
    } catch (err: any) {
      setErrorMsg(err?.message || '加载库存概览数据失败')
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  // Tab 1: Products Table
  const productsTable = useTable<ProductItem, { lowStockOnly: boolean }>({
    initialFilters: { lowStockOnly: false },
    initialPageSize: 20,
    fetchData: async ({ filters, search, page, pageSize }) => {
      const list = await api.get<ProductItem[]>('/inventory/products', {
        keyword: search || undefined,
        lowStockOnly: filters.lowStockOnly ? 'true' : undefined,
      })
      const items = list || []
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
      }
    },
  })

  // Tab 2: Channels Table
  const channelsTable = useTable<ChannelListingItem, Record<string, any>>({
    initialPageSize: 20,
    autoFetch: false,
    fetchData: async ({ search, page, pageSize }) => {
      const list = await api.get<ChannelListingItem[]>('/inventory/channel-listings')
      let items = list || []
      if (search) {
        const q = search.toLowerCase()
        items = items.filter(
          (c) =>
            c.productName.toLowerCase().includes(q) ||
            c.skuCode.toLowerCase().includes(q) ||
            c.platformName.toLowerCase().includes(q) ||
            c.shopName.toLowerCase().includes(q)
        )
      }
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
      }
    },
  })

  // Tab 3: Reservations Table
  const reservationsTable = useTable<ReservationItem, Record<string, any>>({
    initialPageSize: 20,
    autoFetch: false,
    fetchData: async ({ search, page, pageSize }) => {
      const list = await api.get<ReservationItem[]>('/inventory/reservations', { limit: 100 })
      let items = list || []
      if (search) {
        const q = search.toLowerCase()
        items = items.filter(
          (r) =>
            r.reservationNo.toLowerCase().includes(q) ||
            r.orderNo.toLowerCase().includes(q) ||
            r.productName.toLowerCase().includes(q) ||
            r.skuCode.toLowerCase().includes(q)
        )
      }
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
      }
    },
  })

  // Tab 4: Ledger Table
  const ledgerTable = useTable<LedgerRow, Record<string, any>>({
    initialPageSize: 20,
    autoFetch: false,
    fetchData: async ({ search, page, pageSize }) => {
      const list = await api.get<LedgerRow[]>('/inventory/ledger', { limit: 100 })
      let items = list || []
      if (search) {
        const q = search.toLowerCase()
        items = items.filter(
          (l) =>
            l.sku_code.toLowerCase().includes(q) ||
            l.product_name.toLowerCase().includes(q) ||
            (l.operator_name && l.operator_name.toLowerCase().includes(q))
        )
      }
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
      }
    },
  })

  // Lazy load tab data on tab switch
  useEffect(() => {
    if (activeTab === 'channels' && channelsTable.data.length === 0 && !channelsTable.loading) {
      channelsTable.reload()
    } else if (activeTab === 'reservations' && reservationsTable.data.length === 0 && !reservationsTable.loading) {
      reservationsTable.reload()
    } else if (activeTab === 'ledger' && ledgerTable.data.length === 0 && !ledgerTable.loading) {
      ledgerTable.reload()
    }
  }, [activeTab])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadOverview(),
      productsTable.reload(),
      channelsTable.reload(),
      reservationsTable.reload(),
      ledgerTable.reload(),
    ])
  }, [loadOverview, productsTable, channelsTable, reservationsTable, ledgerTable])

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      await api.post('/inventory/products', {
        spuCode: newForm.spuCode,
        skuCode: newForm.skuCode,
        productName: newForm.productName,
        category: newForm.category,
        unitCost: Number(newForm.unitCost),
        retailPrice: Number(newForm.retailPrice),
        safetyStock: Number(newForm.safetyStock),
        initialQty: Number(newForm.initialQty),
      })
      setShowNewModal(false)
      setNewForm({
        spuCode: '',
        skuCode: '',
        productName: '',
        category: '户外服饰',
        unitCost: '80',
        retailPrice: '259',
        safetyStock: '30',
        initialQty: '100',
      })
      await refreshAll()
    } catch (err: any) {
      setErrorMsg(err?.message || '新建商品失败')
    }
  }

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustTarget) return
    setErrorMsg('')
    try {
      await api.post('/inventory/stock/adjust', {
        productId: adjustTarget.id,
        warehouseCode: adjustTarget.warehouseCode,
        changeType: adjustForm.changeType,
        qty: Number(adjustForm.qty),
        remark: adjustForm.remark,
      })
      setAdjustTarget(null)
      setAdjustForm({ changeType: 'inbound', qty: '20', remark: '' })
      await refreshAll()
    } catch (err: any) {
      setErrorMsg(err?.message || '库存调账失败')
    }
  }

  const handleOpenEditListing = (listing: ChannelListingItem) => {
    setSelectedListing(listing)
    setListingEditPrice(String(listing.channelPrice))
    setListingEditAlloc(String(listing.allocatedStock))
  }

  const handleUpdateListing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedListing) return
    setErrorMsg('')
    try {
      await api.put(`/inventory/channel-listings/${selectedListing.id}`, {
        channelPrice: Number(listingEditPrice),
        allocatedStock: Number(listingEditAlloc),
      })
      setSelectedListing(null)
      await refreshAll()
    } catch (err: any) {
      setErrorMsg(err?.message || '更新渠道定价与配额失败')
    }
  }

  const handleCommitReservation = async (reservationNo: string) => {
    if (!window.confirm(`确认对预留单 ${reservationNo} 执行支付核销并扣减物理出库？`)) return
    setErrorMsg('')
    try {
      await api.post(`/inventory/reservations/${reservationNo}/commit`, {})
      await refreshAll()
    } catch (err: any) {
      setErrorMsg(err?.message || '核销出库失败')
    }
  }

  const handleReleaseReservation = async (reservationNo: string) => {
    const reason = window.prompt(
      `请输入预留单 ${reservationNo} 的释放原因 (例如: 超时未支付/用户取消):`,
      '用户取消订单'
    )
    if (reason === null) return
    setErrorMsg('')
    try {
      await api.post(`/inventory/reservations/${reservationNo}/release`, { reason })
      await refreshAll()
    } catch (err: any) {
      setErrorMsg(err?.message || '释放预留库存失败')
    }
  }

  // Columns for Products
  const productColumns: ColumnDef<ProductItem>[] = useMemo(
    () => [
      {
        key: 'productName',
        header: 'SKU / 商品名称',
        sortable: true,
        render: (_, item) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-primary)]">{item.productName}</span>
              {item.isLowStock && (
                <Badge variant="danger" dot>
                  低库存
                </Badge>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {item.spuCode} / {item.skuCode} · {item.category}
            </p>
          </div>
        ),
      },
      {
        key: 'warehouseName',
        header: '仓库',
        render: (_, item) => (
          <span className="text-xs text-[var(--text-secondary)]">{item.warehouseName}</span>
        ),
      },
      {
        key: 'onHandQty',
        header: '在库 / 锁定 / 可用',
        align: 'right',
        sortable: true,
        render: (_, item) => (
          <span className="tabular-nums">
            <span className="text-[var(--text-secondary)]">{item.onHandQty}</span>
            <span className="text-[var(--text-muted)] mx-1">/</span>
            <span className="text-status-warning">{item.lockedQty}</span>
            <span className="text-[var(--text-muted)] mx-1">/</span>
            <span
              className={`font-semibold ${
                item.isLowStock ? 'text-status-danger' : 'text-status-success'
              }`}
            >
              {item.availableQty}
            </span>
          </span>
        ),
      },
      {
        key: 'safetyStock',
        header: '安全线 / 在途',
        align: 'right',
        render: (_, item) => (
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            安全 {item.safetyStock} / 在途 {item.inTransitQty}
          </span>
        ),
      },
      {
        key: 'unitCost',
        header: '成本 / 售价',
        align: 'right',
        render: (_, item) => (
          <span className="text-xs tabular-nums">
            <span className="text-[var(--text-muted)]">¥{item.unitCost.toFixed(0)}</span>
            <span className="text-[var(--text-primary)] mx-1">/</span>
            <span className="text-[var(--text-secondary)]">¥{item.retailPrice.toFixed(0)}</span>
          </span>
        ),
      },
      {
        key: 'skuMappings',
        header: '平台铺货映射',
        render: (_, item) => (
          <div className="flex flex-wrap gap-1">
            {item.skuMappings.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)]">未映射</span>
            ) : (
              item.skuMappings.map((m) => (
                <Badge key={m.id} variant="info">
                  {m.platformCode}: {m.platformSkuId}
                </Badge>
              ))
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        align: 'right',
        render: (_, item) => (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setAdjustTarget(item)}
            icon={<ArrowUpDown className="w-3 h-3" />}
          >
            调账出入库
          </Button>
        ),
      },
    ],
    []
  )

  // Columns for Channels
  const channelColumns: ColumnDef<ChannelListingItem>[] = useMemo(
    () => [
      {
        key: 'productName',
        header: 'SKU / 商品名称',
        sortable: true,
        render: (_, item) => (
          <div>
            <span className="font-medium text-[var(--text-primary)]">{item.productName}</span>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.skuCode}</p>
          </div>
        ),
      },
      {
        key: 'platformName',
        header: '销售渠道 / 店铺',
        render: (_, item) => (
          <div className="text-xs">
            <span className="font-medium text-[var(--text-secondary)]">{item.platformName}</span>
            <span className="text-[var(--text-muted)] block">{item.shopName}</span>
          </div>
        ),
      },
      {
        key: 'channelSkuId',
        header: '渠道平台 SKU',
        render: (_, item) => (
          <span className="font-mono text-xs text-[var(--text-secondary)]">{item.channelSkuId}</span>
        ),
      },
      {
        key: 'channelPrice',
        header: '渠道专享价 / 主档价',
        align: 'right',
        sortable: true,
        render: (_, item) => (
          <div className="text-xs tabular-nums text-right">
            <span className="text-status-success font-semibold">
              ¥{item.channelPrice.toFixed(2)}
            </span>
            <span className="text-[var(--text-primary)] mx-1">/</span>
            <span className="text-[var(--text-muted)]">¥{item.baseRetailPrice.toFixed(2)}</span>
          </div>
        ),
      },
      {
        key: 'allocatedStock',
        header: '独占配额 / 预留 / 可用',
        align: 'right',
        sortable: true,
        render: (_, item) => (
          <span className="tabular-nums">
            <span className="text-[var(--text-secondary)]">{item.allocatedStock}</span>
            <span className="text-[var(--text-muted)] mx-1">/</span>
            <span className="text-status-warning">{item.reservedStock}</span>
            <span className="text-[var(--text-muted)] mx-1">/</span>
            <span
              className={`font-semibold ${
                item.availableChannelStock <= item.safetyStock
                  ? 'text-status-danger'
                  : 'text-status-success'
              }`}
            >
              {item.availableChannelStock}
            </span>
          </span>
        ),
      },
      {
        key: 'safetyStock',
        header: '安全线',
        align: 'right',
        render: (_, item) => (
          <span className="text-xs text-[var(--text-muted)] tabular-nums">{item.safetyStock}</span>
        ),
      },
      {
        key: 'isActive',
        header: '状态',
        render: (_, item) =>
          item.isActive ? (
            <Badge variant="success">生效中</Badge>
          ) : (
            <Badge variant="neutral">已下架</Badge>
          ),
      },
      {
        key: 'actions',
        header: '操作',
        align: 'right',
        render: (_, item) => (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => handleOpenEditListing(item)}
            icon={<ArrowUpDown className="w-3 h-3" />}
          >
            调整定价与配额
          </Button>
        ),
      },
    ],
    []
  )

  // Columns for Reservations
  const reservationColumns: ColumnDef<ReservationItem>[] = useMemo(
    () => [
      {
        key: 'reservationNo',
        header: '预留单号 / 关联订单',
        sortable: true,
        render: (_, item) => (
          <div>
            <span className="font-mono font-semibold text-xs text-[var(--text-secondary)]">
              {item.reservationNo}
            </span>
            <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{item.orderNo}</p>
          </div>
        ),
      },
      {
        key: 'productName',
        header: '商品 / SKU',
        render: (_, item) => (
          <div>
            <span className="font-medium text-[var(--text-primary)]">{item.productName}</span>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.skuCode}</p>
          </div>
        ),
      },
      {
        key: 'platformName',
        header: '渠道平台 / 店铺',
        render: (_, item) => (
          <div className="text-xs">
            <span className="text-[var(--text-secondary)] font-medium">{item.platformName}</span>
            <span className="text-[var(--text-muted)] block">{item.shopName}</span>
          </div>
        ),
      },
      {
        key: 'reservedQty',
        header: '预留数量',
        align: 'right',
        sortable: true,
        render: (_, item) => (
          <span className="font-mono font-bold text-status-warning">{item.reservedQty} 件</span>
        ),
      },
      {
        key: 'status',
        header: '状态',
        render: (_, item) => {
          if (item.status === 'reserved') return <Badge variant="warning" dot>待支付核销</Badge>
          if (item.status === 'committed') return <Badge variant="success">已核销出库</Badge>
          return <Badge variant="neutral">已释放还库</Badge>
        },
      },
      {
        key: 'expiresAt',
        header: '到期时间 / 释放原因',
        render: (_, item) => (
          <div className="text-xs text-[var(--text-muted)]">
            <div>到期: {new Date(item.expiresAt).toLocaleTimeString('zh-CN')}</div>
            {item.releaseReason && (
              <span className="text-status-danger block mt-0.5">原因: {item.releaseReason}</span>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        align: 'right',
        render: (_, item) => {
          if (item.status !== 'reserved') return <span className="text-xs text-[var(--text-muted)]">-</span>
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="xs"
                variant="primary"
                onClick={() => handleCommitReservation(item.reservationNo)}
                icon={<CheckCircle className="w-3 h-3" />}
              >
                核销出库
              </Button>
              <Button
                size="xs"
                variant="destructive"
                onClick={() => handleReleaseReservation(item.reservationNo)}
                icon={<XCircle className="w-3 h-3" />}
              >
                释放
              </Button>
            </div>
          )
        },
      },
    ],
    []
  )

  // Columns for Ledger
  const ledgerColumns: ColumnDef<LedgerRow>[] = useMemo(
    () => [
      {
        key: 'created_at',
        header: '变动时间',
        sortable: true,
        render: (_, row) => (
          <span className="text-xs text-[var(--text-muted)]">
            {new Date(row.created_at).toLocaleString('zh-CN')}
          </span>
        ),
      },
      {
        key: 'sku_code',
        header: 'SKU / 商品名称',
        render: (_, row) => (
          <span className="text-xs text-[var(--text-secondary)]">
            {row.sku_code} · {row.product_name}
          </span>
        ),
      },
      {
        key: 'change_type',
        header: '变动类型',
        render: (_, row) => {
          const b = CHANGE_TYPE_LABELS[row.change_type] || {
            label: row.change_type,
            variant: 'neutral' as const,
          }
          return <Badge variant={b.variant}>{b.label}</Badge>
        },
      },
      {
        key: 'delta_qty',
        header: '数量变动',
        align: 'right',
        sortable: true,
        render: (_, row) => (
          <span
            className={`font-mono font-semibold tabular-nums ${
              row.delta_qty >= 0 ? 'text-status-success' : 'text-status-danger'
            }`}
          >
            {row.delta_qty >= 0 ? `+${row.delta_qty}` : row.delta_qty}
          </span>
        ),
      },
      {
        key: 'before_on_hand',
        header: '在库前后',
        align: 'right',
        render: (_, row) => (
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {row.before_on_hand} → {row.after_on_hand}
          </span>
        ),
      },
      {
        key: 'operator_name',
        header: '操作人 / 备注',
        render: (_, row) => (
          <span className="text-xs text-[var(--text-muted)]">
            {row.operator_name || '系统'} {row.remark ? `· ${row.remark}` : ''}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">商品主数据与全渠道库存中心</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            统一维护 SPU/SKU 主档、跨 7 大平台铺货映射、可用/锁定库存快照与不可篡改出入库流水
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            loading={productsTable.loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            全局刷新
          </Button>
          <Button
            size="sm"
            onClick={() => setShowNewModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            新增商品 SKU
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-orbit-danger/30 bg-orbit-danger/10 px-4 py-2.5 text-sm text-status-danger">
          {errorMsg}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">SPU / SKU 总数</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                {overview.totalSpus} / {overview.totalSkus}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">物理在库 / 锁定</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                {overview.totalOnHand} /{' '}
                <span className="text-status-warning">{overview.totalLocked}</span>
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">可用可售库存</p>
              <p className="mt-1 text-2xl font-bold text-status-success">
                {overview.totalAvailable}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">缺货预警 SKU</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  overview.lowStockCount > 0 ? 'text-status-danger' : 'text-[var(--text-primary)]'
                }`}
              >
                {overview.lowStockCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">库存总货值</p>
              <p className="mt-1 text-2xl font-bold text-status-ai">
                ¥{overview.totalStockValue.toLocaleString()}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-orbit-border space-x-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-orbit-primary text-orbit-primary-light font-semibold'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Package className="w-4 h-4" />
          商品主档与总仓 ({productsTable.total})
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'channels'
              ? 'border-orbit-primary text-orbit-primary-light font-semibold'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Tag className="w-4 h-4" />
          渠道专享定价与配额 ({channelsTable.total})
        </button>
        <button
          onClick={() => setActiveTab('reservations')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reservations'
              ? 'border-orbit-primary text-orbit-primary-light font-semibold'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          大促防超卖预留单 ({reservationsTable.total})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ledger'
              ? 'border-orbit-primary text-orbit-primary-light font-semibold'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Layers className="w-4 h-4" />
          异动审计流水 ({ledgerTable.total})
        </button>
      </div>

      {activeTab === 'products' && (
        <DataPage<ProductItem>
          title="商品主档与总仓可用库存"
          subtitle="统一维护主档规格、跨平台映射以及仓库实物与安全线"
          badge={
            <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-status-success border border-orbit-border">
              DataPage + useTable
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => productsTable.reload()}
              loading={productsTable.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          }
          table={productsTable}
          columns={productColumns}
          searchPlaceholder="搜索 SPU/SKU 或商品名称..."
          exportFilename="inventory_products"
          filterControls={
            <Button
              size="sm"
              variant={productsTable.filters.lowStockOnly ? 'destructive' : 'outline'}
              onClick={() =>
                productsTable.setFilter('lowStockOnly', !productsTable.filters.lowStockOnly)
              }
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
            >
              仅看低库存预警
            </Button>
          }
        />
      )}

      {activeTab === 'channels' && (
        <DataPage<ChannelListingItem>
          title="渠道专属定价与独立配额管控"
          subtitle="支持同一 SKU 在抖音、快手、视频号独立制定平台专享售价与独占安全库存配额"
          badge={
            <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-status-ai border border-orbit-border">
              渠道配额引擎
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => channelsTable.reload()}
              loading={channelsTable.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          }
          table={channelsTable}
          columns={channelColumns}
          searchPlaceholder="搜索 SKU、商品名或销售渠道..."
          exportFilename="inventory_channel_listings"
        />
      )}

      {activeTab === 'reservations' && (
        <DataPage<ReservationItem>
          title="大促防超卖预留单 (原子锁库与超时释放)"
          subtitle="下单强一致性行锁锁定，支持 15/30 分钟超时释放与支付完成核销物理出库"
          badge={
            <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-status-warning border border-orbit-border">
              防超卖锁库
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => reservationsTable.reload()}
              loading={reservationsTable.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          }
          table={reservationsTable}
          columns={reservationColumns}
          searchPlaceholder="搜索预留单号、订单号或商品..."
          exportFilename="inventory_reservations"
        />
      )}

      {activeTab === 'ledger' && (
        <DataPage<LedgerRow>
          title="出入库、锁库与配额异动全链路审计流水"
          subtitle="记录采购入库、销售出库、下单冻结与盘点调账的不可逆事实流水"
          badge={
            <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-orbit-primary border border-orbit-border">
              审计流水
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => ledgerTable.reload()}
              loading={ledgerTable.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          }
          table={ledgerTable}
          columns={ledgerColumns}
          searchPlaceholder="搜索 SKU、商品或操作人..."
          exportFilename="inventory_ledger"
        />
      )}

      {/* Modal: Create Product */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-orbit-border bg-orbit-surface p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">新增商品 SKU 主档</h3>
            <form onSubmit={handleCreateProduct} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="SPU 编码 (如 CLOTH-001)"
                  value={newForm.spuCode}
                  onChange={(e) => setNewForm({ ...newForm, spuCode: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  required
                  placeholder="SKU 编码 (如 CLOTH-001-BLK-M)"
                  value={newForm.skuCode}
                  onChange={(e) => setNewForm({ ...newForm, skuCode: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>
              <input
                required
                placeholder="商品全称"
                value={newForm.productName}
                onChange={(e) => setNewForm({ ...newForm, productName: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="类目"
                  value={newForm.category}
                  onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  required
                  type="number"
                  placeholder="采购成本价"
                  value={newForm.unitCost}
                  onChange={(e) => setNewForm({ ...newForm, unitCost: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  required
                  type="number"
                  placeholder="建议零售价"
                  value={newForm.retailPrice}
                  onChange={(e) => setNewForm({ ...newForm, retailPrice: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  required
                  type="number"
                  placeholder="安全库存线"
                  value={newForm.safetyStock}
                  onChange={(e) => setNewForm({ ...newForm, safetyStock: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  required
                  type="number"
                  placeholder="期初库存"
                  value={newForm.initialQty}
                  onChange={(e) => setNewForm({ ...newForm, initialQty: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowNewModal(false)}>
                  取消
                </Button>
                <Button type="submit">创建主档</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Stock */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              库存调账 / 出入库 · {adjustTarget.skuCode}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {adjustTarget.productName} (当前可用: {adjustTarget.availableQty} / 在库:{' '}
              {adjustTarget.onHandQty})
            </p>
            <form onSubmit={handleAdjustStock} className="space-y-3 text-sm">
              <select
                value={adjustForm.changeType}
                onChange={(e) =>
                  setAdjustForm({ ...adjustForm, changeType: e.target.value as any })
                }
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
              >
                <option value="inbound">采购入库 (+)</option>
                <option value="return_in">退货入库 (+)</option>
                <option value="outbound">发货出库 (-)</option>
                <option value="adjust">盘点调账 (+/-)</option>
                <option value="lock">手动锁库 (冻结)</option>
                <option value="unlock">释放锁库 (解冻)</option>
              </select>
              <input
                required
                type="number"
                placeholder="变动数量 (支持正负数)"
                value={adjustForm.qty}
                onChange={(e) => setAdjustForm({ ...adjustForm, qty: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
              />
              <input
                placeholder="调账原因 / 关联单号 (必填)"
                required
                value={adjustForm.remark}
                onChange={(e) => setAdjustForm({ ...adjustForm, remark: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setAdjustTarget(null)}>
                  取消
                </Button>
                <Button type="submit">提交调账流水</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Channel Pricing & Allocation */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              调整渠道专享定价与配额 · {selectedListing.platformName}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {selectedListing.productName} ({selectedListing.skuCode})
            </p>
            <form onSubmit={handleUpdateListing} className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">
                  渠道专享售价 (主档价: ¥{selectedListing.baseRetailPrice.toFixed(2)})
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={listingEditPrice}
                  onChange={(e) => setListingEditPrice(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)] font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">
                  独占库存配额 (当前已预留: {selectedListing.reservedStock})
                </label>
                <input
                  required
                  type="number"
                  value={listingEditAlloc}
                  onChange={(e) => setListingEditAlloc(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)] font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setSelectedListing(null)}>
                  取消
                </Button>
                <Button type="submit">保存生效</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
