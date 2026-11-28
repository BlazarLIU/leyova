import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canAccessAdSpend, requireAuth } from '../lib/guard.js'
import { computeRefundRatePct } from '../services/metrics-caliber.js'

export async function overviewRoutes(app: FastifyInstance) {
  // ── GET /api/v1/overview/live-monitor ──
  app.get('/api/v1/overview/live-monitor', async (request, reply) => {
    try {
      const { rooms, summary } = await withRlsContext(request, async (client) => {
        const roomsRes = await client.query<{
          room_id: number; room_name: string; anchor_name: string
          online: number; gmv: string; status: string; duration_min: number
        }>(
          `SELECT r.id AS room_id, r.name AS room_name,
                  COALESCE(a.name, '') AS anchor_name,
                  COALESCE(s.online_peak, 0) AS online,
                  COALESCE(s.gmv, 0) AS gmv,
                  s.status, s.duration_min
           FROM live_rooms r
           LEFT JOIN live_sessions s ON s.room_id = r.id
             AND s.date = (SELECT MAX(date) FROM live_sessions WHERE status = 'live')
             AND s.status = 'live'
           LEFT JOIN anchors a ON a.id = s.anchor_id
           WHERE r.status = 'active'
           ORDER BY r.id`,
        )
        const sumRes = await client.query<{
          total_online: number; cumulative_views: number; real_time_gmv: string
          total_orders: number; views_actual_rows: number
        }>(
          // P1-B9：累计观看不能凭空乘系数
          //
          // 审计断点：原实现 `SUM(online_peak) * 15` —— 峰值在线乘 15 当作累计观看，
          //   这个 15 没有任何业务依据，是纯粹的伪数据。
          // 修复：从 session_overview_metrics 取真实 enter_users（进场人数），
          //   无该数据时回退为 0 并标记 viewsEstimated=true，让前端能提示「数据未接入」。
          `SELECT COALESCE(SUM(ls.online_peak), 0)::int AS total_online,
                  COALESCE(SUM(om.enter_users), 0)::int AS cumulative_views,
                  COALESCE(SUM(ls.gmv), 0) AS real_time_gmv,
                  COALESCE(SUM(ls.orders), 0)::int AS total_orders,
                  COUNT(om.enter_users)::int AS views_actual_rows
           FROM live_sessions ls
           LEFT JOIN session_overview_metrics om
                  ON om.session_id = ls.id
           WHERE ls.date = (SELECT MAX(date) FROM live_sessions WHERE status = 'live')
             AND ls.status = 'live'`,
        )
        return { rooms: roomsRes, summary: sumRes }
      })
      return sendOk(reply, {
        summary: {
          total_online: summary.rows[0]?.total_online ?? 0,
          cumulative_views: summary.rows[0]?.cumulative_views ?? 0,
          // 若没有任何真实进场数据，前端应显示「—」而不是 0（避免误读为真没人看）
          views_estimated: (summary.rows[0]?.views_actual_rows ?? 0) === 0,
          real_time_gmv: parseFloat(summary.rows[0]?.real_time_gmv ?? '0'),
          orders: summary.rows[0]?.total_orders ?? 0,
        },
        rooms: rooms.rows.map((r) => ({
          room_id: r.room_id, room_name: r.room_name, anchor: r.anchor_name,
          online: r.online, gmv: parseFloat(r.gmv), status: r.status, duration: r.duration_min,
        })),
      })
    } catch (err) {
      app.log.warn({ err }, 'overview/live-monitor query failed')
      return sendOk(reply, { summary: { total_online: 0, cumulative_views: 0, real_time_gmv: 0 }, rooms: [] })
    }
  })

  // ── GET /api/v1/overview/stats ──
  app.get('/api/v1/overview/stats', async (request, reply) => {
    try {
      const outcome = await withRlsContext(request, async (client) => {
        await client.query('SAVEPOINT sp_overview_stats_daily')
        try {
          const result = await client.query<{
            today_gmv: string; today_orders: number; active_rooms: number
            online_viewers: number; growth_rate: string | null
          }>(
            `SELECT today_gmv, today_orders, active_rooms, online_viewers, growth_rate
             FROM overview_daily_stats
             WHERE date = (SELECT MAX(date) FROM overview_daily_stats) LIMIT 1`,
          )
          await client.query('RELEASE SAVEPOINT sp_overview_stats_daily')
          if (result.rows.length > 0) {
            const row = result.rows[0]
            return {
              today_gmv: parseFloat(row.today_gmv),
              today_orders: row.today_orders,
              active_livestreams: row.active_rooms,
              online_viewers: row.online_viewers,
              growth_rate: row.growth_rate ? parseFloat(row.growth_rate) : 0,
            }
          }
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT sp_overview_stats_daily')
          app.log.warn({ err }, 'overview/stats db query failed')
        }

        const today = await client.query<{
          today_gmv: string; today_orders: number; active_rooms: number; online_peak: number
        }>(
          `SELECT COALESCE(SUM(gmv), 0) AS today_gmv,
                  COALESCE(SUM(orders), 0) AS today_orders,
                  COUNT(*) FILTER (WHERE status = 'live')::int AS active_rooms,
                  COALESCE(MAX(online_peak), 0) AS online_peak
           FROM live_sessions
           WHERE date = (SELECT MAX(date) FROM live_sessions WHERE status IN ('live', 'completed'))
             AND status IN ('live', 'completed')`,
        )
        const r = today.rows[0]
        const yesterday = await client.query<{ prev_gmv: string }>(
          `SELECT COALESCE(SUM(gmv), 0) AS prev_gmv
           FROM live_sessions
           WHERE date = (SELECT MAX(date) FROM live_sessions WHERE status IN ('live', 'completed')) - 1
             AND status IN ('live', 'completed')`,
        )
        const prevGmv = parseFloat(yesterday.rows[0]?.prev_gmv ?? '0')
        const curGmv = parseFloat(r.today_gmv)
        const growth = prevGmv > 0 ? ((curGmv - prevGmv) / prevGmv) * 100 : 0
        return {
          today_gmv: curGmv, today_orders: r.today_orders,
          active_livestreams: r.active_rooms, online_viewers: r.online_peak,
          growth_rate: Math.round(growth * 10) / 10,
        }
      })
      return sendOk(reply, outcome)
    } catch (err2) {
      app.log.warn({ err: err2 }, 'overview/stats fallback failed')
      return sendOk(reply, { today_gmv: 0, today_orders: 0, active_livestreams: 0, online_viewers: 0, growth_rate: 0 })
    }
  })

  // ── GET /api/v1/overview/analytics ──
  app.get('/api/v1/overview/analytics', async (request, reply) => {
    try {
      const result = await withRlsContext(request, async (client) => {
        let res = await client.query(
          `SELECT date::text, today_gmv, today_orders, active_rooms, online_viewers, growth_rate
           FROM overview_daily_stats
           WHERE date >= (SELECT MAX(date) FROM overview_daily_stats) - INTERVAL '30 days'
           ORDER BY date DESC`,
        )
        if (res.rows.length === 0) {
          res = await client.query(
            `SELECT date::text, today_gmv, today_orders, active_rooms, online_viewers, growth_rate
             FROM overview_daily_stats
             ORDER BY date DESC`,
          )
        }
        return res
      })
      const rows = result.rows.map((r: any) => ({
        date: r.date,
        gmv: parseFloat(r.today_gmv),
        orders: r.today_orders,
        active_rooms: r.active_rooms,
        online_viewers: r.online_viewers,
        growth_rate: r.growth_rate ? parseFloat(r.growth_rate) : 0,
      }))
      return sendOk(reply, rows)
    } catch (err) {
      app.log.warn({ err }, 'overview/analytics query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/overview/activities ──
  app.get('/api/v1/overview/activities', async (request, reply) => {
    try {
      const result = await withRlsContext(request, (client) =>
        client.query<{ id: number; title: string; time_desc: string; activity_type: string }>(
          `SELECT id, title, time_desc, activity_type
           FROM overview_activities ORDER BY created_at DESC LIMIT 20`,
        ),
      )
      return sendOk(reply, result.rows.map((r) => ({
        id: r.id, title: r.title, time: r.time_desc, type: r.activity_type,
      })))
    } catch (err) {
      app.log.warn({ err }, 'overview/activities query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/overview/cockpit ──
  app.get('/api/v1/overview/cockpit', async (request, reply) => {
    try {
      const cockpit = await withRlsContext(request, async (client) => {
        const summary = await client.query(
          `SELECT
             COALESCE(SUM(gmv), 0) AS total_gmv,
             COALESCE(SUM(gsv), 0) AS total_gsv,
             COALESCE(SUM(orders), 0)::int AS total_orders,
             COALESCE(SUM(return_amount), 0) AS total_return,
             COALESCE(SUM(ad_cost), 0) AS total_ad_cost,
             COALESCE(SUM(gmv), 0) - COALESCE(SUM(return_amount), 0) AS net_gmv
           FROM live_sessions
           WHERE date >= (SELECT MAX(date) FROM live_sessions WHERE status = 'completed') - INTERVAL '30 days'
             AND status = 'completed'`,
        )
        const s = summary.rows[0] || {}
        let totalGmv = parseFloat(s.total_gmv || '0')
        let totalReturn = parseFloat(s.total_return || '0')
        let totalAdCost = parseFloat(s.total_ad_cost || '0')

        const fromLiveSessions = totalGmv > 0
        if (!fromLiveSessions) {
          const impSummary = await client.query(
            `SELECT
               COALESCE(SUM(lb.payment_amount), 0) AS total_gmv,
               0 AS total_gsv,
               COALESCE(SUM(om.deal_users), 0)::int AS total_orders,
               COALESCE(SUM(om.refund_amount), 0) AS total_return,
               0 AS total_ad_cost
             FROM session_live_basic_info lb
             LEFT JOIN session_overview_metrics om
               ON om.room_id = lb.room_id AND om.business_date = lb.business_date`,
          )
          const row = impSummary.rows[0] || {}
          totalGmv = parseFloat(row.total_gmv || '0')
          totalReturn = parseFloat(row.total_return || '0')
          totalAdCost = parseFloat(row.total_ad_cost || '0')
        }
        const refundRate = computeRefundRatePct(totalReturn, totalGmv, 1)
        const roi = totalAdCost > 0 ? +(totalGmv / totalAdCost).toFixed(2) : 0

        const trend = fromLiveSessions
          ? await client.query(
              `SELECT date::text, COALESCE(SUM(gmv), 0) AS gmv
               FROM live_sessions
               WHERE date BETWEEN
                 (SELECT MAX(date) FROM live_sessions WHERE status = 'completed') - INTERVAL '6 days'
                 AND (SELECT MAX(date) FROM live_sessions WHERE status = 'completed')
                 AND status = 'completed'
               GROUP BY date ORDER BY date`,
            )
          : await client.query(
              `SELECT lb.business_date::text AS date, COALESCE(SUM(lb.payment_amount), 0) AS gmv
               FROM session_live_basic_info lb
               GROUP BY lb.business_date
               ORDER BY lb.business_date`,
            )
        const gmvTrend = trend.rows.map((r: any) => ({
          date: typeof r.date === 'string' ? r.date.slice(5) : r.date.toISOString().slice(5, 10),
          gmv: parseFloat(r.gmv),
        }))

        const traffic = await client.query(
          `SELECT sc.channel,
                  COALESCE(SUM(sc.views), 0) AS views,
                  COALESCE(SUM(sc.gmv), 0) AS channel_gmv
           FROM session_channel_metrics sc
           LEFT JOIN live_sessions s ON s.id = sc.session_id
           WHERE (s.date >= (SELECT MAX(date) FROM live_sessions WHERE status = 'completed') - INTERVAL '30 days' OR sc.session_id IS NULL)
             AND (s.status = 'completed' OR sc.session_id IS NULL)
           GROUP BY sc.channel ORDER BY channel_gmv DESC`,
        )
        const totalViews = traffic.rows.reduce((sum: number, r: any) => sum + parseInt(r.views), 0)
        const trafficSources = traffic.rows.map((r: any) => ({
          source: r.channel,
          value: totalViews > 0 ? +((parseInt(r.views) / totalViews) * 100).toFixed(1) : 0,
        }))

        return {
          summary: { total_gmv: totalGmv, refund_rate: refundRate, roi },
          gmv_trend: gmvTrend,
          traffic_sources: trafficSources,
          top_products: [],
        }
      })
      return sendOk(reply, cockpit)
    } catch (err) {
      app.log.warn({ err }, 'overview/cockpit query failed')
      return sendOk(reply, {
        summary: { total_gmv: 0, refund_rate: 0, roi: 0 },
        gmv_trend: [], traffic_sources: [], top_products: [],
      })
    }
  })

  // ── GET /api/v1/overview/patrol-summary ── 获取指定日期的巡检摘要
  app.get('/api/v1/overview/patrol-summary', async (request, reply) => {
    const query = request.query as { date?: string }
    const date = query.date || new Date().toISOString().slice(0, 10)
    try {
      const result = await withRlsContext(request, (client) =>
        client.query(
          `SELECT m.content, c.created_at
           FROM ai_conversations c
           JOIN ai_messages m ON m.conversation_id = c.id
           WHERE c.title = $1 AND m.role = 'assistant'
           ORDER BY m.created_at DESC LIMIT 1`,
          [`patrol-${date}`],
        ),
      )
      return sendOk(reply, {
        content: result.rows[0]?.content || null,
        generatedAt: result.rows[0]?.created_at || null,
        date,
      })
    } catch (err) {
      request.log.warn({ err }, 'overview/patrol-summary query failed')
      return sendOk(reply, { content: null, generatedAt: null, date })
    }
  })

  // ── GET /api/v1/overview/daily-report ── 获取指定日期的经营日报
  app.get('/api/v1/overview/daily-report', async (request, reply) => {
    const query = request.query as { date?: string }
    const date = query.date || new Date().toISOString().slice(0, 10)
    try {
      const result = await withRlsContext(request, (client) =>
        client.query(
          `SELECT m.content, c.created_at
           FROM ai_conversations c
           JOIN ai_messages m ON m.conversation_id = c.id
           WHERE c.title = $1 AND m.role = 'assistant'
           ORDER BY m.created_at DESC LIMIT 1`,
          [`daily-${date}`],
        ),
      )
      return sendOk(reply, {
        content: result.rows[0]?.content || null,
        generatedAt: result.rows[0]?.created_at || null,
        date,
      })
    } catch (err) {
      request.log.warn({ err }, 'overview/daily-report query failed')
      return sendOk(reply, { content: null, generatedAt: null, date })
    }
  })

  async function getReportRecords(
    request: any,
    prefix: string,
  ): Promise<Array<{ title: string; date: string; content: string | null; createdAt: string }>> {
    const { rows } = await withRlsContext(request, (client) =>
      client.query(
        `SELECT c.id, c.title, c.created_at, lm.content
         FROM ai_conversations c
         JOIN LATERAL (
           SELECT content FROM ai_messages
           WHERE conversation_id = c.id AND role = 'assistant'
           ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         WHERE c.title LIKE $1
         ORDER BY c.created_at DESC`,
        [`${prefix}%`],
      ),
    )
    return rows.map((r: any) => ({
      title: String(r.title),
      date: String(r.title).slice(prefix.length),
      content: r.content ?? null,
      createdAt: r.created_at,
    }))
  }

  // ── GET /api/v1/overview/daily-reports ── 全部经营日报（最新在上）
  app.get('/api/v1/overview/daily-reports', async (request, reply) => {
    try {
      return sendOk(reply, await getReportRecords(request, 'daily-'))
    } catch (err) {
      request.log.warn({ err }, 'overview/daily-reports query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/overview/patrol-records ── 全部巡检记录（最新在上）
  app.get('/api/v1/overview/patrol-records', async (request, reply) => {
    try {
      return sendOk(reply, await getReportRecords(request, 'patrol-'))
    } catch (err) {
      request.log.warn({ err }, 'overview/patrol-records query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/overview/sessions ── 场次列表（SessionsPage 对接）
  app.get('/api/v1/overview/sessions', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const allowAd = canAccessAdSpend(user)
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT ls.id,
                  ls.date::text AS date,
                  COALESCE(r.name, ls.title, '直播间') AS room,
                  COALESCE(a.name, '未知') AS anchor,
                  COALESCE(TO_CHAR(ls.start_time, 'HH24:MI'), '00:00') AS start_time,
                  COALESCE(TO_CHAR(ls.end_time, 'HH24:MI'), '00:00') AS end_time,
                  ls.gmv,
                  ls.ad_cost,
                  ls.status
             FROM live_sessions ls
             LEFT JOIN live_rooms r ON r.id = ls.room_id
             LEFT JOIN anchors a ON a.id = ls.anchor_id
            WHERE ls.status <> 'cancelled'
            ORDER BY ls.date DESC, ls.id DESC
            LIMIT 200`,
        ),
      )

      // P0-2：排班与场次联动
      // 场次列表原本只返回主播，导致「排班表里排了人，场次详情看不到当班岗位」。
      // 这里把 session_staff_assignments（378 行）的岗位分工带出来，
      // 让前端能直接展示「这场谁值班」，也为复盘按岗位归因人效提供输入。
      const sessionIds = rows.map((r: any) => Number(r.id))
      const staffMap = new Map<number, Array<{ roleCode: string; roleName: string; staffName: string }>>()
      if (sessionIds.length > 0) {
        const { rows: staffRows } = await withRlsContext(request, (client) =>
          client.query(
            `SELECT ssa.session_id, ssa.role_code,
                    COALESCE(srd.name, ssa.role_code) AS role_name,
                    ssa.staff_name
               FROM session_staff_assignments ssa
               LEFT JOIN staff_role_dict srd ON srd.code = ssa.role_code
              WHERE ssa.session_id = ANY($1::int[])
              ORDER BY ssa.session_id, ssa.id`,
            [sessionIds],
          ),
        )
        for (const s of staffRows) {
          const sid = Number(s.session_id)
          if (!staffMap.has(sid)) staffMap.set(sid, [])
          staffMap.get(sid)!.push({
            roleCode: String(s.role_code),
            roleName: String(s.role_name),
            staffName: String(s.staff_name),
          })
        }
      }

      return sendOk(reply, {
        sessions: rows.map((r: any) => {
          const gmv = Number(r.gmv || 0)
          const adCost = Number(r.ad_cost || 0)
          const staff = staffMap.get(Number(r.id)) ?? []
          return {
            id: Number(r.id),
            date: String(r.date).slice(0, 10),
            room: r.room,
            anchor: r.anchor,
            start_time: r.start_time,
            end_time: r.end_time,
            gmv,
            roi: allowAd && adCost > 0 ? Number((gmv / adCost).toFixed(2)) : 0,
            status: r.status,
            staff,
            staffCount: staff.length,
          }
        }),
      })
    } catch (err) {
      request.log.warn({ err }, 'overview/sessions query failed')
      return sendError(reply, 500, '查询场次列表失败')
    }
  })
}
