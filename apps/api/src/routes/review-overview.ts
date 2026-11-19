import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { computeRefundRatePct } from '../services/metrics-caliber.js'

/**
 * review 域拆分（P2-1）：复盘总览
 * 原属 routes/review.ts，2026-11-17 拆出。
 */
export async function reviewOverviewRoutes(app: FastifyInstance) {
  // ── GET /api/v1/review/overview ──
  app.get('/api/v1/review/overview', async (request, reply) => {
    // P1-B2：加 platform 维度
    // 审计断点：review.ts 全文 grep platform_code 零命中 → 老板问「抖音为什么跌 15%」
    //           系统物理上答不出来（只有全局数字，无法按平台下钻）。
    const q = request.query as {
      session_id?: string; start_date?: string; end_date?: string; anchor_id?: string
      platform?: string
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

      // ── 导入数据分支持久化条件（含平台过滤，P1-B2）──
      // session_live_basic_info 无 platform_code 列，必须经 live_rooms 关联
      const importedParams: any[] = []
      const importedConds: string[] = []
      let platformRoomJoin = ''

      if (q.platform) {
        importedParams.push(q.platform)
        const pIdx = importedParams.length
        platformRoomJoin = ` JOIN live_rooms lr ON lr.id = lb.room_id AND lr.platform_code = $${pIdx}::text `
      }
      if (q.start_date) {
        importedParams.push(q.start_date)
        importedConds.push(`lb.business_date >= $${importedParams.length}::date`)
      }
      if (q.end_date) {
        importedParams.push(q.end_date)
        importedConds.push(`lb.business_date <= $${importedParams.length}::date`)
      }

      const importedWhere = importedConds.length > 0 ? `WHERE ${importedConds.join(' AND ')}` : ''

      const rlsResult = await withRlsContext(request, async (client) => {
        const overall = await client.query(
          `SELECT
             COALESCE(SUM(lb.payment_amount), 0) AS gmv,
             COALESCE(SUM(om.deal_users), 0)::int AS orders,
             -- GPM 是比率（每千次观看成交额），必须 AVG 不能 SUM
             COALESCE(AVG(lb.gpm), 0) AS gpm,
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
           ${platformRoomJoin}
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
            orders_change: prev.orders > 0 ? Math.round((((k.orders || 0) - prev.orders) / prev.orders) * 10000) / 100 : 0,
            views_change: prev.views > 0 ? Math.round((((k.views || 0) - prev.views) / prev.views) * 10000) / 100 : 0,
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
          await client.query('ROLLBACK TO SAVEPOINT sp_rev_ch').catch(() => { })
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
        // P1-B5：主播归因
        //
        // 审计断点：此前硬编码 `const topAnchors = { rows: [] }`，注释自认
        //   「导入数据无主播归属，主播 TOP3 为空」→ 老板问「哪个主播带得好」系统答不出来。
        //
        // 修复：改从 session_staff_assignments（S4 建立的场次×岗位×人员模型）取主播，
        //   回退到 live_sessions.anchor_id（老数据只有 anchor_id，没有多岗位表记录）。
        const anchorRes = await client.query(
          `WITH sess AS (
             SELECT ls.id, ls.date, COALESCE(ls.duration_min, 0) AS duration_min, COALESCE(ls.gmv, 0) AS gmv,
                    COALESCE(ls.anchor_id, ssa.staff_id) AS anchor_id
               FROM live_sessions ls
               LEFT JOIN session_staff_assignments ssa
                      ON ssa.session_id = ls.id AND ssa.role_code = 'anchor'
              WHERE ls.date >= $1::date AND ls.date <= $2::date
                AND ls.status = 'completed'
           )
           SELECT a.anchor_id,
                  COALESCE(an.name, '未知主播') AS anchor_name,
                  SUM(a.gmv)::numeric AS gmv,
                  SUM(a.duration_min)::int AS duration_min,
                  CASE WHEN SUM(a.duration_min) > 0
                       THEN ROUND(SUM(a.gmv) / (SUM(a.duration_min) / 60.0), 2)
                       ELSE 0 END AS gmv_per_hour
             FROM sess a
             LEFT JOIN anchors an ON an.id = a.anchor_id
            WHERE a.anchor_id IS NOT NULL
            GROUP BY a.anchor_id, an.name
            -- 按「小时产出」排序：场次时长不同，绝对 GMV 无法横向比较主播效率
            ORDER BY gmv_per_hour DESC
            LIMIT 3`,
          [q.start_date || '1970-01-01', q.end_date || '2999-12-31'],
        )

        return { kpi: k, comparison: comp, topChannels: channels, avgResult: avgRes, topAnchors: anchorRes }
      })
      const { kpi, comparison, topChannels, avgResult } = rlsResult

      const topAnchors = { rows: (rlsResult as any).topAnchors?.rows ?? [] }
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
          refund_rate: computeRefundRatePct(
            parseFloat(kpi.refund_amount || '0'),
            parseFloat(kpi.gmv || '0'),
            2,
          ),
        },
        comparison,
        top_channels: topChannels,
        top_anchors: topAnchors.rows.map((r: any) => ({
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

}
