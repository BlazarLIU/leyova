/**
 * ai/contract/evidence.ts — 执行器产出证据包契约 (EvidenceSchema)
 * 
 * 对齐 Plan §6.3 ②：
 *   执行器计算出来的每个数字必须登记为证据，支持严格血缘 (parents[] 回溯) 与 SQL 快照
 */

import { z } from 'zod'

export const EvidenceKindSchema = z.enum(['fact', 'derived', 'model_param'])
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>

export const EvidenceItemSchema = z.object({
  id: z.string(), // e1, e2...
  kind: EvidenceKindSchema,
  metric: z.string(),
  label: z.string(),
  unit: z.string().default(''),
  value: z.number(),
  scope: z.string().default('all'),
  time_range: z.string().default(''),
  parents: z.array(z.string()).default([]), // 派生值必须顺着链回到事实（如 diff 依赖 base 与 compare）
  sql_snapshot: z.string().optional(),     // 取数 SQL，供前端“点开看证明”
  insufficient: z.boolean().default(false), // 样本不足或触底守卫标记
  clamp_flag: z.string().optional(),        // 如 'bottom_clamped_to_zero'
})

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>

export interface RawEvidenceInput {
  kind: EvidenceKind
  metric: string
  label: string
  unit?: string
  value: number
  scope?: string
  time_range?: string
  parents?: string[]
  sql_snapshot?: string
  insufficient?: boolean
  clamp_flag?: string
}

export interface EvidencePacket {
  items: EvidenceItem[]
  byId: Map<string, EvidenceItem>
  add: (item: RawEvidenceInput) => EvidenceItem
}

export function createEvidencePacket(): EvidencePacket {
  const items: EvidenceItem[] = []
  const byId = new Map<string, EvidenceItem>()
  let counter = 0

  return {
    items,
    byId,
    add(raw: RawEvidenceInput) {
      counter += 1
      const id = `e${counter}`
      const item: EvidenceItem = {
        id,
        kind: raw.kind,
        metric: raw.metric,
        label: raw.label,
        unit: raw.unit || '',
        value: Number(raw.value),
        scope: raw.scope || 'all',
        time_range: raw.time_range || '',
        parents: raw.parents || [],
        sql_snapshot: raw.sql_snapshot,
        insufficient: Boolean(raw.insufficient),
        clamp_flag: raw.clamp_flag,
      }
      items.push(item)
      byId.set(id, item)
      return item
    },
  }
}
