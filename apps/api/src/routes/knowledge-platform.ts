/**
 * routes/knowledge-platform.ts — W9 本地知识平台
 *
 * 与已有的 /api/v1/kb/*（外部 RAGFlow/MaxKB 客户端）并存：
 *   - /kb/*     ：外部知识库配置与代理检索（保持原行为）
 *   - /kb/collections 等：本地 pgvector 知识平台（本文件）
 *
 * 接口面：
 *   GET    /api/v1/kb/collections                 集合列表
 *   PUT    /api/v1/kb/collections/:code           更新集合（embedding 模型/分块）
 *   GET    /api/v1/kb/documents                   文档列表
 *   POST   /api/v1/kb/documents                   入库（文本 / 转写片段）
 *   DELETE /api/v1/kb/documents/:id               删除文档（级联切片）
 *   GET    /api/v1/kb/chunks/:id                  引用回溯
 *   GET    /api/v1/kb/ingest-jobs                 入库任务
 *   GET    /api/v1/kb/retrieve                    混合检索（本地 pgvector）
 *   POST   /api/v1/kb/retrieve                    同上（JSON body）
 *   GET    /api/v1/kb/stats                       平台统计
 *   GET    /api/v1/kb/banned-words                违禁词列表
 *   POST   /api/v1/kb/banned-words                新增/更新违禁词
 *   DELETE /api/v1/kb/banned-words/:id            删除违禁词
 *   POST   /api/v1/kb/banned-words/scan           违禁词扫描
 *   POST   /api/v1/kb/feedback                    检索反馈
 */

import type { FastifyInstance } from 'fastify'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import * as XLSX from 'xlsx'
import { tenantIdOf } from '../lib/tenant-context.js'
import { z } from 'zod'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { DEFAULT_BANNED_RULES } from '../knowledge/banned-words.js'
import { testEmbeddingConnection } from '../knowledge/embedding.js'
import { assertEndpointAllowed } from '../integrations/connectors.js'
import {
  createCollection,
  deleteBannedWord,
  deleteCollection,
  getChunkTrail,
  getCollectionByCode,
  getDocumentDetail,
  ingestDocument,
  isRuleOnlyCollection,
  knowledgeStats,
  listBannedWords,
  listCollections,
  listDocuments,
  scanBannedWords,
  searchKnowledge,
  updateBannedWord,
  updateCollection,
  updateDocument,
  upsertBannedWord,
} from '../knowledge/service.js'

const execFileAsync = promisify(execFile)

const MANAGEMENT_ROLES = ['super_admin', 'ops_director', 'ops_lead', 'ops_staff']

const collectionCreateSchema = z.object({
  code: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(120),
  domain: z.enum(['product', 'script', 'banned', 'replay', 'document']).optional(),
  description: z.string().max(2000).optional(),
  chunkSize: z.number().int().min(100).max(4000).optional(),
  chunkOverlap: z.number().int().min(0).max(2000).optional(),
})

const collectionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  domain: z.enum(['product', 'script', 'banned', 'replay', 'document']).optional(),
  embeddingProvider: z.string().max(64).optional(),
  embeddingApiBase: z.string().max(500).optional(),
  embeddingModel: z.string().max(120).optional(),
  chunkSize: z.number().int().min(100).max(4000).optional(),
  chunkOverlap: z.number().int().min(0).max(2000).optional(),
  description: z.string().max(2000).optional(),
})

const docUpdateSchema = z.object({
  collectionCode: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().max(200000).optional(),
  businessKey: z.string().max(120).optional(),
})

/** 从上传文件中提取纯文本（支持 txt / md / csv / json / xlsx / xls / pdf / docx） */
async function extractTextFromUpload(filename: string, buffer: Buffer): Promise<string> {
  const ext = path.extname(filename).toLowerCase()
  if (['.txt', '.md', '.markdown', '.csv', '.json', '.log'].includes(ext)) {
    return buffer.toString('utf8')
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const parts: string[] = []
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName]
      if (!sheet) continue
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim()
      if (csv) parts.push(`【工作表：${sheetName}】\n${csv}`)
    }
    return parts.join('\n\n')
  }
  const tmpFile = path.join(os.tmpdir(), `leyova-kb-${crypto.randomUUID()}${ext}`)
  await writeFile(tmpFile, buffer)
  try {
    if (ext === '.pdf') {
      const { stdout } = await execFileAsync('pdftotext', ['-layout', tmpFile, '-'], {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 30000,
      })
      return stdout
    }
    if (ext === '.docx') {
      const pyScript = [
        'import sys, zipfile, xml.etree.ElementTree as ET',
        'with zipfile.ZipFile(sys.argv[1]) as z:',
        '    xml = z.read("word/document.xml")',
        'root = ET.fromstring(xml)',
        'ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}',
        'lines = []',
        'for p in root.findall(".//w:p", ns):',
        '    texts = [t.text for t in p.findall(".//w:t", ns) if t.text]',
        '    if texts: lines.append("".join(texts))',
        'print("\\n".join(lines))',
      ].join('\n')
      const { stdout } = await execFileAsync('python3', ['-c', pyScript, tmpFile], {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 30000,
      })
      return stdout
    }
    throw new Error(`暂不支持 ${ext || '未知'} 格式文件，支持 txt / md / csv / json / xlsx / pdf / docx`)
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
}

const segmentSchema = z.object({
  text: z.string().min(1).max(20000),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  speaker: z.string().max(64).optional(),
})

const ingestSchema = z.object({
  collectionCode: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(255),
  content: z.string().max(200000).optional(),
  segments: z.array(segmentSchema).max(2000).optional(),
  sourceType: z.enum(['text', 'url', 'file', 'asr', 'structured']).optional(),
  sourceRef: z.string().max(500).optional(),
  businessKey: z.string().max(120).optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => Boolean(data.content?.trim()) || Boolean(data.segments?.length), {
  message: '必须提供 content 或 segments',
})

const searchSchema = z.object({
  query: z.string().trim().min(1).max(500),
  collectionCodes: z.array(z.string().max(64)).max(20).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  minScore: z.number().min(0).max(1).optional(),
  businessKey: z.string().max(120).optional(),
})

const bannedWordSchema = z.object({
  word: z.string().trim().min(1).max(64),
  category: z.enum(['absolute', 'medical', 'financial', 'platform', 'politics', 'other']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  action: z.enum(['block', 'warn', 'rewrite']).optional(),
  platform: z.string().max(32).optional(),
  enabled: z.boolean().optional(),
})

const scanSchema = z.object({
  text: z.string().min(1).max(50000),
  platform: z.string().max(32).optional(),
})

const feedbackSchema = z.object({
  runId: z.string().max(64).optional(),
  chunkId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  rating: z.enum(['up', 'down']),
  comment: z.string().max(1000).optional(),
})

function isManager(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role)
}

export async function knowledgePlatformRoutes(app: FastifyInstance) {
  // ── 集合 ──
  app.get('/api/v1/kb/collections', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const items = await listCollections(tenantIdOf(user))
    return sendOk(reply, { items, total: items.length })
  })

  app.post('/api/v1/kb/collections', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权创建知识集合')

    const parsed = collectionCreateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    const autoCode = parsed.data.code || `custom_${Date.now().toString(36)}`
    try {
      const created = await createCollection({
        tenantId: tenantIdOf(user),
        code: autoCode,
        name: parsed.data.name,
        domain: parsed.data.domain || 'document',
        description: parsed.data.description,
        chunkSize: parsed.data.chunkSize,
        chunkOverlap: parsed.data.chunkOverlap,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'kb.collection.create',
          resourceType: 'kb_collections',
          resourceId: created.code,
          afterData: parsed.data,
        })
      )
      return sendOk(reply, created)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '创建知识集合失败')
    }
  })

  app.put('/api/v1/kb/collections/:code', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权修改知识集合')

    const { code } = request.params as { code: string }
    const parsed = collectionUpdateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    const existing = await getCollectionByCode(tenantIdOf(user), code)
    if (!existing) return sendError(reply, 404, '知识集合不存在')

    const targetDomain = parsed.data.domain || existing.domain
    const hasVectorInput = Boolean(
      parsed.data.embeddingModel?.trim() ||
      parsed.data.embeddingProvider?.trim() ||
      parsed.data.embeddingApiBase?.trim()
    )
    if (isRuleOnlyCollection(code, targetDomain) && hasVectorInput) {
      return sendError(reply, 400, '违禁词库走确定性 DFA 规则引擎，不支持配置向量模型')
    }
    if (parsed.data.embeddingApiBase?.trim()) {
      const rejected = assertEndpointAllowed(parsed.data.embeddingApiBase.trim())
      if (rejected) return sendError(reply, 400, rejected)
    }

    const updated = await updateCollection({ tenantId: tenantIdOf(user), code, ...parsed.data })
    if (!updated) return sendError(reply, 404, '知识集合不存在')

    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'kb.collection.update',
        resourceType: 'kb_collections',
        resourceId: code,
        afterData: parsed.data,
      })
    )
    return sendOk(reply, updated)
  })

  app.delete('/api/v1/kb/collections/:code', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权删除知识集合')

    const { code } = request.params as { code: string }
    try {
      const deleted = await deleteCollection(tenantIdOf(user), code)
      if (!deleted) return sendError(reply, 404, '知识集合不存在')
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'kb.collection.delete',
          resourceType: 'kb_collections',
          resourceId: code,
        })
      )
      return sendOk(reply, { code, deleted: true })
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '删除集合失败')
    }
  })

  // ── 文档 ──
  app.get('/api/v1/kb/documents', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as { collectionCode?: string; status?: string; search?: string; limit?: string }
    const items = await listDocuments(tenantIdOf(user), {
      collectionCode: query.collectionCode ? String(query.collectionCode).slice(0, 64) : undefined,
      status: query.status ? String(query.status).slice(0, 16) : undefined,
      search: query.search ? String(query.search).slice(0, 120) : undefined,
      limit: Number(query.limit) || 100,
    })
    return sendOk(reply, { items, total: items.length })
  })

  app.post('/api/v1/kb/documents/upload', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权上传知识文档')
    if (!request.isMultipart()) return sendError(reply, 400, '请使用 multipart/form-data 上传文件')

    try {
      const file = await request.file()
      if (!file) return sendError(reply, 400, '未选择上传文件')

      const buffer = await file.toBuffer()
      if (!buffer.length) return sendError(reply, 400, '上传文件为空')

      const fields = file.fields as Record<string, { value?: string } | undefined>
      const collectionCode = String(fields?.collectionCode?.value || 'products').trim()
      const businessKey = String(fields?.businessKey?.value || '').trim()
      const customTitle = String(fields?.title?.value || '').trim()

      const extracted = await extractTextFromUpload(file.filename || 'upload.txt', buffer)
      if (!extracted.trim()) return sendError(reply, 400, '未能从文件中提取到有效文字（若是扫描版 PDF，请转为文字版或直接粘贴正文）')

      const title = customTitle || path.basename(file.filename || '上传文档', path.extname(file.filename || ''))
      const result = await ingestDocument({
        tenantId: tenantIdOf(user),
        collectionCode,
        title,
        content: extracted,
        sourceType: 'file',
        sourceRef: file.filename || '',
        businessKey: businessKey || undefined,
        userId: user.id,
      })

      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'kb.document.upload',
          resourceType: 'kb_documents',
          resourceId: result.documentId,
          afterData: { filename: file.filename, collectionCode, title, chunkCount: result.chunkCount },
        })
      )
      return sendOk(reply, { ...result, title, extractedChars: extracted.length })
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '文件解析或入库失败')
    }
  })

  app.post('/api/v1/kb/documents', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权入库知识文档')

    const parsed = ingestSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    try {
      const result = await ingestDocument({
        tenantId: tenantIdOf(user),
        ...parsed.data,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'kb.document.ingest',
          resourceType: 'kb_documents',
          resourceId: result.documentId,
          afterData: {
            collectionCode: parsed.data.collectionCode,
            title: parsed.data.title,
            chunkCount: result.chunkCount,
            embedded: result.embedded,
            embeddingDegraded: result.embeddingDegraded,
            indexVersion: result.indexVersion,
          },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '入库失败')
    }
  })

  app.delete('/api/v1/kb/documents/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权删除知识文档')

    const { id } = request.params as { id: string }
    const deleted = await withRlsContext(request, async (client) => {
      const { rowCount } = await client.query(
        `DELETE FROM public.kb_documents WHERE tenant_id = $1 AND id = $2`,
        [tenantIdOf(user), id]
      )
      if (!rowCount) return false

      await client.query(
        `UPDATE public.kb_collections c
            SET document_count = (SELECT count(*) FROM public.kb_documents d WHERE d.collection_id = c.id AND d.status = 'ready'),
                chunk_count = (SELECT count(*) FROM public.kb_chunks k WHERE k.collection_id = c.id),
                updated_at = now()
          WHERE c.tenant_id = $1`,
        [tenantIdOf(user)]
      )

      await writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'kb.document.delete',
        resourceType: 'kb_documents',
        resourceId: id,
      })
      return true
    })
    if (!deleted) return sendError(reply, 404, '文档不存在')
    return sendOk(reply, { id, deleted: true })
  })

  // ── 文档详情与编辑更新 ──
  app.get('/api/v1/kb/documents/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const doc = await getDocumentDetail(tenantIdOf(user), id)
    if (!doc) return sendError(reply, 404, '文档不存在')
    return sendOk(reply, doc)
  })

  app.put('/api/v1/kb/documents/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权修改知识文档')

    const { id } = request.params as { id: string }
    const parsed = docUpdateSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    try {
      const result = await updateDocument({
        tenantId: tenantIdOf(user),
        documentId: id,
        ...parsed.data,
        userId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'kb.document.update',
          resourceType: 'kb_documents',
          resourceId: id,
          afterData: {
            title: parsed.data.title,
            collectionCode: parsed.data.collectionCode,
            chunkCount: result.chunkCount,
            docVersion: result.docVersion,
          },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '更新文档失败')
    }
  })

  // ── 引用回溯 ──
  app.get('/api/v1/kb/chunks/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const trail = await getChunkTrail(tenantIdOf(user), id)
    if (!trail) return sendError(reply, 404, '切片不存在')
    return sendOk(reply, trail)
  })

  // ── 入库任务 ──
  app.get('/api/v1/kb/ingest-jobs', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { rows } = await withRlsContext(request, (client) =>
      client.query<any>(
        `SELECT j.id, j.status, j.stage, j.progress, j.chunk_count, j.error,
                j.created_at, j.started_at, j.finished_at, c.code AS collection_code,
                d.title AS document_title
           FROM public.kb_ingest_jobs j
           JOIN public.kb_collections c ON c.id = j.collection_id
           LEFT JOIN public.kb_documents d ON d.id = j.document_id
          WHERE j.tenant_id = $1
          ORDER BY j.created_at DESC
          LIMIT 50`,
        [tenantIdOf(user)]
      )
    )
    return sendOk(reply, {
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        stage: row.stage,
        progress: Number(row.progress) || 0,
        chunkCount: Number(row.chunk_count) || 0,
        error: row.error,
        collectionCode: row.collection_code,
        documentTitle: row.document_title,
        createdAt: new Date(row.created_at).toISOString(),
        finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
      })),
    })
  })

  // ── 检索（本地 pgvector；外部 RAGFlow/MaxKB 走 POST /kb/search）──
  app.get('/api/v1/kb/retrieve', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    const parsed = searchSchema.safeParse({
      query: query.query,
      collectionCodes: query.collections ? query.collections.split(',').filter(Boolean) : undefined,
      topK: query.topK ? Number(query.topK) : undefined,
      minScore: query.minScore ? Number(query.minScore) : undefined,
      businessKey: query.businessKey,
    })
    if (!parsed.success) return sendError(reply, 400, '检索参数不合法')

    const result = await searchKnowledge({
      tenantId: tenantIdOf(user),
      role: user.role,
      query: parsed.data.query,
      collectionCodes: parsed.data.collectionCodes,
      topK: parsed.data.topK,
      minScore: parsed.data.minScore,
      filters: { businessKey: parsed.data.businessKey },
    })
    return sendOk(reply, result)
  })

  app.post('/api/v1/kb/retrieve', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const parsed = searchSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '检索参数不合法')

    const result = await searchKnowledge({
      tenantId: tenantIdOf(user),
      role: user.role,
      query: parsed.data.query,
      collectionCodes: parsed.data.collectionCodes,
      topK: parsed.data.topK,
      minScore: parsed.data.minScore,
      filters: { businessKey: parsed.data.businessKey },
    })
    return sendOk(reply, result)
  })

  // ── 统计 ──
  app.get('/api/v1/kb/stats', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    return sendOk(reply, await knowledgeStats(tenantIdOf(user)))
  })

  // ── 违禁词 ──
  app.get('/api/v1/kb/banned-words', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const items = await listBannedWords(tenantIdOf(user))
    return sendOk(reply, { items, total: items.length, defaultCount: DEFAULT_BANNED_RULES.length })
  })

  app.get('/api/v1/kb/banned-words/defaults', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    return sendOk(reply, { items: DEFAULT_BANNED_RULES, total: DEFAULT_BANNED_RULES.length })
  })

  app.put('/api/v1/kb/banned-words/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权维护违禁词库')

    const { id } = request.params as { id: string }
    const body = (request.body || {}) as {
      category?: string
      severity?: string
      action?: string
      platform?: string
      enabled?: boolean
    }
    const updated = await updateBannedWord({ tenantId: tenantIdOf(user), id, ...body })
    if (!updated) return sendError(reply, 404, '违禁词不存在')

    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'kb.banned_word.update',
        resourceType: 'kb_banned_words',
        resourceId: id,
        afterData: body,
      })
    )
    return sendOk(reply, updated)
  })

  app.post('/api/v1/kb/banned-words', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权维护违禁词库')

    const parsed = bannedWordSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    const saved = await upsertBannedWord({ tenantId: tenantIdOf(user), ...parsed.data })
    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'kb.banned_word.upsert',
        resourceType: 'kb_banned_words',
        resourceId: saved.id,
        afterData: parsed.data,
      })
    )
    return sendOk(reply, saved)
  })

  app.post('/api/v1/kb/banned-words/batch', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权维护违禁词库')

    const body = (request.body || {}) as {
      words: string[]
      category?: string
      severity?: string
      action?: string
      platform?: string
    }
    const words = Array.isArray(body.words) ? body.words : []
    const results = []
    for (const w of words) {
      const cleanWord = typeof w === 'string' ? w.trim() : ''
      if (!cleanWord) continue
      const saved = await upsertBannedWord({
        tenantId: tenantIdOf(user),
        word: cleanWord,
        category: body.category || 'absolute',
        severity: body.severity || 'high',
        action: body.action || 'block',
        platform: body.platform || 'all',
      })
      results.push(saved)
    }

    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'kb.banned_word.batch_upsert',
        resourceType: 'kb_banned_words',
        resourceId: `batch-${results.length}`,
        afterData: { count: results.length },
      })
    )
    return sendOk(reply, { count: results.length, items: results })
  })

  app.delete('/api/v1/kb/banned-words/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isManager(user.role)) return sendError(reply, 403, '当前角色无权维护违禁词库')

    const { id } = request.params as { id: string }
    const deleted = await deleteBannedWord(tenantIdOf(user), id)
    if (!deleted) return sendError(reply, 404, '违禁词不存在')

    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'kb.banned_word.delete',
        resourceType: 'kb_banned_words',
        resourceId: id,
      })
    )
    return sendOk(reply, { id, deleted: true })
  })

  app.post('/api/v1/kb/banned-words/scan', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const parsed = scanSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    const result = await scanBannedWords({
      tenantId: tenantIdOf(user),
      text: parsed.data.text,
      platform: parsed.data.platform,
    })
    return sendOk(reply, result)
  })

  // ── 反馈 ──
  app.post('/api/v1/kb/feedback', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const parsed = feedbackSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    const { rows } = await withRlsContext(request, (client) =>
      client.query<{ id: string }>(
        `INSERT INTO public.kb_feedback
           (tenant_id, run_id, chunk_id, document_id, rating, comment, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          tenantIdOf(user),
          parsed.data.runId || null,
          parsed.data.chunkId || null,
          parsed.data.documentId || null,
          parsed.data.rating,
          String(parsed.data.comment || '').slice(0, 1000),
          user.id,
        ]
      )
    )
    return sendOk(reply, { id: rows[0].id })
  })

  // ── 向量模型连通性测试（仅超管，在「系统配置与 AI → AI 模型」调用） ──
  app.post('/api/v1/kb/embedding/test', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const user = request.user as { id: number; tenantId?: number }
    const body = (request.body || {}) as {
      provider?: string
      apiBase?: string
      model?: string
      apiKey?: string
    }
    const result = await testEmbeddingConnection({
      tenantId: tenantIdOf(user),
      provider: String(body.provider || ''),
      apiBase: typeof body.apiBase === 'string' ? body.apiBase : undefined,
      model: String(body.model || ''),
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
    })
    return sendOk(reply, result)
  })
}