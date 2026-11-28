/**
 * video/render-worker.ts — 模板渲染 Worker
 *
 * 职责闭环（F.1.5）：
 *   1. 从 render_jobs 领取 queued 任务（FOR UPDATE SKIP LOCKED，支持多实例）；
 *   2. 模板 DSL + 槽位 → 镜头 → 素材解析 → FFmpeg 渲染；
 *   3. ffprobe 实测时长/分辨率/响度/黑帧/静音，跑质检门禁；
 *   4. 通过才写 render_outputs；不通过不产出成片并回写失败原因。
 *
 * 由独立 worker 进程（src/worker.ts）轮询驱动，不占用 HTTP 进程。
 */

import { existsSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { env } from '../config/env.js'
import { scanBannedWords } from '../knowledge/service.js'
import {
  detectBlackFrames,
  detectSilence,
  ensureDir,
  mediaDir,
  mediaRoot,
  probeLoudness,
  probeMedia,
  renderCover,
  runFfmpeg,
} from '../media/ffmpeg.js'
import {
  buildShotPlan,
  parseTemplateDsl,
  runQualityGate,
  selectTemplateVersion,
  type TemplateDsl,
} from './assembly.js'
import {
  aspectSize,
  buildRenderGraph,
  buildRenderShots,
  buildSrt,
  buildSubtitleSegments,
  collectSlotAssets,
  type ShotRow,
} from './renderer.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RenderJobRow {
  id: string
  tenant_id: number
  project_id: string
  status: string
  project_title: string
  slot_values: Record<string, unknown>
  template_id: string
  template_version_id: string | null
  aspect: string
  gray_ratio: number
  brand_kit_id: string | null
  template_code: string
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

/** 素材路径解析：支持绝对路径、媒体根目录相对路径、media_assets UUID；远程 URL 暂不下载 */
async function resolveAssetPath(tenantId: number, raw: unknown): Promise<string> {
  const value = String(raw ?? '').trim()
  if (!value || /^https?:\/\//i.test(value)) return ''

  if (UUID_RE.test(value)) {
    const { rows } = await getPool().query<{ storage_path: string }>(
      `SELECT storage_path FROM public.media_assets WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, value]
    )
    const stored = rows[0]?.storage_path
    return stored && existsSync(stored) ? stored : ''
  }

  const candidates = [value]
  if (!isAbsolute(value)) candidates.push(resolve(mediaRoot(), value), resolve(process.cwd(), value))
  for (const candidate of candidates) {
    const abs = resolve(candidate)
    if (existsSync(abs)) return abs
  }
  return ''
}

async function resolveAssets(tenantId: number, raw: string[]): Promise<string[]> {
  const resolved = await Promise.all(raw.map((item) => resolveAssetPath(tenantId, item)))
  return [...new Set(resolved.filter(Boolean))]
}

async function loadBgmPath(tenantId: number, dsl: TemplateDsl, values: Record<string, unknown>): Promise<string> {
  const code = typeof values.bgm === 'string' && values.bgm.trim()
    ? values.bgm.trim()
    : (dsl.audio?.bgm || '').trim()
  if (!code) return ''
  const { rows } = await getPool().query<{ file_path: string }>(
    `SELECT file_path FROM public.bgm_library
      WHERE tenant_id = $1 AND code = $2 AND is_active = TRUE LIMIT 1`,
    [tenantId, code]
  )
  return resolveAssetPath(tenantId, rows[0]?.file_path || '')
}

async function loadLogoPath(tenantId: number, template: RenderJobRow, dsl: TemplateDsl): Promise<string> {
  const rule = dsl.rules.brand_logo
  if (!rule || rule === 'off' || rule === 'none') return ''
  const { rows } = template.brand_kit_id
    ? await getPool().query<{ logo_path: string }>(
        `SELECT logo_path FROM public.brand_kits WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, template.brand_kit_id]
      )
    : await getPool().query<{ logo_path: string }>(
        `SELECT logo_path FROM public.brand_kits
          WHERE tenant_id = $1 AND (code = $2 OR is_default = TRUE)
          ORDER BY (code = $2) DESC, is_default DESC LIMIT 1`,
        [tenantId, dsl.brand_kit || 'default']
      )
  return resolveAssetPath(tenantId, rows[0]?.logo_path || '')
}

function loadShots(tenantId: number, projectId: string, dsl: TemplateDsl, values: Record<string, unknown>): Promise<ShotRow[]> {
  return getPool()
    .query<ShotRow>(
      `SELECT seq, shot_type, title, script_text, subtitle_text, duration_ms, asset_path
         FROM public.shot_items
        WHERE tenant_id = $1 AND project_id = $2
        ORDER BY seq ASC`,
      [tenantId, projectId]
    )
    .then(({ rows }) => {
      if (rows.length > 0) return rows
      return buildShotPlan(dsl, values).map((shot) => ({
        seq: shot.seq,
        shot_type: shot.shotType,
        title: shot.title,
        script_text: shot.scriptText,
        subtitle_text: shot.subtitleText,
        duration_ms: shot.durationMs,
        asset_path: '',
      }))
    })
}

async function updateJob(jobId: string, stage: string, progress: number): Promise<void> {
  await getPool().query(
    `UPDATE public.render_jobs
        SET status = 'running', stage = $2, progress = $3, started_at = COALESCE(started_at, now())
      WHERE id = $1`,
    [jobId, stage, progress]
  )
}

async function failJob(jobId: string, projectId: string, message: string, gate?: unknown): Promise<void> {
  await getPool().query(
    `UPDATE public.render_jobs
        SET status = 'failed', stage = 'failed', progress = 100, gate_passed = FALSE,
            gate_result = COALESCE($2::jsonb, gate_result), error = $3, finished_at = now()
      WHERE id = $1`,
    [jobId, gate ? JSON.stringify(gate) : null, message.slice(0, 1000)]
  )
  await getPool().query(
    `UPDATE public.video_projects SET status = 'failed', updated_at = now() WHERE id = $1`,
    [projectId]
  )
}

/** 领取一个 queued 任务并置为 running */
export async function claimRenderJob(): Promise<string | null> {
  const { rows } = await getPool().query<{ id: string }>(
    `UPDATE public.render_jobs
        SET status = 'running', stage = 'precheck', progress = 5, started_at = now(), error = ''
      WHERE id = (
        SELECT id FROM public.render_jobs
         WHERE status = 'queued'
         ORDER BY priority ASC, queued_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id`
  )
  return rows[0]?.id || null
}

export interface RenderJobResult {
  status: 'succeeded' | 'failed'
  outputPath?: string
  error?: string
  gate?: unknown
}

/** 执行单个渲染任务（幂等：可重复调用，已成功的任务直接返回） */
export async function runRenderJob(jobId: string): Promise<RenderJobResult> {
  const pool = getPool()

  const { rows } = await pool.query<RenderJobRow>(
    `SELECT j.id, j.tenant_id, j.project_id, j.status,
            p.title AS project_title, p.slot_values, p.template_id, p.template_version_id, p.aspect,
            t.gray_ratio, t.brand_kit_id, t.code AS template_code
       FROM public.render_jobs j
       JOIN public.video_projects p ON p.id = j.project_id
       JOIN public.video_templates t ON t.id = p.template_id
      WHERE j.id = $1 LIMIT 1`,
    [jobId]
  )
  const job = rows[0]
  if (!job) return { status: 'failed', error: '渲染任务不存在' }
  if (job.status === 'succeeded') return { status: 'succeeded' }
  if (job.status === 'cancelled') return { status: 'failed', error: '任务已取消' }

  const tenantId = Number(job.tenant_id) || 1
  await updateJob(jobId, 'assemble', 15)

  let outputPath = ''
  let subtitlePath = ''
  let coverPath = ''

  try {
    // 1. 模板版本（项目锁定版本优先，否则按灰度重新选择）
    const { rows: versionRows } = job.template_version_id
      ? await pool.query<any>(`SELECT * FROM public.template_versions WHERE tenant_id = $1 AND id = $2 LIMIT 1`, [
          tenantId,
          job.template_version_id,
        ])
      : await pool.query<any>(
          `SELECT * FROM public.template_versions
            WHERE tenant_id = $1 AND template_id = $2 AND status = 'published'
            ORDER BY version DESC`,
          [tenantId, job.template_id]
        )
    const version = job.template_version_id
      ? versionRows[0]
      : selectTemplateVersion(versionRows as any, Number(job.gray_ratio))
    if (!version) throw new Error('模板没有可用版本')

    const dsl = parseTemplateDsl((version as any).dsl)
    const values = (job.slot_values && typeof job.slot_values === 'object' ? job.slot_values : {}) as Record<string, unknown>

    // 2. 镜头与素材
    const shotRows = await loadShots(tenantId, job.project_id, dsl, values)
    const rawAssets = collectSlotAssets(dsl, values)
    const [images, videos] = await Promise.all([
      resolveAssets(tenantId, rawAssets.images),
      resolveAssets(tenantId, rawAssets.videos),
    ])
    const shots = buildRenderShots({ shots: shotRows, images, videos })
    if (shots.length === 0) throw new Error('没有可渲染的镜头')

    const { width, height } = aspectSize(dsl.aspect)
    const segments = buildSubtitleSegments(shots)
    const srt = buildSrt(segments)
    const subtitleDir = mediaDir('subtitles', tenantId)
    subtitlePath = resolve(subtitleDir, `${jobId}.srt`)
    await writeFile(subtitlePath, srt, 'utf8')

    const bgmPath = await loadBgmPath(tenantId, dsl, values)
    const logoPath = await loadLogoPath(tenantId, job, dsl)
    const fontPath = env.MEDIA_FONT_PATH && existsSync(env.MEDIA_FONT_PATH) ? env.MEDIA_FONT_PATH : ''

    const aiRule = dsl.rules.ai_label || 'off'
    const generated = aiRule === 'if_generated' && dsl.type !== 'selection'
    const needsAiLabel = aiRule === 'always' || generated
    const aiLabelText = needsAiLabel && fontPath ? 'AI 生成内容' : undefined

    outputPath = resolve(mediaDir('clips', tenantId), `${jobId}.mp4`)
    ensureDir(mediaDir('clips', tenantId))

    const graph = buildRenderGraph({
      shots,
      width,
      height,
      outputPath,
      subtitlePath,
      subtitleSegments: segments,
      bgmPath: bgmPath || undefined,
      logoPath: logoPath || undefined,
      aiLabelText,
      fontPath: fontPath || undefined,
      loudness: dsl.audio?.loudness ?? -14,
    })

    // 3. 渲染
    await runFfmpeg(graph.args, { timeoutMs: 600_000 })
    await updateJob(jobId, 'subtitle', 70)

    // 4. 实测质检
    const probe = await probeMedia(outputPath)
    if (!probe.hasVideo || !probe.width || !probe.height) throw new Error('渲染产物无有效视频流')

    await updateJob(jobId, 'qc', 85)
    const loudness = graph.hasAudio ? await probeLoudness(outputPath) : null
    const blackSegments = await detectBlackFrames(outputPath)
    const silenceSegments = graph.hasAudio ? await detectSilence(outputPath) : []

    const banned = await scanBannedWords({ tenantId, text: collectSlotText(values) })
    const gate = runQualityGate({
      dsl,
      durationMs: probe.durationMs,
      width: probe.width,
      height: probe.height,
      loudness,
      subtitleSegments: segments,
      hasBlackFrame: blackSegments.some((seg) => seg.endMs - seg.startMs >= 500),
      hasSilence: silenceSegments.some((seg) => seg.endMs - seg.startMs >= 1000),
      logoPresent: graph.hasLogo,
      aiLabelPresent: graph.hasAiLabel,
      generated,
      audioExpected: graph.hasAudio,
      logoExpected: graph.hasLogo,
      bannedHits: banned.matched as any,
    })

    if (!gate.passed) {
      rmSync(outputPath, { force: true })
      rmSync(subtitlePath, { force: true })
      const message = `质检未通过：${gate.blockers.join('、')}`
      await failJob(jobId, job.project_id, message, gate)
      logger.warn({ jobId, blockers: gate.blockers }, '[RenderWorker] Quality gate blocked output')
      return { status: 'failed', error: message, gate }
    }

    // 5. 封面 + 落库（通过才写 render_outputs）
    coverPath = resolve(mediaDir('covers', tenantId), `${jobId}.jpg`)
    try {
      await renderCover({
        sourcePath: outputPath,
        outputPath: coverPath,
        atMs: Math.min(1500, Math.max(0, Math.floor(probe.durationMs / 3))),
      })
    } catch {
      coverPath = ''
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO public.render_outputs
           (tenant_id, job_id, output_path, cover_path, subtitle_path, duration_ms, width, height,
            size_bytes, loudness, qc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
        [
          tenantId,
          jobId,
          outputPath,
          coverPath,
          subtitlePath,
          probe.durationMs,
          probe.width,
          probe.height,
          probe.sizeBytes,
          loudness,
          JSON.stringify(gate),
        ]
      )
      await client.query(
        `UPDATE public.render_jobs
            SET status = 'succeeded', stage = 'done', progress = 100, gate_passed = TRUE,
                gate_result = $2::jsonb, error = '', finished_at = now()
          WHERE id = $1`,
        [jobId, JSON.stringify(gate)]
      )
      await client.query(
        `UPDATE public.video_projects SET status = 'rendered', updated_at = now() WHERE id = $1`,
        [job.project_id]
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }

    logger.info({ jobId, durationMs: probe.durationMs, width: probe.width, height: probe.height }, '[RenderWorker] Job succeeded')
    return { status: 'succeeded', outputPath, gate }
  } catch (err) {
    const message = (err as Error)?.message || String(err)
    rmSync(outputPath, { force: true })
    rmSync(subtitlePath, { force: true })
    if (coverPath) rmSync(coverPath, { force: true })
    await failJob(jobId, job.project_id, message)
    logger.error({ err, jobId }, '[RenderWorker] Job failed')
    return { status: 'failed', error: message }
  }
}

/** 轮询执行 queued 任务（由独立 worker 每 5s 调用一次） */
export async function pollRenderJobs(limit = 1): Promise<number> {
  let processed = 0
  for (let i = 0; i < limit; i += 1) {
    const jobId = await claimRenderJob()
    if (!jobId) break
    await runRenderJob(jobId)
    processed += 1
  }
  return processed
}
