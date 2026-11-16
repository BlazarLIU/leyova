import React, { useTransition, Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Calendar,
  Users,
  Clock,
  Sparkles,
  Loader2,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/utils/cn'

// Lazy load the 4 schedule views
const CalendarView = lazy(() =>
  import('@/pages/anchors/LiveScheduleCalendarPage').then((m) => ({
    default: m.LiveScheduleCalendarPage,
  }))
)
const ManagementView = lazy(() =>
  import('@/pages/anchors/ScheduleManagementPage').then((m) => ({
    default: m.ScheduleManagementPage,
  }))
)
const MyScheduleView = lazy(() =>
  import('@/pages/anchors/MySchedulePage').then((m) => ({
    default: m.MySchedulePage,
  }))
)
const RecommendView = lazy(() =>
  import('@/pages/anchors/ScheduleRecommendPage').then((m) => ({
    default: m.ScheduleRecommendPage,
  }))
)

export type ScheduleView = 'calendar' | 'management' | 'my-schedule' | 'recommend'

interface ScheduleTabConfig {
  key: ScheduleView
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  description: string
}

const SCHEDULE_TABS: ScheduleTabConfig[] = [
  {
    key: 'calendar',
    label: '直播排班月历',
    shortLabel: '月历视图',
    icon: Calendar,
    description: '直播间场次全局排期、时间段分布与主播占位日历',
  },
  {
    key: 'management',
    label: '人员排班管理',
    shortLabel: '人员调度',
    icon: Users,
    description: '主播、助播、运营排班设置、班次模板与换班审批',
  },
  {
    key: 'my-schedule',
    label: '我的出勤排班',
    shortLabel: '我的排班',
    icon: Clock,
    description: '个人考勤班次、打卡记录、累计工时与请假换班申请',
  },
  {
    key: 'recommend',
    label: 'AI 智能排班推荐',
    shortLabel: '智能推荐',
    icon: Sparkles,
    badge: 'AI',
    description: '基于历史主播产销峰值与时段流量自动生成最优排班策略',
  },
]

export interface UnifiedScheduleHubProps {
  defaultView?: ScheduleView
}

export function UnifiedScheduleHub({ defaultView = 'calendar' }: UnifiedScheduleHubProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [, startTransition] = useTransition()

  const paramView = searchParams.get('view') as ScheduleView | null
  const activeTab: ScheduleView =
    paramView && SCHEDULE_TABS.some((t) => t.key === paramView)
      ? paramView
      : defaultView

  const handleSelectTab = (key: ScheduleView) => {
    startTransition(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('view', key)
          return next
        },
        { replace: true }
      )
    })
  }

  const currentTabConfig = SCHEDULE_TABS.find((t) => t.key === activeTab) || SCHEDULE_TABS[0]

  return (
    <div className="space-y-6">
      {/* ─── 1. Header & Tab Switcher ─── */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface/90 p-4 backdrop-blur shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-orbit-border/60">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orbit-primary/15 text-orbit-primary-light">
                <CalendarDays className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                直播排班调度中心
                <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-slate-400 font-normal border border-orbit-border">
                  全流程排班工作台
                </span>
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-400 pl-10.5">
              {currentTabConfig.description}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 self-end md:self-auto">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-orbit-surface2 border border-orbit-border">
              <Users className="w-3.5 h-3.5 text-orbit-primary-light" />
              主播 · 助播 · 运营 · 场控全角色调度
            </span>
          </div>
        </div>

        {/* ─── 2. Tab Navigation ─── */}
        <div className="mt-3 overflow-x-auto scrollbar-none py-1">
          <div className="flex items-center gap-1.5 min-w-max">
            {SCHEDULE_TABS.map((tab) => {
              const isActive = tab.key === activeTab
              const Icon = tab.icon

              return (
                <button
                  key={tab.key}
                  onClick={() => handleSelectTab(tab.key)}
                  className={cn(
                    'relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 select-none',
                    isActive
                      ? 'bg-orbit-primary text-white shadow-md shadow-orbit-primary/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-400')} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded font-normal',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-orbit-primary/10 text-orbit-primary-light border border-orbit-primary/20'
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── 3. Active Schedule Content ─── */}
      <div className="min-h-[500px]">
        <Suspense
          fallback={
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-orbit-primary-light" />
              <span className="text-xs">正在加载 {currentTabConfig.label}...</span>
            </div>
          }
        >
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'management' && <ManagementView />}
          {activeTab === 'my-schedule' && <MyScheduleView />}
          {activeTab === 'recommend' && <RecommendView />}
        </Suspense>
      </div>
    </div>
  )
}

export default UnifiedScheduleHub
