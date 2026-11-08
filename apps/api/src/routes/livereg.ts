import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'

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
      // 去重检查限定在人工登记表内（不查 live_sessions，避免与系统数据混淆）
      if (body.date && body.startTime) {
        const dupRes = await pool.query(
          `SELECT id FROM live_registrations
            WHERE biz_date = $1::date
              AND COALESCE(anchor_id, 0) = COALESCE($2, 0)
              AND COALESCE(room_id, 0) = COALESCE($3, 0)
              AND start_time = $4::time
              AND status <> 'cancelled'
            LIMIT 1`,
          [body.date, body.anchorId ?? null, body.roomId ?? null, body.startTime],
        )
        if (dupRes.rows.length > 0) {
          return sendError(reply, 409, `该主播在 ${body.date} ${body.startTime} 已有登记记录（ID: ${dupRes.rows[0].id}）`)
        }
      }

      // 人工登记写入独立表 live_registrations
      // live_sessions 仅接受官方 API / 手动上传的数据，两者互不影响
      const result = await pool.query(
        `INSERT INTO live_registrations
           (biz_date, anchor_id, room_id, operator_id,
            title, start_time, end_time, duration_min, status,
            gmv, orders, buyer_count, return_amount, remark,
            registered_by, entry_source)
         VALUES ($1::date, $2, $3, $4,
                 $5, $6::time, $7::time, $8, $9,
                 $10, $11, $12, $13, $14,
                 $15, 'manual_entry')
         RETURNING id`,
        [
          body.date,
          body.anchorId ?? null,
          body.roomId ?? null,
          body.operatorId || null,
          body.title || '',
          body.startTime || null,
          body.endTime || null,
          body.duration || 0,
          'scheduled',
          body.gmv || 0,
          0,
          0,
          body.returnAmount || 0,
          body.remark || '',
          user.id,
        ]
      )
      return sendOk(reply, {
        saved: true,
        id: result.rows[0].id,
        submittedBy: user.username,
        note: '已保存到人工登记表，不影响分析数据',
      }, '保存成功')
    } catch (err) {
      request.log.warn({ err }, 'livereg/submit failed')
      return sendOk(reply, { saved: false }, '保存失败')
    }
  })
}