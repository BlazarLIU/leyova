/**
 * ai/orchestrator.ts — 向后兼容门面导出
 *
 * 核心实现已深度重构迁移至 apps/api/src/ai/engine/orchestrator.ts，
 * 本文件保留作为统一入口，保证历史引用 100% 兼容。
 */

export * from './engine/orchestrator.js'
export * from './contract/index.js'
export { verifyClaimPacket } from './engine/critic.js'
export { mapQuestionToSchema } from './engine/planner/schema-mapper.js'
export { planByRules } from './engine/planner/rule-planner.js'

import type { EvidenceItem } from './contract/evidence.js'

/**
 * 兼容旧版 verifyNumbers 函数签名
 */
export function verifyNumbers(
  text: string,
  evidence: EvidenceItem[],
  tolerancePct = 0.1,
  ignoreSmallIntegers = true
): {
  passed: boolean
  checkedNumbers: number
  matched: number
  unmatched: number[]
  suspiciousNumbers?: number[]
} {
  const numbers = text.match(/-?\d+(\.\d+)?/g)?.map(Number).filter((n) => !isNaN(n)) || []
  const filtered = ignoreSmallIntegers
    ? numbers.filter((n) => !(Number.isInteger(n) && Math.abs(n) < 11))
    : numbers

  if (filtered.length === 0) {
    return { passed: true, checkedNumbers: 0, matched: 0, unmatched: [] }
  }

  const unmatched: number[] = []
  let matched = 0

  for (const num of filtered) {
    const ok = evidence.some((ev) => {
      if (Math.abs(ev.value - num) < 0.05) return true
      if (Math.abs(ev.value * 100 - num) < 0.05) return true
      if (Math.abs(ev.value / 10000 - num) < 0.05) return true
      return false
    })
    if (ok) matched += 1
    else unmatched.push(num)
  }

  return {
    passed: unmatched.length === 0,
    checkedNumbers: filtered.length,
    matched,
    unmatched,
  }
}
