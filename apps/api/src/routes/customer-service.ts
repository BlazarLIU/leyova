import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

export async function customerServiceRoutes(app: FastifyInstance) {
  const writeRoles = ['super_admin', 'admin', 'ops_director', 'operator', 'ops_staff']

  // ── GET /api/v1/cs/overview ── 全平台客服咨询响应与询单转化绩效总览
  app.get('/api/v1/cs/overview', async (request: FastifyRequest<{
    Querystring: { from?: string; to?: string; platformCode?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { from, to, platformCode } = request.query
      const conds: string[] = []
      const params: any[] = []
      let idx = 1
      if (from) { conds.push(`s.session_date >= $${idx++}::date`); params.push(from) }
      if (to) { conds.push(`s.session_date <= $${idx++}::date`); params.push(to) }
      if (platformCode) { conds.push(`s.platform_code = $${idx++}`); params.push(platformCode) }
      const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''

      const { rows, byPlatform } = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT
             (SELECT COUNT(*)::int FROM dim_cs_agent) AS total_agents,
             COALESCE(SUM(s.total_sessions), 0)::int AS total_sessions,
             COALESCE(SUM(s.responded_sessions), 0)::int AS responded_sessions,
             COALESCE(SUM(s.timeout_sessions), 0)::int AS timeout_sessions,
             COALESCE(ROUND(SUM(s.avg_first_response_sec * s.total_sessions) / NULLIF(SUM(s.total_sessions), 0), 1), 0)::numeric AS avg_first_response_sec,
             COALESCE(SUM(s.inquiry_buyers), 0)::int AS inquiry_buyers,
             COALESCE(SUM(s.converted_buyers), 0)::int AS converted_buyers,
             COALESCE(SUM(s.converted_gmv), 0)::numeric(14,2) AS converted_gmv,
             COALESCE(ROUND(AVG(s.satisfaction_rate), 2), 0)::numeric AS avg_satisfaction_rate
           FROM fact_cs_session s
           ${where}`,
          params,
        )
        const pRes = await client.query(
          `SELECT
             s.platform_code,
             p.platform_name,
             SUM(s.total_sessions)::int AS total_sessions,
             SUM(s.timeout_sessions)::int AS timeout_sessions,
             ROUND(SUM(s.avg_first_response_sec * s.total_sessions) / NULLIF(SUM(s.total_sessions), 0), 1)::numeric AS avg_first_response_sec,
             SUM(s.inquiry_buyers)::int AS inquiry_buyers,
             SUM(s.converted_buyers)::int AS converted_buyers,
             SUM(s.converted_gmv)::numeric(14,2) AS converted_gmv
           FROM fact_cs_session s
           JOIN system_platform_configs p ON p.platform_code = s.platform_code
           ${where}
           GROUP BY s.platform_code, p.platform_name, p.sort_order
           ORDER BY total_sessions DESC, p.sort_order`,
          params,
        )
        return { rows: res.rows, byPlatform: pRes.rows }
      })
      const r = rows[0] || {}
      const totalSess = Number(r.total_sessions || 0)
      const inqBuyers = Number(r.inquiry_buyers || 0)
      return sendOk(reply, {
        totalAgents: Number(r.total_agents || 0),
        totalSessions: totalSess,
        respondedSessions: Number(r.responded_sessions || 0),
        timeoutSessions: Number(r.timeout_sessions || 0),
        responseRate: totalSess > 0 ? Number(((Number(r.responded_sessions || 0) / totalSess) * 100).toFixed(1)) : 100,
        timeoutRate: totalSess > 0 ? Number(((Number(r.timeout_sessions || 0) / totalSess) * 100).toFixed(1)) : 0,
        avgFirstResponseSec: Number(r.avg_first_response_sec || 0),
        inquiryBuyers: inqBuyers,
        convertedBuyers: Number(r.converted_buyers || 0),
        inquiryConversionRate: inqBuyers > 0 ? Number(((Number(r.converted_buyers || 0) / inqBuyers) * 100).toFixed(1)) : 0,
        convertedGmv: Number(r.converted_gmv || 0),
        avgSatisfactionRate: Number(r.avg_satisfaction_rate || 0),
        byPlatform: byPlatform.map((x: any) => ({
          platformCode: x.platform_code,
          platformName: x.platform_name,
          totalSessions: Number(x.total_sessions),
          timeoutSessions: Number(x.timeout_sessions),
          avgFirstResponseSec: Number(x.avg_first_response_sec || 0),
          inquiryConversionRate: Number(x.inquiry_buyers) > 0
            ? Number(((Number(x.converted_buyers) / Number(x.inquiry_buyers)) * 100).toFixed(1))
            : 0,
          convertedGmv: Number(x.converted_gmv),
        })),
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch CS overview')
      return sendError(reply, 500, '获取客服绩效总览失败')
    }
  })

  // ── GET /api/v1/cs/agents ── 客服坐席档案与累计绩效
  app.get('/api/v1/cs/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(`
          SELECT
            a.*,
            p.platform_name,
            sh.shop_name,
            COALESCE(SUM(s.total_sessions), 0)::int AS total_sessions,
            COALESCE(SUM(s.timeout_sessions), 0)::int AS timeout_sessions,
            COALESCE(ROUND(SUM(s.avg_first_response_sec * s.total_sessions) / NULLIF(SUM(s.total_sessions), 0), 1), 0)::numeric AS avg_first_response_sec,
            COALESCE(SUM(s.converted_gmv), 0)::numeric(14,2) AS converted_gmv
          FROM dim_cs_agent a
          JOIN system_platform_configs p ON p.platform_code = a.platform_code
          JOIN dim_shop sh ON sh.id = a.shop_id
          LEFT JOIN fact_cs_session s ON s.agent_id = a.id
          GROUP BY a.id, p.platform_name, sh.shop_name
          ORDER BY converted_gmv DESC, a.id ASC
        `),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch CS agents')
      return sendError(reply, 500, '查询客服坐席失败')
    }
  })

  // ── POST /api/v1/cs/agents ── 新增客服坐席档案
  app.post('/api/v1/cs/agents', { preHandler: [requireRole([...writeRoles, 'hrbp'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      agentCode?: string
      agentName?: string
      platformCode?: string
      shopId?: number
      shiftGroup?: 'day' | 'night' | 'all'
    }
    if (!body?.agentCode?.trim() || !body?.agentName?.trim() || !body?.platformCode || !body?.shopId) {
      return sendError(reply, 400, '坐席工号、姓名、平台和店铺均为必填项')
    }
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO dim_cs_agent (agent_code, agent_name, platform_code, shop_id, shift_group)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [body.agentCode!.trim(), body.agentName!.trim(), body.platformCode!.trim(), Number(body.shopId), body.shiftGroup || 'day'],
        ),
      )
      return sendOk(reply, rows[0])
    } catch (err: any) {
      if (err?.code === '23505') return sendError(reply, 409, '坐席工号已存在')
      request.log.error({ err }, 'Failed to create CS agent')
      return sendError(reply, 500, '创建客服坐席失败')
    }
  })

  // ── GET /api/v1/cs/sessions ── 客服每日班次会话绩效明细
  app.get('/api/v1/cs/sessions', async (request: FastifyRequest<{
    Querystring: { platformCode?: string; shiftType?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { platformCode, shiftType } = request.query
      const conds: string[] = []
      const params: any[] = []
      let idx = 1
      if (platformCode) { conds.push(`s.platform_code = $${idx++}`); params.push(platformCode) }
      if (shiftType) { conds.push(`s.shift_type = $${idx++}`); params.push(shiftType) }
      const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT
             s.*,
             a.agent_code,
             a.agent_name,
             p.platform_name,
             sh.shop_name
           FROM fact_cs_session s
           JOIN dim_cs_agent a ON a.id = s.agent_id
           JOIN system_platform_configs p ON p.platform_code = s.platform_code
           JOIN dim_shop sh ON sh.id = s.shop_id
           ${where}
           ORDER BY s.session_date DESC, s.id DESC`,
          params,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch CS sessions')
      return sendError(reply, 500, '查询客服班次绩效失败')
    }
  })

  // ── POST /api/v1/cs/sessions ── 录入或更新坐席日班次绩效（含9-23点咚咚响应与询单转化）
  app.post('/api/v1/cs/sessions', { preHandler: [requireRole(writeRoles)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      sessionDate?: string
      agentId?: number
      shiftType?: 'day' | 'night'
      totalSessions?: number
      respondedSessions?: number
      timeoutSessions?: number
      avgFirstResponseSec?: number
      inquiryBuyers?: number
      convertedBuyers?: number
      convertedGmv?: number
      satisfactionRate?: number
      notes?: string
    }
    if (!body?.agentId) {
      return sendError(reply, 400, '必须指定客服坐席ID')
    }
    try {
      const result = await withRlsContext(request, async (client) => {
        const agentRes = await client.query(`SELECT platform_code, shop_id FROM dim_cs_agent WHERE id = $1`, [Number(body.agentId)])
        if (agentRes.rows.length === 0) return { notFound: true as const }
        const agent = agentRes.rows[0]

        const { rows } = await client.query(
          `INSERT INTO fact_cs_session
             (session_date, agent_id, platform_code, shop_id, shift_type, total_sessions, responded_sessions,
              timeout_sessions, avg_first_response_sec, inquiry_buyers, converted_buyers, converted_gmv, satisfaction_rate, notes)
           VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (session_date, agent_id, shift_type) DO UPDATE
           SET total_sessions = EXCLUDED.total_sessions,
               responded_sessions = EXCLUDED.responded_sessions,
               timeout_sessions = EXCLUDED.timeout_sessions,
               avg_first_response_sec = EXCLUDED.avg_first_response_sec,
               inquiry_buyers = EXCLUDED.inquiry_buyers,
               converted_buyers = EXCLUDED.converted_buyers,
               converted_gmv = EXCLUDED.converted_gmv,
               satisfaction_rate = EXCLUDED.satisfaction_rate,
               notes = EXCLUDED.notes,
               updated_at = NOW()
           RETURNING *`,
          [
            body.sessionDate || new Date().toISOString().slice(0, 10),
            Number(body.agentId),
            agent.platform_code,
            agent.shop_id,
            body.shiftType || 'day',
            Math.max(0, Math.trunc(Number(body.totalSessions || 0))),
            Math.max(0, Math.trunc(Number(body.respondedSessions || 0))),
            Math.max(0, Math.trunc(Number(body.timeoutSessions || 0))),
            Math.max(0, Number(body.avgFirstResponseSec || 0)),
            Math.max(0, Math.trunc(Number(body.inquiryBuyers || 0))),
            Math.max(0, Math.trunc(Number(body.convertedBuyers || 0))),
            Math.max(0, Number(body.convertedGmv || 0)),
            Math.min(100, Math.max(0, Number(body.satisfactionRate ?? 95))),
            body.notes?.trim() || '',
          ],
        )
        return { row: rows[0] }
      })
      if ('notFound' in result && result.notFound) return sendError(reply, 404, '客服坐席不存在')
      return sendOk(reply, result.row)
    } catch (err) {
      request.log.error({ err }, 'Failed to upsert CS session')
      return sendError(reply, 500, '保存客服会话绩效失败')
    }
  })
}

