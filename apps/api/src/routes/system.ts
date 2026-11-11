import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { queryInventoryProducts } from './inventory.js'

// 规范化目标模板指标项：{ metric, target, unit }，过滤非法项
function normalizeTemplateMetrics(items?: Array<{ metric?: string; target?: number | string; unit?: string }>) {
  return (items || [])
    .map((it) => ({
      metric: (it.metric || '').trim(),
      target: it.target == null || isNaN(Number(it.target)) ? null : Number(it.target),
      unit: (it.unit || '').trim(),
    }))
    .filter((it) => it.metric && it.target != null && isNaN(Number(it.target)) === false)
}

// 校验目标周期参数，返回合法值或空串
function validateTemplatePeriod(period?: string): string {
  const p = (period || '').trim().toLowerCase()
  return ['monthly', 'quarterly', 'yearly'].includes(p) ? p : ''
}

export async function systemRoutes(app: FastifyInstance) {
  // ── GET /api/v1/system/roles ──
  app.get('/api/v1/system/roles', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT r.code, r.name, r.description,
                COALESCE(
                  (SELECT json_agg(rm.module_code) FROM role_modules rm WHERE rm.role_code = r.code),
                  '[]'
                ) AS modules
         FROM roles r ORDER BY r.id`
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/roles query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/system/modules ──
  app.get('/api/v1/system/modules', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT code, name, icon, sort_order, visible_to FROM system_modules ORDER BY sort_order`
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/modules query failed')
      return sendOk(reply, [])
    }
  })

  // ── PUT /api/v1/system/roles/modules ── 更新角色模块权限
  app.put('/api/v1/system/roles/modules', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const pool = getPool()
    try {
      const body = request.body as { roleCode: string; moduleCodes: string[] }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM role_modules WHERE role_code = $1', [body.roleCode])
        for (const mc of body.moduleCodes) {
          await client.query(
            'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [body.roleCode, mc]
          )
        }
        await client.query('COMMIT')
        return sendOk(reply, { updated: true })
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    } catch (err) {
      request.log.warn({ err }, 'system/roles/modules update failed')
      return sendOk(reply, { updated: false })
    }
  })

  // ── GET /api/v1/system/users ──
  app.get('/api/v1/system/users', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT id, username, real_name AS "realName", role, status, last_login_at AS "lastLogin",
                created_at AS "createdAt" FROM users ORDER BY id`
      )
      // 为每条用户附加模块权限
      const result = []
      for (const row of rows) {
        const { rows: mods } = await pool.query(
          'SELECT module_code FROM role_modules WHERE role_code = $1',
          [row.role]
        )
        result.push({ ...row, modules: mods.map((m: any) => m.module_code) })
      }
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'system/users list failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/system/users ──
  app.post('/api/v1/system/users', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const pool = getPool()
    try {
      const body = request.body as {
        username?: string; realName?: string; role?: string; status?: number; modules?: string[]
        password?: string
      }
      const username = (body.username || '').trim()
      if (!username || username.length > 50) {
        return sendError(reply, 400, '用户名不能为空且长度不能超过 50 个字符')
      }
      const { rows: existing } = await pool.query(
        'SELECT 1 FROM users WHERE username = $1',
        [username]
      )
      if (existing.length > 0) {
        return sendError(reply, 409, '用户名已存在')
      }
      const { env } = await import('../config/env.js')
      const password = body.password || env.DEFAULT_USER_PASSWORD
      if (!password) {
        return sendError(reply, 400, '密码不能为空')
      }
      const hash = bcrypt.hashSync(password, 10)
      const role = body.role || 'employee'
      const validRoles = ['super_admin', 'admin', 'operator', 'finance', 'hrbp', 'employee', 'ops_director', 'ops_staff', 'controller', 'manager']
      if (!validRoles.includes(role)) {
        return sendError(reply, 400, '角色不合法，可选角色：系统管理员(super_admin)、管理员(admin)、运营(operator)、财务(finance)、HRBP(hrbp)、员工(employee)')
      }
      const { rows } = await pool.query(
        `INSERT INTO users (username, password_hash, real_name, role, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, username, real_name AS "realName", role, status, created_at AS "createdAt"`,
        [username, hash, body.realName || '新用户', role, body.status ?? 1]
      )
      if (rows.length === 0) return sendError(reply, 500, '创建失败')
      // 保存自定义模块权限
      if (body.modules && body.modules.length > 0) {
        for (const mc of body.modules) {
          await pool.query(
            'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [role, mc]
          )
        }
      }
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'system/users create failed')
      return sendError(reply, 500, '创建失败，请检查输入后重试')
    }
  })

  // ── PUT /api/v1/system/users/:id ──
  app.put('/api/v1/system/users/:id', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const pool = getPool()
    try {
      const { id } = request.params as { id: string }
      const body = request.body as {
        realName?: string; role?: string; status?: number; modules?: string[]
      }
      await pool.query(
        `UPDATE users SET real_name = COALESCE($1, real_name), role = COALESCE($2, role),
         status = COALESCE($3, status), updated_at = NOW() WHERE id = $4`,
        [body.realName, body.role, body.status, parseInt(id)]
      )
      // 更新模块权限
      if (body.role && body.modules) {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          await client.query('DELETE FROM role_modules WHERE role_code = $1', [body.role])
          for (const mc of (body.modules || [])) {
            await client.query(
              'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [body.role, mc]
            )
          }
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally {
          client.release()
        }
      }
      return sendOk(reply, { updated: true })
    } catch (err) {
      request.log.warn({ err }, 'system/users update failed')
      return sendOk(reply, { updated: false })
    }
  })

  // ── DELETE /api/v1/system/users/:id ──
  app.delete('/api/v1/system/users/:id', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const pool = getPool()
    try {
      const { id } = request.params as { id: string }
      const result = await pool.query('DELETE FROM users WHERE id = $1', [parseInt(id)])
      return sendOk(reply, { deleted: (result.rowCount ?? 0) > 0 })
    } catch (err) {
      request.log.warn({ err }, 'system/users delete failed')
      return sendOk(reply, { deleted: false })
    }
  })

  // ── GET /api/v1/system/rooms ── 直播间管理
  app.get('/api/v1/system/rooms', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT id, name, platform, status, created_at, updated_at
         FROM live_rooms ORDER BY id`
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/rooms list failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/system/rooms ──
  app.post('/api/v1/system/rooms', async (request, reply) => {
    const pool = getPool()
    try {
      const body = request.body as {
        name?: string; platform?: string; status?: string
      }
      const { rows } = await pool.query(
        `INSERT INTO live_rooms (name, platform, status)
         VALUES ($1, $2, $3) RETURNING id, name, platform, status, created_at, updated_at`,
        [body.name || '新直播间', body.platform || '抖音', body.status || 'inactive']
      )
      if (rows.length === 0) return sendOk(reply, { error: '创建失败' })
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'system/rooms create failed')
      return sendOk(reply, { error: '创建失败' })
    }
  })

  // ── PUT /api/v1/system/rooms/:id ──
  app.put('/api/v1/system/rooms/:id', async (request, reply) => {
    const pool = getPool()
    try {
      const { id } = request.params as { id: string }
      const body = request.body as {
        name?: string; platform?: string; status?: string
      }
      const result = await pool.query(
        `UPDATE live_rooms SET
         name = COALESCE($1, name),
         platform = COALESCE($2, platform),
         status = COALESCE($3, status),
         updated_at = NOW()
         WHERE id = $4`,
        [body.name, body.platform, body.status, parseInt(id)]
      )
      return sendOk(reply, { updated: (result.rowCount ?? 0) > 0 })
    } catch (err) {
      request.log.warn({ err }, 'system/rooms update failed')
      return sendOk(reply, { updated: false })
    }
  })

  // ── DELETE /api/v1/system/rooms/:id ──
  app.delete('/api/v1/system/rooms/:id', async (request, reply) => {
    const pool = getPool()
    try {
      const { id } = request.params as { id: string }
      const result = await pool.query('DELETE FROM live_rooms WHERE id = $1', [parseInt(id)])
      return sendOk(reply, { deleted: (result.rowCount ?? 0) > 0 })
    } catch (err) {
      request.log.warn({ err }, 'system/rooms delete failed')
      return sendOk(reply, { deleted: false })
    }
  })

  // ── GET /api/v1/system/target-templates ── 目标模板列表
  app.get('/api/v1/system/target-templates', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT id, name, metrics, period, created_at::text AS "createdAt", updated_at::text AS "updatedAt"
         FROM target_templates ORDER BY id DESC`
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates list failed')
      return sendError(reply, 500, '获取目标模板失败')
    }
  })

  // ── POST /api/v1/system/target-templates ── 新建目标
  // metrics: [{ metric, target, unit }]（每个指标均可设定目标数值）
  app.post('/api/v1/system/target-templates', async (request, reply) => {
    const pool = getPool()
    try {
      const body = request.body as { name?: string; period?: string; metrics?: Array<{ metric?: string; target?: number | string; unit?: string }> }
      const name = (body.name || '').trim()
      if (!name) return sendError(reply, 400, '目标名称不能为空')
      if (name.length > 200) return sendError(reply, 400, '目标名称长度不能超过 200 个字符')
      const period = validateTemplatePeriod(body.period)
      if (!period) return sendError(reply, 400, '周期参数不合法（应为 monthly/quarterly/yearly）')
      const metrics = normalizeTemplateMetrics(body.metrics)
      if (metrics.length === 0) return sendError(reply, 400, '请至少添加一个指标并填写目标值')
      const { rows } = await pool.query(
        `INSERT INTO target_templates (name, period, metrics)
         VALUES ($1, $2, $3) RETURNING id, name, metrics, period, created_at::text AS "createdAt", updated_at::text AS "updatedAt"`,
        [name, period, JSON.stringify(metrics)]
      )
      if (rows.length === 0) return sendError(reply, 500, '创建目标失败')
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates create failed')
      return sendError(reply, 500, '创建目标失败')
    }
  })

  // ── PUT /api/v1/system/target-templates/:id ── 编辑目标
  app.put('/api/v1/system/target-templates/:id', async (request, reply) => {
    const pool = getPool()
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { name?: string; period?: string; metrics?: Array<{ metric?: string; target?: number | string; unit?: string }> }
      const name = (body.name || '').trim()
      if (!name) return sendError(reply, 400, '目标名称不能为空')
      if (name.length > 200) return sendError(reply, 400, '目标名称长度不能超过 200 个字符')
      const period = validateTemplatePeriod(body.period)
      if (!period) return sendError(reply, 400, '周期参数不合法（应为 monthly/quarterly/yearly）')
      const metrics = normalizeTemplateMetrics(body.metrics)
      if (metrics.length === 0) return sendError(reply, 400, '请至少添加一个指标并填写目标值')
      const result = await pool.query(
        `UPDATE target_templates SET name = $1, period = $2, metrics = $3, updated_at = NOW()
         WHERE id = $4`,
        [name, period, JSON.stringify(metrics), parseInt(id)]
      )
      if ((result.rowCount ?? 0) === 0) return sendError(reply, 404, '目标不存在')
      const { rows } = await pool.query(
        `SELECT id, name, metrics, period, created_at::text AS "createdAt", updated_at::text AS "updatedAt"
         FROM target_templates WHERE id = $1`,
        [parseInt(id)]
      )
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates update failed')
      return sendError(reply, 500, '更新目标失败')
    }
  })

  // ── POST /api/v1/system/target-templates/:id/apply ── 应用到目标达成
  // 将模板中的每个指标项写入 goal_tracking（目标达成页面数据源）
  app.post('/api/v1/system/target-templates/:id/apply', async (request, reply) => {
    const pool = getPool()
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { period?: string }
      const { rows } = await pool.query(
        'SELECT id, name, metrics, period FROM target_templates WHERE id = $1',
        [parseInt(id)]
      )
      if (rows.length === 0) return sendError(reply, 404, '目标不存在')
      const tmpl = rows[0]
      // 优先使用模板自身设定的周期，未设定时允许请求参数覆盖
      const period = validateTemplatePeriod(tmpl.period) || validateTemplatePeriod(body.period) || 'monthly'
      const items: Array<{ metric?: string; target?: number; unit?: string }> = tmpl.metrics || []
      let inserted = 0
      let updated = 0
      for (const it of items) {
        const metric = (it.metric || '').trim()
        const target = it.target
        if (!metric || target == null || isNaN(Number(target))) continue
        const name = `${tmpl.name} · ${metric}`
        const unit = (it.unit || '%').trim() || '%'
        // 已应用过（同一来源目标）则更新数值，避免重复插入
        const up = await pool.query(
          `UPDATE goal_tracking SET target = $1, unit = $2, period = $3, updated_at = NOW()
           WHERE source_template_id = $4 AND name = $5`,
          [Number(target), unit, period, tmpl.id, name]
        )
        if ((up.rowCount ?? 0) > 0) { updated++; continue }
        await pool.query(
          `INSERT INTO goal_tracking (name, target, current_val, unit, progress, category, period, source_template_id)
           VALUES ($1, $2, 0, $3, 0, '营收', $4, $5)`,
          [name, Number(target), unit, period, tmpl.id]
        )
        inserted++
      }
      return sendOk(reply, { applied: inserted, updated, name: tmpl.name, period })
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates apply failed')
      return sendError(reply, 500, '应用到目标达成失败')
    }
  })

  // ── DELETE /api/v1/system/target-templates/:id ── 删除目标（级联删除其目标达成记录）
  app.delete('/api/v1/system/target-templates/:id', async (request, reply) => {
    const pool = getPool()
    try {
      const { id } = request.params as { id: string }
      const cascade = await pool.query(
        'DELETE FROM goal_tracking WHERE source_template_id = $1',
        [parseInt(id)]
      )
      const result = await pool.query('DELETE FROM target_templates WHERE id = $1', [parseInt(id)])
      if ((result.rowCount ?? 0) === 0) return sendError(reply, 404, '目标不存在')
      return sendOk(reply, { deleted: true, cascadeDeleted: cascade.rowCount ?? 0 })
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates delete failed')
      return sendError(reply, 500, '删除目标失败')
    }
  })

  // ── GET /api/v1/system/config ──
  app.get('/api/v1/system/config', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query('SELECT * FROM system_config ORDER BY id')
      const config: Record<string, string> = {}
      for (const r of rows) config[r.config_key] = r.config_value
      return sendOk(reply, config)
    } catch (err) {
      request.log.warn({ err }, 'system/config query failed')
      return sendOk(reply, {})
    }
  })

  // ── PUT /api/v1/system/config ──
  app.put('/api/v1/system/config', async (request, reply) => {
    const pool = getPool()
    try {
      const body = request.body as Record<string, string>
      for (const [key, value] of Object.entries(body)) {
        await pool.query(
          `INSERT INTO system_config (config_key, config_value) VALUES ($1, $2)
           ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = NOW()`,
          [key, value]
        )
      }
      return sendOk(reply, { message: '配置已更新' })
    } catch (err) {
      request.log.warn({ err }, 'system/config update failed')
      return sendOk(reply, { message: '更新失败' })
    }
  })

  // ── GET /api/v1/system/alerts ──
  app.get('/api/v1/system/alerts', async (request, reply) => {
    const pool = getPool()
    try {
      // 1. 静态预警事件
      const { rows: events } = await pool.query(
        'SELECT id, severity, title, description, event_time, status FROM alert_events ORDER BY event_time DESC LIMIT 20'
      )
      const { rows: rules } = await pool.query('SELECT * FROM alert_rules ORDER BY id')

      // 2. 自动检测动态异常
      const autoAlerts: any[] = []

      // 2a. 数据完整性检查 — 当日未上传
      const today = new Date().toISOString().slice(0, 10)
      const uploadsToday = await pool.query(
        `SELECT data_type FROM data_uploads WHERE business_date = $1::date AND status = 'completed'`,
        [today],
      )
      const uploadedTypes = new Set(uploadsToday.rows.map((r: any) => r.data_type))
      if (!uploadedTypes.has('anchor_analysis')) {
        autoAlerts.push({
          id: 'auto-missing-anchor', severity: 'warning', title: '主播分析日报未上传',
          description: `今日(${today})主播分析日报尚未上传，请提醒运营团队及时上传`,
          time: today, status: 'pending',
        })
      }
      if (!uploadedTypes.has('channel_analysis')) {
        autoAlerts.push({
          id: 'auto-missing-channel', severity: 'warning', title: '渠道分析日报未上传',
          description: `今日(${today})渠道分析日报尚未上传，请提醒运营团队及时上传`,
          time: today, status: 'pending',
        })
      }

      // 2b. 主播GMV异常 — 较近7天大幅下降
      const anchorGmvRows = await pool.query(
        `SELECT a.name AS anchor_name,
                COALESCE(AVG(ls.gmv_per_hour), 0) AS today_avg,
                COALESCE((
                  SELECT AVG(sub.gmv_per_hour)
                  FROM live_sessions sub
                  WHERE sub.anchor_id = ls.anchor_id
                    AND sub.date >= CURRENT_DATE - INTERVAL '8 days'
                    AND sub.date < CURRENT_DATE
                    AND sub.gmv_per_hour IS NOT NULL
                    AND sub.status = 'completed'
                ), 0) AS past_avg
         FROM anchors a
         JOIN live_sessions ls ON ls.anchor_id = a.id
         WHERE a.status = 1 AND ls.date = CURRENT_DATE AND ls.status IN ('live', 'completed')
         GROUP BY a.id, a.name, ls.anchor_id`
      )
      for (const row of anchorGmvRows.rows) {
        const todayVal = parseFloat(row.today_avg)
        const pastVal = parseFloat(row.past_avg)
        if (pastVal > 0 && todayVal > 0 && (todayVal - pastVal) / pastVal < -0.3) {
          const dropPct = Math.round((1 - todayVal / pastVal) * 100)
          autoAlerts.push({
            id: `auto-anchor-gmv-${row.anchor_name}`, severity: 'critical', title: `${row.anchor_name} GMV异常下降`,
            description: `${row.anchor_name}今日小时产出¥${todayVal.toFixed(0)}，较近7天均值¥${pastVal.toFixed(0)}下降${dropPct}%`,
            time: today, status: 'pending',
          })
        }
      }

      // 2c. 渠道异常 — 观看增加但成交下降
      const channelRows = await pool.query(
        `SELECT sc.channel,
                COALESCE(SUM(sc.views) FILTER (WHERE s.date = CURRENT_DATE), 0) AS today_views,
                COALESCE(SUM(sc.orders) FILTER (WHERE s.date = CURRENT_DATE), 0) AS today_orders,
                COALESCE(SUM(sc.views) FILTER (WHERE s.date >= CURRENT_DATE - 8 AND s.date < CURRENT_DATE), 0) AS past_views,
                COALESCE(SUM(sc.orders) FILTER (WHERE s.date >= CURRENT_DATE - 8 AND s.date < CURRENT_DATE), 0) AS past_orders
         FROM session_channel_metrics sc
         JOIN live_sessions s ON s.id = sc.session_id
         WHERE s.date >= CURRENT_DATE - INTERVAL '8 days' AND s.status = 'completed'
         GROUP BY sc.channel`
      )
      for (const row of channelRows.rows) {
        const tv = parseInt(row.today_views)
        const to = parseInt(row.today_orders)
        const pv = parseInt(row.past_views)
        const po = parseInt(row.past_orders)
        if (pv > 0 && tv > 0 && po > 0) {
          const viewChange = (tv - pv) / pv
          const orderChange = (to - po) / po
          if (viewChange > 0.2 && orderChange < -0.3) {
            autoAlerts.push({
              id: `auto-channel-${row.channel}`, severity: 'warning', title: `${row.channel} 渠道异常`,
              description: `${row.channel}渠道观看量环比+${Math.round(viewChange*100)}%，但成交订单环比${Math.round(orderChange*100)}%，转化效率下降`,
              time: today, status: 'pending',
            })
          }
        }
      }

      // 2d. 转化异常 — 商品点击率/成交率偏低
      const convRows = await pool.query(
        `SELECT sc.channel,
                COALESCE(AVG(sc.product_click_rate), 0) AS avg_click_rate,
                COALESCE(AVG(sc.product_deal_rate), 0) AS avg_deal_rate
         FROM session_channel_metrics sc
         JOIN live_sessions s ON s.id = sc.session_id
         WHERE s.date >= CURRENT_DATE - INTERVAL '7 days' AND s.status = 'completed'
         GROUP BY sc.channel`
      )
      for (const row of convRows.rows) {
        const clickRate = parseFloat(row.avg_click_rate)
        const dealRate = parseFloat(row.avg_deal_rate)
        if (clickRate > 0 && clickRate < 1.5) {
          autoAlerts.push({
            id: `auto-conv-click-${row.channel}`, severity: 'warning', title: `${row.channel} 商品点击率偏低`,
            description: `${row.channel}商品曝光-点击率仅${clickRate.toFixed(1)}%，低于正常阈值，需优化商品讲解`,
            time: today, status: 'pending',
          })
        }
        if (dealRate > 0 && dealRate < 0.5) {
          autoAlerts.push({
            id: `auto-conv-deal-${row.channel}`, severity: 'info', title: `${row.channel} 成交转化率偏低`,
            description: `${row.channel}商品点击-成交率仅${dealRate.toFixed(1)}%，需检查价格和福利机制`,
            time: today, status: 'pending',
          })
        }
      }

      // 2e. 数据质量 — 空值率扫描
      const qualityRow = await pool.query(
        `SELECT COUNT(*)::int AS total,
                SUM(CASE WHEN uv_value IS NULL OR interaction_rate IS NULL OR retention_rate IS NULL THEN 1 ELSE 0 END)::int AS null_count
         FROM live_sessions WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND status != 'scheduled'`
      )
      const q = qualityRow.rows[0]
      if (q.total > 0 && q.null_count > 0) {
        const nullRate = Math.round((q.null_count / q.total) * 100)
        if (nullRate > 5) {
          autoAlerts.push({
            id: 'auto-data-quality', severity: 'info', title: '数据质量异常',
            description: `近7天数据中有${q.null_count}条记录存在空值（空值率${nullRate}%），建议检查数据导入完整性`,
            time: today, status: 'pending',
          })
        }
      }

      // 合并静态事件+自动检测，去重
      const allAlerts = [
        ...autoAlerts,
        ...events.map((e: any) => ({
          id: String(e.id), severity: e.severity, title: e.title,
          description: e.description || '', time: e.event_time?.toISOString?.()?.slice(0, 10) ?? '',
          status: e.status,
        })),
      ]

      // tableAlerts: 按类型汇总
      const typeCounts = new Map<string, { type: string; severity: string; source: string; count: number; lastOccur: string; status: string }>()
      const countByType = (items: any[]) => {
        for (const a of items) {
          let cat = '其他'
          if (a.title.includes('未上传')) cat = '数据缺失'
          else if (a.title.includes('GMV')) cat = 'GMV异常'
          else if (a.title.includes('渠道')) cat = '渠道异常'
          else if (a.title.includes('商品点击') || a.title.includes('成交转化')) cat = '转化异常'
          else if (a.title.includes('空值') || a.title.includes('数据质量')) cat = '数据质量'
          else if (a.title.includes('互动')) cat = '主播异常'
          else if (a.title.includes('直播间')) cat = '直播间异常'

          const existing = typeCounts.get(cat)
          if (existing) {
            existing.count++
            existing.lastOccur = a.time > existing.lastOccur ? a.time : existing.lastOccur
          } else {
            typeCounts.set(cat, {
              type: cat, severity: a.severity,
              source: cat === 'GMV异常' || cat === '主播异常' ? '主播检测' : cat === '数据缺失' ? '数据完整性检测' : cat === '渠道异常' || cat === '转化异常' ? '渠道检测' : '系统检测',
              count: 1, lastOccur: a.time, status: a.status === 'resolved' ? '已处理' : '未处理',
            })
          }
        }
      }
      countByType(allAlerts)
      const tableAlerts = Array.from(typeCounts.values())

      return sendOk(reply, { alerts: allAlerts, tableAlerts, rules })
    } catch (err) {
      request.log.warn({ err }, 'system/alerts query failed')
      return sendOk(reply, { alerts: [], tableAlerts: [], rules: [] })
    }
  })

  // ── GET /api/v1/system/competitors ──
  app.get('/api/v1/system/competitors', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows: brands } = await pool.query(
        `SELECT cb.*, COALESCE(
          (SELECT json_agg(json_build_object(
            'label', cpd.label, 'ours', cpd.ours, 'theirs', cpd.theirs
          )) FROM competitor_price_data cpd WHERE cpd.brand_id = cb.id),
          '[]'
        ) AS price_data
         FROM competitor_brands cb ORDER BY cb.id`
      )
      return sendOk(reply, brands)
    } catch (err) {
      request.log.warn({ err }, 'system/competitors query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/system/multi-room ──
  app.get('/api/v1/system/multi-room', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT mrs.*, lr.name AS room_name
         FROM multi_room_status mrs
         JOIN live_rooms lr ON lr.id = mrs.room_id
         ORDER BY mrs.online_users DESC`
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/multi-room query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/system/inventory ──
  app.get('/api/v1/system/inventory', async (request, reply) => {
    const pool = getPool()
    try {
      const items = await queryInventoryProducts(pool)
      return sendOk(reply, items)
    } catch (err) {
      request.log.warn({ err }, 'system/inventory query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/system/tasks ── (改进任务列表，含自动生成)
  app.get('/api/v1/system/tasks', async (request, reply) => {
    const pool = getPool()
    try {
      // 1. 自动从未处理的预警事件生成任务
      const { rows: pendingEvents } = await pool.query(
        `SELECT ae.id, ae.severity, ae.title, ae.description, ae.event_time
         FROM alert_events ae
         WHERE ae.status = 'pending'
           AND ae.severity IN ('critical', 'warning')
           AND NOT EXISTS (
             SELECT 1 FROM improvement_tasks t
             WHERE t.source = 'anomaly' AND t.source_id = ae.id::text
           )
         ORDER BY ae.event_time DESC
         LIMIT 5`
      )
      for (const evt of pendingEvents) {
        const priority = evt.severity === 'critical' ? 'high' : 'medium'
        const assignee = evt.title.includes('主播') || evt.title.includes('GMV') ? '主播运营组'
          : evt.title.includes('渠道') || evt.title.includes('转化') ? '投放优化组'
          : '运营团队'
        const desc = evt.description?.substring(0, 200) || evt.title
        await pool.query(
          `INSERT INTO improvement_tasks (title, description, assignee, priority, source, source_id, due_date)
           VALUES ($1, $2, $3, $4, 'anomaly', $5, CURRENT_DATE + 3)`,
          [evt.title, desc, assignee, priority, String(evt.id)]
        )
      }

      // 2. 返回所有任务
      const { rows: tasks } = await pool.query(
        `SELECT id, title, description, assignee, priority, source, source_id,
                due_date::text AS "dueDate", progress, status, created_at::text AS "createdAt"
         FROM improvement_tasks
         ORDER BY
           CASE status
             WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'completed' THEN 2
           END,
           CASE priority
             WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2
           END,
           created_at DESC`
      )
      return sendOk(reply, { tasks })
    } catch (err) {
      request.log.warn({ err }, 'system/tasks query failed')
      return sendOk(reply, { tasks: [] })
    }
  })

  // ── PUT /api/v1/system/tasks/:id/status ──
  app.put('/api/v1/system/tasks/:id/status', async (request, reply) => {
    const pool = getPool()
    const { id } = request.params as { id: string }
    const body = request.body as { status?: string }
    const newStatus = body.status

    if (!newStatus || !['pending', 'in_progress', 'completed'].includes(newStatus)) {
      return sendError(reply, 400, '无效的状态值')
    }

    try {
      const progress = newStatus === 'pending' ? 0 : newStatus === 'in_progress' ? 30 : 100
      const { rowCount } = await pool.query(
        `UPDATE improvement_tasks SET status = $1, progress = $2, updated_at = now() WHERE id = $3`,
        [newStatus, progress, parseInt(id)]
      )
      if (rowCount === 0) {
        return sendError(reply, 404, '任务不存在')
      }
      return sendOk(reply, { ok: true })
    } catch (err) {
      request.log.warn({ err }, 'system/tasks status update failed')
      return sendError(reply, 500, '更新失败')
    }
  })

  // ─────────────────────────────────────
  // 活动管理 (Promotions)
  // ─────────────────────────────────────

  // ── GET /api/v1/system/promotions ──
  app.get('/api/v1/system/promotions', async (request, reply) => {
    const pool = getPool()
    try {
      const query = request.query as { status?: string }
      let sql = `SELECT p.*,
                        COALESCE(
                          (SELECT json_agg(json_build_object('id', lr.id, 'name', lr.name))
                           FROM live_rooms lr WHERE lr.id = ANY(
                             SELECT jsonb_array_elements_text(p.applicable_rooms)::int
                           )),
                          '[]'
                        ) AS rooms,
                        COALESCE(
                          (SELECT json_agg(json_build_object('id', a.id, 'name', a.name))
                           FROM anchors a WHERE a.id = ANY(
                             SELECT jsonb_array_elements_text(p.applicable_anchors)::int
                           ) AND a.status = 1),
                          '[]'
                        ) AS anchors
                 FROM promotions p`
      const params: any[] = []
      if (query.status && query.status !== 'all') {
        sql += ` WHERE p.status = $1`
        params.push(query.status)
      }
      sql += ` ORDER BY p.created_at DESC`
      const { rows } = await pool.query(sql, params)

      // 构建 detailTable
      const detailTable = rows.map((r: any) => ({
        name: r.name,
        type: r.type,
        status: r.status === 'preparing' ? '筹备中' : r.status === 'active' ? '进行中' : '已结束',
        anchors: r.anchors?.length ?? 0,
        rooms: r.rooms?.length ?? 0,
      }))

      return sendOk(reply, { campaigns: rows, detailTable })
    } catch (err) {
      request.log.warn({ err }, 'system/promotions list failed')
      return sendOk(reply, { campaigns: [], detailTable: [] })
    }
  })

  // ── POST /api/v1/system/promotions ──
  app.post('/api/v1/system/promotions', async (request, reply) => {
    const pool = getPool()
    try {
      const body = request.body as {
        name: string
        type: string
        content: string
        startDate: string
        endDate: string
        applicableRooms?: number[]
        applicableAnchors?: number[]
      }
      const { rows } = await pool.query(
        `INSERT INTO promotions (name, type, content, start_date, end_date, applicable_rooms, applicable_anchors)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
         RETURNING id`,
        [
          body.name,
          body.type || '',
          body.content || '',
          body.startDate,
          body.endDate,
          JSON.stringify(body.applicableRooms || []),
          JSON.stringify(body.applicableAnchors || []),
        ]
      )
      return sendOk(reply, { id: rows[0].id, created: true })
    } catch (err) {
      request.log.warn({ err }, 'system/promotions create failed')
      return sendOk(reply, { created: false })
    }
  })
}