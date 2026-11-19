import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { insightRange, range, num, ym, type Align, type Column, type Kpi, type TableBlock } from '../lib/insight-utils.js'

/**
 * platform-dedicated 域拆分（P2-1）：抖音三池统一调度
 * 原属 routes/platform-dedicated.ts，2026-11-17 拆出。
 */
export async function insightsDouyinRoutes(app: FastifyInstance) {
  const guard = { preHandler: [requireAuth] }

  app.get('/api/v1/insights/douyin/three-pools', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = range(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        // 三池：直播 / 短视频 / 商城（货架）
        const poolRes = await client.query(
          `SELECT
             -- 互斥匹配：渠道名如「直播推荐」会同时命中「直播」与「推荐」，必须按优先级排他，
             -- 否则三池占比合计会超过 100%
             COALESCE(SUM(CASE WHEN channel_name LIKE '%直播%' THEN gmv ELSE 0 END), 0)::numeric(14,2) AS live_gmv,
             COALESCE(SUM(CASE WHEN channel_name NOT LIKE '%直播%' AND channel_name LIKE '%短视频%' THEN gmv ELSE 0 END), 0)::numeric(14,2) AS video_gmv,
             COALESCE(SUM(CASE WHEN channel_name NOT LIKE '%直播%' AND channel_name NOT LIKE '%短视频%' THEN gmv ELSE 0 END), 0)::numeric(14,2) AS mall_gmv,
             COALESCE(SUM(gmv), 0)::numeric(14,2) AS total_gmv
           FROM public.v_fact_trade_default
          WHERE platform_code = 'douyin'
            AND biz_date BETWEEN $1::date AND $2::date`,
          [from, to],
        )
        const p = poolRes.rows[0] || {}
        const total = num(p.total_gmv)

        // 场次级直播数据
        const sessRes = await client.query(
          `SELECT COUNT(DISTINCT ls.id)::int AS sessions,
                  COALESCE(SUM(lb.payment_amount), 0)::numeric(14,2) AS live_gmv,
                  COALESCE(SUM(lb.live_duration_min), 0)::int AS minutes
             FROM public.live_sessions ls
             JOIN public.live_rooms r ON r.id = ls.room_id
             LEFT JOIN public.session_live_basic_info lb ON lb.session_id = ls.id
            WHERE r.platform_code = 'douyin'
              AND ls.date BETWEEN $1::date AND $2::date`,
          [from, to],
        )

        // 短视频引流
        const svRes = await client.query(
          `SELECT COUNT(DISTINCT sv.video_name)::int AS videos,
                  COALESCE(SUM(sv.traffic_to_live), 0)::bigint AS entries
             FROM public.session_short_video_traffic sv
             JOIN public.live_sessions s ON s.id = sv.session_id
             JOIN public.live_rooms r ON r.id = s.room_id
            WHERE r.platform_code = 'douyin'
              AND sv.business_date BETWEEN $1::date AND $2::date`,
          [from, to],
        )

        const pct = (v: number) => (total > 0 ? Number(((v / total) * 100).toFixed(2)) : 0)

        return {
          range: { from, to },
          kpis: [
            { label: '直播池 GMV', value: `¥${num(p.live_gmv).toLocaleString()}`, hint: `${pct(num(p.live_gmv))}%`, accent: 'primary' as const },
            { label: '短视频池 GMV', value: `¥${num(p.video_gmv).toLocaleString()}`, hint: `${pct(num(p.video_gmv))}%` },
            { label: '商城池 GMV', value: `¥${num(p.mall_gmv).toLocaleString()}`, hint: `${pct(num(p.mall_gmv))}%` },
            { label: '场次数', value: num(sessRes.rows[0]?.sessions), hint: `${num(sessRes.rows[0]?.minutes)} 分钟` },
            { label: '引流短视频', value: num(svRes.rows[0]?.videos), hint: `进房 ${num(svRes.rows[0]?.entries).toLocaleString()}` },
          ],
          tables: [{
            title: '三池结构',
            columns: [
              { key: 'pool', label: '流量池' },
              { key: 'gmv', label: 'GMV', align: 'right' as Align },
              { key: 'ratio', label: '占比', align: 'right' as Align },
              { key: 'role', label: '职能' },
            ],
            rows: [
              { pool: '直播池', gmv: `¥${num(p.live_gmv).toLocaleString()}`, ratio: `${pct(num(p.live_gmv))}%`, role: '收割：承接停留与成交' },
              { pool: '短视频池', gmv: `¥${num(p.video_gmv).toLocaleString()}`, ratio: `${pct(num(p.video_gmv))}%`, role: '蓄水：内容种草与引流' },
              { pool: '商城池', gmv: `¥${num(p.mall_gmv).toLocaleString()}`, ratio: `${pct(num(p.mall_gmv))}%`, role: '承接：搜索与推荐的长尾转化' },
            ],
          }],
          note: '抖音三池需统一调度：短视频蓄水、直播收割、商城承接长尾。任一池独大都会导致增长见顶',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/douyin/three-pools failed')
      return sendError(reply, 500, '获取抖音三池数据失败')
    }
  })

}
