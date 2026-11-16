/**
 * platform-dedicated.ts — 平台专属洞察（S7-B 第二批：剩余 10 条）
 *
 * 统一返回结构，前端用一个通用渲染器承载：
 *   { range, kpis[], tables[], note }
 *
 * 10 个专属视图（对应 platform_capability_matrix.needs_dedicated_page 的剩余标记）：
 *   抖音   三池统一调度（直播/短视频/商城）
 *   淘宝   直播三源流量（直播推荐/搜索/店铺自运营）
 *   天猫   品牌×场次视图 / 五层抵扣规则 / 直播与官方立减联动
 *   小红书 买手画像 / 蒲公英达人合作 / 直播流量来源
 *   视频号 全域带货者 / 短视频与公众号图文
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'

type Align = 'left' | 'right' | 'center'
interface Column { key: string; label: string; align?: Align }
interface Kpi { label: string; value: string | number; hint?: string; accent?: 'primary' | 'success' | 'warn' | 'danger' }
interface TableBlock { title: string; columns: Column[]; rows: Record<string, unknown>[]; emptyText?: string }

function range(q: { from?: string; to?: string }, defaultDays = 30) {
  const to = q.to || new Date().toISOString().slice(0, 10)
  const from = q.from || new Date(Date.now() - defaultDays * 86400_000).toISOString().slice(0, 10)
  return { from, to }
}

const num = (v: unknown) => Number(v ?? 0)
const ym = (v: unknown) => {
  if (!v) return ''
  return typeof v === 'string' ? v.slice(0, 10) : new Date(v as string).toISOString().slice(0, 10)
}

export async function platformDedicatedRoutes(app: FastifyInstance) {
  const guard = { preHandler: [requireAuth] }

  // ════════════════════════════════════════════════════════════
  // 1. 抖音 · 三池统一调度
  // ════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════
  // 2. 淘宝 · 直播三源流量
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/taobao/three-sources', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = range(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT scm.channel,
                  COUNT(*)::int AS rows,
                  COALESCE(SUM(scm.views), 0)::bigint AS views,
                  COALESCE(SUM(scm.product_clicks), 0)::bigint AS clicks,
                  COALESCE(SUM(scm.orders), 0)::bigint AS orders,
                  COALESCE(SUM(scm.gmv), 0)::numeric(14,2) AS gmv
             FROM public.session_channel_metrics scm
             JOIN public.live_sessions s ON s.id = scm.session_id
             JOIN public.live_rooms r ON r.id = s.room_id
            WHERE r.platform_code IN ('taobao','tmall')
              AND scm.period_date BETWEEN $1::date AND $2::date
            GROUP BY scm.channel
            ORDER BY gmv DESC`,
          [from, to],
        )

        // 归类三源
        const classify = (ch: string): string => {
          const c = (ch || '').toLowerCase()
          if (c.includes('直播') || c.includes('推荐')) return '直播推荐'
          if (c.includes('搜索') || c.includes('关键词')) return '搜索'
          return '店铺自运营'
        }
        const agg = new Map<string, { views: number; clicks: number; orders: number; gmv: number }>()
        for (const r of res.rows) {
          const k = classify(r.channel)
          const cur = agg.get(k) || { views: 0, clicks: 0, orders: 0, gmv: 0 }
          cur.views += num(r.views); cur.clicks += num(r.clicks)
          cur.orders += num(r.orders); cur.gmv += num(r.gmv)
          agg.set(k, cur)
        }
        const totalGmv = Array.from(agg.values()).reduce((a, b) => a + b.gmv, 0)

        return {
          range: { from, to },
          kpis: [
            { label: '三源总 GMV', value: `¥${totalGmv.toLocaleString('zh-CN')}`, accent: 'primary' as const },
            { label: '渠道数', value: res.rows.length },
            ...Array.from(agg.entries()).slice(0, 3).map(([k, v]) => ({
              label: k,
              value: `¥${v.gmv.toLocaleString('zh-CN')}`,
              hint: totalGmv > 0 ? `${((v.gmv / totalGmv) * 100).toFixed(1)}%` : '0%',
            })),
          ],
          tables: [
            {
              title: '三源汇总',
              columns: [
                { key: 'source', label: '流量源' },
                { key: 'views', label: '观看', align: 'right' as Align },
                { key: 'clicks', label: '商品点击', align: 'right' as Align },
                { key: 'orders', label: '订单', align: 'right' as Align },
                { key: 'gmv', label: 'GMV', align: 'right' as Align },
                { key: 'ratio', label: '占比', align: 'right' as Align },
              ],
              rows: Array.from(agg.entries()).map(([k, v]) => ({
                source: k,
                views: v.views.toLocaleString('zh-CN'),
                clicks: v.clicks.toLocaleString('zh-CN'),
                orders: v.orders.toLocaleString('zh-CN'),
                gmv: `¥${v.gmv.toLocaleString('zh-CN')}`,
                ratio: totalGmv > 0 ? `${((v.gmv / totalGmv) * 100).toFixed(2)}%` : '0%',
              })),
              emptyText: '暂无淘宝/天猫渠道数据',
            },
            {
              title: '原始渠道明细',
              columns: [
                { key: 'channel', label: '渠道' },
                { key: 'source', label: '归类' },
                { key: 'views', label: '观看', align: 'right' as Align },
                { key: 'gmv', label: 'GMV', align: 'right' as Align },
              ],
              rows: res.rows.map((r: any) => ({
                channel: r.channel || '(未命名)',
                source: classify(r.channel),
                views: num(r.views).toLocaleString('zh-CN'),
                gmv: `¥${num(r.gmv).toLocaleString('zh-CN')}`,
              })),
              emptyText: '暂无渠道明细',
            },
          ],
          note: '淘宝直播三源：直播推荐（平台分发）、搜索（主动意图）、店铺自运营（私域/关注）。三源结构决定投放与内容策略',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/taobao/three-sources failed')
      return sendError(reply, 500, '获取淘宝三源数据失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 3. 天猫 · 品牌 × 场次视图
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/tmall/brand-sessions', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = range(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        // live_sessions 无 shop_id 列，店铺维度需经 live_rooms.shop_id 关联
        const res = await client.query(
          `SELECT r.shop_id,
                  COALESCE(sh.shop_name, '未绑定店铺') AS shop_name,
                  COALESCE(sh.shop_type, '—')          AS shop_type,
                  COUNT(DISTINCT ls.id)::int           AS sessions,
                  COALESCE(SUM(ls.gmv), 0)::numeric(14,2) AS gmv,
                  COALESCE(SUM(ls.orders), 0)::int     AS orders,
                  COALESCE(SUM(ls.duration_min), 0)::int AS minutes,
                  COALESCE(AVG(ls.online_peak), 0)::int AS avg_peak
             FROM public.live_sessions ls
             JOIN public.live_rooms r ON r.id = ls.room_id
             LEFT JOIN public.dim_shop sh ON sh.id = r.shop_id
            WHERE r.platform_code = 'tmall'
              AND ls.date BETWEEN $1::date AND $2::date
            GROUP BY r.shop_id, sh.shop_name, sh.shop_type
            ORDER BY gmv DESC`,
          [from, to],
        )

        const totalGmv = res.rows.reduce((a: number, r: any) => a + num(r.gmv), 0)
        const totalSessions = res.rows.reduce((a: number, r: any) => a + num(r.sessions), 0)

        return {
          range: { from, to },
          kpis: [
            { label: '开播店铺', value: res.rows.length, accent: 'primary' as const },
            { label: '总场次', value: totalSessions },
            { label: '总 GMV', value: `¥${totalGmv.toLocaleString('zh-CN')}`, accent: 'success' as const },
            { label: '场均 GMV', value: `¥${(totalSessions > 0 ? totalGmv / totalSessions : 0).toFixed(0)}` },
          ],
          tables: [{
            title: '品牌 × 场次',
            columns: [
              { key: 'shopName', label: '品牌/店铺' },
              { key: 'shopType', label: '店铺类型' },
              { key: 'sessions', label: '场次', align: 'right' as Align },
              { key: 'minutes', label: '总时长(分)', align: 'right' as Align },
              { key: 'orders', label: '订单', align: 'right' as Align },
              { key: 'avgPeak', label: '平均在线峰值', align: 'right' as Align },
              { key: 'gmv', label: 'GMV', align: 'right' as Align },
            ],
            rows: res.rows.map((r: any) => ({
              shopName: r.shop_name,
              shopType: r.shop_type,
              sessions: num(r.sessions),
              minutes: num(r.minutes).toLocaleString('zh-CN'),
              orders: num(r.orders).toLocaleString('zh-CN'),
              avgPeak: num(r.avg_peak),
              gmv: `¥${num(r.gmv).toLocaleString('zh-CN')}`,
            })),
            emptyText: '暂无天猫场次数据',
          }],
          note: '天猫以品牌自播为主：一场直播即一次品牌内容投放，需按品牌维度而非按直播间维度看',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/tmall/brand-sessions failed')
      return sendError(reply, 500, '获取天猫品牌场次数据失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 4. 天猫 · 五层抵扣规则
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/tmall/promotion-layers', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT rule_layer, rule_name, discount_mode, discount_value,
                  is_exclusive, merchant_cost_ratio, platform_cost_ratio, note, is_active
             FROM public.pricing_rules
            WHERE platform_code = 'tmall'
            ORDER BY rule_layer ASC, rule_name ASC`,
        )

        const layers = res.rows
        const merchantTotal = layers.reduce((a: number, r: any) => a + num(r.merchant_cost_ratio), 0)
        const platformTotal = layers.reduce((a: number, r: any) => a + num(r.platform_cost_ratio), 0)

        // 模拟：以 100 元零售价为例，逐层叠加
        let price = 100
        const simRows = layers.map((r: any, i: number) => {
          const before = price
          if (r.discount_mode === 'rate') {
            price = price * num(r.discount_value)
          } else if (r.discount_mode === 'amount') {
            price = Math.max(0, price - num(r.discount_value))
          }
          return {
            layer: num(r.rule_layer) || i + 1,
            ruleName: r.rule_name,
            mode: r.discount_mode,
            value: num(r.discount_value),
            merchantRatio: num(r.merchant_cost_ratio).toFixed(2),
            platformRatio: num(r.platform_cost_ratio).toFixed(2),
            before: before.toFixed(2),
            after: price.toFixed(2),
            active: r.is_active ? '启用' : '停用',
          }
        })

        return {
          range: { from: '', to: '' },
          kpis: [
            { label: '抵扣层数', value: layers.length, accent: 'primary' as const },
            { label: '商家承担合计', value: merchantTotal.toFixed(2) },
            { label: '平台承担合计', value: platformTotal.toFixed(2) },
            { label: '100 元最终到手', value: `¥${price.toFixed(2)}`, accent: 'warn' as const },
          ],
          tables: [
            {
              title: '五层抵扣规则',
              columns: [
                { key: 'layer', label: '层', align: 'right' as Align },
                { key: 'ruleName', label: '规则' },
                { key: 'mode', label: '方式' },
                { key: 'value', label: '折扣值', align: 'right' as Align },
                { key: 'merchantRatio', label: '商家承担', align: 'right' as Align },
                { key: 'platformRatio', label: '平台承担', align: 'right' as Align },
                { key: 'active', label: '状态' },
              ],
              rows: layers.map((r: any, i: number) => ({
                layer: num(r.rule_layer) || i + 1,
                ruleName: r.rule_name,
                mode: r.discount_mode === 'rate' ? '折扣率' : r.discount_mode === 'amount' ? '立减' : r.discount_mode,
                value: num(r.discount_value),
                merchantRatio: num(r.merchant_cost_ratio).toFixed(2),
                platformRatio: num(r.platform_cost_ratio).toFixed(2),
                active: r.is_active ? '启用' : '停用',
              })),
              emptyText: '暂无天猫抵扣规则',
            },
            {
              title: '逐层叠加模拟（100 元零售价）',
              columns: [
                { key: 'layer', label: '层', align: 'right' as Align },
                { key: 'ruleName', label: '规则' },
                { key: 'before', label: '叠加前', align: 'right' as Align },
                { key: 'after', label: '叠加后', align: 'right' as Align },
              ],
              rows: simRows,
              emptyText: '无可模拟规则',
            },
          ],
          note: '天猫五层抵扣是独有结构：跨店满减、官方立减、百亿补贴、品类券、店铺券可叠加。真实毛利必须按商家承担比例重算，不能只看零售价减成本',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/tmall/promotion-layers failed')
      return sendError(reply, 500, '获取天猫抵扣规则失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 5. 天猫 · 直播与官方立减联动
  // ════════════════════════════════════════════════════════════
  app.get('/api/v1/insights/tmall/live-promo-link', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = range(request.query as any)
    try {
      const data = await withRlsContext(request, async (client) => {
        // 天猫场次
        const sessRes = await client.query(
          `SELECT ls.date AS biz_date,
                  COUNT(DISTINCT ls.id)::int AS sessions,
                  COALESCE(SUM(ls.gmv), 0)::numeric(14,2) AS gmv,
                  COALESCE(SUM(ls.orders), 0)::int AS orders
             FROM public.live_sessions ls
             JOIN public.live_rooms r ON r.id = ls.room_id
            WHERE r.platform_code = 'tmall'
              AND ls.date BETWEEN $1::date AND $2::date
            GROUP BY ls.date ORDER BY ls.date ASC`,
          [from, to],
        )

        // 同期天猫大促活动
        // promotions 表无 platform_code 列：用 applicable_rooms 关联天猫直播间来筛平台
        const promoRes = await client.query(
          `SELECT p.id, p.name, p.start_date, p.end_date, p.target_gmv, p.current_gmv, p.status
             FROM public.promotions p
            WHERE (p.start_date <= $2::date AND p.end_date >= $1::date)
              AND (
                p.applicable_rooms IS NULL
                OR jsonb_array_length(p.applicable_rooms) = 0
                OR EXISTS (
                  SELECT 1 FROM public.live_rooms r
                   WHERE r.platform_code = 'tmall'
                     AND r.id IN (
                       SELECT jsonb_array_elements_text(p.applicable_rooms)::int
                     )
                )
              )
            ORDER BY p.start_date ASC`,
          [from, to],
        )

        const promos = promoRes.rows
        const inPromoDays = new Set<string>()
        for (const p of promos) {
          const s = new Date(p.start_date); const e = new Date(p.end_date)
          for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            inPromoDays.add(new Date(d).toISOString().slice(0, 10))
          }
        }

        const rows = sessRes.rows.map((r: any) => {
          const biz = ym(r.biz_date)
          return {
            date: biz,
            sessions: num(r.sessions),
            gmv: `¥${num(r.gmv).toLocaleString('zh-CN')}`,
            orders: num(r.orders),
            inPromo: inPromoDays.has(biz) ? '大促期' : '日常',
          }
        })

        const promoGmv = sessRes.rows.filter((r: any) => inPromoDays.has(ym(r.biz_date))).reduce((a: number, r: any) => a + num(r.gmv), 0)
        const dailyGmv = sessRes.rows.filter((r: any) => !inPromoDays.has(ym(r.biz_date))).reduce((a: number, r: any) => a + num(r.gmv), 0)
        const promoDays = sessRes.rows.filter((r: any) => inPromoDays.has(ym(r.biz_date))).length
        const dailyDays = sessRes.rows.length - promoDays

        return {
          range: { from, to },
          kpis: [
            { label: '大促场次 GMV', value: `¥${promoGmv.toLocaleString('zh-CN')}`, hint: `${promoDays} 天`, accent: 'danger' as const },
            { label: '日常场次 GMV', value: `¥${dailyGmv.toLocaleString('zh-CN')}`, hint: `${dailyDays} 天` },
            { label: '大促日均', value: `¥${(promoDays > 0 ? promoGmv / promoDays : 0).toFixed(0)}` },
            { label: '日常日均', value: `¥${(dailyDays > 0 ? dailyGmv / dailyDays : 0).toFixed(0)}` },
            { label: '同期活动数', value: promos.length },
          ],
          tables: [
            {
              title: '同期大促活动',
              columns: [
                { key: 'name', label: '活动' },
                { key: 'range', label: '起止' },
                { key: 'target', label: '目标 GMV', align: 'right' as Align },
                { key: 'current', label: '当前 GMV', align: 'right' as Align },
                { key: 'status', label: '状态' },
              ],
              rows: promos.map((p: any) => ({
                name: p.name,
                range: `${ym(p.start_date)} ~ ${ym(p.end_date)}`,
                target: p.target_gmv ? `¥${num(p.target_gmv).toLocaleString('zh-CN')}` : '—',
                current: p.current_gmv ? `¥${num(p.current_gmv).toLocaleString('zh-CN')}` : '—',
                status: p.status,
              })),
              emptyText: '同期无天猫大促活动',
            },
            {
              title: '逐日场次 vs 大促期',
              columns: [
                { key: 'date', label: '日期' },
                { key: 'phase', label: '阶段' },
                { key: 'sessions', label: '场次', align: 'right' as Align },
                { key: 'orders', label: '订单', align: 'right' as Align },
                { key: 'gmv', label: 'GMV', align: 'right' as Align },
              ],
              rows: rows.map((r: any) => ({
                date: r.date, phase: r.inPromo, sessions: r.sessions, orders: r.orders, gmv: r.gmv,
              })),
              emptyText: '暂无天猫场次',
            },
          ],
          note: '天猫直播必须与官方立减/大促活动联动看：大促期日均 GMV 通常显著高于日常，若差异不明显说明活动没吃到',
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'insights/tmall/live-promo-link failed')
      return sendError(reply, 500, '获取天猫直播与活动联动数据失败')
    }
  })

  // ════════════════════════════════════════════════════════════
  // 6. 小红书 · 买手画像
  // ════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════
  // 9. 视频号 · 全域带货者
  // ════════════════════════════════════════════════════════════
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
  })
}
