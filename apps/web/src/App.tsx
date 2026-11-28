import { Suspense, lazy, type ComponentType } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RequireAccess } from '@/components/auth/RequireAccess'
import { RequireAiOpsAccess } from '@/components/auth/RequireAiOpsAccess'
import { RequireInitialized } from '@/components/setup/RequireInitialized'
import { SetupPage } from '@/pages/setup/SetupPage'
import { useAuth, getDefaultHomePath } from '@/hooks/useAuth'
import { ROLE_CODES } from '@/constants/roles'
import { SignInPage } from '@/pages/auth/SignInPage'
import { NotFoundPage } from '@/pages/system/NotFoundPage'
import { CLASSIC_ROUTES } from '@/routes/classic-routes'

function lazyPage<M extends Record<string, any>, K extends keyof M>(
  loader: () => Promise<M>,
  exportName: K,
) {
  return lazy(() =>
    loader().then((mod) => ({ default: mod[exportName] as ComponentType<any> })),
  )
}

// 角色工作台（W2.5）
const WorkbenchPage = lazyPage(() => import('@/pages/workbench/WorkbenchPage'), 'WorkbenchPage')

// AI 运营系统 (AI-Native 独立分支)
const AiOpsCockpitPage = lazyPage(() => import('@/pages/ai-ops/AiOpsCockpitPage'), 'AiOpsCockpitPage')
const AiOpsWorkbenchPage = lazyPage(() => import('@/pages/ai-ops/AiOpsWorkbenchPage'), 'AiOpsWorkbenchPage')
const AiOpsChatPage = lazyPage(() => import('@/pages/ai-ops/AiOpsChatPage'), 'AiOpsChatPage')
const AiOpsRunDetailPage = lazyPage(() => import('@/pages/ai-ops/AiOpsRunDetailPage'), 'AiOpsRunDetailPage')
const AiOpsInboxPage = lazyPage(() => import('@/pages/ai-ops/AiOpsInboxPage'), 'AiOpsInboxPage')
const AiOpsAlertsPage = lazyPage(() => import('@/pages/ai-ops/AiOpsAlertsPage'), 'AiOpsAlertsPage')
const AiOpsPlanningPage = lazyPage(() => import('@/pages/ai-ops/AiOpsPlanningPage'), 'AiOpsPlanningPage')
const AiOpsPrompterPage = lazyPage(() => import('@/pages/ai-ops/AiOpsPrompterPage'), 'AiOpsPrompterPage')
const AiOpsLiveWatchPage = lazyPage(() => import('@/pages/ai-ops/AiOpsLiveWatchPage'), 'AiOpsLiveWatchPage')
const AiOpsReviewPage = lazyPage(() => import('@/pages/ai-ops/AiOpsReviewPage'), 'AiOpsReviewPage')
const AiOpsActionItemsPage = lazyPage(() => import('@/pages/ai-ops/AiOpsActionItemsPage'), 'AiOpsActionItemsPage')
const AiOpsSelectionPage = lazyPage(() => import('@/pages/ai-ops/AiOpsSelectionPage'), 'AiOpsSelectionPage')
const AiOpsAssortmentStructurePage = lazyPage(() => import('@/pages/ai-ops/AiOpsAssortmentStructurePage'), 'AiOpsAssortmentStructurePage')
const AiOpsPricesPage = lazyPage(() => import('@/pages/ai-ops/AiOpsPricesPage'), 'AiOpsPricesPage')
const AiOpsCampaignsPage = lazyPage(() => import('@/pages/ai-ops/AiOpsCampaignsPage'), 'AiOpsCampaignsPage')
const AiOpsFinancePnlPage = lazyPage(() => import('@/pages/ai-ops/AiOpsFinancePnlPage'), 'AiOpsFinancePnlPage')
const AiOpsPeoplePage = lazyPage(() => import('@/pages/ai-ops/AiOpsPeoplePage'), 'AiOpsPeoplePage')
const AiOpsScheduleRecommendPage = lazyPage(() => import('@/pages/ai-ops/AiOpsScheduleRecommendPage'), 'AiOpsScheduleRecommendPage')
const AiOpsMetricsPage = lazyPage(() => import('@/pages/ai-ops/AiOpsMetricsPage'), 'AiOpsMetricsPage')
const AiOpsCasesPage = lazyPage(() => import('@/pages/ai-ops/AiOpsCasesPage'), 'AiOpsCasesPage')
const AiOpsKnowledgePage = lazyPage(() => import('@/pages/ai-ops/AiOpsKnowledgePage'), 'AiOpsKnowledgePage')

// 品牌门户
const BrandPortalPage = lazyPage(() => import('@/pages/brand-portal/BrandPortalPage'), 'BrandPortalPage')

// 系统与风控合规
const ChangeDetailPage = lazyPage(() => import('@/pages/compliance/ChangeDetailPage'), 'ChangeDetailPage')

function HomeLandingRedirect() {
  const { user, allowedModules, loading } = useAuth()
  if (loading || !user) return null
  return <Navigate to={getDefaultHomePath(user, allowedModules)} replace />
}

const PageLoaderFallback = (
  <div className="flex min-h-[45vh] items-center justify-center text-sm text-muted-foreground">
    正在加载页面模块...
  </div>
)

export default function App() {
  return (
    <Suspense fallback={PageLoaderFallback}>
      <Routes>
        {/* 首次部署初始化 — 独立页面，不经过登录与侧边栏 */}
        <Route path="/setup" element={<SetupPage />} />

        {/* Auth routes — no sidebar layout */}
        <Route path="/sign-in" element={<RequireInitialized><SignInPage /></RequireInitialized>} />

        {/* Main app routes — with sidebar layout */}
        <Route element={<RequireInitialized><Layout /></RequireInitialized>}>
          {/* 默认按角色与权限智能跳转首页 */}
          <Route path="/" element={<HomeLandingRedirect />} />

          {/* 角色专属工作台（W2.5）：所有已登录角色可进入，内容由服务端按权限过滤 */}
          <Route
            path="/workbench"
            element={
              <RequireAccess allowBrandViewer roles={[...ROLE_CODES]}>
                <WorkbenchPage />
              </RequireAccess>
            }
          />

          {/* ===== 总览与看板 ===== */}
          <Route path="/overview" element={<Navigate to="/ai-ops/cockpit" replace />} />
          <Route path="/overview/cockpit/standalone" element={<Navigate to="/overview/cockpit" replace />} />

          {/* ===== 旧 AI 助手功能已迁移至 AI 运营系统（平滑重定向） ===== */}
          <Route path="/ai" element={<Navigate to="/ai-ops/chat" replace />} />
          <Route path="/ai/chat" element={<Navigate to="/ai-ops/chat" replace />} />
          <Route path="/ai/selection" element={<Navigate to="/ai-ops/assortment/selection" replace />} />
          <Route path="/ai/selection/history" element={<Navigate to="/ai-ops/assortment/selection" replace />} />
          <Route path="/ai/workbench" element={<Navigate to="/ai-ops/workbench" replace />} />

          {/* ===== 数据管理 ===== */}
          <Route path="/omnichannel/dashboard/standalone" element={<Navigate to="/omnichannel/dashboard" replace />} />
          <Route path="/brand-portal" element={<RequireAccess allowBrandViewer><BrandPortalPage /></RequireAccess>} />

          {/* ===== 商业智能 ===== */}
          <Route path="/bi/roi" element={<Navigate to="/ops/net-roi" replace />} />

          {/* ===== 旧主播训练与能力看板平滑重定向至主播档案 ===== */}
          <Route path="/anchors/training" element={<Navigate to="/anchors/profile" replace />} />
          <Route path="/ops/capabilities" element={<Navigate to="/anchors/profile" replace />} />

          {/* ===== 主播赋能 ===== */}
          <Route path="/anchors/live-schedule/standalone" element={<Navigate to="/anchors/live-schedule" replace />} />
          <Route path="/anchors/schedule/standalone" element={<Navigate to="/anchors/schedule" replace />} />
          <Route path="/anchors/schedule-recommend" element={<Navigate to="/ai-ops/people/schedule-recommend" replace />} />
          <Route path="/anchors/schedule-recommend/standalone" element={<Navigate to="/ai-ops/people/schedule-recommend" replace />} />

          {/* ===== 系统 ===== */}
          <Route path="/compliance/changes/:id" element={<RequireAccess module="compliance"><ChangeDetailPage /></RequireAccess>} />

          {/* ===== AI 运营系统 (AI-Native 独立分支) ===== */}
          <Route path="/ai-ops" element={<Navigate to="/ai-ops/cockpit" replace />} />
          <Route path="/ai-ops/cockpit" element={<RequireAiOpsAccess><AiOpsCockpitPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/workbench" element={<RequireAiOpsAccess><AiOpsWorkbenchPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/chat" element={<RequireAiOpsAccess><AiOpsChatPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/runs/:runId" element={<RequireAiOpsAccess><AiOpsRunDetailPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/inbox" element={<RequireAiOpsAccess><AiOpsInboxPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/alerts" element={<RequireAiOpsAccess><AiOpsAlertsPage /></RequireAiOpsAccess>} />

          {/* 场 Session & 复盘 */}
          <Route path="/ai-ops/session/planning" element={<RequireAiOpsAccess><AiOpsPlanningPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/session/prompter" element={<RequireAiOpsAccess><AiOpsPrompterPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/session/live-watch" element={<RequireAiOpsAccess><AiOpsLiveWatchPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/session/review" element={<RequireAiOpsAccess><AiOpsReviewPage /></RequireAiOpsAccess>} />

          {/* 货 Assortment */}
          <Route path="/ai-ops/assortment/selection" element={<RequireAiOpsAccess><AiOpsSelectionPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/assortment/structure" element={<RequireAiOpsAccess><AiOpsAssortmentStructurePage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/assortment/prices" element={<RequireAiOpsAccess><AiOpsPricesPage /></RequireAiOpsAccess>} />

          {/* 投流 Media */}
          <Route path="/ai-ops/media/campaigns" element={<RequireAiOpsAccess><AiOpsCampaignsPage /></RequireAiOpsAccess>} />

          {/* 财 Finance (严格隔离：仅财务与超管可访问) */}
          <Route path="/ai-ops/finance/pnl" element={<RequireAiOpsAccess requireFinance><AiOpsFinancePnlPage /></RequireAiOpsAccess>} />

          {/* 人效 People */}
          <Route path="/ai-ops/people/performance" element={<RequireAiOpsAccess><AiOpsPeoplePage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/session/actions" element={<RequireAiOpsAccess><AiOpsActionItemsPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/people/schedule-recommend" element={<RequireAiOpsAccess><AiOpsScheduleRecommendPage /></RequireAiOpsAccess>} />

          {/* 系统治理 */}
          <Route path="/ai-ops/governance/metrics" element={<RequireAiOpsAccess><AiOpsMetricsPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/governance/cases" element={<RequireAiOpsAccess><AiOpsCasesPage /></RequireAiOpsAccess>} />
          <Route path="/ai-ops/governance/knowledge" element={<RequireAiOpsAccess><AiOpsKnowledgePage /></RequireAiOpsAccess>} />

          {/* 兜底 404：未匹配路由不再白屏 */}
          <Route path="*" element={<NotFoundPage />} />
          {CLASSIC_ROUTES}
        </Route>
      </Routes>
    </Suspense>
  )
}
