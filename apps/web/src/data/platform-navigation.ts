/**
 * platform-navigation.ts — 按平台业态组织信息架构
 *
 * 设计原则（对齐工作计划 2.2 与平台属性）：
 *   不同平台的经营对象根本不同，菜单不该是同一套模板删减：
 *
 *   ┌ 直播电商（抖音/快手）───────────────────────────────
 *   │ 核心对象：直播间 / 场次 / 主播
 *   │ 主链路：场次 GMV → 流量结构 → 转化漏斗 → 主播效能 → 复盘
 *   └────────────────────────────────────────────────
 *
 *   ┌ 货架电商（淘宝/天猫）──────────────────────────────────
 *   │ 核心对象：店铺 / 商品 SKU / 活动
 *   │ 主链路：店铺成交 → 商品结构 → 流量渠道 → 投放 ROI → 退款
 *   │ 没有直播场次概念，绝不该出现「直播复盘」「主播赋能」
 *   └────────────────────────────────────────────────
 *
 *   ┌ 内容种草（小红书）───────────────────────────────
 *   │ 核心对象：笔记 / 达人 / 店铺
 *   │ 主链路：笔记曝光 → 互动 → 种草人群 → 搜索回搜 → 成交
 *   └────────────────────────────────────────────────
 *
 * 三类平台共用的部分（数据接入、AI 分析、系统管理）保持稳定，
 * 因为那是「能力」而非「业务」。
 */

import {
  LayoutDashboard, BarChart3, Monitor, Radio, TrendingUp, Globe, Bot,
  CalendarDays, ClipboardPlus, Table, Clapperboard, LineChart, Mic, Zap,
  BarChart4, Database, Settings, Store, Package,
  Megaphone, Users, MessageSquare, TrendingDown, FileText, Film, Home, Shield,
  BookKey, Layers, Compass,
} from 'lucide-react'
import type { NavSection, NavSubItem } from '@/types'

export type PlatformMode = 'live' | 'shelf' | 'content'

/** 平台能力（来自后端 capabilities） */
export interface PlatformCapability {
  supportsLive: boolean
  supportsShelf: boolean
  supportsContent: boolean
  supportsAds: boolean
  /** 平台标识，用于按平台分流专属页面 */
  platformCode?: string
}

/** 判断平台应使用哪种信息架构 */
export function resolvePlatformMode(
  cap?: (PlatformCapability & { platformCode?: string }) | null,
  platformCode?: string,
): PlatformMode {
  if (!cap) return 'live'
  const code = platformCode || cap.platformCode
  // 直播能力最独特，优先；小红书以内容种草为核心主模式；淘系保持货架主模式并辅以内容中心入口
  if (cap.supportsLive) return 'live'
  if (code === 'xiaohongshu') return 'content'
  if (cap.supportsShelf) return 'shelf'
  if (cap.supportsContent) return 'content'
  return 'shelf'
}

// ═══════════════════════════════════════════════════════════════
// 通用部分（所有平台共享）
// ═══════════════════════════════════════════════════════════════

/** 总览：随业态变化 */
function buildOverviewSection(mode: PlatformMode): NavSection {
  const items: NavSection['items'] = [
    { label: '首页', icon: LayoutDashboard, href: '/overview/home', module: 'overview' },
  ]

  if (mode === 'live') {
    items.push(
      { label: '经营驾驶舱', icon: BarChart3, href: '/overview/cockpit', module: 'overview' },
      { label: '多直播间总览', icon: Monitor, href: '/system/multi-room', module: 'system_multiroom' },
      { label: '实时监控', icon: Radio, href: '/overview/live-monitor', module: 'overview' },
      { label: '数据分析', icon: TrendingUp, href: '/overview/analytics', module: 'overview' },
    )
  } else if (mode === 'shelf') {
    items.push(
      { label: '店铺经营看板', icon: Store, href: '/shop/overview', module: 'overview' },
      { label: '数据分析', icon: TrendingUp, href: '/overview/analytics', module: 'overview' },
    )
  } else {
    // content
    items.push(
      { label: '店铺经营看板', icon: Store, href: '/shop/overview', module: 'overview' },
      { label: '数据分析', icon: TrendingUp, href: '/overview/analytics', module: 'overview' },
    )
  }

  items.push(
    { label: '全渠道大盘', icon: Globe, href: '/omnichannel/dashboard', module: 'overview' },
    { label: '经营分析工作台', icon: Bot, href: '/ai/workbench', module: 'overview' },
  )

  return { title: '总览', items }
}

/** 数据管理：所有平台都需要，但上传口径不同 */
function buildDataSection(mode: PlatformMode): NavSection {
  const children: NavSubItem[] = [
    { label: '数据管理', href: '/data/management' },
  ]

  if (mode === 'live') {
    children.push({ label: '直播数据上传', href: '/data/upload' })
  } else if (mode === 'shelf') {
    children.push({ label: '店铺数据上传', href: '/data/upload' })
  } else {
    children.push({ label: '笔记数据上传', href: '/data/upload' })
  }

  children.push(
    { label: '多平台接入（自定义清洗）', href: '/data/ingest' },
    { label: '上传数据管理', href: '/data/uploaded-data' },
    { label: '数据质量', href: '/data/quality' },
  )

  return {
    title: '数据管理',
    items: [
      { label: '数据管理', icon: Database, module: 'data', children },
    ],
  }
}

/** 智能分析（所有平台共享，但入口文案随业态） */
function buildAiSection(mode: PlatformMode): NavSection {
  const label = mode === 'shelf' ? 'AI 店铺助手' : 'AI 助手'

  return {
    title: '智能分析',
    items: [
      { label, icon: Bot, href: '/ai/chat', module: 'ai' },
      {
        label: '商业智能',
        icon: LineChart,
        module: 'bi',
        children: [
          { label: 'BI 仪表盘', href: '/bi/dashboard' },
          { label: '全域投放与净ROI', href: '/ops/net-roi', module: 'net_roi' },
          { label: '退款分析', href: '/bi/refund-analysis' },
          { label: '异常检测', href: '/bi/anomaly-detection' },
        ],
      },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════
// 直播电商专属：抖音 / 快手
// ═══════════════════════════════════════════════════════════════

function buildLiveSections(platformCode?: string): NavSection[] {
  const isKuaishou = platformCode === 'kuaishou'

  return [
    {
      // 人工登记分组：纯手工录入，独立模块，不参与任何分析计算
      // 复盘/驾驶舱用的场次数据来自官方 API 或手动上传（走「数据管理」）
      title: '人工登记',
      items: [
        { label: '个人达成', icon: CalendarDays, href: '/live/attendance', module: 'personal_achievement' },
        { label: '直播登记', icon: ClipboardPlus, href: '/live/registration', module: 'live_registration' },
        { label: '登记数据管理', icon: Table, href: '/live/data', module: 'live_data' },
      ],
    },
    {
      title: '主播赋能',
      items: [
        {
          label: '主播管理',
          icon: Mic,
          module: 'anchor',
          children: [
            { label: '主播列表', href: '/anchors/list' },
            { label: '主播档案', href: '/anchors/profile' },
            { label: '我的排班', href: '/anchors/my-schedule' },
            { label: '直播排班', href: '/anchors/live-schedule' },
            { label: '排班设置', href: '/anchors/schedule' },
            { label: 'AI智能排班', href: '/anchors/schedule-recommend' },
            { label: '我的业绩', href: '/anchors/my-performance' },
            { label: '训练管理', href: '/anchors/training' },
            { label: '话术模板', href: '/ops/script-library' },
            { label: '能力看板', href: '/ops/capabilities' },
            { label: 'HRBP 工作台', href: '/hrbp/workspace' },
          ],
        },
      ],
    },
    ...(isKuaishou ? [{
      title: '快手私域经营',
      items: [
        { label: '公私域流量分析', icon: Home, href: '/shop/kuaishou/traffic-split', module: 'bi' },
        { label: '间接成交分析', icon: Zap, href: '/shop/kuaishou/indirect-gmv', module: 'bi' },
        { label: '粉丝团运营', icon: Users, href: '/shop/kuaishou/fans-team', module: 'ops' },
      ],
    } as NavSection] : []),
    {
      title: '直播复盘',
      items: [
        {
          label: '复盘分析',
          icon: BarChart4,
          module: 'review',
          children: [
            { label: '复盘总览', href: '/review/overview', module: 'review_overview' },
            { label: '商品分析', href: '/review/products', module: 'review' },
            { label: '短视频引流', href: '/review/short-videos', module: 'review' },
            { label: '渠道流量', href: '/review/channels', module: 'review_channels' },
            { label: '主播效能', href: '/review/anchors', module: 'review_anchors' },
            { label: '转化漏斗', href: '/review/funnel', module: 'review_funnel' },
            { label: '改进闭环', href: '/review/closed-loop', module: 'review_closed_loop' },
          ],
        },
      ],
    },
    {
      title: '运营提效',
      items: [
        {
          label: '运营工具',
          icon: Zap,
          module: 'ops',
          children: [
            { label: '场次管理', href: '/overview/sessions', module: 'session' },
            { label: '场次排品', href: '/ops/session-products', module: 'session_products' },
            { label: 'AI 全品类选品', href: '/ai/selection', module: 'ai' },
            { label: '话术模板', href: '/ops/script-library', module: 'ops' },
            ...(platformCode === 'douyin' ? [
              { label: '短视频引流→直播承接', href: '/insights/douyin/short-video', module: 'review_channels' },
              { label: '三池统一调度', href: '/insights/douyin/three-pools', module: 'review_channels' },
            ] : []),
            ...(platformCode === 'wechat' ? [
              { label: '公私域流量拆分', href: '/insights/wechat/private-public', module: 'review_channels' },
              { label: '全域带货者', href: '/insights/wechat/affiliate', module: 'anchor' },
              { label: '短视频与公众号图文', href: '/insights/wechat/content', module: 'content' },
            ] : []),
            { label: '直播间健康度', href: '/ops/room-health', module: 'ops' },
            { label: '全域投放与T+7净ROI', href: '/ops/net-roi', module: 'net_roi' },
            { label: '搜索词卡位', href: '/ops/search-keywords', module: 'search_seo' },
            { label: '会员与私域', href: '/ops/members', module: 'members' },
            { label: '商品主数据与库存', href: '/ops/inventory', module: 'product_center' },
            { label: '履约SLA与赔付风控', href: '/ops/fulfillment', module: 'fulfillment' },
            { label: '售后工单与原因归因', href: '/ops/after-sales', module: 'after_sales' },
            { label: '达人合作与佣金', href: '/ops/kol', module: 'kol' },
            { label: '客服响应与绩效', href: '/ops/cs', module: 'customer_service' },
            { label: '改进任务', href: '/system/tasks', module: 'system_tasks' },
            { label: '活动管理', href: '/system/promotions', module: 'system_promotions' },
            { label: '竞品观察', href: '/system/competitors', module: 'system_competitors' },
            { label: '问题库', href: '/ops/issue-library', module: 'ops' },
            { label: '目标达成', href: '/ops/goal-tracking', module: 'ops' },
          ],
        },
        {
          label: '内容创作',
          icon: Clapperboard,
          module: 'content',
          children: [
            { label: '内容排产与归因', href: '/content/schedule', module: 'content_schedule' },
            { label: '视频创作', href: '/content/video-create', module: 'content' },
            { label: '视频数据', href: '/content/video-data', module: 'content' },
            { label: '生成服务配置', href: '/content/center-config', module: 'content' },
          ],
        },
      ],
    },
  ]
}

// ═══════════════════════════════════════════════════════════════
// 货架电商专属：淘宝 / 天猫（京东/拼多多已于 2026-11-14 移除）
// ═══════════════════════════════════════════════════════════════

function buildShelfSections(platformCode?: string): NavSection[] {
  // 淘宝/天猫走专属经营看板（含父子订单、支付转化率、万相台对账）
  const isTaobaoFamily = platformCode === 'taobao' || platformCode === 'tmall'
  const shopBoardHref = isTaobaoFamily
    ? '/shop/taobao/board'
    : '/shop/overview'

  return [
    {
      title: '店铺经营',
      items: [
        { label: isTaobaoFamily ? '店铺经营看板（淘系）' : '店铺经营看板', icon: Store, href: shopBoardHref, module: 'overview' },
        ...(isTaobaoFamily ? [
          { label: '店铺×场次联动', icon: Radio, href: '/insights/taobao/shop-session', module: 'overview' },
          { label: '直播三源流量', icon: Layers, href: '/insights/taobao/three-sources', module: 'review_channels' },
        ] : []),
        ...(platformCode === 'tmall' ? [
          { label: '品牌×场次', icon: Store, href: '/insights/tmall/brand-sessions', module: 'session' },
          { label: '五层抵扣规则', icon: Layers, href: '/insights/tmall/promotion-layers', module: 'system_promotions' },
          { label: '直播与官方立减联动', icon: Megaphone, href: '/insights/tmall/live-promo-link', module: 'review_channels' },
        ] : []),
        {
          label: '流量与投放',
          icon: Megaphone,
          module: 'ops',
          children: isTaobaoFamily
            ? [
              { label: '商品与渠道结构', href: '/shop/taobao/product-channel' },
              { label: '渠道流量分析', href: '/review/channels', module: 'review_channels' },
              { label: '万相台投放对账', href: '/shop/taobao/ad-reconciliation' },
              { label: '全域投放与T+7净ROI', href: '/ops/net-roi', module: 'net_roi' },
              { label: '搜索词卡位', href: '/ops/search-keywords', module: 'search_seo' },
            ]
            : [
              { label: '渠道流量分析', href: '/review/channels', module: 'review_channels' },
              { label: '全域投放与T+7净ROI', href: '/ops/net-roi', module: 'net_roi' },
              { label: '搜索词卡位', href: '/ops/search-keywords', module: 'search_seo' },
            ],
        },
        {
          label: '售后与退款',
          icon: TrendingDown,
          module: 'bi',
          children: [
            { label: '售后工单与原因归因', href: '/ops/after-sales', module: 'after_sales' },
            { label: '退款分析', href: '/bi/refund-analysis' },
            { label: '异常检测', href: '/bi/anomaly-detection' },
          ],
        },
      ],
    },
    {
      title: '商品中心',
      items: [
        {
          label: '商品管理',
          icon: Package,
          module: 'product_center',
          children: [
            { label: '商品结构分析', href: '/shop/products', module: 'product_center' },
            { label: '商品主数据与库存', href: '/ops/inventory', module: 'product_center' },
            { label: '竞品价格观察', href: '/system/competitors', module: 'system_competitors' },
          ],
        },
      ],
    },
    {
      title: '店铺运营',
      items: [
        {
          label: '运营工具',
          icon: Zap,
          module: 'ops',
          children: [
            { label: 'AI 全品类选品', href: '/ai/selection', module: 'ai' },
            { label: '履约SLA与赔付风控', href: '/ops/fulfillment', module: 'fulfillment' },
            { label: '客服响应与绩效', href: '/ops/cs', module: 'customer_service' },
            { label: '达人合作与佣金', href: '/ops/kol', module: 'kol' },
            { label: '会员与私域', href: '/ops/members', module: 'members' },
            ...(isTaobaoFamily ? [{ label: '内容排产与归因', href: '/content/schedule', module: 'content_schedule' }] : []),
            { label: '目标达成', href: '/ops/goal-tracking', module: 'ops' },
            { label: '活动管理', href: '/system/promotions', module: 'system_promotions' },
            { label: '改进任务', href: '/system/tasks', module: 'system_tasks' },
            { label: '问题库', href: '/ops/issue-library', module: 'ops' },
          ],
        },
      ],
    },
  ]
}

// ═══════════════════════════════════════════════════════════════
// 内容种草专属：小红书
// ═══════════════════════════════════════════════════════════════

function buildContentSections(): NavSection[] {
  return [
    {
      title: '内容经营',
      items: [
        { label: '笔记经营看板', icon: FileText, href: '/shop/xiaohongshu/notes', module: 'content' },
        { label: '笔记→直播→成交', icon: TrendingUp, href: '/insights/xiaohongshu/note-live', module: 'content' },
        { label: '直播流量来源', icon: Compass, href: '/insights/xiaohongshu/traffic-sources', module: 'review_channels' },
        { label: '买手画像', icon: Mic, href: '/insights/xiaohongshu/buyer-profile', module: 'anchor' },
        { label: '蒲公英达人合作', icon: Users, href: '/insights/xiaohongshu/dandelion', module: 'kol' },
        {
          label: '内容分析',
          icon: Film,
          module: 'content',
          children: [
            { label: '种草转化链路', href: '/shop/xiaohongshu/conversion', module: 'content' },
            { label: '内容排产与归因', href: '/content/schedule', module: 'content_schedule' },
            { label: '笔记数据', href: '/content/video-data', module: 'content' },
            { label: '搜索词卡位', href: '/ops/search-keywords', module: 'search_seo' },
            { label: '全域投放与T+7净ROI', href: '/ops/net-roi', module: 'net_roi' },
          ],
        },
        {
          label: '内容创作',
          icon: Clapperboard,
          module: 'content',
          children: [
            { label: '图文/视频创作', href: '/content/video-create', module: 'content' },
            { label: '生成服务配置', href: '/content/center-config', module: 'content' },
          ],
        },
      ],
    },
    {
      title: '达人合作',
      items: [
        {
          label: '达人合作与佣金',
          icon: Users,
          module: 'kol',
          children: [
            { label: '达人排期与佣金台账', href: '/ops/kol', module: 'kol' },
          ],
        },
        { label: '竞品笔记监测', icon: MessageSquare, href: '/system/competitors', module: 'system_competitors' },
      ],
    },
    {
      title: '店铺转化',
      items: [
        {
          label: '经营工具',
          icon: Zap,
          module: 'ops',
          children: [
            { label: 'AI 全品类选品', href: '/ai/selection', module: 'ai' },
            { label: '商品主数据与库存', href: '/ops/inventory', module: 'product_center' },
            { label: '履约SLA与赔付风控', href: '/ops/fulfillment', module: 'fulfillment' },
            { label: '售后工单与原因归因', href: '/ops/after-sales', module: 'after_sales' },
            { label: '客服响应与绩效', href: '/ops/cs', module: 'customer_service' },
            { label: '目标达成', href: '/ops/goal-tracking', module: 'ops' },
            { label: '活动管理', href: '/system/promotions', module: 'system_promotions' },
            { label: '改进任务', href: '/system/tasks', module: 'system_tasks' },
          ],
        },
      ],
    },
  ]
}

// ═══════════════════════════════════════════════════════════════
// 系统与设置（所有平台共享）
// 2026-11-14 重构：原单一「系统管理」大容器拆为 5 个职责清晰的分组
//   系统运维（聚合账号权限、平台场地、配置、队列、模型、审计、告警）
//   运营支撑 / 合规风控
// ═══════════════════════════════════════════════════════════════

function buildSystemSection(): NavSection {
  return {
    title: '系统与设置',
    items: [
      {
        label: '系统运维',
        icon: Settings,
        module: 'system_config',
        children: [
          { label: '账号管理', href: '/system/users', module: 'system_users' },
          { label: '角色与模块权限', href: '/system/roles', module: 'system_users' },
          { label: '运营人员管理', href: '/system/personnel', module: 'system_personnel_ops' },
          { label: '平台与渠道管理', href: '/system/platforms', module: 'system_users' },
          { label: '直播间管理', href: '/system/rooms', module: 'system_rooms' },
          { label: '系统配置', href: '/system/config', module: 'system_config' },
          { label: '异步任务与运维队列', href: '/system/jobs', module: 'system_config' },
          { label: '模型与知识库', href: '/content/center-config', module: 'system_ai' },
          { label: '操作审计日志', href: '/system/audit-logs', module: 'audit_logs' },
          { label: '异常中心', href: '/system/alerts', module: 'system_alerts' },
        ],
      },
      {
        label: '运营支撑',
        icon: BookKey,
        module: 'system_dict',
        children: [
          { label: '字典管理', href: '/system/dict', module: 'system_dict' },
          { label: '大促活动管理', href: '/system/promotions', module: 'system_promotions' },
          { label: '竞品观察', href: '/system/competitors', module: 'system_competitors' },
          { label: '改进任务', href: '/system/tasks', module: 'system_tasks' },
        ],
      },
      {
        label: '合规风控',
        icon: Shield,
        module: 'compliance',
        children: [
          { label: '平台规则雷达', href: '/compliance/rules', module: 'compliance' },
          { label: '违规事件看板', href: '/compliance/events', module: 'compliance' },
        ],
      },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════
// 主入口：按平台业态构建导航（已取消代运营/品牌自播/全功能三模式，统一为全功能）
// ═══════════════════════════════════════════════════════════════

/**
 * 根据平台能力构建导航。
 *
 * 2026-11-14（S3）取消「代运营 / 品牌自播 / 全功能」三种展示模式，统一为单一导航。
 * 2026-11-14（S7）修正：5 个平台全部是直播电商平台，导航改为「直播骨架 + 平台专属叠加」，
 *   不再用单一 mode 互斥判断 —— 否则淘宝/小红书会因为「支持直播」而丢掉店铺/笔记专属分组。
 *
 * 组合规则：
 *   ① 所有平台都有：总览 + 直播骨架（场次/排班/复盘/主播）+ AI + 数据 + 系统
 *   ② 淘系（taobao/tmall）额外叠加：店铺经营 / 商品中心 / 店铺运营
 *   ③ 小红书额外叠加：内容经营（笔记）/ 达人合作 / 店铺转化
 *
 * @param capability 平台能力
 */
export function buildNavigation(capability?: PlatformCapability | null): NavSection[] {
  const code = capability?.platformCode
  const mode = resolvePlatformMode(capability)
  const isLive = capability?.supportsLive !== false

  const sections: NavSection[] = [buildOverviewSection(mode)]

  // ① 直播骨架：5 个平台全部适用（leyova 定位是直播电商）
  if (isLive) {
    sections.push(...buildLiveSections(code))
  }

  // ② 淘系专属叠加
  if (code === 'taobao' || code === 'tmall') {
    sections.push(...buildShelfSections(code))
  }

  // ③ 小红书专属叠加
  if (code === 'xiaohongshu') {
    sections.push(...buildContentSections())
  }

  sections.push(buildAiSection(mode))
  sections.push(buildDataSection(mode))
  sections.push(buildSystemSection())

  return sections
}

/** 平台业态的中文名，用于顶栏提示 */
export function platformModeLabel(mode: PlatformMode): string {
  return mode === 'live' ? '直播电商' : mode === 'shelf' ? '货架电商' : '内容种草'
}
