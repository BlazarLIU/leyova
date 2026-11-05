import { z } from 'zod'
import type { ToolDefinition, ToolContext } from './types.js'
import { query } from './db.js'

const registry = new Map<string, ToolDefinition>()

export function registerTool<S extends z.ZodTypeAny>(tool: ToolDefinition<S>): void {
  registry.set(tool.name, tool as unknown as ToolDefinition)
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name)
}

export function listTools(): ToolDefinition[] {
  return Array.from(registry.values())
}

export function getToolSchemas(): Array<{
  type: 'function'
  function: { name: string; description: string; parameters: unknown }
}> {
  return listTools()
    .filter((t) => t.riskLevel !== 'forbidden')
    .map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.inputSchema),
      },
    }))
}

export async function executeTool(
  name: string,
  rawParams: unknown,
  ctx: ToolContext
): Promise<{ ok: boolean; result?: unknown; error?: string; toolLogId?: number }> {
  const tool = getTool(name)
  if (!tool) {
    await logToolCall(ctx, name, rawParams, null, 'rejected', `Unknown tool: ${name}`)
    return { ok: false, error: `Unknown tool: ${name}` }
  }
  if (tool.riskLevel === 'forbidden') {
    await logToolCall(ctx, name, rawParams, null, 'rejected', `Tool ${name} is forbidden`)
    return { ok: false, error: `Tool ${name} is forbidden` }
  }

  const parsed = tool.inputSchema.safeParse(rawParams)
  if (!parsed.success) {
    await logToolCall(ctx, name, rawParams, null, 'failed', `Invalid params: ${parsed.error.message}`)
    return { ok: false, error: `Invalid params: ${parsed.error.message}` }
  }

  if (tool.riskLevel === 'write_with_approval') {
    const toolLogId = await logToolCall(
      ctx, name, parsed.data, null, 'success',
      'Pending user approval', 'pending'
    )
    if (toolLogId) {
      await query(
        `INSERT INTO ai_action_approvals
           (tool_log_id, requested_by, status, expires_at)
         VALUES ($1, $2, 'pending', NOW() + INTERVAL '24 hours')`,
        [toolLogId, ctx.userId]
      )
    }
    return {
      ok: true,
      result: {
        pending_approval: true,
        toolLogId,
        message: 'Write operation requires user confirmation.',
      },
      toolLogId,
    }
  }

  try {
    const result = await tool.execute(parsed.data, ctx)
    await logToolCall(ctx, name, parsed.data, result, 'success')
    return { ok: true, result }
  } catch (err) {
    const errorMsg = (err as Error).message
    await logToolCall(ctx, name, parsed.data, null, 'failed', errorMsg)
    return { ok: false, error: errorMsg }
  }
}

async function logToolCall(
  ctx: ToolContext,
  toolName: string,
  inputParams: unknown,
  result: unknown,
  status: 'success' | 'failed' | 'rejected' | 'timeout',
  errorMsg?: string,
  approvalStatus: 'auto' | 'pending' | 'approved' | 'rejected' | 'expired' = 'auto'
): Promise<number | undefined> {
  try {
    const resultSummary = result
      ? JSON.stringify(result).slice(0, 500)
      : errorMsg || ''
    const { rows } = await query(
      `INSERT INTO ai_tool_logs
         (actor_user_id, scope_type, scope_id,
          tool_name, risk_level, input_payload, result_summary,
          approval_status, status, error_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        ctx.userId,
        ctx.scopeType,
        ctx.scopeId,
        toolName,
        getTool(toolName)?.riskLevel || 'read_only',
        JSON.stringify(inputParams || {}),
        resultSummary,
        approvalStatus,
        status,
        errorMsg || null,
      ]
    )
    return rows[0]?.id
  } catch {
    return undefined
  }
}

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = (schema as any)._def

  if (def?.typeName === 'ZodObject') {
    const shape = def.shape()
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const [key, val] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(val as z.ZodTypeAny)
      if (!(val as any).isOptional()) required.push(key)
    }
    return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) }
  }
  if (def?.typeName === 'ZodString') return { type: 'string' }
  if (def?.typeName === 'ZodNumber') return { type: 'number' }
  if (def?.typeName === 'ZodOptional' || def?.typeName === 'ZodNullable')
    return zodToJsonSchema(def.innerType)
  if (def?.typeName === 'ZodArray') return { type: 'array', items: zodToJsonSchema(def.type) }
  if (def?.typeName === 'ZodEnum') return { type: 'string', enum: def.values }
  if (def?.typeName === 'ZodDefault') return zodToJsonSchema(def.innerType)
  return {}
}
