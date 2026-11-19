import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Eye, Users, DollarSign, ShoppingCart, Radio, RefreshCw, Monitor } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface MetricItem {
  id: string
  label: string
  value: string
  change: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}

interface RoomItem {
  id: string
  name: string
  anchor: string
  online: number
  gmv: string
  status: string
  duration: string
}



function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const s = 0
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function LiveMonitorPage() {
  const [metrics, setMetrics] = useState<MetricItem[]>([])
  const [rooms, setRooms] = useState<RoomItem[]>([])

  const fetchData = () => {
    api.get<Record<string, any>>('/api/v1/overview/live-monitor')
      .then(data => {
        if (!data) return

        // Update metrics from summary
        if (data.summary) {
          setMetrics([
            {
              id: 'online',
              label: '实时在线',
              value: (data.summary.total_online ?? 0).toLocaleString(),
              change: '—',
              icon: Eye,
              color: 'text-cyan-400',
              bg: 'bg-cyan-500/10',
            },
            {
              id: 'total-views',
              label: '今日累计观看',
              value: (data.summary.cumulative_views ?? 0).toLocaleString(),
              change: '—',
              icon: Users,
              color: 'text-orbit-primary',
              bg: 'bg-orbit-primary/10',
            },
            {
              id: 'realtime-gmv',
              label: '实时 GMV',
              value: `¥${((data.summary.real_time_gmv ?? 0) / 10000).toFixed(1)}万`,
              change: '—',
              icon: DollarSign,
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10',
            },
            {
              id: 'orders',
              label: '今日订单数',
              value: (data.summary.orders ?? 0).toLocaleString(),
              change: '—',
              icon: ShoppingCart,
              color: 'text-amber-400',
              bg: 'bg-amber-500/10',
            },
          ])
        }

        // Update rooms
        if (Array.isArray(data.rooms) && data.rooms.length > 0) {
          setRooms(data.rooms.map((r: any, i: number) => ({
            id: `R${String(r.room_id ?? i + 1).padStart(3, '0')}`,
            name: r.room_name ?? '未知直播间',
            anchor: r.anchor ?? '未知主播',
            online: r.online ?? 0,
            gmv: r.gmv > 0 ? `¥${(r.gmv / 10000).toFixed(1)}万` : '¥0',
            status: r.status === 'live' ? 'live' : 'ended',
            duration: r.duration > 0 ? formatDuration(r.duration) : '00:00:00',
          })))
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">实时监控</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">直播间实时数据监控</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] bg-orbit-surface2 px-3 py-1.5 rounded-lg border border-orbit-border">
            <RefreshCw className="w-3.5 h-3.5 text-orbit-accent animate-spin" />
            数据每30秒自动刷新
          </div>
        </div>
      </motion.div>

      {/* Real-time metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((metric, i) => {
          const Icon = metric.icon
          return (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              className="bg-orbit-surface rounded-xl border border-orbit-border hover:border-orbit-border2 transition-colors overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${metric.bg}`}>
                    <Icon className={`w-4 h-4 ${metric.color}`} />
                  </div>
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                    {metric.change}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium mb-1">{metric.label}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{metric.value}</p>
              </div>
              {/* Live indicator bar */}
              <div className="h-1 bg-gradient-to-r from-orbit-accent to-orbit-accent/20" />
            </motion.div>
          )
        })}
      </div>

      {/* Room status table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader
            title="直播间状态"
            subtitle={`共 ${rooms.length} 个直播间，${rooms.filter(r => r.status === 'live').length} 个直播中`}
            actions={
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Monitor className="w-3.5 h-3.5" />
              </div>
            }
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">房间名</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">主播</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">在线人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">实时 GMV</th>
                    <th className="text-center text-xs text-[var(--text-muted)] font-medium px-5 py-3">状态</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">时长</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-[var(--text-muted)]">
                        <Radio className="w-8 h-8 mx-auto mb-2 text-[var(--text-primary)]" />
                        <p className="text-sm">暂无直播间数据</p>
                        <p className="text-xs text-[var(--text-primary)] mt-1">数据将在直播间开播后自动显示</p>
                      </td>
                    </tr>
                  ) : (
                    rooms.map((room) => (
                      <tr
                        key={room.id}
                        className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Radio className={`w-4 h-4 ${room.status === 'live' ? 'text-emerald-400 animate-pulse' : 'text-[var(--text-primary)]'}`} />
                            <span className="text-[var(--text-secondary)] font-medium">{room.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-muted)]">{room.anchor}</td>
                        <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] font-medium tabular-nums">
                          {room.online.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right text-emerald-400 font-medium">{room.gmv}</td>
                        <td className="px-5 py-3.5 text-center">
                          {room.status === 'live' ? (
                            <Badge variant="success" dot>直播中</Badge>
                          ) : (
                            <Badge variant="neutral">已结束</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[var(--text-muted)] tabular-nums">{room.duration}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}