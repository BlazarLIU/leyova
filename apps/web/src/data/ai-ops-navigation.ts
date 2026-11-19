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
  Sparkles,
  Flame,
  Radio,
  FileSpreadsheet,
  FileCheck2,
  ListTodo,
  Layers,
  Tag,
  Scissors,
  TrendingUp,
  DollarSign,
  Receipt,
  Users,
  CalendarCheck,
  BookOpen,
  GitBranch,
  BrainCircuit,
  MessageSquareCode,
  LayoutGrid,
  BarChart3,
  PieChart,
  Video,
  Share2,
  Filter,
  Briefcase,
} from 'lucide-react'
import type { NavSection } from '@/types'

export interface AiOpsNavItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  href: string
  /** 严格仅限财务人员（与超管）访问 */
  onlyFinance?: boolean
  /** 仅限 HRBP/运营/超管 访问（排班/绩效） */
  onlyHrbp?: boolean
}

export interface AiOpsNavSection {
  title: string
  items: AiOpsNavItem[]
}

export function buildAiOpsNavigation(isFinanceUser: boolean, _isHrbpUser: boolean, isSuperAdmin: boolean): NavSection[] {
  const sections: AiOpsNavSection[] = [
    {
      title: '工作面 1 · 作战台',
      items: [
        { label: 'AI助手', icon: MessageSquareCode, href: '/ai-ops/chat' },
        { label: '今日作战单', icon: Flame, href: '/ai-ops/cockpit' },
        { label: '经营诊断台', icon: LayoutGrid, href: '/ai-ops/workbench' },
        { label: '待办审批中心', icon: ListTodo, href: '/ai-ops/inbox' },
        { label: '实时告警流', icon: Sparkles, href: '/ai-ops/alerts' },
      ],
    },
    {
      title: '工作面 2 · 场次台与全域复盘',
      items: [
        { label: '货盘排品编辑', icon: FileSpreadsheet, href: '/ai-ops/session/planning' },
        { label: '提词卡与指令', icon: Radio, href: '/ai-ops/session/prompter' },
        { label: '盯盘驾驶舱', icon: Sparkles, href: '/ai-ops/session/live-watch' },
        { label: '单场五段复盘', icon: FileCheck2, href: '/ai-ops/session/review' },
        { label: '复盘总览矩阵', icon: BarChart3, href: '/ai-ops/review/overview' },
        { label: '商品表现分析', icon: PieChart, href: '/ai-ops/review/products' },
        { label: '短视频引流复盘', icon: Video, href: '/ai-ops/review/short-videos' },
        { label: '渠道流量复盘', icon: Share2, href: '/ai-ops/review/channels' },
        { label: '转化漏斗穿透', icon: Filter, href: '/ai-ops/review/funnel' },
      ],
    },
    {
      title: '工作面 3 · 货与内容',
      items: [
        { label: 'AI 全品类选品', icon: Sparkles, href: '/ai-ops/assortment/selection' },
        { label: '货盘结构分析', icon: Layers, href: '/ai-ops/assortment/structure' },
        { label: '价格与渠道价目', icon: Tag, href: '/ai-ops/assortment/prices' },
        { label: '内容排产与切片', icon: Scissors, href: '/ai-ops/content/clips' },
        { label: '投放协同与熔断', icon: TrendingUp, href: '/ai-ops/media/campaigns' },
      ],
    },
    {
      title: '工作面 4 · 财务与人资工作台',
      items: [
        // 财务专属板块（严格隔离：非财务角色不可见、不可访问）
        { label: '利润与单位经济 P&L', icon: DollarSign, href: '/ai-ops/finance/pnl', onlyFinance: true },
        { label: '结算对账分录', icon: Receipt, href: '/ai-ops/finance/settle', onlyFinance: true },
        // HRBP 与人效协同板块（HRBP、运营团队、超管均可见、可协同推进）
        { label: 'HRBP 效能总览', icon: Briefcase, href: '/ai-ops/hrbp/workspace' },
        { label: '主播效能排行', icon: Users, href: '/ai-ops/people/performance' },
        { label: '改进闭环追踪', icon: ListTodo, href: '/ai-ops/session/actions' },
        { label: 'AI 智能排班推荐', icon: CalendarCheck, href: '/ai-ops/people/schedule-recommend' },
      ],
    },
    {
      title: '系统与内核治理',
      items: [
        { label: '22+5 指标注册字典', icon: BookOpen, href: '/ai-ops/governance/metrics' },
        { label: 'Decision Case 决策流', icon: GitBranch, href: '/ai-ops/governance/cases' },
        { label: '知识库与模型中心', icon: BrainCircuit, href: '/ai-ops/governance/knowledge' },
      ],
    },
  ]

  // 按角色权限精确过滤（特别是财务板块隔离）
  return sections.map(section => ({
    title: section.title,
    items: section.items.filter(item => {
      // 财务板块：仅财务人员或超管可见
      if (item.onlyFinance && !isFinanceUser && !isSuperAdmin) {
        return false
      }
      return true
    }).map(item => ({
      label: item.label,
      icon: item.icon,
      href: item.href,
    })),
  })).filter(section => section.items.length > 0)
}
