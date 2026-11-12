import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

interface SlaRuleRow {
  platform_code: string
  sla_type: string
  sla_name: string
  threshold_hours: number
  pickup_threshold_hours: number
  penalty_fixed_amount: string
  penalty_rate: string
  penalty_min_amount: string
  penalty_max_amount: string
  autonomy_min_score: string | null
  penalty_note: string
}

function clampPenalty(amount: number, minAmt: number, maxAmt: number): number {
  let res = amount
  if (minAmt > 0 && res < minAmt) res = minAmt
  if (maxAmt > 0 && res > maxAmt) res = maxAmt
  return Number(res.toFixed(2))
}

/** 根据 platform_sla_config 计算单笔运单的发货延期/虚假发货风险与预估赔付 */
export function evaluateWaybillSla(
  input: {
    platformCode: string
    orderAmount: number
    isCustomPresale: boolean
    paidAt: Date
    shippedAt?: Date | null
    pickupAt?: Date | null
    signedAt?: Date | null
  },
  rules: SlaRuleRow[],
  now: Date = new Date(),
) {
  const shipRule = rules.find((r) => r.platform_code === input.platformCode && (r.sla_type === 'ship' || r.sla_type === 'ship_delay'))
  const shipPresaleRule = rules.find((r) => r.platform_code === input.platformCode && r.sla_type === 'ship_presale')
  const fakeRule = rules.find((r) => r.platform_code === input.platformCode && r.sla_type === 'fake_ship') || shipRule

  // 预售/定制订单优先读取 platform_sla_config(ship_presale)，统一由配置表驱动时限与赔付
  const baseHours = shipRule ? Number(shipRule.threshold_hours || 48) : 48
  const shipLimitHours = input.isCustomPresale
    ? (shipPresaleRule ? Number(shipPresaleRule.threshold_hours) : baseHours)
    : baseHours
  const shipDeadlineAt = new Date(input.paidAt.getTime() + shipLimitHours * 3600 * 1000)

  const pickupLimitHours = fakeRule?.pickup_threshold_hours ? Number(fakeRule.pickup_threshold_hours) : 24
  const checkShipTime = input.shippedAt ?? now
  const isShipDelayed = checkShipTime.getTime() > shipDeadlineAt.getTime()

  let isFakeShipRisk = false
  if (input.shippedAt) {
    const checkPickupTime = input.pickupAt ?? now
    const pickupElapsedHours = (checkPickupTime.getTime() - input.shippedAt.getTime()) / (3600 * 1000)
    if (pickupElapsedHours > pickupLimitHours) {
      isFakeShipRisk = true
    }
  }

  let estimatedPenalty = 0
  const reasons: string[] = []

  if (isFakeShipRisk && fakeRule) {
    const fixed = Number(fakeRule.penalty_fixed_amount || 0)
    const rate = Number(fakeRule.penalty_rate || 0)
    const minAmt = Number(fakeRule.penalty_min_amount || 0)
    const maxAmt = Number(fakeRule.penalty_max_amount || 0)
    const calc = fixed > 0 ? fixed : clampPenalty(input.orderAmount * rate, minAmt, maxAmt)
    estimatedPenalty = Math.max(estimatedPenalty, calc)
    reasons.push(`上传单号超${pickupLimitHours}h无揽收轨迹（虚假发货风险，预估赔付¥${calc.toFixed(2)}）`)
  }

  if (isShipDelayed) {
    const activeShipRule = (input.isCustomPresale && shipPresaleRule) ? shipPresaleRule : shipRule
    let calc = 0
    if (activeShipRule) {
      const fixed = Number(activeShipRule.penalty_fixed_amount || 0)
      const rate = Number(activeShipRule.penalty_rate || 0)
      const minAmt = Number(activeShipRule.penalty_min_amount || 0)
      const maxAmt = Number(activeShipRule.penalty_max_amount || 0)
      calc = fixed > 0 ? fixed : (rate > 0 ? clampPenalty(input.orderAmount * rate, minAmt, maxAmt) : 0)
    }
    estimatedPenalty = Math.max(estimatedPenalty, calc)
    reasons.push(`超过${shipLimitHours}h发货时限（延迟发货，预估赔付¥${calc.toFixed(2)}）`)
  }

  let fulfillmentStatus: 'pending_ship' | 'shipped_no_pickup' | 'in_transit' | 'signed' = 'pending_ship'
  if (input.signedAt) fulfillmentStatus = 'signed'
  else if (input.pickupAt) fulfillmentStatus = 'in_transit'
  else if (input.shippedAt) fulfillmentStatus = 'shipped_no_pickup'

  return {
    shipDeadlineAt,
    isShipDelayed,
    isFakeShipRisk,
    estimatedPenaltyAmount: Number(estimatedPenalty.toFixed(2)),
    slaRiskReason: reasons.join('；'),
    fulfillmentStatus,
  }
}

export async function fulfillmentRoutes(app: FastifyInstance) {
  const writeRoles = ['super_admin', 'admin', 'ops_director', 'operator', 'ops_staff']

  // ── GET /api/v1/fulfillment/sla-rules ── 各平台官方法定履约规则配置
  app.get('/api/v1/fulfillment/sla-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(`
          SELECT c.*, p.platform_name
          FROM platform_sla_config c
          JOIN system_platform_configs p ON p.platform_code = c.platform_code
          ORDER BY p.sort_order, c.platform_code, c.sla_type
        `),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch fulfillment SLA rules')
      return sendError(reply, 500, '获取履约规则失败')
    }
  })

  // ── GET /api/v1/fulfillment/overview ── 履约大盘与违约赔付风控汇总
  app.get('/api/v1/fulfillment/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { summaryRows, byPlatform } = await withRlsContext(request, async (client) => {
        const sRes = await client.query(`
          SELECT
            COUNT(*)::int AS total_waybills,
            COUNT(*) FILTER (WHERE fulfillment_status = 'pending_ship')::int AS pending_ship_count,
            COUNT(*) FILTER (WHERE fulfillment_status = 'shipped_no_pickup')::int AS no_pickup_count,
            COUNT(*) FILTER (WHERE is_ship_delayed = true)::int AS delayed_count,
            COUNT(*) FILTER (WHERE is_fake_ship_risk = true)::int AS fake_ship_risk_count,
            COALESCE(SUM(estimated_penalty_amount), 0)::numeric(14,2) AS total_estimated_penalty
          FROM fact_fulfillment_waybill
        `)
        const pRes = await client.query(`
          SELECT
            w.platform_code,
            p.platform_name,
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (WHERE w.is_ship_delayed = true)::int AS delayed_count,
            COUNT(*) FILTER (WHERE w.is_fake_ship_risk = true)::int AS fake_ship_count,
            COALESCE(SUM(w.estimated_penalty_amount), 0)::numeric(14,2) AS estimated_penalty,
            CASE WHEN COUNT(*) > 0
                 THEN ROUND((COUNT(*) FILTER (WHERE w.is_ship_delayed = false AND w.is_fake_ship_risk = false)::numeric / COUNT(*)) * 100, 1)
                 ELSE 100 END AS compliant_rate
          FROM fact_fulfillment_waybill w
          JOIN system_platform_configs p ON p.platform_code = w.platform_code
          GROUP BY w.platform_code, p.platform_name, p.sort_order
          ORDER BY estimated_penalty DESC, p.sort_order
        `)
        return { summaryRows: sRes.rows, byPlatform: pRes.rows }
      })
      const s = summaryRows[0] || {}
      return sendOk(reply, {
        totalWaybills: Number(s.total_waybills || 0),
        pendingShipCount: Number(s.pending_ship_count || 0),
        noPickupCount: Number(s.no_pickup_count || 0),
        delayedCount: Number(s.delayed_count || 0),
        fakeShipRiskCount: Number(s.fake_ship_risk_count || 0),
        totalEstimatedPenalty: Number(s.total_estimated_penalty || 0),
        byPlatform: byPlatform.map((r: any) => ({
          platformCode: r.platform_code,
          platformName: r.platform_name,
          totalCount: Number(r.total_count),
          delayedCount: Number(r.delayed_count),
          fakeShipCount: Number(r.fake_ship_count),
          estimatedPenalty: Number(r.estimated_penalty),
          compliantRate: Number(r.compliant_rate),
        })),
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to load fulfillment overview')
      return sendError(reply, 500, '加载履约风控大盘失败')
    }
  })

  // ── GET /api/v1/fulfillment/waybills ── 运单履约明细与实时 SLA 倒计时
  app.get('/api/v1/fulfillment/waybills', async (request: FastifyRequest<{
    Querystring: { platformCode?: string; status?: string; riskOnly?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { platformCode, status, riskOnly } = request.query
      const conds: string[] = []
      const params: any[] = []
      let idx = 1
      if (platformCode) { conds.push(`w.platform_code = $${idx++}`); params.push(platformCode) }
      if (status) { conds.push(`w.fulfillment_status = $${idx++}`); params.push(status) }
      if (riskOnly === 'true' || riskOnly === '1') {
        conds.push(`(w.is_ship_delayed = true OR w.is_fake_ship_risk = true)`)
      }
      const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT
             w.*,
             p.platform_name,
             sh.shop_name,
             pr.sku_code,
             pr.product_name,
             ROUND(EXTRACT(EPOCH FROM (w.ship_deadline_at - COALESCE(w.shipped_at, NOW()))) / 3600.0, 1) AS ship_margin_hours,
             CASE WHEN w.shipped_at IS NOT NULL
                  THEN ROUND(EXTRACT(EPOCH FROM (COALESCE(w.pickup_at, NOW()) - w.shipped_at)) / 3600.0, 1)
                  ELSE NULL END AS pickup_wait_hours
           FROM fact_fulfillment_waybill w
           JOIN system_platform_configs p ON p.platform_code = w.platform_code
           JOIN dim_shop sh ON sh.id = w.shop_id
           LEFT JOIN dim_product pr ON pr.id = w.product_id
           ${where}
           ORDER BY w.is_fake_ship_risk DESC, w.is_ship_delayed DESC, w.ship_deadline_at ASC`,
          params,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch waybills')
      return sendError(reply, 500, '查询履约运单失败')
    }
  })

  // ── POST /api/v1/fulfillment/waybills ── 新增订单履约监控并按平台 SLA 评估风险
  app.post('/api/v1/fulfillment/waybills', { preHandler: [requireRole(writeRoles)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      platformCode?: string
      shopId?: number
      orderNo?: string
      waybillNo?: string
      carrierCode?: string
      productId?: number
      orderAmount?: number
      isCustomPresale?: boolean
      paidAt?: string
      shippedAt?: string
      pickupAt?: string
    }
    if (!body?.platformCode || !body?.shopId || !body?.orderNo) {
      return sendError(reply, 400, '平台、店铺ID和订单号不能为空')
    }
    try {
      const { rows } = await withRlsContext(request, async (client) => {
        const { rows: rules } = await client.query<SlaRuleRow>(
          `SELECT * FROM platform_sla_config WHERE platform_code = $1`,
          [body.platformCode!.trim()],
        )
        const paidAt = body.paidAt ? new Date(body.paidAt) : new Date()
        const shippedAt = body.shippedAt ? new Date(body.shippedAt) : null
        const pickupAt = body.pickupAt ? new Date(body.pickupAt) : null
        const evalRes = evaluateWaybillSla(
          {
            platformCode: body.platformCode!.trim(),
            orderAmount: Number(body.orderAmount || 0),
            isCustomPresale: Boolean(body.isCustomPresale),
            paidAt,
            shippedAt,
            pickupAt,
          },
          rules,
        )

        return client.query(
          `INSERT INTO fact_fulfillment_waybill
             (platform_code, shop_id, order_no, waybill_no, carrier_code, product_id, order_amount, is_custom_presale,
              paid_at, ship_deadline_at, shipped_at, pickup_at, fulfillment_status,
              is_ship_delayed, is_fake_ship_risk, estimated_penalty_amount, sla_risk_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (platform_code, shop_id, order_no) DO UPDATE
           SET waybill_no = COALESCE(EXCLUDED.waybill_no, public.fact_fulfillment_waybill.waybill_no),
               shipped_at = COALESCE(EXCLUDED.shipped_at, public.fact_fulfillment_waybill.shipped_at),
               pickup_at = COALESCE(EXCLUDED.pickup_at, public.fact_fulfillment_waybill.pickup_at),
               fulfillment_status = EXCLUDED.fulfillment_status,
               is_ship_delayed = EXCLUDED.is_ship_delayed,
               is_fake_ship_risk = EXCLUDED.is_fake_ship_risk,
               estimated_penalty_amount = EXCLUDED.estimated_penalty_amount,
               sla_risk_reason = EXCLUDED.sla_risk_reason,
               updated_at = NOW()
           RETURNING *`,
          [
            body.platformCode!.trim(),
            Number(body.shopId),
            body.orderNo!.trim(),
            body.waybillNo?.trim() || null,
            body.carrierCode?.trim() || 'SF',
            body.productId ? Number(body.productId) : null,
            Number(body.orderAmount || 0),
            Boolean(body.isCustomPresale),
            paidAt,
            evalRes.shipDeadlineAt,
            shippedAt,
            pickupAt,
            evalRes.fulfillmentStatus,
            evalRes.isShipDelayed,
            evalRes.isFakeShipRisk,
            evalRes.estimatedPenaltyAmount,
            evalRes.slaRiskReason,
          ],
        )
      })
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.error({ err }, 'Failed to upsert waybill')
      return sendError(reply, 500, '保存履约运单失败')
    }
  })

  // ── PATCH /api/v1/fulfillment/waybills/:id/dispatch ── 更新发货/揽收/签收节点并重算赔付
  app.patch<{ Params: { id: string } }>(
    '/api/v1/fulfillment/waybills/:id/dispatch',
    { preHandler: [requireRole(writeRoles)] },
    async (request, reply) => {
      const body = request.body as {
        waybillNo?: string
        carrierCode?: string
        shippedAt?: string
        pickupAt?: string
        signedAt?: string
      }
      try {
        const result = await withRlsContext(request, async (client) => {
          const existing = await client.query(`SELECT * FROM fact_fulfillment_waybill WHERE id = $1`, [Number(request.params.id)])
          if (existing.rows.length === 0) return { notFound: true as const }
          const cur = existing.rows[0]

          const { rows: rules } = await client.query<SlaRuleRow>(
            `SELECT * FROM platform_sla_config WHERE platform_code = $1`,
            [cur.platform_code],
          )

          const shippedAt = body?.shippedAt ? new Date(body.shippedAt) : (cur.shipped_at ? new Date(cur.shipped_at) : (body?.waybillNo ? new Date() : null))
          const pickupAt = body?.pickupAt ? new Date(body.pickupAt) : (cur.pickup_at ? new Date(cur.pickup_at) : null)
          const finalSignedAt = body?.signedAt ? new Date(body.signedAt) : (cur.signed_at ? new Date(cur.signed_at) : null)

          const evalRes = evaluateWaybillSla(
            {
              platformCode: cur.platform_code,
              orderAmount: Number(cur.order_amount),
              isCustomPresale: Boolean(cur.is_custom_presale),
              paidAt: new Date(cur.paid_at),
              shippedAt,
              pickupAt,
              signedAt: finalSignedAt,
            },
            rules,
          )

          const { rows } = await client.query(
            `UPDATE fact_fulfillment_waybill
           SET waybill_no = COALESCE($1, waybill_no),
               carrier_code = COALESCE($2, carrier_code),
               shipped_at = $3,
               pickup_at = $4,
               signed_at = $5,
               fulfillment_status = $6,
               is_ship_delayed = $7,
               is_fake_ship_risk = $8,
               estimated_penalty_amount = $9,
               sla_risk_reason = $10,
               updated_at = NOW()
           WHERE id = $11
           RETURNING *`,
            [
              body?.waybillNo?.trim() || null,
              body?.carrierCode?.trim() || null,
              shippedAt,
              pickupAt,
              finalSignedAt,
              evalRes.fulfillmentStatus,
              evalRes.isShipDelayed,
              evalRes.isFakeShipRisk,
              evalRes.estimatedPenaltyAmount,
              evalRes.slaRiskReason,
              Number(request.params.id),
            ],
          )
          return { row: rows[0] }
        })
        if ('notFound' in result && result.notFound) return sendError(reply, 404, '运单记录不存在')
        return sendOk(reply, result.row)
      } catch (err) {
        request.log.error({ err }, 'Failed to update waybill dispatch')
        return sendError(reply, 500, '更新运单节点失败')
      }
    })
}
