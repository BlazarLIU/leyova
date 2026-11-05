import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { findDuplicateSession, buildDuplicateMessage } from '../lib/livereg-dedupe.js'

export async function liveregRoutes(app: FastifyInstance) {
  // ── GET /api/v1/livereg/form-data ──
  app.get('/api/v1/livereg/form-data', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const [anchorsRes, roomsRes, usersRes] = await Promise.all([
        pool.query('SELECT id, name FROM anchors WHERE status = 1 ORDER BY name'),
        pool.query('SELECT id, name FROM live_rooms WHERE status = \'active\' ORDER BY name'),
        pool.query('SELECT id, name FROM operators WHERE status = 1 ORDER BY name'),
      ])
      const userRoomIds = user.role === 'room_specific' ? [1] : []
      return sendOk(reply, {
        anchors: anchorsRes.rows,
        rooms: roomsRes.rows,
        operators: usersRes.rows,
        userRole: user.role,
        userRoomIds,
      })
    } catch (err) {
      request.log.warn({ err }, 'livereg/form-data query failed')
      return sendOk(reply, { anchors: [], rooms: [], operators: [], userRole: user.role, userRoomIds: [] })
    }
  })

  // ── POST /api/v1/livereg/submit ──
  app.post('/api/v1/livereg/submit', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const body = request.body as {
        roomId?: number
        anchorId?: number
        operatorId?: number
        date?: string
        startTime?: string
        endTime?: string
        duration?: number
        title?: string
        gmv?: number
        returnAmount?: number
        gsv?: number
        remark?: string
        adPlatform?: string
        adType?: string
        adCost?: number
        adGsv?: number
        adStatus?: number
      }

      // 去重校验：同主播、同直播间、同一天、且开始时间相同，视为重复登记。
      // startTime 为空时跳过，status='cancelled' 的作废记录不计重复。
      const dup = await findDuplicateSession(pool, {
        date: body.date,
        roomId: body.roomId,
        anchorId: body.anchorId,
        startTime: body.startTime,
      })
      if (dup) {
        return sendError(reply, 409, buildDuplicateMessage(dup, body.date, body.startTime))
      }

      const result = await pool.query(
        `INSERT INTO live_sessions
           (room_id, anchor_id, operator_id, date, start_time, end_time,
            duration_min, title, gmv, return_amount, gsv, remark,
            ad_platform, ad_type, ad_cost, ad_gsv, ad_status, status)
         VALUES ($1, $2, $3, $4::date, $5::time, $6::time,
                 $7, $8, $9, $10, $11, $12,
                 $13, $14, $15, $16, $17, 'scheduled')
         RETURNING id`,
        [
          body.roomId, body.anchorId, body.operatorId || null,
          body.date, body.startTime, body.endTime,
          body.duration || 0, body.title || '',
          body.gmv || 0, body.returnAmount || 0, body.gsv || 0, body.remark || '',
          body.adPlatform || '', body.adType || '', body.adCost || 0, body.adGsv || 0,
          body.adStatus ?? 1,
        ]
      )
      return sendOk(reply, { saved: true, id: result.rows[0].id, submittedBy: user.username, payload: body }, '保存成功')
    } catch (err) {
      request.log.warn({ err }, 'livereg/submit failed')
      return sendOk(reply, { saved: false }, '保存失败')
    }
  })
}