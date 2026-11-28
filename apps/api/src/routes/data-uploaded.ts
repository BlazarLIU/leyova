import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'
import { DATA_OPERATE_ROLES, DATA_ADMIN_ROLES } from '../lib/roles.js'
import { writeAuditLog } from '../lib/audit.js'
import { executeCleaningPipeline } from '../ingest/cleaner/engine.js'

/**
 * data 域拆分（P2-1）：上传数据管理（主播/渠道）
 * 原属 routes/data.ts，2026-11-17 拆出。
 */
export async function dataUploadedRoutes(app: FastifyInstance) {
  // ── GET /api/v1/data/uploaded-data/anchor ──
  app.get('/api/v1/data/uploaded-data/anchor', async (request, reply) => {
    try {
      const query = request.query as Record<string, string>
      const page = Math.max(1, parseInt(query.page) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 15))
      const offset = (page - 1) * pageSize

      const conditions: string[] = []
      const params: any[] = []
      let idx = 1

      if (query.startDate) {
        conditions.push(`a.business_date >= $${idx++}::date`)
        params.push(query.startDate)
      }
      if (query.endDate) {
        conditions.push(`a.business_date <= $${idx++}::date`)
        params.push(query.endDate)
      }
      if (query.keyword) {
        conditions.push(`a.anchor_name ILIKE $${idx++}`)
        params.push(`%${query.keyword}%`)
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      const { total, rows } = await withRlsContext(request, async (client) => {
        const countResult = await client.query(
          `SELECT COUNT(*)::int AS total FROM douyin_anchor_daily_metrics a ${whereClause}`,
          params,
        )
        const dataResult = await client.query(
          `SELECT a.*, u.file_name AS upload_file_name
           FROM douyin_anchor_daily_metrics a
           LEFT JOIN data_uploads u ON u.id = a.upload_id
           ${whereClause}
           ORDER BY a.business_date DESC, a.anchor_name ASC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, pageSize, offset],
        )
        return { total: countResult.rows[0]?.total ?? 0, rows: dataResult.rows }
      })

      return sendOk(reply, { items: rows, total, page, pageSize })
    } catch (err) {
      request.log.warn({ err }, 'data/uploaded-data/anchor query failed')
      return sendOk(reply, { items: [], total: 0, page: 1, pageSize: 15 })
    }
  })

  // ── DELETE /api/v1/data/uploaded-data/anchor/:id ──
  app.delete('/api/v1/data/uploaded-data/anchor/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await withRlsContext(request, async (client) => {
        await client.query('DELETE FROM douyin_anchor_daily_metrics WHERE id = $1', [parseInt(id)])
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.uploaded_anchor.delete',
          resourceType: 'douyin_anchor_daily_metric',
          resourceId: id,
          request,
        })
      })
      return sendOk(reply, { deleted: true })
    } catch (err) {
      request.log.warn({ err }, 'data/uploaded-data/anchor/:id delete failed')
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // ── POST /api/v1/data/uploaded-data/anchor/batch-delete ──
  app.post('/api/v1/data/uploaded-data/anchor/batch-delete', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const body = request.body as { ids: number[] }
      const ids = Array.isArray(body?.ids) ? body.ids : []
      if (ids.length === 0) return sendOk(reply, { deleted: false, count: 0 })
      const result = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `DELETE FROM douyin_anchor_daily_metrics WHERE id = ANY($1::int[])`,
          [ids],
        )
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.uploaded_anchor.batch_delete',
          resourceType: 'douyin_anchor_daily_metric',
          afterData: { ids, deletedCount: res.rowCount },
          request,
        })
        return res
      })
      return sendOk(reply, { deleted: true, count: result.rowCount })
    } catch (err) {
      request.log.warn({ err }, 'data/uploaded-data/anchor/batch-delete failed')
      return reply.code(500).send({ success: false, message: '批量删除失败' })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 上传数据管理 — 渠道分析数据
  // ═══════════════════════════════════════════════════════════════

  // ── GET /api/v1/data/uploaded-data/channel ──
  app.get('/api/v1/data/uploaded-data/channel', async (request, reply) => {
    try {
      const query = request.query as Record<string, string>
      const page = Math.max(1, parseInt(query.page) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 15))
      const offset = (page - 1) * pageSize

      const conditions: string[] = []
      const params: any[] = []
      let idx = 1

      if (query.startDate) {
        conditions.push(`c.business_date >= $${idx++}::date`)
        params.push(query.startDate)
      }
      if (query.endDate) {
        conditions.push(`c.business_date <= $${idx++}::date`)
        params.push(query.endDate)
      }
      if (query.keyword) {
        conditions.push(`c.channel_name ILIKE $${idx++}`)
        params.push(`%${query.keyword}%`)
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      const { total, rows } = await withRlsContext(request, async (client) => {
        const countResult = await client.query(
          `SELECT COUNT(*)::int AS total FROM douyin_channel_daily_metrics c ${whereClause}`,
          params,
        )
        const dataResult = await client.query(
          `SELECT c.*, u.file_name AS upload_file_name
           FROM douyin_channel_daily_metrics c
           LEFT JOIN data_uploads u ON u.id = c.upload_id
           ${whereClause}
           ORDER BY c.business_date DESC, c.channel_name ASC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, pageSize, offset],
        )
        return { total: countResult.rows[0]?.total ?? 0, rows: dataResult.rows }
      })

      return sendOk(reply, { items: rows, total, page, pageSize })
    } catch (err) {
      request.log.warn({ err }, 'data/uploaded-data/channel query failed')
      return sendOk(reply, { items: [], total: 0, page: 1, pageSize: 15 })
    }
  })

  // ── DELETE /api/v1/data/uploaded-data/channel/:id ──
  app.delete('/api/v1/data/uploaded-data/channel/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await withRlsContext(request, async (client) => {
        await client.query('DELETE FROM douyin_channel_daily_metrics WHERE id = $1', [parseInt(id)])
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.uploaded_channel.delete',
          resourceType: 'douyin_channel_daily_metric',
          resourceId: id,
          request,
        })
      })
      return sendOk(reply, { deleted: true })
    } catch (err) {
      request.log.warn({ err }, 'data/uploaded-data/channel/:id delete failed')
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // ── POST /api/v1/data/uploaded-data/channel/batch-delete ──
  app.post('/api/v1/data/uploaded-data/channel/batch-delete', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const body = request.body as { ids: number[] }
      const ids = Array.isArray(body?.ids) ? body.ids : []
      if (ids.length === 0) return sendOk(reply, { deleted: false, count: 0 })
      const result = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `DELETE FROM douyin_channel_daily_metrics WHERE id = ANY($1::int[])`,
          [ids],
        )
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.uploaded_channel.batch_delete',
          resourceType: 'douyin_channel_daily_metric',
          afterData: { ids, deletedCount: res.rowCount },
          request,
        })
        return res
      })
      return sendOk(reply, { deleted: true, count: result.rowCount })
    } catch (err) {
      request.log.warn({ err }, 'data/uploaded-data/channel/batch-delete failed')
      return reply.code(500).send({ success: false, message: '批量删除失败' })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 自定义数据清洗引擎端点 (Custom Data Cleaning Engine)
  // ═══════════════════════════════════════════════════════════════

  // ── GET /api/v1/data/clean-rules ── 获取清洗规则集列表
  app.get('/api/v1/data/clean-rules', async (request, reply) => {
    try {
      const { platform } = request.query as { platform?: string }
      let query = `SELECT id, name, platform_code, description, is_system, rules, created_at, updated_at FROM clean_rule_sets`
      const params: any[] = []
      if (platform) {
        query += ` WHERE platform_code = $1`
        params.push(platform)
      }
      query += ` ORDER BY is_system DESC, id ASC`
      const { rows } = await withRlsContext(request, (client) => client.query(query, params))
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch clean rules')
      return sendError(reply, 500, '获取清洗规则列表失败')
    }
  })

  // ── POST /api/v1/data/clean-rules ── 创建自定义清洗规则集
  app.post('/api/v1/data/clean-rules', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const body = request.body as {
        name: string
        platform_code: string
        description?: string
        rules: any[]
      }
      if (!body.name || !body.platform_code || !Array.isArray(body.rules)) {
        return sendError(reply, 400, '缺少必要参数 (name, platform_code, rules)')
      }

      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `INSERT INTO clean_rule_sets (name, platform_code, description, is_system, rules)
           VALUES ($1, $2, $3, false, $4)
           RETURNING *`,
          [body.name, body.platform_code, body.description || '', JSON.stringify(body.rules)],
        )
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.clean_rule.create',
          resourceType: 'clean_rule_set',
          resourceId: res.rows[0]?.id,
          afterData: res.rows[0],
          request,
        })
        return res.rows
      })
      return sendOk(reply, rows[0], '清洗规则集创建成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to create clean rule set')
      return sendError(reply, 500, '创建清洗规则集失败')
    }
  })

  // ── PUT /api/v1/data/clean-rules/:id ── 更新自定义清洗规则集
  app.put('/api/v1/data/clean-rules/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as {
        name?: string
        description?: string
        rules?: any[]
      }

      const updates: string[] = []
      const values: any[] = [parseInt(id)]
      let idx = 2

      if (body.name) {
        updates.push(`name = $${idx++}`)
        values.push(body.name)
      }
      if (body.description !== undefined) {
        updates.push(`description = $${idx++}`)
        values.push(body.description)
      }
      if (Array.isArray(body.rules)) {
        updates.push(`rules = $${idx++}`)
        values.push(JSON.stringify(body.rules))
      }

      updates.push(`updated_at = now()`)

      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE clean_rule_sets SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
          values,
        )
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'data.clean_rule.update',
            resourceType: 'clean_rule_set',
            resourceId: id,
            afterData: res.rows[0],
            request,
          })
        }
        return res.rows
      })
      if (rows.length === 0) return sendError(reply, 404, '清洗规则集不存在')
      return sendOk(reply, rows[0], '清洗规则集更新成功')
    } catch (err) {
      request.log.error({ err }, 'Failed to update clean rule set')
      return sendError(reply, 500, '更新清洗规则集失败')
    }
  })

  // ── DELETE /api/v1/data/clean-rules/:id ── 删除自定义清洗规则集 (系统内置不可删)
  app.delete('/api/v1/data/clean-rules/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const status = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(`SELECT is_system FROM clean_rule_sets WHERE id = $1`, [parseInt(id)])
        if (rows.length === 0) return 'not_found' as const
        if (rows[0].is_system) return 'system_forbidden' as const

        await client.query(`DELETE FROM clean_rule_sets WHERE id = $1`, [parseInt(id)])
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.clean_rule.delete',
          resourceType: 'clean_rule_set',
          resourceId: id,
          request,
        })
        return 'deleted' as const
      })
      if (status === 'not_found') return sendError(reply, 404, '清洗规则集不存在')
      if (status === 'system_forbidden') return sendError(reply, 403, '系统官方清洗规则不可删除')
      return sendOk(reply, { deleted: true }, '清洗规则集已删除')
    } catch (err) {
      request.log.error({ err }, 'Failed to delete clean rule set')
      return sendError(reply, 500, '删除清洗规则集失败')
    }
  })

  // ── POST /api/v1/data/clean-rules/test ── 预演测试清洗规则（返回前后 Diff 对照与清洗报告）
  app.post('/api/v1/data/clean-rules/test', { preHandler: [requireRole(DATA_OPERATE_ROLES)] }, async (request, reply) => {
    try {
      const body = request.body as {
        rows: Record<string, any>[]
        rules: any[]
      }
      const rawRows = Array.isArray(body?.rows) ? body.rows : []
      const rules = Array.isArray(body?.rules) ? body.rules : []

      if (rawRows.length === 0) {
        return sendError(reply, 400, '缺少测试样本行数据 (rows)')
      }

      const { cleanedRows, report } = executeCleaningPipeline(rawRows, rules)
      return sendOk(reply, {
        report,
        previewCleanedRows: cleanedRows.slice(0, 50),
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to test clean rules')
      return sendError(reply, 500, '清洗规则预演测试失败')
    }
  })
}
