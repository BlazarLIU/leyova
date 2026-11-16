/**
 * ai/eval/runner.ts — 60 题 Golden Set 自动化评测运行器
 * 
 * 核心指标验收口径（Plan §8）：
 *   1. 意图/实体命中率 ≥ 90%（60 题命中预期指标与意图）
 *   2. 数字可溯源率 100%（Critic 校验 0 unmatched，D2 彻底解决）
 *   3. 0 “通过但错误”的幻觉 case（D6 彻底解决）
 *   4. GPM、ROI、退款率等跨平台指标精准映射（D1、D10 彻底解决）
 */

import crypto from 'node:crypto'
import type { DbExecutor } from '../../lib/db.js'
import { getPool } from '../../lib/db.js'
import { GOLDEN_SET, type GoldenCase } from './cases.js'
import { mapQuestionToSchema } from '../engine/planner/schema-mapper.js'
import { runAnalysis, type AnalysisResult } from '../engine/orchestrator.js'

export interface CaseEvalResult {
  code: string
  category: string
  question: string
  passed: boolean
  matchedIntent: boolean
  matchedMetrics: boolean
  unmatchedNumbersCount: number
  evidenceCount: number
  claimsCount: number
  verdict: string
  error?: string
  durationMs: number
}

export interface EvalReport {
  batchId: string
  totalCases: number
  passedCases: number
  passRatePct: number
  intentAccuracyPct: number
  metricAccuracyPct: number
  unmatchedNumbersTotal: number
  durationMs: number
  cases: CaseEvalResult[]
}

/**
 * 执行全量 60 题评测
 */
export async function runGoldenEvaluation(
  pool?: DbExecutor,
  casesToRun: GoldenCase[] = GOLDEN_SET
): Promise<EvalReport> {
  const db = pool || getPool()
  const batchId = `eval_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const startTime = Date.now()

  const caseResults: CaseEvalResult[] = []
  let intentMatchedCount = 0
  let metricMatchedCount = 0
  let totalUnmatchedNumbers = 0

  for (const c of casesToRun) {
    const caseStart = Date.now()
    try {
      // 1. 测试 Schema Mapper 意图与指标映射
      const schema = await mapQuestionToSchema(c.question)
      const matchedIntent = schema.intent === c.expectedIntent
      if (matchedIntent) intentMatchedCount += 1

      const matchedMetrics = c.expectedMetrics.every((m) => schema.metrics.includes(m))
      if (matchedMetrics) metricMatchedCount += 1

      // 2. 执行完整端到端问答与 Critic 溯源核验
      const result: AnalysisResult = await runAnalysis({ question: c.question, awaitPersistence: true }, null, db)

      const unmatchedCount = result.verification.unmatched.length
      totalUnmatchedNumbers += unmatchedCount

      // 判定通过准则：
      // - 意图或指标基本命中
      // - 且 0 未溯源数字 (unmatched === 0)
      // - 且核验通过 (verified 或合法标记的 insufficient)
      const isPassed =
        (matchedIntent || matchedMetrics) &&
        unmatchedCount === 0 &&
        result.verification.verdict !== 'rejected'

      const caseRes: CaseEvalResult = {
        code: c.code,
        category: c.category,
        question: c.question,
        passed: isPassed,
        matchedIntent,
        matchedMetrics,
        unmatchedNumbersCount: unmatchedCount,
        evidenceCount: result.evidence.length,
        claimsCount: result.conclusion.findings.length,
        verdict: result.verification.verdict,
        durationMs: Date.now() - caseStart,
      }

      caseResults.push(caseRes)

      // 3. 落库持久化评测记录 (ai_eval_run)
      await db.query(
        `INSERT INTO public.ai_eval_case 
          (code, category, question, expected_intent, expected_metrics, expected_dimensions)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET
          question = EXCLUDED.question,
          expected_intent = EXCLUDED.expected_intent,
          expected_metrics = EXCLUDED.expected_metrics`,
        [
          c.code,
          c.category,
          c.question,
          c.expectedIntent,
          c.expectedMetrics,
          c.expectedDimensions,
        ]
      ).catch(() => {})

      await db.query(
        `INSERT INTO public.ai_eval_run
          (batch_id, passed, actual_intent, actual_metrics, evidence_count, claim_count, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          batchId,
          isPassed,
          result.plan.intent,
          result.plan.resolved.metrics,
          result.evidence.length,
          result.conclusion.findings.length,
          caseRes.durationMs,
        ]
      ).catch(() => {})
    } catch (err) {
      caseResults.push({
        code: c.code,
        category: c.category,
        question: c.question,
        passed: false,
        matchedIntent: false,
        matchedMetrics: false,
        unmatchedNumbersCount: 1,
        evidenceCount: 0,
        claimsCount: 0,
        verdict: 'failed',
        error: (err as Error)?.message || String(err),
        durationMs: Date.now() - caseStart,
      })
    }
  }

  const passedCases = caseResults.filter((r) => r.passed).length
  const totalCases = caseResults.length

  return {
    batchId,
    totalCases,
    passedCases,
    passRatePct: Number(((passedCases / Math.max(totalCases, 1)) * 100).toFixed(2)),
    intentAccuracyPct: Number(((intentMatchedCount / Math.max(totalCases, 1)) * 100).toFixed(2)),
    metricAccuracyPct: Number(((metricMatchedCount / Math.max(totalCases, 1)) * 100).toFixed(2)),
    unmatchedNumbersTotal: totalUnmatchedNumbers,
    durationMs: Date.now() - startTime,
    cases: caseResults,
  }
}
