/**
 * platform-navigation.ts — 导航构建器（P1 重构后）
 *
 * 数据源已统一收敛到 `route-manifest.ts`（唯一事实源）。
 * 本文件只保留两件事：
 *   1. 平台能力判定（resolvePlatformMode / platformModeLabel）——供首页等调用方使用；
 *   2. 按平台过滤 + 按 9 大工作面分组 / 折叠（buildNavigation）。
 *
 * 旧实现用 5 个 build* 函数拼装菜单，导致 131 处 href 声明、43 处重复挂载；
 * 现在 nav 数据只存在于 route-manifest.ts，菜单与数据同源。
 */
import type { ComponentType } from 'react'
import {
  LayoutDashboard, CalendarCheck, Package, TrendingUp, ClipboardList,
  Clapperboard, Users, Database, Settings,
  BarChart3, ListTodo, ClipboardPlus, BarChart4, Layers, Megaphone,
  FileText, Video, Mic, CalendarDays, Shield,
} from 'lucide-react'
import type { NavSection, NavItem, NavSubItem } from '@/types'
import { NAV_MANIFEST, NAV_GROUP_TITLES, type NavGroupKey } from './route-manifest'

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
  if (cap.supportsLive) return 'live'
  if (code === 'xiaohongshu') return 'content'
  if (cap.supportsShelf) return 'shelf'
  if (cap.supportsContent) return 'content'
  return 'shelf'
}

/** 平台业态的中文名，用于顶栏提示 */
export function platformModeLabel(mode: PlatformMode): string {
  return mode === 'live' ? '直播电商' : mode === 'shelf' ? '货架电商' : '内容种草'
}

type Icon = ComponentType<{ className?: string }>

/** 每个工作面取一个统一图标（用于该组下的扁平入口） */
const GROUP_ICONS: Record<NavGroupKey, Icon> = {
  today: LayoutDashboard,
  session: CalendarCheck,
  assortment: Package,
  traffic: TrendingUp,
  fulfillment: ClipboardList,
  content: Clapperboard,
  people: Users,
  data: Database,
  system: Settings,
}

/** 折叠分组的图标 */
const PARENT_ICONS: Record<string, Icon> = {
  经营与看板: BarChart3,
  待办与目标: ListTodo,
  人工登记: ClipboardPlus,
  直播复盘: BarChart4,
  平台流量洞察: Layers,
  营销与竞品: Megaphone,
  内容创作: Clapperboard,
  小红书内容: FileText,
  视频号内容: Video,
  主播: Mic,
  排班与绩效: CalendarDays,
  HRBP: Users,
  'HRBP 工作台': Users,
  系统运维: Settings,
  合规风控: Shield,
}

/**
 * 根据平台能力构建导航。
 *
 * 规则：从 route-manifest 取当前平台可见的条目，按 9 大工作面分组；
 * 有 parent 的条目聚合为二级折叠，无 parent 的为扁平入口。
 * 平台差异只体现在 manifest 的 `platforms` 过滤上，不再拼装不同菜单骨架。
 */
export function buildNavigation(capability?: PlatformCapability | null): NavSection[] {
  const code = capability?.platformCode
  const sections: NavSection[] = []

  for (const group of Object.keys(NAV_GROUP_TITLES) as NavGroupKey[]) {
    const entries = NAV_MANIFEST.filter(
      (e) => e.group === group && (!e.platforms || !code || e.platforms.includes(code)),
    )
    if (entries.length === 0) continue

    const items: NavItem[] = []

    // 1) 扁平入口
    for (const e of entries.filter((x) => !x.parent)) {
      items.push({ label: e.label, icon: GROUP_ICONS[group], href: e.href, module: e.module })
    }

    // 2) 二级折叠分组
    const parents = Array.from(new Set(entries.filter((x) => x.parent).map((x) => x.parent as string)))
    for (const p of parents) {
      const children: NavSubItem[] = entries
        .filter((x) => x.parent === p)
        .map((x) => ({ label: x.label, href: x.href, module: x.module }))
      items.push({
        label: p,
        icon: PARENT_ICONS[p] ?? GROUP_ICONS[group],
        module: children[0]?.module,
        children,
      })
    }

    sections.push({ title: NAV_GROUP_TITLES[group], items })
  }

  return sections
}
