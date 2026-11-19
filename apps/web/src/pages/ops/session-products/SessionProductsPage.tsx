import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { motion } from 'framer-motion'
import { Plus, Clock, Package, X, Trash2, Calendar, User, Link as LinkIcon } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface PlanProduct {
  id: number
  planId: number
  groupLetter: string
  productCode: string
  price: number
}

interface SessionPlan {
  id: number
  room_name: string
  planDate: string
  anchor_name: string
  campaign_name: string | null
  campaignStart: string | null
  campaignEnd: string | null
  campaign_type: string | null
  campaign_content: string | null
  notes: string
  createdAt: string
  products: PlanProduct[]
}

export function SessionProductsPage() {
  const [plans, setPlans] = useState<SessionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaipinModal, setShowPaipinModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roomList, setRoomList] = useState<{ id: number; name: string }[]>([])
  const [anchorList, setAnchorList] = useState<{ id: number; name: string }[]>([])
  const [campaignList, setCampaignList] = useState<any[]>([])
  const [deleting, setDeleting] = useState<number | null>(null)
  const [paipinForm, setPaipinForm] = useState({
    roomId: '',
    date: '',
    anchorId: '',
    products: {
      a: { code: '', price: '' },
      b: { code: '', price: '' },
      c: { code: '', price: '' },
      d: { code: '', price: '' },
      e: { code: '', price: '' },
    },
    campaignId: '',
    notes: '',
  })

  const selectedCampaign = paipinForm.campaignId
    ? campaignList.find(c => String(c.id) === paipinForm.campaignId)
    : null

  const loadPlans = () => {
    setLoading(true)
    api.get<any>('/api/v1/ops/session-plans')
      .then((res: any) => setPlans((res?.plans ?? []) as SessionPlan[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPlans()
    api.get<any>('/api/v1/system/rooms')
      .then(res => setRoomList(Array.isArray(res) ? res : []))
      .catch(() => {})
    api.get<any>('/api/v1/personnel/anchors')
      .then(res => setAnchorList(Array.isArray(res) ? res : []))
      .catch(() => {})
    api.get<any>('/api/v1/system/promotions')
      .then(res => {
        const list = res?.campaigns ?? []
        setCampaignList(list.filter((c: any) => c.status === 'preparing' || c.status === 'active'))
      })
      .catch(() => {})
  }, [])

  const totalProducts = plans.reduce((s, p) => s + p.products.length, 0)
  const linkedCampaigns = plans.filter(p => p.campaign_name).length
  const groupLabels = ['A', 'B', 'C', 'D', 'E']

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await api.delete(`/api/v1/ops/session-plans/${id}`)
      setPlans(prev => prev.filter(p => p.id !== id))
    } catch { /* ok */ }
    setDeleting(null)
  }

  const resetForm = () => {
    setPaipinForm({
      roomId: '', date: '', anchorId: '',
      products: { a: { code: '', price: '' }, b: { code: '', price: '' }, c: { code: '', price: '' }, d: { code: '', price: '' }, e: { code: '', price: '' } },
      campaignId: '', notes: '',
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">场次排品</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">直播场次商品排布计划</p>
          </div>
          <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />} onClick={() => setShowPaipinModal(true)}>
            排品
          </Button>
        </div>
      </motion.div>

      {/* 排品概览 */}
      <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.05 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orbit-surface2 border border-orbit-border">
            <Package className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">{plans.length} 个排品计划</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orbit-surface2 border border-orbit-border">
            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">{totalProducts} 个商品</span>
          </div>
          {linkedCampaigns > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orbit-primary/10 border border-orbit-primary/20">
              <LinkIcon className="w-3.5 h-3.5 text-orbit-primary-light" />
              <span className="text-xs text-orbit-primary-light font-medium">{linkedCampaigns} 个关联活动</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* 排品列表 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {loading ? (
          <div className="text-center py-20 text-[var(--text-muted)] text-sm">加载中...</div>
        ) : plans.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-16 text-[var(--text-muted)]">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">暂无排品计划</p>
                <p className="text-xs text-[var(--text-primary)] mt-1">点击右上角「排品」按钮创建第一个计划</p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.map((plan, idx) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className="rounded-xl border border-orbit-border bg-orbit-surface2/60 hover:border-orbit-border2 transition-colors overflow-hidden group"
              >
                {/* Card header */}
                <div className="px-4 py-3 border-b border-orbit-border flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-orbit-primary/10 text-orbit-primary-light shrink-0">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-secondary)] truncate">{plan.room_name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {plan.planDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {plan.anchor_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    disabled={deleting === plan.id}
                    className={cn(
                      'p-1.5 rounded-lg text-[var(--text-primary)] opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all',
                      deleting === plan.id && 'opacity-50 pointer-events-none'
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 space-y-3">
                  {/* Campaign */}
                  {plan.campaign_name && (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-orbit-primary/5 border border-orbit-primary/15">
                      <LinkIcon className="w-3 h-3 text-orbit-primary-light shrink-0" />
                      <div className="text-[11px] text-[var(--text-muted)] min-w-0">
                        <span className="text-[var(--text-secondary)] font-medium">{plan.campaign_name}</span>
                        {plan.campaignStart && (
                          <span className="text-[var(--text-primary)] ml-2">
                            {(plan.campaignStart || '').split('T')[0]} ~ {(plan.campaignEnd || '').split('T')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Products grid */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {groupLabels.map(letter => {
                      const prod = plan.products.find(p => p.groupLetter === letter)
                      return (
                        <div key={letter} className={cn(
                          'rounded-lg border px-2 py-1.5 text-center',
                          prod ? 'border-orbit-border bg-orbit-surface3' : 'border-dashed border-orbit-border/40 bg-transparent'
                        )}>
                          <p className={cn(
                            'text-[10px] font-bold mb-0.5',
                            prod ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
                          )}>{letter}</p>
                          {prod ? (
                            <>
                              <p className="text-[10px] text-[var(--text-muted)] truncate">{prod.productCode}</p>
                              <p className="text-[10px] text-orbit-primary-light font-medium">¥{Number(prod.price).toLocaleString()}</p>
                            </>
                          ) : (
                            <p className="text-[10px] text-[var(--text-primary)]">未设置</p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Notes */}
                  {plan.notes && (
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed px-1 line-clamp-2">{plan.notes}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* 排品弹窗 */}
      {showPaipinModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center overflow-y-auto py-6" onClick={() => setShowPaipinModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-[var(--text-secondary)]">排品</h3>
              <button onClick={() => setShowPaipinModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* 直播间 */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">直播间 *</label>
                <select value={paipinForm.roomId} onChange={e => setPaipinForm(p => ({ ...p, roomId: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value="">请选择直播间</option>
                  {roomList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {/* 日期 */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">日期 *</label>
                <input type="date" value={paipinForm.date} onChange={e => setPaipinForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
              </div>
              {/* 主播 */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">主播 *</label>
                <select value={paipinForm.anchorId} onChange={e => setPaipinForm(p => ({ ...p, anchorId: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value="">请选择主播</option>
                  {anchorList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {/* A/B/C/D/E 商品组 */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">商品组</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['a', 'b', 'c', 'd', 'e'] as const).map(group => (
                    <div key={group} className="p-3 rounded-lg border border-orbit-border bg-orbit-surface2">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase">{group}</p>
                      <div className="space-y-2">
                        <input value={paipinForm.products[group].code} onChange={e => setPaipinForm(p => ({ ...p, products: { ...p.products, [group]: { ...p.products[group], code: e.target.value } } }))}
                          className="w-full h-8 rounded-lg border border-orbit-border bg-orbit-surface3 px-2.5 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="货号" />
                        <input value={paipinForm.products[group].price} onChange={e => setPaipinForm(p => ({ ...p, products: { ...p.products, [group]: { ...p.products[group], price: e.target.value } } }))}
                          className="w-full h-8 rounded-lg border border-orbit-border bg-orbit-surface3 px-2.5 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="到手价" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 关联活动 */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">是否关联活动</label>
                <select value={paipinForm.campaignId} onChange={e => setPaipinForm(p => ({ ...p, campaignId: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value="">不关联</option>
                  {campaignList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedCampaign && (
                  <div className="mt-3 p-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-[var(--text-muted)] space-y-1">
                    <p><span className="text-[var(--text-muted)]">活动名称：</span>{selectedCampaign.name}</p>
                    <p><span className="text-[var(--text-muted)]">活动类型：</span>{selectedCampaign.type}</p>
                    <p><span className="text-[var(--text-muted)]">活动时间：</span>{(selectedCampaign.start_date || '').split('T')[0]} ~ {(selectedCampaign.end_date || '').split('T')[0]}</p>
                    {selectedCampaign.content && <p><span className="text-[var(--text-muted)]">活动内容：</span>{selectedCampaign.content}</p>}
                  </div>
                )}
              </div>
              {/* 备注 */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">备注</label>
                <textarea value={paipinForm.notes} onChange={e => setPaipinForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full min-h-[60px] rounded-lg border border-orbit-border bg-orbit-surface2 px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 resize-y" placeholder="备注信息..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => { setShowPaipinModal(false); resetForm() }}>取消</Button>
              <Button variant="primary" onClick={async () => {
                if (!paipinForm.roomId || !paipinForm.anchorId) return
                setSaving(true)
                try {
                  await api.post('/api/v1/ops/session-plans', paipinForm)
                  setShowPaipinModal(false)
                  resetForm()
                  loadPlans()
                } catch { /* ok */ }
                finally { setSaving(false) }
              }} loading={saving}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}