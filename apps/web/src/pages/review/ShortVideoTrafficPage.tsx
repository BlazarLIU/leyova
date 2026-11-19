import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { cn } from '@/utils/cn'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Video, Eye, TrendingUp, Calendar, Monitor, List,
  AlertTriangle, MousePointerClick, BarChart3, VideoOff,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { CHART_SERIES, CHART_AXIS } from '@/constants/chartPalette'

// ─── Types ───

interface SessionOption {
  id: number
  room_id: number
  business_date: string
  title?: string
  anchor_name?: string
}

interface ShortVideoItem {
  id: number
  session_id: number | null
  room_id: number
  business_date: string
  video_name: string
  post_time: string | null
  live_entry_impressions: number
  traffic_to_live: number
  entry_click_rate: number
  upload_id: number
  created_at: string
}

// ─── Constants ───

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay },
})

/** Purple gradient palette for ranking bars */
const RANK_COLORS = CHART_SERIES

type RankMetric = 'impressions' | 'traffic'

// ─── Helpers ───

function formatNumber(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(2) + '亿'
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万'
  return n.toLocaleString()
}

function computeSummary(items: ShortVideoItem[]) {
  return {
    totalVideos: items.length,
    totalImpressions: items.reduce((s, i) => s + i.live_entry_impressions, 0),
    totalTrafficToLive: items.reduce((s, i) => s + i.traffic_to_live, 0),
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function sessionLabel(s: SessionOption): string {
  const parts = [s.title ?? `直播间 ${s.room_id}`]
  if (s.business_date) parts.push(s.business_date)
  if (s.anchor_name) parts.push(s.anchor_name)
  return parts.join(' · ')
}

// ─── Sub-components ───

function SessionFilter({
  sessions,
  selectedId,
  onChange,
}: {
  sessions: SessionOption[]
  selectedId: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Session selector */}
      <div className="relative">
        <List className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50 min-w-[200px]"
        >
          <option value="">请选择场次</option>
          {sessions.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {sessionLabel(s)}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Room / date info — derived from selected session */}
      {(() => {
        const sel = sessions.find((s) => String(s.id) === selectedId)
        if (!sel) return null
        return (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Monitor className="w-4 h-4 text-[var(--text-muted)]" />
            <span>房间 {sel.room_id}</span>
            <span className="text-[var(--text-primary)]">|</span>
            <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
            <span>{sel.business_date}</span>
          </div>
        )
      })()}
    </div>
  )
}

function SummaryCards({
  data,
}: {
  data: ReturnType<typeof computeSummary>
}) {
  const cards = [
    {
      label: '短视频总数',
      value: data.totalVideos,
      icon: Video,
      format: (v: number) => String(v),
      color: 'text-orbit-primary',
      bg: 'bg-orbit-primary/15',
    },
    {
      label: '直播引流曝光',
      value: data.totalImpressions,
      icon: Eye,
      format: formatNumber,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/15',
    },
    {
      label: '引流进房',
      value: data.totalTrafficToLive,
      icon: TrendingUp,
      format: formatNumber,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <motion.div key={card.label} {...fadeUp(0.1 + i * 0.05)}>
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center shrink-0', card.bg)}>
                  <card.icon className={cn('w-5 h-5', card.color)} />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-0.5">{card.label}</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                    {card.format(card.value)}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

function VideoTable({ items }: { items: ShortVideoItem[] }) {
  const [sortKey, setSortKey] = useState<'impressions' | 'traffic'>('impressions')
  const [sortDesc, setSortDesc] = useState(true)

  const sorted = useMemo(() => {
    const list = [...items]
    const key = sortKey === 'impressions' ? 'live_entry_impressions' as const : 'traffic_to_live' as const
    list.sort((a, b) => (sortDesc ? b[key] - a[key] : a[key] - b[key]))
    return list
  }, [items, sortKey, sortDesc])

  const toggleSort = useCallback((key: 'impressions' | 'traffic') => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDesc((d) => !d)
        return prev
      }
      setSortDesc(true)
      return key
    })
  }, [])

  const renderSortIcon = (key: 'impressions' | 'traffic') => {
    if (sortKey !== key) return null
    return sortDesc
      ? <ChevronDown className="w-3.5 h-3.5 text-orbit-primary ml-0.5" />
      : <ChevronUp className="w-3.5 h-3.5 text-orbit-primary ml-0.5" />
  }

  if (items.length === 0) {
    return (
      <motion.div {...fadeUp(0.3)}>
        <Card>
          <CardHeader title="短视频明细" subtitle="各短视频引流数据" />
          <CardBody>
            <div className="h-32 flex items-center justify-center border border-dashed border-orbit-border rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <VideoOff className="w-6 h-6 text-[var(--text-muted)]" />
                <p className="text-[var(--text-muted)] text-sm">暂无短视频数据</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div {...fadeUp(0.3)}>
      <Card>
        <CardHeader
          title="短视频明细"
          subtitle="按引流效果排序"
          actions={
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>共 {items.length} 条记录</span>
            </div>
          }
        />
        <CardBody className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orbit-border">
                  <th className="text-left text-[var(--text-muted)] font-medium py-3 pl-5 pr-4 whitespace-nowrap">
                    视频名称
                  </th>
                  <th className="text-left text-[var(--text-muted)] font-medium py-3 px-4 whitespace-nowrap">
                    发布时间
                  </th>
                  <th
                    className="text-right text-[var(--text-muted)] font-medium py-3 px-4 whitespace-nowrap cursor-pointer hover:text-[var(--text-primary)] select-none transition-colors"
                    onClick={() => toggleSort('impressions')}
                  >
                    <span className="inline-flex items-center justify-end">
                      直播引流曝光
                      {renderSortIcon('impressions')}
                    </span>
                  </th>
                  <th
                    className="text-right text-[var(--text-muted)] font-medium py-3 px-4 whitespace-nowrap cursor-pointer hover:text-[var(--text-primary)] select-none transition-colors"
                    onClick={() => toggleSort('traffic')}
                  >
                    <span className="inline-flex items-center justify-end">
                      引流进房
                      {renderSortIcon('traffic')}
                    </span>
                  </th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 pl-4 pr-5 whitespace-nowrap">
                    点击率
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, i) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className={cn(
                      'border-b border-orbit-border/40 last:border-b-0',
                      'hover:bg-white/[0.03] transition-colors',
                    )}
                  >
                    <td className="py-3 pl-5 pr-4">
                      <div className="flex items-center gap-2 max-w-[220px]">
                        <Video className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                        <span
                          className="text-[var(--text-secondary)] truncate"
                          title={item.video_name}
                        >
                          {item.video_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                      {formatDateTime(item.post_time)}
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-primary)] font-medium tabular-nums">
                      {Number(item.live_entry_impressions ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--text-primary)] font-medium tabular-nums">
                      {Number(item.traffic_to_live ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 pl-4 pr-5 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium tabular-nums">
                        <MousePointerClick className="w-3.5 h-3.5" />
                        {Number(item.entry_click_rate ?? 0).toFixed(2)}%
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

function RankingChart({
  items,
  metric,
  onMetricChange,
}: {
  items: ShortVideoItem[]
  metric: RankMetric
  onMetricChange: (m: RankMetric) => void
}) {
  const topItems = useMemo(() => {
    const key = metric === 'impressions' ? 'live_entry_impressions' as const : 'traffic_to_live' as const
    return [...items]
      .sort((a, b) => b[key] - a[key])
      .slice(0, 10)
  }, [items, metric])

  if (items.length === 0) {
    return (
      <motion.div {...fadeUp(0.35)}>
        <Card>
          <CardHeader title="引流排行" subtitle="TOP 10 短视频" />
          <CardBody>
            <div className="h-64 flex items-center justify-center border border-dashed border-orbit-border rounded-lg">
              <p className="text-[var(--text-muted)] text-sm">暂无数据</p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    )
  }

  const metricLabel = metric === 'impressions' ? '直播引流曝光' : '引流进房'

  return (
    <motion.div {...fadeUp(0.35)}>
      <Card>
        <CardHeader
          title="引流排行"
          subtitle="TOP 10 短视频 — 点击切换指标"
          actions={
            <div className="flex items-center gap-1 bg-orbit-surface2 rounded-lg p-0.5">
              <button
                onClick={() => onMetricChange('impressions')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
                  metric === 'impressions'
                    ? 'bg-orbit-primary/20 text-orbit-primary font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                曝光
              </button>
              <button
                onClick={() => onMetricChange('traffic')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer',
                  metric === 'traffic'
                    ? 'bg-orbit-primary/20 text-orbit-primary font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                进房
              </button>
            </div>
          }
        />
        <CardBody>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topItems}
                layout="vertical"
                margin={{ top: 8, right: 80, left: 120, bottom: 8 }}
                barSize={20}
                barGap={6}
              >
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: CHART_AXIS, fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="video_name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: CHART_AXIS, fontSize: 11 }}
                  width={110}
                  tickFormatter={(val: string) =>
                    val.length > 8 ? `${val.slice(0, 8)}…` : val
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                  formatter={(value: number) => [value.toLocaleString(), metricLabel]}
                  labelFormatter={(label: string) => `视频：${label}`}
                />
                <Bar
                  dataKey={metric === 'impressions' ? 'live_entry_impressions' : 'traffic_to_live'}
                  radius={[0, 4, 4, 0]}
                >
                  {topItems.map((_, i) => (
                    <Cell
                      key={i}
                      fill={RANK_COLORS[i % RANK_COLORS.length]}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

// ─── Loading Skeleton ───

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[var(--surface3)] shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-16 bg-[var(--surface3)] rounded" />
                <div className="h-6 w-24 bg-[var(--surface3)] rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-40 bg-[var(--surface3)] rounded mb-6" />
        <div className="h-72 bg-[var(--surface3)] rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-40 bg-[var(--surface3)] rounded mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[var(--surface3)] rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page Component ───

export function ShortVideoTrafficPage() {
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [videos, setVideos] = useState<ShortVideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [videosLoading, setVideosLoading] = useState(false)
  const [error, setError] = useState(false)
  const [rankMetric, setRankMetric] = useState<RankMetric>('impressions')

  // Fetch available sessions on mount
  useEffect(() => {
    setLoading(true)
    setError(false)
    api.get<SessionOption[]>('/api/v1/review/sessions')
      .then((data) => {
        setSessions(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  // Fetch videos when session selection changes
  useEffect(() => {
    if (!selectedSessionId) {
      setVideos([])
      return
    }

    const session = sessions.find((s) => String(s.id) === selectedSessionId)
    if (!session) return

    setVideosLoading(true)
    api.get<ShortVideoItem[]>('/api/v1/review/short-videos', {
      room_id: session.room_id,
      date: session.business_date,
    })
      .then((data) => {
        setVideos(Array.isArray(data) ? data : [])
        setVideosLoading(false)
      })
      .catch(() => {
        setVideos([])
        setVideosLoading(false)
      })
  }, [selectedSessionId, sessions])

  const summary = useMemo(() => computeSummary(videos), [videos])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* ── Page header ── */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">短视频引流分析</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">短视频为直播间引流效果分析</p>
          </div>
        </div>
      </motion.div>

      {/* ── Session filter card ── */}
      <motion.div {...fadeUp(0.05)}>
        <Card>
          <CardHeader
            title="选择场次"
            subtitle="选择直播场次查看短视频引流数据"
          />
          <CardBody>
            {loading ? (
              <div className="h-9 w-48 bg-[var(--surface3)] rounded animate-pulse" />
            ) : error ? (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-red-400">加载场次列表失败</span>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">暂无可用场次</p>
            ) : (
              <SessionFilter
                sessions={sessions}
                selectedId={selectedSessionId}
                onChange={setSelectedSessionId}
              />
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* ── Content area ── */}
      {!selectedSessionId ? (
        /* Empty state — no session selected */
        <motion.div {...fadeUp(0.1)}>
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center py-16">
                <Video className="w-12 h-12 text-[var(--text-primary)] mb-4" />
                <p className="text-[var(--text-muted)] text-sm font-medium mb-1">请选择直播场次</p>
                <p className="text-[var(--text-muted)] text-xs">选择一个场次以查看短视频引流数据</p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ) : videosLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Summary cards */}
          <SummaryCards data={summary} />

          {/* Ranking chart */}
          <RankingChart
            items={videos}
            metric={rankMetric}
            onMetricChange={setRankMetric}
          />

          {/* Video detail table */}
          <VideoTable items={videos} />
        </>
      )}
    </div>
  )
}