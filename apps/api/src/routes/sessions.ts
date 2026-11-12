import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

const SESSION_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'controller']

export async function sessionRoutes(app: FastifyInstance) {
  // ── GET /api/v1/sessions/:id ── 单场次详情
  app.get('/api/v1/sessions/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT ls.*, a.name AS anchor_name, lr.name AS room_name
           FROM live_sessions ls
           LEFT JOIN anchors a ON a.id = ls.anchor_id
           LEFT JOIN live_rooms lr ON lr.id = ls.room_id
           WHERE ls.id = $1`,
          [id]
        )
      )
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '场次不存在' })
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'sessions/:id query failed')
      return reply.code(500).send({ success: false, message: '查询失败' })
    }
  })

  // ── POST /api/v1/sessions ── 创建场次
  app.post('/api/v1/sessions', { preHandler: [requireRole(SESSION_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const body = request.body as {
        title?: string; roomId?: number; anchorId?: number
        date?: string; startTime?: string; endTime?: string
      }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO live_sessions (room_id, anchor_id, date, start_time, end_time, title, status, gmv, orders)
           VALUES ($1, $2, $3::date, $4::time, $5::time, $6, 'scheduled', 0, 0)
           RETURNING *`,
          [body.roomId, body.anchorId, body.date, body.startTime, body.endTime, body.title || ''],
        ),
      )
      return sendOk(reply, { session: rows[0] }, '场次创建成功')
    } catch (err) {
      request.log.warn({ err }, 'POST /sessions failed')
      if ((err as any)?.code === '23503') {
        return reply.code(400).send({ success: false, message: '房间或主播不存在' })
      }
      return reply.code(500).send({ success: false, message: '创建失败' })
    }
  })

  // ── PATCH /api/v1/sessions/:id ── 更新场次
  app.patch('/api/v1/sessions/:id', { preHandler: [requireRole(SESSION_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as Partial<{
        title: string; roomId: number; anchorId: number
        date: string; startTime: string; endTime: string; status: string
        gmv: number; orders: number
      }>

      const fields: string[] = []
      const values: any[] = []
      let idx = 1

      if (body.title !== undefined) { fields.push(`title = $${idx++}`); values.push(body.title) }
      if (body.roomId !== undefined) { fields.push(`room_id = $${idx++}`); values.push(body.roomId) }
      if (body.anchorId !== undefined) { fields.push(`anchor_id = $${idx++}`); values.push(body.anchorId) }
      if (body.date !== undefined) { fields.push(`date = $${idx++}::date`); values.push(body.date) }
      if (body.startTime !== undefined) { fields.push(`start_time = $${idx++}::time`); values.push(body.startTime) }
      if (body.endTime !== undefined) { fields.push(`end_time = $${idx++}::time`); values.push(body.endTime) }
      if (body.status !== undefined) { fields.push(`status = $${idx++}`); values.push(body.status) }
      if (body.gmv !== undefined) { fields.push(`gmv = $${idx++}`); values.push(body.gmv) }
      if (body.orders !== undefined) { fields.push(`orders = $${idx++}`); values.push(body.orders) }

      if (fields.length === 0) {
        return reply.code(400).send({ success: false, message: '没有需要更新的字段' })
      }

      values.push(id)
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `UPDATE live_sessions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
          values,
        ),
      )
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '场次不存在' })
      return sendOk(reply, { session: rows[0] }, '更新成功')
    } catch (err) {
      request.log.warn({ err }, 'PATCH /sessions/:id failed')
      return reply.code(500).send({ success: false, message: '更新失败' })
    }
  })

  // ── POST /api/v1/sessions/:id/finalize ── 完结场次
  app.post('/api/v1/sessions/:id/finalize', { preHandler: [requireRole(SESSION_WRITE_ROLES)] }, async (request, reply) => {
    const user = (request as any).user
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { gmv?: number; orders?: number }
      const { rows } = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE live_sessions
           SET status = 'completed', gmv = COALESCE($1, gmv), orders = COALESCE($2, orders), end_time = CURRENT_TIME
           WHERE id = $3 AND status != 'completed'
           RETURNING *`,
          [body.gmv, body.orders, id],
        )
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            actorUserId: user?.id,
            action: 'session.finalize',
            resourceType: 'live_session',
            resourceId: id,
            afterData: res.rows[0],
            request,
          })
        }
        return res
      })
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '场次不存在或已完结' })
      return sendOk(reply, { session: rows[0] }, '场次已完结')
    } catch (err) {
      request.log.warn({ err }, 'POST /sessions/:id/finalize failed')
      return reply.code(500).send({ success: false, message: '完结失败' })
    }
  })

  // ── GET /api/v1/sessions/:id/metrics ── 场次指标
  app.get('/api/v1/sessions/:id/metrics', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, gmv, orders, duration_min,
                  COALESCE(gmv / NULLIF(orders, 0), 0) AS avg_order_value
           FROM live_sessions WHERE id = $1`,
          [id]
        )
      )
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '场次不存在' })
      return sendOk(reply, { metrics: rows[0] })
    } catch (err) {
      request.log.warn({ err }, 'GET /sessions/:id/metrics failed')
      return reply.code(500).send({ success: false, message: '查询失败' })
    }
  })
}