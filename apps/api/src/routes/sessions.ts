import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canAccessCostAsync, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

const SESSION_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'controller']

export async function sessionRoutes(app: FastifyInstance) {
  // ── GET /api/v1/sessions/:id ── 单场次详情
  app.get('/api/v1/sessions/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT ls.*, a.name AS anchor_name, lr.name AS room_name
           FROM live_sessions ls
           LEFT JOIN anchors a ON a.id = ls.anchor_id
           LEFT JOIN live_rooms lr ON lr.id = ls.room_id
           WHERE ls.id = $1`,
          [id]
        )
      )
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '场次不存在' })
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'sessions/:id query failed')
      return reply.code(500).send({ success: false, message: '查询失败' })
    }
  })

  // ── POST /api/v1/sessions ── 创建场次
  app.post('/api/v1/sessions', { preHandler: [requireRole(SESSION_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const body = request.body as {
        title?: string; roomId?: number; anchorId?: number
        date?: string; startTime?: string; endTime?: string
      }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO live_sessions (room_id, anchor_id, date, start_time, end_time, title, status, gmv, orders)
           VALUES ($1, $2, $3::date, $4::time, $5::time, $6, 'scheduled', 0, 0)
           RETURNING *`,
          [body.roomId, body.anchorId, body.date, body.startTime, body.endTime, body.title || ''],
        ),
      )
      return sendOk(reply, { session: rows[0] }, '场次创建成功')
    } catch (err) {
      request.log.warn({ err }, 'POST /sessions failed')
      if ((err as any)?.code === '23503') {
        return reply.code(400).send({ success: false, message: '房间或主播不存在' })
      }
      return reply.code(500).send({ success: false, message: '创建失败' })
    }
  })

  // ── PATCH /api/v1/sessions/:id ── 更新场次
  app.patch('/api/v1/sessions/:id', { preHandler: [requireRole(SESSION_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as Partial<{
        title: string; roomId: number; anchorId: number
        date: string; startTime: string; endTime: string; status: string
        gmv: number; orders: number
      }>

      const fields: string[] = []
      const values: any[] = []
      let idx = 1

      if (body.title !== undefined) { fields.push(`title = $${idx++}`); values.push(body.title) }
      if (body.roomId !== undefined) { fields.push(`room_id = $${idx++}`); values.push(body.roomId) }
      if (body.anchorId !== undefined) { fields.push(`anchor_id = $${idx++}`); values.push(body.anchorId) }
      if (body.date !== undefined) { fields.push(`date = $${idx++}::date`); values.push(body.date) }
      if (body.startTime !== undefined) { fields.push(`start_time = $${idx++}::time`); values.push(body.startTime) }
      if (body.endTime !== undefined) { fields.push(`end_time = $${idx++}::time`); values.push(body.endTime) }
      if (body.status !== undefined) { fields.push(`status = $${idx++}`); values.push(body.status) }
      if (body.gmv !== undefined) { fields.push(`gmv = $${idx++}`); values.push(body.gmv) }
      if (body.orders !== undefined) { fields.push(`orders = $${idx++}`); values.push(body.orders) }

      if (fields.length === 0) {
        return reply.code(400).send({ success: false, message: '没有需要更新的字段' })
      }

      values.push(id)
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `UPDATE live_sessions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
          values,
        ),
      )
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '场次不存在' })
      return sendOk(reply, { session: rows[0] }, '更新成功')
    } catch (err) {
      request.log.warn({ err }, 'PATCH /sessions/:id failed')
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // ── POST /api/v1/sessions/:id/finalize ── 完结场次
  app.post('/api/v1/sessions/:id/finalize', { preHandler: [requireRole(SESSION_WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { gmv?: number; orders?: number }
      const { rows } = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE live_sessions
           SET status = 'completed', gmv = COALESCE($1, gmv), orders = COALESCE($2, orders), end_time = CURRENT_TIME
           WHERE id = $3 AND status != 'completed'
           RETURNING *`,
          [body.gmv, body.orders, id],
        )
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            actorUserId: user?.id,
            action: 'session.finalize',
            resourceType: 'live_session',
            resourceId: id,
            afterData: res.rows[0],
            request,
          })
        }
        return res
      })
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '场次不存在或已完结' })
      return sendOk(reply, { session: rows[0] }, '场次已完结')
    } catch (err) {
      request.log.warn({ err }, 'POST /sessions/:id/finalize failed')
      return reply.code(500).send({ success: false, message: '完结失败' })
    }
  })

  // ── POST /api/v1/sessions/:id/start ── 开播（P1-B19）
  //    审计断点：此前只有 finalize（完结），没有「开播」动作，
  //    中控/运营无法让场次从 scheduled 流转到 live，只能手工改库。
  app.post('/api/v1/sessions/:id/start', { preHandler: [requireRole(SESSION_WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user
    try {
      const { id } = request.params as { id: string }
      const { rows } = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE live_sessions
              SET status = 'live',
                  start_time = COALESCE(start_time, CURRENT_TIME)
            WHERE id = $1 AND status = 'scheduled'
            RETURNING *`,
          [id],
        )
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            actorUserId: user?.id,
            action: 'session.start',
            resourceType: 'live_session',
            resourceId: id,
            afterData: res.rows[0],
            request,
          })
        }
        return res
      })
      if (rows.length === 0) {
        return reply.code(409).send({
          success: false,
          message: '场次不存在或当前状态不允许开播（仅 scheduled 可开播）',
        })
      }
      return sendOk(reply, { session: rows[0] }, '已开播')
    } catch (err) {
      request.log.warn({ err }, 'POST /sessions/:id/start failed')
      return reply.code(500).send({ success: false, message: '开播失败' })
    }
  })

  // ── POST /api/v1/sessions/:id/cancel ── 取消场次（P1-B19 配套）
  //    取消后，排班人员按方案 A 规则计为缺勤（见 v_staff_attendance）
  app.post('/api/v1/sessions/:id/cancel', { preHandler: [requireRole(SESSION_WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user
    try {
      const { id } = request.params as { id: string }
      const body = (request.body || {}) as { reason?: string }
      const { rows } = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE live_sessions
              SET status = 'cancelled'
            WHERE id = $1 AND status IN ('scheduled','live')
            RETURNING *`,
          [id],
        )
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            actorUserId: user?.id,
            action: 'session.cancel',
            resourceType: 'live_session',
            resourceId: id,
            afterData: { ...res.rows[0], reason: body.reason || '' },
            request,
          })
        }
        return res
      })
      if (rows.length === 0) {
        return reply.code(409).send({
          success: false,
          message: '场次不存在或已完结/已取消',
        })
      }
      return sendOk(reply, { session: rows[0] }, '场次已取消')
    } catch (err) {
      request.log.warn({ err }, 'POST /sessions/:id/cancel failed')
      return reply.code(500).send({ success: false, message: '取消失败' })
    }
  })

  // ── GET /api/v1/sessions/:id/metrics ── 场次指标
  app.get('/api/v1/sessions/:id/metrics', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, gmv, orders, duration_min,
                  COALESCE(gmv / NULLIF(orders, 0), 0) AS avg_order_value
           FROM live_sessions WHERE id = $1`,
          [id]
        )
      )
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '场次不存在' })
      return sendOk(reply, { metrics: rows[0] })
    } catch (err) {
      request.log.warn({ err }, 'GET /sessions/:id/metrics failed')
      return reply.code(500).send({ success: false, message: '查询失败' })
    }
  })

  // ── GET /api/v1/sessions/:id/pnl ── 单场次盈亏闭环（P6 / 审计断点）
  // 规则：回答「这场赚没赚」；缺成本项返回 null，严禁返回虚假 0
  app.get('/api/v1/sessions/:id/pnl', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const user = (request as any).user

      const allowCost = await canAccessCostAsync(user?.id, user?.role, user?.userType, undefined)
      const isCostMasked = !allowCost && user?.userType !== 'brand_viewer'

      const result = await withRlsContext(request, async (client) => {
        // 1. 查询场次基础信息与归属直播间、店铺
        const sessRes = await client.query(
          `SELECT ls.id, ls.room_id, ls.anchor_id, ls.date, ls.title, ls.status,
                  ls.gmv, ls.return_amount, ls.ad_cost,
                  lr.shop_id, lr.platform_code, lr.name AS room_name,
                  a.name AS anchor_name, ds.shop_name
           FROM live_sessions ls
           JOIN live_rooms lr ON lr.id = ls.room_id
           LEFT JOIN dim_shop ds ON ds.id = lr.shop_id
           LEFT JOIN anchors a ON a.id = ls.anchor_id
           WHERE ls.id = $1`,
          [id],
        )

        if (sessRes.rows.length === 0) {
          return null
        }

        const sess = sessRes.rows[0]
        const gmv = Number(sess.gmv) || 0
        const returnAmount = Number(sess.return_amount) || 0
        const netRevenue = Number((gmv - returnAmount).toFixed(2))

        if (isCostMasked) {
          return {
            sessionId: Number(sess.id),
            title: sess.title,
            date: sess.date,
            roomId: sess.room_id,
            roomName: sess.room_name,
            shopId: sess.shop_id,
            shopName: sess.shop_name,
            platformCode: sess.platform_code,
            anchorId: sess.anchor_id,
            anchorName: sess.anchor_name,
            status: sess.status,
            gmv,
            returnAmount,
            netRevenue,
            adSpend: null,
            platformFee: null,
            anchorCommission: null,
            pitFee: null,
            totalCosts: null,
            netProfit: null,
            netProfitMarginPct: null,
            isComplete: false,
            missingCosts: ['ad_spend', 'platform_fee', 'anchor_commission'],
            costMasked: true,
            sources: {},
          }
        }

        // 2. 统计当天同直播间场次总数，以便分摊日级共享成本
        const cntRes = await client.query(
          `SELECT count(*)::int as count FROM live_sessions WHERE room_id = $1 AND date = $2`,
          [sess.room_id, sess.date],
        )
        const sessionCount = Math.max(cntRes.rows[0]?.count || 1, 1)

        // 3. 投流成本 (从 fact_ad_spend_daily 获取，无则回退至 session.ad_cost，均无则 null)
        let adSpend: number | null = null
        let adSpendSource: string | null = null
        if (sess.shop_id) {
          const adRes = await client.query(
            `SELECT sum(ad_spend) as ad_spend
             FROM fact_ad_spend_daily
             WHERE shop_id = $1 AND biz_date = $2`,
            [sess.shop_id, sess.date],
          )
          if (adRes.rows[0]?.ad_spend !== null && adRes.rows[0]?.ad_spend !== undefined) {
            adSpend = Number((Number(adRes.rows[0].ad_spend) / sessionCount).toFixed(2))
            adSpendSource = 'fact_ad_spend_daily'
          }
        }
        if (adSpend === null && Number(sess.ad_cost) > 0) {
          adSpend = Number(sess.ad_cost)
          adSpendSource = 'live_sessions.ad_cost'
        }

        // 4. 平台技术服务费 (从 fact_settlement_cycles 获取，无则 null)
        let platformFee: number | null = null
        let platformFeeSource: string | null = null
        if (sess.shop_id) {
          const feeRes = await client.query(
            `SELECT sum(platform_fee) as platform_fee
             FROM fact_settlement_cycles
             WHERE shop_id = $1 AND order_date = $2`,
            [sess.shop_id, sess.date],
          )
          if (feeRes.rows[0]?.platform_fee !== null && feeRes.rows[0]?.platform_fee !== undefined) {
            platformFee = Number((Number(feeRes.rows[0].platform_fee) / sessionCount).toFixed(2))
            platformFeeSource = 'fact_settlement_cycles'
          }
        }

        // 5. 主播/KOL 佣金与坑位费 (从 fact_kol_cooperation 获取，无则 null)
        let anchorCommission: number | null = null
        let pitFee: number | null = null
        let kolSource: string | null = null
        if (sess.shop_id) {
          const kolRes = await client.query(
            `SELECT sum(commission_amount) as commission_amount, sum(pit_fee) as pit_fee
             FROM fact_kol_cooperation
             WHERE shop_id = $1 AND publish_date = $2`,
            [sess.shop_id, sess.date],
          )
          if (kolRes.rows[0]?.commission_amount !== null && kolRes.rows[0]?.commission_amount !== undefined) {
            anchorCommission = Number((Number(kolRes.rows[0].commission_amount) / sessionCount).toFixed(2))
            pitFee = kolRes.rows[0].pit_fee !== null ? Number((Number(kolRes.rows[0].pit_fee) / sessionCount).toFixed(2)) : null
            kolSource = 'fact_kol_cooperation'
          }
        }

        // 6. 完整性评估与单场净利润计算
        // 缺成本项时严禁填补假 0，而是将对应指标与净利润置为 null，并在 missingCosts 中公示
        const missingCosts: string[] = []
        if (adSpend === null) missingCosts.push('ad_spend')
        if (platformFee === null) missingCosts.push('platform_fee')
        if (anchorCommission === null) missingCosts.push('anchor_commission')

        const isComplete = missingCosts.length === 0
        const totalCosts = isComplete
          ? Number(((adSpend ?? 0) + (platformFee ?? 0) + (anchorCommission ?? 0)).toFixed(2))
          : null
        const netProfit = isComplete ? Number((netRevenue - totalCosts!).toFixed(2)) : null
        const netProfitMarginPct = isComplete && gmv > 0 ? Number(((netProfit! / gmv) * 100).toFixed(2)) : null

        return {
          sessionId: Number(sess.id),
          title: sess.title,
          date: sess.date,
          roomId: sess.room_id,
          roomName: sess.room_name,
          shopId: sess.shop_id,
          shopName: sess.shop_name,
          platformCode: sess.platform_code,
          anchorId: sess.anchor_id,
          anchorName: sess.anchor_name,
          status: sess.status,
          gmv,
          returnAmount,
          netRevenue,
          adSpend,
          platformFee,
          anchorCommission,
          pitFee,
          totalCosts,
          netProfit,
          netProfitMarginPct,
          isComplete,
          missingCosts,
          costMasked: false,
          sources: {
            adSpend: adSpendSource,
            platformFee: platformFeeSource,
            anchorCommission: kolSource,
          },
        }
      })

      if (!result) return reply.code(404).send({ success: false, message: '场次不存在' })
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'GET /sessions/:id/pnl failed')
      return reply.code(500).send({ success: false, message: '查询场次盈亏失败' })
    }
  })

  // ── GET /api/v1/sessions/:id/full-trace ── session_id 全链路穿透查询（Master Plan §5.2 #1）
  // 聚合 6 大核心领域：场次基础人货场、排品计划、岗位分工、投流计划与消耗、财务真实 PnL、履约与售后 SLA
  app.get('/api/v1/sessions/:id/full-trace', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const sessionId = parseInt(id, 10)
      if (isNaN(sessionId)) {
        return sendError(reply, 400, '无效的场次 ID')
      }

      const user = (request as any).user
      const allowCost = await canAccessCostAsync(user?.id, user?.role, user?.userType, undefined)
      const isCostMasked = !allowCost && user?.userType !== 'brand_viewer'

      const result = await withRlsContext(request, async (client) => {
        // 1. 场次基础信息与直播间、店铺、主播、运营
        const sessRes = await client.query(
          `SELECT ls.id, ls.room_id, ls.anchor_id, ls.operator_id, ls.date::text AS date,
                  ls.start_time, ls.end_time, ls.title, ls.status,
                  ls.gmv, ls.return_amount, ls.orders, ls.online_peak, ls.duration_min,
                  ls.avg_online, ls.views, ls.gpm, ls.ad_cost, ls.platform_code,
                  lr.name AS room_name, lr.shop_id,
                  ds.shop_name,
                  a.name AS anchor_name,
                  op.name AS operator_name
           FROM live_sessions ls
           LEFT JOIN live_rooms lr ON lr.id = ls.room_id
           LEFT JOIN dim_shop ds ON ds.id = lr.shop_id
           LEFT JOIN anchors a ON a.id = ls.anchor_id
           LEFT JOIN operators op ON op.id = ls.operator_id
           WHERE ls.id = $1`,
          [sessionId],
        )

        if (sessRes.rows.length === 0) {
          return null
        }

        const sess = sessRes.rows[0]
        const shopId = sess.shop_id ? Number(sess.shop_id) : null
        const sessionDate = sess.date
        const gmv = Number(sess.gmv) || 0
        const returnAmount = Number(sess.return_amount) || 0
        const netRevenue = Number((gmv - returnAmount).toFixed(2))

        // 2. 岗位分工人员名单 (session_staff_assignments)
        const staffRes = await client.query(
          `SELECT ssa.id, ssa.role_code, ssa.staff_id, ssa.staff_name, ssa.note, ssa.created_at
           FROM session_staff_assignments ssa
           WHERE ssa.session_id = $1
           ORDER BY ssa.id ASC`,
          [sessionId],
        )

        // 3. 排品计划与货盘清单 (session_plan_products & session_plans)
        const planMetaRes = await client.query(
          `SELECT sp.id, sp.room_id, sp.plan_date::text AS plan_date, sp.anchor_id, sp.notes, sp.created_at
           FROM session_plans sp
           WHERE (sp.room_id = $1 AND sp.plan_date = $2::date)
              OR sp.id IN (SELECT plan_id FROM session_plan_products WHERE session_id = $3 AND plan_id IS NOT NULL)
           ORDER BY sp.id DESC LIMIT 1`,
          [sess.room_id, sessionDate, sessionId],
        )
        const planMeta = planMetaRes.rows[0] || null

        const productsRes = await client.query(
          `SELECT spp.id, spp.plan_id, spp.group_letter, spp.product_code, spp.price,
                  spp.product_order, spp.product_name, spp.product_id, spp.product_image,
                  spp.payment_amount, spp.sold_count, spp.buyer_count, spp.order_count,
                  spp.pre_sale_orders, spp.pre_sale_amount, spp.exposure_users, spp.click_users,
                  spp.exposure_click_rate, spp.click_deal_rate, spp.refund_users, spp.refund_amount,
                  spp.sku_snapshot_jsonb, spp.created_at
           FROM session_plan_products spp
           WHERE spp.session_id = $1
              OR (spp.plan_id IS NOT NULL AND spp.plan_id = $2)
           ORDER BY spp.group_letter NULLS LAST, spp.product_order NULLS LAST, spp.id ASC`,
          [sessionId, planMeta?.id || -1],
        )

        // 4. 投流计划实体与实际对账 (ad_plan & ad_plan_receipts)
        const adPlansRes = shopId
          ? await client.query(
              `SELECT ap.id, ap.plan_no, ap.platform_code, ap.ad_tool_code, ap.plan_name, ap.plan_date::text AS plan_date,
                      ap.planned_budget, ap.target_roi, ap.pre_heat_ratio, ap.live_peak_ratio, ap.tail_push_ratio,
                      ap.targeting_tags, ap.bid_strategy, ap.status, ap.created_at,
                      coalesce(r.actual_spend, 0)::numeric AS actual_spend,
                      coalesce(r.net_gmv, 0)::numeric AS receipt_net_gmv,
                      coalesce(r.attributed_orders, 0)::int AS receipt_orders
               FROM ad_plan ap
               LEFT JOIN ad_plan_receipts r ON r.plan_id = ap.id AND r.biz_date = ap.plan_date
               WHERE ap.session_id = $1 OR (ap.shop_id = $2 AND ap.plan_date = $3::date)
               ORDER BY ap.id DESC`,
              [sessionId, shopId, sessionDate],
            )
          : { rows: [] }

        // 5. 财务真实 PnL（严格遵循断点原则：缺项标 null，禁填假 0）
        const voucherRes = await client.query(
          `SELECT id, voucher_no, voucher_type, total_debit, total_credit, is_balanced, status, summary, posted_at
           FROM public.fact_gl_voucher
           WHERE session_id = $1 OR (ref_type = 'live_session' AND ref_id = $1::text)
           ORDER BY id ASC`,
          [sessionId],
        )
        let adSpend: number | null = null
        let adSpendSource: string | null = null
        let platformFee: number | null = null
        let platformFeeSource: string | null = null
        let anchorCommission: number | null = null
        let pitFee: number | null = null
        let kolSource: string | null = null
        let missingCosts: string[] = []
        let isComplete = false
        let totalCosts: number | null = null
        let netProfit: number | null = null
        let netProfitMarginPct: number | null = null

        if (isCostMasked) {
          missingCosts = ['ad_spend', 'platform_fee', 'anchor_commission']
        } else {
          // 统计当天同直播间场次总数，以便分摊日级成本
          const cntRes = await client.query(
            `SELECT count(*)::int AS count FROM live_sessions WHERE room_id = $1 AND date = $2::date`,
            [sess.room_id, sessionDate],
          )
          const sessionCount = Math.max(cntRes.rows[0]?.count || 1, 1)

          if (shopId) {
            // 投流消耗
            const adRes = await client.query(
              `SELECT sum(ad_spend) AS ad_spend FROM fact_ad_spend_daily WHERE shop_id = $1 AND biz_date = $2::date`,
              [shopId, sessionDate],
            )
            if (adRes.rows[0]?.ad_spend !== null && adRes.rows[0]?.ad_spend !== undefined) {
              adSpend = Number((Number(adRes.rows[0].ad_spend) / sessionCount).toFixed(2))
              adSpendSource = 'fact_ad_spend_daily'
            }

            // 平台服务费
            const feeRes = await client.query(
              `SELECT sum(platform_fee) AS platform_fee FROM fact_settlement_cycles WHERE shop_id = $1 AND order_date = $2::date`,
              [shopId, sessionDate],
            )
            if (feeRes.rows[0]?.platform_fee !== null && feeRes.rows[0]?.platform_fee !== undefined) {
              platformFee = Number((Number(feeRes.rows[0].platform_fee) / sessionCount).toFixed(2))
              platformFeeSource = 'fact_settlement_cycles'
            }

            // 主播/KOL佣金与坑位费
            const kolRes = await client.query(
              `SELECT sum(commission_amount) AS commission_amount, sum(pit_fee) AS pit_fee
               FROM fact_kol_cooperation WHERE shop_id = $1 AND publish_date = $2::date`,
              [shopId, sessionDate],
            )
            if (kolRes.rows[0]?.commission_amount !== null && kolRes.rows[0]?.commission_amount !== undefined) {
              anchorCommission = Number((Number(kolRes.rows[0].commission_amount) / sessionCount).toFixed(2))
              pitFee = kolRes.rows[0].pit_fee !== null ? Number((Number(kolRes.rows[0].pit_fee) / sessionCount).toFixed(2)) : null
              kolSource = 'fact_kol_cooperation'
            }
          }

          if (adSpend === null && Number(sess.ad_cost) > 0) {
            adSpend = Number(sess.ad_cost)
            adSpendSource = 'live_sessions.ad_cost'
          }

          if (adSpend === null) missingCosts.push('ad_spend')
          if (platformFee === null) missingCosts.push('platform_fee')
          if (anchorCommission === null) missingCosts.push('anchor_commission')

          isComplete = missingCosts.length === 0
          totalCosts = isComplete
            ? Number(((adSpend ?? 0) + (platformFee ?? 0) + (anchorCommission ?? 0)).toFixed(2))
            : null
          netProfit = isComplete ? Number((netRevenue - totalCosts!).toFixed(2)) : null
          netProfitMarginPct = isComplete && gmv > 0 ? Number(((netProfit! / gmv) * 100).toFixed(2)) : null
        }

        // 6. 履约与售后 SLA 风险穿透 (fact_fulfillment_waybill & fact_after_sale_tickets)
        let fulfillmentStats = {
          totalWaybills: 0,
          signedCount: 0,
          delayedCount: 0,
          fakeShipRiskCount: 0,
          estimatedPenalties: 0,
        }
        let afterSaleStats = {
          totalTickets: 0,
          pendingAuditCount: 0,
          approvedCount: 0,
          intervenedCount: 0,
          totalRefundAmount: 0,
          avgExperienceScore: 5.0,
        }

        if (shopId) {
          const waybillRes = await client.query(
            `SELECT count(*)::int AS total_waybills,
                    count(*) FILTER (WHERE fulfillment_status = 'signed')::int AS signed_count,
                    count(*) FILTER (WHERE is_ship_delayed = true)::int AS delayed_count,
                    count(*) FILTER (WHERE is_fake_ship_risk = true)::int AS fake_ship_risk_count,
                    coalesce(sum(estimated_penalty_amount), 0)::numeric AS estimated_penalties
             FROM fact_fulfillment_waybill
             WHERE shop_id = $1 AND paid_at::date = $2::date`,
            [shopId, sessionDate],
          )
          if (waybillRes.rows[0]) {
            const w = waybillRes.rows[0]
            fulfillmentStats = {
              totalWaybills: w.total_waybills,
              signedCount: w.signed_count,
              delayedCount: w.delayed_count,
              fakeShipRiskCount: w.fake_ship_risk_count,
              estimatedPenalties: Number(w.estimated_penalties),
            }
          }

          const ticketRes = await client.query(
            `SELECT count(*)::int AS total_tickets,
                    count(*) FILTER (WHERE ticket_status = 'pending_audit')::int AS pending_audit_count,
                    count(*) FILTER (WHERE ticket_status = 'approved')::int AS approved_count,
                    count(*) FILTER (WHERE ticket_status = 'platform_intervened')::int AS intervened_count,
                    coalesce(sum(refund_amount), 0)::numeric AS total_refund_amount,
                    coalesce(avg(shop_experience_score), 5.0)::numeric(3,2) AS avg_experience_score
             FROM fact_after_sale_tickets
             WHERE shop_id = $1 AND applied_at::date = $2::date`,
            [shopId, sessionDate],
          )
          if (ticketRes.rows[0]) {
            const t = ticketRes.rows[0]
            afterSaleStats = {
              totalTickets: t.total_tickets,
              pendingAuditCount: t.pending_audit_count,
              approvedCount: t.approved_count,
              intervenedCount: t.intervened_count,
              totalRefundAmount: Number(t.total_refund_amount),
              avgExperienceScore: Number(t.avg_experience_score),
            }
          }
        }

        return {
          session: {
            id: Number(sess.id),
            title: sess.title,
            date: sess.date,
            startTime: sess.start_time,
            endTime: sess.end_time,
            status: sess.status,
            gmv,
            returnAmount,
            orders: sess.orders,
            onlinePeak: sess.online_peak,
            durationMin: sess.duration_min,
            avgOnline: sess.avg_online,
            views: sess.views,
            gpm: sess.gpm,
            platformCode: sess.platform_code,
            roomId: sess.room_id,
            roomName: sess.room_name,
            shopId,
            shopName: sess.shop_name,
          },
          staff: {
            anchor: sess.anchor_id ? { id: sess.anchor_id, name: sess.anchor_name } : null,
            operator: sess.operator_id ? { id: sess.operator_id, name: sess.operator_name } : null,
            assignments: staffRes.rows.map((s) => ({
              id: Number(s.id),
              roleCode: s.role_code,
              staffId: s.staff_id ? Number(s.staff_id) : null,
              staffName: s.staff_name,
              note: s.note,
              createdAt: s.created_at,
            })),
          },
          assortment: {
            planId: planMeta?.id || null,
            planNotes: planMeta?.notes || null,
            productsCount: productsRes.rows.length,
            products: productsRes.rows.map((p) => ({
              id: Number(p.id),
              planId: p.plan_id ? Number(p.plan_id) : null,
              groupLetter: p.group_letter,
              productCode: p.product_code,
              price: Number(p.price || 0),
              productOrder: p.product_order,
              productName: p.product_name,
              productId: p.product_id,
              productImage: p.product_image,
              paymentAmount: Number(p.payment_amount || 0),
              soldCount: Number(p.sold_count || 0),
              buyerCount: Number(p.buyer_count || 0),
              orderCount: Number(p.order_count || 0),
              skuSnapshot: p.sku_snapshot_jsonb,
            })),
          },
          adPlans: {
            plansCount: adPlansRes.rows.length,
            plans: adPlansRes.rows.map((p) => ({
              id: Number(p.id),
              planNo: p.plan_no,
              platformCode: p.platform_code,
              adToolCode: p.ad_tool_code,
              planName: p.plan_name,
              planDate: p.plan_date,
              plannedBudget: Number(p.planned_budget),
              targetRoi: Number(p.target_roi),
              actualSpend: Number(p.actual_spend),
              receiptNetGmv: Number(p.receipt_net_gmv),
              status: p.status,
            })),
          },
          pnl: {
            gmv,
            returnAmount,
            netRevenue,
            adSpend,
            platformFee,
            anchorCommission,
            pitFee,
            totalCosts,
            netProfit,
            netProfitMarginPct,
            isComplete,
            missingCosts,
            costMasked: isCostMasked,
            sources: {
              adSpend: adSpendSource,
              platformFee: platformFeeSource,
              anchorCommission: kolSource,
            },
          },
          fulfillment: fulfillmentStats,
          afterSales: afterSaleStats,
          accounting: {
            hasVoucherChain: voucherRes.rows.length > 0,
            voucherCount: voucherRes.rows.length,
            vouchers: voucherRes.rows.map((v) => ({
              id: Number(v.id),
              voucherNo: v.voucher_no,
              voucherType: v.voucher_type,
              totalDebit: Number(v.total_debit),
              totalCredit: Number(v.total_credit),
              isBalanced: Boolean(v.is_balanced),
              status: v.status,
              summary: v.summary,
              postedAt: v.posted_at,
            })),
          },
        }
      })

      if (!result) return reply.code(404).send({ success: false, message: '场次不存在' })
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'GET /sessions/:id/full-trace failed')
      return reply.code(500).send({ success: false, message: '查询场次全链路穿透数据失败' })
    }
  })
}
