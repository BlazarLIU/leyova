import {
  CleanRuleDefinition,
  cleanCurrency,
  cleanPercent,
  cleanDuration,
} from './rules.js'

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

        case 'assert_expr': {
          // simple check: gmv >= refund
          if (col && rule.params?.expr === 'row.gmv >= row.refund_amount') {
            const gmv = Number(row.gmv || row['成交额'] || 0)
            const refund = Number(row.refund_amount || row['退款金额'] || 0)
            if (gmv < refund) {
              if (rule.onError === 'drop') {
                isDropped = true
                statusReason = '退款金额超出成交金额 (逻辑校验未通过)'
              } else {
                isMarked = true
                row._warning = '退款金额超出成交金额'
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

