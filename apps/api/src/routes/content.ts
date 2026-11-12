/**
 * content.ts — 内容中心路由（P3 预开发）
 *
 * 覆盖计划 6.4：
 *   - providers 管理（本地 ComfyUI 地址、连通性测试、节点清单）
 *   - projects / tasks 创作工作台
 *   - 任务提交与轮询（ComfyUI /insert prompt → /history 查询）
 *   - 视频数据（API 接口 + 手动上传）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { canAccessAdSpend, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import { createProvider, type ProviderInfo } from '../content/providers/comfyui.js'

const PROVIDER_WRITE_ROLES = ['super_admin', 'admin', 'ops_director']
const CONTENT_WORK_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']

export async function contentRoutes(app: FastifyInstance) {
  /** 按 id 取 provider 配置 */
  const loadProvider = async (executor: DbExecutor, providerId?: number | null) => {
    const sql = providerId
      ? `SELECT * FROM content_providers WHERE id = $1`
      : `SELECT * FROM content_providers WHERE is_enabled = true ORDER BY is_default DESC, id LIMIT 1`
    const { rows } = await executor.query(sql, providerId ? [providerId] : [])
    if (rows.length === 0) return null
    const p = rows[0]
    const info: ProviderInfo = {
      providerType: p.provider_type,
      baseUrl: p.base_url,
      apiKey: p.api_key || undefined,
    }
    return { row: p, provider: createProvider(info) }
  }

  // ═══════════════════════════════════════════════════════════════
  // Providers
  // ═══════════════════════════════════════════════════════════════

  // ── GET /api/v1/content/providers ──
  app.get('/api/v1/content/providers', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) => client.query(
        `SELECT id, name, provider_type, base_url, is_enabled, is_default,
                capabilities, last_checked_at, last_check_result, created_at
           FROM content_providers ORDER BY is_default DESC, id`,
      ))
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取生成服务列表失败')
    }
  })

  // ── POST /api/v1/content/providers ──
  app.post<{
    Body: { name: string; providerType?: string; baseUrl: string; apiKey?: string; isDefault?: boolean }
  }>('/api/v1/content/providers', { preHandler: [requireRole(PROVIDER_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const { name, providerType = 'comfyui', baseUrl, apiKey, isDefault } = request.body || {}
      if (!name || !baseUrl) return sendError(reply, 400, '缺少必要参数 (name, baseUrl)')

      const { rows } = await withRlsContext(request, async (client) => {
        if (isDefault) {
          await client.query(`UPDATE content_providers SET is_default = false`)
        }
        const res = await client.query(
          `INSERT INTO content_providers (name, provider_type, base_url, api_key, is_default)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [name, providerType, baseUrl, apiKey || null, !!isDefault],
        )
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'content_provider.create',
          resourceType: 'content_provider',
          resourceId: res.rows[0]?.id,
          afterData: { id: res.rows[0]?.id, name, providerType, baseUrl, isDefault: !!isDefault },
          request,
        })
        return res
      })
      return sendOk(reply, rows[0], '生成服务已保存')
    } catch (err) {
      return sendError(reply, 500, '保存生成服务失败')
    }
  })

  // ── PUT /api/v1/content/providers/:id ──
  app.put<{
    Params: { id: string }
    Body: { name?: string; baseUrl?: string; apiKey?: string; isEnabled?: boolean; isDefault?: boolean }
  }>('/api/v1/content/providers/:id', { preHandler: [requireRole(PROVIDER_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      const b = request.body || {}

      const sets: string[] = []
      const vals: any[] = [id]
      let i = 2
      if (b.name !== undefined) { sets.push(`name = $${i++}`); vals.push(b.name) }
      if (b.baseUrl !== undefined) { sets.push(`base_url = $${i++}`); vals.push(b.baseUrl) }
      if (b.apiKey !== undefined) { sets.push(`api_key = $${i++}`); vals.push(b.apiKey) }
      if (b.isEnabled !== undefined) { sets.push(`is_enabled = $${i++}`); vals.push(b.isEnabled) }
      if (b.isDefault !== undefined) { sets.push(`is_default = $${i++}`); vals.push(b.isDefault) }
      sets.push('updated_at = now()')

      const { rows } = await withRlsContext(request, async (client) => {
        if (b.isDefault) {
          await client.query(`UPDATE content_providers SET is_default = false WHERE id <> $1`, [id])
        }
        const res = await client.query(
          `UPDATE content_providers SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
          vals,
        )
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'content_provider.update',
            resourceType: 'content_provider',
            resourceId: id,
            afterData: { id, name: b.name, baseUrl: b.baseUrl, isEnabled: b.isEnabled, isDefault: b.isDefault },
            request,
          })
        }
        return res
      })
      if (rows.length === 0) return sendError(reply, 404, '生成服务不存在')
      return sendOk(reply, rows[0], '更新成功')
    } catch (err) {
      return sendError(reply, 500, '更新生成服务失败')
    }
  })

  // ── DELETE /api/v1/content/providers/:id ──
  app.delete<{ Params: { id: string } }>('/api/v1/content/providers/:id', { preHandler: [requireRole(PROVIDER_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      await withRlsContext(request, async (client) => {
        await client.query(`DELETE FROM content_providers WHERE id = $1`, [id])
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'content_provider.delete',
          resourceType: 'content_provider',
          resourceId: id,
          request,
        })
      })
      return sendOk(reply, { deleted: true }, '已删除')
    } catch (err) {
      return sendError(reply, 500, '删除生成服务失败')
    }
  })

  // ── POST /api/v1/content/providers/:id/test ── 连通性测试
  app.post<{ Params: { id: string } }>('/api/v1/content/providers/:id/test', { preHandler: [requireRole(PROVIDER_WRITE_ROLES)] }, async (request, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      const loaded = await withRlsContext(request, (client) => loadProvider(client, id))
      if (!loaded) return sendError(reply, 404, '生成服务不存在')

      const health = await loaded.provider.checkHealth()
      await withRlsContext(request, (client) => client.query(
        `UPDATE content_providers SET last_checked_at = now(), last_check_result = $1 WHERE id = $2`,
        [health.ok ? 'ok' : 'failed', id],
      ))
      return sendOk(reply, health, health.ok ? '连接正常' : '连接失败')
    } catch (err: any) {
      return sendError(reply, 500, err?.message || '测试连接失败')
    }
  })

  // ── GET /api/v1/content/providers/:id/object-info ── 可用节点/模型
  app.get('/api/v1/content/providers/:id/object-info', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      const loaded = await withRlsContext(request, (client) => loadProvider(client, id))
      if (!loaded) return sendError(reply, 404, '生成服务不存在')
      const info = await loaded.provider.getObjectInfo()
      return sendOk(reply, info)
    } catch (err: any) {
      return sendError(reply, 500, err?.message || '获取节点清单失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // Projects
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/v1/content/projects', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) => client.query(
        `SELECT p.*,
                (SELECT count(*) FROM content_tasks t WHERE t.project_id = p.id)::int AS task_count,
                (SELECT count(*) FROM content_assets a WHERE a.project_id = p.id)::int AS asset_count
           FROM content_projects p ORDER BY p.created_at DESC`,
      ))
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取项目列表失败')
    }
  })

  app.post<{
    Body: { name: string; description?: string; platformCode?: string; shopId?: number }
  }>('/api/v1/content/projects', { preHandler: [requireRole(CONTENT_WORK_ROLES)] }, async (request, reply) => {
    try {
      const { name, description, platformCode, shopId } = request.body || {}
      if (!name) return sendError(reply, 400, '缺少项目名称')
      const { rows } = await withRlsContext(request, (client) => client.query(
        `INSERT INTO content_projects (name, description, platform_code, shop_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, description || '', platformCode || null, shopId || null],
      ))
      return sendOk(reply, rows[0], '项目已创建')
    } catch (err) {
      return sendError(reply, 500, '创建项目失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // Tasks
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/v1/content/tasks', async (request: FastifyRequest<{
    Querystring: { projectId?: string; status?: string; limit?: string }
  }>, reply) => {
    try {
      const { projectId, status, limit } = request.query
      const conds: string[] = []
      const params: any[] = []
      let i = 1
      if (projectId) { conds.push(`t.project_id = $${i++}`); params.push(parseInt(projectId, 10)) }
      if (status) { conds.push(`t.status = $${i++}`); params.push(status) }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
      const lim = Math.min(parseInt(limit || '50', 10) || 50, 200)

      const { rows } = await withRlsContext(request, (client) => client.query(
        `SELECT t.*, p.name AS project_name
           FROM content_tasks t
           LEFT JOIN content_projects p ON p.id = t.project_id
           ${where}
          ORDER BY t.created_at DESC LIMIT ${lim}`,
        params,
      ))
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取任务列表失败')
    }
  })

  // ── POST /api/v1/content/tasks ── 提交生成任务
  app.post<{
    Body: {
      projectId?: number
      providerId?: number
      taskType: string
      prompt?: string
      workflow?: Record<string, any>
    }
  }>('/api/v1/content/tasks', { preHandler: [requireRole(CONTENT_WORK_ROLES)] }, async (request, reply) => {
    try {
      const { projectId, providerId, taskType = 'text2video', prompt, workflow } = request.body || {}

      const loaded = await withRlsContext(request, (client) => loadProvider(client, providerId))
      if (!loaded) {
        // 没有配置任何生成服务 → 明确提示，不静默失败
        return sendError(reply, 400, '未配置生成服务，请先在「中心配置」中添加 ComfyUI 地址或启用 Mock 模式')
      }

      if (!workflow || Object.keys(workflow).length === 0) {
        return sendError(reply, 400, '缺少 ComfyUI workflow JSON（请在「中心配置」中保存 workflow 模板）')
      }

      const ins = await withRlsContext(request, (client) => client.query(
        `INSERT INTO content_tasks (project_id, provider_id, task_type, status, prompt, workflow, started_at)
         VALUES ($1, $2, $3, 'running', $4, $5, now()) RETURNING *`,
        [projectId || null, loaded.row.id, taskType, prompt || '', JSON.stringify(workflow)],
      ))
      const task = ins.rows[0]

      try {
        const result = await loaded.provider.submit(workflow)
        await withRlsContext(request, (client) => client.query(
          `UPDATE content_tasks SET comfy_prompt_id = $1 WHERE id = $2`,
          [result.promptId, task.id],
        ))
        return sendOk(reply, { ...task, comfy_prompt_id: result.promptId }, '任务已提交')
      } catch (submitErr: any) {
        await withRlsContext(request, (client) => client.query(
          `UPDATE content_tasks SET status = 'failed', error_message = $1, completed_at = now() WHERE id = $2`,
          [String(submitErr?.message || submitErr).slice(0, 1000), task.id],
        ))
        return sendError(reply, 502, `提交到生成服务失败：${submitErr?.message || submitErr}`)
      }
    } catch (err) {
      return sendError(reply, 500, '创建任务失败')
    }
  })

  // ── GET /api/v1/content/tasks/:id ── 轮询任务进度
  app.get('/api/v1/content/tasks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的任务 ID')

      const initial = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(`SELECT * FROM content_tasks WHERE id = $1`, [id])
        if (rows.length === 0) return { notFound: true as const }
        const task = rows[0]
        if (task.status === 'completed' || task.status === 'failed' || !task.comfy_prompt_id) {
          return { notFound: false as const, task, loaded: null }
        }
        const loaded = await loadProvider(client, task.provider_id)
        return { notFound: false as const, task, loaded }
      })
      if (initial.notFound) return sendError(reply, 404, '任务不存在')
      if (!initial.loaded) return sendOk(reply, initial.task)
      const { task, loaded } = initial

      const progress = await loaded.provider.poll(task.comfy_prompt_id)

      const after = await withRlsContext(request, async (client) => {
        if (progress.status === 'completed') {
          const outputUrl = progress.outputUrls[0] || null
          await client.query(
            `UPDATE content_tasks
                SET status = 'completed', progress = 100, output_url = $1,
                    output_assets = $2, completed_at = now()
              WHERE id = $3`,
            [outputUrl, JSON.stringify(progress.outputUrls), id],
          )
          // 产物入库
          for (const url of progress.outputUrls) {
            await client.query(
              `INSERT INTO content_assets (project_id, task_id, asset_type, name, url, provider)
               VALUES ($1, $2, 'video', $3, $4, $5)`,
              [task.project_id, id, url.split('/').pop() || 'output', url, loaded.row.provider_type],
            )
          }
        } else if (progress.status === 'failed') {
          await client.query(
            `UPDATE content_tasks SET status = 'failed', error_message = $1, completed_at = now() WHERE id = $2`,
            [progress.error || '生成失败', id],
          )
        } else {
          await client.query(`UPDATE content_tasks SET progress = $1 WHERE id = $2`, [progress.progress, id])
        }

        return client.query(`SELECT * FROM content_tasks WHERE id = $1`, [id])
      })
      return sendOk(reply, after.rows[0])
    } catch (err: any) {
      return sendError(reply, 500, err?.message || '查询任务失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // Assets & Video Metrics
  // ═══════════════════════════════════════════════════════════════

  app.get('/api/v1/content/assets', async (request: FastifyRequest<{
    Querystring: { projectId?: string; limit?: string }
  }>, reply) => {
    try {
      const { projectId, limit } = request.query
      const lim = Math.min(parseInt(limit || '50', 10) || 50, 200)
      const { rows } = await withRlsContext(request, (client) => client.query(
        `SELECT * FROM content_assets
          ${projectId ? 'WHERE project_id = $1' : ''}
          ORDER BY created_at DESC LIMIT ${lim}`,
        projectId ? [parseInt(projectId, 10)] : [],
      ))
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取素材列表失败')
    }
  })

  // ── GET /api/v1/content/video-metrics ── 视频数据查询
  app.get('/api/v1/content/video-metrics', async (request: FastifyRequest<{
    Querystring: { platform?: string; from?: string; to?: string; contentType?: string; limit?: string }
  }>, reply) => {
    try {
      const { platform, from, to, contentType, limit } = request.query
      const conds: string[] = []
      const params: any[] = []
      let i = 1
      if (platform) { conds.push(`v.platform_code = $${i++}`); params.push(platform) }
      if (from) { conds.push(`v.biz_date >= $${i++}::date`); params.push(from) }
      if (to) { conds.push(`v.biz_date <= $${i++}::date`); params.push(to) }
      if (contentType) { conds.push(`v.content_type = $${i++}`); params.push(contentType) }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
      const lim = Math.min(parseInt(limit || '100', 10) || 100, 500)

      const { rows } = await withRlsContext(request, (client) => client.query(
        `SELECT v.*, p.platform_name, s.shop_name
           FROM video_metrics v
           LEFT JOIN system_platform_configs p ON p.platform_code = v.platform_code
           LEFT JOIN dim_shop s ON s.id = v.shop_id
           ${where}
          ORDER BY v.biz_date DESC, v.plays DESC LIMIT ${lim}`,
        params,
      ))
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

      const { rows } = await withRlsContext(request, (client) => client.query(
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
      ))
      return sendOk(reply, rows[0], '视频数据已保存')
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
      const rows = await withRlsContext(request, async (client) => {
        const params: any[] = []
        const conds: string[] = []
        if (platform) {
          params.push(platform)
          conds.push(`cs.platform_code = $${params.length}`)
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
      const outcome = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT * FROM public.content_schedules WHERE id = $1', [id])
        const before = beforeRes.rows[0]
        if (!before) return { error: { code: 404, msg: '内容排期不存在或无权访问' } }

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

  // ── POST /api/v1/content/assets/:id/derive ── 一鱼多吃：生成平台适配衍生素材版本
  app.post<{
    Params: { id: string }
    Body: { targetPlatform: string; name?: string; complianceStatus?: string }
  }>('/api/v1/content/assets/:id/derive', { preHandler: [requireRole(CONTENT_WORK_ROLES)] }, async (request, reply) => {
    const parentId = Number(request.params.id)
    const b = request.body || ({} as any)
    if (!Number.isInteger(parentId) || parentId <= 0 || !b.targetPlatform) {
      return sendError(reply, 400, '缺少必要参数 (assetId, targetPlatform)')
    }

    try {
      const derived = await withRlsContext(request, async (client) => {
        const parentRes = await client.query('SELECT * FROM public.content_assets WHERE id = $1', [parentId])
        const parent = parentRes.rows[0]
        if (!parent) return null

        const derivedName = b.name?.trim() || `${parent.name} [${b.targetPlatform}分发版]`
        const { rows } = await client.query(
          `INSERT INTO public.content_assets
             (project_id, task_id, asset_type, name, url, local_path, size_bytes, duration_seconds,
              provider, extra, tenant_id, parent_asset_id, source_platform, distribution_status, compliance_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ready', $14)
           RETURNING *`,
          [
            parent.project_id,
            parent.task_id,
            parent.asset_type,
            derivedName,
            parent.url,
            parent.local_path,
            parent.size_bytes,
            parent.duration_seconds,
            parent.provider,
            parent.extra || '{}',
            parent.tenant_id || 1,
            parentId,
            b.targetPlatform,
            b.complianceStatus || 'pending',
          ],
        )
        await writeAuditLog(client, {
          request,
          action: 'content.asset.derive',
          resourceType: 'content_assets',
          resourceId: rows[0].id,
          afterData: rows[0],
        })
        return rows[0]
      })
      if (!derived) return sendError(reply, 404, '母版素材不存在')
      return sendOk(reply, derived, '已派生多端适配版本')
    } catch (err) {
      request.log.warn({ err }, 'content/assets derive failed')
      return sendError(reply, 500, '派生多平台素材失败')
    }
  })

  // ── GET /api/v1/content/attribution ── 内容→搜索回搜→交易 GMV 归因台账
  app.get<{
    Querystring: { platform?: string; shopId?: string; channel?: string; from?: string; to?: string }
  }>('/api/v1/content/attribution', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    const showSpend = canAccessAdSpend(user)
    const { platform, shopId, channel, from, to } = request.query || {}
    const toDate = to || new Date().toISOString().slice(0, 10)
    const fromDate = from || new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10)

    try {
      const data = await withRlsContext(request, async (client) => {
        const params: any[] = [fromDate, toDate]
        let filterSql = ''
        if (platform) {
          params.push(platform)
          filterSql += ` AND l.platform_code = $${params.length}`
        }
        if (shopId) {
          params.push(Number(shopId))
          filterSql += ` AND l.shop_id = $${params.length}`
        }
        if (channel) {
          params.push(channel)
          filterSql += ` AND l.attribution_channel = $${params.length}`
        }

        const { rows } = await client.query(
          `SELECT l.*, s.shop_name, p.platform_name, cs.title AS schedule_title
           FROM public.content_attribution_ledger l
           LEFT JOIN public.dim_shop s ON s.id = l.shop_id
           LEFT JOIN public.system_platform_configs p ON p.platform_code = l.platform_code
           LEFT JOIN public.content_schedules cs ON cs.id = l.schedule_id
           WHERE l.biz_date >= $1::date AND l.biz_date <= $2::date ${filterSql}
           ORDER BY l.attributed_gmv DESC, l.biz_date DESC`,
          params,
        )

        const items = rows.map((r) => ({
          ...r,
          ad_spend: showSpend ? Number(r.ad_spend || 0) : null,
        }))

        const summary = {
          total_views: rows.reduce((a, r) => a + Number(r.views || 0), 0),
          total_engagements: rows.reduce((a, r) => a + Number(r.engagements || 0), 0),
          total_search_back: rows.reduce((a, r) => a + Number(r.search_back_count || 0), 0),
          total_orders: rows.reduce((a, r) => a + Number(r.attributed_orders || 0), 0),
          total_attributed_gmv: Number(rows.reduce((a, r) => a + Number(r.attributed_gmv || 0), 0).toFixed(2)),
          total_settled_gmv: Number(rows.reduce((a, r) => a + Number(r.settled_gmv || 0), 0).toFixed(2)),
          total_ad_spend: showSpend
            ? Number(rows.reduce((a, r) => a + Number(r.ad_spend || 0), 0).toFixed(2))
            : null,
        }

        return { range: { from: fromDate, to: toDate }, spendMasked: !showSpend, summary, items }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'content/attribution query failed')
      return sendError(reply, 500, '查询内容归因台账失败')
    }
  })

  app.post<{
    Body: {
      contentId: string
      scheduleId?: number | null
      platformCode: string
      shopId: number
      bizDate: string
      attributionChannel?: string
      attributionWindowHours?: number
      views?: number
      engagements?: number
      searchBackCount?: number
      attributedOrders?: number
      attributedGmv?: number
      settledGmv?: number
      adSpend?: number
    }
  }>('/api/v1/content/attribution', { preHandler: [requireRole([...CONTENT_WORK_ROLES, 'ad_buyer'])] }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.contentId || !b.platformCode || !b.shopId || !b.bizDate) {
      return sendError(reply, 400, '缺少必要参数 (contentId, platformCode, shopId, bizDate)')
    }

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        const shopCheck = await assertShopPlatform(client, b.shopId, b.platformCode)
        if (!shopCheck.ok) {
          return { error: { code: shopCheck.statusCode || 400, msg: shopCheck.message || '店铺校验失败' } }
        }

        const { rows } = await client.query(
          `INSERT INTO public.content_attribution_ledger
             (tenant_id, content_id, schedule_id, platform_code, shop_id, biz_date,
              attribution_channel, attribution_window_hours, views, engagements,
              search_back_count, attributed_orders, attributed_gmv, settled_gmv, ad_spend)
           VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (tenant_id, content_id, platform_code, shop_id, biz_date, attribution_channel) DO UPDATE SET
             schedule_id = COALESCE(EXCLUDED.schedule_id, public.content_attribution_ledger.schedule_id),
             attribution_window_hours = EXCLUDED.attribution_window_hours,
             views = EXCLUDED.views,
             engagements = EXCLUDED.engagements,
             search_back_count = EXCLUDED.search_back_count,
             attributed_orders = EXCLUDED.attributed_orders,
             attributed_gmv = EXCLUDED.attributed_gmv,
             settled_gmv = EXCLUDED.settled_gmv,
             ad_spend = EXCLUDED.ad_spend
           RETURNING *`,
          [
            scope.tenantId,
            b.contentId.trim(),
            b.scheduleId ? Number(b.scheduleId) : null,
            b.platformCode,
            Number(b.shopId),
            b.bizDate,
            b.attributionChannel || 'in_site',
            Number(b.attributionWindowHours || 168),
            Number(b.views || 0),
            Number(b.engagements || 0),
            Number(b.searchBackCount || 0),
            Number(b.attributedOrders || 0),
            Number(b.attributedGmv || 0),
            Number(b.settledGmv || 0),
            Number(b.adSpend || 0),
          ],
        )
        await writeAuditLog(client, {
          request,
          action: 'content.attribution.upsert',
          resourceType: 'content_attribution_ledger',
          resourceId: rows[0].id,
          afterData: rows[0],
        })
        return { row: rows[0] }
      })

      if ('error' in outcome && outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }
      return sendOk(reply, outcome.row, '内容归因数据已保存')
    } catch (err) {
      request.log.warn({ err }, 'content/attribution upsert failed')
      return sendError(reply, 500, '保存内容归因数据失败')
    }
  })
}
