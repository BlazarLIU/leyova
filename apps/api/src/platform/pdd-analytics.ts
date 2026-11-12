/**
 * pdd-analytics.ts — 拼多多专属分析服务
 *
 * 基于调研结论（docs/platform-business-model-comparison.md）：
 *   1. 订单原子是「团」：支付 → 待成团 → 已成团，未成团自动退款
 *   2. 三套口径并存：交易额 / 结算金额 / 净成交
 *   3. 售后指标分母是「已成团订单数」，不是支付订单数
 *   4. 仅退款占比全平台最高
 */

import type { DbExecutor } from '../lib/audit.js'
import { getPool } from '../lib/db.js'
import { getDefaultCaliber } from '../platform/caliber.js'

export interface PddGroupFunnel {
  range: { from: string; to: string }
  /** 支付（发起拼团）订单数与金额 */
  paid: { orders: number; amount: number }
  /** 待成团（含拼团中） */
  waiting: { groups: number; amount: number }
  /** 已成团 */
  grouped: { groups: number; amount: number }
  /** 拼团过期（自动退款） */
  expired: { groups: number; amount: number }
  /** 成团转化率 = 已成团 / (已成团 + 过期) */
  groupSuccessRate: number | null
  /** 成团损耗金额 */
  lossAmount: number
  /** 平均成团人数 */
  avgGroupSize: number | null
}

/** 成团漏斗 */
export async function getPddGroupFunnel(
  shopId: number,
  from: string,
  to: string,
  pool?: DbExecutor,
): Promise<PddGroupFunnel> {
  const p = pool || getPool()

  const { rows } = await p.query(
    `SELECT
       status,
       COUNT(*)::int                    AS groups,
       COALESCE(SUM(pay_amount), 0)::numeric AS amount,
       COALESCE(AVG(NULLIF(group_size_actual,0)), 0)::numeric AS avg_size
     FROM pdd_group_buy
     WHERE shop_id = $1 AND biz_date BETWEEN $2::date AND $3::date
     GROUP BY status`,
    [shopId, from, to],
  )

  const byStatus = new Map<string, { groups: number; amount: number; avgSize: number }>()
  for (const r of rows) {
    byStatus.set(r.status, {
      groups: Number(r.groups),
      amount: Number(r.amount),
      avgSize: Number(r.avg_size),
    })
  }

  const waitingG = byStatus.get('waiting')?.groups || 0
  const groupingG = byStatus.get('grouping')?.groups || 0
  const groupedG = byStatus.get('grouped')?.groups || 0
  const expiredG = byStatus.get('expired')?.groups || 0

  const waitingAmt = (byStatus.get('waiting')?.amount || 0) + (byStatus.get('grouping')?.amount || 0)
  const groupedAmt = byStatus.get('grouped')?.amount || 0
  const expiredAmt = byStatus.get('expired')?.amount || 0

  // 支付订单 = 所有已发起拼团的（含待成团、已成团、过期）
  const paidOrders = waitingG + groupingG + groupedG + expiredG
  const paidAmount = waitingAmt + groupedAmt + expiredAmt

  const settled = groupedG + expiredG

  return {
    range: { from, to },
    paid: { orders: paidOrders, amount: Number(paidAmount.toFixed(2)) },
    waiting: { groups: waitingG + groupingG, amount: Number(waitingAmt.toFixed(2)) },
    grouped: { groups: groupedG, amount: Number(groupedAmt.toFixed(2)) },
    expired: { groups: expiredG, amount: Number(expiredAmt.toFixed(2)) },
    groupSuccessRate: settled > 0 ? Number(((groupedG / settled) * 100).toFixed(2)) : null,
    lossAmount: Number(expiredAmt.toFixed(2)),
    avgGroupSize: groupedG > 0 ? Number((byStatus.get('grouped')?.avgSize || 0).toFixed(2)) : null,
  }
}

export interface PddCaliberCompare {
  range: { from: string; to: string }
  /** 交易额口径（已成团订单） */
  grossPaid: { amount: number; orders: number; note: string }
  /** 结算金额口径（交易额 - 退款） */
  grossSettled: { amount: number; orders: number; note: string }
  /** 净成交口径（剔除秒退） */
  netSettled: { amount: number; orders: number; note: string }
  /** 三者差异 */
  diffs: {
    settledVsPaid: number | null
    netVsPaid: number | null
  }
}

/** 三口径对账 */
export async function getPddCaliberCompare(
  shopId: number,
  from: string,
  to: string,
  pool?: DbExecutor,
): Promise<PddCaliberCompare> {
  const p = pool || getPool()

  const { rows } = await p.query(
    `SELECT
       amount_type,
       COALESCE(SUM(gmv), 0)::numeric          AS amount,
       COALESCE(SUM(paid_order_count), 0)::int AS orders
     FROM fact_trade_daily
     WHERE shop_id = $1
       AND platform_code = 'pdd'
       AND biz_date BETWEEN $2::date AND $3::date
     GROUP BY amount_type`,
    [shopId, from, to],
  )

  const map = new Map<string, { amount: number; orders: number }>()
  for (const r of rows) {
    map.set(r.amount_type, { amount: Number(r.amount), orders: Number(r.orders) })
  }

  const grossPaid = map.get('gross_paid') || { amount: 0, orders: 0 }
  const grossSettled = map.get('gross_settled') || { amount: 0, orders: 0 }
  const netSettled = map.get('net_settled') || { amount: 0, orders: 0 }

  return {
    range: { from, to },
    grossPaid: {
      ...grossPaid,
      note: '交易额口径：以已成团订单为准。这是拼多多的默认口径。',
    },
    grossSettled: {
      ...grossSettled,
      note: '结算金额 = 总交易额 - 退款交易额。部分退款只剔除对应金额，且该单不计入退单笔数。',
    },
    netSettled: {
      ...netSettled,
      note: '净成交 = 剔除秒退订单（支付后 1 小时内且当日 23:59:59 前退款、商家未发货）。',
    },
    diffs: {
      settledVsPaid: grossPaid.amount > 0
        ? Number((((grossSettled.amount - grossPaid.amount) / grossPaid.amount) * 100).toFixed(2))
        : null,
      netVsPaid: grossPaid.amount > 0
        ? Number((((netSettled.amount - grossPaid.amount) / grossPaid.amount) * 100).toFixed(2))
        : null,
    },
  }
}

export interface PddRefundAnalysis {
  range: { from: string; to: string }
  /** 注意：分母是已成团订单数，不是支付订单数 */
  denominator: { groupedOrders: number; note: string }
  refund: {
    amount: number
    orders: number
    rate: number | null
  }
  /** 拼团明细样本（用于漏斗分析，不作分母） */
  groupSample: {
    groupedGroups: number
    note: string
  }
  /** 仅退款专项（拼多多占比最高） */
  onlyRefund: {
    available: boolean
    note: string
  }
  caliber: {
    amountType: string
    amountTypeName: string
    displayNote: string
    note: string
  } | null
}

/** 仅退款与售后分析（分母为已成团订单） */
export async function getPddRefundAnalysis(
  shopId: number,
  from: string,
  to: string,
  pool?: DbExecutor,
): Promise<PddRefundAnalysis> {
  const p = pool || getPool()

  // ── 关键：分子分母必须同源 ──
  // 退款数据来自 fact_trade_daily，分母也必须来自 fact_trade_daily 的「已成团成交订单数」，
  // 不能跨表用 pdd_group_buy 的条数（粒度不同会导致比率失真）。
  const tradeRes = await p.query(
    `SELECT
       COALESCE(SUM(refund_amount), 0)::numeric   AS refund_amount,
       COALESCE(SUM(refund_count), 0)::int        AS refund_count,
       COALESCE(SUM(paid_order_count), 0)::int    AS order_count
     FROM fact_trade_daily
     WHERE shop_id = $1
       AND platform_code = 'pdd'
       AND biz_date BETWEEN $2::date AND $3::date
       AND amount_type = 'gross_paid'`,
    [shopId, from, to],
  )
  const refundAmount = Number(tradeRes.rows[0]?.refund_amount || 0)
  const refundCount = Number(tradeRes.rows[0]?.refund_count || 0)
  const orderCount = Number(tradeRes.rows[0]?.order_count || 0)

  // 拼团表作为「成团样本」交叉校验（不作为分母）
  const groupedRes = await p.query(
    `SELECT COUNT(*)::int AS n
       FROM pdd_group_buy
      WHERE shop_id = $1 AND biz_date BETWEEN $2::date AND $3::date
        AND status = 'grouped'`,
    [shopId, from, to],
  )
  const groupedSample = Number(groupedRes.rows[0]?.n || 0)

  const caliber = await getDefaultCaliber('pdd', 'gmv', p)

  return {
    range: { from, to },
    denominator: {
      groupedOrders: orderCount,
      note: '分母取 fact_trade_daily 的已成团成交订单数（与退款数据同源）。拼多多后台的「退款率」分母是已成团订单数，不是支付订单数。',
    },
    refund: {
      amount: refundAmount,
      orders: refundCount,
      rate: orderCount > 0 ? Number(((refundCount / orderCount) * 100).toFixed(2)) : null,
    },
    groupSample: {
      groupedGroups: groupedSample,
      note: groupedSample > 0
        ? `拼团明细表记录了 ${groupedSample} 个已成团样本，可用于成团漏斗分析，但不作为售后比率分母`
        : '暂无拼团明细数据',
    },
    onlyRefund: {
      available: false,
      note: '仅退款占比需从拼多多商家后台「售后服务指标」导出（含介入率/纠纷退款率/品质退款率），当前数据源未包含该字段。',
    },
    caliber: caliber ? {
      amountType: caliber.amountType,
      amountTypeName: caliber.amountTypeName,
      displayNote: caliber.displayNote,
      note: '拼多多退款率分母为 paid_order_count（已成团订单数），而非零售 GMV；跨平台横向对比请参考语义层 refund_rate 口径',
    } : null,
  }
}

export interface PddStoreHealth {
  /** 店铺领航员、成长层级、体验星级 三套并存 */
  tiers: {
    navigator: { available: boolean; note: string }
    growthLevel: { available: boolean; note: string }
    experienceStar: { available: boolean; note: string }
  }
  ads: {
    adSpend: number
    adGmv: number
    roi: number | null
    /** 结算投产比 = 结算金额 / 花费 */
    settledRoi: number | null
    note: string
  }
}

/** 店铺健康度 + 投放 */
export async function getPddStoreHealth(
  shopId: number,
  from: string,
  to: string,
  pool?: DbExecutor,
): Promise<PddStoreHealth> {
  const p = pool || getPool()

  const adRes = await p.query(
    `SELECT
       COALESCE(SUM(ad_spend), 0)::numeric             AS spend,
       COALESCE(SUM(attributed_gross_gmv), 0)::numeric AS gmv
     FROM fact_ad_spend_daily
     WHERE shop_id = $1
       AND platform_code = 'pdd'
       AND biz_date BETWEEN $2::date AND $3::date`,
    [shopId, from, to],
  )
  const spend = Number(adRes.rows[0]?.spend || 0)
  const adGmv = Number(adRes.rows[0]?.gmv || 0)

  const settledRes = await p.query(
    `SELECT COALESCE(SUM(gmv), 0)::numeric AS amount
       FROM fact_trade_daily
      WHERE shop_id = $1 AND platform_code = 'pdd'
        AND biz_date BETWEEN $2::date AND $3::date
        AND amount_type = 'gross_settled'`,
    [shopId, from, to],
  )
  const settledAmount = Number(settledRes.rows[0]?.amount || 0)

  return {
    tiers: {
      navigator: { available: false, note: '店铺领航员：售后、品质、物流、活跃四维评分，需从商家后台导出' },
      growthLevel: { available: false, note: '成长层级：依据近 30 天交易额与领航员综合评定' },
      experienceStar: { available: false, note: '店铺综合体验星级：与领航员、成长层级三套并存' },
    },
    ads: {
      adSpend: Number(spend.toFixed(2)),
      adGmv: Number(adGmv.toFixed(2)),
      roi: spend > 0 ? Number((adGmv / spend).toFixed(2)) : null,
      settledRoi: spend > 0 && settledAmount > 0 ? Number((settledAmount / spend).toFixed(2)) : null,
      note: '拼多多投产比按 14 天归因。2025-01 起新增「净成交出价」，2025-09 新增「结算投产比」。',
    },
  }
}
