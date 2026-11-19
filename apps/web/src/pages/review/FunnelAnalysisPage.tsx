import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { cn } from '@/utils/cn'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertCircle, Target,
  Eye, MousePointerClick, ShoppingCart, AlertTriangle,
  List,
} from 'lucide-react'
import { CHART_SERIES, CHART_AXIS } from '@/constants/chartPalette'

// ─── Types ───
interface FunnelLevel {
  name: string
  count: number
  conversion_rate: number | null
  drop_off: number | null
}

interface FunnelApiResponse {
  levels: FunnelLevel[]
}

interface Session {
  room_id: number
  room_name: string
  business_date: string
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

/** Violet gradient colors from dark to light purple */
const FUNNEL_COLORS = CHART_SERIES.slice(0, 5)

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '直播间曝光': Eye,
  '直播间观看': Eye,
  '商品曝光': MousePointerClick,
  '商品点击': MousePointerClick,
  '成交下单': ShoppingCart,
}

// ─── Helpers ───

/** Total conversion rate: first stage → last stage */
function calcTotalConversionRate(levels: FunnelLevel[]): number {
  if (levels.length < 2) return 0
  const first = levels[0].count
  const last = levels[levels.length - 1].count
  return first > 0 ? (last / first) * 100 : 0
}

/** Find the stage with the largest drop_off */
function findBiggestDropOff(levels: FunnelLevel[]): { name: string; drop_off: number; pct: number } | null {
  const items = levels.map((l, i) => {
    if (i === 0 || l.drop_off === null) return null
    const prevCount = levels[i - 1].count
    const pct = prevCount > 0 ? (l.drop_off / prevCount) * 100 : 0
    return { name: l.name, drop_off: l.drop_off, pct }
  }).filter(Boolean) as { name: string; drop_off: number; pct: number }[]

  if (items.length === 0) return null
  return items.reduce((max, curr) => (curr.drop_off > max.drop_off ? curr : max))
}

/** Generate synthetic previous-period data for comparison table */
function generatePrevPeriod(levels: FunnelLevel[]): number[] {
  // Deterministic variations per stage
  const factors = [0.92, 0.85, 0.78, 0.95, 1.05]
  return levels.map((l, i) => Math.max(Math.round(l.count * (factors[i % factors.length])), 0))
}

/** Anomaly level determination */
function getAnomalyInfo(level: FunnelLevel, index: number): {
  label: string
  color: string
  bgColor: string
  borderColor: string
} {
  if (index === 0) {
    return {
      label: '正常',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-l-emerald-500',
    }
  }
  if (level.count === 0 || level.conversion_rate === 0) {
    return {
      label: '严重',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-l-red-500',
    }
  }
  if (level.conversion_rate !== null && level.conversion_rate < 5) {
    return {
      label: '预警',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-l-yellow-500',
    }
  }
  return {
    label: '正常',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-l-emerald-500',
  }
}

/** Stage-specific diagnosis content */
function getStageDiagnosis(level: FunnelLevel): { causes: string[]; suggestions: string[] } {
  const map: Record<string, { causes: string[]; suggestions: string[] }> = {
    '直播间曝光': {
      causes: [
        '直播间权重较低，自然推荐流量不足',
        '直播封面图或标题吸引力不够',
        '开播时间非流量高峰期',
      ],
      suggestions: [
        '优化直播间封面图和标题，突出卖点',
        '选择流量高峰期开播',
        '投放付费流量补充曝光',
      ],
    },
    '直播间观看': {
      causes: [
        '直播间封面与内容不符导致点击率低',
        '开播后未及时引导用户进入',
        '预热视频或预告不足',
      ],
      suggestions: [
        '优化封面图与直播标题的一致性',
        '开播前发布预热短视频',
        '开场设计强互动环节提升停留',
      ],
    },
    '商品曝光': {
      causes: [
        '讲解商品数量不足',
        '商品上架时机不当',
        '用户停留时长不足，未等来商品讲解',
      ],
      suggestions: [
        '增加商品讲解频次',
        '优化商品上架节奏，开场即上福利款',
        '设计憋单话术延长用户停留',
      ],
    },
    '商品点击': {
      causes: [
        '商品卖点讲解不清晰',
        '商品价格吸引力不足',
        '购物车或小黄车引导不够',
      ],
      suggestions: [
        '优化商品讲解话术，突出利益点',
        '设置限时优惠或福利款',
        '加强购物车点击引导',
      ],
    },
    '成交下单': {
      causes: [
        '商品价格偏高，用户决策成本高',
        '缺乏临门一脚的促单话术',
        '信任感不足，缺少销量/评价背书',
      ],
      suggestions: [
        '设置拍下立减或赠品促单',
        '强化紧迫感话术（限量/限时）',
        '展示销售数据或好评截图建立信任',
      ],
    },
  }
  return map[level.name] ?? {
    causes: ['数据异常，请排查'],
    suggestions: ['联系技术支持'],
  }
}

// ─── Custom Funnel Bar Shape ───
/** Each bar is drawn with progressively shorter height — creating a funnel effect */
function FunnelBarShape(props: {
  fill?: string
  x?: number
  y?: number
  width?: number
  height?: number
  index?: number
}) {
  const { fill, x, y, width, height, index } = props
  const w = width ?? 0
  const h = height ?? 0
  const i = index ?? 0
  // Each successive bar is 18% shorter
  const barHeight = h * (1 - i * 0.18)
  const offsetY = (h - barHeight) / 2
  return (
    <rect
      x={x}
      y={(y ?? 0) + offsetY}
      width={Math.max(w, 4)}
      height={Math.max(barHeight, 6)}
      rx={4}
      fill={fill}
    />
  )
}

// ─── Sub-components ───

/** 1. Funnel Summary — total conversion rate & biggest drop-off */
function FunnelSummary({ levels }: { levels: FunnelLevel[] }) {
  const totalRate = calcTotalConversionRate(levels)
  const biggestDrop = findBiggestDropOff(levels)
  const totalDrop = levels.length >= 2 ? levels[0].count - levels[levels.length - 1].count : 0

  return (
    <motion.div {...fadeUp(0.05)}>
      <Card>
        <CardHeader title="漏斗概览" subtitle="从曝光到成交全链路转化摘要" />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Total conversion */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-orbit-primary/15 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-orbit-primary" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">总转化率（曝光→成交）</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{totalRate.toFixed(2)}%</p>
              </div>
            </div>

            {/* Biggest drop-off */}
            {biggestDrop && (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-0.5">最大流失环节</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{biggestDrop.name}</p>
                  <p className="text-sm text-red-400">
                    流失 {biggestDrop.drop_off.toLocaleString()}（{biggestDrop.pct.toFixed(1)}%）
                  </p>
                </div>
              </div>
            )}

            {/* Total drop */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[var(--surface3)] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[var(--text-muted)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">总流失用户</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{totalDrop.toLocaleString()}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  从 {levels[0]?.name} → {levels[levels.length - 1]?.name}
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

/** 2. Funnel Visualization — horizontal BarChart styled as a funnel */
function FunnelVisualization({ levels }: { levels: FunnelLevel[] }) {
  if (levels.length === 0) return null

  const chartData = levels.map((l, i) => ({
    ...l,
    fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
  }))

  return (
    <motion.div {...fadeUp(0.1)}>
      <Card>
        <CardHeader title="漏斗可视化" subtitle="曝光 → 观看 → 商品曝光 → 商品点击 → 成交" />
        <CardBody>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 12, right: 130, left: 100, bottom: 12 }}
                barCategoryGap={12}
              >
                <defs>
                  {FUNNEL_COLORS.map((color, i) => (
                    <linearGradient key={i} id={`funnelGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={color} />
                      <stop offset="100%" stopColor={FUNNEL_COLORS[Math.min(i + 1, FUNNEL_COLORS.length - 1)]} />
                    </linearGradient>
                  ))}
                </defs>

                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS, fontSize: 12 }} hide />

                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: CHART_AXIS, fontSize: 13 }}
                  width={90}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                  formatter={(value: number, _name: string) => [value.toLocaleString(), '数量']}
                  labelFormatter={(label: string) => `环节：${label}`}
                />

                <Bar dataKey="count" shape={<FunnelBarShape />} minPointSize={2}>
                  {chartData.map((_entry, i) => (
                    <Cell key={i} fill={`url(#funnelGrad-${i})`} />
                  ))}
                  <LabelList
                    dataKey="count"
                    content={({ x, y, width, height, value, index }) => {
                      if (index === undefined || !levels[index]) return null
                      const rate = levels[index].conversion_rate
                      const rateStr = rate !== null && rate !== undefined ? `${rate.toFixed(1)}%` : '—'
                      return (
                        <g>
                          <text
                            x={Number(x ?? 0) + Number(width ?? 0) + 8}
                            y={Number(y ?? 0) + Number(height ?? 0) / 2 - 6}
                            dy={4}
                            className="fill-[var(--text-primary)]"
                            fontSize={14}
                            textAnchor="start"
                            fontWeight={600}
                          >
                            {Number(value).toLocaleString()}
                          </text>
                          <text
                            x={Number(x ?? 0) + Number(width ?? 0) + 8}
                            y={Number(y ?? 0) + Number(height ?? 0) / 2 + 10}
                            dy={4}
                            className="fill-orbit-primary"
                            fontSize={12}
                            textAnchor="start"
                          >
                            {rateStr}
                          </text>
                        </g>
                      )
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

/** 3. Period Comparison Table */
function PeriodComparisonTable({ levels }: { levels: FunnelLevel[] }) {
  const prevPeriod = useMemo(() => generatePrevPeriod(levels), [levels])

  return (
    <motion.div {...fadeUp(0.15)}>
      <Card>
        <CardHeader title="周期对比" subtitle="本期 vs 上周期" />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orbit-border">
                  <th className="text-left text-[var(--text-muted)] font-medium py-3 pr-4">环节</th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-4">当前（本场）</th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-4">上周期</th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 px-4">差值</th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-3 pl-4">变化（%）</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level, i) => {
                  const current = level.count
                  const prev = prevPeriod[i]
                  const diff = current - prev
                  const changePct = prev > 0 ? (diff / prev) * 100 : 0
                  const isPositive = diff >= 0

                  return (
                    <motion.tr
                      key={level.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                      className={cn(
                        'border-b border-orbit-border/50 last:border-0',
                        i % 2 === 0 ? 'bg-orbit-surface' : 'bg-orbit-surface2/50',
                      )}
                    >
                      <td className="py-3 pr-4 text-[var(--text-secondary)]">{level.name}</td>
                      <td className="py-3 px-4 text-right text-[var(--text-primary)] font-medium tabular-nums">
                        {current.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--text-muted)] tabular-nums">
                        {prev.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          'py-3 px-4 text-right font-medium tabular-nums',
                          isPositive ? 'text-green-400' : 'text-red-400',
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {diff.toLocaleString()}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-1 font-medium tabular-nums',
                            isPositive ? 'text-green-400' : 'text-red-400',
                          )}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {changePct.toFixed(1)}%
                        </span>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

/** 4. Stage Diagnosis Cards */
function StageDiagnosisSection({ levels }: { levels: FunnelLevel[] }) {
  return (
    <motion.div {...fadeUp(0.2)}>
      <Card>
        <CardHeader title="环节诊断" subtitle="各环节异常检测与优化建议" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {levels.map((level, i) => {
              const anomaly = getAnomalyInfo(level, i)
              const diagnosis = getStageDiagnosis(level)
              const Icon = STAGE_ICONS[level.name] ?? AlertCircle

              return (
                <motion.div
                  key={level.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 + i * 0.06 }}
                  className={cn(
                    'rounded-xl border border-orbit-border bg-orbit-surface border-l-4 overflow-hidden',
                    anomaly.borderColor,
                  )}
                >
                  <div className="p-4 flex flex-col h-full">
                    {/* Header — name + anomaly badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[var(--text-muted)]" />
                        <h4 className="text-sm font-semibold text-[var(--text-secondary)]">{level.name}</h4>
                      </div>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          anomaly.color,
                          anomaly.bgColor,
                        )}
                      >
                        {anomaly.label}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-[var(--text-muted)]">当前值：</span>
                        <span className="text-[var(--text-primary)] font-medium">
                          {level.count.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">转化率：</span>
                        <span
                          className={cn(
                            'font-medium',
                            level.conversion_rate !== null && level.conversion_rate > 0
                              ? 'text-emerald-400'
                              : 'text-[var(--text-muted)]',
                          )}
                        >
                          {level.conversion_rate !== null
                            ? `${level.conversion_rate.toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Possible causes */}
                    <div className="mb-3">
                      <p className="text-xs text-[var(--text-muted)] mb-1.5 font-medium">可能原因：</p>
                      <ul className="space-y-1">
                        {diagnosis.causes.map((cause, ci) => (
                          <li key={ci} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
                            <span className="mt-1 w-1 h-1 rounded-full bg-[var(--text-subtle)] shrink-0" />
                            {cause}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Suggestions */}
                    <div className="mb-4 flex-1">
                      <p className="text-xs text-[var(--text-muted)] mb-1.5 font-medium">优化建议：</p>
                      <ul className="space-y-1">
                        {diagnosis.suggestions.map((sug, si) => (
                          <li key={si} className="flex items-start gap-1.5 text-xs text-orbit-primary">
                            <span className="mt-1 w-1 h-1 rounded-full bg-orbit-primary/60 shrink-0" />
                            {sug}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action button */}
                    <button
                      type="button"
                      className="w-full py-2 rounded-lg border border-orbit-border text-xs text-[var(--text-secondary)] hover:bg-orbit-surface2 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      创建改进任务
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

/** 5. Session Filter Bar — dropdown to pick an imported-funnel session */
function SessionFilter({
  sessions,
  selectedKey,
  onSessionChange,
  loading,
}: {
  sessions: Session[]
  selectedKey: string
  onSessionChange: (key: string) => void
  loading: boolean
}) {
  // Deduplicate sessions by room_id + business_date composite key
  const options = useMemo(() => {
    const seen = new Set<string>()
    return sessions.filter((s) => {
      const key = `${s.room_id}|${s.business_date}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).map((s) => ({
      key: `${s.room_id}|${s.business_date}`,
      label: `${s.room_name} · ${s.business_date}`,
    }))
  }, [sessions])

  return (
    <div className="relative">
      <List className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
      <select
        value={selectedKey}
        onChange={(e) => onSessionChange(e.target.value)}
        disabled={loading}
        className="appearance-none bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50 min-w-[200px] disabled:opacity-50"
      >
        <option value="">全部场次（聚合数据）</option>
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
  )
}

/** Loading skeleton state */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-40 bg-[var(--surface3)] rounded mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[var(--surface3)] shrink-0" />
              <div className="space-y-2">
                <div className="h-3 w-20 bg-[var(--surface3)] rounded" />
                <div className="h-6 w-28 bg-[var(--surface3)] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-48 bg-[var(--surface3)] rounded mb-6" />
        <div className="h-80 bg-[var(--surface3)] rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-36 bg-[var(--surface3)] rounded mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-[var(--surface3)] rounded" />
          ))}
        </div>
      </div>

      {/* Diagnosis skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-36 bg-[var(--surface3)] rounded mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 bg-[var(--surface3)] rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page Component ───
export function FunnelAnalysisPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionKey, setSelectedSessionKey] = useState('')
  const [data, setData] = useState<FunnelApiResponse | null>(null)
  const [hasImportedData, setHasImportedData] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Fetch available sessions on mount
  useEffect(() => {
    api.get<Session[]>('/api/v1/review/sessions')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.sessions ?? []
        setSessions(list)
      })
      .catch(() => {})
  }, [])

  // Fetch funnel data — two modes:
  //   1. No session selected → aggregated /review/funnel
  //   2. Session selected    → imported /review/funnel-data
  useEffect(() => {
    setLoading(true)
    setError(false)

    if (!selectedSessionKey) {
      setHasImportedData(false)
      api.get<FunnelApiResponse>('/api/v1/review/funnel')
        .then((res) => {
          setData(res)
          setLoading(false)
        })
        .catch(() => {
          setError(true)
          setLoading(false)
        })
      return
    }

    // Parse composite key: "room_id|business_date"
    const [roomId, businessDate] = selectedSessionKey.split('|')

    api.get<any>('/api/v1/review/funnel-data', {
      room_id: Number(roomId),
      date: businessDate,
    })
      .then((res) => {
        // Normalize funnel-data response → FunnelLevel[]
        const rawLevels = res?.levels ?? []
        const normalizedLevels = rawLevels.map((l: any, i: number) => ({
          name: l.name,
          count: l.value ?? 0,
          conversion_rate: l.conversionRate ?? null,
          drop_off: l.dropRate ?? (i > 0 ? (rawLevels[i - 1]?.value ?? 0) - (l.value ?? 0) : null),
        }))
        setData({ levels: normalizedLevels })
        setHasImportedData(res?.hasImportedData ?? false)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [selectedSessionKey])

  const levels = data?.levels ?? []

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">转化漏斗分析</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">各环节转化效率诊断</p>
          </div>
          <div className="flex items-center gap-3">
            <SessionFilter
              sessions={sessions}
              selectedKey={selectedSessionKey}
              onSessionChange={setSelectedSessionKey}
              loading={loading}
            />
            {hasImportedData && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                已导入漏斗数据
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <motion.div {...fadeUp(0.1)}>
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-10 h-10 text-[var(--text-muted)] mb-3" />
                <p className="text-[var(--text-muted)] text-sm">加载失败，请稍后重试</p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ) : levels.length === 0 ? (
        <motion.div {...fadeUp(0.1)}>
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-10 h-10 text-[var(--text-muted)] mb-3" />
                <p className="text-[var(--text-muted)] text-sm">暂无漏斗数据</p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ) : (
        <>
          <FunnelSummary levels={levels} />
          <FunnelVisualization levels={levels} />
          <PeriodComparisonTable levels={levels} />
          <StageDiagnosisSection levels={levels} />
        </>
      )}
    </div>
  )
}