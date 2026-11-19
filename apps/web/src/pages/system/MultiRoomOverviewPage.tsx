import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, ArrowUpDown, Users, DollarSign, Eye, Radio, Monitor, TrendingUp, ShoppingCart } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type SortKey = 'gmv' | 'viewers' | 'views'

interface RoomData {
  id: string
  name: string
  anchor: string
  onlineUsers: number
  realtimeGmv: number
  totalViews: number
  status: 'live' | 'ended'
  conversionRate: number
  avgOrderValue: number
}

const sortOptions: { value: SortKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'gmv', label: 'GMV', icon: DollarSign },
  { value: 'viewers', label: '在线人数', icon: Users },
  { value: 'views', label: '观看量', icon: Eye },
]



function formatGmv(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`
  }
  return `¥${value.toLocaleString()}`
}

function formatNumber(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`
  }
  return value.toLocaleString()
}

export function MultiRoomOverviewPage() {
  const [sortKey, setSortKey] = useState<SortKey>('gmv')
  const [dateFilter, setDateFilter] = useState('today')
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [summaryTable, setSummaryTable] = useState<any[]>([])

  useEffect(() => {
    api.get<any>('/api/system/multi-room')
      .then((res) => {
        if (res.rooms) setRooms(res.rooms)
        if (res.summaryTable) setSummaryTable(res.summaryTable)
      })
      .catch(() => {})
  }, [])

  const sortedRooms = [...rooms].sort((a, b) => {
    if (sortKey === 'gmv') return b.realtimeGmv - a.realtimeGmv
    if (sortKey === 'viewers') return b.onlineUsers - a.onlineUsers
    return b.totalViews - a.totalViews
  })

  const dateOptions = ['今天', '昨天', '近7天', '近30天']

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">多直播间总览</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">多直播间数据总览</p>
          </div>
        </div>
      </motion.div>

      {/* Filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        {/* Date filter */}
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[var(--text-muted)]" />
          <div className="flex items-center gap-1">
            {dateOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setDateFilter(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  dateFilter === opt
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-[var(--text-muted)]" />
          <div className="flex items-center gap-1">
            {sortOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setSortKey(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    sortKey === opt.value
                      ? 'bg-orbit-accent/15 text-orbit-accent-light border border-orbit-accent/30'
                      : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>

      {/* Room cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRooms.map((room, i) => (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
          >
            <Card className="hover:border-orbit-border2 transition-colors h-full">
              <CardBody>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-[var(--text-muted)]" />
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--text-secondary)]">{room.name}</h4>
                      <p className="text-xs text-[var(--text-muted)]">{room.anchor}</p>
                    </div>
                  </div>
                  <Badge variant={room.status === 'live' ? 'success' : 'neutral'} dot>
                    {room.status === 'live' ? '直播中' : '已结束'}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 rounded-lg bg-orbit-surface2 border border-orbit-border">
                    <Users className="w-3.5 h-3.5 text-orbit-primary-light mx-auto mb-0.5" />
                    <p className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums">{formatNumber(room.onlineUsers)}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">在线</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-orbit-surface2 border border-orbit-border">
                    <DollarSign className="w-3.5 h-3.5 text-status-success mx-auto mb-0.5" />
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">{formatGmv(room.realtimeGmv)}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">实时GMV</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-orbit-surface2 border border-orbit-border">
                    <Eye className="w-3.5 h-3.5 text-orbit-accent-light mx-auto mb-0.5" />
                    <p className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums">{formatNumber(room.totalViews)}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">累计观看</p>
                  </div>
                </div>

                {/* Mini stats bar */}
                <div className="flex items-center gap-4 pt-3 border-t border-orbit-border text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>
                      转化率{' '}
                      <span className="text-[var(--text-secondary)] font-medium">
                        {room.conversionRate > 0 ? `${room.conversionRate}%` : '-'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" />
                    <span>
                      客单价{' '}
                      <span className="text-[var(--text-secondary)] font-medium">
                        {room.avgOrderValue > 0 ? `¥${room.avgOrderValue}` : '-'}
                      </span>
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Summary table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <Card>
          <CardHeader
            title="房间汇总数据"
            subtitle="所有直播间数据对比"
            actions={
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                <Radio className="w-3.5 h-3.5" />
                <span>共 {summaryTable.length} 个房间</span>
              </div>
            }
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">房间名称</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">主播</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">在线人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">实时GMV</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">累计观看</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">转化率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">客单价</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryTable.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-[var(--text-primary)]" />
                          <span className="text-[var(--text-secondary)] font-medium">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-muted)]">{row.anchor}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{formatNumber(row.online)}</td>
                      <td className="px-5 py-3.5 text-right text-status-success font-medium">{row.gmv}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{formatNumber(row.views)}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{row.conversion}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{row.avgOrder}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={row.status === '直播中' ? 'success' : 'neutral'} dot>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}