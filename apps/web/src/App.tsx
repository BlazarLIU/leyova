import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { SignInPage } from '@/pages/auth/SignInPage'

// 总览
import { HomePage } from '@/pages/overview/HomePage'
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

// 运营提效
import { CapabilitiesPage } from '@/pages/ops/CapabilitiesPage'

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

      {/* Main app routes — with sidebar layout */}
      <Route element={<Layout />}>
        {/* 默认跳转到首页 */}
        <Route path="/" element={<Navigate to="/overview/home" replace />} />

        {/* ===== 总览 ===== */}
        <Route path="/overview/home" element={<HomePage />} />
        <Route path="/overview/cockpit" element={<CockpitPage />} />
        <Route path="/overview/live-monitor" element={<LiveMonitorPage />} />
        {/* <Route path="/overview/sessions" element={<SessionsPage />} />  已冻结 */}
        <Route path="/overview/analytics" element={<AnalyticsPage />} />

        {/* ===== 直播管理 ===== */}
        <Route path="/live/attendance" element={<AttendancePage />} />
        <Route path="/live/registration" element={<LiveRegistrationPage />} />
        <Route path="/live/data" element={<DataLivePage />} />

        {/* ===== AI 分析助手 ===== */}
        <Route path="/ai/chat" element={<ChatPage />} />

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
        {/* ===== 运营提效 ===== */}
        <Route path="/ops/capabilities" element={<CapabilitiesPage />} />
        <Route path="/ops/script-library" element={<ScriptTemplatesPage />} />
        <Route path="/ops/issue-library" element={<IssueLibraryPage />} />
        <Route path="/ops/goal-tracking" element={<GoalTrackingPage />} />
        <Route path="/ops/room-health" element={<RoomHealthPage />} />
        <Route path="/ops/session-products" element={<SessionProductsPage />} />

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