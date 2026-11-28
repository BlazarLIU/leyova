/**
 * media/jianying.ts — 剪映草稿导出
 *
 * 生成剪映专业版可识别的草稿目录：
 *   drafts/<草稿名>/draft_meta_info.json   —— 草稿元信息
 *   drafts/<草稿名>/draft_content.json    —— 时间轴与素材引用
 *   drafts/<草稿名>/materials/            —— 素材（此处仅写清单，视频用绝对路径引用）
 *
 * 注意：剪映内部格式存在版本差异，此实现按通用字段输出，
 * 导入失败时应降级为「导出素材包 + 时间轴 CSV」的人工兜底路径。
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

export interface JianyingClip {
  videoPath: string
  durationMs: number
}

export interface JianyingDraftInput {
  outputDir: string
  title: string
  clips: JianyingClip[]
}

export interface JianyingDraftResult {
  draftPath: string
  draftJsonPath: string
  totalDurationMs: number
}

/** 生成稳定 ID（剪映用字符串 uuid） */
function draftId(): string {
  const hex = '0123456789ABCDEF'
  let out = ''
  for (let i = 0; i < 32; i += 1) out += hex[Math.floor(Math.random() * 16)]
  return out
}

/** 微秒：剪映时间轴以 1/1_000_000 秒为单位 */
function toMicros(ms: number): number {
  return Math.max(0, Math.round(ms * 1000))
}

/** 草稿目录名：去掉文件系统不安全字符 */
export function safeDraftName(title: string): string {
  const clean = String(title || 'draft')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60)
  return clean || 'draft'
}

/**
 * 构建 draft_content.json。
 * 结构按剪映草稿的通用骨架：canvas_config / tracks / materials。
 * 视频片段按顺序首尾相接排在同一条主轨道上。
 */
export function buildDraftContent(input: JianyingDraftInput): Record<string, unknown> {
  const now = Date.now()
  let cursorMicros = 0

  const videos: Array<Record<string, unknown>> = []
  const videoSegments: Array<Record<string, unknown>> = []
  const audios: Array<Record<string, unknown>> = []
  const audioSegments: Array<Record<string, unknown>> = []

  input.clips.forEach((clip, index) => {
    const materialId = draftId()
    const segmentId = draftId()
    const durationMicros = toMicros(clip.durationMs)
    const clipDurationMicros = durationMicros > 0 ? durationMicros : toMicros(5000)

    videos.push({
      id: materialId,
      type: 'video',
      path: resolve(clip.videoPath),
      name: basename(clip.videoPath),
      duration: clipDurationMicros,
      width: 1080,
      height: 1920,
      material_name: basename(clip.videoPath),
      category_name: 'local',
      extra_info: { is_ai_generate: false },
    })

    videoSegments.push({
      id: segmentId,
      material_id: materialId,
      target_timerange: { start: cursorMicros, duration: clipDurationMicros },
      source_timerange: { start: 0, duration: clipDurationMicros },
      speed: 1.0,
      volume: 1.0,
      extra_material_refs: [],
      clip: {
        scale: { x: 1.0, y: 1.0 },
        rotation: 0,
        flip: { horizontal: false, vertical: false },
        alpha: 1.0,
      },
      render_index: index,
    })

    // 同步音频轨（剪映会把视频自带音轨单独挂载，此处建占位以保持结构完整）
    const audioMaterialId = draftId()
    const audioSegmentId = draftId()
    audios.push({
      id: audioMaterialId,
      type: 'video',
      path: resolve(clip.videoPath),
      name: basename(clip.videoPath),
      duration: clipDurationMicros,
    })
    audioSegments.push({
      id: audioSegmentId,
      material_id: audioMaterialId,
      target_timerange: { start: cursorMicros, duration: clipDurationMicros },
      source_timerange: { start: 0, duration: clipDurationMicros },
      speed: 1.0,
      volume: 1.0,
      extra_material_refs: [],
      render_index: index,
    })

    cursorMicros += clipDurationMicros
  })

  const totalDuration = Math.max(1, cursorMicros)

  return {
    id: draftId(),
    version: 360000,
    name: input.title,
    duration: totalDuration,
    fps: 30,
    canvas_config: { width: 1080, height: 1920, ratio: '9:16' },
    create_time: now,
    update_time: now,
    materials: {
      videos,
      audios,
      texts: [],
      stickers: [],
      images: [],
      effects: [],
      videos_extra: [],
    },
    tracks: [
      {
        id: draftId(),
        type: 'video',
        segments: videoSegments,
        attribute: 0,
        flag: 0,
      },
      {
        id: draftId(),
        type: 'audio',
        segments: audioSegments,
        attribute: 0,
        flag: 0,
      },
      {
        id: draftId(),
        type: 'text',
        segments: [],
        attribute: 0,
        flag: 0,
      },
    ],
    extra_info: {
      created_by: 'leyova_media_pipeline',
      clip_count: input.clips.length,
    },
  }
}

/** 写出草稿目录 */
export async function exportJianyingDraft(input: JianyingDraftInput): Promise<JianyingDraftResult> {
  if (input.clips.length === 0) throw new Error('没有可导出的切片')

  const draftName = `${safeDraftName(input.title)}_${Date.now()}`
  const draftPath = resolve(input.outputDir, draftName)
  const materialsDir = resolve(draftPath, 'materials')
  await mkdir(materialsDir, { recursive: true })

  const content = buildDraftContent(input)
  const draftJsonPath = resolve(draftPath, 'draft_content.json')
  await writeFile(draftJsonPath, JSON.stringify(content, null, 2), 'utf8')

  const totalDurationMs = input.clips.reduce((sum, clip) => sum + Math.max(0, clip.durationMs), 0)
  const meta = {
    draft_name: draftName,
    draft_root_path: draftPath,
    draft_id: content.id,
    draft_fold_path: draftPath,
    draft_removable_storage_space: 0,
    draft_cloud_purchase_info: '',
    draft_cloud_tutorial_info: '',
    draft_tips_info: '',
    draft_cover: '',
    tm_draft_create: content.create_time,
    tm_draft_modified: content.update_time,
    tm_duration: toMicros(totalDurationMs),
    draft_platform: { app_id: 3704, app_source: 'lv', app_version: '5.9.0', os: 'linux' },
    draft_materials: [
      {
        type: 0,
        value: input.clips.map((clip) => ({
          path: resolve(clip.videoPath),
          name: basename(clip.videoPath),
          duration: toMicros(clip.durationMs),
        })),
      },
    ],
  }
  await writeFile(resolve(draftPath, 'draft_meta_info.json'), JSON.stringify(meta, null, 2), 'utf8')

  // 素材清单：剪映导入后若需重连素材，可按此文件人工替换
  const manifest = input.clips.map((clip, index) => ({
    index: index + 1,
    file: resolve(clip.videoPath),
    name: basename(clip.videoPath),
    durationMs: clip.durationMs,
  }))
  await writeFile(resolve(materialsDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  return { draftPath, draftJsonPath, totalDurationMs }
}