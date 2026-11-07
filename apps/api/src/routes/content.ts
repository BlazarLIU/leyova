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
import { getPool } from '../lib/db.js'
import { createProvider, type ProviderInfo } from '../content/providers/comfyui.js'

export async function contentRoutes(app: FastifyInstance) {
  const pool = getPool()

  /** 按 id 取 provider 配置 */
  const loadProvider = async (providerId?: number | null) => {
    const sql = providerId
      ? `SELECT * FROM content_providers WHERE id = $1`
      : `SELECT * FROM content_providers WHERE is_enabled = true ORDER BY is_default DESC, id LIMIT 1`
    const { rows } = await pool.query(sql, providerId ? [providerId] : [])
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
  app.get('/api/v1/content/providers', async (_request, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, provider_type, base_url, is_enabled, is_default,
                capabilities, last_checked_at, last_check_result, created_at
           FROM content_providers ORDER BY is_default DESC, id`,
      )
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取生成服务列表失败')
    }
  })

  // ── POST /api/v1/content/providers ──
  app.post('/api/v1/content/providers', async (request: FastifyRequest<{
    Body: { name: string; providerType?: string; baseUrl: string; apiKey?: string; isDefault?: boolean }
  }>, reply) => {
    try {
      const { name, providerType = 'comfyui', baseUrl, apiKey, isDefault } = request.body || {}
      if (!name || !baseUrl) return sendError(reply, 400, '缺少必要参数 (name, baseUrl)')

      if (isDefault) {
        await pool.query(`UPDATE content_providers SET is_default = false`)
      }
      const { rows } = await pool.query(
        `INSERT INTO content_providers (name, provider_type, base_url, api_key, is_default)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, providerType, baseUrl, apiKey || null, !!isDefault],
      )
      return sendOk(reply, rows[0], '生成服务已保存')
    } catch (err) {
      return sendError(reply, 500, '保存生成服务失败')
    }
  })

  // ── PUT /api/v1/content/providers/:id ──
  app.put('/api/v1/content/providers/:id', async (request: FastifyRequest<{
    Params: { id: string }
    Body: { name?: string; baseUrl?: string; apiKey?: string; isEnabled?: boolean; isDefault?: boolean }
  }>, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      const b = request.body || {}

      if (b.isDefault) {
        await pool.query(`UPDATE content_providers SET is_default = false WHERE id <> $1`, [id])
      }

      const sets: string[] = []
      const vals: any[] = [id]
      let i = 2
      if (b.name !== undefined) { sets.push(`name = $${i++}`); vals.push(b.name) }
      if (b.baseUrl !== undefined) { sets.push(`base_url = $${i++}`); vals.push(b.baseUrl) }
      if (b.apiKey !== undefined) { sets.push(`api_key = $${i++}`); vals.push(b.apiKey) }
      if (b.isEnabled !== undefined) { sets.push(`is_enabled = $${i++}`); vals.push(b.isEnabled) }
      if (b.isDefault !== undefined) { sets.push(`is_default = $${i++}`); vals.push(b.isDefault) }
      sets.push('updated_at = now()')

      const { rows } = await pool.query(
        `UPDATE content_providers SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
        vals,
      )
      if (rows.length === 0) return sendError(reply, 404, '生成服务不存在')
      return sendOk(reply, rows[0], '更新成功')
    } catch (err) {
      return sendError(reply, 500, '更新生成服务失败')
    }
  })

  // ── DELETE /api/v1/content/providers/:id ──
  app.delete('/api/v1/content/providers/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      await pool.query(`DELETE FROM content_providers WHERE id = $1`, [id])
      return sendOk(reply, { deleted: true }, '已删除')
    } catch (err) {
      return sendError(reply, 500, '删除生成服务失败')
    }
  })

  // ── POST /api/v1/content/providers/:id/test ── 连通性测试
  app.post('/api/v1/content/providers/:id/test', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      const loaded = await loadProvider(id)
      if (!loaded) return sendError(reply, 404, '生成服务不存在')

      const health = await loaded.provider.checkHealth()
      await pool.query(
        `UPDATE content_providers SET last_checked_at = now(), last_check_result = $1 WHERE id = $2`,
        [health.ok ? 'ok' : 'failed', id],
      )
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
      const loaded = await loadProvider(id)
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

  app.get('/api/v1/content/projects', async (_request, reply) => {
    try {
      const { rows } = await pool.query(
        `SELECT p.*,
                (SELECT count(*) FROM content_tasks t WHERE t.project_id = p.id)::int AS task_count,
                (SELECT count(*) FROM content_assets a WHERE a.project_id = p.id)::int AS asset_count
           FROM content_projects p ORDER BY p.created_at DESC`,
      )
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取项目列表失败')
    }
  })

  app.post('/api/v1/content/projects', async (request: FastifyRequest<{
    Body: { name: string; description?: string; platformCode?: string; shopId?: number }
  }>, reply) => {
    try {
      const { name, description, platformCode, shopId } = request.body || {}
      if (!name) return sendError(reply, 400, '缺少项目名称')
      const { rows } = await pool.query(
        `INSERT INTO content_projects (name, description, platform_code, shop_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, description || '', platformCode || null, shopId || null],
      )
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

      const { rows } = await pool.query(
        `SELECT t.*, p.name AS project_name
           FROM content_tasks t
           LEFT JOIN content_projects p ON p.id = t.project_id
           ${where}
          ORDER BY t.created_at DESC LIMIT ${lim}`,
        params,
      )
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取任务列表失败')
    }
  })

  // ── POST /api/v1/content/tasks ── 提交生成任务
  app.post('/api/v1/content/tasks', async (request: FastifyRequest<{
    Body: {
      projectId?: number
      providerId?: number
      taskType: string
      prompt?: string
      workflow?: Record<string, any>
    }
  }>, reply) => {
    try {
      const { projectId, providerId, taskType = 'text2video', prompt, workflow } = request.body || {}

      const loaded = await loadProvider(providerId)
      if (!loaded) {
        // 没有配置任何生成服务 → 明确提示，不静默失败
        return sendError(reply, 400, '未配置生成服务，请先在「中心配置」中添加 ComfyUI 地址或启用 Mock 模式')
      }

      if (!workflow || Object.keys(workflow).length === 0) {
        return sendError(reply, 400, '缺少 ComfyUI workflow JSON（请在「中心配置」中保存 workflow 模板）')
      }

      const ins = await pool.query(
        `INSERT INTO content_tasks (project_id, provider_id, task_type, status, prompt, workflow, started_at)
         VALUES ($1, $2, $3, 'running', $4, $5, now()) RETURNING *`,
        [projectId || null, loaded.row.id, taskType, prompt || '', JSON.stringify(workflow)],
      )
      const task = ins.rows[0]

      try {
        const result = await loaded.provider.submit(workflow)
        await pool.query(
          `UPDATE content_tasks SET comfy_prompt_id = $1 WHERE id = $2`,
          [result.promptId, task.id],
        )
        return sendOk(reply, { ...task, comfy_prompt_id: result.promptId }, '任务已提交')
      } catch (submitErr: any) {
        await pool.query(
          `UPDATE content_tasks SET status = 'failed', error_message = $1, completed_at = now() WHERE id = $2`,
          [String(submitErr?.message || submitErr).slice(0, 1000), task.id],
        )
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

      const { rows } = await pool.query(`SELECT * FROM content_tasks WHERE id = $1`, [id])
      if (rows.length === 0) return sendError(reply, 404, '任务不存在')
      const task = rows[0]

      // 已完成/失败的任务直接返回
      if (task.status === 'completed' || task.status === 'failed') {
        return sendOk(reply, task)
      }
      if (!task.comfy_prompt_id) {
        return sendOk(reply, task)
      }

      const loaded = await loadProvider(task.provider_id)
      if (!loaded) return sendOk(reply, task)

      const progress = await loaded.provider.poll(task.comfy_prompt_id)

      if (progress.status === 'completed') {
        const outputUrl = progress.outputUrls[0] || null
        await pool.query(
          `UPDATE content_tasks
              SET status = 'completed', progress = 100, output_url = $1,
                  output_assets = $2, completed_at = now()
            WHERE id = $3`,
          [outputUrl, JSON.stringify(progress.outputUrls), id],
        )
        // 产物入库
        for (const url of progress.outputUrls) {
          await pool.query(
            `INSERT INTO content_assets (project_id, task_id, asset_type, name, url, provider)
             VALUES ($1, $2, 'video', $3, $4, $5)`,
            [task.project_id, id, url.split('/').pop() || 'output', url, loaded.row.provider_type],
          )
        }
      } else if (progress.status === 'failed') {
        await pool.query(
          `UPDATE content_tasks SET status = 'failed', error_message = $1, completed_at = now() WHERE id = $2`,
          [progress.error || '生成失败', id],
        )
      } else {
        await pool.query(`UPDATE content_tasks SET progress = $1 WHERE id = $2`, [progress.progress, id])
      }

      const after = await pool.query(`SELECT * FROM content_tasks WHERE id = $1`, [id])
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
      const { rows } = await pool.query(
        `SELECT * FROM content_assets
          ${projectId ? 'WHERE project_id = $1' : ''}
          ORDER BY created_at DESC LIMIT ${lim}`,
        projectId ? [parseInt(projectId, 10)] : [],
      )
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

      const { rows } = await pool.query(
        `SELECT v.*, p.platform_name, s.shop_name
           FROM video_metrics v
           LEFT JOIN system_platform_configs p ON p.platform_code = v.platform_code
           LEFT JOIN dim_shop s ON s.id = v.shop_id
           ${where}
          ORDER BY v.biz_date DESC, v.plays DESC LIMIT ${lim}`,
        params,
      )
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取视频数据失败')
    }
  })

  // ── POST /api/v1/content/video-metrics ── 手动写入视频数据（API 接口预留同一形状）
  app.post('/api/v1/content/video-metrics', async (request: FastifyRequest<{
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
  }>, reply) => {
    try {
      const b = request.body || ({} as any)
      if (!b.platformCode || !b.bizDate || !b.videoId) {
        return sendError(reply, 400, '缺少必要参数 (platformCode, bizDate, videoId)')
      }

      const { rows } = await pool.query(
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
      return sendOk(reply, rows[0], '视频数据已保存')
    } catch (err) {
      return sendError(reply, 500, '保存视频数据失败')
    }
  })
}
