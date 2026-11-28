/**
 * controlled-compliance.ts — 词级受控合规检查与官方替换词推荐
 *
 * 核心原则：
 *   1. 不调用大模型自由撰写，杜绝幻觉与不可控监管风险；
 *   2. 基于官方规则、广告法与类目违禁词库，提供受控短语级替换建议；
 *   3. 明确标示违规等级 (BLOCK / WARN)。
 */

import type { Queryable } from './attribution-engine.js'

export interface ComplianceMatchItem {
  word: string
  category: string
  riskLevel: 'BLOCK' | 'WARN'
  suggestedReplacement: string
  explanation: string
  positions: number[]
}

export interface ComplianceCheckResult {
  passed: boolean
  riskLevel: 'NONE' | 'WARN' | 'BLOCK'
  matchedCount: number
  scriptLength: number
  matches: ComplianceMatchItem[]
  auditedAt: string
}

export async function checkScriptCompliance(
  db: Queryable,
  tenantId: number,
  scriptText: string,
  checkedBy?: number,
): Promise<ComplianceCheckResult> {
  const text = String(scriptText || '')
  if (!text.trim()) {
    return {
      passed: true,
      riskLevel: 'NONE',
      matchedCount: 0,
      scriptLength: 0,
      matches: [],
      auditedAt: new Date().toISOString(),
    }
  }

  const { rows } = await db.query(
    `SELECT sensitive_word AS "sensitiveWord",
            category,
            risk_level AS "riskLevel",
            suggested_replacement AS "suggestedReplacement",
            explanation
       FROM public.compliance_sensitive_replacements
      WHERE tenant_id IS NULL OR tenant_id = $1`,
    [tenantId],
  )

  const matches: ComplianceMatchItem[] = []
  let hasBlock = false
  let hasWarn = false

  for (const row of rows) {
    const word = row.sensitiveWord
    if (!word) continue

    const positions: number[] = []
    let pos = text.indexOf(word)
    while (pos !== -1) {
      positions.push(pos)
      pos = text.indexOf(word, pos + 1)
    }

    if (positions.length > 0) {
      if (row.riskLevel === 'BLOCK') hasBlock = true
      if (row.riskLevel === 'WARN') hasWarn = true

      matches.push({
        word,
        category: row.category,
        riskLevel: row.riskLevel,
        suggestedReplacement: row.suggestedReplacement,
        explanation: row.explanation || '违规敏感词，建议替换为合规表述',
        positions,
      })
    }
  }

  const riskLevel = hasBlock ? 'BLOCK' : hasWarn ? 'WARN' : 'NONE'

  // 写入合规检查审计记录表 (留痕防篡改)
  try {
    await db.query(
      `INSERT INTO public.compliance_script_check_logs
         (tenant_id, script_text, risk_level, hit_count, hit_details, checked_by, checked_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())`,
      [tenantId, text.slice(0, 10000), riskLevel, matches.length, JSON.stringify(matches), checkedBy || null],
    )
  } catch {
    // 审计留痕异常不阻断主流程返回
  }

  return {
    passed: !hasBlock,
    riskLevel,
    matchedCount: matches.length,
    scriptLength: text.length,
    matches,
    auditedAt: new Date().toISOString(),
  }
}
