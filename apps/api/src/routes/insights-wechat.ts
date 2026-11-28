import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { insightRange, range, num, ym, type Align, type Column, type Kpi, type TableBlock } from '../lib/insight-utils.js'

/**
 * platform-dedicated 域拆分（P2-1）：视频号（全域带货者 / 短视频与公众号图文）
 * 原属 routes/platform-dedicated.ts，2026-11-17 拆出。
 */
export async function insightsWechatRoutes(app: FastifyInstance) {
  const guard = { preHandler: [requireAuth] }

  app.get('/api/v1/insights/wechat/affiliate', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = range(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT scm.channel,
                  COALESCE(SUM(scm.views), 0)::bigint AS views,
                  COALESCE(SUM(scm.new_fans), 0)::int AS new_fans,
                  COALESCE(SUM(scm.orders), 0)::bigint AS orders,
                  COALESCE(SUM(scm.gmv), 0)::numeric(14,2) AS gmv
             FROM public.session_channel_metrics scm
             JOIN public.live_sessions s ON s.id = scm.session_id
             JOIN public.live_rooms r ON r.id = s.room_id
            WHERE r.platform_code = 'wechat'
              AND scm.period_date BETWEEN $1::date AND $2::date
            GROUP BY scm.channel
            ORDER BY gmv DESC`,
          [from, to],
        )

        // 全域场景归类：直播 / 短视频 / 公众号 / 社群
        const scene = (ch: string): string => {
          const c = (ch || '').toLowerCase()
          if (c.includes('直播') || c.includes('推荐') || c.includes('点赞')) return '视频号直播'
          if (c.includes('社群') || c.includes('朋友圈')) return '社群/朋友圈'
          if (c.includes('公众号')) return '公众号图文'
          return '其他'
        }
        const agg = new Map<string, { views: number; fans: number; orders: number; gmv: number }>()
        for (const r of res.rows) {
          const k = scene(r.channel)
          const cur = agg.get(k) || { views: 0, fans: 0, orders: 0, gmv: 0 }
          cur.views += num(r.views); cur.fans += num(r.new_fans)
          cur.orders += num(r.orders); cur.gmv += num(r.gmv)
          agg.set(k, cur)
        }
        const totalGmv = Array.from(agg.values()).reduce((a, b) => a + b.gmv, 0)

        return {
          range: { from, to },
          kpis: [
            { label: '全域总 GMV', value: `¥${totalGmv.toLocaleString('zh-CN')}`, accent: 'primary' as const },
            { label: '场景数', value: agg.size },
            { label: '新增粉丝', value: Array.from(agg.values()).reduce((a, b) => a + b.fans, 0).toLocaleString('zh-CN') },
            { label: '总订单', value: Array.from(agg.values()).reduce((a, b) => a + b.orders, 0).toLocaleString('zh-CN') },
          ],
          tables: [{
            title: '全域带货场景拆分',
            columns: [
              { key: 'scene', label: '场景' },
              { key: 'views', label: '观看', align: 'right' as Align },
              { key: 'fans', label: '新增粉丝', align: 'right' as Align },
              { key: 'orders', label: '订单', align: 'right' as Align },
              { key: 'gmv', label: 'GMV', align: 'right' as Align },
              { key: 'ratio', label: '占比', align: 'right' as Align },
            ],
            rows: Array.from(agg.entries()).map(([k, v]) => ({
              scene: k,
              views: v.views.toLocaleString('zh-CN'),
              fans: v.fans.toLocaleString('zh-CN'),
              orders: v.orders.toLocaleString('zh-CN'),
              gmv: `¥${v.gmv.toLocaleString('zh-CN')}`,
              ratio: totalGmv > 0 ? `${((v.gmv / totalGmv) * 100).toFixed(2)}%` : '0%',
            })),
            emptyText: '暂无视频号全域数据',
          }],
          note: '视频号「微信小店带货者」可在视频号/公众号/社群/朋友圈全域带货；只统计直播占比会低估视频号的真实体量',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/wechat/affiliate failed')
      return sendError(reply, 500, '获取视频号全域带货数据失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 10. 视频号 · 短视频与公众号图文
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/wechat/content', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = range(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT COALESCE(target_platforms, ARRAY[platform_code]::varchar[]) AS platforms,
                  stage,
                  COUNT(*)::int AS items,
                  COUNT(*) FILTER (WHERE published_at IS NOT NULL)::int AS published,
                  COUNT(*) FILTER (WHERE compliance_checked)::int AS compliant
             FROM public.content_schedules
            WHERE platform_code = 'wechat'
              AND planned_publish_at BETWEEN $1::date AND $2::date + interval '1 day'
            GROUP BY COALESCE(target_platforms, ARRAY[platform_code]::varchar[]), stage
            ORDER BY items DESC`,
          [from, to],
        ).catch(async () => {
          return client.query(
            `SELECT stage,
                    COUNT(*)::int AS items,
                    COUNT(*) FILTER (WHERE published_at IS NOT NULL)::int AS published,
                    COUNT(*) FILTER (WHERE compliance_checked)::int AS compliant
               FROM public.content_schedules
              WHERE platform_code = 'wechat'
                AND planned_publish_at BETWEEN $1::date AND $2::date + interval '1 day'
              GROUP BY stage ORDER BY items DESC`,
            [from, to],
          )
        })

        const listRes = await client.query(
          `SELECT title, stage, topic_category, planned_publish_at, published_at,
                  compliance_checked, script_summary
             FROM public.content_schedules
            WHERE platform_code = 'wechat'
              AND planned_publish_at BETWEEN $1::date AND $2::date + interval '1 day'
            ORDER BY planned_publish_at DESC
            LIMIT 50`,
          [from, to],
        ).catch(() => ({ rows: [] as any[] }))

        const total = res.rows.reduce((a: number, r: any) => a + num(r.items), 0)
        const published = res.rows.reduce((a: number, r: any) => a + num(r.published), 0)
        const compliant = res.rows.reduce((a: number, r: any) => a + num(r.compliant), 0)

        return {
          range: { from, to },
          kpis: [
            { label: '内容条目', value: total, accent: 'primary' as const },
            { label: '已发布', value: published, hint: total > 0 ? `${((published / total) * 100).toFixed(0)}%` : '0%' },
            { label: '合规已检', value: compliant, hint: total > 0 ? `${((compliant / total) * 100).toFixed(0)}%` : '0%', accent: compliant < total ? 'warn' as const : 'success' as const },
          ],
          tables: [
            {
              title: '按阶段汇总',
              columns: [
                { key: 'stage', label: '阶段' },
                { key: 'items', label: '条目', align: 'right' as Align },
                { key: 'published', label: '已发布', align: 'right' as Align },
                { key: 'compliant', label: '合规已检', align: 'right' as Align },
              ],
              rows: res.rows.map((r: any) => ({
                stage: r.stage || '—',
                items: num(r.items),
                published: num(r.published),
                compliant: num(r.compliant),
              })),
              emptyText: '所选区间无视频号内容排产',
            },
            {
              title: '内容明细',
              columns: [
                { key: 'title', label: '标题' },
                { key: 'stage', label: '阶段' },
                { key: 'topic', label: '话题类目' },
                { key: 'planned', label: '计划发布' },
                { key: 'published', label: '实际发布' },
                { key: 'compliance', label: '合规' },
              ],
              rows: listRes.rows.map((r: any) => ({
                title: r.title || '(未命名)',
                stage: r.stage || '—',
                topic: r.topic_category || '—',
                planned: r.planned_publish_at ? ym(r.planned_publish_at) : '—',
                published: r.published_at ? ym(r.published_at) : '未发布',
                compliance: r.compliance_checked ? '已检' : '未检',
              })),
              emptyText: '暂无内容明细',
            },
          ],
          note: '视频号内容生态 = 短视频 + 公众号图文，两者都能为直播蓄水；合规已检率是红线指标',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/wechat/content failed')
      return sendError(reply, 500, '获取视频号内容数据失败')
    }
  })}
