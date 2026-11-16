/**
 * tmall-analytics.ts — 天猫专属分析服务
 *
 * 天猫与淘宝的结构差异：
 *   1. **品牌自播为主**：一场直播即一次品牌内容投放，应按**品牌维度**而非直播间维度看
 *   2. **五层抵扣**：跨店满减 + 官方立减 + 百亿补贴 + 品类券 + 店铺券可叠加，
 *      真实毛利必须按商家承担比例重算
 *   3. **结算 T+7**：比淘宝（T+10）快
 *   4. **大促强绑定**：天猫直播的 GMV 高度集中在双11/618 等大促期
 */

import type { DbExecutor } from '../lib/audit.js'

export interface TmallBrandSessionRow {
  shopId: number
  shopName: string
  brandName: string | null
  sessions: number
  gmv: number
  orders: number
  minutes: number
  avgPeak: number
  gmvPerSession: number
}

/** 品牌 × 场次视图：按品牌聚合天猫直播表现 */
export async function getTmallBrandSessions(
  from: string,
  to: string,
  client: DbExecutor,
  shopId?: number,
): Promise<{
  range: { from: string; to: string }
  summary: {
    brands: number
    shops: number
    sessions: number
    totalGmv: number
    gmvPerSession: number
    gmvPerMinute: number
  }
  brands: TmallBrandSessionRow[]
  note: string
}> {
  const params: any[] = [from, to]
  let shopCond = ''
  if (shopId && Number.isFinite(shopId)) {
    params.push(shopId)
    shopCond = ` AND r.shop_id = $${params.length}`
  }

  const res = await client.query(
    `SELECT r.shop_id,
            COALESCE(sh.shop_name, '未绑定店铺')  AS shop_name,
            COALESCE(br.brand_name, NULL)        AS brand_name,
            COUNT(DISTINCT ls.id)::int           AS sessions,
            COALESCE(SUM(ls.gmv), 0)::numeric(14,2)     AS gmv,
            COALESCE(SUM(ls.orders), 0)::int     AS orders,
            COALESCE(SUM(ls.duration_min), 0)::int AS minutes,
            COALESCE(ROUND(AVG(ls.online_peak)), 0)::int AS avg_peak
       FROM public.live_sessions ls
       JOIN public.live_rooms r ON r.id = ls.room_id
       LEFT JOIN public.dim_shop sh ON sh.id = r.shop_id
       LEFT JOIN public.dim_brand br ON br.id = sh.brand_id
      WHERE r.platform_code = 'tmall'
        AND ls.date BETWEEN $1::date AND $2::date${shopCond}
      GROUP BY r.shop_id, sh.shop_name, br.brand_name
      ORDER BY gmv DESC`,
    params,
  )

  const brands: TmallBrandSessionRow[] = res.rows.map((r: any) => {
    const sessions = Number(r.sessions || 0)
    const gmv = Number(r.gmv || 0)
    return {
      shopId: Number(r.shop_id),
      shopName: r.shop_name,
      brandName: r.brand_name || null,
      sessions,
      gmv: Number(gmv.toFixed(2)),
      orders: Number(r.orders || 0),
      minutes: Number(r.minutes || 0),
      avgPeak: Number(r.avg_peak || 0),
      gmvPerSession: sessions > 0 ? Number((gmv / sessions).toFixed(2)) : 0,
    }
  })

  const totalGmv = brands.reduce((a, b) => a + b.gmv, 0)
  const totalSessions = brands.reduce((a, b) => a + b.sessions, 0)
  const totalMinutes = brands.reduce((a, b) => a + b.minutes, 0)

  return {
    range: { from, to },
    summary: {
      brands: brands.filter((b) => b.brandName).length,
      shops: brands.length,
      sessions: totalSessions,
      totalGmv: Number(totalGmv.toFixed(2)),
      gmvPerSession: totalSessions > 0 ? Number((totalGmv / totalSessions).toFixed(2)) : 0,
      gmvPerMinute: totalMinutes > 0 ? Number((totalGmv / totalMinutes).toFixed(2)) : 0,
    },
    brands,
    note: '天猫以品牌自播为主：一场直播 = 一次品牌内容投放，应按品牌维度合并多店多场次判断',
  }
}

export interface TmallPromotionLayer {
  ruleLayer: number
  ruleName: string
  discountMode: string
  discountValue: number
  merchantCostRatio: number
  platformCostRatio: number
  isActive: boolean
  note: string
}

/** 五层抵扣规则（天猫独有结构） */
export async function getTmallPromotionLayers(
  client: DbExecutor,
): Promise<{
  summary: {
    layers: number
    merchantCostTotal: number
    platformCostTotal: number
    finalPriceFor100: number
  }
  layers: TmallPromotionLayer[]
  simulation: Array<{ layer: number; ruleName: string; before: number; after: number }>
  note: string
}> {
  const res = await client.query(
    `SELECT rule_layer, rule_name, discount_mode, discount_value,
            merchant_cost_ratio, platform_cost_ratio, is_active, note
       FROM public.pricing_rules
      WHERE platform_code = 'tmall'
      ORDER BY rule_layer ASC, rule_name ASC`,
  )

  const layers: TmallPromotionLayer[] = res.rows.map((r: any, i: number) => ({
    ruleLayer: Number(r.rule_layer || i + 1),
    ruleName: r.rule_name || '',
    discountMode: r.discount_mode || 'rate',
    discountValue: Number(r.discount_value || 0),
    merchantCostRatio: Number(r.merchant_cost_ratio || 0),
    platformCostRatio: Number(r.platform_cost_ratio || 0),
    isActive: Boolean(r.is_active),
    note: r.note || '',
  }))

  // 100 元零售价逐层叠加模拟
  //
  // ⚠️ 关键：discount_mode 存的是**业务类型**（official_reduction / store_coupon / ...），
  //    不是计算方式。计算语义必须从 discount_value 推断：
  //      · 0 < value < 1  → 折扣率（0.15 = 让利 15%）
  //      · value >= 1     → 固定金额立减（15 = 减 15 元）
  //    早期实现误按 discount_mode 判断，导致 0.15 被当成「rate 且 >1」而跳过，价格永远不变。
  let price = 100
  const simulation = layers.map((l) => {
    const before = price
    if (l.discountValue > 0 && l.discountValue < 1) {
      // 折扣率：让利 value（0.15 → 打 85 折）
      price = price * (1 - l.discountValue)
    } else if (l.discountValue >= 1) {
      // 固定金额立减
      price = Math.max(0, price - l.discountValue)
    }
    return {
      layer: l.ruleLayer,
      ruleName: l.ruleName,
      before: Number(before.toFixed(2)),
      after: Number(price.toFixed(2)),
    }
  })

  return {
    summary: {
      layers: layers.length,
      merchantCostTotal: Number(layers.reduce((a, l) => a + l.merchantCostRatio, 0).toFixed(2)),
      platformCostTotal: Number(layers.reduce((a, l) => a + l.platformCostRatio, 0).toFixed(2)),
      finalPriceFor100: Number(price.toFixed(2)),
    },
    layers,
    simulation,
    note: '天猫五层抵扣：跨店满减 + 官方立减 + 百亿补贴 + 品类券 + 店铺券。真实毛利必须按商家承担比例重算',
  }
}

/** 大促期 vs 日常期的场次表现对比 */
export async function getTmallPromoCompare(
  from: string,
  to: string,
  client: DbExecutor,
  shopId?: number,
): Promise<{
  range: { from: string; to: string }
  summary: {
    promoGmv: number
    dailyGmv: number
    promoDays: number
    dailyDays: number
    promoAvg: number
    dailyAvg: number
    lift: number
  }
  daily: Array<{ date: string; phase: string; sessions: number; gmv: number; orders: number }>
  note: string
}> {
  const params: any[] = [from, to]
  let shopCond = ''
  if (shopId && Number.isFinite(shopId)) {
    params.push(shopId)
    shopCond = ` AND r.shop_id = $${params.length}`
  }

  // 天猫大促：双11（10-25~11-11）、618（05-25~06-18）
  const res = await client.query(
    `SELECT ls.date::text AS biz_date,
            COUNT(DISTINCT ls.id)::int AS sessions,
            COALESCE(SUM(ls.gmv), 0)::numeric(14,2) AS gmv,
            COALESCE(SUM(ls.orders), 0)::int AS orders,
            CASE
              WHEN ls.date BETWEEN '2026-10-25' AND '2026-11-11' THEN 'double11'
              WHEN ls.date BETWEEN '2026-05-25' AND '2026-06-18' THEN '618'
              ELSE 'daily'
            END AS phase
       FROM public.live_sessions ls
       JOIN public.live_rooms r ON r.id = ls.room_id
      WHERE r.platform_code = 'tmall'
        AND ls.date BETWEEN $1::date AND $2::date${shopCond}
      GROUP BY ls.date
      ORDER BY ls.date ASC`,
    params,
  )

  const daily = res.rows.map((r: any) => ({
    date: r.biz_date,
    phase: r.phase,
    sessions: Number(r.sessions || 0),
    gmv: Number(Number(r.gmv || 0).toFixed(2)),
    orders: Number(r.orders || 0),
  }))

  const promoRows = daily.filter((d) => d.phase !== 'daily')
  const dailyRows = daily.filter((d) => d.phase === 'daily')
  const promoGmv = promoRows.reduce((a, d) => a + d.gmv, 0)
  const dailyGmv = dailyRows.reduce((a, d) => a + d.gmv, 0)
  const promoAvg = promoRows.length > 0 ? promoGmv / promoRows.length : 0
  const dailyAvg = dailyRows.length > 0 ? dailyGmv / dailyRows.length : 0

  return {
    range: { from, to },
    summary: {
      promoGmv: Number(promoGmv.toFixed(2)),
      dailyGmv: Number(dailyGmv.toFixed(2)),
      promoDays: promoRows.length,
      dailyDays: dailyRows.length,
      promoAvg: Number(promoAvg.toFixed(2)),
      dailyAvg: Number(dailyAvg.toFixed(2)),
      lift: dailyAvg > 0 ? Number(((promoAvg / dailyAvg - 1) * 100).toFixed(2)) : 0,
    },
    daily,
    note: '大促期日均 GMV 相对日常的提升倍数（lift）是活动红利是否吃到的直接指标；若 <20% 说明活动没做透',
  }
}
