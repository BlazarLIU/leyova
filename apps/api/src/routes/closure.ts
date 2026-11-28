/**
 * closure.ts — 分析闭环 HTTP 路由（P5）
 *
 *   POST /api/v1/analysis/tasks/convert    把分析结论的行动建议转为改进任务
 *   POST /api/v1/analysis/report           生成复盘报告（Markdown）
 *   POST /api/v1/analysis/report/archive   把报告沉淀到企业知识库
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'
import {
  convertFindingsToTasks,
  convertAllActions,
  generateReviewReport,
  archiveReportToKb,
} from '../ai/closure.js'

const ANALYSIS_WRITE_ROLES = ['super_admin', 'ops_director', 'ops_staff']

export async function closureRoutes(app: FastifyInstance) {
  // ── POST /api/v1/analysis/tasks/convert ──
  app.post<{
    Body: {
      runId?: number
      sourceQuestion?: string
      assignee?: string
      priority?: 'high' | 'medium' | 'low'
      dueDate?: string
      /** 单条任务 */
      title?: string
      description?: string
      /** 或批量：直接传行动建议数组 */
      actions?: string[]
    }
  }>('/api/v1/analysis/tasks/convert', { preHandler: [requireRole(ANALYSIS_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const b = request.body || ({} as any)

      // 批量模式
      if (Array.isArray(b.actions) && b.actions.length > 0) {
        const actionsList = b.actions
        const created = await withRlsContext(request, (client) =>
          convertAllActions(
            actionsList,
            { runId: b.runId, sourceQuestion: b.sourceQuestion, assignee: b.assignee, priority: b.priority },
            client,
          ),
        )
        return sendOk(reply, { created, count: created.length }, `已创建 ${created.length} 个改进任务`)
      }

      // 单条模式
      if (!b.title) return sendError(reply, 400, '缺少任务标题（title）或行动建议数组（actions）')
      const taskTitle = b.title
      const task = await withRlsContext(request, (client) =>
        convertFindingsToTasks(
          {
            runId: b.runId,
            title: taskTitle,
            description: b.description,
            assignee: b.assignee,
            priority: b.priority,
            dueDate: b.dueDate,
            sourceQuestion: b.sourceQuestion,
          },
          client,
        ),
      )
      return sendOk(reply, task, '改进任务已创建')
    } catch (err: any) {
      request.log.error({ err }, 'convert to task failed')
      return sendError(reply, 500, `创建改进任务失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/analysis/tasks ── 查看由分析产生的任务
  app.get('/api/v1/analysis/tasks', async (request: FastifyRequest<{
    Querystring: { limit?: string; status?: string }
  }>, reply: FastifyReply) => {
    try {
      const lim = Math.min(parseInt(request.query.limit || '50', 10) || 50, 200)
      const status = request.query.status
      const params: any[] = []
      let where = `WHERE source = 'ai_analysis'`
      if (status) { where += ` AND status = $1`; params.push(status) }

      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, title, description, assignee, priority, status, progress,
                  due_date, source_id, created_at
             FROM improvement_tasks
             ${where}
            ORDER BY created_at DESC LIMIT ${lim}`,
          params,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取分析任务失败')
    }
  })

  // ── POST /api/v1/analysis/report ── 生成复盘报告
  app.post<{
    Body: {
      timeRange: { from: string; to: string }
      filters?: { platform?: string; shopId?: number }
      archiveToKb?: boolean
    }
  }>('/api/v1/analysis/report', { preHandler: [requireRole(ANALYSIS_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const b = request.body || ({} as any)
      if (!b.timeRange?.from || !b.timeRange?.to) {
        return sendError(reply, 400, '缺少时间范围 (timeRange.from / timeRange.to)')
      }

      const user = (request as any).user
      const report = await withRlsContext(request, (client) =>
        generateReviewReport(
          {
            timeRange: b.timeRange,
            filters: b.filters,
            role: user?.role,
            userId: user?.id,
          },
          client,
        ),
      )

      let archive = null
      if (b.archiveToKb) {
        archive = await archiveReportToKb(report.title, report.markdown, {
          range: `${report.range.from}~${report.range.to}`,
          runId: report.runId,
        })
      }

      return sendOk(reply, { ...report, archive }, '复盘报告已生成')
    } catch (err: any) {
      request.log.error({ err }, 'generate review report failed')
      return sendError(reply, 500, `生成复盘报告失败：${err?.message || err}`)
    }
  })

  // ── POST /api/v1/analysis/report/archive ── 单独沉淀报告
  app.post<{
    Body: { title: string; markdown: string; metadata?: Record<string, any> }
  }>('/api/v1/analysis/report/archive', { preHandler: [requireRole(ANALYSIS_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const b = request.body || ({} as any)
      if (!b.title || !b.markdown) return sendError(reply, 400, '缺少 title 或 markdown')

      const res = await archiveReportToKb(b.title, b.markdown, b.metadata || {})
      if (!res.archived) {
        // 明确告知未沉淀原因，而不是返回成功
        return sendError(reply, 409, res.reason || '知识库未配置，报告未沉淀')
      }
      return sendOk(reply, res, '报告已沉淀到知识库')
    } catch (err: any) {
      request.log.error({ err }, 'archive report failed')
      return sendError(reply, 500, `沉淀报告失败：${err?.message || err}`)
    }
  })
}
