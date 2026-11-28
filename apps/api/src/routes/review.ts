import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { computeRefundRatePct } from '../services/metrics-caliber.js'

export async function reviewRoutes(app: FastifyInstance) {
  // ── GET /api/v1/review/sessions ──
  app.get('/api/v1/review/sessions', async (request, reply) => {
    try {
      const { lsResult, importedResult } = await withRlsContext(request, async (client) => {
        // 查询 live_sessions 中的场次
        const lsRes = await client.query(
          `SELECT ls.id, ls.date, ls.title, ls.gmv, ls.views, ls.duration_min,
                  ls.status, COALESCE(a.name, '') AS anchor_name,
                  ls.room_id, NULL::date AS business_date
           FROM live_sessions ls
           LEFT JOIN anchors a ON a.id = ls.anchor_id
           WHERE ls.status = 'completed'
           ORDER BY ls.date DESC, ls.id`
        )

        // 同时查询导入的整场数据（session_live_basic_info）
        const impRes = await client.query(
          `SELECT -lb.id AS id, lb.live_date AS date,
                  r.name AS title, lb.payment_amount AS gmv,
                  ol.viewers AS views, lb.live_duration_min AS duration_min,
                  'completed' AS status, r.name AS anchor_name,
                  lb.room_id, lb.business_date
           FROM session_live_basic_info lb
           JOIN live_rooms r ON r.id = lb.room_id
           LEFT JOIN session_overview_metrics ol ON ol.room_id = lb.room_id AND ol.business_date = lb.business_date
           WHERE NOT EXISTS (
             SELECT 1 FROM live_sessions ls
             WHERE ls.room_id = lb.room_id AND ls.date = lb.business_date::date
           )
           ORDER BY lb.business_date DESC`
        )
        return { lsResult: lsRes, importedResult: impRes }
      })

      const sessions = [
        ...lsResult.rows.map(r => ({
          id: r.id,
          date: r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
          title: r.title || '',
          gmv: parseFloat(r.gmv || '0'),
          views: r.views || 0,
          duration_min: r.duration_min || 0,
          anchor_name: r.anchor_name,
          status: r.status,
          room_id: r.room_id,
          business_date: r.business_date ? new Date(r.business_date).toISOString().slice(0, 10) : null,
        })),
        ...importedResult.rows.map(r => ({
          id: r.id,
          date: r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
          title: r.title || '',
          gmv: parseFloat(r.gmv || '0'),
          views: r.views || 0,
          duration_min: r.duration_min || 0,
          anchor_name: r.anchor_name,
          status: r.status,
          room_id: r.room_id,
          business_date: r.business_date ? new Date(r.business_date).toISOString().slice(0, 10) : null,
        })),
      ]

      return sendOk(reply, sessions)
    } catch (err) {
      request.log.warn({ err }, 'review/sessions query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/live-rooms ──
  app.get('/api/v1/review/live-rooms', async (request, reply) => {
    try {
      const result = await withRlsContext(request, (client) => client.query(
        'SELECT id, name FROM live_rooms WHERE status = $1 ORDER BY name',
        ['active'],
      ))
      return sendOk(reply, result.rows)
    } catch (err) {
      request.log.warn({ err }, 'review/live-rooms query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/session-info ──
  app.get('/api/v1/review/session-info', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const roomId = q.room_id ? parseInt(q.room_id) : null
      const date = q.date || null

      if (!roomId || !date) {
        return reply.code(400).send({ success: false, message: '缺少 room_id 或 date 参数' })
      }

      const [basic, overview] = await withRlsContext(request, async (client) => {
        const b = await client.query(
          `SELECT * FROM session_live_basic_info WHERE room_id = $1 AND business_date = $2::date`,
          [roomId, date],
        )
        const o = await client.query(
          `SELECT * FROM session_overview_metrics WHERE room_id = $1 AND business_date = $2::date`,
          [roomId, date],
        )
        return [b, o]
      })

      return sendOk(reply, {
        basic_info: basic.rows[0] || null,
        overview: overview.rows[0] || null,
      })
    } catch (err) {
      request.log.warn({ err }, 'review/session-info query failed')
      return sendOk(reply, { basic_info: null, overview: null })
    }
  })

  // ── GET /api/v1/review/products ──
  app.get('/api/v1/review/products', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const roomId = q.room_id ? parseInt(q.room_id) : null
      const date = q.date || null

      if (!roomId || !date) {
        return reply.code(400).send({ success: false, message: '缺少 room_id 或 date 参数' })
      }

      const products = await withRlsContext(request, async (client) => {
        return await client.query(
          `SELECT *, COALESCE(sku_snapshot_jsonb, '[]'::jsonb) AS skus
           FROM session_plan_products
           WHERE room_id = $1 AND business_date = $2::date AND plan_id IS NULL
           ORDER BY product_order`,
          [roomId, date],
        )
      })

      return sendOk(reply, products.rows)
    } catch (err) {
      request.log.warn({ err }, 'review/products query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/short-videos ──
  app.get('/api/v1/review/short-videos', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const roomId = q.room_id ? parseInt(q.room_id) : null
      const date = q.date || null

      if (!roomId || !date) {
        return reply.code(400).send({ success: false, message: '缺少 room_id 或 date 参数' })
      }

      const result = await withRlsContext(request, (client) => client.query(
        `SELECT id, session_id, room_id, business_date, video_name, post_time,
                live_entry_impressions::int AS live_entry_impressions,
                traffic_to_live, entry_click_rate, upload_id, created_at, updated_at
         FROM session_short_video_traffic
         WHERE room_id = $1 AND business_date = $2::date
         ORDER BY live_entry_impressions DESC`,
        [roomId, date],
      ))

      return sendOk(reply, result.rows)
    } catch (err) {
      request.log.warn({ err }, 'review/short-videos query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/review/funnel-data ──
  app.get('/api/v1/review/funnel-data', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const roomId = q.room_id ? parseInt(q.room_id) : null
      const date = q.date || null

      if (!roomId || !date) {
        return reply.code(400).send({ success: false, message: '缺少 room_id 或 date 参数' })
      }

      const result = await withRlsContext(request, (client) => client.query(
        `SELECT exposure_users, enter_users, product_exposure_users,
                product_click_persons, deal_users
         FROM session_overview_metrics
         WHERE room_id = $1 AND business_date = $2::date`,
        [roomId, date],
      ))

      const row = result.rows[0]
      if (!row) {
        return sendOk(reply, { levels: [], hasImportedData: false })
      }

      // 构建漏斗层级
      const levels = [
        { name: '直播间曝光', value: row.exposure_users || 0 },
        { name: '直播间观看', value: row.enter_users || 0 },
        { name: '商品曝光', value: row.product_exposure_users || 0 },
        { name: '商品点击', value: row.product_click_persons || 0 },
        { name: '成交下单', value: row.deal_users || 0 },
      ]

      // 计算转化率和流失率
      const levelsWithRate = levels.map((level, i) => {
        const prev = i > 0 ? levels[i - 1].value : null
        const conversionRate = prev && prev > 0
          ? Number(((level.value / prev) * 100).toFixed(2))
          : null
        const dropRate = prev && prev > 0
          ? Number((((prev - level.value) / prev) * 100).toFixed(2))
          : null
        return { ...level, conversionRate, dropRate }
      })

      return sendOk(reply, { levels: levelsWithRate, hasImportedData: true })
    } catch (err) {
      request.log.warn({ err }, 'review/funnel-data query failed')
      return sendOk(reply, { levels: [], hasImportedData: false })
    }
  })

  // ── GET /api/v1/review/related-issues ── 复盘改进闭环关联问题列表
  app.get('/api/v1/review/related-issues', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, title, category, occurrence_count, created_at::text AS created_at
             FROM issue_library
            ORDER BY occurrence_count DESC, id DESC
            LIMIT 50`,
        ),
      )
      return sendOk(
        reply,
        rows.map((r: any) => ({
          id: String(r.id),
          title: r.title,
          session: '全平台复盘库',
          type: r.category || 'general',
          assignee: '运营团队',
          status: Number(r.occurrence_count || 0) >= 3 ? 'pending' : 'resolved',
          created_at: String(r.created_at).slice(0, 10),
        })),
      )
    } catch (err) {
      request.log.warn({ err }, 'review/related-issues query failed')
      return sendOk(reply, [])
    }
  })
}
