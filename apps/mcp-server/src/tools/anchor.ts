import { z } from 'zod'
import { registerTool } from '../registry.js'
import { query } from '../db.js'

registerTool({
  name: 'get_anchor_rank',
  description: 'Get the ranking of anchors by performance.',
  inputSchema: z.object({
    period: z.string().optional(),
    limit: z.number().int().positive().max(100).default(10),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const { rows } = await query(
      `SELECT a.name,
              COALESCE(SUM(ls.gmv), 0) AS total_gmv,
              COALESCE(SUM(ls.orders), 0) AS total_orders,
              COALESCE(AVG(ls.uv_value), 0) AS avg_uv,
              COALESCE(AVG(ls.interaction_rate), 0) AS avg_interaction
       FROM anchors a
       JOIN live_sessions ls ON ls.anchor_id = a.id AND ls.status = 'completed'
       GROUP BY a.id, a.name
       ORDER BY total_gmv DESC
       LIMIT $1`,
      [params.limit]
    )
    return rows
  },
})

registerTool({
  name: 'get_anchor_profile',
  description: 'Get anchor profile and capability overview.',
  inputSchema: z.object({
    anchorId: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const { rows } = await query(
      `SELECT a.id, a.name, a.platform, a.level, a.status,
              p.tags, p.description
       FROM anchors a
       LEFT JOIN anchor_profiles p ON p.anchor_id = a.id
       WHERE a.id = $1`,
      [params.anchorId]
    )
    return rows[0] ?? null
  },
})

registerTool({
  name: 'analyze_anchor',
  description: 'Analyze anchor performance and summarize strengths and weaknesses.',
  inputSchema: z.object({
    anchorId: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const { rows } = await query(
      `SELECT a.name,
              COALESCE(SUM(ls.gmv), 0) AS total_gmv,
              COALESCE(SUM(ls.orders), 0) AS total_orders,
              COALESCE(AVG(ls.uv_value), 0) AS avg_uv,
              COALESCE(AVG(ls.interaction_rate), 0) AS avg_interaction,
              COALESCE(AVG(ls.retention_rate), 0) AS avg_retention
       FROM anchors a
       JOIN live_sessions ls ON ls.anchor_id = a.id AND ls.status = 'completed'
       WHERE a.id = $1
       GROUP BY a.id, a.name`,
      [params.anchorId]
    )
    return rows[0] ?? null
  },
})

registerTool({
  name: 'get_anchor_kpi',
  description: 'Get anchor KPI summary for a date range or the latest period.',
  inputSchema: z.object({
    anchorId: z.number().int().positive().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = ["ls.status = 'completed'"]
    const values: unknown[] = []
    let idx = 1
    if (params.anchorId) {
      conditions.push(`ls.anchor_id = $${idx++}`)
      values.push(params.anchorId)
    }
    if (params.startDate) {
      conditions.push(`ls.date >= $${idx++}::date`)
      values.push(params.startDate)
    }
    if (params.endDate) {
      conditions.push(`ls.date <= $${idx++}::date`)
      values.push(params.endDate)
    }
    const { rows } = await query(
      `SELECT a.name AS anchor_name,
              COALESCE(SUM(ls.gmv), 0) AS gmv,
              COALESCE(SUM(ls.orders), 0) AS orders,
              COALESCE(AVG(ls.uv_value), 0) AS uv_value,
              COALESCE(AVG(ls.interaction_rate), 0) AS interaction_rate,
              COALESCE(AVG(ls.retention_rate), 0) AS retention_rate
       FROM live_sessions ls
       LEFT JOIN anchors a ON a.id = ls.anchor_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY a.name
       ORDER BY gmv DESC
       LIMIT 20`,
      values
    )
    return rows
  },
})
