import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { motion } from 'framer-motion'
import { Target, Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type TimeRange = 'month' | 'quarter' | 'year'

interface GoalItem {
  id: string
  name: string
  target: number
  current: number
  unit: string
  status: 'achieved' | 'ongoing' | 'behind'
  category: string
}

const timeRanges: { label: string; value: TimeRange }[] = [
  { label: '本月', value: 'month' },
  { label: '本季度', value: 'quarter' },
  { label: '本年', value: 'year' },
]

// 默认空数据 - 从 API 获取后填充

const statusConfig: Record<string, { variant: 'success' | 'primary' | 'danger'; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  achieved: { variant: 'success', label: '已达成', icon: CheckCircle2 },
  ongoing: { variant: 'primary', label: '进行中', icon: Clock },
  behind: { variant: 'danger', label: '滞后', icon: AlertTriangle },
}

const categoryColors: Record<string, string> = {
  '营收': 'bg-orbit-primary/15 text-orbit-primary-light',
  '效率': 'bg-orbit-warning/15 text-amber-400',
  '增长': 'bg-orbit-success/15 text-emerald-400',
  '流量': 'bg-orbit-accent/15 text-cyan-400',
  '服务': 'bg-orbit-info/15 text-orbit-info',
  '团队': 'bg-orbit-primary/15 text-orbit-primary',
  '运营': 'bg-orange-500/15 text-orange-400',
}

export function GoalTrackingPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('month')
  const [goals, setGoals] = useState<GoalItem[]>([])

  useEffect(() => {
    api.get<any>('/api/v1/ops/goal-tracking', { period: timeRange })
      .then((res) => {
        if (res && res.goals && Array.isArray(res.goals)) {
          setGoals(res.goals.map((g: any, i: number) => ({
            id: g.id ?? `G-${String(i + 1).padStart(3, '0')}`,
            name: g.name ?? '',
            target: g.target ?? 0,
            current: g.current ?? 0,
            unit: g.unit ?? '',
            status: (g.progress != null ? (g.progress >= 100 ? 'achieved' : g.progress >= 50 ? 'ongoing' : 'behind') : 'ongoing') as 'achieved' | 'ongoing' | 'behind',
            category: g.category ?? '营收',
          })))
        }
      })
      .catch(() => {})
  }, [timeRange])

  const overallProgress = Math.round(
    (goals.reduce((s, g) => s + g.current, 0) / goals.reduce((s, g) => s + g.target, 0)) * 100
  )

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">目标达成</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">目标完成情况跟踪</p>
          </div>
          {/* Time range selector */}
          <div className="flex items-center gap-1.5 bg-orbit-surface rounded-lg border border-orbit-border p-1">
            {timeRanges.map((t) => (
              <button
                key={t.value}
                onClick={() => setTimeRange(t.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                  timeRange === t.value
                    ? 'bg-orbit-primary/15 text-orbit-primary-light'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                <Calendar className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Overall progress */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-[var(--text-muted)] font-medium">综合目标达成进度</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{overallProgress}%</p>
              </div>
              <div className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium',
                overallProgress >= 80 ? 'bg-emerald-500/10 text-emerald-400' :
                overallProgress >= 50 ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              )}>
                {overallProgress >= 80 ? '进度正常' : overallProgress >= 50 ? '需要关注' : '严重滞后'}
              </div>
            </div>
            <div className="h-2.5 bg-orbit-surface2 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={cn(
                  'h-full rounded-full',
                  overallProgress >= 80 ? 'bg-orbit-success' :
                  overallProgress >= 50 ? 'bg-orbit-warning' :
                  'bg-orbit-danger'
                )}
              />
            </div>
            <p className="text-xs text-[var(--text-primary)] mt-2">
              已完成 {goals.filter((g) => g.status === 'achieved').length} 个目标，
              {goals.filter((g) => g.status === 'behind').length} 个滞后
            </p>
          </CardBody>
        </Card>
      </motion.div>

      {/* Goal cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {goals.map((goal, i) => {
          const progress = Math.min(Math.round((goal.current / goal.target) * 100), 100)
          const status = statusConfig[goal.status]
          const StatusIcon = status.icon
          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
            >
              <Card className="hover:border-orbit-border2 transition-colors">
                <CardBody>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('p-2 rounded-lg', categoryColors[goal.category] || 'bg-orbit-surface2 text-[var(--text-muted)]')}>
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">{goal.name}</h3>
                        <p className="text-[10px] text-[var(--text-primary)]">{goal.category}</p>
                      </div>
                    </div>
                    <Badge variant={status.variant} dot>
                      <span className="flex items-center gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </Badge>
                  </div>

                  {/* Values */}
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-2xl font-bold text-[var(--text-primary)]">
                      {goal.current.toLocaleString()}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">/ {goal.target.toLocaleString()} {goal.unit}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-orbit-surface2 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: 'easeOut' }}
                      className={cn(
                        'h-full rounded-full',
                        goal.status === 'achieved' ? 'bg-orbit-success' :
                        goal.status === 'ongoing' ? 'bg-orbit-primary' :
                        'bg-orbit-danger'
                      )}
                    />
                  </div>

                  {/* Progress label */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-xs font-medium',
                      goal.status === 'achieved' ? 'text-emerald-400' :
                      goal.status === 'ongoing' ? 'text-orbit-primary' :
                      'text-red-400'
                    )}>
                      {progress}%
                    </span>
                    {goal.status === 'achieved' && (
                      <span className="text-xs text-emerald-400/70">已超额完成目标</span>
                    )}
                    {goal.status === 'behind' && (
                      <span className="text-xs text-red-400/70">落后 {100 - progress}%</span>
                    )}
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Goal detail table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <Card>
          <CardHeader title="目标明细" subtitle="各维度目标完成明细数据" />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border text-[var(--text-muted)] text-xs">
                    <th className="text-left py-3 px-5 font-medium">目标名称</th>
                    <th className="text-right py-3 px-5 font-medium">目标值</th>
                    <th className="text-right py-3 px-5 font-medium">当前值</th>
                    <th className="text-center py-3 px-5 font-medium">完成率</th>
                    <th className="text-center py-3 px-5 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map((goal, i) => {
                    const progress = Math.min(Math.round((goal.current / goal.target) * 100), 100)
                    const status = statusConfig[goal.status]
                    return (
                      <tr
                        key={goal.id}
                        className={cn(
                          'border-b border-orbit-border transition-colors hover:bg-white/[0.02]',
                          i === goals.length - 1 && 'border-b-0'
                        )}
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className={cn('p-1.5 rounded-lg', categoryColors[goal.category] || 'bg-orbit-surface2')}>
                              <Target className="w-3 h-3" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[var(--text-secondary)]">{goal.name}</p>
                              <p className="text-[10px] text-[var(--text-primary)]">{goal.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right text-[var(--text-secondary)] font-medium">
                          {goal.target.toLocaleString()} {goal.unit}
                        </td>
                        <td className="py-3.5 px-5 text-right text-[var(--text-secondary)] font-medium">
                          {goal.current.toLocaleString()} {goal.unit}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-1.5 bg-orbit-surface2 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  goal.status === 'achieved' ? 'bg-orbit-success' :
                                  goal.status === 'ongoing' ? 'bg-orbit-primary' :
                                  'bg-orbit-danger'
                                )}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className={cn(
                              'text-xs font-medium w-8 text-right',
                              goal.status === 'achieved' ? 'text-emerald-400' :
                              goal.status === 'ongoing' ? 'text-orbit-primary' :
                              'text-red-400'
                            )}>
                              {progress}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}