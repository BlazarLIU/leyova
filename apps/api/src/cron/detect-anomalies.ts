import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'

const JOB_NAME = 'detect-anomalies'

export async function detectAnomalies(): Promise<void> {
  const pool = getPool()
  const start = Date.now()
  logger.info({ job: JOB_NAME }, 'Starting anomaly detection')

  try {
    // 1. Detect GMV anomalies (today vs 7-day average)
    const gmvAnomalies = await pool.query(`
      WITH weekly_avg AS (
        SELECT AVG(gmv) AS avg_gmv
        FROM live_sessions
        WHERE date >= CURRENT_DATE - 7 AND date < CURRENT_DATE AND status = 'completed'
      ),
      today_stats AS (
        SELECT COALESCE(SUM(gmv), 0) AS today_gmv
        FROM live_sessions
        WHERE date = CURRENT_DATE AND status IN ('live', 'completed')
      )
      SELECT today_gmv, avg_gmv
      FROM today_stats, weekly_avg
      WHERE avg_gmv > 0
        AND (today_gmv < avg_gmv * 0.5 OR today_gmv > avg_gmv * 1.5)
    `)

    if (gmvAnomalies.rows.length > 0) {
      const { today_gmv, avg_gmv } = gmvAnomalies.rows[0]
      const deviation = ((parseFloat(today_gmv) - parseFloat(avg_gmv)) / parseFloat(avg_gmv) * 100).toFixed(1)

      await pool.query(`
        INSERT INTO alert_events (severity, title, description, event_time, status)
        VALUES ($1, $2, $3, NOW(), 'pending')
      `, [
        Math.abs(parseFloat(deviation)) > 50 ? 'critical' : 'warning',
        'GMV 异常波动检测',
        `今日GMV ¥${(parseFloat(today_gmv) / 10000).toFixed(1)}万，较7日均值偏差 ${deviation}%`,
      ])

      logger.warn({ job: JOB_NAME, deviation: `${deviation}%`, today_gmv, avg_gmv }, 'GMV anomaly detected')
    }

    // 2. Detect low-activity rooms
    const lowActivity = await pool.query(`
      SELECT id, name FROM live_rooms
      WHERE id NOT IN (
        SELECT DISTINCT room_id FROM live_sessions
        WHERE date >= CURRENT_DATE - 3
      )
    `)

    for (const room of lowActivity.rows) {
      await pool.query(`
        INSERT INTO alert_events (severity, title, description, event_time, status)
        VALUES ('warning', $1, $2, NOW(), 'pending')
      `, [
        '直播间无活动',
        `直播间"${room.name}"近3天无开播记录`,
      ])
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2)
    logger.info({
      job: JOB_NAME,
      elapsed: `${elapsed}s`,
      gmvAlerts: gmvAnomalies.rows.length,
      roomAlerts: lowActivity.rows.length,
    }, 'Anomaly detection completed')
  } catch (err) {
    logger.error({ job: JOB_NAME, err }, 'Anomaly detection failed')
  }
}