import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle, AlertCircle, Info, Play,
  CalendarDays, BarChart3, Filter,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type Dimension = 'gmv' | 'refundRate' | 'roi' | 'viewers'
type Severity = 'all' | 'critical' | 'warning' | 'info'
type DateRange = '7d' | '30d' | 'quarter'

const dimensionOptions: { value: Dimension; label: string }[] = [
  { value: 'gmv', label: 'GMV' },
  { value: 'refundRate', label: '退款率' },
  { value: 'roi', label: 'ROI' },
  { value: 'viewers', label: '观看人数' },
]

const severityOptions: { value: Severity; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'critical', label: '严重' },
  { value: 'warning', label: '警告' },
  { value: 'info', label: '提示' },
]

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: 'quarter', label: '本季度' },
]

interface AnomalyEvent {
  id: string
  dimension: string
  actualValue: string
  normalRange: string
  deviation: string
  detectedAt: string
  severity: 'critical' | 'warning' | 'info'
  detail: string
}

// 默认空数据 - 从 API 获取后填充

const severityBadgeMap: Record<string, { variant: 'danger' | 'warning' | 'info'; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  critical: { variant: 'danger', label: '严重', icon: AlertTriangle },
  warning: { variant: 'warning', label: '警告', icon: AlertCircle },
  info: { variant: 'info', label: '提示', icon: Info },
}

// const dimLabelMap was unused — using inline labels instead

const dimColorMap: Record<string, string> = {
  GMV: 'text-orbit-primary bg-orbit-primary/10',
  退款率: 'text-amber-400 bg-amber-400/10',
  ROI: 'text-cyan-400 bg-cyan-400/10',
  观看人数: 'text-emerald-400 bg-emerald-400/10',
}

export function AnomalyDetectionPage() {
  const [dimension, setDimension] = useState<Dimension>('gmv')
  const [severity, setSeverity] = useState<Severity>('all')
  const [dateRange, setDateRange] = useState<DateRange>('7d')
  const [isRunning, setIsRunning] = useState(false)
  const [events, setEvents] = useState<AnomalyEvent[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    api.get<any>('/api/bi/anomalies', {
      dimension,
      severity: severity === 'all' ? undefined : severity,
      period: dateRange,
    })
      .then(res => {
        const list = Array.isArray(res) ? res : res?.data ?? []
        if (list.length > 0) {
          setEvents(list.map((item: any) => ({
            id: item.id,
            dimension: item.dimension ?? '',
            actualValue: item.actualValue ?? item.actual_value ?? '',
            normalRange: item.normalRange ?? item.normal_range ?? '',
            deviation: item.deviation ?? '',
            detectedAt: item.detectedAt ?? item.detected_at ?? '',
            severity: item.severity ?? 'info',
            detail: item.detail ?? item.description ?? '',
          })))
        }
      })
      .catch(() => { /* 保持默认数据 */ })
      .finally(() => setLoading(false))
  }, [dimension, severity, dateRange])

  const filteredEvents = events.filter((event) => {
    if (severity !== 'all' && event.severity !== severity) return false
    return true
  })

  const handleRunDetection = useCallback(() => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 2000)
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">异常检测</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">数据异常智能检测</p>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Play className="w-4 h-4" />}
            loading={isRunning}
            onClick={handleRunDetection}
          >
            运行检测
          </Button>
        </div>
      </motion.div>

      {/* Filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap"
      >
        {/* Dimension filter */}
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
          <div className="flex items-center gap-1">
            {dimensionOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDimension(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  dimension === opt.value
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[var(--text-muted)]" />
          <div className="flex items-center gap-1">
            {dateRangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  dateRange === opt.value
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          <div className="flex items-center gap-1">
            {severityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSeverity(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  severity === opt.value
                    ? 'bg-orbit-accent/15 text-orbit-accent-light border border-orbit-accent/30'
                    : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Anomaly event cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {filteredEvents.map((event, i) => {
          const badgeInfo = severityBadgeMap[event.severity]
          const SeverityIcon = badgeInfo.icon
          const dimColorClass = dimColorMap[event.dimension] ?? 'text-[var(--text-muted)] bg-[var(--hover-bg)]'
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.22 + i * 0.06 }}
            >
              <Card className="h-full hover:border-orbit-border2 transition-colors">
                <CardBody>
                  <div className="flex items-start justify-between mb-4">
                    {/* Dimension badge */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${dimColorClass}`}>
                      {event.dimension}
                    </span>
                    {/* Severity badge */}
                    <Badge variant={badgeInfo.variant} dot>
                      <SeverityIcon className="w-3 h-3" />
                      {badgeInfo.label}
                    </Badge>
                  </div>

                  {/* Event details */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">异常值</span>
                      <span className="text-sm font-semibold text-red-400">{event.actualValue}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">正常范围</span>
                      <span className="text-sm text-[var(--text-secondary)]">{event.normalRange}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">偏离幅度</span>
                      <span className={`text-sm font-semibold ${
                        event.deviation.startsWith('+') ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {event.deviation}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">发现时间</span>
                      <span className="text-xs text-[var(--text-muted)]">{event.detectedAt}</span>
                    </div>
                  </div>

                  {/* Detail description */}
                  <div className="mt-4 pt-3 border-t border-orbit-border">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{event.detail}</p>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Empty state */}
      {filteredEvents.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-12 h-12 text-[var(--text-primary)] mb-4" />
                <p className="text-[var(--text-muted)] text-sm">当前筛选条件下暂无异常事件</p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Detail table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader title="异常事件列表" subtitle="全部异常检测事件详细记录" />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">检测维度</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">异常值</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">正常范围</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">偏离幅度</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">发现时间</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">严重程度</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((row) => {
                    const badgeInfo = severityBadgeMap[row.severity]
                    const SeverityIcon = badgeInfo.icon
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-[var(--text-secondary)] font-medium">{row.dimension}</td>
                        <td className="px-5 py-3.5 text-right text-red-400 font-medium tabular-nums">{row.actualValue}</td>
                        <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{row.normalRange}</td>
                        <td className={`px-5 py-3.5 text-right text-sm font-medium tabular-nums ${
                          row.deviation.startsWith('+') ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {row.deviation}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{row.detectedAt}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Badge variant={badgeInfo.variant} dot>
                            <SeverityIcon className="w-3 h-3" />
                            {badgeInfo.label}
                          </Badge>
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