import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'
import { DATA_OPERATE_ROLES, DATA_ADMIN_ROLES } from '../lib/roles.js'
import { writeAuditLog } from '../lib/audit.js'

/**
 * data 域拆分（P2-1）：登记数据管理（CRUD）
 * 原属 routes/data.ts，2026-11-17 拆出。
 */
export async function dataLiveRoutes(app: FastifyInstance) {
  // ── GET /api/v1/data/live ──
  app.get('/api/v1/data/live', async (request, reply) => {
    try {
      // 登记数据管理：只读人工登记表（独立模块，不混入系统场次数据）
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT s.id, s.biz_date::text AS date,
                  s.anchor_id, s.room_id, s.operator_id,
                  a.name AS anchor_name,
                  r.name AS room_name,
                  o.name AS operator_name,
                  s.start_time::text, s.end_time::text,
                  s.duration_min AS duration,
                  s.title, s.gmv, s.return_amount AS refund_amount, s.status,
                  s.remark, s.entry_source, s.registered_at::text
           FROM live_registrations s
           LEFT JOIN anchors a ON a.id = s.anchor_id
           LEFT JOIN live_rooms r ON r.id = s.room_id
           LEFT JOIN operators o ON o.id = s.operator_id
           ORDER BY s.biz_date DESC, s.start_time DESC
           LIMIT 500`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'data/live query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/data/live/:id ──
  app.get('/api/v1/data/live/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT s.*, a.name AS anchor_name, r.name AS room_name, o.name AS operator_name
           FROM live_registrations s
           LEFT JOIN anchors a ON a.id = s.anchor_id
           LEFT JOIN live_rooms r ON r.id = s.room_id
           LEFT JOIN operators o ON o.id = s.operator_id
           WHERE s.id = $1`,
          [parseInt(id)],
        ),
      )
      return sendOk(reply, rows[0] ?? null)
    } catch (err) {
      request.log.warn({ err }, 'data/live/:id query failed')
      return sendOk(reply, null)
    }
  })

  // ── DELETE /api/v1/data/live/:id ──
  app.delete('/api/v1/data/live/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await withRlsContext(request, async (client) => {
        const res = await client.query('DELETE FROM live_registrations WHERE id = $1 RETURNING id', [parseInt(id)])
        if ((res.rowCount ?? 0) > 0) {
          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'data.live_registration.delete',
            resourceType: 'live_registration',
            resourceId: id,
            request,
          })
        }
        return res
      })
      return sendOk(reply, { deleted: (result.rowCount ?? 0) > 0, id: parseInt(id) })
    } catch (err) {
      request.log.warn({ err }, 'data/live delete failed')
      return sendOk(reply, { deleted: false })
    }
  })

  // ── PUT /api/v1/data/live/:id ──
  app.put('/api/v1/data/live/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as Record<string, any>
      const sessionId = parseInt(id)

      const out = await withRlsContext(request, async (client) => {
        const { rows: current } = await client.query(
          `SELECT room_id, anchor_id, biz_date::text AS date, start_time::text
             FROM live_registrations WHERE id = $1`,
          [sessionId],
        )

        if (current[0]) {
          const effective = {
            room_id: body.roomId ?? current[0].room_id,
            anchor_id: body.anchorId ?? current[0].anchor_id,
            date: body.date ?? current[0].date,
            start_time: body.startTime ?? current[0].start_time,
          }
          if (effective.date && effective.start_time) {
            const dupRes = await client.query(
              `SELECT id FROM live_registrations
                WHERE biz_date = $1::date
                  AND COALESCE(anchor_id, 0) = COALESCE($2, 0)
                  AND COALESCE(room_id, 0) = COALESCE($3, 0)
                  AND start_time = $4::time
                  AND status <> 'cancelled'
                  AND id <> $5
                LIMIT 1`,
              [effective.date, effective.anchor_id, effective.room_id, effective.start_time, sessionId],
            )
            if (dupRes.rows.length > 0) {
              return { status: 409 as const, message: `该主播在 ${effective.date} ${effective.start_time} 已有登记记录（ID: ${dupRes.rows[0].id}）` }
            }
          }
        }

        const result = await client.query(
          `UPDATE live_registrations SET
             room_id       = COALESCE($1, room_id),
             anchor_id     = COALESCE($2, anchor_id),
             operator_id   = COALESCE($3, operator_id),
             biz_date      = COALESCE($4::date, biz_date),
             start_time    = COALESCE($5::time, start_time),
             end_time      = COALESCE($6::time, end_time),
             duration_min  = COALESCE($7, duration_min),
             title         = COALESCE($8, title),
             gmv           = COALESCE($9, gmv),
             orders        = COALESCE($10, orders),
             buyer_count   = COALESCE($11, buyer_count),
             return_amount = COALESCE($12, return_amount),
             remark        = COALESCE($13, remark),
             status        = COALESCE($14, status),
             updated_at    = NOW()
           WHERE id = $15
           RETURNING *`,
          [
            body.roomId ?? null,
            body.anchorId ?? null,
            body.operatorId ?? null,
            body.date ?? null,
            body.startTime ?? null,
            body.endTime ?? null,
            body.duration ?? null,
            body.title ?? null,
            body.gmv ?? null,
            body.orders ?? null,
            body.buyerCount ?? null,
            body.returnAmount ?? null,
            body.remark ?? null,
            body.status ?? null,
            sessionId,
          ],
        )
        if (result.rows.length === 0) return { status: 404 as const, message: '登记记录不存在' }
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.live_registration.update',
          resourceType: 'live_registration',
          resourceId: sessionId,
          afterData: result.rows[0],
          request,
        })
        return { status: 200 as const, row: result.rows[0] }
      })

      if (out.status !== 200) return sendError(reply, out.status, out.message)
      return sendOk(reply, out.row, '登记信息已更新')
    } catch (err) {
      request.log.warn({ err }, 'data/live update failed')
      return sendError(reply, 500, '更新登记信息失败')
    }
  })

}
