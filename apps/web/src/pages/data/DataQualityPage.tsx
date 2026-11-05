import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Search, Filter } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface QualityMetric {
  id: string
  label: string
  value: string
  percentage: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  trend: 'up' | 'down'
  change: string
}

interface QualityIssue {
  id: string
  tableName: string
  issueType: '缺失值' | '异常值' | '格式错误'
  affectedRows: number
  severity: '高' | '中' | '低'
  foundTime: string
  status: 'open' | 'resolved'
}

const severityConfig: Record<string, { variant: 'danger' | 'warning' | 'info'; label: string }> = {
  '高': { variant: 'danger', label: '高' },
  '中': { variant: 'warning', label: '中' },
  '低': { variant: 'info', label: '低' },
}

const issueTypeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  '缺失值': XCircle,
  '异常值': AlertTriangle,
  '格式错误': AlertTriangle,
}

const issueTypeColor: Record<string, string> = {
  '缺失值': 'text-rose-400',
  '异常值': 'text-amber-400',
  '格式错误': 'text-orange-400',
}

const defaultQualityMetrics: QualityMetric[] = [
  { id: 'completeness', label: '数据完整性', value: '-', percentage: 0, icon: CheckCircle2, color: 'text-emerald-400', trend: 'up', change: '' },
  { id: 'accuracy', label: '数据准确性', value: '-', percentage: 0, icon: CheckCircle2, color: 'text-cyan-400', trend: 'up', change: '' },
  { id: 'consistency', label: '数据一致性', value: '-', percentage: 0, icon: CheckCircle2, color: 'text-violet-400', trend: 'up', change: '' },
  { id: 'timeliness', label: '数据及时性', value: '-', percentage: 0, icon: CheckCircle2, color: 'text-amber-400', trend: 'up', change: '' },
]

export function DataQualityPage() {
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [metrics, setMetrics] = useState<QualityMetric[]>([])
  const [issues, setIssues] = useState<QualityIssue[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    api.get<any>('/api/data/quality')
      .then(res => {
        const data = res?.data ?? res
        if (data) {
          if (data.metrics && Array.isArray(data.metrics)) {
            setMetrics(data.metrics.map((m: any, idx: number) => ({
              id: m.id ?? defaultQualityMetrics[idx]?.id ?? `m${idx}`,
              label: m.label ?? defaultQualityMetrics[idx]?.label ?? '',
              value: m.value ?? '',
              percentage: m.percentage ?? 0,
              icon: defaultQualityMetrics[idx]?.icon ?? CheckCircle2,
              color: m.color ?? defaultQualityMetrics[idx]?.color ?? 'text-emerald-400',
              trend: m.trend ?? 'up',
              change: m.change ?? '',
            })))
          }
          if (data.issues && Array.isArray(data.issues)) {
            setIssues(data.issues.map((i: any) => ({
              id: i.id,
              tableName: i.tableName ?? i.table_name ?? '',
              issueType: i.issueType ?? i.issue_type ?? '缺失值',
              affectedRows: i.affectedRows ?? i.affected_rows ?? 0,
              severity: i.severity ?? '低',
              foundTime: i.foundTime ?? i.found_time ?? i.detected_at ?? '',
              status: i.status ?? 'open',
            })))
          }
        }
      })
      .catch(() => { /* 保持默认数据 */ })
      .finally(() => setLoading(false))
  }, [])

  const filteredIssues = issues.filter(issue => {
    const matchSearch = issue.tableName.toLowerCase().includes(search.toLowerCase())
    const matchSeverity = severityFilter === 'all' || issue.severity === severityFilter
    return matchSearch && matchSeverity
  })

  const severityFilters = [
    { value: 'all', label: '全部' },
    { value: '高', label: '高' },
    { value: '中', label: '中' },
    { value: '低', label: '低' },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">数据质量</h1>
            <p className="text-slate-500 text-sm mt-1">数据质量监控报告</p>
          </div>
          <Badge variant="warning" dot>
            {issues.filter(i => i.status === 'open').length} 个待处理问题
          </Badge>
        </div>
      </motion.div>

      {/* Quality metric cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            className="bg-orbit-surface rounded-xl border border-orbit-border p-5 hover:border-orbit-border2 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn('p-2 rounded-lg bg-orbit-surface3', metric.color)}>
                <metric.icon className="w-4 h-4" />
              </div>
              <span className={cn(
                'text-xs font-medium',
                metric.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
              )}>
                {metric.change}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-1">{metric.label}</p>
            <p className={cn('text-2xl font-bold tracking-tight', metric.color)}>
              {metric.value}
            </p>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-orbit-surface3 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metric.percentage}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.06 }}
                className={cn(
                  'h-full rounded-full',
                  metric.id === 'completeness' && 'bg-emerald-500',
                  metric.id === 'accuracy' && 'bg-cyan-500',
                  metric.id === 'consistency' && 'bg-violet-500',
                  metric.id === 'timeliness' && 'bg-amber-500',
                )}
              />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Issues section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader
            title="质量问题列表"
            subtitle="当前检测到的数据质量问题"
            actions={
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜索表名..."
                    className="w-44 h-8 pl-8 pr-3 rounded-lg border border-orbit-border bg-orbit-surface2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary/50 transition-colors"
                  />
                </div>
              </div>
            }
          />

          {/* Severity filter */}
          <div className="px-5 pb-3">
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
              {severityFilters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setSeverityFilter(f.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                    severityFilter === f.value
                      ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                      : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">数据表</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">问题类型</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">影响行数</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">严重程度</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">发现时间</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((issue, i) => {
                    const sevInfo = severityConfig[issue.severity]
                    const IssueIcon = issueTypeIcon[issue.issueType]
                    return (
                      <motion.tr
                        key={issue.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: i * 0.02 }}
                        className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span className="text-slate-200 font-medium">{issue.tableName}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {IssueIcon && <IssueIcon className={cn('w-4 h-4', issueTypeColor[issue.issueType])} />}
                            <span className="text-slate-300">{issue.issueType}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={cn(
                            'tabular-nums font-medium',
                            issue.affectedRows > 200 ? 'text-orbit-danger' : issue.affectedRows > 50 ? 'text-amber-400' : 'text-slate-300'
                          )}>
                            {issue.affectedRows.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={sevInfo.variant}>{sevInfo.label}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">{issue.foundTime}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={issue.status === 'open' ? 'danger' : 'success'} dot>
                            {issue.status === 'open' ? '待处理' : '已解决'}
                          </Badge>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredIssues.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-sm text-slate-500">没有匹配的质量问题</p>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}