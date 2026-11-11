/**
 * taobao-analytics.ts — 淘宝/天猫专属分析服务
 *
 * 基于调研结论（docs/platform-business-model-comparison.md）：
 *   - 经营对象：店铺 + SKU，父子订单双层结构
 *   - 核心指标：支付金额/支付买家数/支付转化率/客单价/动销率/DSR
 *   - 店铺类型：taobao_personal | taobao_enterprise | tmall（不拆平台）
 *   - 投放：万相台无界版，与生意参谋口径天然不一致
 *   - DSR：三项评分，最近 180 天滚动
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'
import { getDefaultCaliber } from '../platform/caliber.js'

/** 百分比格式化：统一保留 2 位小数，避免 1.00 显示成 1 */
function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Number(((numerator / denominator) * 100).toFixed(2))
}

export interface TaobaoShopMetrics {
  shopId: number
  shopName: string
  shopType: string | null
  // 交易
  payAmount: number
  payBuyerCount: number
  payOrderCount: number
  avgOrderValue: number
  payConversionRate: number | null  // 支付买家数 / 访客数
  // 流量
  visitors: number
  pageViews: number
  // 商品
  itemCount: number
  activeItemCount: number
  sellThroughRate: number | null     // 动销率 = 支付商品数 / 在线商品数
  // 退款
  refundAmount: number
  refundRate: number
  // 口径
  caliber: {
    amountType: string
    amountTypeName: string
    displayNote: string
  } | null
}

/** 店铺经营指标（淘宝/天猫） */
export async function getTaobaoShopMetrics(
  shopId: number,
  from: string,
  to: string,
  pool?: Pool,
): Promise<TaobaoShopMetrics | null> {
  const p = pool || getPool()

  const shopRes = await p.query(
    `SELECT id, shop_name, shop_type, platform_code FROM dim_shop WHERE id = $1`,
    [shopId],
  )
  if (shopRes.rows.length === 0) return null
  const shop = shopRes.rows[0]

  // 交易指标（用默认口径 amount_type）
  const tradeRes = await p.query(
    `SELECT
       COALESCE(SUM(f.gmv), 0)::numeric             AS pay_amount,
       COALESCE(SUM(f.paid_buyer_count), 0)::int    AS pay_buyer,
       COALESCE(SUM(f.paid_order_count), 0)::int    AS pay_order,
       COALESCE(SUM(f.refund_amount), 0)::numeric   AS refund_amount
     FROM fact_trade_daily f
     LEFT JOIN platform_caliber_config pcc
       ON pcc.platform_code = f.platform_code
      AND pcc.metric_code = 'gmv'
      AND pcc.is_default = true
     WHERE f.shop_id = $1
       AND f.biz_date BETWEEN $2::date AND $3::date
       AND (pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type)`,
    [shopId, from, to],
  )
  const t = tradeRes.rows[0]

  // 流量指标
  const trafficRes = await p.query(
    `SELECT
       COALESCE(SUM(visitors), 0)::bigint      AS visitors,
       COALESCE(SUM(clicks), 0)::bigint        AS page_views
     FROM fact_traffic_daily
     WHERE shop_id = $1
       AND biz_date BETWEEN $2::date AND $3::date`,
    [shopId, from, to],
  )
  const v = trafficRes.rows[0]

  // 商品指标（父子订单结构）
  const itemRes = await p.query(
    `SELECT
       COUNT(DISTINCT sku_code)::int                              AS item_count,
       COUNT(DISTINCT CASE WHEN pay_amount > 0 THEN sku_code END)::int AS active_items
     FROM taobao_order_hierarchy
     WHERE shop_id = $1
       AND biz_date BETWEEN $2::date AND $3::date
       AND sku_code <> ''`,
    [shopId, from, to],
  )
  const i = itemRes.rows[0]

  const payAmount = Number(t.pay_amount)
  const payBuyer = Number(t.pay_buyer)
  const payOrder = Number(t.pay_order)
  const visitors = Number(v.visitors)
  const refundAmount = Number(t.refund_amount)

  const caliber = await getDefaultCaliber(shop.platform_code, 'gmv', p)

  return {
    shopId: shop.id,
    shopName: shop.shop_name,
    shopType: shop.shop_type,
    payAmount,
    payBuyerCount: payBuyer,
    payOrderCount: payOrder,
    avgOrderValue: payBuyer > 0 ? Number((payAmount / payBuyer).toFixed(2)) : 0,
    payConversionRate: pct(payBuyer, visitors),
    visitors,
    pageViews: Number(v.page_views),
    itemCount: Number(i.item_count),
    activeItemCount: Number(i.active_items),
    sellThroughRate: pct(Number(i.active_items), Number(i.item_count)),
    refundAmount,
    refundRate: pct(refundAmount, payAmount) ?? 0,
    caliber: caliber ? {
      amountType: caliber.amountType,
      amountTypeName: caliber.amountTypeName,
      displayNote: caliber.displayNote,
    } : null,
  }
}

/** 商品结构分析（父子订单） */
export async function getTaobaoProductStructure(
  shopId: number,
  from: string,
  to: string,
  limit = 50,
  pool?: Pool,
): Promise<Array<{
  skuCode: string
  payAmount: number
  refundAmount: number
  quantity: number
  orderCount: number
  avgPrice: number
}>> {
  const p = pool || getPool()
  const { rows } = await p.query(
    `SELECT
       sku_code,
       COALESCE(SUM(pay_amount), 0)::numeric    AS pay_amount,
       COALESCE(SUM(refund_amount), 0)::numeric AS refund_amount,
       COALESCE(SUM(quantity), 0)::int          AS quantity,
       COUNT(DISTINCT sub_order_id)::int        AS order_count
     FROM taobao_order_hierarchy
     WHERE shop_id = $1
       AND biz_date BETWEEN $2::date AND $3::date
       AND sku_code <> ''
     GROUP BY sku_code
     ORDER BY pay_amount DESC
     LIMIT ${Math.min(limit, 200)}`,
    [shopId, from, to],
  )

  return rows.map((r: any) => {
    const amount = Number(r.pay_amount)
    const qty = Number(r.quantity)
    return {
      skuCode: r.sku_code,
      payAmount: amount,
      refundAmount: Number(r.refund_amount),
      quantity: qty,
      orderCount: Number(r.order_count),
      avgPrice: qty > 0 ? Number((amount / qty).toFixed(2)) : 0,
    }
  })
}

/** 渠道结构（淘系三级：淘内免费 / 淘内付费 / 淘外） */
export async function getTaobaoChannelSplit(
  shopId: number,
  from: string,
  to: string,
  pool?: Pool,
): Promise<Array<{ level1: string; level2: string; gmv: number; visitors: number; share: number }>> {
  const p = pool || getPool()
  const { rows } = await p.query(
    `SELECT
       COALESCE(ds.level1, '其他') AS level1,
       COALESCE(ds.level2, '未分类') AS level2,
       COALESCE(SUM(f.gmv), 0)::numeric AS gmv
     FROM fact_trade_daily f
     LEFT JOIN dim_traffic_source ds ON ds.code = f.source_code
     LEFT JOIN platform_caliber_config pcc
       ON pcc.platform_code = f.platform_code
      AND pcc.metric_code = 'gmv'
      AND pcc.is_default = true
     WHERE f.shop_id = $1
       AND f.biz_date BETWEEN $2::date AND $3::date
       AND (pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type)
     GROUP BY 1, 2
     ORDER BY gmv DESC`,
    [shopId, from, to],
  )

  const total = rows.reduce((s: number, r: any) => s + Number(r.gmv), 0) || 1

  return rows.map((r: any) => ({
    level1: r.level1,
    level2: r.level2,
    gmv: Number(r.gmv),
    visitors: 0,
    share: pct(Number(r.gmv), total) ?? 0,
  }))
}

/**
 * 万相台投放分析 + 双源对账
 * 关键：万相台（广告口径）与生意参谋（经营口径）天然不一致，必须同时展示
 */
export async function getTaobaoAdReconciliation(
  shopId: number,
  from: string,
  to: string,
  pool?: Pool,
): Promise<{
  adPlatform: { spend: number; gmv: number; roi: number }
  merchant: { gmv: number; roi: number }
  diffPct: number | null
  warning: string
  byTool: Array<{ tool: string; spend: number; adGmv: number; roi: number }>
}> {
  const p = pool || getPool()

  const adRes = await p.query(
    `SELECT
       COALESCE(SUM(ad_spend), 0)::numeric AS spend,
       COALESCE(SUM(ad_gmv), 0)::numeric   AS ad_gmv
     FROM fact_ad_daily
     WHERE shop_id = $1 AND biz_date BETWEEN $2::date AND $3::date`,
    [shopId, from, to],
  )

  const tradeRes = await p.query(
    `SELECT COALESCE(SUM(f.gmv), 0)::numeric AS gmv
       FROM fact_trade_daily f
       LEFT JOIN platform_caliber_config pcc
         ON pcc.platform_code = f.platform_code
        AND pcc.metric_code = 'gmv'
        AND pcc.is_default = true
      WHERE f.shop_id = $1
        AND f.biz_date BETWEEN $2::date AND $3::date
        AND (pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type)`,
    [shopId, from, to],
  )

  const toolRes = await p.query(
    `SELECT
       COALESCE(ad_tool, '未标注') AS tool,
       COALESCE(SUM(ad_spend), 0)::numeric AS spend,
       COALESCE(SUM(ad_gmv), 0)::numeric   AS ad_gmv
     FROM fact_ad_daily
     WHERE shop_id = $1 AND biz_date BETWEEN $2::date AND $3::date
     GROUP BY 1 ORDER BY ad_gmv DESC`,
    [shopId, from, to],
  )

  const spend = Number(adRes.rows[0]?.spend || 0)
  const adGmv = Number(adRes.rows[0]?.ad_gmv || 0)
  const merchantGmv = Number(tradeRes.rows[0]?.gmv || 0)

  return {
    adPlatform: {
      spend,
      gmv: adGmv,
      roi: spend > 0 ? Number((adGmv / spend).toFixed(2)) : 0,
    },
    merchant: {
      gmv: merchantGmv,
      roi: spend > 0 ? Number((merchantGmv / spend).toFixed(2)) : 0,
    },
    diffPct: merchantGmv > 0
      ? Number((((adGmv - merchantGmv) / merchantGmv) * 100).toFixed(2))
      : null,
    warning: '万相台（广告后台）与生意参谋（经营后台）因去重方式与归因窗口不同，数据天然存在差异，此为正常现象，不应强行对齐。',
    byTool: toolRes.rows.map((r: any) => {
      const sp = Number(r.spend)
      const gm = Number(r.ad_gmv)
      return {
        tool: r.tool,
        spend: sp,
        adGmv: gm,
        roi: sp > 0 ? Number((gm / sp).toFixed(2)) : 0,
      }
    }),
  }
}

/**
 * DSR 与店铺体验分
 * DSR 取最近 180 天滚动；体验分 ≥ 4.8 影响仅退款自主权
 */
export async function getTaobaoDsrStatus(
  shopId: number,
  pool?: Pool,
): Promise<{
  dsr: { descriptionMatch: number | null; serviceAttitude: number | null; logisticsService: number | null }
  window: string
  onlyRefundAutonomy: boolean
  threshold: number
  note: string
}> {
  const p = pool || getPool()

  // DSR 数据暂无专表，先返回结构并说明数据来源
  const slaRes = await p.query(
    `SELECT threshold_hours, penalty_note, is_verified
       FROM platform_sla_config
      WHERE platform_code = 'taobao' AND sla_type = 'only_refund_autonomy'`,
  )

  return {
    dsr: {
      descriptionMatch: null,
      serviceAttitude: null,
      logisticsService: null,
    },
    window: '最近 180 天滚动',
    onlyRefundAutonomy: false,
    threshold: 4.8,
    note: slaRes.rows[0]?.penalty_note || '店铺综合体验分 ≥ 4.8 时平台不主动介入收货后仅退款',
  }
}
