/**
 * ai/contract/plan.ts — 规划器输出强类型契约 (PlanSchema)
 * 
 * 对齐 Plan §6.3 ①：
 *   不论是 LLM 还是规则规划器，均必须产出符合 PlanSchema 的结构化规划对象。
 */

import { z } from 'zod'

export const IntentSchema = z.enum([
  'query',       // S1 问数
  'compare',     // S2 环比/对比
  'attribute',   // S3 归因剖析
  'anomaly',     // S4 异常探测
  'forecast',    // S5 趋势外推
  'review',      // S6 场次/周期综合复盘
])

export type IntentType = z.infer<typeof IntentSchema>

export const ToolCallSchema = z.object({
  tool: z.enum([
    'query_metric',
    'compare_periods',
    'drill_down',
    'detect_anomalies',
    'forecast_trend',
  ]),
  args: z.record(z.string(), z.unknown()),
  purpose: z.string(), // 用户可见："正在按平台拉取 GMV"
})

export type ToolCallPlan = z.infer<typeof ToolCallSchema>

export const PlanSchema = z.object({
  intent: IntentSchema,
  question_rewrite: z.string(), // 归一化问题，供后续评测与记忆
  resolved: z.object({
    metrics: z.array(z.string()),        // 必须为注册表中有效 code
    dimensions: z.array(z.string()),     // 维度（platform, channel, date, shop_id...）
    unresolved_terms: z.array(z.string()).default([]), // 无法解析的词，触发澄清
  }),
  time_range: z.object({
    from: z.string(), // YYYY-MM-DD
    to: z.string(),   // YYYY-MM-DD
  }),
  needs_clarification: z.boolean().default(false),
  clarification_prompt: z.string().optional(),
  calls: z.array(ToolCallSchema).min(1).max(5),
  engine: z.enum(['llm', 'rule']),
})

export type Plan = z.infer<typeof PlanSchema>
