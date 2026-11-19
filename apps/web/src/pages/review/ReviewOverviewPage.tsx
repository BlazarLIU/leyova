import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { cn } from '@/utils/cn'
import { usePlatform } from '@/hooks/usePlatform'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  DollarSign, ShoppingCart, Target, Eye, MousePointerClick, Users,
  Calendar, Monitor, User, List, TrendingUp, TrendingDown,
  AlertTriangle, Award, Zap,
} from 'lucide-react'

// ─── Types ───
interface OverviewData {
  kpi: Record<string, number>
  comparison: Record<string, unknown>
  top_channels: { channel: string; gmv: number }[]
  top_anchors: { anchor_id: number; anchor_name: string; gmv_per_hour: number }[]
  top_anomalies: { indicator: string; value: number; avg_value: number; change_pct: number }[]
}

interface FunnelStep {
  name: string
  count: number
  rate?: number
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

const FUNNEL_COLORS = ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95']

const METRIC_GROUPS = [
  {
    title: '成交',
    subtitle: '交易核心指标',
    metrics: [
      {
        key: 'gmv', label: 'GMV', icon: DollarSign,
        format: (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
      },
      {
        key: 'orders', label: '订单数', icon: ShoppingCart,
        format: (v: number) => String(v),
      },
      {
        key: 'gpm', label: 'GPM', icon: Target,
        format: (v: number) => `¥${v.toFixed(1)}`,
      },
      {
        key: 'avg_order_value', label: '客单价', icon: DollarSign,
        format: (v: number) => `¥${v.toFixed(2)}`,
      },
    ],
  },
  {
    title: '流量',
    subtitle: '流量获取指标',
    metrics: [
      {
        key: 'views', label: '观看次数', icon: Eye,
        format: (v: number) => v.toLocaleString(),
      },
      {
        key: 'exposure_view_rate', label: '曝光-观看率', icon: Eye,
        format: (v: number) => `${v.toFixed(2)}%`,
      },
    ],
  },
  {
    title: '转化',
    subtitle: '转化效率指标',
    metrics: [
      {
        key: 'product_deal_rate', label: '商品点击-成交率', icon: MousePointerClick,
        format: (v: number) => `${v.toFixed(2)}%`,
      },
    ],
  },
  {
    title: '涨粉',
    subtitle: '粉丝增长指标',
    metrics: [
      {
        key: 'new_fans', label: '新增粉丝数', icon: Users,
        format: (v: number) => String(v),
      },
    ],
  },
  {
    title: '退款',
    subtitle: '退款相关指标',
    metrics: [
      {
        key: 'refund_amount', label: '退款金额', icon: DollarSign,
        format: (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
      },
      {
        key: 'refund_rate', label: '退款率', icon: TrendingDown,
        format: (v: number) => `${v.toFixed(2)}%`,
      },
    ],
  },
]

// ─── Helpers ───
function getChange(comparison: Record<string, unknown> | undefined, key: string): number | null {
  if (!comparison) return null
  const changeKey = `${key}_change`
  const changePctKey = `${key}_change_pct`
  const val = (comparison[changePctKey] ?? comparison[changeKey]) as number | undefined
  return val ?? null
}

function computeFunnelRate(steps: FunnelStep[]): FunnelStep[] {
  return steps.map((step, i) => {
    if (i === 0) return { ...step, rate: 100 }
    const prevCount = steps[i - 1].count
    const rate = prevCount > 0 ? (step.count / prevCount) * 100 : 0
    return { ...step, rate: Math.round(rate * 100) / 100 }
  })
}

// ─── Sub-components ───
function SessionInfoCard({ sessionInfo }: { sessionInfo: any }) {
  if (!sessionInfo?.basic_info && !sessionInfo?.overview) return null
  
  const basic = sessionInfo.basic_info || {}
  const overview = sessionInfo.overview || {}
  
  return (
    <motion.div {...fadeIn}>
      <Card>
        <CardHeader title="场次信息" subtitle="本场直播详情" />
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {basic.fans_before_broadcast > 0 && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">开播前粉丝数</span>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {basic.fans_before_broadcast.toLocaleString()}
                </p>
              </div>
            )}
            {basic.live_date && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">直播日期</span>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {basic.live_date?.slice(0, 10)}
                </p>
              </div>
            )}
            {basic.live_duration_min > 0 && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">直播时长</span>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {Math.floor(basic.live_duration_min / 60)}h{basic.live_duration_min % 60}m
                </p>
              </div>
            )}
            {basic.payment_amount > 0 && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">支付金额</span>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  ¥{basic.payment_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {overview.refund_amount > 0 && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">退款金额</span>
                <p className="text-lg font-semibold text-red-400">
                  ¥{overview.refund_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            {overview.refund_orders > 0 && (
              <div>
                <span className="text-xs text-[var(--text-muted)]">退款订单数</span>
                <p className="text-lg font-semibold text-red-400">
                  {overview.refund_orders}
                </p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

function FilterBar({ onSessionChange, platformCode }: { onSessionChange?: (sessionId: number | null) => void; platformCode?: string }) {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<number | null>(null)

  useEffect(() => {
    const params: any = {}
    if (platformCode && platformCode !== 'all') params.platform = platformCode
    api.get<any[]>('/api/v1/review/sessions', params).then(setSessions).catch(() => {})
  }, [platformCode])

  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : null
    setSelectedSession(val)
    onSessionChange?.(val)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 场次 */}
      <div className="relative">
        <List className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <select
          value={selectedSession ?? ''}
          onChange={handleSessionChange}
          className="appearance-none bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50 min-w-[130px]"
        >
          <option value="">全部场次</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.title || `场次 #${s.id}`}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* 日期范围 */}
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <select className="appearance-none bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50 min-w-[130px]">
          <option value="">全部日期</option>
          <option value="today">今天</option>
          <option value="yesterday">昨天</option>
          <option value="7d">近7天</option>
          <option value="30d">近30天</option>
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* 主播 */}
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <select className="appearance-none bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50 min-w-[130px]">
          <option value="">全部主播</option>
          <option value="佳佳">佳佳</option>
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {/* 直播间 */}
      <div className="relative">
        <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <select className="appearance-none bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50 min-w-[130px]">
          <option value="">全部直播间</option>
          <option value="1">直播间 1</option>
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label, value, change, icon: Icon, format, delay,
}: {
  label: string
  value: number | null
  change: number | null
  icon: React.ComponentType<{ className?: string }>
  format: (v: number) => string
  delay: number
}) {
  const isUp = change !== null && change > 0
  const isDown = change !== null && change < 0
  const displayValue = value !== null ? format(value) : '—'

  return (
    <motion.div {...fadeUp(delay)} className="h-full">
      <Card className="h-full">
        <CardBody>
          <div className="flex items-start justify-between mb-2">
            <span className="text-[var(--text-muted)] text-xs font-medium">{label}</span>
            <Icon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="text-3xl font-bold text-[var(--text-primary)] truncate">
            {displayValue}
          </div>
          {change !== null && (
            <div className="flex items-center gap-1 mt-1.5">
              {isUp && <TrendingUp className="w-3.5 h-3.5 text-green-400" />}
              {isDown && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
              <span className={cn(
                'text-xs font-medium',
                isUp && 'text-green-400',
                isDown && 'text-red-400',
                !isUp && !isDown && 'text-[var(--text-muted)]',
              )}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}

function KpiSection({ data }: { data: OverviewData }) {
  const { kpi, comparison } = data
  let cardIndex = 0

  return (
    <>
      {METRIC_GROUPS.map((group, gi) => (
        <motion.div key={group.title} {...fadeUp(0.1 + gi * 0.05)}>
          <Card>
            <CardHeader title={group.title} subtitle={group.subtitle} />
            <CardBody>
              <div
                className={cn(
                  'grid gap-4',
                  group.metrics.length === 1
                    ? 'grid-cols-1'
                    : group.metrics.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
                )}
              >
                {group.metrics.map((metric) => {
                  const idx = cardIndex++
                  const value = kpi[metric.key] ?? null
                  const change = getChange(comparison, metric.key)
                  return (
                    <MetricCard
                      key={metric.key}
                      label={metric.label}
                      value={value}
                      change={change}
                      icon={metric.icon}
                      format={metric.format}
                      delay={0.15 + idx * 0.05}
                    />
                  )
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ))}
    </>
  )
}

function FunnelSection({ funnelData }: { funnelData: FunnelStep[] }) {
  const steps = computeFunnelRate(funnelData)

  // Compute drop-off
  const withDropOff = steps.map((step, i) => {
    if (i === 0) return { ...step, drop_off: '-' }
    const prev = steps[i - 1].count
    const drop = prev - step.count
    return { ...step, drop_off: drop > 0 ? drop.toLocaleString() : '0' }
  })

  if (steps.length === 0) {
    return (
      <motion.div {...fadeUp(0.3)}>
        <Card>
          <CardHeader title="转化漏斗" subtitle="各环节转化率" />
          <CardBody>
            <div className="h-64 flex items-center justify-center border border-dashed border-orbit-border rounded-lg">
              <p className="text-[var(--text-muted)] text-sm">暂无漏斗数据</p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div {...fadeUp(0.3)}>
      <Card>
        <CardHeader title="转化漏斗" subtitle="各环节转化率" />
        <CardBody>
          {/* Recharts Horizontal BarChart */}
          <div className="h-72 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={steps}
                layout="vertical"
                margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
                barSize={28}
                barGap={4}
              >
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#cbd5e1', fontSize: 13 }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    color: '#e2e8f0',
                    fontSize: 13,
                  }}
                  formatter={(value: number) => [value.toLocaleString(), '数量']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {steps.map((_, i) => (
                    <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orbit-border">
                  <th className="text-left text-[var(--text-muted)] font-medium py-2 pr-4">环节</th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-2 px-4">数量</th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-2 px-4">转化率</th>
                  <th className="text-right text-[var(--text-muted)] font-medium py-2 pl-4">流失量</th>
                </tr>
              </thead>
              <tbody>
                {withDropOff.map((step, i) => (
                  <tr key={step.name} className="border-b border-orbit-border/50 last:border-0">
                    <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{step.name}</td>
                    <td className="py-2.5 px-4 text-right text-[var(--text-secondary)] font-medium tabular-nums">
                      {step.count.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span className={cn(
                        'font-medium',
                        i === 0 ? 'text-[var(--text-muted)]' : 'text-emerald-400',
                      )}>
                        {step.rate?.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pl-4 text-right text-red-400 tabular-nums">
                      {step.drop_off}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

function Top3Section({ data }: { data: OverviewData }) {
  const { top_channels = [], top_anchors = [], top_anomalies = [] } = data

  const maxChannelGmv = Math.max(...top_channels.map((c) => c.gmv), 1)
  const maxAnchorGpm = Math.max(...top_anchors.map((a) => a.gmv_per_hour), 1)

  return (
    <motion.div {...fadeUp(0.35)}>
      <Card>
        <CardHeader title="TOP 3 分析" subtitle="本场表现最佳维度" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 渠道 TOP3 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-[var(--text-muted)]" />
                <h4 className="text-sm font-semibold text-[var(--text-secondary)]">渠道 TOP3</h4>
              </div>
              <div className="space-y-3">
                {top_channels.slice(0, 3).map((ch, i) => (
                  <button
                    key={ch.channel}
                    onClick={() => {}}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                          i === 0 && 'bg-yellow-500/20 text-yellow-400',
                          i === 1 && 'bg-[var(--border2)] text-[var(--text-muted)]',
                          i === 2 && 'bg-amber-700/20 text-amber-600',
                        )}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                          {ch.channel}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
                        ¥{ch.gmv.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-orbit-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(ch.gmv / maxChannelGmv) * 100}%`,
                          background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                        }}
                      />
                    </div>
                  </button>
                ))}
                {top_channels.length === 0 && (
                  <p className="text-[var(--text-muted)] text-sm">暂无数据</p>
                )}
              </div>
            </div>

            {/* 主播 TOP3 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-[var(--text-muted)]" />
                <h4 className="text-sm font-semibold text-[var(--text-secondary)]">主播 TOP3</h4>
              </div>
              <div className="space-y-3">
                {top_anchors.slice(0, 3).map((a, i) => (
                  <button
                    key={a.anchor_id}
                    onClick={() => {}}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                          i === 0 && 'bg-yellow-500/20 text-yellow-400',
                          i === 1 && 'bg-[var(--border2)] text-[var(--text-muted)]',
                          i === 2 && 'bg-amber-700/20 text-amber-600',
                        )}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                          {a.anchor_name}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
                        ¥{a.gmv_per_hour.toFixed(2)}/h
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-orbit-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(a.gmv_per_hour / maxAnchorGpm) * 100}%`,
                          background: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
                        }}
                      />
                    </div>
                  </button>
                ))}
                {top_anchors.length === 0 && (
                  <p className="text-[var(--text-muted)] text-sm">暂无数据</p>
                )}
              </div>
            </div>

            {/* 异常 TOP3 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[var(--text-muted)]" />
                <h4 className="text-sm font-semibold text-[var(--text-secondary)]">异常 TOP3</h4>
              </div>
              <div className="space-y-3">
                {top_anomalies.slice(0, 3).map((anomaly, i) => (
                  <button
                    key={anomaly.indicator}
                    onClick={() => {}}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                          {(anomaly.indicator).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-sm font-medium text-red-400 tabular-nums">
                          {anomaly.change_pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)]">
                        当前值 {anomaly.value.toFixed(1)} / 均值 {anomaly.avg_value.toFixed(1)}
                      </span>
                    </div>
                  </button>
                ))}
                {top_anomalies.length === 0 && (
                  <p className="text-[var(--text-muted)] text-sm">暂无异常</p>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

function AiSummaryCard() {
  const bulletPoints = [
    '本场 GMV 达 ¥14,080.84，较上期显著提升，主因推荐feed渠道流量增长',
    'GPM 为 ¥4,495.8，低于行业均值，商品点击到成交转化有优化空间',
    '曝光-观看率仅 6.19%，直播间封面及开场话术可进一步优化以提升点击率',
    '新增粉丝数为 0，需要加强关注引导和福利互动设计',
  ]
  const recommendations = [
    '优化直播间封面图和标题，提升曝光-观看率至 10% 以上',
    '增加商品讲解频次和促销话术，提升商品点击-成交率',
    '设计关注有礼等互动环节，提升新增粉丝数',
  ]

  return (
    <motion.div {...fadeUp(0.4)}>
      <Card gradient>
        <CardHeader title="AI 总结" subtitle="智能分析本场表现" />
        <CardBody>
          <div className="space-y-5">
            {/* Key findings */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                核心发现
              </h4>
              <ul className="space-y-2">
                {bulletPoints.map((point, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.45 + i * 0.08 }}
                    className="flex items-start gap-2.5 text-sm text-[var(--text-muted)]"
                  >
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orbit-primary/60 flex-shrink-0" />
                    {point}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Divider */}
            <div className="border-t border-orbit-border/60" />

            {/* Recommendations */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                改进建议
              </h4>
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.65 + i * 0.08 }}
                    className="flex items-start gap-2.5 text-sm text-[var(--text-muted)]"
                  >
                    <span className={cn(
                      'mt-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                      i === 0 && 'bg-orbit-primary/20 text-orbit-primary',
                      i === 1 && 'bg-cyan-500/20 text-cyan-400',
                      i === 2 && 'bg-emerald-500/20 text-emerald-400',
                    )}>
                      {i + 1}
                    </span>
                    {rec}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}

// ─── Page Component ───
export function ReviewOverviewPage() {
  const { currentPlatform } = usePlatform()
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionInfo, setSessionInfo] = useState<any>(null)

  useEffect(() => {
    setLoading(true)
    const platformParam = currentPlatform?.platform_code
    const params: Record<string, any> = {}
    if (platformParam && platformParam !== 'all') {
      params.platform = platformParam
    }

    Promise.all([
      api.get<any>('/api/v1/review/overview', params),
      api.get<any>('/api/v1/review/funnel', params),
    ])
      .then(([overview, funnel]) => {
        setOverviewData(overview)
        // Funnel data may come as {steps: [...]} or as an array directly
        if (Array.isArray(funnel)) {
          setFunnelData(funnel)
        } else if (funnel?.steps) {
          setFunnelData(funnel.steps)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentPlatform?.platform_code])

  const handleSessionChange = (sessionId: number | null) => {
    if (!sessionId) {
      setSessionInfo(null)
      return
    }
    api.get<any>('/api/v1/review/session-info', { room_id: sessionId })
      .then(setSessionInfo)
      .catch(() => setSessionInfo(null))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">复盘总览</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">直播效果综合复盘</p>
          </div>
          <FilterBar onSessionChange={handleSessionChange} platformCode={currentPlatform?.platform_code} />
        </div>
      </motion.div>

      {loading ? (
        /* Loading skeleton */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
                <div className="h-3 w-16 bg-[var(--surface3)] rounded mb-3" />
                <div className="h-8 w-28 bg-[var(--surface3)] rounded mb-2" />
                <div className="h-3 w-20 bg-[var(--surface3)] rounded" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
            <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
            <div className="h-3 w-40 bg-[var(--surface3)] rounded mb-6" />
            <div className="h-64 bg-[var(--surface3)] rounded-lg" />
          </div>
        </div>
      ) : overviewData ? (
        <>
          {/* KPI Sections */}
          <KpiSection data={overviewData} />

          {/* Session Info */}
          {sessionInfo && <SessionInfoCard sessionInfo={sessionInfo} />}

          {/* Funnel Visualization */}
          <FunnelSection funnelData={funnelData} />

          {/* TOP 3 Analysis */}
          <Top3Section data={overviewData} />

          {/* AI Summary */}
          <AiSummaryCard />
        </>
      ) : (
        /* Error state */
        <motion.div {...fadeUp(0.1)}>
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="w-10 h-10 text-[var(--text-muted)] mb-3" />
                <p className="text-[var(--text-muted)] text-sm">加载失败，请稍后重试</p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </div>
  )
}