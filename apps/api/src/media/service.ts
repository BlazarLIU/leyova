/**
 * media/service.ts — W11 媒体流水线编排
 *
 * 流程：上传 → 探测 → 转写（ASR/人工）→ 高光评分 → 渲染切片（含字幕/封面）
 *      → 回写 content_assets → 可选入知识库 → 剪映草稿导出
 *
 * 设计取舍：
 *   1. 渲染在请求内同步执行（单个切片 12–90s），并受 maxCount 限制；
 *      大批量应改走 worker，此处保留 queued/running 状态便于后续迁移。
 *   2. 任一步失败都落库失败原因，不吞错；产物半成品由 ffmpeg 层回收。
 */

import { createWriteStream, existsSync } from 'node:fs'
import { stat, unlink } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { getPool, type DbExecutor } from '../lib/db.js'
import { ingestDocument } from '../knowledge/service.js'
import { env } from '../config/env.js'
import {
  MediaCommandError,
  ensureDir,
  mediaDir,
  probeMedia,
  renderClip,
  renderCover,
} from './ffmpeg.js'
import { parseManualTranscript, transcribe, type AsrConfig, type AsrProvider } from './asr.js'
import {
  computeHighlights,
  defaultTitle,
  type HighlightPipelineOptions,
  type HighlightWindow,
} from './highlights.js'
import { exportJianyingDraft } from './jianying.js'

const ALLOWED_EXT = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.mp3', '.wav', '.m4a', '.aac', '.flac'])

export interface MediaAssetView {
  id: string
  title: string
  sourceType: string
  mimeType: string
  sizeBytes: number
  durationMs: number
  width: number | null
  height: number | null
  hasAudio: boolean
  status: string
  businessKey: string
  transcriptProvider: string | null
  segmentCount: number
  highlightCount: number
  clipCount: number
  createdAt: string
}

/** 安全文件名：仅保留字母数字与少量安全符号，防止路径穿越 */
export function safeFileName(original: string): string {
  const raw = basename(String(original || 'upload'))
  const ext = extname(raw).toLowerCase()
  const stem = raw
    .slice(0, raw.length - ext.length)
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '_')
    .slice(0, 60) || 'upload'
  return `${Date.now()}-${stem}${ext}`
}

export function assertAllowedExtension(fileName: string): void {
  const ext = extname(String(fileName || '')).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`不支持的文件类型：${ext || '无扩展名'}（支持 ${Array.from(ALLOWED_EXT).join(' / ')}）`)
  }
}

export interface UploadInput {
  tenantId: number
  title: string
  originalName: string
  stream: NodeJS.ReadableStream
  businessKey?: string
  userId?: number | null
  /** 由 multipart 提供的已知大小，用于提前拒绝超大文件 */
  declaredSize?: number
  db?: DbExecutor
}

export interface UploadResult {
  assetId: string
  storagePath: string
  durationMs: number
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  hasAudio: boolean
}

/** 落盘上传：流式写入，禁止整段读入内存 */
export async function uploadMedia(input: UploadInput): Promise<UploadResult> {
  const executor = input.db || getPool()
  assertAllowedExtension(input.originalName)

  const maxBytes = Math.max(1, env.MEDIA_MAX_UPLOAD_MB) * 1024 * 1024
  if (input.declaredSize && input.declaredSize > maxBytes) {
    throw new Error(`文件过大：上限 ${env.MEDIA_MAX_UPLOAD_MB}MB`)
  }

  const dir = mediaDir('source', input.tenantId)
  const fileName = safeFileName(input.originalName)
  const targetPath = resolve(dir, fileName)

  await pipeline(input.stream, createWriteStream(targetPath))

  let probe: Awaited<ReturnType<typeof probeMedia>>
  try {
    const info = await stat(targetPath)
    if (info.size > maxBytes) throw new Error(`文件过大：上限 ${env.MEDIA_MAX_UPLOAD_MB}MB`)
    probe = await probeMedia(targetPath)
  } catch (err) {
    await unlink(targetPath).catch(() => undefined)
    throw err instanceof MediaCommandError
      ? new Error('文件无法解析为音视频，请确认格式')
      : err
  }

  const { rows } = await executor.query<{ id: string }>(
    `INSERT INTO public.media_assets
       (tenant_id, title, source_type, storage_path, mime_type, size_bytes, duration_ms,
        width, height, has_audio, status, business_key, meta, created_by)
     VALUES ($1, $2, 'upload', $3, $4, $5, $6, $7, $8, $9, 'uploaded', $10, $11::jsonb, $12)
     RETURNING id`,
    [
      input.tenantId,
      String(input.title || basename(input.originalName)).slice(0, 255),
      targetPath,
      probe.mimeType,
      probe.sizeBytes,
      probe.durationMs,
      probe.width,
      probe.height,
      probe.hasAudio,
      String(input.businessKey || '').slice(0, 120),
      JSON.stringify({ originalName: input.originalName }),
      input.userId ?? null,
    ]
  )

  return {
    assetId: rows[0].id,
    storagePath: targetPath,
    durationMs: probe.durationMs,
    mimeType: probe.mimeType,
    sizeBytes: probe.sizeBytes,
    width: probe.width,
    height: probe.height,
    hasAudio: probe.hasAudio,
  }
}

export interface TranscribeInput {
  tenantId: number
  assetId: string
  provider: AsrProvider
  apiBase?: string
  apiKey?: string
  model?: string
  /** 人工转写内容（SRT 或 [mm:ss] 时间轴），provider=manual 时必填 */
  manualContent?: string
  db?: DbExecutor
}

export interface TranscribeResult {
  transcriptId: string
  provider: string
  segmentCount: number
  ok: boolean
  error?: string
  segments: Array<{ text: string; startMs: number; endMs: number; speaker?: string }>
}

/** 转写并落库；失败时保留 failed 记录，便于重试与排查 */
export async function transcribeAsset(input: TranscribeInput): Promise<TranscribeResult> {
  const executor = input.db || getPool()
  const { rows } = await executor.query<{ id: string; storage_path: string; status: string }>(
    `SELECT id, storage_path, status FROM public.media_assets
      WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [input.tenantId, input.assetId]
  )
  const asset = rows[0]
  if (!asset) throw new Error('媒体素材不存在')
  if (!existsSync(asset.storage_path)) throw new Error('源文件已丢失，请重新上传')

  await executor.query(
    `UPDATE public.media_assets SET status = 'transcribing', updated_at = now() WHERE id = $1`,
    [asset.id]
  )

  const config: AsrConfig = {
    provider: input.provider,
    apiBase: input.apiBase || '',
    apiKey: input.apiKey || '',
    model: input.model || 'whisper-1',
  }

  const result = await transcribe(asset.storage_path, config, input.manualContent)

  const fullText = result.fullText
  const { rows: transcriptRows } = await executor.query<{ id: string }>(
    `INSERT INTO public.media_transcripts
       (tenant_id, asset_id, provider, language, segment_count, segments, full_text, status, error)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
     ON CONFLICT (asset_id, provider) DO UPDATE
       SET language = EXCLUDED.language,
           segment_count = EXCLUDED.segment_count,
           segments = EXCLUDED.segments,
           full_text = EXCLUDED.full_text,
           status = EXCLUDED.status,
           error = EXCLUDED.error
     RETURNING id`,
    [
      input.tenantId,
      asset.id,
      result.provider,
      result.language,
      result.segments.length,
      JSON.stringify(result.segments),
      fullText,
      result.ok ? 'ready' : 'failed',
      String(result.error || '').slice(0, 1000),
    ]
  )

  await executor.query(
    `UPDATE public.media_assets
        SET status = $2, updated_at = now()
      WHERE id = $1`,
    [asset.id, result.ok ? 'transcribed' : 'failed']
  )

  return {
    transcriptId: transcriptRows[0].id,
    provider: result.provider,
    segmentCount: result.segments.length,
    ok: result.ok,
    error: result.error,
    segments: result.segments,
  }
}

/** 读取可用转写：优先人工（可复核），其次任意 ready */
export async function loadTranscript(
  tenantId: number,
  assetId: string,
  db?: DbExecutor
): Promise<{ id: string; provider: string; segments: Array<{ text: string; startMs: number; endMs: number; speaker?: string }> } | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT id, provider, segments FROM public.media_transcripts
      WHERE tenant_id = $1 AND asset_id = $2 AND status = 'ready'
      ORDER BY CASE provider WHEN 'manual' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 1`,
    [tenantId, assetId]
  )
  const row = rows[0]
  if (!row) return null
  const segments = Array.isArray(row.segments) ? row.segments : []
  if (segments.length === 0) return null
  return { id: row.id, provider: row.provider, segments }
}

export interface AnalyseInput {
  tenantId: number
  assetId: string
  options?: HighlightPipelineOptions
  db?: DbExecutor
}

export interface AnalyseResult {
  highlightCount: number
  highlights: Array<{
    id: string
    startMs: number
    endMs: number
    durationMs: number
    score: number
    title: string
    reason: string
    scoreDetail: Record<string, number>
  }>
}

/** 高光分析：重算时保留已渲染切片对应的命中，其余候选重建 */
export async function analyseAsset(input: AnalyseInput): Promise<AnalyseResult> {
  const executor = input.db || getPool()
  const transcript = await loadTranscript(input.tenantId, input.assetId, executor)
  if (!transcript) throw new Error('尚无可用转写，请先完成转写')

  const highlights = computeHighlights(transcript.segments, input.options || {})

  // 清掉旧的候选（不删已渲染/已选中，避免丢产物）
  await executor.query(
    `DELETE FROM public.media_highlights
      WHERE tenant_id = $1 AND asset_id = $2 AND status = 'candidate'`,
    [input.tenantId, input.assetId]
  )

  const saved: AnalyseResult['highlights'] = []
  for (const item of highlights) {
    const title = defaultTitle(item.text)
    const reason = `关键词 ${item.detail.keyword} / 密度 ${item.detail.density} / 时长 ${item.detail.length} / 位置 ${item.detail.position}`
    const { rows } = await executor.query<{ id: string }>(
      `INSERT INTO public.media_highlights
         (tenant_id, asset_id, transcript_id, start_ms, end_ms, duration_ms, score, title, reason, score_detail, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, 'candidate')
       RETURNING id`,
      [
        input.tenantId,
        input.assetId,
        transcript.id,
        item.startMs,
        item.endMs,
        item.durationMs,
        item.score,
        title,
        reason.slice(0, 500),
        JSON.stringify(item.detail),
      ]
    )
    saved.push({
      id: rows[0].id,
      startMs: item.startMs,
      endMs: item.endMs,
      durationMs: item.durationMs,
      score: item.score,
      title,
      reason,
      scoreDetail: item.detail,
    })
  }

  await executor.query(
    `UPDATE public.media_assets SET status = 'analysed', updated_at = now() WHERE id = $1`,
    [input.assetId]
  )

  return { highlightCount: saved.length, highlights: saved }
}

/** 生成 SRT（毫秒 → 00:00:00,000） */
export function toSrtTime(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const h = Math.floor(total / 3_600_000)
  const m = Math.floor((total % 3_600_000) / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  const millis = total % 1000
  const pad = (value: number, size = 2) => String(value).padStart(size, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(millis, 3)}`
}

/** 把切片区间内的转写片段转成 SRT（时间相对切片起点） */
export function buildClipSrt(
  segments: Array<{ text: string; startMs: number; endMs: number }>,
  clipStartMs: number,
  clipEndMs: number
): string {
  const lines: string[] = []
  let index = 1
  for (const seg of segments) {
    const start = Math.max(seg.startMs, clipStartMs)
    const end = Math.min(seg.endMs, clipEndMs)
    if (end <= start) continue
    lines.push(String(index))
    lines.push(`${toSrtTime(start - clipStartMs)} --> ${toSrtTime(end - clipStartMs)}`)
    lines.push(seg.text.trim())
    lines.push('')
    index += 1
  }
  return lines.join('\n')
}

export interface RenderInput {
  tenantId: number
  assetId: string
  highlightIds?: string[]
  /** 竖屏画幅，默认 1080x1920 */
  width?: number
  height?: number
  burnSubtitle?: boolean
  userId?: number | null
  db?: DbExecutor
}

export interface RenderResult {
  rendered: number
  failed: number
  clips: Array<{
    jobId: string
    highlightId: string
    status: string
    outputPath: string
    coverPath: string
    error: string
  }>
}

/**
 * 渲染切片：
 *   - 默认取该素材下评分最高的候选（最多 3 条，控制同步耗时）；
 *   - 每条切片独立落 job，失败不阻断其余；
 *   - 成功后写 content_assets，parent_asset_id 关联母版。
 */
export async function renderHighlights(input: RenderInput): Promise<RenderResult> {
  const executor = input.db || getPool()
  const { rows: assetRows } = await executor.query<{
    id: string
    title: string
    storage_path: string
    content_asset_id: number | null
    business_key: string
  }>(
    `SELECT id, title, storage_path, content_asset_id, business_key FROM public.media_assets
      WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [input.tenantId, input.assetId]
  )
  const asset = assetRows[0]
  if (!asset) throw new Error('媒体素材不存在')
  if (!existsSync(asset.storage_path)) throw new Error('源文件已丢失，请重新上传')

  const transcript = await loadTranscript(input.tenantId, input.assetId, executor)
  if (!transcript) throw new Error('尚无可用转写，请先完成转写')

  const highlightFilter = Array.isArray(input.highlightIds) && input.highlightIds.length > 0
  const params: unknown[] = [input.tenantId, input.assetId]
  let clause = ''
  if (highlightFilter) {
    params.push(input.highlightIds)
    clause = ` AND id = ANY($${params.length}::uuid[])`
  } else {
    clause = ` AND status = 'candidate'`
  }

  const { rows: highlightRows } = await executor.query<any>(
    `SELECT id, start_ms, end_ms, duration_ms, title, score
       FROM public.media_highlights
      WHERE tenant_id = $1 AND asset_id = $2 ${clause}
      ORDER BY score DESC
      LIMIT ${highlightFilter ? 20 : 3}`,
    params
  )
  if (highlightRows.length === 0) throw new Error('没有可渲染的高光候选，请先执行高光分析')

  const clipsDir = mediaDir('clips', input.tenantId)
  const coversDir = mediaDir('covers', input.tenantId)
  const subtitleDir = mediaDir('subtitles', input.tenantId)
  const clips: RenderResult['clips'] = []
  let rendered = 0
  let failed = 0

  for (const highlight of highlightRows) {
    const job = await executor.query<{ id: string }>(
      `INSERT INTO public.media_render_jobs
         (tenant_id, asset_id, highlight_id, status, stage, progress, options, started_at, created_by)
       VALUES ($1, $2, $3, 'running', 'probe', 10, $4::jsonb, now(), $5)
       RETURNING id`,
      [
        input.tenantId,
        input.assetId,
        highlight.id,
        JSON.stringify({
          width: input.width || 1080,
          height: input.height || 1920,
          burnSubtitle: input.burnSubtitle !== false,
        }),
        input.userId ?? null,
      ]
    )
    const jobId = job.rows[0].id

    try {
      const startMs = Number(highlight.start_ms)
      const endMs = Number(highlight.end_ms)
      const outputPath = resolve(clipsDir, `${highlight.id}.mp4`)

      // 字幕：先写 SRT，再烧录；burnSubtitle=false 时仅生成 SRT 供剪辑软件使用
      let subtitlePath = ''
      if (input.burnSubtitle !== false) {
        const srt = buildClipSrt(transcript.segments, startMs, endMs)
        if (srt.trim()) {
          subtitlePath = resolve(subtitleDir, `${highlight.id}.srt`)
          const { writeFile } = await import('node:fs/promises')
          await writeFile(subtitlePath, srt, 'utf8')
        }
      }
      await executor.query(
        `UPDATE public.media_render_jobs SET stage = 'cut', progress = 30 WHERE id = $1`,
        [jobId]
      )

      const clip = await renderClip({
        sourcePath: asset.storage_path,
        outputPath,
        startMs,
        endMs,
        width: input.width || 1080,
        height: input.height || 1920,
        subtitlePath: subtitlePath || undefined,
      })

      await executor.query(
        `UPDATE public.media_render_jobs SET stage = 'cover', progress = 75 WHERE id = $1`,
        [jobId]
      )

      const coverPath = resolve(coversDir, `${highlight.id}.jpg`)
      let coverSize = 0
      try {
        const cover = await renderCover({
          sourcePath: clip.outputPath,
          outputPath: coverPath,
          atMs: Math.min(1500, Math.max(0, Math.floor(clip.durationMs / 3))),
        })
        coverSize = cover.sizeBytes
      } catch {
        // 封面失败不影响主产物
      }

      // 回写 content_assets（母版存在时挂 parent_asset_id）
      const assetInsert = await executor.query<{ id: number }>(
        `INSERT INTO public.content_assets
           (project_id, task_id, asset_type, name, url, local_path, size_bytes, duration_seconds,
            provider, extra, tenant_id, parent_asset_id, source_platform, distribution_status, compliance_status)
         VALUES (NULL, NULL, 'video', $1, $2, $3, $4, $5, 'media_pipeline', $6::jsonb, $7, $8, NULL, 'draft', 'pending')
         RETURNING id`,
        [
          String(highlight.title || asset.title).slice(0, 200),
          `/api/v1/media/files/clips/${input.tenantId}/${basename(clip.outputPath)}`,
          clip.outputPath,
          clip.sizeBytes || coverSize,
          Math.round(clip.durationMs / 1000),
          JSON.stringify({
            mediaAssetId: input.assetId,
            highlightId: highlight.id,
            coverPath,
            subtitlePath,
            score: Number(highlight.score),
            businessKey: asset.business_key,
          }),
          input.tenantId,
          asset.content_asset_id,
        ]
      )

      await executor.query(
        `UPDATE public.media_render_jobs
            SET status = 'succeeded', stage = 'done', progress = 100,
                output_path = $2, cover_path = $3, subtitle_path = $4,
                content_asset_id = $5, duration_ms = $6, size_bytes = $7, finished_at = now()
          WHERE id = $1`,
        [
          jobId,
          clip.outputPath,
          existsSync(coverPath) ? coverPath : '',
          subtitlePath,
          assetInsert.rows[0].id,
          clip.durationMs,
          clip.sizeBytes,
        ]
      )
      await executor.query(
        `UPDATE public.media_highlights SET status = 'rendered' WHERE id = $1`,
        [highlight.id]
      )

      rendered += 1
      clips.push({
        jobId,
        highlightId: highlight.id,
        status: 'succeeded',
        outputPath: clip.outputPath,
        coverPath: existsSync(coverPath) ? coverPath : '',
        error: '',
      })
    } catch (err) {
      failed += 1
      const message = (err as Error)?.message || String(err)
      await executor.query(
        `UPDATE public.media_render_jobs
            SET status = 'failed', stage = 'failed', error = $2, finished_at = now()
          WHERE id = $1`,
        [jobId, message.slice(0, 1000)]
      )
      await executor.query(
        `UPDATE public.media_highlights SET status = 'failed' WHERE id = $1`,
        [highlight.id]
      )
      clips.push({
        jobId,
        highlightId: highlight.id,
        status: 'failed',
        outputPath: '',
        coverPath: '',
        error: message,
      })
    }
  }

  return { rendered, failed, clips }
}

export interface ExportDraftInput {
  tenantId: number
  assetId: string
  clipIds?: string[]
  userId?: number | null
  db?: DbExecutor
}

/** 导出剪映草稿：仅使用已渲染成功的切片 */
export async function exportDraft(input: ExportDraftInput) {
  const executor = input.db || getPool()
  const params: unknown[] = [input.tenantId, input.assetId]
  let clause = ` AND status = 'succeeded'`
  if (Array.isArray(input.clipIds) && input.clipIds.length > 0) {
    params.push(input.clipIds)
    clause += ` AND id = ANY($${params.length}::uuid[])`
  }

  const { rows: jobs } = await executor.query<any>(
    `SELECT id, highlight_id, output_path, subtitle_path, duration_ms
       FROM public.media_render_jobs
      WHERE tenant_id = $1 AND asset_id = $2 ${clause}
      ORDER BY created_at ASC`,
    params
  )
  if (jobs.length === 0) throw new Error('没有已渲染成功的切片，请先渲染')

  const { rows: assetRows } = await executor.query<{ title: string }>(
    `SELECT title FROM public.media_assets WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [input.tenantId, input.assetId]
  )
  const title = assetRows[0]?.title || '未命名场次'

  const draftsDir = mediaDir('drafts', input.tenantId)
  const draft = await exportJianyingDraft({
    outputDir: draftsDir,
    title,
    clips: jobs.map((job) => ({
      videoPath: job.output_path,
      durationMs: Number(job.duration_ms) || 0,
    })),
  })

  const { rows } = await executor.query<{ id: string }>(
    `INSERT INTO public.media_draft_exports
       (tenant_id, asset_id, clip_ids, draft_path, draft_json_path, clip_count, status, created_by)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'ready', $7)
     RETURNING id`,
    [
      input.tenantId,
      input.assetId,
      JSON.stringify(jobs.map((job) => job.id)),
      draft.draftPath,
      draft.draftJsonPath,
      jobs.length,
      input.userId ?? null,
    ]
  )

  return {
    exportId: rows[0].id,
    draftPath: draft.draftPath,
    draftJsonPath: draft.draftJsonPath,
    clipCount: jobs.length,
    totalDurationMs: draft.totalDurationMs,
  }
}

/** 把转写写入知识库回放集合 */
export async function ingestTranscriptToKnowledge(input: {
  tenantId: number
  assetId: string
  userId?: number | null
  db?: DbExecutor
}) {
  const executor = input.db || getPool()
  const transcript = await loadTranscript(input.tenantId, input.assetId, executor)
  if (!transcript) throw new Error('尚无可用转写，请先完成转写')

  const { rows } = await executor.query<{ title: string; business_key: string }>(
    `SELECT title, business_key FROM public.media_assets WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [input.tenantId, input.assetId]
  )
  const asset = rows[0]

  const result = await ingestDocument({
    tenantId: input.tenantId,
    collectionCode: 'replays',
    title: asset?.title || '直播回放',
    segments: transcript.segments,
    sourceType: 'asr',
    sourceRef: input.assetId,
    businessKey: asset?.business_key || '',
    tags: { source: 'media_pipeline', assetId: input.assetId, provider: transcript.provider },
    userId: input.userId ?? null,
    db: executor,
  })

  return result
}

/** 列表视图 */
export async function listMediaAssets(
  tenantId: number,
  options: { status?: string; limit?: number } = {},
  db?: DbExecutor
): Promise<MediaAssetView[]> {
  const executor = db || getPool()
  const limit = Math.min(100, Math.max(1, options.limit || 30))
  const params: unknown[] = [tenantId]
  let where = 'a.tenant_id = $1'
  if (options.status) {
    params.push(options.status)
    where += ` AND a.status = $${params.length}`
  }
  params.push(limit)

  const { rows } = await executor.query<any>(
    `SELECT a.id, a.title, a.source_type, a.mime_type, a.size_bytes, a.duration_ms,
            a.width, a.height, a.has_audio, a.status, a.business_key, a.created_at,
            t.provider AS transcript_provider, coalesce(t.segment_count, 0) AS segment_count,
            (SELECT count(*) FROM public.media_highlights h WHERE h.asset_id = a.id) AS highlight_count,
            (SELECT count(*) FROM public.media_render_jobs j
              WHERE j.asset_id = a.id AND j.status = 'succeeded') AS clip_count
       FROM public.media_assets a
       LEFT JOIN public.media_transcripts t ON t.asset_id = a.id AND t.status = 'ready'
      WHERE ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length}`,
    params
  )

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes) || 0,
    durationMs: Number(row.duration_ms) || 0,
    width: row.width,
    height: row.height,
    hasAudio: Boolean(row.has_audio),
    status: row.status,
    businessKey: row.business_key,
    transcriptProvider: row.transcript_provider || null,
    segmentCount: Number(row.segment_count) || 0,
    highlightCount: Number(row.highlight_count) || 0,
    clipCount: Number(row.clip_count) || 0,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

/** 受控文件读取：只允许访问媒体根目录内的文件 */
export function resolveMediaFile(kind: string, tenantId: number, fileName: string): string | null {
  const allowedKinds = new Set(['source', 'clips', 'covers', 'subtitles', 'drafts'])
  if (!allowedKinds.has(kind)) return null
  const base = resolve(mediaDir(kind as any, tenantId))
  const target = resolve(base, basename(String(fileName || '')))
  if (!target.startsWith(base)) return null
  return existsSync(target) ? target : null
}

/** 解析人工上传的转写（供路由复用与测试） */
export { parseManualTranscript }