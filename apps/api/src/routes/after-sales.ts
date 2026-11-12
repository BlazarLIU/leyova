import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'
import { ensureRefundMonthPartition } from '../lib/partitions.js'

/** 根据平台规则（platform_sla_config）计算售后审单截点与仅退款自治保护标志 */
export function computeAfterSaleSla(
  _platformCode: string,
  refundType: string,
  shopExperienceScore: number,
  appliedAt: Date,
  rules: Array<{ sla_type: string; threshold_hours: number; autonomy_min_score: string | null }>,
) {
  const preferredAuditType =
    refundType === 'only_refund' ? 'aftersale_only_refund_audit' : 'aftersale_return_audit'
  const auditRule =
    rules.find((r) => r.sla_type === preferredAuditType) ||
    rules.find((r) => r.sla_type === 'aftersale_review')
  const auditHours = auditRule
    ? Number(auditRule.threshold_hours)
    : (refundType === 'only_refund' ? 24 : 48)

  const autonomyRule =
    rules.find((r) => r.sla_type === 'only_refund_autonomy' && r.autonomy_min_score !== null) ||
    rules.find((r) => r.autonomy_min_score !== null)
  const minScore = autonomyRule?.autonomy_min_score ? Number(autonomyRule.autonomy_min_score) : null
  const autonomyProtected = minScore !== null && shopExperienceScore >= minScore

  const auditDeadlineAt = new Date(appliedAt.getTime() + auditHours * 3600 * 1000)
  return { auditDeadlineAt, autonomyProtected }
}

export async function afterSalesRoutes(app: FastifyInstance) {
  const writeRoles = ['super_admin', 'admin', 'ops_director', 'operator', 'ops_staff']

  // ── GET /api/v1/after-sales/overview ── 售后归因矩阵与超时倒计时风险总览
  app.get('/api/v1/after-sales/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { summaryRows, reasonRows, canonicalStats } = await withRlsContext(request, async (client) => {
        const sRes = await client.query(`
          SELECT
            COUNT(*)::int AS total_tickets,
            COUNT(*) FILTER (WHERE ticket_status IN ('pending_audit', 'waiting_return'))::int AS open_tickets,
            COUNT(*) FILTER (
              WHERE ticket_status IN ('pending_audit', 'waiting_return')
                AND audit_deadline_at IS NOT NULL
                AND audit_deadline_at <= NOW() + INTERVAL '6 hours'
            )::int AS timeout_risk_count,
            COUNT(*) FILTER (WHERE autonomy_protected = true)::int AS autonomy_protected_count,
            COALESCE(SUM(refund_amount), 0)::numeric(14,2) AS total_refund_amount
          FROM fact_after_sale_tickets
        `)

        const rRes = await client.query(`
          SELECT
            reason_category,
            COUNT(*)::int AS ticket_count,
            COALESCE(SUM(refund_amount), 0)::numeric(14,2) AS refund_amount
          FROM fact_after_sale_tickets
          GROUP BY reason_category
          ORDER BY refund_amount DESC, ticket_count DESC
        `)

        const cRes = await client.query(`
          SELECT
            COUNT(*)::int AS canonical_refund_rows,
            COALESCE(SUM(refund_amount), 0)::numeric(14,2) AS canonical_refund_amount
          FROM canonical_refund_events
        `)
        return { summaryRows: sRes.rows, reasonRows: rRes.rows, canonicalStats: cRes.rows }
      })

      const s = summaryRows[0] || {}
      const totalAmt = Number(s.total_refund_amount || 0) || 1
      return sendOk(reply, {
        totalTickets: Number(s.total_tickets || 0),
        openTickets: Number(s.open_tickets || 0),
        timeoutRiskCount: Number(s.timeout_risk_count || 0),
        autonomyProtectedCount: Number(s.autonomy_protected_count || 0),
        totalRefundAmount: Number(s.total_refund_amount || 0),
        canonicalRefundRows: Number(canonicalStats[0]?.canonical_refund_rows || 0),
        canonicalRefundAmount: Number(canonicalStats[0]?.canonical_refund_amount || 0),
        reasonAttribution: reasonRows.map((r: any) => ({
          reasonCategory: r.reason_category,
          ticketCount: Number(r.ticket_count),
          refundAmount: Number(r.refund_amount),
          amountShare: Number(((Number(r.refund_amount) / totalAmt) * 100).toFixed(1)),
        })),
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch after-sales overview')
      return sendError(reply, 500, '获取售后总览失败')
    }
  })

  // ── GET /api/v1/after-sales/tickets ── 售后工单列表（带剩余倒计时与平台保护状态）
  app.get('/api/v1/after-sales/tickets', async (request: FastifyRequest<{
    Querystring: { platformCode?: string; status?: string; reasonCategory?: string; refundType?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { platformCode, status, reasonCategory, refundType } = request.query
      const conds: string[] = []
      const params: any[] = []
      let idx = 1
      if (platformCode) { conds.push(`t.platform_code = $${idx++}`); params.push(platformCode) }
      if (status) { conds.push(`t.ticket_status = $${idx++}`); params.push(status) }
      if (reasonCategory) { conds.push(`t.reason_category = $${idx++}`); params.push(reasonCategory) }
      if (refundType) { conds.push(`t.refund_type = $${idx++}`); params.push(refundType) }
      const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''

      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT
             t.*,
             p.platform_name,
             sh.shop_name,
             pr.sku_code,
             pr.product_name,
             u.real_name AS assignee_name,
             CASE WHEN t.audit_deadline_at IS NOT NULL
                  THEN ROUND(EXTRACT(EPOCH FROM (t.audit_deadline_at - NOW())) / 3600.0, 1)
                  ELSE NULL END AS remaining_hours
           FROM fact_after_sale_tickets t
           JOIN system_platform_configs p ON p.platform_code = t.platform_code
           JOIN dim_shop sh ON sh.id = t.shop_id
           LEFT JOIN dim_product pr ON pr.id = t.product_id
           LEFT JOIN users u ON u.id = t.assignee_id
           ${where}
           ORDER BY
             CASE WHEN t.ticket_status IN ('pending_audit', 'waiting_return') THEN 0 ELSE 1 END,
             t.audit_deadline_at ASC NULLS LAST,
             t.id DESC`,
          params,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to query after-sale tickets')
      return sendError(reply, 500, '查询售后工单失败')
    }
  })

  // ── POST /api/v1/after-sales/tickets ── 新建售后工单并同步沉淀至 canonical_refund_events 分区表
  app.post('/api/v1/after-sales/tickets', { preHandler: [requireRole(writeRoles)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      platformCode?: string
      shopId?: number
      sourceOrderId?: string
      sourceRefundId?: string
      productId?: number
      refundType?: 'only_refund' | 'return_refund' | 'exchange'
      refundAmount?: number
      reasonCategory?: 'size_mismatch' | 'quality_defect' | 'logistics_slow' | 'not_as_described' | 'buyer_remorse' | 'other'
      reasonDetail?: string
      shopExperienceScore?: number
      appliedAt?: string
    }
    if (!body?.platformCode || !body?.shopId || !body?.sourceOrderId || !body?.refundType || !body?.reasonCategory) {
      return sendError(reply, 400, '平台、店铺、订单号、退款类型及原因归因为必填项')
    }

    try {
      const platformCode = body.platformCode.trim()
      const appliedAt = body.appliedAt ? new Date(body.appliedAt) : new Date()
      const bizDateStr = appliedAt.toISOString().slice(0, 10)
      await ensureRefundMonthPartition(bizDateStr)

      const ticket = await withRlsContext(request, async (client) => {
        const ticketNo = `AS-${bizDateStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
        const sourceRefundId = body.sourceRefundId?.trim() || `RFD-${Date.now()}`
        const score = Number(body.shopExperienceScore ?? 4.78)

        const { rows: rules } = await client.query(
          `SELECT sla_type, threshold_hours, autonomy_min_score FROM platform_sla_config WHERE platform_code = $1`,
          [platformCode],
        )
        const { auditDeadlineAt, autonomyProtected } = computeAfterSaleSla(
          platformCode,
          body.refundType!,
          score,
          appliedAt,
          rules,
        )

        const inserted = await client.query(
          `INSERT INTO fact_after_sale_tickets
             (ticket_no, platform_code, shop_id, source_order_id, source_refund_id, product_id,
              refund_type, refund_amount, reason_category, reason_detail, ticket_status,
              shop_experience_score, autonomy_protected, audit_deadline_at, applied_at, assignee_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending_audit', $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            ticketNo,
            platformCode,
            Number(body.shopId),
            body.sourceOrderId!.trim(),
            sourceRefundId,
            body.productId ? Number(body.productId) : null,
            body.refundType,
            Number(body.refundAmount || 0),
            body.reasonCategory,
            body.reasonDetail?.trim() || '',
            score,
            autonomyProtected,
            auditDeadlineAt,
            appliedAt,
            request.user?.id || null,
          ],
        )

        await client.query(
          `INSERT INTO canonical_refund_events
             (biz_date, source_platform, store_id, source_refund_id, source_order_id, refund_type,
              refund_amount, refund_status, refunded_at_source, maturity_status)
           VALUES ($1::date, $2, $3, $4, $5, $6, $7, 'pending_audit', $8, 'PENDING')
           ON CONFLICT (biz_date, source_platform, store_id, source_refund_id) DO UPDATE
           SET refund_amount = EXCLUDED.refund_amount,
               refund_type = EXCLUDED.refund_type,
               refund_status = EXCLUDED.refund_status`,
          [
            bizDateStr,
            platformCode,
            Number(body.shopId),
            sourceRefundId,
            body.sourceOrderId!.trim(),
            body.refundType,
            Number(body.refundAmount || 0),
            appliedAt,
          ],
        )
        return inserted.rows[0]
      })
      return sendOk(reply, ticket)
    } catch (err) {
      request.log.error({ err }, 'Failed to create after-sale ticket')
      return sendError(reply, 500, '创建售后工单失败')
    }
  })

  // ── PATCH /api/v1/after-sales/tickets/:id/handle ── 售后审核处置与标准退款状态同步
  app.patch<{ Params: { id: string } }>(
    '/api/v1/after-sales/tickets/:id/handle',
    { preHandler: [requireRole([...writeRoles, 'finance'])] },
    async (request, reply) => {
    const body = request.body as {
      ticketStatus?: 'waiting_return' | 'approved' | 'rejected' | 'platform_intervened' | 'closed'
      resolutionNote?: string
    }
    if (!body?.ticketStatus) {
      return sendError(reply, 400, '必须提供目标处理状态')
    }

    try {
      const isFinal = ['approved', 'rejected', 'closed'].includes(body.ticketStatus)
      const result = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          `UPDATE fact_after_sale_tickets
           SET ticket_status = $1,
               resolution_note = COALESCE($2, resolution_note),
               resolved_at = CASE WHEN $3 THEN NOW() ELSE resolved_at END,
               assignee_id = COALESCE(assignee_id, $4),
               updated_at = NOW()
           WHERE id = $5
           RETURNING *`,
          [
            body.ticketStatus,
            body.resolutionNote?.trim() ?? null,
            isFinal,
            request.user?.id || null,
            Number(request.params.id),
          ],
        )
        if (rows.length === 0) return { notFound: true as const }
        const t = rows[0]
        await client.query(
          `UPDATE canonical_refund_events
           SET refund_status = $1,
               maturity_status = $2
           WHERE source_platform = $3 AND store_id = $4 AND source_refund_id = $5`,
          [t.ticket_status, isFinal ? 'FINAL' : 'PENDING', t.platform_code, t.shop_id, t.source_refund_id],
        )
        return { ticket: t }
      })
      if ('notFound' in result && result.notFound) {
        return sendError(reply, 404, '售后工单不存在')
      }
      return sendOk(reply, result.ticket)
    } catch (err) {
      request.log.error({ err }, 'Failed to handle after-sale ticket')
      return sendError(reply, 500, '处理售后工单失败')
    }
  })
}
