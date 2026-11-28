import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canManageTargetUser, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

/**
 * system 域拆分（P2-1）：改进任务 + 活动管理
 * 原属 routes/system.ts，2026-11-17 拆出。
 */
export async function systemTasksRoutes(app: FastifyInstance) {
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
  app.post('/api/v1/system/tasks', { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] }, async (request, reply) => {
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
  app.put('/api/v1/system/tasks/:id/status', { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] }, async (request, reply) => {
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
  app.post('/api/v1/system/promotions', { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] }, async (request, reply) => {
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

}
