import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'

const JOB_NAME = 'archive-old-data'

export async function archiveOldData(): Promise<void> {
  const pool = getPool()
  const start = Date.now()
  logger.info({ job: JOB_NAME }, 'Starting old data archival')

  try {
    // Archive live_sessions older than 90 days
    const result = await pool.query(`
      DELETE FROM overview_daily_stats
      WHERE date < CURRENT_DATE - 90
    `)
    const deletedRows = result.rowCount ?? 0

    const elapsed = ((Date.now() - start) / 1000).toFixed(2)
    logger.info({ job: JOB_NAME, elapsed: `${elapsed}s`, deletedRows }, 'Old data archival completed')
  } catch (err) {
    logger.error({ job: JOB_NAME, err }, 'Old data archival failed')
  }
}