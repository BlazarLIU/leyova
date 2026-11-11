import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool, withRlsContext } from '../lib/db.js'
import { getUserAllowedPlatforms, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { platformRegistry } from '../platform/index.js'

export async function platformRoutes(app: FastifyInstance) {
  const pool = getPool()

  // ── GET /api/v1/platforms ── 获取所有平台列表（含全局开关、能力声明与权限状态）
  app.get('/api/v1/platforms', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user
      const permittedPlatforms = await getUserAllowedPlatforms(pool, user)

      const { rows } = await withRlsContext(request, (client) =>
        client.query(`
          SELECT 
            p.platform_code, 
            p.platform_name, 
            p.category, 
            p.is_enabled, 
            p.sort_order, 
            p.icon,
            p.api_config,
            COALESCE(
              (SELECT json_agg(json_build_object('id', s.id, 'name', s.shop_name, 'status', s.status, 'authStatus', s.auth_status))
               FROM dim_shop s WHERE s.platform_code = p.platform_code AND s.status = 'active'),
              '[]'::json
            ) AS shops
          FROM system_platform_configs p
          ORDER BY p.sort_order ASC
        `)
      )

      const result = rows.map((row: any) => {
        const capabilities = platformRegistry.getCapabilities(row.platform_code)
        const isPermitted = permittedPlatforms === null || permittedPlatforms.has(row.platform_code)
        return {
          ...row,
          isPermitted,
          capabilities,
        }
      })

      return sendOk(reply, result)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch platforms')
      return sendError(reply, 500, '获取平台配置失败')
    }
  })

  // ── PUT /api/v1/platforms/:code ── 管理员开启/关闭特定平台
  app.put<{
    Params: { code: string }
    Body: { is_enabled?: boolean; sort_order?: number; api_config?: Record<string, any> }
  }>('/api/v1/platforms/:code', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const { code } = request.params
      const { is_enabled, sort_order, api_config } = request.body || {}

      const beforeRes = await pool.query('SELECT * FROM system_platform_configs WHERE platform_code = $1', [code])
      if (beforeRes.rows.length === 0) {
        return sendError(reply, 404, '平台不存在')
      }

      const updates: string[] = []
      const values: any[] = [code]
      let idx = 2

      if (typeof is_enabled === 'boolean') {
        updates.push(`is_enabled = $${idx++}`)
        values.push(is_enabled)
      }
      if (typeof sort_order === 'number') {
        updates.push(`sort_order = $${idx++}`)
        values.push(sort_order)
      }
      if (api_config && typeof api_config === 'object') {
        updates.push(`api_config = $${idx++}`)
        values.push(JSON.stringify(api_config))
      }

      if (updates.length === 0) {
        return sendError(reply, 400, '缺少更新字段')
      }

      updates.push(`updated_at = now()`)

      const sql = `
        UPDATE system_platform_configs
        SET ${updates.join(', ')}
        WHERE platform_code = $1
        RETURNING *
      `

      const { rows } = await pool.query(sql, values)
      await writeAuditLog(pool, {
        request,
        action: 'platform.config.update',
        resourceType: 'system_platform_configs',
        resourceId: code,
        beforeData: beforeRes.rows[0],
        afterData: rows[0],
      })

      return sendOk(reply, rows[0], '平台配置更新成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to update platform config')
      return sendError(reply, 500, '更新平台配置失败')
    }
  })

  // ── GET /api/v1/platforms/:code/shops ── 获取某平台下有效店铺列表
  app.get<{
    Params: { code: string }
  }>('/api/v1/platforms/:code/shops', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { code } = request.params
      const { rows } = await withRlsContext(request, (client) =>
        client.query(`
          SELECT id, platform_code, shop_name, external_shop_id, status, auth_status, extra, created_at
          FROM dim_shop
          WHERE platform_code = $1 AND status = 'active'
          ORDER BY id ASC
        `, [code])
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch shops')
      return sendError(reply, 500, '获取店铺列表失败')
    }
  })

  // ── GET /api/v1/platforms/permissions ── 获取角色-平台权限矩阵
  app.get('/api/v1/platforms/permissions', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await pool.query(`
        SELECT 
          rpp.id,
          rpp.role_id,
          r.code AS role_code,
          r.name AS role_name,
          rpp.platform_code,
          spc.platform_name,
          rpp.allowed_modules
        FROM role_platform_permissions rpp
        JOIN roles r ON r.id = rpp.role_id
        JOIN system_platform_configs spc ON spc.platform_code = rpp.platform_code
        ORDER BY r.id, spc.sort_order
      `)
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch platform permissions')
      return sendError(reply, 500, '获取平台权限矩阵失败')
    }
  })

  // ── PUT /api/v1/platforms/permissions ── 更新角色-平台权限
  app.put<{
    Body: {
      roleId: number
      platformCode: string
      isPermitted: boolean
      allowedModules?: string[]
    }
  }>('/api/v1/platforms/permissions', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const actor = (request as any).user
      const { roleId, platformCode, isPermitted, allowedModules } = request.body || {}
      if (!roleId || !platformCode) {
        return sendError(reply, 400, '缺少必要参数 (roleId, platformCode)')
      }

      const roleRes = await pool.query('SELECT code FROM roles WHERE id = $1', [roleId])
      if (roleRes.rows.length === 0) {
        return sendError(reply, 404, '目标角色不存在')
      }
      if (roleRes.rows[0].code === 'super_admin' && actor.role !== 'super_admin') {
        return sendError(reply, 403, '仅系统超级管理员可调整 super_admin 平台权限')
      }

      const beforeRes = await pool.query(
        'SELECT * FROM role_platform_permissions WHERE role_id = $1 AND platform_code = $2',
        [roleId, platformCode]
      )

      if (isPermitted) {
        await pool.query(`
          INSERT INTO role_platform_permissions (role_id, platform_code, allowed_modules)
          VALUES ($1, $2, $3)
          ON CONFLICT (role_id, platform_code)
          DO UPDATE SET allowed_modules = EXCLUDED.allowed_modules
        `, [roleId, platformCode, allowedModules || []])
      } else {
        await pool.query(`
          DELETE FROM role_platform_permissions
          WHERE role_id = $1 AND platform_code = $2
        `, [roleId, platformCode])
      }

      await writeAuditLog(pool, {
        request,
        action: 'platform.permission.update',
        resourceType: 'role_platform_permissions',
        resourceId: `${roleId}:${platformCode}`,
        beforeData: beforeRes.rows[0] ?? null,
        afterData: { roleId, roleCode: roleRes.rows[0].code, platformCode, isPermitted, allowedModules: allowedModules || [] },
      })

      return sendOk(reply, { success: true }, '角色平台权限更新成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to update platform permissions')
      return sendError(reply, 500, '更新角色平台权限失败')
    }
  })
}

