import { Suspense, lazy, type ComponentType } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RequireAccess } from '@/components/auth/RequireAccess'
import { useAuth, getDefaultHomePath } from '@/hooks/useAuth'
import { SignInPage } from '@/pages/auth/SignInPage'
import { BrandLoginPage } from '@/pages/brand-portal/BrandLoginPage'

function lazyPage<M extends Record<string, any>, K extends keyof M>(
  loader: () => Promise<M>,
  exportName: K,
) {
  return lazy(() =>
    loader().then((mod) => ({ default: mod[exportName] as ComponentType<any> })),
  )
}

// 总览
const PlatformAwareHomePage = lazyPage(() => import('@/pages/overview/PlatformAwareHomePage'), 'PlatformAwareHomePage')
const CockpitPage = lazyPage(() => import('@/pages/overview/CockpitPage'), 'CockpitPage')
const LiveMonitorPage = lazyPage(() => import('@/pages/overview/LiveMonitorPage'), 'LiveMonitorPage')
const SessionsPage = lazyPage(() => import('@/pages/overview/SessionsPage'), 'SessionsPage')
const AnalyticsPage = lazyPage(() => import('@/pages/overview/AnalyticsPage'), 'AnalyticsPage')

// 直播管理
const AttendancePage = lazyPage(() => import('@/pages/live/AttendancePage'), 'AttendancePage')
const LiveRegistrationPage = lazyPage(() => import('@/pages/live/LiveRegistrationPage'), 'LiveRegistrationPage')
const DataLivePage = lazyPage(() => import('@/pages/live/DataLivePage'), 'DataLivePage')

// AI
const ChatPage = lazyPage(() => import('@/pages/ai/ChatPage'), 'ChatPage')
const WeatherSelectionPage = lazyPage(() => import('@/pages/ai/WeatherSelectionPage'), 'WeatherSelectionPage')
const AnalysisWorkbenchPage = lazyPage(() => import('@/pages/ai/AnalysisWorkbenchPage'), 'AnalysisWorkbenchPage')

// 数据管理 & 全渠道店铺
const DataManagementPage = lazyPage(() => import('@/pages/data/DataManagementPage'), 'DataManagementPage')
const DataUploadPage = lazyPage(() => import('@/pages/data/DataUploadPage'), 'DataUploadPage')
const UploadedDataPage = lazyPage(() => import('@/pages/data/UploadedDataPage'), 'UploadedDataPage')
const DataQualityPage = lazyPage(() => import('@/pages/data/DataQualityPage'), 'DataQualityPage')
const IngestWizardPage = lazyPage(() => import('@/pages/data/IngestWizardPage'), 'IngestWizardPage')
const OmniDashboardPage = lazyPage(() => import('@/pages/omnichannel/OmniDashboardPage'), 'OmniDashboardPage')
const ShopOverviewPage = lazyPage(() => import('@/pages/shop/ShopOverviewPage'), 'ShopOverviewPage')
const ShopProductsPage = lazyPage(() => import('@/pages/shop/ShopProductsPage'), 'ShopProductsPage')
const TaobaoShopBoardPage = lazyPage(() => import('@/pages/shop/taobao/TaobaoShopBoardPage'), 'TaobaoShopBoardPage')
const TaobaoAdReconciliationPage = lazyPage(() => import('@/pages/shop/taobao/TaobaoAdReconciliationPage'), 'TaobaoAdReconciliationPage')
const TaobaoProductChannelPage = lazyPage(() => import('@/pages/shop/taobao/TaobaoProductChannelPage'), 'TaobaoProductChannelPage')
const PddGroupFunnelPage = lazyPage(() => import('@/pages/shop/pdd/PddGroupFunnelPage'), 'PddGroupFunnelPage')
const PddCaliberComparePage = lazyPage(() => import('@/pages/shop/pdd/PddCaliberComparePage'), 'PddCaliberComparePage')
const PddRefundAnalysisPage = lazyPage(() => import('@/pages/shop/pdd/PddRefundAnalysisPage'), 'PddRefundAnalysisPage')
const KsTrafficSplitPage = lazyPage(() => import('@/pages/shop/kuaishou/KsTrafficSplitPage'), 'KsTrafficSplitPage')
const KsIndirectGmvPage = lazyPage(() => import('@/pages/shop/kuaishou/KsIndirectGmvPage'), 'KsIndirectGmvPage')
const KsFansTeamPage = lazyPage(() => import('@/pages/shop/kuaishou/KsFansTeamPage'), 'KsFansTeamPage')
const JdBusinessBoardPage = lazyPage(() => import('@/pages/shop/jd/JdBusinessBoardPage'), 'JdBusinessBoardPage')
const JdFulfillmentPage = lazyPage(() => import('@/pages/shop/jd/JdFulfillmentPage'), 'JdFulfillmentPage')
const JdStoreRatingPage = lazyPage(() => import('@/pages/shop/jd/JdStoreRatingPage'), 'JdStoreRatingPage')
const XhsNoteBoardPage = lazyPage(() => import('@/pages/shop/xiaohongshu/XhsNoteBoardPage'), 'XhsNoteBoardPage')
const XhsConversionPage = lazyPage(() => import('@/pages/shop/xiaohongshu/XhsConversionPage'), 'XhsConversionPage')

// 内容中心
const VideoCreatePage = lazyPage(() => import('@/pages/content/VideoCreatePage'), 'VideoCreatePage')
const VideoDataPage = lazyPage(() => import('@/pages/content/VideoDataPage'), 'VideoDataPage')
const ContentSchedulePage = lazyPage(() => import('@/pages/content/ContentSchedulePage'), 'ContentSchedulePage')
const ContentCenterConfigPage = lazyPage(() => import('@/pages/content/ContentCenterConfigPage'), 'ContentCenterConfigPage')

// 商业智能
const RefundAnalysisPage = lazyPage(() => import('@/pages/bi/RefundAnalysisPage'), 'RefundAnalysisPage')
const BiDashboardPage = lazyPage(() => import('@/pages/bi/BiDashboardPage'), 'BiDashboardPage')
const AnomalyDetectionPage = lazyPage(() => import('@/pages/bi/AnomalyDetectionPage'), 'AnomalyDetectionPage')

// 主播赋能
const AnchorListPage = lazyPage(() => import('@/pages/anchors/AnchorListPage'), 'AnchorListPage')
const AnchorProfilePage = lazyPage(() => import('@/pages/anchors/AnchorProfilePage'), 'AnchorProfilePage')
const TrainingPage = lazyPage(() => import('@/pages/anchors/TrainingPage'), 'TrainingPage')
const ScriptTemplatesPage = lazyPage(() => import('@/pages/anchors/ScriptTemplatesPage'), 'ScriptTemplatesPage')
const ScheduleRecommendPage = lazyPage(() => import('@/pages/anchors/ScheduleRecommendPage'), 'ScheduleRecommendPage')
const ScheduleManagementPage = lazyPage(() => import('@/pages/anchors/ScheduleManagementPage'), 'ScheduleManagementPage')
const MySchedulePage = lazyPage(() => import('@/pages/anchors/MySchedulePage'), 'MySchedulePage')
const MyPerformancePage = lazyPage(() => import('@/pages/anchors/MyPerformancePage'), 'MyPerformancePage')

// 运营提效 & 业务中台
const CapabilitiesPage = lazyPage(() => import('@/pages/ops/CapabilitiesPage'), 'CapabilitiesPage')
const CostStructurePage = lazyPage(() => import('@/pages/ops/CostStructurePage'), 'CostStructurePage')
const IssueLibraryPage = lazyPage(() => import('@/pages/ops/IssueLibraryPage'), 'IssueLibraryPage')
const GoalTrackingPage = lazyPage(() => import('@/pages/ops/GoalTrackingPage'), 'GoalTrackingPage')
const RoomHealthPage = lazyPage(() => import('@/pages/ops/RoomHealthPage'), 'RoomHealthPage')
const SessionProductsPage = lazyPage(() => import('@/pages/ops/session-products/SessionProductsPage'), 'SessionProductsPage')
const InventoryCenterPage = lazyPage(() => import('@/pages/ops/product-center/InventoryCenterPage'), 'InventoryCenterPage')
const FulfillmentSlaPage = lazyPage(() => import('@/pages/ops/fulfillment/FulfillmentSlaPage'), 'FulfillmentSlaPage')
const AfterSalesPage = lazyPage(() => import('@/pages/ops/after-sales/AfterSalesPage'), 'AfterSalesPage')
const KolCooperationPage = lazyPage(() => import('@/pages/ops/kol/KolCooperationPage'), 'KolCooperationPage')
const CustomerServicePage = lazyPage(() => import('@/pages/ops/customer-service/CustomerServicePage'), 'CustomerServicePage')
const NetRoiPage = lazyPage(() => import('@/pages/ops/net-roi/NetRoiPage'), 'NetRoiPage')
const SearchKeywordsPage = lazyPage(() => import('@/pages/ops/search-seo/SearchKeywordsPage'), 'SearchKeywordsPage')
const MembersPage = lazyPage(() => import('@/pages/ops/members/MembersPage'), 'MembersPage')

// MCN 代运营与品牌方
const ClientsPage = lazyPage(() => import('@/pages/agency/ClientsPage'), 'ClientsPage')
const ProjectsPage = lazyPage(() => import('@/pages/agency/ProjectsPage'), 'ProjectsPage')
const SettlementPage = lazyPage(() => import('@/pages/agency/SettlementPage'), 'SettlementPage')
const BrandDashboardPage = lazyPage(() => import('@/pages/brand-portal/BrandDashboardPage'), 'BrandDashboardPage')

// 直播复盘
const ReviewOverviewPage = lazyPage(() => import('@/pages/review/ReviewOverviewPage'), 'ReviewOverviewPage')
const ProductAnalysisPage = lazyPage(() => import('@/pages/review/ProductAnalysisPage'), 'ProductAnalysisPage')
const ShortVideoTrafficPage = lazyPage(() => import('@/pages/review/ShortVideoTrafficPage'), 'ShortVideoTrafficPage')
const ChannelAnalysisPage = lazyPage(() => import('@/pages/review/ChannelAnalysisPage'), 'ChannelAnalysisPage')
const AnchorPerformancePage = lazyPage(() => import('@/pages/review/AnchorPerformancePage'), 'AnchorPerformancePage')
const FunnelAnalysisPage = lazyPage(() => import('@/pages/review/FunnelAnalysisPage'), 'FunnelAnalysisPage')
const ClosedLoopPage = lazyPage(() => import('@/pages/review/ClosedLoopPage'), 'ClosedLoopPage')

// 系统与风控合规
const PlatformManagementPage = lazyPage(() => import('@/pages/system/PlatformManagementPage'), 'PlatformManagementPage')
const UsersPage = lazyPage(() => import('@/pages/system/UsersPage'), 'UsersPage')
const AuditLogsPage = lazyPage(() => import('@/pages/system/AuditLogsPage'), 'AuditLogsPage')
const DictPage = lazyPage(() => import('@/pages/system/DictPage'), 'DictPage')
const SystemConfigPage = lazyPage(() => import('@/pages/system/SystemConfigPage'), 'SystemConfigPage')
const PersonnelPage = lazyPage(() => import('@/pages/system/PersonnelPage'), 'PersonnelPage')
const RoomsPage = lazyPage(() => import('@/pages/system/RoomsPage'), 'RoomsPage')
const AlertCenterPage = lazyPage(() => import('@/pages/system/AlertCenterPage'), 'AlertCenterPage')
const ImprovementTasksPage = lazyPage(() => import('@/pages/system/ImprovementTasksPage'), 'ImprovementTasksPage')
const PromotionCampaignsPage = lazyPage(() => import('@/pages/system/PromotionCampaignsPage'), 'PromotionCampaignsPage')
const CompetitorWatchPage = lazyPage(() => import('@/pages/system/CompetitorWatchPage'), 'CompetitorWatchPage')
const MultiRoomOverviewPage = lazyPage(() => import('@/pages/system/MultiRoomOverviewPage'), 'MultiRoomOverviewPage')
const CompliancePage = lazyPage(() => import('@/pages/system/CompliancePage'), 'CompliancePage')

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
        {/* Auth routes — no sidebar layout */}
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/brand-login" element={<BrandLoginPage />} />

        {/* Main app routes — with sidebar layout */}
        <Route element={<Layout />}>
          {/* 默认按角色与权限智能跳转首页 */}
          <Route path="/" element={<HomeLandingRedirect />} />

          {/* ===== 总览 ===== */}
          <Route path="/overview/home" element={<RequireAccess module="overview"><PlatformAwareHomePage /></RequireAccess>} />
          <Route path="/overview/cockpit" element={<RequireAccess module="overview"><CockpitPage /></RequireAccess>} />
          <Route path="/overview/live-monitor" element={<RequireAccess module="overview"><LiveMonitorPage /></RequireAccess>} />
          <Route path="/overview/sessions" element={<RequireAccess module="session"><SessionsPage /></RequireAccess>} />
          <Route path="/overview/analytics" element={<RequireAccess module="overview"><AnalyticsPage /></RequireAccess>} />

          {/* ===== 直播管理 ===== */}
          <Route path="/live/attendance" element={<RequireAccess module="personal_achievement"><AttendancePage /></RequireAccess>} />
          <Route path="/live/registration" element={<RequireAccess module="live_registration"><LiveRegistrationPage /></RequireAccess>} />
          <Route path="/live/data" element={<RequireAccess module="live_data"><DataLivePage /></RequireAccess>} />

          {/* ===== AI 助手 ===== */}
          <Route path="/ai/chat" element={<RequireAccess module="ai"><ChatPage /></RequireAccess>} />
          <Route path="/ai/weather" element={<RequireAccess module="ai"><WeatherSelectionPage /></RequireAccess>} />

          {/* ===== 数据管理 ===== */}
          <Route path="/data/management" element={<RequireAccess module="data"><DataManagementPage /></RequireAccess>} />
          <Route path="/data/upload" element={<RequireAccess module="data"><DataUploadPage /></RequireAccess>} />
          <Route path="/data/uploaded-data" element={<RequireAccess module="data"><UploadedDataPage /></RequireAccess>} />
          <Route path="/data/quality" element={<RequireAccess module="data"><DataQualityPage /></RequireAccess>} />
          <Route path="/data/ingest" element={<RequireAccess module="data"><IngestWizardPage /></RequireAccess>} />
          <Route path="/omnichannel/dashboard" element={<RequireAccess module="overview"><OmniDashboardPage /></RequireAccess>} />
          <Route path="/content/center-config" element={<RequireAccess anyModules={['content', 'system_ai']}><ContentCenterConfigPage /></RequireAccess>} />
          <Route path="/ai/workbench" element={<RequireAccess module="overview"><AnalysisWorkbenchPage /></RequireAccess>} />
          <Route path="/shop/overview" element={<RequireAccess module="overview"><ShopOverviewPage /></RequireAccess>} />
          <Route path="/shop/products" element={<RequireAccess module="product_center"><ShopProductsPage /></RequireAccess>} />
          <Route path="/shop/taobao/board" element={<RequireAccess module="overview"><TaobaoShopBoardPage /></RequireAccess>} />
          <Route path="/shop/taobao/ad-reconciliation" element={<RequireAccess anyModules={['overview', 'ops']}><TaobaoAdReconciliationPage /></RequireAccess>} />
          <Route path="/shop/pdd/group-funnel" element={<RequireAccess module="bi"><PddGroupFunnelPage /></RequireAccess>} />
          <Route path="/shop/pdd/caliber-compare" element={<RequireAccess module="bi"><PddCaliberComparePage /></RequireAccess>} />
          <Route path="/shop/kuaishou/traffic-split" element={<RequireAccess module="bi"><KsTrafficSplitPage /></RequireAccess>} />
          <Route path="/shop/kuaishou/indirect-gmv" element={<RequireAccess module="bi"><KsIndirectGmvPage /></RequireAccess>} />
          <Route path="/shop/kuaishou/fans-team" element={<RequireAccess module="ops"><KsFansTeamPage /></RequireAccess>} />
          <Route path="/shop/jd/board" element={<RequireAccess module="overview"><JdBusinessBoardPage /></RequireAccess>} />
          <Route path="/shop/jd/fulfillment" element={<RequireAccess module="fulfillment"><JdFulfillmentPage /></RequireAccess>} />
          <Route path="/shop/jd/store-rating" element={<RequireAccess module="fulfillment"><JdStoreRatingPage /></RequireAccess>} />
          <Route path="/shop/pdd/refund" element={<RequireAccess module="bi"><PddRefundAnalysisPage /></RequireAccess>} />
          <Route path="/shop/taobao/product-channel" element={<RequireAccess anyModules={['overview', 'ops']}><TaobaoProductChannelPage /></RequireAccess>} />
          <Route path="/shop/xiaohongshu/notes" element={<RequireAccess module="content"><XhsNoteBoardPage /></RequireAccess>} />
          <Route path="/shop/xiaohongshu/conversion" element={<RequireAccess module="content"><XhsConversionPage /></RequireAccess>} />
          <Route path="/system/platforms" element={<RequireAccess roles={['super_admin', 'admin']} module="system_users"><PlatformManagementPage /></RequireAccess>} />
          <Route path="/system/users" element={<RequireAccess roles={['super_admin', 'admin']} module="system_users"><UsersPage /></RequireAccess>} />
          <Route path="/system/audit-logs" element={<RequireAccess roles={['super_admin', 'admin']} module="audit_logs"><AuditLogsPage /></RequireAccess>} />
          <Route path="/system/dict" element={<RequireAccess roles={['super_admin']} module="system_dict"><DictPage /></RequireAccess>} />

          {/* ===== 内容中心 ===== */}
          <Route path="/content/video-create" element={<RequireAccess module="content"><VideoCreatePage /></RequireAccess>} />
          <Route path="/content/video-data" element={<RequireAccess module="content"><VideoDataPage /></RequireAccess>} />
          <Route path="/content/schedule" element={<RequireAccess module="content_schedule"><ContentSchedulePage /></RequireAccess>} />

          {/* ===== 商业智能 ===== */}
          <Route path="/bi/dashboard" element={<RequireAccess module="bi"><BiDashboardPage /></RequireAccess>} />
          <Route path="/bi/roi" element={<Navigate to="/ops/net-roi" replace />} />
          <Route path="/bi/refund-analysis" element={<RequireAccess module="bi"><RefundAnalysisPage /></RequireAccess>} />
          <Route path="/bi/anomaly-detection" element={<RequireAccess module="bi"><AnomalyDetectionPage /></RequireAccess>} />

          {/* ===== 主播赋能 ===== */}
          <Route path="/anchors/list" element={<RequireAccess module="anchor"><AnchorListPage /></RequireAccess>} />
          <Route path="/anchors/profile" element={<RequireAccess module="anchor"><AnchorProfilePage /></RequireAccess>} />
          <Route path="/anchors/training" element={<RequireAccess module="anchor"><TrainingPage /></RequireAccess>} />
          <Route path="/anchors/schedule" element={<RequireAccess module="anchor"><ScheduleManagementPage /></RequireAccess>} />
          <Route path="/anchors/my-schedule" element={<RequireAccess anyModules={['personal_achievement', 'anchor']}><MySchedulePage /></RequireAccess>} />
          <Route path="/anchors/schedule-recommend" element={<RequireAccess module="anchor"><ScheduleRecommendPage /></RequireAccess>} />
          <Route path="/anchors/my-performance" element={<RequireAccess anyModules={['personal_achievement', 'anchor']}><MyPerformancePage /></RequireAccess>} />

          {/* ===== 运营提效 ===== */}
          <Route path="/ops/capabilities" element={<RequireAccess anyModules={['ops', 'anchor']}><CapabilitiesPage /></RequireAccess>} />
          <Route path="/ops/script-library" element={<RequireAccess anyModules={['ops', 'anchor']}><ScriptTemplatesPage /></RequireAccess>} />
          <Route path="/ops/issue-library" element={<RequireAccess module="ops"><IssueLibraryPage /></RequireAccess>} />
          <Route path="/ops/goal-tracking" element={<RequireAccess module="ops"><GoalTrackingPage /></RequireAccess>} />
          <Route path="/ops/room-health" element={<RequireAccess module="ops"><RoomHealthPage /></RequireAccess>} />
          <Route path="/ops/session-products" element={<RequireAccess module="session_products"><SessionProductsPage /></RequireAccess>} />
          <Route path="/ops/costs" element={<RequireAccess roles={['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance']} module="ops"><CostStructurePage /></RequireAccess>} />
          <Route path="/ops/inventory" element={<RequireAccess module="product_center"><InventoryCenterPage /></RequireAccess>} />
          <Route path="/ops/fulfillment" element={<RequireAccess module="fulfillment"><FulfillmentSlaPage /></RequireAccess>} />
          <Route path="/ops/after-sales" element={<RequireAccess module="after_sales"><AfterSalesPage /></RequireAccess>} />
          <Route path="/ops/kol" element={<RequireAccess module="kol"><KolCooperationPage /></RequireAccess>} />
          <Route path="/ops/cs" element={<RequireAccess module="customer_service"><CustomerServicePage /></RequireAccess>} />
          <Route path="/ops/net-roi" element={<RequireAccess roles={['super_admin', 'admin', 'finance', 'ops_director', 'ad_buyer']} module="net_roi"><NetRoiPage /></RequireAccess>} />
          <Route path="/ops/search-keywords" element={<RequireAccess module="search_seo"><SearchKeywordsPage /></RequireAccess>} />
          <Route path="/ops/members" element={<RequireAccess module="members"><MembersPage /></RequireAccess>} />

          {/* ===== MCN 代运营与对账中心 ===== */}
          <Route path="/agency/clients" element={<RequireAccess module="agency"><ClientsPage /></RequireAccess>} />
          <Route path="/agency/projects" element={<RequireAccess module="agency"><ProjectsPage /></RequireAccess>} />
          <Route path="/agency/settlement" element={<RequireAccess module="agency"><SettlementPage /></RequireAccess>} />
          <Route path="/brand-portal" element={<RequireAccess allowBrandViewer module="agency"><BrandDashboardPage /></RequireAccess>} />

          {/* ===== 直播复盘 ===== */}
          <Route path="/review/overview" element={<RequireAccess anyModules={['review_overview', 'review']}><ReviewOverviewPage /></RequireAccess>} />
          <Route path="/review/products" element={<RequireAccess module="review"><ProductAnalysisPage /></RequireAccess>} />
          <Route path="/review/short-videos" element={<RequireAccess module="review"><ShortVideoTrafficPage /></RequireAccess>} />
          <Route path="/review/channels" element={<RequireAccess anyModules={['review_channels', 'review']}><ChannelAnalysisPage /></RequireAccess>} />
          <Route path="/review/anchors" element={<RequireAccess anyModules={['review_anchors', 'review']}><AnchorPerformancePage /></RequireAccess>} />
          <Route path="/review/funnel" element={<RequireAccess anyModules={['review_funnel', 'review']}><FunnelAnalysisPage /></RequireAccess>} />
          <Route path="/review/closed-loop" element={<RequireAccess anyModules={['review_closed_loop', 'review']}><ClosedLoopPage /></RequireAccess>} />

          {/* ===== 系统 ===== */}
          <Route path="/system/config" element={<RequireAccess roles={['super_admin']} module="system_config"><SystemConfigPage /></RequireAccess>} />
          <Route path="/system/personnel" element={<RequireAccess module="system_personnel_ops"><PersonnelPage /></RequireAccess>} />
          <Route path="/system/rooms" element={<RequireAccess module="system_rooms"><RoomsPage /></RequireAccess>} />
          <Route path="/system/alerts" element={<RequireAccess module="system_alerts"><AlertCenterPage /></RequireAccess>} />
          <Route path="/system/tasks" element={<RequireAccess anyModules={['system_tasks', 'ops']}><ImprovementTasksPage /></RequireAccess>} />
          <Route path="/system/promotions" element={<RequireAccess anyModules={['system_promotions', 'ops']}><PromotionCampaignsPage /></RequireAccess>} />
          <Route path="/system/competitors" element={<RequireAccess anyModules={['system_competitors', 'ops']}><CompetitorWatchPage /></RequireAccess>} />
          <Route path="/system/multi-room" element={<RequireAccess module="system_multiroom"><MultiRoomOverviewPage /></RequireAccess>} />
          <Route path="/system/compliance" element={<RequireAccess module="compliance"><CompliancePage /></RequireAccess>} />
        </Route>
      </Routes>
    </Suspense>
  )
}
