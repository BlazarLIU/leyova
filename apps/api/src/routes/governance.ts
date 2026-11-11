/**
 * governance.ts — 数据治理与数据清洗/质量校验引擎 RESTful 路由
 * 
 * 严格支持：
 * 1. 客户类型 1 (API 直连): POST /api/v1/governance/ingest/api
 * 2. 客户类型 2 (手动上传): POST /api/v1/governance/ingest/file
 * 3. 7 大平台 API 技术规范与凭证查询: GET /api/v1/governance/platforms/specs
 * 4. 批次生命周期与数据成熟度状态追踪: GET /api/v1/governance/batches, GET /api/v1/governance/batches/:id
 * 5. 独立清洗与校验任务触发: POST /api/v1/governance/batches/:id/clean, POST /api/v1/governance/batches/:id/validate
 * 6. 人工审核工作台 (四屏同显): GET /api/v1/governance/batches/:id/issues, POST /api/v1/governance/issues/:id/resolve
 * 7. 多层对账中心: POST /api/v1/governance/batches/:id/reconcile
 * 8. 原子发布闸门与反向冲正: POST /api/v1/governance/batches/:id/publish, POST /api/v1/governance/publishes/:id/reverse
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import {
  IngestionService,
  CleanerService,
  ValidationService,
  ReconciliationService,
  ReviewService,
  PublishingService,
  governancePlatformRegistry,
} from '../modules/data-governance/index.js'

export async function governanceRoutes(app: FastifyInstance) {
  const pool = getPool()
  const ingestionService = new IngestionService(pool)
  const cleanerService = new CleanerService(pool)
  const validationService = new ValidationService(pool)
  const reconciliationService = new ReconciliationService(pool)
  const reviewService = new ReviewService(pool)
  const publishingService = new PublishingService(pool)

  // ── 1. GET /api/v1/governance/platforms/specs ── 7 大主流电商平台 API 技术规范
  app.get('/api/v1/governance/platforms/specs', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const specs = governancePlatformRegistry.getAll().map((a) => ({
        platformCode: a.platformCode,
        platformName: a.platformName,
        gatewayUrl: a.gatewayUrl,
        docUrl: a.docUrl,
      }))
      return sendOk(reply, specs)
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── 2. GET /api/v1/governance/batches ── 获取导入批次列表 (成熟度状态机监控)
  app.get('/api/v1/governance/batches', async (request: FastifyRequest<{
    Querystring: { platform?: string; status?: string; limit?: string; offset?: string }
  }>, reply: FastifyReply) => {
    try {
      const { platform, status, limit = '20', offset = '0' } = request.query
      const conditions: string[] = []
      const params: any[] = []

      if (platform) {
        params.push(platform)
        conditions.push(`b.source_platform = $${params.length}`)
      }
      if (status) {
        params.push(status)
        conditions.push(`b.status = $${params.length}`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const sql = `
        SELECT b.id, b.batch_no, b.source_platform, b.store_id, b.dataset_type,
               b.source_channel, b.status, b.file_hash, b.total_raw_rows,
               b.clean_candidate_rows, b.validated_rows, b.published_rows,
               b.created_at, b.updated_at,
               s.shop_name,
               COALESCE((SELECT COUNT(*) FROM data_quality_issues i WHERE i.batch_id = b.id AND i.severity = 'P0' AND i.status = 'OPEN'), 0) as open_p0_count,
               COALESCE((SELECT COUNT(*) FROM data_quality_issues i WHERE i.batch_id = b.id AND i.severity = 'P1' AND i.status = 'OPEN'), 0) as open_p1_count
        FROM import_batches b
        LEFT JOIN dim_shop s ON s.id = b.store_id
        ${whereClause}
        ORDER BY b.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `
      params.push(parseInt(limit), parseInt(offset))
      const { rows } = await pool.query(sql, params)

      return sendOk(reply, {
        list: rows,
        limit: parseInt(limit),
        offset: parseInt(offset),
      })
    } catch (err: any) {
      request.log.error({ err }, 'Failed to list governance batches')
      return sendError(reply, 500, err.message)
    }
  })

  // ── 3. GET /api/v1/governance/batches/:id ── 批次详情
  app.get('/api/v1/governance/batches/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const batchId = parseInt(request.params.id)
      const { rows } = await pool.query(
        `SELECT b.*, s.shop_name,
                f.original_filename, f.file_size_bytes, f.sha256 as file_sha256
         FROM import_batches b
         LEFT JOIN dim_shop s ON s.id = b.store_id
         LEFT JOIN import_files f ON f.batch_id = b.id
         WHERE b.id = $1`,
        [batchId]
      )
      if (rows.length === 0) {
        return sendError(reply, 404, '批次不存在')
      }
      return sendOk(reply, rows[0])
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── 4. POST /api/v1/governance/ingest/api ── 客户类型 1: 官方 OpenAPI 同步
  app.post<{
    Body: { platformCode: string; shopId: number; datasetType?: 'orders' | 'refunds'; sinceTime?: string }
  }>('/api/v1/governance/ingest/api', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance'])] }, async (request, reply) => {
    try {
      const user = (request as any).user
      const result = await ingestionService.ingestFromApi({
        platformCode: request.body.platformCode,
        shopId: Number(request.body.shopId),
        datasetType: request.body.datasetType,
        sinceTime: request.body.sinceTime,
        userId: user?.id,
      })
      return sendOk(reply, result)
    } catch (err: any) {
      request.log.error({ err }, 'OpenAPI ingest failed')
      return sendError(reply, 500, err.message)
    }
  })

  // ── 5. POST /api/v1/governance/ingest/file ── 客户类型 2: 手动上传文件
  app.post('/api/v1/governance/ingest/file', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file()
      if (!data) {
        return sendError(reply, 400, '请选择需要上传的 Excel 或 CSV 文件')
      }

      const fileBuffer = await data.toBuffer()
      const fields = (data.fields || {}) as Record<string, any>
      const platformCode = fields.platformCode?.value || 'douyin'
      const shopId = Number(fields.shopId?.value || 1)
      const datasetType = (fields.datasetType?.value || 'orders') as 'orders' | 'refunds'
      const user = (request as any).user

      const result = await ingestionService.ingestFromFile({
        platformCode,
        shopId,
        datasetType,
        fileBuffer,
        originalFilename: data.filename,
        mimeType: data.mimetype,
        userId: user?.id,
      })

      return sendOk(reply, result)
    } catch (err: any) {
      request.log.error({ err }, 'File ingest failed')
      return sendError(reply, 500, err.message)
    }
  })

  // ── 6. POST /api/v1/governance/batches/:id/clean ── 触发清洗任务
  app.post<{
    Params: { id: string }
  }>('/api/v1/governance/batches/:id/clean', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance'])] }, async (request, reply) => {
    try {
      const batchId = parseInt(request.params.id)
      const result = await cleanerService.cleanBatch(batchId)
      return sendOk(reply, result)
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── 7. POST /api/v1/governance/batches/:id/validate ── 触发独立质量校验
  app.post<{
    Params: { id: string }
    Body?: { cleaningRunId?: number; controlTotalAmount?: number; tolerance?: number }
  }>('/api/v1/governance/batches/:id/validate', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance'])] }, async (request, reply) => {
    try {
      const batchId = parseInt(request.params.id)
      let runId = request.body?.cleaningRunId
      if (!runId) {
        const { rows } = await pool.query(
          `SELECT id FROM cleaning_runs WHERE batch_id = $1 ORDER BY id DESC LIMIT 1`,
          [batchId]
        )
        if (rows.length === 0) {
          return sendError(reply, 400, '该批次尚未执行过清洗，请先执行清洗')
        }
        runId = Number(rows[0].id)
      }

      const result = await validationService.validateCleaningRun(runId, {
        controlTotalAmount: request.body?.controlTotalAmount,
        tolerance: request.body?.tolerance,
      })
      return sendOk(reply, result)
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── 8. GET /api/v1/governance/batches/:id/issues ── 人工审核工作台 (四屏同显)
  app.get('/api/v1/governance/batches/:id/issues', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply) => {
    try {
      const batchId = parseInt(request.params.id)
      const issues = await reviewService.getBatchIssues(batchId)
      return sendOk(reply, issues)
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── 9. POST /api/v1/governance/issues/:id/resolve ── 提交人工审核决策
  app.post<{
    Params: { id: string }
    Body: { decision: 'CONFIRM_FIX' | 'REJECT' | 'OVERRIDE_ALLOW'; reason: string; fixedValues?: any }
  }>('/api/v1/governance/issues/:id/resolve', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator', 'finance'])] }, async (request, reply) => {
    try {
      const issueId = parseInt(request.params.id)
      const user = (request as any).user
      const result = await reviewService.resolveIssue({
        issueId,
        reviewerId: user.id,
        decision: request.body.decision,
        reason: request.body.reason,
        fixedValues: request.body.fixedValues,
      })
      await writeAuditLog(pool, {
        request,
        action: 'governance.issue.resolve',
        resourceType: 'data_quality_issues',
        resourceId: issueId,
        afterData: { decision: request.body.decision, reason: request.body.reason },
      })
      return sendOk(reply, result)
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── 10. POST /api/v1/governance/batches/:id/reconcile ── 多层对账中心
  app.post<{
    Params: { id: string }
    Body: { expectedRowCount?: number; expectedTotalAmount?: number; tolerance?: number }
  }>('/api/v1/governance/batches/:id/reconcile', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator', 'finance'])] }, async (request, reply) => {
    try {
      const batchId = parseInt(request.params.id)
      const results = await reconciliationService.reconcileBatch({
        batchId,
        controlTotals: {
          expectedRowCount: request.body?.expectedRowCount,
          expectedTotalAmount: request.body?.expectedTotalAmount,
          tolerance: request.body?.tolerance,
        },
      })
      return sendOk(reply, results)
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── 11. POST /api/v1/governance/batches/:id/publish ── 原子发布闸门
  app.post<{
    Params: { id: string }
    Body?: { policyVersion?: string; allowPartial?: boolean }
  }>('/api/v1/governance/batches/:id/publish', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'finance'])] }, async (request, reply) => {
    try {
      const batchId = parseInt(request.params.id)
      const user = (request as any).user
      const result = await publishingService.publishBatch({
        batchId,
        userId: user.id,
        policyVersion: request.body?.policyVersion,
        allowPartial: request.body?.allowPartial,
      })
      await writeAuditLog(pool, {
        request,
        action: 'governance.batch.publish',
        resourceType: 'import_batches',
        resourceId: batchId,
        afterData: result,
      })
      return sendOk(reply, result)
    } catch (err: any) {
      request.log.error({ err }, 'Publish gate blocked or failed')
      return sendError(reply, 400, err.message)
    }
  })

  // ── 12. POST /api/v1/governance/publishes/:id/reverse ── 撤销/反向冲正
  app.post<{
    Params: { id: string }
    Body: { reason: string }
  }>('/api/v1/governance/publishes/:id/reverse', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'finance'])] }, async (request, reply) => {
    try {
      const publishRunId = parseInt(request.params.id)
      const user = (request as any).user
      const result = await publishingService.reverseBatch(publishRunId, request.body.reason, user.id)
      await writeAuditLog(pool, {
        request,
        action: 'governance.publish.reverse',
        resourceType: 'publish_runs',
        resourceId: publishRunId,
        afterData: { reason: request.body.reason, result },
      })
      return sendOk(reply, result)
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })
}

