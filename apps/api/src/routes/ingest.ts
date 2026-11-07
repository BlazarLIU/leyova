/**
 * ingest.ts — 数据接入中心路由
 *
 * 覆盖计划第四章「双轨数据接入」：
 *   ① 官方 OpenAPI 同步     POST /ingest/sync
 *   ② 手动上传自定义清洗     POST /ingest/preview, POST /ingest/manual-upload
 *   ③ 上传模板与列映射        GET/POST /ingest/templates, GET/POST /ingest/mappings
 *   ④ 接入任务监控           GET /ingest/jobs, GET /ingest/jobs/:id
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as XLSX from 'xlsx'
import { createHash } from 'node:crypto'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { runSyncJob, runPlatformSync, type SyncDataType } from '../ingest/sync-job.js'
import { ingestManualFacts, mapRowsToStandard, TRADE_COLUMN_ALIASES, TRAFFIC_COLUMN_ALIASES } from '../ingest/manual-mapper.js'
import { executeCleaningPipeline } from '../ingest/cleaner/engine.js'

/**
 * 读取上传的文件为行对象数组。
 *
 * CSV 处理要点：电商后台导出的 CSV 常把金额写成 `￥12,345.60` 且不带引号，
 * 直接交给通用 CSV 解析器会把一列拆成两列，导致后面整行错位。
 *
 * 采用「按列数对齐」的结构化修复：先按逗号无脑切分，若切出的字段数多于表头列数，
 * 则尝试把相邻两个字段重新合并（中间补回逗号），使字段数恰好等于表头列数。
 * 只有在合并后的两个片段都像同一个数字（$/数字 结尾 + 数字开头）时才合并，
 * 避免把两个真正独立的列误并。
 */
const NUMERIC_BOUNDARY = /[￥¥$]?\s*[\d,]+\.?\d*$/
const NUMERIC_START = /^\d{1,3}(?:[,.]\d+)*$/

function mergeNumericFragments(fields: string[], expected: number): string[] {
  if (fields.length <= expected) return fields
  const out: string[] = []
  let i = 0
  while (i < fields.length) {
    const remainingSlots = expected - out.length
    const remainingFields = fields.length - i
    // 剩余字段多于剩余槽位 → 说明有金额被逗号拆开，尝试合并相邻两段
    if (remainingFields > remainingSlots) {
      const a = fields[i]
      const b = fields[i + 1]
      const combined = `${a},${b}`
      const looksSplittable =
        NUMERIC_BOUNDARY.test(a.trim()) &&
        NUMERIC_START.test(b.trim()) &&
        /^[￥¥$]?[\d,]/.test(combined)
      if (looksSplittable) {
        out.push(combined)
        i += 2
        continue
      }
    }
    out.push(fields[i])
    i++
  }
  return out
}

/** 轻量 CSV 切分（支持双引号包裹字段、双引号转义） */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseFileToRows(
  buffer: Buffer,
  fileName: string,
): { headers: string[]; rows: Record<string, any>[] } {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  if (ext === 'csv' || ext === 'tsv') {
    const delimiter = ext === 'tsv' ? '\t' : ','
    const text = buffer.toString('utf-8').replace(/^\uFEFF/, '')
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
    if (lines.length === 0) return { headers: [], rows: [] }

    const headers = splitCsvLine(lines[0], delimiter).map((h) => h.trim())
    const expected = headers.length
    const rows: Record<string, any>[] = []

    for (let i = 1; i < lines.length; i++) {
      let fields = splitCsvLine(lines[i], delimiter)
      if (fields.length > expected) fields = mergeNumericFragments(fields, expected)
      // 仍不匹配则记录为错位行，交由上层统计，不静默丢弃
      const obj: Record<string, any> = {}
      headers.forEach((h, idx) => { obj[h] = fields[idx] !== undefined ? fields[idx].trim() : '' })
      if (fields.length !== expected) obj.__misaligned__ = fields.length
      rows.push(obj)
    }
    return { headers, rows }
  }

  const wb = XLSX.read(buffer, { type: 'buffer', raw: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}

/** 列名指纹，用于复用已保存的列映射 */
function headerFingerprint(headers: string[]): string {
  return createHash('sha256').update(headers.join('|')).digest('hex').slice(0, 32)
}

export async function ingestRoutes(app: FastifyInstance) {
  const pool = getPool()

  // ═══════════════════════════════════════════════════════════════
  // ① 官方 OpenAPI 同步
  // ═══════════════════════════════════════════════════════════════

  // ── POST /api/v1/ingest/sync ── 触发同步（单店铺 或 整平台）
  app.post('/api/v1/ingest/sync', async (request: FastifyRequest<{
    Body: {
      platformCode: string
      shopId?: number
      dataType?: SyncDataType
      since?: string
    }
  }>, reply: FastifyReply) => {
    try {
      const { platformCode, shopId, dataType = 'trade', since } = request.body || {}
      if (!platformCode) return sendError(reply, 400, '缺少 platformCode')

      const results = shopId
        ? [await runSyncJob(pool, platformCode, shopId, dataType, since)]
        : await runPlatformSync(pool, platformCode, dataType, since)

      const summary = {
        total: results.length,
        completed: results.filter((r) => r.status === 'completed').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        failed: results.filter((r) => r.status === 'failed').length,
      }
      return sendOk(reply, { summary, results }, '同步任务已执行')
    } catch (err) {
      request.log.error({ err }, 'Failed to run ingest sync')
      return sendError(reply, 500, '执行同步任务失败')
    }
  })

  // ── GET /api/v1/ingest/jobs ── 任务列表（接入监控）
  app.get('/api/v1/ingest/jobs', async (request: FastifyRequest<{
    Querystring: { platform?: string; status?: string; limit?: string }
  }>, reply: FastifyReply) => {
    try {
      const { platform, status, limit } = request.query
      const conds: string[] = []
      const params: any[] = []
      let i = 1
      if (platform) { conds.push(`j.platform_code = $${i++}`); params.push(platform) }
      if (status) { conds.push(`j.status = $${i++}`); params.push(status) }
      const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
      const lim = Math.min(parseInt(limit || '50', 10) || 50, 200)

      const { rows } = await pool.query(
        `SELECT j.*, s.shop_name, p.platform_name
           FROM ingest_sync_jobs j
           LEFT JOIN dim_shop s ON s.id = j.shop_id
           LEFT JOIN system_platform_configs p ON p.platform_code = j.platform_code
           ${where}
          ORDER BY j.started_at DESC
          LIMIT ${lim}`,
        params,
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to list ingest jobs')
      return sendError(reply, 500, '获取接入任务列表失败')
    }
  })

  // ── GET /api/v1/ingest/stats ── 接入总览统计
  app.get('/api/v1/ingest/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await pool.query(`
        SELECT platform_code,
               count(*) FILTER (WHERE status = 'completed') AS completed,
               count(*) FILTER (WHERE status = 'failed') AS failed,
               count(*) FILTER (WHERE status = 'running') AS running,
               COALESCE(sum(success_rows), 0) AS total_success_rows,
               max(completed_at) AS last_completed_at
          FROM ingest_sync_jobs
         GROUP BY platform_code
         ORDER BY platform_code`)
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取接入统计失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // ③ 上传模板与列映射
  // ═══════════════════════════════════════════════════════════════

  // ── GET /api/v1/ingest/templates?platform= ── 可用模板（标准字段清单 + 已保存映射）
  app.get('/api/v1/ingest/templates', async (request: FastifyRequest<{
    Querystring: { platform?: string; dataType?: string }
  }>, reply: FastifyReply) => {
    try {
      const { platform, dataType = 'trade' } = request.query
      const aliases = dataType === 'traffic' ? TRAFFIC_COLUMN_ALIASES : TRADE_COLUMN_ALIASES
      const fields = Object.entries(aliases).map(([field, aliasList]) => ({
        field,
        aliases: aliasList,
        required: field === 'biz_date',
      }))

      let savedMappings: any[] = []
      if (platform) {
        const r = await pool.query(
          `SELECT id, template_code, platform_code, file_header_fingerprint, column_mappings, created_at
             FROM upload_column_mappings WHERE platform_code = $1 ORDER BY id DESC`,
          [platform],
        )
        savedMappings = r.rows
      }

      const ruleSets = platform
        ? (await pool.query(
            `SELECT id, name, description, is_system, rules FROM clean_rule_sets WHERE platform_code = $1 ORDER BY is_system DESC, id`,
            [platform],
          )).rows
        : []

      return sendOk(reply, { fields, savedMappings, ruleSets })
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch templates')
      return sendError(reply, 500, '获取上传模板失败')
    }
  })

  // ── POST /api/v1/ingest/mappings ── 保存自定义列映射
  app.post('/api/v1/ingest/mappings', async (request: FastifyRequest<{
    Body: {
      templateCode: string
      platformCode: string
      headers: string[]
      columnMappings: Record<string, string | null>
    }
  }>, reply: FastifyReply) => {
    try {
      const { templateCode, platformCode, headers, columnMappings } = request.body || {}
      if (!platformCode || !Array.isArray(headers) || !columnMappings) {
        return sendError(reply, 400, '缺少必要参数 (platformCode, headers, columnMappings)')
      }
      const fp = headerFingerprint(headers)
      const { rows } = await pool.query(
        `INSERT INTO upload_column_mappings
           (template_code, platform_code, file_header_fingerprint, column_mappings)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (platform_code, file_header_fingerprint)
         DO UPDATE SET column_mappings = EXCLUDED.column_mappings, template_code = EXCLUDED.template_code
         RETURNING *`,
        [templateCode || 'custom', platformCode, fp, JSON.stringify(columnMappings)],
      )
      return sendOk(reply, rows[0], '列映射已保存')
    } catch (err) {
      request.log.error({ err }, 'Failed to save mapping')
      return sendError(reply, 500, '保存列映射失败')
    }
  })

  // ── POST /api/v1/ingest/fingerprint ── 计算表头指纹并查询已有映射
  app.post('/api/v1/ingest/fingerprint', async (request: FastifyRequest<{
    Body: { platformCode: string; headers: string[] }
  }>, reply: FastifyReply) => {
    try {
      const { platformCode, headers } = request.body || {}
      if (!platformCode || !Array.isArray(headers)) return sendError(reply, 400, '缺少必要参数')
      const fp = headerFingerprint(headers)
      const { rows } = await pool.query(
        `SELECT * FROM upload_column_mappings WHERE platform_code = $1 AND file_header_fingerprint = $2`,
        [platformCode, fp],
      )
      return sendOk(reply, { fingerprint: fp, existing: rows[0] || null })
    } catch (err) {
      return sendError(reply, 500, '计算表头指纹失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // ② 手动上传：预演 / 正式导入
  // ═══════════════════════════════════════════════════════════════

  // ── POST /api/v1/ingest/preview ── 上传文件 → 解析 + 映射建议 + 清洗预演 Diff
  app.post('/api/v1/ingest/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileName = 'unknown'
      let platformCode = ''
      let dataType: 'trade' | 'traffic' = 'trade'
      let ruleSetId: number | null = null
      let bizDate = ''
      let mappingOverride: Record<string, string | null> | null = null

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk as Buffer)
          fileBuffer = Buffer.concat(chunks)
          fileName = part.filename || 'unknown'
        } else if (part.fieldname === 'platform_code') {
          platformCode = String(part.value || '').trim()
        } else if (part.fieldname === 'data_type') {
          const v = String(part.value || '').trim()
          if (v === 'traffic' || v === 'trade') dataType = v
        } else if (part.fieldname === 'rule_set_id') {
          const n = parseInt(String(part.value || ''), 10)
          if (Number.isFinite(n)) ruleSetId = n
        } else if (part.fieldname === 'business_date') {
          bizDate = String(part.value || '').trim()
        } else if (part.fieldname === 'column_mappings') {
          try { mappingOverride = JSON.parse(String(part.value)) } catch { /* ignore */ }
        }
      }

      if (!fileBuffer) return sendError(reply, 400, '未选择文件')
      if (!platformCode) return sendError(reply, 400, '缺少 platform_code')

      const { headers, rows } = parseFileToRows(fileBuffer, fileName)
      if (rows.length === 0) return sendError(reply, 400, '文件解析后没有数据行')

      // 套用列映射（用户覆盖优先）
      let workingRows = rows
      let appliedMapping: Record<string, string | null> | null = null
      if (mappingOverride) {
        appliedMapping = mappingOverride
        workingRows = rows.map((r) => {
          const out: Record<string, any> = {}
          for (const [targetField, sourceCol] of Object.entries(mappingOverride!)) {
            if (sourceCol && sourceCol in r) out[targetField] = r[sourceCol]
          }
          // 保留原始列，便于清洗规则按中文列名工作
          return { ...r, ...out }
        })
      }

      // 清洗预演
      let cleanReport: any = null
      let cleanedRows = workingRows
      if (ruleSetId) {
        const rs = await pool.query(`SELECT rules FROM clean_rule_sets WHERE id = $1`, [ruleSetId])
        if (rs.rows.length > 0) {
          const rules = rs.rows[0].rules || []
          const out = executeCleaningPipeline(workingRows, rules, { maxDiffSamples: 30 })
          cleanedRows = out.cleanedRows
          cleanReport = out.report
        }
      } else {
        // 即使没有规则集，也返回一个基础统计
        cleanReport = {
          inputRowsCount: workingRows.length,
          successRowsCount: workingRows.length,
          droppedRowsCount: 0,
          modifiedRowsCount: 0,
          markedRowsCount: 0,
          rulesAppliedCount: 0,
          sampleDiffs: [],
        }
      }

      // 映射建议 + 试映射
      const mapped = mapRowsToStandard(cleanedRows, dataType, bizDate || undefined)

      const fp = headerFingerprint(headers)
      const existing = await pool.query(
        `SELECT * FROM upload_column_mappings WHERE platform_code = $1 AND file_header_fingerprint = $2`,
        [platformCode, fp],
      )

      const result = {
        fileName,
        platformCode,
        dataType,
        headers,
        totalRows: rows.length,
        fingerprint: fp,
        savedMapping: existing.rows[0] || null,
        suggestedMapping: appliedMapping || mapped.mapping,
        cleanReport,
        mappedPreview: mapped.rows.slice(0, 20),
        rejectedCount: mapped.rejected.length,
        rejectedSample: mapped.rejected.slice(0, 10),
        rawSample: rows.slice(0, 10),
      }

      // 返回时清空 sampleDiffs 中的大对象，避免响应过大
      if (result.cleanReport?.sampleDiffs?.length > 10) {
        result.cleanReport.sampleDiffs = result.cleanReport.sampleDiffs.slice(0, 10)
      }

      return sendOk(reply, result)
    } catch (err) {
      request.log.error({ err }, 'ingest/preview failed')
      return sendError(reply, 500, '上传预演失败')
    }
  })

  // ── POST /api/v1/ingest/manual-upload ── 正式导入（绑定模板+映射+规则集）
  app.post('/api/v1/ingest/manual-upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileName = 'unknown'
      let platformCode = ''
      let shopId: number | null = null
      let dataType: 'trade' | 'traffic' = 'trade'
      let ruleSetId: number | null = null
      let bizDate = ''
      let mappingOverride: Record<string, string | null> | null = null

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk as Buffer)
          fileBuffer = Buffer.concat(chunks)
          fileName = part.filename || 'unknown'
        } else if (part.fieldname === 'platform_code') {
          platformCode = String(part.value || '').trim()
        } else if (part.fieldname === 'shop_id') {
          const n = parseInt(String(part.value || ''), 10)
          if (Number.isFinite(n)) shopId = n
        } else if (part.fieldname === 'data_type') {
          const v = String(part.value || '').trim()
          if (v === 'traffic' || v === 'trade') dataType = v
        } else if (part.fieldname === 'rule_set_id') {
          const n = parseInt(String(part.value || ''), 10)
          if (Number.isFinite(n)) ruleSetId = n
        } else if (part.fieldname === 'business_date') {
          bizDate = String(part.value || '').trim()
        } else if (part.fieldname === 'column_mappings') {
          try { mappingOverride = JSON.parse(String(part.value)) } catch { /* ignore */ }
        }
      }

      if (!fileBuffer) return sendError(reply, 400, '未选择文件')
      if (!platformCode) return sendError(reply, 400, '缺少 platform_code')
      if (!shopId) return sendError(reply, 400, '缺少 shop_id')

      const shopCheck = await pool.query(
        `SELECT id FROM dim_shop WHERE id = $1 AND platform_code = $2`,
        [shopId, platformCode],
      )
      if (shopCheck.rows.length === 0) return sendError(reply, 400, '店铺不存在或不属于该平台')

      const { rows } = parseFileToRows(fileBuffer, fileName)
      if (rows.length === 0) return sendError(reply, 400, '文件解析后没有数据行')

      let workingRows = rows
      if (mappingOverride) {
        workingRows = rows.map((r) => {
          const out: Record<string, any> = {}
          for (const [targetField, sourceCol] of Object.entries(mappingOverride!)) {
            if (sourceCol && sourceCol in r) out[targetField] = r[sourceCol]
          }
          return { ...r, ...out }
        })
      }

      if (ruleSetId) {
        const rs = await pool.query(`SELECT rules FROM clean_rule_sets WHERE id = $1`, [ruleSetId])
        if (rs.rows.length === 0) return sendError(reply, 404, '清洗规则集不存在')
        const out = executeCleaningPipeline(workingRows, rs.rows[0].rules || [])
        workingRows = out.cleanedRows
      }

      const result = await ingestManualFacts(pool, {
        platformCode,
        shopId,
        dataType,
        rows: workingRows,
        defaultBizDate: bizDate || undefined,
        cleanRuleSetId: ruleSetId,
      })

      return sendOk(reply, {
        ...result,
        fileName,
        inputRows: rows.length,
        cleanedRows: workingRows.length,
      }, `导入完成：成功 ${result.insertedRows} 行，拒绝 ${result.rejectedRows} 行`)
    } catch (err) {
      request.log.error({ err }, 'ingest/manual-upload failed')
      return sendError(reply, 500, '手动上传导入失败')
    }
  })

  // ── GET /api/v1/ingest/facts ── 事实表查询（调试与验证用）
  app.get('/api/v1/ingest/facts', async (request: FastifyRequest<{
    Querystring: { platform?: string; shopId?: string; from?: string; to?: string; limit?: string }
  }>, reply: FastifyReply) => {
    try {
      const { platform, shopId, from, to, limit } = request.query
      const conds: string[] = []
      const params: any[] = []
      let i = 1
      if (platform) { conds.push(`f.platform_code = $${i++}`); params.push(platform) }
      if (shopId) { conds.push(`f.shop_id = $${i++}`); params.push(parseInt(shopId, 10)) }
      if (from) { conds.push(`f.biz_date >= $${i++}::date`); params.push(from) }
      if (to) { conds.push(`f.biz_date <= $${i++}::date`); params.push(to) }
      const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
      const lim = Math.min(parseInt(limit || '100', 10) || 100, 500)

      const { rows } = await pool.query(
        `SELECT f.*, s.shop_name
           FROM fact_trade_daily f
           LEFT JOIN dim_shop s ON s.id = f.shop_id
           ${where}
          ORDER BY f.biz_date DESC, f.id DESC
          LIMIT ${lim}`,
        params,
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to query facts')
      return sendError(reply, 500, '查询事实表失败')
    }
  })
}
