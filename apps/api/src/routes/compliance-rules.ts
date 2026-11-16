import type { FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { runComplianceScan } from '../modules/compliance/compliance-scanner.js'

export async function complianceRulesRoutes(app: FastifyInstance) {
  // ── GET /api/v1/compliance/rules ──
  app.get('/api/v1/compliance/rules', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const q = request.query as {
        platformCode?: string
        category?: string
        search?: string
        page?: string
        pageSize?: string
      }

      const page = Math.max(1, parseInt(q.page || '1', 10))
      const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '20', 10)))
      const offset = (page - 1) * pageSize

      const data = await withRlsContext(request, async (client) => {
        const conditions: string[] = ['1=1']
        const params: any[] = []
        let pIdx = 1

        if (q.platformCode) {
          conditions.push(`s.platform_code = $${pIdx++}`)
          params.push(q.platformCode)
        }
        if (q.category) {
          conditions.push(`s.category = $${pIdx++}`)
          params.push(q.category)
        }
        if (q.search) {
          conditions.push(`(s.title ILIKE $${pIdx} OR s.content_text ILIKE $${pIdx})`)
          params.push(`%${q.search}%`)
          pIdx++
        }

        const whereClause = conditions.join(' AND ')

        const countRes = await client.query(
          `SELECT COUNT(*) AS total FROM public.compliance_rule_snapshot s WHERE ${whereClause}`,
          params,
        )
        const total = parseInt(countRes.rows[0]?.total || '0', 10)

        const listRes = await client.query(
          `SELECT s.id, s.platform_code, p.platform_name, s.external_id, s.title,
                  s.category, s.source_url, s.published_at, s.effective_at, s.fetched_at,
                  s.fetch_method, s.content_hash,
                  SUBSTRING(s.content_text FROM 1 FOR 200) AS content_preview,
                  s.created_at
           FROM public.compliance_rule_snapshot s
           LEFT JOIN public.system_platform_configs p ON s.platform_code = p.platform_code
           WHERE ${whereClause}
           ORDER BY s.fetched_at DESC
           LIMIT $${pIdx++} OFFSET $${pIdx++}`,
          [...params, pageSize, offset],
        )

        return {
          total,
          page,
          pageSize,
          items: listRes.rows,
        }
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch compliance rules')
      return sendError(reply, 500, err.message || '获取合规规则失败')
    }
  })

  // ── GET /api/v1/compliance/rules/:id ──
  app.get('/api/v1/compliance/rules/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const data = await withRlsContext(request, async (client) => {
        const snapRes = await client.query(
          `SELECT s.*, p.platform_name
           FROM public.compliance_rule_snapshot s
           LEFT JOIN public.system_platform_configs p ON s.platform_code = p.platform_code
           WHERE s.id = $1`,
          [id],
        )

        if (snapRes.rows.length === 0) {
          return null
        }

        const rule = snapRes.rows[0]

        // 历史变更记录
        const changesRes = await client.query(
          `SELECT c.*, u.username AS read_by_name
           FROM public.compliance_rule_change c
           LEFT JOIN public.users u ON c.read_by = u.id
           WHERE c.snapshot_id = $1
           ORDER BY c.created_at DESC`,
          [id],
        )

        return {
          ...rule,
          changes: changesRes.rows,
        }
      })

      if (!data) {
        return sendError(reply, 404, '合规规则快照未找到')
      }

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to get compliance rule detail')
      return sendError(reply, 500, err.message || '获取规则详情失败')
    }
  })

  // ── GET /api/v1/compliance/changes ──
  app.get('/api/v1/compliance/changes', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const q = request.query as {
        platformCode?: string
        severity?: string
        unreadOnly?: string
        page?: string
        pageSize?: string
      }

      const page = Math.max(1, parseInt(q.page || '1', 10))
      const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '20', 10)))
      const offset = (page - 1) * pageSize

      const data = await withRlsContext(request, async (client) => {
        const conditions: string[] = ['1=1']
        const params: any[] = []
        let pIdx = 1

        if (q.platformCode) {
          conditions.push(`c.platform_code = $${pIdx++}`)
          params.push(q.platformCode)
        }
        if (q.severity) {
          conditions.push(`c.severity = $${pIdx++}`)
          params.push(q.severity)
        }
        if (q.unreadOnly === 'true') {
          conditions.push(`c.is_read = false`)
        }

        const whereClause = conditions.join(' AND ')

        // 统计未读总数与高危未读数
        const statsRes = await client.query(`
          SELECT
            COUNT(*) FILTER (WHERE is_read = false) AS unread_count,
            COUNT(*) FILTER (WHERE is_read = false AND severity IN ('critical', 'high')) AS critical_unread_count
          FROM public.compliance_rule_change
        `)
        const unreadCount = parseInt(statsRes.rows[0]?.unread_count || '0', 10)
        const criticalUnreadCount = parseInt(statsRes.rows[0]?.critical_unread_count || '0', 10)

        const countRes = await client.query(
          `SELECT COUNT(*) AS total FROM public.compliance_rule_change c WHERE ${whereClause}`,
          params,
        )
        const total = parseInt(countRes.rows[0]?.total || '0', 10)

        const listRes = await client.query(
          `SELECT c.id, c.snapshot_id, c.platform_code, p.platform_name,
                  c.external_id, c.change_type, c.diff_summary, c.severity,
                  c.is_read, c.read_at, u.username AS read_by_name,
                  s.title AS rule_title, s.category AS rule_category,
                  s.source_url, s.effective_at, c.created_at,
                  a.id AS assessment_id, a.risk_summary
           FROM public.compliance_rule_change c
           JOIN public.compliance_rule_snapshot s ON c.snapshot_id = s.id
           LEFT JOIN public.system_platform_configs p ON c.platform_code = p.platform_code
           LEFT JOIN public.compliance_risk_assessment a ON a.change_id = c.id
           LEFT JOIN public.users u ON c.read_by = u.id
           WHERE ${whereClause}
           ORDER BY c.created_at DESC
           LIMIT $${pIdx++} OFFSET $${pIdx++}`,
          [...params, pageSize, offset],
        )

        return {
          total,
          page,
          pageSize,
          unreadCount,
          criticalUnreadCount,
          items: listRes.rows,
        }
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch compliance changes')
      return sendError(reply, 500, err.message || '获取规则变更失败')
    }
  })

  // ── GET /api/v1/compliance/changes/:id/assessment ──
  app.get('/api/v1/compliance/changes/:id/assessment', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const data = await withRlsContext(request, async (client) => {
        const changeRes = await client.query(
          `SELECT c.*, s.title AS rule_title, s.category AS rule_category,
                  s.source_url, s.content_text, s.effective_at, s.published_at,
                  p.platform_name, u.username AS read_by_name
           FROM public.compliance_rule_change c
           JOIN public.compliance_rule_snapshot s ON c.snapshot_id = s.id
           LEFT JOIN public.system_platform_configs p ON c.platform_code = p.platform_code
           LEFT JOIN public.users u ON c.read_by = u.id
           WHERE c.id = $1`,
          [id],
        )

        if (changeRes.rows.length === 0) {
          return null
        }

        const change = changeRes.rows[0]

        const assessRes = await client.query(
          `SELECT * FROM public.compliance_risk_assessment WHERE change_id = $1 LIMIT 1`,
          [id],
        )

        return {
          change,
          assessment: assessRes.rows[0] || null,
        }
      })

      if (!data) {
        return sendError(reply, 404, '变更记录未找到')
      }

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch change assessment')
      return sendError(reply, 500, err.message || '获取风险评估失败')
    }
  })

  // ── POST /api/v1/compliance/changes/:id/ack ──
  app.post('/api/v1/compliance/changes/:id/ack', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const user = request.user as { id?: number } | undefined

      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE public.compliance_rule_change
           SET is_read = true, read_by = $1, read_at = now()
           WHERE id = $2
           RETURNING id, is_read, read_at`,
          [user?.id || null, id],
        )
        return res.rows[0] || null
      })

      if (!data) {
        return sendError(reply, 404, '变更记录未找到')
      }

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to ack compliance change')
      return sendError(reply, 500, err.message || '确认已读失败')
    }
  })

  // ── POST /api/v1/compliance/rules/manual ──
  app.post('/api/v1/compliance/rules/manual', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const body = (request.body || {}) as {
        platformCode: string
        externalId: string
        title: string
        category?: string
        sourceUrl: string
        publishedAt?: string
        effectiveAt?: string
        contentText: string
        severity?: 'critical' | 'high' | 'medium' | 'low'
        operationalImpact?: string
        recommendedActions?: string[]
      }

      if (!body.platformCode || !body.externalId || !body.title || !body.contentText) {
        return sendError(reply, 400, '缺少必填字段: platformCode, externalId, title, contentText')
      }

      const contentHash = createHash('sha256').update(body.contentText.trim(), 'utf8').digest('hex')
      const user = request.user as { id?: number } | undefined

      const data = await withRlsContext(request, async (client) => {
        // 1. 插入快照
        const snapRes = await client.query(
          `INSERT INTO public.compliance_rule_snapshot (
             platform_code, external_id, title, category, source_url,
             published_at, effective_at, fetch_method, content_text, content_hash, raw_metadata
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual', $8, $9, $10)
           ON CONFLICT (platform_code, external_id, content_hash) DO UPDATE
           SET title = EXCLUDED.title, fetched_at = now()
           RETURNING id`,
          [
            body.platformCode,
            body.externalId,
            body.title,
            body.category || '通用规则',
            body.sourceUrl || 'manual-entry',
            body.publishedAt || new Date().toISOString(),
            body.effectiveAt || null,
            body.contentText,
            contentHash,
            JSON.stringify({ manualCreatedBy: user?.id }),
          ],
        )

        const snapId = snapRes.rows[0].id

        // 2. 插入变更
        const severity = body.severity || 'medium'
        const changeRes = await client.query(
          `INSERT INTO public.compliance_rule_change (
             snapshot_id, platform_code, external_id, change_type, diff_summary, severity, is_read
           ) VALUES ($1, $2, $3, 'new', $4, $5, false)
           RETURNING id`,
          [snapId, body.platformCode, body.externalId, `【人工录入】${body.title}`, severity],
        )

        const changeId = changeRes.rows[0].id

        // 3. 插入风险评估
        const opImpact = body.operationalImpact || `本规则由运营团队手工补录，适用于 ${body.platformCode} 平台，请相关主播与排班运营遵从。`
        const actions = body.recommendedActions || ['研读规则内容', '排查现存选品与话术清单']

        await client.query(
          `INSERT INTO public.compliance_risk_assessment (
             change_id, risk_summary, operational_impact, recommended_actions, evidence_refs, assessed_by
           ) VALUES ($1, $2, $3, $4, $5, 'MANUAL_ENTRY')`,
          [
            changeId,
            `【手工录入预警】${body.title}`,
            opImpact,
            actions,
            JSON.stringify([{ source: body.externalId, url: body.sourceUrl }]),
          ],
        )

        return {
          snapshotId: snapId,
          changeId,
          contentHash,
        }
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to manually record compliance rule')
      return sendError(reply, 500, err.message || '录入规则失败')
    }
  })

  // ── POST /api/v1/compliance/scan ──
  app.post('/api/v1/compliance/scan', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        return runComplianceScan(client)
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to trigger compliance scan')
      return sendError(reply, 500, err.message || '巡检触发失败')
    }
  })

  // ── GET /api/v1/compliance/reminders ──
  app.get('/api/v1/compliance/reminders', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const q = request.query as { status?: string; platformCode?: string }
      const data = await withRlsContext(request, async (client) => {
        const conditions: string[] = ['1=1']
        const params: any[] = []
        let pIdx = 1

        if (q.status) {
          conditions.push(`r.status = $${pIdx++}`)
          params.push(q.status)
        }
        if (q.platformCode) {
          conditions.push(`r.platform_code = $${pIdx++}`)
          params.push(q.platformCode)
        }

        const res = await client.query(
          `SELECT r.*, p.platform_name
           FROM public.compliance_activity_reminder r
           LEFT JOIN public.system_platform_configs p ON r.platform_code = p.platform_code
           WHERE ${conditions.join(' AND ')}
           ORDER BY r.signup_deadline ASC`,
          params,
        )

        return res.rows
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch compliance reminders')
      return sendError(reply, 500, err.message || '获取活动提醒失败')
    }
  })
}
