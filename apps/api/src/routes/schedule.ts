import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { effectivePlatforms } from '../lib/platform-scope.js'

// P1-B11：排班写权限补齐
//
// 审计断点：此前缺 controller（中控）/ ad_buyer（投手）/ ops_staff（运营专员）
//   → 中控和投手「改不了自己的班次」，只能找运营代改，排班流程卡在一个人身上。
// 保留 hrbp（排班管理是 HRBP 职责）、super_admin/admin（管理）、ops_director/operator（运营）。
// 中控（controller）对排班只读：需要看「今天谁播」，但不应改排班。
const SCHEDULE_WRITE_ROLES = [
  'super_admin', 'ops_director', 'ops_staff',
  'hrbp', 'ad_buyer',
]

export async function scheduleRoutes(app: FastifyInstance) {
  // ── GET /api/v1/schedule/meta ── 获取排班所需的元数据（直播间、主播、运营人员、中控、项目）
  app.get('/api/v1/schedule/meta', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const [roomsRes, anchorsRes, operatorsRes, controllersRes, projectsRes] = await withRlsContext(request, (client, scope) => {
        const eff = effectivePlatforms(undefined, scope.allowedPlatforms)
        const roomCond = eff !== null ? 'AND platform = ANY($1::text[])' : ''
        const anchorCond = eff !== null ? 'AND platform = ANY($1::text[])' : ''
        const args = eff !== null ? [eff] : []
        return Promise.all([
          client.query(`SELECT id, name, platform, status FROM public.live_rooms WHERE status = 'active' ${roomCond} ORDER BY id ASC`, args),
          client.query(`SELECT id, name, level, status FROM public.anchors WHERE status = 1 ${anchorCond} ORDER BY name ASC`, args),
          client.query("SELECT id, real_name AS name, role FROM public.users WHERE role IN ('super_admin', 'ops_director', 'ops_staff', 'controller') ORDER BY real_name ASC"),
          client.query("SELECT id, real_name AS name, role FROM public.users WHERE role IN ('controller', 'super_admin') ORDER BY real_name ASC"),
          // S3：代运营项目域已下线，返回空项目列表（保持响应契约）
          Promise.resolve({ rows: [] as unknown[] }),
        ])
      })

      return sendOk(reply, {
        rooms: roomsRes.rows,
        anchors: anchorsRes.rows,
        operators: operatorsRes.rows,
        controllers: controllersRes.rows,
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
      const data = await withRlsContext(request, async (client, scope) => {
        const conds: string[] = ['s.date BETWEEN $1::date AND $2::date']
        const params: any[] = [from, to]

        if (q.roomId) {
          params.push(Number(q.roomId))
          conds.push(`s.room_id = $${params.length}`)
        }
        const eff = effectivePlatforms(q.platform, scope.allowedPlatforms)
        if (eff !== null) {
          params.push(eff)
          conds.push(`r.platform_code = ANY($${params.length}::text[])`)
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

}

