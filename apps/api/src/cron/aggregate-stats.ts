import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'

const JOB_NAME = 'aggregate-stats'

export async function aggregateDailyStats(): Promise<void> {
  const pool = getPool()
  const start = Date.now()
  logger.info({ job: JOB_NAME }, 'Starting daily stats aggregation')

  try {
    // Aggregate yesterday's data from live_sessions
    await pool.query(`
      INSERT INTO overview_daily_stats (date, today_gmv, today_orders, active_rooms, online_viewers, growth_rate)
      SELECT
        CURRENT_DATE - 1 AS date,
        COALESCE(SUM(s.gmv), 0) AS today_gmv,
        COALESCE(SUM(s.orders), 0)::int AS today_orders,
        COUNT(DISTINCT s.room_id)::int AS active_rooms,
        COALESCE(AVG(s.online_peak), 0)::int AS online_viewers,
        0.0 AS growth_rate
      FROM live_sessions s
      WHERE s.date = CURRENT_DATE - 1 AND s.status IN ('live', 'completed')
      HAVING COUNT(*) > 0
      ON CONFLICT (date) DO UPDATE SET
        today_gmv = EXCLUDED.today_gmv,
        today_orders = EXCLUDED.today_orders,
        active_rooms = EXCLUDED.active_rooms,
        online_viewers = EXCLUDED.online_viewers
    `)

    // Calculate growth rate (compare with previous day)
    await pool.query(`
      UPDATE overview_daily_stats
      SET growth_rate = ROUND(
        CASE WHEN prev.today_gmv > 0
          THEN ((overview_daily_stats.today_gmv - prev.today_gmv) / prev.today_gmv * 100)::numeric\n          ELSE 0 END, 2\n      )\n      FROM overview_daily_stats prev\n      WHERE prev.date = overview_daily_stats.date - 1\n        AND overview_daily_stats.date = CURRENT_DATE - 1
    `)

    const elapsed = ((Date.now() - start) / 1000).toFixed(2)
    logger.info({ job: JOB_NAME, elapsed: `${elapsed}s` }, 'Daily stats aggregation completed')
  } catch (err) {
    logger.error({ job: JOB_NAME, err }, 'Daily stats aggregation failed')
  }
}

/**
 * Backfills overview_daily_stats from imported session data.
 * Runs once at startup to populate historical data that the cron missed.
 */
export async function backfillDailyStats(): Promise<void> {
  const pool = getPool()
  logger.info({ job: 'backfill-stats' }, 'Backfilling daily stats from imported data...')
  try {
    await pool.query(`
      INSERT INTO overview_daily_stats (date, today_gmv, today_orders, active_rooms, online_viewers, growth_rate)
      SELECT
        lb.business_date AS date,
        COALESCE(SUM(lb.payment_amount), 0) AS today_gmv,
        COALESCE(SUM(om.deal_users), 0)::int AS today_orders,
        COUNT(DISTINCT lb.room_id)::int AS active_rooms,
        COALESCE(MAX(om.peak_online), 0)::int AS online_viewers,
        0.0 AS growth_rate
      FROM session_live_basic_info lb
      LEFT JOIN session_overview_metrics om
        ON om.room_id = lb.room_id AND om.business_date = lb.business_date
      GROUP BY lb.business_date
      ON CONFLICT (date) DO UPDATE SET
        today_gmv = EXCLUDED.today_gmv,
        today_orders = EXCLUDED.today_orders,
        active_rooms = EXCLUDED.active_rooms,
        online_viewers = EXCLUDED.online_viewers
    `)

    // Re-calculate growth_rate for all dates
    await pool.query(`
      UPDATE overview_daily_stats ods
      SET growth_rate = ROUND(
        CASE WHEN prev.today_gmv > 0
          THEN ((ods.today_gmv - prev.today_gmv) / prev.today_gmv * 100)::numeric
          ELSE 0 END, 2
      )
      FROM overview_daily_stats prev
      WHERE prev.date = ods.date - 1
    `)

    logger.info({ job: 'backfill-stats' }, 'Daily stats backfill completed')
  } catch (err) {
    logger.error({ job: 'backfill-stats', err }, 'Daily stats backfill failed (imported tables may not exist)')
  }
}