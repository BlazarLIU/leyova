import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { SqlQualityGateEngine } from '../modules/data-governance/index.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'

/**
 * governance 域拆分（P2-1）：主体映射与字段映射规则 CRUD
 * 原属 routes/governance.ts，2026-11-17 拆出。
 */
export async function governanceMappingRoutes(app: FastifyInstance) {
  // ── 13. entity_aliases 跨平台商品/主播/达人主体映射 CRUD ──
  app.get<{
    Querystring: { entityType?: string; platform?: string }
  }>('/api/v1/governance/entity-aliases', { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityType, platform } = request.query || {}
    const params: any[] = []
    const conds: string[] = []
    if (entityType) {
      params.push(entityType)
      conds.push(`ea.entity_type = $${params.length}`)
    }
    if (platform) {
      params.push(platform)
      conds.push(`ea.source_platform = $${params.length}`)
    }
    const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
    const { rows } = await withRlsContext(request, (client) => client.query(
      `SELECT ea.*, p.platform_name, u.real_name AS approved_by_name
       FROM public.entity_aliases ea
       LEFT JOIN public.system_platform_configs p ON p.platform_code = ea.source_platform
       LEFT JOIN public.users u ON u.id = ea.approved_by
       ${whereSql}
       ORDER BY ea.id DESC LIMIT 200`,
      params,
    ))
    return sendOk(reply, rows)
  })

  app.post<{
    Body: {
      entityType: string
      sourcePlatform: string
      externalId: string
      externalName?: string
      internalId: number
      internalCode?: string
      validFrom?: string
      validTo?: string
    }
  }>('/api/v1/governance/entity-aliases', {
    preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator'])],
  }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.entityType || !b.sourcePlatform || !b.externalId || !b.internalId) {
      return sendError(reply, 400, '缺少必要参数 (entityType, sourcePlatform, externalId, internalId)')
    }
    const actor = (request as any).user
    const { rows } = await withRlsContext(request, async (client) => {
      const res = await client.query(
        `INSERT INTO public.entity_aliases
           (entity_type, source_platform, external_id, external_name, internal_id, internal_code, valid_from, valid_to, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, '2020-01-01'::date), COALESCE($8::date, '2099-12-31'::date), $9)
         ON CONFLICT (entity_type, source_platform, external_id, valid_from) DO UPDATE SET
           external_name = EXCLUDED.external_name,
           internal_id = EXCLUDED.internal_id,
           internal_code = EXCLUDED.internal_code,
           valid_to = EXCLUDED.valid_to,
           approved_by = EXCLUDED.approved_by
         RETURNING *`,
        [
          b.entityType.trim(),
          b.sourcePlatform.trim(),
          b.externalId.trim(),
          b.externalName || '',
          Number(b.internalId),
          b.internalCode || '',
          b.validFrom || null,
          b.validTo || null,
          actor?.id || null,
        ],
      )
      await writeAuditLog(client, {
        request,
        action: 'governance.entity_alias.upsert',
        resourceType: 'entity_aliases',
        resourceId: res.rows[0].id,
        afterData: res.rows[0],
      })
      return res
    })
    return sendOk(reply, rows[0], '实体别名映射已保存')
  })

  app.delete<{ Params: { id: string } }>('/api/v1/governance/entity-aliases/:id', {
    preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])],
  }, async (request, reply) => {
    const id = Number(request.params.id)
    if (!Number.isInteger(id) || id <= 0) return sendError(reply, 400, '无效 ID')
    const found = await withRlsContext(request, async (client) => {
      const before = await client.query('SELECT * FROM public.entity_aliases WHERE id = $1', [id])
      if (before.rows.length === 0) return false
      await client.query('DELETE FROM public.entity_aliases WHERE id = $1', [id])
      await writeAuditLog(client, {
        request,
        action: 'governance.entity_alias.delete',
        resourceType: 'entity_aliases',
        resourceId: id,
        beforeData: before.rows[0],
      })
      return true
    })
    if (!found) return sendError(reply, 404, '映射记录不存在')
    return sendOk(reply, { deleted: true, id })
  })

  // ── 14. field_mapping_rules 可配置字段映射规则 CRUD ──
  app.get<{
    Querystring: { platform?: string; datasetType?: string }
  }>('/api/v1/governance/field-mappings', { preHandler: [requireAuth] }, async (request, reply) => {
    const { platform, datasetType } = request.query || {}
    const params: any[] = []
    const conds: string[] = []
    if (platform) {
      params.push(platform)
      conds.push(`source_platform = $${params.length}`)
    }
    if (datasetType) {
      params.push(datasetType)
      conds.push(`dataset_type = $${params.length}`)
    }
    const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
    const { rows } = await withRlsContext(request, (client) => client.query(
      `SELECT * FROM public.field_mapping_rules ${whereSql} ORDER BY source_platform, dataset_type, version DESC, id ASC`,
      params,
    ))
    return sendOk(reply, rows)
  })

  app.post<{
    Body: {
      mappingCode: string
      version?: number
      sourcePlatform: string
      datasetType: string
      sourceField: string
      canonicalField: string
      transform?: string
      required?: boolean
      approvalStatus?: string
    }
  }>('/api/v1/governance/field-mappings', {
    preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])],
  }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.mappingCode || !b.sourcePlatform || !b.datasetType || !b.sourceField || !b.canonicalField) {
      return sendError(reply, 400, '缺少必要参数')
    }
    const { rows } = await withRlsContext(request, async (client) => {
      const res = await client.query(
        `INSERT INTO public.field_mapping_rules
           (mapping_code, version, source_platform, dataset_type, source_field, canonical_field, transform, required, approval_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (source_platform, dataset_type, mapping_code, version, source_field) DO UPDATE SET
           canonical_field = EXCLUDED.canonical_field,
           transform = EXCLUDED.transform,
           required = EXCLUDED.required,
           approval_status = EXCLUDED.approval_status
         RETURNING *`,
        [
          b.mappingCode.trim(),
          Number(b.version || 1),
          b.sourcePlatform.trim(),
          b.datasetType.trim(),
          b.sourceField.trim(),
          b.canonicalField.trim(),
          b.transform || 'identity',
          Boolean(b.required),
          b.approvalStatus || 'approved',
        ],
      )
      await writeAuditLog(client, {
        request,
        action: 'governance.field_mapping.upsert',
        resourceType: 'field_mapping_rules',
        resourceId: res.rows[0].id,
        afterData: res.rows[0],
      })
      return res
    })
    return sendOk(reply, rows[0], '字段映射规则已保存')
  })

  // ═══════════════════════════════════════════════════════════════════
  // ── Master Plan §8.3 & §8.6: 八条 SQL 质量门禁与隔离区机制
  // ═══════════════════════════════════════════════════════════════════

  // ── POST /api/v1/governance/batches/:id/run-quality-gates ── 执行 8 条 SQL 质量门禁断言
  app.post<{ Params: { id: string } }>('/api/v1/governance/batches/:id/run-quality-gates', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const batchId = Number(request.params.id)
    if (!batchId) return sendError(reply, 400, '无效的批次 ID')

    try {
      const report = await withRlsContext(request, async (client) => {
        return await SqlQualityGateEngine.evaluateBatch(client, batchId)
      })
      return sendOk(reply, report)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to evaluate SQL quality gates')
      return sendError(reply, 500, err?.message || '执行 SQL 质量门禁失败')
    }
  })

  // ── GET /api/v1/governance/batches/:id/quarantine ── 查询批次隔离区异常数据
  app.get<{
    Params: { id: string }
    Querystring: { status?: string; ruleCode?: string; limit?: string; offset?: string }
  }>('/api/v1/governance/batches/:id/quarantine', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const batchId = Number(request.params.id)
    const { status, ruleCode, limit = '20', offset = '0' } = request.query || {}

    try {
      const result = await withRlsContext(request, async (client) => {
        const params: any[] = [batchId]
        const conds: string[] = ['batch_id = $1']

        if (status) {
          params.push(status)
          conds.push(`status = $${params.length}`)
        }
        if (ruleCode) {
          params.push(ruleCode)
          conds.push(`rule_code = $${params.length}`)
        }

        const countRes = await client.query(
          `SELECT COUNT(*)::int AS total FROM public.dq_quarantine WHERE ${conds.join(' AND ')}`,
          params,
        )

        const take = Math.min(Number(limit) || 20, 100)
        const skip = Math.max(Number(offset) || 0, 0)
        params.push(take, skip)

        const listRes = await client.query(
          `SELECT id, batch_id, row_num, rule_code, severity, raw_payload,
                  failure_reason, status, resolved_by, resolved_at, created_at
           FROM public.dq_quarantine
           WHERE ${conds.join(' AND ')}
           ORDER BY id DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        )

        return {
          total: Number(countRes.rows[0]?.total || 0),
          items: listRes.rows.map((r) => ({
            id: Number(r.id),
            batchId: Number(r.batch_id),
            rowNum: Number(r.row_num),
            ruleCode: r.rule_code,
            severity: r.severity,
            rawPayload: r.raw_payload,
            failureReason: r.failure_reason,
            status: r.status,
            resolvedBy: r.resolved_by,
            resolvedAt: r.resolved_at,
            createdAt: r.created_at,
          })),
        }
      })

      return sendOk(reply, result)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch quarantine list')
      return sendError(reply, 500, '获取质量隔离区数据失败')
    }
  })

  // ── POST /api/v1/governance/batches/:id/quarantine ── 人工或规则写入隔离区
  app.post<{
    Params: { id: string }
    Body: {
      rowNum: number
      ruleCode: string
      severity?: 'warning' | 'error' | 'fatal'
      rawPayload?: Record<string, any>
      failureReason: string
    }
  }>('/api/v1/governance/batches/:id/quarantine', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
    const batchId = Number(request.params.id)
    const b = request.body
    if (!batchId || !b?.ruleCode || !b?.failureReason) {
      return sendError(reply, 400, '必须提供批次 ID、门禁规则码与拦截原因')
    }

    try {
      const row = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `INSERT INTO public.dq_quarantine (
             batch_id, row_num, rule_code, severity, raw_payload, failure_reason, status
           ) VALUES (
             $1, $2, $3, $4, $5::jsonb, $6, 'quarantined'
           ) RETURNING *`,
          [
            batchId,
            Number(b.rowNum) || 0,
            b.ruleCode,
            b.severity || 'error',
            JSON.stringify(b.rawPayload || {}),
            b.failureReason,
          ],
        )
        return res.rows[0]
      })
      return sendOk(reply, row)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to insert quarantine item')
      return sendError(reply, 500, err?.message || '写入隔离区失败')
    }
  })

  // ── PUT /api/v1/governance/quarantine/:id/status ── 处置隔离区异常行 (解决/忽略)
  app.put<{
    Params: { id: string }
    Body: { status: 'quarantined' | 'resolved' | 'ignored'; remark?: string }
  }>('/api/v1/governance/quarantine/:id/status', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] }, async (request, reply) => {
    const id = Number(request.params.id)
    const b = request.body
    if (!id || !b?.status) return sendError(reply, 400, '必须提供隔离记录 ID 与目标状态')

    const user = (request as any).user

    try {
      const row = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE public.dq_quarantine
           SET status = $1,
               resolved_by = $2,
               resolved_at = now()
           WHERE id = $3
           RETURNING *`,
          [b.status, user?.name || user?.username || 'admin', id],
        )
        return res.rows[0]
      })
      if (!row) return sendError(reply, 404, '隔离记录不存在')
      return sendOk(reply, row)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to update quarantine status')
      return sendError(reply, 500, err?.message || '更新隔离状态失败')
    }
  })

  // ── POST /api/v1/governance/batches/:id/staging-load ── 集合式高速导入暂存表并校验去重哨兵
  app.post<{
    Params: { id: string }
    Body: {
      rows: Array<{
        sourceOrderId: string
        sourceSubOrderId?: string
        orderStatus: string
        paidAmount: number
        orderDate: string
        rawJson?: Record<string, any>
      }>
    }
  }>('/api/v1/governance/batches/:id/staging-load', { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator'])] }, async (request, reply) => {
    const batchId = Number(request.params.id)
    const b = request.body
    if (!batchId || !Array.isArray(b?.rows) || b.rows.length === 0) {
      return sendError(reply, 400, '必须提供批次 ID 与非空导入数据行集合 rows')
    }

    try {
      const summary = await withRlsContext(request, async (client) => {
        const batchRes = await client.query(
          `SELECT id, source_platform, store_id FROM public.import_batches WHERE id = $1`,
          [batchId],
        )
        if (batchRes.rows.length === 0) throw new Error('批次不存在')
        const batch = batchRes.rows[0]

        let loadedCount = 0
        let duplicateCount = 0

        for (let i = 0; i < b.rows.length; i++) {
          const r = b.rows[i]
          const rawStr = JSON.stringify(r.rawJson || r)
          // 简单的 sha256 逻辑由 PG 的 digest 或 node crypto 生成
          const hashRes = await client.query(
            `SELECT encode(sha256($1::bytea), 'hex') AS h`,
            [rawStr],
          )
          const payloadHash = hashRes.rows[0]?.h || '0000000000000000000000000000000000000000000000000000000000000000'

          // 写入 land_raw_dedup 哨兵去重
          const dedupRes = await client.query(
            `INSERT INTO public.land_raw_dedup (
               source_platform, payload_hash, batch_id, biz_date
             ) VALUES ($1, $2, $3, $4::date)
             ON CONFLICT (source_platform, payload_hash) DO NOTHING
             RETURNING id`,
            [batch.source_platform, payloadHash, batchId, r.orderDate],
          )

          const isUnique = dedupRes.rows.length > 0
          if (!isUnique) {
            duplicateCount++
            // 写入隔离区
            await client.query(
              `INSERT INTO public.dq_quarantine (
                 batch_id, row_num, rule_code, severity, raw_payload, failure_reason, status
               ) VALUES ($1, $2, 'RULE_BATCH_KEY_UNIQUE', 'warning', $3::jsonb, '跨分区或批次哈希重复，已自动去重隔离', 'quarantined')`,
              [batchId, i + 1, JSON.stringify(r)],
            )
          }

          // 无论是否去重，均暂存至 UNLOGGED 表供集合校验
          await client.query(
            `INSERT INTO public.stg_order_import (
               batch_id, row_num, source_platform, store_id, source_order_id, source_sub_order_id,
               order_status, paid_amount, order_date, payload_hash, raw_json, validation_status
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               $7, $8, $9::date, $10, $11::jsonb, $12
             )`,
            [
              batchId,
              i + 1,
              batch.source_platform,
              batch.store_id,
              r.sourceOrderId.trim(),
              (r.sourceSubOrderId || '').trim(),
              r.orderStatus,
              Number(r.paidAmount) || 0,
              r.orderDate,
              payloadHash,
              JSON.stringify(r.rawJson || r),
              isUnique ? 'passed' : 'quarantined',
            ],
          )
          loadedCount++
        }

        // 更新批次行数指标
        await client.query(
          `UPDATE public.import_batches
           SET total_raw_rows = total_raw_rows + $1,
               clean_candidate_rows = clean_candidate_rows + $2,
               updated_at = now()
           WHERE id = $3`,
          [loadedCount, loadedCount - duplicateCount, batchId],
        )

        return { batchId, loadedCount, uniqueCount: loadedCount - duplicateCount, duplicateCount }
      })

      return sendOk(reply, summary)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to stage order rows')
      return sendError(reply, 500, err?.message || '批量暂存订单行失败')
    }
  })
}
