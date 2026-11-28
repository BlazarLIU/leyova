/**
 * routes/assistant.ts — 助手 Run 与 Agent 配置接口
 *
 * 接口面：
 *   POST   /api/v1/assistant/runs                      创建 Run（真流式执行）
 *   GET    /api/v1/assistant/runs/:runId                Run 详情（步骤/证据/事件）
 *   GET    /api/v1/assistant/runs/:runId/events         SSE 事件流（cursor 补发 + 心跳）
 *   POST   /api/v1/assistant/runs/:runId/cancel         取消 Run
 *   GET    /api/v1/assistant/agents                     Agent 配置列表（超管）
 *   PUT    /api/v1/assistant/agents/:agentKey           Agent 配置写入（超管）
 *   DELETE /api/v1/assistant/agents/:agentKey           Agent 配置删除（超管）
 */

import type { FastifyInstance } from 'fastify'
import { tenantIdOf } from '../lib/tenant-context.js'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext, withRlsPool } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { isAdminRole, assertConversationOwnership } from '../lib/ai-access.js'
import {
  createAssistantRun,
  executeAssistantRun,
  enqueueAssistantRun,
  cancelAssistantRun,
  getRunDetail,
} from '../ai/run/engine.js'
import { listRunEvents, subscribeRun, type RunEvent } from '../ai/run/events.js'
import {
  listAgentConfigs,
  upsertAgentConfig,
  deleteAgentConfig,
} from '../ai/run/agent-config.js'
import {
  listVisibleMemories,
  listReviewMemories,
  approveMemory,
  rejectMemory,
  deleteOwnMemory,
  inferPreferenceKey,
  sanitizeMemoryKey,
  sanitizeMemoryText,
  writeMemory,
} from '../ai/run/memory.js'

const TERMINAL_EVENTS = ['run.completed', 'run.failed', 'run.cancelled']

export async function assistantRoutes(app: FastifyInstance) {
  // ── 创建并执行 Run ──
  app.post('/api/v1/assistant/runs', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const body = (request.body || {}) as {
      message?: string
      conversationId?: string
      agentKey?: string
      idempotencyKey?: string
    }
    const message = String(body.message || '').trim()
    if (!message) return sendError(reply, 400, '消息内容不能为空')

    try {
      const outcome = await withRlsPool(request, async (pool) => {
        let convId = body.conversationId
        if (convId && convId !== 'default') {
          const ownership = await assertConversationOwnership(pool, convId, user)
          if (!ownership.ok) return { forbidden: true as const }
        }

        if (!convId || convId === 'default') {
          const { rows } = await pool.query<{ id: number }>(
            `INSERT INTO ai_conversations (user_id, title, model_name, status)
             VALUES ($1, $2, $3, 'active') RETURNING id`,
            [user.id, message.slice(0, 50), 'agentic-bi-v4']
          )
          convId = rows[0]?.id?.toString()
          if (!convId) return { failed: true as const }
        }

        await pool.query(
          `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
          [convId, message]
        )
        await pool.query(`UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`, [convId])

        const created = await createAssistantRun(
          {
            question: message,
            userId: user.id,
            tenantId: tenantIdOf(user),
            conversationId: convId,
            agentKey: body.agentKey || 'business_analyst',
            triggerType: 'chat',
            idempotencyKey: body.idempotencyKey,
          },
          pool
        )

        if (created.created) {
          // 进程内立即执行（低延迟）；同时入队作为崩溃兜底，认领逻辑保证不会重复执行
          void executeAssistantRun(created.runId, pool).catch((err) => {
            request.log.warn({ err, runId: created.runId }, 'assistant run inline execution failed')
          })
          await enqueueAssistantRun(created.runId, pool).catch(() => undefined)
        }

        return {
          runId: created.runId,
          conversationId: convId,
          status: created.status,
          eventsUrl: `/api/v1/assistant/runs/${created.runId}/events`,
        }
      })
      if ('forbidden' in outcome) return sendError(reply, 403, '会话不可访问')
      if ('failed' in outcome) return sendError(reply, 500, '创建会话失败')
      return sendOk(reply, outcome)
    } catch (err) {
      request.log.warn({ err }, 'assistant/runs create failed')
      return sendError(reply, 500, (err as Error)?.message || '创建 Run 失败')
    }
  })

  // ── SSE 事件流：cursor 补发 + 心跳 + 终态关闭 ──
  app.get('/api/v1/assistant/runs/:runId/events', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const { runId } = request.params as { runId: string }
    const query = request.query as { cursor?: string }
    const lastEventId = Number(request.headers['last-event-id'] || 0) || 0
    let cursor = Math.max(Number(query.cursor || 0) || 0, lastEventId)

    const runInfo = await withRlsContext(request, async (client) => {
      const runRes = await client.query<{ user_id: number | null; status: string }>(
        `SELECT user_id, status FROM public.ai_v2_run WHERE id = $1`,
        [runId]
      )
      return runRes.rows[0]
    })
    const run = runInfo
    if (!run) return sendError(reply, 404, 'Run 不存在')
    if (run.user_id && run.user_id !== user.id && !isAdminRole(user.role)) {
      return sendError(reply, 403, '无权查看该 Run')
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    reply.raw.write('retry: 3000\n\n')

    let closed = false
    let replayed = false
    const pending: RunEvent[] = []
    const buffered: RunEvent[] = []

    const writeEvent = (event: RunEvent): void => {
      if (closed) return
      if (event.seq <= cursor) return
      cursor = event.seq
      reply.raw.write(
        `id: ${event.seq}\ndata: ${JSON.stringify({
          ...event.payload,
          runId: event.runId,
          seq: event.seq,
          type: event.type,
        })}\n\n`
      )
    }

    const bufferOrWrite = (event: RunEvent): void => {
      if (!replayed) {
        buffered.push(event)
        return
      }
      writeEvent(event)
      if (TERMINAL_EVENTS.includes(event.type)) {
        setTimeout(() => close(), 30)
      }
    }

    const heartbeat = setInterval(() => {
      if (!closed) reply.raw.write(': ping\n\n')
    }, 15000)

    const unsubscribe = subscribeRun(runId, bufferOrWrite)

    let resolveDone: () => void = () => undefined
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve
    })

    function close(): void {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      unsubscribe()
      try {
        reply.raw.end()
      } catch {
        // ignore
      }
      resolveDone()
    }

    request.raw.on('close', close)
    request.raw.on('error', close)

    try {
      const past = await withRlsContext(request, (client) => listRunEvents(client, runId, cursor))
      for (const event of past) writeEvent(event)
      replayed = true
      for (const event of buffered) bufferOrWrite(event)
      buffered.length = 0
      pending.length = 0

      if (TERMINAL_EVENTS.some((t) => past.some((e) => e.type === t))) {
        setTimeout(close, 30)
      } else if (['succeeded', 'failed', 'cancelled', 'completed'].includes(run.status)) {
        setTimeout(close, 30)
      }
    } catch (err) {
      request.log.warn({ err, runId }, 'assistant run event replay failed')
      close()
      return
    }

    await done
  })

  // ── Run 详情 ──
  app.get('/api/v1/assistant/runs/:runId', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const { runId } = request.params as { runId: string }
    try {
      const detail = await getRunDetail(runId)
      if (!detail) return sendError(reply, 404, 'Run 不存在')
      const ownerId = Number((detail.run as { user_id?: number | null }).user_id || 0)
      if (ownerId && ownerId !== user.id && !isAdminRole(user.role)) {
        return sendError(reply, 403, '无权查看该 Run')
      }
      return sendOk(reply, detail)
    } catch (err) {
      request.log.warn({ err, runId }, 'assistant run detail failed')
      return sendError(reply, 500, '查询 Run 失败')
    }
  })

  // ── 取消 Run ──
  app.post('/api/v1/assistant/runs/:runId/cancel', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const { runId } = request.params as { runId: string }
    try {
      const outcome = await withRlsContext(request, async (client) => {
        const owner = await client.query<{ user_id: number | null }>(
          `SELECT user_id FROM public.ai_v2_run WHERE id = $1`,
          [runId]
        )
        if (!owner.rows[0]) return { notFound: true as const }
        if (owner.rows[0].user_id && owner.rows[0].user_id !== user.id && !isAdminRole(user.role)) {
          return { forbidden: true as const }
        }
        const res = await cancelAssistantRun(runId)
        return { ok: true as const, cancelled: res }
      })
      if ('notFound' in outcome) return sendError(reply, 404, 'Run 不存在')
      if ('forbidden' in outcome) return sendError(reply, 403, '无权取消该 Run')
      return sendOk(reply, { cancelled: outcome.cancelled })
    } catch (err) {
      request.log.warn({ err, runId }, 'assistant run cancel failed')
      return sendError(reply, 500, '取消 Run 失败')
    }
  })

  // ── 记忆：本人可见（个人/会话 + 本角色 + 组织术语） ──
  app.get('/api/v1/assistant/memories', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const query = request.query as { scope?: string; keyword?: string; limit?: string }
    try {
      const items = await withRlsContext(request, async (client) => {
        const roleRes = await client.query<{ role: string }>(
          `SELECT role FROM public.users WHERE id = $1 LIMIT 1`,
          [user.id]
        )
        return listVisibleMemories(client, {
          tenantId: tenantIdOf(user),
          userId: user.id,
          role: roleRes.rows[0]?.role || 'ops_staff',
          scope: query.scope,
          keyword: query.keyword,
          limit: Number(query.limit || 50) || 50,
        })
      })
      return sendOk(reply, { items, total: items.length })
    } catch (err) {
      request.log.warn({ err }, 'assistant memories list failed')
      return sendError(reply, 500, '查询记忆失败')
    }
  })

  // ── 记忆：用户确认写入个人记忆（组织/角色记忆不开放给普通用户写） ──
  app.post('/api/v1/assistant/memories', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const body = (request.body || {}) as {
      memoryKey?: string
      content?: string
      scope?: string
      sourceId?: string
    }
    const scope = body.scope || 'personal'
    if (scope !== 'personal') {
      return sendError(reply, 400, '仅允许写入个人记忆，角色/组织记忆需审核')
    }
    const content = sanitizeMemoryText(body.content)
    if (content.length < 4) return sendError(reply, 400, '记忆内容过短')

    try {
      const memoryKey =
        sanitizeMemoryKey(body.memoryKey) ||
        inferPreferenceKey(content) ||
        'preference:manual'
      const result = await withRlsContext(request, (client) =>
        writeMemory(
          client,
          {
            tenantId: tenantIdOf(user),
            scope: 'personal',
            ownerUserId: user.id,
            memoryKey,
            content,
            confidence: 0.9,
            sourceType: 'user_confirm',
            sourceId: body.sourceId || null,
            status: 'active',
            createdBy: user.id,
          },
          { allowSupersede: true }
        )
      )
      if (result.action === 'rejected') {
        return sendError(reply, 400, result.reason || '写入记忆失败')
      }
      return sendOk(reply, { id: result.id, action: result.action })
    } catch (err) {
      request.log.warn({ err }, 'assistant memories write failed')
      return sendError(reply, 500, '写入记忆失败')
    }
  })

  // ── 记忆：用户删除自己的记忆（软删除 + 审计） ──
  app.delete('/api/v1/assistant/memories/:memoryId', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const { memoryId } = request.params as { memoryId: string }
    try {
      const deleted = await withRlsContext(request, (client) =>
        deleteOwnMemory(client, {
          tenantId: tenantIdOf(user),
          userId: user.id,
          memoryId,
        })
      )
      if (!deleted) return sendError(reply, 404, '记忆不存在或无权删除')
      return sendOk(reply, { deleted: true })
    } catch (err) {
      request.log.warn({ err, memoryId }, 'assistant memories delete failed')
      return sendError(reply, 500, '删除记忆失败')
    }
  })

  // ── 记忆审核队列（超管） ──
  app.get(
    '/api/v1/assistant/memories/review',
    { preHandler: [requireRole(['super_admin'])] },
    async (request, reply) => {
      const user = await requireAuth(request, reply)
      if (!user) return
      const query = request.query as { status?: string; scope?: string }
      try {
        const items = await withRlsContext(request, (client) =>
          listReviewMemories(client, {
            tenantId: tenantIdOf(user),
            status: query.status,
            scope: query.scope,
          })
        )
        return sendOk(reply, { items, total: items.length })
      } catch (err) {
        request.log.warn({ err }, 'assistant memory review list failed')
        return sendError(reply, 500, '查询记忆审核队列失败')
      }
    }
  )

  // ── 人工策展角色/组织记忆（超管）：角色记忆进入待审核，组织术语直接生效 ──
  app.post(
    '/api/v1/assistant/memories/admin',
    { preHandler: [requireRole(['super_admin'])] },
    async (request, reply) => {
      const user = await requireAuth(request, reply)
      if (!user) return

      const body = (request.body || {}) as {
        scope?: string
        roleKey?: string
        memoryKey?: string
        content?: string
        confidence?: number
      }
      const scope = body.scope === 'org' ? 'org' : 'role'
      const content = sanitizeMemoryText(body.content)
      if (content.length < 4) return sendError(reply, 400, '记忆内容过短')
      const roleKey = String(body.roleKey || '').trim()
      if (scope === 'role' && !roleKey) return sendError(reply, 400, '角色记忆必须指定角色')

      try {
        const result = await withRlsContext(request, (client) =>
          writeMemory(client, {
            tenantId: tenantIdOf(user),
            scope,
            roleKey: scope === 'role' ? roleKey : null,
            memoryKey: sanitizeMemoryKey(body.memoryKey) || `term:${Date.now()}`,
            content,
            confidence: Number(body.confidence ?? 0.8),
            sourceType: 'manual_curated',
            sourceId: `admin:${user.id}`,
            // 角色记忆先进审核队列；组织术语人工策展后直接生效
            status: scope === 'role' ? 'pending' : 'active',
            createdBy: user.id,
          })
        )
        if (result.action === 'rejected') {
          return sendError(reply, 400, result.reason || '写入记忆失败')
        }
        return sendOk(reply, { id: result.id, action: result.action, status: scope === 'role' ? 'pending' : 'active' })
      } catch (err) {
        request.log.warn({ err }, 'assistant memory admin write failed')
        return sendError(reply, 500, '写入记忆失败')
      }
    }
  )

  // ── 审核通过 / 驳回（超管） ──
  app.post(
    '/api/v1/assistant/memories/review/:memoryId',
    { preHandler: [requireRole(['super_admin'])] },
    async (request, reply) => {
      const user = await requireAuth(request, reply)
      if (!user) return

      const { memoryId } = request.params as { memoryId: string }
      const body = (request.body || {}) as { action?: string; reason?: string }
      try {
        if (body.action === 'reject') {
          const ok = await withRlsContext(request, (client) =>
            rejectMemory(client, {
              tenantId: tenantIdOf(user),
              memoryId,
              actorUserId: user.id,
              reason: body.reason,
            })
          )
          if (!ok) return sendError(reply, 404, '待审核记忆不存在')
          return sendOk(reply, { reviewed: true, action: 'rejected' })
        }
        const ok = await withRlsContext(request, (client) =>
          approveMemory(client, {
            tenantId: tenantIdOf(user),
            memoryId,
            actorUserId: user.id,
          })
        )
        if (!ok) return sendError(reply, 404, '待审核记忆不存在')
        return sendOk(reply, { reviewed: true, action: 'approved' })
      } catch (err) {
        request.log.warn({ err, memoryId }, 'assistant memory review failed')
        return sendError(reply, 500, '审核记忆失败')
      }
    }
  )

  // ── Agent 配置（超管） ──
  app.get('/api/v1/assistant/agents', { preHandler: [requireRole(['super_admin'])] }, async (request, reply) => {
    const agents = await withRlsContext(request, (client) => listAgentConfigs(client))
    return sendOk(reply, { items: agents, total: agents.length })
  })

  app.put(
    '/api/v1/assistant/agents/:agentKey',
    { preHandler: [requireRole(['super_admin'])] },
    async (request, reply) => {
      const { agentKey } = request.params as { agentKey: string }
      const body = (request.body || {}) as Record<string, unknown>
      try {
        const saved = await withRlsContext(request, (client) =>
          upsertAgentConfig(client, {
            agentKey,
            name: String(body.name || ''),
            description: body.description != null ? String(body.description) : undefined,
            systemPrompt: body.systemPrompt != null ? String(body.systemPrompt) : undefined,
            toolAllowlist: Array.isArray(body.toolAllowlist)
              ? (body.toolAllowlist as unknown[]).map(String)
              : undefined,
            riskCeiling: body.riskCeiling != null ? String(body.riskCeiling) : undefined,
            outputContract:
              body.outputContract && typeof body.outputContract === 'object'
                ? (body.outputContract as Record<string, unknown>)
                : undefined,
            isEnabled: body.isEnabled !== false,
          })
        )
        return sendOk(reply, saved)
      } catch (err) {
        return sendError(reply, 400, (err as Error)?.message || '保存 Agent 配置失败')
      }
    }
  )

  app.delete(
    '/api/v1/assistant/agents/:agentKey',
    { preHandler: [requireRole(['super_admin'])] },
    async (request, reply) => {
      const { agentKey } = request.params as { agentKey: string }
      const deleted = await withRlsContext(request, (client) => deleteAgentConfig(client, agentKey))
      if (!deleted) return sendError(reply, 404, 'Agent 不存在')
      return sendOk(reply, { deleted: true })
    }
  )
}
