import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'

export async function personnelRoutes(app: FastifyInstance) {
  // ── GET /api/v1/personnel/anchors ──
  app.get('/api/v1/personnel/anchors', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) => client.query(
        `SELECT a.id, a.name, a.level, a.status, COALESCE(ap.phone, '') AS phone,
                COALESCE(ap.email, '') AS email, a.created_at AS "createdAt"
         FROM anchors a
         LEFT JOIN anchor_profiles ap ON ap.id = a.id
         WHERE a.status = 1
         ORDER BY a.id`
      ))
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'personnel/anchors query failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/personnel/anchors ──
  app.post('/api/v1/personnel/anchors', { preHandler: [requireRole(['super_admin', 'admin', 'hrbp', 'ops_director'])] }, async (request, reply) => {
    try {
      const body = request.body as { name?: string; level?: string; status?: number }
      const { rows } = await withRlsContext(request, (client) => client.query(
        `INSERT INTO anchors (name, level, status)
         VALUES ($1, $2, $3) RETURNING id, name, level, status, created_at`,
        [body.name || '新主播', body.level || 'B', body.status ?? 1]
      ))
      if (rows.length === 0) return sendOk(reply, { error: '创建失败' })
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'personnel/anchors create failed')
      return sendOk(reply, { error: '创建失败' })
    }
  })

  // ── DELETE /api/v1/personnel/anchors/:id ──
  // 软删除：仅标记 status=0，保留历史出勤数据
  app.delete('/api/v1/personnel/anchors/:id', { preHandler: [requireRole(['super_admin', 'admin', 'hrbp', 'ops_director'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await withRlsContext(request, (client) => client.query(
        'UPDATE anchors SET status = 0 WHERE id = $1',
        [parseInt(id)]
      ))
      return sendOk(reply, { deleted: (result.rowCount ?? 0) > 0 })
    } catch (err) {
      request.log.warn({ err }, 'personnel/anchors delete failed')
      return sendOk(reply, { deleted: false })
    }
  })

  // ── GET /api/v1/personnel/operators ──
  app.get('/api/v1/personnel/operators', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) => client.query(
        `SELECT id, name, employee_id AS "employeeId", status, created_at AS "createdAt"
         FROM operators WHERE status = 1 ORDER BY id`
      ))
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'personnel/operators query failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/personnel/operators ──
  app.post('/api/v1/personnel/operators', { preHandler: [requireRole(['super_admin', 'admin', 'hrbp', 'ops_director'])] }, async (request, reply) => {
    try {
      const body = request.body as { name?: string; employeeId?: string; status?: number }
      const { rows } = await withRlsContext(request, (client) => client.query(
        `INSERT INTO operators (name, employee_id, status)\n         VALUES ($1, $2, $3) RETURNING id, name, employee_id AS \"employeeId\", status, created_at AS \"createdAt\"`,
        [body.name || '新中控', body.employeeId || '', body.status ?? 1]
      ))
      if (rows.length === 0) return sendOk(reply, { error: '创建失败' })
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'personnel/operators create failed')
      return sendOk(reply, { error: '创建失败' })
    }
  })

  // ── PUT /api/v1/personnel/anchors/:id ──
  app.put('/api/v1/personnel/anchors/:id', { preHandler: [requireRole(['super_admin', 'admin', 'hrbp', 'ops_director'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { name?: string; level?: string; status?: number }
      await withRlsContext(request, (client) => client.query(
        `UPDATE anchors SET name = COALESCE($1, name), level = COALESCE($2, level), status = COALESCE($3, status) WHERE id = $4`,
        [body.name, body.level, body.status ?? null, parseInt(id)]
      ))
      return sendOk(reply, { updated: true })
    } catch (err) {
      request.log.warn({ err }, 'personnel/anchors update failed')
      return sendOk(reply, { updated: false })
    }
  })

  // ── DELETE /api/v1/personnel/operators/:id ──
  // 软删除：仅标记 status=0，保留历史出勤数据
  app.delete('/api/v1/personnel/operators/:id', { preHandler: [requireRole(['super_admin', 'admin', 'hrbp', 'ops_director'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await withRlsContext(request, (client) => client.query(
        'UPDATE operators SET status = 0 WHERE id = $1',
        [parseInt(id)]
      ))
      return sendOk(reply, { deleted: (result.rowCount ?? 0) > 0 })
    } catch (err) {
      request.log.warn({ err }, 'personnel/operators delete failed')
      return sendOk(reply, { deleted: false })
    }
  })

  // ── PUT /api/v1/personnel/operators/:id ──
  app.put('/api/v1/personnel/operators/:id', { preHandler: [requireRole(['super_admin', 'admin', 'hrbp', 'ops_director'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as { name?: string; employeeId?: string; status?: number }
      await withRlsContext(request, (client) => client.query(
        `UPDATE operators SET name = COALESCE($1, name), employee_id = COALESCE($2, employee_id), status = COALESCE($3, status) WHERE id = $4`,
        [body.name, body.employeeId, body.status ?? null, parseInt(id)]
      ))
      return sendOk(reply, { updated: true })
    } catch (err) {
      request.log.warn({ err }, 'personnel/operators update failed')
      return sendOk(reply, { updated: false })
    }
  })

  // ── GET /api/v1/personnel/managers ── (from users with role=manager)
  app.get('/api/v1/personnel/managers', { preHandler: [requireRole(['super_admin', 'admin', 'hrbp', 'ops_director'])] }, async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) => client.query(
        `SELECT id, username, real_name AS "realName", status, created_at AS "createdAt"
         FROM users WHERE role IN ('admin', 'manager') AND status = 1 ORDER BY id`
      ))
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'personnel/managers query failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/personnel/managers ──
  app.post('/api/v1/personnel/managers', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const body = request.body as { username?: string; realName?: string; status?: number }
      const { env } = await import('../config/env.js')
      if (!env.DEFAULT_USER_PASSWORD) {
        return sendOk(reply, { error: '未配置默认密码（DEFAULT_USER_PASSWORD），无法创建账号' })
      }
      const hash = bcrypt.hashSync(env.DEFAULT_USER_PASSWORD, 10)
      const { rows } = await withRlsContext(request, (client) => client.query(
        `INSERT INTO users (username, password_hash, real_name, role, status)\n         VALUES ($1, $2, $3, 'ops_staff', $4) RETURNING id, username, real_name AS \"realName\", status, created_at AS \"createdAt\"`,
        [body.username || 'new_ops', hash, body.realName || '新运营', body.status ?? 1]
      ))
      if (rows.length === 0) return sendOk(reply, { error: '创建失败' })
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'personnel/managers create failed')
      return sendOk(reply, { error: '创建失败' })
    }
  })

  // ── DELETE /api/v1/personnel/managers/:id ──
  app.delete('/api/v1/personnel/managers/:id', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await withRlsContext(request, (client) => client.query(
        `DELETE FROM users WHERE id = $1 AND role IN ('admin', 'manager')`,
        [parseInt(id)]
      ))
      return sendOk(reply, { deleted: (result.rowCount ?? 0) > 0 })
    } catch (err) {
      request.log.warn({ err }, 'personnel/managers delete failed')
      return sendOk(reply, { deleted: false })
    }
  })

  // ── GET /api/v1/attendance ── (frontend: /attendance?year=&month=)
  app.get('/api/v1/attendance', async (request, reply) => {
    try {
      const query = request.query as { year?: string; month?: string }
      const now = new Date()
      const year = parseInt(query.year || String(now.getFullYear()))
      const month = parseInt(query.month || String(now.getMonth() + 1))

      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

      // Sessions for the selected month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

      const { anchorsRes, operatorsRes, sessionsRes } = await withRlsContext(request, async (client) => {
        // Get all anchors（包括已离职的，确保历史数据仍可显示）
        const aRes = await client.query('SELECT id, name FROM anchors ORDER BY name')
        // Get all operators（包括已离职的，确保历史数据仍可显示）
        const oRes = await client.query('SELECT id, name FROM operators ORDER BY name')

        // 个人达成数据来源：人工登记表（独立模块）
        // 字段映射：biz_date → date, return_amount → return_amount,
        //           gsv 无对应（人工登记不记 gsv），用 0 占位保持下游逻辑不变
        const sRes = await client.query(
          `SELECT s.id, s.anchor_id, s.operator_id, s.biz_date::text AS date,
                  s.duration_min, s.start_time::text, s.gmv,
                  0::numeric AS gsv, s.return_amount
           FROM live_registrations s
           WHERE s.biz_date >= $1::date AND s.biz_date <= $2::date
             AND s.status <> 'cancelled'
           ORDER BY s.biz_date`,
          [startDate, endDate]
        )
        return { anchorsRes: aRes, operatorsRes: oRes, sessionsRes: sRes }
      })

      // Build attendance data map
      const attendanceData: Record<string, Record<string, { duration: number; count: number; nightShift: boolean }>> = {}
      const anchorStatsMap: Record<number, { totalDuration: number; totalGmv: number; totalGsv: number; totalReturn: number; nightShiftCount: number; sessionDays: Set<string> }> = {}
      const operatorStatsMap: Record<number, { totalGmv: number; totalGsv: number; nightShiftCount: number; sessionDays: Set<string> }> = {}

      // Initialize
      for (const a of anchorsRes.rows) {
        attendanceData[`anchor_${a.id}`] = {}
        anchorStatsMap[a.id] = { totalDuration: 0, totalGmv: 0, totalGsv: 0, totalReturn: 0, nightShiftCount: 0, sessionDays: new Set() }
      }
      for (const o of operatorsRes.rows) {
        attendanceData[`operator_${o.id}`] = {}
        operatorStatsMap[o.id] = { totalGmv: 0, totalGsv: 0, nightShiftCount: 0, sessionDays: new Set() }
      }

      // Process each session
      for (const s of sessionsRes.rows) {
        const dateStr = String(s.date).substring(0, 10)
        const isNight = s.start_time && String(s.start_time) >= '18:00'

        // Anchor side
        if (s.anchor_id) {
          const key = `anchor_${s.anchor_id}`
          if (!attendanceData[key]) attendanceData[key] = {}
          if (!attendanceData[key][dateStr]) {
            attendanceData[key][dateStr] = { duration: 0, count: 0, nightShift: false }
          }
          attendanceData[key][dateStr].duration += s.duration_min || 0
          attendanceData[key][dateStr].count += 1
          if (isNight) attendanceData[key][dateStr].nightShift = true

          if (!anchorStatsMap[s.anchor_id]) {
            anchorStatsMap[s.anchor_id] = { totalDuration: 0, totalGmv: 0, totalGsv: 0, totalReturn: 0, nightShiftCount: 0, sessionDays: new Set() }
          }
          anchorStatsMap[s.anchor_id].totalDuration += s.duration_min || 0
          anchorStatsMap[s.anchor_id].totalGmv += Number(s.gmv) || 0
          anchorStatsMap[s.anchor_id].totalGsv += Number(s.gsv) || 0
          anchorStatsMap[s.anchor_id].totalReturn += Number(s.return_amount) || 0
          if (isNight) anchorStatsMap[s.anchor_id].nightShiftCount += 1
          anchorStatsMap[s.anchor_id].sessionDays.add(dateStr)
        }

        // Operator side
        if (s.operator_id) {
          const key = `operator_${s.operator_id}`
          if (!attendanceData[key]) attendanceData[key] = {}
          if (!attendanceData[key][dateStr]) {
            attendanceData[key][dateStr] = { duration: 0, count: 0, nightShift: false }
          }
          attendanceData[key][dateStr].duration += s.duration_min || 0
          attendanceData[key][dateStr].count += 1
          if (isNight) attendanceData[key][dateStr].nightShift = true

          if (!operatorStatsMap[s.operator_id]) {
            operatorStatsMap[s.operator_id] = { totalGmv: 0, totalGsv: 0, nightShiftCount: 0, sessionDays: new Set() }
          }
          operatorStatsMap[s.operator_id].totalGmv += Number(s.gmv) || 0
          operatorStatsMap[s.operator_id].totalGsv += Number(s.gsv) || 0
          if (isNight) operatorStatsMap[s.operator_id].nightShiftCount += 1
          operatorStatsMap[s.operator_id].sessionDays.add(dateStr)
        }
      }

      // Build dates array
      const daysInMonth = new Date(year, month, 0).getDate()
      const dates = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const weekdayIdx = new Date(year, month - 1, day).getDay()
        return {
          date: dateStr,
          day,
          weekday: weekdays[weekdayIdx],
          isWeekend: weekdayIdx === 0 || weekdayIdx === 6,
        }
      })

      // Build anchor stats（仅包含当月有数据的人员）
      const anchorStats = anchorsRes.rows
        .filter((a: any) => anchorStatsMap[a.id] && anchorStatsMap[a.id].sessionDays.size > 0)
        .map((a: any) => {
          const stats = anchorStatsMap[a.id]
          const daysCount = stats.sessionDays.size || 1
          return {
            id: a.id,
            name: a.name,
            totalDuration: stats.totalDuration,
            totalGmv: stats.totalGmv,
            totalGsv: stats.totalGsv,
            avgGsv: stats.totalGsv / daysCount,
            totalReturn: stats.totalReturn,
            nightShiftCount: stats.nightShiftCount,
          }
        })
        // 按总GSV从高到低排序
        .sort((x: any, y: any) => y.totalGsv - x.totalGsv)

      // Build operator stats（仅包含当月有数据的人员）
      const operatorStats = operatorsRes.rows
        .filter((o: any) => operatorStatsMap[o.id] && operatorStatsMap[o.id].sessionDays.size > 0)
        .map((o: any) => {
          const stats = operatorStatsMap[o.id]
          const daysCount = stats.sessionDays.size || 1
          return {
            id: o.id,
            name: o.name,
            streamCount: stats.sessionDays.size,
            totalGmv: stats.totalGmv,
            totalGsv: stats.totalGsv,
            avgGsv: stats.totalGsv / daysCount,
            nightShiftCount: stats.nightShiftCount,
          }
        })
        // 按总GSV从高到低排序
        .sort((x: any, y: any) => y.totalGsv - x.totalGsv)

      return sendOk(reply, {
        year,
        month,
        daysInMonth,
        dates,
        anchors: anchorsRes.rows.map((a: any) => ({ id: a.id, name: a.name, role: 'anchor' as const, status: 1 })),
        operators: operatorsRes.rows.map((o: any) => ({ id: o.id, name: o.name, role: 'operator' as const, status: 1 })),
        attendanceData,
        anchorStats,
        operatorStats,
      })
    } catch (err) {
      request.log.warn({ err }, 'attendance query failed')
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth() + 1
      const dim = new Date(y, m, 0).getDate()
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const dates = Array.from({ length: dim }, (_, i) => {
        const day = i + 1
        const weekdayIdx = new Date(y, m - 1, day).getDay()
        return { date: `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`, day, weekday: weekdays[weekdayIdx], isWeekend: weekdayIdx === 0 || weekdayIdx === 6 }
      })
      return sendOk(reply, { year: y, month: m, daysInMonth: dim, dates, anchors: [], operators: [], attendanceData: {}, anchorStats: [], operatorStats: [] })
    }
  })
}