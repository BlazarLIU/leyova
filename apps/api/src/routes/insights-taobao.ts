import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { insightRange, range, num, ym, type Align, type Column, type Kpi, type TableBlock } from '../lib/insight-utils.js'

/**
 * platform-dedicated 域拆分（P2-1）：淘系（直播三源 / 品牌×场次 / 五层抵扣 / 官方立减联动）
 * 原属 routes/platform-dedicated.ts，2026-11-17 拆出。
 */
export async function insightsTaobaoRoutes(app: FastifyInstance) {
  const guard = { preHandler: [requireAuth] }

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

}
