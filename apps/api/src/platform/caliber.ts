/**
 * caliber.ts — 平台成交口径解析与校验
 *
 * 核心职责（阶段 A1）：
 *   1. 读取某平台某指标的可用口径（amount_type）
 *   2. 校验跨平台对比时口径是否可比
 *   3. 为前端提供口径说明文案
 *
 * 设计原则：
 *   - 不同平台的 GMV 定义不同，**跨平台直接加总在语义上就是错的**
 *   - 因此提供 assertComparable()，口径不可比时返回明确警告而非静默混合
 */

import type { DbExecutor } from '../lib/audit.js'
import { getPool } from '../lib/db.js'

export interface CaliberConfig {
  platform_code: string
  metric_code: string
  amount_type: string
  attribution_window_hours: number | null
  attribution_type: string
  is_default: boolean
  display_note: string
}

export interface AmountTypeMeta {
  code: string
  name: string
  description: string
  is_comparable: boolean
}

export interface CaliberInfo {
  platformCode: string
  amountType: string
  amountTypeName: string
  attributionWindowHours: number | null
  attributionType: string
  displayNote: string
  isComparable: boolean
}

/** 读取全部口径配置 */
export async function listCaliberConfig(
  pool?: DbExecutor,
): Promise<Array<CaliberConfig & { amount_type_name: string; is_comparable: boolean }>> {
  const p = pool || getPool()
  const { rows } = await p.query(`
    SELECT c.platform_code, c.metric_code, c.amount_type,
           c.attribution_window_hours, c.attribution_type,
           c.is_default, c.display_note,
           COALESCE(d.name, c.amount_type) AS amount_type_name,
           COALESCE(d.is_comparable, true) AS is_comparable
      FROM platform_caliber_config c
      LEFT JOIN amount_type_dict d ON d.code = c.amount_type
     ORDER BY c.platform_code, c.metric_code, c.is_default DESC
  `)
  return rows
}

/** 读取某平台某指标的默认口径 */
export async function getDefaultCaliber(
  platformCode: string,
  metricCode = 'gmv',
  pool?: DbExecutor,
): Promise<CaliberInfo | null> {
  const p = pool || getPool()
  const { rows } = await p.query(`
    SELECT c.platform_code, c.amount_type,
           COALESCE(d.name, c.amount_type) AS amount_type_name,
           c.attribution_window_hours, c.attribution_type, c.display_note,
           COALESCE(d.is_comparable, true) AS is_comparable
      FROM platform_caliber_config c
      LEFT JOIN amount_type_dict d ON d.code = c.amount_type
     WHERE c.platform_code = $1 AND c.metric_code = $2
     ORDER BY c.is_default DESC, c.id
     LIMIT 1
  `, [platformCode, metricCode])

  if (rows.length === 0) return null
  const r = rows[0]
  return {
    platformCode: r.platform_code,
    amountType: r.amount_type,
    amountTypeName: r.amount_type_name,
    attributionWindowHours: r.attribution_window_hours,
    attributionType: r.attribution_type,
    displayNote: r.display_note,
    isComparable: r.is_comparable,
  }
}

/** 读取指定口径的详情 */
export async function getCaliberByType(
  platformCode: string,
  amountType: string,
  metricCode = 'gmv',
  pool?: DbExecutor,
): Promise<CaliberInfo | null> {
  const p = pool || getPool()
  const { rows } = await p.query(`
    SELECT c.platform_code, c.amount_type,
           COALESCE(d.name, c.amount_type) AS amount_type_name,
           c.attribution_window_hours, c.attribution_type, c.display_note,
           COALESCE(d.is_comparable, true) AS is_comparable
      FROM platform_caliber_config c
      LEFT JOIN amount_type_dict d ON d.code = c.amount_type
     WHERE c.platform_code = $1 AND c.metric_code = $2 AND c.amount_type = $3
     LIMIT 1
  `, [platformCode, metricCode, amountType])

  if (rows.length === 0) return null
  const r = rows[0]
  return {
    platformCode: r.platform_code,
    amountType: r.amount_type,
    amountTypeName: r.amount_type_name,
    attributionWindowHours: r.attribution_window_hours,
    attributionType: r.attribution_type,
    displayNote: r.display_note,
    isComparable: r.is_comparable,
  }
}

export interface ComparabilityResult {
  comparable: boolean
  reason?: string
  /** 各平台实际使用的口径 */
  platforms: Array<{ platformCode: string; amountType: string; amountTypeName: string; displayNote: string }>
  /** 建议：如果不可比，建议按什么口径对齐 */
  suggestion?: string
}

/**
 * 校验多平台口径是否可比。
 * 跨平台对比前必须调用，不可比时前端要明确提示而非静默混合。
 */
export async function checkComparability(
  platformCodes: string[],
  metricCode = 'gmv',
  pool?: DbExecutor,
): Promise<ComparabilityResult> {
  const p = pool || getPool()

  const infos: ComparabilityResult['platforms'] = []
  for (const code of platformCodes) {
    const info = await getDefaultCaliber(code, metricCode, p)
    if (info) {
      infos.push({
        platformCode: info.platformCode,
        amountType: info.amountType,
        amountTypeName: info.amountTypeName,
        displayNote: info.displayNote,
      })
    }
  }

  if (infos.length === 0) {
    return { comparable: false, reason: '未配置任何平台口径', platforms: [] }
  }
  if (infos.length === 1) {
    return { comparable: true, platforms: infos }
  }

  // 口径去重
  const types = new Set(infos.map((i) => i.amountType))
  if (types.size === 1) {
    return { comparable: true, platforms: infos }
  }

  // 口径不同 → 检查是否都可比（is_comparable 全 true 才算「可横向看」）
  const metas = await p.query(
    `SELECT code, name, is_comparable FROM amount_type_dict WHERE code = ANY($1::text[])`,
    [Array.from(types)],
  )
  const allComparable = metas.rows.every((m: any) => m.is_comparable)

  const typeNames = metas.rows.map((m: any) => `${m.name}(${m.code})`).join(' / ')

  if (allComparable) {
    return {
      comparable: true,
      reason: `各平台口径不同（${typeNames}），但都属于可横向对比口径。仍需在页面标注各平台具体口径。`,
      platforms: infos,
    }
  }

  // 找出不可比的口径
  const incomparable = metas.rows.filter((m: any) => !m.is_comparable).map((m: any) => m.name)

  return {
    comparable: false,
    reason: `存在不可横向对比的口径：${incomparable.join('、')}。直接加总会产生错误结论。`,
    platforms: infos,
    suggestion: buildSuggestion(metas.rows),
  }
}

/** 根据涉及的口径给出对齐建议 */
function buildSuggestion(metas: Array<{ code: string; name: string }>): string {
  const codes = new Set(metas.map((m) => m.code))

  if (codes.has('offline_cod_included') && codes.has('gross_paid')) {
    return '京东含货到付款，与其他平台支付口径不同。建议：京东单独展示并标注「含 COD」，或改用京东的 gross_paid（仅在线支付）口径后再对比。'
  }
  if (codes.has('indirect_included') && codes.has('gross_paid')) {
    return '快手含间接成交，GMV 天然高于其他平台的直接成交口径。建议：改用快手的 net_settled（净成交）口径，或对比时明确说明快手数值含间接成交。'
  }
  if (codes.has('supply_amount')) {
    return '京东自营为供货金额（采销额），与零售成交额不是同一量级。建议：自营与 POP 分开看，不做 GMV 加总。'
  }
  if (codes.has('onsite') && codes.has('offsite')) {
    return '小红书站内外成交需分开统计。建议：先按站内口径对齐，站外单独列出。'
  }
  if (codes.has('gross_settled') || codes.has('net_settled')) {
    return '存在结算/净成交口径，与支付口径不可直接比。建议：统一到同一 amount_type 后再对比。'
  }
  return '建议按同一 amount_type 重新取数后再做跨平台对比。'
}

/** 口径字典（供前端展示解释） */
export async function listAmountTypes(pool?: DbExecutor): Promise<AmountTypeMeta[]> {
  const p = pool || getPool()
  const { rows } = await p.query(
    `SELECT code, name, description, is_comparable FROM amount_type_dict ORDER BY code`,
  )
  return rows
}
