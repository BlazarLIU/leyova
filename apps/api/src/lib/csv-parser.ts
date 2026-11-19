/**
 * csv-parser.ts — 电商导出文件（CSV / XLSX）结构化解析（P2-1 从 routes/ingest.ts 抽出）
 *
 * 背景：原实现在 routes/ingest.ts 顶部（约 140 行助手），被 preview / manual-upload /
 *       templates / fingerprint 多个路由共用，属可复用解析逻辑而非路由逻辑，
 *       故抽到 lib 层便于单测与复用。
 *
 * CSV 处理要点：电商后台导出的 CSV 常把金额写成 `￥12,345.60` 且不带引号，
 * 直接交给通用 CSV 解析器会把一列拆成两列，导致后面整行错位。
 * 采用「按列数对齐」的结构化修复：先按逗号切分，若字段数多于表头列数，
 * 则尝试把相邻字段重新合并（补回逗号），使字段数恰好等于表头列数。
 */
import * as XLSX from 'xlsx'
import { createHash } from 'node:crypto'

const THOUSAND_TAIL = /^\d{3}(?:[.,]\d+)?(?:[^\d]|$)/

/** 金额类列名关键词：只有这些列可能出现 "12,345.60" 这种被拆开的千分位 */
/** 计数器类列名：这些列是整数，绝不可能有千分位小数 */
const COUNT_HEADER_HINT = /数$|量$|笔$|个数|单数|次数|件数|人数|率$|占比|比例|count|qty|quantity|rate|ratio/i

/** 金额类列名关键词：只有这些列可能出现 "12,345.60" 这种被拆开的千分位 */
const MONEY_HEADER_HINT = /金额|GMV|gmv|实付|成交额|交易额|收款|售价|单价|费用|成本|收入|支出|余额|amount|price|cost|revenue/i

/** 判断某列表头是否为金额列（计数器列一律排除） */
function isMoneyColumn(header: string): boolean {
  const h = (header || '').trim()
  if (!h) return false
  if (COUNT_HEADER_HINT.test(h)) return false
  return MONEY_HEADER_HINT.test(h)
}

/**
 * 判断 a、b 是否本属同一个数字（被千分位逗号拆开）。
 * 前提：该列必须是金额类列（由调用方保证），因为整数列（订单数/买家数）
 * 不存在千分位小数，绝不应被合并。
 */
function looksLikeThousandSplit(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return false
  const left = String(a).trim()
  const right = String(b).trim()
  if (!left || !right) return false
  if (!/\d$/.test(left)) return false
  // 前半段若已带完整小数部分，该数字已结束，不可能再接千分位
  if (/\.\d+$/.test(left)) return false
  return THOUSAND_TAIL.test(right)
}

/**
 * 按列数对齐修复被逗号拆开的金额列。
 * headers 用于判断每一列是否为金额类，只有金额列允许合并。
 */
function mergeNumericFragments(fields: string[], headers: string[]): string[] {
  const expected = headers.length
  if (fields.length <= expected) return fields
  const out: string[] = []
  let i = 0
  while (i < fields.length) {
    const remainingSlots = expected - out.length
    const remainingFields = fields.length - i
    if (remainingSlots > 0 && remainingFields > remainingSlots && i + 1 < fields.length) {
      // 当前要填充的目标列
      const targetHeader = headers[out.length] || ''
      const moneyColumn = isMoneyColumn(targetHeader)
      const a = fields[i]
      const b = fields[i + 1]
      if (moneyColumn) {
        // 优先三段合并（如 1,234,567）
        if (i + 2 < fields.length && remainingFields - 2 > remainingSlots - 1) {
          const ab = `${a},${b}`
          if (looksLikeThousandSplit(a, b) && looksLikeThousandSplit(ab, fields[i + 2])) {
            out.push(`${ab},${fields[i + 2]}`)
            i += 3
            continue
          }
        }
        if (looksLikeThousandSplit(a, b)) {
          out.push(`${a},${b}`)
          i += 2
          continue
        }
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
      // 一行可能有多个金额列同时被拆开，需反复合并直到列数对齐
      let guard = 0
      while (fields.length > expected && guard < 20) {
        const merged = mergeNumericFragments(fields, headers)
        if (merged.length === fields.length) break // 无进展，停止避免死循环
        fields = merged
        guard++
      }
      // 仍不匹配则记录为错位行，交由上层统计，不静默丢弃
      const obj: Record<string, any> = {}
      headers.forEach((h, idx) => { obj[h] = fields[idx] !== undefined ? fields[idx].trim() : '' })
      if (fields.length !== expected) obj.__misaligned__ = fields.length
      rows.push(obj)
    }
    return { headers, rows }
  }

  const wb = XLSX.read(buffer, { type: 'buffer', raw: false, dense: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}

/** 列名指纹，用于复用已保存的列映射 */
function headerFingerprint(headers: string[]): string {
  return createHash('sha256').update(headers.join('|')).digest('hex').slice(0, 32)
}

export { isMoneyColumn, looksLikeThousandSplit, mergeNumericFragments, splitCsvLine, parseFileToRows, headerFingerprint, THOUSAND_TAIL, MONEY_HEADER_HINT, COUNT_HEADER_HINT }
