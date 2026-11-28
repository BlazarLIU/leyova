/**
 * ai/run/intent.ts — Main Assistant 意图路由
 *
 * 先走确定性规则（快、可解释、零成本），规则置信度不足时再请 LLM 判定；
 * LLM 不可用或返回不可解析时回落到规则结果，并把降级原因透出到事件流。
 *
 * 意图：
 *   analysis   经营分析 / 取数诊断
 *   ops_action 写操作意图（需要审批编排）
 *   smalltalk  寒暄 / 能力询问（无需取数）
 *   clarify    信息不足，需要追问
 */

import { generateObject } from '../llm/gateway.js'
import { requireTenantId } from '../../lib/tenant-context.js'

export type IntentKind = 'analysis' | 'ops_action' | 'smalltalk' | 'clarify'
export type IntentSource = 'rules' | 'llm' | 'fallback_rules'

export interface IntentResult {
  intent: IntentKind
  source: IntentSource
  confidence: number
  reason: string
  usedFallback?: boolean
  fallbackReason?: string
}

const OPS_ACTIONS = [
  '暂停', '开启', '关闭', '调整预算', '改价', '降价', '提价', '上架', '下架',
  '创建任务', '提交', '执行', '删除', '更新价格', '审批通过', '驳回', '投放', '停止投放',
]

const ANALYSIS_HINTS = [
  '为什么', '分析', '对比', '趋势', '原因', '多少', '如何', '怎么', '是否',
  '预测', '异常', 'roi', 'gmv', '销售额', '退款', '转化', '环比', '同比',
  '排名', '结构', '漏斗', '诊断', '表现', '清单',
]

const SMALLTALK_RE = /^(你好|您好|hi|hello|在吗|在不在|谢谢|感谢|你是谁|你能做什么|帮助)[!！。？?\s]*$/i

const INTENTS: IntentKind[] = ['analysis', 'ops_action', 'smalltalk', 'clarify']

export function detectIntentByRules(question: string): IntentResult {
  const q = String(question || '').trim()
  const lower = q.toLowerCase()

  if (!q) {
    return { intent: 'clarify', source: 'rules', confidence: 0.95, reason: '问题为空' }
  }
  if (SMALLTALK_RE.test(q) && q.length <= 24) {
    return { intent: 'smalltalk', source: 'rules', confidence: 0.95, reason: '命中寒暄/能力询问规则' }
  }

  const opsHit = OPS_ACTIONS.find((k) => q.includes(k))
  if (opsHit) {
    return {
      intent: 'ops_action',
      source: 'rules',
      confidence: 0.9,
      reason: `命中写操作关键词「${opsHit}」`,
    }
  }

  const analysisHit = ANALYSIS_HINTS.find((k) => k && (q.includes(k) || lower.includes(k)))
  if (analysisHit) {
    return {
      intent: 'analysis',
      source: 'rules',
      confidence: 0.85,
      reason: `命中分析关键词「${analysisHit}」`,
    }
  }

  // 无明显关键词：短句要求澄清，长句默认按分析处理
  if (q.length <= 6) {
    return { intent: 'clarify', source: 'rules', confidence: 0.55, reason: '信息过少，需要追问' }
  }
  return { intent: 'analysis', source: 'rules', confidence: 0.6, reason: '默认按经营分析处理' }
}

function normalizeIntent(value: unknown): IntentKind | null {
  const v = String(value || '').trim().toLowerCase()
  return (INTENTS as string[]).includes(v) ? (v as IntentKind) : null
}

/**
 * 混合意图识别：规则高置信直接返回；低置信且 LLM 开启时尝试 LLM。
 * 任何 LLM 异常都回落规则，source 标记为 fallback_rules。
 */
export async function detectIntent(
  question: string,
  options: {
    tenantId?: number
    runId?: string | null
    forceLlm?: boolean
  } = {}
): Promise<IntentResult> {
  const ruled = detectIntentByRules(question)
  if (!options.forceLlm && ruled.confidence >= 0.8) return ruled

  const tenantId = requireTenantId(options.tenantId, 'ai.run.intent')

  const llm = await generateObject<{ intent: string; confidence?: number; reason?: string }>(
    `用户问题：${question}\n请判断意图，只能是 analysis / ops_action / smalltalk / clarify 之一。`,
    '{"intent": "analysis|ops_action|smalltalk|clarify", "confidence": 0-1, "reason": "简述"}',
    {
      tenantId,
      runId: options.runId ?? null,
      temperature: 0.1,
      maxTokens: 200,
      timeoutMs: 5000,
      trace: { operationName: 'assistant.intent', tenantId, runId: options.runId ?? null },
    }
  )

  const intent = llm.ok ? normalizeIntent(llm.data?.intent) : null
  if (!intent) {
    return {
      ...ruled,
      source: 'fallback_rules',
      usedFallback: true,
      fallbackReason: llm.ok ? 'LLM 返回了无法识别的意图' : 'LLM 不可用',
    }
  }

  return {
    intent,
    source: 'llm',
    confidence: Math.min(1, Math.max(0, Number(llm.data?.confidence) || 0.75)),
    reason: String(llm.data?.reason || 'LLM 意图判定'),
    usedFallback: llm.usedFallback,
    fallbackReason: llm.fallbackReason,
  }
}
