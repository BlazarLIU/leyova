import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, CalendarDays, Users, Package, Megaphone, X, Tags } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { PromotionLayerSimulator } from '@/components/promotions/PromotionLayerSimulator'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type CampaignStatus = 'all' | 'preparing' | 'active' | 'ended'

interface Campaign {
  id: string
  name: string
  type: string
  content: string
  startDate: string
  endDate: string
  status: 'preparing' | 'active' | 'ended'
  rooms: { id: number; name: string }[]
  anchors: { id: number; name: string }[]
}

interface SelectOption {
  id: number
  name: string
}

const statusOptions: { value: CampaignStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'preparing', label: '筹备中' },
  { value: 'active', label: '进行中' },
  { value: 'ended', label: '已结束' },
]

const statusBadgeMap: Record<string, 'warning' | 'success' | 'neutral'> = {
  preparing: 'warning',
  active: 'success',
  ended: 'neutral',
}

const statusLabelMap: Record<string, string> = {
  preparing: '筹备中',
  active: '进行中',
  ended: '已结束',
}

const ACTIVITY_TYPES = [
  '大促活动',
  '新品推广',
  '满赠&满减',
  '周年庆',
  '节日活动',
  '日常促销',
  '其他',
]

export function PromotionCampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<CampaignStatus>('all')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [detailTable, setDetailTable] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [allRooms, setAllRooms] = useState<SelectOption[]>([])
  const [allAnchors, setAllAnchors] = useState<SelectOption[]>([])
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: '',
    content: '',
    startDate: '',
    endDate: '',
    applicableRooms: [] as number[],
    applicableAnchors: [] as number[],
  })

  const loadData = (status: string) => {
    api.get<any>('/api/system/promotions', {
      status: status !== 'all' ? status : undefined,
    })
      .then((res) => {
        if (res.campaigns) setCampaigns(res.campaigns)
        if (res.detailTable) setDetailTable(res.detailTable)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadData(statusFilter)
    // 加载直播间列表和主播列表供下拉选择
    api.get<any>('/api/system/rooms')
      .then((res) => {
        if (Array.isArray(res)) setAllRooms(res.map((r: any) => ({ id: r.id, name: r.name })))
      })
      .catch(() => {})
    api.get<any>('/api/anchors/list')
      .then((res) => {
        if (Array.isArray(res)) setAllAnchors(res.map((a: any) => ({ id: a.id, name: a.name })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadData(statusFilter)
  }, [statusFilter])

  const toggleRoom = (roomId: number) => {
    setNewCampaign(p => ({
      ...p,
      applicableRooms: p.applicableRooms.includes(roomId)
        ? p.applicableRooms.filter(id => id !== roomId)
        : [...p.applicableRooms, roomId],
    }))
  }

  const toggleAnchor = (anchorId: number) => {
    setNewCampaign(p => ({
      ...p,
      applicableAnchors: p.applicableAnchors.includes(anchorId)
        ? p.applicableAnchors.filter(id => id !== anchorId)
        : [...p.applicableAnchors, anchorId],
    }))
  }

  const filteredCampaigns = campaigns.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">活动管理</h1>
            <p className="text-slate-500 text-sm mt-1">活动管理</p>
          </div>
        </div>
      </motion.div>

      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <Button size="sm" onClick={() => setShowCreateForm(v => !v)}>
          <Plus className="w-4 h-4" />
          创建活动
        </Button>

        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-slate-500" />
          <div className="flex items-center gap-1">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Create form */}
      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-orbit-primary/30">
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-200">新建活动</h3>
                <button onClick={() => setShowCreateForm(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* 活动名称 */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">活动名称</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary/50 transition-colors"
                    placeholder="输入活动名称"
                  />
                </div>

                {/* 类型 */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">类型</label>
                  <select
                    value={newCampaign.type}
                    onChange={(e) => setNewCampaign(p => ({ ...p, type: e.target.value }))}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-slate-200 outline-none focus:border-orbit-primary/50 transition-colors"
                  >
                    <option value="">请选择类型</option>
                    {ACTIVITY_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* 开始日期 */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">开始日期</label>
                  <input
                    type="date"
                    value={newCampaign.startDate}
                    onChange={(e) => setNewCampaign(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-slate-200 outline-none focus:border-orbit-primary/50 transition-colors"
                  />
                </div>

                {/* 结束日期 */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">结束日期</label>
                  <input
                    type="date"
                    value={newCampaign.endDate}
                    onChange={(e) => setNewCampaign(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-slate-200 outline-none focus:border-orbit-primary/50 transition-colors"
                  />
                </div>
              </div>

              {/* 活动内容 */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-1">内容</label>
                <textarea
                  value={newCampaign.content}
                  onChange={(e) => setNewCampaign(p => ({ ...p, content: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary/50 transition-colors resize-none"
                  placeholder="输入活动内容描述"
                />
              </div>

              {/* 适用直播间 */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-2">适用直播间</label>
                {allRooms.length === 0 ? (
                  <p className="text-xs text-slate-500">暂无直播间数据</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allRooms.map(room => (
                      <button
                        key={room.id}
                        onClick={() => toggleRoom(room.id)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          newCampaign.applicableRooms.includes(room.id)
                            ? 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/30'
                            : 'bg-orbit-surface2 text-slate-400 border-orbit-border hover:text-slate-300'
                        }`}
                      >
                        {room.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 适用主播 */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-400 mb-2">适用主播</label>
                {allAnchors.length === 0 ? (
                  <p className="text-xs text-slate-500">暂无主播数据</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allAnchors.map(anchor => (
                      <button
                        key={anchor.id}
                        onClick={() => toggleAnchor(anchor.id)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          newCampaign.applicableAnchors.includes(anchor.id)
                            ? 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/30'
                            : 'bg-orbit-surface2 text-slate-400 border-orbit-border hover:text-slate-300'
                        }`}
                      >
                        {anchor.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>取消</Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!newCampaign.name.trim() || !newCampaign.type || !newCampaign.startDate || !newCampaign.endDate) return
                    try {
                      await api.post('/api/system/promotions', newCampaign)
                      setShowCreateForm(false)
                      setNewCampaign({
                        name: '', type: '', content: '', startDate: '', endDate: '',
                        applicableRooms: [], applicableAnchors: [],
                      })
                      const res = await api.get<any>('/api/system/promotions', {
                        status: statusFilter !== 'all' ? statusFilter : undefined,
                      })
                      if (res.campaigns) setCampaigns(res.campaigns)
                      if (res.detailTable) setDetailTable(res.detailTable)
                    } catch {}
                  }}
                >
                  保存
                </Button>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Campaign cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredCampaigns.map((campaign, i) => {
          return (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
            >
              <Card className="hover:border-orbit-border2 transition-colors h-full">
                <CardBody>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-200">{campaign.name}</h4>
                    <Badge variant={statusBadgeMap[campaign.status]}>
                      {statusLabelMap[campaign.status]}
                    </Badge>
                  </div>

                  {campaign.type && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                      <Tags className="w-3 h-3" />
                      <span>{campaign.type}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <CalendarDays className="w-3 h-3" />
                    <span>{campaign.startDate} ~ {campaign.endDate}</span>
                  </div>

                  {campaign.content && (
                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{campaign.content}</p>
                  )}

                  {/* 适用直播间和主播 */}
                  <div className="flex flex-wrap gap-3 mb-3">
                    {campaign.rooms && campaign.rooms.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Package className="w-3 h-3" />
                        <span>{campaign.rooms.map(r => r.name).join(', ')}</span>
                      </div>
                    )}
                    {campaign.anchors && campaign.anchors.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Users className="w-3 h-3" />
                        <span>{campaign.anchors.map(a => a.name).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-orbit-border">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{campaign.anchors?.length ?? 0} 主播</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      <span>{campaign.rooms?.length ?? 0} 直播间</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Detail table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <Card>
          <CardHeader
            title="活动明细"
            subtitle="各活动详细数据对比"
            actions={
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                <Tags className="w-3.5 h-3.5" />
                <span>共 {detailTable.length} 个活动</span>
              </div>
            }
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">活动名称</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">类型</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">状态</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">参与主播</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">直播间数</th>
                  </tr>
                </thead>
                <tbody>
                  {detailTable.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-slate-200 font-medium">{row.name}</td>
                      <td className="px-5 py-3.5 text-slate-400">{row.type || '-'}</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            row.status === '进行中'
                              ? 'success'
                              : row.status === '筹备中'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">{row.anchors}</td>
                      <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">{row.rooms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      <PromotionLayerSimulator />
    </div>
  )
}