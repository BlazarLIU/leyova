/**
 * routes/video.ts — F.1 全类型自动剪辑：模板 / 装配 / 渲染质检
 *
 * 接口面：
 *   GET    /api/v1/video/templates                         模板列表（含最新版本）
 *   POST   /api/v1/video/templates                         新建模板 + v1
 *   GET    /api/v1/video/templates/:id                     模板详情 + 版本
 *   PATCH  /api/v1/video/templates/:id                     启停 / 灰度比例
 *   POST   /api/v1/video/templates/:id/versions            追加版本
 *   POST   /api/v1/video/templates/:id/versions/:vid/publish 发布版本（可灰度）
 *   GET    /api/v1/video/brand-kits|voice-profiles|bgm|subtitle-styles
 *   POST   /api/v1/video/brand-kits                        新建品牌套件
 *   GET    /api/v1/video/projects                          项目列表
 *   POST   /api/v1/video/projects                          装配项目（缺必选槽 400）
 *   GET    /api/v1/video/projects/:id                      项目详情（分镜 + 渲染）
 *   PATCH  /api/v1/video/projects/:id                      更新槽位 / 状态
 *   POST   /api/v1/video/projects/:id/render               创建渲染任务（预检门禁）
 *   GET    /api/v1/video/render-jobs/:id                   渲染任务详情
 *   PATCH  /api/v1/video/render-jobs/:id/output            回写成片元数据并质检
 */

import type { FastifyInstance } from 'fastify'
import { tenantIdOf } from '../lib/tenant-context.js'
import { z } from 'zod'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAuth } from '../lib/guard.js'
import { scanBannedWords } from '../knowledge/service.js'
import {
  assertSlots,
  buildShotPlan,
  parseTemplateDsl,
  runQualityGate,
  selectTemplateVersion,
  TemplateDslError,
  TEMPLATE_CATEGORIES,
  type TemplateDsl,
} from '../video/assembly.js'

const CONTENT_ROLES = ['super_admin', 'ops_director', 'ops_staff']

const slotValueSchema = z.record(z.string(), z.unknown())

const createTemplateSchema = z.object({
  code: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(160),
  category: z.enum(TEMPLATE_CATEGORIES),
  description: z.string().max(2000).optional(),
  dsl: z.unknown(),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  grayRatio: z.number().int().min(0).max(100).optional(),
})

const createVersionSchema = z.object({
  dsl: z.unknown(),
  changelog: z.string().max(1000).optional(),
  publish: z.boolean().optional(),
  isCanary: z.boolean().optional(),
})

const publishVersionSchema = z.object({
  isCanary: z.boolean().optional(),
})

const createProjectSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string().min(1).max(200),
  mode: z.enum(['template_fill', 'script_to_video', 'mashup']).optional(),
  automationLevel: z.enum(['L1', 'L2', 'L3']).optional(),
  businessKey: z.string().max(120).optional(),
  sourceAssetId: z.string().uuid().optional(),
  slotValues: slotValueSchema.optional(),
})

const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'assembling', 'ready', 'archived']).optional(),
  slotValues: slotValueSchema.optional(),
})

const outputSchema = z.object({
  outputPath: z.string().min(1).max(2000),
  coverPath: z.string().max(2000).optional(),
  subtitlePath: z.string().max(2000).optional(),
  durationMs: z.number().int().min(0),
  width: z.number().int().min(0),
  height: z.number().int().min(0),
  sizeBytes: z.number().int().min(0).optional(),
  loudness: z.number().min(-60).max(0).optional(),
  subtitleSegments: z.array(z.object({
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    text: z.string().max(500),
  })).optional(),
  hasBlackFrame: z.boolean().optional(),
  hasSilence: z.boolean().optional(),
  logoPresent: z.boolean().optional(),
  aiLabelPresent: z.boolean().optional(),
  contentAssetId: z.number().int().positive().optional(),
})

const createBrandKitSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  primaryColor: z.string().max(16).optional(),
  secondaryColor: z.string().max(16).optional(),
  fontFamily: z.string().max(80).optional(),
  logoPath: z.string().max(2000).optional(),
  isDefault: z.boolean().optional(),
})

function isContentRole(role: string): boolean {
  return CONTENT_ROLES.includes(role)
}

function dslError(reply: any, err: unknown) {
  const message = err instanceof TemplateDslError ? err.message : (err as Error)?.message || '模板 DSL 不合法'
  return sendError(reply, 400, message)
}

function collectSlotText(values: Record<string, unknown>): string {
  const parts: string[] = []
  for (const value of Object.values(values || {})) {
    if (typeof value === 'string') parts.push(value)
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string') parts.push(item)
    } else if (value && typeof value === 'object') parts.push(JSON.stringify(value))
  }
  return parts.join('\n')
}

async function loadTemplateWithVersion(request: any, tenantId: number, templateId: string) {
  return withRlsContext(request, async (client) => {
    const { rows } = await client.query<any>(
      `SELECT * FROM public.video_templates WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, templateId]
    )
    const template = rows[0]
    if (!template) return null
    const { rows: versions } = await client.query<any>(
      `SELECT * FROM public.template_versions
        WHERE tenant_id = $1 AND template_id = $2
        ORDER BY version DESC`,
      [tenantId, templateId]
    )
    return { template, versions }
  })
}

function mapTemplate(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    type: row.type,
    aspect: row.aspect,
    minDurationSec: Number(row.min_duration_sec),
    maxDurationSec: Number(row.max_duration_sec),
    description: row.description,
    status: row.status,
    grayRatio: Number(row.gray_ratio),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function mapVersion(row: any) {
  return {
    id: row.id,
    version: Number(row.version),
    status: row.status,
    isCanary: Boolean(row.is_canary),
    changelog: row.changelog,
    dsl: row.dsl,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function videoRoutes(app: FastifyInstance) {
  // ── 模板列表 ──
  app.get('/api/v1/video/templates', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    const params: unknown[] = [tenantIdOf(user)]
    let where = 't.tenant_id = $1'
    if (query.category) {
      params.push(String(query.category))
      where += ` AND t.category = $${params.length}`
    }
    if (query.status) {
      params.push(String(query.status))
      where += ` AND t.status = $${params.length}`
    }
    const { rows } = await withRlsContext(request, (client) =>
      client.query<any>(
        `SELECT t.*,
                (SELECT count(*) FROM public.template_versions v WHERE v.template_id = t.id) AS version_count,
                (SELECT max(version) FROM public.template_versions v WHERE v.template_id = t.id AND v.status = 'published') AS latest_version
           FROM public.video_templates t
          WHERE ${where}
          ORDER BY t.category, t.created_at DESC`,
        params
      )
    )
    return sendOk(reply, {
      items: rows.map((row) => ({
        ...mapTemplate(row),
        versionCount: Number(row.version_count) || 0,
        latestVersion: row.latest_version == null ? null : Number(row.latest_version),
      })),
    })
  })

  // ── 新建模板 ──
  app.post('/api/v1/video/templates', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权创建模板')

    const parsed = createTemplateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    let dsl: TemplateDsl
    try {
      dsl = parseTemplateDsl(parsed.data.dsl)
    } catch (err) {
      return dslError(reply, err)
    }

    const tenantId = tenantIdOf(user)
    try {
      const templateId = await withRlsContext(request, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO public.video_templates
             (tenant_id, code, name, category, type, aspect, min_duration_sec, max_duration_sec,
              description, status, gray_ratio, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', 100, $10)
           RETURNING id`,
          [
            tenantId,
            String(parsed.data.code || dsl.template).slice(0, 60),
            parsed.data.name,
            parsed.data.category,
            dsl.type,
            dsl.aspect,
            dsl.duration.min,
            dsl.duration.max,
            parsed.data.description || '',
            user.id,
          ]
        )
        const tId = rows[0].id
        await client.query(
          `INSERT INTO public.template_versions (tenant_id, template_id, version, dsl, changelog, status, created_by)
           VALUES ($1, $2, 1, $3::jsonb, '初始版本', 'published', $4)`,
          [tenantId, tId, JSON.stringify(dsl), user.id]
        )
        await writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'video.template.create',
          resourceType: 'video_templates',
          resourceId: tId,
          afterData: { code: parsed.data.code || dsl.template, category: parsed.data.category },
        })
        return tId
      })
      return sendOk(reply, { id: templateId, version: 1 })
    } catch (err) {
      const message = (err as any)?.code === '23505' ? '模板 code 已存在' : (err as Error)?.message || '创建模板失败'
      return sendError(reply, 400, message)
    }
  })

  // ── 模板详情 ──
  app.get('/api/v1/video/templates/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const detail = await loadTemplateWithVersion(request, tenantIdOf(user), id)
    if (!detail) return sendError(reply, 404, '模板不存在')
    return sendOk(reply, {
      ...mapTemplate(detail.template),
      versions: detail.versions.map(mapVersion),
    })
  })

  // ── 更新模板（启停 / 灰度）──
  app.patch('/api/v1/video/templates/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权修改模板')
    const { id } = request.params as { id: string }
    const parsed = updateTemplateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const data = parsed.data
    const sets: string[] = []
    const params: unknown[] = [tenantIdOf(user), id]
    const add = (column: string, value: unknown) => {
      params.push(value)
      sets.push(`${column} = $${params.length}`)
    }
    if (data.name !== undefined) add('name', data.name)
    if (data.description !== undefined) add('description', data.description)
    if (data.status !== undefined) add('status', data.status)
    if (data.grayRatio !== undefined) add('gray_ratio', data.grayRatio)
    if (sets.length === 0) return sendError(reply, 400, '没有需要更新的字段')

    const updated = await withRlsContext(request, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE public.video_templates SET ${sets.join(', ')}, updated_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        params
      )
      if (!rowCount) return false

      await writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'video.template.update',
        resourceType: 'video_templates',
        resourceId: id,
        afterData: data,
      })
      return true
    })
    if (!updated) return sendError(reply, 404, '模板不存在')
    return sendOk(reply, { id, updated: true })
  })

  // ── 追加版本 ──
  app.post('/api/v1/video/templates/:id/versions', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权修改模板')
    const { id } = request.params as { id: string }
    const parsed = createVersionSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    let dsl: TemplateDsl
    try {
      dsl = parseTemplateDsl(parsed.data.dsl)
    } catch (err) {
      return dslError(reply, err)
    }

    const tenantId = tenantIdOf(user)
    const detail = await loadTemplateWithVersion(request, tenantId, id)
    if (!detail) return sendError(reply, 404, '模板不存在')

    const nextVersion = detail.versions.reduce((max, item) => Math.max(max, Number(item.version)), 0) + 1
    const publish = parsed.data.publish === true
    const isCanary = parsed.data.isCanary === true
    try {
      const versionResult = await withRlsContext(request, async (client) => {
        if (publish && !isCanary) {
          await client.query(
            `UPDATE public.template_versions SET status = 'archived'
              WHERE tenant_id = $1 AND template_id = $2 AND status = 'published' AND is_canary = false`,
            [tenantId, id]
          )
        }
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO public.template_versions
             (tenant_id, template_id, version, dsl, changelog, status, is_canary, created_by)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
           RETURNING id`,
          [
            tenantId,
            id,
            nextVersion,
            JSON.stringify(dsl),
            parsed.data.changelog || '',
            publish ? 'published' : 'draft',
            isCanary,
            user.id,
          ]
        )
        return { id: rows[0].id, version: nextVersion, status: publish ? 'published' : 'draft' }
      })
      return sendOk(reply, versionResult)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '创建版本失败')
    }
  })

  // ── 发布版本（可灰度）──
  app.post('/api/v1/video/templates/:id/versions/:versionId/publish', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权发布模板')
    const { id, versionId } = request.params as { id: string; versionId: string }
    const parsed = publishVersionSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const tenantId = tenantIdOf(user)
    const isCanary = parsed.data.isCanary === true

    try {
      const publishedResult = await withRlsContext(request, async (client) => {
        if (!isCanary) {
          await client.query(
            `UPDATE public.template_versions SET status = 'archived'
              WHERE tenant_id = $1 AND template_id = $2 AND status = 'published' AND is_canary = false AND id <> $3`,
            [tenantId, id, versionId]
          )
        }
        const { rowCount } = await client.query(
          `UPDATE public.template_versions SET status = 'published', is_canary = $4
            WHERE tenant_id = $1 AND template_id = $2 AND id = $3`,
          [tenantId, id, versionId, isCanary]
        )
        if (!rowCount) return null
        return { id: versionId, published: true, isCanary }
      })
      if (!publishedResult) return sendError(reply, 404, '模板版本不存在')
      return sendOk(reply, publishedResult)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '发布失败')
    }
  })

  // ── 品牌资产列表 ──
  for (const resource of [
    { path: '/api/v1/video/brand-kits', table: 'brand_kits', order: 'is_default DESC, created_at ASC' },
    { path: '/api/v1/video/voice-profiles', table: 'voice_profiles', order: 'created_at ASC' },
    { path: '/api/v1/video/bgm', table: 'bgm_library', order: 'created_at ASC' },
    { path: '/api/v1/video/subtitle-styles', table: 'subtitle_styles', order: 'created_at ASC' },
  ]) {
    app.get(resource.path, async (request, reply) => {
      const user = await requireAuth(request, reply)
      if (!user) return
      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query<any>(
          `SELECT * FROM public.${resource.table} WHERE tenant_id = $1 ORDER BY ${resource.order}`,
          [tenantIdOf(user)]
        )
        return res.rows
      })
      return sendOk(reply, { items: rows })
    })
  }

  // ── 新建品牌套件 ──
  app.post('/api/v1/video/brand-kits', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权创建品牌套件')
    const parsed = createBrandKitSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const data = parsed.data
    const tenantId = tenantIdOf(user)
    try {
      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query<{ id: string }>(
          `INSERT INTO public.brand_kits
             (tenant_id, code, name, primary_color, secondary_color, font_family, logo_path, is_default, created_by)
           VALUES ($1, $2, $3, COALESCE($4, '#111827'), COALESCE($5, '#F59E0B'),
                   COALESCE($6, 'Source Han Sans SC'), COALESCE($7, ''), $8, $9)
           RETURNING id`,
          [tenantId, data.code, data.name, data.primaryColor, data.secondaryColor, data.fontFamily, data.logoPath, data.isDefault === true, user.id]
        )
        return res.rows
      })
      return sendOk(reply, { id: rows[0].id })
    } catch (err) {
      const message = (err as any)?.code === '23505' ? '品牌套件 code 已存在' : (err as Error)?.message || '创建失败'
      return sendError(reply, 400, message)
    }
  })

  // ── 项目列表 ──
  app.get('/api/v1/video/projects', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    const params: unknown[] = [tenantIdOf(user)]
    let where = 'p.tenant_id = $1'
    if (query.status) {
      params.push(String(query.status))
      where += ` AND p.status = $${params.length}`
    }
    params.push(Math.min(100, Math.max(1, Number(query.limit) || 30)))
    const rows = await withRlsContext(request, async (client) => {
      const res = await client.query<any>(
        `SELECT p.*, t.name AS template_name, t.category AS template_category,
                (SELECT count(*) FROM public.shot_items s WHERE s.project_id = p.id) AS shot_count,
                (SELECT status FROM public.render_jobs j WHERE j.project_id = p.id ORDER BY j.queued_at DESC LIMIT 1) AS latest_job_status
           FROM public.video_projects p
           JOIN public.video_templates t ON t.id = p.template_id
          WHERE ${where}
          ORDER BY p.created_at DESC
          LIMIT $${params.length}`,
        params
      )
      return res.rows
    })
    return sendOk(reply, {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        templateId: row.template_id,
        templateName: row.template_name,
        templateCategory: row.template_category,
        mode: row.mode,
        aspect: row.aspect,
        status: row.status,
        automationLevel: row.automation_level,
        businessKey: row.business_key,
        shotCount: Number(row.shot_count) || 0,
        latestJobStatus: row.latest_job_status || null,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    })
  })

  // ── 装配项目 ──
  app.post('/api/v1/video/projects', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权创建项目')

    const parsed = createProjectSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const body = parsed.data
    const tenantId = tenantIdOf(user)

    const detail = await loadTemplateWithVersion(request, tenantId, body.templateId)
    if (!detail) return sendError(reply, 404, '模板不存在')
    if (detail.template.status !== 'active') return sendError(reply, 400, '模板已停用，无法装配')

    const version = selectTemplateVersion(detail.versions as any, Number(detail.template.gray_ratio))
    if (!version) return sendError(reply, 400, '模板没有已发布版本')

    let dsl: TemplateDsl
    try {
      dsl = parseTemplateDsl((version as any).dsl)
      assertSlots(dsl, body.slotValues)
    } catch (err) {
      return dslError(reply, err)
    }

    try {
      const result = await withRlsContext(request, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO public.video_projects
             (tenant_id, template_id, template_version_id, title, mode, aspect, status,
              slot_values, source_asset_id, business_key, automation_level, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'ready', $7::jsonb, $8, $9, $10, $11)
           RETURNING id`,
          [
            tenantId,
            body.templateId,
            version.id || null,
            body.title,
            body.mode || (dsl.type === 'selection' ? 'template_fill' : 'template_fill'),
            dsl.aspect,
            JSON.stringify(body.slotValues || {}),
            body.sourceAssetId || null,
            body.businessKey || '',
            body.automationLevel || (dsl.type === 'assembly' ? 'L1' : 'L2'),
            user.id,
          ]
        )
        const projectId = rows[0].id
        const plan = buildShotPlan(dsl, body.slotValues || {})
        for (const shot of plan) {
          await client.query(
            `INSERT INTO public.shot_items
               (tenant_id, project_id, seq, shot_type, title, script_text, subtitle_text, duration_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tenantId, projectId, shot.seq, shot.shotType, shot.title, shot.scriptText, shot.subtitleText, shot.durationMs]
          )
        }

        await writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'video.project.create',
          resourceType: 'video_projects',
          resourceId: projectId,
          afterData: { templateId: body.templateId, templateVersion: version.version, shotCount: plan.length },
        })
        return { id: projectId, templateVersion: version.version, shotCount: plan.length }
      })
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '创建项目失败')
    }
  })

  // ── 项目详情 ──
  app.get('/api/v1/video/projects/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const tenantId = tenantIdOf(user)
    const data = await withRlsContext(request, async (client) => {
      const { rows } = await client.query<any>(
        `SELECT p.*, t.name AS template_name, t.category AS template_category
           FROM public.video_projects p
           JOIN public.video_templates t ON t.id = p.template_id
          WHERE p.tenant_id = $1 AND p.id = $2 LIMIT 1`,
        [tenantId, id]
      )
      const project = rows[0]
      if (!project) return null

      const { rows: shots } = await client.query<any>(
        `SELECT * FROM public.shot_items WHERE tenant_id = $1 AND project_id = $2 ORDER BY seq ASC`,
        [tenantId, id]
      )
      const { rows: jobs } = await client.query<any>(
        `SELECT j.*, o.id AS output_id, o.output_path, o.cover_path, o.duration_ms AS output_duration_ms,
                o.width, o.height, o.size_bytes, o.loudness, o.qc
           FROM public.render_jobs j
           LEFT JOIN public.render_outputs o ON o.job_id = j.id
          WHERE j.tenant_id = $1 AND j.project_id = $2
          ORDER BY j.queued_at DESC`,
        [tenantId, id]
      )
      return { project, shots, jobs }
    })
    if (!data) return sendError(reply, 404, '项目不存在')
    const { project, shots, jobs } = data

    return sendOk(reply, {
      id: project.id,
      title: project.title,
      templateId: project.template_id,
      templateVersionId: project.template_version_id,
      templateName: project.template_name,
      templateCategory: project.template_category,
      mode: project.mode,
      aspect: project.aspect,
      status: project.status,
      automationLevel: project.automation_level,
      businessKey: project.business_key,
      slotValues: project.slot_values || {},
      sourceAssetId: project.source_asset_id,
      createdAt: new Date(project.created_at).toISOString(),
      shots: shots.map((shot: any) => ({
        id: shot.id,
        seq: Number(shot.seq),
        shotType: shot.shot_type,
        title: shot.title,
        scriptText: shot.script_text,
        subtitleText: shot.subtitle_text,
        durationMs: Number(shot.duration_ms),
        transition: shot.transition,
      })),
      renderJobs: jobs.map((job: any) => ({
        id: job.id,
        status: job.status,
        stage: job.stage,
        progress: Number(job.progress),
        gatePassed: job.gate_passed,
        gateResult: job.gate_result || {},
        error: job.error,
        queuedAt: new Date(job.queued_at).toISOString(),
        output: job.output_id ? {
          id: job.output_id,
          outputPath: job.output_path,
          coverPath: job.cover_path,
          durationMs: Number(job.output_duration_ms) || 0,
          width: Number(job.width) || 0,
          height: Number(job.height) || 0,
          sizeBytes: Number(job.size_bytes) || 0,
          loudness: job.loudness == null ? null : Number(job.loudness),
          qc: job.qc || {},
        } : null,
      })),
    })
  })

  // ── 更新项目槽位 ──
  app.patch('/api/v1/video/projects/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权修改项目')
    const { id } = request.params as { id: string }
    const parsed = updateProjectSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const tenantId = tenantIdOf(user)
    const data = parsed.data

    const project = await withRlsContext(request, async (client) => {
      const { rows } = await client.query<any>(
        `SELECT p.*, t.gray_ratio FROM public.video_projects p
           JOIN public.video_templates t ON t.id = p.template_id
          WHERE p.tenant_id = $1 AND p.id = $2 LIMIT 1`,
        [tenantId, id]
      )
      return rows[0]
    })
    if (!project) return sendError(reply, 404, '项目不存在')

    let slotValues = project.slot_values
    if (data.slotValues) {
      const detail = await loadTemplateWithVersion(request, tenantId, project.template_id)
      const version = project.template_version_id
        ? detail?.versions.find((item: any) => item.id === project.template_version_id)
        : selectTemplateVersion((detail?.versions || []) as any, Number(project.gray_ratio))
      if (!version) return sendError(reply, 400, '模板版本不存在')
      try {
        const dsl = parseTemplateDsl((version as any).dsl)
        assertSlots(dsl, data.slotValues)
      } catch (err) {
        return dslError(reply, err)
      }
      slotValues = data.slotValues
    }

    const sets: string[] = ['updated_at = now()']
    const params: unknown[] = [tenantId, id]
    const add = (column: string, value: unknown) => {
      params.push(value)
      sets.push(`${column} = $${params.length}`)
    }
    if (data.title !== undefined) add('title', data.title)
    if (data.status !== undefined) add('status', data.status)
    if (data.slotValues !== undefined) add('slot_values', JSON.stringify(slotValues))

    await withRlsContext(request, async (client) => {
      await client.query(
        `UPDATE public.video_projects SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
        params
      )
    })
    return sendOk(reply, { id, updated: true })
  })

  // ── 创建渲染任务（预检门禁）──
  app.post('/api/v1/video/projects/:id/render', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权发起渲染')

    const { id } = request.params as { id: string }
    const tenantId = tenantIdOf(user)
    const project = await withRlsContext(request, async (client) => {
      const { rows } = await client.query<any>(
        `SELECT p.*, t.gray_ratio, t.status AS template_status
           FROM public.video_projects p
           JOIN public.video_templates t ON t.id = p.template_id
          WHERE p.tenant_id = $1 AND p.id = $2 LIMIT 1`,
        [tenantId, id]
      )
      return rows[0]
    })
    if (!project) return sendError(reply, 404, '项目不存在')
    if (project.template_status !== 'active') return sendError(reply, 400, '模板已停用')

    const detail = await loadTemplateWithVersion(request, tenantId, project.template_id)
    const version = project.template_version_id
      ? detail?.versions.find((item: any) => item.id === project.template_version_id)
      : selectTemplateVersion((detail?.versions || []) as any, Number(project.gray_ratio))
    if (!version) return sendError(reply, 400, '模板没有已发布版本')

    let dsl: TemplateDsl
    try {
      dsl = parseTemplateDsl((version as any).dsl)
      assertSlots(dsl, project.slot_values)
    } catch (err) {
      return dslError(reply, err)
    }

    const text = collectSlotText(project.slot_values || {})
    const banned = text ? await scanBannedWords({ tenantId, text }) : { matched: [], ruleCount: 0 }
    const hardHits = (banned.matched || []).filter((hit: any) => {
      const action = String(hit.action || '').toLowerCase()
      const severity = String(hit.severity || '').toLowerCase()
      return action === 'block' || severity === 'high' || severity === 'critical'
    })
    const precheck = {
      passed: hardHits.length === 0,
      stage: 'precheck',
      checks: [
        { key: 'slots', label: '必选槽位', passed: true, detail: `${dsl.slots.filter((slot) => slot.required).length} 个必选槽已填` },
        {
          key: 'banned_words',
          label: '违禁词预检',
          passed: hardHits.length === 0,
          detail: hardHits.length === 0 ? '未命中拦截级违禁词' : hardHits.map((hit: any) => hit.word).join(' / '),
        },
      ],
      blockers: hardHits.length === 0 ? [] : ['违禁词预检'],
      ruleCount: banned.ruleCount || 0,
    }

    const { jobId } = await withRlsContext(request, async (client) => {
      const { rows: jobRows } = await client.query<{ id: string }>(
        `INSERT INTO public.render_jobs
           (tenant_id, project_id, status, stage, progress, gate_passed, gate_result, options, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
         RETURNING id`,
        [
          tenantId,
          id,
          precheck.passed ? 'queued' : 'failed',
          precheck.passed ? 'queued' : 'failed',
          precheck.passed ? 0 : 100,
          precheck.passed ? null : false,
          JSON.stringify(precheck),
          JSON.stringify({ templateVersion: version.version, aspect: dsl.aspect }),
          user.id,
        ]
      )
      const createdJobId = jobRows[0].id
      await client.query(
        `UPDATE public.video_projects SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id, precheck.passed ? 'rendering' : 'failed']
      )

      await writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'video.project.render',
        resourceType: 'render_jobs',
        resourceId: createdJobId,
        afterData: { projectId: id, precheckPassed: precheck.passed },
      })
      return { jobId: createdJobId }
    })

    if (!precheck.passed) {
      return sendError(reply, 400, `预检未通过：${precheck.blockers.join('、')}`)
    }
    return sendOk(reply, { jobId, status: 'queued', gateResult: precheck })
  })

  // ── 渲染任务详情 ──
  app.get('/api/v1/video/render-jobs/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const job = await withRlsContext(request, async (client) => {
      const { rows } = await client.query<any>(
        `SELECT j.*, o.id AS output_id, o.output_path, o.cover_path, o.duration_ms AS output_duration_ms,
                o.width, o.height, o.size_bytes, o.loudness, o.qc
           FROM public.render_jobs j
           LEFT JOIN public.render_outputs o ON o.job_id = j.id
          WHERE j.tenant_id = $1 AND j.id = $2 LIMIT 1`,
        [tenantIdOf(user), id]
      )
      return rows[0]
    })
    if (!job) return sendError(reply, 404, '渲染任务不存在')
    return sendOk(reply, {
      id: job.id,
      projectId: job.project_id,
      status: job.status,
      stage: job.stage,
      progress: Number(job.progress),
      gatePassed: job.gate_passed,
      gateResult: job.gate_result || {},
      error: job.error,
      output: job.output_id ? {
        id: job.output_id,
        outputPath: job.output_path,
        coverPath: job.cover_path,
        durationMs: Number(job.output_duration_ms) || 0,
        width: Number(job.width) || 0,
        height: Number(job.height) || 0,
        sizeBytes: Number(job.size_bytes) || 0,
        loudness: job.loudness == null ? null : Number(job.loudness),
        qc: job.qc || {},
      } : null,
    })
  })

  // ── 回写成片并质检 ──
  app.patch('/api/v1/video/render-jobs/:id/output', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权回写渲染产物')

    const { id } = request.params as { id: string }
    const parsed = outputSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const body = parsed.data
    const tenantId = tenantIdOf(user)

    const job = await withRlsContext(request, async (client) => {
      const { rows } = await client.query<any>(
        `SELECT j.*, p.slot_values, p.template_version_id, p.template_id, t.gray_ratio, t.type AS template_type
           FROM public.render_jobs j
           JOIN public.video_projects p ON p.id = j.project_id
           JOIN public.video_templates t ON t.id = p.template_id
          WHERE j.tenant_id = $1 AND j.id = $2 LIMIT 1`,
        [tenantId, id]
      )
      return rows[0]
    })
    if (!job) return sendError(reply, 404, '渲染任务不存在')
    if (job.status === 'succeeded') return sendError(reply, 400, '该任务已完成')

    const detail = await loadTemplateWithVersion(request, tenantId, job.template_id)
    const version = job.template_version_id
      ? detail?.versions.find((item: any) => item.id === job.template_version_id)
      : selectTemplateVersion((detail?.versions || []) as any, Number(job.gray_ratio))
    if (!version) return sendError(reply, 400, '模板版本不存在')

    let dsl: TemplateDsl
    try {
      dsl = parseTemplateDsl((version as any).dsl)
    } catch (err) {
      return dslError(reply, err)
    }

    const text = collectSlotText(job.slot_values || {})
    const banned = text ? await scanBannedWords({ tenantId, text }) : { matched: [] }
    const generated = dsl.rules.ai_label === 'if_generated' && dsl.type !== 'selection'
    const gate = runQualityGate({
      dsl,
      durationMs: body.durationMs,
      width: body.width,
      height: body.height,
      loudness: body.loudness,
      subtitleSegments: body.subtitleSegments,
      hasBlackFrame: body.hasBlackFrame,
      hasSilence: body.hasSilence,
      logoPresent: body.logoPresent,
      aiLabelPresent: body.aiLabelPresent,
      generated,
      bannedHits: banned.matched as any,
    })

    if (!gate.passed) {
      await withRlsContext(request, async (client) => {
        await client.query(
          `UPDATE public.render_jobs
              SET status = 'failed', stage = 'failed', progress = 100, gate_passed = false,
                  gate_result = $2::jsonb, error = $3, finished_at = now()
            WHERE id = $1`,
          [id, JSON.stringify(gate), `质检未通过：${gate.blockers.join('、')}`.slice(0, 1000)]
        )
        await client.query(
          `UPDATE public.video_projects SET status = 'failed', updated_at = now() WHERE id = $1`,
          [job.project_id]
        )
      })
      return sendOk(reply, { passed: false, gateResult: gate })
    }

    try {
      const outputRows = await withRlsContext(request, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO public.render_outputs
             (tenant_id, job_id, output_path, cover_path, subtitle_path, duration_ms, width, height,
              size_bytes, loudness, content_asset_id, qc)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
           RETURNING id`,
          [
            tenantId,
            id,
            body.outputPath,
            body.coverPath || '',
            body.subtitlePath || '',
            body.durationMs,
            body.width,
            body.height,
            body.sizeBytes || 0,
            body.loudness ?? null,
            body.contentAssetId ?? null,
            JSON.stringify(gate),
          ]
        )
        await client.query(
          `UPDATE public.render_jobs
              SET status = 'succeeded', stage = 'done', progress = 100, gate_passed = true,
                  gate_result = $2::jsonb, finished_at = now()
            WHERE id = $1`,
          [id, JSON.stringify(gate)]
        )
        await client.query(
          `UPDATE public.video_projects SET status = 'rendered', updated_at = now() WHERE id = $1`,
          [job.project_id]
        )
        return rows
      })
      return sendOk(reply, { passed: true, outputId: outputRows[0].id, gateResult: gate })
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '回写失败')
    }
  })
}
