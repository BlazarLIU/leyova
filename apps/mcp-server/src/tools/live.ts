import { z } from 'zod'
import { registerTool } from '../registry.js'
import { query } from '../db.js'

registerTool({
  name: 'get_live_summary',
  description: 'Get a summary of completed live sessions, GMV, orders, and overall health.',
  inputSchema: z.object({
    date: z.string().optional(),
    roomId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = ["status = 'completed'"]
    const values: unknown[] = []
    let idx = 1
    if (params.date) {
      conditions.push(`date = $${idx++}::date`)
      values.push(params.date)
    }
    if (params.roomId) {
      conditions.push(`room_id = $${idx++}`)
      values.push(params.roomId)
    }
    const { rows } = await query(
      `SELECT
         COALESCE(COUNT(*), 0) AS session_count,
         COALESCE(SUM(gmv), 0) AS total_gmv,
         COALESCE(SUM(orders), 0) AS total_orders,
         COALESCE(SUM(views), 0) AS total_views,
         COALESCE(AVG(uv_value), 0) AS avg_uv_value,
         COALESCE(AVG(interaction_rate), 0) AS avg_interaction_rate,
         COALESCE(AVG(retention_rate), 0) AS avg_retention_rate
       FROM live_sessions
       WHERE ${conditions.join(' AND ')}`,
      values
    )
    return rows[0] ?? null
  },
})

registerTool({
  name: 'get_room_health',
  description: 'Get room health metrics for a room or the current user scope.',
  inputSchema: z.object({
    roomId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = []
    const values: unknown[] = []
    if (params.roomId) {
      conditions.push(`room_id = $1`)
      values.push(params.roomId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await query(
      `SELECT * FROM room_health ${where} ORDER BY created_at DESC LIMIT 20`,
      values
    )
    return rows
  },
})

registerTool({
  name: 'get_session_metrics',
  description: 'Get detailed metrics for a specific live session.',
  inputSchema: z.object({
    sessionId: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const { rows } = await query(
      `SELECT ls.*, a.name AS anchor_name, r.name AS room_name
       FROM live_sessions ls
       LEFT JOIN anchors a ON a.id = ls.anchor_id
       LEFT JOIN live_rooms r ON r.id = ls.room_id
       WHERE ls.id = $1`,
      [params.sessionId]
    )
    return rows[0] ?? null
  },
})
