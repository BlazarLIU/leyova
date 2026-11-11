import {
  LayoutDashboard,          // 总览
  BarChart3,                // 驾驶舱
  Radio,                    // 实时监控
  CalendarDays,             // 个人达成
  ClipboardPlus,            // 直播登记
  TrendingUp,               // 数据分析
  Globe,                    // 全渠道大盘
  Table,                    // 直播数据管理
  Monitor,                  // 多直播间总览
  // ---- 应用 ----
  Bot,                      // AI 助手
  Database,                 // 数据管理
  Clapperboard,             // 内容中心
  LineChart,                // 商业智能
  Mic,                      // 主播赋能
  Zap,                      // 运营提效
  BarChart4,                // 直播复盘
  Building2,                // MCN 代运营
  CloudSun,                 // 天气 AI 穿搭
  // ---- 系统 ----
  Settings,                 // 系统配置
  AlertTriangle,            // 异常中心
} from 'lucide-react'
import type { NavSection } from '@/types'

export const navigation: NavSection[] = [
  // ────────────────────────────────────
  // 第一部分：总览
  // ────────────────────────────────────
  {
    title: '总览',
    items: [
      { label: '首页', icon: LayoutDashboard, href: '/overview/home', module: 'overview' },
      { label: '经营驾驶舱', icon: BarChart3, href: '/overview/cockpit', module: 'overview' },
      { label: '多直播间总览', icon: Monitor, href: '/system/multi-room', module: 'overview' },
      { label: '实时监控', icon: Radio, href: '/overview/live-monitor', module: 'overview' },
      { label: '数据分析', icon: TrendingUp, href: '/overview/analytics', module: 'overview' },
      { label: '全渠道大盘', icon: Globe, href: '/omnichannel/dashboard', module: 'overview' },
      { label: '经营分析工作台', icon: Bot, href: '/ai/workbench', module: 'overview' },
    ],
  },

  // ────────────────────────────────────
  // 直播管理
  // ────────────────────────────────────
  {
    title: '直播管理',
    items: [
      { label: '个人达成', icon: CalendarDays, href: '/live/attendance', module: 'personal_achievement' },
      { label: '直播登记', icon: ClipboardPlus, href: '/live/registration', module: 'live_registration' },
      { label: '登记数据管理', icon: Table, href: '/live/data', module: 'live_data' },
    ],
  },

  // ────────────────────────────────────
  // 第二部分：应用
  // ────────────────────────────────────
  {
    title: '应用',
    items: [
      // AI 助手（带 New 徽标）
      {
        label: 'AI 助手',
        icon: Bot,
        href: '/ai/chat',
        badge: 'New',
        module: 'ai',
      },
      {
        label: '天气AI穿搭',
        icon: CloudSun,
        href: '/ai/weather',
        badge: '特色',
        module: 'ai',
      },

      // 内容中心（折叠组）
      {
        label: '内容中心',
        icon: Clapperboard,
        module: 'content',
        children: [
          { label: '视频创作', href: '/content/video-create', module: 'content' },
          { label: '视频数据', href: '/content/video-data', module: 'content' },
          { label: '中心配置', href: '/content/config', module: 'content' },
          { label: '中心配置(生成服务/知识库)', href: '/content/center-config', module: 'system_ai' },
        ],
      },

      // 商业智能（折叠组）
      {
        label: '商业智能',
        icon: LineChart,
        module: 'bi',
        children: [
          { label: 'BI仪表盘', href: '/bi/dashboard' },
          { label: 'ROI看板', href: '/bi/roi' },
          // { label: '退款分析', href: '/bi/refund-analysis' },
          { label: '异常检测', href: '/bi/anomaly-detection' },
        ],
      },

      // 主播赋能（折叠组）
      {
        label: '主播赋能',
        icon: Mic,
        module: 'anchor',
        children: [
          { label: '主播列表', href: '/anchors/list', module: 'anchor' },
          { label: '主播档案', href: '/anchors/profile', module: 'anchor' },
          { label: '我的排班', href: '/anchors/my-schedule', module: 'personal_achievement' },
          { label: '排班管理', href: '/anchors/schedule', module: 'anchor' },
          { label: 'AI智能排班', href: '/anchors/schedule-recommend', module: 'anchor' },
          { label: '我的业绩', href: '/anchors/my-performance', module: 'personal_achievement' },
          { label: '训练管理', href: '/anchors/training', module: 'anchor' },
        ],
      },

      // 运营提效（折叠组）
      {
        label: '运营提效',
        icon: Zap,
        module: 'ops',
        children: [
          { label: '能力看板', href: '/ops/capabilities', module: 'ops' },
          { label: '成本与净利', href: '/ops/costs', module: 'ops' },
          { label: '话术模板', href: '/ops/script-library', module: 'ops' },
          { label: '问题库', href: '/ops/issue-library', module: 'ops' },
          { label: '目标达成', href: '/ops/goal-tracking', module: 'ops' },
          { label: '直播间健康度', href: '/ops/room-health', module: 'ops' },
          { label: '场次排品', href: '/ops/session-products', module: 'session_products' },
          { label: '改进任务', href: '/system/tasks', module: 'system_tasks' },
          { label: '活动管理', href: '/system/promotions', module: 'system_promotions' },
          { label: '竞品观察', href: '/system/competitors', module: 'system_competitors' },
        ],
      },

      // MCN 代运营中心（对外 SaaS）
      {
        label: 'MCN 代运营',
        icon: Building2,
        module: 'agency',
        children: [
          { label: '品牌客户档案', href: '/agency/clients', module: 'agency' },
          { label: '代播项目合同', href: '/agency/projects', module: 'agency' },
          { label: '月结对账单', href: '/agency/settlement', module: 'agency' },
          { label: '品牌方只读看板', href: '/brand-portal', module: 'agency' },
        ],
      },

      // 直播复盘（折叠组）
      {
        label: '直播复盘',
        icon: BarChart4,
        module: 'review',
        children: [
          { label: '复盘总览',       href: '/review/overview',   module: 'review_overview' },
          { label: '商品分析',       href: '/review/products',   module: 'review' },
          { label: '短视频引流分析',  href: '/review/short-videos', module: 'review' },
          { label: '渠道流量分析',   href: '/review/channels',   module: 'review_channels' },
          { label: '主播效能分析',   href: '/review/anchors',    module: 'review_anchors' },
          { label: '转化漏斗分析',   href: '/review/funnel',     module: 'review_funnel' },
          { label: '改进闭环',       href: '/review/closed-loop', module: 'review_closed_loop' },
        ],
      },

      // 数据管理（折叠组）
      {
        label: '数据管理',
        icon: Database,
        module: 'data',
        children: [
          { label: '数据管理', href: '/data/management' },
          { label: '数据上传', href: '/data/upload' },
          { label: '多平台接入', href: '/data/ingest' },
          { label: '上传数据管理', href: '/data/uploaded-data' },
          { label: '数据质量', href: '/data/quality' },
        ],
      },
    ],
  },

  // ────────────────────────────────────
  // 第三部分：系统
  // ────────────────────────────────────
  {
    title: '系统',
    items: [
      { label: '系统配置', icon: Settings, href: '/system/config', module: 'system_config' },
      { label: '账号管理', icon: Settings, href: '/system/users', module: 'system_users' },
      { label: '操作审计日志', icon: Settings, href: '/system/audit-logs', module: 'system_users' },
      { label: '异常中心', icon: AlertTriangle, href: '/system/alerts', module: 'system_alerts' },
    ],
  },
]