import React, { useTransition, Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  LineChart,
  Globe,
  Target,
  Tv,
  Video,
  Layers,
  Store,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/utils/cn'

// Lazy load the 8 views to keep code splitting optimal
const CockpitView = lazy(() =>
  import('@/pages/overview/CockpitPage').then((m) => ({ default: m.CockpitPage }))
)
const BiDashboardView = lazy(() =>
  import('@/pages/bi/BiDashboardPage').then((m) => ({ default: m.BiDashboardPage }))
)
const OmniDashboardView = lazy(() =>
  import('@/pages/omnichannel/OmniDashboardPage').then((m) => ({ default: m.OmniDashboardPage }))
)
const NetRoiView = lazy(() =>
  import('@/pages/ops/net-roi/NetRoiPage').then((m) => ({ default: m.NetRoiPage }))
)
const ReviewOverviewView = lazy(() =>
  import('@/pages/review/ReviewOverviewPage').then((m) => ({ default: m.ReviewOverviewPage }))
)
const ShortVideoTrafficView = lazy(() =>
  import('@/pages/review/ShortVideoTrafficPage').then((m) => ({ default: m.ShortVideoTrafficPage }))
)
const ChannelAnalysisView = lazy(() =>
  import('@/pages/review/ChannelAnalysisPage').then((m) => ({ default: m.ChannelAnalysisPage }))
)
const ShopOverviewView = lazy(() =>
  import('@/pages/shop/ShopOverviewPage').then((m) => ({ default: m.ShopOverviewPage }))
)

export type DashboardView =
  | 'cockpit'
  | 'bi'
  | 'omnichannel'
  | 'roi'
  | 'review'
  | 'traffic'
  | 'channels'
  | 'shop'

interface TabConfig {
  key: DashboardView
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  description: string
}

const DASHBOARD_TABS: TabConfig[] = [
  {
    key: 'cockpit',
    label: '经营驾驶舱',
    shortLabel: '驾驶舱',
    icon: BarChart3,
    badge: '实时',
    description: '核心交易总览、大盘走势与主播实时排位',
  },
  {
    key: 'bi',
    label: 'BI 仪表盘',
    shortLabel: 'BI 看板',
    icon: LineChart,
    description: '跨平台商业智能多维指标对比与下钻',
  },
  {
    key: 'omnichannel',
    label: '全渠道大盘',
    shortLabel: '全渠道',
    icon: Globe,
    description: '抖音/快手/淘宝/天猫/视频号/小红书全域大盘对账',
  },
  {
    key: 'roi',
    label: '全域投放与净ROI',
    shortLabel: 'Net-ROI',
    icon: Target,
    badge: '净利润',
    description: 'T+7 剔退净销售额、千川/磁力/万相台投流净ROI结算',
  },
  {
    key: 'review',
    label: '场次复盘',
    shortLabel: '场次复盘',
    icon: Tv,
    description: '单场直播大盘 KPI、五维漏斗、高光切片与异动归因',
  },
  {
    key: 'traffic',
    label: '短视频流量',
    shortLabel: '短视频',
    icon: Video,
    description: '挂车短视频投产、看播引流与公域引流转化',
  },
  {
    key: 'channels',
    label: '渠道拆分',
    shortLabel: '渠道分析',
    icon: Layers,
    description: '公域推荐/关注/搜索/付费流量矩阵价值象限',
  },
  {
    key: 'shop',
    label: '店铺矩阵',
    shortLabel: '店铺大盘',
    icon: Store,
    description: '全域自营/分销店铺矩阵交易与履约体检',
  },
]

export interface UnifiedDashboardHubProps {
  defaultView?: DashboardView
}

export function UnifiedDashboardHub({ defaultView = 'cockpit' }: UnifiedDashboardHubProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [, startTransition] = useTransition()

  // Determine active tab from URL param or defaultView
  const paramView = searchParams.get('view') as DashboardView | null
  const activeTab: DashboardView =
    paramView && DASHBOARD_TABS.some((t) => t.key === paramView)
      ? paramView
      : defaultView

  const handleSelectTab = (key: DashboardView) => {
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

  const currentTabConfig = DASHBOARD_TABS.find((t) => t.key === activeTab) || DASHBOARD_TABS[0]

  return (
    <div className="space-y-6">
      {/* ─── 1. Unified Hub Header & View Switcher ─── */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface/90 p-4 backdrop-blur shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-orbit-border/60">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orbit-primary/15 text-orbit-primary-light">
                <currentTabConfig.icon className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                全域经营分析看板
                <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-[var(--text-muted)] font-normal border border-orbit-border">
                  8 视图综合工作台
                </span>
              </h1>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)] pl-10.5">
              {currentTabConfig.description}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] self-end md:self-auto">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-orbit-surface2 border border-orbit-border">
              <Sparkles className="w-3.5 h-3.5 text-orbit-accent-light" />
              已启用聚合汇总层（agg_*）秒级响应
            </span>
          </div>
        </div>

        {/* ─── 2. Scrollable 8-Tab Switcher ─── */}
        <div className="mt-3 overflow-x-auto scrollbar-none py-1">
          <div className="flex items-center gap-1.5 min-w-max">
            {DASHBOARD_TABS.map((tab) => {
              const isActive = tab.key === activeTab
              const Icon = tab.icon

              return (
                <button
                  key={tab.key}
                  onClick={() => handleSelectTab(tab.key)}
                  className={cn(
                    'relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 select-none',
                    isActive
                      ? 'bg-orbit-primary text-white shadow-md shadow-orbit-primary/20'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-[var(--text-muted)]')} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded font-normal',
                        isActive
                          ? 'bg-[var(--hover-bg3)]0 text-white'
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

      {/* ─── 3. Active View Container ─── */}
      <div className="min-h-[500px]">
        <Suspense
          fallback={
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="w-8 h-8 animate-spin text-orbit-primary-light" />
              <span className="text-xs">正在渲染 {currentTabConfig.label}...</span>
            </div>
          }
        >
          {activeTab === 'cockpit' && <CockpitView />}
          {activeTab === 'bi' && <BiDashboardView />}
          {activeTab === 'omnichannel' && <OmniDashboardView />}
          {activeTab === 'roi' && <NetRoiView />}
          {activeTab === 'review' && <ReviewOverviewView />}
          {activeTab === 'traffic' && <ShortVideoTrafficView />}
          {activeTab === 'channels' && <ChannelAnalysisView />}
          {activeTab === 'shop' && <ShopOverviewView />}
        </Suspense>
      </div>
    </div>
  )
}

export default UnifiedDashboardHub
