import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { runComplianceScan } from '../modules/compliance/compliance-scanner.js'

/**
 * 每日 3 次全网合规风控巡检任务
 * 时间点：09:30 / 13:00 / 18:30
 */
export async function runCompliancePatrolJob() {
  const pool = getPool()
  const client = await pool.connect()
  try {
    logger.info('[compliance-patrol] Starting daily 3x compliance scan...')
    const result = await runComplianceScan(client)
    logger.info(result, '[compliance-patrol] Compliance scan completed')
    return result
  } catch (err) {
    logger.error({ err }, '[compliance-patrol] Compliance scan failed')
    throw err
  } finally {
    client.release()
  }
}
