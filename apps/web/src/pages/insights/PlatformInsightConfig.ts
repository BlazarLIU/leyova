/**
 * PlatformInsightConfig — 平台专属洞察页配置驱动（P9 合并项）
 *
 * 原始：10 个套壳页，每个 16~17 行，只把 4 个 props 写给 DedicatedInsightShell。
 * 合并后：1 个配置表 + 1 个通用渲染组件，新增页只需在此追加一条。
 */
import { Layers, Share2, Clapperboard } from 'lucide-react'
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

/** 平台专属洞察页配置表（仅保留核心 3 平台） */
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
    title: '视频号 · 全域带货者',
    subtitle: '微信小店带货者可在视频号/公众号/社群/朋友圈全域带货。只统计直播占比会低估视频号真实体量——本页按全域场景拆分',
    icon: Share2,
    endpoint: '/wechat/affiliate',
    path: '/insights/wechat/affiliate',
    withRange: true,
    module: 'anchor',
  },
  {
    title: '视频号 · 短视频与公众号图文',
    subtitle: '视频号内容生态 = 短视频 + 公众号图文，两者都能为直播蓄水。合规已检率是红线指标——内容未过合规校验不应发布',
    icon: Clapperboard,
    endpoint: '/wechat/content',
    path: '/insights/wechat/content',
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
