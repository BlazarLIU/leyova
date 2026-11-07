/**
 * jd-analytics.ts — 京东专属分析服务
 *
 * 基于调研结论（docs/platform-business-model-comparison.md）：
 *   京东是全平台最特殊的一个，自营与 POP 是两套完全不同的口径：
 *
 *   自营（采销）：
 *     - 京东采购部门直接采购到仓，邀约式入驻
 *     - 销售额 = 供货金额（采销额），对供货商不是收入
 *     - 毛利 = (零售价 - 供货价) / 零售价
 *     - 账期：周结/月结/60天
 *
 *   POP（平台开放计划）：
 *     - 商家自己定价、发货、售后
 *     - SOP：自发货自发开票；FBP：入京东仓由京东履约
 *     - 成交金额含货到付款（COD），口径比纯在线支付平台大
 *
 *   ⚠️ 关键约束：自营供货金额与 POP 成交金额量级与含义不同，禁止相加
 *   ⚠️ 京东售后考核最严：24h 兜底 + 48h 延迟发货 + 9-23 点客服响应
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'
import { getDefaultCaliber } from '../platform/caliber.js'

export type JdBusinessMode = 'self_operated' | 'pop_sop' | 'pop_fbp' | 'unknown'

export interface JdModeBreakdown {
  businessMode: JdBusinessMode
  businessModeName: string
  shopCount: number
  /** 自营为供货金额，POP 为成交金额 —— 二者不可相加 */
  amount: number
  amountLabel: string
  orderCount: number
  /** 自营独有：毛利 */
  grossMargin: number | null
  /** 自营独有：平均账期 */
  avgSettleDays: number | null
  note: string
}

const MODE_NAMES: Record<JdBusinessMode, string> = {
  self_operated: '自营采销',
  pop_sop: 'POP-SOP（自发货）',
  pop_fbp: 'POP-FBP（京东履约）',
  unknown: '未标注模式',
}

/** 按业务模式拆分（自营 vs POP）——禁止跨模式加总 */
export async function getJdModeBreakdown(
  from: string,
  to: string,
  platformCodes: string[] = ['jd'],
  pool?: Pool,
): Promise<{
  range: { from: string; to: string }
  modes: JdModeBreakdown[]
  warning: string
}> {
  const p = pool || getPool()

  // 取店铺及其业务模式
  const shopRes = await p.query(
    `SELECT id, shop_name, business_mode FROM dim_shop
      WHERE platform_code = ANY($1::text[])`,
    [platformCodes],
  )
  const shopMode = new Map<number, JdBusinessMode>()
  let selfShopCount = 0
  let popShopCount = 0
  for (const s of shopRes.rows) {
    // 注意：pg 对 bigint 返回字符串，必须显式转 Number，否则后面 Number(shop_id) 查询不到
    const shopId = Number(s.id)
    const mode = (s.business_mode || 'unknown') as JdBusinessMode
    shopMode.set(shopId, mode)
    if (mode === 'self_operated') selfShopCount++
    else if (mode !== 'unknown') popShopCount++
  }

  // POP 成交（fact_trade_daily）
  const popRes = await p.query(
    `SELECT shop_id,
            COALESCE(SUM(gmv), 0)::numeric          AS amount,
            COALESCE(SUM(paid_order_count), 0)::int AS orders
       FROM fact_trade_daily
      WHERE platform_code = ANY($1::text[])
        AND biz_date BETWEEN $2::date AND $3::date
      GROUP BY shop_id`,
    [platformCodes, from, to],
  )

  // 自营采销（jd_purchase_order）
  const selfRes = await p.query(
    `SELECT shop_id,
            COALESCE(SUM(settle_amount), 0)::numeric AS settle_amount,
            COALESCE(SUM(gross_margin), 0)::numeric  AS gross_margin,
            COUNT(*)::int                            AS po_count,
            COALESCE(AVG(settle_cycle_days), 0)::numeric AS avg_cycle
       FROM jd_purchase_order
      WHERE biz_date BETWEEN $1::date AND $2::date
      GROUP BY shop_id`,
    [from, to],
  )

  const selfByShop = new Map<number, { settle: number; margin: number; poCount: number; cycle: number }>()
  for (const r of selfRes.rows) {
    selfByShop.set(Number(r.shop_id), {
      settle: Number(r.settle_amount),
      margin: Number(r.gross_margin),
      poCount: Number(r.po_count),
      cycle: Number(r.avg_cycle),
    })
  }

  // 聚合到模式层
  const agg = new Map<JdBusinessMode, {
    shops: Set<number>
    amount: number
    orders: number
    margin: number
    cycleSamples: number[]
  }>()

  const ensure = (m: JdBusinessMode) => {
    if (!agg.has(m)) {
      agg.set(m, { shops: new Set(), amount: 0, orders: 0, margin: 0, cycleSamples: [] })
    }
    return agg.get(m)!
  }

  for (const r of popRes.rows) {
    const shopId = Number(r.shop_id)
    const mode = shopMode.get(shopId) || 'unknown'
    if (mode === 'self_operated') continue // 自营不从 fact_trade 取
    const a = ensure(mode)
    a.shops.add(shopId)
    a.amount += Number(r.amount)
    a.orders += Number(r.orders)
  }

  for (const [shopId, d] of selfByShop.entries()) {
    const mode = shopMode.get(shopId) || 'self_operated'
    const a = ensure('self_operated')
    a.shops.add(shopId)
    a.amount += d.settle
    a.orders += d.poCount
    a.margin += d.margin
    if (d.cycle > 0) a.cycleSamples.push(d.cycle)
  }

  const modes: JdModeBreakdown[] = []
  for (const [mode, a] of agg.entries()) {
    const isSelf = mode === 'self_operated'
    modes.push({
      businessMode: mode,
      businessModeName: MODE_NAMES[mode],
      shopCount: a.shops.size,
      amount: Number(a.amount.toFixed(2)),
      amountLabel: isSelf ? '供货金额（采销额）' : '成交金额（含货到付款）',
      orderCount: a.orders,
      grossMargin: isSelf ? Number(a.margin.toFixed(2)) : null,
      avgSettleDays: isSelf && a.cycleSamples.length > 0
        ? Number((a.cycleSamples.reduce((x, y) => x + y, 0) / a.cycleSamples.length).toFixed(1))
        : null,
      note: isSelf
        ? '自营采销：京东向供货商采购后零售，供货金额对供货商是收入但不等于零售成交额'
        : mode === 'pop_fbp'
          ? 'POP-FBP：商家入京东仓，由京东仓储配送并开票，履约质量影响店铺星级'
          : 'POP-SOP：商家自发货自发开票，要求 12 小时内发货',
    })
  }

  // 按金额降序
  modes.sort((a, b) => b.amount - a.amount)

  return {
    range: { from, to },
    modes,
    warning: selfShopCount > 0 && popShopCount > 0
      ? '⚠️ 检测到同时存在自营与 POP 店铺。自营的「供货金额」与 POP 的「成交金额」含义与量级不同，禁止相加计算总 GMV。'
      : '当前仅有单一业务模式，如后续接入另一模式，系统会自动分流统计。',
  }
}

export interface JdStoreRating {
  range: { from: string; to: string }
  /** 四维评分：客服咨询、物流履约、商品体验、售后服务 */
  dimensions: {
    customerService: { score: number | null; note: string }
    logistics: { score: number | null; note: string }
    productExperience: { score: number | null; note: string }
    afterSale: { score: number | null; note: string }
  }
  /** 物流履约关键指标：延迟发货单量 */
  delayedShipments: {
    count: number
    thresholdHours: number
    note: string
  }
  /** 货到付款占比（京东特有） */
  codRatio: {
    ratio: number | null
    note: string
  }
}

/** 店铺星级（四维）与履约表现 */
export async function getJdStoreRating(
  from: string,
  to: string,
  platformCodes: string[] = ['jd'],
  pool?: Pool,
): Promise<JdStoreRating> {
  const p = pool || getPool()

  // 延迟发货阈值
  const slaRes = await p.query(
    `SELECT threshold_hours, penalty_note
       FROM platform_sla_config
      WHERE platform_code = 'jd' AND sla_type = 'ship_delay'`,
  )
  const threshold = Number(slaRes.rows[0]?.threshold_hours || 48)
  const slaNote = slaRes.rows[0]?.penalty_note || '近 30 天延迟发货超 48h 订单量，计入店铺星级减分'

  // 订单状态分布（用于估算履约表现）
  const orderRes = await p.query(
    `SELECT status_code, COUNT(*)::int AS n
       FROM order_facts
      WHERE platform_code = ANY($1::text[])
        AND biz_date BETWEEN $2::date AND $3::date
      GROUP BY status_code`,
    [platformCodes, from, to],
  )
  const statusMap = new Map<string, number>()
  for (const r of orderRes.rows) statusMap.set(r.status_code, Number(r.n))

  // COD 占比：从交易数据里无法直接得到，需订单表有标记
  return {
    range: { from, to },
    dimensions: {
      customerService: { score: null, note: '咚咚平均响应时长，考核时段 9:00-23:00，需从京麦导出' },
      logistics: { score: null, note: `延迟发货单量（超 ${threshold}h）为减分项，送货上门率为加分项` },
      productExperience: { score: null, note: '商品体验评分，含价格星级等' },
      afterSale: { score: null, note: '售后服务评分，审核兜底 24h / 收货兜底 24h' },
    },
    delayedShipments: {
      count: 0,
      thresholdHours: threshold,
      note: slaNote,
    },
    codRatio: {
      ratio: null,
      note: '货到付款占比：京东成交金额含 COD，与其他纯在线支付平台不可直接横比。需从订单表标记 COD 订单后计算。',
    },
  }
}

export interface JdFulfillment {
  range: { from: string; to: string }
  slas: Array<{
    slaType: string
    slaName: string
    thresholdHours: number
    businessHoursOnly: boolean
    note: string
  }>
  orderStatusFlow: Array<{ status: string; name: string; count: number; countsAsGmv: boolean }>
}

/** 履约时效监控 */
export async function getJdFulfillment(
  from: string,
  to: string,
  platformCodes: string[] = ['jd'],
  pool?: Pool,
): Promise<JdFulfillment> {
  const p = pool || getPool()

  const slaRes = await p.query(
    `SELECT sla_type, sla_name, threshold_hours, business_hours_only, penalty_note
       FROM platform_sla_config
      WHERE platform_code = 'jd'
      ORDER BY threshold_hours ASC`,
  )

  const statusRes = await p.query(
    `SELECT os.status_code, os.status_name, os.counts_as_gmv,
            COALESCE(sub.n, 0)::int AS n
       FROM order_status_config os
       LEFT JOIN (
         SELECT status_code, COUNT(*)::int AS n
           FROM order_facts
          WHERE platform_code = ANY($1::text[])
            AND biz_date BETWEEN $2::date AND $3::date
          GROUP BY status_code
       ) sub ON sub.status_code = os.status_code
      WHERE os.platform_code = 'jd'
      ORDER BY os.sort_order`,
    [platformCodes, from, to],
  )

  return {
    range: { from, to },
    slas: slaRes.rows.map((r: any) => ({
      slaType: r.sla_type,
      slaName: r.sla_name,
      thresholdHours: Number(r.threshold_hours),
      businessHoursOnly: !!r.business_hours_only,
      note: r.penalty_note || '',
    })),
    orderStatusFlow: statusRes.rows.map((r: any) => ({
      status: r.status_code,
      name: r.status_name,
      count: Number(r.n),
      countsAsGmv: !!r.counts_as_gmv,
    })),
  }
}

export interface JdCaliberNote {
  amountType: string
  amountTypeName: string
  displayNote: string
  attributionWindowHours: number | null
  isComparable: boolean
}

/** 京东口径说明（含 COD 与 30 天归因） */
export async function getJdCaliber(
  platformCode = 'jd',
  pool?: Pool,
): Promise<JdCaliberNote | null> {
  const c = await getDefaultCaliber(platformCode, 'gmv', pool)
  if (!c) return null
  return {
    amountType: c.amountType,
    amountTypeName: c.amountTypeName,
    displayNote: c.displayNote,
    attributionWindowHours: c.attributionWindowHours,
    isComparable: c.isComparable,
  }
}
