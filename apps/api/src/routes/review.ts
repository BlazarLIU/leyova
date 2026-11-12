import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'

export async function reviewRoutes(app: FastifyInstance) {
  // ── GET /api/v1/review/sessions ──
  app.get('/api/v1/review/sessions', async (request, reply) => {
    try {
      const { lsResult, importedResult } = await withRlsContext(request, async (client) => {
        // 查询 live_sessions 中的场次
        const lsRes = await client.query(
          `SELECT ls.id, ls.date, ls.title, ls.gmv, ls.views, ls.duration_min,
                  ls.status, COALESCE(a.name, '') AS anchor_name,
                  ls.room_id, NULL::date AS business_date
           FROM live_sessions ls
           LEFT JOIN anchors a ON a.id = ls.anchor_id
           WHERE ls.status = 'completed'
           ORDER BY ls.date DESC, ls.id`
        )

        // 同时查询导入的整场数据（session_live_basic_info）
        const impRes = await client.query(
          `SELECT -lb.id AS id, lb.live_date AS date,
                  r.name AS title, lb.payment_amount AS gmv,
                  ol.viewers AS views, lb.live_duration_min AS duration_min,
                  'completed' AS status, r.name AS anchor_name,
                  lb.room_id, lb.business_date
           FROM session_live_basic_info lb
           JOIN live_rooms r ON r.id = lb.room_id
           LEFT JOIN session_overview_metrics ol ON ol.room_id = lb.room_id AND ol.business_date = lb.business_date
           WHERE NOT EXISTS (
             SELECT 1 FROM live_sessions ls
             WHERE ls.room_id = lb.room_id AND ls.date = lb.business_date::date
           )
           ORDER BY lb.business_date DESC`
        )
        return { lsResult: lsRes, importedResult: impRes }
      })

      const sessions = [
        ...lsResult.rows.map(r => ({
          id: r.id,
          date: r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
          title: r.title || '',
          gmv: parseFloat(r.gmv || '0'),
          views: r.views || 0,
          duration_min: r.duration_min || 0,
          anchor_name: r.anchor_name,
          status: r.status,
          room_id: r.room_id,
          business_date: r.business_date ? new Date(r.business_date).toISOString().slice(0, 10) : null,
        })),
        ...importedResult.rows.map(r => ({
          id: r.id,
          date: r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
          title: r.title || '',
          gmv: parseFloat(r.gmv || '0'),
          views: r.views || 0,
          duration_min: r.duration_min || 0,
          anchor_name: r.anchor_name,
          status: r.status,
          room_id: r.room_id,
          business_date: r.business_date ? new Date(r.business_date).toISOString().slice(0, 10) : null,
        })),
      ]

      return sendOk(reply, sessions)
    } catch (err) {
      request.log.warn({ err }, 'review/sessions query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/overview ──
  app.get('/api/v1/review/overview', async (request, reply) => {
    const q = request.query as {
      session_id?: string; start_date?: string; end_date?: string; anchor_id?: string
    }
    try {
      // Build filter conditions
      const conditions: string[] = []
      const params: any[] = []
      let idx = 1

      if (q.session_id) {
        conditions.push(`ls.id = $${idx++}`)
        params.push(q.session_id)
      }
      if (q.start_date) {
        conditions.push(`ls.date >= $${idx++}::date`)
        params.push(q.start_date)
      }
      if (q.end_date) {
        conditions.push(`ls.date <= $${idx++}::date`)
        params.push(q.end_date)
      }
      if (q.anchor_id) {
        conditions.push(`ls.anchor_id = $${idx++}`)
        params.push(q.anchor_id)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Overall KPI — 从导入数据聚合（session_live_basic_info + session_overview_metrics）
      const importedParams: any[] = []
      let importedWhere = ''
      if (q.start_date) {
        importedWhere = `WHERE lb.business_date >= $1::date`
        importedParams.push(q.start_date)
      }
      if (q.end_date) {
        importedWhere = importedWhere
          ? `${importedWhere} AND lb.business_date <= $2::date`
          : `WHERE lb.business_date <= $1::date`
        importedParams.push(q.end_date)
      }

      const { kpi, comparison, topChannels, avgResult } = await withRlsContext(request, async (client) => {
        const overall = await client.query(
          `SELECT
             COALESCE(SUM(lb.payment_amount), 0) AS gmv,
             COALESCE(SUM(om.deal_users), 0)::int AS orders,
             COALESCE(SUM(lb.gpm), 0) AS gpm,
             COALESCE(SUM(om.avg_order_value), 0) AS avg_order_value,
             COALESCE(SUM(om.viewers), 0)::int AS views,
             COALESCE(AVG(om.exposure_view_rate), 0) AS exposure_view_rate,
             COALESCE(AVG(om.product_click_deal_rate), 0) AS product_deal_rate,
             COALESCE(SUM(om.new_followers), 0)::int AS new_fans,
             COALESCE(AVG(om.interaction_rate), 0) AS interaction_rate,
             0 AS retention_rate,
             0 AS uv_value,
             COALESCE(MAX(om.peak_online), 0)::int AS online_peak,
             COALESCE(AVG(om.avg_online), 0)::int AS avg_online,
             COALESCE(SUM(lb.live_duration_min), 0)::int AS duration_min,
             COALESCE(SUM(om.refund_amount), 0) AS refund_amount,
             COALESCE(SUM(om.refund_orders), 0)::int AS refund_orders,
             CASE WHEN SUM(lb.live_duration_min) > 0
               THEN ROUND(SUM(lb.payment_amount) / NULLIF(SUM(lb.live_duration_min) / 60.0, 0), 2)
               ELSE 0 END AS gmv_per_hour,
             COUNT(lb.id)::int AS session_count
           FROM session_live_basic_info lb
           LEFT JOIN session_overview_metrics om
             ON om.room_id = lb.room_id AND om.business_date = lb.business_date
           ${importedWhere}`,
          importedParams
        )
        const k = overall.rows[0] || {}

        // Period-over-period comparison (previous period)
        let comp: any = null
        if (q.start_date && q.end_date) {
          const daysDiff = Math.round(
            (new Date(q.end_date).getTime() - new Date(q.start_date).getTime()) / (1000 * 60 * 60 * 24)
          ) + 1
          const prevEnd = new Date(new Date(q.start_date).getTime() - 1)
          const prevStart = new Date(prevEnd.getTime() - (daysDiff - 1) * 24 * 60 * 60 * 1000)
          const prevStartStr = prevStart.toISOString().slice(0, 10)
          const prevEndStr = prevEnd.toISOString().slice(0, 10)

          const prevResult = await client.query(
            `SELECT
               COALESCE(SUM(lb.payment_amount), 0) AS gmv,
               COALESCE(SUM(om.deal_users), 0)::int AS orders,
               COALESCE(SUM(om.viewers), 0)::int AS views,
               COALESCE(SUM(om.new_followers), 0)::int AS new_fans,
               COALESCE(SUM(lb.live_duration_min), 0)::int AS duration_min
             FROM session_live_basic_info lb
             LEFT JOIN session_overview_metrics om
               ON om.room_id = lb.room_id AND om.business_date = lb.business_date
             WHERE lb.business_date >= $1::date AND lb.business_date <= $2::date`,
            [prevStartStr, prevEndStr]
          )
          const prev = prevResult.rows[0] || {}
          const curGmv = parseFloat(k.gmv || '0')
          const prevGmv = parseFloat(prev.gmv || '0')
          comp = {
            current_period: { start_date: q.start_date, end_date: q.end_date },
            previous_period: { start_date: prevStartStr, end_date: prevEndStr },
            gmv_change: prevGmv > 0 ? Math.round(((curGmv - prevGmv) / prevGmv) * 10000) / 100 : 0,
            orders_change: prev.orders > 0 ? Math.round((( (k.orders || 0) - prev.orders) / prev.orders) * 10000) / 100 : 0,
            views_change: prev.views > 0 ? Math.round((( (k.views || 0) - prev.views) / prev.views) * 10000) / 100 : 0,
          }
        }

        // Top 3 channels by GMV from imported douyin_channel_daily_metrics
        let channels: any[] = []
        await client.query('SAVEPOINT sp_rev_ch')
        try {
          const channelResult = await client.query(
            `WITH ch AS (
               SELECT business_date, channel_name, payment_amount
               FROM douyin_channel_daily_metrics
               WHERE payment_amount > 0
             )
             SELECT ch.channel_name AS channel, COALESCE(SUM(ch.payment_amount), 0) AS gmv
             FROM ch
             GROUP BY ch.channel_name
             ORDER BY gmv DESC
             LIMIT 3`
          )
          await client.query('RELEASE SAVEPOINT sp_rev_ch')
          channels = channelResult.rows.map(r => ({
            channel: r.channel,
            gmv: parseFloat(r.gmv),
          }))
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT sp_rev_ch').catch(() => {})
        }

        // Top 3 anomaly indicators — 基于导入的整体指标与同行基准对比
        const avgRes = await client.query(
          `SELECT
             COALESCE(AVG(om.interaction_rate), 0) AS avg_interaction_rate,
             COALESCE(AVG(om.exposure_view_rate), 0) AS avg_exposure_view_rate,
             COALESCE(AVG(om.product_exposure_click_rate), 0) AS avg_product_click_rate,
             COALESCE(AVG(om.product_click_deal_rate), 0) AS avg_product_deal_rate
           FROM session_overview_metrics om
           JOIN session_live_basic_info lb ON lb.room_id = om.room_id AND lb.business_date = om.business_date`
        )
        return { kpi: k, comparison: comp, topChannels: channels, avgResult: avgRes }
      })

      // 导入数据无主播归属，主播 TOP3 为空
      const topAnchors = { rows: [] as any[] }
      const avg = avgResult.rows[0] || {}
      const curKpi = {
        interaction_rate: parseFloat(kpi.interaction_rate || '0'),
        exposure_view_rate: parseFloat(kpi.exposure_view_rate || '0'),
        product_deal_rate: parseFloat(kpi.product_deal_rate || '0'),
      }
      const anomalies: { indicator: string; value: number; avg_value: number; change_pct: number }[] = []
      for (const key of ['interaction_rate', 'exposure_view_rate', 'product_deal_rate']) {
        const av = parseFloat(avg[`avg_${key}`] || '0')
        const cv = (curKpi as any)[key]
        const change = av > 0 ? Math.round(((cv - av) / av) * 10000) / 100 : 0
        if (change < 0) {
          anomalies.push({ indicator: key, value: cv, avg_value: av, change_pct: change })
        }
      }
      anomalies.sort((a, b) => a.change_pct - b.change_pct)
      const topAnomalies = anomalies.slice(0, 3)

      return sendOk(reply, {
        kpi: {
          gmv: parseFloat(kpi.gmv || '0'),
          orders: kpi.orders || 0,
          gpm: parseFloat(kpi.gpm || '0'),
          avg_order_value: parseFloat(kpi.avg_order_value || '0'),
          views: kpi.views || 0,
          exposure_view_rate: parseFloat(kpi.exposure_view_rate || '0'),
          product_deal_rate: parseFloat(kpi.product_deal_rate || '0'),
          new_fans: kpi.new_fans || 0,
          interaction_rate: parseFloat(kpi.interaction_rate || '0'),
          retention_rate: parseFloat(kpi.retention_rate || '0'),
          uv_value: parseFloat(kpi.uv_value || '0'),
          online_peak: kpi.online_peak || 0,
          avg_online: kpi.avg_online || 0,
          duration_min: kpi.duration_min || 0,
          gmv_per_hour: parseFloat(kpi.gmv_per_hour || '0'),
          session_count: kpi.session_count || 0,
          refund_amount: parseFloat(kpi.refund_amount || '0'),
          refund_orders: kpi.refund_orders || 0,
          refund_rate: kpi.gmv > 0
            ? Math.round((parseFloat(kpi.refund_amount || '0') / parseFloat(kpi.gmv)) * 10000) / 100
            : 0,
        },
        comparison,
        top_channels: topChannels,
        top_anchors: topAnchors.rows.map(r => ({
          anchor_id: r.anchor_id,
          anchor_name: r.anchor_name,
          gmv_per_hour: parseFloat(r.gmv_per_hour),
        })),
        top_anomalies: topAnomalies,
      })
    } catch (err) {
      request.log.warn({ err }, 'review/overview query failed')
      return sendOk(reply, {
        kpi: {
          gmv: 0, orders: 0, gpm: 0, avg_order_value: 0, views: 0,
          exposure_view_rate: 0, product_deal_rate: 0, new_fans: 0,
          interaction_rate: 0, retention_rate: 0, uv_value: 0,
          online_peak: 0, avg_online: 0, duration_min: 0, gmv_per_hour: 0,
          session_count: 0, refund_amount: 0, refund_orders: 0, refund_rate: 0,
        },
        comparison: null,
        top_channels: [],
        top_anchors: [],
        top_anomalies: [],
      })
    }
  })

  // ── GET /api/v1/review/channels ──
  app.get('/api/v1/review/channels', async (request, reply) => {
    const q = request.query as {
      session_id?: string; start_date?: string; end_date?: string
      channel?: string; sort?: string; order?: string
    }
    try {
      const conditions: string[] = []
      const params: any[] = []
      let idx = 1

      if (q.start_date) {
        conditions.push(`dm.business_date >= $${idx++}::date`)
        params.push(q.start_date)
      }
      if (q.end_date) {
        conditions.push(`dm.business_date <= $${idx++}::date`)
        params.push(q.end_date)
      }
      if (q.channel) {
        conditions.push(`dm.channel_name = $${idx++}`)
        params.push(q.channel)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const sortColumn = q.sort || 'payment_amount'
      const sortOrder = q.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      // Whitelist sort columns to prevent SQL injection
      const allowedSorts = ['payment_amount', 'viewers', 'order_count', 'thousand_view_payment', 'impressions', 'avg_order_value', 'channel_name', 'ad_cost_bound']
      const safeSort = allowedSorts.includes(sortColumn) ? sortColumn : 'payment_amount'

      const result = await withRlsContext(request, (client) => client.query(
        `SELECT dm.business_date, dm.channel_name, dm.avg_watch_seconds, dm.impressions, dm.viewers,
                dm.interactions, dm.new_followers, dm.product_impressions, dm.product_clicks,
                dm.order_count, dm.buyer_count, dm.payment_amount, dm.item_count,
                dm.thousand_view_payment, dm.avg_order_value, dm.ad_cost_bound
         FROM douyin_channel_daily_metrics dm
         ${whereClause}
         ORDER BY dm.${safeSort} ${sortOrder}`,
        params
      ))
      return sendOk(reply, result.rows.map(r => ({
        session_id: null,
        channel: r.channel_name,
        avg_watch_sec: r.avg_watch_seconds || 0,
        impressions: r.impressions || 0,
        views: r.viewers || 0,
        exposure_view_rate: r.impressions > 0
          ? parseFloat(((r.viewers / r.impressions) * 100).toFixed(4))
          : 0,
        interactions: r.interactions || 0,
        view_interaction_rate: r.viewers > 0
          ? parseFloat(((r.interactions / r.viewers) * 100).toFixed(4))
          : 0,
        new_fans: r.new_followers || 0,
        product_impressions: r.product_impressions || 0,
        product_clicks: r.product_clicks || 0,
        product_click_rate: r.product_impressions > 0
          ? parseFloat(((r.product_clicks / r.product_impressions) * 100).toFixed(4))
          : 0,
        product_deal_rate: 0,
        orders: r.order_count || 0,
        buyer_count: r.buyer_count || 0,
        gmv: parseFloat(r.payment_amount || '0'),
        item_count: r.item_count || 0,
        gpm: parseFloat(r.thousand_view_payment || '0'),
        avg_order_value: parseFloat(r.avg_order_value || '0'),
        ad_spend: parseFloat(r.ad_cost_bound || '0'),
        period_date: r.business_date ? new Date(r.business_date).toISOString().slice(0, 10) : '',
      })))
    } catch (err) {
      request.log.warn({ err }, 'review/channels query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/channels/:channel ──
  app.get('/api/v1/review/channels/:channel', async (request, reply) => {
    const { channel } = request.params as { channel: string }
    const q = request.query as { session_id?: string; start_date?: string; end_date?: string }
    try {
      const conditions: string[] = ['dm.channel_name = $1']
      const params: any[] = [channel]
      let idx = 2

      if (q.start_date) {
        conditions.push(`dm.business_date >= $${idx++}::date`)
        params.push(q.start_date)
      }
      if (q.end_date) {
        conditions.push(`dm.business_date <= $${idx++}::date`)
        params.push(q.end_date)
      }

      const result = await withRlsContext(request, (client) => client.query(
        `SELECT dm.*
         FROM douyin_channel_daily_metrics dm
         WHERE ${conditions.join(' AND ')}
         ORDER BY dm.payment_amount DESC
         LIMIT 100`,
        params
      ))
      return sendOk(reply, result.rows.map(r => ({
        session_id: null,
        channel: r.channel_name,
        avg_watch_sec: r.avg_watch_seconds || 0,
        impressions: r.impressions || 0,
        views: r.viewers || 0,
        exposure_view_rate: r.impressions > 0
          ? parseFloat(((r.viewers / r.impressions) * 100).toFixed(4))
          : 0,
        interactions: r.interactions || 0,
        view_interaction_rate: r.viewers > 0
          ? parseFloat(((r.interactions / r.viewers) * 100).toFixed(4))
          : 0,
        new_fans: r.new_followers || 0,
        product_impressions: r.product_impressions || 0,
        product_clicks: r.product_clicks || 0,
        product_click_rate: r.product_impressions > 0
          ? parseFloat(((r.product_clicks / r.product_impressions) * 100).toFixed(4))
          : 0,
        product_deal_rate: 0,
        orders: r.order_count || 0,
        buyer_count: r.buyer_count || 0,
        gmv: parseFloat(r.payment_amount || '0'),
        item_count: r.item_count || 0,
        gpm: parseFloat(r.thousand_view_payment || '0'),
        avg_order_value: parseFloat(r.avg_order_value || '0'),
        ad_spend: parseFloat(r.ad_cost_bound || '0'),
        period_date: r.business_date ? new Date(r.business_date).toISOString().slice(0, 10) : '',
      })))
    } catch (err) {
      request.log.warn({ err }, 'review/channels/:channel query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/anchors ──
  app.get('/api/v1/review/anchors', async (request, reply) => {
    const q = request.query as {
      session_id?: string; start_date?: string; end_date?: string; anchor_id?: string
    }
    try {
      const conditions: string[] = []
      const params: any[] = []

      // 只统计已完结场次，排除登记(scheduled)数据
      conditions.push("ls.status = 'completed'")
      let idx = 1

      if (q.session_id) {
        conditions.push(`ls.id = $${idx++}`)
        params.push(q.session_id)
      }
      if (q.start_date) {
        conditions.push(`ls.date >= $${idx++}::date`)
        params.push(q.start_date)
      }
      if (q.end_date) {
        conditions.push(`ls.date <= $${idx++}::date`)
        params.push(q.end_date)
      }
      if (q.anchor_id) {
        conditions.push(`ls.anchor_id = $${idx++}`)
        params.push(q.anchor_id)
      }

      const liveWhereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // Build separate conditions for session_anchor_metrics (no ls. prefix, skip session_id)
      const samConditions: string[] = []
      const samParams: any[] = []
      let samIdx = 1
      if (q.start_date) {
        samConditions.push(`sam.date >= $${samIdx++}::date`)
        samParams.push(q.start_date)
      }
      if (q.end_date) {
        samConditions.push(`sam.date <= $${samIdx++}::date`)
        samParams.push(q.end_date)
      }
      if (q.anchor_id) {
        samConditions.push(`sam.anchor_id = $${samIdx++}`)
        samParams.push(q.anchor_id)
      }
      const samWhereClause = samConditions.length > 0 ? `WHERE ${samConditions.join(' AND ')}` : ''

      const result = await withRlsContext(request, (client) => client.query(
        `SELECT anchor_id, anchor_name,
                COALESCE(SUM(gmv), 0) AS gmv,
                CASE WHEN COALESCE(SUM(duration_min), 0) > 0
                  THEN ROUND(SUM(gmv) / NULLIF(SUM(duration_min) / 60.0, 0), 2)
                  ELSE 0 END AS gmv_per_hour,
                COALESCE(AVG(avg_item_price), 0) AS avg_item_price,
                COALESCE(SUM(buyer_count), 0)::int AS buyer_count,
                COALESCE(MAX(online_peak), 0)::int AS online_peak,
                COALESCE(AVG(avg_online), 0)::int AS avg_online,
                COALESCE(AVG(exposure_view_rate), 0) AS exposure_view_rate,
                COALESCE(AVG(retention_rate), 0) AS retention_rate,
                COALESCE(AVG(interaction_rate), 0) AS interaction_rate,
                COALESCE(SUM(new_fans), 0)::int AS new_fans,
                COALESCE(AVG(view_follow_rate), 0) AS view_follow_rate,
                COALESCE(SUM(new_group_members), 0)::int AS new_group_members,
                COALESCE(AVG(uv_value), 0) AS uv_value,
                COALESCE(SUM(duration_min), 0)::int AS duration_min,
                MAX(audience_profile) AS audience_profile
         FROM (
           SELECT ls.anchor_id, a.name AS anchor_name,
                  ls.gmv, ls.duration_min, ls.avg_item_price,
                  ls.buyer_count, ls.online_peak, ls.avg_online,
                  ls.exposure_view_rate, ls.retention_rate, ls.interaction_rate,
                  ls.new_fans, ls.view_follow_rate, ls.new_group_members, ls.uv_value,
                  NULL AS audience_profile
           FROM live_sessions ls
           LEFT JOIN anchors a ON a.id = ls.anchor_id
           ${liveWhereClause}

           UNION ALL

           SELECT sam.anchor_id, a.name AS anchor_name,
                  sam.gmv, sam.duration_min, sam.avg_item_price,
                  sam.buyer_count, sam.online_peak, sam.avg_online,
                  sam.exposure_view_rate, sam.retention_rate, sam.interaction_rate,
                  sam.new_fans, sam.view_follow_rate, sam.new_group_members, sam.uv_value,
                  sam.audience_profile
           FROM session_anchor_metrics sam
           LEFT JOIN anchors a ON a.id = sam.anchor_id
           ${samWhereClause}
         ) AS combined
         GROUP BY anchor_id, anchor_name
         ORDER BY gmv DESC`,
        // 两个子查询都使用 $1/$2（全局参数编号），只需传 params 即可
        params
      ))
      return sendOk(reply, result.rows.map(r => ({
        anchor_id: r.anchor_id,
        anchor_name: r.anchor_name,
        gmv: parseFloat(r.gmv),
        gmv_per_hour: parseFloat(r.gmv_per_hour),
        avg_item_price: parseFloat(r.avg_item_price),
        buyer_count: r.buyer_count,
        online_peak: r.online_peak,
        avg_online: r.avg_online,
        exposure_view_rate: parseFloat(r.exposure_view_rate),
        retention_rate: parseFloat(r.retention_rate),
        interaction_rate: parseFloat(r.interaction_rate),
        new_fans: r.new_fans,
        view_follow_rate: parseFloat(r.view_follow_rate),
        new_group_members: r.new_group_members,
        uv_value: parseFloat(r.uv_value),
        duration_min: r.duration_min,
        audience_profile: r.audience_profile,
      })))
    } catch (err) {
      request.log.warn({ err }, 'review/anchors query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/funnel ──
  app.get('/api/v1/review/funnel', async (request, reply) => {
    const q = request.query as { session_id?: string; start_date?: string; end_date?: string }
    try {
      const conditions: string[] = []
      const params: any[] = []

      // 只统计已完结场次，排除登记(scheduled)数据
      conditions.push("ls.status = 'completed'")
      let idx = 1

      if (q.session_id) {
        conditions.push(`ls.id = $${idx++}`)
        params.push(q.session_id)
      }
      if (q.start_date) {
        conditions.push(`ls.date >= $${idx++}::date`)
        params.push(q.start_date)
      }
      if (q.end_date) {
        conditions.push(`ls.date <= $${idx++}::date`)
        params.push(q.end_date)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const { impressions, funnelViews, funnelProductImpressions, funnelProductClicks, funnelOrders } =
        await withRlsContext(request, async (client) => {
          // Get impressions sum from session_channel_metrics
          let impTotal = 0
          await client.query('SAVEPOINT sp_rev_imp')
          try {
            const impResult = await client.query(
              `SELECT COALESCE(SUM(sc.impressions), 0)::int AS total
               FROM session_channel_metrics sc
               LEFT JOIN live_sessions ls ON ls.id = sc.session_id
               ${whereClause}`,
              params
            )
            await client.query('RELEASE SAVEPOINT sp_rev_imp')
            impTotal = impResult.rows[0]?.total || 0
          } catch {
            await client.query('ROLLBACK TO SAVEPOINT sp_rev_imp').catch(() => {})
          }

          // Get views, product_impressions, product_clicks, orders from live_sessions
          const result = await client.query(
            `SELECT
               COALESCE(SUM(ls.views), 0)::int AS views,
               COALESCE(SUM(sc2.product_impressions), 0)::int AS product_impressions,
               COALESCE(SUM(sc2.product_clicks), 0)::int AS product_clicks,
               COALESCE(SUM(sc2.orders), 0)::int AS orders
             FROM live_sessions ls
             LEFT JOIN session_channel_metrics sc2 ON sc2.session_id = ls.id
             ${whereClause}`,
            params
          )
          const row = result.rows[0] || {}

          let views = row.views || 0
          let prodImp = row.product_impressions || 0
          let prodClicks = row.product_clicks || 0
          let orders = row.orders || 0

          // Also aggregate funnel data from imported sessions (session_live_basic_info + session_overview_metrics)
          await client.query('SAVEPOINT sp_rev_imp2')
          try {
            const impConditions: string[] = []
            const impParams: any[] = []
            let impIdx = 1

            if (q.start_date) {
              impConditions.push(`slbi.business_date >= $${impIdx++}::date`)
              impParams.push(q.start_date)
            }
            if (q.end_date) {
              impConditions.push(`slbi.business_date <= $${impIdx++}::date`)
              impParams.push(q.end_date)
            }

            const impWhere = impConditions.length > 0 ? `WHERE ${impConditions.join(' AND ')}` : ''

            // Impressions (exposure_users) from imported data
            const impResult2 = await client.query(
              `SELECT COALESCE(SUM(om.exposure_users), 0)::int AS total
               FROM session_live_basic_info slbi
               LEFT JOIN session_overview_metrics om
                 ON om.room_id = slbi.room_id AND om.business_date = slbi.business_date
               ${impWhere}`,
              impParams
            )
            impTotal += impResult2.rows[0]?.total || 0

            // Funnel metrics from imported data
            const funnelResult2 = await client.query(
              `SELECT
                 COALESCE(SUM(om.viewers), 0)::int AS views,
                 COALESCE(SUM(om.product_exposure_users), 0)::int AS product_exposure_users,
                 COALESCE(SUM(om.product_click_persons), 0)::int AS product_click_persons,
                 COALESCE(SUM(om.deal_users), 0)::int AS deal_users
               FROM session_live_basic_info slbi
               LEFT JOIN session_overview_metrics om
                 ON om.room_id = slbi.room_id AND om.business_date = slbi.business_date
               ${impWhere}`,
              impParams
            )
            await client.query('RELEASE SAVEPOINT sp_rev_imp2')
            const fr2 = funnelResult2.rows[0] || {}
            views += fr2.views || 0
            prodImp += fr2.product_exposure_users || 0
            prodClicks += fr2.product_click_persons || 0
            orders += fr2.deal_users || 0
          } catch {
            await client.query('ROLLBACK TO SAVEPOINT sp_rev_imp2').catch(() => {})
          }

          return {
            impressions: impTotal,
            funnelViews: views,
            funnelProductImpressions: prodImp,
            funnelProductClicks: prodClicks,
            funnelOrders: orders,
          }
        })

      // Build funnel levels
      const levels = [
        {
          name: '直播间曝光',
          count: impressions,
          conversion_rate: null,
          drop_off: null,
        },
        {
          name: '直播间观看',
          count: funnelViews,
          conversion_rate: impressions > 0 ? Math.round((funnelViews / impressions) * 10000) / 100 : 0,
          drop_off: impressions - funnelViews,
        },
        {
          name: '商品曝光',
          count: funnelProductImpressions,
          conversion_rate: funnelViews > 0 ? Math.round((funnelProductImpressions / funnelViews) * 10000) / 100 : 0,
          drop_off: funnelViews - funnelProductImpressions,
        },
        {
          name: '商品点击',
          count: funnelProductClicks,
          conversion_rate: funnelProductImpressions > 0 ? Math.round((funnelProductClicks / funnelProductImpressions) * 10000) / 100 : 0,
          drop_off: funnelProductImpressions - funnelProductClicks,
        },
        {
          name: '成交下单',
          count: funnelOrders,
          conversion_rate: funnelProductClicks > 0 ? Math.round((funnelOrders / funnelProductClicks) * 10000) / 100 : 0,
          drop_off: funnelProductClicks - funnelOrders,
        },
      ]

      return sendOk(reply, { levels })
    } catch (err) {
      request.log.warn({ err }, 'review/funnel query failed')
      return sendOk(reply, { levels: [] })
    }
  })

  // ── GET /api/v1/review/compare ──
  app.get('/api/v1/review/compare', async (request, reply) => {
    const q = request.query as {
      session_id_a?: string; session_id_b?: string
      start_date?: string; end_date?: string
      prev_start_date?: string; prev_end_date?: string
    }
    try {
      let aConditions: string[] = []
      let aParams: any[] = []
      let bConditions: string[] = []
      let bParams: any[] = []

      // 只统计已完结场次，排除登记(scheduled)数据
      aConditions.push("ls.status = 'completed'")
      bConditions.push("ls.status = 'completed'")
      let idx = 1

      if (q.session_id_a && q.session_id_b) {
        aConditions.push(`ls.id = $${idx++}`)
        aParams.push(q.session_id_a)
        bConditions.push(`ls.id = $${idx++}`)
        bParams.push(q.session_id_b)
      } else if (q.start_date && q.end_date && q.prev_start_date && q.prev_end_date) {
        aConditions.push(`ls.date >= $${idx++}::date AND ls.date <= $${idx++}::date`)
        aParams.push(q.start_date, q.end_date)
        bConditions.push(`ls.date >= $${idx++}::date AND ls.date <= $${idx++}::date`)
        bParams.push(q.prev_start_date, q.prev_end_date)
      } else {
        return sendOk(reply, { a: null, b: null, error: '请提供 session_id_a/session_id_b 或 start_date/end_date/prev_start_date/prev_end_date' })
      }

      const [aMetrics, bMetrics] = await withRlsContext(request, async (client) => {
        async function getMetrics(
          conditions: string[], params: any[]
        ): Promise<Record<string, any>> {
          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
          const result = await client.query(
            `SELECT
               COALESCE(SUM(ls.gmv), 0) AS gmv,
               COALESCE(SUM(ls.orders), 0)::int AS orders,
               COALESCE(SUM(ls.views), 0)::int AS views,
               COALESCE(SUM(ls.new_fans), 0)::int AS new_fans,
               COALESCE(SUM(ls.duration_min), 0)::int AS duration_min,
               CASE WHEN SUM(ls.views) > 0
                 THEN ROUND((SUM(ls.gmv) / NULLIF(SUM(ls.views), 0)) * 1000, 2)
                 ELSE 0 END AS gpm,
               COALESCE(AVG(ls.interaction_rate), 0) AS interaction_rate,
               COALESCE(AVG(ls.retention_rate), 0) AS retention_rate,
               CASE WHEN SUM(ls.duration_min) > 0
                 THEN ROUND(SUM(ls.gmv) / NULLIF(SUM(ls.duration_min) / 60.0, 0), 2)
                 ELSE 0 END AS gmv_per_hour,
               COALESCE(MAX(ls.online_peak), 0)::int AS online_peak,
               COALESCE(AVG(ls.uv_value), 0) AS uv_value
             FROM live_sessions ls
             ${whereClause}`,
            params
          )
          return result.rows[0] || {}
        }

        const a = await getMetrics(aConditions, aParams)
        const b = await getMetrics(bConditions, bParams)
        return [a, b]
      })

      const aGmv = parseFloat(aMetrics.gmv || '0')
      const bGmv = parseFloat(bMetrics.gmv || '0')
      const gmvChange = bGmv > 0 ? Math.round(((aGmv - bGmv) / bGmv) * 10000) / 100 : 0

      return sendOk(reply, {
        a: {
          label: q.session_id_a ? `场次 #${q.session_id_a}` : `${q.start_date} ~ ${q.end_date}`,
          gmv: aGmv,
          orders: aMetrics.orders || 0,
          views: aMetrics.views || 0,
          gpm: parseFloat(aMetrics.gpm || '0'),
          gmv_per_hour: parseFloat(aMetrics.gmv_per_hour || '0'),
          interaction_rate: parseFloat(aMetrics.interaction_rate || '0'),
          retention_rate: parseFloat(aMetrics.retention_rate || '0'),
          new_fans: aMetrics.new_fans || 0,
          duration_min: aMetrics.duration_min || 0,
          online_peak: aMetrics.online_peak || 0,
          uv_value: parseFloat(aMetrics.uv_value || '0'),
        },
        b: {
          label: q.session_id_b ? `场次 #${q.session_id_b}` : `${q.prev_start_date} ~ ${q.prev_end_date}`,
          gmv: bGmv,
          orders: bMetrics.orders || 0,
          views: bMetrics.views || 0,
          gpm: parseFloat(bMetrics.gpm || '0'),
          gmv_per_hour: parseFloat(bMetrics.gmv_per_hour || '0'),
          interaction_rate: parseFloat(bMetrics.interaction_rate || '0'),
          retention_rate: parseFloat(bMetrics.retention_rate || '0'),
          new_fans: bMetrics.new_fans || 0,
          duration_min: bMetrics.duration_min || 0,
          online_peak: bMetrics.online_peak || 0,
          uv_value: parseFloat(bMetrics.uv_value || '0'),
        },
        gmv_change_pct: gmvChange,
      })
    } catch (err) {
      request.log.warn({ err }, 'review/compare query failed')
      return sendOk(reply, { a: null, b: null, gmv_change_pct: 0 })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 上传数据管理配套 API + 复盘增强 API
  // ═══════════════════════════════════════════════════════════════

  // ── GET /api/v1/review/live-rooms ──
  app.get('/api/v1/review/live-rooms', async (request, reply) => {
    try {
      const result = await withRlsContext(request, (client) => client.query(
        'SELECT id, name FROM live_rooms WHERE status = $1 ORDER BY name',
        ['active'],
      ))
      return sendOk(reply, result.rows)
    } catch (err) {
      request.log.warn({ err }, 'review/live-rooms query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/session-info ──
  app.get('/api/v1/review/session-info', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const roomId = q.room_id ? parseInt(q.room_id) : null
      const date = q.date || null

      if (!roomId || !date) {
        return reply.code(400).send({ success: false, message: '缺少 room_id 或 date 参数' })
      }

      const [basic, overview] = await withRlsContext(request, async (client) => {
        const b = await client.query(
          `SELECT * FROM session_live_basic_info WHERE room_id = $1 AND business_date = $2::date`,
          [roomId, date],
        )
        const o = await client.query(
          `SELECT * FROM session_overview_metrics WHERE room_id = $1 AND business_date = $2::date`,
          [roomId, date],
        )
        return [b, o]
      })

      return sendOk(reply, {
        basic_info: basic.rows[0] || null,
        overview: overview.rows[0] || null,
      })
    } catch (err) {
      request.log.warn({ err }, 'review/session-info query failed')
      return sendOk(reply, { basic_info: null, overview: null })
    }
  })

  // ── GET /api/v1/review/products ──
  app.get('/api/v1/review/products', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const roomId = q.room_id ? parseInt(q.room_id) : null
      const date = q.date || null

      if (!roomId || !date) {
        return reply.code(400).send({ success: false, message: '缺少 room_id 或 date 参数' })
      }

      const [products, skus] = await withRlsContext(request, async (client) => {
        const p = await client.query(
          `SELECT * FROM session_product_details WHERE room_id = $1 AND business_date = $2::date ORDER BY product_order`,
          [roomId, date],
        )
        const s = await client.query(
          `SELECT s.* FROM session_product_skus s
           JOIN session_product_details p ON p.id = s.product_id
           WHERE p.room_id = $1 AND p.business_date = $2::date
           ORDER BY p.product_order, s.sku_name`,
          [roomId, date],
        )
        return [p, s]
      })

      // 将 SKU 按 product_id 分组
      const skuMap: Record<number, any[]> = {}
      for (const sku of skus.rows) {
        const pid = sku.product_id
        if (!skuMap[pid]) skuMap[pid] = []
        skuMap[pid].push(sku)
      }

      const productsWithSkus = products.rows.map((p: any) => ({
        ...p,
        skus: skuMap[p.id] || [],
      }))

      return sendOk(reply, productsWithSkus)
    } catch (err) {
      request.log.warn({ err }, 'review/products query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/short-videos ──
  app.get('/api/v1/review/short-videos', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const roomId = q.room_id ? parseInt(q.room_id) : null
      const date = q.date || null

      if (!roomId || !date) {
        return reply.code(400).send({ success: false, message: '缺少 room_id 或 date 参数' })
      }

      const result = await withRlsContext(request, (client) => client.query(
        `SELECT id, session_id, room_id, business_date, video_name, post_time,
                live_entry_impressions::int AS live_entry_impressions,
                traffic_to_live, entry_click_rate, upload_id, created_at, updated_at
         FROM session_short_video_traffic
         WHERE room_id = $1 AND business_date = $2::date
         ORDER BY live_entry_impressions DESC`,
        [roomId, date],
      ))

      return sendOk(reply, result.rows)
    } catch (err) {
      request.log.warn({ err }, 'review/short-videos query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/funnel-data ──
  app.get('/api/v1/review/funnel-data', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const roomId = q.room_id ? parseInt(q.room_id) : null
      const date = q.date || null

      if (!roomId || !date) {
        return reply.code(400).send({ success: false, message: '缺少 room_id 或 date 参数' })
      }

      const result = await withRlsContext(request, (client) => client.query(
        `SELECT exposure_users, enter_users, product_exposure_users,
                product_click_persons, deal_users
         FROM session_overview_metrics
         WHERE room_id = $1 AND business_date = $2::date`,
        [roomId, date],
      ))

      const row = result.rows[0]
      if (!row) {
        return sendOk(reply, { levels: [], hasImportedData: false })
      }

      // 构建漏斗层级
      const levels = [
        { name: '直播间曝光', value: row.exposure_users || 0 },
        { name: '直播间观看', value: row.enter_users || 0 },
        { name: '商品曝光', value: row.product_exposure_users || 0 },
        { name: '商品点击', value: row.product_click_persons || 0 },
        { name: '成交下单', value: row.deal_users || 0 },
      ]

      // 计算转化率和流失率
      const levelsWithRate = levels.map((level, i) => {
        const prev = i > 0 ? levels[i - 1].value : null
        const conversionRate = prev && prev > 0
          ? Number(((level.value / prev) * 100).toFixed(2))
          : null
        const dropRate = prev && prev > 0
          ? Number((((prev - level.value) / prev) * 100).toFixed(2))
          : null
        return { ...level, conversionRate, dropRate }
      })

      return sendOk(reply, { levels: levelsWithRate, hasImportedData: true })
    } catch (err) {
      request.log.warn({ err }, 'review/funnel-data query failed')
      return sendOk(reply, { levels: [], hasImportedData: false })
    }
  })
}