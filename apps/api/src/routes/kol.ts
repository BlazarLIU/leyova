import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getPool } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

export async function kolRoutes(app: FastifyInstance) {
  const pool = getPool()
  const opsRoles = ['super_admin', 'admin', 'ops_director', 'operator', 'ops_staff']

  // ── GET /api/v1/kol/overview ── 外部达人合作效果与佣金台账总览
  app.get('/api/v1/kol/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM dim_kol WHERE status = 'active') AS active_kols,
          COUNT(c.id)::int AS total_coops,
          COALESCE(SUM(c.pit_fee), 0)::numeric(14,2) AS total_pit_fee,
          COALESCE(SUM(c.gmv), 0)::numeric(14,2) AS total_gmv,
          COALESCE(SUM(c.net_gmv), 0)::numeric(14,2) AS total_net_gmv,
          COALESCE(SUM(c.commission_amount), 0)::numeric(14,2) AS total_commission,
          COALESCE(SUM(c.commission_amount) FILTER (WHERE c.settlement_status IN ('pending', 'confirmed')), 0)::numeric(14,2) AS unpaid_commission
        FROM fact_kol_cooperation c
      `)
      const { rows: byPlatform } = await pool.query(`
        SELECT
          c.platform_code,
          p.platform_name,
          COUNT(c.id)::int AS coop_count,
          COALESCE(SUM(c.net_gmv), 0)::numeric(14,2) AS net_gmv,
          COALESCE(SUM(c.pit_fee + c.commission_amount), 0)::numeric(14,2) AS total_cost
        FROM fact_kol_cooperation c
        JOIN system_platform_configs p ON p.platform_code = c.platform_code
        GROUP BY c.platform_code, p.platform_name
        ORDER BY net_gmv DESC
      `)
      const s = rows[0] || {}
      const totalCost = Number(s.total_pit_fee || 0) + Number(s.total_commission || 0)
      const totalNetGmv = Number(s.total_net_gmv || 0)
      return sendOk(reply, {
        activeKols: Number(s.active_kols || 0),
        totalCoops: Number(s.total_coops || 0),
        totalPitFee: Number(s.total_pit_fee || 0),
        totalGmv: Number(s.total_gmv || 0),
        totalNetGmv,
        totalCommission: Number(s.total_commission || 0),
        unpaidCommission: Number(s.unpaid_commission || 0),
        overallRoi: totalCost > 0 ? Number((totalNetGmv / totalCost).toFixed(2)) : null,
        byPlatform: byPlatform.map((r: any) => ({
          platformCode: r.platform_code,
          platformName: r.platform_name,
          coopCount: Number(r.coop_count),
          netGmv: Number(r.net_gmv),
          totalCost: Number(r.total_cost),
          roi: Number(r.total_cost) > 0 ? Number((Number(r.net_gmv) / Number(r.total_cost)).toFixed(2)) : null,
        })),
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch KOL overview')
      return sendError(reply, 500, '获取达人合作总览失败')
    }
  })

  // ── GET /api/v1/kol/profiles ── 外部达人档案列表（独立于内部主播 anchors）
  app.get('/api/v1/kol/profiles', async (request: FastifyRequest<{
    Querystring: { platformCode?: string; tier?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { platformCode, tier } = request.query
      const conds: string[] = []
      const params: any[] = []
      let idx = 1
      if (platformCode) { conds.push(`k.platform_code = $${idx++}`); params.push(platformCode) }
      if (tier) { conds.push(`k.tier = $${idx++}`); params.push(tier) }
      const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''

      const { rows } = await pool.query(
        `SELECT
           k.*,
           p.platform_name,
           COUNT(c.id)::int AS coop_count,
           COALESCE(SUM(c.net_gmv), 0)::numeric(14,2) AS cumulative_net_gmv,
           COALESCE(SUM(c.pit_fee + c.commission_amount), 0)::numeric(14,2) AS cumulative_cost
         FROM dim_kol k
         JOIN system_platform_configs p ON p.platform_code = k.platform_code
         LEFT JOIN fact_kol_cooperation c ON c.kol_id = k.id
         ${where}
         GROUP BY k.id, p.platform_name
         ORDER BY cumulative_net_gmv DESC, k.fans_count DESC`,
        params,
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch KOL profiles')
      return sendError(reply, 500, '获取达人档案失败')
    }
  })

  // ── POST /api/v1/kol/profiles ── 新建外部达人档案
  app.post('/api/v1/kol/profiles', { preHandler: [requireRole(opsRoles)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      kolName?: string
      platformCode?: string
      platformUid?: string
      tier?: 'head' | 'waist' | 'tail' | 'koc'
      fansCount?: number
      category?: string
      contactInfo?: string
      defaultCommissionRate?: number
      notes?: string
    }
    if (!body?.kolName?.trim() || !body?.platformCode?.trim()) {
      return sendError(reply, 400, '达人名称和平台编码不能为空')
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO dim_kol
           (kol_name, platform_code, platform_uid, tier, fans_count, category, contact_info, default_commission_rate, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          body.kolName.trim(),
          body.platformCode.trim(),
          body.platformUid?.trim() || '',
          body.tier || 'waist',
          Math.max(0, Math.trunc(Number(body.fansCount || 0))),
          body.category?.trim() || '时尚穿搭',
          body.contactInfo?.trim() || '',
          Number(body.defaultCommissionRate ?? 0.15),
          body.notes?.trim() || '',
        ],
      )
      return sendOk(reply, rows[0])
    } catch (err: any) {
      if (err?.code === '23505') return sendError(reply, 409, '该平台下达人名称已存在')
      request.log.error({ err }, 'Failed to create KOL profile')
      return sendError(reply, 500, '创建达人档案失败')
    }
  })

  // ── GET /api/v1/kol/cooperations ── 达人合作记录与佣金结算明细
  app.get('/api/v1/kol/cooperations', async (request: FastifyRequest<{
    Querystring: { platformCode?: string; settlementStatus?: string; kolId?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { platformCode, settlementStatus, kolId } = request.query
      const conds: string[] = []
      const params: any[] = []
      let idx = 1
      if (platformCode) { conds.push(`c.platform_code = $${idx++}`); params.push(platformCode) }
      if (settlementStatus) { conds.push(`c.settlement_status = $${idx++}`); params.push(settlementStatus) }
      if (kolId) { conds.push(`c.kol_id = $${idx++}`); params.push(Number(kolId)) }
      const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''

      const { rows } = await pool.query(
        `SELECT
           c.*,
           k.kol_name,
           k.tier AS kol_tier,
           p.platform_name,
           sh.shop_name,
           pr.sku_code,
           pr.product_name,
           CASE WHEN (c.pit_fee + c.commission_amount) > 0
                THEN ROUND(c.net_gmv / (c.pit_fee + c.commission_amount), 2)
                ELSE NULL END AS roi
         FROM fact_kol_cooperation c
         JOIN dim_kol k ON k.id = c.kol_id
         JOIN system_platform_configs p ON p.platform_code = c.platform_code
         JOIN dim_shop sh ON sh.id = c.shop_id
         LEFT JOIN dim_product pr ON pr.id = c.product_id
         ${where}
         ORDER BY c.publish_date DESC, c.id DESC`,
        params,
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to query KOL cooperations')
      return sendError(reply, 500, '查询达人合作台账失败')
    }
  })

  // ── POST /api/v1/kol/cooperations ── 登记达人带货/种草排期并计算净佣金
  app.post('/api/v1/kol/cooperations', { preHandler: [requireRole([...opsRoles, 'finance'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      kolId?: number
      platformCode?: string
      shopId?: number
      productId?: number
      coopType?: 'live_slot' | 'short_video' | 'xhs_note' | 'cps_only'
      campaignName?: string
      publishDate?: string
      pitFee?: number
      commissionRate?: number
      gmv?: number
      refundAmount?: number
      remark?: string
    }
    if (!body?.kolId || !body?.platformCode || !body?.shopId || !body?.campaignName?.trim()) {
      return sendError(reply, 400, '达人、平台、店铺与活动名称不能为空')
    }
    try {
      const gmv = Math.max(0, Number(body.gmv || 0))
      const refundAmount = Math.max(0, Number(body.refundAmount || 0))
      const commissionRate = Math.max(0, Number(body.commissionRate ?? 0.15))
      const netGmv = Math.max(0, gmv - refundAmount)
      const commissionAmount = Number((netGmv * commissionRate).toFixed(2))

      const { rows } = await pool.query(
        `INSERT INTO fact_kol_cooperation
           (kol_id, platform_code, shop_id, product_id, coop_type, campaign_name, publish_date,
            pit_fee, commission_rate, gmv, refund_amount, commission_amount, settlement_status, remark)
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, 'pending', $13)
         RETURNING *`,
        [
          Number(body.kolId),
          body.platformCode.trim(),
          Number(body.shopId),
          body.productId ? Number(body.productId) : null,
          body.coopType || 'live_slot',
          body.campaignName.trim(),
          body.publishDate || new Date().toISOString().slice(0, 10),
          Math.max(0, Number(body.pitFee || 0)),
          commissionRate,
          gmv,
          refundAmount,
          commissionAmount,
          body.remark?.trim() || '',
        ],
      )
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.error({ err }, 'Failed to create KOL cooperation')
      return sendError(reply, 500, '登记达人合作失败')
    }
  })

  // ── PATCH /api/v1/kol/cooperations/:id/settle ── 确认/打款结算达人佣金
  app.patch<{ Params: { id: string } }>(
    '/api/v1/kol/cooperations/:id/settle',
    { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] },
    async (request, reply) => {
      const body = request.body as {
        settlementStatus?: 'confirmed' | 'paid' | 'disputed'
        commissionAmount?: number
        remark?: string
      }
      if (!body?.settlementStatus) {
        return sendError(reply, 400, '必须提供结算状态')
      }
      try {
        const { rows } = await pool.query(
          `UPDATE fact_kol_cooperation
         SET settlement_status = $1,
             commission_amount = COALESCE($2, commission_amount),
             settled_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE settled_at END,
             remark = COALESCE($3, remark),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
          [
            body.settlementStatus,
            body.commissionAmount !== undefined ? Number(body.commissionAmount) : null,
            body.remark?.trim() ?? null,
            Number(request.params.id),
          ],
        )
        if (rows.length === 0) return sendError(reply, 404, '达人合作记录不存在')
        return sendOk(reply, rows[0])
      } catch (err) {
        request.log.error({ err }, 'Failed to settle KOL commission')
        return sendError(reply, 500, '结算达人佣金失败')
      }
    })
}
