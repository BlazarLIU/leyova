/**
 * ai/engine/critic.ts — 确定性契约核验与数字溯源质检器 (Critic Engine)
 * 
 * 技术参照：SuperSonic Corrector + Ragas Faithfulness 契约化实现
 * 
 * 校验铁律（Plan §6.3 ④）：
 *   1. 每个 fact/derived 断言必须绑定 ≥1 个 evidence_id，且必须属于本次运行的证据集。
 *   2. 文本中的每个业务数字，必须精确匹配其所引用证据的数值。
 *   3. judgement 类断言若含有未绑定的业务数字，直接判违规。
 *   4. 派生值血缘必须顺着 parents 链闭环回到 fact，无断链。
 *   5. 任一指标触发 insufficient/clamp 守卫，不得进入结论，必须进入 caveats。
 *   6. 失败即拒答并附解释，杜绝“标记不可信后照常给用户看”。
 */

import type { EvidencePacket, EvidenceItem } from '../contract/evidence.js'
import type { ClaimPacket, ClaimItem } from '../contract/claim.js'

export interface VerificationResult {
  passed: boolean
  verdict: 'verified' | 'rejected' | 'insufficient'
  rejectionReason?: string
  checkedCount: number
  matchedCount: number
  unmatchedItems: string[]
  sanitizedPacket: ClaimPacket
}

/**
 * 从字符串中提取所有数值型字符串（忽略年份如 2026 或纯序号）
 */
function extractNumbersFromText(text: string): number[] {
  // 1. 先去除实体名称引用（如「...」「『...』」「【...】」），避免实体名/渠道名/计划名中的序号被误判为业务指标
  const withoutEntities = text
    .replace(/「[^」]+」/g, '')
    .replace(/『[^』]+』/g, '')
    .replace(/【[^】]+】/g, '')
  // 2. 去除形如 2026-11-12 的日期，避免其中的连接符被误判为负号
  const withoutDates = withoutEntities.replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, '')
  // 3. 去除下划线批次/计划编号后缀（如 _01, _02）
  const withoutIdSuffix = withoutDates.replace(/_\d+/g, '')
  // 4. 匹配整数与浮点数
  const matches = withoutIdSuffix.match(/-?\d+(\.\d+)?/g)
  if (!matches) return []
  return matches
    .map(Number)
    .filter((n) => !isNaN(n))
    // 排除年份 2020~2030 与百分号前的极小纯整数或序号
    .filter((n) => !(n >= 2020 && n <= 2030 && Number.isInteger(n)))
}

/**
 * 校验单个数值是否能在指定证据集中找到精确（或合理四舍五入）匹配
 */
function isNumberCoveredByEvidence(val: number, allowedEvidences: EvidenceItem[]): boolean {
  for (const ev of allowedEvidences) {
    if (Math.abs(ev.value - val) < 0.05) return true
    // 百分比容差：例如 34.24% 与 0.3424
    if (Math.abs(ev.value * 100 - val) < 0.05 || Math.abs(ev.value - val * 100) < 0.05) return true
    // 万元缩放：例如 415.63 与 4156300
    if (Math.abs(ev.value / 10000 - val) < 0.05 || Math.abs(ev.value - val * 10000) < 0.05) return true
  }
  return false
}

/**
 * 校验派生血缘是否最终回溯到事实
 */
function verifyLineage(item: EvidenceItem, byId: Map<string, EvidenceItem>, visited = new Set<string>()): boolean {
  if (item.kind === 'fact' || item.kind === 'model_param') return true
  if (visited.has(item.id)) return false // 存在环
  visited.add(item.id)

  if (!item.parents || item.parents.length === 0) return false // 派生值没有来源事实

  for (const pId of item.parents) {
    const parent = byId.get(pId)
    if (!parent) return false // 断链
    if (!verifyLineage(parent, byId, visited)) return false
  }

  return true
}

/**
 * Critic 核心检验器
 */
export function verifyClaimPacket(packet: ClaimPacket, evidence: EvidencePacket): VerificationResult {
  const unmatched: string[] = []
  let checkedCount = 0
  let matchedCount = 0

  const validClaims: ClaimItem[] = []
  const caveats: string[] = [...(packet.caveats || [])]

  // 1. 扫描证据包中的守卫标记
  let hasInsufficient = false
  for (const ev of evidence.items) {
    if (ev.insufficient) {
      hasInsufficient = true
      caveats.push(`指标「${ev.label}」样本容量不足或触发截断，预测结果已降低置信度。`)
    }
    if (ev.clamp_flag === 'bottom_clamped_to_zero') {
      hasInsufficient = true
      caveats.push(`预测模型触发零值拦截保护，历史降幅过快，不宜直接作为经营保底依据。`)
    }
  }

  // 2. 逐条检验 claims
  for (const claim of packet.claims) {
    checkedCount += 1
    const citedEvidences: EvidenceItem[] = []

    // 检查 evidence_ids 是否全部合法
    let idsValid = true
    for (const eid of claim.evidence_ids) {
      const ev = evidence.byId.get(eid)
      if (!ev) {
        idsValid = false
        unmatched.push(`断言引用了不存在的证据 ID: ${eid}`)
      } else {
        citedEvidences.push(ev)
      }
    }

    if (!idsValid) continue

    // fact 或 derived 类断言必须至少引用 1 个证据
    if ((claim.kind === 'fact' || claim.kind === 'derived') && citedEvidences.length === 0) {
      unmatched.push(`事实/派生结论未绑定任何证据: 「${claim.text}」`)
      continue
    }

    // 校验文本中提取的所有数字是否都在引用的证据中
    const numbersInText = extractNumbersFromText(claim.text)
    let numbersCovered = true

    for (const num of numbersInText) {
      if (!isNumberCoveredByEvidence(num, citedEvidences)) {
        numbersCovered = false
        unmatched.push(`数字 ${num} 无法在绑定的证据中找到证明: 「${claim.text}」`)
      }
    }

    if (!numbersCovered) continue

    // 校验派生血缘
    let lineageOk = true
    for (const ev of citedEvidences) {
      if (ev.kind === 'derived' && !verifyLineage(ev, evidence.byId)) {
        lineageOk = false
        unmatched.push(`证据 ${ev.id} (${ev.label}) 派生血缘断裂或存在循环`)
      }
    }

    if (!lineageOk) continue

    // 若引用了 insufficient 证据，降级移入 caveats，不作为确定性 claim
    const citesInsufficient = citedEvidences.some((ev) => ev.insufficient)
    if (citesInsufficient) {
      caveats.push(claim.text)
      continue
    }

    matchedCount += 1
    validClaims.push(claim)
  }

  // 判定结论
  const passed = unmatched.length === 0 && validClaims.length > 0
  let verdict: 'verified' | 'rejected' | 'insufficient' = 'verified'
  let rejectionReason: string | undefined

  if (!passed) {
    verdict = 'rejected'
    rejectionReason = `核验未通过：发现 ${unmatched.length} 处数据无法溯源或血缘异常（${unmatched.slice(0, 2).join('；')}）`
  } else if (hasInsufficient) {
    verdict = 'insufficient'
    rejectionReason = '数据样本不足或触发零点截断保护，已附加风险提示。'
  }

  const sanitizedPacket: ClaimPacket = {
    ...packet,
    claims: validClaims,
    caveats: Array.from(new Set(caveats)),
    verdict,
    rejection_reason: rejectionReason,
  }

  return {
    passed,
    verdict,
    rejectionReason,
    checkedCount,
    matchedCount,
    unmatchedItems: unmatched,
    sanitizedPacket,
  }
}
