import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, Eye, TrendingUp, Clock, Edit, Mail, Phone, Calendar,
  Users, Target, BarChart3, Brain, MessageSquare, ShoppingCart,
  UserCheck, Star, ChevronDown,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { StatCard } from '@/components/ui/StatCard'
import { cn } from '@/utils/cn'
import { CHART_SERIES, CHART_GRID, CHART_AXIS } from '@/constants/chartPalette'
import { api } from '@/services/api'
import type { StatCardData } from '@/types'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface AnchorProfile {
  id: string
  name: string
  initials: string
  level: string
  followers: number
  joinDate: string
  email: string
  phone: string
  tags: string[]
}

interface CapabilityScores {
  expression: number
  interaction: number
  conversion: number
  professionalism: number
  overall: number
}

interface CapabilityHistoryItem {
  date: string
  expression: number
  interaction: number
  conversion: number
  professionalism: number
  overall: number
}

const templateStats = (): StatCardData[] => [
  { id: 'avg-gmv', label: '场均GMV', value: '—', change: 0, changeLabel: '较上月', icon: DollarSign, color: 'primary', sparkData: [] },
  { id: 'avg-viewers', label: '场均观看', value: '—', change: 0, changeLabel: '较上月', icon: Eye, color: 'accent', sparkData: [] },
  { id: 'conversion', label: '转化率', value: '—', change: 0, changeLabel: '较上月', icon: TrendingUp, color: 'success', sparkData: [] },
  { id: 'avg-duration', label: '场均时长', value: '—', change: 0, changeLabel: '较上月', icon: Clock, color: 'warning', sparkData: [] },
]

interface MonthlyPerformance {
  month: string
  sessionCount: number
  totalDurationMin: number        // 开播时长（分钟）
  totalGmv: number                // 直播间用户支付金额
  avgGmvPerHour: number           // 单小时用户支付金额
  maxOnlinePeak: number           // 最高在线人数
  avgAvgOnline: number            // 平均在线人数
  avgAvgItemPrice: number         // 平均件单价
  avgExposureViewRate: number     // 曝光-观看率
  avgRetentionRate: number        // 留存率
  avgInteractionRate: number      // 观看-互动率
  totalNewFans: number            // 新增粉丝数
  avgViewFollowRate: number       // 观看-关注率
  totalNewGroupMembers: number    // 新加团人数
  avgUvValue: number              // 单UV价值(元)
}

interface SessionRecord {
  id: string
  date: string
  durationMin: number              // 开播时长（分钟）
  gmv: number                      // 直播间用户支付金额
  gmvPerHour: number               // 单小时用户支付金额
  onlinePeak: number               // 最高在线人数
  avgOnline: number                // 平均在线人数
  avgItemPrice: number             // 平均件单价
  exposureViewRate: number         // 曝光-观看率
  retentionRate: number            // 留存率
  interactionRate: number          // 观看-互动率
  newFans: number                  // 新增粉丝数
  viewFollowRate: number           // 观看-关注率
  newGroupMembers: number          // 新加团人数
  uvValue: number                  // 单UV价值(元)
}

// ── 对比周期 ──
const COMPARISON_LABELS = {
  vsLastSession: '较上场',
  vsLastWeek: '较上周',
  vsLastMonth: '较上月',
} as const

type ComparisonDimension = keyof typeof COMPARISON_LABELS

// ── 能力维度配置 ──
const CAP_DIMENSIONS = [
  { key: 'expression' as const, label: '引流能力', icon: Users, desc: '封面/标题/内容吸引力' },
  { key: 'interaction' as const, label: '互动能力', icon: MessageSquare, desc: '话术引导/互动水平' },
  { key: 'conversion' as const, label: '转化能力', icon: ShoppingCart, desc: '流量→GMV效率' },
  { key: 'professionalism' as const, label: '专业度', icon: UserCheck, desc: '产品知识/专业表现' },
  { key: 'overall' as const, label: '综合评分', icon: Star, desc: '整体能力评估' },
] as const

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-status-success'
  if (score >= 65) return 'text-status-warning'
  return 'text-status-danger'
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-orbit-success/20'
  if (score >= 65) return 'bg-orbit-warning/20'
  return 'bg-orbit-danger/20'
}

function getScoreBar(score: number): string {
  if (score >= 80) return 'bg-orbit-success'
  if (score >= 65) return 'bg-orbit-warning'
  return 'bg-orbit-danger'
}

function getWeaknessLabel(scores: CapabilityScores): string {
  const map = [
    { key: 'expression' as const, label: '引流' },
    { key: 'interaction' as const, label: '互动' },
    { key: 'conversion' as const, label: '转化' },
    { key: 'professionalism' as const, label: '专业度' },
  ]
  const minKey = map.reduce((a, b) => (scores[a.key] <= scores[b.key] ? a : b))
  return minKey.label
}

export function AnchorProfilePage() {
  const [anchorProfile, setAnchorProfile] = useState<AnchorProfile | null>(null)
  const [performanceStats, setPerformanceStats] = useState<StatCardData[]>(templateStats())
  const [monthlyPerformance, setMonthlyPerformance] = useState<MonthlyPerformance[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [capabilities, setCapabilities] = useState<CapabilityScores | null>(null)
  const [capabilityHistory, setCapabilityHistory] = useState<CapabilityHistoryItem[]>([])
  const [currentAnchorId, setCurrentAnchorId] = useState<string>(
    new URLSearchParams(window.location.search).get('id') || ''
  )
  const [anchorList, setAnchorList] = useState<{ id: number; name: string }[]>([])
  const [comparisonDimension, setComparisonDimension] = useState<ComparisonDimension>('vsLastSession')
  const [rawPerfData, setRawPerfData] = useState<any>(null)

  // 加载主播列表；URL 无 id 参数时默认选中第一个现存主播
  useEffect(() => {
    api.get<any>('/api/anchors/list')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data ?? [])
        setAnchorList(list.map((a: any) => ({ id: a.id, name: a.name })))
        if (!new URLSearchParams(window.location.search).get('id')) {
          setCurrentAnchorId(prev => prev || String(list[0]?.id ?? ''))
        }
      })
      .catch(() => { /* 静默失败 */ })
  }, [])

  // 切换主播
  const switchAnchor = (id: string) => {
    setCurrentAnchorId(id)
    window.history.pushState(null, '', `?id=${id}`)
    // 重置数据
    setAnchorProfile(null)
    setPerformanceStats(templateStats())
    setMonthlyPerformance([])
    setSessions([])
    setCapabilities(null)
    setCapabilityHistory([])
  }

  // 加载主播数据
  useEffect(() => {
    if (!currentAnchorId) return
    api.get<any>(`/api/anchors/${currentAnchorId}`)
      .then((res) => {
        const data = res?.data ?? res ?? {}
        if (data && data.name) {
          setAnchorProfile({
            id: String(data.id ?? data.anchor_id ?? '1'),
            name: data.name,
            initials: data.initials ?? data.name?.slice(0, 2) ?? 'LJ',
            level: data.level ?? '',
            followers: data.followers ?? 0,
            joinDate: data.joinDate ?? data.join_date ?? '',
            email: data.email ?? '',
            phone: data.phone ?? '',
            tags: data.tags ?? [],
          })
        }
      })
      .catch(() => { /* 保持默认数据 */ })

    api.get<any>(`/api/anchors/${currentAnchorId}/performance`)
      .then((res) => {
        const perf = res?.data ?? res ?? {}

        if (perf.stats && perf.stats.length > 0) {
          setPerformanceStats(templateStats().map((stat, i) => {
            const apiStat = perf.stats[i]
            return apiStat ? { ...stat, ...apiStat } : stat
          }))
        }

        if (perf.monthlyData && perf.monthlyData.length > 0) {
          setMonthlyPerformance(perf.monthlyData.map((item: any) => ({
            month: item.month,
            sessionCount: item.sessionCount ?? 0,
            totalDurationMin: item.totalDurationMin ?? 0,
            totalGmv: item.totalGmv ?? 0,
            avgGmvPerHour: item.avgGmvPerHour ?? 0,
            maxOnlinePeak: item.maxOnlinePeak ?? 0,
            avgAvgOnline: item.avgAvgOnline ?? 0,
            avgAvgItemPrice: item.avgAvgItemPrice ?? 0,
            avgExposureViewRate: item.avgExposureViewRate ?? 0,
            avgRetentionRate: item.avgRetentionRate ?? 0,
            avgInteractionRate: item.avgInteractionRate ?? 0,
            totalNewFans: item.totalNewFans ?? 0,
            avgViewFollowRate: item.avgViewFollowRate ?? 0,
            totalNewGroupMembers: item.totalNewGroupMembers ?? 0,
            avgUvValue: item.avgUvValue ?? 0,
          })))
        }

        if (perf.recentSessions && perf.recentSessions.length > 0) {
          setSessions(perf.recentSessions.map((item: any) => ({
            id: item.id ?? '',
            date: item.date ?? '',
            durationMin: item.durationMin ?? 0,
            gmv: item.gmv ?? 0,
            gmvPerHour: item.gmvPerHour ?? 0,
            onlinePeak: item.onlinePeak ?? 0,
            avgOnline: item.avgOnline ?? 0,
            avgItemPrice: item.avgItemPrice ?? 0,
            exposureViewRate: item.exposureViewRate ?? 0,
            retentionRate: item.retentionRate ?? 0,
            interactionRate: item.interactionRate ?? 0,
            newFans: item.newFans ?? 0,
            viewFollowRate: item.viewFollowRate ?? 0,
            newGroupMembers: item.newGroupMembers ?? 0,
            uvValue: item.uvValue ?? 0,
          })))
        }

        // 能力评分
        if (perf.capabilities) {
          setCapabilities(perf.capabilities)
        }
        if (perf.capabilityHistory && perf.capabilityHistory.length > 0) {
          setCapabilityHistory(perf.capabilityHistory)
        }

        // 保存原始数据用于对比周期切换
        setRawPerfData(perf)
      })
      .catch(() => { /* 保持默认数据 */ })
  }, [currentAnchorId])

  // 对比周期切换时重新计算 stat 变化
  useEffect(() => {
    if (!rawPerfData?.comparisons) {
      setPerformanceStats(prev => prev.map(s => ({ ...s, changeLabel: COMPARISON_LABELS[comparisonDimension] })))
      return
    }
    setPerformanceStats(prev => prev.map(stat => {
      const change = rawPerfData.comparisons[comparisonDimension]?.[stat.id] ?? 0
      return { ...stat, change, changeLabel: COMPARISON_LABELS[comparisonDimension] }
    }))
  }, [rawPerfData, comparisonDimension])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{anchorProfile?.name || '主播档案'}</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">主播详细档案与能力评估</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 主播切换下拉 */}
            <div className="relative">
              <select
                value={currentAnchorId}
                onChange={(e) => switchAnchor(e.target.value)}
                className="appearance-none bg-orbit-surface2 border border-orbit-border text-[var(--text-secondary)] text-sm rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-orbit-primary/50 cursor-pointer hover:border-orbit-border-light transition-colors"
              >
                {anchorList.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <Button icon={<Edit className="w-4 h-4" />} size="sm">
              编辑资料
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Anchor info card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardBody>
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <Avatar initials={anchorProfile?.initials || '--'} size="2xl" className="ring-2 ring-orbit-primary/30" />
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{anchorProfile?.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-orbit-primary-light bg-orbit-primary/10 px-2 py-0.5 rounded-full">
                      {anchorProfile?.level}
                    </span>
                    {anchorProfile?.tags.map((tag) => (
                      <span key={tag} className="text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-0.5 rounded-full border border-orbit-border">
                        {tag}
                      </span>
                    ))}
                    {capabilities && (
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        getScoreBg(capabilities.overall)
                      )}>
                        短板: {getWeaknessLabel(capabilities)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orbit-primary/15">
                      <Users className="w-4 h-4 text-orbit-primary-light" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">粉丝数</p>
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">{((anchorProfile?.followers || 0) / 10000).toFixed(0)}万</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orbit-accent/15">
                      <Calendar className="w-4 h-4 text-orbit-accent-light" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">加入时间</p>
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">{anchorProfile?.joinDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orbit-success/15">
                      <Mail className="w-4 h-4 text-status-success" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">邮箱</p>
                      <p className="text-sm font-semibold text-[var(--text-secondary)] truncate">{anchorProfile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orbit-warning/15">
                      <Phone className="w-4 h-4 text-status-warning" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">联系方式</p>
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">{anchorProfile?.phone}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* 对比周期切换 */}
      <motion.div {...fadeIn}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">对比周期:</span>
          <div className="flex rounded-lg border border-orbit-border overflow-hidden">
            {(Object.entries(COMPARISON_LABELS) as [ComparisonDimension, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setComparisonDimension(key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  comparisonDimension === key
                    ? 'bg-orbit-primary text-white'
                    : 'bg-orbit-surface2 text-[var(--text-muted)] hover:bg-orbit-surface2/80'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* StatCards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {performanceStats.map((stat, i) => (
          <StatCard key={stat.id} data={stat} index={i} />
        ))}
      </motion.div>

      {/* 五项能力评分 */}
      {capabilities && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card>
            <CardHeader
              title="五项能力评分"
              subtitle="最新评估周期能力表现"
              actions={
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                  <Brain className="w-3.5 h-3.5" />
                  <span>能力模型</span>
                </div>
              }
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {CAP_DIMENSIONS.map((dim) => {
                  const score = capabilities[dim.key]
                  return (
                    <div key={dim.key} className="flex flex-col items-center text-center p-4 rounded-xl bg-orbit-surface2/50 border border-orbit-border">
                      <div className={cn('p-3 rounded-full mb-3', getScoreBg(score))}>
                        <dim.icon className={cn('w-5 h-5', getScoreColor(score))} />
                      </div>
                      <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{dim.label}</p>
                      <p className={cn('text-3xl font-bold mb-2', getScoreColor(score))}>{score}</p>
                      {/* 进度条 */}
                      <div className="w-full h-1.5 bg-[var(--surface3)] rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', getScoreBar(score))}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2">{dim.desc}</p>
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* 能力趋势图 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader
            title="能力趋势"
            subtitle="近3个月能力变化趋势"
            actions={
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>趋势</span>
              </div>
            }
          />
          <CardBody>
            {capabilityHistory.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={capabilityHistory} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="date" tick={{ fill: CHART_AXIS, fontSize: 12 }} stroke={CHART_AXIS} />
                    <YAxis domain={[0, 100]} tick={{ fill: CHART_AXIS, fontSize: 12 }} stroke={CHART_AXIS} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', color: 'var(--text-muted)' }}
                    />
                    <Line type="monotone" dataKey="expression" name="引流能力" stroke={CHART_SERIES[0]} strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="interaction" name="互动能力" stroke={CHART_SERIES[1]} strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="conversion" name="转化能力" stroke={CHART_SERIES[3]} strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="professionalism" name="专业度" stroke={CHART_SERIES[2]} strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="overall" name="综合评分" stroke={CHART_SERIES[4]} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
                暂无能力评估数据，请上传主播分析数据后查看
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Monthly performance table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        <Card>
          <CardHeader
            title="月度业绩"
            subtitle="自然月实时汇总（以上传数据为依据）"
            actions={
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>业绩概览</span>
              </div>
            }
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">月份</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">开播时长</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">直播间用户支付金额</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">单小时用户支付金额</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">最高在线人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">平均在线人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">平均件单价</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">引流能力<br/>曝光-观看率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">留人能力<br/>留存率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">互动能力<br/>观看-互动率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">新增粉丝数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">观看-关注率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">新加团人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">单UV价值(元)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyPerformance.map((row) => (
                    <tr
                      key={row.month}
                      className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] font-medium whitespace-nowrap">{row.month}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(row.totalDurationMin / 60).toFixed(1)}h</td>
                      <td className="px-5 py-3.5 text-right text-status-success font-medium tabular-nums">¥{row.totalGmv.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">¥{row.avgGmvPerHour.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{row.maxOnlinePeak.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{row.avgAvgOnline.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">¥{row.avgAvgItemPrice.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(row.avgExposureViewRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(row.avgRetentionRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(row.avgInteractionRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right text-status-info tabular-nums">{row.totalNewFans.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(row.avgViewFollowRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right text-status-info tabular-nums">{row.totalNewGroupMembers.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-status-warning font-medium tabular-nums">¥{row.avgUvValue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Recent sessions table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card>
          <CardHeader
            title="近期场次"
            subtitle="最近场次明细（以上传数据为依据）"
            actions={
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                <Target className="w-3.5 h-3.5" />
                <span>场次回顾</span>
              </div>
            }
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">日期</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">开播时长</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">直播间用户支付金额</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">单小时用户支付金额</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">最高在线人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">平均在线人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">平均件单价</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">引流能力<br/>曝光-观看率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">留人能力<br/>留存率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">互动能力<br/>观看-互动率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">新增粉丝数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">观看-关注率</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">新加团人数</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3 whitespace-nowrap">单UV价值(元)</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <td className="px-5 py-3.5 text-[var(--text-muted)] whitespace-nowrap">{session.date}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(session.durationMin / 60).toFixed(1)}h</td>
                      <td className="px-5 py-3.5 text-right text-status-success font-medium tabular-nums">¥{session.gmv.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">¥{session.gmvPerHour.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{session.onlinePeak.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{session.avgOnline.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">¥{session.avgItemPrice.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(session.exposureViewRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(session.retentionRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(session.interactionRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right text-status-info tabular-nums">{session.newFans.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--text-secondary)] tabular-nums">{(session.viewFollowRate * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right text-status-info tabular-nums">{session.newGroupMembers.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right text-status-warning font-medium tabular-nums">¥{session.uvValue.toFixed(2)}</td>
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