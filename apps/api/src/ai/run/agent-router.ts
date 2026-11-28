/**
 * ai/run/agent-router.ts — 域 Agent 路由
 *
 * 规则优先、可解释、零成本：按问题中的域关键词选择域 Agent。
 * 显式指定非默认 Agent 时尊重用户选择；无法判定时回落到经营分析师。
 */

export type DomainAgentKey =
  | 'business_analyst'
  | 'live_ops'
  | 'ads_ops'
  | 'merchandising'
  | 'finance'

export interface AgentRouteResult {
  agentKey: DomainAgentKey
  reason: string
  score: number
}

interface DomainRule {
  agentKey: DomainAgentKey
  /** 域特征词，命中越多越优先 */
  hints: string[]
}

const DOMAIN_RULES: DomainRule[] = [
  {
    agentKey: 'live_ops',
    hints: ['直播', '场次', '主播', '开播', '停留', '弹幕', '讲解', '直播间', 'gpm', '转粉'],
  },
  {
    agentKey: 'ads_ops',
    hints: ['投放', '广告', '千川', '巨量', '计划', '素材', 'roi', 'cpm', 'ctr', '出价', '预算'],
  },
  {
    agentKey: 'merchandising',
    hints: ['选品', '商品', 'sku', '上新', '动销', '库存', '价格带', '毛利', '品类', '爆款'],
  },
  {
    agentKey: 'finance',
    hints: ['财务', '利润', '成本', '现金流', '回款', '发票', '税', '结算', '账期', '对账'],
  },
]

export const DOMAIN_AGENT_KEYS: DomainAgentKey[] = [
  'business_analyst',
  'live_ops',
  'ads_ops',
  'merchandising',
  'finance',
]

/**
 * 选择域 Agent。
 * @param question 用户问题
 * @param requested 调用方显式指定的 Agent（默认 business_analyst）
 */
export function routeAgentKey(question: string, requested?: string | null): AgentRouteResult {
  if (requested && requested !== 'business_analyst' && DOMAIN_AGENT_KEYS.includes(requested as DomainAgentKey)) {
    return { agentKey: requested as DomainAgentKey, reason: '调用方显式指定', score: 0 }
  }

  const q = String(question || '').toLowerCase()
  let best: AgentRouteResult = {
    agentKey: 'business_analyst',
    reason: '未命中域关键词，使用经营分析师',
    score: 0,
  }

  for (const rule of DOMAIN_RULES) {
    let score = 0
    const hits: string[] = []
    for (const hint of rule.hints) {
      if (q.includes(hint)) {
        score += 1
        hits.push(hint)
      }
    }
    if (score > best.score) {
      best = {
        agentKey: rule.agentKey,
        reason: `命中域关键词「${hits.slice(0, 3).join('、')}」`,
        score,
      }
    }
  }

  return best
}