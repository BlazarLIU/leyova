export type SkillCode =
  | 'skill-live-analysis'
  | 'skill-anchor-analysis'
  | 'skill-product-analysis'
  | 'skill-review-generation'
  | 'skill-daily-report'
  | 'skill-task-management'

export interface SkillDefinition {
  code: SkillCode
  name: string
  toolNames: string[]
  scopeTypes: Array<'user' | 'room' | 'role' | 'org'>
  canWrite: boolean
}

export const SKILLS: SkillDefinition[] = [
  {
    code: 'skill-live-analysis',
    name: '直播场次分析',
    toolNames: ['get_live_summary', 'get_room_health', 'get_session_metrics'],
    scopeTypes: ['room', 'role', 'org'],
    canWrite: false,
  },
  {
    code: 'skill-anchor-analysis',
    name: '主播分析',
    toolNames: ['get_anchor_rank', 'get_anchor_profile', 'analyze_anchor'],
    scopeTypes: ['room', 'role', 'org'],
    canWrite: false,
  },
  {
    code: 'skill-product-analysis',
    name: '商品分析',
    toolNames: ['get_product_sales', 'get_product_conversion'],
    scopeTypes: ['room', 'role', 'org'],
    canWrite: false,
  },
  {
    code: 'skill-review-generation',
    name: '复盘生成',
    toolNames: ['generate_review', 'compare_sessions'],
    scopeTypes: ['room', 'role', 'org'],
    canWrite: false,
  },
  {
    code: 'skill-daily-report',
    name: '日报生成',
    toolNames: ['get_bi_dashboard', 'get_bi_trend', 'get_channel_roi'],
    scopeTypes: ['org'],
    canWrite: false,
  },
  {
    code: 'skill-task-management',
    name: '任务管理',
    toolNames: ['create_improvement_task', 'update_task_status', 'list_pending_tasks'],
    scopeTypes: ['room', 'role', 'org'],
    canWrite: true,
  },
]
