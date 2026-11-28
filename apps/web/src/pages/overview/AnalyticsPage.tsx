import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Eye, ShoppingCart, DollarSign, CalendarDays } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type DateRange = '7d' | '30d' | 'custom'
type MetricKey = 'gmv' | 'orders' | 'viewers'

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: 'custom', label: '自定义' },
]

const metricOptions: { value: MetricKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'gmv', label: 'GMV', icon: DollarSign },
  { value: 'orders', label: '订单量', icon: ShoppingCart },
  { value: 'viewers', label: '观看人数', icon: Eye },
]

interface TrendPoint {
  date: string
  value: number
}

interface DetailRow {
  date: string
  gmv: string
  orders: number
  avgOrder: string
  viewers: number
  conversion: string
}

interface TotalsData {
  gmv: string
  orders: number
  avgOrder: string
  viewers: number
  conversion: string
}

const metricLabelMap: Record<MetricKey, { unit: string; format: (v: number) => string }> = {
  gmv: { unit: '万元', format: (v) => `¥${v}万` },
  orders: { unit: '单', format: (v) => v.toLocaleString() },
  viewers: { unit: '人', format: (v) => v.toLocaleString() },
}

export function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('7d')
  const [metric, setMetric] = useState<MetricKey>('gmv')
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [detailData, setDetailData] = useState<DetailRow[]>([])
  const [totals, setTotals] = useState<TotalsData>({ gmv: '', orders: 0, avgOrder: '', viewers: 0, conversion: '' })

  useEffect(() => {
    api.get<Record<string, any>>('/api/v1/overview/analytics', {
      period: dateRange,
      metric: metric,
    })
      .then(data => {
        if (!data) return

        // Update trend
        if (Array.isArray(data.trend) && data.trend.length > 0) {
          setTrendData(data.trend.map((t: any) => ({
            date: t.date,
            value: metric === 'viewers' ? Math.round((t.value ?? 0) * 100) : t.value ?? 0,
          })))
        }

        // Update details
        if (Array.isArray(data.details) && data.details.length > 0) {
          setDetailData(data.details.map((d: any) => ({
            date: d.date,
            gmv: metric === 'gmv' ? `¥${((d.gmv ?? 0) / 10000).toFixed(1)}万` : `¥${((d.gmv ?? 0) / 10000).toFixed(1)}万`,
            orders: d.orders ?? 0,
            avgOrder: d.orders > 0 ? `¥${Math.round((d.gmv ?? 0) / d.orders)}` : '¥0',
            viewers: d.viewers ?? 0,
            conversion: d.orders > 0 && (d.gmv ?? 0) > 0 ? `${(((d.viewers ?? 0) > 0 ? Math.min(10, ((d.orders ?? 0) / (d.viewers ?? 1)) * 100) : 0).toFixed(2))}%` : '0%',
          })))
        }

        // Update totals
        if (data.summary) {
          setTotals({
            gmv: `¥${((data.summary.total_gmv ?? 0) / 10000).toFixed(1)}万`,
            orders: data.summary.total_orders ?? 0,
            avgOrder: (data.summary.total_orders ?? 0) > 0 ? `¥${Math.round((data.summary.total_gmv ?? 0) / (data.summary.total_orders ?? 1))}` : '¥0',
            viewers: data.summary.viewers ?? 0,
            conversion: data.summary.conversion ?? '0%',
          })
        }
      })
      .catch(() => {})
  }, [dateRange, metric])

  const { format: formatValue } = metricLabelMap[metric]
  const maxValue = Math.max(...trendData.map(d => d.value), 1)

  const MetricIcon = metricOptions.find(o => o.value === metric)?.icon ?? TrendingUp

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">数据分析</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">多维度数据分析</p>
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

        {/* Metric selector */}
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--text-muted)]" />
          <div className="flex items-center gap-1">
            {metricOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setMetric(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    metric === opt.value
                      ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
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

      {/* Trend chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader
            title="趋势图表"
            subtitle={`选定指标的趋势变化 (${dateRange === '7d' ? '近7天' : dateRange === '30d' ? '近30天' : '自定义'})`}
            actions={
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                <MetricIcon className="w-3.5 h-3.5" />
                <span>{metricOptions.find(o => o.value === metric)?.label}</span>
              </div>
            }
          />
          <CardBody>
            <div className="flex items-end justify-between gap-2 h-56 pt-2 pb-1">
              {trendData.map((item) => (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">
                    {formatValue(item.value)}
                  </span>
                  <div
                    className="w-full max-w-[48px] bg-gradient-to-t from-orbit-accent to-orbit-success rounded-t-md transition-all duration-300 hover:to-orbit-success"
                    style={{ height: `${(item.value / maxValue) * 100}%` }}
                  />
                  <span className="text-[11px] text-[var(--text-primary)]">{item.date}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Detail table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader title="数据明细" subtitle="每日详细数据" />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">日期</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">GMV</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">订单数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">客单价</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">观看人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">转化率</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.map((row) => (
                    <tr
                      key={row.date}
                      className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-medium">{row.date}</td>
                      <td className="px-5 py-3.5 text-right text-status-success font-medium">{row.gmv}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{row.orders.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{row.avgOrder}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{row.viewers.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{row.conversion}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Summary row */}
                <tfoot>
                  <tr className="bg-orbit-surface2 border-t-2 border-orbit-border">
                    <td className="px-5 py-3.5 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">合计</td>
                    <td className="px-5 py-3.5 text-right text-status-success font-bold">{totals.gmv}</td>
                    <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] font-bold tabular-nums">{totals.orders.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] font-bold">{totals.avgOrder}</td>
                    <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] font-bold tabular-nums">{totals.viewers.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] font-bold">{totals.conversion}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}