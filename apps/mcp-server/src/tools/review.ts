import { z } from 'zod'
import { registerTool } from '../registry.js'
import { query } from '../db.js'

registerTool({
  name: 'generate_review',
  description: 'Generate a structured review draft for a completed live session, including key metrics, issues, and suggestions.',
  inputSchema: z.object({
    sessionId: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const { rows } = await query(
      `SELECT ls.id, ls.date, ls.status, ls.gmv, ls.orders, ls.views,
              ls.uv_value, ls.interaction_rate, ls.retention_rate, ls.gpm,
              ls.conversion_rate, ls.refund_rate,
              a.name AS anchor_name, a.id AS anchor_id,
              r.name AS room_name, r.id AS room_id
       FROM live_sessions ls
       LEFT JOIN anchors a ON a.id = ls.anchor_id
       LEFT JOIN live_rooms r ON r.id = ls.room_id
       WHERE ls.id = $1 AND ls.status = 'completed'`,
      [params.sessionId]
    )
    if (rows.length === 0) return { error: 'Session not found or not completed' }
    const s = rows[0]

    const { rows: channelRows } = await query(
      `SELECT sc.channel, sc.views, sc.orders, sc.gmv, sc.ad_spend,
              COALESCE(sc.gmv / NULLIF(sc.ad_spend, 0), 0) AS roi
       FROM session_channel_metrics sc
       WHERE sc.session_id = $1
       ORDER BY sc.gmv DESC`,
      [params.sessionId]
    )

    const { rows: anomalyRows } = await query(
      `SELECT severity, title, description, event_time
       FROM alert_events
       WHERE status = 'pending'
       ORDER BY event_time DESC
       LIMIT 5`
    ).catch(() => ({ rows: [] as any[] }))

    return {
      session: s,
      channels: channelRows,
      anomalies: anomalyRows,
      summary: {
        gmv: parseFloat(s.gmv),
        orders: parseInt(s.orders),
        views: parseInt(s.views),
        uvValue: parseFloat(s.uv_value),
        interactionRate: parseFloat(s.interaction_rate),
        retentionRate: parseFloat(s.retention_rate),
        gpm: parseFloat(s.gpm),
      },
    }
  },
})

registerTool({
  name: 'compare_sessions',
  description: 'Compare two completed live sessions side by side to identify differences in performance.',
  inputSchema: z.object({
    sessionIdA: z.number().int().positive(),
    sessionIdB: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const { rows } = await query(
      `SELECT ls.id, ls.date, ls.gmv, ls.orders, ls.views,
              ls.uv_value, ls.interaction_rate, ls.retention_rate, ls.gpm,
              a.name AS anchor_name
       FROM live_sessions ls
       LEFT JOIN anchors a ON a.id = ls.anchor_id
       WHERE ls.id IN ($1, $2) AND ls.status = 'completed'
       ORDER BY ls.id`,
      [params.sessionIdA, params.sessionIdB]
    )
    if (rows.length < 2) return { error: 'One or both sessions not found or not completed' }

    const [a, b] = rows
    const diffs: Record<string, { a: number; b: number; change: number; changePct: number | null }> = {}

    for (const key of ['gmv', 'orders', 'views', 'uv_value', 'interaction_rate', 'retention_rate', 'gpm']) {
      const va = parseFloat(a[key])
      const vb = parseFloat(b[key])
      const change = vb - va
      const changePct = va > 0 ? (change / va) * 100 : null
      diffs[key] = { a: va, b: vb, change, changePct }
    }

    return { sessionA: a, sessionB: b, diffs }
  },
})

registerTool({
  name: 'get_session_anomalies',
  description: 'Get anomalies and alerts for a specific live session or recent unresolved ones.',
  inputSchema: z.object({
    sessionId: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(50).default(10),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const { rows } = await query(
      `SELECT severity, title, description, event_time, status
       FROM alert_events
       WHERE status = 'pending'
       ORDER BY event_time DESC
       LIMIT $1`,
      [params.limit]
    )
    return rows
  },
})
