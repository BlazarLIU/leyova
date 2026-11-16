/**
 * ai/llm/cost.ts — 计费与 Token 统计 (OTel GenAI semconv 对齐)
 */

export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  costCny: number
}

// 常见模型基准单价（元 / 百万 tokens）
const PRICING_TABLE: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 1.0, output: 2.0 },
  'deepseek-coder': { input: 1.0, output: 2.0 },
  'qwen-turbo': { input: 0.8, output: 2.0 },
  'gpt-4o-mini': { input: 1.1, output: 4.4 },
  'default': { input: 1.0, output: 2.0 },
}

/**
 * 估算中文字符 token 数量 (粗略比率：1 中文字符 ≈ 1.3 token，1 英文单词 ≈ 1 token)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const len = text.length
  return Math.ceil(len * 1.2)
}

/**
 * 计算模型调用的折合人民币成本
 */
export function calculateCallCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const cleanModel = (modelName || '').toLowerCase()
  let pricing = PRICING_TABLE['default']

  for (const [key, p] of Object.entries(PRICING_TABLE)) {
    if (cleanModel.includes(key)) {
      pricing = p
      break
    }
  }

  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
  return Number(cost.toFixed(6))
}
