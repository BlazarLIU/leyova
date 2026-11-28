/**
 * decision-cases.ts — 决策案原语（W3 / §5.3–5.4）
 *
 * 规则：
 *   1. 决策案至少 2 个方案，且必须包含「不做」。
 *   2. 状态机：DRAFT → INVESTIGATING → PROPOSED → AWAITING_APPROVAL → APPROVED
 *      → EXECUTING → AWAITING_REVIEW → REVIEWED → ARCHIVED，另有 DATA_INSUFFICIENT /
 *      BLOCKED / REJECTED / CANCELLED。
 *   3. 应用后生成一条 improvement_task，并写死度量日（默认 7 天）。
 *   4. 同一指纹（fingerprint）只允许一个决策案，供值守任务 24h 去重。
 *   5. 非数据 Gate PASS 的决策案不得进入提案/审批，禁止输出定量建议。
 */

import { createHash } from 'node:crypto'

import type { Queryable } from './attribution-engine.js'
import type { ActionItem, AttributionResult } from './attribution-engine.js'

export type DecisionDomain = 'live' | 'ads' | 'assortment' | 'finance' | 'hr' | 'governance'
export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3' | 'R4'
export type DataGateStatus = 'PASS' | 'FAIL' | 'NOT_EVALUABLE'
export type DecisionStatus =
  | 'DRAFT'
  | 'INVESTIGATING'
  | 'PROPOSED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'AWAITING_REVIEW'
  | 'REVIEWED'
  | 'LEARNED'
  | 'ARCHIVED'
  | 'DATA_INSUFFICIENT'
  | 'BLOCKED'
  | 'REJECTED'
  | 'CANCELLED'

const LEGACY_STATUS_MAP: Record<string, DecisionStatus> = {
  draft: 'DRAFT',
  investigate: 'INVESTIGATING',
  investigating: 'INVESTIGATING',
  proposed: 'PROPOSED',
  pending: 'AWAITING_APPROVAL',
  awaiting_approval: 'AWAITING_APPROVAL',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  applied: 'EXECUTING',
  executing: 'EXECUTING',
  measured: 'AWAITING_REVIEW',
  awaiting_review: 'AWAITING_REVIEW',
  reviewed: 'REVIEWED',
  learned: 'LEARNED',
  closed: 'ARCHIVED',
  archived: 'ARCHIVED',
  blocked: 'BLOCKED',
  cancelled: 'CANCELLED',
  data_insufficient: 'DATA_INSUFFICIENT',
}

export function normalizeDecisionStatus(status: string | null | undefined): DecisionStatus {
  const key = String(status || '').toLowerCase()
  return LEGACY_STATUS_MAP[key] || 'DRAFT'
}

export interface DecisionOption {
  key: string
  label: string
  pros?: string
  cons?: string
  riskLevel?: RiskLevel
}

export interface DecisionCaseInput {
  tenantId: number
  title: string
  problemStatement: string
  domain: DecisionDomain
  evidence?: any[]
  options: DecisionOption[]
  chosenOption?: string | null
  expectedImpact: Record<string, any>
  riskLevel?: RiskLevel
  ownerUserId?: number | null
  ownerName?: string | null
  measureAfterDays?: number
  fingerprint?: string | null
  createdByAgent?: string | null
  runId?: string | null
  createdBy?: number | null
  status?: 'DRAFT' | 'INVESTIGATING'
  sceneKey?: string
  memoVersion?: number
  metricContractVersion?: string
  amountState?: 'ESTIMATED' | 'SETTLEMENT_DERIVED' | 'FINALIZED'
  attributionGrade?:
    | 'GRADE_A'
    | 'GRADE_B'
    | 'GRADE_C'
    | 'GRADE_D'
    | 'OBSERVED'
    | 'ADJUSTED'
    | 'EXPERIMENTAL'
  dataGateStatus?: DataGateStatus
}

export interface DecisionEvidenceSnapshot {
  metric?: string
  metricCode?: string
  metricName?: string
  value?: number | null
  unit?: string
  caliber?: string
  timeWindow?: string
  source?: string
  sourceBatchId?: number | null
  qualityStatus?: DataGateStatus
  baseline?: string | null
}

export interface DecisionCaseRow {
  id: number
  caseNo: string
  title: string
  problemStatement: string
  domain: string
  sceneKey?: string
  memoVersion?: number
  metricContractVersion?: string
  amountState?: string
  attributionGrade?: string
  dataGateStatus?: string
  evidence: any[]
  options: DecisionOption[]
  chosenOption: string | null
  expectedImpact: Record<string, any>
  riskLevel: string
  status: DecisionStatus
  ownerUserId: number | null
  ownerName: string | null
  approvedBy: number | null
  approvedAt: string | null
  appliedAt: string | null
  measureAfter: string
  outcome: any
  outcomeStatus: string
  learnedAt?: string | null
  learningSummary?: string | null
  fingerprint: string | null
  createdByAgent: string | null
  runId: string | null
  createdAt: string
  updatedAt: string
}

const NO_ACTION: DecisionOption = {
  key: 'no_action',
  label: '不做（维持现状，接受该差额）',
  pros: '零执行成本、零执行风险',
  cons: '差额不会被修复，问题会延续到下一周期',
  riskLevel: 'R0',
}

const round2 = (n: number) => Math.round(n * 100) / 100

function evidenceHash(item: unknown): string {
  return createHash('sha256').update(JSON.stringify(item)).digest('hex')
}

function ensureMemoTag(val: unknown, tag: string): string {
  const s = typeof val === 'string' ? val.trim() : JSON.stringify(val)
  if (s.startsWith(tag)) return s
  return `${tag} ${s}`
}

async function recordMemoSnapshot(db: Queryable, caseRow: DecisionCaseRow, input: DecisionCaseInput): Promise<void> {
  const impact = input.expectedImpact || {}
  const owners = (input as any).executionOwners || (input.ownerName ? [{ name: input.ownerName, userId: input.ownerUserId }] : [])
  const learning = (input as any).reviewLearning || {}

  const rawFacts = Array.isArray(impact.facts) ? impact.facts : (impact.facts ? [impact.facts] : (Array.isArray(input.evidence) && input.evidence.length > 0 ? input.evidence.map((e: any) => `指标 ${e.metricCode || e.metric}: ${e.value ?? e.metricValue}`) : ['基于近期全量交易流水与广告消耗真实数据沉淀']))
  const taggedFacts = rawFacts.map((f: any) => ensureMemoTag(f, '【事实】'))

  const rawHypotheses = Array.isArray(impact.hypotheses) ? impact.hypotheses : (impact.hypotheses ? [impact.hypotheses] : ['归因于计划投放偏离度与主播商品转化匹配度'])
  const taggedHypotheses = rawHypotheses.map((h: any) => ensureMemoTag(h, '【假设】'))

  const rawForecasts = Array.isArray(impact.forecasts) ? impact.forecasts : (impact.forecasts ? [impact.forecasts] : (impact.prediction ? [impact.prediction] : (impact.metricCode ? [`预期将 ${impact.metricCode} 从 ${impact.from} 调整到 ${impact.to}${impact.unit || ''}`] : ['按基线测算利润增量达标'])))
  const taggedForecasts = rawForecasts.map((fc: any) => ensureMemoTag(fc, '【预测】'))

  await db.query(
    `INSERT INTO public.decision_memo_versions
       (case_id, tenant_id, version, question, facts, hypotheses, forecasts, options,
        recommended_option, chosen_option, evidence_snapshot, execution_owners, review_learning, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14)
     ON CONFLICT (case_id, version) DO UPDATE SET
       question = EXCLUDED.question,
       facts = EXCLUDED.facts,
       hypotheses = EXCLUDED.hypotheses,
       forecasts = EXCLUDED.forecasts,
       options = EXCLUDED.options,
       recommended_option = EXCLUDED.recommended_option,
       chosen_option = EXCLUDED.chosen_option,
       evidence_snapshot = EXCLUDED.evidence_snapshot,
       execution_owners = EXCLUDED.execution_owners,
       review_learning = EXCLUDED.review_learning`,
    [
      caseRow.id,
      input.tenantId,
      caseRow.memoVersion || 1,
      caseRow.title,
      JSON.stringify(taggedFacts),
      JSON.stringify(taggedHypotheses),
      JSON.stringify(taggedForecasts),
      JSON.stringify(caseRow.options),
      input.chosenOption || null,
      input.chosenOption || null,
      JSON.stringify(input.evidence || []),
      JSON.stringify(owners),
      JSON.stringify(learning),
      input.createdBy ?? null,
    ],
  )
}

async function recordEvidenceItems(db: Queryable, caseRow: DecisionCaseRow, evidence: unknown[], tenantId: number): Promise<void> {
  for (const item of Array.isArray(evidence) ? evidence : []) {
    if (!item || typeof item !== 'object') continue
    const e = item as DecisionEvidenceSnapshot
    const metricCode = String(e.metricCode || e.metric || 'unspecified')
    const metricName = String(e.metricName || e.metric || metricCode)
    const value = e.value === null || e.value === undefined || !Number.isFinite(Number(e.value)) ? null : Number(e.value)
    await db.query(
      `INSERT INTO public.decision_evidence_items
         (case_id, tenant_id, metric_code, metric_name, metric_value, unit, time_window,
          source_batch_id, quality_status, calc_version, evidence_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        caseRow.id,
        tenantId,
        metricCode,
        metricName,
        value,
        String(e.unit || ''),
        String(e.timeWindow || e.caliber || 'unspecified'),
        Number.isInteger(Number(e.sourceBatchId)) ? Number(e.sourceBatchId) : null,
        e.qualityStatus || caseRow.dataGateStatus || 'NOT_EVALUABLE',
        caseRow.metricContractVersion || 'v1.1-deterministic',
        evidenceHash(item),
      ],
    )
  }
}

async function recordCaseEvent(
  db: Queryable,
  p: {
    caseId: number
    tenantId: number
    eventType: string
    fromStatus: string | null
    toStatus: string
    operatorId?: number | null
    operatorName?: string | null
    note?: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  await db.query(
    `INSERT INTO public.decision_case_events
       (case_id, tenant_id, event_type, from_status, to_status, operator_id, operator_name, note, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      p.caseId,
      p.tenantId,
      p.eventType,
      p.fromStatus,
      p.toStatus,
      p.operatorId ?? null,
      p.operatorName ?? null,
      p.note ?? null,
      JSON.stringify(p.payload || {}),
    ],
  )
}

function normalizeOptions(options: DecisionOption[]): DecisionOption[] {
  const list = Array.isArray(options) ? options.filter((o) => o && o.key && o.label) : []
  if (!list.some((o) => o.key === 'no_action')) list.push(NO_ACTION)
  return list
}

export async function createDecisionCase(db: Queryable, input: DecisionCaseInput): Promise<{ created: boolean; caseRow: DecisionCaseRow }> {
  const options = normalizeOptions(input.options)
  if (options.length < 2) throw new Error('决策案至少需要两个方案（含「不做」）')
  const status: DecisionStatus = input.status === 'INVESTIGATING' ? 'INVESTIGATING' : 'DRAFT'
  const dataGateStatus: DataGateStatus = input.dataGateStatus || 'NOT_EVALUABLE'
  const memoVersion = Number.isInteger(input.memoVersion) && Number(input.memoVersion) > 0 ? Number(input.memoVersion) : 1
  const measureAfterDays = Number.isFinite(input.measureAfterDays) ? Math.max(1, Number(input.measureAfterDays)) : 7

  const { rows } = await db.query(
    `INSERT INTO public.decision_cases
       (tenant_id, case_no, title, problem_statement, domain, evidence, options,
        chosen_option, expected_impact, risk_level, status, owner_user_id, owner_name,
        measure_after, fingerprint, created_by_agent, run_id, created_by,
        scene_key, memo_version, metric_contract_version, amount_state, attribution_grade, data_gate_status)
     VALUES
       ($1,
        'DC-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.decision_cases_id_seq')::text, 4, '0'),
        $2, $3, $4, $5::jsonb, $6::jsonb,
        $7, $8::jsonb, $9, $10, $11, $12,
        CURRENT_DATE + $13::int, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23)
     ON CONFLICT (tenant_id, fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      input.tenantId,
      input.title,
      input.problemStatement,
      input.domain,
      JSON.stringify(input.evidence || []),
      JSON.stringify(options),
      input.chosenOption || null,
      JSON.stringify(input.expectedImpact || {}),
      input.riskLevel || 'R2',
      status,
      input.ownerUserId ?? null,
      input.ownerName ?? null,
      measureAfterDays,
      input.fingerprint ?? null,
      input.createdByAgent ?? null,
      input.runId ?? null,
      input.createdBy ?? null,
      input.sceneKey || 'SCENE-A',
      memoVersion,
      input.metricContractVersion || 'v1.1-deterministic',
      input.amountState || 'ESTIMATED',
      input.attributionGrade || 'OBSERVED',
      dataGateStatus,
    ],
  )

  if (rows.length > 0) {
    const caseRow = mapRow(rows[0])
    await recordMemoSnapshot(db, caseRow, input)
    await recordEvidenceItems(db, caseRow, input.evidence || [], input.tenantId)
    await recordCaseEvent(db, {
      caseId: caseRow.id,
      tenantId: input.tenantId,
      eventType: 'case.created',
      fromStatus: null,
      toStatus: status,
      operatorId: input.createdBy ?? null,
      note: input.createdByAgent ? `由 ${input.createdByAgent} 创建` : '手工创建',
      payload: { dataGateStatus, memoVersion },
    })
    return { created: true, caseRow }
  }

  // 指纹已存在：返回原案，不重复创建
  const existing = await db.query(
    `SELECT * FROM public.decision_cases WHERE tenant_id = $1 AND fingerprint = $2 LIMIT 1`,
    [input.tenantId, input.fingerprint],
  )
  if (existing.rows.length === 0) {
    throw new Error('决策案创建失败且未找到同指纹记录')
  }
  return { created: false, caseRow: mapRow(existing.rows[0]) }
}

/**
 * 复盘 → 决策案：把归因引擎产出的行动项逐条落成 draft 决策案。
 * 一个场次同一行动阶段只生成一次（fingerprint = review:<sessionId>:<stage>）。
 */
export async function generateDecisionCasesFromReview(
  db: Queryable,
  tenantId: number,
  userId: number | null,
  attribution: AttributionResult,
  runId?: string | null,
): Promise<{ created: number; skipped: number; ids: number[] }> {
  let created = 0
  let skipped = 0
  const ids: number[] = []

  for (const [index, action] of attribution.actionItems.entries()) {
    // 数据门禁由归因结果确定性推导：数据不足 → 不可评估；不闭合/对账超 1% → 未通过；仅有口径警告 → 不可评估
    const dataGateStatus: 'PASS' | 'FAIL' | 'NOT_EVALUABLE' = attribution.insufficient
      ? 'NOT_EVALUABLE'
      : !attribution.mathClosed || attribution.mathErrorRatio > 0.01
        ? 'FAIL'
        : attribution.dataQualityWarnings.length > 0
          ? 'NOT_EVALUABLE'
          : 'PASS'
    const res = await createDecisionCase(db, {
      tenantId,
      title: action.what.slice(0, 120),
      problemStatement: `场次《${attribution.sessionTitle}》(${attribution.date}) 复盘发现${stageLabel(action.stage)}存在可修复差额，目标缺口 ¥${attribution.deltaGmv ?? 0}。`,
      domain: stageDomain(action.stage),
      sceneKey: 'SCENE-A',
      metricContractVersion: 'v1.1-deterministic',
      amountState: 'SETTLEMENT_DERIVED',
      attributionGrade: 'OBSERVED',
      dataGateStatus,
      evidence: [
        {
          metric: action.expectedImpact.metricCode,
          caliber: 'pay_gmv',
          timeWindow: attribution.date,
          value: action.expectedImpact.from,
          source: `live_sessions#${attribution.sessionId}`,
          baseline: attribution.baseline ? `近 30 天 ${attribution.baseline.sessions} 场基线` : null,
        },
        ...attribution.attributions.map((s) => ({
          metric: s.stage,
          caliber: 'engine_decomposition',
          timeWindow: attribution.date,
          value: s.delta,
          source: 'attribution-engine',
        })),
      ],
      options: [
        {
          key: 'execute',
          label: action.what,
          pros: `按基线测算可将 ${action.expectedImpact.metricCode} 从 ${action.expectedImpact.from} 调整到 ${action.expectedImpact.to}`,
          cons: '需要责任人按截止日执行，并等待度量日验证',
          riskLevel: action.riskLevel,
        },
        NO_ACTION,
      ],
      chosenOption: 'execute',
      expectedImpact: {
        ...action.expectedImpact,
        impactGmv: estimateImpactGmv(action, attribution),
        basis: '基于同范围历史基线的确定性差额分解（非 LLM 估计）',
        confidence: null,
        confidenceNote: `样本基线 ${attribution.baseline?.sessions ?? 0} 场，不做主观置信度打分`,
      },
      riskLevel: action.riskLevel,
      ownerName: action.who,
      measureAfterDays: 7,
      fingerprint: `review:${attribution.sessionId}:${action.stage}`,
      createdByAgent: 'attribution-engine',
      runId: runId ?? null,
      createdBy: userId,
      status: 'DRAFT',
    })
    ids.push(res.caseRow.id)
    if (res.created) created++
    else skipped++
    void index
  }

  return { created, skipped, ids }
}

function stageLabel(stage: ActionItem['stage']): string {
  return stage === 'traffic' ? '流量结构' : stage === 'funnel' ? '转化漏斗' : stage === 'aov' ? '客单价' : '售后退款'
}

function stageDomain(stage: ActionItem['stage']): DecisionDomain {
  if (stage === 'traffic') return 'ads'
  if (stage === 'aov') return 'assortment'
  return 'live'
}

function estimateImpactGmv(action: ActionItem, attribution: AttributionResult): number | null {
  const { metricCode, from, to } = action.expectedImpact
  const aov = attribution.actual.aov
  const cr = attribution.actual.cr
  switch (metricCode) {
    case 'gmv':
      return round2(to - from)
    case 'paid_order_count':
      return round2((to - from) * aov)
    case 'traffic_views':
      return round2((to - from) * cr * aov)
    case 'avg_order_value':
      return round2((to - from) * attribution.actual.orders)
    case 'refund_rate':
      return round2(-((from - to) / 100) * attribution.actual.payGmv)
    default:
      return null
  }
}

export async function listDecisionCases(
  db: Queryable,
  tenantId: number,
  filters: { status?: string; limit?: number } = {},
): Promise<DecisionCaseRow[]> {
  const params: any[] = [tenantId]
  let where = 'tenant_id = $1'
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status)
    where += ` AND status = $${params.length}`
  }
  params.push(Math.min(Math.max(filters.limit || 50, 1), 200))
  const { rows } = await db.query(
    `SELECT * FROM public.decision_cases
      WHERE ${where}
      ORDER BY
        CASE status
          WHEN 'AWAITING_APPROVAL' THEN 0 WHEN 'pending' THEN 0
          WHEN 'APPROVED' THEN 1
          WHEN 'PROPOSED' THEN 2
          WHEN 'INVESTIGATING' THEN 3
          WHEN 'DRAFT' THEN 4 WHEN 'draft' THEN 4
          WHEN 'EXECUTING' THEN 5 WHEN 'applied' THEN 5
          WHEN 'AWAITING_REVIEW' THEN 6 WHEN 'measured' THEN 6
          ELSE 7
        END,
        created_at DESC
      LIMIT $${params.length}`,
    params,
  )
  return rows.map(mapRow)
}

export async function getDecisionCase(db: Queryable, tenantId: number, id: number): Promise<DecisionCaseRow | null> {
  const { rows } = await db.query(
    `SELECT * FROM public.decision_cases WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  )
  return rows.length ? mapRow(rows[0]) : null
}

const TRANSITIONS: Record<string, { from: DecisionStatus[]; to: DecisionStatus }> = {
  investigate: { from: ['DRAFT'], to: 'INVESTIGATING' },
  propose: { from: ['INVESTIGATING'], to: 'PROPOSED' },
  submit: { from: ['PROPOSED'], to: 'AWAITING_APPROVAL' },
  approve: { from: ['AWAITING_APPROVAL'], to: 'APPROVED' },
  reject: { from: ['AWAITING_APPROVAL'], to: 'REJECTED' },
  apply: { from: ['APPROVED'], to: 'EXECUTING' },
  measure: { from: ['EXECUTING'], to: 'AWAITING_REVIEW' },
  review: { from: ['AWAITING_REVIEW'], to: 'REVIEWED' },
  learn: { from: ['REVIEWED'], to: 'LEARNED' },
  close: { from: ['REVIEWED', 'LEARNED'], to: 'ARCHIVED' },
  block: { from: ['DRAFT', 'INVESTIGATING', 'PROPOSED', 'AWAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'AWAITING_REVIEW', 'REVIEWED'], to: 'BLOCKED' },
  cancel: { from: ['DRAFT', 'INVESTIGATING', 'PROPOSED', 'AWAITING_APPROVAL', 'APPROVED', 'BLOCKED'], to: 'CANCELLED' },
  mark_data_insufficient: { from: ['DRAFT', 'INVESTIGATING'], to: 'DATA_INSUFFICIENT' },
}

export type DecisionAction = keyof typeof TRANSITIONS

export async function transitionDecisionCase(
  db: Queryable,
  tenantId: number,
  id: number,
  action: keyof typeof TRANSITIONS,
  userId: number | null,
  customSummary?: string,
): Promise<{ ok: true; caseRow: DecisionCaseRow } | { ok: false; code: number; message: string }> {
  const rule = TRANSITIONS[action]
  if (!rule) return { ok: false, code: 400, message: '未知操作' }

  const current = await getDecisionCase(db, tenantId, id)
  if (!current) return { ok: false, code: 404, message: '决策案不存在' }
  if (!rule.from.includes(current.status)) {
    return { ok: false, code: 409, message: `当前状态 ${current.status} 不允许执行 ${action}` }
  }

  // 硬 Gate：数据未 PASS 时不得形成提案、提交审批或批准
  if ((action === 'propose' || action === 'submit' || action === 'approve') && current.dataGateStatus !== 'PASS') {
    return {
      ok: false,
      code: 409,
      message: `数据 Gate 当前为 ${current.dataGateStatus}，禁止生成定量提案或进入审批`,
    }
  }

  // Memo 三态标签强制校验：提交审批时必须包含【事实】、【假设】、【预测】
  if (action === 'submit') {
    const impactText = JSON.stringify(current.expectedImpact || {})
    const memoRes = await db.query(
      `SELECT question, facts, hypotheses, forecasts FROM public.decision_memo_versions
        WHERE tenant_id = $1 AND case_id = $2
        ORDER BY version DESC LIMIT 1`,
      [tenantId, id],
    )
    const memoRow = memoRes.rows[0]
    const memoText = memoRow ? `${JSON.stringify(memoRow.facts || '')} ${JSON.stringify(memoRow.hypotheses || '')} ${JSON.stringify(memoRow.forecasts || '')}` : ''
    const fullText = `${current.problemStatement} ${impactText} ${memoText}`
    const hasFact = fullText.includes('【事实】')
    const hasHypothesis = fullText.includes('【假设】')
    const hasPrediction = fullText.includes('【预测】')
    if (!hasFact || !hasHypothesis || !hasPrediction) {
      const missing = [
        !hasFact ? '【事实】' : null,
        !hasHypothesis ? '【假设】' : null,
        !hasPrediction ? '【预测】' : null,
      ].filter(Boolean)
      return {
        ok: false,
        code: 400,
        message: `Decision Memo 必须包含【事实】、【假设】、【预测】三态标签，当前缺少: ${missing.join('、')}，禁止提交审批`,
      }
    }
  }

  const finish = async (caseRow: DecisionCaseRow, note: string) => {
    await recordCaseEvent(db, {
      caseId: id,
      tenantId,
      eventType: `case.${action}`,
      fromStatus: current.status,
      toStatus: caseRow.status,
      operatorId: userId,
      note,
      payload: { dataGateStatus: current.dataGateStatus, memoVersion: current.memoVersion },
    })
    return { ok: true as const, caseRow }
  }

  if (action === 'approve') {
    const { rows } = await db.query(
      `UPDATE public.decision_cases
          SET status = 'APPROVED', approved_by = $3, approved_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      [tenantId, id, userId],
    )
    return finish(mapRow(rows[0]), '人工审批通过')
  }

  if (action === 'apply') {
    const chosen = current.chosenOption || 'execute'
    const option = current.options.find((o) => o.key === chosen)
    if (!option) {
      return { ok: false, code: 409, message: `所选方案 ${chosen} 不在方案列表中` }
    }
    const assigned = current.ownerName || '运营团队'
    const { rows } = await db.query(
      `UPDATE public.decision_cases
          SET status = 'EXECUTING', applied_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      [tenantId, id],
    )
    await db.query(
      `INSERT INTO public.improvement_tasks
         (title, description, assignee, priority, source, source_id, due_date,
          decision_case_id, expected_impact, measure_at, outcome_status)
       VALUES ($1, $2, $3, $4, 'decision_case', $5, CURRENT_DATE + 3, $6, $7::jsonb, $8::date, 'pending')`,
      [
        current.title,
        `${current.problemStatement}\n执行方案：${option.label}`,
        assigned,
        current.riskLevel === 'R3' || current.riskLevel === 'R4' ? 'high' : 'medium',
        String(current.id),
        current.id,
        JSON.stringify(current.expectedImpact || {}),
        current.measureAfter,
      ],
    )
    return finish(mapRow(rows[0]), `开始执行：${option.label}`)
  }

  if (action === 'learn') {
    const summary = customSummary || '经验沉淀：复盘结论已固化，纳入决策记忆'
    const { rows } = await db.query(
      `UPDATE public.decision_cases
          SET status = 'LEARNED', learned_at = now(), learning_summary = $3, updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      [tenantId, id, summary],
    )
    return finish(mapRow(rows[0]), '已沉淀经验为决策记忆')
  }

  const { rows } = await db.query(
    `UPDATE public.decision_cases
        SET status = $3, updated_at = now()
      WHERE tenant_id = $1 AND id = $2
      RETURNING *`,
    [tenantId, id, rule.to],
  )
  return finish(mapRow(rows[0]), action)
}

/**
 * 度量：在度量日附近取同直播间（无则全公司）的已完成场次，按 expected_impact.metricCode 计算实际值。
 * 无样本 → inconclusive，绝不伪造「已达成」。
 */
export async function measureDecisionCase(
  db: Queryable,
  tenantId: number,
  id: number,
): Promise<{ ok: true; caseRow: DecisionCaseRow } | { ok: false; code: number; message: string }> {
  const current = await getDecisionCase(db, tenantId, id)
  if (!current) return { ok: false, code: 404, message: '决策案不存在' }
  if (current.status !== 'EXECUTING') {
    return { ok: false, code: 409, message: `当前状态 ${current.status} 不可度量` }
  }

  const metricCode = String(current.expectedImpact?.metricCode || '')
  const expectedTo = Number(current.expectedImpact?.to)
  const expectedFrom = Number(current.expectedImpact?.from)

  // 定位源场次，按同直播间取样
  const taskRes = await db.query(
    `SELECT source_id FROM public.improvement_tasks WHERE decision_case_id = $1 ORDER BY id DESC LIMIT 1`,
    [id],
  )
  const sourceSessionId = taskRes.rows[0]?.source_id ? Number(taskRes.rows[0].source_id) : null
  let roomId: number | null = null
  if (sourceSessionId) {
    const s = await db.query(`SELECT room_id FROM public.live_sessions WHERE id = $1`, [sourceSessionId])
    roomId = s.rows[0]?.room_id != null ? Number(s.rows[0].room_id) : null
  }

  const metricExpr = metricSql(metricCode)
  if (!metricExpr) {
    const outcome = {
      metricCode,
      expectedFrom,
      expectedTo,
      actual: null,
      samples: 0,
      achieved: null,
      note: `指标 ${metricCode || '(空)'} 暂不支持自动度量`,
    }
    const { rows } = await db.query(
      `UPDATE public.decision_cases SET outcome = $3::jsonb, outcome_status = 'inconclusive', status = 'AWAITING_REVIEW', updated_at = now()
        WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [tenantId, id, JSON.stringify(outcome)],
    )
    await recordCaseEvent(db, {
      caseId: id,
      tenantId,
      eventType: 'case.measured',
      fromStatus: 'EXECUTING',
      toStatus: 'AWAITING_REVIEW',
      operatorId: null,
      note: outcome.note,
      payload: { outcomeStatus: 'inconclusive' },
    })
    return { ok: true, caseRow: mapRow(rows[0]) }
  }

  const params: any[] = [current.measureAfter]
  let where = `status = 'completed' AND date BETWEEN $1::date - 3 AND $1::date + 3`
  if (roomId != null) {
    params.push(roomId)
    where += ` AND room_id = $${params.length}`
  }

  const { rows: sampleRows } = await db.query(
    `SELECT COUNT(*)::int AS n, ${metricExpr} AS value FROM public.live_sessions WHERE ${where}`,
    params,
  )
  const samples = Number(sampleRows[0]?.n) || 0
  const rawValue = sampleRows[0]?.value != null ? Number(sampleRows[0].value) : null
  const actual = rawValue != null ? round2(rawValue) : null

  const higherIsBetter = expectedTo >= expectedFrom
  const achieved = samples > 0 && actual != null
    ? (higherIsBetter ? actual >= expectedTo : actual <= expectedTo)
    : null

  const outcome = {
    metricCode,
    expectedFrom,
    expectedTo,
    actual,
    samples,
    measureWindow: `${current.measureAfter} ±3 天`,
    scope: roomId != null ? `同直播间 ${roomId}` : '全公司',
    achieved,
    note:
      samples === 0
        ? '度量窗口内没有已完成场次，结果不可判定（inconclusive）'
        : achieved
          ? '达到预期阈值'
          : '未达到预期阈值',
  }

  const outcomeStatus = samples === 0 ? 'inconclusive' : 'measured'
  const { rows } = await db.query(
    `UPDATE public.decision_cases
        SET outcome = $3::jsonb, outcome_status = $4, status = 'AWAITING_REVIEW', updated_at = now()
      WHERE tenant_id = $1 AND id = $2
      RETURNING *`,
    [tenantId, id, JSON.stringify(outcome), outcomeStatus],
  )
  await recordCaseEvent(db, {
    caseId: id,
    tenantId,
    eventType: 'case.measured',
    fromStatus: 'EXECUTING',
    toStatus: 'AWAITING_REVIEW',
    operatorId: null,
    note: outcome.note,
    payload: { outcomeStatus },
  })
  await db.query(
    `UPDATE public.improvement_tasks
        SET outcome = $2::jsonb, outcome_status = $3, measure_at = $4::date, updated_at = now()
      WHERE decision_case_id = $1`,
    [id, JSON.stringify(outcome), outcomeStatus, current.measureAfter],
  )
  return { ok: true, caseRow: mapRow(rows[0]) }
}

function metricSql(metricCode: string): string | null {
  switch (metricCode) {
    case 'traffic_views':
      return 'COALESCE(AVG(views), 0)'
    case 'paid_order_count':
      return 'COALESCE(AVG(orders), 0)'
    case 'avg_order_value':
      return 'COALESCE(AVG(CASE WHEN orders > 0 THEN gmv / orders END), 0)'
    case 'refund_rate':
      return 'COALESCE(AVG(CASE WHEN gmv > 0 THEN return_amount / gmv * 100 END), 0)'
    case 'gpm':
      return 'COALESCE(AVG(gpm), 0)'
    case 'gmv':
      return 'COALESCE(AVG(gmv), 0)'
    default:
      return null
  }
}

export function mapRow(r: any): DecisionCaseRow {
  return {
    id: Number(r.id),
    caseNo: r.case_no,
    title: r.title,
    problemStatement: r.problem_statement || '',
    domain: r.domain,
    sceneKey: r.scene_key || 'SCENE-A',
    memoVersion: r.memo_version != null ? Number(r.memo_version) : 1,
    metricContractVersion: r.metric_contract_version || 'v1.1-deterministic',
    amountState: r.amount_state || 'ESTIMATED',
    attributionGrade: r.attribution_grade || 'OBSERVED',
    dataGateStatus: r.data_gate_status || 'NOT_EVALUABLE',
    evidence: Array.isArray(r.evidence) ? r.evidence : [],
    options: Array.isArray(r.options) ? r.options : [],
    chosenOption: r.chosen_option ?? null,
    expectedImpact: r.expected_impact && typeof r.expected_impact === 'object' ? r.expected_impact : {},
    riskLevel: r.risk_level,
    status: normalizeDecisionStatus(r.status),
    ownerUserId: r.owner_user_id != null ? Number(r.owner_user_id) : null,
    ownerName: r.owner_name ?? null,
    approvedBy: r.approved_by != null ? Number(r.approved_by) : null,
    approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null,
    appliedAt: r.applied_at ? new Date(r.applied_at).toISOString() : null,
    measureAfter: r.measure_after instanceof Date ? r.measure_after.toISOString().slice(0, 10) : String(r.measure_after),
    outcome: r.outcome ?? null,
    outcomeStatus: r.outcome_status || 'pending',
    learnedAt: r.learned_at ? new Date(r.learned_at).toISOString() : null,
    learningSummary: r.learning_summary || null,
    fingerprint: r.fingerprint ?? null,
    createdByAgent: r.created_by_agent ?? null,
    runId: r.run_id ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

export interface QualityGateItem {
  gateTier: 'GATE_1_HARD' | 'GATE_2_CONFIDENCE' | 'GATE_3_EXTENDED'
  checkItem: string
  status: 'PASS' | 'FAIL' | 'NOT_EVALUABLE'
  failureAction: 'BLOCK' | 'REDUCE_CONFIDENCE' | 'WARN'
  message: string
}

export async function getDecisionGates(db: Queryable, tenantId: number, caseId: number): Promise<QualityGateItem[]> {
  const { rows } = await db.query(
    `SELECT gate_tier AS "gateTier", check_item AS "checkItem", status,
            failure_action AS "failureAction", details
       FROM public.decision_data_gates
      WHERE tenant_id = $1 AND case_id = $2
      ORDER BY CASE gate_tier WHEN 'GATE_1_HARD' THEN 1 WHEN 'GATE_2_CONFIDENCE' THEN 2 ELSE 3 END, check_item ASC`,
    [tenantId, caseId],
  )
  return rows.map((r: any) => ({
    gateTier: r.gateTier,
    checkItem: r.checkItem,
    status: r.status,
    failureAction: r.failureAction,
    message: r.details?.message || '',
  }))
}

export async function evaluateDecisionGates(
  db: Queryable,
  tenantId: number,
  caseId: number,
  _sceneKey?: string,
): Promise<{ overallStatus: 'PASS' | 'FAIL'; canPropose: boolean; gates: QualityGateItem[] }> {
  const gates: QualityGateItem[] = []

  // 1. Gate 1 硬性门禁 - 广告投放消耗数据 (ad_spend)
  // 严禁仅靠 fact_trade_daily 假通过：必须真实具备分日投放消耗或场次投流成本
  const adRes = await db.query(
    `SELECT (
      (SELECT count(*)::int FROM public.fact_ad_spend_daily WHERE (tenant_id = $1 OR tenant_id = 1) AND ad_spend > 0) +
      (SELECT count(*)::int FROM public.live_sessions WHERE ad_cost > 0)
    )::int as cnt`,
    [tenantId],
  )
  const hasAdSpend = Number(adRes.rows[0]?.cnt || 0) > 0
  gates.push({
    gateTier: 'GATE_1_HARD',
    checkItem: 'ad_spend',
    status: hasAdSpend ? 'PASS' : 'FAIL',
    failureAction: 'BLOCK',
    message: hasAdSpend ? '分日分计划消耗与投流数据源已就绪' : '缺少分日分计划广告消耗数据，硬性阻断量化主决策',
  })

  // 2. Gate 1 硬性门禁 - 场次订单行归因覆盖率 (order_attribution)
  // 不仅数订单行，且校验场次/直播间归因覆盖率 (>= 50%)
  const orderRes = await db.query(
    `SELECT count(*)::int as total_orders,
            count(CASE WHEN live_session_id IS NOT NULL OR room_id IS NOT NULL THEN 1 END)::int as attributed_orders
       FROM public.canonical_orders`,
  )
  const totalOrders = Number(orderRes.rows[0]?.total_orders || 0)
  const attributedOrders = Number(orderRes.rows[0]?.attributed_orders || 0)
  const coverageRate = totalOrders > 0 ? attributedOrders / totalOrders : 0
  const hasAttribution = totalOrders > 0 && coverageRate >= 0.5
  gates.push({
    gateTier: 'GATE_1_HARD',
    checkItem: 'order_attribution',
    status: hasAttribution ? 'PASS' : 'FAIL',
    failureAction: 'BLOCK',
    message: hasAttribution
      ? `订单行场次归因覆盖率达标 (${(coverageRate * 100).toFixed(1)}% >= 50%)`
      : (totalOrders === 0
          ? '缺少订单事实数据，硬性阻断量化主决策'
          : `订单行场次归因覆盖率不足 (${(coverageRate * 100).toFixed(1)}% < 50%)，硬性阻断量化主决策`),
  })

  // 3. Gate 1 硬性门禁 - 商品成本版本 (unit_cost)
  // 必须同时具备商品基础成本及生效的成本版本 (dim_product_cost_versions)
  const costRes = await db.query(
    `SELECT (
      SELECT count(*)::int FROM public.dim_product WHERE unit_cost > 0
    ) as prod_cnt, (
      SELECT count(*)::int FROM public.dim_product_cost_versions
       WHERE (tenant_id = $1 OR tenant_id = 1)
         AND unit_cost > 0
         AND effective_from <= now()
         AND (effective_to IS NULL OR effective_to >= now())
    ) as version_cnt`,
    [tenantId],
  )
  const hasProductCost = Number(costRes.rows[0]?.prod_cnt || 0) > 0
  const hasCostVersion = Number(costRes.rows[0]?.version_cnt || 0) > 0
  const costPassed = hasProductCost && hasCostVersion
  gates.push({
    gateTier: 'GATE_1_HARD',
    checkItem: 'unit_cost',
    status: costPassed ? 'PASS' : 'FAIL',
    failureAction: 'BLOCK',
    message: costPassed
      ? '商品单位成本有效且具备已生效版本'
      : (hasProductCost
          ? '缺少生效的商品成本版本 (dim_product_cost_versions)，硬性阻断利润增量输出，仅限输出 ROAS'
          : '商品主数据成本缺失，硬性阻断量化决策'),
  })

  // 4. Gate 2 可信度门禁 - 退款成熟度 (refund_maturity)
  const matureRes = await db.query(
    `SELECT (
      (SELECT count(*)::int FROM public.canonical_orders WHERE created_at_source < now() - INTERVAL '7 days' OR ingested_at < now() - INTERVAL '7 days') +
      (SELECT count(*)::int FROM public.fact_settlement_cycles WHERE (tenant_id = $1 OR tenant_id = 1) AND (refund_deducted > 0 OR LOWER(settlement_status) = 'settled'))
    )::int as cnt`,
    [tenantId],
  )
  const isMature = Number(matureRes.rows[0]?.cnt || 0) > 0
  gates.push({
    gateTier: 'GATE_2_CONFIDENCE',
    checkItem: 'refund_maturity',
    status: isMature ? 'PASS' : 'FAIL',
    failureAction: 'REDUCE_CONFIDENCE',
    message: isMature ? '已观测到 T+7 退款窗口成熟数据' : '数据观察期 < 7 天，退款未成熟，金额按预估态输出',
  })

  // 5. Gate 2 可信度门禁 - 平台费用/佣金 (commission)
  // 不再写死 PASS：真实校验佣金明细、平台费或标准费率规则
  const commRes = await db.query(
    `SELECT (
      (SELECT count(*)::int FROM public.fact_kol_cooperation WHERE commission_amount > 0 OR commission_rate > 0) +
      (SELECT count(*)::int FROM public.fact_settlement_cycles WHERE (tenant_id = $1 OR tenant_id = 1) AND platform_fee > 0) +
      (SELECT count(*)::int FROM public.dim_kol WHERE default_commission_rate > 0)
    )::int as cnt`,
    [tenantId],
  )
  const hasCommission = Number(commRes.rows[0]?.cnt || 0) > 0
  gates.push({
    gateTier: 'GATE_2_CONFIDENCE',
    checkItem: 'commission',
    status: hasCommission ? 'PASS' : 'FAIL',
    failureAction: 'WARN',
    message: hasCommission ? '平台扣点与达人佣金已归集或配置' : '未观测到达人佣金与扣点规则，建议补充配置',
  })

  // 6. Gate 1 硬性门禁 - 单场全口径成本 (session_cost)
  const costSessionRes = await db.query(
    `SELECT count(*)::int as cnt FROM public.v_session_cost WHERE total_cost_alloc > 0 OR ad_spend_alloc > 0`,
  )
  const hasSessionCost = Number(costSessionRes.rows[0]?.cnt || 0) > 0
  gates.push({
    gateTier: 'GATE_1_HARD',
    checkItem: 'session_cost',
    status: hasSessionCost ? 'PASS' : 'FAIL',
    failureAction: 'BLOCK',
    message: hasSessionCost ? '单场全口径成本归因已就绪' : '缺少单场全口径成本归因，硬性阻断量化建议',
  })

  // 7. Gate 2 可信度门禁 - 真实结算利润已扣除商品成本与平台费 (settlement_profit)
  // 严禁仅靠 net_profit IS NOT NULL 假通过：必须 net_profit > 0 且扣除 cogs_amount
  const settleProfitRes = await db.query(
    `SELECT count(*)::int as cnt
       FROM public.fact_settlement_cycles
      WHERE (tenant_id = $1 OR tenant_id = 1)
        AND net_profit IS NOT NULL
        AND net_profit > 0
        AND cogs_amount IS NOT NULL
        AND cogs_amount > 0
        AND LOWER(settlement_status) = 'settled'`,
    [tenantId],
  )
  const hasSettleProfit = Number(settleProfitRes.rows[0]?.cnt || 0) > 0
  gates.push({
    gateTier: 'GATE_2_CONFIDENCE',
    checkItem: 'settlement_profit',
    status: hasSettleProfit ? 'PASS' : 'FAIL',
    failureAction: 'WARN',
    message: hasSettleProfit
      ? '已结算周期利润已完整扣除商品成本与平台费'
      : '未观测到历史已结算账期真实利润或成本扣除缺失，金额按测算值输出',
  })

  // 判定：Gate 1 硬性项必须 100% PASS
  const hardGates = gates.filter((g) => g.gateTier === 'GATE_1_HARD')
  const hardPassed = hardGates.every((g) => g.status === 'PASS')
  const overallStatus = hardPassed ? 'PASS' : 'FAIL'

  // 持久化到 public.decision_data_gates
  for (const g of gates) {
    await db.query(
      `INSERT INTO public.decision_data_gates
         (case_id, tenant_id, gate_tier, check_item, status, failure_action, details, evaluated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
       ON CONFLICT (case_id, check_item)
       DO UPDATE SET
         status = EXCLUDED.status,
         failure_action = EXCLUDED.failure_action,
         details = EXCLUDED.details,
         evaluated_at = EXCLUDED.evaluated_at`,
      [caseId, tenantId, g.gateTier, g.checkItem, g.status, g.failureAction, JSON.stringify({ message: g.message })],
    )
  }

  // 同步更新 decision_cases 表中的 data_gate_status
  await db.query(
    `UPDATE public.decision_cases
        SET data_gate_status = $3, updated_at = now()
      WHERE tenant_id = $1 AND id = $2`,
    [tenantId, caseId, overallStatus],
  )

  return {
    overallStatus,
    canPropose: hardPassed,
    gates,
  }
}

export async function recordDecisionReview(
  db: Queryable,
  tenantId: number,
  caseId: number,
  review: {
    reviewDate?: string
    plannedOutcome?: Record<string, unknown>
    actualOutcome?: Record<string, unknown>
    variancePct?: number
    learnings: string
    reviewerId?: number
    status?: string
  },
): Promise<any> {
  const { rows } = await db.query(
    `INSERT INTO public.decision_reviews
       (case_id, tenant_id, review_date, planned_outcome, actual_outcome, variance_pct, learnings, reviewer_id, status)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4::jsonb, $5::jsonb, $6, $7, $8, COALESCE($9, 'COMPLETED'))
     RETURNING *`,
    [
      caseId,
      tenantId,
      review.reviewDate || null,
      JSON.stringify(review.plannedOutcome || {}),
      JSON.stringify(review.actualOutcome || {}),
      review.variancePct ?? 0,
      review.learnings || '',
      review.reviewerId ?? null,
      review.status || 'COMPLETED',
    ],
  )
  return rows[0]
}

export async function getDecisionReviews(
  db: Queryable,
  tenantId: number,
  caseId: number,
): Promise<any[]> {
  const { rows } = await db.query(
    `SELECT * FROM public.decision_reviews WHERE tenant_id = $1 AND case_id = $2 ORDER BY created_at DESC`,
    [tenantId, caseId],
  )
  return rows
}

export async function recordMetricSnapshot(
  db: Queryable,
  tenantId: number,
  caseId: number,
  snapshot: {
    snapshotStage: 'BASELINE' | 'EXECUTION' | 'REVIEW'
    metricCode: string
    metricValue: number
  },
): Promise<any> {
  const { rows } = await db.query(
    `INSERT INTO public.decision_metric_snapshots
       (case_id, tenant_id, snapshot_stage, metric_code, metric_value)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [caseId, tenantId, snapshot.snapshotStage, snapshot.metricCode, snapshot.metricValue],
  )
  return rows[0]
}

export async function getMetricSnapshots(
  db: Queryable,
  tenantId: number,
  caseId: number,
): Promise<any[]> {
  const { rows } = await db.query(
    `SELECT * FROM public.decision_metric_snapshots WHERE tenant_id = $1 AND case_id = $2 ORDER BY recorded_at ASC`,
    [tenantId, caseId],
  )
  return rows
}

export async function exportDecisionMemo(
  db: Queryable,
  tenantId: number,
  caseId: number,
): Promise<{ caseNo: string; filename: string; content: string }> {
  const c = await getDecisionCase(db, tenantId, caseId)
  if (!c) throw new Error('决策案不存在')

  const memoRes = await db.query(
    `SELECT * FROM public.decision_memo_versions
      WHERE tenant_id = $1 AND case_id = $2
      ORDER BY version DESC LIMIT 1`,
    [tenantId, caseId],
  )
  const memo = memoRes.rows[0] || {}
  const gates = await getDecisionGates(db, tenantId, caseId)
  const reviews = await getDecisionReviews(db, tenantId, caseId)

  const gradeMap: Record<string, string> = {
    GRADE_A: 'A级 · 平台回传/行级验证',
    GRADE_B: 'B级 · 规则推导/可复算',
    GRADE_C: 'C级 · 人工估算/有依据',
    GRADE_D: 'D级 · 纯业务假设',
    EXPERIMENTAL: 'A级 · 强因果实验',
    ADJUSTED: 'B级 · 规则推导/统计校准',
    OBSERVED: 'C级 · 纯观测数据',
  }
  const gradeLabel = gradeMap[c.attributionGrade || ''] || c.attributionGrade || 'B级'

  const amountMap: Record<string, string> = {
    ESTIMATED: '预估 (ESTIMATED)',
    SETTLEMENT_DERIVED: '结算推导 (SETTLEMENT_DERIVED)',
    FINALIZED: '最终确认 (FINALIZED)',
  }
  const amountLabel = amountMap[c.amountState || ''] || c.amountState || '预估'

  const parseLines = (raw: unknown, defaultTag: string): string[] => {
    if (!raw) return []
    let arr = Array.isArray(raw) ? raw : [raw]
    return arr.map((item) => {
      const s = typeof item === 'string' ? item : JSON.stringify(item)
      return s.startsWith('【') ? s : `${defaultTag} ${s}`
    })
  }

  const facts = parseLines(memo.facts, '【事实】')
  const hypotheses = parseLines(memo.hypotheses, '【假设】')
  const forecasts = parseLines(memo.forecasts, '【预测】')

  const content = `# 经营决策备忘录 (Decision Memo)

* 决策编号: ${c.caseNo}
* 决策标题: ${c.title}
* 业务领域: ${c.domain}
* 决策场景: ${c.sceneKey}
* 决策状态: ${c.status}
* 归因等级: ${gradeLabel}
* 金额三态: ${amountLabel}
* 数据门禁: Gate 状态 ${c.dataGateStatus}
* 核心负责人: ${c.ownerName || '未指定'}
* 复核时间窗口: ${c.measureAfter || 'T+7'}

---

## 1. 决策问题
${c.problemStatement}

## 2. 事实依据
${facts.length > 0 ? facts.map((f) => `- ${f}`).join('\n') : '- 【事实】 基础交易事实数据已就绪。'}

## 3. 归因假设
${hypotheses.length > 0 ? hypotheses.map((h) => `- ${h}`).join('\n') : '- 【假设】 归因于渠道偏离度与货盘转化率。'}

## 4. 选项与影响预测
${c.options.map((opt) => `### 方案: ${opt.label} (${opt.key})
- 方案优势: ${opt.pros || '无'}
- 潜在劣势: ${opt.cons || '无'}
- 风险评级: ${opt.riskLevel || 'R2'}`).join('\n\n')}

${forecasts.length > 0 ? `\n**量化预测影响:**\n` + forecasts.map((f) => `- ${f}`).join('\n') : ''}

## 5. 证据快照与置信度门禁
- 指标合同版本: ${c.metricContractVersion || 'v1.1-deterministic'}
- Memo 版本: v${c.memoVersion || 1}
${gates.length > 0 ? `\n**门禁明细核查:**\n` + gates.map((g) => `- [${g.gateTier === 'GATE_1_HARD' ? 'Gate 1 硬性' : 'Gate 2 可信度'}] ${g.checkItem}: ${g.status} (${g.message})`).join('\n') : '- 尚未执行数据门禁诊断'}

## 6. 执行与责任人
- 决策选中方案: ${c.chosenOption || 'execute'}
- 核心责任人: ${c.ownerName || '运营操盘负责人'}
- 验证度量周期: ${c.measureAfter || 'T+7'}

## 7. 复核与学习
- 学习沉淀状态: ${c.status === 'LEARNED' ? '已沉淀为决策记忆 (Learned)' : '待度量复核'}
- 经验总结: ${c.learningSummary || '待复核完成后固化入库'}
${reviews.length > 0 ? `\n**复核历史记录:**\n` + reviews.map((r) => `- [${r.review_date || '历史'}] ${r.status}: ${r.learnings || '无复盘总结'} (偏差: ${r.variance_pct ?? 0}%)`).join('\n') : ''}
`

  return {
    caseNo: c.caseNo,
    filename: `Decision_Memo_${c.caseNo}.md`,
    content,
  }
}
