/**
 * ai/contract/claim.ts — 结论与断言结构化契约 (ClaimPacketSchema)
 * 
 * 对齐 Plan §6.3 ③：
 *   Reporter 输出结构化断言集，每个断言显式绑定证据引用，禁止输出无法溯源的裸数字。
 */

import { z } from 'zod'

export const ClaimItemKindSchema = z.enum(['fact', 'derived', 'judgement'])
export type ClaimItemKind = z.infer<typeof ClaimItemKindSchema>

export const ClaimItemSchema = z.object({
  id: z.string().optional(),
  text: z.string(), // 可包含 {e1} 占位符或已渲染文本
  evidence_ids: z.array(z.string()).default([]),
  kind: ClaimItemKindSchema,
})

export type ClaimItem = z.infer<typeof ClaimItemSchema>

export const ClaimPacketSchema = z.object({
  headline: z.string(),
  claims: z.array(ClaimItemSchema),
  risks: z.array(z.string()).default([]),
  actions: z.array(z.string()).default([]),
  caveats: z.array(z.string()).default([]), // 守卫提示：如“历史样本不足7天”、“预测值触发零点拦截”
  engine: z.enum(['llm', 'rule']).default('rule'),
  verdict: z.enum(['verified', 'rejected', 'insufficient']).default('verified'),
  rejection_reason: z.string().optional(),
})

export type ClaimPacket = z.infer<typeof ClaimPacketSchema>
