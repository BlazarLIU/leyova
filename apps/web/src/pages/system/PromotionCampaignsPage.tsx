import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  CalendarDays,
  Users,
  Package,
  Megaphone,
  X,
  Tags,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'
import { PromotionLayerSimulator } from '@/components/promotions/PromotionLayerSimulator'

export type CampaignStatus = 'all' | 'preparing' | 'active' | 'ended'

export interface Campaign {
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

export interface SelectOption {
  id: number
  name: string
}

const statusOptions: { value: CampaignStatus; label: string }[] = [
  { value: 'all', label: '全部状态' },
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
  '全部类型',
  '大促活动',
  '新品推广',
  '满赠&满减',
  '周年庆',
  '节日活动',
  '日常促销',
  '其他',
]

export function PromotionCampaignsPage() {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
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

  // Table using useTable
  const table = useTable<Campaign, { status: string; type: string }>({
    initialFilters: { status: 'all', type: '全部类型' },
    initialPageSize: 20,
    fetchData: async ({ search, filters }) => {
      const res = await api.get<any>('/api/system/promotions', {
        status: filters.status !== 'all' ? filters.status : undefined,
      })

      const rawCampaigns: Campaign[] = Array.isArray(res?.campaigns) ? res.campaigns : []
      const filtered = rawCampaigns.filter((c) => {
        if (filters.type !== '全部类型' && c.type !== filters.type) return false
        if (!search) return true
        const q = search.toLowerCase()
        const matchRoom = c.rooms?.some((r) => r.name.toLowerCase().includes(q))
        const matchAnchor = c.anchors?.some((a) => a.name.toLowerCase().includes(q))
        return (
          c.name.toLowerCase().includes(q) ||
          (c.content && c.content.toLowerCase().includes(q)) ||
          (c.type && c.type.toLowerCase().includes(q)) ||
          matchRoom ||
          matchAnchor
        )
      })

      return {
        items: filtered,
        total: filtered.length,
      }
    },
  })

  // Load auxiliary data: rooms and anchors
  useEffect(() => {
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

  const toggleRoom = (roomId: number) => {
    setNewCampaign((p) => ({
      ...p,
      applicableRooms: p.applicableRooms.includes(roomId)
        ? p.applicableRooms.filter((id) => id !== roomId)
        : [...p.applicableRooms, roomId],
    }))
  }

  const toggleAnchor = (anchorId: number) => {
    setNewCampaign((p) => ({
      ...p,
      applicableAnchors: p.applicableAnchors.includes(anchorId)
        ? p.applicableAnchors.filter((id) => id !== anchorId)
        : [...p.applicableAnchors, anchorId],
    }))
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCampaign.name.trim() || !newCampaign.type || !newCampaign.startDate || !newCampaign.endDate) {
      alert('请完整填写活动名称、类型及起止日期')
      return
    }

    try {
      await api.post('/api/system/promotions', newCampaign)
      setShowCreateForm(false)
      setNewCampaign({
        name: '',
        type: '',
        content: '',
        startDate: '',
        endDate: '',
        applicableRooms: [],
        applicableAnchors: [],
      })
      await table.reload()
    } catch (err: any) {
      alert(err?.message || '创建营销活动失败')
    }
  }

  // Derived Stats
  const stats = useMemo(() => {
    const list = table.data
    const total = table.total
    const active = list.filter((c) => c.status === 'active').length
    const preparing = list.filter((c) => c.status === 'preparing').length
    const ended = list.filter((c) => c.status === 'ended').length

    const uniqueAnchors = new Set<string>()
    const uniqueRooms = new Set<string>()
    list.forEach((c) => {
      c.anchors?.forEach((a) => uniqueAnchors.add(a.name))
      c.rooms?.forEach((r) => uniqueRooms.add(r.name))
    })

    return {
      total,
      active,
      preparing,
      ended,
      anchorCount: uniqueAnchors.size,
      roomCount: uniqueRooms.size,
    }
  }, [table.data, table.total])

  // Table Columns
  const columns: ColumnDef<Campaign>[] = useMemo(
    () => [
      {
        key: 'name',
        header: '活动名称与主题',
        render: (_, campaign) => (
          <div className="py-1">
            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              {campaign.name}
              {campaign.type && (
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-orbit-surface2 text-orbit-primary-light border border-orbit-border">
                  {campaign.type}
                </span>
              )}
            </div>
            {campaign.content && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{campaign.content}</p>
            )}
          </div>
        ),
      },
      {
        key: 'period',
        header: '活动周期',
        width: 220,
        render: (_, campaign) => (
          <div className="text-xs text-[var(--text-secondary)] font-mono inline-flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>
              {campaign.startDate} ~ {campaign.endDate}
            </span>
          </div>
        ),
      },
      {
        key: 'status',
        header: '活动状态',
        width: 110,
        align: 'center',
        render: (_, campaign) => (
          <Badge variant={statusBadgeMap[campaign.status] || 'neutral'}>
            {statusLabelMap[campaign.status] || campaign.status}
          </Badge>
        ),
      },
      {
        key: 'rooms',
        header: '适用直播间',
        width: 200,
        render: (_, campaign) => {
          const roomList = campaign.rooms || []
          if (roomList.length === 0) return <span className="text-[var(--text-muted)] text-xs">全员/通用</span>
          return (
            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <Package className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <span className="truncate max-w-[170px]" title={roomList.map((r) => r.name).join(', ')}>
                {roomList.map((r) => r.name).join(', ')}
              </span>
            </div>
          )
        },
      },
      {
        key: 'anchors',
        header: '适用主播',
        width: 180,
        render: (_, campaign) => {
          const anchorList = campaign.anchors || []
          if (anchorList.length === 0) return <span className="text-[var(--text-muted)] text-xs">全员/通用</span>
          return (
            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <Users className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <span className="truncate max-w-[150px]" title={anchorList.map((a) => a.name).join(', ')}>
                {anchorList.map((a) => a.name).join(', ')}
              </span>
            </div>
          )
        },
      },
    ],
    []
  )

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px] text-[var(--text-primary)]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">营销活动总数</span>
              <Activity className="w-4 h-4 text-orbit-primary-light" />
            </div>
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">全渠道已企划大促与日常促销</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">进行中大促</span>
              <CheckCircle2 className="w-4 h-4 text-status-success" />
            </div>
            <p className="mt-1 text-2xl font-bold text-status-success">{stats.active}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">当前周期线上正生效活动</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">筹备预热 / 已结束</span>
              <Clock className="w-4 h-4 text-status-warning" />
            </div>
            <p className="mt-1 text-2xl font-bold text-status-warning">
              {stats.preparing} / <span className="text-[var(--text-muted)]">{stats.ended}</span>
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">锁定排班备选中及历史沉淀</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">覆盖主播 / 直播间</span>
              <Sparkles className="w-4 h-4 text-status-info" />
            </div>
            <p className="mt-1 text-2xl font-bold text-status-info">
              {stats.anchorCount} 位 / {stats.roomCount} 间
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">当前筛选口径下受影响主体</p>
          </CardBody>
        </Card>
      </div>

      <DataPage<Campaign>
        title="营销大促与促销活动管理"
        subtitle="全渠道营销大促排期、活动利益点配置与适用直播间/主播阵列协同"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-orbit-primary-light border border-orbit-border">
            DataPage + useTable
          </span>
        }
        table={table}
        columns={columns}
        searchPlaceholder="搜索活动名称、类型、内容或直播间/主播..."
        exportFilename="promotion_campaigns"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-orbit-ink/80 p-0.5 rounded-lg border border-[var(--border)] mr-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-orbit-primary/20 text-orbit-primary-light'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="表格明细视图"
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-orbit-primary/20 text-orbit-primary-light'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="卡片矩阵视图"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              创建营销活动
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.reload()}
              loading={table.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          </div>
        }
        filterControls={
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">状态:</span>
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => table.setFilter('status', opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    table.filters.status === opt.value
                      ? 'bg-orbit-primary/20 text-orbit-primary-light border border-orbit-primary/40'
                      : 'text-orbit-snow/60 bg-orbit-ink/80 border border-[var(--border)] hover:text-orbit-snow'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-2">
              <Tags className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">类型:</span>
              <select
                value={table.filters.type}
                onChange={(e) => table.setFilter('type', e.target.value)}
                className="h-7 px-2 text-xs rounded border border-[var(--border)] bg-orbit-ink text-orbit-snow/80 focus:outline-none focus:border-orbit-primary/50"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        {/* If Cards View is selected, render card grid above simulator */}
        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {table.data.map((campaign, i) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <Card className="hover:border-orbit-border2 transition-colors h-full border border-orbit-border">
                  <CardBody>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">{campaign.name}</h4>
                      <Badge variant={statusBadgeMap[campaign.status]}>
                        {statusLabelMap[campaign.status] || campaign.status}
                      </Badge>
                    </div>

                    {campaign.type && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2">
                        <Tags className="w-3.5 h-3.5" />
                        <span>{campaign.type}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-3 font-mono">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>
                        {campaign.startDate} ~ {campaign.endDate}
                      </span>
                    </div>

                    {campaign.content && (
                      <p className="text-xs text-[var(--text-muted)] mb-3 line-clamp-2 leading-relaxed">
                        {campaign.content}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3 mb-3">
                      {campaign.rooms && campaign.rooms.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Package className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span>{campaign.rooms.map((r) => r.name).join(', ')}</span>
                        </div>
                      )}
                      {campaign.anchors && campaign.anchors.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span>{campaign.anchors.map((a) => a.name).join(', ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border)]">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{campaign.anchors?.length ?? 0} 位主播</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        <span>{campaign.rooms?.length ?? 0} 个直播间</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <PromotionLayerSimulator />
        </div>
      </DataPage>

      {/* 创建营销活动弹窗 */}
      <AnimatePresence>
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-orbit-ink border border-[var(--border)] rounded-2xl w-full max-w-xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-4">
                <h3 className="text-base font-bold text-orbit-snow flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-orbit-primary-light" />
                  新建营销大促活动
                </h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-orbit-snow/60 hover:text-orbit-snow"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 活动名称 */}
                  <div>
                    <label className="block text-orbit-snow/80 mb-1 font-medium">活动名称</label>
                    <input
                      type="text"
                      required
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))}
                      className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border)] bg-orbit-ink text-orbit-snow placeholder:text-orbit-snow/35 focus:outline-none focus:border-orbit-primary/50"
                      placeholder="输入活动名称，如双11狂欢节"
                    />
                  </div>

                  {/* 类型 */}
                  <div>
                    <label className="block text-orbit-snow/80 mb-1 font-medium">活动类型</label>
                    <select
                      required
                      value={newCampaign.type}
                      onChange={(e) => setNewCampaign((p) => ({ ...p, type: e.target.value }))}
                      className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border)] bg-orbit-ink text-orbit-snow focus:outline-none focus:border-orbit-primary/50"
                    >
                      <option value="">请选择类型</option>
                      {ACTIVITY_TYPES.filter((t) => t !== '全部类型').map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 开始日期 */}
                  <div>
                    <label className="block text-orbit-snow/80 mb-1 font-medium">开始日期</label>
                    <input
                      type="date"
                      required
                      value={newCampaign.startDate}
                      onChange={(e) => setNewCampaign((p) => ({ ...p, startDate: e.target.value }))}
                      className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border)] bg-orbit-ink text-orbit-snow focus:outline-none focus:border-orbit-primary/50"
                    />
                  </div>

                  {/* 结束日期 */}
                  <div>
                    <label className="block text-orbit-snow/80 mb-1 font-medium">结束日期</label>
                    <input
                      type="date"
                      required
                      value={newCampaign.endDate}
                      onChange={(e) => setNewCampaign((p) => ({ ...p, endDate: e.target.value }))}
                      className="w-full h-9 px-3 text-xs rounded-lg border border-[var(--border)] bg-orbit-ink text-orbit-snow focus:outline-none focus:border-orbit-primary/50"
                    />
                  </div>
                </div>

                {/* 活动内容 */}
                <div>
                  <label className="block text-orbit-snow/80 mb-1 font-medium">活动方案与利益点说明</label>
                  <textarea
                    value={newCampaign.content}
                    onChange={(e) => setNewCampaign((p) => ({ ...p, content: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-orbit-ink text-orbit-snow placeholder:text-orbit-snow/35 focus:outline-none focus:border-orbit-primary/50 resize-none"
                    placeholder="输入活动核心玩法、满减规则、补贴机制等"
                  />
                </div>

                {/* 适用直播间 */}
                <div>
                  <label className="block text-orbit-snow/80 mb-1.5 font-medium">
                    适用直播间（点击选择或全选）
                  </label>
                  {allRooms.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">暂无直播间数据</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-lg border border-[var(--border)] bg-orbit-ink/40">
                      {allRooms.map((room) => {
                        const isSelected = newCampaign.applicableRooms.includes(room.id)
                        return (
                          <button
                            type="button"
                            key={room.id}
                            onClick={() => toggleRoom(room.id)}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                              isSelected
                                ? 'bg-orbit-primary/20 text-orbit-primary-light border-orbit-primary/40 font-medium'
                                : 'bg-orbit-ink text-orbit-snow/60 border-[var(--border)] hover:text-orbit-snow'
                            }`}
                          >
                            {room.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 适用主播 */}
                <div>
                  <label className="block text-orbit-snow/80 mb-1.5 font-medium">
                    适用主播（点击选择或全选）
                  </label>
                  {allAnchors.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">暂无主播数据</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-lg border border-[var(--border)] bg-orbit-ink/40">
                      {allAnchors.map((anchor) => {
                        const isSelected = newCampaign.applicableAnchors.includes(anchor.id)
                        return (
                          <button
                            type="button"
                            key={anchor.id}
                            onClick={() => toggleAnchor(anchor.id)}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                              isSelected
                                ? 'bg-orbit-primary/20 text-orbit-primary-light border-orbit-primary/40 font-medium'
                                : 'bg-orbit-ink text-orbit-snow/60 border-[var(--border)] hover:text-orbit-snow'
                            }`}
                          >
                            {anchor.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    保存活动
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default PromotionCampaignsPage
