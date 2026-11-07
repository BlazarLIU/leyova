import {
  CleanRuleDefinition,
  cleanCurrency,
  cleanPercent,
  cleanDuration,
} from './rules.js'

/** 日期时间归一：支持 2026/11/7、2026年11月7日、20261107、Excel 序列号 */
function normalizeDateTime(v: any): string | null {
  if (v === null || v === undefined || v === '') return null

  const raw = String(v).trim()

  // Excel 日期序列号
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw)
    if (n > 20000 && n < 80000) {
      const ms = Math.round((n - 25569) * 86400000)
      const d = new Date(ms)
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    }
    // 20261107
    if (raw.length === 8 && raw.startsWith('20')) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    }
    return null
  }

  // 2026-11-07 / 2026/11/7 / 2026年11月7日
  const m = raw.match(/^(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }

  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

/** 计算某列的四分位数区间（用于 outlier_iqr） */
function computeIqrBounds(values: number[]): { low: number; high: number } | null {
  if (values.length < 4) return null
  const sorted = [...values].sort((a, b) => a - b)
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }
  const q1 = q(0.25)
  const q3 = q(0.75)
  const iqr = q3 - q1
  return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr }
}

/**
 * 安全求值简单比较表达式，例如：
 *   "row.gmv >= row.refund_amount"
 *   "row.paid_order_count > 0"
 *   "row.gmv <= 100000"
 * 返回 true / false；无法解析返回 null（视为不判定，避免误杀数据）
 */
function evaluateSimpleExpr(expr: string, row: Record<string, any>): boolean | null {
  // 字段名允许中文（\p{L} 匹配任意语言字母，需 u 标志）
  const m = expr.match(/^\s*row\.([\p{L}_][\p{L}\p{N}_]*)\s*(>=|<=|==|!=|>|<)\s*(?:row\.([\p{L}_][\p{L}\p{N}_]*)|(-?\d+(?:\.\d+)?))\s*$/u)
  if (!m) return null

  const [, leftCol, op, rightCol, rightNum] = m
  const left = Number(row[leftCol])
  const right = rightCol ? Number(row[rightCol]) : Number(rightNum)

  if (!Number.isFinite(left) || !Number.isFinite(right)) return null

  switch (op) {
    case '>=': return left >= right
    case '<=': return left <= right
    case '>':  return left > right
    case '<':  return left < right
    case '==': return left === right
    case '!=': return left !== right
    default:   return null
  }
}

export interface CleaningReport {
  inputRowsCount: number
  successRowsCount: number
  droppedRowsCount: number
  modifiedRowsCount: number
  markedRowsCount: number
  executionTimeMs: number
  sampleDiffs: Array<{
    rowIndex: number
    status: 'passed' | 'modified' | 'dropped' | 'marked'
    reason?: string
    original: Record<string, any>
    cleaned: Record<string, any>
  }>
  rulesAppliedCount: number
}

export function executeCleaningPipeline(
  rows: Record<string, any>[],
  rules: CleanRuleDefinition[],
  options: { maxDiffSamples?: number } = {}
): {
  cleanedRows: Record<string, any>[]
  report: CleaningReport
} {
  const startTime = Date.now()
  const maxSamples = options.maxDiffSamples ?? 20
  const sampleDiffs: CleaningReport['sampleDiffs'] = []

  let droppedCount = 0
  let modifiedCount = 0
  let markedCount = 0

  let currentRows: Record<string, any>[] = rows.map(r => ({ ...r }))

  // 为 outlier_iqr 规则预计算四分位边界（需全列数据）
  for (const rule of rules) {
    if (rule.type !== 'outlier_iqr' || !rule.targetColumn) continue
    const nums = rows
      .map((r) => Number(r[rule.targetColumn!]))
      .filter((n) => Number.isFinite(n))
    const bounds = computeIqrBounds(nums)
    if (bounds) {
      ;(rule as any)._iqrLow = Number(bounds.low.toFixed(4))
      ;(rule as any)._iqrHigh = Number(bounds.high.toFixed(4))
    }
  }

  // Deduplication rule handled at dataset level first if present
  const dedupRule = rules.find(r => r.type === 'dedup_by_keys')
  if (dedupRule?.params?.keys && Array.isArray(dedupRule.params.keys)) {
    const keys: string[] = dedupRule.params.keys
    const seen = new Map<string, number>()
    const deduped: Record<string, any>[] = []

    currentRows.forEach((row, idx) => {
      const hash = keys.map(k => String(row[k] ?? '')).join('::')
      if (seen.has(hash)) {
        droppedCount++
        if (sampleDiffs.length < maxSamples) {
          sampleDiffs.push({
            rowIndex: idx,
            status: 'dropped',
            reason: `主键去重过滤 (${keys.join(', ')})`,
            original: row,
            cleaned: {},
          })
        }
      } else {
        seen.set(hash, idx)
        deduped.push(row)
      }
    })
    currentRows = deduped
  }

  // Row-level transformations
  const resultRows: Record<string, any>[] = []

  for (let idx = 0; idx < currentRows.length; idx++) {
    const orig = { ...currentRows[idx] }
    let row = { ...orig }
    let isDropped = false
    let isModified = false
    let isMarked = false
    let statusReason = ''

    for (const rule of rules) {
      if (isDropped) break
      const col = rule.targetColumn

      switch (rule.type) {
        case 'rename_column': {
          const newCol = rule.params?.newColumn
          if (col && newCol && col in row) {
            row[newCol] = row[col]
            delete row[col]
            isModified = true
          }
          break
        }

        case 'drop_column': {
          if (col && col in row) {
            delete row[col]
            isModified = true
          }
          break
        }

        case 'cast_currency':
        case 'cast_number': {
          if (col && col in row) {
            const parsed = cleanCurrency(row[col])
            if (parsed === null && rule.onError === 'drop') {
              isDropped = true
              statusReason = `${col} 金额格式非法且设置直接剔除`
            } else {
              if (parsed !== row[col]) isModified = true
              row[col] = parsed
            }
          }
          break
        }

        case 'cast_percent': {
          if (col && col in row) {
            const parsed = cleanPercent(row[col])
            if (parsed !== row[col]) isModified = true
            row[col] = parsed
          }
          break
        }

        case 'cast_duration': {
          if (col && col in row) {
            const unit = rule.params?.unit || 'minute'
            const parsed = cleanDuration(row[col], unit)
            if (parsed !== row[col]) isModified = true
            row[col] = parsed
          }
          break
        }

        case 'fill_null': {
          if (col && (row[col] === null || row[col] === undefined || row[col] === '')) {
            row[col] = rule.params?.defaultValue ?? 0
            isModified = true
          }
          break
        }

        case 'drop_if_null': {
          if (col && (row[col] === null || row[col] === undefined || row[col] === '')) {
            isDropped = true
            statusReason = `关键列 ${col} 为空，整行剔除`
          }
          break
        }

        case 'range_clip': {
          if (col && typeof row[col] === 'number') {
            const min = rule.params?.min
            const max = rule.params?.max
            if (min !== undefined && row[col] < min) {
              if (rule.onError === 'drop') {
                isDropped = true
                statusReason = `${col} 值低于阈值 ${min}`
              } else {
                row[col] = min
                isModified = true
              }
            }
            if (max !== undefined && row[col] > max) {
              if (rule.onError === 'drop') {
                isDropped = true
                statusReason = `${col} 值高于阈值 ${max}`
              } else {
                row[col] = max
                isModified = true
              }
            }
          }
          break
        }

        case 'map_value': {
          const mapping = rule.params?.mapping
          if (col && mapping && row[col] in mapping) {
            row[col] = mapping[row[col]]
            isModified = true
          }
          break
        }

        case 'split_column': {
          // 按分隔符把一列拆成多列：params: { separator, newColumns: ['a','b'] }
          const sep = rule.params?.separator ?? ','
          const newCols: string[] = rule.params?.newColumns || []
          if (col && col in row && newCols.length > 0) {
            const parts = String(row[col] ?? '').split(sep)
            newCols.forEach((nc, i) => {
              row[nc] = parts[i] !== undefined ? parts[i].trim() : ''
            })
            isModified = true
          }
          break
        }

        case 'merge_columns': {
          // 合并多列：params: { sourceColumns: ['a','b'], separator, newColumn }
          const srcCols: string[] = rule.params?.sourceColumns || []
          const joiner = rule.params?.separator ?? ' '
          const target = rule.params?.newColumn || col
          if (srcCols.length > 0 && target) {
            row[target] = srcCols.map((c) => String(row[c] ?? '')).filter(Boolean).join(joiner)
            isModified = true
          }
          break
        }

        case 'cast_datetime': {
          // 日期时间归一：支持 2026/11/7、2026年11月7日、Excel 序列号
          if (col && col in row && row[col] !== '' && row[col] !== null) {
            const parsed = normalizeDateTime(row[col])
            if (parsed === null) {
              if (rule.onError === 'drop') {
                isDropped = true
                statusReason = `${col} 日期格式无法解析`
              } else if (rule.onError === 'mark') {
                isMarked = true
                row._warning = `${col} 日期格式异常`
              }
            } else {
              if (parsed !== row[col]) isModified = true
              row[col] = parsed
            }
          }
          break
        }

        case 'default_value': {
          // 无条件写入默认值（区别于 fill_null 只在空值时填）
          if (col) {
            const v = rule.params?.value ?? rule.params?.defaultValue
            if (v !== undefined) {
              row[col] = v
              isModified = true
            }
          }
          break
        }

        case 'outlier_iqr': {
          // 箱线图异常值探测：边界在数据集级预处理阶段算好
          // 注意：上传数据多为字符串（如 '99999'），必须先做数值转换再比较
          if (col && row[col] !== undefined && row[col] !== '') {
            const lo = (rule as any)._iqrLow
            const hi = (rule as any)._iqrHigh
            const num = Number(String(row[col]).replace(/[¥$,\s￥]/g, ''))
            if (lo !== undefined && hi !== undefined && Number.isFinite(num) && (num < lo || num > hi)) {
              if (rule.onError === 'drop') {
                isDropped = true
                statusReason = `${col} 超出 IQR 正常区间 [${lo.toFixed(2)}, ${hi.toFixed(2)}]`
              } else if (rule.onError === 'mark') {
                isMarked = true
                row._warning = `${col} 超出 IQR 区间 [${lo.toFixed(2)}, ${hi.toFixed(2)}]`
                statusReason = 'IQR 异常已打标'
              }
            }
          }
          break
        }

        case 'replace_regex': {
          // 正则替换：params: { pattern, replacement, flags }
          if (col && col in row) {
            const pattern = rule.params?.pattern
            const repl = rule.params?.replacement ?? ''
            if (pattern) {
              try {
                const flags = rule.params?.flags || 'g'
                const re = new RegExp(pattern, flags)
                const before = String(row[col] ?? '')
                const after = before.replace(re, repl)
                if (after !== before) {
                  row[col] = after
                  isModified = true
                }
              } catch {
                // 非法正则：按 onError 处理
                if (rule.onError === 'drop') {
                  isDropped = true
                  statusReason = `${col} 正则表达式非法`
                }
              }
            }
          }
          break
        }

        case 'assert_expr': {
          /**
           * 通用布尔表达式校验。
           * 支持形如 "row.a >= row.b" / "row.a > 100" 的比较，
           * 运算符：>= <= > < == !=
           * 只允许 row.字段 与数字字面量，不做任意代码求值（安全考虑）。
           */
          const expr = rule.params?.expr
          if (typeof expr === 'string') {
            const result = evaluateSimpleExpr(expr, row)
            if (result === false) {
              const msg = rule.params?.message || `表达式校验未通过: ${expr}`
              if (rule.onError === 'drop') {
                isDropped = true
                statusReason = msg
              } else if (rule.onError !== 'keep') {
                isMarked = true
                row._warning = msg
                statusReason = '数据异常已打标'
              }
            }
          }
          break
        }
      }
    }

    if (isDropped) {
      droppedCount++
      if (sampleDiffs.length < maxSamples) {
        sampleDiffs.push({
          rowIndex: idx + 1,
          status: 'dropped',
          reason: statusReason,
          original: orig,
          cleaned: {},
        })
      }
    } else {
      if (isModified) modifiedCount++
      if (isMarked) markedCount++
      resultRows.push(row)

      if (sampleDiffs.length < maxSamples && (isModified || isMarked)) {
        sampleDiffs.push({
          rowIndex: idx + 1,
          status: isMarked ? 'marked' : 'modified',
          reason: statusReason || '格式清洗/填充',
          original: orig,
          cleaned: row,
        })
      }
    }
  }

  // If we haven't filled up sampleDiffs, add passed samples
  for (let idx = 0; idx < resultRows.length && sampleDiffs.length < maxSamples; idx++) {
    const row = resultRows[idx]
    if (!sampleDiffs.some(s => s.rowIndex === idx + 1)) {
      sampleDiffs.push({
        rowIndex: idx + 1,
        status: 'passed',
        original: currentRows[idx] || row,
        cleaned: row,
      })
    }
  }

  const report: CleaningReport = {
    inputRowsCount: rows.length,
    successRowsCount: resultRows.length,
    droppedRowsCount: droppedCount,
    modifiedRowsCount: modifiedCount,
    markedRowsCount: markedCount,
    executionTimeMs: Date.now() - startTime,
    sampleDiffs,
    rulesAppliedCount: rules.length,
  }

  return { cleanedRows: resultRows, report }
}

