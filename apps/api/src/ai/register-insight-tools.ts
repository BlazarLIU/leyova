import { z } from 'zod'
import { registerTool } from './tool-registry.js'
import { canAccessAdSpend } from '../lib/guard.js'
import { computeRefundRatePct } from '../services/metrics-caliber.js'

// ---------------------------------------------------------------------------
// Insight tools（Read-only）
//
// 依据 plan.md 第11章第一批 MCP Tool 规划补齐的业务查询工具，全部读取来自
// 抖音日报导入链路（session_* / douyin_*_daily_metrics / improvement_tasks），
// 返回结构化 JSON，供 DeerFlow Lead Agent 回答核心复盘问题。
// 规划文件：docs/plan.md §11；本批 17 个工具登记于
// docs/deerflow-capability-assessment-report.md 第5章 P0（缺口1）。
// ---------------------------------------------------------------------------

// 允许的排序字段，防止任意 SQL 字段注入到 ORDER BY
const PRODUCT_ORDER_FIELDS = [
  'payment_amount',
  'sold_count',
  'order_count',
  'buyer_count',
  'exposure_users',
  'click_users',
] as const

// ---------------------------------------------------------------------------
// Overview：经营总览 / 趋势
// ---------------------------------------------------------------------------

registerTool({
  name: 'get_business_overview',
  description:
    '经营总览：指定日期范围/直播间下的场次数、直播间数、GMV(用户支付金额)、观看人数、商品点击人数、退款、平均互动率、平均转化率、平均 GPM、总直播时长。',
  inputSchema: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    roomId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.startDate) {
      conditions.push(`b.business_date >= $${idx++}::date`)
      values.push(params.startDate)
    }
    if (params.endDate) {
      conditions.push(`b.business_date <= $${idx++}::date`)
      values.push(params.endDate)
    }
    if (params.roomId) {
      conditions.push(`b.room_id = $${idx++}`)
      values.push(params.roomId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT
         COALESCE(COUNT(*), 0)::int AS session_count,
         COALESCE(COUNT(DISTINCT b.room_id), 0)::int AS room_count,
         COALESCE(SUM(b.payment_amount), 0)::float8 AS total_gmv,
         COALESCE(SUM(o.viewers), 0)::float8 AS total_viewers,
         COALESCE(SUM(o.product_click_users), 0)::float8 AS total_product_clicks,
         COALESCE(SUM(o.new_followers), 0)::float8 AS total_new_followers,
         COALESCE(SUM(o.refund_amount), 0)::float8 AS total_refund_amount,
         COALESCE(SUM(o.refund_orders), 0)::float8 AS total_refund_orders,
         COALESCE(AVG(o.interaction_rate), 0)::float8 AS avg_interaction_rate,
         COALESCE(AVG(o.conversion_rate), 0)::float8 AS avg_conversion_rate,
         COALESCE(AVG(b.gpm), 0)::float8 AS avg_gpm,
         COALESCE(SUM(b.live_duration_min), 0)::float8 AS total_duration_min
       FROM session_live_basic_info b
       LEFT JOIN session_overview_metrics o
         ON o.room_id = b.room_id AND o.business_date = b.business_date
       ${where}`,
      values
    )

    const r = rows[0]
    if (!r) return null
    return {
      scope: {
        startDate: params.startDate ?? null,
        endDate: params.endDate ?? null,
        roomId: params.roomId ?? null,
      },
      sessionCount: Number(r.session_count) || 0,
      roomCount: Number(r.room_count) || 0,
      totalGmv: Number(r.total_gmv) || 0,
      totalViewers: Number(r.total_viewers) || 0,
      totalProductClicks: Number(r.total_product_clicks) || 0,
      totalNewFollowers: Number(r.total_new_followers) || 0,
      totalRefundAmount: Number(r.total_refund_amount) || 0,
      totalRefundOrders: Number(r.total_refund_orders) || 0,
      avgInteractionRate: Number(r.avg_interaction_rate) || 0,
      avgConversionRate: Number(r.avg_conversion_rate) || 0,
      avgGpm: Number(r.avg_gpm) || 0,
      totalDurationMin: Number(r.total_duration_min) || 0,
    }
  },
})

registerTool({
  name: 'get_business_trend',
  description:
    '经营趋势：按日聚合的 GMV / 观看 / 商品点击 / 互动率 / 转化率序列及其环比变化，用于时段对比与趋势分析。',
  inputSchema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    roomId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = ['b.business_date BETWEEN $1::date AND $2::date']
    const values: unknown[] = [params.startDate, params.endDate]
    let idx = 3
    if (params.roomId) {
      conditions.push(`b.room_id = $${idx++}`)
      values.push(params.roomId)
    }

    const { rows } = await ctx.pool.query(
      `SELECT b.business_date,
         COALESCE(COUNT(DISTINCT b.room_id), 0)::int AS room_count,
         COALESCE(SUM(b.payment_amount), 0)::float8 AS gmv,
         COALESCE(SUM(o.viewers), 0)::float8 AS viewers,
         COALESCE(SUM(o.product_click_users), 0)::float8 AS product_clicks,
         COALESCE(AVG(o.interaction_rate), 0)::float8 AS interaction_rate,
         COALESCE(AVG(o.conversion_rate), 0)::float8 AS conversion_rate,
         COALESCE(AVG(b.gpm), 0)::float8 AS gpm
       FROM session_live_basic_info b
       LEFT JOIN session_overview_metrics o
         ON o.room_id = b.room_id AND o.business_date = b.business_date
       WHERE ${conditions.join(' AND ')}
       GROUP BY b.business_date
       ORDER BY b.business_date ASC`,
      values
    )

    const series = rows.map((row) => ({
      date: row.business_date,
      roomCount: Number(row.room_count) || 0,
      gmv: Number(row.gmv) || 0,
      viewers: Number(row.viewers) || 0,
      productClicks: Number(row.product_clicks) || 0,
      interactionRate: Number(row.interaction_rate) || 0,
      conversionRate: Number(row.conversion_rate) || 0,
      gpm: Number(row.gpm) || 0,
    }))

    // 环比：后一天相对前一天的变化率
    const withChange = series.map((item, i) => {
      const prev = i > 0 ? series[i - 1] : null
      return {
        ...item,
        gmvChangePct: prev && prev.gmv > 0 ? ((item.gmv - prev.gmv) / prev.gmv) * 100 : null,
        viewersChangePct: prev && prev.viewers > 0 ? ((item.viewers - prev.viewers) / prev.viewers) * 100 : null,
      }
    })

    return {
      startDate: params.startDate,
      endDate: params.endDate,
      roomId: params.roomId ?? null,
      series: withChange,
      first: withChange[0] ?? null,
      last: withChange[withChange.length - 1] ?? null,
    }
  },
})

// ---------------------------------------------------------------------------
// Live：场次列表 / 单场指标
// ---------------------------------------------------------------------------

registerTool({
  name: 'get_live_sessions',
  description:
    '直播场次列表：按日期/直播间/主播过滤，返回场次 id、标题、主播名、直播间名、GMV、订单、观看、UV 价值、GPM 等。',
  inputSchema: z.object({
    date: z.string().optional(),
    roomId: z.number().int().positive().optional(),
    anchorId: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`ls.date = $${idx++}::date`)
      values.push(params.date)
    }
    if (params.roomId) {
      conditions.push(`ls.room_id = $${idx++}`)
      values.push(params.roomId)
    }
    if (params.anchorId) {
      conditions.push(`ls.anchor_id = $${idx++}`)
      values.push(params.anchorId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT ls.id, ls.title, ls.date, ls.start_time, ls.end_time, ls.status,
              ls.gmv, ls.orders, ls.views, ls.uv_value, ls.gpm,
              ls.interaction_rate, ls.retention_rate, ls.new_fans,
              a.id AS anchor_id, a.name AS anchor_name,
              r.id AS room_id, r.name AS room_name
       FROM live_sessions ls
       LEFT JOIN anchors a ON a.id = ls.anchor_id
       LEFT JOIN live_rooms r ON r.id = ls.room_id
       ${where}
       ORDER BY ls.date DESC
       LIMIT $${idx}`,
      [...values, params.limit]
    )

    return { rows, count: rows.length }
  },
})

registerTool({
  name: 'get_live_session_metrics',
  description:
    '单场全维指标：场次基本信息 + 整体看板（观看/互动/退款/漏斗） + 渠道汇总（渠道数/总 GMV/总投放/混合 ROI）。',
  inputSchema: z.object({
    sessionId: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
      `SELECT ls.id, ls.title, ls.date, ls.status, ls.gmv, ls.orders, ls.views,
              ls.online_peak, ls.avg_online, ls.uv_value, ls.gpm,
              ls.interaction_rate, ls.retention_rate, ls.new_fans, ls.return_amount,
              ls.ad_platform, ls.ad_cost, ls.gmv_per_hour, ls.avg_item_price, ls.buyer_count,
              a.id AS anchor_id, a.name AS anchor_name,
              r.id AS room_id, r.name AS room_name,
              o.viewers, o.avg_watch_seconds, o.avg_comments_per_person,
              o.product_click_users, o.conversion_rate, o.product_click_deal_rate,
              o.refund_amount, o.refund_orders, o.refund_users,
              o.exposure_users, o.enter_users, o.product_exposure_users,
              o.product_click_persons, o.deal_users
       FROM live_sessions ls
       LEFT JOIN anchors a ON a.id = ls.anchor_id
       LEFT JOIN live_rooms r ON r.id = ls.room_id
       LEFT JOIN session_overview_metrics o
         ON (o.session_id = ls.id)
         OR (o.session_id IS NULL AND o.room_id = ls.room_id AND o.business_date = ls.date)
       WHERE ls.id = $1`,
      [params.sessionId]
    )

    if (rows.length === 0) return { error: 'Session not found' }
    const allowAd = canAccessAdSpend({ role: ctx.role })
    const s = allowAd ? rows[0] : { ...rows[0], ad_cost: null }

    const { rows: channels } = await ctx.pool.query(
      `SELECT channel, avg_watch_sec, impressions, views, interactions, new_fans,
              product_impressions, product_clicks, orders, buyer_count, gmv,
              item_count, gpm, avg_order_value, ad_spend
       FROM session_channel_metrics
       WHERE session_id = $1
       ORDER BY gmv DESC`,
      [params.sessionId]
    )

    const totalChannelGmv = channels.reduce((sum, c) => sum + (Number(c.gmv) || 0), 0)
    const totalAdSpend = channels.reduce((sum, c) => sum + (Number(c.ad_spend) || 0), 0)
    const safeChannels = allowAd ? channels : channels.map((c) => ({ ...c, ad_spend: null }))

    return {
      session: s,
      channels: safeChannels,
      channelSummary: {
        channelCount: channels.length,
        totalGmv: totalChannelGmv,
        totalAdSpend: allowAd ? totalAdSpend : null,
        blendedRoi: allowAd && totalAdSpend > 0 ? totalChannelGmv / totalAdSpend : null,
      },
    }
  },
})

// ---------------------------------------------------------------------------
// Anchor：主播列表 / 五项能力
// ---------------------------------------------------------------------------

registerTool({
  name: 'get_anchor_list',
  description:
    '主播列表：返回主播 id/名称/平台/级别及汇总能力（累计 GMV、平均互动率、平均 GPM、平均 UV 价值）。',
  inputSchema: z.object({
    date: z.string().optional(),
    limit: z.number().int().positive().max(100).default(50),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`sam.date = $${idx++}::date`)
      values.push(params.date)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT a.id, a.name, a.platform, a.level,
              COALESCE(SUM(sam.gmv), 0)::float8 AS total_gmv,
              COALESCE(AVG(sam.interaction_rate), 0)::float8 AS avg_interaction_rate,
              COALESCE(AVG(sam.gpm), 0)::float8 AS avg_gpm,
              COALESCE(AVG(sam.uv_value), 0)::float8 AS avg_uv_value,
              COUNT(sam.id)::int AS metric_days
       FROM anchors a
       LEFT JOIN session_anchor_metrics sam ON sam.anchor_id = a.id
       ${where}
       GROUP BY a.id, a.name, a.platform, a.level
       ORDER BY total_gmv DESC
       LIMIT $${idx}`,
      [...values, params.limit]
    )

    return { rows, count: rows.length }
  },
})

registerTool({
  name: 'get_anchor_performance',
  description:
    '主播五项能力及趋势：引流(观看/曝光观看率)、留人(平均/峰值在线/留存率)、互动(互动率)、吸粉(新增粉丝/观看关注率)、转化(GMV/UV 价值/买家/商品点击成交率)，按日返回序列。',
  inputSchema: z.object({
    anchorId: z.number().int().positive(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = ['sam.anchor_id = $1']
    const values: unknown[] = [params.anchorId]
    let idx = 2
    if (params.startDate) {
      conditions.push(`sam.date >= $${idx++}::date`)
      values.push(params.startDate)
    }
    if (params.endDate) {
      conditions.push(`sam.date <= $${idx++}::date`)
      values.push(params.endDate)
    }

    const { rows } = await ctx.pool.query(
      `SELECT sam.date, sam.title, sam.views, sam.exposure_view_rate,
              sam.avg_online, sam.online_peak, sam.retention_rate,
              sam.interaction_rate, sam.new_fans, sam.view_follow_rate,
              sam.gmv, sam.gmv_per_hour, sam.uv_value, sam.buyer_count,
              sam.avg_item_price, sam.gpm
       FROM session_anchor_metrics sam
       WHERE ${conditions.join(' AND ')}
       ORDER BY sam.date ASC`,
      values
    )

    const series = rows.map((row) => ({
      date: row.date,
      title: row.title,
      traffic: {
        views: Number(row.views) || 0,
        exposureViewRate: Number(row.exposure_view_rate) || 0,
      },
      retention: {
        avgOnline: Number(row.avg_online) || 0,
        peakOnline: Number(row.online_peak) || 0,
        retentionRate: Number(row.retention_rate) || 0,
      },
      interaction: Number(row.interaction_rate) || 0,
      follower: {
        newFans: Number(row.new_fans) || 0,
        viewFollowRate: Number(row.view_follow_rate) || 0,
      },
      conversion: {
        gmv: Number(row.gmv) || 0,
        gmvPerHour: Number(row.gmv_per_hour) || 0,
        uvValue: Number(row.uv_value) || 0,
        buyerCount: Number(row.buyer_count) || 0,
        avgItemPrice: Number(row.avg_item_price) || 0,
        gpm: Number(row.gpm) || 0,
      },
    }))

    const totalGmv = series.reduce((sum, s) => sum + s.conversion.gmv, 0)

    return {
      anchorId: params.anchorId,
      startDate: params.startDate ?? null,
      endDate: params.endDate ?? null,
      days: series.length,
      totalGmv,
      series,
    }
  },
})

// ---------------------------------------------------------------------------
// Channel：渠道表现 / 渠道趋势
// ---------------------------------------------------------------------------

registerTool({
  name: 'get_channel_performance',
  description:
    '渠道表现：指定场次下的各渠道漏斗（曝光→观看→互动→商品→成交）与 ROI（GMV/投放），按 GMV 排序。',
  inputSchema: z.object({
    sessionId: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
      `SELECT channel, impressions, views, exposure_view_rate,
              interactions, view_interaction_rate, new_fans,
              product_impressions, product_clicks, product_click_rate,
              orders, buyer_count, gmv, item_count, gpm, avg_order_value, ad_spend
       FROM session_channel_metrics
       WHERE session_id = $1
       ORDER BY gmv DESC`,
      [params.sessionId]
    )

    const allowAd = canAccessAdSpend({ role: ctx.role })
    return {
      sessionId: params.sessionId,
      channels: rows.map((row) => ({
        channel: row.channel,
        impressions: Number(row.impressions) || 0,
        views: Number(row.views) || 0,
        exposureViewRate: Number(row.exposure_view_rate) || 0,
        interactions: Number(row.interactions) || 0,
        viewInteractionRate: Number(row.view_interaction_rate) || 0,
        newFans: Number(row.new_fans) || 0,
        productImpressions: Number(row.product_impressions) || 0,
        productClicks: Number(row.product_clicks) || 0,
        productClickRate: Number(row.product_click_rate) || 0,
        orders: Number(row.orders) || 0,
        buyerCount: Number(row.buyer_count) || 0,
        gmv: Number(row.gmv) || 0,
        itemCount: Number(row.item_count) || 0,
        gpm: Number(row.gpm) || 0,
        avgOrderValue: Number(row.avg_order_value) || 0,
        adSpend: allowAd ? Number(row.ad_spend) || 0 : null,
        roi: allowAd && Number(row.ad_spend) > 0 ? (Number(row.gmv) || 0) / Number(row.ad_spend) : null,
      })),
      count: rows.length,
    }
  },
})

registerTool({
  name: 'get_channel_trend',
  description:
    '渠道趋势：按日聚合的渠道核心指标（观看/互动/成交/GMV/千次观看支付/客单价）序列及环比。',
  inputSchema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    channel: z.string().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = ['business_date BETWEEN $1::date AND $2::date']
    const values: unknown[] = [params.startDate, params.endDate]
    let idx = 3
    if (params.channel) {
      conditions.push(`channel_name = $${idx++}`)
      values.push(params.channel)
    }

    const { rows } = await ctx.pool.query(
      `SELECT business_date, channel_name,
              COALESCE(viewers, 0)::float8 AS viewers,
              COALESCE(interactions, 0)::float8 AS interactions,
              COALESCE(order_count, 0)::float8 AS orders,
              COALESCE(payment_amount, 0)::float8 AS gmv,
              COALESCE(thousand_view_payment, 0)::float8 AS thousand_view_payment,
              COALESCE(avg_order_value, 0)::float8 AS avg_order_value,
              COALESCE(ad_cost_promoted, 0)::float8 AS ad_spend
       FROM douyin_channel_daily_metrics
       WHERE ${conditions.join(' AND ')}
       ORDER BY business_date ASC`,
      values
    )

    const allowAd = canAccessAdSpend({ role: ctx.role })
    const series = rows.map((row) => ({
      date: row.business_date,
      channel: row.channel_name,
      viewers: Number(row.viewers) || 0,
      interactions: Number(row.interactions) || 0,
      orders: Number(row.orders) || 0,
      gmv: Number(row.gmv) || 0,
      thousandViewPayment: Number(row.thousand_view_payment) || 0,
      avgOrderValue: Number(row.avg_order_value) || 0,
      adSpend: allowAd ? Number(row.ad_spend) || 0 : null,
      roi: allowAd && Number(row.ad_spend) > 0 ? (Number(row.gmv) || 0) / Number(row.ad_spend) : null,
    }))

    return {
      startDate: params.startDate,
      endDate: params.endDate,
      channel: params.channel ?? null,
      series,
      days: series.length,
    }
  },
})

// ---------------------------------------------------------------------------
// Product：商品表现 / 排行 / SKU
// ---------------------------------------------------------------------------

registerTool({
  name: 'get_product_performance',
  description:
    '商品表现 TOP-N：按日期/直播间过滤的商品曝光、点击、成交、退款、GMV 明细，按 GMV 降序。',
  inputSchema: z.object({
    date: z.string().optional(),
    roomId: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).default(10),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`business_date = $${idx++}::date`)
      values.push(params.date)
    }
    if (params.roomId) {
      conditions.push(`room_id = $${idx++}`)
      values.push(params.roomId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT room_id, business_date, product_order, product_name, product_id,
              payment_amount, sold_count, buyer_count, order_count,
              exposure_users, click_users, exposure_click_rate, click_deal_rate,
              refund_users, refund_amount, refund_orders
       FROM session_product_details
       ${where}
       ORDER BY payment_amount DESC
       LIMIT $${idx}`,
      [...values, params.limit]
    )

    return { rows, count: rows.length }
  },
})

registerTool({
  name: 'get_product_ranking',
  description:
    '商品排行：按指定维度（成交额/件数/订单数/点击）对商品排序，返回名次与核心指标。',
  inputSchema: z.object({
    date: z.string().optional(),
    limit: z.number().int().positive().max(100).default(10),
    orderBy: z.enum(PRODUCT_ORDER_FIELDS).default('payment_amount'),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`business_date = $${idx++}::date`)
      values.push(params.date)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT ROW_NUMBER() OVER (ORDER BY ${params.orderBy} DESC)::int AS rank,
              product_name, product_id, room_id, business_date,
              payment_amount, sold_count, buyer_count, order_count,
              exposure_users, click_users
       FROM session_product_details
       ${where}
       ORDER BY ${params.orderBy} DESC
       LIMIT $${idx}`,
      [...values, params.limit]
    )

    return { orderBy: params.orderBy, rows, count: rows.length }
  },
})

registerTool({
  name: 'get_product_sku_details',
  description:
    '商品 SKU 明细：按 session_product_skus 的 product_id 返回各 SKU 的成交金额/件数/人数/订单数。',
  inputSchema: z.object({
    productId: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
      `SELECT id, product_id, sku_name, payment_amount, sold_count, buyer_count, order_count
       FROM session_product_skus
       WHERE product_id = $1
       ORDER BY payment_amount DESC`,
      [params.productId]
    )

    return {
      productId: params.productId,
      count: rows.length,
      rows,
    }
  },
})

// ---------------------------------------------------------------------------
// BI：ROI / 退款 / 异常与数据缺失
// ---------------------------------------------------------------------------

registerTool({
  name: 'get_roi_analysis',
  description:
    '渠道 ROI 分析：按场次或日期汇总各渠道投放消耗、GMV、ROI（GMV/投放）与 GMV 占比，附整体混合 ROI。',
  inputSchema: z.object({
    sessionId: z.number().int().positive().optional(),
    date: z.string().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.sessionId) {
      conditions.push(`session_id = $${idx++}`)
      values.push(params.sessionId)
    }
    if (params.date) {
      conditions.push(`period_date = $${idx++}::date`)
      values.push(params.date)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT channel, period_date, gmv, ad_spend
       FROM session_channel_metrics
       ${where}
       ORDER BY gmv DESC`,
      values
    )

    const allowAd = canAccessAdSpend({ role: ctx.role })
    const items = rows.map((row) => ({
      channel: row.channel,
      periodDate: row.period_date,
      gmv: Number(row.gmv) || 0,
      adSpend: allowAd ? Number(row.ad_spend) || 0 : null,
      roi: allowAd && Number(row.ad_spend) > 0 ? (Number(row.gmv) || 0) / Number(row.ad_spend) : null,
    }))

    const totalGmv = items.reduce((sum, i) => sum + i.gmv, 0)
    const totalAdSpend = allowAd ? items.reduce((sum, i) => sum + (i.adSpend ?? 0), 0) : null

    return {
      sessionId: params.sessionId ?? null,
      date: params.date ?? null,
      channels: items.map((i) => ({ ...i, gmvSharePct: totalGmv > 0 ? (i.gmv / totalGmv) * 100 : 0 })),
      summary: {
        totalGmv,
        totalAdSpend,
        blendedRoi: allowAd && totalAdSpend && totalAdSpend > 0 ? totalGmv / totalAdSpend : null,
        channelCount: items.length,
      },
    }
  },
})

registerTool({
  name: 'get_refund_analysis',
  description:
    '退款分析：按日期或场次返回退款金额/订单/人数与退款率（按成交额口径），供复盘判断退款风险。',
  inputSchema: z.object({
    date: z.string().optional(),
    sessionId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`o.business_date = $${idx++}::date`)
      values.push(params.date)
    }
    if (params.sessionId) {
      conditions.push(`o.session_id = $${idx++}`)
      values.push(params.sessionId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT o.business_date, o.room_id,
              COALESCE(o.refund_amount, 0)::float8 AS refund_amount,
              COALESCE(o.refund_orders, 0)::float8 AS refund_orders,
              COALESCE(o.refund_users, 0)::float8 AS refund_users,
              COALESCE(b.payment_amount, 0)::float8 AS gmv
       FROM session_overview_metrics o
       LEFT JOIN session_live_basic_info b
         ON b.room_id = o.room_id AND b.business_date = o.business_date
       ${where}
       ORDER BY o.business_date DESC`,
      values
    )

    const items = rows.map((row) => {
      const gmv = Number(row.gmv) || 0
      const refundAmount = Number(row.refund_amount) || 0
      return {
        businessDate: row.business_date,
        roomId: row.room_id,
        refundAmount,
        refundOrders: Number(row.refund_orders) || 0,
        refundUsers: Number(row.refund_users) || 0,
        refundRatePct: gmv > 0 ? computeRefundRatePct(refundAmount, gmv, 2) : null,
      }
    })

    return {
      date: params.date ?? null,
      sessionId: params.sessionId ?? null,
      items,
      summary: {
        totalRefundAmount: items.reduce((s, i) => s + i.refundAmount, 0),
        totalRefundOrders: items.reduce((s, i) => s + i.refundOrders, 0),
      },
    }
  },
})

registerTool({
  name: 'get_anomalies',
  description:
    '异常预警：返回未处理的异常事件（按严重级别/日期过滤），并检查指定日期的主播/渠道日报是否缺失（数据完整性预警）。',
  inputSchema: z.object({
    date: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = ["status = 'pending'"]
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`event_time::date = $${idx++}::date`)
      values.push(params.date)
    }
    if (params.severity) {
      conditions.push(`severity = $${idx++}`)
      values.push(params.severity)
    }
    const anomalyWhere = conditions.join(' AND ')

    const { rows: events } = await ctx.pool.query(
      `SELECT id, severity, title, description, event_time, status
       FROM alert_events
       WHERE ${anomalyWhere}
       ORDER BY event_time DESC
       LIMIT $${idx}`,
      [...values, params.limit]
    )

    // 数据缺失检查：整场导入当日是否缺少主播/渠道日报
    let dataGaps = { days: 0, missingAnchorDays: [] as string[], missingChannelDays: [] as string[] }
    if (params.date) {
      dataGaps = { ...dataGaps, days: 1 }
      const checkDate = params.date
      const [anchorRows, channelRows] = await Promise.all([
        ctx.pool
          .query(`SELECT 1 FROM session_anchor_metrics WHERE date = $1::date LIMIT 1`, [checkDate])
          .catch(() => ({ rows: [] })),
        ctx.pool
          .query(`SELECT 1 FROM session_channel_metrics WHERE period_date = $1::date LIMIT 1`, [checkDate])
          .catch(() => ({ rows: [] })),
      ])
      if (anchorRows.rows.length === 0) dataGaps.missingAnchorDays.push(checkDate)
      if (channelRows.rows.length === 0) dataGaps.missingChannelDays.push(checkDate)
    }

    return {
      events,
      eventCount: events.length,
      dataGaps,
    }
  },
})

// ---------------------------------------------------------------------------
// Review：复盘概览 / 漏斗分析
// ---------------------------------------------------------------------------

registerTool({
  name: 'get_review_overview',
  description:
    '复盘概览：按日期/直播间汇总已结束场次的 GMV、订单、观看、UV 价值、互动率、留存率、GPM 与健康度评分，供先概览后深入。',
  inputSchema: z.object({
    date: z.string().optional(),
    roomId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = [`ls.status = 'completed'`]
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`ls.date = $${idx++}::date`)
      values.push(params.date)
    }
    if (params.roomId) {
      conditions.push(`ls.room_id = $${idx++}`)
      values.push(params.roomId)
    }

    const { rows } = await ctx.pool.query(
      `SELECT ls.id, ls.title, ls.date,
              r.name AS room_name, a.name AS anchor_name,
              ls.gmv, ls.orders, ls.views, ls.uv_value, ls.gpm,
              ls.interaction_rate, ls.retention_rate, ls.new_fans, ls.online_peak, ls.avg_online
       FROM live_sessions ls
       LEFT JOIN live_rooms r ON r.id = ls.room_id
       LEFT JOIN anchors a ON a.id = ls.anchor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ls.date DESC, ls.gmv DESC
       LIMIT 50`,
      values
    )

    const sessions = rows.map((row) => {
      const interactionRate = Number(row.interaction_rate) || 0
      const retentionRate = Number(row.retention_rate) || 0
      const uvValue = Number(row.uv_value) || 0
      // 简易健康度 0-100：互动率40%权重、留存率30%、UV价值30%（按常见区间归一）
      const healthScore = Math.min(
        100,
        Math.round(interactionRate * 200 + retentionRate * 150 + Math.min(uvValue / 5, 1) * 30)
      )
      return {
        id: row.id,
        title: row.title,
        date: row.date,
        roomName: row.room_name,
        anchorName: row.anchor_name,
        gmv: Number(row.gmv) || 0,
        orders: Number(row.orders) || 0,
        views: Number(row.views) || 0,
        uvValue,
        gpm: Number(row.gpm) || 0,
        interactionRate,
        retentionRate,
        newFans: Number(row.new_fans) || 0,
        onlinePeak: Number(row.online_peak) || 0,
        avgOnline: Number(row.avg_online) || 0,
        healthScore,
      }
    })

    const totalGmv = sessions.reduce((sum, s) => sum + s.gmv, 0)

    return {
      date: params.date ?? null,
      roomId: params.roomId ?? null,
      sessionCount: sessions.length,
      totalGmv,
      sessions,
    }
  },
})

registerTool({
  name: 'get_funnel_analysis',
  description:
    '转化漏斗：曝光人数→进入直播间→商品曝光→商品点击→成交，返回各环节人数、转化率与流失率，定位漏斗瓶颈。',
  inputSchema: z.object({
    date: z.string().optional(),
    sessionId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`business_date = $${idx++}::date`)
      values.push(params.date)
    }
    if (params.sessionId) {
      conditions.push(`session_id = $${idx++}`)
      values.push(params.sessionId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT room_id, business_date,
              COALESCE(exposure_users, 0)::float8 AS exposure_users,
              COALESCE(enter_users, 0)::float8 AS enter_users,
              COALESCE(product_exposure_users, 0)::float8 AS product_exposure_users,
              COALESCE(product_click_persons, 0)::float8 AS product_click_persons,
              COALESCE(deal_users, 0)::float8 AS deal_users,
              COALESCE(interaction_rate, 0)::float8 AS interaction_rate
       FROM session_overview_metrics
       ${where}
       ORDER BY business_date DESC`,
      values
    )

    const funnels = rows.map((row) => {
      const exposure = Number(row.exposure_users) || 0
      const enter = Number(row.enter_users) || 0
      const productExposure = Number(row.product_exposure_users) || 0
      const productClick = Number(row.product_click_persons) || 0
      const deal = Number(row.deal_users) || 0

      const step = (from: number, to: number) =>
        from > 0 ? { passPct: (to / from) * 100, dropPct: ((from - to) / from) * 100 } : null

      return {
        roomId: row.room_id,
        businessDate: row.business_date,
        funnel: {
          exposureUsers: exposure,
          enterUsers: enter,
          productExposureUsers: productExposure,
          productClickPersons: productClick,
          dealUsers: deal,
        },
        conversion: {
          exposureToEnter: step(exposure, enter),
          enterToProductExposure: step(enter, productExposure),
          productExposureToClick: step(productExposure, productClick),
          clickToDeal: step(productClick, deal),
          exposureToDeal: step(exposure, deal),
        },
      }
    })

    return {
      date: params.date ?? null,
      sessionId: params.sessionId ?? null,
      count: funnels.length,
      funnels,
    }
  },
})

// ---------------------------------------------------------------------------
// Task：改进任务查询
// ---------------------------------------------------------------------------

registerTool({
  name: 'get_improvement_tasks',
  description:
    '改进任务列表：按状态/来源过滤待办改进任务（含优先级、指派对象、截止日期、进度）。',
  inputSchema: z.object({
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
    source: z.string().optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.status) {
      conditions.push(`status = $${idx++}`)
      values.push(params.status)
    }
    if (params.source) {
      conditions.push(`source = $${idx++}`)
      values.push(params.source)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await ctx.pool.query(
      `SELECT id, title, description, assignee, priority, source, source_id,
              due_date, progress, status, created_at, updated_at
       FROM improvement_tasks
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      [...values, params.limit]
    )

    return { rows, count: rows.length }
  },
})