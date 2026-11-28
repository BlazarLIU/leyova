/**
 * route-manifest.ts — 前端导航的唯一事实源（P1 重构底座）
 *
 * 背景（审计 30-ARCH-NAV-BUSINESS-AUDIT.md）：
 *   旧 `platform-navigation.ts` 用 5 个函数拼装菜单，出现 131 处 href 声明 / 88 个唯一页面，
 *   43 处重复挂载（改进任务/活动/竞品/搜索词/净ROI 各出现 4 次），且「运营工具」一组混装 9+ 业务域。
 *
 * 本文件把导航收敛为「一份扁平清单 + 9 个运营工作面」，规则：
 *   1. 每个 href 只出现一次（唯一归属）；
 *   2. 顶层 9 组对齐真实运营工作面（今日作战 / 场次 / 货盘 / 流量与投放 / 订单履约售后 / 内容与达人 / 人与钱 / 数据 / 系统）；
 *   3. 平台专属项用 `platforms` 声明，其余全平台可见；
 *   4. 不改任何路由路径，仅重组归属。
 */

import { lazy, type ComponentType } from 'react'
import { PlatformInsightPage } from '@/pages/insights/PlatformInsightPage'

function lazyPage<M extends Record<string, any>, K extends keyof M>(loader: () => Promise<M>, exportName: K) {
  return lazy(() => loader().then((mod) => ({ default: mod[exportName] as ComponentType<any> })))
}

export type NavGroupKey =
  | 'today'
  | 'session'
  | 'assortment'
  | 'traffic'
  | 'fulfillment'
  | 'content'
  | 'people'
  | 'data'
  | 'system'

export interface NavManifestEntry {
  /** 菜单文案 */
  label: string
  /** 路由路径（必须与 App.tsx 注册的非重定向路由一致） */
  href: string
  /** 前端模块守卫使用的模块码（与 App.tsx / 后端 module-guard 对齐） */
  module?: string
  /** 路由允许多个模块中的任意一个（与 App.tsx anyModules 对齐；用于 route 生成与对等校验） */
  anyModules?: string[]
  /** 路由额外要求的角色白名单（与 App.tsx roles 对齐） */
  roles?: string[]
  /** 归属的顶层工作面 */
  group: NavGroupKey
  /** 所属折叠分组（可选；同一 parent 的条目会聚合为一个二级折叠） */
  parent?: string
  /** 平台限定（不填 = 全平台可见） */
  platforms?: string[]
  /** 路由重定向目标（迁移期经典路由 → AI 运营分支） */
  redirect?: string
  /** 路由渲染组件（由 nav manifest 直接驱动 <Route> 生成） */
  component?: ComponentType<any>
  /** 组件 props（如 UnifiedDashboardHub 的 defaultView） */
  props?: Record<string, unknown>
  /** 依赖的部署功能范围；FEATURE_SCOPE=core 时该入口会被隐藏并阻断直达 */
  feature?: 'full'
}

/** 9 个运营工作面（顺序即侧栏顺序） */
export const NAV_GROUP_TITLES: Record<NavGroupKey, string> = {
  today: '今日作战',
  session: '场次',
  assortment: '货盘',
  traffic: '流量与投放',
  fulfillment: '订单履约售后',
  content: '内容与达人',
  people: '人与钱',
  data: '数据',
  system: '系统',
}

export const NAV_MANIFEST: NavManifestEntry[] = [
  // ── 1 今日作战 ──────────────────────────────────────────────
  // W2.5：角色工作台（路由在 App.tsx 显式注册；此处仅提供菜单与面包屑）
  { label: '我的工作台', href: '/workbench', group: 'today' },
  { label: '首页', href: '/overview/home', module: 'overview', group: 'today', component: lazyPage(() => import('@/pages/overview/PlatformAwareHomePage'), 'PlatformAwareHomePage') },
  { label: '经营驾驶舱', href: '/overview/cockpit', module: 'overview', group: 'today', parent: '经营与看板', props: { defaultView: 'cockpit' }, component: lazyPage(() => import('@/pages/bi/UnifiedDashboardHub'), 'UnifiedDashboardHub') },
  { label: '实时监控', href: '/overview/live-monitor', module: 'overview', group: 'today', parent: '经营与看板', component: lazyPage(() => import('@/pages/overview/LiveMonitorPage'), 'LiveMonitorPage') },
  { label: '数据分析', href: '/overview/analytics', module: 'overview', group: 'today', parent: '经营与看板', component: lazyPage(() => import('@/pages/overview/AnalyticsPage'), 'AnalyticsPage') },
  { label: '全渠道大盘', href: '/omnichannel/dashboard', module: 'overview', group: 'today', parent: '经营与看板', props: { defaultView: 'omnichannel' }, component: lazyPage(() => import('@/pages/bi/UnifiedDashboardHub'), 'UnifiedDashboardHub') },
  { label: '店铺经营看板', href: '/shop/overview', module: 'overview', group: 'today', parent: '经营与看板', component: lazyPage(() => import('@/pages/shop/ShopOverviewPage'), 'ShopOverviewPage') },
  { label: '目标达成', href: '/ops/goal-tracking', module: 'ops', group: 'today', parent: '待办与目标', component: lazyPage(() => import('@/pages/ops/GoalTrackingPage'), 'GoalTrackingPage') },
  { label: '改进任务', href: '/system/tasks', module: 'system_tasks', anyModules: ['system_tasks', 'ops'], group: 'today', parent: '待办与目标', component: lazyPage(() => import('@/pages/system/ImprovementTasksPage'), 'ImprovementTasksPage') },
  { label: '问题库', href: '/ops/issue-library', module: 'ops', group: 'today', parent: '待办与目标', component: lazyPage(() => import('@/pages/ops/IssueLibraryPage'), 'IssueLibraryPage') },
  { label: '异常中心', href: '/system/alerts', module: 'system_alerts', group: 'today', parent: '待办与目标', component: lazyPage(() => import('@/pages/system/AlertCenterPage'), 'AlertCenterPage') },

  // ── 2 场次 ────────────────────────────────────────────────
  { label: '场次管理', href: '/overview/sessions', module: 'session', group: 'session', props: { defaultView: 'sessions' }, component: lazyPage(() => import('@/pages/ops/schedule/UnifiedScheduleHub'), 'UnifiedScheduleHub') },
  { label: '场次排品', href: '/ops/session-products', module: 'session_products', group: 'session', props: { defaultView: 'products' }, component: lazyPage(() => import('@/pages/ops/schedule/UnifiedScheduleHub'), 'UnifiedScheduleHub') },
  { label: '智能排品推荐', href: '/ops/assortment-recommend', module: 'session_products', group: 'session', component: lazyPage(() => import('@/pages/ops/AssortmentRecommendPage'), 'AssortmentRecommendPage') },
  { label: '直播间健康度', href: '/ops/room-health', module: 'ops', group: 'session', component: lazyPage(() => import('@/pages/ops/RoomHealthPage'), 'RoomHealthPage') },
  { label: '多直播间总览', href: '/system/multi-room', module: 'system_multiroom', group: 'session', component: lazyPage(() => import('@/pages/system/MultiRoomOverviewPage'), 'MultiRoomOverviewPage') },
  { label: '个人达成', href: '/live/attendance', module: 'personal_achievement', group: 'session', parent: '人工登记', component: lazyPage(() => import('@/pages/live/AttendancePage'), 'AttendancePage') },
  { label: '直播登记', href: '/live/registration', module: 'live_registration', group: 'session', parent: '人工登记', component: lazyPage(() => import('@/pages/live/LiveRegistrationPage'), 'LiveRegistrationPage') },
  { label: '登记数据管理', href: '/live/data', module: 'live_data', group: 'session', parent: '人工登记', component: lazyPage(() => import('@/pages/live/DataLivePage'), 'DataLivePage') },
  { label: '主播效能', href: '/review/anchors', module: 'review_anchors', group: 'session', parent: '直播复盘', redirect: '/ai-ops/people/performance' },
  { label: '改进闭环', href: '/review/closed-loop', module: 'review_closed_loop', group: 'session', parent: '直播复盘', redirect: '/ai-ops/session/actions' },

  // ── 3 货盘 ────────────────────────────────────────────────
  { label: '商品结构分析', href: '/shop/products', module: 'product_center', group: 'assortment', component: lazyPage(() => import('@/pages/shop/ShopProductsPage'), 'ShopProductsPage') },
  { label: '商品主数据与库存', href: '/ops/inventory', module: 'product_center', group: 'assortment', component: lazyPage(() => import('@/pages/ops/product-center/InventoryCenterPage'), 'InventoryCenterPage') },

  // ── 4 流量与投放 ──────────────────────────────────────────
  { label: '全域投放与净ROI', href: '/ops/net-roi', module: 'net_roi', roles: ['super_admin', 'ops_director', 'ad_buyer'], group: 'traffic', component: lazyPage(() => import('@/pages/ops/net-roi/NetRoiPage'), 'NetRoiPage') },
  { label: '抖音短视频引流', href: '/insights/douyin/short-video', module: 'review_channels', group: 'traffic', parent: '平台流量洞察', platforms: ['douyin'], component: lazyPage(() => import('@/pages/shop/douyin/DouyinShortVideoFunnelPage'), 'DouyinShortVideoFunnelPage') },
  { label: '抖音三池统一调度', href: '/insights/douyin/three-pools', module: 'review_channels', group: 'traffic', parent: '平台流量洞察', platforms: ['douyin'], component: PlatformInsightPage },
  { label: '快手公私域流量', href: '/shop/kuaishou/traffic-split', module: 'bi', group: 'traffic', parent: '平台流量洞察', platforms: ['kuaishou'], component: lazyPage(() => import('@/pages/shop/kuaishou/KsTrafficSplitPage'), 'KsTrafficSplitPage') },
  { label: '快手间接成交', href: '/shop/kuaishou/indirect-gmv', module: 'bi', group: 'traffic', parent: '平台流量洞察', platforms: ['kuaishou'], component: lazyPage(() => import('@/pages/shop/kuaishou/KsIndirectGmvPage'), 'KsIndirectGmvPage') },
  { label: '视频号公私域', href: '/insights/wechat/private-public', module: 'review_channels', group: 'traffic', parent: '平台流量洞察', platforms: ['wechat'], component: lazyPage(() => import('@/pages/shop/wechat/WechatPrivatePublicPage'), 'WechatPrivatePublicPage') },
  { label: '活动管理', href: '/system/promotions', module: 'system_promotions', anyModules: ['system_promotions', 'ops'], group: 'traffic', parent: '营销与竞品', component: lazyPage(() => import('@/pages/system/PromotionCampaignsPage'), 'PromotionCampaignsPage') },
  { label: '竞品观察', href: '/system/competitors', module: 'system_competitors', anyModules: ['system_competitors', 'ops'], group: 'traffic', parent: '营销与竞品', component: lazyPage(() => import('@/pages/system/CompetitorWatchPage'), 'CompetitorWatchPage') },

  // ── 6 内容生态 ────────────────────────────────────────────
  { label: '视频号全域带货', href: '/insights/wechat/affiliate', module: 'anchor', group: 'content', parent: '视频号内容', platforms: ['wechat'], component: PlatformInsightPage },
  { label: '视频号图文内容', href: '/insights/wechat/content', module: 'content', group: 'content', parent: '视频号内容', platforms: ['wechat'], component: PlatformInsightPage },

  // ── 7 人与钱 ──────────────────────────────────────────────
  { label: '话术库', href: '/ops/script-library', module: 'ops', anyModules: ['ops', 'anchor'], group: 'people', component: lazyPage(() => import('@/pages/anchors/ScriptTemplatesPage'), 'ScriptTemplatesPage') },
  { label: '主播列表', href: '/anchors/list', module: 'anchor', group: 'people', parent: '主播', component: lazyPage(() => import('@/pages/anchors/AnchorListPage'), 'AnchorListPage') },
  { label: '主播档案', href: '/anchors/profile', module: 'anchor', group: 'people', parent: '主播', component: lazyPage(() => import('@/pages/anchors/AnchorCenterPage'), 'AnchorCenterPage') },
  { label: '直播排班', href: '/anchors/live-schedule', module: 'anchor', group: 'people', parent: '排班与绩效', props: { defaultView: 'calendar' }, component: lazyPage(() => import('@/pages/ops/schedule/UnifiedScheduleHub'), 'UnifiedScheduleHub') },
  { label: '排班设置', href: '/anchors/schedule', module: 'anchor', group: 'people', parent: '排班与绩效', props: { defaultView: 'management' }, component: lazyPage(() => import('@/pages/ops/schedule/UnifiedScheduleHub'), 'UnifiedScheduleHub') },

  // ── 8 数据 ────────────────────────────────────────────────
  { label: '数据管理', href: '/data/management', module: 'data', group: 'data', component: lazyPage(() => import('@/pages/data/DataManagementPage'), 'DataManagementPage') },
  { label: '数据上传', href: '/data/upload', module: 'data', group: 'data', component: lazyPage(() => import('@/pages/data/DataUploadPage'), 'DataUploadPage') },
  { label: '上传数据管理', href: '/data/uploaded-data', module: 'data', group: 'data', component: lazyPage(() => import('@/pages/data/UploadedDataPage'), 'UploadedDataPage') },
  { label: '多平台接入（自定义清洗）', href: '/data/ingest', module: 'data', group: 'data', component: lazyPage(() => import('@/pages/data/IngestWizardPage'), 'IngestWizardPage') },
  { label: '数据质量', href: '/data/quality', module: 'data', group: 'data', component: lazyPage(() => import('@/pages/data/DataQualityPage'), 'DataQualityPage') },

  // ── 9 系统 ────────────────────────────────────────────────
  { label: '账号管理', href: '/system/users', module: 'system_users', roles: ['super_admin'], group: 'system', parent: '系统运维', component: lazyPage(() => import('@/pages/system/UsersPage'), 'UsersPage') },
  { label: '角色与模块权限', href: '/system/roles', module: 'system_users', roles: ['super_admin'], group: 'system', parent: '系统运维', component: lazyPage(() => import('@/pages/system/RolesPage'), 'RolesPage') },
  { label: '运营人员管理', href: '/system/personnel', module: 'system_personnel_ops', group: 'system', parent: '系统运维', component: lazyPage(() => import('@/pages/system/PersonnelPage'), 'PersonnelPage') },
  { label: '平台与渠道管理', href: '/system/platforms', module: 'system_users', roles: ['super_admin'], group: 'system', parent: '系统运维', component: lazyPage(() => import('@/pages/system/PlatformManagementPage'), 'PlatformManagementPage') },
  { label: '直播间管理', href: '/system/rooms', module: 'system_rooms', group: 'system', parent: '系统运维', component: lazyPage(() => import('@/pages/system/RoomsPage'), 'RoomsPage') },
  { label: '系统配置', href: '/system/config', module: 'system_config', roles: ['super_admin'], group: 'system', parent: '系统运维', component: lazyPage(() => import('@/pages/system/SystemConfigPage'), 'SystemConfigPage') },
  { label: '模块热插拔', href: '/system/modules', module: 'system_config', roles: ['super_admin'], group: 'system', parent: '系统运维', component: lazyPage(() => import('@/pages/system/ModuleManagementPage'), 'ModuleManagementPage') },
  { label: '操作审计日志', href: '/system/audit-logs', module: 'audit_logs', roles: ['super_admin'], group: 'system', parent: '系统运维', component: lazyPage(() => import('@/pages/system/AuditLogsPage'), 'AuditLogsPage') },
  { label: '合规风控雷达', href: '/compliance/rules', module: 'compliance', group: 'system', parent: '合规风控', component: lazyPage(() => import('@/pages/compliance/RuleRadarPage'), 'RuleRadarPage') },
  { label: '违规事件看板', href: '/compliance/events', module: 'compliance', group: 'system', parent: '合规风控', component: lazyPage(() => import('@/pages/system/CompliancePage'), 'CompliancePage') },
]

/** 导航索引：按 href 查表（供面包屑 / 搜索 / 未来路由生成复用，避免各组件各维护一份映射） */
const NAV_INDEX = new Map(NAV_MANIFEST.map((e) => [e.href, e]))

export function navEntryFor(path: string): NavManifestEntry | undefined {
  return NAV_INDEX.get(path)
}

export function navEntries(): NavManifestEntry[] {
  return NAV_MANIFEST
}
