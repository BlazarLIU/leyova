import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { effectivePlatforms } from '../lib/platform-scope.js'
import { canAccessAdSpend, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { assertShopPlatform } from '../lib/shop-guard.js'

const CONTENT_WORK_ROLES = ['super_admin', 'ops_director', 'ops_staff']

/**
 * content 域拆分（P2-1）：视频数据（video-metrics）查询与批写入
 * 原属 routes/content.ts，2026-11-17 拆出。
 */
export async function contentMetricsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/content/video-metrics ── 视频数据查询
  app.get('/api/v1/content/video-metrics', async (request: FastifyRequest<{
    Querystring: { platform?: string; from?: string; to?: string; contentType?: string; limit?: string }
  }>, reply) => {
    try {
      const { platform, from, to, contentType, limit } = request.query
      const lim = Math.min(parseInt(limit || '100', 10) || 100, 500)

      const { rows } = await withRlsContext(request, (client, scope) => {
        const conds: string[] = []
        const params: any[] = []
        let i = 1
        const eff = effectivePlatforms(platform, scope.allowedPlatforms)
        if (eff !== null) { conds.push(`v.platform_code = ANY($${i++}::text[])`); params.push(eff) }
        if (from) { conds.push(`v.biz_date >= $${i++}::date`); params.push(from) }
        if (to) { conds.push(`v.biz_date <= $${i++}::date`); params.push(to) }
        if (contentType) { conds.push(`v.content_type = $${i++}`); params.push(contentType) }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
        return client.query(
          `SELECT v.*, p.platform_name, s.shop_name
             FROM video_metrics v
             LEFT JOIN system_platform_configs p ON p.platform_code = v.platform_code
             LEFT JOIN dim_shop s ON s.id = v.shop_id
             ${where}
            ORDER BY v.biz_date DESC, v.plays DESC LIMIT ${lim}`,
          params,
        )
      })
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取视频数据失败')
    }
  })

  // ── POST /api/v1/content/video-metrics ── 手动写入视频数据（API 接口预留同一形状）
  app.post<{
    Body: {
      platformCode: string
      shopId?: number
      bizDate: string
      videoId: string
      title?: string
      contentType?: string
      impressions?: number
      plays?: number
      completeRate?: number
      likes?: number
      comments?: number
      shares?: number
      collects?: number
      attributedGmv?: number
      source?: string
    }
  }>('/api/v1/content/video-metrics', { preHandler: [requireRole(CONTENT_WORK_ROLES)] }, async (request, reply) => {
    try {
      const b = request.body || ({} as any)
      if (!b.platformCode || !b.bizDate || !b.videoId) {
        return sendError(reply, 400, '缺少必要参数 (platformCode, bizDate, videoId)')
      }

      let forbidden = false
      const result = await withRlsContext(request, (client, scope) => {
        if (effectivePlatforms(b.platformCode, scope.allowedPlatforms)?.length === 0) {
          forbidden = true
          return client.query('SELECT 1 WHERE false')
        }
        return client.query(
        `INSERT INTO video_metrics
           (biz_date, platform_code, shop_id, video_id, title, content_type,
            impressions, plays, complete_rate, likes, comments, shares, collects,
            attributed_gmv, source)
         VALUES ($1::date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (platform_code, video_id, biz_date) DO UPDATE SET
           title = EXCLUDED.title,
           impressions = EXCLUDED.impressions,
           plays = EXCLUDED.plays,
           complete_rate = EXCLUDED.complete_rate,
           likes = EXCLUDED.likes,
           comments = EXCLUDED.comments,
           shares = EXCLUDED.shares,
           collects = EXCLUDED.collects,
           attributed_gmv = EXCLUDED.attributed_gmv,
           source = EXCLUDED.source
         RETURNING *`,
        [
          b.bizDate, b.platformCode, b.shopId || null, b.videoId,
          b.title || '', b.contentType || 'short_video',
          b.impressions || 0, b.plays || 0, b.completeRate || 0,
          b.likes || 0, b.comments || 0, b.shares || 0, b.collects || 0,
          b.attributedGmv || 0, b.source || 'manual',
        ],
        )
      })
      if (forbidden) return sendError(reply, 403, '无权访问该平台数据')
      return sendOk(reply, result.rows[0], '视频数据已保存')
    } catch (err) {
      return sendError(reply, 500, '保存视频数据失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 5. 内容排产工作流 + 多端分发衍生 + 内容归因台账 (Migration 118)
  // ═══════════════════════════════════════════════════════════════
  const SCHEDULE_STAGES = [
    'topic_planned', 'script_drafted', 'shooting', 'editing',
    'compliance_review', 'approved', 'scheduled', 'published',
  ]

  app.get<{
    Querystring: { platform?: string; stage?: string }
  }>('/api/v1/content/schedules', { preHandler: [requireAuth] }, async (request, reply) => {
    const { platform, stage } = request.query || {}
    try {
      const rows = await withRlsContext(request, async (client, scope) => {
        const params: any[] = []
        const conds: string[] = []
        const eff = effectivePlatforms(platform, scope.allowedPlatforms)
        if (eff !== null) {
          params.push(eff)
          conds.push(`cs.platform_code = ANY($${params.length}::text[])`)
        }
        if (stage) {
          params.push(stage)
          conds.push(`cs.stage = $${params.length}`)
        }
        const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
        const res = await client.query(
          `SELECT cs.*, p.platform_name,
                  u1.real_name AS owner_name,
                  u2.real_name AS reviewer_name,
                  ca.name AS asset_name
           FROM public.content_schedules cs
           LEFT JOIN public.system_platform_configs p ON p.platform_code = cs.platform_code
           LEFT JOIN public.users u1 ON u1.id = cs.owner_user_id
           LEFT JOIN public.users u2 ON u2.id = cs.reviewer_user_id
           LEFT JOIN public.content_assets ca ON ca.id = cs.asset_id
           ${whereSql}
           ORDER BY COALESCE(cs.planned_publish_at, cs.created_at) DESC, cs.id DESC`,
          params,
        )
        return res.rows
      })
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'content/schedules query failed')
      return sendError(reply, 500, '查询内容排期工作流失败')
    }
  })

  app.post<{
    Body: {
      title: string
      topicCategory?: string
      platformCode: string
      targetPlatforms?: string[]
      scriptSummary?: string
      plannedPublishAt?: string
      assetId?: number | null
      complianceChecked?: boolean
      complianceNote?: string
    }
  }>('/api/v1/content/schedules', { preHandler: [requireRole(CONTENT_WORK_ROLES)] }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.title || !b.platformCode) {
      return sendError(reply, 400, '缺少必要参数 (title, platformCode)')
    }
    const actor = (request as any).user
    try {
      const row = await withRlsContext(request, async (client, scope) => {
        if (effectivePlatforms(b.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { forbidden: true as const }
        }
        const res = await client.query(
          `INSERT INTO public.content_schedules
             (tenant_id, title, topic_category, stage, platform_code, target_platforms,
              script_summary, owner_user_id, planned_publish_at, asset_id,
              compliance_checked, compliance_note)
           VALUES ($1, $2, $3, 'topic_planned', $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            scope.tenantId,
            b.title.trim(),
            b.topicCategory || '商品测评',
            b.platformCode,
            Array.isArray(b.targetPlatforms) && b.targetPlatforms.length > 0 ? b.targetPlatforms : [b.platformCode],
            b.scriptSummary || '',
            actor?.id || null,
            b.plannedPublishAt || null,
            b.assetId ? Number(b.assetId) : null,
            Boolean(b.complianceChecked),
            b.complianceNote || '',
          ],
        )
        await writeAuditLog(client, {
          request,
          action: 'content.schedule.create',
          resourceType: 'content_schedules',
          resourceId: res.rows[0].id,
          afterData: res.rows[0],
        })
        return res.rows[0]
      })
      if ('forbidden' in row) return sendError(reply, 403, '无权访问该平台数据')
      return sendOk(reply, row, '内容排期已创建')
    } catch (err) {
      request.log.warn({ err }, 'content/schedules create failed')
      return sendError(reply, 500, '创建内容排期失败')
    }
  })

  app.patch<{
    Params: { id: string }
    Body: { stage: string; complianceChecked?: boolean; complianceNote?: string; externalContentId?: string }
  }>('/api/v1/content/schedules/:id/stage', { preHandler: [requireRole(CONTENT_WORK_ROLES)] }, async (request, reply) => {
    const id = Number(request.params.id)
    const b = request.body || ({} as any)
    if (!Number.isInteger(id) || id <= 0 || !SCHEDULE_STAGES.includes(b.stage)) {
      return sendError(reply, 400, '无效的排期 ID 或工作流阶段')
    }

    try {
      const actor = (request as any).user
      const outcome = await withRlsContext(request, async (client, scope) => {
        const beforeRes = await client.query('SELECT * FROM public.content_schedules WHERE id = $1', [id])
        const before = beforeRes.rows[0]
        if (!before) return { error: { code: 404, msg: '内容排期不存在或无权访问' } }
        if (effectivePlatforms(before.platform_code, scope.allowedPlatforms)?.length === 0) {
          return { error: { code: 403, msg: '无权访问该平台数据' } }
        }

        const nextComplianceChecked =
          b.complianceChecked !== undefined ? Boolean(b.complianceChecked) : Boolean(before.compliance_checked)
        if (['approved', 'scheduled', 'published'].includes(b.stage) && !nextComplianceChecked) {
          return { error: { code: 400, msg: '进入审批通过/待发布/已发布阶段前，必须完成广审/平台合规预检 (complianceChecked=true)' } }
        }

        const { rows } = await client.query(
          `UPDATE public.content_schedules
           SET stage = $1,
               compliance_checked = $2,
               compliance_note = COALESCE($3, compliance_note),
               external_content_id = COALESCE($4, external_content_id),
               reviewer_user_id = CASE WHEN $1 IN ('compliance_review', 'approved') THEN COALESCE(reviewer_user_id, $5) ELSE reviewer_user_id END,
               published_at = CASE WHEN $1 = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
               updated_at = NOW()
           WHERE id = $6
           RETURNING *`,
          [
            b.stage,
            nextComplianceChecked,
            b.complianceNote !== undefined ? b.complianceNote : null,
            b.externalContentId !== undefined ? b.externalContentId : null,
            actor?.id || null,
            id,
          ],
        )

        await writeAuditLog(client, {
          request,
          action: 'content.schedule.transition',
          resourceType: 'content_schedules',
          resourceId: id,
          beforeData: before,
          afterData: rows[0],
        })
        return { row: rows[0] }
      })

      if ('error' in outcome && outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }
      return sendOk(reply, outcome.row, '排期阶段已推进')
    } catch (err) {
      request.log.warn({ err }, 'content/schedules transition failed')
      return sendError(reply, 500, '推进内容排期阶段失败')
    }
  })

}
