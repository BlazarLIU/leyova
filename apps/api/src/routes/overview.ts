import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { getPool } from '../lib/db.js'

export async function overviewRoutes(app: FastifyInstance) {
  // ── GET /api/v1/overview/sessions ── 已冻结
  // app.get('/api/v1/overview/sessions', async (_request, reply) => {
  //   const pool = getPool()
  //   try {
  //     const result = await pool.query<{...}>(...)
  //     return sendOk(reply, result.rows.map(r => ({...})))
  //   } catch (err) {
  //     app.log.warn({ err }, 'overview/sessions query failed')
  //     return sendOk(reply, [])
  //   }
  // })

  // ── GET /api/v1/overview/live-monitor ──
  app.get('/api/v1/overview/live-monitor', async (_request, reply) => {
    const pool = getPool()
    try {
      const rooms = await pool.query<{
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
         ORDER BY r.id`
      )
      const summary = await pool.query<{
        total_online: number; cumulative_views: number; real_time_gmv: string; total_orders: number
      }>(
        `SELECT COALESCE(SUM(online_peak), 0)::int AS total_online,
                COALESCE(SUM(online_peak) * 15, 0)::int AS cumulative_views,
                COALESCE(SUM(gmv), 0) AS real_time_gmv,
                COALESCE(SUM(orders), 0)::int AS total_orders
         FROM live_sessions
         WHERE date = (SELECT MAX(date) FROM live_sessions WHERE status = 'live') AND status = 'live'`
      )
      return sendOk(reply, {
        summary: {
          total_online: summary.rows[0]?.total_online ?? 0,
          cumulative_views: summary.rows[0]?.cumulative_views ?? 0,
          real_time_gmv: parseFloat(summary.rows[0]?.real_time_gmv ?? '0'),
          orders: summary.rows[0]?.total_orders ?? 0,
        },
        rooms: rooms.rows.map(r => ({
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
  app.get('/api/v1/overview/stats', async (_request, reply) => {
    const pool = getPool()
    try {
      const result = await pool.query<{
        today_gmv: string; today_orders: number; active_rooms: number
        online_viewers: number; growth_rate: string | null
      }>(
        `SELECT today_gmv, today_orders, active_rooms, online_viewers, growth_rate
         FROM overview_daily_stats
         WHERE date = (SELECT MAX(date) FROM overview_daily_stats) LIMIT 1`
      )
      if (result.rows.length > 0) {
        const row = result.rows[0]
        return sendOk(reply, {
          today_gmv: parseFloat(row.today_gmv),
          today_orders: row.today_orders,
          active_livestreams: row.active_rooms,
          online_viewers: row.online_viewers,
          growth_rate: row.growth_rate ? parseFloat(row.growth_rate) : 0,
        })
      }
    } catch (err) {
      app.log.warn({ err }, 'overview/stats db query failed')
    }
    // Fallback: compute from live_sessions
    try {
      const today = await pool.query<{
        today_gmv: string; today_orders: number; active_rooms: number; online_peak: number
      }>(
        `SELECT COALESCE(SUM(gmv), 0) AS today_gmv,
                COALESCE(SUM(orders), 0) AS today_orders,
                COUNT(*) FILTER (WHERE status = 'live')::int AS active_rooms,
                COALESCE(MAX(online_peak), 0) AS online_peak
         FROM live_sessions
         WHERE date = (SELECT MAX(date) FROM live_sessions WHERE status IN ('live', 'completed'))
           AND status IN ('live', 'completed')`
      )
      const r = today.rows[0]
      const yesterday = await pool.query<{ prev_gmv: string }>(
        `SELECT COALESCE(SUM(gmv), 0) AS prev_gmv
         FROM live_sessions
         WHERE date = (SELECT MAX(date) FROM live_sessions WHERE status IN ('live', 'completed')) - 1
           AND status IN ('live', 'completed')`
      )
      const prevGmv = parseFloat(yesterday.rows[0]?.prev_gmv ?? '0')
      const curGmv = parseFloat(r.today_gmv)
      const growth = prevGmv > 0 ? ((curGmv - prevGmv) / prevGmv) * 100 : 0
      return sendOk(reply, {
        today_gmv: curGmv, today_orders: r.today_orders,
        active_livestreams: r.active_rooms, online_viewers: r.online_peak,
        growth_rate: Math.round(growth * 10) / 10,
      })
    } catch (err2) {
      app.log.warn({ err: err2 }, 'overview/stats fallback failed')
      return sendOk(reply, { today_gmv: 0, today_orders: 0, active_livestreams: 0, online_viewers: 0, growth_rate: 0 })
    }
  })

  // ── GET /api/v1/overview/analytics ──
  app.get('/api/v1/overview/analytics', async (_request, reply) => {
    const pool = getPool()
    try {
      // Try with 30-day window first
      let result = await pool.query(
        `SELECT date::text, today_gmv, today_orders, active_rooms, online_viewers, growth_rate
         FROM overview_daily_stats
         WHERE date >= (SELECT MAX(date) FROM overview_daily_stats) - INTERVAL '30 days'
         ORDER BY date DESC`
      )
      // If no data, fallback to ALL available data
      if (result.rows.length === 0) {
        result = await pool.query(
          `SELECT date::text, today_gmv, today_orders, active_rooms, online_viewers, growth_rate
           FROM overview_daily_stats
           ORDER BY date DESC`
        )
      }
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
  app.get('/api/v1/overview/activities', async (_request, reply) => {
    const pool = getPool()
    try {
      const result = await pool.query<{
        id: number; title: string; time_desc: string; activity_type: string
      }>(
        `SELECT id, title, time_desc, activity_type
         FROM overview_activities ORDER BY created_at DESC LIMIT 20`
      )
      return sendOk(reply, result.rows.map(r => ({
        id: r.id, title: r.title, time: r.time_desc, type: r.activity_type,
      })))
    } catch (err) {
      app.log.warn({ err }, 'overview/activities query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/overview/cockpit ──
  app.get('/api/v1/overview/cockpit', async (_request, reply) => {
    const pool = getPool()
    try {
      // ── Summary: aggregate from live_sessions (recent data) ──
      const summary = await pool.query(
        `SELECT
           COALESCE(SUM(gmv), 0) AS total_gmv,
           COALESCE(SUM(gsv), 0) AS total_gsv,
           COALESCE(SUM(orders), 0)::int AS total_orders,
           COALESCE(SUM(return_amount), 0) AS total_return,
           COALESCE(SUM(ad_cost), 0) AS total_ad_cost,
           COALESCE(SUM(gmv), 0) - COALESCE(SUM(return_amount), 0) AS net_gmv
         FROM live_sessions
         WHERE date >= (SELECT MAX(date) FROM live_sessions WHERE status = 'completed') - INTERVAL '30 days'
           AND status = 'completed'`
      )
      let s = summary.rows[0] || {}
      let totalGmv = parseFloat(s.total_gmv || '0')
      let totalReturn = parseFloat(s.total_return || '0')
      let totalAdCost = parseFloat(s.total_ad_cost || '0')

      // ── Fallback: if live_sessions has no data, query from imported data ──
      const fromLiveSessions = totalGmv > 0
      if (!fromLiveSessions) {
        const impSummary = await pool.query(
          `SELECT
             COALESCE(SUM(lb.payment_amount), 0) AS total_gmv,
             0 AS total_gsv,
             COALESCE(SUM(om.deal_users), 0)::int AS total_orders,
             COALESCE(SUM(om.refund_amount), 0) AS total_return,
             0 AS total_ad_cost
           FROM session_live_basic_info lb
           LEFT JOIN session_overview_metrics om
             ON om.room_id = lb.room_id AND om.business_date = lb.business_date`
        )
        const row = impSummary.rows[0] || {}
        totalGmv = parseFloat(row.total_gmv || '0')
        totalReturn = parseFloat(row.total_return || '0')
        totalAdCost = parseFloat(row.total_ad_cost || '0')
      }
      const refundRate = totalGmv > 0 ? +((totalReturn / totalGmv) * 100).toFixed(1) : 0
      const roi = totalAdCost > 0 ? +(totalGmv / totalAdCost).toFixed(2) : 0

      // ── GMV trend ──
      let trend
      if (fromLiveSessions) {
        // live_sessions found data → use the original trend query
        trend = await pool.query(
          `SELECT date::text, COALESCE(SUM(gmv), 0) AS gmv
           FROM live_sessions
           WHERE date BETWEEN
             (SELECT MAX(date) FROM live_sessions WHERE status = 'completed') - INTERVAL '6 days'
             AND (SELECT MAX(date) FROM live_sessions WHERE status = 'completed')
             AND status = 'completed'
           GROUP BY date ORDER BY date`
        )
      } else {
        // fallback to imported data trend
        trend = await pool.query(
          `SELECT lb.business_date::text AS date, COALESCE(SUM(lb.payment_amount), 0) AS gmv
           FROM session_live_basic_info lb
           GROUP BY lb.business_date
           ORDER BY lb.business_date`
        )
      }
      const gmvTrend = trend.rows.map((r: any) => ({
        date: typeof r.date === 'string' ? r.date.slice(5) : r.date.toISOString().slice(5, 10),
        gmv: parseFloat(r.gmv),
      }))

      // Traffic sources from session_channel_metrics
      const traffic = await pool.query(
        `SELECT sc.channel,
                COALESCE(SUM(sc.views), 0) AS views,
                COALESCE(SUM(sc.gmv), 0) AS channel_gmv
         FROM session_channel_metrics sc
         LEFT JOIN live_sessions s ON s.id = sc.session_id
         WHERE (s.date >= (SELECT MAX(date) FROM live_sessions WHERE status = 'completed') - INTERVAL '30 days' OR sc.session_id IS NULL)
           AND (s.status = 'completed' OR sc.session_id IS NULL)
         GROUP BY sc.channel ORDER BY channel_gmv DESC`
      )
      const totalViews = traffic.rows.reduce((sum: number, r: any) => sum + parseInt(r.views), 0)
      const trafficSources = traffic.rows.map((r: any) => ({
        source: r.channel,
        value: totalViews > 0 ? +((parseInt(r.views) / totalViews) * 100).toFixed(1) : 0,
      }))

      return sendOk(reply, {
        summary: {
          total_gmv: totalGmv,
          refund_rate: refundRate,
          roi,
        },
        gmv_trend: gmvTrend,
        traffic_sources: trafficSources,
        top_products: [], // Products table not yet available
      })
    } catch (err) {
      app.log.warn({ err }, 'overview/cockpit query failed')
      return sendOk(reply, {
        summary: { total_gmv: 0, refund_rate: 0, roi: 0 },
        gmv_trend: [], traffic_sources: [], top_products: [],
      })
    }
  })

  // ── GET /api/v1/overview/patrol-summary ── 获取指定日期的巡检摘要
  app.get('/api/v1/overview/patrol-summary', async (_request, reply) => {
    const pool = getPool()
    const query = _request.query as { date?: string }
    const date = query.date || new Date().toISOString().slice(0, 10)
    try {
      const result = await pool.query(
        `SELECT m.content, c.created_at
         FROM ai_conversations c
         JOIN ai_messages m ON m.conversation_id = c.id
         WHERE c.title = $1 AND m.role = 'assistant'
         ORDER BY m.created_at DESC LIMIT 1`,
        [`patrol-${date}`]
      )
      return sendOk(reply, {
        content: result.rows[0]?.content || null,
        generatedAt: result.rows[0]?.created_at || null,
        date,
      })
    } catch (err) {
      _request.log.warn({ err }, 'overview/patrol-summary query failed')
      return sendOk(reply, { content: null, generatedAt: null, date })
    }
  })

  // ── GET /api/v1/overview/daily-report ── 获取指定日期的经营日报
  app.get('/api/v1/overview/daily-report', async (_request, reply) => {
    const pool = getPool()
    const query = _request.query as { date?: string }
    const date = query.date || new Date().toISOString().slice(0, 10)
    try {
      const result = await pool.query(
        `SELECT m.content, c.created_at
         FROM ai_conversations c
         JOIN ai_messages m ON m.conversation_id = c.id
         WHERE c.title = $1 AND m.role = 'assistant'
         ORDER BY m.created_at DESC LIMIT 1`,
        [`daily-${date}`]
      )
      return sendOk(reply, {
        content: result.rows[0]?.content || null,
        generatedAt: result.rows[0]?.created_at || null,
        date,
      })
    } catch (err) {
      _request.log.warn({ err }, 'overview/daily-report query failed')
      return sendOk(reply, { content: null, generatedAt: null, date })
    }
  })

  // ── 通用：按标题前缀返回该类型全部记录（最新在上）──
  async function getReportRecords(
    prefix: string
  ): Promise<Array<{ title: string; date: string; content: string | null; createdAt: string }>> {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.created_at, lm.content
       FROM ai_conversations c
       JOIN LATERAL (
         SELECT content FROM ai_messages
         WHERE conversation_id = c.id AND role = 'assistant'
         ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE c.title LIKE $1
       ORDER BY c.created_at DESC`,
      [`${prefix}%`]
    )
    return rows.map((r: any) => ({
      title: String(r.title),
      date: String(r.title).slice(prefix.length),
      content: r.content ?? null,
      createdAt: r.created_at,
    }))
  }

  // ── GET /api/v1/overview/daily-reports ── 全部经营日报（最新在上）
  app.get('/api/v1/overview/daily-reports', async (_request, reply) => {
    try {
      return sendOk(reply, await getReportRecords('daily-'))
    } catch (err) {
      _request.log.warn({ err }, 'overview/daily-reports query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/overview/patrol-records ── 全部巡检记录（最新在上）
  app.get('/api/v1/overview/patrol-records', async (_request, reply) => {
    try {
      return sendOk(reply, await getReportRecords('patrol-'))
    } catch (err) {
      _request.log.warn({ err }, 'overview/patrol-records query failed')
      return sendOk(reply, [])
    }
  })
}