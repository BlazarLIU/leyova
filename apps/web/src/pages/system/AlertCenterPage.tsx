import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, AlertCircle, Info, Clock, CheckCircle2, ArrowRight, Search } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'
type StatusFilter = 'all' | 'pending' | 'resolved'

const severityOptions: { value: SeverityFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'critical', label: '严重' },
  { value: 'warning', label: '警告' },
  { value: 'info', label: '提示' },
]

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '未处理' },
  { value: 'resolved', label: '已处理' },
]

const timeRangeOptions = ['全部', '近1小时', '近24小时', '近7天']

interface AlertItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  time: string
  status: 'pending' | 'resolved'
}



const severityIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
}

const severityColorMap: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  info: 'text-blue-400 bg-blue-500/10',
}

const severityBadgeMap: Record<string, 'danger' | 'warning' | 'info'> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
  '严重': 'danger',
  '警告': 'warning',
  '提示': 'info',
}

const tableSeverityColorMap: Record<string, 'danger' | 'warning' | 'info'> = {
  '严重': 'danger',
  '警告': 'warning',
  '提示': 'info',
}

export function AlertCenterPage() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [timeFilter, setTimeFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [tableAlerts, setTableAlerts] = useState<any[]>([])

  useEffect(() => {
    api.get<any>('/api/system/alerts', {
      severity: severityFilter !== 'all' ? severityFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      period: timeFilter !== '全部' ? timeFilter : undefined,
    })
      .then((res) => {
        if (res.alerts) setAlerts(res.alerts)
        if (res.tableAlerts) setTableAlerts(res.tableAlerts)
      })
      .catch(() => {})
  }, [severityFilter, statusFilter, timeFilter])

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">异常中心</h1>
            <p className="text-slate-500 text-sm mt-1">系统异常告警中心</p>
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
        {/* Severity filter */}
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-slate-500" />
          <div className="flex items-center gap-1">
            {severityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSeverityFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  severityFilter === opt.value
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time range */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <div className="flex items-center gap-1">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setTimeFilter(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  timeFilter === opt
                    ? 'bg-orbit-accent/15 text-orbit-accent-light border border-orbit-accent/30'
                    : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-slate-500" />
          <div className="flex items-center gap-1">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Alert cards */}
      <div className="grid grid-cols-1 gap-4">
        {filteredAlerts.map((alert, i) => {
          const SeverityIcon = severityIconMap[alert.severity]
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
            >
              <Card className="hover:border-orbit-border2 transition-colors">
                <CardBody>
                  <div className="flex items-start gap-4">
                    {/* Severity icon */}
                    <div
                      className={`p-2.5 rounded-xl flex-shrink-0 ${
                        severityColorMap[alert.severity]
                      }`}
                    >
                      <SeverityIcon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-slate-200">{alert.title}</h4>
                        <Badge variant={severityBadgeMap[alert.severity]}>
                          {alert.severity === 'critical' ? '严重' : alert.severity === 'warning' ? '警告' : '提示'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2">{alert.description}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{alert.time}</span>
                        </div>
                        <Badge variant={alert.status === 'pending' ? 'warning' : 'success'} dot>
                          {alert.status === 'pending' ? '未处理' : '已处理'}
                        </Badge>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      {alert.status === 'pending' ? (
                        <button className="flex items-center gap-1 text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors px-3 py-1.5 rounded-lg bg-orbit-primary/10 hover:bg-orbit-primary/20">
                          处理告警
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 px-3 py-1.5">已处理</span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Alert table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <Card>
          <CardHeader
            title="告警明细"
            subtitle="按类型汇总的告警数据"
            actions={
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                <Search className="w-3.5 h-3.5" />
                <span>共 {tableAlerts.length} 条</span>
              </div>
            }
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">告警类型</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">严重程度</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">来源</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">发生次数</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">最近发生</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {tableAlerts.map((row) => (
                    <tr
                      key={row.type}
                      className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-slate-200 font-medium">{row.type}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={tableSeverityColorMap[row.severity]}>{row.severity}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">{row.source}</td>
                      <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">{row.count}</td>
                      <td className="px-5 py-3.5 text-slate-300">{row.lastOccur}</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            row.status === '未处理'
                              ? 'danger'
                              : row.status === '处理中'
                                ? 'warning'
                                : 'success'
                          }
                          dot
                        >
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