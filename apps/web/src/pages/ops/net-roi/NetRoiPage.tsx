import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, RefreshCw, Plus, ShieldCheck, AlertTriangle, Clock } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { usePlatform } from '@/hooks/usePlatform'

interface NetRoiOverview {
  range: { from: string; to: string }
  costMasked: boolean
  summary: {
    total_ad_spend: number
    total_attributed_gross_gmv: number
    total_attributed_settled_gmv: number
    total_refund_reserve: number
    pay_roi: number
    net_roi: number
    total_impressions: number
    total_clicks: number
    avg_cpc: number
    total_attributed_orders: number
    total_platform_fee: number | null
  }
  dualTimeline: Array<{
    id: number
    platform_code: string
    platform_name: string
    shop_id: number
    shop_name: string
    order_date: string
    settle_date: string
    settlement_cycle_days: number
    gross_gmv: string
    settled_gmv: string
    refund_deducted: string
    reserve_held: string
    ad_spend: string
    pay_roi: number
    net_roi: number
    platform_fee: number | null
    settlement_status: string
    note: string
  }>
  byTool: Array<{
    ad_tool_code: string
    ad_tool_name: string
    platform_code: string
    default_attribution_hours: number | null
    impression_window_hours: number
    supported_windows: string
    settlement_cycle_days: number
    ad_spend: string
    attributed_gross_gmv: string
    attributed_settled_gmv: string
    refund_reserve_amount: string
    pay_roi: number
    net_roi: number
  }>
}

interface AttributionTool {
  code: string
  name: string
  platform_code: string
  platform_name: string
  default_attribution_hours: number | null
  impression_window_hours: number
  supported_windows: string
  settlement_cycle_days: number
  is_verified: boolean
  description: string
}

interface ShopOption {
  id: number
  platform_code: string
  shop_name: string
}

const WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'ad_buyer']

const statusVariant: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
  settled: 'success',
  partial: 'info',
  pending: 'warning',
  frozen: 'danger',
}

export function NetRoiPage() {
  const { hasRole } = useAuth()
  const { currentPlatform } = usePlatform()
  const canWrite = hasRole(WRITE_ROLES)

  const [platform, setPlatform] = useState(() => currentPlatform?.platform_code || '')
  const [overview, setOverview] = useState<NetRoiOverview | null>(null)
  const [tools, setTools] = useState<AttributionTool[]>([])
  const [shops, setShops] = useState<ShopOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddSpend, setShowAddSpend] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    platformCode: currentPlatform?.platform_code || 'douyin',
    shopId: '',
    bizDate: new Date().toISOString().slice(0, 10),
    adToolCode: 'qianchuan',
    adSpend: '',
    attributedGrossGmv: '',
    attributedSettledGmv: '',
    refundReserveAmount: '',
    impressions: '',
    clicks: '',
    attributedOrders: '',
  })

  // 监听顶栏平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      setPlatform(currentPlatform.platform_code)
      setForm((prev) => ({ ...prev, platformCode: currentPlatform.platform_code }))
    }
  }, [currentPlatform?.platform_code])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, win, sh] = await Promise.all([
        api.get<NetRoiOverview>('/net-roi/overview', platform ? { platform } : undefined),
        api.get<AttributionTool[]>('/net-roi/attribution-windows'),
        api.get<ShopOption[]>('/omnichannel/shops').catch(() => []),
      ])
      setOverview(ov)
      setTools(Array.isArray(win) ? win : [])
      setShops(Array.isArray(sh) ? sh : [])
    } catch (err: any) {
      setError(err?.message || '加载 T+7 净成交 ROI 数据失败')
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => {
    load()
  }, [load])

  const filteredTools = tools.filter((t) => t.platform_code === form.platformCode)
  const filteredShops = shops.filter((s) => s.platform_code === form.platformCode)

  const submitSpend = async () => {
    if (!form.shopId || !form.adToolCode || !form.adSpend) return
    setSaving(true)
    try {
      await api.post('/net-roi/ad-spend', {
        platformCode: form.platformCode,
        shopId: Number(form.shopId),
        bizDate: form.bizDate,
        adToolCode: form.adToolCode,
        adSpend: Number(form.adSpend),
        attributedGrossGmv: Number(form.attributedGrossGmv || 0),
        attributedSettledGmv: Number(form.attributedSettledGmv || 0),
        refundReserveAmount: Number(form.refundReserveAmount || 0),
        impressions: Number(form.impressions || 0),
        clicks: Number(form.clicks || 0),
        attributedOrders: Number(form.attributedOrders || 0),
      })
      setShowAddSpend(false)
      await load()
    } catch (err: any) {
      setError(err?.message || '保存投流消耗失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            全域投流与 T+7 净成交 ROI 双时间线
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            同步对比 T+0 消耗支付 ROI（千川/万相台/精准通/聚光）与 T+N 回款周期核销净成交 ROI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-xs text-slate-200"
          >
            <option value="">全部平台</option>
            <option value="douyin">抖音</option>
            <option value="kuaishou">快手</option>
            <option value="wechat">视频号</option>
            <option value="taobao">淘宝</option>
            <option value="tmall">天猫</option>
            <option value="xiaohongshu">小红书</option>
          </select>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {canWrite && (
            <Button size="sm" variant="primary" onClick={() => setShowAddSpend((v) => !v)}>
              <Plus className="w-3.5 h-3.5" />
              录入投流日耗
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </span>
          <Button size="sm" variant="secondary" onClick={load}>重试</Button>
        </div>
      )}

      {showAddSpend && canWrite && (
        <Card>
          <CardHeader title="录入投流消耗与归因结算口径" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">平台</label>
                <select
                  value={form.platformCode}
                  onChange={(e) => {
                    const p = e.target.value
                    const firstTool = tools.find((t) => t.platform_code === p)?.code || ''
                    const firstShop = shops.find((s) => s.platform_code === p)?.id
                    setForm({ ...form, platformCode: p, adToolCode: firstTool, shopId: firstShop ? String(firstShop) : '' })
                  }}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                >
                  {['douyin', 'kuaishou', 'wechat', 'taobao', 'tmall', 'xiaohongshu'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">店铺</label>
                <select
                  value={form.shopId}
                  onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                >
                  <option value="">选择店铺</option>
                  {filteredShops.map((s) => (
                    <option key={s.id} value={s.id}>{s.shop_name} (#{s.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">投流工具</label>
                <select
                  value={form.adToolCode}
                  onChange={(e) => setForm({ ...form, adToolCode: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                >
                  {filteredTools.map((t) => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">消耗日期</label>
                <input
                  type="date"
                  value={form.bizDate}
                  onChange={(e) => setForm({ ...form, bizDate: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">消耗金额 (元)</label>
                <input
                  type="number"
                  value={form.adSpend}
                  onChange={(e) => setForm({ ...form, adSpend: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                  placeholder="例如 12000"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">T+0 归因支付 GMV</label>
                <input
                  type="number"
                  value={form.attributedGrossGmv}
                  onChange={(e) => setForm({ ...form, attributedGrossGmv: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">T+N 预估/已结算净 GMV</label>
                <input
                  type="number"
                  value={form.attributedSettledGmv}
                  onChange={(e) => setForm({ ...form, attributedSettledGmv: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">退款减扣预备金</label>
                <input
                  type="number"
                  value={form.refundReserveAmount}
                  onChange={(e) => setForm({ ...form, refundReserveAmount: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowAddSpend(false)}>取消</Button>
              <Button size="sm" variant="primary" onClick={submitSpend} disabled={saving}>
                {saving ? '保存中...' : '保存消耗'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {overview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <Card><CardBody>
              <div className="text-xs text-slate-400">总投流消耗</div>
              <div className="text-xl font-bold text-slate-100 mt-1 tabular-nums">¥{overview.summary.total_ad_spend.toLocaleString()}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">T+0 归因支付 GMV</div>
              <div className="text-xl font-bold text-cyan-400 mt-1 tabular-nums">¥{overview.summary.total_attributed_gross_gmv.toLocaleString()}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">支付 ROI {overview.summary.pay_roi}x</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">T+N 结算净 GMV</div>
              <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">¥{overview.summary.total_attributed_settled_gmv.toLocaleString()}</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">净成交 ROI {overview.summary.net_roi}x</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">退款/预留核减</div>
              <div className="text-xl font-bold text-amber-400 mt-1 tabular-nums">¥{overview.summary.total_refund_reserve.toLocaleString()}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">平均点击成本 (CPC)</div>
              <div className="text-xl font-bold text-slate-200 mt-1 tabular-nums">¥{overview.summary.avg_cpc.toFixed(2)}</div>
            </CardBody></Card>
          </div>

          <Card>
            <CardHeader
              title="T+0 下单 vs T+N 账期回款双时间线"
              subtitle="按订单日与平台官方结算日对照，消除只看支付 ROI 造成的虚假盈利幻觉"
            />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-orbit-border text-slate-500">
                      <th className="text-left px-4 py-2.5">平台/店铺</th>
                      <th className="text-left px-4 py-2.5">T+0 下单日</th>
                      <th className="text-left px-4 py-2.5">T+N 结算日</th>
                      <th className="text-right px-4 py-2.5">支付 GMV</th>
                      <th className="text-right px-4 py-2.5">核减退款</th>
                      <th className="text-right px-4 py-2.5">净结算 GMV</th>
                      <th className="text-right px-4 py-2.5">消耗</th>
                      <th className="text-right px-4 py-2.5">支付 ROI vs 净 ROI</th>
                      <th className="text-left px-4 py-2.5">结算状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.dualTimeline.map((row) => (
                      <tr key={row.id} className="border-b border-orbit-border/60 hover:bg-white/5">
                        <td className="px-4 py-2.5 text-slate-200">{row.platform_name} · {row.shop_name}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-300">{String(row.order_date).slice(0, 10)}</td>
                        <td className="px-4 py-2.5 font-mono text-cyan-300">
                          {String(row.settle_date).slice(0, 10)} <span className="text-slate-500">(T+{row.settlement_cycle_days})</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">¥{Number(row.gross_gmv).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-400">-¥{Number(row.refund_deducted).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">¥{Number(row.settled_gmv).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">¥{Number(row.ad_spend).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className="text-slate-400">{row.pay_roi}x</span>
                          <span className="mx-1 text-slate-600">→</span>
                          <span className="font-semibold text-emerald-400">{row.net_roi}x</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={statusVariant[row.settlement_status] || 'neutral'}>{row.settlement_status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <Card>
        <CardHeader
          title="7 大平台官方归因窗口与账期校准字典"
          subtitle="对应各平台官方投流工具 2026 年标准点击/曝光归因窗口及默认净成交回款周期"
        />
        <CardBody className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-orbit-border text-slate-500">
                  <th className="text-left px-4 py-2.5">平台</th>
                  <th className="text-left px-4 py-2.5">投流工具</th>
                  <th className="text-right px-4 py-2.5">点击窗口</th>
                  <th className="text-right px-4 py-2.5">曝光窗口</th>
                  <th className="text-left px-4 py-2.5">支持周期</th>
                  <th className="text-right px-4 py-2.5">结算账期</th>
                  <th className="text-left px-4 py-2.5">官方校准</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => (
                  <tr key={t.code} className="border-b border-orbit-border/60 hover:bg-white/5">
                    <td className="px-4 py-2.5 text-slate-300">{t.platform_name || t.platform_code}</td>
                    <td className="px-4 py-2.5 text-slate-100 font-medium">{t.name} <span className="text-slate-500 font-mono">({t.code})</span></td>
                    <td className="px-4 py-2.5 text-right text-cyan-300 tabular-nums">
                      {t.default_attribution_hours ? `${t.default_attribution_hours}h` : '自定义'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums">{t.impression_window_hours}h</td>
                    <td className="px-4 py-2.5 text-slate-300">{t.supported_windows}</td>
                    <td className="px-4 py-2.5 text-right text-slate-200 tabular-nums">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" />T+{t.settlement_cycle_days}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {t.is_verified ? <Badge variant="success"><ShieldCheck className="w-3 h-3 inline mr-0.5" />已核验</Badge> : <Badge variant="warning">待校准</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
