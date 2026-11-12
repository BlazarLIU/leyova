import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canManageTargetUser, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
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
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT r.code, r.name, r.description,
                  COALESCE(
                    (SELECT json_agg(rm.module_code) FROM role_modules rm WHERE rm.role_code = r.code),
                    '[]'
                  ) AS modules
           FROM roles r ORDER BY r.id`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/roles query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/system/modules ──
  app.get('/api/v1/system/modules', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT m.code,
                  m.name,
                  m.icon,
                  m.sort_order,
                  COALESCE(ARRAY_AGG(rm.role_code ORDER BY rm.role_code) FILTER (WHERE rm.role_code IS NOT NULL), '{}'::varchar[]) AS assigned_roles
           FROM system_modules m
           LEFT JOIN role_modules rm ON rm.module_code = m.code
           GROUP BY m.code, m.name, m.icon, m.sort_order
           ORDER BY m.sort_order`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/modules query failed')
      return sendOk(reply, [])
    }
  })

  // ── PUT /api/v1/system/roles/modules ── 更新角色模块权限
  app.put('/api/v1/system/roles/modules', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const body = request.body as { roleCode: string; moduleCodes: string[] }
      if (!body?.roleCode || !Array.isArray(body.moduleCodes)) {
        return sendError(reply, 400, '缺少必要参数 (roleCode, moduleCodes)')
      }
      if (body.roleCode === 'super_admin' && actor.role !== 'super_admin') {
        return sendError(reply, 403, '仅超级管理员可修改 super_admin 模块权限')
      }

      await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT module_code FROM role_modules WHERE role_code = $1 ORDER BY module_code', [body.roleCode])
        const beforeModules = beforeRes.rows.map((r: any) => r.module_code)

        await client.query('DELETE FROM role_modules WHERE role_code = $1', [body.roleCode])
        for (const mc of body.moduleCodes) {
          await client.query(
            'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [body.roleCode, mc],
          )
        }

        await writeAuditLog(client, {
          request,
          action: 'system.role_modules.update',
          resourceType: 'role_modules',
          resourceId: body.roleCode,
          beforeData: { roleCode: body.roleCode, moduleCodes: beforeModules },
          afterData: { roleCode: body.roleCode, moduleCodes: body.moduleCodes },
        })
      })

      return sendOk(reply, { updated: true })
    } catch (err) {
      request.log.warn({ err }, 'system/roles/modules update failed')
      return sendError(reply, 500, '更新角色模块权限失败')
    }
  })

  // ── GET /api/v1/system/users ──
  app.get('/api/v1/system/users', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const result = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          `SELECT id, username, real_name AS "realName", role, user_type AS "userType",
                  tenant_id AS "tenantId", anchor_id AS "anchorId", status,
                  last_login_at AS "lastLogin", created_at AS "createdAt"
           FROM users
           WHERE ($1 = 'super_admin' OR tenant_id = $2)
           ORDER BY id`,
          [actor.role, actor.tenantId || 1],
        )
        const out = []
        for (const row of rows) {
          const { rows: mods } = await client.query(
            'SELECT module_code FROM role_modules WHERE role_code = $1',
            [row.role],
          )
          out.push({ ...row, modules: mods.map((m: any) => m.module_code) })
        }
        return out
      })
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'system/users list failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/system/users ──
  app.post('/api/v1/system/users', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const body = request.body as {
        username?: string; realName?: string; role?: string; status?: number; modules?: string[]
        password?: string; anchorId?: number | null; tenantId?: number | null; userType?: string
      }
      const username = (body.username || '').trim()
      if (!username || username.length > 50) {
        return sendError(reply, 400, '用户名不能为空且长度不能超过 50 个字符')
      }
      const { env } = await import('../config/env.js')
      const password = body.password || env.DEFAULT_USER_PASSWORD
      if (!password) {
        return sendError(reply, 400, '密码不能为空')
      }
      const role = body.role || 'employee'
      const validRoles = ['super_admin', 'admin', 'operator', 'finance', 'hrbp', 'employee', 'ad_buyer', 'ops_director', 'ops_staff', 'controller', 'manager']
      if (!validRoles.includes(role)) {
        return sendError(reply, 400, '角色不合法，可选角色：系统管理员(super_admin)、管理员(admin)、运营(operator)、投放专员(ad_buyer)、财务(finance)、HRBP(hrbp)、员工(employee)')
      }
      if (!canManageTargetUser(actor.role, undefined, role)) {
        return sendError(reply, 403, '仅超级管理员可创建 super_admin 账号')
      }
      const hash = bcrypt.hashSync(password, 10)
      const tenantId = actor.role === 'super_admin' && body.tenantId ? body.tenantId : (actor.tenantId || 1)
      const userType = body.userType === 'brand_viewer' ? 'brand_viewer' : 'agency_staff'

      const out = await withRlsContext(request, async (client) => {
        const { rows: existing } = await client.query(
          'SELECT 1 FROM users WHERE username = $1',
          [username],
        )
        if (existing.length > 0) {
          return { errStatus: 409 as const, errMsg: '用户名已存在' }
        }

        const { rows } = await client.query(
          `INSERT INTO users (username, password_hash, real_name, role, status, tenant_id, user_type, anchor_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, username, real_name AS "realName", role, status, tenant_id AS "tenantId", user_type AS "userType", anchor_id AS "anchorId", created_at AS "createdAt"`,
          [username, hash, body.realName || '新用户', role, body.status ?? 1, tenantId, userType, body.anchorId ?? null],
        )
        if (rows.length === 0) return { errStatus: 500 as const, errMsg: '创建失败' }

        if (body.modules && body.modules.length > 0 && canManageTargetUser(actor.role, role, role)) {
          for (const mc of body.modules) {
            await client.query(
              'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [role, mc],
            )
          }
        }
        await writeAuditLog(client, {
          request,
          action: 'system.user.create',
          resourceType: 'users',
          resourceId: rows[0].id,
          afterData: rows[0],
        })
        return { row: rows[0] }
      })

      if ('errStatus' in out && out.errStatus !== undefined) return sendError(reply, out.errStatus, out.errMsg)
      return sendOk(reply, out.row)
    } catch (err) {
      request.log.warn({ err }, 'system/users create failed')
      return sendError(reply, 500, '创建失败，请检查输入后重试')
    }
  })

  // ── PUT /api/v1/system/users/:id ──
  app.put('/api/v1/system/users/:id', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const { id } = request.params as { id: string }
      const targetId = parseInt(id)
      const body = request.body as {
        realName?: string; role?: string; status?: number; modules?: string[]
      }

      const out = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query(
          'SELECT id, username, real_name AS "realName", role, status, tenant_id AS "tenantId", user_type AS "userType", anchor_id AS "anchorId" FROM users WHERE id = $1',
          [targetId],
        )
        if (beforeRes.rows.length === 0) {
          return { errStatus: 404 as const, errMsg: '目标用户不存在' }
        }
        const beforeUser = beforeRes.rows[0]
        if (!canManageTargetUser(actor.role, beforeUser.role, body.role)) {
          return { errStatus: 403 as const, errMsg: '无权修改 super_admin 账号或将账号提权为 super_admin' }
        }

        await client.query(
          `UPDATE users SET real_name = COALESCE($1, real_name), role = COALESCE($2, role),
           status = COALESCE($3, status), updated_at = NOW() WHERE id = $4`,
          [body.realName, body.role, body.status, targetId],
        )
        if (body.role && body.modules && canManageTargetUser(actor.role, body.role, body.role)) {
          await client.query('DELETE FROM role_modules WHERE role_code = $1', [body.role])
          for (const mc of (body.modules || [])) {
            await client.query(
              'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [body.role, mc],
            )
          }
        }
        const afterRes = await client.query(
          'SELECT id, username, real_name AS "realName", role, status, tenant_id AS "tenantId", user_type AS "userType", anchor_id AS "anchorId" FROM users WHERE id = $1',
          [targetId],
        )
        await writeAuditLog(client, {
          request,
          action: 'system.user.update',
          resourceType: 'users',
          resourceId: targetId,
          beforeData: beforeUser,
          afterData: afterRes.rows[0] ?? null,
        })
        return { updated: true }
      })

      if ('errStatus' in out && out.errStatus !== undefined) return sendError(reply, out.errStatus, out.errMsg)
      return sendOk(reply, { updated: true })
    } catch (err) {
      request.log.warn({ err }, 'system/users update failed')
      return sendError(reply, 500, '更新用户失败')
    }
  })

  // ── DELETE /api/v1/system/users/:id ──
  app.delete('/api/v1/system/users/:id', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    try {
      const { id } = request.params as { id: string }
      const targetId = parseInt(id)
      if (targetId === actor.id) {
        return sendError(reply, 400, '不能删除当前登录账号')
      }

      const out = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query(
          'SELECT id, username, real_name AS "realName", role, status, tenant_id AS "tenantId", user_type AS "userType" FROM users WHERE id = $1',
          [targetId],
        )
        if (beforeRes.rows.length === 0) {
          return { errStatus: 404 as const, errMsg: '目标用户不存在' }
        }
        if (!canManageTargetUser(actor.role, beforeRes.rows[0].role)) {
          return { errStatus: 403 as const, errMsg: '仅超级管理员可删除 super_admin 账号' }
        }
        const result = await client.query('DELETE FROM users WHERE id = $1', [targetId])
        if ((result.rowCount ?? 0) > 0) {
          await writeAuditLog(client, {
            request,
            action: 'system.user.delete',
            resourceType: 'users',
            resourceId: targetId,
            beforeData: beforeRes.rows[0],
          })
        }
        return { deleted: (result.rowCount ?? 0) > 0 }
      })

      if ('errStatus' in out && out.errStatus !== undefined) return sendError(reply, out.errStatus, out.errMsg)
      return sendOk(reply, { deleted: out.deleted })
    } catch (err) {
      request.log.warn({ err }, 'system/users delete failed')
      return sendError(reply, 500, '删除用户失败')
    }
  })

  // ── GET /api/v1/system/rooms ── 直播间管理
  app.get('/api/v1/system/rooms', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, name, platform, status, created_at, updated_at
           FROM live_rooms ORDER BY id`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/rooms list failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/system/rooms ──
  app.post('/api/v1/system/rooms', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator'])] }, async (request, reply) => {
    try {
      const body = request.body as {
        name?: string; platform?: string; status?: string
      }
      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `INSERT INTO live_rooms (name, platform, status)
           VALUES ($1, $2, $3) RETURNING id, name, platform, status, created_at, updated_at`,
          [body.name || '新直播间', body.platform || '抖音', body.status || 'inactive'],
        )
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            request,
            action: 'system.room.create',
            resourceType: 'live_rooms',
            resourceId: res.rows[0].id,
            afterData: res.rows[0],
          })
        }
        return res.rows
      })
      if (rows.length === 0) return sendError(reply, 500, '创建失败')
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'system/rooms create failed')
      return sendError(reply, 500, '创建失败')
    }
  })

  // ── PUT /api/v1/system/rooms/:id ──
  app.put('/api/v1/system/rooms/:id', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as {
        name?: string; platform?: string; status?: string
      }
      const result = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT id, name, platform, status FROM live_rooms WHERE id = $1', [parseInt(id)])
        const res = await client.query(
          `UPDATE live_rooms SET
           name = COALESCE($1, name),
           platform = COALESCE($2, platform),
           status = COALESCE($3, status),
           updated_at = NOW()
           WHERE id = $4`,
          [body.name, body.platform, body.status, parseInt(id)],
        )
        if ((res.rowCount ?? 0) > 0) {
          const afterRes = await client.query('SELECT id, name, platform, status FROM live_rooms WHERE id = $1', [parseInt(id)])
          await writeAuditLog(client, {
            request,
            action: 'system.room.update',
            resourceType: 'live_rooms',
            resourceId: id,
            beforeData: beforeRes.rows[0] ?? null,
            afterData: afterRes.rows[0] ?? null,
          })
        }
        return res
      })
      return sendOk(reply, { updated: (result.rowCount ?? 0) > 0 })
    } catch (err) {
      request.log.warn({ err }, 'system/rooms update failed')
      return sendError(reply, 500, '更新失败')
    }
  })

  // ── DELETE /api/v1/system/rooms/:id ──
  app.delete('/api/v1/system/rooms/:id', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT id, name, platform, status FROM live_rooms WHERE id = $1', [parseInt(id)])
        const res = await client.query('DELETE FROM live_rooms WHERE id = $1', [parseInt(id)])
        if ((res.rowCount ?? 0) > 0) {
          await writeAuditLog(client, {
            request,
            action: 'system.room.delete',
            resourceType: 'live_rooms',
            resourceId: id,
            beforeData: beforeRes.rows[0] ?? null,
          })
        }
        return res
      })
      return sendOk(reply, { deleted: (result.rowCount ?? 0) > 0 })
    } catch (err) {
      request.log.warn({ err }, 'system/rooms delete failed')
      return sendError(reply, 500, '删除失败')
    }
  })

  // ── GET /api/v1/system/target-templates ── 目标模板列表
  app.get('/api/v1/system/target-templates', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, name, metrics, period, created_at::text AS "createdAt", updated_at::text AS "updatedAt"
           FROM target_templates ORDER BY id DESC`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates list failed')
      return sendError(reply, 500, '获取目标模板失败')
    }
  })

  // ── POST /api/v1/system/target-templates ── 新建目标
  // metrics: [{ metric, target, unit }]（每个指标均可设定目标数值）
  app.post('/api/v1/system/target-templates', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator'])] }, async (request, reply) => {
    try {
      const body = request.body as { name?: string; period?: string; metrics?: Array<{ metric?: string; target?: number | string; unit?: string }> }
      const name = (body.name || '').trim()
      if (!name) return sendError(reply, 400, '目标名称不能为空')
      if (name.length > 200) return sendError(reply, 400, '目标名称长度不能超过 200 个字符')
      const period = validateTemplatePeriod(body.period)
      if (!period) return sendError(reply, 400, '周期参数不合法（应为 monthly/quarterly/yearly）')
      const metrics = normalizeTemplateMetrics(body.metrics)
      if (metrics.length === 0) return sendError(reply, 400, '请至少添加一个指标并填写目标值')
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO target_templates (name, period, metrics)
           VALUES ($1, $2, $3) RETURNING id, name, metrics, period, created_at::text AS "createdAt", updated_at::text AS "updatedAt"`,
          [name, period, JSON.stringify(metrics)],
        ),
      )
      if (rows.length === 0) return sendError(reply, 500, '创建目标失败')
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates create failed')
      return sendError(reply, 500, '创建目标失败')
    }
  })

  // ── PUT /api/v1/system/target-templates/:id ── 编辑目标
  app.put('/api/v1/system/target-templates/:id', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator'])] }, async (request, reply) => {
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
      const row = await withRlsContext(request, async (client) => {
        const result = await client.query(
          `UPDATE target_templates SET name = $1, period = $2, metrics = $3, updated_at = NOW()
           WHERE id = $4`,
          [name, period, JSON.stringify(metrics), parseInt(id)],
        )
        if ((result.rowCount ?? 0) === 0) return null
        const { rows } = await client.query(
          `SELECT id, name, metrics, period, created_at::text AS "createdAt", updated_at::text AS "updatedAt"
           FROM target_templates WHERE id = $1`,
          [parseInt(id)],
        )
        return rows[0] ?? null
      })
      if (!row) return sendError(reply, 404, '目标不存在')
      return sendOk(reply, row)
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates update failed')
      return sendError(reply, 500, '更新目标失败')
    }
  })

  // ── POST /api/v1/system/target-templates/:id/apply ── 应用到目标达成
  // 将模板中的每个指标项写入 goal_tracking（目标达成页面数据源）
  app.post('/api/v1/system/target-templates/:id/apply', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { period?: string }
      const out = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          'SELECT id, name, metrics, period FROM target_templates WHERE id = $1',
          [parseInt(id)],
        )
        if (rows.length === 0) return null
        const tmpl = rows[0]
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
          const up = await client.query(
            `UPDATE goal_tracking SET target = $1, unit = $2, period = $3, updated_at = NOW()
             WHERE source_template_id = $4 AND name = $5`,
            [Number(target), unit, period, tmpl.id, name],
          )
          if ((up.rowCount ?? 0) > 0) { updated++; continue }
          await client.query(
            `INSERT INTO goal_tracking (name, target, current_val, unit, progress, category, period, source_template_id)
             VALUES ($1, $2, 0, $3, 0, '营收', $4, $5)`,
            [name, Number(target), unit, period, tmpl.id],
          )
          inserted++
        }
        return { applied: inserted, updated, name: tmpl.name, period }
      })
      if (!out) return sendError(reply, 404, '目标不存在')
      return sendOk(reply, out)
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates apply failed')
      return sendError(reply, 500, '应用到目标达成失败')
    }
  })

  // ── DELETE /api/v1/system/target-templates/:id ── 删除目标（级联删除其目标达成记录）
  app.delete('/api/v1/system/target-templates/:id', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const out = await withRlsContext(request, async (client) => {
        const cascade = await client.query(
          'DELETE FROM goal_tracking WHERE source_template_id = $1',
          [parseInt(id)],
        )
        const result = await client.query('DELETE FROM target_templates WHERE id = $1', [parseInt(id)])
        if ((result.rowCount ?? 0) === 0) return null
        return { deleted: true, cascadeDeleted: cascade.rowCount ?? 0 }
      })
      if (!out) return sendError(reply, 404, '目标不存在')
      return sendOk(reply, out)
    } catch (err) {
      request.log.warn({ err }, 'system/target-templates delete failed')
      return sendError(reply, 500, '删除目标失败')
    }
  })

  // ── GET /api/v1/system/config ──
  app.get('/api/v1/system/config', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query('SELECT * FROM system_config ORDER BY id'),
      )
      const config: Record<string, string> = {}
      for (const r of rows) config[r.config_key] = r.config_value
      return sendOk(reply, config)
    } catch (err) {
      request.log.warn({ err }, 'system/config query failed')
      return sendOk(reply, {})
    }
  })

  // ── PUT /api/v1/system/config ──
  app.put('/api/v1/system/config', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const body = request.body as Record<string, string>
      const keys = Object.keys(body || {})
      await withRlsContext(request, async (client) => {
        const beforeRes = keys.length > 0
          ? await client.query('SELECT config_key, config_value FROM system_config WHERE config_key = ANY($1)', [keys])
          : { rows: [] }
        for (const [key, value] of Object.entries(body || {})) {
          await client.query(
            `INSERT INTO system_config (config_key, config_value) VALUES ($1, $2)
             ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_at = NOW()`,
            [key, value],
          )
        }
        await writeAuditLog(client, {
          request,
          action: 'system.config.update',
          resourceType: 'system_config',
          resourceId: keys.join(','),
          beforeData: beforeRes.rows,
          afterData: body,
        })
      })
      return sendOk(reply, { message: '配置已更新' })
    } catch (err) {
      request.log.warn({ err }, 'system/config update failed')
      return sendError(reply, 500, '更新失败')
    }
  })

  // ── GET /api/v1/system/alerts ──
  app.get('/api/v1/system/alerts', async (request, reply) => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { events, rules, uploadsTodayRows, anchorGmvRows, channelRows, convRows, qualityRow } =
        await withRlsContext(request, async (client) => {
          const evRes = await client.query(
            'SELECT id, severity, title, description, event_time, status FROM alert_events ORDER BY event_time DESC LIMIT 20',
          )
          const ruleRes = await client.query('SELECT * FROM alert_rules ORDER BY id')
          const upRes = await client.query(
            `SELECT data_type FROM data_uploads WHERE business_date = $1::date AND status = 'completed'`,
            [today],
          )
          const gmvRes = await client.query(
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
             GROUP BY a.id, a.name, ls.anchor_id`,
          )
          const chRes = await client.query(
            `SELECT sc.channel,
                    COALESCE(SUM(sc.views) FILTER (WHERE s.date = CURRENT_DATE), 0) AS today_views,
                    COALESCE(SUM(sc.orders) FILTER (WHERE s.date = CURRENT_DATE), 0) AS today_orders,
                    COALESCE(SUM(sc.views) FILTER (WHERE s.date >= CURRENT_DATE - 8 AND s.date < CURRENT_DATE), 0) AS past_views,
                    COALESCE(SUM(sc.orders) FILTER (WHERE s.date >= CURRENT_DATE - 8 AND s.date < CURRENT_DATE), 0) AS past_orders
             FROM session_channel_metrics sc
             JOIN live_sessions s ON s.id = sc.session_id
             WHERE s.date >= CURRENT_DATE - INTERVAL '8 days' AND s.status = 'completed'
             GROUP BY sc.channel`,
          )
          const cRes = await client.query(
            `SELECT sc.channel,
                    COALESCE(AVG(sc.product_click_rate), 0) AS avg_click_rate,
                    COALESCE(AVG(sc.product_deal_rate), 0) AS avg_deal_rate
             FROM session_channel_metrics sc
             JOIN live_sessions s ON s.id = sc.session_id
             WHERE s.date >= CURRENT_DATE - INTERVAL '7 days' AND s.status = 'completed'
             GROUP BY sc.channel`,
          )
          const qRes = await client.query(
            `SELECT COUNT(*)::int AS total,
                    SUM(CASE WHEN uv_value IS NULL OR interaction_rate IS NULL OR retention_rate IS NULL THEN 1 ELSE 0 END)::int AS null_count
             FROM live_sessions WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND status != 'scheduled'`,
          )
          return {
            events: evRes.rows,
            rules: ruleRes.rows,
            uploadsTodayRows: upRes.rows,
            anchorGmvRows: gmvRes,
            channelRows: chRes,
            convRows: cRes,
            qualityRow: qRes,
          }
        })

      // 2. 自动检测动态异常
      const autoAlerts: any[] = []
      const uploadedTypes = new Set(uploadsTodayRows.map((r: any) => r.data_type))
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
              description: `${row.channel}渠道观看量环比+${Math.round(viewChange * 100)}%，但成交订单环比${Math.round(orderChange * 100)}%，转化效率下降`,
              time: today, status: 'pending',
            })
          }
        }
      }

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
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const q = request.query as { search?: string }
      const search = q.search?.trim() || ''
      const { rows: brands } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT cb.*, COALESCE(
            (SELECT json_agg(json_build_object(
              'label', cpd.label, 'ours', cpd.ours, 'theirs', cpd.theirs
            )) FROM competitor_price_data cpd WHERE cpd.brand_id = cb.id),
            '[]'
          ) AS price_data
           FROM competitor_brands cb
          WHERE ($1 = '' OR cb.brand ILIKE '%' || $1 || '%' OR cb.industry ILIKE '%' || $1 || '%')
          ORDER BY cb.id`,
          [search],
        ),
      )
      return sendOk(reply, brands)
    } catch (err) {
      request.log.warn({ err }, 'system/competitors query failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/system/competitors ── 新增竞品观察品牌
  app.post('/api/v1/system/competitors', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator'])] }, async (request, reply) => {
    const body = request.body as { brand?: string; industry?: string }
    const brand = (body?.brand || '').trim()
    const industry = (body?.industry || '').trim()
    if (!brand) {
      return sendError(reply, 400, '品牌名称不能为空')
    }
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO competitor_brands (brand, industry, trend)
           VALUES ($1, $2, 'stable')
           RETURNING *`,
          [brand, industry],
        ),
      )
      return reply.code(201).send({ success: true, message: '竞品品牌已添加', data: rows[0] })
    } catch (err) {
      request.log.warn({ err }, 'system/competitors create failed')
      return sendError(reply, 500, '创建竞品品牌失败')
    }
  })

  // ── GET /api/v1/system/multi-room ──
  app.get('/api/v1/system/multi-room', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT mrs.*, lr.name AS room_name
           FROM multi_room_status mrs
           JOIN live_rooms lr ON lr.id = mrs.room_id
           ORDER BY mrs.online_users DESC`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/multi-room query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/system/inventory ──
  app.get('/api/v1/system/inventory', async (request, reply) => {
    try {
      const items = await withRlsContext(request, (client) => queryInventoryProducts(client))
      return sendOk(reply, items)
    } catch (err) {
      request.log.warn({ err }, 'system/inventory query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/system/tasks ── (改进任务列表，含自动生成)
  app.get('/api/v1/system/tasks', async (request, reply) => {
    try {
      const tasks = await withRlsContext(request, async (client) => {
        const { rows: pendingEvents } = await client.query(
          `SELECT ae.id, ae.severity, ae.title, ae.description, ae.event_time
           FROM alert_events ae
           WHERE ae.status = 'pending'
             AND ae.severity IN ('critical', 'warning')
             AND NOT EXISTS (
               SELECT 1 FROM improvement_tasks t
               WHERE t.source = 'anomaly' AND t.source_id = ae.id::text
             )
           ORDER BY ae.event_time DESC
           LIMIT 5`,
        )
        for (const evt of pendingEvents) {
          const priority = evt.severity === 'critical' ? 'high' : 'medium'
          const assignee = evt.title.includes('主播') || evt.title.includes('GMV') ? '主播运营组'
            : evt.title.includes('渠道') || evt.title.includes('转化') ? '投放优化组'
            : '运营团队'
          const desc = evt.description?.substring(0, 200) || evt.title
          await client.query(
            `INSERT INTO improvement_tasks (title, description, assignee, priority, source, source_id, due_date)
             VALUES ($1, $2, $3, $4, 'anomaly', $5, CURRENT_DATE + 3)`,
            [evt.title, desc, assignee, priority, String(evt.id)],
          )
        }

        const { rows } = await client.query(
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
             created_at DESC`,
        )
        return rows
      })
      return sendOk(reply, { tasks })
    } catch (err) {
      request.log.warn({ err }, 'system/tasks query failed')
      return sendOk(reply, { tasks: [] })
    }
  })

  // ── POST /api/v1/system/tasks ── 手动创建改进任务
  app.post('/api/v1/system/tasks', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator'])] }, async (request, reply) => {
    const body = request.body as {
      title?: string
      description?: string
      assignee?: string
      priority?: string
      dueDate?: string
    }
    const title = (body?.title || '').trim()
    if (!title) {
      return sendError(reply, 400, '任务标题不能为空')
    }
    const priority = ['high', 'medium', 'low'].includes(body?.priority || '') ? body.priority! : 'medium'
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO improvement_tasks (title, description, assignee, priority, source, due_date)
           VALUES ($1, $2, $3, $4, 'manual', COALESCE(NULLIF($5, '')::date, CURRENT_DATE + 7))
           RETURNING id, title, description, assignee, priority, source, source_id,
                     due_date::text AS "dueDate", progress, status, created_at::text AS "createdAt"`,
          [
            title,
            (body?.description || '').trim(),
            (body?.assignee || '').trim() || '运营团队',
            priority,
            (body?.dueDate || '').trim(),
          ],
        ),
      )
      return reply.code(201).send({ success: true, message: '改进任务已创建', data: { task: rows[0] } })
    } catch (err) {
      request.log.warn({ err }, 'system/tasks create failed')
      return sendError(reply, 500, '创建改进任务失败')
    }
  })

  // ── PUT /api/v1/system/tasks/:id/status ──
  app.put('/api/v1/system/tasks/:id/status', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator'])] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { status?: string }
    const newStatus = body.status

    if (!newStatus || !['pending', 'in_progress', 'completed'].includes(newStatus)) {
      return sendError(reply, 400, '无效的状态值')
    }

    try {
      const progress = newStatus === 'pending' ? 0 : newStatus === 'in_progress' ? 30 : 100
      const { rowCount } = await withRlsContext(request, (client) =>
        client.query(
          `UPDATE improvement_tasks SET status = $1, progress = $2, updated_at = now() WHERE id = $3`,
          [newStatus, progress, parseInt(id)],
        ),
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
      const { rows } = await withRlsContext(request, (client) => client.query(sql, params))

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
  app.post('/api/v1/system/promotions', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator'])] }, async (request, reply) => {
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
      const createdId = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
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
          ],
        )
        await writeAuditLog(client, {
          request,
          action: 'system.promotion.create',
          resourceType: 'promotions',
          resourceId: rows[0].id,
          afterData: { id: rows[0].id, name: body.name, type: body.type, startDate: body.startDate, endDate: body.endDate },
        })
        return rows[0].id
      })
      return sendOk(reply, { id: createdId, created: true })
    } catch (err) {
      request.log.warn({ err }, 'system/promotions create failed')
      return sendOk(reply, { created: false })
    }
  })

  // ── GET /api/v1/system/audit-logs ── 安全审计日志查询
  app.get('/api/v1/system/audit-logs', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const q = request.query as {
        page?: string
        pageSize?: string
        action?: string
        resourceType?: string
        actorUserId?: string
        from?: string
        to?: string
      }
      const page = Math.max(1, parseInt(q.page || '1', 10) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '30', 10) || 30))
      const offset = (page - 1) * pageSize

      const conditions: string[] = []
      const params: any[] = []
      let idx = 1

      if (q.action) {
        conditions.push(`al.action ILIKE $${idx++}`)
        params.push(`%${q.action.trim()}%`)
      }
      if (q.resourceType) {
        conditions.push(`al.resource_type = $${idx++}`)
        params.push(q.resourceType.trim())
      }
      if (q.actorUserId) {
        conditions.push(`al.actor_user_id = $${idx++}`)
        params.push(parseInt(q.actorUserId, 10))
      }
      if (q.from) {
        conditions.push(`al.created_at >= $${idx++}::timestamptz`)
        params.push(q.from)
      }
      if (q.to) {
        conditions.push(`al.created_at <= $${idx++}::timestamptz`)
        params.push(q.to)
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const data = await withRlsContext(request, async (client) => {
        const countRes = await client.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM public.audit_logs al ${whereSql}`,
          params
        )
        const listRes = await client.query(
          `SELECT
             al.id::text AS id,
             al.actor_user_id AS "actorUserId",
             u.username AS "actorUsername",
             u.real_name AS "actorRealName",
             u.role AS "actorRole",
             al.action,
             al.resource_type AS "resourceType",
             al.resource_id AS "resourceId",
             al.before_data AS "beforeData",
             al.after_data AS "afterData",
             al.ip_address AS "ipAddress",
             al.user_agent AS "userAgent",
             al.created_at::text AS "createdAt"
           FROM public.audit_logs al
           LEFT JOIN public.users u ON u.id = al.actor_user_id
           ${whereSql}
           ORDER BY al.created_at DESC, al.id DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, pageSize, offset]
        )
        return {
          total: countRes.rows[0]?.total ?? 0,
          items: listRes.rows,
          page,
          pageSize,
        }
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'system/audit-logs query failed')
      return sendError(reply, 500, '获取审计日志失败')
    }
  })
}