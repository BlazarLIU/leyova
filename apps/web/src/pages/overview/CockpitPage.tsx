import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, Percent, TrendingUp, BarChart3, Package, ClipboardList, FileText, Calendar } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { PerformanceLeaderboard } from '@/components/overview/PerformanceLeaderboard'
import { api } from '@/services/api'
import type { StatCardData } from '@/types'

const defaultStats = (): StatCardData[] => [
  { id: 'gmv', label: '总GMV', value: '—', change: 0, changeLabel: '较昨日', icon: DollarSign, color: 'primary', sparkData: [] },
  { id: 'refund-rate', label: '退款率', value: '—', change: 0, changeLabel: '较昨日', icon: Percent, color: 'warning', sparkData: [] },
  { id: 'roi', label: 'ROI', value: '—', change: 0, changeLabel: '较昨日', icon: TrendingUp, color: 'success', sparkData: [] },
  { id: 'ad-roi', label: '广告ROI', value: '—', change: 0, changeLabel: '较昨日', icon: BarChart3, color: 'accent', sparkData: [] },
]

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}



interface TrendItem {
  day: string
  value: number
}

interface TrafficSource {
  name: string
  value: number
  color: string
}

interface TopProduct {
  rank: number
  name: string
  sales: number
  gmv: string
  roi: number
  refundRate: string
}

const trafficColors = [
  'bg-orbit-primary',
  'bg-orbit-success',
  'bg-orbit-success',
  'bg-orbit-warning',
]

export function CockpitPage() {
  const [cockpitStats, setCockpitStats] = useState<StatCardData[]>(defaultStats())
  const [gmvTrendData, setGmvTrendData] = useState<TrendItem[]>([])
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [patrolContent, setPatrolContent] = useState<string | null>(null)
  const [patrolGeneratedAt, setPatrolGeneratedAt] = useState<string | null>(null)
  const [dailyReportContent, setDailyReportContent] = useState<string | null>(null)
  const [dailyReportGeneratedAt, setDailyReportGeneratedAt] = useState<string | null>(null)

  useEffect(() => {
    api.get<Record<string, any>>('/api/v1/overview/cockpit')
      .then(data => {
        if (!data) return

        // Update stat cards from summary
        if (data.summary) {
          const s = data.summary
          setCockpitStats(prev => prev.map(c => {
            switch (c.id) {
              case 'gmv':
                return { ...c, value: s.total_gmv ? `¥${(s.total_gmv / 10000).toFixed(1)}万` : '—' }
              case 'refund-rate':
                return { ...c, value: s.refund_rate != null ? `${s.refund_rate}%` : '—' }
              case 'roi':
                return { ...c, value: s.roi ? s.roi.toFixed(2) : '—' }
              case 'ad-roi':
                return { ...c, value: s.roi ? s.roi.toFixed(2) : '—' }
              default:
                return c
            }
          }))
        }

        // Update GMV trend
        if (Array.isArray(data.gmv_trend) && data.gmv_trend.length > 0) {
          setGmvTrendData(data.gmv_trend.map((t: any) => ({
            day: t.date,
            value: Math.round(t.gmv / 10000),
          })))
        }

        // Update traffic sources
        if (Array.isArray(data.traffic_sources) && data.traffic_sources.length > 0) {
          setTrafficSources(data.traffic_sources.map((t: any, i: number) => ({
            name: t.source,
            value: t.value,
            color: trafficColors[i % trafficColors.length],
          })))
        }

        // Update top products
        if (Array.isArray(data.top_products) && data.top_products.length > 0) {
          setTopProducts(data.top_products.map((p: any) => ({
            rank: p.rank,
            name: p.name,
            sales: p.sales,
            gmv: `¥${(p.gmv / 10000).toFixed(1)}万`,
            roi: p.roi ?? 0,
            refundRate: p.refundRate ?? `${((p.refund_rate ?? 0)).toFixed(1)}%`,
          })))
        }
      })
      .catch(() => {})
  }, [])

  // ── 按日期获取巡检摘要 & 经营日报 ──
  useEffect(() => {
    api.get<{ content: string | null; generatedAt: string | null }>('/api/v1/overview/patrol-summary', { date: selectedDate })
      .then(data => {
        setPatrolContent(data?.content ?? null)
        setPatrolGeneratedAt(data?.generatedAt ?? null)
      })
      .catch(() => {
        setPatrolContent(null)
        setPatrolGeneratedAt(null)
      })

    api.get<{ content: string | null; generatedAt: string | null }>('/api/v1/overview/daily-report', { date: selectedDate })
      .then(data => {
        setDailyReportContent(data?.content ?? null)
        setDailyReportGeneratedAt(data?.generatedAt ?? null)
      })
      .catch(() => {
        setDailyReportContent(null)
        setDailyReportGeneratedAt(null)
      })
  }, [selectedDate])

  const maxGmv = Math.max(...gmvTrendData.map(d => d.value))

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                经营驾驶舱
              </h1>
            </div>
            <p className="text-[var(--text-muted)] text-xs mt-1">
              全平台全渠道店铺核心经营数据、真实净利与流量转化总览
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors"
            />
          </div>
        </div>
      </motion.div>

      {/* StatCards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {cockpitStats.map((stat, i) => (
          <StatCard key={stat.id} data={stat} index={i} />
        ))}
      </motion.div>

      {/* Chart cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* GMV Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card>
            <CardHeader title="GMV 趋势" subtitle="近7日 GMV (万元)" />
            <CardBody>
              <div className="flex items-end justify-between gap-2 h-48 pt-2 pb-1">
                {gmvTrendData.map((item) => (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">
                      ¥{item.value}万
                    </span>
                    <div
                      className="w-full max-w-[48px] bg-gradient-to-t from-orbit-primary to-orbit-primary-dark rounded-t-md transition-all duration-300 hover:to-orbit-primary-dark"
                      style={{ height: `${(item.value / maxGmv) * 100}%` }}
                    />
                    <span className="text-[11px] text-[var(--text-primary)]">{item.day}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Traffic Sources */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card>
            <CardHeader title="流量来源" subtitle="各渠道流量占比" />
            <CardBody>
              <div className="space-y-4 pt-2">
                {trafficSources.map((source) => (
                  <div key={source.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${source.color}`} />
                        <span className="text-sm text-[var(--text-secondary)]">{source.name}</span>
                      </div>
                      <span className="text-sm font-medium text-[var(--text-muted)]">{source.value}%</span>
                    </div>
                    <div className="h-2 bg-orbit-surface3 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${source.color} transition-all duration-700`}
                        style={{ width: `${source.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {trafficSources.map((source) => (
                  <div key={source.name} className="text-center p-3 rounded-lg bg-orbit-surface2 border border-orbit-border">
                    <p className="text-lg font-bold text-[var(--text-secondary)]">{source.value}%</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{source.name}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Top Products Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <Card>
          <CardHeader title="热销商品 Top10" subtitle="按 GMV 降序排列" />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">排名</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">商品名称</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">销量</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">GMV</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">ROI</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">退款率</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, i) => (
                    <tr
                      key={product.rank}
                      className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className={`
                          inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                          ${i === 0 ? 'bg-orbit-warning/20 text-status-warning' : ''}
                          ${i === 1 ? 'bg-[var(--border2)] text-[var(--text-secondary)]' : ''}
                          ${i === 2 ? 'bg-orbit-warning/20 text-status-warning' : ''}
                          ${i > 2 ? 'bg-orbit-surface3 text-[var(--text-muted)]' : ''}
                        `}>
                          {product.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-[var(--text-primary)]" />
                          <span className="text-[var(--text-secondary)] font-medium">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{product.sales.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-status-success font-medium">{product.gmv}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{product.roi.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">{product.refundRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* 竞品对标：业绩排行榜 (主播GMV / 项目 双维度) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <PerformanceLeaderboard />
      </motion.div>

      {/* ── 巡检摘要 & 经营日报 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Patrol Summary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
        >
          <Card>
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-orbit-primary-light" />
                  <span>巡检摘要</span>
                </div>
              }
              subtitle={patrolGeneratedAt ? `生成于 ${new Date(patrolGeneratedAt).toLocaleString('zh-CN')}` : `${selectedDate} 暂无数据`}
            />
            <CardBody>
              {patrolContent ? (
                <pre className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap font-sans">
                  {patrolContent}
                </pre>
              ) : (
                <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
                  <div className="text-center">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{selectedDate === new Date().toISOString().slice(0, 10) ? '今日巡检摘要尚未生成（每小时自动巡检）' : '该日期暂无巡检摘要'}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>

        {/* Daily Report */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.65 }}
        >
          <Card>
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-status-success" />
                  <span>leyova 直播电商经营日报</span>
                </div>
              }
              subtitle={dailyReportGeneratedAt ? `生成于 ${new Date(dailyReportGeneratedAt).toLocaleString('zh-CN')}` : `${selectedDate} 暂无数据`}
            />
            <CardBody>
              {dailyReportContent ? (
                <pre className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap font-sans">
                  {dailyReportContent}
                </pre>
              ) : (
                <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
                  <div className="text-center">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{selectedDate === new Date().toISOString().slice(0, 10) ? '今日经营日报尚未生成（每日 01:15 自动生成）' : '该日期暂无经营日报'}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}