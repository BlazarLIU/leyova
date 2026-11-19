import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Users, CalendarDays, Clock, BookOpen, Star } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface TrainingPlan {
  id: string
  name: string
  anchorCount: number
  startDate: string
  endDate: string
  progress: number
  status: 'in_progress' | 'completed'
}

interface TrainingRecord {
  id: string
  date: string
  anchor: string
  project: string
  duration: string
  completion: 'full' | 'partial' | 'missed'
  score: number
}

const filterTabs = [
  { value: 'all', label: '全部' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
] as const

type FilterValue = (typeof filterTabs)[number]['value']

const planStatusBadgeMap: Record<string, 'warning' | 'success'> = {
  in_progress: 'warning',
  completed: 'success',
}

const planStatusLabelMap: Record<string, string> = {
  in_progress: '进行中',
  completed: '已完成',
}

const completionBadgeMap: Record<string, 'success' | 'warning' | 'danger'> = {
  full: 'success',
  partial: 'warning',
  missed: 'danger',
}

const completionLabelMap: Record<string, string> = {
  full: '已完成',
  partial: '部分完成',
  missed: '未完成',
}

export function TrainingPage() {
  const [filter, setFilter] = useState<FilterValue>('all')
  const [plans, setPlans] = useState<TrainingPlan[]>([])
  const [records, setRecords] = useState<TrainingRecord[]>([])

  // 筛选变化时重新请求训练计划
  useEffect(() => {
    const params: Record<string, string | number | undefined> = {}
    if (filter !== 'all') params.status = filter

    api.get<{ plans: any[] }>('/api/training/plans', params)
      .then((res) => {
        const list = res?.plans ?? []
        if (list.length > 0) {
          setPlans(list.map((item: any) => ({
            id: String(item.id ?? ''),
            name: item.name ?? '',
            anchorCount: item.anchorCount ?? item.anchor_count ?? 0,
            startDate: item.startDate ?? item.start_date ?? '',
            endDate: item.endDate ?? item.end_date ?? '',
            progress: item.progress ?? 0,
            status: item.status as 'in_progress' | 'completed',
          })))
        }
      })
      .catch(() => { /* 保持默认数据 */ })

    // 首次加载时也获取训练记录
    if (filter === 'all') {
      api.get<{ records: any[] }>('/api/training/records')
        .then((res) => {
          const list = res?.records ?? []
          if (list.length > 0) {
            setRecords(list.map((item: any) => ({
              id: String(item.id ?? ''),
              date: item.date ?? '',
              anchor: item.anchor ?? '',
              project: item.project ?? '',
              duration: item.duration ?? '',
              completion: item.completion as 'full' | 'partial' | 'missed',
              score: item.score ?? 0,
            })))
          }
        })
        .catch(() => { /* 保持默认数据 */ })
    }
  }, [filter])

  const filteredPlans = plans.filter((plan) => {
    return filter === 'all' || plan.status === filter
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">训练管理</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">主播训练计划与记录</p>
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
        <div className="flex items-center gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                filter === tab.value
                  ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                  : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <Button icon={<Plus className="w-4 h-4" />} size="sm">
            创建训练计划
          </Button>
        </div>
      </motion.div>

      {/* Training plan cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredPlans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i }}
          >
            <Card className="h-full hover:border-orbit-border2 transition-colors">
              <CardBody className="flex flex-col h-full">
                {/* Plan header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orbit-primary/15">
                      <BookOpen className="w-4 h-4 text-orbit-primary-light" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{plan.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Users className="w-3 h-3 text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-muted)]">{plan.anchorCount}人参与</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={planStatusBadgeMap[plan.status]}>
                    {planStatusLabelMap[plan.status]}
                  </Badge>
                </div>

                {/* Date range */}
                <div className="flex items-center gap-3 mb-3 text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>{plan.startDate}</span>
                  </div>
                  <span className="text-[var(--text-primary)]">至</span>
                  <div className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>{plan.endDate}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-auto space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">训练进度</span>
                    <span className={cn(
                      'font-medium tabular-nums',
                      plan.progress === 100 ? 'text-emerald-400' : 'text-[var(--text-secondary)]'
                    )}>
                      {plan.progress}%
                    </span>
                  </div>
                  <div className="h-2 bg-orbit-surface3 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        plan.progress === 100
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : 'bg-gradient-to-r from-orbit-primary to-orbit-primary-dark'
                      )}
                      style={{ width: `${plan.progress}%` }}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Training records table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">训练记录</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">近期训练执行记录</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
              <Clock className="w-3.5 h-3.5" />
              <span>最近记录</span>
            </div>
          </div>
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">日期</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">主播</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">训练项目</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">时长</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">完成情况</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">评分</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-[var(--text-muted)]">{record.date}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-[var(--text-secondary)] font-medium">{record.anchor}</span>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)]">{record.project}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{record.duration}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={completionBadgeMap[record.completion]}>
                          {completionLabelMap[record.completion]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {record.completion === 'missed' ? (
                          <span className="text-[var(--text-primary)] text-xs">--</span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <span className={cn(
                              'font-semibold tabular-nums',
                              record.score >= 90 ? 'text-emerald-400' : record.score >= 80 ? 'text-[var(--text-secondary)]' : 'text-amber-400'
                            )}>
                              {record.score}
                            </span>
                            <Star className={cn(
                              'w-3 h-3',
                              record.score >= 90 ? 'fill-emerald-400/30 text-emerald-400' : 'text-[var(--text-primary)]'
                            )} />
                          </div>
                        )}
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