import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'

const JOB_NAME = 'detect-anomalies'

/** 异步发送告警 Webhook 通知 (钉钉/飞书/通用) */
async function sendWebhookNotification(
  webhookUrl: string,
  channelType: string,
  ruleName: string,
  description: string
) {
  try {
    const text = `【Leyova 告警触发通知】\n规则：${ruleName}\n详情：${description}\n触发时间：${new Date().toLocaleString('zh-CN')}`
    const payload =
      channelType === 'feishu'
        ? { msg_type: 'text', content: { text } }
        : { msgtype: 'text', text: { content: text } }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err: any) {
    logger.warn({ err: err?.message, webhookUrl }, '[alert] Webhook delivery failed')
  }
}

export async function detectAnomalies(): Promise<void> {
  const pool = getPool()
  const start = Date.now()
  logger.info({ job: JOB_NAME }, 'Starting anomaly detection and alert rules evaluation')

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

    let gmvCreated = 0
    if (gmvAnomalies.rows.length > 0) {
      const { today_gmv, avg_gmv } = gmvAnomalies.rows[0]
      const deviation = (((parseFloat(today_gmv) - parseFloat(avg_gmv)) / parseFloat(avg_gmv)) * 100).toFixed(1)

      // 去重检查：24 小时内未闭环同名告警严禁重复生成
      const existGmv = await pool.query(
        `SELECT 1 FROM alert_events
         WHERE title = 'GMV 异常波动检测'
           AND event_time >= NOW() - INTERVAL '24 hours'
           AND status IN ('pending', 'processing')
         LIMIT 1`
      )
      if (existGmv.rows.length === 0) {
        await pool.query(
          `INSERT INTO alert_events (severity, title, description, event_time, status)
           VALUES ($1, $2, $3, NOW(), 'pending')`,
          [
            Math.abs(parseFloat(deviation)) > 50 ? 'critical' : 'warning',
            'GMV 异常波动检测',
            `今日GMV ¥${(parseFloat(today_gmv) / 10000).toFixed(1)}万，较7日均值偏差 ${deviation}%`,
          ]
        )
        gmvCreated++
        logger.warn({ job: JOB_NAME, deviation: `${deviation}%`, today_gmv, avg_gmv }, 'GMV anomaly detected')
      }
    }

    // 2. Detect low-activity rooms
    const lowActivity = await pool.query(`
      SELECT id, name FROM live_rooms
      WHERE id NOT IN (
        SELECT DISTINCT room_id FROM live_sessions
        WHERE date >= CURRENT_DATE - 3
      )
    `)

    let roomCreated = 0
    for (const room of lowActivity.rows) {
      // 去重检查：24 小时内同一直播间无活动告警不重复生成
      const existRoom = await pool.query(
        `SELECT 1 FROM alert_events
         WHERE title = '直播间无活动'
           AND description LIKE $1
           AND event_time >= NOW() - INTERVAL '24 hours'
           AND status IN ('pending', 'processing')
         LIMIT 1`,
        [`%${room.name}%`]
      )
      if (existRoom.rows.length === 0) {
        await pool.query(
          `INSERT INTO alert_events (severity, title, description, event_time, status)
           VALUES ('warning', $1, $2, NOW(), 'pending')`,
          ['直播间无活动', `直播间"${room.name}"近3天无开播记录`]
        )
        roomCreated++
      }
    }

    // 3. 动态评测已启用的 alert_rules 自定义告警规则 (修复 P0-4 告警链路断开)
    const enabledRules = await pool.query(`
      SELECT id, name, metric, condition, threshold, notify_channels, severity
      FROM public.alert_rules
      WHERE enabled = true
    `)

    let ruleAlertsCount = 0
    for (const rule of enabledRules.rows) {
      let triggered = false
      let triggerDesc = ''

      if (rule.metric === 'refund_rate') {
        const refRes = await pool.query(`
          SELECT COALESCE(SUM(f.refund_amount), 0) AS total_refund, COALESCE(SUM(f.gmv), 0) AS total_gmv
          FROM fact_trade_daily f
          LEFT JOIN platform_caliber_config pcc
            ON pcc.platform_code = f.platform_code
           AND pcc.metric_code = 'gmv'
           AND pcc.is_default = true
          WHERE f.biz_date = CURRENT_DATE
            AND (pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type)
        `)
        const refGmv = parseFloat(refRes.rows[0]?.total_gmv || 0)
        const refAmount = parseFloat(refRes.rows[0]?.total_refund || 0)
        if (refGmv > 0) {
          const curRate = refAmount / refGmv
          if (rule.condition === 'gt' && curRate > parseFloat(rule.threshold)) {
            triggered = true
            triggerDesc = `今日全店退款率 ${(curRate * 100).toFixed(1)}% 超过预警阈值 ${(parseFloat(rule.threshold) * 100).toFixed(1)}%`
          }
        }
      } else if (rule.metric === 'gmv') {
        const gmvRes = await pool.query(
          `SELECT id, title, gmv FROM live_sessions
           WHERE date = CURRENT_DATE AND status = 'completed' AND gmv < $1
           ORDER BY gmv ASC LIMIT 1`,
          [rule.threshold]
        )
        if (gmvRes.rows.length > 0 && rule.condition === 'lt') {
          triggered = true
          triggerDesc = `场次 "${gmvRes.rows[0].title}" GMV ¥${gmvRes.rows[0].gmv} 低于预警门槛 ¥${rule.threshold}`
        }
      } else if (rule.metric === 'data_upload') {
        const upRes = await pool.query(
          `SELECT count(*)::int as cnt FROM data_uploads WHERE business_date = CURRENT_DATE AND status = 'completed'`
        )
        if (Number(upRes.rows[0]?.cnt || 0) === 0 && rule.condition === 'eq' && parseFloat(rule.threshold) === 0) {
          triggered = true
          triggerDesc = `今日截至当前尚未检测到任何已完成的数据上传记录`
        }
      }

      if (triggered) {
        // 去重检查
        const existRule = await pool.query(
          `SELECT 1 FROM alert_events
           WHERE title = $1
             AND event_time >= NOW() - INTERVAL '24 hours'
             AND status IN ('pending', 'processing')
           LIMIT 1`,
          [rule.name]
        )
        if (existRule.rows.length === 0) {
          await pool.query(
            `INSERT INTO alert_events (severity, title, description, event_time, status)
             VALUES ($1, $2, $3, NOW(), 'pending')`,
            [
              rule.severity === '严重' ? 'critical' : 'warning',
              rule.name,
              triggerDesc,
            ]
          )

          // 刷新规则最后触发时间
          await pool.query(
            `UPDATE public.alert_rules SET last_triggered_at = NOW() WHERE id = $1`,
            [rule.id]
          )
          ruleAlertsCount++

          // 触发已绑定的 Webhook 外部通知
          const channels = Array.isArray(rule.notify_channels) ? rule.notify_channels : []
          for (const ch of channels) {
            if (ch?.webhookUrl) {
              sendWebhookNotification(ch.webhookUrl, ch.type || 'dingtalk', rule.name, triggerDesc).catch(() => {})
            }
          }
        }
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2)
    logger.info(
      {
        job: JOB_NAME,
        elapsed: `${elapsed}s`,
        gmvAlertsCreated: gmvCreated,
        roomAlertsCreated: roomCreated,
        ruleAlertsCreated: ruleAlertsCount,
      },
      'Anomaly detection and alert evaluation completed'
    )
  } catch (err) {
    logger.error({ job: JOB_NAME, err }, 'Anomaly detection failed')
  }
}
