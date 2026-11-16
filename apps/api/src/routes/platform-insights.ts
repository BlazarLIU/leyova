/**
 * platform-insights.ts — 平台专属洞察（S7-B）
 *
 * 老大要求：「每个平台专属的功能还不完善，调研后详细补全」
 * 首批做 4 个最高频的专属视图（每个平台一个，直击该平台独有的业务结构）：
 *
 *   1. 抖音     短视频引流 → 直播承接（三池中最独特的「内容蓄水→直播收割」链路）
 *   2. 淘宝     店铺 × 场次联动（淘宝直播按店铺组织，非按直播间组织）
 *   3. 小红书   笔记 → 直播 → 成交（种草内容与直播的联动，含站内外成交拆分）
 *   4. 视频号   公私域流量拆分（社交裂变与私域占比是视频号最核心的差异）
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
  // 2. 淘宝：店铺 × 场次联动
  //    淘宝直播按店铺组织（不是按直播间），父子订单结构与直播场次需要对齐
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/taobao/shop-session-link', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = dateRange(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        const shopRes = await client.query(
          `SELECT s.id AS shop_id,
                  s.shop_name,
                  COUNT(DISTINCT ls.id)::int                        AS sessions,
                  COALESCE(SUM(ls.gmv), 0)::numeric(14,2)           AS session_gmv,
                  COALESCE(SUM(ls.orders), 0)::int                  AS session_orders,
                  COALESCE(SUM(ls.duration_min), 0)::int            AS total_minutes
             FROM public.dim_shop s
             LEFT JOIN public.live_rooms r ON r.shop_id = s.id
             LEFT JOIN public.live_sessions ls
               ON ls.room_id = r.id
              AND ls.date BETWEEN $1::date AND $2::date
            WHERE s.platform_code = 'taobao' AND s.status = 'active'
            GROUP BY s.id, s.shop_name
            ORDER BY session_gmv DESC`,
          [from, to],
        )

        // 父子订单结构：父单=一次付款，子单=商品×SKU
        const orderRes = await client.query(
          `SELECT biz_date,
                  COUNT(DISTINCT parent_order_id)::int AS parent_orders,
                  COUNT(sub_order_id)::int             AS sub_orders,
                  COALESCE(SUM(pay_amount), 0)::numeric(14,2) AS sub_pay_amount,
                  COALESCE(SUM(refund_amount), 0)::numeric(14,2) AS refund_amount
             FROM public.taobao_order_hierarchy
            WHERE biz_date BETWEEN $1::date AND $2::date
            GROUP BY biz_date
            ORDER BY biz_date ASC`,
          [from, to],
        )

        const totalParent = orderRes.rows.reduce((a: number, r: any) => a + Number(r.parent_orders), 0)
        const totalSub = orderRes.rows.reduce((a: number, r: any) => a + Number(r.sub_orders), 0)

        return {
          range: { from, to },
          summary: {
            shopsWithLive: shopRes.rows.filter((r: any) => Number(r.sessions) > 0).length,
            totalShops: shopRes.rows.length,
            totalSessions: shopRes.rows.reduce((a: number, r: any) => a + Number(r.sessions), 0),
            totalSessionGmv: Number(shopRes.rows.reduce((a: number, r: any) => a + Number(r.session_gmv), 0).toFixed(2)),
            parentOrders: totalParent,
            subOrders: totalSub,
            skuPerOrder: totalParent > 0 ? Number((totalSub / totalParent).toFixed(2)) : 0,
          },
          shops: shopRes.rows.map((r: any) => ({
            shopId: Number(r.shop_id),
            shopName: r.shop_name,
            sessions: Number(r.sessions),
            sessionGmv: Number(r.session_gmv),
            sessionOrders: Number(r.session_orders),
            totalMinutes: Number(r.total_minutes),
            hasLive: Number(r.sessions) > 0,
          })),
          orderTrend: orderRes.rows.map((r: any) => ({
            date: typeof r.biz_date === 'string' ? r.biz_date : new Date(r.biz_date).toISOString().slice(0, 10),
            parentOrders: Number(r.parent_orders),
            subOrders: Number(r.sub_orders),
            payAmount: Number(r.sub_pay_amount),
            refundAmount: Number(r.refund_amount),
          })),
          note: '淘宝直播按店铺组织，非按直播间；skuPerOrder = 子单数/父单数，反映连带率',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/taobao shop-session-link failed')
      return sendError(reply, 500, '获取淘宝店铺场次联动数据失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 3. 小红书：笔记 → 直播 → 成交
  //    小红书的核心是「笔记种草蓄水 → 直播/搜索收割」，且分站内/站外双口径
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/xiaohongshu/note-to-live', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = dateRange(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        const noteRes = await client.query(
          `SELECT note_id, title, note_type, author_name,
                  impressions, reads, likes, collects, comments, shares, follows,
                  search_impressions, recommend_impressions,
                  product_clicks,
                  onsite_gmv, offsite_gmv
             FROM public.xhs_note
            WHERE biz_date BETWEEN $1::date AND $2::date
            ORDER BY (COALESCE(onsite_gmv,0) + COALESCE(offsite_gmv,0)) DESC
            LIMIT 50`,
          [from, to],
        )

        // 笔记互动 → 商品点击 → 成交 的转化链
        const totalImpr = noteRes.rows.reduce((a: number, r: any) => a + Number(r.impressions || 0), 0)
        const totalReads = noteRes.rows.reduce((a: number, r: any) => a + Number(r.reads || 0), 0)
        const totalClicks = noteRes.rows.reduce((a: number, r: any) => a + Number(r.product_clicks || 0), 0)
        const onsite = noteRes.rows.reduce((a: number, r: any) => a + Number(r.onsite_gmv || 0), 0)
        const offsite = noteRes.rows.reduce((a: number, r: any) => a + Number(r.offsite_gmv || 0), 0)
        const searchImpr = noteRes.rows.reduce((a: number, r: any) => a + Number(r.search_impressions || 0), 0)
        const recImpr = noteRes.rows.reduce((a: number, r: any) => a + Number(r.recommend_impressions || 0), 0)
        const totalGmv = onsite + offsite

        // 直播间数据（小红书买手直播）
        const liveRes = await client.query(
          `SELECT COALESCE(SUM(ls.gmv), 0)::numeric(14,2) AS live_gmv,
                  COUNT(DISTINCT ls.id)::int              AS live_sessions
             FROM public.live_sessions ls
             JOIN public.live_rooms r ON r.id = ls.room_id
            WHERE r.platform_code = 'xiaohongshu'
              AND ls.date BETWEEN $1::date AND $2::date`,
          [from, to],
        )

        return {
          range: { from, to },
          summary: {
            noteCount: noteRes.rows.length,
            impressions: totalImpr,
            reads: totalReads,
            readRate: totalImpr > 0 ? Number(((totalReads / totalImpr) * 100).toFixed(2)) : 0,
            productClicks: totalClicks,
            clickRate: totalReads > 0 ? Number(((totalClicks / totalReads) * 100).toFixed(2)) : 0,
            onsiteGmv: Number(onsite.toFixed(2)),
            offsiteGmv: Number(offsite.toFixed(2)),
            totalGmv: Number(totalGmv.toFixed(2)),
            offsiteRatio: totalGmv > 0 ? Number(((offsite / totalGmv) * 100).toFixed(2)) : 0,
            searchImpressionShare: (searchImpr + recImpr) > 0
              ? Number(((searchImpr / (searchImpr + recImpr)) * 100).toFixed(2)) : 0,
            liveSessions: Number(liveRes.rows[0]?.live_sessions || 0),
            liveGmv: Number(liveRes.rows[0]?.live_gmv || 0),
          },
          notes: noteRes.rows.map((r: any) => ({
            noteId: r.note_id,
            title: r.title,
            noteType: r.note_type,
            author: r.author_name,
            impressions: Number(r.impressions || 0),
            reads: Number(r.reads || 0),
            likes: Number(r.likes || 0),
            collects: Number(r.collects || 0),
            productClicks: Number(r.product_clicks || 0),
            onsiteGmv: Number(r.onsite_gmv || 0),
            offsiteGmv: Number(r.offsite_gmv || 0),
          })),
          note: '小红书核心链路：笔记曝光 → 阅读 → 商品点击 → 站内/站外成交；offsiteRatio 越高说明种草外溢越强',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/xiaohongshu note-to-live failed')
      return sendError(reply, 500, '获取小红书笔记直播联动数据失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 4. 视频号：公私域流量拆分
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
