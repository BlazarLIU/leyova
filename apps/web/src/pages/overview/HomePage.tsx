import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, ShoppingCart, Radio, Users,
  LayoutDashboard, Activity, ClipboardPlus,
  Sparkles, CheckCircle2, AlertTriangle, RefreshCw, Clock,
  ArrowUpRight, ArrowRight, Inbox,
  type LucideIcon,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { api } from '@/services/api'
import type { StatCardData } from '@/types'

const defaultStats = (): StatCardData[] => [
  { id: 'today-gmv', label: '今日 GMV', value: '—', change: 0, changeLabel: '较昨日', icon: DollarSign, color: 'primary', sparkData: [] },
  { id: 'today-orders', label: '今日订单', value: '—', change: 0, changeLabel: '较昨日', icon: ShoppingCart, color: 'accent', sparkData: [] },
  { id: 'live-rooms', label: '直播中', value: '—', change: 0, changeLabel: '较昨日', icon: Radio, color: 'success', sparkData: [] },
  { id: 'online-users', label: '在线用户', value: '—', change: 0, changeLabel: '较昨日', icon: Users, color: 'warning', sparkData: [] },
]

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
}

const quickEntries = [
  { label: '经营驾驶舱', code: '01', icon: LayoutDashboard, href: '/overview/cockpit' },
  { label: '实时监控', code: '02', icon: Activity, href: '/overview/live-monitor' },
  { label: '直播登记', code: '03', icon: ClipboardPlus, href: '/live/registration' },
  { label: 'AI 助手', code: '04', icon: Sparkles, href: '/ai/chat', ai: true },
]

const activityTypeIcons: Record<string, LucideIcon> = {
  livestream_start: CheckCircle2,
  order_placed: RefreshCw,
  gmv_milestone: CheckCircle2,
  ad_launched: Clock,
  viewer_peak: AlertTriangle,
  default: CheckCircle2,
}

const activityTypeMap: Record<string, 'success' | 'info' | 'warning'> = {
  livestream_start: 'info',
  order_placed: 'success',
  gmv_milestone: 'success',
  ad_launched: 'info',
  viewer_peak: 'warning',
  default: 'info',
}

export function HomePage() {
  const [stats, setStats] = useState<StatCardData[]>(defaultStats())
  const [activities, setActivities] = useState<any[]>([])

  useEffect(() => {
    api.get<Record<string, any>>('/api/v1/overview/stats')
      .then(data => {
        if (!data) return
        setStats(prev => prev.map(s => {
          switch (s.id) {
            case 'today-gmv':
              return { ...s, value: `¥${((data.today_gmv ?? 0) / 10000).toFixed(1)}万`, change: data.growth_rate ?? 0 }
            case 'today-orders':
              return { ...s, value: (data.today_orders ?? 0).toLocaleString(), change: data.growth_rate ?? 0 }
            case 'live-rooms':
              return { ...s, value: `${data.active_livestreams ?? 0}个` }
            case 'online-users':
              return { ...s, value: (data.online_viewers ?? 0).toLocaleString(), change: -(data.growth_rate ?? 0) }
            default:
              return s
          }
        }))
      })
      .catch(() => {})

    api.get<Record<string, any>[]>('/api/v1/overview/activities')
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setActivities(data.map(a => ({
            id: String(a.id),
            text: a.title,
            time: a.time ?? '刚刚',
            type: activityTypeMap[a.type] ?? activityTypeMap.default,
            icon: activityTypeIcons[a.type] ?? activityTypeIcons.default,
          })))
        }
      })
      .catch(() => {})
  }, [])

  const today = new Date().toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  })

  const gmv = stats.find(s => s.id === 'today-gmv')
  const orders = stats.find(s => s.id === 'today-orders')

  return (
    <div className="max-w-[1600px] flex-1 space-y-4 overflow-y-auto p-4 lg:p-6">
      {/* ── 顶部：橙红 Hero + 右列经营/AI 卡 ─────────────────────────────── */}
      <motion.section {...fadeIn} className="grid gap-4 lg:grid-cols-[1.62fr_1fr]">
        {/* Orange Red Hero */}
        <div className="relative flex min-h-[248px] flex-col justify-between overflow-hidden rounded-[20px] bg-orbit-primary p-6 lg:p-8 brand-grain">
          <div className="pointer-events-none absolute inset-0 brand-grid opacity-[0.14]" />
          <div className="relative z-10">
            <p className="display-eyebrow text-white/60">{today}</p>
            <h1 className="mt-4 text-[36px] font-extrabold leading-[0.98] tracking-[-0.045em] text-white sm:text-[44px]">
              今日经营
              <br />
              全景
            </h1>
            <p className="mt-4 max-w-sm text-[12.5px] leading-relaxed text-white/70">
              经营数据、场次复盘与 AI 洞察已就绪，以下指标取自当前店铺的一致口径。
            </p>
          </div>

          {/* 荧光绿大箭头 —— 跳转经营驾驶舱 */}
          <a
            href="/overview/cockpit"
            aria-label="进入经营驾驶舱"
            className="absolute bottom-4 right-4 z-10 flex h-[86px] w-[86px] items-center justify-center rounded-full bg-orbit-accent text-orbit-ink transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.03] lg:bottom-6 lg:right-6 lg:h-[104px] lg:w-[104px]"
          >
            <ArrowUpRight className="h-11 w-11 lg:h-[52px] lg:w-[52px]" strokeWidth={2.4} />
          </a>
        </div>

        {/* 右列：经营卡 + AI 洞察卡 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-[1fr_auto]">
          <div className="flex flex-col justify-between rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                今日 GMV
              </p>
              <span className="rounded-[6px] bg-orbit-primary/10 px-1.5 py-0.5 text-[10.5px] font-bold text-orbit-primary dark:text-orbit-primary-light">
                {gmv && gmv.change !== 0 ? `${gmv.change > 0 ? '+' : ''}${gmv.change}%` : '—'}
              </span>
            </div>
            <p className="metric-num mt-3 text-[32px] leading-none text-[var(--text-primary)]">
              {gmv?.value ?? '—'}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
              <span className="text-[11.5px] text-[var(--text-muted)]">今日订单</span>
              <span className="metric-num text-[13px] text-[var(--text-primary)]">{orders?.value ?? '—'}</span>
            </div>
          </div>

          <a
            href="/ai-ops/cockpit"
            className="group flex flex-col justify-between rounded-[20px] bg-orbit-accent p-5 transition-colors hover:bg-orbit-accent-light"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-orbit-ink/70">
                <Sparkles className="h-3.5 w-3.5" />
                AI 洞察
              </span>
              <ArrowUpRight className="h-4 w-4 text-orbit-ink/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <div className="mt-4">
              <p className="text-[17px] font-extrabold leading-tight tracking-[-0.03em] text-orbit-ink">
                进入 AI 作战台
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-orbit-ink/60">
                待拍板决策 · 场次诊断 · 受控执行
              </p>
            </div>
          </a>
        </div>
      </motion.section>

      {/* ── 黑色 AI 状态条 ──────────────────────────────────────────────── */}
      <motion.div
        {...fadeIn}
        className="flex flex-col gap-3 rounded-[16px] bg-orbit-ink px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orbit-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orbit-accent" />
          </span>
          <p className="text-[12.5px] text-white/80">
            <span className="font-semibold text-white">AI 运营系统在线</span>
            <span className="mx-2 text-white/25">|</span>
            经营诊断与受控执行通道已就绪
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/ai-ops/cockpit"
            className="inline-flex items-center gap-1.5 rounded-full bg-orbit-accent px-3.5 py-1.5 text-[11.5px] font-bold text-orbit-ink transition-colors hover:bg-orbit-accent-light"
          >
            今日作战单
            <ArrowRight className="h-3 w-3" />
          </a>
          <a
            href="/ai/chat"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[11.5px] font-semibold text-white/75 transition-colors hover:border-white/35 hover:text-white"
          >
            AI 助手
          </a>
        </div>
      </motion.div>

      {/* ── KPI grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.id} data={stat} index={i} />
        ))}
      </div>

      {/* ── Quick entries + activity feed ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="xl:col-span-2"
        >
          <Card>
            <CardHeader title="快捷入口" subtitle="快速访问核心作战模块" />
            <CardBody>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {quickEntries.map((entry) => {
                  const Icon = entry.icon
                  return (
                    <a
                      key={entry.label}
                      href={entry.href}
                      className="group relative flex flex-col justify-between gap-6 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-orbit-ink/25 dark:hover:border-white/25"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={
                            entry.ai
                              ? 'flex h-8 w-8 items-center justify-center rounded-[9px] bg-orbit-accent text-orbit-ink'
                              : 'flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--surface3)] text-[var(--text-primary)] transition-colors group-hover:bg-orbit-primary group-hover:text-white'
                          }
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="metric-num text-[10px] text-[var(--text-subtle)]">{entry.code}</span>
                      </div>
                      <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">{entry.label}</span>
                    </a>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <Card className="h-full">
            <CardHeader title="最新动态" subtitle="系统实时业务流" />
            <CardBody>
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-9 text-center">
                  <Inbox className="h-6 w-6 text-[var(--text-subtle)]" />
                  <p className="mt-2.5 text-[12px] text-[var(--text-muted)]">暂无动态</p>
                  <p className="mt-0.5 text-[10.5px] text-[var(--text-subtle)]">产生业务操作后将在此展示</p>
                </div>
              ) : (
                <div>
                  {activities.map((item, i) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 py-3 ${i < activities.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
                      >
                        <div
                          className={[
                            'mt-0.5 flex-shrink-0 rounded-[7px] p-1.5',
                            item.type === 'success' ? 'bg-orbit-success/10 text-orbit-success' : '',
                            item.type === 'info' ? 'bg-orbit-primary/10 text-orbit-primary' : '',
                            item.type === 'warning' ? 'bg-orbit-warning/12 text-orbit-warning' : '',
                          ].join(' ')}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{item.text}</p>
                          <p className="mt-0.5 text-[10.5px] text-[var(--text-subtle)]">{item.time}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
