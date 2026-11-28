/**
 * media/highlights.ts — 高光评分与候选切片
 *
 * 纯函数优先（可单测）：
 *   1. 规则分：营销信号词密度、语速密度、时长适中度、时间轴位置；
 *   2. 可选 LLM 分：对候选段做「是否可独立成片」的二次打分；
 *   3. 合并去重：重叠窗口只保留高分，避免同一段出多条切片。
 */

import type { TranscriptSegment } from '../knowledge/chunking.js'

/** 营销信号词：出现即加分，用于规则打分 */
export const SIGNAL_WORDS = [
  '价格', '优惠', '福利', '买一送一', '限时', '到手价', '券', '链接', '下单',
  '尺码', '面料', '材质', '防风', '保暖', '透气', '显瘦', '百搭',
  '库存', '最后', '秒杀', '包邮', '赠品', '支持', '七天',
]

export interface HighlightWindow {
  startMs: number
  endMs: number
  durationMs: number
  text: string
  score: number
  detail: {
    keyword: number
    density: number
    length: number
    position: number
  }
}

const MIN_DURATION_MS = 12_000
const MAX_DURATION_MS = 90_000
const TARGET_DURATION_MS = 35_000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 关键词得分：命中信号词数量，封顶 40 */
export function keywordScore(text: string): number {
  const lower = String(text || '')
  let hits = 0
  for (const word of SIGNAL_WORDS) {
    if (lower.includes(word)) hits += 1
  }
  return clamp(hits * 8, 0, 40)
}

/** 语速/信息密度得分：字符数 / 秒，理想 3-6 字每秒，封顶 25 */
export function densityScore(text: string, durationMs: number): number {
  if (durationMs <= 0) return 0
  const charsPerSec = String(text || '').replace(/\s/g, '').length / (durationMs / 1000)
  if (charsPerSec <= 0) return 0
  // 3–6 字/秒最贴近自然口播；过低或过高都扣分
  const distance = charsPerSec < 3 ? 3 - charsPerSec : charsPerSec > 6 ? charsPerSec - 6 : 0
  return clamp(25 - distance * 8, 0, 25)
}

/** 时长得分：越接近 35s 越高，封顶 20 */
export function lengthScore(durationMs: number): number {
  if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) return 0
  const ratio = Math.abs(durationMs - TARGET_DURATION_MS) / TARGET_DURATION_MS
  return clamp(20 - ratio * 20, 0, 20)
}

/** 位置得分：开场与结尾通常有钩子/逼单，中间偶发；封顶 15 */
export function positionScore(startMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0
  const ratio = startMs / totalMs
  if (ratio <= 0.15 || ratio >= 0.85) return 15
  if (ratio <= 0.3 || ratio >= 0.7) return 10
  return 5
}

/**
 * 按固定时间窗（默认 40s）+ 步长（默认 20s）滑动，产出候选窗口。
 * 窗口内容取落在区间内的转写片段拼接。
 */
export function buildWindows(
  segments: TranscriptSegment[],
  options: { windowMs?: number; stepMs?: number } = {}
): Array<{ startMs: number; endMs: number; text: string }> {
  if (segments.length === 0) return []
  const windowMs = Math.max(MIN_DURATION_MS, options.windowMs ?? 40_000)
  const stepMs = Math.max(5_000, options.stepMs ?? 20_000)
  const totalMs = segments[segments.length - 1].endMs
  const windows: Array<{ startMs: number; endMs: number; text: string }> = []

  for (let start = 0; start < totalMs; start += stepMs) {
    const end = Math.min(start + windowMs, totalMs)
    if (end - start < MIN_DURATION_MS) break
    const parts = segments
      .filter((seg) => seg.endMs > start && seg.startMs < end)
      .map((seg) => seg.text)
      .filter(Boolean)
    if (parts.length === 0) continue
    windows.push({ startMs: start, endMs: end, text: parts.join(' ') })
  }
  return windows
}

/** 对候选窗口打分 */
export function scoreWindows(
  windows: Array<{ startMs: number; endMs: number; text: string }>,
  totalMs: number
): HighlightWindow[] {
  return windows.map((win) => {
    const durationMs = win.endMs - win.startMs
    const keyword = keywordScore(win.text)
    const density = densityScore(win.text, durationMs)
    const length = lengthScore(durationMs)
    const position = positionScore(win.startMs, totalMs)
    const raw = keyword + density + length + position
    return {
      startMs: win.startMs,
      endMs: win.endMs,
      durationMs,
      text: win.text,
      score: Number(clamp(raw, 0, 100).toFixed(2)),
      detail: {
        keyword: Number(keyword.toFixed(2)),
        density: Number(density.toFixed(2)),
        length: Number(length.toFixed(2)),
        position: Number(position.toFixed(2)),
      },
    }
  })
}

/**
 * 去重：窗口之间存在重叠时只保留高分。
 * 规则：按分数降序贪心选取，已选窗口的时间区间不再接受重叠超过 50% 的候选。
 */
export function dedupeHighlights(
  candidates: HighlightWindow[],
  options: { maxCount?: number; overlapTolerance?: number } = {}
): HighlightWindow[] {
  const maxCount = Math.max(1, options.maxCount ?? 5)
  const tolerance = clamp(options.overlapTolerance ?? 0.5, 0, 1)
  const sorted = candidates.slice().sort((a, b) => b.score - a.score)
  const selected: HighlightWindow[] = []

  for (const candidate of sorted) {
    if (selected.length >= maxCount) break
    const overlaps = selected.some((picked) => {
      const overlapStart = Math.max(picked.startMs, candidate.startMs)
      const overlapEnd = Math.min(picked.endMs, candidate.endMs)
      if (overlapEnd <= overlapStart) return false
      const overlapMs = overlapEnd - overlapStart
      const shorter = Math.min(picked.durationMs, candidate.durationMs)
      return overlapMs / shorter > tolerance
    })
    if (!overlaps) selected.push(candidate)
  }

  return selected.sort((a, b) => a.startMs - b.startMs)
}

export interface HighlightPipelineOptions {
  windowMs?: number
  stepMs?: number
  maxCount?: number
  minScore?: number
}

/** 完整规则流水线：切片窗口 → 打分 → 过滤 → 去重 → 排序 */
export function computeHighlights(
  segments: TranscriptSegment[],
  options: HighlightPipelineOptions = {}
): HighlightWindow[] {
  if (segments.length === 0) return []
  const totalMs = segments[segments.length - 1].endMs
  const windows = buildWindows(segments, { windowMs: options.windowMs, stepMs: options.stepMs })
  const scored = scoreWindows(windows, totalMs)
  const minScore = options.minScore ?? 0
  const filtered = scored.filter((item) => item.score >= minScore)
  return dedupeHighlights(filtered, { maxCount: options.maxCount })
}

/** 从窗口文本生成默认标题：优先取首个信号词所在短句 */
export function defaultTitle(text: string, maxLength = 30): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return '未命名切片'
  const sentences = clean.split(/[。！？!?]/).map((s) => s.trim()).filter(Boolean)
  const target = sentences.find((s) => SIGNAL_WORDS.some((word) => s.includes(word))) || sentences[0] || clean
  return target.length > maxLength ? `${target.slice(0, maxLength)}…` : target
}