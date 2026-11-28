/**
 * director/scoring.ts — F.2 选题机会分（确定性公式，LLM 不参与计算）
 *
 *   机会分 = 0.30×品类需求 + 0.25×历史内容表现 + 0.20×毛利/库存
 *          + 0.15×季节/节点匹配 + 0.10×制作可行性
 *
 * 约定：
 *   1. 每项输入要么是 0–100 的已归一化值，要么是 null（数据不足）；
 *   2. 缺失项不计 0 分，而是从权重分母中剔除并写入 missing，避免「没数据=差」；
 *   3. 全部缺失时机会分为 null，明确回答「数据不足」，不硬凑。
 */

export const SCORE_WEIGHTS = {
  demand: 0.30,
  history: 0.25,
  margin: 0.20,
  season: 0.15,
  feasibility: 0.10,
} as const

export type ScoreFactorKey = keyof typeof SCORE_WEIGHTS

export const SCORE_FACTOR_LABELS: Record<ScoreFactorKey, string> = {
  demand: '品类需求',
  history: '历史内容表现',
  margin: '毛利/库存',
  season: '季节/节点匹配',
  feasibility: '制作可行性',
}

export interface ScoreInputs {
  demand: number | null
  history: number | null
  margin: number | null
  season: number | null
  feasibility: number | null
}

export interface ScoreFactor {
  key: ScoreFactorKey
  label: string
  weight: number
  value: number | null
  contribution: number
  source: string
}

export type ScoreRecommendation = 'recommended' | 'neutral' | 'not_recommended' | 'insufficient'

export interface ScoreResult {
  score: number | null
  recommendation: ScoreRecommendation
  factors: ScoreFactor[]
  missing: ScoreFactorKey[]
  /** 数据不足时的显式说明 */
  note: string
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * 需求归一化：按播放量取对数（100 → 0，1 万 → 50，100 万 → 100）。
 * 缺样本时调用方传 null，不要传 0。
 */
export function normalizeDemand(avgPlays: number | null): number | null {
  if (avgPlays == null || !Number.isFinite(avgPlays) || avgPlays <= 0) return null
  const value = ((Math.log10(avgPlays + 1) - 2) / 4) * 100
  return round2(clamp(value))
}

/** 历史表现归一化：互动率（百分数）10% 记满分 */
export function normalizeHistory(engagementRatePercent: number | null): number | null {
  if (engagementRatePercent == null || !Number.isFinite(engagementRatePercent) || engagementRatePercent < 0) {
    return null
  }
  return round2(clamp(engagementRatePercent * 10))
}

/**
 * 毛利/库存归一化：
 *   毛利率（0–1）占 70%，库存周转天数占 30%；
 *   14–45 天为健康区间，过短有断货风险，过长有滞销风险。
 */
export function normalizeMargin(marginRate: number | null, stockDays: number | null): number | null {
  const hasMargin = marginRate != null && Number.isFinite(marginRate)
  const hasStock = stockDays != null && Number.isFinite(stockDays)
  if (!hasMargin && !hasStock) return null

  const marginScore = hasMargin ? clamp(Number(marginRate) * 100) : null
  let stockScore: number | null = null
  if (hasStock) {
    const days = Number(stockDays)
    if (days >= 14 && days <= 45) stockScore = 100
    else if ((days >= 7 && days < 14) || (days > 45 && days <= 60)) stockScore = 70
    else stockScore = 40
  }

  if (marginScore != null && stockScore != null) {
    return round2(clamp(marginScore * 0.7 + stockScore * 0.3))
  }
  return round2(clamp((marginScore ?? stockScore) as number))
}

/**
 * 季节/节点归一化：重要度 1–5 → 20–100，再按距离衰减
 *   - 活动进行中或 14 天内开始：100%
 *   - 30 天内开始：80%
 *   - 60 天内开始：50%
 * 无匹配节点传 null。
 */
export function normalizeSeason(importance: number | null, daysToStart: number | null): number | null {
  if (importance == null || !Number.isFinite(importance)) return null
  const base = clamp(Number(importance) * 20, 20, 100)
  const days = daysToStart == null || !Number.isFinite(daysToStart) ? 0 : Number(daysToStart)
  if (days <= 14) return round2(base)
  if (days <= 30) return round2(base * 0.8)
  if (days <= 60) return round2(base * 0.5)
  return null
}

/**
 * 制作可行性：有商品事实 40 + 有可用模板 30 + 素材 ≥3 条 30。
 * 缺商品直接视为不可行（0 分），因为脚本事实必须来自商品库。
 */
export function normalizeFeasibility(input: {
  hasProduct: boolean
  hasTemplate: boolean
  assetCount: number
}): number {
  const product = input.hasProduct ? 40 : 0
  const template = input.hasTemplate ? 30 : 0
  const assets = clamp(Math.min(3, Math.max(0, input.assetCount)) * 10, 0, 30)
  return round2(clamp(product + template + assets))
}

/** 主评分：缺失因子按权重重归一化 */
export function computeOpportunityScore(inputs: ScoreInputs): ScoreResult {
  const factors: ScoreFactor[] = (Object.keys(SCORE_WEIGHTS) as ScoreFactorKey[]).map((key) => {
    const raw = inputs[key]
    const value = raw != null && Number.isFinite(raw) ? round2(clamp(Number(raw))) : null
    return {
      key,
      label: SCORE_FACTOR_LABELS[key],
      weight: SCORE_WEIGHTS[key],
      value,
      contribution: value == null ? 0 : round2(value * SCORE_WEIGHTS[key]),
      source: value == null ? '数据不足' : '已计算',
    }
  })

  const available = factors.filter((factor) => factor.value != null)
  const missing = factors.filter((factor) => factor.value == null).map((factor) => factor.key)

  if (available.length === 0) {
    return {
      score: null,
      recommendation: 'insufficient',
      factors,
      missing,
      note: '数据不足：缺少品类需求、历史表现、毛利库存、季节节点与商品事实，暂不建议做。',
    }
  }

  const weightSum = available.reduce((sum, factor) => sum + factor.weight, 0)
  const weighted = available.reduce((sum, factor) => sum + (factor.value as number) * factor.weight, 0)
  const score = round2(weighted / weightSum)

  let recommendation: ScoreRecommendation
  if (score >= 60) recommendation = 'recommended'
  else if (score >= 45) recommendation = 'neutral'
  else recommendation = 'not_recommended'

  const note = missing.length > 0
    ? `数据不足项：${missing.map((key) => SCORE_FACTOR_LABELS[key]).join('、')}（已按剩余权重重算）`
    : '全部因子均有数据来源'

  return { score, recommendation, factors, missing, note }
}
