/**
 * yon MCP Server — Streamable HTTP MCP Server（供 DeerFlow 调用）
 *
 * 将 yon 的业务工具（tool-registry 已注册）与共享上下文工具
 * （search_memory / write_memory / search_knowledge）暴露为 MCP 工具。
 *
 * - 业务工具：复用 executeTool()，风险分级 / ai_tool_logs 审计 / 写审批流不变
 * - 共享上下文工具：仅在本 MCP Server 注册，不进入主 registry
 *   （保证 OpenClaw 兜底路径不变，仍由 ai-gateway 请求前检索注入）
 * - 身份映射：Bearer token 鉴权（YON_MCP_TOKEN），按 X-Yon-User-Id 头
 *   映射 yon 用户（DeerFlow 不转发每请求用户身份，headers 为静态配置），
 *   缺省走 YON_MCP_DEFAULT_USER_ID
 *
 * 路由：POST /mcp（JSON-RPC）、GET /mcp（SSE standalone）
 * 模式：无状态（每个 HTTP 请求创建独立 McpServer+transport，DeerFlow
 *   每次工具发现/会话都会重新 initialize；避免单例 Protocol 仅可
 *   初始化一次的 400/500 问题）
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { env } from '../config/env.js'
import { getPool } from '../lib/db.js'
import { listTools, executeTool, type ToolContext } from './tool-registry.js'
import type { AiScopeContext } from '../lib/ai-gateway.js'
import { searchMemory, writeMemory } from '../lib/openviking-client.js'
import { searchKnowledge } from '../lib/anythingllm-client.js'
import { sendError } from '../lib/http.js'

// ---------------------------------------------------------------------------
// Shared-context tools (NOT registered into the main tool registry —
// they exist only for the MCP path; OpenClaw fallback path stays unchanged)
// ---------------------------------------------------------------------------

interface SharedToolDef {
  name: string
  description: string
  inputSchema: z.ZodObject<Record<string, z.ZodTypeAny>>
  execute: (params: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

const SHARED_TOOLS: SharedToolDef[] = [
  {
    name: 'search_memory',
    description:
      '检索历史记忆/上下文（OpenViking 共享数据源，与 OpenClaw 兜底路径同一份数据）。历史经验优先来自这里。',
    inputSchema: z.object({ query: z.string() }),
    execute: async (params, ctx) => {
      const text = await searchMemory(String(params.query ?? ''), ctx.scope)
      return text ?? '（未检索到相关历史记忆）'
    },
  },
  {
    name: 'write_memory',
    description:
      '把一段内容沉淀到历史记忆（OpenViking，异步追加、幂等）。对话中的关键决策/偏好/事件可写入。',
    inputSchema: z.object({
      content: z.string(),
      category: z.string().optional(),
    }),
    execute: async (params, ctx) => {
      await writeMemory(
        String(params.content),
        ctx.scope,
        params.category ? String(params.category) : 'events'
      )
      return { ok: true, message: '记忆已沉淀' }
    },
  },
  {
    name: 'search_knowledge',
    description:
      '检索企业知识库（AnythingLLM 共享数据源）。所有策略优先来自知识库。',
    inputSchema: z.object({
      query: z.string(),
      workspace: z.string().optional(),
    }),
    execute: async (params, ctx) => {
      const text = await searchKnowledge(
        String(params.query ?? ''),
        params.workspace ? String(params.workspace) : ctx.scope.anythingllmWorkspace
      )
      return text ?? '（知识库未检索到相关内容）'
    },
  },
]

// Per-session identity: sessionId -> yon userId (set at request time)
const sessionUserIds = new Map<string, number>()

// 无状态模式下的请求级身份：每个 HTTP 请求从 X-Yon-User-Id 头解析出
// userId 后用 AsyncLocalStorage 沿请求链路传给工具回调（DeerFlow 无
// mcp-session-id 时 sessionUserIds 永远为空，静态头此前根本不生效）。
const requestUserIdStore = new AsyncLocalStorage<number>()

// Tool handler extra: only sessionId（避免深层类型导入）
interface ToolExtra {
  sessionId?: string
}

// ---------------------------------------------------------------------------
// Auth / identity
// ---------------------------------------------------------------------------

async function mcpAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = request.headers.authorization || ''
  if (!auth.startsWith('Bearer ') || auth.slice(7).trim() !== env.YON_MCP_TOKEN) {
    sendError(reply, 401, 'Unauthorized')
    return
  }
  const rawId = request.headers['x-yon-user-id']
  const userId = rawId ? Number(rawId) : env.YON_MCP_DEFAULT_USER_ID
  if (Number.isInteger(userId) && userId > 0) {
    const sessionId = request.headers['mcp-session-id']
    if (sessionId) sessionUserIds.set(String(sessionId), userId)
  }
}

function resolveUserId(extra?: ToolExtra): number {
  // 无状态模式下请求级身份优先（每个 HTTP 请求从 X-Yon-User-Id 头解析，
  // 经 AsyncLocalStorage 沿请求链路传入——这是 DeerFlow 动态身份的主路径）
  const requestUserId = requestUserIdStore.getStore()
  if (requestUserId) return requestUserId
  const sessionId = extra?.sessionId
  if (sessionId) {
    const mapped = sessionUserIds.get(sessionId)
    if (mapped) return mapped
  }
  return env.YON_MCP_DEFAULT_USER_ID
}

async function buildToolContext(userId: number): Promise<ToolContext> {
  const pool = getPool()
  const { rows: userRows } = await pool.query<{ id: number; username: string; role: string }>(
    `SELECT u.id, u.username, u.role
     FROM users u
     WHERE u.id = $1 AND u.status = 1
     LIMIT 1`,
    [userId]
  )
  const user = userRows[0]
  if (!user) throw new Error(`未知的 yon 用户: ${userId}`)

  const { rows: bindings } = (await pool
    .query<Record<string, string | null>>(
      `SELECT openviking_account, openviking_user, anythingllm_workspace,
              knowledge_role_workspace, knowledge_public_workspace
       FROM ai_context_bindings
       WHERE user_id = $1 AND scope_type = 'user' AND scope_id = $2
       LIMIT 1`,
      [userId, `user:${userId}`]
    )
    .catch(() => ({ rows: [] as Array<Record<string, string | null>> })))

  const scope: AiScopeContext = {
    userId,
    username: user.username,
    role: user.role,
    scopeType: 'user',
    scopeId: `user:${userId}`,
    roomScope: [],
    openvikingAccount: bindings[0]?.openviking_account || 'yon',
    openvikingUser: bindings[0]?.openviking_user || `yon_${userId}`,
    anythingllmWorkspace: bindings[0]?.anythingllm_workspace || 'yon-knowledge',
    knowledgeRoleWorkspace: bindings[0]?.knowledge_role_workspace || undefined,
    knowledgePublicWorkspace: bindings[0]?.knowledge_public_workspace || undefined,
  }

  return { userId, role: user.role, scope, pool }
}

// ---------------------------------------------------------------------------
// Tool call handlers
// ---------------------------------------------------------------------------

function toolResult(text: string, isError?: boolean) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError: true } : {}) }
}

async function callBusinessTool(
  name: string,
  args: Record<string, unknown>,
  extra?: ToolExtra
) {
  const userId = resolveUserId(extra)
  const ctx = await buildToolContext(userId)
  const result = await executeTool(name, args, ctx)
  if (!result.ok) {
    return toolResult(result.error || `工具 ${name} 执行失败`, true)
  }
  if (result.result === null || result.result === undefined) {
    return toolResult(`（${name} 未返回数据）`)
  }
  return toolResult(typeof result.result === 'string' ? result.result : JSON.stringify(result.result))
}

async function callSharedTool(
  name: string,
  args: Record<string, unknown>,
  extra?: ToolExtra
) {
  const def = SHARED_TOOLS.find((t) => t.name === name)
  if (!def) return toolResult(`未知工具: ${name}`, true)

  const userId = resolveUserId(extra)
  const ctx = await buildToolContext(userId)

  const parsed = def.inputSchema.safeParse(args)
  if (!parsed.success) {
    await logSharedToolCall(ctx, name, args, null, 'failed', parsed.error.message)
    return toolResult(`无效参数: ${parsed.error.message}`, true)
  }

  try {
    const result = await def.execute(parsed.data as Record<string, unknown>, ctx)
    await logSharedToolCall(ctx, name, args, result, 'success')
    if (result === null || result === undefined) {
      return toolResult(`（${name} 未返回数据）`)
    }
    return toolResult(typeof result === 'string' ? result : JSON.stringify(result))
  } catch (err) {
    const message = (err as Error).message
    await logSharedToolCall(ctx, name, args, null, 'failed', message)
    return toolResult(message, true)
  }
}

async function logSharedToolCall(
  ctx: ToolContext,
  toolName: string,
  inputParams: unknown,
  result: unknown,
  status: 'success' | 'failed',
  errorMsg?: string
): Promise<void> {
  try {
    const resultSummary = result
      ? JSON.stringify(result).slice(0, 500)
      : errorMsg || ''
    await ctx.pool.query(
      `INSERT INTO ai_tool_logs
         (actor_user_id, scope_type, scope_id,
          tool_name, risk_level, input_payload, result_summary,
          approval_status, status, error_code)
       VALUES ($1, $2, $3, $4, 'read_only', $5, $6, 'auto', $7, $8)`,
      [
        ctx.userId,
        ctx.scope.scopeType,
        ctx.scope.scopeId,
        toolName,
        JSON.stringify(inputParams || {}),
        resultSummary,
        status,
        errorMsg || null,
      ]
    )
  } catch {
    // ai_tool_logs 表可能不存在，静默跳过
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

// 每次请求创建独立 McpServer + transport（无状态模式）：
// DeerFlow 每次工具发现/会话都会重新 POST initialize，若复用单例
// McpServer/transport，Protocol 层的初始化状态只允许一次，后续请求会
// 500/400。无状态下每个 HTTP 请求独立地 initialize→list→call，
// 身份仍由静态头 X-Yon-User-Id 映射（缺省 YON_MCP_DEFAULT_USER_ID）。
function createMcpServer(): McpServer {
  const mcpServer = new McpServer({ name: 'yon-mcp', version: '1.0.0' })

  for (const tool of listTools().filter((t) => t.riskLevel !== 'forbidden')) {
    mcpServer.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as z.ZodObject<Record<string, z.ZodTypeAny>>,
      },
      (args, extra) => callBusinessTool(tool.name, args as Record<string, unknown>, extra)
    )
  }

  for (const tool of SHARED_TOOLS) {
    mcpServer.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      (args, extra) => callSharedTool(tool.name, args as Record<string, unknown>, extra)
    )
  }

  return mcpServer
}

export async function registerMcpRoutes(app: FastifyInstance): Promise<void> {
  app.route({
    method: ['GET', 'POST'],
    url: '/mcp',
    preHandler: mcpAuth,
    handler: async (request, reply) => {
      reply.hijack()
      // 无状态模式下直接从请求头解析 yon 用户（缺省 DEFAULT），
      // 经 AsyncLocalStorage 沿本请求链路传给工具回调 → 动态身份生效
      const rawId = request.headers['x-yon-user-id']
      const headerUserId =
        rawId !== undefined && rawId !== '' ? Number(rawId) : env.YON_MCP_DEFAULT_USER_ID
      const requestUserId = Number.isInteger(headerUserId) && headerUserId > 0 ? headerUserId : env.YON_MCP_DEFAULT_USER_ID
      try {
        const mcpServer = createMcpServer()
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        })
        await mcpServer.connect(transport)
        const body = request.body === undefined ? undefined : request.body
        await requestUserIdStore.run(requestUserId, () =>
          transport.handleRequest(request.raw, reply.raw, body)
        )
      } catch (err) {
        console.error('[mcp] handleRequest error:', err)
        if (!reply.raw.headersSent) {
          reply.raw.statusCode = 500
          reply.raw.end('MCP handler error')
        }
      }
    },
  })
}