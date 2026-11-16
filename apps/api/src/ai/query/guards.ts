/**
 * ai/query/guards.ts — 数值与样本守卫（防幻觉与虚假外推）
 * 
 * 包含：
 *   1. 样本容量守卫（不足 3 个周期禁止线性回归，防虚假高置信度）
 *   2. 触底与截断守卫（预测跌破 0 显式标记 bottom_clamped_to_zero，禁止静默截断）
 *   3. 跨事实域守卫（阻止无关联事实表跨表裸 join）
 */

import { AiError, AiErrorCode } from '../contract/errors.js'
import type { CatalogMetricItem } from '../catalog/loader.js'

export interface ClampCheckResult {
  value: number
  isClamped: boolean
  originalValue: number
}

/**
 * 触底截断守卫：如果数值为负数截断到 0，必须显式打标
 */
export function guardBottomClamp(rawVal: number, min = 0): ClampCheckResult {
  if (rawVal < min) {
    return {
      value: min,
      isClamped: true,
      originalValue: rawVal,
    }
  }
  return {
    value: rawVal,
    isClamped: false,
    originalValue: rawVal,
  }
}

/**
 * 历史时间序列样本容量守卫
 */
export function guardSampleSufficiency(
  seriesCount: number,
  minRequired = 3,
  contextMsg = '回归分析'
): { sufficient: boolean; reason?: string } {
  if (seriesCount < minRequired) {
    return {
      sufficient: false,
      reason: `数据样本量仅有 ${seriesCount} 条，低于${contextMsg}最低阈值 ${minRequired} 条`,
    }
  }
  return { sufficient: true }
}

/**
 * 跨域一致性校验：单次 SQL 原语不得混用不同底层事实表指标
 */
export function guardCrossDomain(
  metricCodes: string[],
  catalog: Record<string, CatalogMetricItem>
): { domain: string; isValid: boolean; conflictMetrics: string[] } {
  if (metricCodes.length === 0) {
    return { domain: 'trade', isValid: true, conflictMetrics: [] }
  }

  const domains = new Set<string>()
  const byDomain: Record<string, string[]> = {}

  for (const code of metricCodes) {
    const item = catalog[code]
    const d = item?.factTable || 'trade'
    domains.add(d)
    if (!byDomain[d]) byDomain[d] = []
    byDomain[d].push(code)
  }

  if (domains.size > 1) {
    return {
      domain: Array.from(domains)[0],
      isValid: false,
      conflictMetrics: metricCodes,
    }
  }

  return {
    domain: Array.from(domains)[0],
    isValid: true,
    conflictMetrics: [],
  }
}
