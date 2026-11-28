/**
 * routes/media.ts — W11 媒体流水线
 *
 * 接口面：
 *   POST   /api/v1/media/assets                       上传源视频（multipart，流式落盘）
 *   GET    /api/v1/media/assets                       素材列表
 *   POST   /api/v1/media/assets/:id/transcribe        转写（manual / whisper）
 *   GET    /api/v1/media/assets/:id/transcript        读取转写
 *   POST   /api/v1/media/assets/:id/analyse           高光分析
 *   GET    /api/v1/media/assets/:id/highlights        高光候选
 *   POST   /api/v1/media/assets/:id/render            渲染切片
 *   GET    /api/v1/media/assets/:id/clips             切片列表
 *   POST   /api/v1/media/assets/:id/export-draft      导出剪映草稿
 *   POST   /api/v1/media/assets/:id/ingest-knowledge  转写入知识库
 *   GET    /api/v1/media/files/:kind/:tenantId/:name  受控文件下载
 */

import type { FastifyInstance } from 'fastify'
import { tenantIdOf } from '../lib/tenant-context.js'
import { createReadStream } from 'node:fs'
import { z } from 'zod'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAuth } from '../lib/guard.js'
import {
  analyseAsset,
  exportDraft,
  ingestTranscriptToKnowledge,
  listMediaAssets,
  loadTranscript,
  renderHighlights,
  resolveMediaFile,
  transcribeAsset,
  uploadMedia,
} from '../media/service.js'

const MANAGER_ROLES = ['super_admin', 'ops_director']

const transcribeSchema = z.object({
  provider: z.enum(['manual', 'whisper', 'volcengine', 'dashscope']).default('manual'),
  apiBase: z.string().max(500).optional(),
  apiKey: z.string().max(4096).optional(),
  model: z.string().max(100).optional(),
  manualContent: z.string().max(2_000_000).optional(),
})

const analyseSchema = z.object({
  windowMs: z.number().int().min(12_000).max(180_000).optional(),
  stepMs: z.number().int().min(5_000).max(120_000).optional(),
  maxCount: z.number().int().min(1).max(20).optional(),
  minScore: z.number().min(0).max(100).optional(),
})

const renderSchema = z.object({
  highlightIds: z.array(z.string().uuid()).max(20).optional(),
  width: z.number().int().min(240).max(2160).optional(),
  height: z.number().int().min(240).max(3840).optional(),
  burnSubtitle: z.boolean().optional(),
})

const exportSchema = z.object({
  clipIds: z.array(z.string().uuid()).max(50).optional(),
})

function isManager(role: string): boolean {
  return MANAGER_ROLES.includes(role)
}

export async function mediaRoutes(app: FastifyInstance) {
  // ── 上传 ──
  app.post('/api/v1/media/assets', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权上传媒体素材')

    if (!request.isMultipart()) return sendError(reply, 400, '请使用 multipart/form-data 上传')

    let title = ''
    let businessKey = ''
    let uploaded: Awaited<ReturnType<typeof uploadMedia>> | null = null

    try {
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (uploaded) {
            // 只接受单个文件，后续文件流必须消费掉，避免连接挂起
            part.file.resume()
            continue
          }
          uploaded = await uploadMedia({
            tenantId: tenantIdOf(user),
            title: title || part.filename || '未命名素材',
            originalName: part.filename || 'upload.mp4',
            stream: part.file,
            businessKey,
            userId: user.id,
            declaredSize: undefined,
          })
        } else if (part.fieldname === 'title') {
          title = String(part.value || '')
        } else if (part.fieldname === 'businessKey') {
          businessKey = String(part.value || '')
        }
      }
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '上传失败')
    }

    if (!uploaded) return sendError(reply, 400, '未收到文件')

    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'media.asset.upload',
        resourceType: 'media_assets',
        resourceId: uploaded.assetId,
        afterData: {
          durationMs: uploaded.durationMs,
          sizeBytes: uploaded.sizeBytes,
          mimeType: uploaded.mimeType,
        },
      })
    )
    return sendOk(reply, uploaded)
  })

  // ── 列表 ──
  app.get('/api/v1/media/assets', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    const items = await listMediaAssets(tenantIdOf(user), {
      status: query.status ? String(query.status).slice(0, 16) : undefined,
      limit: Number(query.limit) || 30,
    })
    return sendOk(reply, { items, total: items.length })
  })

  // ── 转写 ──
  app.post('/api/v1/media/assets/:id/transcribe', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权执行转写')

    const { id } = request.params as { id: string }
    const parsed = transcribeSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const result = await transcribeAsset({
        tenantId: tenantIdOf(user),
        assetId: id,
        ...parsed.data,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'media.asset.transcribe',
          resourceType: 'media_assets',
          resourceId: id,
          afterData: {
            provider: result.provider,
            segmentCount: result.segmentCount,
            ok: result.ok,
            error: result.error,
          },
        })
      )
      if (!result.ok) return sendError(reply, 400, result.error || '转写失败')
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '转写失败')
    }
  })

  // ── 读取转写 ──
  app.get('/api/v1/media/assets/:id/transcript', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const transcript = await loadTranscript(tenantIdOf(user), id)
    if (!transcript) return sendError(reply, 404, '尚无可用转写')
    return sendOk(reply, transcript)
  })

  // ── 高光分析 ──
  app.post('/api/v1/media/assets/:id/analyse', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权执行高光分析')

    const { id } = request.params as { id: string }
    const parsed = analyseSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const result = await analyseAsset({
        tenantId: tenantIdOf(user),
        assetId: id,
        options: parsed.data,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'media.asset.analyse',
          resourceType: 'media_assets',
          resourceId: id,
          afterData: { highlightCount: result.highlightCount },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '高光分析失败')
    }
  })

  // ── 高光列表 ──
  app.get('/api/v1/media/assets/:id/highlights', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const { rows } = await withRlsContext(request, (client) =>
      client.query<any>(
        `SELECT id, start_ms, end_ms, duration_ms, score, title, reason, score_detail, status
           FROM public.media_highlights
          WHERE tenant_id = $1 AND asset_id = $2
          ORDER BY score DESC`,
        [tenantIdOf(user), id]
      )
    )
    return sendOk(reply, {
      items: rows.map((row) => ({
        id: row.id,
        startMs: Number(row.start_ms),
        endMs: Number(row.end_ms),
        durationMs: Number(row.duration_ms),
        score: Number(row.score),
        title: row.title,
        reason: row.reason,
        scoreDetail: row.score_detail || {},
        status: row.status,
      })),
    })
  })

  // ── 渲染 ──
  app.post('/api/v1/media/assets/:id/render', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权渲染切片')

    const { id } = request.params as { id: string }
    const parsed = renderSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const result = await renderHighlights({
        tenantId: tenantIdOf(user),
        assetId: id,
        ...parsed.data,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'media.asset.render',
          resourceType: 'media_assets',
          resourceId: id,
          afterData: { rendered: result.rendered, failed: result.failed },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '渲染失败')
    }
  })

  // ── 切片列表 ──
  app.get('/api/v1/media/assets/:id/clips', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const { rows } = await withRlsContext(request, (client) =>
      client.query<any>(
        `SELECT j.id, j.highlight_id, j.status, j.stage, j.progress, j.output_path,
                j.cover_path, j.subtitle_path, j.content_asset_id, j.duration_ms,
                j.size_bytes, j.error, j.created_at, h.title, h.score
           FROM public.media_render_jobs j
           LEFT JOIN public.media_highlights h ON h.id = j.highlight_id
          WHERE j.tenant_id = $1 AND j.asset_id = $2
          ORDER BY j.created_at DESC`,
        [tenantIdOf(user), id]
      )
    )
    return sendOk(reply, {
      items: rows.map((row) => ({
        id: row.id,
        highlightId: row.highlight_id,
        status: row.status,
        stage: row.stage,
        progress: Number(row.progress) || 0,
        title: row.title || '',
        score: Number(row.score) || 0,
        durationMs: Number(row.duration_ms) || 0,
        sizeBytes: Number(row.size_bytes) || 0,
        contentAssetId: row.content_asset_id,
        error: row.error,
        createdAt: new Date(row.created_at).toISOString(),
        // 下载地址走受控端点，不暴露磁盘路径
        videoUrl: row.output_path
          ? `/api/v1/media/files/clips/${tenantIdOf(user)}/${row.output_path.split('/').pop()}`
          : '',
        coverUrl: row.cover_path
          ? `/api/v1/media/files/covers/${tenantIdOf(user)}/${row.cover_path.split('/').pop()}`
          : '',
        subtitleUrl: row.subtitle_path
          ? `/api/v1/media/files/subtitles/${tenantIdOf(user)}/${row.subtitle_path.split('/').pop()}`
          : '',
      })),
    })
  })

  // ── 导出剪映草稿 ──
  app.post('/api/v1/media/assets/:id/export-draft', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权导出草稿')

    const { id } = request.params as { id: string }
    const parsed = exportSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const result = await exportDraft({
        tenantId: tenantIdOf(user),
        assetId: id,
        clipIds: parsed.data.clipIds,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'media.asset.export_draft',
          resourceType: 'media_assets',
          resourceId: id,
          afterData: { clipCount: result.clipCount, draftPath: result.draftPath },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '导出失败')
    }
  })

  // ── 转写入知识库 ──
  app.post('/api/v1/media/assets/:id/ingest-knowledge', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权写入知识库')

    const { id } = request.params as { id: string }
    try {
      const result = await ingestTranscriptToKnowledge({
        tenantId: tenantIdOf(user),
        assetId: id,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'media.asset.ingest_knowledge',
          resourceType: 'media_assets',
          resourceId: id,
          afterData: { documentId: result.documentId, chunkCount: result.chunkCount },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '写入知识库失败')
    }
  })

  // ── 受控文件下载 ──
  app.get('/api/v1/media/files/:kind/:tenantId/:name', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const { kind, tenantId, name } = request.params as { kind: string; tenantId: string; name: string }
    const requestedTenant = Number(tenantId)
    // 非超管只能访问自己租户的文件
    if (user.role !== 'super_admin' && requestedTenant !== (tenantIdOf(user))) {
      return sendError(reply, 403, '无权访问该文件')
    }

    const filePath = resolveMediaFile(kind, requestedTenant, name)
    if (!filePath) return sendError(reply, 404, '文件不存在')

    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const contentType =
      ext === 'mp4' ? 'video/mp4'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'png' ? 'image/png'
            : ext === 'srt' ? 'text/plain; charset=utf-8'
              : ext === 'json' ? 'application/json'
                : 'application/octet-stream'

    reply.header('Content-Type', contentType)
    reply.header('Cache-Control', 'private, max-age=300')
    return reply.send(createReadStream(filePath))
  })
}