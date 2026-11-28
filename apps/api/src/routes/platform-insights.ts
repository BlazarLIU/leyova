/**
 * platform-insights.ts — 平台专属洞察（S7-B）
 *
 * 老大要求：「每个平台专属的功能还不完善，调研后详细补全」
 * 首批做专属视图（直击该平台独有的业务结构）：
 *
 *   1. 抖音     短视频引流 → 直播承接（三池中最独特的「内容蓄水→直播收割」链路）
 *   2. 视频号   公私域流量拆分（社交裂变与私域占比是视频号最核心的差异）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'

function dateRange(q: { from?: string; to?: string }, defaultDays = 30) {
  const to = q.to || new Date().toISOString().slice(0, 10)
  const from = q.from || new Date(Date.now() - defaultDays * 86400_000).toISOString().slice(0, 10)
  return { from, to }
}

export async function platformInsightsRoutes(app: FastifyInstance) {
  // ════════════════════════════════════════════════════════════
  // 1. 抖音：短视频引流 → 直播承接
  //    抖音三池结构里，短视频负责蓄水、直播负责收割，通用场次页看不出这个链路
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/douyin/short-video-funnel', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = dateRange(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        // 短视频引流明细（按视频聚合）
        const videoRes = await client.query(
          `SELECT sv.video_name,
                  COUNT(DISTINCT sv.session_id)::int             AS session_count,
                  COALESCE(SUM(sv.live_entry_impressions), 0)::bigint AS impressions,
                  COALESCE(SUM(sv.traffic_to_live), 0)::bigint    AS entries,
                  COALESCE(ROUND(AVG(sv.entry_click_rate)::numeric, 2), 0) AS click_rate,
                  MAX(sv.post_time)                               AS last_post
             FROM public.session_short_video_traffic sv
             JOIN public.live_sessions s ON s.id = sv.session_id
             JOIN public.live_rooms r ON r.id = s.room_id
            WHERE r.platform_code = 'douyin'
              AND sv.business_date BETWEEN $1::date AND $2::date
            GROUP BY sv.video_name
            ORDER BY entries DESC
            LIMIT 50`,
          [from, to],
        )

        // 按日趋势：短视频引流 vs 直播承接 GMV
        const trendRes = await client.query(
          `SELECT sv.business_date AS biz_date,
                  COALESCE(SUM(sv.traffic_to_live), 0)::bigint AS video_entries,
                  COALESCE((
                    SELECT SUM(lb.payment_amount)
                      FROM public.session_live_basic_info lb
                      JOIN public.live_rooms rr ON rr.id = lb.room_id
                     WHERE rr.platform_code = 'douyin' AND lb.business_date = sv.business_date
                  ), 0)::numeric(14,2) AS live_gmv
             FROM public.session_short_video_traffic sv
             JOIN public.live_sessions s ON s.id = sv.session_id
             JOIN public.live_rooms r ON r.id = s.room_id
            WHERE r.platform_code = 'douyin'
              AND sv.business_date BETWEEN $1::date AND $2::date
            GROUP BY sv.business_date
            ORDER BY sv.business_date ASC`,
          [from, to],
        )

        const totalEntries = videoRes.rows.reduce((a: number, r: any) => a + Number(r.entries), 0)
        const totalImpressions = videoRes.rows.reduce((a: number, r: any) => a + Number(r.impressions), 0)
        const totalGmv = trendRes.rows.reduce((a: number, r: any) => a + Number(r.live_gmv), 0)

        return {
          range: { from, to },
          summary: {
            videoCount: videoRes.rows.length,
            totalImpressions,
            totalEntries,
            entryRate: totalImpressions > 0 ? Number(((totalEntries / totalImpressions) * 100).toFixed(2)) : 0,
            liveGmv: Number(totalGmv.toFixed(2)),
            gmvPerEntry: totalEntries > 0 ? Number((totalGmv / totalEntries).toFixed(2)) : 0,
          },
          videos: videoRes.rows.map((r: any) => ({
            videoName: r.video_name,
            sessionCount: Number(r.session_count),
            impressions: Number(r.impressions),
            entries: Number(r.entries),
            clickRate: Number(r.click_rate),
            lastPost: r.last_post,
          })),
          trend: trendRes.rows.map((r: any) => ({
            date: typeof r.biz_date === 'string' ? r.biz_date : new Date(r.biz_date).toISOString().slice(0, 10),
            videoEntries: Number(r.video_entries),
            liveGmv: Number(r.live_gmv),
          })),
          note: '抖音三池中，短视频负责蓄水、直播负责收割；gmvPerEntry 表示每个短视频引流来的观众贡献的直播 GMV',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/douyin short-video-funnel failed')
      return sendError(reply, 500, '获取抖音短视频引流数据失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 2. 视频号：公私域流量拆分
  //    视频号最独特的是「朋友点赞/社群/朋友圈」等社交裂变流量，必须与公域推荐分开看
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/wechat/private-public-split', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = dateRange(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        const channelRes = await client.query(
          `SELECT sc.channel,
                  COUNT(DISTINCT sc.session_id)::int                 AS sessions,
                  COALESCE(SUM(sc.impressions), 0)::bigint            AS impressions,
                  COALESCE(SUM(sc.views), 0)::bigint                  AS views,
                  COALESCE(SUM(sc.product_clicks), 0)::bigint         AS product_clicks,
                  COALESCE(SUM(sc.orders), 0)::bigint                 AS orders,
                  COALESCE(SUM(sc.gmv), 0)::numeric(14,2)             AS gmv,
                  COALESCE(SUM(sc.new_fans), 0)::int                  AS new_fans,
                  COALESCE(ROUND(AVG(sc.avg_watch_sec)), 0)::int      AS avg_watch_sec
             FROM public.session_channel_metrics sc
             JOIN public.live_sessions s ON s.id = sc.session_id
             JOIN public.live_rooms r ON r.id = s.room_id
            WHERE r.platform_code = 'wechat'
              AND sc.period_date BETWEEN $1::date AND $2::date
            GROUP BY sc.channel
            ORDER BY gmv DESC`,
          [from, to],
        )

        // 公私域归类：视频号推荐=公域，朋友圈/社群/公众号=私域，朋友点赞=社交裂变
        const classify = (ch: string): 'public' | 'private' | 'social' => {
          const c = (ch || '').toLowerCase()
          if (c.includes('推荐') || c.includes('直播广场') || c.includes('发现')) return 'public'
          if (c.includes('朋友圈') || c.includes('社群') || c.includes('公众号') || c.includes('私域')) return 'private'
          if (c.includes('朋友') || c.includes('点赞') || c.includes('分享')) return 'social'
          return 'public'
        }

        const buckets = { public: { gmv: 0, views: 0, sessions: 0, channels: [] as string[] },
                          private: { gmv: 0, views: 0, sessions: 0, channels: [] as string[] },
                          social: { gmv: 0, views: 0, sessions: 0, channels: [] as string[] } }

        for (const r of channelRes.rows) {
          const k = classify(r.channel)
          buckets[k].gmv += Number(r.gmv || 0)
          buckets[k].views += Number(r.views || 0)
          buckets[k].sessions += Number(r.sessions || 0)
          if (r.channel) buckets[k].channels.push(r.channel)
        }

        const totalGmv = buckets.public.gmv + buckets.private.gmv + buckets.social.gmv
        const totalViews = buckets.public.views + buckets.private.views + buckets.social.views
        const pct = (n: number, total: number) => (total > 0 ? Number(((n / total) * 100).toFixed(2)) : 0)

        return {
          range: { from, to },
          summary: {
            totalGmv: Number(totalGmv.toFixed(2)),
            totalViews: totalViews,
            publicGmvPct: pct(buckets.public.gmv, totalGmv),
            privateGmvPct: pct(buckets.private.gmv, totalGmv),
            socialGmvPct: pct(buckets.social.gmv, totalGmv),
            publicViewPct: pct(buckets.public.views, totalViews),
            privateViewPct: pct(buckets.private.views, totalViews),
            socialViewPct: pct(buckets.social.views, totalViews),
          },
          buckets: {
            public: { gmv: Number(buckets.public.gmv.toFixed(2)), views: buckets.public.views, sessions: buckets.public.sessions, channels: buckets.public.channels },
            private: { gmv: Number(buckets.private.gmv.toFixed(2)), views: buckets.private.views, sessions: buckets.private.sessions, channels: buckets.private.channels },
            social: { gmv: Number(buckets.social.gmv.toFixed(2)), views: buckets.social.views, sessions: buckets.social.sessions, channels: buckets.social.channels },
          },
          channels: channelRes.rows.map((r: any) => ({
            channel: r.channel,
            bucket: classify(r.channel),
            sessions: Number(r.sessions),
            impressions: Number(r.impressions),
            views: Number(r.views),
            productClicks: Number(r.product_clicks),
            orders: Number(r.orders),
            gmv: Number(r.gmv),
            newFans: Number(r.new_fans),
            avgWatchSec: Number(r.avg_watch_sec),
          })),
          note: '视频号公私域混合度最高：social（朋友点赞/分享）是视频号独有流量，private 含朋友圈/社群/公众号',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/wechat private-public-split failed')
      return sendError(reply, 500, '获取视频号公私域拆分数据失败')
    }
  })
}
