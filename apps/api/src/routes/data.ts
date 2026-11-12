/**
 * data.ts -- 数据管理路由
 *
 * 功能：
 *   - 数据表列表 / 刷新
 *   - 文件上传（CSV + XLSX）：预览 -> 确认导入
 *   - 上传历史查询
 *   - 登记数据管理（CRUD）
 *   - 数据质量概览
 */

import type { FastifyInstance } from 'fastify'
import * as XLSX from 'xlsx'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { findDuplicateSession, buildDuplicateMessage } from '../lib/livereg-dedupe.js'
import { executeCleaningPipeline } from '../ingest/cleaner/engine.js'
import {
  text,
  detectDouyinTemplate,
  detectFullSessionTemplate,
  inferBusinessDate,
  buildPreview,
  importAnchorAnalysis,
  importChannelAnalysis,
  importFullSession,
  parseCsv,
  importLiveSessionCsv,
  validateAnchorRows,
  validateChannelRows,
  validateCsvRows,
  makeColumnGetter,
  TEMPLATES,
} from '../lib/importer.js'

import type { XlsxWorkbook, NameCache } from '../lib/importer.js'

// ── Helper: XLSX workbook parsing ──

type WorksheetRow = Record<string, unknown>

function parseXlsxWorkbook(buffer: Buffer): { template: string | null; rows: WorksheetRow[]; workbook?: any } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = sheet ? XLSX.utils.sheet_to_json<WorksheetRow>(sheet, { defval: '' }) : []
  const headers = Object.keys(rows[0] ?? {})
  const template = detectDouyinTemplate(headers)
  return { template, rows, workbook }
}

// ── Helper: find session for a given date ──

async function findSessionForDate(pool: DbExecutor, date: string): Promise<number | null> {
  const r = await pool.query(
    'SELECT id FROM live_sessions WHERE date = $1::date ORDER BY start_time ASC LIMIT 1',
    [date],
  )
  return r.rows.length > 0 ? r.rows[0].id : null
}

// ═══════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════

export async function dataRoutes(app: FastifyInstance) {
  // ── GET /api/v1/data/tables ──
  app.get('/api/v1/data/tables', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT tablename AS name,
                  COALESCE((SELECT SUM(n_live_tup)::int FROM pg_stat_user_tables WHERE relname = t.tablename), 0) AS row_count
           FROM pg_catalog.pg_tables t
           WHERE schemaname = 'public' AND tablename NOT LIKE 'pg\\\\_%'
           ORDER BY tablename`,
        ),
      )
      return sendOk(
        reply,
        rows.map((r: any) => ({
          id: r.name,
          name: r.name,
          rowCount: r.row_count,
          status: 'synced',
        })),
      )
    } catch (err) {
      request.log.warn({ err }, 'data/tables query failed')
      return sendOk(reply, [])
    }
  })

  const DATA_OPERATE_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance']
  const DATA_ADMIN_ROLES = ['super_admin', 'admin', 'ops_director', 'operator', 'finance']

  // ── POST /api/v1/data/tables/:id/refresh ──
  app.post('/api/v1/data/tables/:id/refresh', { preHandler: [requireRole(DATA_OPERATE_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const safeTable = id.replace(/[^a-z0-9_]/gi, '')
      if (safeTable) {
        await withRlsContext(request, (client) => client.query(`ANALYZE "${safeTable}"`))
      }
      return sendOk(reply, { refreshed: true })
    } catch (err) {
      request.log.warn({ err }, 'data/tables refresh failed')
      return sendOk(reply, { refreshed: false })
    }
  })

  // ── GET /api/v1/data/uploads ──
  app.get('/api/v1/data/uploads', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, file_name, file_type, file_size, upload_time, status,
                  row_count, data_type, business_date::text, error_message
           FROM data_uploads ORDER BY upload_time DESC`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'data/uploads query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/data/uploads/:id/download ── 下载上传的文件
  app.get('/api/v1/data/uploads/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          'SELECT file_name, source_path FROM data_uploads WHERE id = $1',
          [parseInt(id)],
        ),
      )
      if (rows.length === 0) return reply.code(404).send({ success: false, message: '文件不存在' })
      const { file_name, source_path } = rows[0]
      const filePath = path.resolve('./uploads', source_path)
      if (!fs.existsSync(filePath)) return reply.code(404).send({ success: false, message: '文件已丢失' })
      return reply.type('application/octet-stream').header('Content-Disposition', `attachment; filename="${encodeURIComponent(file_name)}"`).send(fs.readFileSync(filePath))
    } catch (err) {
      request.log.warn({ err }, 'data/uploads/:id/download failed')
      return reply.code(500).send({ success: false, message: '下载失败' })
    }
  })

  // ── DELETE /api/v1/data/uploads/:id ── 删除上传记录和文件
  app.delete('/api/v1/data/uploads/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const deletedRow = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          'SELECT file_name, source_path FROM data_uploads WHERE id = $1',
          [parseInt(id)],
        )
        if (rows.length === 0) return null
        await client.query('DELETE FROM data_uploads WHERE id = $1', [parseInt(id)])
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.upload.delete',
          resourceType: 'data_upload',
          resourceId: id,
          beforeData: rows[0],
          request,
        })
        return rows[0]
      })
      if (!deletedRow) return reply.code(404).send({ success: false, message: '记录不存在' })
      if (deletedRow.source_path) {
        const filePath = path.resolve('./uploads', deletedRow.source_path)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }
      return sendOk(reply, { message: '删除成功' })
    } catch (err) {
      request.log.warn({ err }, 'data/uploads/:id delete failed')
      return reply.code(500).send({ success: false, message: '删除失败' })
    }
  })

  // ── POST /api/v1/data/upload-preview ──
  app.post('/api/v1/data/upload-preview', { preHandler: [requireRole(DATA_OPERATE_ROLES)] }, async (request, reply) => {
    try {
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileName = 'unknown'
      let fileType = 'bin'
      let targetTable = ''

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk)
          fileBuffer = Buffer.concat(chunks)
          fileName = part.filename || 'unknown'
          fileType = fileName.split('.').pop()?.toLowerCase() || 'bin'
        } else if (part.fieldname === 'target_table') {
          targetTable = text(part.value)
        }
      }

      if (!fileBuffer) return reply.code(400).send({ success: false, message: '\u672A\u9009\u62E9\u6587\u4EF6' })

      if (fileType === 'xlsx' || fileType === 'xls') {
        let { template, rows, workbook: parsedWorkbook } = parseXlsxWorkbook(fileBuffer)
        const businessDate = inferBusinessDate(fileName)
        const preview = buildPreview(template, rows, businessDate)
        const isFullSession = !template && detectFullSessionTemplate(fileName)
        if (isFullSession) {
          template = TEMPLATES.FULL_SESSION
        }
        const sheetNames: string[] = isFullSession ? (parsedWorkbook?.SheetNames ?? []) : []

        const dbInfo = await withRlsContext(request, async (client) => {
          let sessionsForDate: { id: number; title: string; anchor_name: string }[] = []
          let availableRooms: { id: number; name: string }[] = []
          let anchorsMissingRooms: string[] = []
          let allAnchors: any[] = []
          const unmatchedAnchors: string[] = []

          if (template === TEMPLATES.CHANNEL && businessDate) {
            const s = await client.query(
              `SELECT s.id, s.title, COALESCE(a.name, '') AS anchor_name
               FROM live_sessions s
               LEFT JOIN anchors a ON a.id = s.anchor_id
               WHERE s.date = $1::date ORDER BY s.start_time`,
              [businessDate],
            )
            sessionsForDate = s.rows
          }

          if (template === TEMPLATES.ANCHOR) {
            const roomsRes = await client.query('SELECT id, name FROM live_rooms WHERE status = $1 ORDER BY name', ['active'])
            availableRooms = roomsRes.rows

            const allAnchorsRes = await client.query('SELECT id, name FROM anchors WHERE status = 1 ORDER BY name')
            allAnchors = allAnchorsRes.rows

            const anchorNames = [...new Set(rows.map(r => text(r['主播名称'])).filter(Boolean))]
              .filter(n => !['整体', '较上周期', '同行同级优秀值'].includes(n))

            for (const name of anchorNames) {
              const anchorRes = await client.query('SELECT id FROM anchors WHERE name = $1 AND status = 1 LIMIT 1', [name])
              if (anchorRes.rows.length === 0) {
                unmatchedAnchors.push(name)
                anchorsMissingRooms.push(name)
                continue
              }
              const aid = anchorRes.rows[0].id
              const roomRes = await client.query(
                'SELECT room_id FROM live_sessions WHERE anchor_id = $1 AND room_id IS NOT NULL LIMIT 1',
                [aid],
              )
              if (roomRes.rows.length === 0) {
                anchorsMissingRooms.push(name)
              }
            }
          }

          if (isFullSession) {
            const roomsRes = await client.query('SELECT id, name FROM live_rooms ORDER BY name')
            availableRooms = roomsRes.rows
          }

          return { sessionsForDate, availableRooms, anchorsMissingRooms, allAnchors, unmatchedAnchors }
        })

        return sendOk(reply, {
          ...preview,
          sessionsForDate: dbInfo.sessionsForDate,
          availableRooms: dbInfo.availableRooms,
          anchorsMissingRooms: dbInfo.anchorsMissingRooms,
          fileType,
          fileName,
          isFullSession,
          sheetNames,
          allAnchors: template === TEMPLATES.ANCHOR ? dbInfo.allAnchors : ((preview as any).allAnchors ?? []),
          unmatchedAnchors: template === TEMPLATES.ANCHOR ? dbInfo.unmatchedAnchors : ((preview as any).unmatchedAnchors ?? []),
        })
      }

      if (fileType === 'csv') {
        const content = fileBuffer.toString('utf-8')
        const { headers, rows } = parseCsv(content)
        const get = makeColumnGetter(headers)
        const issues = validateCsvRows(rows, get)
        const previewRows = rows.slice(0, 10).map((vals) => {
          const obj: Record<string, string> = {}
          headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
          return obj
        })
        return sendOk(reply, {
          detectedType: 'csv_live_sessions',
          businessDate: null,
          totalRows: rows.length,
          validRows: rows.length - issues.filter((i) => i.severity === 'error').length,
          issues,
          previewRows,
          sessionsForDate: [],
          fileType,
          fileName,
        })
      }

      return reply.code(400).send({ success: false, message: '\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F\uFF0C\u8BF7\u4E0A\u4F20 CSV \u6216 XLSX' })
    } catch (err) {
      request.log.warn({ err }, 'data/upload-preview failed')
      return reply.code(500).send({ success: false, message: '\u6587\u4EF6\u9884\u89C8\u5931\u8D25' })
    }
  })

  // ── POST /api/v1/data/uploads ──
  app.post('/api/v1/data/uploads', { preHandler: [requireRole(DATA_OPERATE_ROLES)] }, async (request, reply) => {
    try {
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileName = 'unknown'
      let fileType = 'bin'
      let targetTable = ''
      let sessionIdOverride: number | null = null
      let roomAssignments: Record<string, number> = {}
      let uploadBusinessDate = ''
      let selectedRoomId: number | null = null
      let anchorMappings: Record<string, number | 'create'> = {}

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk)
          fileBuffer = Buffer.concat(chunks)
          fileName = part.filename || 'unknown'
          fileType = fileName.split('.').pop()?.toLowerCase() || 'bin'
        } else if (part.fieldname === 'target_table') {
          targetTable = text(part.value)
        } else if (part.fieldname === 'session_id') {
          sessionIdOverride = parseInt(text(part.value)) || null
        } else if (part.fieldname === 'room_assignments') {
          try { roomAssignments = JSON.parse(text(part.value)) } catch { roomAssignments = {} }
        } else if (part.fieldname === 'business_date') {
          uploadBusinessDate = text(part.value)
        } else if (part.fieldname === 'room_id') {
          const rid = parseInt(text(part.value))
          selectedRoomId = Number.isFinite(rid) ? rid : null
        } else if (part.fieldname === 'anchor_mappings') {
          try { anchorMappings = JSON.parse(text(part.value)) } catch { anchorMappings = {} }
        }
      }

      if (!fileBuffer) return reply.code(400).send({ success: false, message: '\u672A\u9009\u62E9\u6587\u4EF6' })
      const fileSize = fileBuffer.length

      // Save file to disk
      const fs = await import('node:fs')
      const path = await import('node:path')
      const uploadDir = path.resolve('./uploads')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      fs.writeFileSync(path.join(uploadDir, safeName), fileBuffer)

      // ── XLSX ──
      if (fileType === 'xlsx' || fileType === 'xls') {
        const { template, rows, workbook } = parseXlsxWorkbook(fileBuffer)
        let detectedType: string | null = template
        let businessDate: string | null = inferBusinessDate(fileName)

        // Anchor analysis
        if (detectedType === TEMPLATES.ANCHOR || targetTable === 'anchor_analysis') {
          if (!businessDate) {
            return reply.code(400).send({ success: false, message: '\u65E0\u6CD5\u4ECE\u6587\u4EF6\u540D\u8BC6\u522B\u4E1A\u52A1\u65E5\u671F\uFF0C\u8BF7\u4F7F\u7528\u6807\u51C6\u6296\u97F3\u540E\u53F0\u5BFC\u51FA\u6587\u4EF6\u540D' })
          }

          const { uploadId, importedRows, errorsList } = await withRlsContext(request, async (client) => {
            const anchorNameCache: NameCache = {}
            for (const [excelName, mapping] of Object.entries(anchorMappings)) {
              if (mapping === 'create') {
                const insertRes = await client.query(
                  'INSERT INTO anchors (name, level, status) VALUES ($1, $2, $3) RETURNING id',
                  [excelName, 'B', 1],
                )
                anchorNameCache[excelName] = { id: insertRes.rows[0].id }
              } else if (typeof mapping === 'number') {
                anchorNameCache[excelName] = { id: mapping }
              }
            }

            const uploadResult = await client.query(
              `INSERT INTO data_uploads (file_name, file_type, file_size, status, row_count, data_type, business_date, source_path)
               VALUES ($1, $2, $3, 'processing', 0, 'anchor_analysis', $4::date, $5) RETURNING id`,
              [fileName, fileType, String(fileSize), businessDate, safeName],
            )
            const uid = uploadResult.rows[0].id
            const result = await importAnchorAnalysis(client, rows, businessDate!, roomAssignments, anchorNameCache, uid)
            const finalStatus = result.errors.length > 0 && result.imported === 0 ? 'failed' : 'completed'
            await client.query(
              `UPDATE data_uploads SET status = $1, row_count = $2, error_message = $3 WHERE id = $4`,
              [finalStatus, result.imported, result.errors.join('; ') || null, uid],
            )
            return { uploadId: uid, importedRows: result.imported, errorsList: result.errors }
          })

          return sendOk(reply, {
            upload: { id: uploadId, file_name: fileName, data_type: 'anchor_analysis', business_date: businessDate },
            imported_rows: importedRows,
            errors: errorsList,
            message: errorsList.length > 0
              ? `\u5BFC\u5165\u5B8C\u6210\uFF0C${errorsList.length} \u6761\u8B66\u544A`
              : '\u4E3B\u64AD\u5206\u6790\u6570\u636E\u5BFC\u5165\u6210\u529F',
          })
        }

        // Channel analysis
        if (detectedType === TEMPLATES.CHANNEL || targetTable === 'channel_analysis') {
          if (!businessDate) businessDate = uploadBusinessDate || null
          if (!businessDate) {
            return reply.code(400).send({ success: false, message: '\u65E0\u6CD5\u4ECE\u6587\u4EF6\u540D\u8BC6\u522B\u4E1A\u52A1\u65E5\u671F\uFF0C\u8BF7\u4F7F\u7528\u6807\u51C6\u6296\u97F3\u540E\u53F0\u5BFC\u51FA\u6587\u4EF6\u540D' })
          }

          const { uploadId, sessionId, importedRows, errorsList } = await withRlsContext(request, async (client) => {
            let sid = sessionIdOverride
            if (!sid) sid = await findSessionForDate(client, businessDate!) || null

            const uploadResult = await client.query(
              `INSERT INTO data_uploads (file_name, file_type, file_size, status, row_count, data_type, business_date, source_path)
               VALUES ($1, $2, $3, 'processing', 0, 'channel_analysis', $4::date, $5) RETURNING id`,
              [fileName, fileType, String(fileSize), businessDate, safeName],
            )
            const uid = uploadResult.rows[0].id
            const result = await importChannelAnalysis(client, rows, businessDate!, sid, uid)
            const finalStatus = result.errors.length > 0 && result.imported === 0 ? 'failed' : 'completed'
            await client.query(
              `UPDATE data_uploads SET status = $1, row_count = $2, error_message = $3 WHERE id = $4`,
              [finalStatus, result.imported, result.errors.join('; ') || null, uid],
            )
            return { uploadId: uid, sessionId: sid, importedRows: result.imported, errorsList: result.errors }
          })

          return sendOk(reply, {
            upload: {
              id: uploadId, file_name: fileName, data_type: 'channel_analysis',
              business_date: businessDate, session_id: sessionId,
            },
            imported_rows: importedRows,
            errors: errorsList,
            message: errorsList.length > 0
              ? `\u5BFC\u5165\u5B8C\u6210\uFF0C${errorsList.length} \u6761\u8B66\u544A`
              : '\u6E20\u9053\u5206\u6790\u6570\u636E\u5BFC\u5165\u6210\u529F',
          })
        }

        // ── Full session ──
        if (detectedType === TEMPLATES.FULL_SESSION || detectFullSessionTemplate(fileName)) {
          detectedType = TEMPLATES.FULL_SESSION
          if (!selectedRoomId) {
            return reply.code(400).send({ success: false, message: '\u8BF7\u9009\u62E9\u76F4\u64AD\u95F4' })
          }
          if (!uploadBusinessDate) {
            return reply.code(400).send({ success: false, message: '\u8BF7\u9009\u62E9\u4E1A\u52A1\u65E5\u671F' })
          }

          const { uploadId, importedRows, errorsList } = await withRlsContext(request, async (client) => {
            const uploadResult = await client.query(
              `INSERT INTO data_uploads (file_name, file_type, file_size, status, row_count, data_type, business_date, source_path)
               VALUES ($1, $2, $3, 'processing', 0, 'full_session', $4::date, $5) RETURNING id`,
              [fileName, fileType, String(fileSize), uploadBusinessDate, safeName],
            )
            const uid = uploadResult.rows[0].id
            const result = await importFullSession(client, workbook, uploadBusinessDate, selectedRoomId!, uid!)
            const finalStatus = result.errors.length > 0 && result.imported === 0 ? 'failed' : 'completed'
            await client.query(
              `UPDATE data_uploads SET status = $1, row_count = $2, error_message = $3 WHERE id = $4`,
              [finalStatus, result.imported, result.errors.join('; ') || null, uid],
            )
            return { uploadId: uid, importedRows: result.imported, errorsList: result.errors }
          })

          return sendOk(reply, {
            upload: { id: uploadId, file_name: fileName, data_type: 'full_session', business_date: uploadBusinessDate, room_id: selectedRoomId },
            imported_rows: importedRows,
            errors: errorsList,
            message: '\u6574\u573A\u6570\u636E\u5BFC\u5165\u6210\u529F',
          })
        }

        return reply.code(400).send({ success: false, message: '\u65E0\u6CD5\u8BC6\u522B\u8BE5 Excel \u6A21\u677F\uFF0C\u8BF7\u4E0A\u4F20\u6296\u97F3\u6E20\u9053\u5206\u6790\u6216\u4E3B\u64AD\u5206\u6790\u65E5\u62A5' })
      }

      // ── CSV ──
      if (fileType === 'csv' && (targetTable === 'live_sessions' || targetTable === '')) {
        const content = fileBuffer.toString('utf-8')
        const { headers, rows } = parseCsv(content)

        const { uploadId, importedRows, errorsList } = await withRlsContext(request, async (client) => {
          if (rows.length > 0) {
            const uploadResult = await client.query(
              `INSERT INTO data_uploads (file_name, file_type, file_size, status, row_count, data_type, source_path)
               VALUES ($1, $2, $3, 'processing', 0, 'live_sessions_csv', $4) RETURNING id`,
              [fileName, fileType, String(fileSize), safeName],
            )
            const uid = uploadResult.rows[0].id
            const result = await importLiveSessionCsv(client, headers, rows)
            const finalStatus = result.errors.length > 0 && result.imported === 0 ? 'failed' : 'completed'
            await client.query(
              `UPDATE data_uploads SET status = $1, row_count = $2, error_message = $3 WHERE id = $4`,
              [finalStatus, result.imported, result.errors.join('; ') || null, uid],
            )
            return { uploadId: uid, importedRows: result.imported, errorsList: result.errors }
          } else {
            const uploadResult = await client.query(
              `INSERT INTO data_uploads (file_name, file_type, file_size, status, row_count, data_type, source_path)
               VALUES ($1, $2, $3, 'completed', 0, 'live_sessions_csv', $4) RETURNING id`,
              [fileName, fileType, String(fileSize), safeName],
            )
            return { uploadId: uploadResult.rows[0].id, importedRows: 0, errorsList: [] as string[] }
          }
        })

        return sendOk(reply, {
          upload: { id: uploadId, file_name: fileName, data_type: 'live_sessions_csv', row_count: importedRows },
          imported_rows: importedRows,
          errors: errorsList,
          message: errorsList.length > 0
            ? `\u5BFC\u5165\u5B8C\u6210\uFF0C${errorsList.length} \u6761\u8B66\u544A`
            : 'CSV \u6570\u636E\u5BFC\u5165\u6210\u529F',
        })
      }

      return reply.code(400).send({ success: false, message: '\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u7C7B\u578B\u6216\u76EE\u6807\u8868' })
    } catch (err) {
      request.log.warn({ err }, 'data/uploads upload failed')
      return reply.code(500).send({ success: false, message: '\u6587\u4EF6\u4E0A\u4F20\u5931\u8D25' })
    }
  })

  // ── GET /api/v1/data/exports ──
  app.get('/api/v1/data/exports', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query('SELECT * FROM data_exports ORDER BY requested_at DESC LIMIT 20'),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'data/exports query failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/data/exports ──
  app.post('/api/v1/data/exports', { preHandler: [requireRole(DATA_OPERATE_ROLES)] }, async (request, reply) => {
    try {
      const body = request.body as { exportName?: string; format?: string }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `INSERT INTO data_exports (export_name, format, status) VALUES ($1, $2, 'completed') RETURNING *`,
          [body.exportName || '\u6570\u636E\u5BFC\u51FA', body.format || 'xlsx'],
        ),
      )
      if (rows.length === 0) return sendOk(reply, { error: '\u5BFC\u51FA\u5931\u8D25' })
      return sendOk(reply, rows[0])
    } catch (err) {
      request.log.warn({ err }, 'data/exports create failed')
      return sendOk(reply, { error: '\u5BFC\u51FA\u5931\u8D25' })
    }
  })

  // ── GET /api/v1/data/live ──
  app.get('/api/v1/data/live', async (request, reply) => {
    try {
      // 登记数据管理：只读人工登记表（独立模块，不混入系统场次数据）
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT s.id, s.biz_date::text AS date,
                  s.anchor_id, s.room_id, s.operator_id,
                  a.name AS anchor_name,
                  r.name AS room_name,
                  o.name AS operator_name,
                  s.start_time::text, s.end_time::text,
                  s.duration_min AS duration,
                  s.title, s.gmv, s.return_amount AS refund_amount, s.status,
                  s.remark, s.entry_source, s.registered_at::text
           FROM live_registrations s
           LEFT JOIN anchors a ON a.id = s.anchor_id
           LEFT JOIN live_rooms r ON r.id = s.room_id
           LEFT JOIN operators o ON o.id = s.operator_id
           ORDER BY s.biz_date DESC, s.start_time DESC
           LIMIT 500`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'data/live query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/data/live/:id ──
  app.get('/api/v1/data/live/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT s.*, a.name AS anchor_name, r.name AS room_name, o.name AS operator_name
           FROM live_registrations s
           LEFT JOIN anchors a ON a.id = s.anchor_id
           LEFT JOIN live_rooms r ON r.id = s.room_id
           LEFT JOIN operators o ON o.id = s.operator_id
           WHERE s.id = $1`,
          [parseInt(id)],
        ),
      )
      return sendOk(reply, rows[0] ?? null)
    } catch (err) {
      request.log.warn({ err }, 'data/live/:id query failed')
      return sendOk(reply, null)
    }
  })

  // ── DELETE /api/v1/data/live/:id ──
  app.delete('/api/v1/data/live/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await withRlsContext(request, async (client) => {
        const res = await client.query('DELETE FROM live_registrations WHERE id = $1 RETURNING id', [parseInt(id)])
        if ((res.rowCount ?? 0) > 0) {
          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'data.live_registration.delete',
            resourceType: 'live_registration',
            resourceId: id,
            request,
          })
        }
        return res
      })
      return sendOk(reply, { deleted: (result.rowCount ?? 0) > 0, id: parseInt(id) })
    } catch (err) {
      request.log.warn({ err }, 'data/live delete failed')
      return sendOk(reply, { deleted: false })
    }
  })

  // ── PUT /api/v1/data/live/:id ──
  app.put('/api/v1/data/live/:id', { preHandler: [requireRole(DATA_ADMIN_ROLES)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as Record<string, any>
      const sessionId = parseInt(id)

      const out = await withRlsContext(request, async (client) => {
        const { rows: current } = await client.query(
          `SELECT room_id, anchor_id, biz_date::text AS date, start_time::text
             FROM live_registrations WHERE id = $1`,
          [sessionId],
        )

        if (current[0]) {
          const effective = {
            room_id: body.roomId ?? current[0].room_id,
            anchor_id: body.anchorId ?? current[0].anchor_id,
            date: body.date ?? current[0].date,
            start_time: body.startTime ?? current[0].start_time,
          }
          if (effective.date && effective.start_time) {
            const dupRes = await client.query(
              `SELECT id FROM live_registrations
                WHERE biz_date = $1::date
                  AND COALESCE(anchor_id, 0) = COALESCE($2, 0)
                  AND COALESCE(room_id, 0) = COALESCE($3, 0)
                  AND start_time = $4::time
                  AND status <> 'cancelled'
                  AND id <> $5
                LIMIT 1`,
              [effective.date, effective.anchor_id, effective.room_id, effective.start_time, sessionId],
            )
            if (dupRes.rows.length > 0) {
              return { status: 409 as const, message: `该主播在 ${effective.date} ${effective.start_time} 已有登记记录（ID: ${dupRes.rows[0].id}）` }
            }
          }
        }

        const result = await client.query(
          `UPDATE live_registrations SET
             room_id       = COALESCE($1, room_id),
             anchor_id     = COALESCE($2, anchor_id),
             operator_id   = COALESCE($3, operator_id),
             biz_date      = COALESCE($4::date, biz_date),
             start_time    = COALESCE($5::time, start_time),
             end_time      = COALESCE($6::time, end_time),
             duration_min  = COALESCE($7, duration_min),
             title         = COALESCE($8, title),
             gmv           = COALESCE($9, gmv),
             orders        = COALESCE($10, orders),
             buyer_count   = COALESCE($11, buyer_count),
             return_amount = COALESCE($12, return_amount),
             remark        = COALESCE($13, remark),
             status        = COALESCE($14, status),
             updated_at    = NOW()
           WHERE id = $15
           RETURNING *`,
          [
            body.roomId ?? null,
            body.anchorId ?? null,
            body.operatorId ?? null,
            body.date ?? null,
            body.startTime ?? null,
            body.endTime ?? null,
            body.duration ?? null,
            body.title ?? null,
            body.gmv ?? null,
            body.orders ?? null,
            body.buyerCount ?? null,
            body.returnAmount ?? null,
            body.remark ?? null,
            body.status ?? null,
            sessionId,
          ],
        )
        if (result.rows.length === 0) return { status: 404 as const, message: '登记记录不存在' }
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'data.live_registration.update',
          resourceType: 'live_registration',
          resourceId: sessionId,
          afterData: result.rows[0],
          request,
        })
        return { status: 200 as const, row: result.rows[0] }
      })

      if (out.status !== 200) return sendError(reply, out.status, out.message)
      return sendOk(reply, out.row, '登记信息已更新')
    } catch (err) {
      request.log.warn({ err }, 'data/live update failed')
      return sendError(reply, 500, '更新登记信息失败')
    }
  })

  app.get('/api/v1/data/quality', async (request, reply) => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { q, uploadedTypes } = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          `SELECT COUNT(*)::int AS total,
                  SUM(CASE WHEN gmv IS NULL OR gmv = 0 THEN 1 ELSE 0 END)::int AS null_count,
                  SUM(CASE WHEN anchor_id IS NULL THEN 1 ELSE 0 END)::int AS missing_anchor,
                  SUM(CASE WHEN room_id IS NULL THEN 1 ELSE 0 END)::int AS missing_room,
                  ROUND(100.0 * SUM(CASE WHEN gmv IS NULL OR gmv = 0 THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1), 1) AS null_rate
           FROM live_sessions`,
        )
        const uploadsToday = await client.query(
          `SELECT data_type, COUNT(*)::int AS cnt
           FROM data_uploads
           WHERE business_date = $1::date AND status = 'completed'
           GROUP BY data_type`,
          [today],
        )
        return {
          q: rows[0] || { total: 0, null_count: 0, null_rate: 0, missing_anchor: 0, missing_room: 0 },
          uploadedTypes: new Set(uploadsToday.rows.map((r: any) => r.data_type)),
        }
      })

      const alerts: string[] = []
      if (!uploadedTypes.has('anchor_analysis')) alerts.push('\u4E3B\u64AD\u5206\u6790\u65E5\u62A5\u672A\u4E0A\u4F20')
      if (!uploadedTypes.has('channel_analysis')) alerts.push('\u6E20\u9053\u5206\u6790\u65E5\u62A5\u672A\u4E0A\u4F20')

      return sendOk(reply, {
        tables: [
          {
            id: 'live_sessions',
            name: '\u573A\u6B21\u6570\u636E',
            total: q.total,
            nullCount: q.null_count,
            nullRate: `${q.null_rate}%`,
            missingAnchor: q.missing_anchor,
            missingRoom: q.missing_room,
            status: q.null_rate > 10 ? 'warning' : 'good',
          },
        ],
        alerts,
      })
    } catch (err) {
      request.log.warn({ err }, 'data/quality query failed')
      return sendOk(reply, { tables: [], alerts: [] })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 上传数据管理 — 主播分析数据
  // ═══════════════════════════════════════════════════════════════

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
