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

import type { DbExecutor } from '../lib/audit.js'
import { getPool } from '../lib/db.js'
import { getDefaultCaliber } from '../platform/caliber.js'

export type JdBusinessMode = 'self_operated' | 'pop_sop' | 'pop_fbp' | 'unknown'

export interface JdFeeSummary {
  grossMarginGuarantee: number | null
  rebate: number | null
  tcFreight: number | null
  labelFee: number | null
  qualityDeposit: number | null
  commission: number | null
  /** 净费用影响：返点 (+) 减去各项扣费 (-) */
  netFeeImpact: number | null
}

export interface JdSettlementFeeItem {
  id: number
  shopId: number
  shopName: string
  businessMode: JdBusinessMode
  businessModeName: string
  bizMonth: string
  feeCode: string
  feeName: string
  direction: 'deduct' | 'rebate'
  amount: number | null
  note: string
}

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
  /** 精细化结算费用汇总（按成本权限脱敏） */
  feeSummary?: JdFeeSummary | null
  note: string
}

const MODE_NAMES: Record<JdBusinessMode, string> = {
  self_operated: '自营采销',
  pop_sop: 'POP-SOP（自发货）',
  pop_fbp: 'POP-FBP（京东履约）',
  unknown: '未标注模式',
}

function createEmptyFeeSummary(): JdFeeSummary {
  return {
    grossMarginGuarantee: 0,
    rebate: 0,
    tcFreight: 0,
    labelFee: 0,
    qualityDeposit: 0,
    commission: 0,
    netFeeImpact: 0,
  }
}

/** 查询京东自营与 POP 精细化结算费用明细（毛保、返点、TC运费、贴码费、质保金、佣金） */
export async function getJdSettlementFees(
  from: string,
  to: string,
  platformCodes: string[] = ['jd'],
  pool?: DbExecutor,
  options?: { shopId?: number; maskCost?: boolean },
): Promise<{
  range: { from: string; to: string }
  costMasked: boolean
  items: JdSettlementFeeItem[]
  byMode: Record<string, JdFeeSummary>
}> {
  const p = pool || getPool()
  const maskCost = Boolean(options?.maskCost)
  if (maskCost) {
    return {
      range: { from, to },
      costMasked: true,
      items: [],
      byMode: {},
    }
  }

  const params: any[] = [platformCodes, from, to]
  let shopCond = ''
  if (options?.shopId && Number.isFinite(options.shopId)) {
    params.push(options.shopId)
    shopCond = ` AND f.shop_id = $${params.length}`
  }

  const { rows } = await p.query(
    `SELECT f.id, f.shop_id, s.shop_name, f.business_mode, f.biz_month,
            f.fee_code, f.fee_name, f.direction, f.amount, f.note
       FROM fact_jd_settlement_fees f
       JOIN dim_shop s ON s.id = f.shop_id
      WHERE s.platform_code = ANY($1::text[])
        AND f.biz_month BETWEEN to_char($2::date, 'YYYY-MM') AND to_char($3::date, 'YYYY-MM')${shopCond}
      ORDER BY f.biz_month DESC, f.business_mode, f.fee_code`,
    params,
  )

  const items: JdSettlementFeeItem[] = []
  const byMode: Record<string, JdFeeSummary> = {}

  for (const r of rows) {
    const mode = (r.business_mode || 'unknown') as JdBusinessMode
    const amount = Number(r.amount || 0)
    const direction = r.direction === 'rebate' ? 'rebate' : 'deduct'
    items.push({
      id: Number(r.id),
      shopId: Number(r.shop_id),
      shopName: r.shop_name || '',
      businessMode: mode,
      businessModeName: MODE_NAMES[mode] || mode,
      bizMonth: r.biz_month,
      feeCode: r.fee_code,
      feeName: r.fee_name,
      direction,
      amount: Number(amount.toFixed(2)),
      note: r.note || '',
    })

    if (!byMode[mode]) byMode[mode] = createEmptyFeeSummary()
    const bucket = byMode[mode]
    if (r.fee_code === 'gross_margin_guarantee') bucket.grossMarginGuarantee = (bucket.grossMarginGuarantee || 0) + amount
    else if (r.fee_code === 'rebate') bucket.rebate = (bucket.rebate || 0) + amount
    else if (r.fee_code === 'tc_freight') bucket.tcFreight = (bucket.tcFreight || 0) + amount
    else if (r.fee_code === 'label_fee') bucket.labelFee = (bucket.labelFee || 0) + amount
    else if (r.fee_code === 'quality_deposit') bucket.qualityDeposit = (bucket.qualityDeposit || 0) + amount
    else if (r.fee_code === 'commission') bucket.commission = (bucket.commission || 0) + amount

    bucket.netFeeImpact = Number(
      ((bucket.netFeeImpact || 0) + (direction === 'rebate' ? amount : -amount)).toFixed(2),
    )
  }

  return {
    range: { from, to },
    costMasked: false,
    items,
    byMode,
  }
}

/** 按业务模式拆分（自营 vs POP）——禁止跨模式加总 */
export async function getJdModeBreakdown(
  from: string,
  to: string,
  platformCodes: string[] = ['jd'],
  pool?: DbExecutor,
  options?: { maskCost?: boolean },
): Promise<{
  range: { from: string; to: string }
  costMasked: boolean
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

  // POP 成交（fact_trade_daily，按平台默认口径过滤避免多口径重复叠加）
  const popRes = await p.query(
    `SELECT f.shop_id,
            COALESCE(SUM(f.gmv), 0)::numeric          AS amount,
            COALESCE(SUM(f.paid_order_count), 0)::int AS orders
       FROM fact_trade_daily f
       LEFT JOIN platform_caliber_config pcc
         ON pcc.platform_code = f.platform_code
        AND pcc.metric_code = 'gmv'
        AND pcc.is_default = true
      WHERE f.platform_code = ANY($1::text[])
        AND f.biz_date BETWEEN $2::date AND $3::date
        AND (pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type)
      GROUP BY f.shop_id`,
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

  const maskCost = Boolean(options?.maskCost)
  const feeData = await getJdSettlementFees(from, to, platformCodes, p, { maskCost })

  const modes: JdModeBreakdown[] = []
  for (const [mode, a] of agg.entries()) {
    const isSelf = mode === 'self_operated'
    const feeSummary = maskCost
      ? null
      : (feeData.byMode[mode] ?? null)
    modes.push({
      businessMode: mode,
      businessModeName: MODE_NAMES[mode],
      shopCount: a.shops.size,
      amount: Number(a.amount.toFixed(2)),
      amountLabel: isSelf ? '供货金额（采销额）' : '成交金额（含货到付款）',
      orderCount: a.orders,
      grossMargin: isSelf && !maskCost ? Number(a.margin.toFixed(2)) : null,
      avgSettleDays: isSelf && a.cycleSamples.length > 0
        ? Number((a.cycleSamples.reduce((x, y) => x + y, 0) / a.cycleSamples.length).toFixed(1))
        : null,
      feeSummary,
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
    costMasked: maskCost,
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
  pool?: DbExecutor,
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

  // 订单与物流履约状态分布（从 fact_fulfillment_waybill 实时计算）
  const waybillRes = await p.query(
    `SELECT fulfillment_status,
            COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE is_ship_delayed)::int AS delayed_cnt
       FROM fact_fulfillment_waybill
      WHERE platform_code = ANY($1::text[])
        AND paid_at::date BETWEEN $2::date AND $3::date
      GROUP BY fulfillment_status`,
    [platformCodes, from, to],
  )
  let delayedCount = 0
  for (const r of waybillRes.rows) {
    delayedCount += Number(r.delayed_cnt || 0)
  }

  // COD 占比：需在订单事实源标记 COD 支付方式
  return {
    range: { from, to },
    dimensions: {
      customerService: { score: null, note: '咚咚平均响应时长，考核时段 9:00-23:00，需从京麦导出' },
      logistics: { score: null, note: `延迟发货单量（超 ${threshold}h）为减分项，送货上门率为加分项` },
      productExperience: { score: null, note: '商品体验评分，含价格星级等' },
      afterSale: { score: null, note: '售后服务评分，审核兜底 24h / 收货兜底 24h' },
    },
    delayedShipments: {
      count: delayedCount,
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
  pool?: DbExecutor,
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
         SELECT CASE fulfillment_status
                  WHEN 'pending_ship' THEN 'paid'
                  WHEN 'shipped_no_pickup' THEN 'shipped'
                  WHEN 'in_transit' THEN 'shipped'
                  WHEN 'signed' THEN 'completed'
                  ELSE fulfillment_status
                END AS status_code,
                COUNT(*)::int AS n
           FROM fact_fulfillment_waybill
          WHERE platform_code = ANY($1::text[])
            AND paid_at::date BETWEEN $2::date AND $3::date
          GROUP BY 1
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
  pool?: DbExecutor,
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
