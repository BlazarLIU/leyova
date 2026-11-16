/**
 * PlatformInsightConfig — 平台专属洞察页配置驱动（P9 合并项）
 *
 * 原始：10 个套壳页，每个 16~17 行，只把 4 个 props 写给 DedicatedInsightShell。
 * 合并后：1 个配置表 + 1 个通用渲染组件，新增页只需在此追加一条。
 */
import { Layers, Store, Megaphone, Mic, Users, Compass, Share2, Clapperboard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** 单个平台洞察页配置 */
export interface InsightPageConfig {
  /** 路由路径（缺省 = endpoint） */
  path?: string
  /** 后端 API 端点 */
  endpoint: string
  title: string
  subtitle: string
  icon: LucideIcon
  withRange?: boolean
  module: string
}

/** 10 个平台专属洞察页配置表 */
export const INSIGHT_PAGE_CONFIG: InsightPageConfig[] = [
  {
    title: '抖音 · 三池统一调度',
    subtitle: '抖音的三池结构：短视频蓄水、直播收割、商城承接长尾。任何一池独大都会导致增长见顶——本页回答「三池各自的体量与职能边界」',
    icon: Layers,
    endpoint: '/insights/douyin/three-pools',
    withRange: true,
    module: 'review_channels',
  },
  {
    title: '淘宝 · 直播三源流量',
    subtitle: '淘宝直播的流量由三源构成：直播推荐（平台分发）、搜索（主动意图）、店铺自运营（私域/关注）。三源结构决定投放预算与内容策略',
    icon: Layers,
    endpoint: '/insights/taobao/three-sources',
    withRange: true,
    module: 'review_channels',
  },
  {
    title: '天猫 · 品牌 × 场次',
    subtitle: '天猫以品牌自播为主：一场直播即一次品牌内容投放。因此要按「品牌」而非「直播间」维度看——同一品牌多店多场次需合并判断',
    icon: Store,
    endpoint: '/tmall/brands',
    path: '/insights/tmall/brand-sessions',
    withRange: true,
    module: 'session',
  },
  {
    title: '天猫 · 五层抵扣规则',
    subtitle: '天猫独家结构：跨店满减、官方立减、百亿补贴、品类券、店铺券可叠加。真实毛利必须按「商家承担比例」重算，不能只看零售价减成本',
    icon: Layers,
    endpoint: '/tmall/promotion-layers',
    withRange: false,
    module: 'system_promotions',
  },
  {
    title: '天猫 · 直播与官方立减联动',
    subtitle: '天猫直播必须与官方立减/大促活动联动看：大促期日均 GMV 通常显著高于日常，若差异不明显说明活动红利没吃到',
    icon: Megaphone,
    endpoint: '/tmall/promo-compare',
    path: '/insights/tmall/live-promo-link',
    withRange: true,
    module: 'review_channels',
  },
  {
    title: '小红书 · 买手画像',
    subtitle: '小红书主播即「买手」：其粉丝画像与笔记调性共同决定选品方向，不能按抖快的「主播」逻辑硬套。本页把买手档案与内容表现放在一起看',
    icon: Mic,
    endpoint: '/insights/xiaohongshu/buyer-profile',
    withRange: false,
    module: 'anchor',
  },
  {
    title: '小红书 · 蒲公英达人合作',
    subtitle: '小红书达人合作走蒲公英平台，计费为「坑位费 + 佣金」双结构。ROI 必须按（坑位费+佣金）计算，只看佣金会严重高估',
    icon: Users,
    endpoint: '/insights/xiaohongshu/dandelion',
    withRange: true,
    module: 'kol',
  },
  {
    title: '小红书 · 直播流量来源',
    subtitle: '小红书直播流量三源：笔记引流（内容蓄水）→ 推荐（算法分发）→ 搜索（主动意图）。笔记是蓄水池，直播是收割场',
    icon: Compass,
    endpoint: '/insights/xiaohongshu/traffic-sources',
    withRange: true,
    module: 'review_channels',
  },
  {
    title: '视频号 · 全域带货者',
    subtitle: '微信小店带货者可在视频号/公众号/社群/朋友圈全域带货。只统计直播占比会低估视频号真实体量——本页按全域场景拆分',
    icon: Share2,
    endpoint: '/wechat/affiliate',
    withRange: true,
    module: 'anchor',
  },
  {
    title: '视频号 · 短视频与公众号图文',
    subtitle: '视频号内容生态 = 短视频 + 公众号图文，两者都能为直播蓄水。合规已检率是红线指标——内容未过合规校验不应发布',
    icon: Clapperboard,
    endpoint: '/wechat/content',
    withRange: true,
    module: 'content',
  },
]

/** 按 path（缺省回退 endpoint）预建查找表 */
const _configByPath = new Map(INSIGHT_PAGE_CONFIG.map((c) => [c.path ?? c.endpoint, c] as const))

/**
 * 按当前浏览器路径查找配置
 * @param pathname 如 /insights/douyin/three-pools
 */
export function findInsightConfig(pathname: string): InsightPageConfig | undefined {
  if (_configByPath.has(pathname)) return _configByPath.get(pathname)!
  return INSIGHT_PAGE_CONFIG.find((c) => pathname.startsWith(c.path ?? c.endpoint))
}
