import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { computeRefundRatePct } from '../services/metrics-caliber.js'

/**
 * review 域拆分（P2-1）：渠道 / 主播 / 漏斗 / 对比
 * 原属 routes/review.ts，2026-11-17 拆出。
 */
export async function reviewAnalysisRoutes(app: FastifyInstance) {
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

      // P1-B15：修复参数绑定错位
      //
      // 审计断点：原实现 liveWhereClause 用 $1..$n、samWhereClause 也用 $1..$m，
      //   但 query 只传了 `params`（live 分支的），`samParams` 构造后从未传入。
      //   → 带日期/主播过滤时，session_anchor_metrics 分支的参数会错位引用。
      //
      // 修复：把两个分支的参数合并成一个数组，sam 分支编号从 params.length 之后开始。
      const samConditions: string[] = []
      const samParams: any[] = []
      let samIdx = params.length + 1   // 关键：编号接着 live 分支往后排
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
      const allParams = [...params, ...samParams]

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
        // P1-B15：必须传合并后的参数（live 分支 + sam 分支），否则 sam 分支参数错位
        allParams
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
            await client.query('ROLLBACK TO SAVEPOINT sp_rev_imp').catch(() => { })
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
            await client.query('ROLLBACK TO SAVEPOINT sp_rev_imp2').catch(() => { })
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

}
