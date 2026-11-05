import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Receipt, Clock, AlertCircle,
  CalendarDays,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import type { StatCardData } from '@/types'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type TimeRange = '7d' | '30d' | 'quarter'

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: 'quarter', label: '本季度' },
]

const templateStatCards = (): StatCardData[] => [
  { id: 'total-refund', label: '总退款', value: '—', change: 0, changeLabel: '较上期', icon: RefreshCw, color: 'warning', sparkData: [] },
  { id: 'refund-rate', label: '退款率', value: '—', change: 0, changeLabel: '较上期', icon: AlertCircle, color: 'primary', sparkData: [] },
  { id: 'refund-orders', label: '退款订单', value: '—', change: 0, changeLabel: '较上期', icon: Receipt, color: 'accent', sparkData: [] },
  { id: 'avg-refund-time', label: '平均退款时长', value: '—', change: 0, changeLabel: '较上期', icon: Clock, color: 'success', sparkData: [] },
]

const statusBadgeMap: Record<string, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  '已退款': { variant: 'success', label: '已退款' },
  '处理中': { variant: 'warning', label: '处理中' },
  '已驳回': { variant: 'danger', label: '已驳回' },
}

export function RefundAnalysisPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [cards, setCards] = useState<StatCardData[]>(templateStatCards())
  const [reasons, setReasons] = useState<{ reason: string; percentage: number; amount: number; barColor: string; dotColor: string }[]>([])
  const [records, setRecords] = useState<{ orderId: string; product: string; amount: number; reason: string; applyTime: string; duration: string; status: string }[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    api.get<any>('/api/bi/refund', { period: timeRange })
      .then(res => {
        const data = res?.data ?? res
        if (data) {
          // Transform stat cards
          if (data.total_refund !== undefined || data.refund_rate !== undefined) {
            const updated = templateStatCards()
            if (data.total_refund !== undefined) {
              updated[0] = { ...updated[0], value: `¥${(data.total_refund / 10000).toFixed(0)}万` }
            }
            if (data.refund_rate !== undefined) {
              updated[1] = { ...updated[1], value: `${data.refund_rate}%` }
            }
            if (data.refund_orders !== undefined) {
              updated[2] = { ...updated[2], value: data.refund_orders.toLocaleString() }
            }
            if (data.avg_refund_time !== undefined) {
              updated[3] = { ...updated[3], value: `${data.avg_refund_time}天` }
            }
            if (data.change_rates) {
              if (data.change_rates.total_refund !== undefined) updated[0] = { ...updated[0], change: data.change_rates.total_refund }
              if (data.change_rates.refund_rate !== undefined) updated[1] = { ...updated[1], change: data.change_rates.refund_rate }
              if (data.change_rates.refund_orders !== undefined) updated[2] = { ...updated[2], change: data.change_rates.refund_orders }
              if (data.change_rates.avg_refund_time !== undefined) updated[3] = { ...updated[3], change: data.change_rates.avg_refund_time }
            }
            setCards(updated)
          }
          // Transform refund reasons
          if (data.reasons && Array.isArray(data.reasons)) {
            setReasons(data.reasons.map((r: any) => ({
              reason: r.reason,
              percentage: r.percentage,
              amount: r.amount,
              barColor: r.barColor ?? 'from-violet-500 to-violet-400',
              dotColor: r.dotColor ?? 'bg-violet-400',
            })))
          }
          // Transform refund records
          if (data.records && Array.isArray(data.records)) {
            setRecords(data.records.map((r: any) => ({
              orderId: r.orderId ?? r.order_id ?? '',
              product: r.product ?? '',
              amount: r.amount ?? 0,
              reason: r.reason ?? '',
              applyTime: r.applyTime ?? r.apply_time ?? '',
              duration: r.duration ?? '',
              status: r.status ?? '已退款',
            })))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [timeRange])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">退款分析</h1>
            <p className="text-slate-500 text-sm mt-1">退款数据分析</p>
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
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-500" />
          <div className="flex items-center gap-1">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  timeRange === opt.value
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

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <StatCard key={card.id} data={card} index={i} />
        ))}
      </div>

      {/* Refund reasons distribution */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader title="退款原因分布" subtitle="各退款原因占比及金额" />
          <CardBody>
            <div className="space-y-5">
              {reasons.map((item) => (
                <div key={item.reason}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.dotColor}`} />
                      <span className="text-sm text-slate-300">{item.reason}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">¥{item.amount}万</span>
                      <span className="text-xs font-medium text-slate-200 w-8 text-right">{item.percentage}%</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-orbit-surface2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${item.barColor} transition-all duration-500`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Refund detail table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader title="退款明细" subtitle="退款订单详细记录" />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">订单号</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">商品</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">金额</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">退款原因</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">申请时间</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">处理时长</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => {
                    const badgeInfo = statusBadgeMap[row.status]
                    return (
                      <tr
                        key={row.orderId}
                        className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-slate-300 font-mono text-xs">{row.orderId}</td>
                        <td className="px-5 py-3.5 text-slate-300">{row.product}</td>
                        <td className="px-5 py-3.5 text-right text-red-400 font-medium tabular-nums">¥{row.amount}</td>
                        <td className="px-5 py-3.5 text-slate-300">{row.reason}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{row.applyTime}</td>
                        <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">{row.duration}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
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