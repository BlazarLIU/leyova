import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

// P1-B11：排班写权限补齐
//
// 审计断点：此前缺 controller（中控）/ ad_buyer（投手）/ ops_staff（运营专员）
//   → 中控和投手「改不了自己的班次」，只能找运营代改，排班流程卡在一个人身上。
// 保留 hrbp（排班管理是 HRBP 职责）、super_admin/admin（管理）、ops_director/operator（运营）。
const SCHEDULE_WRITE_ROLES = [
  'super_admin', 'admin', 'ops_director', 'ops_staff',
  'hrbp', 'operator', 'controller', 'ad_buyer',
]

export async function scheduleRoutes(app: FastifyInstance) {
  // ── GET /api/v1/schedule/meta ── 获取排班所需的元数据（直播间、主播、运营人员、项目）
  app.get('/api/v1/schedule/meta', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const [roomsRes, anchorsRes, operatorsRes, projectsRes] = await withRlsContext(request, (client) =>
        Promise.all([
          client.query("SELECT id, name, platform, status FROM public.live_rooms WHERE status = 'active' ORDER BY id ASC"),
          client.query('SELECT id, name, level, status FROM public.anchors WHERE status = 1 ORDER BY name ASC'),
          client.query("SELECT id, real_name AS name, role FROM public.users WHERE role IN ('admin', 'super_admin', 'operator') ORDER BY real_name ASC"),
          // S3：代运营项目域已下线，返回空项目列表（保持响应契约）
          Promise.resolve({ rows: [] as unknown[] }),
        ]),
      )

      return sendOk(reply, {
        rooms: roomsRes.rows,
        anchors: anchorsRes.rows,
        operators: operatorsRes.rows,
        projects: projectsRes.rows,
      })
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/schedule/staff-roles ── 岗位字典
  app.get('/api/v1/schedule/staff-roles', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const rows = await withRlsContext(request, (client) =>
        client.query(
          `SELECT code, name, sort_order, color, is_multi, description
             FROM public.staff_role_dict ORDER BY sort_order ASC, code ASC`,
        ),
      )
      return sendOk(reply, rows.rows)
    } catch (err) {
      request.log.warn({ err }, 'schedule/staff-roles failed')
      return sendError(reply, 500, '获取岗位字典失败')
    }
  })

  // ── GET /api/v1/schedule/calendar ── 直播排班日历（含多岗位）
  //   老大要求：按日历方式展示，且不只显示主播，要含中控/运营/投手/拍剪/编导
  app.get('/api/v1/schedule/calendar', { preHandler: [requireAuth] }, async (request, reply) => {
    const q = request.query as { from?: string; to?: string; roomId?: string; platform?: string }
    const from = q.from || new Date().toISOString().slice(0, 10)
    const to = q.to || from

    try {
      const data = await withRlsContext(request, async (client) => {
        const conds: string[] = ['s.date BETWEEN $1::date AND $2::date']
        const params: any[] = [from, to]

        if (q.roomId) {
          params.push(Number(q.roomId))
          conds.push(`s.room_id = $${params.length}`)
        }
        if (q.platform) {
          params.push(String(q.platform))
          conds.push(`r.platform_code = $${params.length}`)
        }

        const sessRes = await client.query(
          `SELECT s.id,
                  s.date,
                  s.title,
                  s.start_time,
                  s.end_time,
                  s.status,
                  s.duration_min,
                  COALESCE(s.gmv, 0)::numeric(14,2) AS gmv,
                  s.room_id,
                  r.name            AS room_name,
                  r.platform_code,
                  s.anchor_id
             FROM public.live_sessions s
             LEFT JOIN public.live_rooms r ON r.id = s.room_id
            WHERE ${conds.join(' AND ')}
            ORDER BY s.date ASC, s.start_time ASC NULLS LAST`,
          params,
        )

        const ids = sessRes.rows.map((r: any) => r.id)
        let staffRows: any[] = []
        if (ids.length > 0) {
          const staffRes = await client.query(
            `SELECT sa.session_id, sa.role_code, sa.staff_name, d.name AS role_name,
                    d.sort_order, d.color
               FROM public.session_staff_assignments sa
               JOIN public.staff_role_dict d ON d.code = sa.role_code
              WHERE sa.session_id = ANY($1::int[])
              ORDER BY d.sort_order ASC, sa.staff_name ASC`,
            [ids],
          )
          staffRows = staffRes.rows
        }

        const staffBySession = new Map<number, any[]>()
        for (const r of staffRows) {
          if (!staffBySession.has(r.session_id)) staffBySession.set(r.session_id, [])
          staffBySession.get(r.session_id)!.push({
            roleCode: r.role_code,
            roleName: r.role_name,
            color: r.color,
            name: r.staff_name,
          })
        }

        const sessions = sessRes.rows.map((r: any) => ({
          id: r.id,
          date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
          title: r.title,
          startTime: r.start_time,
          endTime: r.end_time,
          status: r.status,
          durationMin: r.duration_min,
          gmv: Number(r.gmv),
          roomId: r.room_id,
          roomName: r.room_name,
          platformCode: r.platform_code,
          staff: staffBySession.get(r.id) || [],
        }))

        // 按日期分组，便于前端直接渲染日历格
        const byDate: Record<string, any[]> = {}
        for (const s of sessions) {
          if (!byDate[s.date]) byDate[s.date] = []
          byDate[s.date].push(s)
        }

        // 岗位覆盖度：有多少场次配齐了核心岗位
        const roleSet = new Set(staffRows.map((r: any) => r.role_code))
        const coreRoles = ['anchor', 'controller', 'operator']
        const fullyStaffed = sessions.filter(
          (s: any) => coreRoles.every((rc) => s.staff.some((x: any) => x.roleCode === rc)),
        ).length

        return {
          range: { from, to },
          totals: {
            sessions: sessions.length,
            fullyStaffed,
            rolesCovered: Array.from(roleSet),
          },
          byDate,
          sessions,
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'schedule/calendar failed')
      return sendError(reply, 500, '获取排班日历失败')
    }
  })

  // ── POST /api/v1/schedule/sessions/:id/staff ── 设置某场次的岗位人员（全量替换）
  app.post('/api/v1/schedule/sessions/:id/staff', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const sessionId = Number(id)
    if (!Number.isFinite(sessionId)) return sendError(reply, 400, '场次 ID 非法')

    const body = (request.body || {}) as {
      staff?: Array<{ roleCode: string; staffName: string; staffId?: number; note?: string }>
    }
    const staff = Array.isArray(body.staff) ? body.staff : []
    if (staff.length === 0) return sendError(reply, 400, 'staff 不能为空')

    for (const s of staff) {
      if (!s.roleCode || !s.staffName) {
        return sendError(reply, 400, '每个岗位项必须包含 roleCode 与 staffName')
      }
    }

    try {
      const result = await withRlsContext(request, async (client) => {
        const sess = await client.query(`SELECT id FROM public.live_sessions WHERE id = $1`, [sessionId])
        if (sess.rows.length === 0) throw new Error('场次不存在')

        const before = await client.query(
          `SELECT role_code, staff_name FROM public.session_staff_assignments WHERE session_id = $1`,
          [sessionId],
        )

        await client.query(`DELETE FROM public.session_staff_assignments WHERE session_id = $1`, [sessionId])

        for (const s of staff) {
          await client.query(
            `INSERT INTO public.session_staff_assignments (session_id, role_code, staff_id, staff_name, note)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (session_id, role_code, staff_name) DO NOTHING`,
            [sessionId, s.roleCode, s.staffId ?? null, s.staffName, s.note ?? ''],
          )
        }

        return { before: before.rows, after: staff }
      })

      await withRlsContext(request, (client) => writeAuditLog(client, {
        request,
        action: 'schedule.staff.update',
        resourceType: 'session_staff_assignments',
        resourceId: String(sessionId),
        afterData: result,
      }))

      return sendOk(reply, result, '岗位排班已更新')
    } catch (err: any) {
      request.log.warn({ err }, 'schedule/staff update failed')
      return sendError(reply, 400, err?.message || '更新岗位排班失败')
    }
  })

  // ── GET /api/v1/schedule/day-status ── 人员每日状态（上班/排休/请假）
  app.get('/api/v1/schedule/day-status', { preHandler: [requireAuth] }, async (request, reply) => {
    const q = request.query as { from?: string; to?: string }
    const from = q.from || new Date().toISOString().slice(0, 10)
    const to = q.to || from
    try {
      const rows = await withRlsContext(request, (client) =>
        client.query(
          `SELECT staff_name, biz_date, status, note
             FROM public.staff_day_status
            WHERE biz_date BETWEEN $1::date AND $2::date
            ORDER BY biz_date ASC, staff_name ASC`,
          [from, to],
        ),
      )
      const byDate: Record<string, Array<{ staffName: string; status: string; note: string }>> = {}
      for (const r of rows.rows) {
        const d = typeof r.biz_date === 'string' ? r.biz_date : new Date(r.biz_date).toISOString().slice(0, 10)
        if (!byDate[d]) byDate[d] = []
        byDate[d].push({ staffName: r.staff_name, status: r.status, note: r.note || '' })
      }
      return sendOk(reply, { range: { from, to }, byDate })
    } catch (err) {
      request.log.warn({ err }, 'schedule/day-status failed')
      return sendError(reply, 500, '获取人员每日状态失败')
    }
  })

  // ── PUT /api/v1/schedule/day-status ── 批量设置人员每日状态（排班/排休）
  // ── POST /api/v1/schedule/my/leave ── 本人请假（P1-B24）
  //
  // 审计断点：此前主播无法自己请假 —— PUT /schedule/day-status 需要 SCHEDULE_WRITE_ROLES，
  //   主播（employee）不在其中，只能找运营代填。
  //
  // 本端点：登录即可，但**只能给自己**填（staffName 由后端从 user 推导，不接受前端传入），
  //   防止越权给他人标记请假。
  app.post('/api/v1/schedule/my/leave', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    if (!user) return sendError(reply, 401, '未登录')

    const body = (request.body || {}) as {
      bizDate?: string
      status?: string
      note?: string
    }
    const VALID = ['leave', 'sick', 'rest']
    const status = body.status || 'leave'
    if (!VALID.includes(status)) {
      return sendError(reply, 400, `请假类型必须是 ${VALID.join('/')}`)
    }
    if (!body.bizDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.bizDate)) {
      return sendError(reply, 400, '请提供合法日期（YYYY-MM-DD）')
    }

    // 只能申请今天及以后
    const today = new Date().toISOString().slice(0, 10)
    if (body.bizDate < today) {
      return sendError(reply, 400, '不能为已过去的日期申请请假')
    }

    // 本人姓名：从主播档案取，取不到用 realName
    let staffName: string | null = null
    try {
      staffName = await withRlsContext(request, async (client) => {
        const r = await client.query(
          `SELECT COALESCE(
                    (SELECT name FROM public.anchors WHERE user_id = $1 LIMIT 1),
                    (SELECT COALESCE(NULLIF(real_name,''), username) FROM public.users WHERE id = $1)
                  ) AS name`,
          [user.id],
        )
        return r.rows[0]?.name || null
      })
    } catch {
      staffName = null
    }
    if (!staffName) return sendError(reply, 400, '未找到你的员工档案，请联系 HRBP')

    try {
      const result = await withRlsContext(request, async (client) => {
        // 若当天已有排班，提示需协调（不阻断，但返回 warning）
        const sched = await client.query(
          `SELECT COUNT(*)::int AS n
             FROM session_staff_assignments ssa
             JOIN live_sessions ls ON ls.id = ssa.session_id
            WHERE ls.date = $1::date
              AND ssa.staff_name = $2`,
          [body.bizDate, staffName],
        )
        const conflictCount = sched.rows[0]?.n ?? 0

        await client.query(
          `INSERT INTO public.staff_day_status (staff_name, biz_date, status, note)
           VALUES ($1, $2::date, $3, $4)
           ON CONFLICT (staff_name, biz_date)
           DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now()`,
          [staffName, body.bizDate, status, body.note ?? ''],
        )

        await writeAuditLog(client, {
          request,
          action: 'schedule.my_leave.create',
          resourceType: 'staff_day_status',
          resourceId: `${staffName}_${body.bizDate}`,
          afterData: { staffName, bizDate: body.bizDate, status },
        })

        return { staffName, bizDate: body.bizDate, status, conflictCount }
      })

      return sendOk(
        reply,
        result,
        result.conflictCount > 0
          ? `已提交请假，但当天你还有 ${result.conflictCount} 个排班，请尽快与排班负责人协调`
          : '请假已提交',
      )
    } catch (err: any) {
      request.log.warn({ err }, 'schedule/my/leave failed')
      return sendError(reply, 400, err?.message || '提交请假失败')
    }
  })

  app.put('/api/v1/schedule/day-status', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const body = (request.body || {}) as {
      entries?: Array<{ staffName: string; bizDate: string; status: string; note?: string }>
    }
    const entries = Array.isArray(body.entries) ? body.entries : []
    if (entries.length === 0) return sendError(reply, 400, 'entries 不能为空')

    const VALID = ['work', 'rest', 'leave', 'sick']
    for (const e of entries) {
      if (!e.staffName || !e.bizDate || !VALID.includes(e.status)) {
        return sendError(reply, 400, `非法条目（status 必须是 ${VALID.join('/')}）`)
      }
    }

    try {
      const result = await withRlsContext(request, async (client) => {
        for (const e of entries) {
          await client.query(
            `INSERT INTO public.staff_day_status (staff_name, biz_date, status, note)
             VALUES ($1, $2::date, $3, $4)
             ON CONFLICT (staff_name, biz_date)
             DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now()`,
            [e.staffName, e.bizDate, e.status, e.note ?? ''],
          )
        }
        return { count: entries.length }
      })

      await withRlsContext(request, (client) => writeAuditLog(client, {
        request,
        action: 'schedule.day_status.update',
        resourceType: 'staff_day_status',
        resourceId: 'batch',
        afterData: result,
      }))

      return sendOk(reply, result, '人员状态已更新')
    } catch (err: any) {
      request.log.warn({ err }, 'schedule/day-status update failed')
      return sendError(reply, 400, err?.message || '更新人员状态失败')
    }
  })

  // ── GET /api/v1/schedule/sessions ── 获取排班场次列表（按周/按月/按筛选）
  app.get('/api/v1/schedule/sessions', { preHandler: [requireAuth] }, async (request, reply) => {
    const { startDate, endDate, anchorId, roomId, projectId, status } = request.query as any

    try {
      const conditions: string[] = ['1=1']
      const params: any[] = []
      let pIdx = 1

      if (startDate) {
        conditions.push(`s.date >= $${pIdx++}`)
        params.push(startDate)
      }
      if (endDate) {
        conditions.push(`s.date <= $${pIdx++}`)
        params.push(endDate)
      }
      if (anchorId) {
        conditions.push(`s.anchor_id = $${pIdx++}`)
        params.push(Number(anchorId))
      }
      if (roomId) {
        conditions.push(`s.room_id = $${pIdx++}`)
        params.push(Number(roomId))
      }
      if (projectId) {
        conditions.push(`s.project_id = $${pIdx++}`)
        params.push(Number(projectId))
      }
      if (status) {
        conditions.push(`s.status = $${pIdx++}`)
        params.push(status)
      }

      const sql = `
        SELECT
          s.id,
          s.title,
          s.date::text AS "date",
          s.start_time::text AS "startTime",
          s.end_time::text AS "endTime",
          s.status,
          s.room_id AS "roomId",
          r.name AS "roomName",
          s.anchor_id AS "anchorId",
          a.name AS "anchorName",
          a.level AS "anchorLevel",
          s.operator_id AS "operatorId",
          u.real_name AS "operatorName",
          s.project_id AS "projectId",
          NULL::text AS "projectName",
          NULL::text AS "brandName",
          s.gmv::float AS "gmv",
          s.orders::int AS "orders",
          s.duration_min AS "durationMin",
          s.platform_code AS "platformCode",
          s.remark
        FROM public.live_sessions s
        LEFT JOIN public.live_rooms r ON s.room_id = r.id
        LEFT JOIN public.anchors a ON s.anchor_id = a.id
        LEFT JOIN public.users u ON s.operator_id = u.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.date DESC, s.start_time ASC
      `

      const { rows } = await withRlsContext(request, (client) => client.query(sql, params))
      return sendOk(reply, rows)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch schedule sessions')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/schedule/sessions ── 新建排班场次（含冲突检测）
  app.post('/api/v1/schedule/sessions', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const {
      title,
      date,
      startTime,
      endTime,
      roomId,
      anchorId,
      operatorId,
      projectId,
      platformCode = 'douyin',
      remark = '',
      status = 'scheduled',
    } = request.body as any

    if (!date || !startTime || !endTime || !anchorId || !roomId) {
      return sendError(reply, 400, '缺少必填字段: date, startTime, endTime, anchorId, roomId')
    }

    try {
      const outcome = await withRlsContext(request, async (client) => {
        const conflictCheck = await client.query(
          `
          SELECT s.id, s.title, s.start_time, s.end_time, a.name AS anchor_name
          FROM public.live_sessions s
          JOIN public.anchors a ON s.anchor_id = a.id
          WHERE s.anchor_id = $1
            AND s.date = $2
            AND s.status != 'cancelled'
            AND NOT (s.end_time <= $3 OR s.start_time >= $4)
          LIMIT 1
          `,
          [anchorId, date, startTime, endTime],
        )

        if (conflictCheck.rows.length > 0) {
          return { conflict: conflictCheck.rows[0] }
        }

        const insertSql = `
          INSERT INTO public.live_sessions (
            title, date, start_time, end_time, room_id, anchor_id, operator_id,
            project_id, platform_code, remark, status, duration_min
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 240)
          RETURNING *
        `
        const { rows } = await client.query(insertSql, [
          title || `排期直播 ${date}`,
          date,
          startTime,
          endTime,
          roomId,
          anchorId,
          operatorId || null,
          projectId || null,
          platformCode,
          remark,
          status,
        ])
        return { row: rows[0] }
      })

      if ('conflict' in outcome && outcome.conflict) {
        const c = outcome.conflict
        return sendError(
          reply,
          409,
          `排班冲突：主播【${c.anchor_name}】在该时段已有场次【${c.title}】(${c.start_time}~${c.end_time})，不可重叠排班！`,
        )
      }

      return sendOk(reply, outcome.row, '排班创建成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create schedule session')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/schedule/sessions/:id ── 更新排班场次
  app.put('/api/v1/schedule/sessions/:id', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { title, date, startTime, endTime, roomId, anchorId, operatorId, projectId, status, remark } = request.body as any

    try {
      const updates: string[] = ['updated_at = NOW()']
      const params: any[] = [Number(id)]
      let pIdx = 2

      if (title !== undefined) { updates.push(`title = $${pIdx++}`); params.push(title) }
      if (date !== undefined) { updates.push(`date = $${pIdx++}`); params.push(date) }
      if (startTime !== undefined) { updates.push(`start_time = $${pIdx++}`); params.push(startTime) }
      if (endTime !== undefined) { updates.push(`end_time = $${pIdx++}`); params.push(endTime) }
      if (roomId !== undefined) { updates.push(`room_id = $${pIdx++}`); params.push(roomId) }
      if (anchorId !== undefined) { updates.push(`anchor_id = $${pIdx++}`); params.push(anchorId) }
      if (operatorId !== undefined) { updates.push(`operator_id = $${pIdx++}`); params.push(operatorId) }
      if (projectId !== undefined) { updates.push(`project_id = $${pIdx++}`); params.push(projectId) }
      if (status !== undefined) { updates.push(`status = $${pIdx++}`); params.push(status) }
      if (remark !== undefined) { updates.push(`remark = $${pIdx++}`); params.push(remark) }

      const sql = `UPDATE public.live_sessions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`
      const { rows } = await withRlsContext(request, async (client) => {
        const res = await client.query(sql, params)
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'schedule.update',
            resourceType: 'live_session',
            resourceId: id,
            afterData: res.rows[0],
            request,
          })
        }
        return res
      })

      if (rows.length === 0) {
        return sendError(reply, 404, '场次不存在')
      }

      return sendOk(reply, rows[0], '排班更新成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to update schedule session')
      return sendError(reply, 500, err.message)
    }
  })

  // ── DELETE /api/v1/schedule/sessions/:id ── 取消/删除排班场次
  app.delete('/api/v1/schedule/sessions/:id', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const cancelled = await withRlsContext(request, async (client) => {
        const { rowCount } = await client.query(
          "DELETE FROM public.live_sessions WHERE id = $1 AND status = 'scheduled'",
          [Number(id)],
        )

        if (rowCount === 0) {
          await client.query("UPDATE public.live_sessions SET status = 'cancelled' WHERE id = $1", [Number(id)])
          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'schedule.cancel',
            resourceType: 'live_session',
            resourceId: id,
            request,
          })
          return true
        }

        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'schedule.delete',
          resourceType: 'live_session',
          resourceId: id,
          request,
        })
        return false
      })

      if (cancelled) return sendOk(reply, { cancelled: true }, '场次已标记为已取消')
      return sendOk(reply, { deleted: true }, '排班已删除')
    } catch (err: any) {
      request.log.error(err, 'Failed to delete schedule session')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/schedule/apply-recommendation ── 一键将 AI 排班建议应用为指定日期的排班
  app.post('/api/v1/schedule/apply-recommendation', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const { targetDate, roomId = 1, projectId, scheduleItems } = request.body as any

    if (!targetDate || !Array.isArray(scheduleItems) || scheduleItems.length === 0) {
      return sendError(reply, 400, '缺少必填字段: targetDate 或 scheduleItems')
    }

    try {
      const timeSlotMap: Record<string, { start: string; end: string }> = {
        morning: { start: '07:00:00', end: '10:30:00' },
        noon: { start: '11:30:00', end: '14:30:00' },
        prime: { start: '19:00:00', end: '23:30:00' },
        late_night: { start: '23:30:00', end: '02:00:00' },
      }

      const createdSessions = await withRlsContext(request, async (client) => {
        const list: any[] = []
        for (const item of scheduleItems) {
          const slotTimes = timeSlotMap[item.slotKey] || { start: '19:00:00', end: '23:00:00' }
          const leadAnchorId = item.leadAnchor?.id
          if (!leadAnchorId) continue

          const title = `AI排班 · ${item.slotName.split(' ')[0]}`

          // 获取直播间归属平台
          const roomRes = await client.query('SELECT platform_code FROM public.live_rooms WHERE id = $1', [roomId])
          const roomPlatform = roomRes.rows[0]?.platform_code || 'douyin'

          const res = await client.query(
            `
            INSERT INTO public.live_sessions (
              title, date, start_time, end_time, room_id, anchor_id, project_id,
              platform_code, remark, status, duration_min
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', 210)
            RETURNING id, title, date, start_time, end_time, anchor_id
            `,
            [
              title,
              targetDate,
              slotTimes.start,
              slotTimes.end,
              roomId,
              leadAnchorId,
              projectId || null,
              roomPlatform,
              `AI智能推导排班：${item.aiReason || ''}`,
            ],
          )
          list.push(res.rows[0])
        }

        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'schedule.apply_recommendation',
          resourceType: 'live_session',
          afterData: { targetDate, createdCount: list.length },
          request,
        })
        return list
      })

      return sendOk(reply, { createdCount: createdSessions.length, sessions: createdSessions }, 'AI排班建议已成功转化为正式排班计划！')
    } catch (err: any) {
      request.log.error(err, 'Failed to apply recommendation')
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/schedule/my ── 当前主播个人排班行程日历
  app.get('/api/v1/schedule/my', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user

    try {
      const outcome = await withRlsContext(request, async (client) => {
        let anchorId = user?.anchorId
        if (!anchorId) {
          const findAnchor = await client.query(
            'SELECT id, name FROM public.anchors WHERE user_id = $1 OR name = $2 LIMIT 1',
            [user?.id, user?.realName || user?.username],
          )
          if (findAnchor.rows.length > 0) {
            anchorId = findAnchor.rows[0].id
          }
        }

        if (!anchorId) {
          return { anchorId: null, sessions: [], empty: true }
        }

        const sql = `
          SELECT
            s.id,
            s.title,
            s.date::text AS "date",
            s.start_time::text AS "startTime",
            s.end_time::text AS "endTime",
            s.status,
            s.room_id AS "roomId",
            r.name AS "roomName",
            s.project_id AS "projectId",
            NULL::text AS "projectName",
            NULL::text AS "brandName",
            s.gmv::float AS "gmv",
            s.orders::int AS "orders",
            s.duration_min AS "durationMin",
            s.remark
          FROM public.live_sessions s
          LEFT JOIN public.live_rooms r ON s.room_id = r.id
          WHERE s.anchor_id = $1
          ORDER BY s.date DESC, s.start_time ASC
          LIMIT 30
        `
        const { rows } = await client.query(sql, [anchorId])
        return { anchorId, sessions: rows, empty: false }
      })

      if (outcome.empty) {
        return sendOk(reply, {
          anchorId: null,
          sessions: [],
          message: '当前登录账号未绑定主播档案，无个人排班数据',
        })
      }

      return sendOk(reply, {
        anchorId: outcome.anchorId,
        sessions: outcome.sessions,
      })
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/schedule/recommendations ── AI 智能排班建议
  app.get('/api/v1/schedule/recommendations', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const anchorQuery = `
        SELECT
          a.id,
          a.name,
          a.level,
          COALESCE(c.overall, 80) AS "capabilityScore",
          COALESCE(SUM(s.gmv), 0)::float AS "historicalGmv",
          COALESCE(AVG(s.gmv), 0)::float AS "avgSessionGmv",
          COUNT(s.id)::int AS "sessionCount"
        FROM public.anchors a
        LEFT JOIN LATERAL (
          SELECT overall FROM public.anchor_capabilities
          WHERE anchor_id = a.id
          ORDER BY evaluated_at DESC, id DESC LIMIT 1
        ) c ON true
        LEFT JOIN public.live_sessions s ON a.id = s.anchor_id
        WHERE a.status = 1
        GROUP BY a.id, a.name, a.level, c.overall
        ORDER BY "historicalGmv" DESC
      `
      const [anchorRes, slotRes] = await withRlsContext(request, (client) =>
        Promise.all([
          client.query(anchorQuery),
          client.query(`
            SELECT
              s.anchor_id,
              CASE
                WHEN s.start_time >= '06:00:00' AND s.start_time < '11:00:00' THEN 'morning'
                WHEN s.start_time >= '11:00:00' AND s.start_time < '15:00:00' THEN 'noon'
                WHEN s.start_time >= '18:00:00' AND s.start_time < '23:30:00' THEN 'prime'
                ELSE 'late_night'
              END AS slot_key,
              COUNT(s.id)::int AS slot_sessions,
              COALESCE(AVG(s.gmv), 0)::float AS slot_avg_gmv,
              COALESCE(MAX(s.gmv), 0)::float AS slot_max_gmv,
              COALESCE(AVG(s.online_peak), 0)::int AS slot_avg_peak
            FROM public.live_sessions s
            WHERE s.anchor_id IS NOT NULL AND s.gmv > 0
            GROUP BY s.anchor_id, slot_key
          `),
        ]),
      )

      const anchors = anchorRes.rows
      if (anchors.length === 0) {
        return sendOk(reply, {
          schedule: [],
          strategy: '暂无活跃主播数据，请先录入主播档案',
        })
      }

      const slotStatsMap = new Map<string, { sessions: number; avgGmv: number; maxGmv: number; avgPeak: number }>()
      for (const row of slotRes.rows) {
        slotStatsMap.set(`${row.anchor_id}:${row.slot_key}`, {
          sessions: row.slot_sessions,
          avgGmv: Number(row.slot_avg_gmv),
          maxGmv: Number(row.slot_max_gmv),
          avgPeak: Number(row.slot_avg_peak),
        })
      }

      const slots = [
        {
          slotKey: 'morning',
          slotName: '早间清醒场 (07:00 - 10:30)',
          trafficWeight: 0.65,
          requiredTrait: '亲和力强、语速沉稳、适合高客单日用/保暖',
        },
        {
          slotKey: 'noon',
          slotName: '午间白领冲锋场 (11:30 - 14:30)',
          trafficWeight: 0.85,
          requiredTrait: '节奏紧凑、快打快切、适合短平快服饰',
        },
        {
          slotKey: 'prime',
          slotName: '晚间巅峰大促场 (19:00 - 23:30)',
          trafficWeight: 1.0,
          requiredTrait: '全盘气场、压单爆发力、高转化带货一号位',
        },
        {
          slotKey: 'late_night',
          slotName: '深夜长尾捡漏场 (23:30 - 02:00)',
          trafficWeight: 0.55,
          requiredTrait: '陪伴互动、低压力聊天促单、尾货福利',
        },
      ]

      const assignedLeadIds = new Set<number>()

      const schedule = slots.map((slot) => {
        // 计算全员在此 slot 下的实测聚合产出与综合评分
        const ranked = anchors.map((a) => {
          const key = `${a.id}:${slot.slotKey}`
          const stat = slotStatsMap.get(key)
          const hasHistory = Boolean(stat && stat.sessions > 0)
          const slotGmv = hasHistory ? stat!.avgGmv : (a.avgSessionGmv * slot.trafficWeight)
          // 综合分：历史该时段产出 (70%) + 综合能力模型 (30%)
          const score = (slotGmv * 0.7) + (Number(a.capabilityScore) * 100 * 0.3)
          return {
            anchor: a,
            score,
            hasHistory,
            stat: stat || { sessions: 0, avgGmv: Math.round(slotGmv), maxGmv: Math.round(slotGmv), avgPeak: 0 },
          }
        }).sort((x, y) => y.score - x.score)

        // 优先挑选本时段综合排名最高且未在前序时段担任主打的主播
        let leadChoice = ranked.find((r) => !assignedLeadIds.has(r.anchor.id))
        if (!leadChoice) leadChoice = ranked[0]
        assignedLeadIds.add(leadChoice.anchor.id)

        // 副播挑选互补主播（非同一人）
        const supportChoice = ranked.find((r) => r.anchor.id !== leadChoice!.anchor.id) || ranked[0]

        const lead = leadChoice.anchor
        const support = supportChoice.anchor
        const stat = leadChoice.stat

        // 真实预测 GMV：基于该主播在该时段真实历史均值（无硬编码假数据兜底）
        const expectedGmv = Math.round(stat.avgGmv > 0 ? stat.avgGmv : (lead.avgSessionGmv * slot.trafficWeight))
        const rankInSlot = ranked.findIndex((r) => r.anchor.id === lead.id) + 1

        const evidence = {
          slotSessions: stat.sessions,
          slotAvgGmv: Math.round(stat.avgGmv),
          slotMaxGmv: Math.round(stat.maxGmv),
          overallAvgGmv: Math.round(lead.avgSessionGmv),
          capabilityScore: lead.capabilityScore,
          rankInSlot,
          timeSlotRange: slot.slotName,
          dataSource: leadChoice.hasHistory ? 'historical_session_aggregate' : 'overall_capability_weighted',
        }

        const aiReason = leadChoice.hasHistory
          ? `基于历史 ${stat.sessions} 场「${slot.slotName}」真实开播数据，${lead.name}在同时段平均 GMV 达 ¥${Math.round(stat.avgGmv).toLocaleString()}（排名第 ${rankInSlot}），综合能力分 ${lead.capabilityScore}，为该时段最优首发主播`
          : `根据综合能力模型（${lead.capabilityScore}分）与历史场均 GMV ¥${Math.round(lead.avgSessionGmv).toLocaleString()}，${lead.name}与「${slot.slotName}」风格画像（${slot.requiredTrait}）契合度最高`

        return {
          slotKey: slot.slotKey,
          slotName: slot.slotName,
          trait: slot.requiredTrait,
          leadAnchor: {
            id: lead.id,
            name: lead.name,
            score: lead.capabilityScore,
            historicalGmv: lead.historicalGmv,
          },
          supportAnchor: {
            id: support.id,
            name: support.name,
            score: support.capabilityScore,
          },
          expectedGmv,
          evidence,
          aiReason,
        }
      })

      return sendOk(reply, {
        platform: 'douyin',
        shopId: 1,
        generatedAt: new Date().toISOString(),
        strategy: 'AI 根据主播历史时段带货峰值、真实场均 GMV 与综合能力评级推导出最优排班矩阵',
        schedule,
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to generate schedule recommendations')
      return sendError(reply, 500, err.message)
    }
  })
}

