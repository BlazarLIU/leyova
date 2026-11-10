import type { FastifyInstance } from 'fastify'
import { getPool } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireAuth } from '../lib/guard.js'

export async function alertRulesRoutes(app: FastifyInstance) {
  // ── GET /api/v1/alerts/rules ── 获取自定义指标告警规则列表
  app.get('/api/v1/alerts/rules', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(`
        SELECT 
          r.id,
          r.name AS "ruleName",
          r.shop_id AS "shopId",
          s.shop_name AS "shopName",
          r.platform_code AS "platformCode",
          sp.platform_name AS "platformName",
          r.metric AS "metricCode",
          r.condition,
          r.threshold::float AS "threshold",
          r.notify_channels AS "notifyChannels",
          r.enabled AS "isActive",
          r.severity,
          r.last_triggered_at AS "lastTriggeredAt",
          r.created_at AS "createdAt"
        FROM public.alert_rules r
        LEFT JOIN public.dim_shop s ON r.shop_id = s.id
        LEFT JOIN public.system_platform_configs sp ON r.platform_code = sp.platform_code
        ORDER BY r.id DESC
      `)

      return sendOk(reply, rows)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch alert rules')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/alerts/rules ── 创建告警规则
  app.post('/api/v1/alerts/rules', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    const {
      ruleName,
      shopId,
      platformCode,
      metricCode,
      condition = 'gt',
      threshold = 0,
      notifyChannels = [],
      severity = '警告',
      isActive = true,
    } = request.body as any

    if (!ruleName || !metricCode) {
      return sendError(reply, 400, '缺少必填字段: ruleName, metricCode')
    }

    try {
      const { rows } = await pool.query(
        `
        INSERT INTO public.alert_rules (
          name, shop_id, platform_code, metric, condition, threshold, notify_channels, severity, enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          ruleName,
          shopId || null,
          platformCode || null,
          metricCode,
          condition,
          threshold,
          JSON.stringify(notifyChannels),
          severity,
          isActive,
        ]
      )

      return sendOk(reply, rows[0], '告警规则创建成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create alert rule')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/alerts/rules/:id ── 更新规则
  app.put('/api/v1/alerts/rules/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    const { id } = request.params as { id: string }
    const { ruleName, condition, threshold, notifyChannels, severity, isActive } = request.body as any

    try {
      const updates: string[] = ['updated_at = NOW()']
      const params: any[] = [Number(id)]
      let pIdx = 2

      if (ruleName !== undefined) {
        updates.push(`name = $${pIdx++}`)
        params.push(ruleName)
      }
      if (condition !== undefined) {
        updates.push(`condition = $${pIdx++}`)
        params.push(condition)
      }
      if (threshold !== undefined) {
        updates.push(`threshold = $${pIdx++}`)
        params.push(threshold)
      }
      if (notifyChannels !== undefined) {
        updates.push(`notify_channels = $${pIdx++}`)
        params.push(JSON.stringify(notifyChannels))
      }
      if (severity !== undefined) {
        updates.push(`severity = $${pIdx++}`)
        params.push(severity)
      }
      if (isActive !== undefined) {
        updates.push(`enabled = $${pIdx++}`)
        params.push(isActive)
      }

      const sql = `UPDATE public.alert_rules SET ${updates.join(', ')} WHERE id = $1 RETURNING *`
      const { rows } = await pool.query(sql, params)

      if (rows.length === 0) {
        return sendError(reply, 404, '规则不存在')
      }

      return sendOk(reply, rows[0], '告警规则更新成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to update alert rule')
      return sendError(reply, 500, err.message)
    }
  })

  // ── DELETE /api/v1/alerts/rules/:id ── 删除规则
  app.delete('/api/v1/alerts/rules/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    const { id } = request.params as { id: string }
    try {
      const { rowCount } = await pool.query('DELETE FROM public.alert_rules WHERE id = $1', [Number(id)])
      if (rowCount === 0) {
        return sendError(reply, 404, '规则不存在')
      }
      return sendOk(reply, { success: true }, '告警规则已删除')
    } catch (err: any) {
      request.log.error(err, 'Failed to delete alert rule')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/alerts/rules/test-webhook ── 测试推送 Webhook
  app.post('/api/v1/alerts/rules/test-webhook', { preHandler: [requireAuth] }, async (request, reply) => {
    const { webhookUrl, channelType = 'dingtalk', ruleName = '测试指标预警' } = request.body as any
    if (!webhookUrl) {
      return sendError(reply, 400, 'Webhook URL 不能为空')
    }

    try {
      const sampleText = `【leyova 数据告警触发】\n规则名称：${ruleName}\n触发指标：退款率达到 18.5% (预设阈值: >15.0%)\n触发时间：${new Date().toLocaleString('zh-CN')}\n请运营负责人及时复盘千川投放与直播间话术。`

      let bodyData: any = {}
      if (channelType === 'dingtalk') {
        bodyData = {
          msgtype: 'text',
          text: { content: sampleText },
        }
      } else if (channelType === 'feishu') {
        bodyData = {
          msg_type: 'text',
          content: { text: sampleText },
        }
      } else {
        bodyData = {
          msgtype: 'text',
          text: { content: sampleText },
        }
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
        signal: AbortSignal.timeout(5000),
      })

      return sendOk(reply, {
        status: res.status,
        ok: res.ok,
        message: res.ok ? 'Webhook 测试通知发送成功！' : `发送失败 (HTTP ${res.status})`,
      })
    } catch (err: any) {
      return sendError(reply, 500, `Webhook 发送异常: ${err.message}`)
    }
  })
}
