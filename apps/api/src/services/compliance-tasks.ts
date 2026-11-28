/**
 * compliance-tasks.ts — 合规新规学习与整改轻量任务服务
 */

import type { Queryable } from './attribution-engine.js'

export interface ComplianceLearningTask {
  id: number
  tenantId: number
  title: string
  ruleReference: string | null
  assigneeId: number | null
  assigneeName: string | null
  dueDate: string | null
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED'
  completionNotes: string | null
  completedAt: string | null
  createdAt: string
}

export async function listComplianceLearningTasks(
  db: Queryable,
  tenantId: number,
  status?: string,
): Promise<ComplianceLearningTask[]> {
  const params: any[] = [tenantId]
  let sql = `SELECT id, tenant_id AS "tenantId", title,
                    rule_reference AS "ruleReference",
                    assignee_id AS "assigneeId", assignee_name AS "assigneeName",
                    due_date::text AS "dueDate", status,
                    completion_notes AS "completionNotes",
                    completed_at AS "completedAt",
                    created_at AS "createdAt"
               FROM public.compliance_learning_tasks
              WHERE tenant_id = $1`
  if (status && status !== 'all') {
    params.push(status)
    sql += ` AND status = $${params.length}`
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`

  const { rows } = await db.query(sql, params)
  return rows
}

export async function createComplianceLearningTask(
  db: Queryable,
  tenantId: number,
  data: {
    title: string
    ruleReference?: string
    assigneeId?: number
    assigneeName?: string
    dueDate?: string
  },
): Promise<ComplianceLearningTask> {
  const { rows } = await db.query(
    `INSERT INTO public.compliance_learning_tasks
       (tenant_id, title, rule_reference, assignee_id, assignee_name, due_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
     RETURNING id, tenant_id AS "tenantId", title,
               rule_reference AS "ruleReference",
               assignee_id AS "assigneeId", assignee_name AS "assigneeName",
               due_date::text AS "dueDate", status,
               completion_notes AS "completionNotes",
               completed_at AS "completedAt",
               created_at AS "createdAt"`,
    [
      tenantId,
      data.title,
      data.ruleReference ?? null,
      data.assigneeId ?? null,
      data.assigneeName ?? null,
      data.dueDate ?? null,
    ],
  )
  return rows[0]
}

export async function completeComplianceLearningTask(
  db: Queryable,
  tenantId: number,
  id: number,
  completionNotes?: string,
): Promise<ComplianceLearningTask | null> {
  const { rows } = await db.query(
    `UPDATE public.compliance_learning_tasks
        SET status = 'COMPLETED',
            completion_notes = $3,
            completed_at = now()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id AS "tenantId", title,
                rule_reference AS "ruleReference",
                assignee_id AS "assigneeId", assignee_name AS "assigneeName",
                due_date::text AS "dueDate", status,
                completion_notes AS "completionNotes",
                completed_at AS "completedAt",
                created_at AS "createdAt"`,
    [tenantId, id, completionNotes || '已完成学习并确认掌握'],
  )
  return rows[0] || null
}
