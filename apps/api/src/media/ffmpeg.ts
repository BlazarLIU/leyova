/**
 * media/ffmpeg.ts — FFmpeg / FFprobe 封装
 *
 * 关键约束（踩过的坑）：
 *   1. 必须清理 LD_LIBRARY_PATH / LD_PRELOAD：
 *      工具链注入的旧 libstdc++ 会让系统 ffmpeg 报 GLIBCXX 版本缺失。
 *   2. 参数数组化，不拼 shell 字符串，避免路径注入。
 *   3. 一律 -nostdin -hide_banner -y，并设 timeout + SIGKILL + maxBuffer。
 *   4. 失败时回收半成品文件，避免下一轮读取到不完整产物。
 */

import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { env } from '../config/env.js'

const FFMPEG_BIN = env.MEDIA_FFMPEG_PATH || '/usr/bin/ffmpeg'
const FFPROBE_BIN = env.MEDIA_FFPROBE_PATH || '/usr/bin/ffprobe'

/** 子进程环境：剔除会污染动态库解析的变量 */
export function cleanChildEnv(): NodeJS.ProcessEnv {
  const childEnv = { ...process.env }
  delete childEnv.LD_LIBRARY_PATH
  delete childEnv.LD_PRELOAD
  delete childEnv.DYLD_LIBRARY_PATH
  return childEnv
}

export interface MediaProbe {
  durationMs: number
  width: number | null
  height: number | null
  hasAudio: boolean
  hasVideo: boolean
  mimeType: string
  sizeBytes: number
}

/** 媒体根目录：绝对路径，默认 apps/api/uploads */
export function mediaRoot(): string {
  return resolve(env.MEDIA_ROOT || './uploads')
}

export function ensureDir(dir: string): string {
  const target = resolve(dir)
  if (!existsSync(target)) mkdirSync(target, { recursive: true })
  return target
}

/** 按类型返回受控子目录（source / clips / covers / subtitles / drafts） */
export function mediaDir(kind: 'source' | 'clips' | 'covers' | 'subtitles' | 'drafts', tenantId: number): string {
  return ensureDir(resolve(mediaRoot(), kind, String(tenantId)))
}

export class MediaCommandError extends Error {
  readonly code: string
  readonly stderr: string
  constructor(message: string, code: string, stderr: string) {
    super(message)
    this.name = 'MediaCommandError'
    this.code = code
    this.stderr = stderr
  }
}

interface RunOptions {
  timeoutMs?: number
  maxBuffer?: number
}

interface BinaryCapture {
  stdout: string
  stderr: string
}

function runBinaryCapture(bin: string, args: string[], options: RunOptions = {}): Promise<BinaryCapture> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      bin,
      args,
      {
        env: cleanChildEnv(),
        timeout: Math.max(1000, options.timeoutMs ?? 120_000),
        killSignal: 'SIGKILL',
        maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
          const code = err.killed ? 'TIMEOUT' : err.code || 'EXEC_FAILED'
          reject(new MediaCommandError(`媒体处理失败（${code}）`, String(code), String(stderr || '').slice(0, 2000)))
          return
        }
        resolvePromise({ stdout: String(stdout || ''), stderr: String(stderr || '') })
      }
    )
  })
}

function runBinary(bin: string, args: string[], options: RunOptions = {}): Promise<string> {
  return runBinaryCapture(bin, args, options).then((result) => result.stdout)
}

/** 探测媒体信息；文件不存在或不可解析时抛错 */
export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const abs = resolve(filePath)
  if (!existsSync(abs)) throw new MediaCommandError('媒体文件不存在', 'ENOENT', '')
  const stdout = await runBinary(FFPROBE_BIN, [
    '-v', 'error',
    '-show_entries', 'format=duration,size,format_name:stream=codec_type,width,height',
    '-of', 'json',
    abs,
  ])

  let parsed: any
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new MediaCommandError('媒体信息解析失败', 'PARSE_FAILED', stdout.slice(0, 500))
  }

  const streams: any[] = Array.isArray(parsed?.streams) ? parsed.streams : []
  const video = streams.find((s) => s.codec_type === 'video')
  const audio = streams.find((s) => s.codec_type === 'audio')
  const durationSec = Number(parsed?.format?.duration) || 0
  const formatName = String(parsed?.format?.format_name || '')

  return {
    durationMs: Math.max(0, Math.round(durationSec * 1000)),
    width: video?.width ? Number(video.width) : null,
    height: video?.height ? Number(video.height) : null,
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video),
    mimeType: guessMime(formatName),
    sizeBytes: Number(parsed?.format?.size) || 0,
  }
}

function guessMime(formatName: string): string {
  if (formatName.includes('mp4')) return 'video/mp4'
  if (formatName.includes('matroska')) return 'video/x-matroska'
  if (formatName.includes('mov')) return 'video/quicktime'
  if (formatName.includes('mp3')) return 'audio/mpeg'
  if (formatName.includes('wav')) return 'audio/wav'
  if (formatName.includes('aac')) return 'audio/aac'
  return 'application/octet-stream'
}

export interface RenderClipInput {
  sourcePath: string
  outputPath: string
  startMs: number
  endMs: number
  /** 竖屏 1080x1920；不传则保持原始分辨率 */
  width?: number
  height?: number
  /** 是否烧字幕（需要 subtitlePath） */
  subtitlePath?: string
  timeoutMs?: number
}

export interface RenderClipOutput {
  outputPath: string
  durationMs: number
  sizeBytes: number
}

/**
 * 按时间区间切出竖屏切片。
 * 有字幕时用 subtitles 滤镜烧录；无字幕时直接流拷贝或转码。
 */
export async function renderClip(input: RenderClipInput): Promise<RenderClipOutput> {
  const startSec = Math.max(0, input.startMs / 1000)
  const durationSec = Math.max(0.2, (input.endMs - input.startMs) / 1000)
  const absOut = resolve(input.outputPath)
  ensureDir(dirname(absOut))

  const args = ['-nostdin', '-hide_banner', '-y', '-ss', String(startSec), '-t', String(durationSec), '-i', resolve(input.sourcePath)]

  if (input.subtitlePath) {
    // 竖屏缩放 + 字幕烧录
    const width = input.width ?? 1080
    const height = input.height ?? 1920
    const escaped = resolve(input.subtitlePath).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
    args.push(
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,subtitles='${escaped}'`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart'
    )
  } else if (input.width && input.height) {
    args.push(
      '-vf', `scale=${input.width}:${input.height}:force_original_aspect_ratio=decrease,pad=${input.width}:${input.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart'
    )
  } else {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart')
  }
  args.push(absOut)

  try {
    await runBinary(FFMPEG_BIN, args, { timeoutMs: input.timeoutMs ?? 300_000 })
  } catch (err) {
    // 失败清理半成品
    if (existsSync(absOut)) {
      try {
        rmSync(absOut, { force: true })
      } catch {
        // 清理失败不掩盖原始错误
      }
    }
    throw err
  }

  const probe = await probeMedia(absOut)
  return { outputPath: absOut, durationMs: probe.durationMs, sizeBytes: probe.sizeBytes }
}

/** 从源视频抽一帧作为封面 */
export async function renderCover(input: {
  sourcePath: string
  outputPath: string
  atMs: number
  width?: number
  timeoutMs?: number
}): Promise<{ outputPath: string; sizeBytes: number }> {
  const absOut = resolve(input.outputPath)
  ensureDir(dirname(absOut))
  const atSec = Math.max(0, input.atMs / 1000)
  const args = [
    '-nostdin', '-hide_banner', '-y',
    '-ss', String(atSec),
    '-i', resolve(input.sourcePath),
    '-frames:v', '1',
    '-vf', `scale=${input.width ?? 720}:-2`,
    '-q:v', '3',
    absOut,
  ]
  try {
    await runBinary(FFMPEG_BIN, args, { timeoutMs: input.timeoutMs ?? 60_000 })
  } catch (err) {
    if (existsSync(absOut)) {
      try {
        rmSync(absOut, { force: true })
      } catch {
        // ignore
      }
    }
    throw err
  }
  const probe = await probeMedia(absOut)
  return { outputPath: absOut, sizeBytes: probe.sizeBytes }
}

export const FFMPEG_PATHS = { ffmpeg: FFMPEG_BIN, ffprobe: FFPROBE_BIN }

/** 通用 FFmpeg 执行器：参数数组化，自动加 -nostdin -hide_banner -y */
export async function runFfmpeg(args: string[], options: RunOptions = {}): Promise<void> {
  await runBinary(FFMPEG_BIN, ['-nostdin', '-hide_banner', '-y', ...args], options)
}

/** 综合响度（LUFS）；无音轨或解析失败返回 null，由调用方决定是否适用 */
export async function probeLoudness(filePath: string, timeoutMs = 180_000): Promise<number | null> {
  const abs = resolve(filePath)
  if (!existsSync(abs)) return null
  try {
    const { stderr } = await runBinaryCapture(
      FFMPEG_BIN,
      ['-nostdin', '-hide_banner', '-i', abs, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
      { timeoutMs }
    )
    const matches = [...stderr.matchAll(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)]
    if (matches.length === 0) return null
    return Number(matches[matches.length - 1][1])
  } catch {
    return null
  }
}

export interface MediaSegment {
  startMs: number
  endMs: number
}

/** 黑帧检测：返回持续 >= minDurationSec 的黑帧区间 */
export async function detectBlackFrames(filePath: string, minDurationSec = 0.5): Promise<MediaSegment[]> {
  const abs = resolve(filePath)
  if (!existsSync(abs)) return []
  const { stderr } = await runBinaryCapture(
    FFMPEG_BIN,
    [
      '-nostdin', '-hide_banner', '-i', abs,
      '-vf', `blackdetect=d=${minDurationSec}:pix_th=0.10`,
      '-an', '-f', 'null', '-',
    ],
    { timeoutMs: 180_000 }
  )
  const segments: MediaSegment[] = []
  for (const match of stderr.matchAll(/black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)/g)) {
    segments.push({
      startMs: Math.round(Number(match[1]) * 1000),
      endMs: Math.round(Number(match[2]) * 1000),
    })
  }
  return segments
}

/** 静音检测：返回持续 >= minDurationSec 的静音区间 */
export async function detectSilence(filePath: string, minDurationSec = 1): Promise<MediaSegment[]> {
  const abs = resolve(filePath)
  if (!existsSync(abs)) return []
  const { stderr } = await runBinaryCapture(
    FFMPEG_BIN,
    [
      '-nostdin', '-hide_banner', '-i', abs,
      '-af', `silencedetect=noise=-50dB:d=${minDurationSec}`,
      '-f', 'null', '-',
    ],
    { timeoutMs: 180_000 }
  )
  const segments: MediaSegment[] = []
  for (const match of stderr.matchAll(/silence_start:\s*(-?[\d.]+)[\s\S]*?silence_duration:\s*([\d.]+)/g)) {
    const startMs = Math.max(0, Math.round(Number(match[1]) * 1000))
    segments.push({ startMs, endMs: startMs + Math.round(Number(match[2]) * 1000) })
  }
  return segments
}