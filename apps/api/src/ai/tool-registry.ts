/**
 * MCP Tool Registry
 *
 * Central registry for all tools that OpenClaw can call.
 * Each tool declares:
 * - name, description
 * - input schema (Zod)
 * - risk level
 * - required permission
 * - execute function (receives validated params + context)
 *
 * Tools are registered here and exposed to the AI Gateway,
 * which passes their schemas to OpenClaw as function definitions.
 */

import { z } from 'zod'
import { getPool } from '../lib/db.js'
import { requireTenantId } from '../lib/tenant-context.js'
import type { AiScopeContext } from '../lib/ai-types.js'
import { resolveToolPolicy } from './policy.js'
import { createApproval } from './approvals.js'
import { computePayloadDigest, stableStringify } from './payload-digest.js'

export { computePayloadDigest, stableStringify }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskLevel = 'read_only' | 'write_with_approval' | 'admin_only' | 'forbidden'

export interface ToolContext {
  userId: number
  role: string
  scope: AiScopeContext
  pool: ReturnType<typeof getPool>
  /** 当前用户的租户（缺失时工具必须 fail-closed，不允许回退默认租户） */
  tenantId: number | null
}

export interface ToolDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  inputSchema: S
  riskLevel: RiskLevel
  requiredPermission?: string
  execute: (params: z.infer<S>, ctx: ToolContext) => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

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

export function getToolSchemasForOpenClaw(): Array<{
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

export interface ExecuteToolOptions {
  /** 审批已通过：跳过 pending 分支，直接执行写操作 */
  approved?: boolean
  /** 复用原 pending 日志行回写执行结果，避免重复插入 */
  toolLogId?: number
  /** 租户上下文：用于解析 Policy 与创建审批记录 */
  tenantId?: number
}

/**
 * 工具级权限校验（fail-closed）。
 * requiredPermission 支持两种写法：
 * - `module:<code>`：要求角色拥有该模块授权（读 sys_role_permission 的 module: 资源）
 * - `<resource>:<action>`：精确匹配资源与动作，`*` 通配
 */
async function hasToolPermission(ctx: ToolContext, permission: string): Promise<boolean> {
  if (ctx.role === 'super_admin') return true

  if (permission.startsWith('module:')) {
    const moduleCode = permission.slice('module:'.length)
    if (!moduleCode) return false
    const { rows } = await ctx.pool.query(
      `SELECT 1 FROM public.sys_role_permission
        WHERE role_code = $1 AND effect = 'allow' AND resource = $2
        LIMIT 1`,
      [ctx.role, `module:${moduleCode}`]
    )
    return rows.length > 0
  }

  const idx = permission.lastIndexOf(':')
  const resource = idx > 0 ? permission.slice(0, idx) : permission
  const action = idx > 0 ? permission.slice(idx + 1) : '*'
  const { rows } = await ctx.pool.query(
    `SELECT 1 FROM public.sys_role_permission
      WHERE role_code = $1 AND effect = 'allow'
        AND (resource = $2 OR resource = '*')
        AND (action = $3 OR action = '*')
      LIMIT 1`,
    [ctx.role, resource, action]
  )
  return rows.length > 0
}

export async function executeTool(
  name: string,
  rawParams: unknown,
  ctx: ToolContext,
  options: ExecuteToolOptions = {}
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
  if (tool.riskLevel === 'admin_only' && ctx.role !== 'super_admin') {
    await logToolCall(ctx, name, rawParams, null, 'rejected', `Tool ${name} requires admin role`)
    return { ok: false, error: `Tool ${name} requires admin privileges` }
  }
  if (tool.requiredPermission && !(await hasToolPermission(ctx, tool.requiredPermission))) {
    await logToolCall(
      ctx, name, rawParams, null, 'rejected',
      `Missing permission: ${tool.requiredPermission}`
    )
    return { ok: false, error: `Permission denied: ${tool.requiredPermission}` }
  }

  const parsed = tool.inputSchema.safeParse(rawParams)
  if (!parsed.success) {
    await logToolCall(ctx, name, rawParams, null, 'failed', `Invalid params: ${parsed.error.message}`)
    return { ok: false, error: `Invalid params: ${parsed.error.message}` }
  }

  // ── Policy Engine（R0-R4）：在真正执行前决定 自动放行 / 需审批 / 拒绝 ──
  const tenantId = requireTenantId(options.tenantId, 'ai.tool-registry')
  const decision = await resolveToolPolicy(ctx.pool, tenantId, {
    name: tool.name,
    riskLevel: tool.riskLevel,
  })
  if (decision.effect === 'deny') {
    await logToolCall(ctx, name, parsed.data, null, 'rejected', decision.reason)
    return { ok: false, error: `Policy denied: ${decision.reason}` }
  }
  if (decision.requiredPermission && !(await hasToolPermission(ctx, decision.requiredPermission))) {
    await logToolCall(
      ctx, name, parsed.data, null, 'rejected',
      `Missing policy permission: ${decision.requiredPermission}`
    )
    return { ok: false, error: `Permission denied: ${decision.requiredPermission}` }
  }

  // R2/R3 写操作：未获批准时只落 pending 审批；批准后（options.approved）
  // 直接进入真正的执行分支，避免「批准 → 再次 pending」死循环。
  // fail-closed：审批记录必须成功落库，否则拒绝本次写操作。
  if (decision.effect === 'require_approval' && !options.approved) {
    const toolLogId = await logToolCall(
      ctx, name, parsed.data, null, 'success',
      'Pending user approval',
      'pending'
    )
    if (!toolLogId) {
      return { ok: false, error: '审批日志写入失败，写操作已拒绝（fail-closed）' }
    }

    const approval = await createApproval(ctx.pool, {
      toolLogId,
      requestedBy: ctx.userId,
      payload: parsed.data,
      tenantId,
      riskTier: decision.tier,
      reason: decision.reason,
    })
    if (!approval) {
      await ctx.pool
        .query(
          `UPDATE ai_tool_logs
             SET approval_status = 'failed', status = 'failed',
                 error_code = 'APPROVAL_CREATE_FAILED'
           WHERE id = $1`,
          [toolLogId]
        )
        .catch(() => undefined)
      return { ok: false, error: '审批记录创建失败，写操作已拒绝（fail-closed）' }
    }

    return {
      ok: true,
      result: {
        pending_approval: true,
        toolLogId,
        approvalId: approval.publicId,
        expiresAt: approval.expiresAt,
        riskTier: decision.tier,
        message: 'Write operation requires user confirmation. Use /api/v1/ai/approve/:toolLogId to confirm.',
      },
      toolLogId,
    }
  }

  try {
    const result = await tool.execute(parsed.data, ctx)
    if (options.toolLogId) {
      await updateToolLog(ctx, options.toolLogId, result, 'success')
    } else {
      await logToolCall(ctx, name, parsed.data, result, 'success')
    }
    return { ok: true, result, toolLogId: options.toolLogId }
  } catch (err) {
    const errorMsg = (err as Error).message
    if (options.toolLogId) {
      await updateToolLog(ctx, options.toolLogId, null, 'failed', errorMsg)
    } else {
      await logToolCall(ctx, name, parsed.data, null, 'failed', errorMsg)
    }
    return { ok: false, error: errorMsg, toolLogId: options.toolLogId }
  }
}

// ---------------------------------------------------------------------------
// Audit log writer — writes to ai_tool_logs (silently skips if table missing)
// ---------------------------------------------------------------------------

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

    const { rows } = await ctx.pool.query(
      `INSERT INTO ai_tool_logs
         (actor_user_id, scope_type, scope_id,
          tool_name, risk_level, input_payload, result_summary,
          approval_status, status, error_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        ctx.userId,
        ctx.scope.scopeType,
        ctx.scope.scopeId,
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
  } catch (err) {
    console.warn('[tool-registry] failed to write ai_tool_logs:', (err as Error)?.message || err)
    return undefined
  }
}

/**
 * 审批通过后复用原 pending 日志行回写真实执行结果，
 * 避免同一次写操作产生两条互不关联的 ai_tool_logs。
 */
async function updateToolLog(
  ctx: ToolContext,
  toolLogId: number,
  result: unknown,
  status: 'success' | 'failed',
  errorMsg?: string
): Promise<void> {
  try {
    const resultSummary = result
      ? JSON.stringify(result).slice(0, 500)
      : errorMsg || ''
    await ctx.pool.query(
      `UPDATE ai_tool_logs
       SET status = $2,
           result_summary = $3,
           approval_status = $4,
           error_code = $5
       WHERE id = $1`,
      [toolLogId, status, resultSummary, 'approved', errorMsg || null]
    )
  } catch (err) {
    console.warn('[tool-registry] failed to update ai_tool_logs:', (err as Error)?.message || err)
  }
}

// ---------------------------------------------------------------------------
// Helper: Zod v4 native toJSONSchema
// ---------------------------------------------------------------------------

/**
 * 使用 zod v4 内置的 toJSONSchema 将 Zod schema 转为 JSON Schema。
 * 移除了 v3 时代的手写 shim（访问 _def.typeName）。
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return z.toJSONSchema(schema)
}
