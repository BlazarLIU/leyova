import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canManageTargetUser, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

/**
 * system 域拆分（P2-1）：直播间管理
 * 原属 routes/system.ts，2026-11-17 拆出。
 */
export async function systemRoomsRoutes(app: FastifyInstance) {
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

}
