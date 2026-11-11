import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RequireAccess } from '@/components/auth/RequireAccess'
import { useAuth, getDefaultHomePath } from '@/hooks/useAuth'
import { SignInPage } from '@/pages/auth/SignInPage'

// 总览
import { PlatformAwareHomePage } from '@/pages/overview/PlatformAwareHomePage'
import { CockpitPage } from '@/pages/overview/CockpitPage'
import { LiveMonitorPage } from '@/pages/overview/LiveMonitorPage'
// import { SessionsPage } from '@/pages/overview/SessionsPage' // 已冻结
import { AnalyticsPage } from '@/pages/overview/AnalyticsPage'

// 直播管理
import { AttendancePage } from '@/pages/live/AttendancePage'
import { LiveRegistrationPage } from '@/pages/live/LiveRegistrationPage'
import { DataLivePage } from '@/pages/live/DataLivePage'

// AI
import { ChatPage } from '@/pages/ai/ChatPage'

// 数据管理
import { DataManagementPage } from '@/pages/data/DataManagementPage'
import { DataUploadPage } from '@/pages/data/DataUploadPage'
import { UploadedDataPage } from '@/pages/data/UploadedDataPage'
import { DataQualityPage } from '@/pages/data/DataQualityPage'
import { IngestWizardPage } from '@/pages/data/IngestWizardPage'
import { OmniDashboardPage } from '@/pages/omnichannel/OmniDashboardPage'
import { ContentCenterConfigPage } from '@/pages/content/ContentCenterConfigPage'
import { AnalysisWorkbenchPage } from '@/pages/ai/AnalysisWorkbenchPage'
import { ShopOverviewPage } from '@/pages/shop/ShopOverviewPage'
import { ShopProductsPage } from '@/pages/shop/ShopProductsPage'
import { TaobaoShopBoardPage } from '@/pages/shop/taobao/TaobaoShopBoardPage'
import { TaobaoAdReconciliationPage } from '@/pages/shop/taobao/TaobaoAdReconciliationPage'
import { PddGroupFunnelPage } from '@/pages/shop/pdd/PddGroupFunnelPage'
import { PddCaliberComparePage } from '@/pages/shop/pdd/PddCaliberComparePage'
import { KsTrafficSplitPage } from '@/pages/shop/kuaishou/KsTrafficSplitPage'
import { KsIndirectGmvPage } from '@/pages/shop/kuaishou/KsIndirectGmvPage'
import { KsFansTeamPage } from '@/pages/shop/kuaishou/KsFansTeamPage'
import { JdBusinessBoardPage } from '@/pages/shop/jd/JdBusinessBoardPage'
import { JdFulfillmentPage } from '@/pages/shop/jd/JdFulfillmentPage'
import { JdStoreRatingPage } from '@/pages/shop/jd/JdStoreRatingPage'
import { PddRefundAnalysisPage } from '@/pages/shop/pdd/PddRefundAnalysisPage'
import { TaobaoProductChannelPage } from '@/pages/shop/taobao/TaobaoProductChannelPage'
import { XhsNoteBoardPage } from '@/pages/shop/xiaohongshu/XhsNoteBoardPage'
import { XhsConversionPage } from '@/pages/shop/xiaohongshu/XhsConversionPage'
import { PlatformManagementPage } from '@/pages/system/PlatformManagementPage'
import { UsersPage } from '@/pages/system/UsersPage'
import { AuditLogsPage } from '@/pages/system/AuditLogsPage'
import { DictPage } from '@/pages/system/DictPage'

// 内容中心
import { VideoCreatePage } from '@/pages/content/VideoCreatePage'
import { VideoDataPage } from '@/pages/content/VideoDataPage'
import { ContentConfigPage } from '@/pages/content/ContentConfigPage'

// 商业智能
import { RefundAnalysisPage } from '@/pages/bi/RefundAnalysisPage'
import { BiDashboardPage } from '@/pages/bi/BiDashboardPage'
import { RoiDashboardPage } from '@/pages/bi/RoiDashboardPage'
import { AnomalyDetectionPage } from '@/pages/bi/AnomalyDetectionPage'

// 主播赋能
import { AnchorListPage } from '@/pages/anchors/AnchorListPage'
import { AnchorProfilePage } from '@/pages/anchors/AnchorProfilePage'
import { TrainingPage } from '@/pages/anchors/TrainingPage'
import { ScriptTemplatesPage } from '@/pages/anchors/ScriptTemplatesPage'
import { ScheduleRecommendPage } from '@/pages/anchors/ScheduleRecommendPage'
import { ScheduleManagementPage } from '@/pages/anchors/ScheduleManagementPage'
import { MySchedulePage } from '@/pages/anchors/MySchedulePage'
import { MyPerformancePage } from '@/pages/anchors/MyPerformancePage'
import { WeatherSelectionPage } from '@/pages/ai/WeatherSelectionPage'
import { BrandLoginPage } from '@/pages/brand-portal/BrandLoginPage'

// 运营提效
import { CapabilitiesPage } from '@/pages/ops/CapabilitiesPage'
import { CostStructurePage } from '@/pages/ops/CostStructurePage'
import { ClientsPage } from '@/pages/agency/ClientsPage'
import { ProjectsPage } from '@/pages/agency/ProjectsPage'
import { SettlementPage } from '@/pages/agency/SettlementPage'
import { BrandDashboardPage } from '@/pages/brand-portal/BrandDashboardPage'

import { IssueLibraryPage } from '@/pages/ops/IssueLibraryPage'
import { GoalTrackingPage } from '@/pages/ops/GoalTrackingPage'
import { RoomHealthPage } from '@/pages/ops/RoomHealthPage'
import { SessionProductsPage } from '@/pages/ops/SessionProductsPage'
import { InventoryCenterPage } from '@/pages/ops/InventoryCenterPage'
import { FulfillmentSlaPage } from '@/pages/ops/FulfillmentSlaPage'
import { AfterSalesPage } from '@/pages/ops/AfterSalesPage'
import { KolCooperationPage } from '@/pages/ops/KolCooperationPage'
import { CustomerServicePage } from '@/pages/ops/CustomerServicePage'

// 直播复盘
import { ReviewOverviewPage } from '@/pages/review/ReviewOverviewPage'
import { ProductAnalysisPage } from '@/pages/review/ProductAnalysisPage'
import { ShortVideoTrafficPage } from '@/pages/review/ShortVideoTrafficPage'
import { ChannelAnalysisPage } from '@/pages/review/ChannelAnalysisPage'
import { AnchorPerformancePage } from '@/pages/review/AnchorPerformancePage'
import { FunnelAnalysisPage } from '@/pages/review/FunnelAnalysisPage'
import { ClosedLoopPage } from '@/pages/review/ClosedLoopPage'

// 系统
import { SystemConfigPage } from '@/pages/system/SystemConfigPage'
import { AlertCenterPage } from '@/pages/system/AlertCenterPage'
import { ImprovementTasksPage } from '@/pages/system/ImprovementTasksPage'
import { PromotionCampaignsPage } from '@/pages/system/PromotionCampaignsPage'

import { CompetitorWatchPage } from '@/pages/system/CompetitorWatchPage'
import { MultiRoomOverviewPage } from '@/pages/system/MultiRoomOverviewPage'

function HomeLandingRedirect() {
  const { user, allowedModules, loading } = useAuth()
  if (loading || !user) return null
  return <Navigate to={getDefaultHomePath(user, allowedModules)} replace />
}

export default function App() {
  return (
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
        {/* <Route path="/overview/sessions" element={<SessionsPage />} />  已冻结 */}
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
        <Route path="/shop/pdd/caliber-compare" element={<RequireAccess module="overview"><PddCaliberComparePage /></RequireAccess>} />
        <Route path="/shop/kuaishou/traffic-split" element={<RequireAccess module="bi"><KsTrafficSplitPage /></RequireAccess>} />
        <Route path="/shop/kuaishou/indirect-gmv" element={<RequireAccess module="bi"><KsIndirectGmvPage /></RequireAccess>} />
        <Route path="/shop/kuaishou/fans-team" element={<RequireAccess module="ops"><KsFansTeamPage /></RequireAccess>} />
        <Route path="/shop/jd/board" element={<RequireAccess module="overview"><JdBusinessBoardPage /></RequireAccess>} />
        <Route path="/shop/jd/fulfillment" element={<RequireAccess module="fulfillment"><JdFulfillmentPage /></RequireAccess>} />
        <Route path="/shop/jd/store-rating" element={<RequireAccess module="overview"><JdStoreRatingPage /></RequireAccess>} />
        <Route path="/shop/pdd/refund" element={<RequireAccess module="bi"><PddRefundAnalysisPage /></RequireAccess>} />
        <Route path="/shop/taobao/product-channel" element={<RequireAccess anyModules={['overview', 'ops']}><TaobaoProductChannelPage /></RequireAccess>} />
        <Route path="/shop/xiaohongshu/notes" element={<RequireAccess module="overview"><XhsNoteBoardPage /></RequireAccess>} />
        <Route path="/shop/xiaohongshu/conversion" element={<RequireAccess module="content"><XhsConversionPage /></RequireAccess>} />
        <Route path="/system/platforms" element={<RequireAccess roles={['super_admin', 'admin']} module="system_users"><PlatformManagementPage /></RequireAccess>} />
        <Route path="/system/users" element={<RequireAccess roles={['super_admin', 'admin']} module="system_users"><UsersPage /></RequireAccess>} />
        <Route path="/system/audit-logs" element={<RequireAccess roles={['super_admin', 'admin']} module="system_users"><AuditLogsPage /></RequireAccess>} />
        <Route path="/system/dict" element={<RequireAccess roles={['super_admin']} module="system_dict"><DictPage /></RequireAccess>} />

        {/* ===== 内容中心 ===== */}
        <Route path="/content/video-create" element={<RequireAccess module="content"><VideoCreatePage /></RequireAccess>} />
        <Route path="/content/video-data" element={<RequireAccess module="content"><VideoDataPage /></RequireAccess>} />
        <Route path="/content/config" element={<RequireAccess module="content"><ContentConfigPage /></RequireAccess>} />

        {/* ===== 商业智能 ===== */}
        <Route path="/bi/dashboard" element={<RequireAccess module="bi"><BiDashboardPage /></RequireAccess>} />
        <Route path="/bi/roi" element={<RequireAccess module="bi"><RoiDashboardPage /></RequireAccess>} />
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
        <Route path="/system/alerts" element={<RequireAccess module="system_alerts"><AlertCenterPage /></RequireAccess>} />
        <Route path="/system/tasks" element={<RequireAccess anyModules={['system_tasks', 'ops']}><ImprovementTasksPage /></RequireAccess>} />
        <Route path="/system/promotions" element={<RequireAccess anyModules={['system_promotions', 'ops']}><PromotionCampaignsPage /></RequireAccess>} />
        <Route path="/system/competitors" element={<RequireAccess anyModules={['system_competitors', 'ops']}><CompetitorWatchPage /></RequireAccess>} />
        <Route path="/system/multi-room" element={<RequireAccess module="system_multiroom"><MultiRoomOverviewPage /></RequireAccess>} />
      </Route>
    </Routes>
  )
}