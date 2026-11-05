import { z } from 'zod'
import { registerTool } from '../registry.js'
import { query } from '../db.js'

registerTool({
  name: 'create_improvement_task',
  description: 'Create an improvement task based on review findings. Requires user confirmation.',
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
  execute: async (params) => {
    const { rows } = await query(
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
    return { task: rows[0], message: `任务已创建（ID: ${rows[0].id}），等待用户确认。` }
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
  execute: async (params) => {
    const progress = params.status === 'pending' ? 0 : params.status === 'in_progress' ? 30 : 100
    const { rows } = await query(
      `UPDATE improvement_tasks
       SET status = $2, progress = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, status, progress`,
      [params.taskId, params.status, progress]
    )
    if (rows.length === 0) return { error: 'Task not found' }
    return { task: rows[0], message: `任务 #${params.taskId} 状态更新为 ${params.status}，等待确认。` }
  },
})

registerTool({
  name: 'list_pending_tasks',
  description: 'List pending and in-progress improvement tasks.',
  inputSchema: z.object({
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
    assignee: z.string().optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.status) {
      conditions.push(`status = $${idx++}`)
      values.push(params.status)
    } else {
      conditions.push(`status IN ('pending', 'in_progress')`)
    }
    if (params.assignee) {
      conditions.push(`assignee = $${idx++}`)
      values.push(params.assignee)
    }
    const { rows } = await query(
      `SELECT id, title, description, assignee, priority, status, progress, due_date, created_at
       FROM improvement_tasks
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         due_date ASC
       LIMIT $${idx}`,
      [...values, params.limit]
    )
    return rows
  },
})

registerTool({
  name: 'get_task_overview',
  description: 'Get overview statistics for improvement tasks.',
  inputSchema: z.object({}),
  riskLevel: 'read_only',
  execute: async () => {
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
         COUNT(*) FILTER (WHERE status = 'in_progress') AS progress_count,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
         COALESCE(AVG(progress), 0) AS avg_progress
       FROM improvement_tasks`,
      []
    )
    return rows[0] ?? null
  },
})
