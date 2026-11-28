/**
 * ops-primitives.ts — 运营三原语 API（W3）
 *
 *  目标      /api/v1/biz-targets
 *  决策案    /api/v1/decision-cases
 *  AI 工作面  /api/v1/ai-ops/today-battle | /ai-ops/review/:sessionId | /ai-ops/inbox
 *  告警确认  /api/v1/system/alerts/:id/ack
 *
 * 原则：所有数值来自库内真实数据或显式「数据不足」，不做兜底、不写死占比。
 */

import type { FastifyInstance } from 'fastify'
import { requireTenantId } from '../lib/tenant-context.js'
import { z } from 'zod'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { getSessionAttribution, resolveTargetForSession, loadSessionFacts } from '../services/attribution-engine.js'
import {
  createDecisionCase,
  generateDecisionCasesFromReview,
  getDecisionCase,
  listDecisionCases,
  measureDecisionCase,
  transitionDecisionCase,
  evaluateDecisionGates,
  getDecisionGates,
  recordDecisionReview,
  getDecisionReviews,
  recordMetricSnapshot,
  getMetricSnapshots,
  exportDecisionMemo,
  type DecisionAction,
} from '../services/decision-cases.js'
import {
  listAnchorCompetencyProfiles,
  createAnchorCompetencyProfile,
  updateAnchorCompetencyProfile,
} from '../services/anchor-profiles.js'
import {
  listComplianceLearningTasks,
  createComplianceLearningTask,
  completeComplianceLearningTask,
} from '../services/compliance-tasks.js'
import { checkScriptCompliance } from '../services/controlled-compliance.js'
import { recommendProductSequence, exportChecklistCsv, exportChecklistExcel } from '../services/assortment-sequencing.js'

const WRITE_ROLES = ['super_admin', 'ops_director', 'ops_staff']
const APPROVE_ROLES = ['super_admin', 'ops_director']

type AuthUser = { id: number; role: string; tenantId?: number | null }

const tenantOf = (user: AuthUser) => requireTenantId(user.tenantId, 'routes.ops-primitives')

const targetSchema = z.object({
  periodType: z.enum(['day', 'week', 'month', 'campaign']),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scopeType: z.enum(['company', 'shop', 'live_room', 'anchor', 'product']),
  scopeId: z.number().int().positive().nullable().optional(),
  metricCode: z.string().trim().min(1),
  targetValue: z.number().finite(),
  currency: z.string().trim().min(1).max(8).optional(),
  note: z.string().trim().max(500).optional(),
})

const optionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  pros: z.string().max(500).optional(),
  cons: z.string().max(500).optional(),
  riskLevel: z.enum(['R0', 'R1', 'R2', 'R3', 'R4']).optional(),
})

const caseSchema = z.object({
  title: z.string().trim().min(2).max(200),
  problemStatement: z.string().trim().min(1).max(2000),
  domain: z.enum(['live', 'ads', 'traffic', 'assortment', 'finance', 'hr', 'governance']).default('live'),
  evidence: z.array(z.any()).default([]),
  options: z.array(optionSchema).min(2),
  chosenOption: z.string().trim().max(50).nullable().optional(),
  expectedImpact: z.record(z.string(), z.any()).default({}),
  riskLevel: z.enum(['R0', 'R1', 'R2', 'R3', 'R4']).default('R2'),
  ownerUserId: z.number().int().positive().nullable().optional(),
  ownerName: z.string().trim().max(100).nullable().optional(),
  measureAfterDays: z.number().int().min(1).max(90).optional(),
  status: z.enum(['DRAFT', 'INVESTIGATING']).optional(),
  sceneKey: z.string().trim().max(50).optional(),
  memoVersion: z.number().int().positive().optional(),
  metricContractVersion: z.string().trim().max(50).optional(),
  amountState: z.enum(['ESTIMATED', 'SETTLEMENT_DERIVED', 'FINALIZED']).optional(),
  attributionGrade: z.enum(['GRADE_A', 'GRADE_B', 'GRADE_C', 'GRADE_D', 'OBSERVED', 'ADJUSTED', 'EXPERIMENTAL']).optional(),
  dataGateStatus: z.enum(['PASS', 'FAIL', 'NOT_EVALUABLE']).optional(),
  executionOwners: z.array(z.any()).optional(),
  reviewLearning: z.record(z.string(), z.any()).optional(),
  submit: z.boolean().optional(),
})

export async function opsPrimitivesRoutes(app: FastifyInstance) {
  // ────────────────────────────────────────────────────────────
  // 目标（biz_targets）
  // ────────────────────────────────────────────────────────────
  app.get('/api/v1/biz-targets', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const q = request.query as { status?: string; metricCode?: string; periodType?: string }
    try {
      const rows = await withRlsContext(request, async (client) => {
        const params: any[] = [tenantOf(user)]
        const conditions = ['tenant_id = $1']
        if (q.status && q.status !== 'all') {
          params.push(q.status)
          conditions.push(`status = $${params.length}`)
        } else if (!q.status) {
          conditions.push(`status = 'active'`)
        }
        if (q.metricCode) {
          params.push(q.metricCode)
          conditions.push(`metric_code = $${params.length}`)
        }
        if (q.periodType) {
          params.push(q.periodType)
          conditions.push(`period_type = $${params.length}`)
        }
        const res = await client.query(
          `SELECT id, tenant_id AS "tenantId", period_type AS "periodType",
                  period_start::text AS "periodStart", period_end::text AS "periodEnd",
                  scope_type AS "scopeType", scope_id AS "scopeId", metric_code AS "metricCode",
                  target_value AS "targetValue", currency, version, status, source, note,
                  created_at AS "createdAt"
             FROM public.biz_targets
            WHERE ${conditions.join(' AND ')}
            ORDER BY period_start DESC, id DESC
            LIMIT 200`,
          params,
        )
        return res.rows
      })
      return sendOk(reply, { targets: rows })
    } catch (err) {
      request.log.warn({ err }, 'biz-targets list failed')
      return sendError(reply, 500, '查询目标失败')
    }
  })

  app.post('/api/v1/biz-targets', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const parsed = targetSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')
    }
    const body = parsed.data
    if (body.scopeType !== 'company' && !body.scopeId) {
      return sendError(reply, 400, '非公司范围必须提供 scopeId')
    }
    try {
      const result = await withRlsContext(request, async (client) => {
        const tenantId = tenantOf(user)
        const prev = await client.query(
          `SELECT COALESCE(MAX(version), 0)::int AS v
             FROM public.biz_targets
            WHERE tenant_id = $1 AND period_type = $2 AND period_start = $3::date
              AND scope_type = $4 AND COALESCE(scope_id, 0) = COALESCE($5::bigint, 0) AND metric_code = $6`,
          [tenantId, body.periodType, body.periodStart, body.scopeType, body.scopeId ?? null, body.metricCode],
        )
        const nextVersion = Number(prev.rows[0]?.v || 0) + 1
        await client.query(
          `UPDATE public.biz_targets
              SET status = 'superseded', updated_at = now()
            WHERE tenant_id = $1 AND period_type = $2 AND period_start = $3::date
              AND scope_type = $4 AND COALESCE(scope_id, 0) = COALESCE($5::bigint, 0)
              AND metric_code = $6 AND status = 'active'`,
          [tenantId, body.periodType, body.periodStart, body.scopeType, body.scopeId ?? null, body.metricCode],
        )
        const ins = await client.query(
          `INSERT INTO public.biz_targets
             (tenant_id, period_type, period_start, period_end, scope_type, scope_id,
              metric_code, target_value, currency, version, status, source, note, created_by)
           VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, 'active', 'manual', $11, $12)
           RETURNING id, period_type AS "periodType", period_start::text AS "periodStart",
                     period_end::text AS "periodEnd", scope_type AS "scopeType", scope_id AS "scopeId",
                     metric_code AS "metricCode", target_value AS "targetValue", currency, version, status, source, note`,
          [
            tenantId, body.periodType, body.periodStart, body.periodEnd, body.scopeType,
            body.scopeId ?? null, body.metricCode, body.targetValue, body.currency || 'CNY',
            nextVersion, body.note || null, user.id,
          ],
        )
        await writeAuditLog(client, {
          request,
          action: 'biz_target.create',
          resourceType: 'biz_targets',
          resourceId: ins.rows[0].id,
          afterData: ins.rows[0],
        })
        return ins.rows[0]
      })
      return reply.code(201).send({ success: true, message: '目标已创建', data: { target: result } })
    } catch (err) {
      request.log.warn({ err }, 'biz-targets create failed')
      return sendError(reply, 500, '创建目标失败')
    }
  })

  app.put('/api/v1/biz-targets/:id/archive', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    try {
      const rowCount = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE public.biz_targets SET status = 'archived', updated_at = now()
            WHERE id = $1 AND tenant_id = $2 AND status <> 'archived'`,
          [Number(id), tenantOf(user)],
        )
        return res.rowCount || 0
      })
      if (!rowCount) return sendError(reply, 404, '目标不存在或已归档')
      return sendOk(reply, { ok: true })
    } catch (err) {
      request.log.warn({ err }, 'biz-targets archive failed')
      return sendError(reply, 500, '归档目标失败')
    }
  })

  // ────────────────────────────────────────────────────────────
  // 决策案
  // ────────────────────────────────────────────────────────────
  app.get('/api/v1/decision-cases', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const q = request.query as { status?: string; limit?: string }
    try {
      const rows = await withRlsContext(request, (client) =>
        listDecisionCases(client, tenantOf(user), {
          status: q.status,
          limit: q.limit ? Number(q.limit) : 50,
        }),
      )
      return sendOk(reply, { cases: rows })
    } catch (err) {
      request.log.warn({ err }, 'decision-cases list failed')
      return sendError(reply, 500, '查询决策案失败')
    }
  })

  app.get('/api/v1/decision-cases/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    try {
      const row = await withRlsContext(request, (client) => getDecisionCase(client, tenantOf(user), Number(id)))
      if (!row) return sendError(reply, 404, '决策案不存在')
      return sendOk(reply, { case: row })
    } catch (err) {
      request.log.warn({ err }, 'decision-cases get failed')
      return sendError(reply, 500, '查询决策案失败')
    }
  })

  app.post('/api/v1/decision-cases', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const parsed = caseSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')
    }
    const body = parsed.data
    if (!body.options.some((o) => o.key === 'no_action')) {
      return sendError(reply, 400, '决策案方案必须包含「不做」(key=no_action)')
    }
    try {
      const result = await withRlsContext(request, async (client) => {
        const created = await createDecisionCase(client, {
          tenantId: tenantOf(user),
          title: body.title,
          problemStatement: body.problemStatement,
          domain: body.domain,
          evidence: body.evidence,
          options: body.options,
          chosenOption: body.chosenOption ?? null,
          expectedImpact: body.expectedImpact,
          riskLevel: body.riskLevel,
          ownerUserId: body.ownerUserId ?? null,
          ownerName: body.ownerName ?? null,
          measureAfterDays: body.measureAfterDays,
          createdBy: user.id,
          status: body.status || 'DRAFT',
          sceneKey: body.sceneKey,
          memoVersion: body.memoVersion,
          metricContractVersion: body.metricContractVersion,
          amountState: body.amountState,
          attributionGrade: body.attributionGrade,
          dataGateStatus: body.dataGateStatus,
          executionOwners: body.executionOwners,
          reviewLearning: body.reviewLearning,
        } as any)
        await writeAuditLog(client, {
          request,
          action: 'decision_case.create',
          resourceType: 'decision_cases',
          resourceId: created.caseRow.id,
          afterData: { id: created.caseRow.id, caseNo: created.caseRow.caseNo, title: created.caseRow.title },
        })
        return created
      })
      return reply.code(result.created ? 201 : 200).send({
        success: true,
        message: result.created ? '决策案已创建' : '同指纹决策案已存在',
        data: { case: result.caseRow, created: result.created },
      })
    } catch (err: any) {
      request.log.warn({ err }, 'decision-cases create failed')
      return sendError(reply, 500, err?.message || '创建决策案失败')
    }
  })

  const actionRoutes: Array<{ path: string; action: DecisionAction; roles: string[] }> = [
    { path: 'investigate', action: 'investigate', roles: WRITE_ROLES },
    { path: 'propose', action: 'propose', roles: WRITE_ROLES },
    { path: 'submit', action: 'submit', roles: WRITE_ROLES },
    { path: 'approve', action: 'approve', roles: APPROVE_ROLES },
    { path: 'reject', action: 'reject', roles: APPROVE_ROLES },
    { path: 'apply', action: 'apply', roles: WRITE_ROLES },
    { path: 'measure', action: 'measure', roles: WRITE_ROLES },
    { path: 'review', action: 'review', roles: WRITE_ROLES },
    { path: 'learn', action: 'learn', roles: WRITE_ROLES },
    { path: 'close', action: 'close', roles: WRITE_ROLES },
    { path: 'block', action: 'block', roles: WRITE_ROLES },
    { path: 'cancel', action: 'cancel', roles: WRITE_ROLES },
    { path: 'mark-data-insufficient', action: 'mark_data_insufficient', roles: WRITE_ROLES },
  ]

  for (const route of actionRoutes) {
    app.post(`/api/v1/decision-cases/:id/${route.path}`, { preHandler: [requireRole(route.roles)] }, async (request, reply) => {
      const user = (request as any).user as AuthUser
      const { id } = request.params as { id: string }
      try {
        const result = await withRlsContext(request, async (client) => {
          if (route.action === 'measure') {
            return measureDecisionCase(client, tenantOf(user), Number(id))
          }
          if (route.action === 'learn') {
            const body = request.body as { summary?: string } | undefined
            return transitionDecisionCase(client, tenantOf(user), Number(id), 'learn', user.id, body?.summary)
          }
          return transitionDecisionCase(client, tenantOf(user), Number(id), route.action, user.id)
        })
        if (!result.ok) return sendError(reply, result.code, result.message)
        return sendOk(reply, { case: result.caseRow })
      } catch (err) {
        request.log.warn({ err }, `decision-cases ${route.action} failed`)
        return sendError(reply, 500, '决策案状态更新失败')
      }
    })
  }

  // ── 决策案数据 Gate 详细检查与重新评估 ──
  app.post('/api/v1/decision-cases/:id/eval-gates', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    try {
      const result = await withRlsContext(request, (client) =>
        evaluateDecisionGates(client, tenantOf(user), Number(id)),
      )
      return sendOk(reply, result)
    } catch (err: any) {
      request.log.warn({ err }, 'eval-gates failed')
      return sendError(reply, 500, err?.message || '评估决策数据门禁失败')
    }
  })

  app.get('/api/v1/decision-cases/:id/gates', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    try {
      const gates = await withRlsContext(request, (client) =>
        getDecisionGates(client, tenantOf(user), Number(id)),
      )
      return sendOk(reply, { gates })
    } catch (err) {
      request.log.warn({ err }, 'get-gates failed')
      return sendError(reply, 500, '获取决策数据门禁明细失败')
    }
  })

  // ── 决策复核记录 (Decision Reviews) ──
  app.get('/api/v1/decision-cases/:id/reviews', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    try {
      const reviews = await withRlsContext(request, (client) =>
        getDecisionReviews(client, tenantOf(user), Number(id)),
      )
      return sendOk(reply, { reviews })
    } catch (err) {
      request.log.warn({ err }, 'get-reviews failed')
      return sendError(reply, 500, '获取决策复核历史失败')
    }
  })

  app.post('/api/v1/decision-cases/:id/reviews', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as any
    try {
      const review = await withRlsContext(request, (client) =>
        recordDecisionReview(client, tenantOf(user), Number(id), {
          reviewDate: body.reviewDate,
          plannedOutcome: body.plannedOutcome,
          actualOutcome: body.actualOutcome,
          variancePct: body.variancePct,
          learnings: String(body.learnings || ''),
          reviewerId: user.id,
          status: body.status,
        }),
      )
      return sendOk(reply, { review })
    } catch (err) {
      request.log.warn({ err }, 'post-reviews failed')
      return sendError(reply, 500, '创建决策复核记录失败')
    }
  })

  // ── 阶段指标快照 (Metric Snapshots) ──
  app.get('/api/v1/decision-cases/:id/snapshots', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    try {
      const snapshots = await withRlsContext(request, (client) =>
        getMetricSnapshots(client, tenantOf(user), Number(id)),
      )
      return sendOk(reply, { snapshots })
    } catch (err) {
      request.log.warn({ err }, 'get-snapshots failed')
      return sendError(reply, 500, '获取指标快照失败')
    }
  })

  app.post('/api/v1/decision-cases/:id/snapshots', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as any
    try {
      const snapshot = await withRlsContext(request, (client) =>
        recordMetricSnapshot(client, tenantOf(user), Number(id), {
          snapshotStage: body.snapshotStage || 'BASELINE',
          metricCode: String(body.metricCode || ''),
          metricValue: Number(body.metricValue || 0),
        }),
      )
      return sendOk(reply, { snapshot })
    } catch (err) {
      request.log.warn({ err }, 'post-snapshots failed')
      return sendError(reply, 500, '记录阶段指标快照失败')
    }
  })

  // ── 导出决策备忘录 (Export Decision Memo) ──
  app.get('/api/v1/decision-cases/:id/export', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    try {
      const memo = await withRlsContext(request, (client) =>
        exportDecisionMemo(client, tenantOf(user), Number(id)),
      )
      reply.header('Content-Type', 'text/markdown; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${memo.filename}"`)
      return reply.send(memo.content)
    } catch (err) {
      request.log.warn({ err }, 'export-memo failed')
      return sendError(reply, 500, '导出决策备忘录失败')
    }
  })

  // ── 7/14/30 天待复核调度列表 (Pending Reviews) ──
  app.get('/api/v1/decision-cases/pending-reviews', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const q = request.query as { days?: string }
    const days = Number(q.days) || 7
    try {
      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT id, case_no, title, status, owner_name, measure_after,
                  attribution_grade, amount_state, data_gate_status, created_at
             FROM public.decision_cases
            WHERE tenant_id = $1
              AND status IN ('EXECUTING', 'AWAITING_REVIEW', 'REVIEWED')
              AND measure_after <= (CURRENT_DATE + $2::int)
            ORDER BY measure_after ASC`,
          [tenantOf(user), days],
        )
        return res.rows
      })
      return sendOk(reply, { pendingReviews: rows, queryDays: days })
    } catch (err) {
      request.log.warn({ err }, 'pending-reviews failed')
      return sendError(reply, 500, '获取待复核决策案列表失败')
    }
  })

  // ── 主播轻量能力画像 ──
  app.get('/api/v1/anchors/competency-profiles', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    try {
      const profiles = await withRlsContext(request, (client) =>
        listAnchorCompetencyProfiles(client, tenantOf(user)),
      )
      return sendOk(reply, { profiles })
    } catch (err) {
      request.log.warn({ err }, 'list-anchor-profiles failed')
      return sendError(reply, 500, '获取主播画像列表失败')
    }
  })

  app.post('/api/v1/anchors/competency-profiles', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const body = (request.body || {}) as any
    if (!body.anchorName) return sendError(reply, 400, '主播姓名不能为空')
    try {
      const profile = await withRlsContext(request, (client) =>
        createAnchorCompetencyProfile(client, tenantOf(user), {
          anchorName: body.anchorName,
          suitableCategories: body.suitableCategories,
          styleTags: body.styleTags,
          hourlyRate: body.hourlyRate,
        }),
      )
      return reply.code(201).send({ success: true, data: { profile } })
    } catch (err) {
      request.log.warn({ err }, 'create-anchor-profile failed')
      return sendError(reply, 500, '创建主播画像失败')
    }
  })

  app.put('/api/v1/anchors/competency-profiles/:id', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as any
    try {
      const profile = await withRlsContext(request, (client) =>
        updateAnchorCompetencyProfile(client, tenantOf(user), Number(id), body),
      )
      if (!profile) return sendError(reply, 404, '主播画像不存在')
      return sendOk(reply, { profile })
    } catch (err) {
      request.log.warn({ err }, 'update-anchor-profile failed')
      return sendError(reply, 500, '更新主播画像失败')
    }
  })

  // ── 合规新规学习与整改任务 ──
  app.get('/api/v1/compliance/learning-tasks', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const q = request.query as { status?: string }
    try {
      const tasks = await withRlsContext(request, (client) =>
        listComplianceLearningTasks(client, tenantOf(user), q.status),
      )
      return sendOk(reply, { tasks })
    } catch (err) {
      request.log.warn({ err }, 'list-compliance-tasks failed')
      return sendError(reply, 500, '获取合规学习任务失败')
    }
  })

  app.post('/api/v1/compliance/learning-tasks', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const body = (request.body || {}) as any
    if (!body.title) return sendError(reply, 400, '任务标题不能为空')
    try {
      const task = await withRlsContext(request, (client) =>
        createComplianceLearningTask(client, tenantOf(user), {
          title: body.title,
          ruleReference: body.ruleReference,
          assigneeId: body.assigneeId,
          assigneeName: body.assigneeName,
          dueDate: body.dueDate,
        }),
      )
      return reply.code(201).send({ success: true, data: { task } })
    } catch (err) {
      request.log.warn({ err }, 'create-compliance-task failed')
      return sendError(reply, 500, '创建合规任务失败')
    }
  })

  app.post('/api/v1/compliance/learning-tasks/:id/complete', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as any
    try {
      const task = await withRlsContext(request, (client) =>
        completeComplianceLearningTask(client, tenantOf(user), Number(id), body.completionNotes),
      )
      if (!task) return sendError(reply, 404, '合规任务不存在')
      return sendOk(reply, { task })
    } catch (err) {
      request.log.warn({ err }, 'complete-compliance-task failed')
      return sendError(reply, 500, '完成合规任务失败')
    }
  })

  // ── 词级受控合规检查 ──
  app.post('/api/v1/compliance/check-script', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const body = (request.body || {}) as any
    try {
      const result = await withRlsContext(request, (client) =>
        checkScriptCompliance(client, tenantOf(user), String(body.scriptText || ''), user.id),
      )
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'check-script failed')
      return sendError(reply, 500, '话术合规检查失败')
    }
  })

  // ── 排品测算推荐与直播清单导出 ──
  app.post('/api/v1/assortment/recommend-sequence', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = (request.body || {}) as any
    try {
      const result = recommendProductSequence({
        goal: body.goal,
        durationMinutes: body.durationMinutes,
        products: body.products || [],
      })
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'recommend-sequence failed')
      return sendError(reply, 500, '排品测算推荐失败')
    }
  })

  app.post('/api/v1/assortment/export-checklist', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = (request.body || {}) as any
    try {
      const sequence = Array.isArray(body.sequence) ? body.sequence : []
      const format = body.format === 'excel' ? 'excel' : 'csv'
      if (format === 'excel') {
        const excel = exportChecklistExcel(sequence)
        return reply
          .header('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="live_assortment_checklist.xls"')
          .send(excel)
      }
      const csv = exportChecklistCsv(sequence)
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="live_assortment_checklist.csv"')
        .send(csv)
    } catch (err) {
      request.log.warn({ err }, 'export-checklist failed')
      return sendError(reply, 500, '导出排品清单失败')
    }
  })

  // ────────────────────────────────────────────────────────────
  // 复盘归因 + 从复盘生成决策案
  // ────────────────────────────────────────────────────────────
  app.get('/api/v1/ai-ops/review/:sessionId', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { sessionId } = request.params as { sessionId: string }
    try {
      const result = await withRlsContext(request, (client) =>
        getSessionAttribution(client, tenantOf(user), Number(sessionId)),
      )
      if (!result) return sendError(reply, 404, '场次不存在')
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'ai-ops review failed')
      return sendError(reply, 500, '生成复盘归因失败')
    }
  })

  app.post('/api/v1/ai-ops/review/:sessionId/decision-cases', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { sessionId } = request.params as { sessionId: string }
    try {
      const result = await withRlsContext(request, async (client) => {
        const attribution = await getSessionAttribution(client, tenantOf(user), Number(sessionId))
        if (!attribution) return { notFound: true as const }
        if (attribution.insufficient) return { insufficient: attribution.insufficientReasons }
        const generated = await generateDecisionCasesFromReview(
          client, tenantOf(user), user.id, attribution,
        )
        return { generated }
      })
      if ('notFound' in result) return sendError(reply, 404, '场次不存在')
      if ('insufficient' in result) {
        return sendError(reply, 422, `数据不足，无法生成决策案：${result.insufficient!.join('；')}`)
      }
      return sendOk(reply, result.generated)
    } catch (err) {
      request.log.warn({ err }, 'ai-ops generate decision cases failed')
      return sendError(reply, 500, '生成决策案失败')
    }
  })

  // ────────────────────────────────────────────────────────────
  // 作战台：目标缺口 / 预测区间 / 决策案 / 已执行动作
  // ────────────────────────────────────────────────────────────
  app.get('/api/v1/ai-ops/today-battle', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const q = request.query as { date?: string }
    const date = q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : new Date().toISOString().slice(0, 10)

    try {
      const payload = await withRlsContext(request, async (client) => {
        const tenantId = tenantOf(user)
        const { rows: sessionRows } = await client.query(
          `SELECT ls.id, ls.title, ls.room_id, ls.anchor_id, ls.date::text AS date,
                  ls.start_time::text AS start_time, ls.end_time::text AS end_time,
                  ls.status, ls.gmv, ls.orders, ls.views,
                  lr.name AS room_name, a.name AS anchor_name
             FROM public.live_sessions ls
             LEFT JOIN public.live_rooms lr ON lr.id = ls.room_id
             LEFT JOIN public.anchors a ON a.id = ls.anchor_id
            WHERE ls.date = $1::date
            ORDER BY ls.start_time NULLS LAST, ls.id ASC`,
          [date],
        )

        // 目标：逐场解析（范围越具体越优先），无目标则为 null，不再用实际 GMV 冒充
        let targetGmv = 0
        let targetCount = 0
        const sessionTargets: Array<number | null> = []
        for (const s of sessionRows) {
          const facts = await loadSessionFacts(client, tenantId, Number(s.id))
          const target = facts ? await resolveTargetForSession(client, tenantId, facts) : null
          sessionTargets.push(target ? target.sessionValue : null)
          if (target) {
            targetGmv += target.sessionValue
            targetCount++
          }
        }

        const actualGmv = sessionRows.reduce((acc: number, s: any) => acc + Number(s.gmv || 0), 0)

        // 预测：同星期几的日总 GMV 均值与分位区间，标注非事实
        const { rows: historyRows } = await client.query(
          `SELECT date::text AS date, SUM(gmv)::numeric AS total
             FROM public.live_sessions
            WHERE status = 'completed'
              AND date < $1::date
              AND date >= $1::date - INTERVAL '42 days'
              AND EXTRACT(DOW FROM date) = EXTRACT(DOW FROM $1::date)
            GROUP BY date
            ORDER BY date ASC`,
          [date],
        )
        let prediction: any = null
        if (historyRows.length >= 3) {
          const totals = historyRows.map((r: any) => Number(r.total)).sort((a, b) => a - b)
          const mean = totals.reduce((a, b) => a + b, 0) / totals.length
          const q = (p: number) => totals[Math.min(totals.length - 1, Math.floor(p * (totals.length - 1)))]
          prediction = {
            predictedGmv: Math.round(mean),
            interval: [Math.round(q(0.25)), Math.round(q(0.75))],
            samples: historyRows.length,
            method: '同星期几近 6 周日均值，区间为 P25–P75',
            isPrediction: true,
          }
        }

        const { rows: caseRows } = await client.query(
          `SELECT id, case_no AS "caseNo", title, problem_statement AS "problemStatement",
                  domain, risk_level AS "riskLevel", status, options, chosen_option AS "chosenOption",
                  expected_impact AS "expectedImpact", measure_after::text AS "measureAfter",
                  data_gate_status AS "dataGateStatus", attribution_grade AS "attributionGrade",
                  amount_state AS "amountState", scene_key AS "sceneKey", owner_name AS "ownerName",
                  created_at AS "createdAt"
             FROM public.decision_cases
            WHERE tenant_id = $1 AND status IN ('AWAITING_APPROVAL', 'PROPOSED', 'INVESTIGATING', 'DRAFT')
            ORDER BY CASE status
                       WHEN 'AWAITING_APPROVAL' THEN 0
                       WHEN 'PROPOSED' THEN 1
                       WHEN 'INVESTIGATING' THEN 2
                       ELSE 3
                     END, created_at DESC
            LIMIT 10`,
          [tenantId],
        )

        const { rows: actionRows } = await client.query(
          `SELECT t.id, t.title, t.assignee, t.status, t.progress,
                  t.decision_case_id AS "decisionCaseId", t.updated_at AS "updatedAt"
             FROM public.improvement_tasks t
            WHERE t.decision_case_id IS NOT NULL
              AND t.updated_at::date = $1::date
            ORDER BY t.updated_at DESC
            LIMIT 20`,
          [date],
        )

        return {
          date,
          targetGmv: targetCount > 0 ? Math.round(targetGmv * 100) / 100 : null,
          targetSessions: targetCount,
          actualGmv: Math.round(actualGmv * 100) / 100,
          gapGmv: targetCount > 0 ? Math.round((actualGmv - targetGmv) * 100) / 100 : null,
          prediction,
          todaySessions: sessionRows.map((s: any, i: number) => ({
            id: Number(s.id),
            title: s.title || `场次 #${s.id}`,
            roomName: s.room_name || '未关联直播间',
            anchorName: s.anchor_name || '未关联主播',
            timeRange: `${s.start_time || '--:--'} ~ ${s.end_time || '--:--'}`,
            status: s.status,
            gmv: Number(s.gmv) || 0,
            targetGmv: sessionTargets[i],
          })),
          pendingDecisionCases: caseRows,
          aiActionsExecutedToday: actionRows,
          insufficient: targetCount === 0,
          insufficientReasons: targetCount === 0 ? ['当日场次尚未配置生效中的 GMV 目标（biz_targets）'] : [],
          facts: true,
        }
      })
      return sendOk(reply, payload)
    } catch (err) {
      request.log.warn({ err }, 'ai-ops today-battle failed')
      return sendError(reply, 500, '获取今日作战数据失败')
    }
  })

  // ────────────────────────────────────────────────────────────
  // 待办收件箱：决策案待审（影响金额取预期影响，不写死）
  // ────────────────────────────────────────────────────────────
  app.get('/api/v1/ai-ops/inbox', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    try {
      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT id, case_no AS "caseNo", title, problem_statement AS "problemStatement",
                  domain, risk_level AS "riskLevel", status,
                  expected_impact AS "expectedImpact",
                  data_gate_status AS "dataGateStatus", attribution_grade AS "attributionGrade",
                  amount_state AS "amountState",
                  owner_name AS "ownerName", measure_after::text AS "measureAfter",
                  created_at AS "createdAt"
             FROM public.decision_cases
            WHERE tenant_id = $1 AND status = 'AWAITING_APPROVAL'
            ORDER BY CASE risk_level WHEN 'R4' THEN 0 WHEN 'R3' THEN 1 WHEN 'R2' THEN 2 ELSE 3 END,
                     created_at ASC
            LIMIT 100`,
          [tenantOf(user)],
        )
        return res.rows.map((r: any) => {
          const impact = r.expectedImpact && typeof r.expectedImpact === 'object' ? r.expectedImpact : {}
          const impactGmv = impact.impactGmv != null && Number.isFinite(Number(impact.impactGmv))
            ? Number(impact.impactGmv)
            : null
          return {
            kind: 'decision_case',
            id: `CASE-${r.id}`,
            caseId: Number(r.id),
            caseNo: r.caseNo,
            type: `决策案待审 · ${r.title}`,
            source: r.problemStatement,
            domain: r.domain,
            riskLevel: r.riskLevel,
            impactGmv,
            impactNote: impact.metricCode
              ? `预期 ${impact.metricCode}: ${impact.from} → ${impact.to}`
              : '未填写预期影响',
            deadline: r.measureAfter,
            approver: '运营总监 / 超管',
            ownerName: r.ownerName,
            status: r.status,
            createdAt: r.createdAt,
          }
        })
      })
      return sendOk(reply, { items: rows })
    } catch (err) {
      request.log.warn({ err }, 'ai-ops inbox failed')
      return sendError(reply, 500, '获取待办列表失败')
    }
  })

  // ────────────────────────────────────────────────────────────
  // 告警确认（X4）：落 alert_events.ack_*
  // ────────────────────────────────────────────────────────────
  app.put('/api/v1/system/alerts/:id/ack', { preHandler: [requireRole(WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user as AuthUser
    const { id } = request.params as { id: string }
    const body = request.body as { status?: 'acknowledged' | 'false_positive'; note?: string }
    const ackStatus = body?.status === 'false_positive' ? 'false_positive' : 'acknowledged'
    if (!/^\d+$/.test(id)) return sendError(reply, 400, '无效的告警 ID')
    try {
      const rowCount = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE public.alert_events
              SET ack_status = $1, ack_by = $2, ack_at = now(), ack_note = $3,
                  status = CASE WHEN $1 = 'acknowledged' THEN 'resolved' ELSE status END,
                  updated_at = now()
            WHERE id = $4
            RETURNING id, ack_status AS "ackStatus", ack_at AS "ackAt", ack_note AS "ackNote"`,
          [ackStatus, user.id, (body?.note || '').slice(0, 500) || null, Number(id)],
        )
        return res.rows[0] || null
      })
      if (!rowCount) return sendError(reply, 404, '告警不存在')
      return sendOk(reply, { alert: rowCount })
    } catch (err) {
      request.log.warn({ err }, 'alert ack failed')
      return sendError(reply, 500, '确认告警失败')
    }
  })
}

/** 供 Worker 值守任务复用：按日期解析公司目标（未配置则 null）。 */
export async function resolveCompanyDailyTarget(
  db: any,
  tenantId: number,
  date: string,
): Promise<{ targetValue: number; dailyValue: number; source: string } | null> {
  const { rows } = await db.query(
    `SELECT target_value, (period_end - period_start + 1)::int AS days, source
       FROM public.biz_targets
      WHERE tenant_id = $1 AND metric_code = 'gmv' AND status = 'active'
        AND scope_type = 'company'
        AND period_start <= $2::date AND period_end >= $2::date
      ORDER BY period_start DESC LIMIT 1`,
    [tenantId, date],
  )
  if (!rows.length) return null
  const targetValue = Number(rows[0].target_value)
  const days = Math.max(1, Number(rows[0].days) || 1)
  return { targetValue, dailyValue: Math.round((targetValue / days) * 100) / 100, source: rows[0].source }
}
