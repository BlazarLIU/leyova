/**
 * omnichannel.ts — 全渠道经营大盘与货架店铺经营看板
 *
 * 对应计划 P2「多平台业务板块」：
 *   1. 全渠道经营大盘：平台对比、店铺排行、渠道结构、同环比、目标达成
 *   2. 货架店铺经营看板：店铺日报、流量结构、活动效果
 *
 * 数据来源：fact_trade_daily / fact_traffic_daily / fact_ad_daily + dim_shop
 * 权限：所有查询强制按「用户可访问平台」过滤，未开启平台不返回任何数据。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canAccessCost, canAccessCostAsync, getUserAllowedPlatforms, requireAuth } from '../lib/guard.js'
import { checkComparability } from '../platform/caliber.js'
import { computeRefundRatePct } from '../services/metrics-caliber.js'

/** 解析时间范围，默认最近 30 天 */
function resolveRange(from?: string, to?: string): { from: string; to: string } {
  const today = new Date()
  const toDate = to || today.toISOString().slice(0, 10)
  const fromDate =
    from ||
    (() => {
      const d = new Date(toDate)
      d.setDate(d.getDate() - 29)
      return d.toISOString().slice(0, 10)
    })()
  return { from: fromDate, to: toDate }
}

/** 计算同长度上一周期 */
function previousRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(from)
  const t = new Date(to)
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1
  const prevTo = new Date(f)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - days + 1)
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) }
}

/** 读取用户可访问的平台集合（fail-closed：未登录返回空集合，超级管理员返回 null） */
async function accessiblePlatforms(pool: any, request: FastifyRequest): Promise<Set<string> | null> {
  return getUserAllowedPlatforms(pool, (request as any).user)
}

/** 构造平台过滤条件 */
function platformClause(
  requested: string | undefined,
  allowed: Set<string> | null,
  alias = 'f',
  startIndex = 3,
): { sql: string; params: any[] } {
  const params: any[] = []
  const conds: string[] = []

  if (requested) {
    if (allowed && !allowed.has(requested)) {
      // 无权限 → 强制返回空集
      return { sql: 'AND false', params: [] }
    }
    conds.push(`${alias}.platform_code = $${startIndex}`)
    params.push(requested)
  } else if (allowed) {
    const list = Array.from(allowed)
    if (list.length === 0) return { sql: 'AND false', params: [] }
    conds.push(`${alias}.platform_code = ANY($${startIndex}::text[])`)
    params.push(list)
  }

  return { sql: conds.length > 0 ? `AND ${conds.join(' AND ')}` : '', params }
}

// P0-B-2：口径过滤必须 fail-closed
//
// 改造前：`LEFT JOIN ... AND (pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type)`
//         → 某平台未配默认口径时，IS NULL 为真，该平台**所有 amount_type 全部返回**
//         → 静默退化成裸 SUM，实测放大 2.42 倍且各平台倍数不等（会导致排名反转）
//
// 改造后：内连接 + 精确匹配。未配默认口径的平台返回 0 行（可被 check_caliber_gap() 检出），
//         而不是静默返回错误的高值。
const DEFAULT_CALIBER_JOIN = `JOIN platform_caliber_config pcc ON pcc.platform_code = f.platform_code AND pcc.metric_code = 'gmv' AND pcc.is_default = true`
const DEFAULT_CALIBER_COND = `AND f.amount_type = pcc.amount_type`

async function loadAccessibleShop(
  client: any,
  request: FastifyRequest,
  shopId: number,
): Promise<
  | { status: 'ok'; shop: { id: number; platform_code: string; shop_name: string; external_shop_id: string | null; auth_status: string; status: string } }
  | { status: 'not_found' }
  | { status: 'forbidden' }
> {
  const allowed = await accessiblePlatforms(client, request)
  const shopRes = await client.query(
    `SELECT id, platform_code, shop_name, external_shop_id, auth_status, status
       FROM dim_shop WHERE id = $1`,
    [shopId],
  )
  if (shopRes.rows.length === 0) return { status: 'not_found' }
  const shop = shopRes.rows[0]
  if (allowed && !allowed.has(shop.platform_code)) {
    return { status: 'forbidden' }
  }
  return { status: 'ok', shop }
}

export async function omnichannelRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════════
  // 全渠道经营大盘
  // ═══════════════════════════════════════════════════════════════

  // ── GET /api/v1/omnichannel/overview ── 总览指标 + 同环比
  app.get<{
    Querystring: { platform?: string; from?: string; to?: string; shopId?: string }
  }>('/api/v1/omnichannel/overview', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { platform, from, to, shopId } = request.query
      const r = resolveRange(from, to)
      const prev = previousRange(r.from, r.to)

      const { cur, pre } = await withRlsContext(request, async (client) => {
        const allowed = await accessiblePlatforms(client, request)
        const pc = platformClause(platform, allowed)
        const buildQuery = async (range: { from: string; to: string }) => {
          const params: any[] = [range.from, range.to, ...pc.params]
          let sql = `
            SELECT
              COALESCE(sum(gmv), 0)::numeric           AS gmv,
              COALESCE(sum(pay_amount), 0)::numeric    AS pay_amount,
              COALESCE(sum(paid_order_count), 0)::int  AS paid_order_count,
              COALESCE(sum(paid_buyer_count), 0)::int  AS paid_buyer_count,
              COALESCE(sum(refund_amount), 0)::numeric AS refund_amount
            FROM fact_trade_daily f
            ${DEFAULT_CALIBER_JOIN}
            WHERE f.biz_date BETWEEN $1::date AND $2::date
            ${DEFAULT_CALIBER_COND}
            ${pc.sql}`
          if (shopId) {
            params.push(parseInt(shopId, 10))
            sql += ` AND f.shop_id = $${params.length}`
          }
          const res = await client.query(sql, params)
          return res.rows[0]
        }
        return {
          cur: await buildQuery(r),
          pre: await buildQuery(prev),
        }
      })

      const num = (v: any) => Number(v || 0)
      const pct = (a: number, b: number) => (b === 0 ? null : ((a - b) / b) * 100)

      const refundRate = computeRefundRatePct(num(cur.refund_amount), num(cur.gmv), 2)
      const aov = num(cur.paid_order_count) > 0 ? num(cur.gmv) / num(cur.paid_order_count) : 0

      return sendOk(reply, {
        range: r,
        previousRange: prev,
        current: {
          gmv: num(cur.gmv),
          payAmount: num(cur.pay_amount),
          paidOrderCount: num(cur.paid_order_count),
          paidBuyerCount: num(cur.paid_buyer_count),
          refundAmount: num(cur.refund_amount),
          refundRate,
          netSales: num(cur.gmv) - num(cur.refund_amount),
          avgOrderValue: Number(aov.toFixed(2)),
        },
        previous: {
          gmv: num(pre.gmv),
          payAmount: num(pre.pay_amount),
          paidOrderCount: num(pre.paid_order_count),
          paidBuyerCount: num(pre.paid_buyer_count),
          refundAmount: num(pre.refund_amount),
        },
        growth: {
          gmv: pct(num(cur.gmv), num(pre.gmv)),
          payAmount: pct(num(cur.pay_amount), num(pre.pay_amount)),
          paidOrderCount: pct(num(cur.paid_order_count), num(pre.paid_order_count)),
          paidBuyerCount: pct(num(cur.paid_buyer_count), num(pre.paid_buyer_count)),
          refundAmount: pct(num(cur.refund_amount), num(pre.refund_amount)),
        },
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to build omnichannel overview')
      return sendError(reply, 500, '获取全渠道总览失败')
    }
  })

  // ── GET /api/v1/omnichannel/platforms ── 平台对比矩阵
  app.get<{
    Querystring: { from?: string; to?: string }
  }>('/api/v1/omnichannel/platforms', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { from, to } = request.query
      const r = resolveRange(from, to)

      const { rows, caliberCheck } = await withRlsContext(request, async (client) => {
        const allowed = await accessiblePlatforms(client, request)
        const pc = platformClause(undefined, allowed)
        const res = await client.query(
          `SELECT
             f.platform_code,
             p.platform_name,
             p.category,
             COALESCE(sum(f.gmv), 0)::numeric           AS gmv,
             COALESCE(sum(f.pay_amount), 0)::numeric    AS pay_amount,
             COALESCE(sum(f.paid_order_count), 0)::int  AS paid_order_count,
             COALESCE(sum(f.paid_buyer_count), 0)::int  AS paid_buyer_count,
             COALESCE(sum(f.refund_amount), 0)::numeric AS refund_amount,
             CASE WHEN sum(f.gmv) > 0
                  THEN round(sum(f.refund_amount) / sum(f.gmv) * 100, 2)
                  ELSE 0 END                             AS refund_rate,
             CASE WHEN sum(f.paid_order_count) > 0
                  THEN round(sum(f.gmv) / sum(f.paid_order_count), 2)
                  ELSE 0 END                             AS avg_order_value,
             count(DISTINCT f.shop_id)::int             AS shop_count
           FROM fact_trade_daily f
           JOIN system_platform_configs p ON p.platform_code = f.platform_code
           ${DEFAULT_CALIBER_JOIN}
           WHERE f.biz_date BETWEEN $1::date AND $2::date
             AND p.is_enabled = true
             ${DEFAULT_CALIBER_COND}
           ${pc.sql}
           GROUP BY f.platform_code, p.platform_name, p.category, p.sort_order
           ORDER BY gmv DESC`,
          [r.from, r.to, ...pc.params],
        )

        // 口径可比性校验：跨平台 GMV 加总在口径不同时不可直接加总
        let check: any = null
        const codes = res.rows.map((x: any) => x.platform_code).filter(Boolean)
        if (codes.length > 1) {
          await client.query('SAVEPOINT sp_omni_caliber')
          try {
            check = await checkComparability(codes, 'gmv', client)
            await client.query('RELEASE SAVEPOINT sp_omni_caliber')
          } catch {
            await client.query('ROLLBACK TO SAVEPOINT sp_omni_caliber')
            check = null
          }
        }
        return { rows: res.rows, caliberCheck: check }
      })

      const totalGmv = rows.reduce((s: number, x: any) => s + Number(x.gmv), 0)
      const comparableTotalGmv = caliberCheck && !caliberCheck.comparable ? null : totalGmv

      return sendOk(reply, {
        range: r,
        totalGmv,
        comparableTotalGmv,
        caliberCheck,
        platforms: rows.map((x: any) => ({
          ...x,
          gmv: Number(x.gmv),
          pay_amount: Number(x.pay_amount),
          refund_amount: Number(x.refund_amount),
          refund_rate: Number(x.refund_rate),
          avg_order_value: Number(x.avg_order_value),
          gmv_share: totalGmv > 0 ? Number(((Number(x.gmv) / totalGmv) * 100).toFixed(2)) : 0,
        })),
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to build platform comparison')
      return sendError(reply, 500, '获取平台对比失败')
    }
  })

  // ── GET /api/v1/omnichannel/shops ── 店铺排行
  app.get<{
    Querystring: { platform?: string; from?: string; to?: string; limit?: string }
  }>('/api/v1/omnichannel/shops', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { platform, from, to, limit } = request.query
      const r = resolveRange(from, to)
      const lim = Math.min(parseInt(limit || '50', 10) || 50, 200)

      const { rows } = await withRlsContext(request, async (client) => {
        const allowed = await accessiblePlatforms(client, request)
        const pc = platformClause(platform, allowed)
        return client.query(
          `SELECT
             f.shop_id,
             s.shop_name,
             f.platform_code,
             p.platform_name,
             COALESCE(sum(f.gmv), 0)::numeric           AS gmv,
             COALESCE(sum(f.paid_order_count), 0)::int  AS paid_order_count,
             COALESCE(sum(f.refund_amount), 0)::numeric AS refund_amount,
             CASE WHEN sum(f.gmv) > 0
                  THEN round(sum(f.refund_amount) / sum(f.gmv) * 100, 2)
                  ELSE 0 END                             AS refund_rate
           FROM fact_trade_daily f
           JOIN dim_shop s ON s.id = f.shop_id
           JOIN system_platform_configs p ON p.platform_code = f.platform_code
           ${DEFAULT_CALIBER_JOIN}
           WHERE f.biz_date BETWEEN $1::date AND $2::date
             ${DEFAULT_CALIBER_COND}
           ${pc.sql}
           GROUP BY f.shop_id, s.shop_name, f.platform_code, p.platform_name
           ORDER BY gmv DESC
           LIMIT ${lim}`,
          [r.from, r.to, ...pc.params],
        )
      })

      return sendOk(reply, rows.map((x: any) => ({
        ...x,
        gmv: Number(x.gmv),
        refund_amount: Number(x.refund_amount),
        refund_rate: Number(x.refund_rate),
      })))
    } catch (err) {
      request.log.error({ err }, 'Failed to build shop ranking')
      return sendError(reply, 500, '获取店铺排行失败')
    }
  })

  // ── GET /api/v1/omnichannel/trend ── 经营趋势（按日）
  app.get<{
    Querystring: { platform?: string; from?: string; to?: string; shopId?: string }
  }>('/api/v1/omnichannel/trend', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { platform, from, to, shopId } = request.query
      const r = resolveRange(from, to)

      const { rows } = await withRlsContext(request, async (client) => {
        const allowed = await accessiblePlatforms(client, request)
        const pc = platformClause(platform, allowed)

        const params: any[] = [r.from, r.to, ...pc.params]
        let sql = `
          SELECT
            f.biz_date,
            COALESCE(sum(f.gmv), 0)::numeric          AS gmv,
            COALESCE(sum(f.pay_amount), 0)::numeric   AS pay_amount,
            COALESCE(sum(f.paid_order_count), 0)::int AS paid_order_count,
            COALESCE(sum(f.refund_amount), 0)::numeric AS refund_amount
          FROM fact_trade_daily f
          ${DEFAULT_CALIBER_JOIN}
          WHERE f.biz_date BETWEEN $1::date AND $2::date
          ${DEFAULT_CALIBER_COND}
          ${pc.sql}`
        if (shopId) {
          params.push(parseInt(shopId, 10))
          sql += ` AND f.shop_id = $${params.length}`
        }
        sql += ` GROUP BY f.biz_date ORDER BY f.biz_date`

        return client.query(sql, params)
      })
      return sendOk(reply, rows.map((x: any) => ({
        ...x,
        gmv: Number(x.gmv),
        pay_amount: Number(x.pay_amount),
        refund_amount: Number(x.refund_amount),
      })))
    } catch (err) {
      request.log.error({ err }, 'Failed to build trend')
      return sendError(reply, 500, '获取经营趋势失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 货架店铺经营看板
  // ═══════════════════════════════════════════════════════════════

  // ── GET /api/v1/omnichannel/shop/:id ── 单店铺经营详情
  app.get<{
    Params: { id: string }
    Querystring: { from?: string; to?: string }
  }>('/api/v1/omnichannel/shop/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const { from, to } = request.query
      const r = resolveRange(from, to)

      const scoped = await withRlsContext(request, async (client) => {
        const shopCheck = await loadAccessibleShop(client, request, shopId)
        if (shopCheck.status === 'not_found') return { notFound: true as const }
        if (shopCheck.status === 'forbidden') return { forbidden: true as const }
        const shop = shopCheck.shop

        // 交易汇总
        const tradeRes = await client.query(
          `SELECT
             COALESCE(sum(gmv), 0)::numeric           AS gmv,
             COALESCE(sum(pay_amount), 0)::numeric    AS pay_amount,
             COALESCE(sum(paid_order_count), 0)::int  AS paid_order_count,
             COALESCE(sum(paid_buyer_count), 0)::int  AS paid_buyer_count,
             COALESCE(sum(refund_amount), 0)::numeric AS refund_amount,
             CASE WHEN sum(gmv) > 0 THEN round(sum(refund_amount)/sum(gmv)*100, 2) ELSE 0 END AS refund_rate,
             CASE WHEN sum(paid_order_count) > 0 THEN round(sum(gmv)/sum(paid_order_count), 2) ELSE 0 END AS avg_order_value
           FROM fact_trade_daily f
           ${DEFAULT_CALIBER_JOIN}
           WHERE f.shop_id = $1 AND f.biz_date BETWEEN $2::date AND $3::date
           ${DEFAULT_CALIBER_COND}`,
          [shopId, r.from, r.to],
        )

        // 流量汇总
        const trafficRes = await client.query(
          `SELECT
             COALESCE(sum(impressions), 0)::bigint AS impressions,
             COALESCE(sum(clicks), 0)::bigint      AS clicks,
             COALESCE(sum(visitors), 0)::bigint    AS visitors,
             CASE WHEN sum(impressions) > 0 THEN round(sum(clicks)::numeric/sum(impressions)*100, 2) ELSE 0 END AS ctr
           FROM fact_traffic_daily
           WHERE shop_id = $1 AND biz_date BETWEEN $2::date AND $3::date`,
          [shopId, r.from, r.to],
        )

        // 渠道结构
        const channelRes = await client.query(
          `SELECT f.channel_name,
                  COALESCE(sum(f.gmv), 0)::numeric AS gmv,
                  COALESCE(sum(f.paid_order_count), 0)::int AS orders
             FROM fact_trade_daily f
             ${DEFAULT_CALIBER_JOIN}
            WHERE f.shop_id = $1 AND f.biz_date BETWEEN $2::date AND $3::date
            ${DEFAULT_CALIBER_COND}
            GROUP BY f.channel_name ORDER BY gmv DESC`,
          [shopId, r.from, r.to],
        )

        // 日趋势
        const dailyRes = await client.query(
          `SELECT f.biz_date,
                  COALESCE(sum(f.gmv), 0)::numeric AS gmv,
                  COALESCE(sum(f.paid_order_count), 0)::int AS orders
             FROM fact_trade_daily f
             ${DEFAULT_CALIBER_JOIN}
            WHERE f.shop_id = $1 AND f.biz_date BETWEEN $2::date AND $3::date
            ${DEFAULT_CALIBER_COND}
            GROUP BY f.biz_date ORDER BY f.biz_date`,
          [shopId, r.from, r.to],
        )

        return { shop, tradeRes, trafficRes, channelRes, dailyRes }
      })

      if ('notFound' in scoped && scoped.notFound) return sendError(reply, 404, '店铺不存在')
      if ('forbidden' in scoped && scoped.forbidden) return sendError(reply, 403, '无权访问该平台数据')
      const { shop, tradeRes, trafficRes, channelRes, dailyRes } = scoped

      const t = tradeRes.rows[0]
      const tr = trafficRes.rows[0]

      return sendOk(reply, {
        shop,
        range: r,
        trade: {
          gmv: Number(t.gmv),
          payAmount: Number(t.pay_amount),
          paidOrderCount: t.paid_order_count,
          paidBuyerCount: t.paid_buyer_count,
          refundAmount: Number(t.refund_amount),
          refundRate: Number(t.refund_rate),
          avgOrderValue: Number(t.avg_order_value),
        },
        traffic: {
          impressions: Number(tr.impressions),
          clicks: Number(tr.clicks),
          visitors: Number(tr.visitors),
          ctr: Number(tr.ctr),
        },
        channels: channelRes.rows.map((x: any) => ({ ...x, gmv: Number(x.gmv) })),
        daily: dailyRes.rows.map((x: any) => ({ ...x, gmv: Number(x.gmv) })),
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to build shop detail')
      return sendError(reply, 500, '获取店铺经营详情失败')
    }
  })

  // ── GET /api/v1/omnichannel/shop/:id/products ── 店铺 SKU 级订单明细销售聚合
  app.get<{
    Params: { id: string }
    Querystring: { from?: string; to?: string; limit?: string }
  }>('/api/v1/omnichannel/shop/:id/products', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const shopId = parseInt(request.params.id, 10)
      if (!Number.isFinite(shopId)) return sendError(reply, 400, '无效的店铺 ID')
      const { from, to, limit } = request.query
      const r = resolveRange(from, to)
      const lim = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 200)
      const allowCost = await canAccessCostAsync(
        (user as any).id, user.role, user.userType, undefined)

      const scoped = await withRlsContext(request, async (client) => {
        const shopCheck = await loadAccessibleShop(client, request, shopId)
        if (shopCheck.status === 'not_found') return { notFound: true as const }
        if (shopCheck.status === 'forbidden') return { forbidden: true as const }
        const shop = shopCheck.shop

        const res = await client.query(
          `SELECT
             COALESCE(p.id, 0)::bigint                                    AS product_id,
             COALESCE(p.spu_code, '')                                     AS spu_code,
             COALESCE(p.sku_code, coi.platform_sku_id, '')                AS sku_code,
             COALESCE(p.product_name, coi.product_name, '未匹配商品')       AS product_name,
             COALESCE(p.category, '未分类')                                AS category,
             MAX(COALESCE(coi.platform_sku_id, ''))                       AS platform_sku_id,
             COALESCE(SUM(coi.quantity), 0)::numeric                      AS sold_qty,
             COUNT(DISTINCT coi.source_order_id)::int                     AS order_count,
             COALESCE(SUM(coi.item_paid_amount), 0)::numeric              AS paid_amount,
             COALESCE(SUM(coi.item_discount_allocated), 0)::numeric       AS discount_allocated,
             COALESCE(MAX(p.retail_price), 0)::numeric                    AS retail_price,
             COALESCE(MAX(p.unit_cost), 0)::numeric                       AS unit_cost
           FROM canonical_order_items coi
           LEFT JOIN dim_product p ON p.id = coi.internal_sku_id
           WHERE coi.store_id = $1
             AND coi.biz_date BETWEEN $2::date AND $3::date
             AND coi.maturity_status <> 'SUPERSEDED'
           GROUP BY
             COALESCE(p.id, 0),
             COALESCE(p.spu_code, ''),
             COALESCE(p.sku_code, coi.platform_sku_id, ''),
             COALESCE(p.product_name, coi.product_name, '未匹配商品'),
             COALESCE(p.category, '未分类')
           ORDER BY paid_amount DESC, sold_qty DESC
           LIMIT $4`,
          [shopId, r.from, r.to, lim],
        )

        return { shop, rows: res.rows }
      })

      if ('notFound' in scoped && scoped.notFound) return sendError(reply, 404, '店铺不存在')
      if ('forbidden' in scoped && scoped.forbidden) return sendError(reply, 403, '无权访问该平台数据')

      const items = scoped.rows.map((row: any) => {
        const soldQty = Number(row.sold_qty || 0)
        const paidAmount = Number(row.paid_amount || 0)
        const discountAllocated = Number(row.discount_allocated || 0)
        const unitCost = Number(row.unit_cost || 0)
        const estimatedCost = unitCost > 0 ? Number((unitCost * soldQty).toFixed(2)) : 0
        const estimatedProfit = Number((paidAmount - estimatedCost).toFixed(2))
        const marginRatePct = paidAmount > 0 ? Number(((estimatedProfit / paidAmount) * 100).toFixed(2)) : 0

        return {
          productId: Number(row.product_id),
          spuCode: row.spu_code,
          skuCode: row.sku_code,
          productName: row.product_name,
          category: row.category,
          platformSkuId: row.platform_sku_id,
          soldQty: Number(soldQty.toFixed(2)),
          orderCount: Number(row.order_count || 0),
          paidAmount: Number(paidAmount.toFixed(2)),
          discountAllocated: Number(discountAllocated.toFixed(2)),
          avgUnitPrice: soldQty > 0 ? Number((paidAmount / soldQty).toFixed(2)) : 0,
          retailPrice: Number(row.retail_price || 0),
          unitCost: allowCost ? unitCost : null,
          estimatedCost: allowCost ? estimatedCost : null,
          estimatedProfit: allowCost ? estimatedProfit : null,
          marginRatePct: allowCost ? marginRatePct : null,
        }
      })

      return sendOk(reply, {
        shop: scoped.shop,
        range: r,
        costMasked: !allowCost,
        summary: {
          totalSkuCount: items.length,
          totalSoldQty: Number(items.reduce((s: number, i: any) => s + i.soldQty, 0).toFixed(2)),
          totalPaidAmount: Number(items.reduce((s: number, i: any) => s + i.paidAmount, 0).toFixed(2)),
          totalDiscountAllocated: Number(items.reduce((s: number, i: any) => s + i.discountAllocated, 0).toFixed(2)),
        },
        items,
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to build shop SKU products analytics')
      return sendError(reply, 500, '获取店铺商品 SKU 明细失败')
    }
  })

  // ── GET /api/v1/omnichannel/capabilities ── 当前用户可见的平台能力矩阵（供前端动态导航）
  app.get('/api/v1/omnichannel/capabilities', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const visible = await withRlsContext(request, async (client) => {
        const allowed = await accessiblePlatforms(client, request)
        const { rows } = await client.query(
          `SELECT platform_code, platform_name, category, is_enabled, sort_order
             FROM system_platform_configs
            WHERE is_enabled = true
            ORDER BY sort_order`,
        )
        return rows.filter((r: any) => !allowed || allowed.has(r.platform_code))
      })
      return sendOk(reply, {
        platforms: visible,
        hasLive: visible.some((r: any) => r.category === 'live'),
        hasShelf: visible.some((r: any) => r.category === 'shelf'),
        hasContent: visible.some((r: any) => r.category === 'content'),
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to build capability matrix')
      return sendError(reply, 500, '获取平台能力矩阵失败')
    }
  })
}
