import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'

const JOB_NAME = 'archive-old-data'
const RETENTION_DAYS = parseInt(process.env.STATS_RETENTION_DAYS || '365', 10)

export async function archiveOldData(): Promise<void> {
  const pool = getPool()
  const start = Date.now()
  logger.info({ job: JOB_NAME, retentionDays: RETENTION_DAYS }, 'Starting old data archival to cold storage')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 确保冷存储归档表存在
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.overview_daily_stats_archive (
        id integer,
        date date NOT NULL,
        today_gmv numeric(12,2) NOT NULL DEFAULT 0,
        today_orders integer NOT NULL DEFAULT 0,
        active_rooms integer NOT NULL DEFAULT 0,
        online_viewers integer NOT NULL DEFAULT 0,
        growth_rate numeric(5,1) NOT NULL DEFAULT 0,
        created_at timestamp with time zone NOT NULL,
        archived_at timestamp with time zone NOT NULL DEFAULT now(),
        PRIMARY KEY (date)
      )
    `)

    // 2. 将超出保留期限的数据先安全转存入归档表 (冷存储)
    const archiveResult = await client.query(`
      INSERT INTO public.overview_daily_stats_archive
        (id, date, today_gmv, today_orders, active_rooms, online_viewers, growth_rate, created_at, archived_at)
      SELECT id, date, today_gmv, today_orders, active_rooms, online_viewers, growth_rate, created_at, now()
      FROM public.overview_daily_stats
      WHERE date < CURRENT_DATE - $1::int
      ON CONFLICT (date) DO UPDATE SET
        today_gmv      = EXCLUDED.today_gmv,
        today_orders   = EXCLUDED.today_orders,
        active_rooms   = EXCLUDED.active_rooms,
        online_viewers = EXCLUDED.online_viewers,
        growth_rate    = EXCLUDED.growth_rate,
        archived_at    = now()
    `, [RETENTION_DAYS])
    const archivedRows = archiveResult.rowCount ?? 0

    // 3. 仅在转存成功后清理热表超期数据
    const deleteResult = await client.query(`
      DELETE FROM public.overview_daily_stats
      WHERE date < CURRENT_DATE - $1::int
    `, [RETENTION_DAYS])
    const deletedRows = deleteResult.rowCount ?? 0

    await client.query('COMMIT')

    const elapsed = ((Date.now() - start) / 1000).toFixed(2)
    logger.info({ job: JOB_NAME, elapsed: `${elapsed}s`, archivedRows, deletedRows }, 'Old data archival completed successfully')
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error({ job: JOB_NAME, err }, 'Old data archival failed')
  } finally {
    client.release()
  }
}
