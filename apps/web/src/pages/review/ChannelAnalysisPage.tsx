import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine, Cell,
} from 'recharts'
import {
  Calendar, Filter, ArrowUpDown, TrendingUp, Eye,
  DollarSign, ShoppingBag, Gem, Activity, X,
  Search, ChevronDown, ChevronUp,
} from 'lucide-react'
import { api } from '@/services/api'
import { cn } from '@/utils/cn'
import { CHART_SERIES, CHART_AXIS } from '@/constants/chartPalette'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

/* ───────── type definitions ───────── */

interface ChannelData {
  channel: string
  impressions: number
  views: number
  exposure_view_rate: number
  interactions: number
  view_interaction_rate: number
  new_fans: number
  product_impressions: number
  product_clicks: number
  product_click_rate: number
  product_deal_rate: number
  orders: number
  buyer_count: number
  gmv: number
  item_count: number
  gpm: number
  avg_order_value: number
  ad_spend: number
}

type SortKey = keyof ChannelData | 'roi'
type SortOrder = 'asc' | 'desc'

interface ColumnGroup {
  key: string
  label: string
  columns: ColumnDef[]
}

interface ColumnDef {
  key: SortKey
  label: string
  format: (v: number) => string
  align?: 'left' | 'right' | 'center'
  width?: string
  tooltip?: string
}

/* ───────── constants ───────── */

const CHANNEL_CATEGORIES = ['全部', '推荐流量', '搜索流量', '社交流量', '付费流量'] as const
const COMPARE_PERIODS = ['无对比', '环比', '同比'] as const

const CHANNEL_COLORS = CHART_SERIES

const funnelStages = [
  { key: 'impressions', label: '曝光', color: 'from-orbit-primary/40 to-orbit-primary-dark/20' },
  { key: 'views', label: '观看', color: 'from-cyan-500/40 to-cyan-500/20' },
  { key: 'interactions', label: '互动', color: 'from-amber-500/40 to-amber-500/20' },
  { key: 'product_clicks', label: '商品点击', color: 'from-emerald-500/40 to-emerald-500/20' },
  { key: 'orders', label: '成交', color: 'from-emerald-600/40 to-emerald-600/20' },
]

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

/* ───────── helpers ───────── */

function formatNumber(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(2) + '亿'
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万'
  return n.toLocaleString()
}

function formatPercent(n: number): string {
  return n.toFixed(2) + '%'
}

function formatCurrency(n: number): string {
  if (n >= 100_000_000) return '¥' + (n / 100_000_000).toFixed(2) + '亿'
  if (n >= 10_000) return '¥' + (n / 10_000).toFixed(1) + '万'
  return '¥' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getChannelCategory(channel: string): string {
  if (/推荐|feed/i.test(channel)) return '推荐流量'
  if (/搜索/i.test(channel)) return '搜索流量'
  if (/短视频|视频/i.test(channel)) return '社交流量'
  if (/直播/i.test(channel)) return '社交流量'
  if (/广告|付费|推广/i.test(channel)) return '付费流量'
  return '其他'
}

function roiFromData(d: ChannelData): number {
  return d.ad_spend > 0 ? d.gmv / d.ad_spend : 0
}

/* ───────── column definitions ───────── */

const columnGroups: ColumnGroup[] = [
  {
    key: 'traffic',
    label: '流量获客',
    columns: [
      { key: 'channel', label: '渠道', format: v => String(v), align: 'left', width: 'w-28' },
      { key: 'impressions', label: '曝光', format: formatNumber, align: 'right' },
      { key: 'views', label: '观看', format: formatNumber, align: 'right' },
      { key: 'exposure_view_rate', label: '曝光-观看率', format: formatPercent, align: 'right' },
    ],
  },
  {
    key: 'engagement',
    label: '互动涨粉',
    columns: [
      { key: 'interactions', label: '互动', format: formatNumber, align: 'right' },
      { key: 'view_interaction_rate', label: '观看-互动率', format: formatPercent, align: 'right' },
      { key: 'new_fans', label: '新增粉丝', format: formatNumber, align: 'right' },
    ],
  },
  {
    key: 'product',
    label: '商品触达',
    columns: [
      { key: 'product_impressions', label: '商品曝光', format: formatNumber, align: 'right' },
      { key: 'product_clicks', label: '商品点击', format: formatNumber, align: 'right' },
      { key: 'product_click_rate', label: '商品点击率', format: formatPercent, align: 'right' },
    ],
  },
  {
    key: 'conversion',
    label: '成交转化',
    columns: [
      { key: 'product_deal_rate', label: '商品成交率', format: formatPercent, align: 'right' },
      { key: 'orders', label: '订单数', format: formatNumber, align: 'right' },
      { key: 'buyer_count', label: '买家数', format: formatNumber, align: 'right' },
      { key: 'gmv', label: 'GMV', format: formatCurrency, align: 'right' },
      { key: 'item_count', label: '商品件数', format: formatNumber, align: 'right' },
    ],
  },
  {
    key: 'efficiency',
    label: '渠道效率',
    columns: [
      { key: 'gpm', label: 'GPM', format: formatCurrency, align: 'right', tooltip: '千次曝光成交额' },
      { key: 'avg_order_value', label: '客单价', format: formatCurrency, align: 'right' },
      { key: 'ad_spend', label: '广告花费', format: formatCurrency, align: 'right' },
    ],
  },
]

/* ───────── custom tooltip ───────── */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="text-[var(--text-secondary)] font-medium mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[var(--text-muted)]">{entry.name}: </span>
          <span className="text-[var(--text-secondary)] font-medium">{formatNumber(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 shadow-lg text-xs space-y-1 max-w-48">
      <p className="text-[var(--text-secondary)] font-medium mb-1">{d.channel}</p>
      <p className="text-[var(--text-muted)]">GPM: <span className="text-[var(--text-secondary)]">{formatCurrency(d.gpm)}</span></p>
      <p className="text-[var(--text-muted)]">曝光-观看率: <span className="text-[var(--text-secondary)]">{formatPercent(d.exposure_view_rate)}</span></p>
      <p className="text-[var(--text-muted)]">GMV: <span className="text-[var(--text-secondary)]">{formatCurrency(d.gmv)}</span></p>
      <p className="text-[var(--text-muted)]">ROI: <span className="text-[var(--text-secondary)]">{roiFromData(d).toFixed(2)}</span></p>
    </div>
  )
}

/* ───────── main component ───────── */

export function ChannelAnalysisPage() {
  const [rawData, setRawData] = useState<ChannelData[]>([])
  const [loading, setLoading] = useState(true)

  /* filter & sort state */
  const [channelCategory, setChannelCategory] = useState<string>('全部')
  const [sortMetric, setSortMetric] = useState<SortKey>('gmv')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [comparePeriod, setComparePeriod] = useState<string>('无对比')
  const [dateRange, setDateRange] = useState<string>(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })

  /* drill-down drawer state */
  const [selectedChannel, setSelectedChannel] = useState<ChannelData | null>(null)

  /* ── fetch ── */
  useEffect(() => {
    api.get<ChannelData[]>('/api/v1/review/channels')
      .then(setRawData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /* ── filtered & sorted data ── */
  const processedData = useMemo(() => {
    let list = [...rawData]

    /* filter by channel category */
    if (channelCategory !== '全部') {
      list = list.filter(d => getChannelCategory(d.channel) === channelCategory)
    }

    /* sort */
    const key = sortMetric
    list.sort((a, b) => {
      const va = key === 'roi' ? roiFromData(a) : (a[key] as number)
      const vb = key === 'roi' ? roiFromData(b) : (b[key] as number)
      return sortOrder === 'desc' ? vb - va : va - vb
    })

    return list
  }, [rawData, channelCategory, sortMetric, sortOrder])

  /* ── median values for quadrant lines ── */
  const medianGPM = useMemo(() => {
    const vals = processedData.map(d => d.gpm).sort((a, b) => a - b)
    if (!vals.length) return 0
    const mid = Math.floor(vals.length / 2)
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
  }, [processedData])

  const medianEVR = useMemo(() => {
    const vals = processedData.map(d => d.exposure_view_rate).sort((a, b) => a - b)
    if (!vals.length) return 0
    const mid = Math.floor(vals.length / 2)
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
  }, [processedData])

  /* ── handler ── */
  const toggleSort = useCallback((key: SortKey) => {
    setSortMetric(prev => {
      if (prev === key) {
        setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
        return prev
      }
      setSortOrder('desc')
      return key
    })
  }, [])

  /* ── render helpers ── */
  const renderSortIcon = (key: SortKey) => {
    if (sortMetric !== key) return <ArrowUpDown className="w-3 h-3 text-[var(--text-primary)] ml-1" />
    return sortOrder === 'desc'
      ? <ChevronDown className="w-3 h-3 text-orbit-accent ml-1" />
      : <ChevronUp className="w-3 h-3 text-orbit-accent ml-1" />
  }

  /* ── empty state ── */
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-[var(--text-muted)] text-sm">加载中...</span>
        </div>
      </div>
    )
  }

  if (!processedData.length && rawData.length) {
    /* filtered to empty */
  }

  /* ── render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* ======== Page header ======== */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">渠道流量分析</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">各渠道流量来源与效果对比</p>
          </div>
        </div>
      </motion.div>

      {/* ======== Filter Bar ======== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card>
          <CardHeader
            title="筛选条件"
            subtitle="渠道、日期范围、排序指标"
            actions={
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Activity className="w-3.5 h-3.5" />
                <span>共 {processedData.length} 个渠道</span>
              </div>
            }
          />
          <CardBody>
            <div className="flex flex-wrap items-end gap-4">
              {/* 日期 */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <label className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 日期
                </label>
                <input
                  type="date"
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 transition-colors"
                />
              </div>

              {/* 渠道类型 */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <label className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> 渠道类型
                </label>
                <select
                  value={channelCategory}
                  onChange={e => setChannelCategory(e.target.value)}
                  className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 pr-8 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 transition-colors appearance-none cursor-pointer"
                  style={{ backgroundImage: 'none' }}
                >
                  {CHANNEL_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* 排序指标 */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <label className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" /> 排序指标
                </label>
                <div className="flex gap-1">
                  <select
                    value={sortMetric}
                    onChange={e => setSortMetric(e.target.value as SortKey)}
                    className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 pr-8 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 transition-colors appearance-none cursor-pointer"
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value="gmv">GMV</option>
                    <option value="gpm">GPM</option>
                    <option value="exposure_view_rate">曝光-观看率</option>
                    <option value="roi">ROI</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    title={sortOrder === 'desc' ? '降序' : '升序'}
                  >
                    {sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 对比周期 */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <label className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> 对比周期
                </label>
                <select
                  value={comparePeriod}
                  onChange={e => setComparePeriod(e.target.value)}
                  className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 pr-8 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 transition-colors appearance-none cursor-pointer"
                  style={{ backgroundImage: 'none' }}
                >
                  {COMPARE_PERIODS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* ======== Traffic Structure Chart ======== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <Card>
          <CardHeader
            title="流量结构"
            subtitle="各渠道曝光与观看量对比"
            actions={
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orbit-primary/60" />
                  <span className="text-[var(--text-muted)]">曝光</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/60" />
                  <span className="text-[var(--text-muted)]">观看</span>
                </span>
              </div>
            }
          />
          <CardBody>
            {processedData.length === 0 ? (
              <div className="h-72 flex items-center justify-center border border-dashed border-orbit-border rounded-lg">
                <p className="text-[var(--text-muted)] text-sm">暂无数据</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(72, processedData.length * 56)}>
                <BarChart
                  data={processedData}
                  layout="vertical"
                  margin={{ top: 8, right: 80, bottom: 8, left: 100 }}
                  barSize={14}
                  barGap={4}
                >
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_AXIS, fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="channel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_AXIS, fontSize: 12 }}
                    width={90}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,148,143,0.10)' }} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: CHART_AXIS }}
                    formatter={(value) => value === 'impressions' ? '曝光' : '观看'}
                  />
                  <Bar
                    dataKey="impressions"
                    name="impressions"
                    fill={CHART_SERIES[0]}
                    fillOpacity={0.6}
                    radius={[0, 3, 3, 0]}
                    label={{
                      position: 'right',
                      fill: CHART_AXIS,
                      fontSize: 11,
                      formatter: (v: number) => formatNumber(v),
                    }}
                  />
                  <Bar
                    dataKey="views"
                    name="views"
                    fill={CHART_SERIES[3]}
                    fillOpacity={0.6}
                    radius={[0, 3, 3, 0]}
                    label={{
                      position: 'right',
                      fill: CHART_AXIS,
                      fontSize: 11,
                      formatter: (v: number) => formatNumber(v),
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* ======== Efficiency Matrix ======== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <Card>
          <CardHeader
            title="效率矩阵"
            subtitle="GPM vs 曝光-观看率，气泡大小=GMV"
            actions={
              <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                <span>中位线 GPM: {formatCurrency(medianGPM)}</span>
                <span>|</span>
                <span>中位线 曝光-观看率: {formatPercent(medianEVR)}</span>
              </div>
            }
          />
          <CardBody>
            {processedData.length === 0 ? (
              <div className="h-72 flex items-center justify-center border border-dashed border-orbit-border rounded-lg">
                <p className="text-[var(--text-muted)] text-sm">暂无数据</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 8 }}>
                  <XAxis
                    type="number"
                    dataKey="gpm"
                    name="GPM"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_AXIS, fontSize: 11 }}
                    label={{ value: 'GPM (千次曝光成交额)', position: 'bottom', fill: CHART_AXIS, fontSize: 11, offset: 4 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="exposure_view_rate"
                    name="曝光-观看率"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: CHART_AXIS, fontSize: 11 }}
                    label={{ value: '曝光-观看率 (%)', angle: -90, position: 'insideLeft', fill: CHART_AXIS, fontSize: 11, offset: 0 }}
                  />
                  <ZAxis type="number" dataKey="gmv" range={[60, 500]} />
                  <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '4 4' }} />
                  {/* quadrant lines */}
                  <ReferenceLine
                    x={medianGPM}
                    stroke={CHART_AXIS}
                    strokeDasharray="6 3"
                    strokeWidth={1}
                  />
                  <ReferenceLine
                    y={medianEVR}
                    stroke={CHART_AXIS}
                    strokeDasharray="6 3"
                    strokeWidth={1}
                  />
                  <Scatter data={processedData} shape="circle">
                    {processedData.map((entry, index) => (
                      <Cell
                        key={entry.channel}
                        fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]}
                        fillOpacity={0.75}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* ======== Channel Detail Table ======== */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.4 }}
      >
        <Card>
          <CardHeader
            title="渠道明细"
            subtitle="点击行查看渠道详情"
            actions={
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Search className="w-3.5 h-3.5" />
                <span>{processedData.length} 个渠道</span>
              </div>
            }
          />
          <CardBody className="px-0 pb-0">
            {processedData.length === 0 ? (
              <div className="h-32 flex items-center justify-center border border-dashed border-orbit-border rounded-lg mx-5 mb-4">
                <p className="text-[var(--text-muted)] text-sm">暂无数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  {/* group headers */}
                  <thead>
                    {/* Group header row — each group label spans its columns */}
                    <tr className="border-b border-orbit-border">
                      {columnGroups.map(group => (
                        <th
                          key={group.key}
                          colSpan={group.columns.length}
                          className="text-left text-xs font-semibold text-[var(--text-muted)] bg-orbit-surface2/20 px-3 py-2 border-r border-orbit-border last:border-r-0 whitespace-nowrap"
                        >
                          {group.label}
                        </th>
                      ))}
                    </tr>
                    {/* Column header row */}
                    <tr className="border-b border-orbit-border">
                      {columnGroups.map(group =>
                        group.columns.map((col, ci) => (
                          <th
                            key={col.key}
                            className={cn(
                              'text-[var(--text-muted)] font-medium px-3 py-2.5 whitespace-nowrap',
                              'hover:text-[var(--text-primary)] cursor-pointer select-none transition-colors',
                              col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right',
                              ci === 0 && 'pl-6',
                              col.width,
                            )}
                            onClick={() => col.key !== 'channel' && toggleSort(col.key)}
                            title={col.tooltip}
                          >
                            <span className="flex items-center gap-0.5 justify-end">
                              {col.label}
                              {col.key !== 'channel' && renderSortIcon(col.key)}
                            </span>
                          </th>
                        ))
                      )}
                    </tr>
                    {/* separation line */}
                    <tr>
                      <td colSpan={18} className="h-2" />
                    </tr>
                  </thead>

                  {/* data rows */}
                  <tbody>
                    {processedData.map((row, ri) => (
                      <motion.tr
                        key={row.channel}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: ri * 0.03 }}
                        onClick={() => setSelectedChannel(row)}
                        className={cn(
                          'group cursor-pointer transition-colors',
                          'hover:bg-white/[0.03] border-b border-orbit-border/40',
                          ri === processedData.length - 1 && 'border-b-0',
                        )}
                      >
                        {columnGroups.map((group, gi) =>
                          group.columns.map((col, ci) => {
                            const rawVal = col.key === 'roi'
                              ? roiFromData(row)
                              : (row[col.key as keyof ChannelData] as number)
                            const displayVal = col.key === 'channel' ? row.channel : col.format(rawVal)

                            return (
                              <td
                                key={`${group.key}-${String(col.key)}`}
                                className={cn(
                                  'px-3 py-3 whitespace-nowrap text-sm',
                                  col.align === 'left' ? 'text-left' : col.align === 'center' ? 'text-center' : 'text-right',
                                  col.key === 'channel'
                                    ? 'text-[var(--text-secondary)] font-medium pl-6'
                                    : 'text-[var(--text-secondary)]',
                                  gi === 0 && ci === 0 && 'text-left',
                                )}
                              >
                                {col.key === 'channel' ? (
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: CHANNEL_COLORS[ri % CHANNEL_COLORS.length] }}
                                    />
                                    {displayVal}
                                  </span>
                                ) : (
                                  displayVal
                                )}
                              </td>
                            )
                          })
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* ======== Channel Drill-down Drawer ======== */}
      <AnimatePresence>
        {selectedChannel && (
          <>
            {/* backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setSelectedChannel(null)}
            />

            {/* drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-orbit-surface border-l border-orbit-border z-50 shadow-2xl overflow-y-auto"
            >
              {/* drawer header */}
              <div className="sticky top-0 bg-orbit-surface/95 backdrop-blur-sm border-b border-orbit-border px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        CHANNEL_COLORS[processedData.findIndex(d => d.channel === selectedChannel.channel) % CHANNEL_COLORS.length],
                    }}
                  />
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">{selectedChannel.channel}</h2>
                    <p className="text-xs text-[var(--text-muted)]">{getChannelCategory(selectedChannel.channel)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedChannel(null)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* core KPIs */}
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">核心指标</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: '曝光', value: formatNumber(selectedChannel.impressions), icon: Eye, color: 'text-orbit-primary' },
                      { label: '观看', value: formatNumber(selectedChannel.views), icon: Eye, color: 'text-cyan-400' },
                      { label: 'GMV', value: formatCurrency(selectedChannel.gmv), icon: DollarSign, color: 'text-emerald-400' },
                      { label: 'GPM', value: formatCurrency(selectedChannel.gpm), icon: TrendingUp, color: 'text-amber-400' },
                      { label: '订单数', value: formatNumber(selectedChannel.orders), icon: ShoppingBag, color: 'text-orbit-info' },
                      { label: '客单价', value: formatCurrency(selectedChannel.avg_order_value), icon: Gem, color: 'text-pink-400' },
                      { label: 'ROI', value: roiFromData(selectedChannel).toFixed(2), icon: Activity, color: 'text-orange-400' },
                      { label: '广告花费', value: formatCurrency(selectedChannel.ad_spend), icon: DollarSign, color: 'text-red-400' },
                    ].map(kpi => (
                      <div
                        key={kpi.label}
                        className="flex items-center gap-3 rounded-lg border border-orbit-border bg-orbit-surface2/50 px-4 py-3"
                      >
                        <kpi.icon className={cn('w-4 h-4 flex-shrink-0', kpi.color)} />
                        <div className="min-w-0">
                          <p className="text-[11px] text-[var(--text-muted)]">{kpi.label}</p>
                          <p className="text-sm font-semibold text-[var(--text-secondary)] truncate">{kpi.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* conversion funnel mini chart */}
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">转化漏斗</h3>
                  <div className="rounded-lg border border-orbit-border bg-orbit-surface2/30 p-4 space-y-3">
                    {funnelStages.map((stage, si) => {
                      const val = selectedChannel[stage.key as keyof ChannelData] as number
                      const maxVal = selectedChannel.impressions || 1
                      const pct = (val / maxVal) * 100
                      const prevVal = si === 0
                        ? selectedChannel.impressions
                        : (selectedChannel[funnelStages[si - 1].key as keyof ChannelData] as number)
                      const conversion = prevVal > 0 ? (val / prevVal) * 100 : 0

                      return (
                        <div key={stage.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-muted)] w-16">{stage.label}</span>
                            <span className="text-[var(--text-secondary)] font-medium">{formatNumber(val)}</span>
                            <span className="text-[var(--text-muted)] w-20 text-right">
                              {si === 0 ? '100%' : conversion.toFixed(1) + '%'}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-orbit-surface3 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                                stage.color,
                              )}
                              style={{ width: `${Math.max(0.5, pct)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* period comparison placeholder */}
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                    周期对比
                    <Badge variant="neutral" className="ml-2 text-[10px]">{comparePeriod}</Badge>
                  </h3>
                  {comparePeriod === '无对比' ? (
                    <div className="h-20 flex items-center justify-center border border-dashed border-orbit-border rounded-lg">
                      <p className="text-[var(--text-primary)] text-xs">请选择对比周期</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-orbit-border bg-orbit-surface2/30 p-4">
                      <p className="text-xs text-[var(--text-muted)] text-center">周期对比数据将在后续版本中提供</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}