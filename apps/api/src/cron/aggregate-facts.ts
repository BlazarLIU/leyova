/**
 * aggregate-facts.ts — 多平台事实表聚合与回填
 *
 * 修复背景（审核 D1/D2）：
 *   agg_shop_daily / agg_platform_monthly 在 P0 建表后，
 *   全仓无任何代码写入也无回填，属彻底空壳。
 *
 * 本模块职责：
 *   1. aggregateShopDaily(date)      — 把某日的 fact_trade_daily 聚合进 agg_shop_daily
 *   2. aggregatePlatformMonthly(ym)  — 把某月的店铺聚合进 agg_platform_monthly
 *   3. aggregateRange(from, to)      — 批量回填区间
 *   4. runFactAggregation()          — 定时任务入口（增量：今天+昨天）
 *
 * 设计：
 *   - 全部使用 ON CONFLICT DO UPDATE，可反复重跑（幂等）
 *   - 只读 fact_* 与 agg_*，不触碰任何旧表
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'

export interface AggResult {
  date: string
  shopRows: number
  durationMs: number
}

/**
 * 聚合某一天：fact_trade_daily → agg_shop_daily
 * 同时关联 fact_traffic_daily 的流量指标（若当日无流量数据则为 0）
 */
export async function aggregateShopDaily(
  pool: Pool,
  bizDate: string,
): Promise<AggResult> {
  const started = Date.now()

  const { rowCount } = await pool.query(
    `INSERT INTO agg_shop_daily (
        biz_date, platform_code, shop_id,
        total_gmv, total_pay_amount, total_order_count, total_buyer_count,
        total_refund_amount, net_sales, total_ad_spend, overall_roi,
        total_impressions, total_clicks, updated_at
     )
     SELECT
        t.biz_date,
        t.platform_code,
        t.shop_id,
        COALESCE(t.gmv_sum, 0),
        COALESCE(t.pay_sum, 0),
        COALESCE(t.order_sum, 0),
        COALESCE(t.buyer_sum, 0),
        COALESCE(t.refund_sum, 0),
        COALESCE(t.gmv_sum, 0) - COALESCE(t.refund_sum, 0) AS net_sales,
        COALESCE(a.spend_sum, 0)                            AS total_ad_spend,
        CASE WHEN COALESCE(a.spend_sum, 0) > 0
             THEN ROUND(COALESCE(t.gmv_sum, 0) / a.spend_sum, 2)
             ELSE 0 END                                     AS overall_roi,
        COALESCE(v.impressions_sum, 0),
        COALESCE(v.clicks_sum, 0),
        now()
     FROM (
        SELECT f.biz_date, f.platform_code, f.shop_id,
               SUM(f.gmv)              AS gmv_sum,
               SUM(f.pay_amount)       AS pay_sum,
               SUM(f.paid_order_count) AS order_sum,
               SUM(f.paid_buyer_count) AS buyer_sum,
               SUM(f.refund_amount)    AS refund_sum
          FROM fact_trade_daily f
          LEFT JOIN platform_caliber_config pcc
            ON pcc.platform_code = f.platform_code
           AND pcc.metric_code = 'gmv'
           AND pcc.is_default = true
         WHERE f.biz_date = $1::date
           AND (pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type)
         GROUP BY f.biz_date, f.platform_code, f.shop_id
     ) t
     LEFT JOIN (
        SELECT biz_date, platform_code, shop_id, SUM(ad_spend) AS spend_sum
          FROM fact_ad_spend_daily
         WHERE biz_date = $1::date
         GROUP BY biz_date, platform_code, shop_id
     ) a ON a.biz_date = t.biz_date AND a.platform_code = t.platform_code AND a.shop_id = t.shop_id
     LEFT JOIN (
        SELECT biz_date, platform_code, shop_id,
               SUM(impressions) AS impressions_sum,
               SUM(clicks)      AS clicks_sum
          FROM fact_traffic_daily
         WHERE biz_date = $1::date
         GROUP BY biz_date, platform_code, shop_id
     ) v ON v.biz_date = t.biz_date AND v.platform_code = t.platform_code AND v.shop_id = t.shop_id
     ON CONFLICT (biz_date, platform_code, shop_id)
     DO UPDATE SET
        total_gmv           = EXCLUDED.total_gmv,
        total_pay_amount    = EXCLUDED.total_pay_amount,
        total_order_count   = EXCLUDED.total_order_count,
        total_buyer_count   = EXCLUDED.total_buyer_count,
        total_refund_amount = EXCLUDED.total_refund_amount,
        net_sales           = EXCLUDED.net_sales,
        total_ad_spend      = EXCLUDED.total_ad_spend,
        overall_roi         = EXCLUDED.overall_roi,
        total_impressions   = EXCLUDED.total_impressions,
        total_clicks        = EXCLUDED.total_clicks,
        updated_at          = now()`,
    [bizDate],
  )

  return { date: bizDate, shopRows: rowCount ?? 0, durationMs: Date.now() - started }
}

/**
 * 刷新月度平台汇总物化视图（agg_shop_daily → agg_platform_monthly）
 * ym 格式 'YYYY-MM'
 */
export async function aggregatePlatformMonthly(
  pool: Pool,
  ym: string,
): Promise<{ ym: string; platformRows: number }> {
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY public.agg_platform_monthly')
  const { rows } = await pool.query<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM public.agg_platform_monthly WHERE year_month = $1`,
    [ym],
  )
  return { ym, platformRows: rows[0]?.cnt ?? 0 }
}

/** 批量回填一个日期区间（日聚合 + 涉及的月份聚合） */
export async function aggregateRange(
  pool: Pool,
  from: string,
  to: string,
): Promise<{ days: AggResult[]; months: Array<{ ym: string; platformRows: number }> }> {
  // 先从事实表取该区间内实际有数据的日期，避免空跑
  const { rows: dateRows } = await pool.query(
    `SELECT DISTINCT biz_date::text AS d
       FROM fact_trade_daily
      WHERE biz_date BETWEEN $1::date AND $2::date
      ORDER BY d`,
    [from, to],
  )

  const days: AggResult[] = []
  for (const r of dateRows) {
    days.push(await aggregateShopDaily(pool, r.d))
  }

  // 计算涉及月份（按月初 UTC 步进，避免 31 号溢出或末日早于起点日导致当月遗漏）
  const months = new Set<string>()
  const cur = new Date(`${from.slice(0, 7)}-01T00:00:00Z`)
  const end = new Date(`${to.slice(0, 7)}-01T00:00:00Z`)
  while (cur <= end) {
    months.add(cur.toISOString().slice(0, 7))
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }

  const monthResults: Array<{ ym: string; platformRows: number }> = []
  for (const ym of months) {
    monthResults.push(await aggregatePlatformMonthly(pool, ym))
  }

  return { days, months: monthResults }
}

/**
 * 定时任务入口：增量聚合最近 2 天（覆盖迟到数据）
 * 由 cron/index.ts 每日调用
 */
export async function runFactAggregation(): Promise<{
  dates: AggResult[]
  months: Array<{ ym: string; platformRows: number }>
}> {
  const pool = getPool()
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const from = fmt(yesterday)
  const to = fmt(today)

  logger.info({ from, to }, '[agg-facts] starting incremental aggregation')
  const result = await aggregateRange(pool, from, to)
  logger.info(
    { days: result.days.length, months: result.months.length },
    '[agg-facts] aggregation completed',
  )
  return { dates: result.days, months: result.months }
}

/** Manual backfill entry invoked by admin maintenance endpoint outside RLS transactions. */
export async function runManualAggregate(opts: {
  from?: string
  to?: string
  date?: string
  month?: string
}) {
  const pool = getPool()
  if (opts.date) {
    const day = await aggregateShopDaily(pool, opts.date)
    const ym = opts.date.slice(0, 7)
    const month = await aggregatePlatformMonthly(pool, ym)
    return { mode: 'single-day' as const, day, month }
  }
  if (opts.month) {
    const month = await aggregatePlatformMonthly(pool, opts.month)
    return { mode: 'single-month' as const, month }
  }
  const range = await aggregateRange(pool, opts.from!, opts.to!)
  return {
    mode: 'range' as const,
    from: opts.from,
    to: opts.to,
    daysProcessed: range.days.length,
    monthsProcessed: range.months.length,
    days: range.days,
    months: range.months,
  }
}
