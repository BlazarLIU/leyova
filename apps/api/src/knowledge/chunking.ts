/**
 * knowledge/chunking.ts — 文本分块
 *
 * 中文按句末标点与长度双重约束切分，保证语义尽量完整；
 * 回放域按时间戳切分（由调用方传入 startMs/endMs 区间）。
 */

export interface TextChunk {
  seq: number
  content: string
  tokenCount: number
  pageNo?: number
  startMs?: number
  endMs?: number
}

const SENTENCE_END = /[。！？；\n]/

/** 粗略 token 估算：中文按 1 字 ≈ 1 token，英文按 4 字符 ≈ 1 token */
export function estimateTokens(text: string): number {
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const others = text.length - chinese
  return Math.ceil(chinese + others / 4)
}

/** 清洗：去控制字符、压缩空白、去首尾空白（保留 \f 分页符，供 PDF 定位页码） */
export function cleanText(text: string): string {
  return String(text ?? '')
    .replace(/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 按语义边界切块：
 * 1. 先按句子累积，超过 chunkSize 即切；
 * 2. 保留 chunkOverlap 字符作为上下文衔接；
 * 3. 页码随文本位置推进（PDF 用分页符 \f 分隔）。
 */
export function splitText(
  raw: string,
  options: { chunkSize?: number; chunkOverlap?: number } = {}
): TextChunk[] {
  const chunkSize = Math.max(100, options.chunkSize ?? 800)
  const chunkOverlap = Math.min(Math.max(0, options.chunkOverlap ?? 100), chunkSize - 1)
  const text = cleanText(raw)
  if (!text) return []

  // 先按分页符拆页，保留页码
  const pages = text.split('\f')
  const chunks: TextChunk[] = []
  let seq = 0

  pages.forEach((pageText, pageIndex) => {
    const page = cleanText(pageText)
    if (!page) return

    // 句子切分：保留分隔符
    const sentences: string[] = []
    let buffer = ''
    for (const char of page) {
      buffer += char
      if (SENTENCE_END.test(char) && buffer.trim()) {
        sentences.push(buffer)
        buffer = ''
      }
    }
    if (buffer.trim()) sentences.push(buffer)

    let current = ''
    for (const sentence of sentences) {
      if (current.length + sentence.length <= chunkSize) {
        current += sentence
        continue
      }
      if (current.trim()) {
        chunks.push({
          seq: seq++,
          content: current.trim(),
          tokenCount: estimateTokens(current.trim()),
          pageNo: pages.length > 1 ? pageIndex + 1 : undefined,
        })
      }
      // 长句强制硬切，避免单块过大
      let rest = sentence
      while (rest.length > chunkSize) {
        const head = rest.slice(0, chunkSize)
        chunks.push({
          seq: seq++,
          content: head.trim(),
          tokenCount: estimateTokens(head.trim()),
          pageNo: pages.length > 1 ? pageIndex + 1 : undefined,
        })
        rest = rest.slice(chunkSize - chunkOverlap)
      }
      current = chunkOverlap > 0 && current ? current.slice(-chunkOverlap) + rest : rest
    }

    if (current.trim()) {
      chunks.push({
        seq: seq++,
        content: current.trim(),
        tokenCount: estimateTokens(current.trim()),
        pageNo: pages.length > 1 ? pageIndex + 1 : undefined,
      })
    }
  })

  return chunks
}

export interface TranscriptSegment {
  text: string
  startMs: number
  endMs: number
  speaker?: string
}

/**
 * 回放转写切块：按时间窗合并相邻片段，保留起止时间戳与说话人。
 */
export function splitTranscript(
  segments: TranscriptSegment[],
  options: { chunkSize?: number } = {}
): TextChunk[] {
  const chunkSize = Math.max(100, options.chunkSize ?? 800)
  const chunks: TextChunk[] = []
  let seq = 0
  let current: TextChunk | null = null
  let speaker = ''

  for (const seg of segments) {
    const piece = cleanText(seg.text)
    if (!piece) continue
    const label = seg.speaker && seg.speaker !== speaker ? `【${seg.speaker}】` : ''
    const line = `${label}${piece} `
    if (current && current.content.length + line.length <= chunkSize && seg.speaker === speaker) {
      current.content += line
      current.endMs = seg.endMs
      current.tokenCount = estimateTokens(current.content)
      continue
    }
    if (current) chunks.push({ ...current, content: current.content.trim() })
    speaker = seg.speaker || ''
    current = {
      seq: seq++,
      content: line,
      tokenCount: estimateTokens(line),
      startMs: seg.startMs,
      endMs: seg.endMs,
    }
  }
  if (current) chunks.push({ ...current, content: current.content.trim() })
  return chunks
}

/** 内容哈希：用于去重（同集合同内容不重复入库） */
export function contentFingerprint(text: string): string {
  let hash = 0n
  const normalized = cleanText(text).slice(0, 20000)
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31n + BigInt(normalized.charCodeAt(i))) % 18446744073709551557n
  }
  return `${normalized.length}-${hash.toString(16)}`
}