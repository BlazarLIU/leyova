import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, ShoppingCart, Radio, Users,
  LayoutDashboard, Activity, ClipboardPlus,
  Sparkles, CheckCircle2, AlertTriangle, RefreshCw, Clock,
  type LucideIcon,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
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
  transition: { duration: 0.4 },
}



const quickEntries = [
  { label: '经营驾驶舱', icon: LayoutDashboard, href: '/overview/cockpit', color: 'from-violet-500/20 to-violet-600/10', border: 'border-violet-500/30', textColor: 'text-violet-300' },
  { label: '实时监控', icon: Activity, href: '/overview/live-monitor', color: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/30', textColor: 'text-cyan-300' },
  { label: '直播登记', icon: ClipboardPlus, href: '/live/registration', color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', textColor: 'text-emerald-300' },
  { label: 'AI 分析助手', icon: Sparkles, href: '/ai/chat', color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30', textColor: 'text-purple-300' },
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

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">欢迎回来，系统管理员</h1>
            <p className="text-slate-500 text-sm mt-1">leyova 电商运营管理中心</p>
          </div>
          <Badge variant="accent" dot>
            系统运行正常
          </Badge>
        </div>
      </motion.div>

      {/* StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.id} data={stat} index={i} />
        ))}
      </div>

      {/* Quick entries + Activity feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick entries */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="xl:col-span-2"
        >
          <Card>
            <CardHeader title="快捷入口" subtitle="快速访问核心功能模块" />
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {quickEntries.map((entry) => {
                  const Icon = entry.icon
                  return (
                    <a
                      key={entry.label}
                      href={entry.href}
                      className={`
                        flex flex-col items-center justify-center gap-2 p-4 rounded-xl border ${entry.border}
                        bg-gradient-to-br ${entry.color} hover:brightness-125 transition-all duration-200
                        group cursor-pointer
                      `}
                    >
                      <div className={`p-2.5 rounded-lg bg-white/5 ${entry.textColor} group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-slate-300 group-hover:text-slate-200 text-center">
                        {entry.label}
                      </span>
                    </a>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Activity feed */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <Card>
            <CardHeader title="最新动态" subtitle="系统实时动态更新" />
            <CardBody>
              <div className="space-y-0">
                {activities.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.id}
                      className={`
                        flex items-start gap-3 py-3
                        ${i < activities.length - 1 ? 'border-b border-orbit-border' : ''}
                      `}
                    >
                      <div className={`
                        p-1.5 rounded-lg flex-shrink-0 mt-0.5
                        ${item.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                        ${item.type === 'info' ? 'bg-blue-500/10 text-blue-400' : ''}
                        ${item.type === 'warning' ? 'bg-amber-500/10 text-amber-400' : ''}
                      `}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-300 leading-relaxed">{item.text}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}