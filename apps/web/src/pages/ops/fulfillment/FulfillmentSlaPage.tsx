import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle, Plus, RefreshCw, ShieldAlert } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useShops } from '@/hooks/useShops'
import { usePlatform } from '@/hooks/usePlatform'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'

interface WaybillRow {
  id: number
  platform_code: string
  platform_name: string
  shop_id: number
  shop_name: string
  order_no: string
  waybill_no: string | null
  carrier_code: string
  sku_code?: string
  product_name?: string
  order_amount: string
  is_custom_presale: boolean
  paid_at: string
  ship_deadline_at: string
  shipped_at: string | null
  pickup_at: string | null
  fulfillment_status: string
  is_ship_delayed: boolean
  is_fake_ship_risk: boolean
  estimated_penalty_amount: string
  sla_risk_reason: string
  ship_margin_hours: string | null
  pickup_wait_hours: string | null
}

interface FulfillmentOverview {
  totalWaybills: number
  pendingShipCount: number
  noPickupCount: number
  delayedCount: number
  fakeShipRiskCount: number
  totalEstimatedPenalty: number
  byPlatform: Array<{
    platformCode: string
    platformName: string
    totalCount: number
    delayedCount: number
    fakeShipCount: number
    estimatedPenalty: number
    compliantRate: number
  }>
}

interface SlaRule {
  id: number
  platform_code: string
  platform_name: string
  sla_type: string
  sla_name: string
  threshold_hours: number
  pickup_threshold_hours: number
  penalty_fixed_amount: string
  penalty_rate: string
  penalty_min_amount: string
  penalty_max_amount: string
  penalty_note: string
}

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'danger' | 'info' | 'success' | 'neutral' }> = {
  pending_ship: { label: '待发货', variant: 'warning' },
  shipped_no_pickup: { label: '已上传待揽收', variant: 'danger' },
  in_transit: { label: '运输中', variant: 'info' },
  signed: { label: '已签收', variant: 'success' },
  cancelled: { label: '已取消', variant: 'neutral' },
}

export function FulfillmentSlaPage() {
  const { currentPlatform } = usePlatform()
  const [overview, setOverview] = useState<FulfillmentOverview | null>(null)
  const [rules, setRules] = useState<SlaRule[]>([])
  const [showModal, setShowModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { getShopsByPlatform, getDefaultShopId } = useShops()
  const [form, setForm] = useState({
    platformCode: currentPlatform?.platform_code || 'douyin',
    shopId: '',
    orderNo: '',
    orderAmount: '199',
    carrierCode: 'YTO',
    waybillNo: '',
    isCustomPresale: false,
  })

  // 监听顶栏平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      const p = currentPlatform.platform_code
      table.setFilter('platformCode', p)
      setForm((prev) => ({ ...prev, platformCode: p, shopId: getDefaultShopId(p) }))
    }
  }, [currentPlatform?.platform_code, getDefaultShopId])

  useEffect(() => {
    const nextShopId = getDefaultShopId(form.platformCode, form.shopId)
    if (nextShopId && nextShopId !== form.shopId) {
      setForm((prev) => ({ ...prev, shopId: nextShopId }))
    }
  }, [form.platformCode, form.shopId, getDefaultShopId])

  const loadAuxData = useCallback(async () => {
    try {
      const [ov, rl] = await Promise.all([
        api.get<FulfillmentOverview>('/fulfillment/overview'),
        api.get<SlaRule[]>('/fulfillment/sla-rules'),
      ])
      setOverview(ov)
      setRules(rl || [])
    } catch (err: any) {
      setErrorMsg(err?.message || '加载履约概览失败')
    }
  }, [])

  useEffect(() => {
    loadAuxData()
  }, [loadAuxData])

  const table = useTable<WaybillRow, { platformCode: string; riskOnly: boolean }>({
    initialFilters: { platformCode: currentPlatform?.platform_code || '', riskOnly: false },
    initialPageSize: 20,
    fetchData: async ({ filters, search, page, pageSize }) => {
      const wb = await api.get<WaybillRow[]>('/fulfillment/waybills', {
        platformCode: filters.platformCode || undefined,
        riskOnly: filters.riskOnly ? 'true' : undefined,
      })
      let list = wb || []
      if (search) {
        const q = search.toLowerCase()
        list = list.filter(
          (w) =>
            w.order_no.toLowerCase().includes(q) ||
            (w.waybill_no && w.waybill_no.toLowerCase().includes(q)) ||
            w.shop_name.toLowerCase().includes(q) ||
            (w.product_name && w.product_name.toLowerCase().includes(q))
        )
      }
      return {
        items: list.slice((page - 1) * pageSize, page * pageSize),
        total: list.length,
      }
    },
  })

  const handleCreateWaybill = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      await api.post('/fulfillment/waybills', {
        platformCode: form.platformCode,
        shopId: Number(form.shopId),
        orderNo: form.orderNo,
        orderAmount: Number(form.orderAmount),
        carrierCode: form.carrierCode,
        waybillNo: form.waybillNo || undefined,
        isCustomPresale: form.isCustomPresale,
      })
      setShowModal(false)
      setForm({ ...form, orderNo: '', waybillNo: '' })
      await Promise.all([table.reload(), loadAuxData()])
    } catch (err: any) {
      setErrorMsg(err?.message || '登记运单失败')
    }
  }

  const handleDispatch = async (row: WaybillRow, action: 'ship' | 'pickup' | 'sign') => {
    setErrorMsg('')
    try {
      const nowIso = new Date().toISOString()
      const payload: Record<string, string> = {}
      if (action === 'ship') {
        payload.waybillNo = row.waybill_no || `SF${Date.now().toString().slice(-10)}`
        payload.shippedAt = nowIso
      } else if (action === 'pickup') {
        payload.pickupAt = nowIso
      } else if (action === 'sign') {
        payload.signedAt = nowIso
      }
      await api.patch(`/fulfillment/waybills/${row.id}/dispatch`, payload)
      await Promise.all([table.reload(), loadAuxData()])
    } catch (err: any) {
      setErrorMsg(err?.message || '更新物流节点失败')
    }
  }

  const columns: ColumnDef<WaybillRow>[] = useMemo(
    () => [
      {
        key: 'order_no',
        header: '平台 / 订单号',
        sortable: true,
        render: (_, w) => (
          <div>
            <div className="flex items-center gap-1.5">
              <Badge variant="info">{w.platform_name}</Badge>
              <span className="font-mono font-medium text-[var(--text-primary)]">{w.order_no}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {w.shop_name} {w.product_name ? `· ${w.product_name}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'waybill_no',
        header: '物流单号',
        render: (_, w) =>
          w.waybill_no ? (
            <span className="font-mono text-xs text-[var(--text-secondary)]">
              {w.carrier_code}: {w.waybill_no}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">未上传运单</span>
          ),
      },
      {
        key: 'order_amount',
        header: '订单金额',
        align: 'right',
        sortable: true,
        render: (_, w) => (
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">
            ¥{Number(w.order_amount).toFixed(2)}
          </span>
        ),
      },
      {
        key: 'fulfillment_status',
        header: '状态',
        render: (_, w) => {
          const st = STATUS_BADGE[w.fulfillment_status] || {
            label: w.fulfillment_status,
            variant: 'neutral' as const,
          }
          return (
            <Badge variant={st.variant} dot>
              {st.label}
            </Badge>
          )
        },
      },
      {
        key: 'ship_margin_hours',
        header: '发货余量 / 揽收等待',
        align: 'right',
        render: (_, w) => {
          const marginH = w.ship_margin_hours !== null ? Number(w.ship_margin_hours) : null
          const pickupWait = w.pickup_wait_hours !== null ? Number(w.pickup_wait_hours) : null
          return (
            <div className="text-xs tabular-nums text-right">
              {marginH !== null && (
                <span
                  className={
                    marginH < 0
                      ? 'text-red-400 font-semibold'
                      : marginH < 12
                      ? 'text-amber-400'
                      : 'text-[var(--text-secondary)]'
                  }
                >
                  发货{marginH >= 0 ? `剩 ${marginH}h` : `超 ${Math.abs(marginH)}h`}
                </span>
              )}
              {pickupWait !== null && (
                <p
                  className={
                    pickupWait > 24 && !w.pickup_at
                      ? 'text-red-400 font-semibold'
                      : 'text-[var(--text-muted)]'
                  }
                >
                  揽收等 {pickupWait}h
                </p>
              )}
            </div>
          )
        },
      },
      {
        key: 'estimated_penalty_amount',
        header: '预估赔付',
        align: 'right',
        sortable: true,
        render: (_, w) => (
          <span
            className={`font-semibold tabular-nums ${
              Number(w.estimated_penalty_amount) > 0 ? 'text-red-400' : 'text-[var(--text-muted)]'
            }`}
          >
            ¥{Number(w.estimated_penalty_amount).toFixed(2)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '风控归因与操作',
        render: (_, w) => (
          <div className="space-y-1">
            {w.sla_risk_reason && (
              <p className="text-xs text-amber-300">{w.sla_risk_reason}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {!w.shipped_at && (
                <Button size="xs" variant="primary" onClick={() => handleDispatch(w, 'ship')}>
                  一键发货
                </Button>
              )}
              {w.shipped_at && !w.pickup_at && (
                <Button size="xs" variant="secondary" onClick={() => handleDispatch(w, 'pickup')}>
                  标记已揽收
                </Button>
              )}
              {w.pickup_at && w.fulfillment_status === 'in_transit' && (
                <Button size="xs" variant="outline" onClick={() => handleDispatch(w, 'sign')}>
                  标记签收
                </Button>
              )}
            </div>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">在管履约运单</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{overview.totalWaybills}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">待发货 / 无揽收</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {overview.pendingShipCount} / {overview.noPickupCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">延迟发货违约</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  overview.delayedCount > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {overview.delayedCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">虚假发货风控 (24h无揽收)</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  overview.fakeShipRiskCount > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {overview.fakeShipRiskCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">预估赔付敞口</p>
              <p className="mt-1 text-2xl font-bold text-red-400">
                ¥{overview.totalEstimatedPenalty.toFixed(2)}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <DataPage<WaybillRow>
        title="多平台 48h 履约 SLA 与赔付风控中心"
        subtitle="对齐拼多多 48h/120h + ¥3 延迟券、快手 24h 无揽收 1% 赔付（¥3–¥30 封顶）、抖音 24h 首条轨迹规则"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-emerald-400 border border-orbit-border">
            DataPage + useTable
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => Promise.all([table.reload(), loadAuxData()])}
              loading={table.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              录入监控订单
            </Button>
          </>
        }
        table={table}
        columns={columns}
        searchPlaceholder="搜索订单号、运单号或商品名..."
        exportFilename="fulfillment_sla_waybills"
        filterControls={
          <div className="flex items-center gap-2">
            <select
              value={table.filters.platformCode}
              onChange={(e) => table.setFilter('platformCode', e.target.value)}
              className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-[var(--text-secondary)]"
            >
              <option value="">全部平台</option>
              <option value="douyin">抖音</option>
              <option value="kuaishou">快手</option>
              <option value="wechat">视频号</option>
              <option value="taobao">淘宝</option>
              <option value="tmall">天猫</option>
              <option value="xiaohongshu">小红书</option>
            </select>
            <Button
              size="sm"
              variant={table.filters.riskOnly ? 'destructive' : 'outline'}
              onClick={() => table.setFilter('riskOnly', !table.filters.riskOnly)}
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
            >
              仅看风险违约单
            </Button>
          </div>
        }
      >
        <div className="mt-6">
          <Card>
            <CardHeader className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-[var(--text-primary)]">
                平台官方法定履约规则配置基准（platform_sla_config）
              </span>
            </CardHeader>
            <CardBody className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rules
                .filter((r) => ['ship', 'fake_ship', 'ship_delay'].includes(r.sla_type))
                .map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-orbit-border bg-orbit-surface2/40 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="info">{r.platform_name}</Badge>
                      <span className="text-xs text-[var(--text-muted)]">
                        发货 {r.threshold_hours}h · 揽收 {r.pickup_threshold_hours}h
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{r.sla_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.penalty_note}</p>
                  </div>
                ))}
            </CardBody>
          </Card>
        </div>
      </DataPage>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">录入订单履约监控</h3>
            <form onSubmit={handleCreateWaybill} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.platformCode}
                  onChange={(e) => {
                    const nextPlatform = e.target.value
                    setForm({
                      ...form,
                      platformCode: nextPlatform,
                      shopId: getDefaultShopId(nextPlatform),
                    })
                  }}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                >
                  <option value="douyin">抖音</option>
                  <option value="kuaishou">快手</option>
                  <option value="wechat">视频号</option>
                  <option value="taobao">淘宝</option>
                  <option value="tmall">天猫</option>
                  <option value="xiaohongshu">小红书</option>
                </select>
                <select
                  required
                  value={form.shopId}
                  onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                >
                  {getShopsByPlatform(form.platformCode).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {getShopsByPlatform(form.platformCode).length === 0 && (
                    <option value="">暂无可用店铺</option>
                  )}
                </select>
              </div>
              <input
                required
                placeholder="订单号"
                value={form.orderNo}
                onChange={(e) => setForm({ ...form, orderNo: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="订单实付金额"
                  value={form.orderAmount}
                  onChange={(e) => setForm({ ...form, orderAmount: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  placeholder="承运商 (如 SF/YTO)"
                  value={form.carrierCode}
                  onChange={(e) => setForm({ ...form, carrierCode: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>
              <input
                placeholder="快递单号（选填，留空则进入待发货倒计时）"
                value={form.waybillNo}
                onChange={(e) => setForm({ ...form, waybillNo: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
              />
              {form.platformCode === 'pdd' && (
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={form.isCustomPresale}
                    onChange={(e) =>
                      setForm({ ...form, isCustomPresale: e.target.checked })
                    }
                  />
                  定制/预售商品（拼多多放宽至 120h 发货上限）
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                  取消
                </Button>
                <Button type="submit">创建监控</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
