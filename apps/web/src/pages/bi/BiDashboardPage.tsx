import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, RefreshCw, CalendarDays, BarChart3,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import type { StatCardData } from '@/types'
import { api } from '@/services/api'
import { CHART_SERIES } from '@/constants/chartPalette'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type TimeRange = '7d' | '30d' | 'quarter'
type DataSource = 'all' | 'douyin' | 'shipinhao'

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: 'quarter', label: '本季度' },
]

const dataSourceOptions: { value: DataSource; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'douyin', label: '抖音' },
  { value: 'shipinhao', label: '视频号' },
]

const templateStatCards = (): StatCardData[] => [
  { id: 'total-gmv', label: '总GMV', value: '—', change: 0, changeLabel: '较上期', icon: DollarSign, color: 'primary', sparkData: [] },
  { id: 'total-orders', label: '总订单', value: '—', change: 0, changeLabel: '较上期', icon: ShoppingCart, color: 'accent', sparkData: [] },
  { id: 'avg-price', label: '平均客单价', value: '—', change: 0, changeLabel: '较上期', icon: Users, color: 'success', sparkData: [] },
  { id: 'total-refund', label: '总退款', value: '—', change: 0, changeLabel: '较上期', icon: RefreshCw, color: 'warning', sparkData: [] },
]

export function BiDashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [dataSource, setDataSource] = useState<DataSource>('all')
  const [cards, setCards] = useState<StatCardData[]>(templateStatCards())
  const [platformStats, setPlatformStats] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    api.get<any>('/api/bi/dashboard', { period: timeRange, platform: dataSource })
      .then(res => {
        const data = res?.data ?? res
        if (data) {
          if (data.total_gmv !== undefined || data.total_orders !== undefined) {
            const updated = templateStatCards()
            if (data.total_gmv !== undefined) {
              updated[0] = { ...updated[0], value: `¥${(data.total_gmv / 10000).toFixed(0)}万` }
            }
            if (data.total_orders !== undefined) {
              updated[1] = { ...updated[1], value: data.total_orders.toLocaleString() }
            }
            if (data.avg_order_value !== undefined) {
              updated[2] = { ...updated[2], value: `¥${data.avg_order_value}` }
            }
            if (data.total_refund !== undefined) {
              updated[3] = { ...updated[3], value: `¥${(data.total_refund / 10000).toFixed(0)}万` }
            }
            if (data.change_rates) {
              if (data.change_rates.total_gmv !== undefined) updated[0] = { ...updated[0], change: data.change_rates.total_gmv }
              if (data.change_rates.total_orders !== undefined) updated[1] = { ...updated[1], change: data.change_rates.total_orders }
              if (data.change_rates.avg_order_value !== undefined) updated[2] = { ...updated[2], change: data.change_rates.avg_order_value }
              if (data.change_rates.total_refund !== undefined) updated[3] = { ...updated[3], change: data.change_rates.total_refund }
            }
            setCards(updated)
          }
          if (data.platforms && Array.isArray(data.platforms)) {
            setPlatformStats(data.platforms.map((p: any) => ({
              platform: p.platform,
              gmv: p.gmv,
              orders: p.orders,
              refundRate: p.refundRate ?? p.refund_rate ?? 0,
              roi: p.roi,
              trend: p.trend ?? 'up',
            })))
          }
          if (data.dailyTrend && Array.isArray(data.dailyTrend)) {
            setTrendData(data.dailyTrend.map((d: any) => ({
              date: d.date,
              value: d.value,
            })))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [timeRange, dataSource])

  const maxTrendValue = Math.max(...trendData.map(d => d.value))
  const trendAreaId = 'trendAreaGradient'
  const platformMaxGmv = Math.max(...platformStats.map(p => p.gmv))

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">BI仪表盘</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">商业智能数据总览</p>
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
        {/* Time range */}
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[var(--text-muted)]" />
          <div className="flex items-center gap-1">
            {timeRangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeRange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  timeRange === opt.value
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Data source */}
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
          <div className="flex items-center gap-1">
            {dataSourceOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDataSource(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  dataSource === opt.value
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

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <StatCard key={card.id} data={card} index={i} />
        ))}
      </div>

      {/* Platform comparison bar chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader title="各平台GMV对比" subtitle="各直播平台GMV数据对比（万元）" />
          <CardBody>
            <div className="flex items-end justify-around gap-6 h-64 pt-2 pb-1">
              {platformStats.map((item) => {
                const colorClass =
                  item.platform === '抖音'
                    ? 'from-orbit-primary to-orbit-primary-dark'
                    : 'from-amber-500 to-amber-400'
                const heightPct = (item.gmv / platformMaxGmv) * 100
                return (
                  <div key={item.platform} className="flex-1 flex flex-col items-center gap-3 h-full justify-end max-w-[120px]">
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">¥{item.gmv}万</span>
                    <div
                      className={`w-full max-w-[80px] bg-gradient-to-t ${colorClass} rounded-t-md transition-all duration-300`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-xs font-medium text-[var(--text-muted)]">{item.platform}</span>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Daily trend line chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <Card>
          <CardHeader title="每日GMV趋势" subtitle="近7日GMV变化趋势（万元）" />
          <CardBody>
            <div className="relative h-64">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between py-1 text-right pr-2">
                {[maxTrendValue, Math.round(maxTrendValue * 0.75), Math.round(maxTrendValue * 0.5), Math.round(maxTrendValue * 0.25), 0].map((v) => (
                  <span key={v} className="text-[10px] text-[var(--text-muted)]">{v}万</span>
                ))}
              </div>

              {/* Chart area */}
              <div className="ml-12 mr-4 h-full relative">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((pct) => (
                  <div
                    key={pct}
                    className="absolute left-0 right-0 border-t border-orbit-border/20"
                    style={{ top: `${pct}%` }}
                  />
                ))}

                {/* SVG for line chart */}
                <svg className="absolute inset-0 w-full h-full pb-8" viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id={trendAreaId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_SERIES[0]} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={CHART_SERIES[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  {/* Area fill */}
                  <path
                    d={`M ${trendData.map((d, i) => {
                      const x = 30 + i * (540 / (trendData.length - 1))
                      const y = 200 - (d.value / maxTrendValue) * 170
                      return `${i === 0 ? 'M' : 'L'} ${x},${y}`
                    }).join(' ')} L ${30 + (trendData.length - 1) * (540 / (trendData.length - 1))},200 L 30,200 Z`}
                    fill={`url(#${trendAreaId})`}
                  />

                  {/* Line */}
                  <polyline
                    points={trendData.map((d, i) => {
                      const x = 30 + i * (540 / (trendData.length - 1))
                      const y = 200 - (d.value / maxTrendValue) * 170
                      return `${x},${y}`
                    }).join(' ')}
                    fill="none"
                    stroke={CHART_SERIES[0]}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Dots */}
                  {trendData.map((d, i) => {
                    const x = 30 + i * (540 / (trendData.length - 1))
                    const y = 200 - (d.value / maxTrendValue) * 170
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill={CHART_SERIES[0]}
                        stroke="var(--surface)"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-[6]"
                      />
                    )
                  })}
                </svg>

                {/* X-axis labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between pr-[5px]">
                  {trendData.map((d) => (
                    <span key={d.date} className="text-[10px] text-[var(--text-primary)]">{d.date}</span>
                  ))}
                </div>
              </div>
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
          <CardHeader title="各平台详细数据" subtitle="各平台核心经营指标对比" />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">平台</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">GMV</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">订单数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">退款率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">ROI</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">趋势</th>
                  </tr>
                </thead>
                <tbody>
                  {platformStats.map((row) => (
                    <tr
                      key={row.platform}
                      className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-medium">{row.platform}</td>
                      <td className="px-5 py-3.5 text-right text-emerald-400 font-medium tabular-nums">¥{row.gmv}万</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{row.orders.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{row.refundRate}%</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{row.roi}</td>
                      <td className="px-5 py-3.5 text-right">
                        {row.trend === 'up' ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400 inline-block" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400 inline-block" />
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