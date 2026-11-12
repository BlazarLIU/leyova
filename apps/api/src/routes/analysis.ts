/**
 * analysis.ts — AI 助手 HTTP 接口（P4）
 *
 * 暴露四阶编排分析能力：
 *   POST /api/v1/analysis/run        执行一次完整分析
 *   GET  /api/v1/analysis/metrics    可用指标清单（供前端展示与 LLM 提示）
 *   GET  /api/v1/analysis/dimensions 可用维度清单
 *   GET  /api/v1/analysis/runs       历史分析记录
 *   GET  /api/v1/analysis/runs/:id   单次分析详情（含每步明细）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { runAnalysis, type AnalysisMode } from '../ai/orchestrator.js'
import { resolveScope, listMetricsFromCatalog, listDimensions } from '../ai/semantic-layer.js'
import { listPlatformMetrics } from '../ai/platform-metrics.js'

export async function analysisRoutes(app: FastifyInstance) {
  // ── GET /api/v1/analysis/metrics ──
  app.get('/api/v1/analysis/metrics', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const access = { role: user.role, userType: user.userType }
    const metrics = await withRlsContext(request, (client) =>
      listMetricsFromCatalog(client, access),
    )
    return sendOk(reply, { metrics, dimensions: listDimensions() })
  })

  // ── POST /api/v1/analysis/run ──
  app.post<{
    Body: {
      question: string
      mode?: AnalysisMode
      timeRange?: { from: string; to: string }
      filters?: { platform?: string; shopId?: number; channel?: string }
      conversationId?: number
      /** 当前选中的平台，启用平台专属分析 */
      platformCode?: string
    }
  }>('/api/v1/analysis/run', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance', 'ad_buyer'])] }, async (request, reply) => {
    try {
      const body = request.body || ({} as any)
      const question = (body.question || '').trim()
      if (!question) return sendError(reply, 400, '问题不能为空')

      const user = (request as any).user
      const result = await withRlsContext(request, async (client) => {
        const scope = await resolveScope(client, user?.role)
        return runAnalysis(
          {
            question,
            mode: body.mode,
            timeRange: body.timeRange,
            filters: body.filters,
            userId: user?.id,
            conversationId: body.conversationId,
            role: user?.role,
            platformCode: body.platformCode || body.filters?.platform,
          },
          scope,
          client,
        )
      })

      // 数字溯源未通过时，明确告知前端
      const message = result.verification.passed
        ? '分析完成，所有数字均可溯源'
        : `分析完成，但 ${result.verification.unmatched.length} 个数字无法溯源，请谨慎采信`

      return sendOk(reply, result, message)
    } catch (err: any) {
      request.log.error({ err }, 'analysis run failed')
      return sendError(reply, 500, `分析失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/analysis/platform-metrics/:platform ── 平台专属指标清单
  app.get('/api/v1/analysis/platform-metrics/:platform', async (request: FastifyRequest<{
    Params: { platform: string }
  }>, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const metrics = listPlatformMetrics(request.params.platform, { role: user.role, userType: user.userType })
      return sendOk(reply, { platformCode: request.params.platform, metrics })
    } catch (err) {
      return sendError(reply, 500, '获取平台指标失败')
    }
  })

  // ── GET /api/v1/analysis/runs ──
  app.get('/api/v1/analysis/runs', async (request: FastifyRequest<{
    Querystring: { limit?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const lim = Math.min(parseInt(request.query.limit || '30', 10) || 30, 100)
      const isPrivileged = user.role === 'super_admin' || user.role === 'admin'
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          isPrivileged
            ? `SELECT id, conversation_id, mode, question, status, verdict, duration_ms, created_at
                 FROM ai_analysis_runs ORDER BY created_at DESC LIMIT $1`
            : `SELECT id, conversation_id, mode, question, status, verdict, duration_ms, created_at
                 FROM ai_analysis_runs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
          isPrivileged ? [lim] : [user.id, lim],
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取分析记录失败')
    }
  })

  // ── GET /api/v1/analysis/runs/:id ──
  app.get('/api/v1/analysis/runs/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')

      const isPrivileged = user.role === 'super_admin' || user.role === 'admin'
      const outcome = await withRlsContext(request, async (client) => {
        const run = await client.query(`SELECT * FROM ai_analysis_runs WHERE id = $1`, [id])
        if (run.rows.length === 0) return { status: 404 as const }
        if (!isPrivileged && run.rows[0].user_id !== user.id) {
          return { status: 403 as const }
        }
        const steps = await client.query(
          `SELECT seq, role, tool_name, input, output_ref, row_count, duration_ms, status, error
             FROM ai_analysis_steps WHERE run_id = $1 ORDER BY seq`,
          [id],
        )
        return { status: 200 as const, run: run.rows[0], steps: steps.rows }
      })
      if (outcome.status === 404) return sendError(reply, 404, '分析记录不存在')
      if (outcome.status === 403) return sendError(reply, 403, '无权查看他人分析详情')
      return sendOk(reply, { run: outcome.run, steps: outcome.steps })
    } catch (err) {
      return sendError(reply, 500, '获取分析详情失败')
    }
  })
}
