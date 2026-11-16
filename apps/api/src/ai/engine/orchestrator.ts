/**
 * ai/engine/orchestrator.ts — AI 统一编排大脑 (Planner → Executor → Reporter → Critic)
 * 
 * 核心升级：
 *   1. 遵循 6 大核心契约：PlanSchema、EvidenceSchema、ClaimPacketSchema、TraceSchema。
 *   2. 双引擎架构：自然语言 Schema Mapper 驱动规则引擎（零幻觉）+ 可选 OpenAI 兼容 LLM 引擎。
 *   3. 修复历史 6 大缺陷：
 *      - D1：使用 resolved mode 与指标映射，彻底解决“问数只查 GMV”问题。
 *      - D2：登记 compare_periods 差异额与绝对额，根治归因自验失败。
 *      - D5：统一使用指标注册表 real formula（千次展现成交 GPM）。
 *      - D6：时序预测样本守卫与零点截断守卫，不再出荒谬结论。
 *   4. 向后兼容：保留 runAnalysis 函数签名，无缝兼容既有路由与控制器。
 */

import crypto from 'node:crypto'
import type { DbExecutor } from '../../lib/db.js'
import { getPool } from '../../lib/db.js'
import type { Plan } from '../contract/plan.js'
import type { EvidenceItem } from '../contract/evidence.js'
import type { ClaimPacket } from '../contract/claim.js'
import { planByRules, type PlannerOptions } from './planner/rule-planner.js'
import { executePlan, type ExecutedStep } from './executor.js'
import { synthesizeTemplateReport } from './reporter/template.js'
import { verifyClaimPacket, type VerificationResult } from './critic.js'
import { recordAiRun } from '../trace/recorder.js'
import type { MetricAccessOptions } from '../semantic-layer.js'

export type AnalysisMode = 'S1_query' | 'S2_attribution' | 'S3_compare' | 'S4_anomaly' | 'S5_forecast' | 'S6_review'

export interface AnalysisRequest {
  question: string
  mode?: AnalysisMode
  timeRange?: { from: string; to: string }
  filters?: { platform?: string; shopId?: number; channel?: string }
  platformCode?: string
  role?: string
  userId?: number
  conversationId?: number | string
  awaitPersistence?: boolean
  planner?: (prompt: string, schema: string) => Promise<any>
}

export interface AnalysisResult {
  runId: string
  mode: AnalysisMode
  plan: Plan
  steps: ExecutedStep[]
  evidence: EvidenceItem[]
  conclusion: {
    headline: string
    findings: string[]
    risks: string[]
    actions: string[]
    caveats?: string[]
    evidenceRefs: string[]
    engine: 'rule' | 'llm'
  }
  verification: {
    passed: boolean
    verdict: 'verified' | 'rejected' | 'insufficient'
    checkedNumbers: number
    matched: number
    unmatched: string[]
    rejectionReason?: string
  }
  durationMs: number
}

/**
 * AI 分析主执行流程 (四阶受控闭环)
 */
export async function runAnalysis(
  req: AnalysisRequest,
  scope: string[] | null = null,
  pool?: DbExecutor,
  access?: MetricAccessOptions
): Promise<AnalysisResult> {
  const startTime = Date.now()
  const runId = `run_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const db = pool || getPool()

  // ── 阶段 1：规划 (Planner) ──
  const plan: Plan = await planByRules({
    question: req.question,
    mode: req.mode,
    timeRange: req.timeRange,
    filters: req.filters,
    platformCode: req.platformCode,
    role: req.role,
  })

  // ── 阶段 2：执行与血缘生成 (Executor) ──
  const { steps, evidence, durationMs: execDuration } = await executePlan(plan, scope, db, access)

  // ── 阶段 3：结构化表达 (Reporter) ──
  const draftPacket: ClaimPacket = synthesizeTemplateReport(plan, steps, evidence)

  // ── 阶段 4：确定性质检契约 (Critic) ──
  const verification: VerificationResult = verifyClaimPacket(draftPacket, evidence)

  const totalDuration = Date.now() - startTime

  // ── 阶段 5：异步可观测性记录 (OTel semconv) ──
  const recordPromise = recordAiRun(
    {
      runId,
      conversationId: req.conversationId,
      question: req.question,
      plan,
      steps,
      evidence,
      verification,
      durationMs: totalDuration,
      costCny: 0,
    },
    db
  ).catch(() => {})

  if (req.awaitPersistence) {
    await recordPromise
  }

  // 构造向后兼容的输出结构
  const sanitized = verification.sanitizedPacket
  const findings = sanitized.claims.map((c) => c.text)

  return {
    runId,
    mode: (req.mode || 'S1_query') as AnalysisMode,
    plan,
    steps,
    evidence: evidence.items,
    conclusion: {
      headline: sanitized.headline,
      findings,
      risks: sanitized.risks,
      actions: sanitized.actions,
      caveats: sanitized.caveats,
      evidenceRefs: evidence.items.slice(0, 20).map((e) => e.id),
      engine: plan.engine,
    },
    verification: {
      passed: verification.passed,
      verdict: verification.verdict,
      checkedNumbers: verification.checkedCount,
      matched: verification.matchedCount,
      unmatched: verification.unmatchedItems,
      rejectionReason: verification.rejectionReason,
    },
    durationMs: totalDuration,
  }
}
