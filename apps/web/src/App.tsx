import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
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

export default function App() {
  return (
    <Routes>
      {/* Auth routes — no sidebar layout */}
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/brand-login" element={<BrandLoginPage />} />

      {/* Main app routes — with sidebar layout */}
      <Route element={<Layout />}>
        {/* 默认跳转到首页 */}
        <Route path="/" element={<Navigate to="/overview/home" replace />} />

        {/* ===== 总览 ===== */}
        <Route path="/overview/home" element={<PlatformAwareHomePage />} />
        <Route path="/overview/cockpit" element={<CockpitPage />} />
        <Route path="/overview/live-monitor" element={<LiveMonitorPage />} />
        {/* <Route path="/overview/sessions" element={<SessionsPage />} />  已冻结 */}
        <Route path="/overview/analytics" element={<AnalyticsPage />} />

        {/* ===== 直播管理 ===== */}
        <Route path="/live/attendance" element={<AttendancePage />} />
        <Route path="/live/registration" element={<LiveRegistrationPage />} />
        <Route path="/live/data" element={<DataLivePage />} />

        {/* ===== AI 助手 ===== */}
        <Route path="/ai/chat" element={<ChatPage />} />
        <Route path="/ai/weather" element={<WeatherSelectionPage />} />

        {/* ===== 数据管理 ===== */}
        <Route path="/data/management" element={<DataManagementPage />} />
        <Route path="/data/upload" element={<DataUploadPage />} />
        <Route path="/data/uploaded-data" element={<UploadedDataPage />} />
        <Route path="/data/quality" element={<DataQualityPage />} />
        <Route path="/data/ingest" element={<IngestWizardPage />} />
        <Route path="/omnichannel/dashboard" element={<OmniDashboardPage />} />
        <Route path="/content/center-config" element={<ContentCenterConfigPage />} />
        <Route path="/ai/workbench" element={<AnalysisWorkbenchPage />} />
        <Route path="/shop/overview" element={<ShopOverviewPage />} />
        <Route path="/shop/products" element={<ShopProductsPage />} />
        <Route path="/shop/taobao/board" element={<TaobaoShopBoardPage />} />
        <Route path="/shop/taobao/ad-reconciliation" element={<TaobaoAdReconciliationPage />} />
        <Route path="/shop/pdd/group-funnel" element={<PddGroupFunnelPage />} />
        <Route path="/shop/pdd/caliber-compare" element={<PddCaliberComparePage />} />
        <Route path="/shop/kuaishou/traffic-split" element={<KsTrafficSplitPage />} />
        <Route path="/shop/kuaishou/indirect-gmv" element={<KsIndirectGmvPage />} />
        <Route path="/shop/kuaishou/fans-team" element={<KsFansTeamPage />} />
        <Route path="/shop/jd/board" element={<JdBusinessBoardPage />} />
        <Route path="/shop/jd/fulfillment" element={<JdFulfillmentPage />} />
        <Route path="/shop/jd/store-rating" element={<JdStoreRatingPage />} />
        <Route path="/shop/pdd/refund" element={<PddRefundAnalysisPage />} />
        <Route path="/shop/taobao/product-channel" element={<TaobaoProductChannelPage />} />
        <Route path="/shop/xiaohongshu/notes" element={<XhsNoteBoardPage />} />
        <Route path="/shop/xiaohongshu/conversion" element={<XhsConversionPage />} />
        <Route path="/system/platforms" element={<PlatformManagementPage />} />
        <Route path="/system/users" element={<UsersPage />} />
        <Route path="/system/dict" element={<DictPage />} />

        {/* ===== 内容中心 ===== */}
        <Route path="/content/video-create" element={<VideoCreatePage />} />
        <Route path="/content/video-data" element={<VideoDataPage />} />
        <Route path="/content/config" element={<ContentConfigPage />} />

        {/* ===== 商业智能 ===== */}
        <Route path="/bi/dashboard" element={<BiDashboardPage />} />
        <Route path="/bi/roi" element={<RoiDashboardPage />} />
        <Route path="/bi/refund-analysis" element={<RefundAnalysisPage />} />
        <Route path="/bi/anomaly-detection" element={<AnomalyDetectionPage />} />

        {/* ===== 主播赋能 ===== */}
        <Route path="/anchors/list" element={<AnchorListPage />} />
        <Route path="/anchors/profile" element={<AnchorProfilePage />} />
        <Route path="/anchors/training" element={<TrainingPage />} />
        <Route path="/anchors/schedule" element={<ScheduleManagementPage />} />
        <Route path="/anchors/my-schedule" element={<MySchedulePage />} />
        <Route path="/anchors/schedule-recommend" element={<ScheduleRecommendPage />} />
        <Route path="/anchors/my-performance" element={<MyPerformancePage />} />
        {/* ===== 运营提效 ===== */}
        <Route path="/ops/capabilities" element={<CapabilitiesPage />} />
        <Route path="/ops/script-library" element={<ScriptTemplatesPage />} />
        <Route path="/ops/issue-library" element={<IssueLibraryPage />} />
        <Route path="/ops/goal-tracking" element={<GoalTrackingPage />} />
        <Route path="/ops/room-health" element={<RoomHealthPage />} />
        <Route path="/ops/session-products" element={<SessionProductsPage />} />
        <Route path="/ops/costs" element={<CostStructurePage />} />

        {/* ===== MCN 代运营与对账中心 ===== */}
        <Route path="/agency/clients" element={<ClientsPage />} />
        <Route path="/agency/projects" element={<ProjectsPage />} />
        <Route path="/agency/settlement" element={<SettlementPage />} />
        <Route path="/brand-portal" element={<BrandDashboardPage />} />

        {/* ===== 直播复盘 ===== */}
        <Route path="/review/overview" element={<ReviewOverviewPage />} />
        <Route path="/review/products" element={<ProductAnalysisPage />} />
        <Route path="/review/short-videos" element={<ShortVideoTrafficPage />} />
        <Route path="/review/channels" element={<ChannelAnalysisPage />} />
        <Route path="/review/anchors" element={<AnchorPerformancePage />} />
        <Route path="/review/funnel" element={<FunnelAnalysisPage />} />
        <Route path="/review/closed-loop" element={<ClosedLoopPage />} />

        {/* ===== 系统 ===== */}
        <Route path="/system/config" element={<SystemConfigPage />} />
        <Route path="/system/alerts" element={<AlertCenterPage />} />
        <Route path="/system/tasks" element={<ImprovementTasksPage />} />
        <Route path="/system/promotions" element={<PromotionCampaignsPage />} />
        <Route path="/system/competitors" element={<CompetitorWatchPage />} />
        <Route path="/system/multi-room" element={<MultiRoomOverviewPage />} />
      </Route>
    </Routes>
  )
}