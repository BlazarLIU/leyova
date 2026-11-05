import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, DollarSign, PiggyBank, Target, BarChart3,
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

type RoiPeriod = 'yesterday' | '7d' | '15d' | '30d' | 'month' | 'year'

const quickFilterOptions: { value: RoiPeriod; label: string }[] = [
  { value: 'yesterday', label: '昨天' },
  { value: '7d', label: '7天' },
  { value: '15d', label: '15天' },
  { value: '30d', label: '30天' },
]

const currentYear = new Date().getFullYear()
const monthOptions = Array.from({ length: 12 }, (_, i) => {
  const m = String(i + 1).padStart(2, '0')
  return { value: `${currentYear}-${m}`, label: `${m}月` }
})
const yearOptions = [currentYear - 2, currentYear - 1, currentYear]

const templateStatCards = (): StatCardData[] => [
  { id: 'overall-roi', label: '综合ROI', value: '—', change: 0, changeLabel: '较上期', icon: TrendingUp, color: 'primary', sparkData: [] },
  { id: 'ad-roi', label: '广告ROI', value: '—', change: 0, changeLabel: '较上期', icon: DollarSign, color: 'warning', sparkData: [] },
  { id: 'organic-roi', label: '自然流量ROI', value: '—', change: 0, changeLabel: '较上期', icon: Target, color: 'success', sparkData: [] },
  { id: 'overall-rate', label: '整体投入产出比', value: '—', change: 0, changeLabel: '较上期', icon: PiggyBank, color: 'accent', sparkData: [] },
]

const ratingBadgeMap: Record<string, { variant: 'success' | 'primary' | 'warning' | 'danger'; label: string }> = {
  '优秀': { variant: 'success', label: '优秀' },
  '良好': { variant: 'primary', label: '良好' },
  '一般': { variant: 'warning', label: '一般' },
  '较差': { variant: 'danger', label: '较差' },
}

export function RoiDashboardPage() {
  const [period, setPeriod] = useState<RoiPeriod>('30d')
  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [cards, setCards] = useState<StatCardData[]>(templateStatCards())
  const [chartData, setChartData] = useState<{ label: string; roi: number }[]>([])
  const [channelData, setChannelData] = useState<{ channel: string; investment: number; output: number; roi: number; change: number; rating: string }[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    const params: Record<string, string> = { period }
    if (period === 'month') params.month = selectedMonth
    if (period === 'year') params.year = String(selectedYear)
    api.get<any>('/api/bi/roi', params)
      .then(res => {
        const data = res?.data ?? res
        if (data) {
          // Transform stat cards
          if (data.overall_roi !== undefined || data.ad_roi !== undefined) {
            const updated = templateStatCards()
            if (data.overall_roi !== undefined) { updated[0] = { ...updated[0], value: String(data.overall_roi) } }
            if (data.ad_roi !== undefined) { updated[1] = { ...updated[1], value: String(data.ad_roi) } }
            if (data.organic_roi !== undefined) { updated[2] = { ...updated[2], value: String(data.organic_roi) } }
            if (data.overall_rate !== undefined) { updated[3] = { ...updated[3], value: `1:${data.overall_rate}` } }
            if (data.change_rates) {
              if (data.change_rates.overall_roi !== undefined) updated[0] = { ...updated[0], change: data.change_rates.overall_roi }
              if (data.change_rates.ad_roi !== undefined) updated[1] = { ...updated[1], change: data.change_rates.ad_roi }
              if (data.change_rates.organic_roi !== undefined) updated[2] = { ...updated[2], change: data.change_rates.organic_roi }
              if (data.change_rates.overall_rate !== undefined) updated[3] = { ...updated[3], change: data.change_rates.overall_rate }
            }
            setCards(updated)
          }
          // Transform chart data (daily/weekly based on period)
          if (data.chartData && Array.isArray(data.chartData)) {
            setChartData(data.chartData.map((m: any) => ({
              label: m.label ?? m.month ?? m.day ?? '',
              roi: m.roi,
            })))
          }
          // Transform channel data
          if (data.channels && Array.isArray(data.channels)) {
            setChannelData(data.channels.map((c: any) => ({
              channel: c.channel,
              investment: c.investment,
              output: c.output,
              roi: c.roi,
              change: c.change,
              rating: c.rating ?? '一般',
            })))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, selectedMonth, selectedYear])

  const maxRoi = Math.max(...chartData.map(m => m.roi), 0.01)
  const roundUpMax = Math.ceil(maxRoi * 10) / 10

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">ROI看板</h1>
            <p className="text-slate-500 text-sm mt-1">投资回报率分析</p>
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
        <div className="flex items-center gap-2 flex-wrap">
          <BarChart3 className="w-4 h-4 text-slate-500 shrink-0" />
          {/* Quick period buttons */}
          <div className="flex items-center gap-1">
            {quickFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  period === opt.value
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Month selector */}
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors ${
            period === 'month'
              ? 'bg-orbit-primary/15 border-orbit-primary/30'
              : 'border-orbit-border'
          }`}>
            <span className="text-xs text-slate-500">自然月</span>
            <select
              value={selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setPeriod('month') }}
              className="text-xs font-medium bg-transparent text-slate-300 outline-none cursor-pointer"
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value} className="bg-orbit-surface">{m.label}</option>
              ))}
            </select>
          </div>
          {/* Year selector */}
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors ${
            period === 'year'
              ? 'bg-orbit-primary/15 border-orbit-primary/30'
              : 'border-orbit-border'
          }`}>
            <span className="text-xs text-slate-500">年度</span>
            <select
              value={selectedYear}
              onChange={e => { setSelectedYear(Number(e.target.value)); setPeriod('year') }}
              className="text-xs font-medium bg-transparent text-slate-300 outline-none cursor-pointer"
            >
              {yearOptions.map(y => (
                <option key={y} value={y} className="bg-orbit-surface">{y}年</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <StatCard key={card.id} data={card} index={i} />
        ))}
      </div>

      {/* Monthly ROI trend chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader title="ROI趋势" subtitle={`${
            period === 'month' ? `${selectedMonth.slice(5)}月` :
            period === 'year' ? `${selectedYear}年` :
            quickFilterOptions.find(o => o.value === period)?.label || ''
          } ROI变化趋势`} />
          <CardBody>
            <div className="relative h-64">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between py-1 text-right pr-2">
                {[roundUpMax, roundUpMax * 0.75, roundUpMax * 0.5, roundUpMax * 0.25, 0].map((v) => (
                  <span key={v} className="text-[10px] text-slate-500">{v.toFixed(1)}</span>
                ))}
              </div>

              {/* Chart area */}
              <div className="ml-12 mr-2 h-full">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((pct) => (
                  <div
                    key={pct}
                    className="absolute left-0 right-0 border-t border-orbit-border/20"
                    style={{ top: `${pct}%`, left: '48px', right: '8px' }}
                  />
                ))}

                {/* Bars */}
                <div className="flex items-end justify-around h-full pb-8 pt-1">
                  {chartData.map((item) => {
                    const heightPct = (item.roi / roundUpMax) * 100
                    return (
                      <div key={item.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end max-w-[60px]">
                        <span className="text-[10px] text-slate-500 font-medium">{item.roi}</span>
                        <div
                          className="w-full max-w-[36px] bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-sm transition-all duration-300"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[10px] text-slate-600">{item.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Channel detail table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader title="渠道ROI明细" subtitle="各渠道投入产出明细数据" />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">渠道</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">投入金额（万）</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">产出金额（万）</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">ROI</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">环比变化</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">评级</th>
                  </tr>
                </thead>
                <tbody>
                  {channelData.map((row) => {
                    const badgeInfo = ratingBadgeMap[row.rating]
                    return (
                      <tr
                        key={row.channel}
                        className="border-b border-orbit-border hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-slate-300 font-medium">{row.channel}</td>
                        <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">¥{row.investment}万</td>
                        <td className="px-5 py-3.5 text-right text-emerald-400 font-medium tabular-nums">¥{row.output}万</td>
                        <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">{row.roi}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                            row.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {row.change >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {Math.abs(row.change)}%
                          </span>
                        </td>
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