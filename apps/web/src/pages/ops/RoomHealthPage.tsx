import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { MessageCircle, TrendingUp, Film, Radio, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface RoomHealthData {
  id: string
  name: string
  healthScore: number
  interactionScore: number
  conversionScore: number
  contentScore: number
  trafficScore: number
  status: 'healthy' | 'warning' | 'danger'
}

// 默认空数据 - 从 API 获取后填充

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  healthy: { variant: 'success', label: '健康' },
  warning: { variant: 'warning', label: '亚健康' },
  danger: { variant: 'danger', label: '危险' },
}

const dimensionConfig = [
  { key: 'interactionScore' as const, label: '互动分', icon: MessageCircle, color: 'bg-cyan-500/15 text-cyan-400' },
  { key: 'conversionScore' as const, label: '转化分', icon: TrendingUp, color: 'bg-emerald-500/15 text-emerald-400' },
  { key: 'contentScore' as const, label: '内容分', icon: Film, color: 'bg-violet-500/15 text-violet-400' },
  { key: 'trafficScore' as const, label: '流量分', icon: Radio, color: 'bg-orange-500/15 text-orange-400' },
]

function getHealthColor(score: number): string {
  if (score >= 80) return 'bg-orbit-success'
  if (score >= 60) return 'bg-orbit-warning'
  return 'bg-orbit-danger'
}

function getHealthTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

export function RoomHealthPage() {
  const [rooms, setRooms] = useState<RoomHealthData[]>([])

  useEffect(() => {
    api.get<RoomHealthData[]>('/api/v1/ops/room-health')
      .then(setRooms)
      .catch(() => {})
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">直播间健康度</h1>
            <p className="text-slate-500 text-sm mt-1">直播间健康评估</p>
          </div>
          <Badge variant="info" dot>实时监测中</Badge>
        </div>
      </motion.div>

      {/* Summary stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orbit-success/15 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">健康直播间</p>
                <p className="text-lg font-bold text-slate-100">
                  {rooms.filter((r) => r.status === 'healthy').length} 个
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orbit-warning/15 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">亚健康直播间</p>
                <p className="text-lg font-bold text-slate-100">
                  {rooms.filter((r) => r.status === 'warning').length} 个
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orbit-danger/15 text-red-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">危险直播间</p>
                <p className="text-lg font-bold text-slate-100">
                  {rooms.filter((r) => r.status === 'danger').length} 个
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Room cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rooms.map((room, i) => {
          const status = statusConfig[room.status]
          return (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
            >
              <Card className={cn(
                'hover:border-orbit-border2 transition-colors',
                room.status === 'danger' && 'border-orbit-danger/20',
                room.status === 'warning' && 'border-orbit-warning/20',
              )}>
                <CardBody>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'p-2 rounded-lg',
                        room.status === 'healthy' ? 'bg-orbit-success/15 text-emerald-400' :
                        room.status === 'warning' ? 'bg-orbit-warning/15 text-amber-400' :
                        'bg-orbit-danger/15 text-red-400'
                      )}>
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-200">{room.name}</h3>
                        <Badge variant={status.variant} dot>{status.label}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Health score */}
                  <div className="text-center mb-4">
                    <div className="relative inline-flex items-center justify-center mb-2">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
                        <circle
                          cx="36"
                          cy="36"
                          r="30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="text-orbit-surface2"
                        />
                        <motion.circle
                          cx="36"
                          cy="36"
                          r="30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={188.5}
                          initial={{ strokeDashoffset: 188.5 }}
                          animate={{ strokeDashoffset: 188.5 - (188.5 * room.healthScore) / 100 }}
                          transition={{ duration: 1, delay: 0.3 + i * 0.05, ease: 'easeOut' }}
                          className={getHealthColor(room.healthScore).replace('bg-', 'text-')}
                        />
                      </svg>
                      <span className={cn('absolute text-xl font-bold', getHealthTextColor(room.healthScore))}>
                        {room.healthScore}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">健康分</p>
                  </div>

                  {/* Dimension scores */}
                  <div className="space-y-2.5">
                    {dimensionConfig.map((dim) => {
                      const score = room[dim.key]
                      return (
                        <div key={dim.key} className="flex items-center gap-2.5">
                          <div className={cn('p-1 rounded-lg flex-shrink-0', dim.color)}>
                            <dim.icon className="w-3 h-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-slate-500">{dim.label}</span>
                              <span className={cn('text-[10px] font-medium', getHealthTextColor(score))}>
                                {score}
                              </span>
                            </div>
                            <div className="h-1.5 bg-orbit-surface2 rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', getHealthColor(score))}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}