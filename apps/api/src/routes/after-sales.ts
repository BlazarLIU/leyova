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
    { preHandler: [requireRole([...writeRoles])] },
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

  // ═══════════════════════════════════════════════════════════════════
  // ── Master Plan §5.2 #12: 订单/退款事件流与行级 RMA (Line-Level RMA)
  // ═══════════════════════════════════════════════════════════════════

  // ── GET /api/v1/after-sales/rma-items ── 查询行级退货退款明细 (Line-level RMA)
  app.get<{
    Querystring: {
      rmaNo?: string
      orderId?: string
      storeId?: string
      platform?: string
      status?: string
      inspectionStatus?: string
      limit?: string
      offset?: string
    }
  }>('/api/v1/after-sales/rma-items', async (request: FastifyRequest<{
    Querystring: {
      rmaNo?: string
      orderId?: string
      storeId?: string
      platform?: string
      status?: string
      inspectionStatus?: string
      limit?: string
      offset?: string
    }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const { rmaNo, orderId, storeId, platform, status, inspectionStatus, limit, offset } = request.query || {}

    try {
      const result = await withRlsContext(request, async (client) => {
        const params: any[] = []
        const conds: string[] = ['1=1']

        if (rmaNo) {
          params.push(rmaNo)
          conds.push(`r.rma_no = $${params.length}`)
        }
        if (orderId) {
          params.push(orderId)
          conds.push(`r.source_order_id = $${params.length}`)
        }
        if (storeId) {
          params.push(Number(storeId))
          conds.push(`r.store_id = $${params.length}`)
        }
        if (platform) {
          params.push(platform)
          conds.push(`r.source_platform = $${params.length}`)
        }
        if (status) {
          params.push(status)
          conds.push(`r.status = $${params.length}`)
        }
        if (inspectionStatus) {
          params.push(inspectionStatus)
          conds.push(`r.inspection_status = $${params.length}`)
        }

        const countRes = await client.query(
          `SELECT COUNT(*)::int AS total FROM public.fact_order_rma_item r WHERE ${conds.join(' AND ')}`,
          params,
        )

        const take = Math.min(Number(limit) || 20, 100)
        const skip = Math.max(Number(offset) || 0, 0)
        params.push(take, skip)

        const listRes = await client.query(
          `SELECT r.id, r.rma_no, r.biz_date, r.source_platform, p.platform_name,
                  r.store_id, s.shop_name, r.source_order_id, r.source_sub_order_id,
                  r.internal_sku_id, r.product_name, r.rma_type, r.return_quantity,
                  r.refund_amount, r.reason_category, r.reason_detail,
                  r.return_tracking_no, r.return_logistics_company,
                  r.inspection_status, r.restock_status, r.status, r.handled_by,
                  r.created_at, r.updated_at
           FROM public.fact_order_rma_item r
           LEFT JOIN public.system_platform_configs p ON p.platform_code = r.source_platform
           LEFT JOIN public.dim_shop s ON s.id = r.store_id
           WHERE ${conds.join(' AND ')}
           ORDER BY r.id DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        )

        return {
          total: Number(countRes.rows[0]?.total || 0),
          items: listRes.rows.map((row) => ({
            id: Number(row.id),
            rmaNo: row.rma_no,
            bizDate: row.biz_date,
            platformCode: row.source_platform,
            platformName: row.platform_name || row.source_platform,
            shopId: Number(row.store_id),
            shopName: row.shop_name || '',
            orderId: row.source_order_id,
            subOrderId: row.source_sub_order_id,
            internalSkuId: row.internal_sku_id ? Number(row.internal_sku_id) : null,
            productName: row.product_name,
            rmaType: row.rma_type,
            returnQuantity: Number(row.return_quantity),
            refundAmount: Number(row.refund_amount),
            reasonCategory: row.reason_category,
            reasonDetail: row.reason_detail,
            returnTrackingNo: row.return_tracking_no,
            returnLogisticsCompany: row.return_logistics_company,
            inspectionStatus: row.inspection_status,
            restockStatus: row.restock_status,
            status: row.status,
            handledBy: row.handled_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })),
        }
      })

      return sendOk(reply, result)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch RMA items')
      return sendError(reply, 500, '获取行级售后退换单列表失败')
    }
  })

  // ── POST /api/v1/after-sales/rma-items ── 创建行级售后退换申请 (Line RMA)
  app.post<{
    Body: {
      sourcePlatform: string
      storeId: number
      sourceOrderId: string
      sourceSubOrderId: string
      internalSkuId?: number
      productName: string
      rmaType: 'refund_only' | 'return_and_refund' | 'exchange'
      returnQuantity: number
      refundAmount: number
      reasonCategory: 'size_mismatch' | 'quality_issue' | 'change_mind' | 'logistics_damage' | 'fake_goods' | 'wrong_item' | 'other'
      reasonDetail?: string
      returnTrackingNo?: string
      returnLogisticsCompany?: string
    }
  }>('/api/v1/after-sales/rma-items', { preHandler: [requireRole(writeRoles)] }, async (request, reply) => {
    const b = request.body
    if (!b?.sourcePlatform || !b?.storeId || !b?.sourceOrderId || !b?.sourceSubOrderId || !b?.productName || !b?.rmaType) {
      return sendError(reply, 400, '必须提供平台、店铺、主订单号、子订单行号、商品名称及售后类型')
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randSuffix = Math.floor(1000 + Math.random() * 9000)
    const rmaNo = `RMA-${todayStr}-${randSuffix}`
    const user = (request as any).user

    try {
      const rma = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `INSERT INTO public.fact_order_rma_item (
             rma_no, biz_date, source_platform, store_id, source_order_id, source_sub_order_id,
             internal_sku_id, product_name, rma_type, return_quantity, refund_amount,
             reason_category, reason_detail, return_tracking_no, return_logistics_company,
             inspection_status, restock_status, status, handled_by
           ) VALUES (
             $1, CURRENT_DATE, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14,
             'pending_inspection', 'not_restocked', 'pending', $15
           ) RETURNING *`,
          [
            rmaNo,
            b.sourcePlatform,
            Number(b.storeId),
            b.sourceOrderId.trim(),
            b.sourceSubOrderId.trim(),
            b.internalSkuId || null,
            b.productName.trim(),
            b.rmaType,
            Number(b.returnQuantity) || 1,
            Number(b.refundAmount) || 0,
            b.reasonCategory || 'other',
            b.reasonDetail || '',
            b.returnTrackingNo || '',
            b.returnLogisticsCompany || '',
            user?.name || user?.username || 'system',
          ],
        )

        // 写入订单生命周期事件流
        await client.query(
          `INSERT INTO public.fact_order_event_stream (
             source_platform, store_id, source_order_id, event_type, from_status, to_status,
             operator_type, operator_name, payload, occurred_at
           ) VALUES (
             $1, $2, $3, 'rma_created', '', 'RMA_PENDING',
             'customer_service', $4, $5::jsonb, now()
           )`,
          [
            b.sourcePlatform,
            Number(b.storeId),
            b.sourceOrderId.trim(),
            user?.name || user?.username || '客服',
            JSON.stringify({
              rmaNo,
              subOrderId: b.sourceSubOrderId,
              rmaType: b.rmaType,
              returnQuantity: b.returnQuantity,
              refundAmount: b.refundAmount,
            }),
          ],
        )

        return res.rows[0]
      })

      return sendOk(reply, rma)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to create line RMA item')
      return sendError(reply, 500, err?.message || '创建行级售后退换单失败')
    }
  })

  // ── PUT /api/v1/after-sales/rma-items/:id/status ── 审核/质检/处理行级 RMA 并联动库存自动回仓
  app.put<{
    Params: { id: string }
    Body: {
      status?: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'
      inspectionStatus?: 'pending_inspection' | 'passed' | 'failed_damaged' | 'waived'
      restockStatus?: 'not_restocked' | 'restocked_to_warehouse' | 'scrapped'
      warehouseCode?: string
      handledBy?: string
      remark?: string
    }
  }>('/api/v1/after-sales/rma-items/:id/status', { preHandler: [requireRole(writeRoles)] }, async (request, reply) => {
    const rmaId = Number(request.params.id)
    const b = request.body
    if (!rmaId) return sendError(reply, 400, '无效的 RMA ID')

    const user = (request as any).user

    try {
      const result = await withRlsContext(request, async (client) => {
        const curRes = await client.query(`SELECT * FROM public.fact_order_rma_item WHERE id = $1`, [rmaId])
        if (curRes.rows.length === 0) return { notFound: true as const }
        const cur = curRes.rows[0]

        const nextStatus = b.status || cur.status
        const nextInspect = b.inspectionStatus || cur.inspection_status
        const nextRestock = b.restockStatus || cur.restock_status

        // 更新 RMA 记录
        const updRes = await client.query(
          `UPDATE public.fact_order_rma_item
           SET status = $1,
               inspection_status = $2,
               restock_status = $3,
               handled_by = COALESCE($4, handled_by),
               updated_at = now()
           WHERE id = $5
           RETURNING *`,
          [
            nextStatus,
            nextInspect,
            nextRestock,
            b.handledBy || user?.name || user?.username,
            rmaId,
          ],
        )
        const updated = updRes.rows[0]

        // 联动库存回仓：如果质检通过并要求回仓且之前未回仓
        if (nextRestock === 'restocked_to_warehouse' && cur.restock_status !== 'restocked_to_warehouse') {
          const qty = Number(cur.return_quantity) || 1
          const whCode = b.warehouseCode || 'MAIN_WH'

          if (cur.internal_sku_id) {
            // 锁定在库库存记录
            const stockRes = await client.query(
              `SELECT on_hand_qty FROM public.fact_inventory_stock WHERE product_id = $1 AND warehouse_code = $2 FOR UPDATE`,
              [cur.internal_sku_id, whCode],
            )

            if (stockRes.rows.length > 0) {
              const beforeOnHand = Number(stockRes.rows[0].on_hand_qty)
              const afterOnHand = beforeOnHand + qty

              await client.query(
                `UPDATE public.fact_inventory_stock
                 SET on_hand_qty = on_hand_qty + $1, updated_at = now()
                 WHERE product_id = $2 AND warehouse_code = $3`,
                [qty, cur.internal_sku_id, whCode],
              )

              // 记录入库流水
              await client.query(
                `INSERT INTO public.fact_inventory_ledger (
                   product_id, warehouse_code, change_type, delta_qty,
                   before_on_hand, after_on_hand, ref_type, ref_id, operator_id, remark
                 ) VALUES (
                   $1, $2, 'return_in', $3,
                   $4, $5, 'rma_item', $6, $7, $8
                 )`,
                [
                  cur.internal_sku_id,
                  whCode,
                  qty,
                  beforeOnHand,
                  afterOnHand,
                  cur.rma_no,
                  user?.id || 1,
                  `行级 RMA 审核合格入库回仓: ${cur.source_order_id}`,
                ],
              )
            }
          }
        }

        // 记录生命周期事件
        const eventType = nextStatus === 'completed' ? 'item_refunded' : 'rma_created'
        await client.query(
          `INSERT INTO public.fact_order_event_stream (
             source_platform, store_id, source_order_id, event_type, from_status, to_status,
             operator_type, operator_name, payload, occurred_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             'operator', $7, $8::jsonb, now()
           )`,
          [
            cur.source_platform,
            cur.store_id,
            cur.source_order_id,
            eventType,
            cur.status,
            nextStatus,
            user?.name || user?.username || '售后主管',
            JSON.stringify({
              rmaNo: cur.rma_no,
              inspectionStatus: nextInspect,
              restockStatus: nextRestock,
              remark: b.remark || '',
            }),
          ],
        )

        return { rma: updated }
      })

      if ('notFound' in result && result.notFound) {
        return sendError(reply, 404, '行级售后退换单不存在')
      }
      return sendOk(reply, result.rma)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to update RMA item status')
      return sendError(reply, 500, err?.message || '更新行级售后状态失败')
    }
  })

  // ── GET /api/v1/orders/:orderId/timeline ── 查询订单全生命周期不可篡改事件流时间轴
  app.get<{ Params: { orderId: string } }>('/api/v1/orders/:orderId/timeline', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const orderId = request.params.orderId?.trim()
    if (!orderId) return sendError(reply, 400, '必须提供订单号 orderId')

    try {
      const data = await withRlsContext(request, async (client) => {
        const eventsRes = await client.query(
          `SELECT e.id, e.source_platform, p.platform_name, e.store_id, s.shop_name,
                  e.source_order_id, e.event_type, e.from_status, e.to_status,
                  e.operator_type, e.operator_name, e.payload, e.occurred_at, e.created_at
           FROM public.fact_order_event_stream e
           LEFT JOIN public.system_platform_configs p ON p.platform_code = e.source_platform
           LEFT JOIN public.dim_shop s ON s.id = e.store_id
           WHERE e.source_order_id = $1
           ORDER BY e.occurred_at ASC, e.id ASC`,
          [orderId],
        )

        const rmaRes = await client.query(
          `SELECT r.id, r.rma_no, r.source_sub_order_id, r.product_name, r.rma_type,
                  r.return_quantity, r.refund_amount, r.reason_category, r.status,
                  r.inspection_status, r.restock_status, r.created_at
           FROM public.fact_order_rma_item r
           WHERE r.source_order_id = $1
           ORDER BY r.id ASC`,
          [orderId],
        )

        return {
          orderId,
          totalEvents: eventsRes.rows.length,
          events: eventsRes.rows.map((r) => ({
            id: Number(r.id),
            platformCode: r.source_platform,
            platformName: r.platform_name || r.source_platform,
            shopId: Number(r.store_id),
            shopName: r.shop_name || '',
            orderId: r.source_order_id,
            eventType: r.event_type,
            fromStatus: r.from_status,
            toStatus: r.to_status,
            operatorType: r.operator_type,
            operatorName: r.operator_name,
            payload: r.payload || {},
            occurredAt: r.occurred_at,
          })),
          rmaItems: rmaRes.rows.map((r) => ({
            id: Number(r.id),
            rmaNo: r.rma_no,
            subOrderId: r.source_sub_order_id,
            productName: r.product_name,
            rmaType: r.rma_type,
            returnQuantity: Number(r.return_quantity),
            refundAmount: Number(r.refund_amount),
            reasonCategory: r.reason_category,
            status: r.status,
            inspectionStatus: r.inspection_status,
            restockStatus: r.restock_status,
            createdAt: r.created_at,
          })),
        }
      })

      return sendOk(reply, data)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch order timeline')
      return sendError(reply, 500, '获取订单生命周期事件轴失败')
    }
  })

  // ── POST /api/v1/orders/:orderId/events ── 记录/追加订单事件节点
  app.post<{
    Params: { orderId: string }
    Body: {
      sourcePlatform: string
      storeId: number
      eventType: 'order_placed' | 'payment_confirmed' | 'inventory_locked' | 'inventory_released' | 'shipped' | 'delivered' | 'rma_created' | 'item_refunded' | 'order_completed' | 'order_closed'
      fromStatus?: string
      toStatus: string
      operatorType?: 'system' | 'user' | 'operator' | 'staff' | 'platform_webhook' | 'customer_service'
      operatorName?: string
      payload?: Record<string, any>
    }
  }>('/api/v1/orders/:orderId/events', { preHandler: [requireRole(writeRoles)] }, async (request, reply) => {
    const orderId = request.params.orderId?.trim()
    const b = request.body
    if (!orderId || !b?.sourcePlatform || !b?.storeId || !b?.eventType || !b?.toStatus) {
      return sendError(reply, 400, '必须提供 orderId、sourcePlatform、storeId、eventType 以及 toStatus')
    }

    const user = (request as any).user

    try {
      const event = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `INSERT INTO public.fact_order_event_stream (
             source_platform, store_id, source_order_id, event_type, from_status, to_status,
             operator_type, operator_name, payload, occurred_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9::jsonb, now()
           ) RETURNING *`,
          [
            b.sourcePlatform,
            Number(b.storeId),
            orderId,
            b.eventType,
            b.fromStatus || '',
            b.toStatus,
            b.operatorType || 'operator',
            b.operatorName || user?.name || user?.username || 'system',
            JSON.stringify(b.payload || {}),
          ],
        )
        return res.rows[0]
      })

      return sendOk(reply, event)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to record order event')
      return sendError(reply, 500, err?.message || '记录订单生命周期事件失败')
    }
  })
}
