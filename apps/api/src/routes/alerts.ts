import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

export async function alertRulesRoutes(app: FastifyInstance) {
  // ── GET /api/v1/alerts/rules ── 获取自定义指标告警规则列表
  app.get('/api/v1/alerts/rules', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) => client.query(`
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
      `))

      return sendOk(reply, rows)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch alert rules')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/alerts/rules ── 创建告警规则
  app.post('/api/v1/alerts/rules', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
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
      const { rows } = await withRlsContext(request, (client) => client.query(
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
      ))

      return sendOk(reply, rows[0], '告警规则创建成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create alert rule')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/alerts/rules/:id ── 更新规则
  app.put('/api/v1/alerts/rules/:id', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
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
      const { rows } = await withRlsContext(request, (client) => client.query(sql, params))

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
  app.delete('/api/v1/alerts/rules/:id', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const { rowCount } = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT * FROM public.alert_rules WHERE id = $1', [Number(id)])
        const delRes = await client.query('DELETE FROM public.alert_rules WHERE id = $1', [Number(id)])
        if ((delRes.rowCount ?? 0) > 0) {
          await writeAuditLog(client, {
            request,
            action: 'alerts.rule.delete',
            resourceType: 'alert_rules',
            resourceId: id,
            beforeData: beforeRes.rows[0] ?? null,
          })
        }
        return delRes
      })
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
  app.post('/api/v1/alerts/rules/test-webhook', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
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

  // ── GET /api/v1/alerts/events ── 查询告警事件列表（支持状态过滤与分页）
  app.get('/api/v1/alerts/events', { preHandler: [requireAuth] }, async (request, reply) => {
    const { status, limit = '50', offset = '0' } = request.query as any

    try {
      const conds: string[] = []
      const params: any[] = []

      if (status) {
        params.push(status)
        conds.push(`status = $${params.length}`)
      }

      const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
      const lim = Math.min(parseInt(limit, 10) || 50, 200)
      const off = Math.max(parseInt(offset, 10) || 0, 0)

      params.push(lim, off)
      const query = `
        SELECT id, severity, title, description, event_time AS "eventTime", status, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM public.alert_events
        ${whereClause}
        ORDER BY event_time DESC, id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `
      const { rows, countRes } = await withRlsContext(request, async (client) => {
        const listRes = await client.query(query, params)
        const cntRes = await client.query(
          `SELECT count(*)::int as total FROM public.alert_events ${whereClause}`,
          conds.length > 0 ? [status] : []
        )
        return { rows: listRes.rows, countRes: cntRes }
      })

      return sendOk(reply, {
        total: countRes.rows[0]?.total || 0,
        items: rows,
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch alert events')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/alerts/events/:id/status ── 推进/解决单条告警事件
  app.put('/api/v1/alerts/events/:id/status', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator'])] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: 'pending' | 'processing' | 'resolved' }

    if (!['pending', 'processing', 'resolved'].includes(status)) {
      return sendError(reply, 400, '无效的告警状态，仅支持 pending / processing / resolved')
    }

    try {
      const { rows } = await withRlsContext(request, (client) => client.query(
        `UPDATE public.alert_events
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, severity, title, status, updated_at`,
        [status, Number(id)]
      ))

      if (rows.length === 0) {
        return sendError(reply, 404, '告警事件不存在')
      }

      return sendOk(reply, rows[0], `告警状态已成功更新为: ${status}`)
    } catch (err: any) {
      request.log.error(err, 'Failed to update alert event status')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/alerts/events/resolve-all ── 一键闭环所有待处理告警
  app.post('/api/v1/alerts/events/resolve-all', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator'])] }, async (request, reply) => {
    try {
      const { rowCount } = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE public.alert_events
           SET status = 'resolved', updated_at = NOW()
           WHERE status IN ('pending', 'processing')`
        )
        await writeAuditLog(client, {
          request,
          action: 'alerts.events.resolve_all',
          resourceType: 'alert_events',
          afterData: { resolvedCount: res.rowCount },
        })
        return res
      })
      return sendOk(reply, { resolvedCount: rowCount }, `已一键闭环 ${rowCount} 条未决告警事件`)
    } catch (err: any) {
      request.log.error(err, 'Failed to resolve all alert events')
      return sendError(reply, 500, err.message)
    }
  })
}
