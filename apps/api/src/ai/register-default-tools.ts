import { z } from 'zod'
import { registerTool } from './tool-registry.js'
import { queryBusinessLiveSummary, formatBusinessLiveSummary } from './business-data.js'

// Read-only BI / anchor / live tools for OpenClaw planning.

registerTool({
  name: 'get_live_summary',
  description: 'Get a summary of business live sessions; excludes live management grouping data.',
  inputSchema: z.object({
    date: z.string().optional(),
    roomId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const summary = await queryBusinessLiveSummary(ctx.pool, { date: params.date, roomId: params.roomId })
    return summary ? formatBusinessLiveSummary(summary) : '当前没有可用的业务直播数据。'
  },
})

registerTool({
  name: 'get_room_health',
  description: 'Get room health metrics for a room or the current user scope.',
  inputSchema: z.object({
    roomId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const roomId = params.roomId ?? ctx.scope.roomScope[0]
    if (!roomId) return { rows: [] }
    const { rows } = await ctx.pool.query(
      `SELECT *
       FROM room_health
       WHERE room_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [roomId]
    )
    return rows
  },
})

registerTool({
  name: 'get_anchor_rank',
  description: 'Get the ranking of anchors by performance.',
  inputSchema: z.object({
    period: z.string().optional(),
    limit: z.number().int().positive().max(100).default(10),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
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
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
      `SELECT a.id, a.name, a.platform, a.level, a.status,
              p.tags, p.followers, p.join_date
       FROM anchors a
       LEFT JOIN anchor_profiles p ON p.id = a.id
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
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
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
  name: 'get_bi_dashboard',
  description: 'Get BI dashboard metrics such as GMV, orders, refund and trend overview.',
  inputSchema: z.object({
    date: z.string().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
      `SELECT
         COALESCE(SUM(gmv), 0) AS total_gmv,
         COALESCE(SUM(orders), 0) AS total_orders,
         COALESCE(SUM(views), 0) AS total_views
       FROM live_sessions
       WHERE status = 'completed'`,
      []
    )
    return rows[0] ?? null
  },
})
