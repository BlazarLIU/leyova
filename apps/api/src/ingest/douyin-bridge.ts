/**
 * douyin-bridge.ts — 抖音数据桥接（按真实表结构）
 *
 * live_sessions 实际字段：
 *   id, room_id, anchor_id, title, date, start_time, end_time, status,
 *   gmv, orders, online_peak, duration_min, return_amount, gsv,
 *   ad_cost, ad_gsv, gmv_per_hour, avg_item_price, buyer_count, avg_online,
 *   uv_value, exposure_view_rate, retention_rate, interaction_rate,
 *   new_fans, view_follow_rate, new_group_members, gpm, views
 *
 * session_live_basic_info 实际字段：
 *   id, session_id, room_id, business_date, fans_before_broadcast,
 *   live_date, live_start_time, live_end_time, live_duration_min,
 *   live_platform, payment_amount, gpm, disposal_count
 *
 * 注意：旧表没有曝光/点击/访客数，只有 views（观看次数）与 gpm。
 *       因此流量事实表只能用 views 近似 visitors，曝光留空。
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { ensurePartitionsForRange } from '../cron/manage-partitions.js'

export interface BridgeResult {
  from: string
  to: string
  days: number
  tradeRows: number
  trafficRows: number
  skipped: string | null
  durationMs: number
}

async function checkLegacyData(
  pool: Pool,
): Promise<{ ok: boolean; minDate: string | null; maxDate: string | null; count: number }> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n,
              MIN(date)::text AS min_d,
              MAX(date)::text AS max_d
         FROM live_sessions
        WHERE status = 'completed'`,
    )
    const r = rows[0]
    return {
      ok: Number(r.n) > 0,
      minDate: r.min_d,
      maxDate: r.max_d,
      count: Number(r.n),
    }
  } catch {
    return { ok: false, minDate: null, maxDate: null, count: 0 }
  }
}

/**
 * 桥接抖音旧表 → 新事实表
 */
export async function bridgeDouyinData(
  from?: string,
  to?: string,
  pool?: Pool,
): Promise<BridgeResult> {
  const p = pool || getPool()
  const started = Date.now()

  const legacy = await checkLegacyData(p)
  if (!legacy.ok) {
    return {
      from: from || '', to: to || '', days: 0, tradeRows: 0, trafficRows: 0,
      skipped: 'live_sessions 无已完成场次，无需桥接',
      durationMs: Date.now() - started,
    }
  }

  const rangeFrom = from || legacy.minDate || '2020-01-01'
  const rangeTo = to || legacy.maxDate || new Date().toISOString().slice(0, 10)

  const shopRes = await p.query(
    `SELECT id FROM dim_shop WHERE platform_code = 'douyin' ORDER BY id LIMIT 1`,
  )
  if (shopRes.rows.length === 0) {
    return {
      from: rangeFrom, to: rangeTo, days: 0, tradeRows: 0, trafficRows: 0,
      skipped: '未找到抖音店铺（dim_shop 无 platform_code=douyin）',
      durationMs: Date.now() - started,
    }
  }
  const shopId = Number(shopRes.rows[0].id)

  // 桥接前确保目标日期范围的分区存在（历史数据可能早于现有分区）
  const partResult = await ensurePartitionsForRange(rangeFrom, rangeTo, p).catch(() => null)
  if (partResult && partResult.created.length > 0) {
    logger.info({ created: partResult.created }, '[bridge] 补齐历史分区')
  }

  // ── 1) 交易事实：live_sessions 按 日期+直播间 汇总 ──
  const tradeRes = await p.query(
    `INSERT INTO fact_trade_daily
       (biz_date, platform_code, shop_id, channel_name, source_code,
        gmv, pay_amount, paid_order_count, paid_buyer_count,
        refund_amount, refund_count, source, extra, amount_type)
     SELECT
        ls.date,
        'douyin',
        $1,
        COALESCE(lr.name, '抖音直播间'),
        'recommend_live',
        COALESCE(SUM(ls.gmv), 0),
        COALESCE(SUM(ls.gmv), 0) - COALESCE(SUM(ls.return_amount), 0),
        COALESCE(SUM(ls.orders), 0),
        COALESCE(SUM(ls.buyer_count), 0),
        COALESCE(SUM(ls.return_amount), 0),
        0,
        'bridge',
        jsonb_build_object(
          'source', 'live_sessions',
          'room_id', ls.room_id,
          'views', COALESCE(SUM(ls.views), 0),
          'ad_cost', COALESCE(SUM(ls.ad_cost), 0),
          'gpm', COALESCE(AVG(ls.gpm), 0)
        ),
        'gross_paid'
       FROM live_sessions ls
       LEFT JOIN live_rooms lr ON lr.id = ls.room_id
      WHERE ls.status = 'completed'
        AND ls.date BETWEEN $2::date AND $3::date
      GROUP BY ls.date, ls.room_id, lr.name
     ON CONFLICT (biz_date, platform_code, shop_id, channel_name, amount_type)
     DO UPDATE SET
        gmv              = EXCLUDED.gmv,
        pay_amount       = EXCLUDED.pay_amount,
        paid_order_count = EXCLUDED.paid_order_count,
        paid_buyer_count = EXCLUDED.paid_buyer_count,
        refund_amount    = EXCLUDED.refund_amount,
        extra            = EXCLUDED.extra,
        source           = EXCLUDED.source
     RETURNING id`,
    [shopId, rangeFrom, rangeTo],
  )

  // ── 2) 流量事实：旧表无曝光/点击，用 views 作为 visitors ──
  let trafficRows = 0
  try {
    const trafficRes = await p.query(
      `INSERT INTO fact_traffic_daily
         (biz_date, platform_code, shop_id, channel_name, source_code,
          impressions, clicks, visitors, avg_stay_seconds, source, extra)
       SELECT
          ls.date,
          'douyin',
          $1,
          COALESCE(lr.name, '抖音直播间'),
          'recommend_live',
          0,
          0,
          COALESCE(SUM(ls.views), 0),
          0,
          'bridge',
          jsonb_build_object(
            'source', 'live_sessions',
            'note', '旧表无曝光/点击数据，visitors 用观看次数近似',
            'duration_min', COALESCE(SUM(ls.duration_min), 0)
          )
         FROM live_sessions ls
         LEFT JOIN live_rooms lr ON lr.id = ls.room_id
        WHERE ls.status = 'completed'
          AND ls.date BETWEEN $2::date AND $3::date
          AND ls.views > 0
        GROUP BY ls.date, ls.room_id, lr.name
       ON CONFLICT (biz_date, platform_code, shop_id, channel_name)
       DO UPDATE SET
          visitors = EXCLUDED.visitors,
          extra    = EXCLUDED.extra,
          source   = EXCLUDED.source
       RETURNING id`,
      [shopId, rangeFrom, rangeTo],
    )
    trafficRows = trafficRes.rowCount ?? 0
  } catch (err: any) {
    logger.warn({ err: err?.message }, '[bridge] 流量桥接失败')
  }

  const daysRes = await p.query(
    `SELECT COUNT(DISTINCT biz_date)::int AS n
       FROM fact_trade_daily
      WHERE platform_code = 'douyin'
        AND biz_date BETWEEN $1::date AND $2::date`,
    [rangeFrom, rangeTo],
  )

  const result: BridgeResult = {
    from: rangeFrom,
    to: rangeTo,
    days: Number(daysRes.rows[0]?.n || 0),
    tradeRows: tradeRes.rowCount ?? 0,
    trafficRows,
    skipped: null,
    durationMs: Date.now() - started,
  }

  logger.info(result, '[bridge] 抖音数据桥接完成')
  return result
}

/** 查询旧表可桥接范围 */
export async function inspectLegacyData(pool?: Pool): Promise<{
  available: boolean
  sessions: number
  dateRange: { from: string | null; to: string | null }
  note: string
}> {
  const p = pool || getPool()
  const legacy = await checkLegacyData(p)
  return {
    available: legacy.ok,
    sessions: legacy.count,
    dateRange: { from: legacy.minDate, to: legacy.maxDate },
    note: legacy.ok
      ? `live_sessions 有 ${legacy.count} 场已完成场次，日期范围 ${legacy.minDate} ~ ${legacy.maxDate}`
      : '无旧表数据可桥接',
  }
}
