/**
 * routes/generation.ts — W10 PromptOps 与生成/审核
 *
 * 接口面：
 *   GET    /api/v1/prompts/templates                 模板列表
 *   POST   /api/v1/prompts/templates                 新建模板（含 v1）
 *   GET    /api/v1/prompts/templates/:key/versions   版本列表
 *   POST   /api/v1/prompts/templates/:key/versions   新增版本
 *   POST   /api/v1/prompts/templates/:key/canary     设置灰度
 *   POST   /api/v1/prompts/templates/:key/rollback   回滚到指定版本
 *   POST   /api/v1/generation/drafts                 生成草稿
 *   GET    /api/v1/generation/drafts                 草稿/审核队列
 *   POST   /api/v1/generation/drafts/:id/review      采纳或驳回
 *   GET    /api/v1/generation/stats                  采纳率统计
 */

import type { FastifyInstance } from 'fastify'
import { tenantIdOf } from '../lib/tenant-context.js'
import { z } from 'zod'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAuth } from '../lib/guard.js'
import {
  addVersion,
  createTemplate,
  getTemplate,
  listTemplates,
  listVersions,
  rollback,
  setCanary,
} from '../generation/prompts.js'
import { generateDraft, generationStats, listDrafts, reviewDraft } from '../generation/service.js'

const MANAGER_ROLES = ['super_admin', 'ops_director']

const variableSchema = z.object({
  name: z.string().trim().min(1).max(64),
  required: z.boolean().optional(),
  description: z.string().max(200).optional(),
})

const templateCreateSchema = z.object({
  key: z.string().trim().min(1).max(64).regex(/^[a-z0-9_]+$/, 'key 只能包含小写字母、数字与下划线'),
  name: z.string().trim().min(1).max(120),
  scene: z.enum(['script', 'copy', 'title', 'reply', 'analysis']),
  platform: z.string().max(32).optional(),
  category: z.string().max(64).optional(),
  description: z.string().max(2000).optional(),
  variables: z.array(variableSchema).max(30).optional(),
  systemPrompt: z.string().min(1).max(20000),
  userTemplate: z.string().min(1).max(20000),
  outputSchema: z.string().max(5000).optional(),
})

const versionCreateSchema = z.object({
  systemPrompt: z.string().min(1).max(20000),
  userTemplate: z.string().min(1).max(20000),
  outputSchema: z.string().max(5000).optional(),
  notes: z.string().max(500).optional(),
  activate: z.boolean().optional(),
})

const canarySchema = z.object({
  version: z.number().int().min(1),
  ratio: z.number().int().min(0).max(100),
})

const rollbackSchema = z.object({
  version: z.number().int().min(1),
})

const generateSchema = z.object({
  templateKey: z.string().trim().min(1).max(64),
  variables: z.record(z.string(), z.unknown()),
  platform: z.string().max(32).optional(),
  businessKey: z.string().max(120).optional(),
  title: z.string().max(255).optional(),
  version: z.number().int().min(1).optional(),
})

const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
  writeToLibrary: z.boolean().optional(),
})

function isManager(role: string): boolean {
  return MANAGER_ROLES.includes(role)
}

export async function generationRoutes(app: FastifyInstance) {
  // ── 模板列表 ──
  app.get('/api/v1/prompts/templates', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const items = await listTemplates(tenantIdOf(user))
    return sendOk(reply, { items, total: items.length })
  })

  // ── 新建模板 ──
  app.post('/api/v1/prompts/templates', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权维护提示词模板')

    const parsed = templateCreateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    try {
      const created = await createTemplate({
        tenantId: tenantIdOf(user),
        ...parsed.data,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'prompt.template.create',
          resourceType: 'prompt_templates',
          resourceId: created.key,
          afterData: { key: created.key, scene: created.scene },
        })
      )
      return sendOk(reply, created)
    } catch (err) {
      const message = (err as Error)?.message || '创建失败'
      return sendError(reply, message.includes('uq_prompt_template_key') ? 409 : 400, message)
    }
  })

  // ── 版本列表 ──
  app.get('/api/v1/prompts/templates/:key/versions', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { key } = request.params as { key: string }
    const template = await getTemplate(tenantIdOf(user), key)
    if (!template) return sendError(reply, 404, '模板不存在')
    const items = await listVersions(tenantIdOf(user), key)
    return sendOk(reply, { template, items, total: items.length })
  })

  // ── 新增版本 ──
  app.post('/api/v1/prompts/templates/:key/versions', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权维护提示词版本')

    const { key } = request.params as { key: string }
    const parsed = versionCreateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    try {
      const result = await addVersion({
        tenantId: tenantIdOf(user),
        templateKey: key,
        ...parsed.data,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'prompt.version.create',
          resourceType: 'prompt_versions',
          resourceId: `${key}#v${result.version}`,
          afterData: { version: result.version, activate: parsed.data.activate === true },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '新增版本失败')
    }
  })

  // ── 灰度 ──
  app.post('/api/v1/prompts/templates/:key/canary', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权设置灰度')

    const { key } = request.params as { key: string }
    const parsed = canarySchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const updated = await setCanary({
        tenantId: tenantIdOf(user),
        templateKey: key,
        version: parsed.data.version,
        ratio: parsed.data.ratio,
      })
      if (!updated) return sendError(reply, 404, '模板不存在')

      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'prompt.canary.set',
          resourceType: 'prompt_templates',
          resourceId: key,
          afterData: { version: parsed.data.version, ratio: parsed.data.ratio },
        })
      )
      return sendOk(reply, updated)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '设置灰度失败')
    }
  })

  // ── 回滚 ──
  app.post('/api/v1/prompts/templates/:key/rollback', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权回滚版本')

    const { key } = request.params as { key: string }
    const parsed = rollbackSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const updated = await rollback({
        tenantId: tenantIdOf(user),
        templateKey: key,
        version: parsed.data.version,
      })
      if (!updated) return sendError(reply, 404, '模板不存在')

      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'prompt.rollback',
          resourceType: 'prompt_templates',
          resourceId: key,
          afterData: { version: parsed.data.version },
        })
      )
      return sendOk(reply, updated)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '回滚失败')
    }
  })

  // ── 生成 ──
  app.post('/api/v1/generation/drafts', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权执行生成')

    const parsed = generateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    try {
      const result = await generateDraft({
        tenantId: tenantIdOf(user),
        role: user.role,
        userId: user.id,
        ...parsed.data,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: result.compliance.blocked ? 'generation.draft.blocked' : 'generation.draft.create',
          resourceType: 'ai_generation_drafts',
          resourceId: result.draftId,
          afterData: {
            templateKey: result.templateKey,
            templateVersion: result.templateVersion,
            isCanary: result.isCanary,
            status: result.status,
            blockedWords: result.compliance.hits.map((hit) => hit.word),
            citations: result.citations.length,
            degraded: result.degraded,
          },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '生成失败')
    }
  })

  // ── 草稿 / 审核队列 ──
  app.get('/api/v1/generation/drafts', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    const items = await listDrafts(tenantIdOf(user), {
      status: query.status ? String(query.status).slice(0, 16) : undefined,
      templateKey: query.templateKey ? String(query.templateKey).slice(0, 64) : undefined,
      limit: Number(query.limit) || 30,
    })
    return sendOk(reply, { items, total: items.length })
  })

  // ── 审核 ──
  app.post('/api/v1/generation/drafts/:id/review', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权审核生成内容')

    const { id } = request.params as { id: string }
    const parsed = reviewSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const result = await reviewDraft({
        tenantId: tenantIdOf(user),
        draftId: id,
        ...parsed.data,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: `generation.draft.${parsed.data.decision}`,
          resourceType: 'ai_generation_drafts',
          resourceId: id,
          afterData: { status: result.status, scriptId: result.scriptId },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '审核失败')
    }
  })

  // ── 统计 ──
  app.get('/api/v1/generation/stats', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    return sendOk(reply, await generationStats(tenantIdOf(user)))
  })
}