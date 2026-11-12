import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Truck, Plus, RefreshCw, ShieldAlert } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useShops } from '@/hooks/useShops'
import { api } from '@/services/api'

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
  const [overview, setOverview] = useState<FulfillmentOverview | null>(null)
  const [waybills, setWaybills] = useState<WaybillRow[]>([])
  const [rules, setRules] = useState<SlaRule[]>([])
  const [riskOnly, setRiskOnly] = useState(false)
  const [platformFilter, setPlatformFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { getShopsByPlatform, getDefaultShopId } = useShops()
  const [form, setForm] = useState({
    platformCode: 'pdd',
    shopId: '',
    orderNo: '',
    orderAmount: '199',
    carrierCode: 'YTO',
    waybillNo: '',
    isCustomPresale: false,
  })

  useEffect(() => {
    const nextShopId = getDefaultShopId(form.platformCode, form.shopId)
    if (nextShopId && nextShopId !== form.shopId) {
      setForm((prev) => ({ ...prev, shopId: nextShopId }))
    }
  }, [form.platformCode, form.shopId, getDefaultShopId])

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [ov, wb, rl] = await Promise.all([
        api.get<FulfillmentOverview>('/fulfillment/overview'),
        api.get<WaybillRow[]>('/fulfillment/waybills', {
          platformCode: platformFilter || undefined,
          riskOnly: riskOnly ? 'true' : undefined,
        }),
        api.get<SlaRule[]>('/fulfillment/sla-rules'),
      ])
      setOverview(ov)
      setWaybills(wb || [])
      setRules(rl || [])
    } catch (err: any) {
      setErrorMsg(err?.message || '加载履约风控数据失败')
    } finally {
      setLoading(false)
    }
  }, [platformFilter, riskOnly])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      await loadData()
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
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.message || '更新物流节点失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">多平台 48h 履约 SLA 与赔付风控中心</h1>
          <p className="mt-1 text-sm text-slate-400">
            对齐拼多多 48h/120h + ¥3 延迟券、快手 24h 无揽收 1% 赔付（¥3–¥30 封顶）、抖音 24h 首条轨迹规则
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            刷新
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)} icon={<Plus className="w-4 h-4" />}>
            录入监控订单
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
              <p className="text-xs text-slate-400">在管履约运单</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{overview.totalWaybills}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">待发货 / 无揽收</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {overview.pendingShipCount} / {overview.noPickupCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">延迟发货违约</p>
              <p className={`mt-1 text-2xl font-bold ${overview.delayedCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {overview.delayedCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">虚假发货风控 (24h无揽收)</p>
              <p className={`mt-1 text-2xl font-bold ${overview.fakeShipRiskCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {overview.fakeShipRiskCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">预估赔付敞口</p>
              <p className="mt-1 text-2xl font-bold text-red-400">¥{overview.totalEstimatedPenalty.toFixed(2)}</p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-orbit-primary-light" />
            <span className="font-semibold text-slate-100">实时履约监控与 48h / 24h 倒计时</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-slate-200"
            >
              <option value="">全部平台</option>
              <option value="pdd">拼多多</option>
              <option value="kuaishou">快手</option>
              <option value="douyin">抖音</option>
              <option value="jd">京东</option>
              <option value="taobao">淘宝</option>
            </select>
            <Button
              size="xs"
              variant={riskOnly ? 'destructive' : 'outline'}
              onClick={() => setRiskOnly((v) => !v)}
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
            >
              仅看风险违约单
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-orbit-border text-xs text-slate-400 bg-orbit-surface2/50">
              <tr>
                <th className="px-4 py-3">平台 / 订单号</th>
                <th className="px-4 py-3">物流单号</th>
                <th className="px-4 py-3 text-right">订单金额</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">发货余量 / 揽收等待</th>
                <th className="px-4 py-3 text-right">预估赔付</th>
                <th className="px-4 py-3">风控归因与操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orbit-border">
              {waybills.map((w) => {
                const st = STATUS_BADGE[w.fulfillment_status] || { label: w.fulfillment_status, variant: 'neutral' as const }
                const marginH = w.ship_margin_hours !== null ? Number(w.ship_margin_hours) : null
                const pickupWait = w.pickup_wait_hours !== null ? Number(w.pickup_wait_hours) : null
                return (
                  <tr key={w.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="info">{w.platform_name}</Badge>
                        <span className="font-mono font-medium text-slate-100">{w.order_no}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{w.shop_name} {w.product_name ? `· ${w.product_name}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-300">
                      {w.waybill_no ? `${w.carrier_code}: ${w.waybill_no}` : <span className="text-slate-500">未上传运单</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">¥{Number(w.order_amount).toFixed(2)}</td>
                    <td className="px-4 py-3"><Badge variant={st.variant} dot>{st.label}</Badge></td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {marginH !== null && (
                        <span className={marginH < 0 ? 'text-red-400 font-semibold' : marginH < 12 ? 'text-amber-400' : 'text-slate-300'}>
                          发货{marginH >= 0 ? `剩 ${marginH}h` : `超 ${Math.abs(marginH)}h`}
                        </span>
                      )}
                      {pickupWait !== null && (
                        <p className={pickupWait > 24 && !w.pickup_at ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                          揽收等 {pickupWait}h
                        </p>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${Number(w.estimated_penalty_amount) > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      ¥{Number(w.estimated_penalty_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {w.sla_risk_reason && (
                        <p className="text-xs text-amber-300 mb-1.5">{w.sla_risk_reason}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {!w.shipped_at && (
                          <Button size="xs" variant="primary" onClick={() => handleDispatch(w, 'ship')}>一键发货</Button>
                        )}
                        {w.shipped_at && !w.pickup_at && (
                          <Button size="xs" variant="secondary" onClick={() => handleDispatch(w, 'pickup')}>标记已揽收</Button>
                        )}
                        {w.pickup_at && w.fulfillment_status === 'in_transit' && (
                          <Button size="xs" variant="outline" onClick={() => handleDispatch(w, 'sign')}>标记签收</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {waybills.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">暂无履约运单数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-100">平台官方法定履约规则配置基准（platform_sla_config）</span>
        </CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rules.filter((r) => ['ship', 'fake_ship', 'ship_delay'].includes(r.sla_type)).map((r) => (
            <div key={r.id} className="rounded-lg border border-orbit-border bg-orbit-surface2/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge variant="info">{r.platform_name}</Badge>
                <span className="text-xs text-slate-400">发货 {r.threshold_hours}h · 揽收 {r.pickup_threshold_hours}h</span>
              </div>
              <p className="text-sm font-medium text-slate-100">{r.sla_name}</p>
              <p className="text-xs text-slate-400">{r.penalty_note}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">录入订单履约监控</h3>
            <form onSubmit={handleCreateWaybill} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.platformCode}
                  onChange={(e) => {
                    const nextPlatform = e.target.value
                    setForm({ ...form, platformCode: nextPlatform, shopId: getDefaultShopId(nextPlatform) })
                  }}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100"
                >
                  <option value="pdd">拼多多</option>
                  <option value="kuaishou">快手</option>
                  <option value="douyin">抖音</option>
                  <option value="jd">京东</option>
                  <option value="taobao">淘宝</option>
                  <option value="tmall">天猫</option>
                </select>
                <select
                  required
                  value={form.shopId}
                  onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100"
                >
                  {getShopsByPlatform(form.platformCode).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {getShopsByPlatform(form.platformCode).length === 0 && (
                    <option value="">暂无可用店铺</option>
                  )}
                </select>
              </div>
              <input required placeholder="订单号" value={form.orderNo} onChange={(e) => setForm({ ...form, orderNo: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" step="0.01" placeholder="订单实付金额" value={form.orderAmount} onChange={(e) => setForm({ ...form, orderAmount: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input placeholder="承运商 (如 SF/YTO)" value={form.carrierCode} onChange={(e) => setForm({ ...form, carrierCode: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              </div>
              <input placeholder="快递单号（选填，留空则进入待发货倒计时）" value={form.waybillNo} onChange={(e) => setForm({ ...form, waybillNo: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              {form.platformCode === 'pdd' && (
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={form.isCustomPresale} onChange={(e) => setForm({ ...form, isCustomPresale: e.target.checked })} />
                  定制/预售商品（拼多多放宽至 120h 发货上限）
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
                <Button type="submit">创建监控</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
