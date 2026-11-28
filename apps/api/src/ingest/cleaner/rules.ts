export type CleanRuleType =
  | 'rename_column'
  | 'drop_column'
  | 'split_column'
  | 'merge_columns'
  | 'cast_number'
  | 'cast_currency'
  | 'cast_percent'
  | 'cast_duration'
  | 'cast_datetime'
  | 'fill_null'
  | 'drop_if_null'
  | 'default_value'
  | 'dedup_by_keys'
  | 'range_clip'
  | 'outlier_iqr'
  | 'map_value'
  | 'replace_regex'
  | 'assert_expr'

export interface CleanRuleDefinition {
  type: CleanRuleType
  targetColumn?: string
  params?: Record<string, any>
  onError?: 'drop' | 'keep' | 'mark'
}

/** 解析含货币符号与千分位的金额/数值 */
export function cleanCurrency(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const str = String(val).replace(/[¥$,\s￥]/g, '').trim()
  if (!str || str === '—' || str === '-' || str === 'N/A') return null
  const num = Number(str)
  return Number.isFinite(num) ? num : null
}

/** 解析百分比字符串，如 "12.5%" -> 12.5 */
export function cleanPercent(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const str = String(val).trim()
  const num = cleanCurrency(str.replace('%', ''))
  return num
}

/** 解析中文时长："2小时30分" -> 150 (分钟) 或 秒数 */
export function cleanDuration(val: unknown, unit: 'minute' | 'second' = 'minute'): number | null {
  if (val === null || val === undefined) return null
  const str = String(val).trim()
  if (!str || str === '—' || str === '-') return null

  const hourMatch = str.match(/(\d+)\s*小时/)
  const minMatch = str.match(/(\d+)\s*分(?:钟)?/)
  const secMatch = str.match(/(\d+)\s*秒/)

  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const minutes = minMatch ? Number(minMatch[1]) : 0
  const seconds = secMatch ? Number(secMatch[1]) : 0

  const totalSeconds = hours * 3600 + minutes * 60 + seconds
  if (totalSeconds === 0 && !hourMatch && !minMatch && !secMatch) {
    const rawNum = Number(str)
    return Number.isFinite(rawNum) ? rawNum : null
  }

  return unit === 'second' ? totalSeconds : Math.round(totalSeconds / 60)
}

