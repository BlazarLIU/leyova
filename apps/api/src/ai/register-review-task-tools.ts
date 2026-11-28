import { z } from 'zod'
import { registerTool } from './tool-registry.js'
import { canAccessAdSpend } from '../lib/guard.js'

// ---------------------------------------------------------------------------
// Review tools (read-only)
// ---------------------------------------------------------------------------

registerTool({
  name: 'generate_review',
  description: 'Generate a structured review draft for a completed live session, including key metrics, issues, and suggestions.',
  inputSchema: z.object({
    sessionId: z.number().int().positive(),
  }),
  riskLevel: 'read_only',
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
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

    const { rows: channelRows } = await ctx.pool.query(
      `SELECT sc.channel, sc.views, sc.orders, sc.gmv, sc.ad_spend,
              COALESCE(sc.gmv / NULLIF(sc.ad_spend, 0), 0) AS roi
       FROM session_channel_metrics sc
       WHERE sc.session_id = $1
       ORDER BY sc.gmv DESC`,
      [params.sessionId]
    )

    const { rows: anomalyRows } = await ctx.pool.query(
      `SELECT severity, title, description, event_time
       FROM alert_events
       WHERE status = 'pending'
       ORDER BY event_time DESC
       LIMIT 5`
    ).catch(() => ({ rows: [] as any[] }))

    const allowAd = canAccessAdSpend({ role: ctx.role })
    const safeChannels = allowAd
      ? channelRows
      : channelRows.map((c: any) => ({ ...c, ad_spend: null, roi: null }))

    return {
      session: s,
      channels: safeChannels,
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
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
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

// ---------------------------------------------------------------------------
// Task tools (write_with_approval)
// ---------------------------------------------------------------------------

registerTool({
  name: 'create_improvement_task',
  description: 'Create an improvement task based on review findings. The task is saved as pending and requires user confirmation before execution.',
  inputSchema: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    assignee: z.string().default('运营团队'),
    source: z.string().default('ai_review'),
    sourceId: z.string().optional(),
    dueDate: z.string().optional(),
  }),
  riskLevel: 'write_with_approval',
  requiredPermission: 'module:ai',
  execute: async (params, ctx) => {
    const { rows } = await ctx.pool.query(
      `INSERT INTO improvement_tasks
         (title, description, assignee, priority, source, source_id, due_date, status, progress)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE + 3), 'pending', 0)
       RETURNING id, title, status, created_at`,
      [
        params.title,
        params.description,
        params.assignee,
        params.priority,
        params.source,
        params.sourceId ?? null,
        params.dueDate ?? null,
      ]
    )

    const task = rows[0]

    return {
      task,
      message: `任务已创建（ID: ${task.id}），已进入待执行队列。`,
    }
  },
})

registerTool({
  name: 'update_task_status',
  description: 'Update the status of an improvement task. Requires user confirmation.',
  inputSchema: z.object({
    taskId: z.number().int().positive(),
    status: z.enum(['pending', 'in_progress', 'completed']),
  }),
  riskLevel: 'write_with_approval',
  requiredPermission: 'module:ai',
  execute: async (params, ctx) => {
    const progress = params.status === 'pending' ? 0 : params.status === 'in_progress' ? 30 : 100

    const { rows } = await ctx.pool.query(
      `UPDATE improvement_tasks
       SET status = $2, progress = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, status, progress`,
      [params.taskId, params.status, progress]
    )

    if (rows.length === 0) {
      throw new Error(`Task #${params.taskId} not found`)
    }

    const task = rows[0]

    return {
      task,
      message: `任务 #${params.taskId} 状态已更新为 ${params.status}。`,
    }
  },
})
