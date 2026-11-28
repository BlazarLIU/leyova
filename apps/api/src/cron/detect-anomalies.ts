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

/** 写入 24 小时去重的告警事件（未闭环同名+同描述前缀 24h 内不重复创建） */
async function insertDedupAlert(
  pool: ReturnType<typeof getPool>,
  severity: 'critical' | 'warning',
  title: string,
  description: string,
): Promise<boolean> {
  const exist = await pool.query(
    `SELECT 1 FROM alert_events
     WHERE title = $1
       AND description = $2
       AND event_time >= NOW() - INTERVAL '24 hours'
       AND status IN ('pending', 'processing')
     LIMIT 1`,
    [title, description],
  )
  if (exist.rows.length > 0) return false
  await pool.query(
    `INSERT INTO alert_events (severity, title, description, event_time, status)
     VALUES ($1, $2, $3, NOW(), 'pending')`,
    [severity, title, description],
  )
  return true
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
          JOIN platform_caliber_config pcc
            ON pcc.platform_code = f.platform_code
           AND pcc.metric_code = 'gmv'
           AND pcc.is_default = true
          WHERE f.biz_date = CURRENT_DATE
            AND f.amount_type = pcc.amount_type  -- P0-B-2: fail-closed
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

    // 4. 核心业务链 SLA 与库存风控巡检（低库存 / 48h发货24h揽收违约 / 售后审单倒计时临期）
    let chainAlertsCount = 0

    // 4a. 低库存预警（available_qty < safety_stock）
    const lowStockRes = await pool.query(`
      SELECT p.sku_code, p.product_name, s.warehouse_name, s.available_qty, s.safety_stock
      FROM fact_inventory_stock s
      JOIN dim_product p ON p.id = s.product_id
      WHERE p.status = 'active' AND s.available_qty < s.safety_stock
      ORDER BY (s.safety_stock - s.available_qty) DESC
      LIMIT 10
    `)
    for (const row of lowStockRes.rows) {
      const desc = `SKU "${row.sku_code}"（${row.product_name}，${row.warehouse_name}）可用库存 ${row.available_qty} 低于安全库存阈值 ${row.safety_stock}`
      if (await insertDedupAlert(pool, Number(row.available_qty) <= 5 ? 'critical' : 'warning', '全渠道低库存预警', desc)) {
        chainAlertsCount++
      }
    }

    // 4b. 刷新动态超时运单状态并触发 48h 发货 / 24h 揽收违约预警
    await pool.query(`
      UPDATE fact_fulfillment_waybill
      SET is_ship_delayed = CASE WHEN shipped_at IS NULL AND NOW() > ship_deadline_at THEN true ELSE is_ship_delayed END,
          is_fake_ship_risk = CASE WHEN shipped_at IS NOT NULL AND pickup_at IS NULL AND NOW() - shipped_at > INTERVAL '24 hours' THEN true ELSE is_fake_ship_risk END,
          updated_at = NOW()
      WHERE fulfillment_status IN ('pending_ship', 'shipped_no_pickup')
        AND ((shipped_at IS NULL AND NOW() > ship_deadline_at AND is_ship_delayed = false)
          OR (shipped_at IS NOT NULL AND pickup_at IS NULL AND NOW() - shipped_at > INTERVAL '24 hours' AND is_fake_ship_risk = false))
    `)
    const slaRiskRes = await pool.query(`
      SELECT platform_code, order_no, estimated_penalty_amount, sla_risk_reason, is_fake_ship_risk
      FROM fact_fulfillment_waybill
      WHERE fulfillment_status IN ('pending_ship', 'shipped_no_pickup')
        AND (is_ship_delayed = true OR is_fake_ship_risk = true)
      ORDER BY estimated_penalty_amount DESC
      LIMIT 10
    `)
    for (const w of slaRiskRes.rows) {
      const title = w.is_fake_ship_risk ? '24h无揽收虚假发货风控' : '48h履约延迟发货预警'
      const desc = `平台[${w.platform_code}]订单 ${w.order_no}：${w.sla_risk_reason || title}（预估赔付 ¥${w.estimated_penalty_amount}）`
      if (await insertDedupAlert(pool, 'critical', title, desc)) {
        chainAlertsCount++
      }
    }

    // 4c. 售后工单自审倒计时临期预警（剩余不足 6 小时）
    const afterSaleRes = await pool.query(`
      SELECT ticket_no, platform_code, refund_type, refund_amount,
             ROUND(EXTRACT(EPOCH FROM (audit_deadline_at - NOW())) / 3600.0, 1) AS rem_hours
      FROM fact_after_sale_tickets
      WHERE ticket_status IN ('pending_audit', 'waiting_return')
        AND audit_deadline_at IS NOT NULL
        AND audit_deadline_at <= NOW() + INTERVAL '6 hours'
      ORDER BY audit_deadline_at ASC
      LIMIT 10
    `)
    for (const t of afterSaleRes.rows) {
      const desc = `售后工单 ${t.ticket_no}（${t.platform_code} / ¥${t.refund_amount}）距离平台自动同意截点仅余 ${t.rem_hours} 小时`
      if (await insertDedupAlert(pool, Number(t.rem_hours) <= 2 ? 'critical' : 'warning', '售后审单超时预警', desc)) {
        chainAlertsCount++
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
        chainAlertsCreated: chainAlertsCount,
      },
      'Anomaly detection and alert evaluation completed'
    )
  } catch (err) {
    logger.error({ job: JOB_NAME, err }, 'Anomaly detection failed')
  }
}
