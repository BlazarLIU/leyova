import type { FastifyInstance } from 'fastify'
import { getPool } from '../../lib/db.js'
import { sendOk, sendError } from '../../lib/http.js'
import { requireAuth } from '../../lib/guard.js'
import bcrypt from 'bcryptjs'

export async function agencyClientsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/agency/clients ── 获取品牌自播客户列表
  app.get('/api/v1/agency/clients', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    const user = (request as any).user
    const tenantId = user?.tenant_id || 1

    try {
      const { rows } = await pool.query(
        `
        SELECT 
          c.id,
          c.name,
          c.brand_name AS "brandName",
          c.contact,
          c.contact_phone AS "contactPhone",
          c.contract_no AS "contractNo",
          c.status,
          c.created_at AS "createdAt",
          COUNT(p.id)::int AS "projectCount"
        FROM public.agency_clients c
        LEFT JOIN public.agency_projects p ON c.id = p.client_id
        WHERE c.tenant_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC
        `,
        [tenantId]
      )

      return sendOk(reply, rows)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch agency clients')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/agency/clients ── 创建品牌自播客户
  app.post('/api/v1/agency/clients', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    const user = (request as any).user
    const tenantId = user?.tenant_id || 1
    const { name, brandName, contact, contactPhone, contractNo } = request.body as {
      name: string
      brandName?: string
      contact?: string
      contactPhone?: string
      contractNo?: string
    }

    if (!name) {
      return sendError(reply, 400, '客户名称不能为空')
    }

    try {
      const { rows } = await pool.query(
        `
        INSERT INTO public.agency_clients 
          (tenant_id, name, brand_name, contact, contact_phone, contract_no)
        VALUES 
          ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [tenantId, name, brandName || name, contact || null, contactPhone || null, contractNo || null]
      )

      return sendOk(reply, rows[0], '品牌自播客户创建成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create agency client')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/agency/clients/:id ── 修改品牌自播客户
  app.put('/api/v1/agency/clients/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    const user = (request as any).user
    const tenantId = user?.tenant_id || 1
    const { id } = request.params as { id: string }
    const { name, brandName, contact, contactPhone, contractNo, status } = request.body as any

    try {
      const { rows } = await pool.query(
        `
        UPDATE public.agency_clients
        SET 
          name = COALESCE($1, name),
          brand_name = COALESCE($2, brand_name),
          contact = COALESCE($3, contact),
          contact_phone = COALESCE($4, contact_phone),
          contract_no = COALESCE($5, contract_no),
          status = COALESCE($6, status),
          updated_at = NOW()
        WHERE id = $7 AND tenant_id = $8
        RETURNING *
        `,
        [name, brandName, contact, contactPhone, contractNo, status, Number(id), tenantId]
      )

      if (rows.length === 0) {
        return sendError(reply, 404, '客户不存在或无权限')
      }

      return sendOk(reply, rows[0], '客户更新成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to update agency client')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/agency/clients/:id/users ── 为品牌自播开通专属登录账号
  app.post('/api/v1/agency/clients/:id/users', { preHandler: [requireAuth] }, async (request, reply) => {
    const pool = getPool()
    const user = (request as any).user
    const tenantId = user?.tenant_id || 1
    const { id } = request.params as { id: string }
    const { username, password, name, phone, projectIds = [], canViewCost = false } = request.body as any

    if (!username || !password) {
      return sendError(reply, 400, '登录用户名和密码为必填项')
    }

    try {
      // 验证客户归属
      const clientRes = await pool.query(
        'SELECT id, brand_name FROM public.agency_clients WHERE id = $1 AND tenant_id = $2',
        [Number(id), tenantId]
      )
      if (clientRes.rows.length === 0) {
        return sendError(reply, 404, '客户不存在')
      }

      // bcrypt 哈希密码
      const hashedPassword = bcrypt.hashSync(password, 10)

      // 创建用户
      const userRes = await pool.query(
        `
        INSERT INTO public.users (username, password_hash, real_name, role, status, tenant_id, user_type)
        VALUES ($1, $2, $3, 'brand_viewer', 1, $4, 'brand_viewer')
        RETURNING id, username, real_name, user_type
        `,
        [username, hashedPassword, name || `${clientRes.rows[0].brand_name}代表`, tenantId]
      )
      const createdUser = userRes.rows[0]

      // 绑定 brand_viewer_permissions
      await pool.query(
        `
        INSERT INTO public.brand_viewer_permissions 
          (user_id, tenant_id, client_id, project_ids, can_view_cost)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, client_id) 
        DO UPDATE SET project_ids = EXCLUDED.project_ids, can_view_cost = EXCLUDED.can_view_cost
        `,
        [createdUser.id, tenantId, Number(id), projectIds, canViewCost]
      )

      return sendOk(reply, {
        userId: createdUser.id,
        username: createdUser.username,
        realName: createdUser.real_name,
        clientId: Number(id),
        allowedProjects: projectIds,
        userType: 'brand_viewer',
      }, '品牌自播专属登录账号开通成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create brand viewer user')
      return sendError(reply, 500, err.message)
    }
  })
}
