/**
 * insight-utils.ts — 平台专属洞察共用工具（P2-1 从 routes/platform-dedicated.ts 抽出）
 */

/** 默认查询近 N 天 */
export function insightRange(q: { from?: string; to?: string }, defaultDays = 30) {
  const to = q.to || new Date().toISOString().slice(0, 10)
  const from = q.from || new Date(Date.now() - defaultDays * 86400_000).toISOString().slice(0, 10)
  return { from, to }
}

/** 安全数值化 */
export const num = (v: unknown) => Number(v ?? 0)

/** 取日期部分（兼容 string / Date） */
export const ym = (v: unknown) => {
  if (!v) return ''
  return typeof v === 'string' ? v.slice(0, 10) : new Date(v as string).toISOString().slice(0, 10)
}

/** 洞察页统一返回结构（前端通用渲染器承载） */
export type Align = 'left' | 'right' | 'center'
export interface Column { key: string; label: string; align?: Align }
export interface Kpi { label: string; value: string | number; hint?: string; accent?: 'primary' | 'success' | 'warn' | 'danger' }
export interface TableBlock { title: string; columns: Column[]; rows: Record<string, unknown>[]; emptyText?: string }

/** 旧名兼容（原 platform-dedicated.ts 内部使用 range） */
export const range = insightRange
