import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { insightRange, range, num, ym, type Align, type Column, type Kpi, type TableBlock } from '../lib/insight-utils.js'

/**
 * platform-dedicated 域拆分（P2-1）：小红书（买手画像 / 蒲公英达人 / 直播流量来源）
 * 原属 routes/platform-dedicated.ts，2026-11-17 拆出。
 */
export async function insightsXhsRoutes(app: FastifyInstance) {
  const guard = { preHandler: [requireAuth] }

  app.get('/api/v1/insights/xiaohongshu/buyer-profile', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT a.id, a.name, COALESCE(a.level, '未评级') AS level,
                  COALESCE(p.followers, 0)::bigint AS followers,
                  COALESCE(p.tags, ARRAY[]::text[]) AS tags,
                  p.join_date
             FROM public.anchors a
             LEFT JOIN public.anchor_profiles p ON p.id = a.id
            WHERE a.status = 1
              AND COALESCE(a.platform_code, a.platform) = 'xiaohongshu'
            ORDER BY followers DESC`,
        )

        // 买手笔记表现（按作者聚合）
        const noteRes = await client.query(
          `SELECT author_name,
                  COUNT(*)::int AS notes,
                  COALESCE(SUM(impressions), 0)::bigint AS impressions,
                  COALESCE(SUM(reads), 0)::bigint AS reads,
                  COALESCE(SUM(likes + collects), 0)::bigint AS engagement,
                  COALESCE(SUM(onsite_gmv + offsite_gmv), 0)::numeric(14,2) AS gmv
             FROM public.xhs_note
            GROUP BY author_name
            ORDER BY gmv DESC`,
        )
        const noteByAuthor = new Map<string, any>()
        for (const r of noteRes.rows) noteByAuthor.set(String(r.author_name || ''), r)

        const totalFollowers = res.rows.reduce((a: number, r: any) => a + num(r.followers), 0)

        return {
          range: { from: '', to: '' },
          kpis: [
            { label: '买手数', value: res.rows.length, accent: 'primary' as const },
            { label: '粉丝总量', value: totalFollowers.toLocaleString('zh-CN') },
            { label: '人均粉丝', value: res.rows.length > 0 ? Math.round(totalFollowers / res.rows.length).toLocaleString('zh-CN') : 0 },
            { label: '有笔记产出', value: noteByAuthor.size },
          ],
          tables: [{
            title: '买手画像与内容表现',
            columns: [
              { key: 'name', label: '买手' },
              { key: 'level', label: '评级' },
              { key: 'followers', label: '粉丝', align: 'right' as Align },
              { key: 'tags', label: '标签' },
              { key: 'notes', label: '笔记数', align: 'right' as Align },
              { key: 'reads', label: '阅读', align: 'right' as Align },
              { key: 'engagement', label: '赞藏', align: 'right' as Align },
              { key: 'gmv', label: '带货 GMV', align: 'right' as Align },
            ],
            rows: res.rows.map((r: any) => {
              const note = noteByAuthor.get(String(r.name || '')) || {}
              return {
                name: r.name,
                level: r.level,
                followers: num(r.followers).toLocaleString('zh-CN'),
                tags: Array.isArray(r.tags) && r.tags.length > 0 ? r.tags.slice(0, 3).join(' / ') : '—',
                notes: num(note.notes),
                reads: num(note.reads).toLocaleString('zh-CN'),
                engagement: num(note.engagement).toLocaleString('zh-CN'),
                gmv: `¥${num(note.gmv).toLocaleString('zh-CN')}`,
              }
            }),
            emptyText: '暂无小红书买手数据',
          }],
          note: '小红书主播即「买手」：其粉丝画像与笔记调性共同决定选品方向，不能按抖快的「主播」逻辑硬套',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/xiaohongshu/buyer-profile failed')
      return sendError(reply, 500, '获取小红书买手画像失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 7. 小红书 · 蒲公英达人合作
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/xiaohongshu/dandelion', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = range(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        const kolRes = await client.query(
          `SELECT id, kol_name, tier, fans_count, category, default_commission_rate, status
             FROM public.dim_kol
            WHERE platform_code = 'xiaohongshu'
            ORDER BY fans_count DESC NULLS LAST`,
        )

        const coopRes = await client.query(
          `SELECT k.kol_name, k.tier,
                  COUNT(*)::int AS coops,
                  COALESCE(SUM(fc.pit_fee), 0)::numeric(14,2) AS pit_fee,
                  COALESCE(SUM(fc.gmv), 0)::numeric(14,2) AS gmv,
                  COALESCE(SUM(fc.commission_amount), 0)::numeric(14,2) AS commission,
                  COALESCE(SUM(fc.refund_amount), 0)::numeric(14,2) AS refund
             FROM public.fact_kol_cooperation fc
             JOIN public.dim_kol k ON k.id = fc.kol_id
            WHERE fc.platform_code = 'xiaohongshu'
              AND fc.publish_date BETWEEN $1::date AND $2::date
            GROUP BY k.kol_name, k.tier
            ORDER BY gmv DESC`,
          [from, to],
        )

        const totalGmv = coopRes.rows.reduce((a: number, r: any) => a + num(r.gmv), 0)
        const totalPit = coopRes.rows.reduce((a: number, r: any) => a + num(r.pit_fee), 0)
        const totalComm = coopRes.rows.reduce((a: number, r: any) => a + num(r.commission), 0)
        const totalCost = totalPit + totalComm

        return {
          range: { from, to },
          kpis: [
            { label: '蒲公英达人', value: kolRes.rows.length, accent: 'primary' as const },
            { label: '合作 GMV', value: `¥${totalGmv.toLocaleString('zh-CN')}` },
            { label: '坑位费 + 佣金', value: `¥${totalCost.toLocaleString('zh-CN')}` },
            { label: '达人 ROI', value: totalCost > 0 ? (totalGmv / totalCost).toFixed(2) : '—', accent: 'success' as const },
          ],
          tables: [
            {
              title: '达人库',
              columns: [
                { key: 'name', label: '达人' },
                { key: 'tier', label: '层级' },
                { key: 'fans', label: '粉丝', align: 'right' as Align },
                { key: 'category', label: '类目' },
                { key: 'rate', label: '默认佣金率', align: 'right' as Align },
                { key: 'status', label: '状态' },
              ],
              rows: kolRes.rows.map((r: any) => ({
                name: r.kol_name,
                tier: r.tier || '—',
                fans: num(r.fans_count).toLocaleString('zh-CN'),
                category: r.category || '—',
                rate: r.default_commission_rate != null ? `${(num(r.default_commission_rate) * 100).toFixed(1)}%` : '—',
                status: r.status || '—',
              })),
              emptyText: '暂无小红书的达人库',
            },
            {
              title: '合作台账',
              columns: [
                { key: 'name', label: '达人' },
                { key: 'coops', label: '合作数', align: 'right' as Align },
                { key: 'pit', label: '坑位费', align: 'right' as Align },
                { key: 'gmv', label: 'GMV', align: 'right' as Align },
                { key: 'commission', label: '佣金', align: 'right' as Align },
                { key: 'refund', label: '退款', align: 'right' as Align },
                { key: 'roi', label: 'ROI', align: 'right' as Align },
              ],
              rows: coopRes.rows.map((r: any) => {
                const cost = num(r.pit_fee) + num(r.commission)
                return {
                  name: r.kol_name,
                  coops: num(r.coops),
                  pit: `¥${num(r.pit_fee).toLocaleString('zh-CN')}`,
                  gmv: `¥${num(r.gmv).toLocaleString('zh-CN')}`,
                  commission: `¥${num(r.commission).toLocaleString('zh-CN')}`,
                  refund: `¥${num(r.refund).toLocaleString('zh-CN')}`,
                  roi: cost > 0 ? (num(r.gmv) / cost).toFixed(2) : '—',
                }
              }),
              emptyText: '所选区间无蒲公英合作记录',
            },
          ],
          note: '小红书达人合作走蒲公英平台，计费为「坑位费 + 佣金」双结构；ROI 应按（坑位费+佣金）而非仅佣金计算',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/xiaohongshu/dandelion failed')
      return sendError(reply, 500, '获取小红书达人数据失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 8. 小红书 · 直播流量来源
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/xiaohongshu/traffic-sources', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = range(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT scm.channel,
                  COUNT(*)::int AS rows,
                  COALESCE(SUM(scm.views), 0)::bigint AS views,
                  COALESCE(SUM(scm.product_clicks), 0)::bigint AS clicks,
                  COALESCE(SUM(scm.orders), 0)::bigint AS orders,
                  COALESCE(SUM(scm.gmv), 0)::numeric(14,2) AS gmv,
                  COALESCE(ROUND(AVG(scm.avg_watch_sec)), 0)::int AS avg_watch
             FROM public.session_channel_metrics scm
             JOIN public.live_sessions s ON s.id = scm.session_id
             JOIN public.live_rooms r ON r.id = s.room_id
            WHERE r.platform_code = 'xiaohongshu'
              AND scm.period_date BETWEEN $1::date AND $2::date
            GROUP BY scm.channel
            ORDER BY gmv DESC`,
          [from, to],
        )

        // 笔记引流（同区间笔记的搜索/推荐曝光）
        const noteRes = await client.query(
          `SELECT COALESCE(SUM(search_impressions), 0)::bigint AS search_impr,
                  COALESCE(SUM(recommend_impressions), 0)::bigint AS rec_impr,
                  COALESCE(SUM(impressions), 0)::bigint AS total_impr
             FROM public.xhs_note
            WHERE biz_date BETWEEN $1::date AND $2::date`,
          [from, to],
        )

        const n = noteRes.rows[0] || {}
        const totalGmv = res.rows.reduce((a: number, r: any) => a + num(r.gmv), 0)

        return {
          range: { from, to },
          kpis: [
            { label: '直播渠道数', value: res.rows.length, accent: 'primary' as const },
            { label: '直播总 GMV', value: `¥${totalGmv.toLocaleString('zh-CN')}` },
            { label: '笔记搜索曝光', value: num(n.search_impr).toLocaleString('zh-CN') },
            { label: '笔记推荐曝光', value: num(n.rec_impr).toLocaleString('zh-CN') },
            { label: '搜索曝光占比', value: (num(n.search_impr) + num(n.rec_impr)) > 0
              ? `${((num(n.search_impr) / (num(n.search_impr) + num(n.rec_impr))) * 100).toFixed(1)}%` : '—' },
          ],
          tables: [{
            title: '直播流量来源',
            columns: [
              { key: 'channel', label: '来源' },
              { key: 'views', label: '观看', align: 'right' as Align },
              { key: 'clicks', label: '商品点击', align: 'right' as Align },
              { key: 'orders', label: '订单', align: 'right' as Align },
              { key: 'gmv', label: 'GMV', align: 'right' as Align },
              { key: 'ratio', label: '占比', align: 'right' as Align },
              { key: 'avgWatch', label: '平均停留(秒)', align: 'right' as Align },
            ],
            rows: res.rows.map((r: any) => ({
              channel: r.channel || '(未命名)',
              views: num(r.views).toLocaleString('zh-CN'),
              clicks: num(r.clicks).toLocaleString('zh-CN'),
              orders: num(r.orders).toLocaleString('zh-CN'),
              gmv: `¥${num(r.gmv).toLocaleString('zh-CN')}`,
              ratio: totalGmv > 0 ? `${((num(r.gmv) / totalGmv) * 100).toFixed(2)}%` : '0%',
              avgWatch: num(r.avg_watch),
            })),
            emptyText: '暂无小红书直播渠道数据',
          }],
          note: '小红书直播流量三源：笔记引流（内容）→ 推荐（算法）→ 搜索（主动意图）。笔记是蓄水池，直播是收割场',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/xiaohongshu/traffic-sources failed')
      return sendError(reply, 500, '获取小红书流量来源失败')
    }
  })

}
