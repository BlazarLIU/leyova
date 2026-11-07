/**
 * analysis.ts — AI 分析助手 HTTP 接口（P4）
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
import { getPool } from '../lib/db.js'
import { runAnalysis, type AnalysisMode } from '../ai/orchestrator.js'
import { resolveScope, listMetrics, listDimensions } from '../ai/semantic-layer.js'
import { listPlatformMetrics } from '../ai/platform-metrics.js'

export async function analysisRoutes(app: FastifyInstance) {
  const pool = getPool()

  // ── GET /api/v1/analysis/metrics ──
  app.get('/api/v1/analysis/metrics', async (_request, reply) => {
    return sendOk(reply, { metrics: listMetrics(), dimensions: listDimensions() })
  })

  // ── POST /api/v1/analysis/run ──
  app.post('/api/v1/analysis/run', async (request: FastifyRequest<{
    Body: {
      question: string
      mode?: AnalysisMode
      timeRange?: { from: string; to: string }
      filters?: { platform?: string; shopId?: number; channel?: string }
      conversationId?: number
      /** 当前选中的平台，启用平台专属分析 */
      platformCode?: string
    }
  }>, reply: FastifyReply) => {
    try {
      const body = request.body || ({} as any)
      const question = (body.question || '').trim()
      if (!question) return sendError(reply, 400, '问题不能为空')

      const user = (request as any).user
      const scope = await resolveScope(pool, user?.role)

      const result = await runAnalysis(
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
        pool,
      )

      // 落库每步明细，供审计与复现
      if (result.runId) {
        for (const step of result.steps) {
          await pool.query(
            `INSERT INTO ai_analysis_steps
               (run_id, seq, role, tool_name, input, output_ref, row_count, duration_ms, status, error)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              result.runId, step.seq, step.role, step.toolName,
              JSON.stringify(step.input), JSON.stringify(step.outputRef).slice(0, 100000),
              step.rowCount, step.durationMs, step.status, step.error || null,
            ],
          ).catch(() => {})
        }
        await pool.query(
          `UPDATE ai_analysis_runs SET duration_ms = $1 WHERE id = $2`,
          [result.durationMs, result.runId],
        ).catch(() => {})
      }

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
    try {
      const metrics = listPlatformMetrics(request.params.platform)
      return sendOk(reply, { platformCode: request.params.platform, metrics })
    } catch (err) {
      return sendError(reply, 500, '获取平台指标失败')
    }
  })

  // ── GET /api/v1/analysis/runs ──
  app.get('/api/v1/analysis/runs', async (request: FastifyRequest<{
    Querystring: { limit?: string }
  }>, reply: FastifyReply) => {
    try {
      const lim = Math.min(parseInt(request.query.limit || '30', 10) || 30, 100)
      const { rows } = await pool.query(
        `SELECT id, conversation_id, mode, question, status, verdict, duration_ms, created_at
           FROM ai_analysis_runs ORDER BY created_at DESC LIMIT ${lim}`,
      )
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取分析记录失败')
    }
  })

  // ── GET /api/v1/analysis/runs/:id ──
  app.get('/api/v1/analysis/runs/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')

      const run = await pool.query(`SELECT * FROM ai_analysis_runs WHERE id = $1`, [id])
      if (run.rows.length === 0) return sendError(reply, 404, '分析记录不存在')

      const steps = await pool.query(
        `SELECT seq, role, tool_name, input, output_ref, row_count, duration_ms, status, error
           FROM ai_analysis_steps WHERE run_id = $1 ORDER BY seq`,
        [id],
      )
      return sendOk(reply, { run: run.rows[0], steps: steps.rows })
    } catch (err) {
      return sendError(reply, 500, '获取分析详情失败')
    }
  })
}
