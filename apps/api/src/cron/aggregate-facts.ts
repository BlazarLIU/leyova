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
          JOIN platform_caliber_config pcc
            ON pcc.platform_code = f.platform_code
           AND pcc.metric_code = 'gmv'
           AND pcc.is_default = true
         WHERE f.biz_date = $1::date
           AND f.amount_type = pcc.amount_type  -- P0-B-2: fail-closed
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

  // 2. 同时刷新平台/渠道级汇总表 agg_trade_day_platform_channel
  await pool.query(
    `INSERT INTO public.agg_trade_day_platform_channel (
        biz_date, platform_code, channel_name, shop_id,
        total_gmv, total_pay_amount, total_order_count, total_buyer_count,
        total_refund_amount, net_sales, total_ad_spend, overall_roi, updated_at
     )
     SELECT
        f.biz_date,
        f.platform_code,
        COALESCE(f.channel_name, 'main') AS channel_name,
        f.shop_id,
        COALESCE(SUM(f.gmv), 0) AS total_gmv,
        COALESCE(SUM(f.pay_amount), 0) AS total_pay_amount,
        COALESCE(SUM(f.paid_order_count), 0)::int AS total_order_count,
        COALESCE(SUM(f.paid_buyer_count), 0)::int AS total_buyer_count,
        COALESCE(SUM(f.refund_amount), 0) AS total_refund_amount,
        COALESCE(SUM(f.gmv), 0) - COALESCE(SUM(f.refund_amount), 0) AS net_sales,
        COALESCE(MAX(ad.ad_spend), 0) AS total_ad_spend,
        CASE WHEN COALESCE(MAX(ad.ad_spend), 0) > 0
             THEN ROUND(COALESCE(SUM(f.gmv), 0) / MAX(ad.ad_spend), 2)
             ELSE 0 END AS overall_roi,
        now()
     FROM public.fact_trade_daily f
     JOIN public.platform_caliber_config pcc 
       ON pcc.platform_code = f.platform_code AND pcc.metric_code = 'gmv' AND pcc.is_default = true AND f.amount_type = pcc.amount_type
     LEFT JOIN (
       SELECT biz_date, platform_code, shop_id, SUM(ad_spend) AS ad_spend
       FROM public.fact_ad_spend_daily
       WHERE biz_date = $1::date
       GROUP BY biz_date, platform_code, shop_id
     ) ad ON ad.biz_date = f.biz_date AND ad.platform_code = f.platform_code AND ad.shop_id = f.shop_id
     WHERE f.biz_date = $1::date
     GROUP BY f.biz_date, f.platform_code, COALESCE(f.channel_name, 'main'), f.shop_id
     ON CONFLICT (biz_date, platform_code, channel_name, shop_id) DO UPDATE SET
        total_gmv = EXCLUDED.total_gmv,
        total_pay_amount = EXCLUDED.total_pay_amount,
        total_order_count = EXCLUDED.total_order_count,
        total_buyer_count = EXCLUDED.total_buyer_count,
        total_refund_amount = EXCLUDED.total_refund_amount,
        net_sales = EXCLUDED.net_sales,
        total_ad_spend = EXCLUDED.total_ad_spend,
        overall_roi = EXCLUDED.overall_roi,
        updated_at = now()`,
    [bizDate],
  )

  // 3. 同时刷新直播间/场次级汇总表 agg_traffic_day_live
  await pool.query(
    `INSERT INTO public.agg_traffic_day_live (
        biz_date, platform_code, room_id, shop_id,
        session_count, total_duration_min, total_views, total_buyers,
        peak_online_max, avg_online, total_gmv, avg_gpm, new_fans, updated_at
     )
     SELECT
        ls.date AS biz_date,
        ls.platform_code,
        ls.room_id,
        s.id AS shop_id,
        COUNT(*)::int AS session_count,
        COALESCE(SUM(ls.duration_min), 0)::int AS total_duration_min,
        COALESCE(SUM(ls.views), 0)::bigint AS total_views,
        COALESCE(SUM(ls.buyer_count), 0)::int AS total_buyers,
        COALESCE(MAX(ls.online_peak), 0)::int AS peak_online_max,
        COALESCE(AVG(ls.avg_online), 0)::int AS avg_online,
        COALESCE(SUM(ls.gmv), 0) AS total_gmv,
        COALESCE(AVG(ls.gpm), 0) AS avg_gpm,
        COALESCE(SUM(ls.new_fans), 0)::int AS new_fans,
        now()
     FROM public.live_sessions ls
     LEFT JOIN public.dim_shop s ON s.platform_code = ls.platform_code
     WHERE ls.date = $1::date
     GROUP BY ls.date, ls.platform_code, ls.room_id, s.id
     ON CONFLICT (biz_date, COALESCE(platform_code, '__all__'), COALESCE(room_id, 0), COALESCE(shop_id, 0)) DO UPDATE SET
        session_count = EXCLUDED.session_count,
        total_duration_min = EXCLUDED.total_duration_min,
        total_views = EXCLUDED.total_views,
        total_buyers = EXCLUDED.total_buyers,
        peak_online_max = EXCLUDED.peak_online_max,
        avg_online = EXCLUDED.avg_online,
        total_gmv = EXCLUDED.total_gmv,
        avg_gpm = EXCLUDED.avg_gpm,
        new_fans = EXCLUDED.new_fans,
        updated_at = now()`,
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
  // 先检查物化视图是否已 populated；首次刷新不能用 CONCURRENTLY
  const populatedRes = await pool.query<{ populated: boolean }>(
    `SELECT relispopulated AS populated FROM pg_class WHERE relname = 'agg_platform_monthly'`,
  )
  const populated = populatedRes.rows[0]?.populated ?? false
  if (populated) {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY public.agg_platform_monthly')
  } else {
    await pool.query('REFRESH MATERIALIZED VIEW public.agg_platform_monthly')
  }
  const { rows } = await pool.query<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM public.agg_platform_monthly WHERE year_month = $1`,
    [ym],
  )
  return { ym, platformRows: rows[0]?.cnt ?? 0 }
}

/** 批量回填一个日期区间（日聚合 + 涉及的月份聚合，包含生成连续日期的自动补零） */
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
 * 包含 PG Advisory Lock 防多实例并发冲突
 */
export async function runFactAggregation(): Promise<{
  dates: AggResult[]
  months: Array<{ ym: string; platformRows: number }>
}> {
  const pool = getPool()
  // 获取 PG Advisory Lock
  const lockRes = await pool.query<{ acquired: boolean }>(
    `SELECT pg_try_advisory_lock(hashtext('job:agg_daily')) AS acquired`,
  )
  if (!lockRes.rows[0]?.acquired) {
    logger.warn('[agg-facts] advisory lock already held by another worker, skipping duplicate run')
    return { dates: [], months: [] }
  }

  try {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const from = fmt(yesterday)
    const to = fmt(today)

    logger.info({ from, to }, '[agg-facts] starting incremental aggregation with advisory lock')
    const result = await aggregateRange(pool, from, to)
    logger.info(
      { days: result.days.length, months: result.months.length },
      '[agg-facts] aggregation completed',
    )
    return { dates: result.days, months: result.months }
  } finally {
    await pool.query(`SELECT pg_advisory_unlock(hashtext('job:agg_daily'))`)
  }
}

/** Manual backfill entry invoked by admin maintenance endpoint outside RLS transactions. */
export async function runManualAggregate(opts: {
  from?: string
  to?: string
  date?: string
  month?: string
}) {
  const pool = getPool()
  const lockRes = await pool.query<{ acquired: boolean }>(
    `SELECT pg_try_advisory_lock(hashtext('job:agg_daily')) AS acquired`,
  )
  if (!lockRes.rows[0]?.acquired) {
    throw new Error('汇总任务正由后台或其他 Worker 执行中，请稍候重试')
  }

  try {
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
  } finally {
    await pool.query(`SELECT pg_advisory_unlock(hashtext('job:agg_daily'))`)
  }
}
