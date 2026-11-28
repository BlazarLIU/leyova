/**
 * video/renderer.ts — 渲染计划器（纯函数）
 *
 * 把「镜头计划 + 槽位素材」翻译成可执行的 FFmpeg 参数：
 *   镜头 → 输入源（图片/视频/纯色卡）→ 统一画幅 → concat → 字幕 → AI 标识 → Logo → 音轨
 *
 * 不依赖数据库与子进程，便于单测；实际执行在 render-worker.ts。
 */

import type { TemplateDsl } from './assembly.js'

export interface ShotRow {
  seq: number
  shot_type: string
  title: string
  script_text: string
  subtitle_text: string
  duration_ms: number
  asset_path?: string | null
}

export interface RenderShot {
  seq: number
  shotType: string
  text: string
  subtitleText: string
  durationMs: number
  assetPath: string
  assetKind: 'image' | 'video' | null
}

export interface SubtitleSegment {
  startMs: number
  endMs: number
  text: string
}

export interface AssetCollection {
  images: string[]
  videos: string[]
}

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi|flv)$/i

function guessAssetKind(path: string): 'image' | 'video' | null {
  if (!path) return null
  return VIDEO_EXT.test(path) ? 'video' : 'image'
}

/** 从槽位值收集图片/视频素材（按 DSL 槽位顺序），供 worker 解析真实路径 */
export function collectSlotAssets(dsl: TemplateDsl, values: Record<string, unknown> | null | undefined): AssetCollection {
  const input = values && typeof values === 'object' ? values : {}
  const images: string[] = []
  const videos: string[] = []

  const push = (value: unknown, forced?: 'image' | 'video') => {
    const list = Array.isArray(value) ? value : [value]
    for (const item of list) {
      if (typeof item !== 'string' || !item.trim()) continue
      const kind = forced || guessAssetKind(item)
      if (kind === 'video') videos.push(item.trim())
      else if (kind === 'image') images.push(item.trim())
    }
  }

  for (const slot of dsl.slots) {
    const value = input[slot.key]
    if (slot.type === 'image' || slot.type === 'image_list') push(value, 'image')
    else if (slot.type === 'video' || slot.type === 'video_list') push(value, 'video')
    else if (slot.type === 'media') push(value)
  }

  return { images, videos }
}

/** 为每个镜头分配素材：图片优先，其次视频；都缺时渲染纯色卡 */
export function buildRenderShots(input: {
  shots: ShotRow[]
  images: string[]
  videos: string[]
}): RenderShot[] {
  return input.shots.map((shot, index) => {
    const explicit = String(shot.asset_path || '').trim()
    if (explicit) {
      return {
        seq: shot.seq,
        shotType: shot.shot_type,
        text: shot.script_text || shot.title || '',
        subtitleText: shot.subtitle_text || shot.script_text || '',
        durationMs: Math.max(500, Number(shot.duration_ms) || 0),
        assetPath: explicit,
        assetKind: guessAssetKind(explicit),
      }
    }
    let assetPath = ''
    let assetKind: 'image' | 'video' | null = null
    if (input.images.length > 0) {
      assetPath = input.images[index % input.images.length]
      assetKind = 'image'
    } else if (input.videos.length > 0) {
      assetPath = input.videos[index % input.videos.length]
      assetKind = 'video'
    }
    return {
      seq: shot.seq,
      shotType: shot.shot_type,
      text: shot.script_text || shot.title || '',
      subtitleText: shot.subtitle_text || shot.script_text || '',
      durationMs: Math.max(500, Number(shot.duration_ms) || 0),
      assetPath,
      assetKind,
    }
  })
}

function chunkText(text: string, maxChars: number): string[] {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  if (chars.length === 0) return []
  const chunks: string[] = []
  for (let i = 0; i < chars.length; i += maxChars) {
    const chunk = chars.slice(i, i + maxChars).join('').trim()
    if (chunk) chunks.push(chunk)
  }
  return chunks
}

/** 字幕分段：按安全区字数切块，时间按字数比例分摊到镜头时长内 */
export function buildSubtitleSegments(shots: RenderShot[], maxChars = 20): SubtitleSegment[] {
  const segments: SubtitleSegment[] = []
  let cursor = 0
  for (const shot of shots) {
    const text = (shot.subtitleText || shot.text || '').trim()
    const chunks = chunkText(text, maxChars)
    if (chunks.length === 0) {
      cursor += shot.durationMs
      continue
    }
    const totalChars = chunks.reduce((sum, chunk) => sum + Array.from(chunk).length, 0)
    let chunkStart = cursor
    chunks.forEach((chunk, index) => {
      const chars = Array.from(chunk).length
      const isLast = index === chunks.length - 1
      const span = isLast
        ? cursor + shot.durationMs - chunkStart
        : Math.max(1, Math.round((shot.durationMs * chars) / Math.max(1, totalChars)))
      const endMs = isLast ? Math.max(chunkStart + 1, cursor + shot.durationMs) : chunkStart + span
      segments.push({ startMs: Math.round(chunkStart), endMs: Math.round(endMs), text: chunk })
      chunkStart = endMs
    })
    cursor += shot.durationMs
  }
  return segments
}

function srtTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const h = Math.floor(safe / 3_600_000)
  const m = Math.floor((safe % 3_600_000) / 60_000)
  const s = Math.floor((safe % 60_000) / 1000)
  const millis = safe % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

export function buildSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, index) => `${index + 1}\n${srtTime(seg.startMs)} --> ${srtTime(seg.endMs)}\n${seg.text}\n`)
    .join('\n')
}

/** 按画幅计算成片尺寸：短边 1080，宽高取偶数 */
export function aspectSize(aspect: string, shortSide = 1080): { width: number; height: number } {
  const [w, h] = aspect.split(':').map((item) => Number(item))
  const ratioW = w > 0 ? w : 9
  const ratioH = h > 0 ? h : 16
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2)
  if (ratioH >= ratioW) {
    return { width: even(shortSide), height: even((shortSide * ratioH) / ratioW) }
  }
  return { width: even((shortSide * ratioW) / ratioH), height: even(shortSide) }
}

function escapeFilterPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function escapeDrawText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:')
}

export interface RenderGraphInput {
  shots: RenderShot[]
  width: number
  height: number
  outputPath: string
  subtitlePath?: string
  subtitleSegments?: SubtitleSegment[]
  subtitleFontSize?: number
  bgmPath?: string
  logoPath?: string
  aiLabelText?: string
  fontPath?: string
  loudness?: number
  fps?: number
}

export interface RenderGraph {
  args: string[]
  durationMs: number
  subtitleSegments: SubtitleSegment[]
  hasAudio: boolean
  hasLogo: boolean
  hasAiLabel: boolean
}

/** 生成完整 FFmpeg 参数（不含 -nostdin/-hide_banner/-y） */
export function buildRenderGraph(input: RenderGraphInput): RenderGraph {
  const fps = input.fps ?? 30
  const shots = input.shots.length > 0 ? input.shots : []
  const durationMs = shots.reduce((sum, shot) => sum + shot.durationMs, 0)
  const totalSec = Math.max(0.5, durationMs / 1000)
  const subtitleSegments = input.subtitleSegments || []
  const hasAudio = Boolean(input.bgmPath)
  const hasLogo = Boolean(input.logoPath)
  const hasAiLabel = Boolean(input.aiLabelText && input.fontPath)

  const args: string[] = []
  const inputs: string[] = []

  for (const shot of shots) {
    const sec = Math.max(0.5, shot.durationMs / 1000).toFixed(3)
    if (shot.assetKind === 'image' && shot.assetPath) {
      inputs.push('-loop', '1', '-t', sec, '-i', shot.assetPath)
    } else if (shot.assetKind === 'video' && shot.assetPath) {
      inputs.push('-stream_loop', '-1', '-t', sec, '-i', shot.assetPath)
    } else {
      inputs.push('-f', 'lavfi', '-t', sec, '-i', `color=c=0x1F2937:s=${input.width}x${input.height}:r=${fps}`)
    }
  }
  args.push(...inputs)

  const filters: string[] = []
  const concatLabels: string[] = []
  shots.forEach((shot, index) => {
    const sec = Math.max(0.5, shot.durationMs / 1000).toFixed(3)
    filters.push(
      `[${index}:v]scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,` +
        `pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2:color=0x111827,setsar=1,fps=${fps},` +
        `trim=duration=${sec},setpts=PTS-STARTPTS[v${index}]`
    )
    concatLabels.push(`[v${index}]`)
  })
  filters.push(`${concatLabels.join('')}concat=n=${shots.length}:v=1:a=0[vcat]`)
  filters.push('[vcat]format=yuv420p[vc]')

  let videoLabel = '[vc]'

  if (subtitleSegments.length > 0 && input.subtitlePath) {
    const fontSize = input.subtitleFontSize ?? Math.max(20, Math.round((42 * input.width) / 1080))
    const style = [
      'FontName=WenQuanYi Zen Hei',
      `FontSize=${fontSize}`,
      'PrimaryColour=&H00FFFFFF',
      'OutlineColour=&H00000000',
      'BorderStyle=1',
      'Outline=2',
      'Alignment=2',
      'MarginV=120',
    ].join(',')
    filters.push(
      `${videoLabel}subtitles='${escapeFilterPath(input.subtitlePath)}':force_style='${style}'[vs]`
    )
    videoLabel = '[vs]'
  }

  if (hasAiLabel && input.aiLabelText) {
    const labelSize = Math.max(18, Math.round((36 * input.width) / 1080))
    filters.push(
      `${videoLabel}drawtext=fontfile='${escapeFilterPath(input.fontPath!)}':` +
        `text='${escapeDrawText(input.aiLabelText)}':fontcolor=white@0.95:fontsize=${labelSize}:` +
        `box=1:boxcolor=black@0.45:boxborderw=10:x=w-text_w-32:y=32[va]`
    )
    videoLabel = '[va]'
  }

  let logoIndex = -1
  if (hasLogo) {
    logoIndex = shots.length
    args.push('-i', input.logoPath!)
    filters.push(
      `${videoLabel}[${logoIndex}:v]overlay=W-w-32:H-h-32:format=auto[vfinal]`
    )
    videoLabel = '[vfinal]'
  }

  const targetLoudness = input.loudness ?? -14
  let audioLabel = ''
  if (hasAudio) {
    const bgmIndex = logoIndex >= 0 ? logoIndex + 1 : shots.length
    args.push('-stream_loop', '-1', '-i', input.bgmPath!)
    filters.push(
      `[${bgmIndex}:a]atrim=0:${totalSec},asetpts=PTS-STARTPTS,` +
        `loudnorm=I=${targetLoudness}:TP=-1.5:LRA=11[aout]`
    )
    audioLabel = '[aout]'
  } else {
    const silentIndex = logoIndex >= 0 ? logoIndex + 1 : shots.length
    args.push('-f', 'lavfi', '-t', totalSec.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo')
    filters.push(`[${silentIndex}:a]atrim=0:${totalSec},asetpts=PTS-STARTPTS[aout]`)
    audioLabel = '[aout]'
  }

  args.push('-filter_complex', filters.join(';'))
  args.push('-map', videoLabel, '-map', audioLabel)
  args.push('-t', totalSec.toFixed(3))
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(fps))
  args.push('-c:a', 'aac', '-b:a', '128k')
  args.push('-movflags', '+faststart')
  args.push(input.outputPath)

  return { args, durationMs, subtitleSegments, hasAudio, hasLogo, hasAiLabel }
}
