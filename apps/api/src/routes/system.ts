import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canManageTargetUser, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

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
                  m.is_enabled,
                  m.is_core,
                  COALESCE(ARRAY_AGG(rm.role_code ORDER BY rm.role_code) FILTER (WHERE rm.role_code IS NOT NULL), '{}'::varchar[]) AS assigned_roles
           FROM system_modules m
           LEFT JOIN role_modules rm ON rm.module_code = m.code
           GROUP BY m.code, m.name, m.icon, m.sort_order, m.is_enabled, m.is_core
           ORDER BY m.sort_order`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/modules query failed')
      return sendOk(reply, [])
    }
  })

  // ── PUT /api/v1/system/modules/:code/enabled ── 超级管理员开关模块（热插拔）
  app.put('/api/v1/system/modules/:code/enabled', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const { code } = request.params as { code: string }
    const body = request.body as { enabled?: boolean }
    if (typeof body?.enabled !== 'boolean') {
      return sendError(reply, 400, '缺少 enabled 布尔值')
    }
    try {
      const result = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          `SELECT code, name, is_core, is_enabled FROM public.system_modules WHERE code = $1`,
          [code],
        )
        if (rows.length === 0) return { ok: false as const, status: 404, message: `模块不存在: ${code}` }
        if (!body.enabled && rows[0].is_core) {
          return { ok: false as const, status: 400, message: `核心模块不可关闭: ${code}` }
        }
        const { rows: updated } = await client.query(
          `UPDATE public.system_modules SET is_enabled = $2 WHERE code = $1 RETURNING code, name, is_enabled, is_core`,
          [code, body.enabled],
        )
        await writeAuditLog(client, {
          action: 'system.module.toggle',
          resourceType: 'system_module',
          resourceId: code,
          beforeData: { is_enabled: rows[0].is_enabled },
          afterData: { is_enabled: body.enabled },
        })
        return { ok: true as const, data: updated[0] }
      })
      if (!result.ok) return sendError(reply, result.status, result.message)
      return sendOk(reply, result.data)
    } catch (err) {
      request.log.warn({ err }, 'system/modules toggle failed')
      return sendError(reply, 500, '模块开关失败')
    }
  })

  // ── PUT /api/v1/system/roles/modules ── 更新角色模块权限
  app.put('/api/v1/system/roles/modules', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
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

        // 权限源是 sys_role_permission（access-resolver 优先读它），role_modules 仅作回退。
        // 历史上此处只写 role_modules，导致「角色与模块权限」页的修改对后端零影响。
        // 现在两张表同步写入，保证前端配置真正生效。
        await client.query('DELETE FROM role_modules WHERE role_code = $1', [body.roleCode])
        for (const mc of body.moduleCodes) {
          await client.query(
            'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [body.roleCode, mc],
          )
        }
        await client.query(
          `DELETE FROM sys_role_permission
            WHERE role_code = $1 AND resource LIKE 'module:%'`,
          [body.roleCode],
        )
        // 权限页编辑入口统一落在 role_module_grants（触发器同步 sys_role_permission），
        // 这里一并替换，避免三张表再次漂移。
        await client.query('DELETE FROM role_module_grants WHERE role_code = $1 AND module_code IS NOT NULL', [body.roleCode])
        for (const mc of body.moduleCodes) {
          await client.query(
            `INSERT INTO sys_role_permission (role_code, resource, action, effect, scope_type, condition)
             VALUES ($1, 'module:' || $2, '*', 'allow', 'all', '{}'::jsonb)
             ON CONFLICT DO NOTHING`,
            [body.roleCode, mc],
          )
          await client.query(
            `INSERT INTO role_module_grants (role_code, module_code, effect)
             VALUES ($1, $2, 'allow')
             ON CONFLICT (role_code, module_code) DO UPDATE SET effect = 'allow'`,
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

  // ── POST /api/v1/system/roles ── 自定义新增角色（含初始模块授权）
  // 需求（2026-11-18 老大）：用户可以自己新增角色并配置相应的管理权限。
  app.post('/api/v1/system/roles', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const actor = (request as any).user
    const body = request.body as { code?: string; name?: string; description?: string; moduleCodes?: string[] }
    const code = String(body?.code ?? '').trim()
    const name = String(body?.name ?? '').trim()

    // 角色编码规范：小写字母/数字/下划线，3-32 位。它是权限系统的主键，必须可预期。
    if (!/^[a-z][a-z0-9_]{2,31}$/.test(code)) {
      return sendError(reply, 400, '角色编码须为 3-32 位小写字母、数字或下划线，且以字母开头')
    }
    if (!name) {
      return sendError(reply, 400, '角色名称不能为空')
    }
    // 保留编码：内置系统角色不允许被自定义角色占用
    const RESERVED = ['super_admin']
    if (RESERVED.includes(code)) {
      return sendError(reply, 400, `编码 ${code} 为系统保留，不可使用`)
    }
    if (!Array.isArray(body?.moduleCodes)) {
      return sendError(reply, 400, 'moduleCodes 必须为数组')
    }

    try {
      const result = await withRlsContext(request, async (client) => {
        const dup = await client.query('SELECT 1 FROM roles WHERE code = $1', [code])
        if (dup.rows.length > 0) {
          return { conflict: true as const }
        }
        const { rows: [role] } = await client.query(
          'INSERT INTO roles (code, name, description) VALUES ($1, $2, $3) RETURNING id, code',
          [code, name, body?.description ? String(body.description) : null],
        )
        for (const mc of body.moduleCodes!) {
          await client.query(
            'INSERT INTO role_modules (role_code, module_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [code, mc],
          )
          await client.query(
            `INSERT INTO sys_role_permission (role_code, resource, action, effect, scope_type, condition)
             VALUES ($1, 'module:' || $2, '*', 'allow', 'all', '{}'::jsonb)
             ON CONFLICT DO NOTHING`,
            [code, mc],
          )
        }
        await writeAuditLog(client, {
          request,
          action: 'system.role.create',
          resourceType: 'roles',
          resourceId: code,
          afterData: { code, name, moduleCodes: body.moduleCodes },
        })
        return { id: role.id, code: role.code }
      })

      if ('conflict' in result) {
        return sendError(reply, 409, `角色编码 ${code} 已存在`)
      }
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'system/roles create failed')
      return sendError(reply, 500, '创建角色失败')
    }
  })

  // ── PUT /api/v1/system/roles/:code ── 修改自定义角色名称/描述
  app.put('/api/v1/system/roles/:code', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const code = String((request.params as { code: string }).code)
    const body = request.body as { name?: string; description?: string }
    if (!body?.name || !String(body.name).trim()) {
      return sendError(reply, 400, '角色名称不能为空')
    }
    try {
      await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          'UPDATE roles SET name = $1, description = $2 WHERE code = $3 RETURNING code',
          [String(body.name).trim(), body?.description ? String(body.description) : null, code],
        )
        if (rows.length === 0) throw new Error('ROLE_NOT_FOUND')
        await writeAuditLog(client, {
          request,
          action: 'system.role.update',
          resourceType: 'roles',
          resourceId: code,
          afterData: { name: String(body.name).trim() },
        })
      })
      return sendOk(reply, { code })
    } catch (err: any) {
      if (err?.message === 'ROLE_NOT_FOUND') {
        return sendError(reply, 404, '角色不存在')
      }
      request.log.warn({ err }, 'system/roles update failed')
      return sendError(reply, 500, '更新角色失败')
    }
  })

  // ── DELETE /api/v1/system/roles/:code ── 删除自定义角色
  // 保护：内置角色不可删；仍有账号使用的角色不可删（避免出现孤儿账号）。
  app.delete('/api/v1/system/roles/:code', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const code = String((request.params as { code: string }).code)
    const BUILTIN = ['super_admin', 'ops_director', 'ops_staff', 'ad_buyer', 'controller', 'hrbp']
    if (BUILTIN.includes(code)) {
      return sendError(reply, 403, '内置角色不可删除')
    }
    try {
      const result = await withRlsContext(request, async (client) => {
        const { rows: used } = await client.query(
          'SELECT COUNT(*)::int AS n FROM users WHERE role = $1',
          [code],
        )
        if (Number(used[0].n) > 0) {
          return { inUse: Number(used[0].n) }
        }
        await client.query('DELETE FROM roles WHERE code = $1', [code])
        await client.query('DELETE FROM role_modules WHERE role_code = $1', [code])
        await client.query(
          "DELETE FROM sys_role_permission WHERE role_code = $1 AND resource LIKE 'module:%'",
          [code],
        )
        await writeAuditLog(client, {
          request,
          action: 'system.role.delete',
          resourceType: 'roles',
          resourceId: code,
        })
        return { deleted: true as const }
      })
      if ('inUse' in result) {
        return sendError(reply, 409, `该角色下仍有 ${result.inUse} 个账号，请先转移或删除这些账号`)
      }
      return sendOk(reply, { code })
    } catch (err) {
      request.log.warn({ err }, 'system/roles delete failed')
      return sendError(reply, 500, '删除角色失败')
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
  app.post('/api/v1/system/target-templates', { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] }, async (request, reply) => {
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
  app.put('/api/v1/system/target-templates/:id', { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] }, async (request, reply) => {
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
  app.post('/api/v1/system/target-templates/:id/apply', { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] }, async (request, reply) => {
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
  app.delete('/api/v1/system/target-templates/:id', { preHandler: [requireRole(['super_admin', 'ops_director'])] }, async (request, reply) => {
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
  app.put('/api/v1/system/config', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
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

  // ── GET /api/v1/system/module-parameters ──
  app.get('/api/v1/system/module-parameters', async (request, reply) => {
    try {
      const query = request.query as { module?: string; scope_type?: string }
      const { rows } = await withRlsContext(request, (client) => {
        let sql = `SELECT id, module_code, param_key, param_name, param_type, scope_type, scope_id,
                          param_value, unit, description, updated_by, created_at, updated_at
                   FROM system_module_parameters WHERE 1=1`
        const params: any[] = []
        if (query.module) {
          params.push(query.module)
          sql += ` AND module_code = $${params.length}`
        }
        if (query.scope_type) {
          params.push(query.scope_type)
          sql += ` AND scope_type = $${params.length}`
        }
        sql += ' ORDER BY module_code, scope_type, scope_id, id'
        return client.query(sql, params)
      })
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/module-parameters query failed')
      return sendOk(reply, [])
    }
  })

  // ── PUT /api/v1/system/module-parameters ──
  app.put('/api/v1/system/module-parameters', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    try {
      const body = request.body as any
      const items: any[] = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [body]
      if (!items || items.length === 0) {
        return sendError(reply, 400, '参数列表不能为空')
      }

      const updatedRows: any[] = []
      await withRlsContext(request, async (client) => {
        for (const item of items) {
          if (!item.module_code || !item.param_key) continue
          const scopeType = item.scope_type || 'global'
          const scopeId = item.scope_id || 'default'
          const paramValueJson = typeof item.param_value === 'object' ? JSON.stringify(item.param_value) : JSON.stringify(item.param_value)
          const username = (request as any).user?.username || 'admin'

          const res = await client.query(
            `INSERT INTO system_module_parameters (
               module_code, param_key, param_name, param_type, scope_type, scope_id,
               param_value, unit, description, updated_by
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (module_code, param_key, scope_type, scope_id)
             DO UPDATE SET
               param_name = COALESCE(EXCLUDED.param_name, system_module_parameters.param_name),
               param_type = COALESCE(EXCLUDED.param_type, system_module_parameters.param_type),
               param_value = EXCLUDED.param_value,
               unit = COALESCE(EXCLUDED.unit, system_module_parameters.unit),
               description = COALESCE(EXCLUDED.description, system_module_parameters.description),
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()
             RETURNING *`,
            [
              item.module_code,
              item.param_key,
              item.param_name || item.param_key,
              item.param_type || (typeof item.param_value === 'number' ? 'number' : 'json'),
              scopeType,
              scopeId,
              paramValueJson,
              item.unit || '',
              item.description || '',
              username,
            ]
          )
          if (res.rows[0]) updatedRows.push(res.rows[0])
        }

        await writeAuditLog(client, {
          request,
          action: 'system.module_parameters.update',
          resourceType: 'system_module_parameters',
          resourceId: items.map(i => `${i.module_code}.${i.param_key}`).join(','),
          afterData: items,
        })
      })

      return sendOk(reply, { message: '模块参数已保存', updated: updatedRows.length, items: updatedRows })
    } catch (err: any) {
      request.log.warn({ err }, 'system/module-parameters update failed')
      return sendError(reply, 500, err.message || '更新模块参数失败')
    }
  })

  // ── DELETE /api/v1/system/module-parameters/:id ──
  app.delete('/api/v1/system/module-parameters/:id', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await withRlsContext(request, async (client) => {
        const check = await client.query('SELECT * FROM system_module_parameters WHERE id = $1', [id])
        if (check.rows.length === 0) return
        await client.query('DELETE FROM system_module_parameters WHERE id = $1', [id])
        await writeAuditLog(client, {
          request,
          action: 'system.module_parameters.delete',
          resourceType: 'system_module_parameters',
          resourceId: id,
          beforeData: check.rows[0],
        })
      })
      return sendOk(reply, { message: '模块参数项已删除' })
    } catch (err: any) {
      request.log.warn({ err }, 'system/module-parameters delete failed')
      return sendError(reply, 500, '删除失败')
    }
  })

  // ── GET /api/v1/system/module-parameters/resolve ──
  // 核心三层解析引擎：Entity Override (L3) -> Tier/Role/Category (L2) -> Global Default (L1)
  app.get('/api/v1/system/module-parameters/resolve', async (request, reply) => {
    try {
      const { module: moduleCode, entityId, tier, role, category } = request.query as {
        module?: string
        entityId?: string
        tier?: string
        role?: string
        category?: string
      }
      if (!moduleCode) {
        return sendError(reply, 400, '必须提供 module 参数')
      }

      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, module_code, param_key, param_name, param_type, scope_type, scope_id,
                  param_value, unit, description, updated_at
           FROM system_module_parameters
           WHERE module_code = $1
           ORDER BY id`,
          [moduleCode]
        )
      )

      // 索引化各级别配置
      const globalParams: Record<string, any> = {}
      const tierParams: Record<string, any> = {}
      const categoryParams: Record<string, any> = {}
      const roleParams: Record<string, any> = {}
      const entityOverrides: Record<string, any> = {}

      for (const row of rows) {
        if (row.scope_type === 'global') {
          globalParams[row.param_key] = row
        } else if (row.scope_type === 'tier' && row.scope_id === tier) {
          tierParams[row.param_key] = row
        } else if (row.scope_type === 'category' && row.scope_id === category) {
          categoryParams[row.param_key] = row
        } else if (row.scope_type === 'role' && row.scope_id === role) {
          roleParams[row.param_key] = row
        } else if (row.scope_type === 'entity' && row.scope_id === entityId) {
          entityOverrides[row.param_key] = row
        }
      }

      // 获取该模块涉及的所有唯一 param_key
      const allKeys = Array.from(new Set(rows.map(r => r.param_key)))
      const effective: Record<string, { value: any; source: 'entity' | 'tier' | 'category' | 'role' | 'global' | 'none'; paramName: string; unit: string; description: string }> = {}

      for (const key of allKeys) {
        if (entityOverrides[key]) {
          const it = entityOverrides[key]
          effective[key] = { value: it.param_value, source: 'entity', paramName: it.param_name, unit: it.unit, description: it.description }
        } else if (tierParams[key]) {
          const it = tierParams[key]
          effective[key] = { value: it.param_value, source: 'tier', paramName: it.param_name, unit: it.unit, description: it.description }
        } else if (categoryParams[key]) {
          const it = categoryParams[key]
          effective[key] = { value: it.param_value, source: 'category', paramName: it.param_name, unit: it.unit, description: it.description }
        } else if (roleParams[key]) {
          const it = roleParams[key]
          effective[key] = { value: it.param_value, source: 'role', paramName: it.param_name, unit: it.unit, description: it.description }
        } else if (globalParams[key]) {
          const it = globalParams[key]
          effective[key] = { value: it.param_value, source: 'global', paramName: it.param_name, unit: it.unit, description: it.description }
        }
      }

      return sendOk(reply, {
        module: moduleCode,
        context: { entityId, tier, role, category },
        effective,
        allRows: rows,
      })
    } catch (err: any) {
      request.log.warn({ err }, 'system/module-parameters resolve failed')
      return sendError(reply, 500, '解析模块参数失败')
    }
  })

}