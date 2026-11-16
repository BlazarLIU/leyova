/**
 * ai/contract/trace.ts — 全链路追踪与观测契约 (对齐 OTel GenAI semconv)
 * 
 * 对齐 Plan §6.3 ⑥：
 *   字段命名完全契合 OpenTelemetry GenAI 规范，保证后续无论接入 Langfuse 还是 OTel Collector 均零阻抗。
 */

import { z } from 'zod'

export const LlmCallTraceSchema = z.object({
  run_id: z.string(),
  step_seq: z.number().default(1),
  operation_name: z.string(), // e.g., 'plan_generation', 'claim_synthesis'
  request_model: z.string(),  // gen_ai.request.model
  input_tokens: z.number().default(0),  // gen_ai.usage.input_tokens
  output_tokens: z.number().default(0), // gen_ai.usage.output_tokens
  cost_cny: z.number().default(0),
  latency_ms: z.number().default(0),
  finish_reason: z.string().default('stop'),
  error_code: z.string().optional(),
})

export type LlmCallTrace = z.infer<typeof LlmCallTraceSchema>

export const StepTraceSchema = z.object({
  run_id: z.string(),
  seq: z.number(),
  role: z.enum(['planner', 'executor', 'critic', 'reporter']),
  tool: z.string().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  output_ref: z.record(z.string(), z.unknown()).default({}),
  row_count: z.number().default(0),
  duration_ms: z.number().default(0),
  status: z.enum(['success', 'failed']),
  error: z.string().optional(),
})

export type StepTrace = z.infer<typeof StepTraceSchema>

export const RunTraceSchema = z.object({
  id: z.string(),
  tenant_id: z.number().nullable().optional(),
  conversation_id: z.string().nullable().optional(),
  question: z.string(),
  engine: z.enum(['rule', 'llm']),
  prompt_version: z.string().default('v2.0'),
  plan: z.record(z.string(), z.unknown()),
  status: z.enum(['completed', 'failed']),
  verdict: z.enum(['verified', 'rejected', 'insufficient']),
  rejection_reason: z.string().optional(),
  duration_ms: z.number().default(0),
  cost_cny: z.number().default(0),
})

export type RunTrace = z.infer<typeof RunTraceSchema>
