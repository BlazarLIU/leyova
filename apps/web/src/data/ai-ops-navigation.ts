/**
 * ai-ops-navigation.ts — Leyova AI 运营系统独立导航结构
 *
 * 依据 /home/leyova/docs/newsystem/FUSION-MASTER-PLAN.md 定义：
 *   - 工作面 1：作战台 (ops-cockpit) - 今日打法 / AI已执行 / 待拍板决策 / 待办收件箱
 *   - 工作面 2：场次台 (session-deck) - 货盘排品 / 提词卡 / 盯盘驾驶舱 / 五段复盘 / 行动项
 *   - 工作面 3：货与内容 (assortment-content) - 全品类选品(迁自主系统) / 货盘结构 / 价格与渠道 / 切片队列 / 投放协同
 *   - 工作面 4：人与钱 (people-finance) -
 *       * 财务板块（严格仅财务/超管）：P&L 利润瀑布 / 结算对账 / 汇损分析
 *       * 人效板块（HRBP/运营/超管）：人效看板 / 智能排班推荐(迁自主系统)
 *   - 系统与治理 (governance) - 22+5 指标字典 / 决策对象流 / 模型与知识库中心(迁自主系统)
 */

import {
  Flame,
  LayoutGrid,
  ListTodo,
  TrendingUp,
  MessageSquareCode,
  FileSpreadsheet,
  Search,
  Package,
  CalendarDays,
  Sparkles,
  UserRound,
  Radio,
  UserCheck,
  ClipboardList,
  Database,
  ShieldCheck,
  BookOpen,
  Upload,
  Users,
  Settings,
} from 'lucide-react'
import type { NavSection } from '@/types'

export interface AiOpsNavItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  href: string
  /** 访问该页主数据所需的模块（与后端 module-guard 映射一致） */
  module?: string
  /** 多个模块任意命中即放行 */
  anyModules?: string[]
  /** 严格仅限财务人员（与超管）访问 */
  onlyFinance?: boolean
  /** 仅限 HRBP/运营/超管 访问（排班/绩效） */
  onlyHrbp?: boolean
}

export interface AiOpsNavSection {
  title: string
  items: AiOpsNavItem[]
  defaultCollapsed?: boolean
}

export interface AiOpsNavContext {
  isFinanceUser: boolean
  isHrbpUser: boolean
  isSuperAdmin: boolean
  /** 服务端解析出的可见模块；超管或未就绪时传空表示不做模块过滤 */
  modules: string[]
}

export function buildAiOpsNavigation(ctx: AiOpsNavContext): NavSection[] {
  const { isFinanceUser, isSuperAdmin, modules } = ctx
  const grantAll = isSuperAdmin || modules.length === 0
  // 与后端 resolveEffectiveModule 对齐：持有父模块 ai 时，全部 ai_* 子模块视为可用。
  // 否则只授 ai 的角色（hrbp / ops_*）会看不到 AI 助手、作战台等内容生产入口。
  const visible = new Set(modules)
  if (visible.has('ai')) {
    for (const ai of ['ai_chat', 'ai_review', 'ai_content', 'ai_ads', 'ai_people', 'ai_finance', 'ai_governance', 'ai_assortment']) {
      visible.add(ai)
    }
  }
  const sections: AiOpsNavSection[] = [
    {
      title: '经营决策',
      items: [
        { label: '今天的变化', icon: Flame, href: '/ai-ops/cockpit', module: 'ai' },
        { label: 'AI 助手', icon: MessageSquareCode, href: '/ai-ops/chat', anyModules: ['ai_chat', 'ai'] },
        { label: '调查与决策案', icon: LayoutGrid, href: '/ai-ops/governance/cases', module: 'review' },
        { label: '决策追踪与复核', icon: ListTodo, href: '/ai-ops/session/actions', anyModules: ['system_tasks', 'ops'] },
        { label: '全域投流与净 ROI', icon: TrendingUp, href: '/ops/net-roi', module: 'net_roi' },
      ],
    },
    {
      title: '货盘与选品',
      items: [
        { label: '货盘排品测算', icon: FileSpreadsheet, href: '/ai-ops/session/planning', module: 'session' },
        { label: 'AI 选品与趋势', icon: Search, href: '/ai-ops/assortment/selection', module: 'ai_assortment' },
        { label: '商品主数据与库存', icon: Package, href: '/ops/inventory', module: 'product_center' },
      ],
    },
    {
      title: '场次与主播',
      items: [
        { label: '排班日历', icon: CalendarDays, href: '/anchors/live-schedule', module: 'anchor' },
        { label: 'AI 排班建议', icon: Sparkles, href: '/ai-ops/people/schedule-recommend', anyModules: ['ai', 'anchor'] },
        { label: '主播档案', icon: UserRound, href: '/anchors/profile', module: 'anchor' },
        { label: '场次调度', icon: Radio, href: '/overview/sessions', module: 'session' },
      ],
    },
    {
      title: '人工登记',
      items: [
        { label: '个人达成', icon: UserCheck, href: '/live/attendance', module: 'personal_achievement' },
        { label: '直播登记', icon: ClipboardList, href: '/live/registration', module: 'live_registration' },
        { label: '登记数据管理', icon: Database, href: '/live/data', module: 'live_data' },
      ],
    },
    {
      title: '规则与合规',
      items: [
        { label: '合规风控雷达', icon: ShieldCheck, href: '/compliance/rules', module: 'compliance' },
        { label: '知识与规则库', icon: BookOpen, href: '/ai-ops/governance/knowledge', module: 'system_ai' },
      ],
    },
    {
      title: '数据管理',
      defaultCollapsed: true,
      items: [
        { label: '数据管理', icon: Database, href: '/data/management', module: 'data' },
        { label: '数据上传', icon: Upload, href: '/data/upload', module: 'data' },
        { label: '数据质量与隔离', icon: ShieldCheck, href: '/data/quality', module: 'data' },
      ],
    },
    {
      title: '系统与运维',
      defaultCollapsed: true,
      items: [
        { label: '账号管理', icon: Users, href: '/system/users', module: 'system_users' },
        { label: '角色与权限', icon: ShieldCheck, href: '/system/roles', module: 'system_users' },
        { label: '平台与渠道', icon: Radio, href: '/system/platforms', module: 'system_users' },
        { label: '直播间管理', icon: Radio, href: '/system/rooms', module: 'system_rooms' },
        { label: '系统配置与 AI', icon: Settings, href: '/system/config', module: 'system_config' },
        { label: '审计日志', icon: ClipboardList, href: '/system/audit-logs', module: 'audit_logs' },
      ],
    },
  ]

  // 按角色与模块权限精确过滤（财务隔离 + 模块门禁，避免导航进去就 403）
  return sections.map(section => ({
    title: section.title,
    defaultCollapsed: section.defaultCollapsed,
    items: section.items.filter(item => {
      // 财务板块：仅财务人员或超管可见
      if (item.onlyFinance && !isFinanceUser && !isSuperAdmin) return false
      if (grantAll) return true
      if (item.anyModules && item.anyModules.length > 0) {
        return item.anyModules.some(m => visible.has(m))
      }
      return item.module ? visible.has(item.module) : true
    }).map(item => ({
      label: item.label,
      icon: item.icon,
      href: item.href,
    })),
  })).filter(section => section.items.length > 0)
}
