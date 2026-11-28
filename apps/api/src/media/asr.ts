/**
 * media/asr.ts — 语音转写（可插拔）
 *
 * 三类来源：
 *   1. manual   ：人工上传字幕/转写稿（无需任何外部依赖，永远可用）；
 *   2. whisper  ：自建 Whisper 兼容服务（POST /v1/audio/transcriptions），
 *                 仅在内网白名单开启时允许；
 *   3. 未配置    ：返回结构化 unconfigured，调用方可提示用户改用人工上传。
 *
 * 转写片段统一输出 {text,startMs,endMs,speaker}，与 W9 知识库契约一致。
 */

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { env } from '../config/env.js'
import { isLocalOrPrivateHost } from '../ai/llm/provider.js'
import type { TranscriptSegment } from '../knowledge/chunking.js'

export type AsrProvider = 'manual' | 'whisper' | 'volcengine' | 'dashscope'

export interface AsrConfig {
  provider: AsrProvider
  apiBase: string
  apiKey: string
  model: string
}

export interface AsrResult {
  ok: boolean
  provider: AsrProvider
  configured: boolean
  segments: TranscriptSegment[]
  fullText: string
  language: string
  error?: string
  latencyMs: number
}

/** 解析 SRT 时间戳：00:00:01,200 → 1200ms */
export function parseSrtTimestamp(value: string): number {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/)
  if (!match) return NaN
  const [, h, m, s, ms] = match
  return (
    Number(h) * 3_600_000 +
    Number(m) * 60_000 +
    Number(s) * 1000 +
    Number(ms.padEnd(3, '0'))
  )
}

/**
 * 解析 SRT。容忍 BOM、多余空行与序号缺失。
 * 返回片段按时间升序，时间戳统一为毫秒。
 */
export function parseSrt(content: string): TranscriptSegment[] {
  const text = String(content || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const blocks = text.split(/\n{2,}/)
  const segments: TranscriptSegment[] = []

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length === 0) continue
    const timeIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeIndex === -1) continue

    const [rawStart, rawEnd] = lines[timeIndex].split('-->').map((part) => part.trim())
    const startMs = parseSrtTimestamp(rawStart)
    const endMs = parseSrtTimestamp(rawEnd)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue

    const body = lines.slice(timeIndex + 1).join(' ').trim()
    if (!body) continue
    segments.push({ text: body, startMs, endMs })
  }

  return segments.sort((a, b) => a.startMs - b.startMs)
}

/** 解析纯文本时间轴（每行「[mm:ss] 文本」或「[hh:mm:ss] 文本」） */
export function parseLooseTimeline(content: string): TranscriptSegment[] {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
  const segments: TranscriptSegment[] = []
  let lastEnd = 0

  for (const line of lines) {
    const match = line.match(/^\s*\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*(.+)$/)
    if (!match) continue
    const [, a, b, c, body] = match
    const startMs = c
      ? Number(a) * 3_600_000 + Number(b) * 60_000 + Number(c) * 1000
      : Number(a) * 60_000 + Number(b) * 1000
    const text = body.trim()
    if (!text) continue
    segments.push({ text, startMs, endMs: startMs + 3_000 })
    lastEnd = startMs + 3_000
  }

  // 修正相邻片段首尾衔接，避免大面积重叠
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (segments[i].endMs > segments[i + 1].startMs) {
      segments[i].endMs = segments[i + 1].startMs
    }
  }
  if (segments.length > 0) {
    segments[segments.length - 1].endMs = Math.max(segments[segments.length - 1].endMs, lastEnd)
  }
  return segments.filter((seg) => seg.endMs > seg.startMs)
}

function buildFullText(segments: TranscriptSegment[]): string {
  return segments.map((seg) => (seg.speaker ? `【${seg.speaker}】${seg.text}` : seg.text)).join('\n')
}

/** 人工上传：支持 SRT 或「[mm:ss] 文本」时间轴 */
export function parseManualTranscript(content: string): TranscriptSegment[] {
  const raw = String(content || '')
  if (raw.includes('-->')) return parseSrt(raw)
  return parseLooseTimeline(raw)
}

export function resolveAsrConfig(overrides: Partial<AsrConfig> = {}): AsrConfig {
  return {
    provider: (overrides.provider || 'manual') as AsrProvider,
    apiBase: String(overrides.apiBase || '').replace(/\/+$/, ''),
    apiKey: String(overrides.apiKey || ''),
    model: String(overrides.model || 'whisper-1'),
  }
}

/** 内网 ASR 端点安全校验：元数据地址永久拒绝，内网需显式开关 */
export function assertAsrEndpointAllowed(apiBase: string): string | null {
  let host = ''
  try {
    host = new URL(apiBase).hostname.toLowerCase()
  } catch {
    return 'ASR 服务地址不合法'
  }
  if (!host) return 'ASR 服务地址不合法'
  if (/^169\.254\./.test(host) || /^\[?fe80/i.test(host)) return '拒绝访问云元数据/链路本地地址'
  if (isLocalOrPrivateHost(apiBase) && !env.MEDIA_ALLOW_PRIVATE_ASR) {
    return '默认禁止内网 ASR 地址；私有化部署可设置 MEDIA_ALLOW_PRIVATE_ASR=true'
  }
  return null
}

/**
 * 调用 Whisper 兼容服务做转写。
 * 请求体为 multipart，返回 verbose_json 时按 segment 映射时间轴。
 */
export async function transcribeWithWhisper(
  filePath: string,
  config: AsrConfig,
  options: { timeoutMs?: number } = {}
): Promise<AsrResult> {
  const started = Date.now()
  if (!config.apiBase || !config.apiKey) {
    return {
      ok: false,
      provider: 'whisper',
      configured: false,
      segments: [],
      fullText: '',
      language: 'zh',
      error: '未配置 ASR 服务地址或密钥',
      latencyMs: 0,
    }
  }
  const rejected = assertAsrEndpointAllowed(config.apiBase)
  if (rejected) {
    return {
      ok: false,
      provider: 'whisper',
      configured: true,
      segments: [],
      fullText: '',
      language: 'zh',
      error: rejected,
      latencyMs: 0,
    }
  }

  const controller = new AbortController()
  const timeoutMs = Math.max(5000, options.timeoutMs ?? 600_000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const buffer = await readFile(filePath)
    const form = new FormData()
    form.append('file', new Blob([buffer]), basename(filePath))
    form.append('model', config.model)
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'segment')

    const res = await fetch(`${config.apiBase}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        provider: 'whisper',
        configured: true,
        segments: [],
        fullText: '',
        language: 'zh',
        error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
        latencyMs: Date.now() - started,
      }
    }

    const data = (await res.json()) as any
    const rawSegments: any[] = Array.isArray(data?.segments) ? data.segments : []
    const segments: TranscriptSegment[] = rawSegments
      .map((seg) => ({
        text: String(seg?.text || '').trim(),
        startMs: Math.max(0, Math.round(Number(seg?.start ?? 0) * 1000)),
        endMs: Math.max(0, Math.round(Number(seg?.end ?? 0) * 1000)),
      }))
      .filter((seg) => seg.text && seg.endMs > seg.startMs)
      .sort((a, b) => a.startMs - b.startMs)

    return {
      ok: segments.length > 0,
      provider: 'whisper',
      configured: true,
      segments,
      fullText: segments.length > 0 ? buildFullText(segments) : String(data?.text || ''),
      language: String(data?.language || 'zh'),
      error: segments.length === 0 ? '转写结果为空' : undefined,
      latencyMs: Date.now() - started,
    }
  } catch (err) {
    const name = (err as Error)?.name
    return {
      ok: false,
      provider: 'whisper',
      configured: true,
      segments: [],
      fullText: '',
      language: 'zh',
      error: name === 'AbortError' ? `转写超时（${timeoutMs}ms）` : (err as Error)?.message || String(err),
      latencyMs: Date.now() - started,
    }
  } finally {
    clearTimeout(timer)
  }
}

/** 统一入口：manual 走本地解析，其余走 Whisper 兼容服务 */
export async function transcribe(
  filePath: string,
  config: AsrConfig,
  manualContent?: string
): Promise<AsrResult> {
  if (config.provider === 'manual') {
    const segments = parseManualTranscript(String(manualContent || ''))
    return {
      ok: segments.length > 0,
      provider: 'manual',
      configured: true,
      segments,
      fullText: buildFullText(segments),
      language: 'zh',
      error: segments.length === 0 ? '未提供可解析的转写内容（支持 SRT 或 [mm:ss] 时间轴）' : undefined,
      latencyMs: 0,
    }
  }
  return transcribeWithWhisper(filePath, config)
}