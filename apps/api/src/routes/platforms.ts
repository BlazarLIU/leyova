import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { platformRegistry } from '../platform/index.js'

export async function platformRoutes(app: FastifyInstance) {
  const pool = getPool()

  // ── GET /api/v1/platforms ── 获取所有平台列表（含全局开关、能力声明与权限状态）
  app.get('/api/v1/platforms', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user
      const role = user?.role || 'admin' // default to admin for dev/unauthenticated sessions

      const { rows } = await pool.query(`
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

      // If user is not admin, check which platforms are permitted
      let permittedPlatforms: Set<string> | null = null
      if (role !== 'admin' && role !== 'super_admin' && user?.id) {
        const permRes = await pool.query(`
          SELECT platform_code FROM role_platform_permissions rpp
          JOIN roles r ON r.id = rpp.role_id
          WHERE r.code = $1
        `, [role])
        permittedPlatforms = new Set(permRes.rows.map(r => r.platform_code))
      }

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
  app.put('/api/v1/platforms/:code', async (request: FastifyRequest<{
    Params: { code: string }
    Body: { is_enabled?: boolean; sort_order?: number; api_config?: Record<string, any> }
  }>, reply: FastifyReply) => {
    try {
      const { code } = request.params
      const { is_enabled, sort_order, api_config } = request.body || {}

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
      if (rows.length === 0) {
        return sendError(reply, 404, '平台不存在')
      }

      return sendOk(reply, rows[0], '平台配置更新成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to update platform config')
      return sendError(reply, 500, '更新平台配置失败')
    }
  })

  // ── GET /api/v1/platforms/:code/shops ── 获取某平台下有效店铺列表
  app.get('/api/v1/platforms/:code/shops', async (request: FastifyRequest<{
    Params: { code: string }
  }>, reply: FastifyReply) => {
    try {
      const { code } = request.params
      const { rows } = await pool.query(`
        SELECT id, platform_code, shop_name, external_shop_id, status, auth_status, extra, created_at
        FROM dim_shop
        WHERE platform_code = $1 AND status = 'active'
        ORDER BY id ASC
      `, [code])
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch shops')
      return sendError(reply, 500, '获取店铺列表失败')
    }
  })

  // ── GET /api/v1/platforms/permissions ── 获取角色-平台权限矩阵
  app.get('/api/v1/platforms/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.put('/api/v1/platforms/permissions', async (request: FastifyRequest<{
    Body: {
      roleId: number
      platformCode: string
      isPermitted: boolean
      allowedModules?: string[]
    }
  }>, reply: FastifyReply) => {
    try {
      const { roleId, platformCode, isPermitted, allowedModules } = request.body || {}
      if (!roleId || !platformCode) {
        return sendError(reply, 400, '缺少必要参数 (roleId, platformCode)')
      }

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

      return sendOk(reply, { success: true }, '角色平台权限更新成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to update platform permissions')
      return sendError(reply, 500, '更新角色平台权限失败')
    }
  })
}

