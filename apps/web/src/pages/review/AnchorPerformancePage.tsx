import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, Users, Clock, DollarSign, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { api } from '@/services/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { cn } from '@/utils/cn'
import { CHART_GRID, CHART_AXIS, CHART_SERIES } from '@/constants/chartPalette'

// ---- Types ----

interface AudienceProfile {
  strategy_top3?: string
  gender?: string
  age_top3?: string
  city_tier_top3?: string
  region_top3?: string
}

interface AnchorData {
  anchor_id: number
  anchor_name: string
  gmv: number
  gmv_per_hour: number
  avg_item_price: number
  buyer_count: number
  online_peak: number
  avg_online: number
  exposure_view_rate: number
  retention_rate: number
  interaction_rate: number
  new_fans: number
  view_follow_rate: number
  new_group_members: number
  uv_value: number
  duration_min: number
  audience_profile: string | null
}

// ---- Helpers ----

function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `${h}h${m}min`
  return `${m}min`
}

function formatCurrency(val: number): string {
  return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(val: number): string {
  if (val === 0) return '0.00%'
  return `${val.toFixed(2)}%`
}

function formatNumber(val: number): string {
  return val.toLocaleString('zh-CN')
}

// Color palette for radar series
const ANCHOR_COLORS = CHART_SERIES.slice(0, 8)

// ---- Constants ----

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

// ---- Component ----

export function AnchorPerformancePage() {
  const [data, setData] = useState<AnchorData[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<string>('gmv')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedAnchorId, setSelectedAnchorId] = useState<number | null>(null)

  // Derive selected anchor's audience profile
  const selectedProfile = useMemo<AudienceProfile | null>(() => {
    if (!data || selectedAnchorId === null) return null
    const anchor = data.find((d) => d.anchor_id === selectedAnchorId)
    if (!anchor || !anchor.audience_profile) return null
    try {
      return JSON.parse(anchor.audience_profile) as AudienceProfile
    } catch {
      return null
    }
  }, [data, selectedAnchorId])

  useEffect(() => {
    setLoading(true)
    api
      .get<AnchorData[]>('/api/v1/review/anchors')
      .then((res) => {
        setData(res)
        if (res.length > 0) setSelectedAnchorId(res[0].anchor_id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ---- Sorted data ----

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data].sort((a, b) => {
      const aVal = a[sortKey as keyof AnchorData] ?? 0
      const bVal = b[sortKey as keyof AnchorData] ?? 0
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [data, sortKey, sortDir])

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // ---- Radar chart data ----

  const radarData = useMemo(() => {
    if (!data || data.length === 0) return []
    const maxUv = Math.max(...data.map((d) => d.uv_value), 1)
    return data.map((d) => ({
      anchor_name: d.anchor_name,
      引流能力: Math.min(d.exposure_view_rate, 100),
      留人能力: Math.min(d.retention_rate, 100),
      互动能力: Math.min(d.interaction_rate, 100),
      吸粉能力: Math.min(d.view_follow_rate, 100),
      转化能力: Math.min((d.uv_value / maxUv) * 100, 100),
    }))
  }, [data])

  const radarChartData = useMemo(() => {
    if (radarData.length === 0) return []
    const dimensions = ['引流能力', '留人能力', '互动能力', '吸粉能力', '转化能力']
    return dimensions.map((dim) => ({
      dimension: dim,
      ...Object.fromEntries(radarData.map((d) => [d.anchor_name, d[dim as keyof typeof d]])),
    }))
  }, [radarData])

  // ---- Summary metrics ----

  const summary = useMemo(() => {
    if (!data || data.length === 0) return null
    const totalDuration = data.reduce((s, d) => s + d.duration_min, 0)
    const totalGmv = data.reduce((s, d) => s + d.gmv, 0)
    const avgGmvPerHour = data.reduce((s, d) => s + d.gmv_per_hour, 0) / data.length
    const avgUv = data.reduce((s, d) => s + d.uv_value, 0) / data.length
    return { totalDuration, totalGmv, avgGmvPerHour, avgUv }
  }, [data])

  // =============================================
  // Loading skeleton
  // =============================================

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
        <div className="h-8 w-48 rounded bg-orbit-surface2 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-orbit-surface2 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-orbit-surface2 animate-pulse" />
        <div className="h-96 rounded-xl bg-orbit-surface2 animate-pulse" />
      </div>
    )
  }

  // =============================================
  // Empty state
  // =============================================

  if (!data || data.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">主播效能分析</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">主播维度效能评估</p>
        </motion.div>
        <Card>
          <CardBody>
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="w-12 h-12 text-[var(--text-muted)] mb-4" />
              <p className="text-[var(--text-muted)] text-sm">暂无主播数据</p>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  // =============================================
  // Main render
  // =============================================

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">主播效能分析</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">主播维度效能评估</p>
          </div>
        </div>
      </motion.div>

      {/* ============================================
          1. Summary Cards
          ============================================ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card>
          <CardHeader title="效能概览" subtitle="主播效能关键指标" />
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SummaryCard
                icon={Clock}
                label="总开播时长"
                value={formatDuration(summary!.totalDuration)}
                delay={0.05}
              />
              <SummaryCard
                icon={DollarSign}
                label="总 GMV"
                value={formatCurrency(summary!.totalGmv)}
                delay={0.1}
              />
              <SummaryCard
                icon={TrendingUp}
                label="单小时 GMV"
                value={formatCurrency(summary!.avgGmvPerHour)}
                delay={0.15}
              />
              <SummaryCard
                icon={Users}
                label="单 UV 价值"
                value={formatCurrency(summary!.avgUv)}
                delay={0.2}
              />
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* ============================================
          2. Anchor Radar Chart
          ============================================ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <Card>
          <CardHeader title="能力雷达" subtitle="主播多维度能力对比" />
          <CardBody>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarChartData}>
                  <PolarGrid stroke={CHART_GRID} />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: CHART_AXIS, fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: CHART_AXIS, fontSize: 10 }}
                  />
                  {radarData.map((d, i) => (
                    <Radar
                      key={d.anchor_name}
                      name={d.anchor_name}
                      dataKey={d.anchor_name}
                      stroke={ANCHOR_COLORS[i % ANCHOR_COLORS.length]}
                      fill={ANCHOR_COLORS[i % ANCHOR_COLORS.length]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: CHART_AXIS }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* ============================================
          3. Anchor Detail Table
          ============================================ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <Card>
          <CardHeader title="效能明细" subtitle="各主播详细效能数据" />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Group header row */}
                  <tr className="border-b border-orbit-border">
                    <TableHeader colSpan={7}>基础业绩</TableHeader>
                    <TableHeader colSpan={2}>人气</TableHeader>
                    <TableHeader colSpan={1}>引流</TableHeader>
                    <TableHeader colSpan={2}>留人</TableHeader>
                    <TableHeader colSpan={1}>互动</TableHeader>
                    <TableHeader colSpan={3}>吸粉</TableHeader>
                    <TableHeader colSpan={1}>转化</TableHeader>
                  </tr>
                  {/* Column header row */}
                  <tr className="border-b border-orbit-border text-xs text-[var(--text-muted)]">
                    <Th sortable sortKey="anchor_id" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      账号
                    </Th>
                    <Th sortable sortKey="anchor_name" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      主播名称
                    </Th>
                    <Th sortable sortKey="duration_min" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      开播时长
                    </Th>
                    <Th sortable sortKey="gmv" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      GMV
                    </Th>
                    <Th sortable sortKey="gmv_per_hour" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      单小时GMV
                    </Th>
                    <Th sortable sortKey="avg_item_price" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      平均件单价
                    </Th>
                    <Th sortable sortKey="buyer_count" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      成交人数
                    </Th>
                    <Th sortable sortKey="online_peak" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      PCU
                    </Th>
                    <Th sortable sortKey="avg_online" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      ACU
                    </Th>
                    <Th sortable sortKey="exposure_view_rate" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      曝光-观看率
                    </Th>
                    <Th sortable sortKey="retention_rate" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      留存率
                    </Th>
                    <Th>人均观看时长</Th>
                    <Th sortable sortKey="interaction_rate" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      观看-互动率
                    </Th>
                    <Th sortable sortKey="new_fans" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      新增粉丝数
                    </Th>
                    <Th sortable sortKey="view_follow_rate" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      观看-关注率
                    </Th>
                    <Th sortable sortKey="new_group_members" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      新加团人数
                    </Th>
                    <Th sortable sortKey="uv_value" currentKey={sortKey} dir={sortDir} onSort={toggleSort}>
                      单UV价值
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => (
                    <motion.tr
                      key={row.anchor_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03 }}
                      onClick={() => setSelectedAnchorId(row.anchor_id)}
                      className={cn(
                        'border-b border-orbit-border transition-colors cursor-pointer',
                        i % 2 === 0 ? 'bg-orbit-surface' : 'bg-orbit-surface2/30',
                        selectedAnchorId === row.anchor_id && 'ring-2 ring-inset ring-orbit-accent/40 bg-orbit-accent/5'
                      )}
                    >
                      <Td>{row.anchor_id}</Td>
                      <Td className="font-medium text-[var(--text-secondary)]">{row.anchor_name}</Td>
                      <Td>{formatDuration(row.duration_min)}</Td>
                      <Td>{formatCurrency(row.gmv)}</Td>
                      <Td>{formatCurrency(row.gmv_per_hour)}</Td>
                      <Td>{formatCurrency(row.avg_item_price)}</Td>
                      <Td>{formatNumber(row.buyer_count)}</Td>
                      <Td>{formatNumber(row.online_peak)}</Td>
                      <Td>{formatNumber(row.avg_online)}</Td>
                      <Td>{formatPercent(row.exposure_view_rate)}</Td>
                      <Td>{formatPercent(row.retention_rate)}</Td>
                      <Td className="text-[var(--text-muted)]">—</Td>
                      <Td>{formatPercent(row.interaction_rate)}</Td>
                      <Td>{formatNumber(row.new_fans)}</Td>
                      <Td>{formatPercent(row.view_follow_rate)}</Td>
                      <Td>{formatNumber(row.new_group_members)}</Td>
                      <Td>{formatCurrency(row.uv_value)}</Td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* ============================================
          4. Audience Profile Section
          ============================================ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.4 }}
      >
        <Card>
          <CardHeader
            title="人群画像"
            subtitle={
              selectedAnchorId && data
                ? `主播「${data.find((d) => d.anchor_id === selectedAnchorId)?.anchor_name ?? '—'}」受众特征分析`
                : '受众特征分析'
            }
          />
          <CardBody>
            {selectedProfile ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <ProfileBox title="策略人群 TOP3" value={selectedProfile.strategy_top3 ?? '—'} />
                <ProfileBox title="性别" value={selectedProfile.gender ?? '—'} />
                <ProfileBox title="年龄 TOP3" value={selectedProfile.age_top3 ?? '—'} />
                <ProfileBox title="城市等级 TOP3" value={selectedProfile.city_tier_top3 ?? '—'} />
                <ProfileBox title="地域 TOP3" value={selectedProfile.region_top3 ?? '—'} />
              </div>
            ) : (
              <div className="border-2 border-dashed border-orbit-border rounded-xl p-8">
                <div className="text-center">
                  <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
                  <p className="text-[var(--text-muted)] text-sm font-medium">
                    {data && data.length > 0
                      ? '该主播暂无人群画像数据'
                      : '暂无主播数据'}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs mt-1">
                    {data && data.length > 0
                      ? '请确认主播分析文件已导入且包含人群画像字段'
                      : '请先上传主播分析数据'}
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}

// =====================================================
// Subcomponents
// =====================================================

function SummaryCard({
  icon: Icon,
  label,
  value,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-lg bg-orbit-surface2/50 border border-orbit-border p-4"
    >
      <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-2">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </motion.div>
  )
}

function Th({
  children,
  sortable,
  sortKey,
  currentKey,
  dir,
  onSort,
}: {
  children: React.ReactNode
  sortable?: boolean
  sortKey?: string
  currentKey?: string
  dir?: 'asc' | 'desc'
  onSort?: (key: string) => void
}) {
  const active = sortable && sortKey === currentKey
  const SortIcon = active && dir === 'asc' ? ArrowUp : active && dir === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th
      className={cn(
        'px-3 py-2 text-left font-medium whitespace-nowrap',
        sortable && 'cursor-pointer hover:text-[var(--text-primary)] select-none',
        active ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
      )}
      onClick={() => {
        if (sortable && sortKey) onSort?.(sortKey)
      }}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && <SortIcon className="w-3 h-3 opacity-50 shrink-0" />}
      </div>
    </th>
  )
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <td className={cn('px-3 py-2.5 whitespace-nowrap text-[var(--text-muted)]', className)}>
      {children}
    </td>
  )
}

function TableHeader({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <th
      colSpan={colSpan}
      className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)] bg-orbit-surface2/20 border-r border-orbit-border last:border-r-0"
    >
      {children}
    </th>
  )
}

function ProfileBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg bg-orbit-surface2/50 border border-orbit-border p-4 text-center">
      <p className="text-xs text-[var(--text-muted)] font-medium mb-2">{title}</p>
      <p className="text-sm font-medium text-[var(--text-secondary)]">{value}</p>
    </div>
  )
}