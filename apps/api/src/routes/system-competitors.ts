import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'

/**
 * system 域拆分（P2-1）
 *
 * 原属 routes/system.ts（1370 行上帝文件）。2026-11-17 拆出「竞品观察 + 多直播间总览」两块，
 * 降低单文件复杂度，后续按同样方式继续拆分 system/users、system/tasks 等。
 */
export async function systemCompetitorsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/system/competitors ──
  app.get('/api/v1/system/competitors', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const q = request.query as { search?: string }
      const search = q.search?.trim() || ''
      const { rows: brands } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT cb.*, COALESCE(
            (SELECT json_agg(json_build_object(
              'label', cpd.label, 'ours', cpd.ours, 'theirs', cpd.theirs
            )) FROM competitor_price_data cpd WHERE cpd.brand_id = cb.id),
            '[]'
          ) AS price_data
           FROM competitor_brands cb
          WHERE ($1 = '' OR cb.brand ILIKE '%' || $1 || '%' OR cb.industry ILIKE '%' || $1 || '%')
          ORDER BY cb.id`,
          [search],
        ),
      )
      return sendOk(reply, brands)
    } catch (err) {
      request.log.warn({ err }, 'system/competitors query failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/system/competitors ── 新增竞品观察品牌
  app.post('/api/v1/system/competitors', { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] }, async (request, reply) => {
    const body = request.body as { brand?: string; industry?: string }
    const brand = (body?.brand || '').trim()
    const industry = (body?.industry || '').trim()
    if (!brand) {
      return sendError(reply, 400, '品牌名称不能为空')
    }
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO competitor_brands (brand, industry, trend)
           VALUES ($1, $2, 'stable')
           RETURNING *`,
          [brand, industry],
        ),
      )
      return reply.code(201).send({ success: true, message: '竞品品牌已添加', data: rows[0] })
    } catch (err) {
      request.log.warn({ err }, 'system/competitors create failed')
      return sendError(reply, 500, '创建竞品品牌失败')
    }
  })

  // ── GET /api/v1/system/multi-room ──
  app.get('/api/v1/system/multi-room', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT mrs.*, lr.name AS room_name
           FROM multi_room_status mrs
           JOIN live_rooms lr ON lr.id = mrs.room_id
           ORDER BY mrs.online_users DESC`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'system/multi-room query failed')
      return sendOk(reply, [])
    }
  })
}
