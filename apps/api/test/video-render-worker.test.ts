/**
 * video-render-worker.test.ts — 渲染 Worker 真实 FFmpeg 端到端
 *
 * 覆盖：queued 任务 → 渲染 → ffprobe 实测 → 质检门禁 → render_outputs / 项目状态。
 * 使用自建临时模板（4 镜头 / 4.5s / 9:16），避免依赖种子素材。
 */

import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPool } from '../src/lib/db.js'
import { cleanChildEnv, FFMPEG_PATHS, mediaDir, probeMedia } from '../src/media/ffmpeg.js'
import { buildShotPlan, parseTemplateDsl } from '../src/video/assembly.js'
import { runRenderJob } from '../src/video/render-worker.js'

const execFileAsync = promisify(execFile)

describe('渲染 Worker 端到端', () => {
  const pool = getPool()
  const tenantId = 1
  const stamp = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
  const templateCode = `__render_test_${stamp}`

  let templateId = ''
  let projectId = ''
  let jobId = ''
  let imageA = ''
  let imageB = ''

  before(async () => {
    const sourceDir = resolve(mediaDir('source', tenantId))
    mkdirSync(sourceDir, { recursive: true })
    imageA = resolve(sourceDir, `${templateCode}_a.png`)
    imageB = resolve(sourceDir, `${templateCode}_b.png`)
    for (const [index, file] of [imageA, imageB].entries()) {
      await execFileAsync(
        FFMPEG_PATHS.ffmpeg,
        [
          '-nostdin', '-hide_banner', '-y',
          '-f', 'lavfi', '-i', `color=c=0x${index === 0 ? '334155' : '475569'}:s=720x1280`,
          '-frames:v', '1', file,
        ],
        { env: cleanChildEnv(), timeout: 60_000 }
      )
    }

    const dsl = {
      template: `${templateCode}_v1`,
      type: 'assembly',
      aspect: '9:16',
      duration: { min: 3, max: 6 },
      slots: [
        { key: 'hook', type: 'text', required: true, maxLength: 18 },
        { key: 'product_images', type: 'image_list', required: true, countMin: 1, countMax: 3 },
        { key: 'selling_points', type: 'text_list', required: true, countMin: 1, countMax: 3 },
        { key: 'cta', type: 'text', required: true, maxLength: 12 },
      ],
      audio: { loudness: -14, bgm: '' },
      subtitles: { style: 'bold', safe_area: true },
      rules: { brand_logo: 'off', ai_label: 'off', banned_words_check: 'hard' },
    }
    const slotValues = {
      hook: '新品上市先看这里',
      product_images: [imageA, imageB],
      selling_points: ['轻薄机身', '全天续航'],
      cta: '点击下方链接',
    }

    const templateRes = await pool.query<{ id: string }>(
      `INSERT INTO public.video_templates
         (tenant_id, code, name, category, type, aspect, min_duration_sec, max_duration_sec, status, gray_ratio)
       VALUES ($1, $2, $3, 'product_seed', 'assembly', '9:16', 3, 6, 'active', 100)
       RETURNING id`,
      [tenantId, templateCode, `渲染测试模板 ${stamp}`]
    )
    templateId = templateRes.rows[0].id

    const versionRes = await pool.query<{ id: string }>(
      `INSERT INTO public.template_versions (tenant_id, template_id, version, dsl, status)
       VALUES ($1, $2, 1, $3::jsonb, 'published') RETURNING id`,
      [tenantId, templateId, JSON.stringify(dsl)]
    )
    const versionId = versionRes.rows[0].id

    const projectRes = await pool.query<{ id: string }>(
      `INSERT INTO public.video_projects
         (tenant_id, template_id, template_version_id, title, mode, aspect, status, slot_values, automation_level)
       VALUES ($1, $2, $3, $4, 'template_fill', '9:16', 'ready', $5::jsonb, 'L2')
       RETURNING id`,
      [tenantId, templateId, versionId, `渲染测试项目 ${stamp}`, JSON.stringify(slotValues)]
    )
    projectId = projectRes.rows[0].id

    const plan = buildShotPlan(parseTemplateDsl(dsl), slotValues as any)
    for (const shot of plan) {
      await pool.query(
        `INSERT INTO public.shot_items
           (tenant_id, project_id, seq, shot_type, title, script_text, subtitle_text, asset_path, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '', $8)`,
        [tenantId, projectId, shot.seq, shot.shotType, shot.title, shot.scriptText, shot.subtitleText, shot.durationMs]
      )
    }

    const jobRes = await pool.query<{ id: string }>(
      `INSERT INTO public.render_jobs (tenant_id, project_id, status, stage, progress, priority)
       VALUES ($1, $2, 'queued', 'queued', 0, 5) RETURNING id`,
      [tenantId, projectId]
    )
    jobId = jobRes.rows[0].id
  })

  after(async () => {
    if (projectId) await pool.query('DELETE FROM public.video_projects WHERE id = $1', [projectId]).catch(() => undefined)
    if (templateId) await pool.query('DELETE FROM public.video_templates WHERE id = $1', [templateId]).catch(() => undefined)
    for (const file of [imageA, imageB]) {
      if (file) rmSync(file, { force: true })
    }
    if (jobId) {
      for (const kind of ['clips', 'covers', 'subtitles'] as const) {
        for (const ext of ['mp4', 'jpg', 'srt']) {
          rmSync(resolve(mediaDir(kind, tenantId), `${jobId}.${ext}`), { force: true })
        }
      }
    }
  })

  test('queued 任务渲染成功并通过实测质检', async () => {
    const result = await runRenderJob(jobId)
    assert.equal(result.status, 'succeeded', result.error)
    assert.ok(result.outputPath && existsSync(result.outputPath), '成片文件应存在')

    const probe = await probeMedia(result.outputPath!)
    assert.equal(probe.hasVideo, true)
    assert.equal(probe.width, 1080)
    assert.equal(probe.height, 1920)
    assert.ok(probe.durationMs >= 3000 && probe.durationMs <= 6500, `时长异常: ${probe.durationMs}`)

    const jobRes = await pool.query<any>(
      `SELECT status, stage, progress, gate_passed, gate_result, error FROM public.render_jobs WHERE id = $1`,
      [jobId]
    )
    const job = jobRes.rows[0]
    assert.equal(job.status, 'succeeded')
    assert.equal(job.stage, 'done')
    assert.equal(job.progress, 100)
    assert.equal(job.gate_passed, true)
    assert.equal(job.gate_result.passed, true)
    assert.equal(job.error, '')

    const checks: Array<{ key: string; passed: boolean; detail: string }> = job.gate_result.checks
    const loudness = checks.find((check) => check.key === 'loudness')
    assert.equal(loudness?.passed, true)
    assert.match(loudness?.detail || '', /未配置音频/)
    assert.ok(checks.find((check) => check.key === 'subtitle')?.passed)

    const outputRes = await pool.query<any>(
      `SELECT output_path, subtitle_path, duration_ms, width, height, qc FROM public.render_outputs WHERE job_id = $1`,
      [jobId]
    )
    assert.equal(outputRes.rows.length, 1)
    assert.equal(outputRes.rows[0].width, 1080)
    assert.equal(outputRes.rows[0].height, 1920)
    assert.equal(outputRes.rows[0].qc.passed, true)
    assert.ok(existsSync(outputRes.rows[0].subtitle_path), '字幕文件应保留')

    const projectRes = await pool.query<{ status: string }>(
      `SELECT status FROM public.video_projects WHERE id = $1`,
      [projectId]
    )
    assert.equal(projectRes.rows[0].status, 'rendered')
  })
})
