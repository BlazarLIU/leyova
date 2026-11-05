import { z } from 'zod'
import { registerTool } from '../registry.js'
import { query } from '../db.js'

registerTool({
  name: 'get_bi_dashboard',
  description: 'Get BI dashboard metrics: total GMV, orders, views, and trend overview.',
  inputSchema: z.object({
    date: z.string().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = ["status = 'completed'"]
    const values: unknown[] = []
    if (params.date) {
      conditions.push(`date = $1::date`)
      values.push(params.date)
    }
    const { rows } = await query(
      `SELECT
         COALESCE(SUM(gmv), 0) AS total_gmv,
         COALESCE(SUM(orders), 0) AS total_orders,
         COALESCE(SUM(views), 0) AS total_views,
         COALESCE(AVG(uv_value), 0) AS avg_uv_value,
         COALESCE(AVG(conversion_rate), 0) AS avg_conversion_rate,
         COALESCE(AVG(refund_rate), 0) AS avg_refund_rate
       FROM live_sessions
       WHERE ${conditions.join(' AND ')}`,
      values
    )
    return rows[0] ?? null
  },
})

registerTool({
  name: 'get_bi_trend',
  description: 'Get daily BI trend for GMV, orders, and views over a date range.',
  inputSchema: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    roomId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = ["status = 'completed'"]
    const values: unknown[] = []
    let idx = 1
    if (params.startDate) {
      conditions.push(`date >= $${idx++}::date`)
      values.push(params.startDate)
    }
    if (params.endDate) {
      conditions.push(`date <= $${idx++}::date`)
      values.push(params.endDate)
    }
    if (params.roomId) {
      conditions.push(`room_id = $${idx++}`)
      values.push(params.roomId)
    }
    const { rows } = await query(
      `SELECT date,
              COALESCE(SUM(gmv), 0) AS gmv,
              COALESCE(SUM(orders), 0) AS orders,
              COALESCE(SUM(views), 0) AS views,
              COALESCE(AVG(uv_value), 0) AS avg_uv_value
       FROM live_sessions
       WHERE ${conditions.join(' AND ')}
       GROUP BY date
       ORDER BY date ASC`,
      values
    )
    return rows
  },
})

registerTool({
  name: 'get_channel_roi',
  description: 'Get channel-level ROI: ad spend, GMV, ROI by traffic channel.',
  inputSchema: z.object({
    sessionId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.sessionId) {
      conditions.push(`session_id = $${idx++}`)
      values.push(params.sessionId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await query(
      `SELECT channel,
              COALESCE(SUM(views), 0) AS views,
              COALESCE(SUM(orders), 0) AS orders,
              COALESCE(SUM(gmv), 0) AS gmv,
              COALESCE(SUM(ad_spend), 0) AS ad_spend,
              COALESCE(SUM(gmv) / NULLIF(SUM(ad_spend), 0), 0) AS roi
       FROM session_channel_metrics
       ${where}
       GROUP BY channel
       ORDER BY gmv DESC`,
      values
    )
    return rows
  },
})

registerTool({
  name: 'get_bi_snapshot',
  description: 'Get a compact BI snapshot combining GMV, orders, sessions, and averages.',
  inputSchema: z.object({
    date: z.string().optional(),
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
    const { rows } = await query(
      `SELECT
         COUNT(*) AS sessions,
         COALESCE(SUM(gmv), 0) AS gmv,
         COALESCE(SUM(orders), 0) AS orders,
         COALESCE(AVG(uv_value), 0) AS uv_value,
         COALESCE(AVG(interaction_rate), 0) AS interaction_rate
       FROM live_sessions
       WHERE ${conditions.join(' AND ')}`,
      values
    )
    return rows[0] ?? null
  },
})
