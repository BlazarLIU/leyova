import { useState, useEffect, useCallback } from 'react'
import { Undo2, ShieldCheck, Clock, Plus, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useShops } from '@/hooks/useShops'
import { usePlatform } from '@/hooks/usePlatform'
import { api } from '@/services/api'

interface AfterSaleTicket {
  id: number
  ticket_no: string
  platform_code: string
  platform_name: string
  shop_name: string
  source_order_id: string
  source_refund_id: string
  sku_code?: string
  product_name?: string
  refund_type: 'only_refund' | 'return_refund' | 'exchange'
  refund_amount: string
  reason_category: string
  reason_detail: string
  ticket_status: string
  shop_experience_score: string
  autonomy_protected: boolean
  audit_deadline_at: string | null
  remaining_hours: string | null
  resolution_note: string
}

interface AfterSaleOverview {
  totalTickets: number
  openTickets: number
  timeoutRiskCount: number
  autonomyProtectedCount: number
  totalRefundAmount: number
  canonicalRefundRows: number
  reasonAttribution: Array<{
    reasonCategory: string
    ticketCount: number
    refundAmount: number
    amountShare: number
  }>
}

const REASON_LABELS: Record<string, string> = {
  size_mismatch: '尺码/规格不符',
  quality_defect: '品质做工瑕疵',
  logistics_slow: '物流超时未揽收',
  not_as_described: '图文描述差异',
  buyer_remorse: '7天无理由/买错',
  other: '其他原因',
}

const REFUND_TYPE_LABELS: Record<string, string> = {
  only_refund: '仅退款',
  return_refund: '退货退款',
  exchange: '售后换货',
}

const TICKET_STATUS_MAP: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'danger' | 'neutral' }> = {
  pending_audit: { label: '待商家自审', variant: 'warning' },
  waiting_return: { label: '待买家退回', variant: 'info' },
  approved: { label: '已同意退款', variant: 'success' },
  rejected: { label: '已拒绝申诉', variant: 'danger' },
  platform_intervened: { label: '平台介入', variant: 'danger' },
  closed: { label: '已闭环归档', variant: 'neutral' },
}

export function AfterSalesPage() {
  const { currentPlatform } = usePlatform()
  const [overview, setOverview] = useState<AfterSaleOverview | null>(null)
  const [tickets, setTickets] = useState<AfterSaleTicket[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { getShopsByPlatform, getDefaultShopId } = useShops()
  const [form, setForm] = useState({
    platformCode: currentPlatform?.platform_code || 'douyin',
    shopId: '',
    sourceOrderId: '',
    refundType: 'only_refund',
    refundAmount: '229',
    reasonCategory: 'size_mismatch',
    reasonDetail: '',
    shopExperienceScore: '4.76',
  })

  // 监听顶栏平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      const p = currentPlatform.platform_code
      setForm((prev) => ({ ...prev, platformCode: p, shopId: getDefaultShopId(p) }))
    }
  }, [currentPlatform?.platform_code, getDefaultShopId])

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
      const [ov, tk] = await Promise.all([
        api.get<AfterSaleOverview>('/after-sales/overview'),
        api.get<AfterSaleTicket[]>('/after-sales/tickets', {
          status: statusFilter || undefined,
        }),
      ])
      setOverview(ov)
      setTickets(tk || [])
    } catch (err: any) {
      setErrorMsg(err?.message || '加载售后工单失败')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      await api.post('/after-sales/tickets', {
        platformCode: form.platformCode,
        shopId: Number(form.shopId),
        sourceOrderId: form.sourceOrderId,
        refundType: form.refundType,
        refundAmount: Number(form.refundAmount),
        reasonCategory: form.reasonCategory,
        reasonDetail: form.reasonDetail,
        shopExperienceScore: Number(form.shopExperienceScore),
      })
      setShowModal(false)
      setForm({ ...form, sourceOrderId: '', reasonDetail: '' })
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.message || '新建售后工单失败')
    }
  }

  const handleTransition = async (id: number, ticketStatus: 'waiting_return' | 'approved' | 'rejected' | 'closed') => {
    setErrorMsg('')
    try {
      await api.patch(`/after-sales/tickets/${id}/handle`, {
        ticketStatus,
        resolutionNote: `运营工作台操作流转至 ${ticketStatus}`,
      })
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.message || '处理售后工单失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">售后退货原因归因与工单闭环</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            实时跟踪快手 24h 仅退款 / 36h 退货退款商家自审倒计时、经验分 ≥4.7/4.8 自治保护，并同步写入 canonical_refund_events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            刷新
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)} icon={<Plus className="w-4 h-4" />}>
            新建售后工单
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
              <p className="text-xs text-[var(--text-muted)]">售后工单 / 待处置</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{overview.totalTickets} / {overview.openTickets}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">6h 临期/超时预警</p>
              <p className={`mt-1 text-2xl font-bold ${overview.timeoutRiskCount > 0 ? 'text-status-danger' : 'text-status-success'}`}>
                {overview.timeoutRiskCount}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">经验分仅退款自治保护</p>
              <p className="mt-1 text-2xl font-bold text-status-success">{overview.autonomyProtectedCount}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">工单累计退款额</p>
              <p className="mt-1 text-2xl font-bold text-status-warning">¥{overview.totalRefundAmount.toLocaleString()}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">标准退款分区事件数</p>
              <p className="mt-1 text-2xl font-bold text-status-ai">{overview.canonicalRefundRows}</p>
            </CardBody>
          </Card>
        </div>
      )}

      {overview && overview.reasonAttribution.length > 0 && (
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-status-warning" />
            <span className="font-semibold text-[var(--text-primary)]">退款原因归因占比分布</span>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overview.reasonAttribution.map((item) => (
              <div key={item.reasonCategory} className="rounded-lg border border-orbit-border bg-orbit-surface2/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">{REASON_LABELS[item.reasonCategory] || item.reasonCategory}</span>
                  <span className="text-[var(--text-muted)]">{item.ticketCount} 单 · ¥{item.refundAmount.toFixed(0)} ({item.amountShare}%)</span>
                </div>
                <div className="h-2 rounded-full bg-orbit-surface3 overflow-hidden">
                  <div className="h-full bg-orbit-primary" style={{ width: `${Math.min(100, item.amountShare)}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orbit-primary-light" />
            <span className="font-semibold text-[var(--text-primary)]">售后工单自审队列</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-[var(--text-secondary)]"
          >
            <option value="">全部状态</option>
            <option value="pending_audit">待商家自审</option>
            <option value="waiting_return">待买家退回</option>
            <option value="approved">已同意退款</option>
            <option value="rejected">已拒绝申诉</option>
            <option value="closed">已闭环归档</option>
          </select>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-orbit-border text-xs text-[var(--text-muted)] bg-orbit-surface2/50">
              <tr>
                <th className="px-4 py-3">工单号 / 平台订单</th>
                <th className="px-4 py-3">类型与原因归因</th>
                <th className="px-4 py-3 text-right">退款金额</th>
                <th className="px-4 py-3">自治/体验分</th>
                <th className="px-4 py-3 text-right">审单倒计时</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">处置操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orbit-border">
              {tickets.map((t) => {
                const st = TICKET_STATUS_MAP[t.ticket_status] || { label: t.ticket_status, variant: 'neutral' as const }
                const rem = t.remaining_hours !== null ? Number(t.remaining_hours) : null
                return (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="info">{t.platform_name}</Badge>
                        <span className="font-mono font-medium text-[var(--text-primary)]">{t.ticket_no}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">订单 {t.source_order_id} · {t.product_name || t.shop_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{REFUND_TYPE_LABELS[t.refund_type] || t.refund_type}</Badge>
                      <span className="ml-2 text-xs text-[var(--text-secondary)]">{REASON_LABELS[t.reason_category] || t.reason_category}</span>
                      {t.reason_detail && <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.reason_detail}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-status-warning">
                      ¥{Number(t.refund_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-[var(--text-secondary)]">{t.shop_experience_score} 分</span>
                      {t.autonomy_protected && (
                        <Badge variant="success" className="ml-1.5"><ShieldCheck className="w-3 h-3" /> 自治保护</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {rem !== null && ['pending_audit', 'waiting_return'].includes(t.ticket_status) ? (
                        <span className={rem <= 6 ? 'text-status-danger font-semibold' : 'text-[var(--text-secondary)]'}>
                          {rem >= 0 ? `余 ${rem}h` : `超时 ${Math.abs(rem)}h`}
                        </span>
                      ) : <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-3"><Badge variant={st.variant} dot>{st.label}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {t.ticket_status === 'pending_audit' && (
                          <>
                            <Button size="xs" variant="primary" onClick={() => handleTransition(t.id, 'approved')}>同意退款</Button>
                            <Button size="xs" variant="outline" onClick={() => handleTransition(t.id, 'rejected')}>拒绝申诉</Button>
                          </>
                        )}
                        {t.ticket_status === 'waiting_return' && (
                          <Button size="xs" variant="secondary" onClick={() => handleTransition(t.id, 'closed')}>确认收货闭环</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无售后工单数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">新建售后工单并同步标准退款事件</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.platformCode}
                  onChange={(e) => {
                    const nextPlatform = e.target.value
                    setForm({ ...form, platformCode: nextPlatform, shopId: getDefaultShopId(nextPlatform) })
                  }}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                >
                  <option value="douyin">抖音</option>
                  <option value="kuaishou">快手 (24h/36h自审)</option>
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
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {getShopsByPlatform(form.platformCode).length === 0 && (
                    <option value="">暂无可用店铺</option>
                  )}
                </select>
              </div>
              <input required placeholder="原订单号" value={form.sourceOrderId} onChange={(e) => setForm({ ...form, sourceOrderId: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.refundType} onChange={(e) => setForm({ ...form, refundType: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]">
                  <option value="only_refund">仅退款</option>
                  <option value="return_refund">退货退款</option>
                  <option value="exchange">售后换货</option>
                </select>
                <select value={form.reasonCategory} onChange={(e) => setForm({ ...form, reasonCategory: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]">
                  <option value="size_mismatch">尺码/规格不符</option>
                  <option value="quality_defect">品质做工瑕疵</option>
                  <option value="logistics_slow">物流超时未揽收</option>
                  <option value="not_as_described">图文描述差异</option>
                  <option value="buyer_remorse">7天无理由/买错</option>
                  <option value="other">其他原因</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" step="0.01" placeholder="退款金额" value={form.refundAmount} onChange={(e) => setForm({ ...form, refundAmount: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
                <input required type="number" step="0.01" placeholder="店铺体验分" value={form.shopExperienceScore} onChange={(e) => setForm({ ...form, shopExperienceScore: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
              </div>
              <input placeholder="具体说明（如拉链坏了、尺码偏小）" value={form.reasonDetail} onChange={(e) => setForm({ ...form, reasonDetail: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
                <Button type="submit">提交工单</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

