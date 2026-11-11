import { useState, useEffect, useCallback } from 'react'
import { Package, AlertTriangle, Plus, ArrowUpDown, RefreshCw, Layers } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

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

const CHANGE_TYPE_LABELS: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  inbound: { label: '采购入库', variant: 'success' },
  return_in: { label: '退货入库', variant: 'info' },
  outbound: { label: '发货出库', variant: 'danger' },
  lock: { label: '下单锁库', variant: 'warning' },
  unlock: { label: '释放锁库', variant: 'neutral' },
  adjust: { label: '盘点调账', variant: 'info' },
}

export function InventoryCenterPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<ProductItem | null>(null)
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

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [ov, prods, ldg] = await Promise.all([
        api.get<Overview>('/inventory/overview'),
        api.get<ProductItem[]>('/inventory/products', {
          keyword: keyword || undefined,
          lowStockOnly: lowStockOnly ? 'true' : undefined,
        }),
        api.get<LedgerRow[]>('/inventory/ledger', { limit: 20 }),
      ])
      setOverview(ov)
      setProducts(prods || [])
      setLedger(ldg || [])
    } catch (err: any) {
      setErrorMsg(err?.message || '加载商品与库存数据失败')
    } finally {
      setLoading(false)
    }
  }, [keyword, lowStockOnly])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      setNewForm({ spuCode: '', skuCode: '', productName: '', category: '户外服饰', unitCost: '80', retailPrice: '259', safetyStock: '30', initialQty: '100' })
      await loadData()
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
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.message || '库存调账失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">商品主数据与全渠道库存中心</h1>
          <p className="mt-1 text-sm text-slate-400">
            统一维护 SPU/SKU 主档、跨7大平台铺货映射、可用/锁定库存快照与不可篡改出入库流水
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            刷新
          </Button>
          <Button size="sm" onClick={() => setShowNewModal(true)} icon={<Plus className="w-4 h-4" />}>
            新增商品 SKU
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">SPU / SKU 数</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{overview.totalSpus} / {overview.totalSkus}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">全仓实物在库</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{overview.totalOnHand.toLocaleString()}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">订单已锁定</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">{overview.totalLocked.toLocaleString()}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">低库存预警 SKU</p>
              <p className={`mt-1 text-2xl font-bold ${overview.lowStockCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {overview.lowStockCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">在库货值成本</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">¥{overview.totalStockValue.toLocaleString()}</p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-orbit-primary-light" />
            <span className="font-semibold text-slate-100">SKU 库存与全渠道映射</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索 SPU/SKU 或商品名"
              className="h-8 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-slate-200 focus:outline-none focus:border-orbit-primary"
            />
            <Button
              size="xs"
              variant={lowStockOnly ? 'destructive' : 'outline'}
              onClick={() => setLowStockOnly((v) => !v)}
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
            >
              仅看低库存预警
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-orbit-border text-xs text-slate-400 bg-orbit-surface2/50">
              <tr>
                <th className="px-4 py-3">SKU / 商品名称</th>
                <th className="px-4 py-3">仓库</th>
                <th className="px-4 py-3 text-right">在库 / 锁定 / 可用</th>
                <th className="px-4 py-3 text-right">安全线 / 在途</th>
                <th className="px-4 py-3 text-right">成本 / 售价</th>
                <th className="px-4 py-3">平台铺货映射</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orbit-border">
              {products.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{item.productName}</span>
                      {item.isLowStock && <Badge variant="danger" dot>低库存</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{item.spuCode} / {item.skuCode} · {item.category}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{item.warehouseName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="text-slate-200">{item.onHandQty}</span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span className="text-amber-400">{item.lockedQty}</span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span className={`font-semibold ${item.isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                      {item.availableQty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-400 tabular-nums">
                    安全 {item.safetyStock} / 在途 {item.inTransitQty}
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    <span className="text-slate-400">¥{item.unitCost.toFixed(0)}</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-slate-200">¥{item.retailPrice.toFixed(0)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.skuMappings.length === 0 ? (
                        <span className="text-xs text-slate-500">未映射</span>
                      ) : item.skuMappings.map((m) => (
                        <Badge key={m.id} variant="info">
                          {m.platformCode}: {m.platformSkuId}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => setAdjustTarget(item)}
                      icon={<ArrowUpDown className="w-3 h-3" />}
                    >
                      调账出入库
                    </Button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">暂无符合条件的商品与库存记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-100">最近出入库及锁库审计流水</span>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-orbit-border text-slate-400 bg-orbit-surface2/50">
              <tr>
                <th className="px-4 py-2.5">时间</th>
                <th className="px-4 py-2.5">SKU / 商品</th>
                <th className="px-4 py-2.5">变动类型</th>
                <th className="px-4 py-2.5 text-right">数量变动</th>
                <th className="px-4 py-2.5 text-right">在库前后</th>
                <th className="px-4 py-2.5">操作人 / 备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orbit-border">
              {ledger.map((row) => {
                const badge = CHANGE_TYPE_LABELS[row.change_type] || { label: row.change_type, variant: 'neutral' as const }
                return (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-slate-400">{new Date(row.created_at).toLocaleString('zh-CN')}</td>
                    <td className="px-4 py-2.5 text-slate-200">{row.sku_code} · {row.product_name}</td>
                    <td className="px-4 py-2.5"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                    <td className={`px-4 py-2.5 text-right font-mono font-semibold ${row.delta_qty >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.delta_qty >= 0 ? `+${row.delta_qty}` : row.delta_qty}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums">{row.before_on_hand} → {row.after_on_hand}</td>
                    <td className="px-4 py-2.5 text-slate-400">{row.operator_name || '系统'} {row.remark ? `· ${row.remark}` : ''}</td>
                  </tr>
                )
              })}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">暂无库存异动流水</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">新增商品主档案 SKU</h3>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <input required placeholder="SPU编码 (如 SPU-2026-008)" value={newForm.spuCode} onChange={(e) => setNewForm({ ...newForm, spuCode: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input required placeholder="SKU编码 (如 SKU-2026-008-M)" value={newForm.skuCode} onChange={(e) => setNewForm({ ...newForm, skuCode: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              </div>
              <input required placeholder="商品全称" value={newForm.productName} onChange={(e) => setNewForm({ ...newForm, productName: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="类目" value={newForm.category} onChange={(e) => setNewForm({ ...newForm, category: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input type="number" step="0.01" placeholder="成本价" value={newForm.unitCost} onChange={(e) => setNewForm({ ...newForm, unitCost: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" step="0.01" placeholder="吊牌/售价" value={newForm.retailPrice} onChange={(e) => setNewForm({ ...newForm, retailPrice: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input type="number" placeholder="安全库存" value={newForm.safetyStock} onChange={(e) => setNewForm({ ...newForm, safetyStock: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input type="number" placeholder="期初库存" value={newForm.initialQty} onChange={(e) => setNewForm({ ...newForm, initialQty: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowNewModal(false)}>取消</Button>
                <Button type="submit">确认创建</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">库存调账 · {adjustTarget.skuCode}</h3>
            <p className="text-xs text-slate-400">当前在库 {adjustTarget.onHandQty} · 已锁定 {adjustTarget.lockedQty} · 可用 {adjustTarget.availableQty}</p>
            <form onSubmit={handleAdjustStock} className="space-y-3 text-sm">
              <select
                value={adjustForm.changeType}
                onChange={(e) => setAdjustForm({ ...adjustForm, changeType: e.target.value as any })}
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100"
              >
                <option value="inbound">采购入库 (+在库)</option>
                <option value="return_in">退货回仓 (+在库)</option>
                <option value="outbound">发货出库 (-在库并释放锁库)</option>
                <option value="lock">订单锁库 (+锁定)</option>
                <option value="unlock">释放锁库 (-锁定)</option>
                <option value="adjust">盘点盈亏调整 (+/-在库)</option>
              </select>
              <input required type="number" placeholder="数量" value={adjustForm.qty} onChange={(e) => setAdjustForm({ ...adjustForm, qty: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              <input placeholder="调账原因或关联单号" value={adjustForm.remark} onChange={(e) => setAdjustForm({ ...adjustForm, remark: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setAdjustTarget(null)}>取消</Button>
                <Button type="submit">执行调账</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
