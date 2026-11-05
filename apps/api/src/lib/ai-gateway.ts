/**
 * AI Gateway — unified entry point for OpenClaw (primary, since 2026-09-01)
 * / DeerFlow (fallback) / OpenViking / AnythingLLM.
 *
 * Route handlers call `requestAiReply()` and get back a reply or null
 * (meaning: fall back to the rule-based engine). OpenClaw transport
 * (tool-calling loop, retry, timeout) is now the primary path; the
 * DeerFlow-specific transport lives in `requestDeerFlowReply()` /
 * `streamDeerFlowReply()` and is retained as the fallback path so switching
 * back is seamless.
 */

import { env } from '../config/env.js'
import { aiRuntimeSnapshot, refreshAiRuntimeConfig } from './ai-config.js'
import { searchMemory, writeMemory } from './openviking-client.js'
import { searchKnowledge } from './anythingllm-client.js'
import { executeTool, getToolSchemasForOpenClaw, type ToolContext } from '../ai/tool-registry.js'
import { getPool } from './db.js'

// ---------------------------------------------------------------------------
// Types (shared with route layer)
// ---------------------------------------------------------------------------

export interface AiScopeContext {
  userId: number
  username: string
  role: string
  scopeType: 'user' | 'room' | 'role' | 'org'
  scopeId: string
  roomScope: number[]
  openvikingAccount?: string
  openvikingUser?: string
  /** 私有层知识库 workspace */
  anythingllmWorkspace?: string
  /** 角色层知识库 workspace */
  knowledgeRoleWorkspace?: string
  /** 公共层知识库 workspace */
  knowledgePublicWorkspace?: string
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface OpenClawReplyRequest {
  message: string
  conversationId: string
  modelName: string
  context: AiScopeContext
  systemPrompt: string
  history: ChatTurn[]
}

export interface OpenClawReplyResult {
  reply: string
  modelName: string
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const YON_SYSTEM_PROMPT = `你是直播电商 AI 运营助手。

职责：
1. 分析经营数据：先用 yon MCP 工具取数再作答——总览（yon_get_business_overview）、趋势（yon_get_business_trend）、渠道（yon_get_channel_performance）、商品（yon_get_product_performance）、主播（yon_get_anchor_performance）、漏斗（yon_get_funnel_analysis）、ROI（yon_get_roi_analysis）、异常（yon_get_anomalies）。数字一律来自工具返回，禁止凭经验推算。
2. 发现异常：环比/对比基准后量化指出异常指标与幅度（如"互动率 2.1%，较 7 日均值 -38%"），不泛泛而谈。
3. 生成复盘：复盘必须输出三段式——【诊断】核心指标（GMV/订单/观看/转化/ROI）的实际值、变化与健康度；【归因】基于工具数据给出具体根因（渠道/商品/主播/流量结构），每条归因标注数据支撑，不得臆测；【建议】3-5 条可执行动作按优先级排序并写明对应指标，写操作任务用 yon_create_improvement_task。
4. 提供运营建议：量化、具体、可执行。

规则：
- 所有数字必须来自工具或数据库
- 所有策略优先来自知识库（yon_search_knowledge）
- 所有历史经验优先来自 Context 服务（记忆）
- 禁止编造事实数据，复盘回答"为什么"与"怎么办"，而非罗列数字
- 多用户隔离：工作区中的 USER.md/SOUL.md/MEMORY.md 是共享档案，不得读取或修改；用户身份与偏好一律通过记忆系统（Context/OpenViking）按当前用户读写（2026-09-03 多用户隔离）

收敛规则（归因/复盘题必须一轮收敛）：
- 取数一次批量完成：先用总览/趋势/渠道/商品/主播/漏斗/ROI 等工具并行取齐所需数据，禁止"取一次→犹豫→再取一次"的自我确认循环；数据足够立刻作答。
- 数据有缺口时不追问用户（归因题无交互背景）：默认基于最近完整分析日（如 08-24）的数据作答，并在回复开头一句话明示"本次归因基于 <日期> 数据"。
- 禁止反复自我怀疑：已经取到数据后不得再花多轮推理"要不要澄清/要不要再确认"，直接给出【诊断】/【归因】/【建议】三段式。
- 禁止把大表/原始工具结果整段重放进回复，只输出结论、关键数字与差异。
- 禁止超大单次输出：写文件/回复单次不超过约 8k 字，需要长内容时拆成多次小段完成；禁止把整份数据集或整篇报告反复重发。`

// ---------------------------------------------------------------------------
// DeerFlow (primary agent runtime) — LangGraph-compatible Gateway API
// ---------------------------------------------------------------------------

export function isDeerFlowEnabled(): boolean {
  const cfg = aiRuntimeSnapshot()
  return env.AI_ENABLED && cfg.engine !== 'openclaw' && !!cfg.deerflowApiBase
}

/** yon conversationId → DeerFlow thread_id（符合 1-64 位 [A-Za-z0-9_-] 约束） */
export function toDeerFlowThreadId(conversationId: string): string {
  return `yon_${conversationId}`
}

function deerFlowHeaders(ownerUserId?: number): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (env.DEERFLOW_INTERNAL_TOKEN) {
    headers['X-DeerFlow-Internal-Token'] = env.DEERFLOW_INTERNAL_TOKEN
  }
  // 经 DeerFlow 内网 internal 认证通道把会话用户 ID 透传为 run 身份
  // （AuthMiddleware 校验 internal token 后，X-DeerFlow-Owner-User-Id →
  //   configurable.context.user_id → yon MCP 拦截器注入 X-Yon-User-Id）。
  // 仅在 internal token 已配置（可信内部调用方）时发送，避免匿名环境伪造。
  if (env.DEERFLOW_INTERNAL_TOKEN && ownerUserId) {
    headers['X-DeerFlow-Owner-User-Id'] = String(ownerUserId)
  }
  return headers
}

interface DeerFlowMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 确保 DeerFlow 线程存在（幂等：已有则返回）。
 *
 * ⚠️ 线程创建与 run 必须使用相同身份：`/runs/wait` 与 `/runs/stream` 带
 * owner_check 归属校验（owner_check=True），若创建线程时未透传 owner
 * （user_id 为 'default'）而 run 时透传（user_id=3），归属不匹配返回 404。
 * 因此这里必须与 run 使用同一 `deerFlowHeaders(ownerUserId)`。
 */
async function ensureDeerFlowThread(threadId: string, apiBase?: string, ownerUserId?: number): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase ?? aiRuntimeSnapshot().deerflowApiBase}/threads`, {
      method: 'POST',
      headers: deerFlowHeaders(ownerUserId),
      body: JSON.stringify({ thread_id: threadId, metadata: {} }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.warn('[ai-gateway] DeerFlow create thread failed:', res.status)
      return false
    }
    return true
  } catch (err) {
    console.warn('[ai-gateway] DeerFlow create thread error:', (err as Error).message)
    return false
  }
}

interface DeerFlowReplyResult {
  reply: string
  threadId: string
}

/** DeerFlow run 开关（经 body.context 注入 Gateway 白名单键） */
export interface DeerFlowRunOptions {
  thinkingEnabled?: boolean
  planMode?: boolean
  subagentEnabled?: boolean
  /** 模型名（经白名单键 model_name 注入，覆盖 DeerFlow 侧默认模型） */
  modelName?: string
}

/** 组装 run body 的 context 开关（thinking 始终显式下发：默认 false） */
function deerFlowRunContext(opts?: DeerFlowRunOptions, userId?: number): Record<string, unknown> | undefined {
  const context: Record<string, unknown> = {}
  // thinking 必须显式下发，不能依赖"不传 = DeerFlow 默认"：
  // DeepSeek-V4-Flash @ SiliconFlow thinking 默认开启，DeerFlow lead_agent 的
  // thinking_enabled 默认也是 True。只有显式 thinking_enabled=false 才会命中
  // config.yaml when_thinking_disabled 分支，注入 enable_thinking:false，
  // 否则每次模型调用 reasoning 输出 19万-26万 tokens（分钟级/次）直接把归因长链路
  // 拖到 30+min。默认关闭；仅当调用方显式传 thinkingEnabled:true 时才开启。
  context.thinking_enabled = !!opts?.thinkingEnabled
  if (opts?.planMode) context.is_plan_mode = true
  if (opts?.subagentEnabled) context.subagent_enabled = true
  if (opts?.modelName) context.model_name = opts.modelName
  // 多用户隔离（DeerFlow 原生 per-run 用户通道）：经 body.context.user_id
  // → runtime.context.user_id → yon MCP 拦截器注入 X-Yon-User-Id。
  // 与 config.context.secrets.yon_user_id 双通道并存（互为兜底）。
  if (userId) context.user_id = userId
  return Object.keys(context).length > 0 ? context : undefined
}

/** DeerFlow RunStatus 终态集（复用：主链路 + 异步恢复链路） */
const DEERFLOW_TERMINAL_STATUS = new Set(['success', 'error', 'timeout', 'interrupted'])

/** 主链路轮询间隔：DeerFlow 单次复盘 run 约 8-30 分钟，20s 既不频繁也不失准 */
const DEERFLOW_POLL_INTERVAL_MS = 20_000

/**
 * 超时解耦兜底（RFC：归因题长链路不应被后端超时窗口吞掉真实回复）。
 *
 * 当主链路因 `deerflowTimeoutMs` abort 而返回 fallback 后，run 在 DeerFlow 侧仍会
 * 继续跑到终态、真实回复滞留于线程 /state。本函数在后台（无 abort、fire-and-forget）
 * 继续轮询同一个 run_id，终态后取 /state 提取最后一条 assistant 文本并回调。
 *
 * 安全性：
 * - 只针对已确认 start 成功的 run_id，避免追错对象；
 * - 后台轮询有独立硬上限（默认 40min 后放弃），不会变成僵尸任务；
 * - 恢复线程与后续新 run 无关——轮询按 run_id 追踪，且 /state 提取按
 *   ``messages-tuple 顺序取与当前 run 对应的最后一条 AI 消息``，避免把
 *   用户后续新问题的回复误当成本 run 的延迟结果（由回调方按内容匹配置信）。
 */
const DEERFLOW_RECOVERY_MAX_WAIT_MS = 40 * 60_000

/** 从线程 /state 提取最后一条非空 assistant/AI 文本（主链路与恢复链路共用） */
function extractLastAssistantText(state: {
  values?: {
    messages?: Array<{
      type?: string
      role?: string
      content?: string | Array<{ type?: string; text?: string }>
    }>
  }
}): string | null {
  const msgs = state.values?.messages || []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    const role = m.type || m.role
    if (role !== 'assistant' && role !== 'ai') continue
    const content = m.content
    if (typeof content === 'string' && content.trim()) return content
    if (Array.isArray(content)) {
      const text = content
        .map((p) => (typeof p === 'object' && p?.text ? p.text : ''))
        .join('')
      if (text.trim()) return text
    }
  }
  return null
}

/**
 * 后台恢复链路：持续轮询指定 run 直至终态，成功则取真实回复并回调 `onRecovered`。
 * fire-and-forget；HTTP 层错误一律静默重试，到硬上限即放弃（避免无限占用连接）。
 */
async function recoverDeerFlowReply(opts: {
  threadId: string
  runId: string
  apiBase: string
  ownerUserId?: number
  onRecovered: (res: DeerFlowReplyResult) => void
}): Promise<void> {
  const deadline = Date.now() + DEERFLOW_RECOVERY_MAX_WAIT_MS
  for (;;) {
    const pollRes = await fetch(`${opts.apiBase}/threads/${opts.threadId}/runs/${opts.runId}`, {
      headers: deerFlowHeaders(opts.ownerUserId),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null)
    if (pollRes?.ok) {
      const poll = await pollRes.json().catch(() => null) as { status?: string } | null
      const status = poll?.status || ''
      if (DEERFLOW_TERMINAL_STATUS.has(status)) {
        if (status === 'success') {
          const stateRes = await fetch(`${opts.apiBase}/threads/${opts.threadId}/state`, {
            headers: deerFlowHeaders(opts.ownerUserId),
            signal: AbortSignal.timeout(30_000),
          }).catch(() => null)
          if (stateRes?.ok) {
            const state = await stateRes.json().catch(() => null) as Parameters<typeof extractLastAssistantText>[0] | null
            const reply = state ? extractLastAssistantText(state) : null
            if (reply) {
              console.info(`[ai-gateway] 超时解耦：run ${opts.runId} 终态 success，后台补取到真实回复（${reply.length} 字符）`)
              opts.onRecovered({ reply, threadId: opts.threadId })
              return
            }
          }
        } else {
          console.warn(`[ai-gateway] 超时解耦：run ${opts.runId} 终态为 ${status}，无真实回复可补取`)
          return
        }
      }
    }
    if (Date.now() > deadline) {
      console.warn(`[ai-gateway] 超时解耦：run ${opts.runId} 在 ${DEERFLOW_RECOVERY_MAX_WAIT_MS / 60000}min 内未终态，放弃后台补取`)
      return
    }
    await new Promise((r) => setTimeout(r, DEERFLOW_POLL_INTERVAL_MS))
  }
}

/**
 * 非流式：创建/复用线程并阻塞等待 run 完成，取最终回复文本。
 *
 * 记忆检索由 DeerFlow 原生 OpenViking 适配器注入，知识库经 yon MCP
 * `search_knowledge` 工具由 agent 自主调用——此处不再预取（避免重复注入）。
 */
export async function requestDeerFlowReply(req: {
  message: string
  conversationId: string
  deerflowThreadId: string
  systemPrompt: string
  /** yon 会话用户 ID（经 run config.context.secrets 透传给 DeerFlow，
   *  MCP 拦截器据此动态注入 X-Yon-User-Id → yon MCP 按用户隔离数据） */
  userId?: number
  options?: DeerFlowRunOptions
  /**
   * 超时解耦回调（2026-08-26 归因题收敛性优化 阶段2-1）：
   * 当主链路因 deerflowTimeoutMs abort、run 实际仍在 DeerFlow 侧继续执行时，
   * 后台恢复链路会在 run 终态后从 /state 补取真实回复并调用该回调。
   * 回调由 route 层提供，负责把真实回复落库/替换 fallback。不传则仅打日志、不做恢复。
   */
  onLateReply?: (res: DeerFlowReplyResult) => void
}): Promise<DeerFlowReplyResult | null> {
  const cfg = await refreshAiRuntimeConfig()
  if (!env.AI_ENABLED || cfg.engine === 'openclaw' || !cfg.deerflowApiBase) return null

  const threadId = req.deerflowThreadId || toDeerFlowThreadId(req.conversationId)
  if (!(await ensureDeerFlowThread(threadId, cfg.deerflowApiBase, req.userId))) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.deerflowTimeoutMs)

  // run 一旦成功启动，记录 run_id——超时 abort 时据此武装后台补取链路
  let startedRunId: string | null = null

  try {
    const runContext = deerFlowRunContext({ ...req.options, modelName: cfg.deerflowModel }, req.userId)
    const runBody = {
      assistant_id: 'lead_agent',
      input: {
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.message },
        ],
      },
      ...(runContext ? { context: runContext } : {}),
      // 会话身份经 config.context.secrets 透传（DeerFlow 的 MCP 拦截器
      // 读取后动态注入 yon MCP 的 X-Yon-User-Id → 多用户数据隔离）
      ...(req.userId
        ? { config: { recursion_limit: 500, context: { secrets: { yon_user_id: req.userId } } } }
        : {}),
      stream_mode: ['messages-tuple', 'values'],
    }

    // ① 非阻塞启动 run（立即返回）。注意：不能走 /runs/wait 长轮询——
    // 该端点在整个 run 期间不发响应头，undici fetch 默认 headersTimeout=300s
    // 会中断请求导致误 fallback（golden-gq1~6 曾因 run 恰好 <5min 而侥幸成功，
    // yon_143~145 的 run 8-30min 全部在 300s 处中断、后端 5 分钟内提前 fallback）。
    const startRes = await fetch(`${cfg.deerflowApiBase}/threads/${threadId}/runs`, {
      method: 'POST',
      headers: deerFlowHeaders(req.userId),
      body: JSON.stringify(runBody),
      signal: controller.signal,
    })
    if (!startRes.ok) {
      const body = await startRes.text().catch(() => '')
      throw new Error(`DeerFlow /runs returned ${startRes.status}: ${body.slice(0, 200)}`)
    }
    const started = await startRes.json() as { run_id?: string; status?: string }
    if (!started.run_id) throw new Error('DeerFlow /runs returned no run_id')
    // 记录已成功启动的 run_id：超时 abort 后供后台恢复链路补取真实回复
    startedRunId = started.run_id

    // ② 轮询 run 状态直至终态
    for (;;) {
      const pollRes = await fetch(`${cfg.deerflowApiBase}/threads/${threadId}/runs/${started.run_id}`, {
        headers: deerFlowHeaders(req.userId),
        signal: controller.signal,
      })
      if (!pollRes.ok) {
        const body = await pollRes.text().catch(() => '')
        throw new Error(`DeerFlow run poll returned ${pollRes.status}: ${body.slice(0, 200)}`)
      }
      const poll = await pollRes.json() as { status?: string }
      const status = poll.status || ''
      if (DEERFLOW_TERMINAL_STATUS.has(status)) {
        if (status !== 'success') throw new Error(`DeerFlow run ended with status ${status}`)
        break
      }
      await new Promise((r) => setTimeout(r, DEERFLOW_POLL_INTERVAL_MS))
    }

    // ③ 取线程最终 state，提取最后一条 assistant/ai 消息文本
    const stateRes = await fetch(`${cfg.deerflowApiBase}/threads/${threadId}/state`, {
      headers: deerFlowHeaders(req.userId),
      signal: controller.signal,
    })
    if (!stateRes.ok) {
      const body = await stateRes.text().catch(() => '')
      throw new Error(`DeerFlow /state returned ${stateRes.status}: ${body.slice(0, 200)}`)
    }
    const state = await stateRes.json() as {
      values?: {
        messages?: Array<{
          type?: string
          role?: string
          content?: string | Array<{ type?: string; text?: string }>
        }>
      }
    }

    // 取最后一条 assistant/ai 消息文本（DeerFlow 序列化为 values.messages）
    const msgs = state.values?.messages || []
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      const role = m.type || m.role
      if (role !== 'assistant' && role !== 'ai') continue
      const content = m.content
      if (typeof content === 'string' && content.trim()) {
        return { reply: content, threadId }
      }
      if (Array.isArray(content)) {
        const text = content
          .map((p) => (typeof p === 'object' && p?.text ? p.text : ''))
          .join('')
        if (text.trim()) return { reply: text, threadId }
      }
    }
    throw new Error('DeerFlow run finished with no assistant text')
  } catch (err) {
    const isAbort = (err as Error)?.name === 'AbortError' || controller.signal.aborted
    if (isAbort && startedRunId) {
      // 超时解耦：主链路已到 deerflowTimeoutMs 上限被迫返回 fallback，但 run 在
      // DeerFlow 侧仍在继续。后台补取链路将轮询同一 run 至终态，成功则取 /state
      // 真实回复并回调 onLateReply（由 route 层落库/替换 fallback）。
      console.warn(
        `[ai-gateway] DeerFlow run ${startedRunId} exceeded ${cfg.deerflowTimeoutMs}ms client wait; ` +
        `arming async reply recovery`
      )
      if (req.onLateReply) {
        void recoverDeerFlowReply({
          threadId,
          runId: startedRunId,
          apiBase: cfg.deerflowApiBase,
          ownerUserId: req.userId,
          onRecovered: req.onLateReply,
        })
      }
    } else {
      console.warn('[ai-gateway] DeerFlow call failed, falling back:', (err as Error).message)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 流式：创建/复用线程，SSE 读取 DeerFlow token 增量并通过 onToken 转发。
 *
 * SSE 事件序列：metadata → values（线程状态快照）→ messages（消息增量，
 * AI token 以 messages-tuple 分片发送）→ end。
 * messages 事件的 data 是 [消息增量, 元数据] 二元组；AI 文本 delta 位于
 * 首元素且 type 为 "AIMessageChunk"。
 */
export async function streamDeerFlowReply(
  req: {
    message: string
    conversationId: string
    deerflowThreadId: string
    systemPrompt: string
    /** 会话用户 ID（透传方式同 requestDeerFlowReply） */
    userId?: number
    options?: DeerFlowRunOptions
  },
  onToken: (token: string) => void,
  onToolCall?: (toolName: string) => void
): Promise<DeerFlowReplyResult | null> {
  const cfg = await refreshAiRuntimeConfig()
  if (!env.AI_ENABLED || cfg.engine === 'openclaw' || !cfg.deerflowApiBase) return null

  const threadId = req.deerflowThreadId || toDeerFlowThreadId(req.conversationId)
  if (!(await ensureDeerFlowThread(threadId, cfg.deerflowApiBase, req.userId))) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), cfg.deerflowTimeoutMs)

  try {
    const runContext = deerFlowRunContext({ ...req.options, modelName: cfg.deerflowModel }, req.userId)
    const res = await fetch(`${cfg.deerflowApiBase}/threads/${threadId}/runs/stream`, {
      method: 'POST',
      headers: deerFlowHeaders(req.userId),
      body: JSON.stringify({
        assistant_id: 'lead_agent',
        input: {
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: req.message },
          ],
        },
        ...(runContext ? { context: runContext } : {}),
        // 会话身份透传（同 /runs/wait）
        ...(req.userId
          ? { config: { recursion_limit: 500, context: { secrets: { yon_user_id: req.userId } } } }
          : {}),
        stream_mode: ['messages-tuple', 'values'],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`DeerFlow /runs/stream returned ${res.status}: ${body.slice(0, 200)}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('DeerFlow stream returned no body')

    const decoder = new TextDecoder()
    let buffer = ''
    let fullReply = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        // 仅处理 data: 行（event: 行只作标记；data 是快照/messages-tuple JSON）
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.replace(/^data:\s*/, '')
        if (!payload || payload === '[DONE]') continue

        try {
          // messages 事件的 data 是 [消息增量, 元数据] 二元组（array of
          // [diff, metadata]）。AI 文本增量是首元素，type 为 "AIMessageChunk"，
          // content 为字符串 delta 分片（按 id 拼接恢复完整文本）。
          const parsed = JSON.parse(payload)
          const tuple = Array.isArray(parsed) ? parsed : [parsed]
          const delta = tuple[0]
          if (!delta || typeof delta !== 'object') continue

          // 工具调用指示（前端「调用工具」条）：
          // 1) AI 增量 chunk 携带 tool_calls（tool_call_chunks 为参数分片，去重上报）
          // 2) ToolMessage（type === 'tool'，name/role 标识工具名）
          if (onToolCall) {
            const toolCalls = delta.tool_calls as Array<{ name?: string; function?: { name?: string } }> | undefined
            if (Array.isArray(toolCalls) && toolCalls.length > 0) {
              const name = toolCalls[0]?.function?.name || toolCalls[0]?.name
              if (name) onToolCall(name)
            }
            if ((delta.type === 'tool' || delta.role === 'tool') && typeof delta.name === 'string' && delta.name) {
              onToolCall(delta.name)
            }
          }

          if (
            (delta.type === 'AIMessageChunk' || delta.type === 'ai') &&
            typeof delta.content === 'string' &&
            delta.content
          ) {
            fullReply += delta.content
            onToken(delta.content)
          }
        } catch {
          // 忽略无法解析的心跳/空行
        }
      }
    }

    if (!fullReply.trim()) throw new Error('DeerFlow stream returned no content')
    return { reply: fullReply, threadId }
  } catch (err) {
    console.warn('[ai-gateway] DeerFlow stream failed, falling back:', (err as Error).message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// OpenClaw call with tool-calling loop (fallback path)
// ---------------------------------------------------------------------------

export function isOpenClawEnabled(): boolean {
  return env.AI_ENABLED && !!env.OPENCLAW_API_BASE && !!env.OPENCLAW_MODEL
}

const MAX_TOOL_ROUNDS = 5

interface OpenClawMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

/**
 * Call OpenClaw via its OpenAI-compatible proxy endpoint.
 *
 * Supports function/tool calling: OpenClaw receives the registered MCP tool
 * schemas and may request tool executions. Each tool call is executed
 * through the tool registry (with RBAC + risk-level checks) and the
 * result is fed back to OpenClaw for the next round.
 *
 * Returns the assistant reply, or `null` if OpenClaw is disabled or
 * the call fails (caller should fall back to rule-based engine).
 */
export async function requestOpenClawReply(
  req: OpenClawReplyRequest
): Promise<OpenClawReplyResult | null> {
  if (!isOpenClawEnabled()) {
    return null
  }

  // Build initial message list
  const messages: OpenClawMessage[] = [
    { role: 'system', content: req.systemPrompt },
    ...req.history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: req.message },
  ]

  // Pre-fetch memory and three-tier knowledge context (private/role/public)
  const [memoryContext, privateKnowledge, roleKnowledge, publicKnowledge] = await Promise.all([
    searchMemory(req.message, req.context).catch(() => null),
    searchKnowledge(req.message, req.context.anythingllmWorkspace).catch(() => null),
    searchKnowledge(req.message, req.context.knowledgeRoleWorkspace).catch(() => null),
    searchKnowledge(req.message, req.context.knowledgePublicWorkspace).catch(() => null),
  ])
  const knowledgeContext = [privateKnowledge, roleKnowledge, publicKnowledge]
    .filter((c): c is string => !!c && c.trim().length > 0)
    .join('\n\n') || null

  if (memoryContext) {
    messages.push({
      role: 'system',
      content: `以下是相关的历史记忆，供参考：\n\n${memoryContext}`,
    })
  }

  if (knowledgeContext) {
    messages.push({
      role: 'system',
      content: `以下是相关知识库内容（含私有/角色/公共三层），供参考：\n\n${knowledgeContext}`,
    })
  }

  const tools = getToolSchemasForOpenClaw()
  const pool = getPool()
  const toolCtx: ToolContext = {
    userId: req.context.userId,
    role: req.context.role,
    scope: req.context,
    pool,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.OPENCLAW_TIMEOUT_MS)

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await fetch(`${env.OPENCLAW_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENCLAW_API_KEY}`,
        },
        body: JSON.stringify({
          model: req.modelName,
          messages,
          temperature: 0.7,
          // DeepSeek-V4-Flash（SiliconFlow）thinking 默认开启：2048 会被
          // reasoning 占满导致最终回复为空（openclaw 网关判空回复 → failover
          // → 后端误落 fallback，2026-09-01 归因题复现）。提至与模型
          // maxTokens 对齐的 8192。
          max_tokens: 8192,
          // 用 conversationId 派生稳定 session key，使同一会话的多轮调用
          // 共享 agent session（会话连续性）。注意：会话连续 ≠ 用户记忆隔离，
          // 用户专属记忆仍只走 OpenViking（按 yon_<userId> 隔离）。
          user: `conv:${req.conversationId ?? 'default'}`,
          ...(tools.length > 0 ? { tools } : {}),
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`OpenClaw proxy returned ${res.status}: ${body.slice(0, 200)}`)
      }

      const data = await res.json() as {
        choices?: Array<{
          message?: {
            content?: string
            tool_calls?: Array<{
              id: string
              type: 'function'
              function: { name: string; arguments: string }
            }>
          }
        }>
      }

      const choice = data.choices?.[0]
      if (!choice?.message) {
        throw new Error('Hermes returned an empty response')
      }

      const assistantMsg = choice.message
      messages.push({
        role: 'assistant',
        content: assistantMsg.content || '',
        ...(assistantMsg.tool_calls ? { tool_calls: assistantMsg.tool_calls } : {}),
      })

      // If Hermes didn't request tool calls, we're done
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        const reply = assistantMsg.content
        if (!reply) {
          throw new Error('OpenClaw returned an empty reply')
        }

        // Write memory asynchronously (best-effort)
        writeMemory(
          `用户: ${req.message}\n\n助手: ${reply}`,
          req.context
        ).catch(() => {})

        return { reply, modelName: req.modelName }
      }

      // Execute each requested tool call
      for (const tc of assistantMsg.tool_calls) {
        const toolName = tc.function.name
        let params: unknown
        try {
          params = JSON.parse(tc.function.arguments)
        } catch {
          params = {}
        }

        const result = await executeTool(toolName, params, toolCtx)
        // For write_with_approval, the result contains pending_approval info
        // OpenClaw should relay this to the user
        const toolResponse = result.ok
          ? result.result
          : { error: result.error }
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResponse),
          tool_call_id: tc.id,
        })
      }
    }

    // Exhausted tool rounds without a final reply
    throw new Error('OpenClaw exceeded max tool rounds without a final reply')
  } catch (err) {
    console.warn('[ai-gateway] OpenClaw call failed, falling back:', (err as Error).message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Streaming version — SSE
// ---------------------------------------------------------------------------

/**
 * Stream a Hermes reply via Server-Sent Events.
 *
 * The route handler should:
 * 1. Set SSE headers on the reply
 * 2. Call this function with an `onToken` callback
 * 3. Fall back to the rule-based engine if this returns null
 *
 * Tool calls are executed transparently (non-streamed) between rounds;
 * only the final assistant text is streamed to the client.
 */
export async function streamOpenClawReply(
  req: OpenClawReplyRequest,
  onToken: (token: string) => void
): Promise<OpenClawReplyResult | null> {
  if (!isOpenClawEnabled()) {
    return null
  }

  const messages: OpenClawMessage[] = [
    { role: 'system', content: req.systemPrompt },
    ...req.history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: req.message },
  ]

  const [memoryContext, privateKnowledge, roleKnowledge, publicKnowledge] = await Promise.all([
    searchMemory(req.message, req.context).catch(() => null),
    searchKnowledge(req.message, req.context.anythingllmWorkspace).catch(() => null),
    searchKnowledge(req.message, req.context.knowledgeRoleWorkspace).catch(() => null),
    searchKnowledge(req.message, req.context.knowledgePublicWorkspace).catch(() => null),
  ])
  const knowledgeContext = [privateKnowledge, roleKnowledge, publicKnowledge]
    .filter((c): c is string => !!c && c.trim().length > 0)
    .join('\n\n') || null

  if (memoryContext) {
    messages.push({ role: 'system', content: `以下是相关的历史记忆，供参考：\n\n${memoryContext}` })
  }
  if (knowledgeContext) {
    messages.push({ role: 'system', content: `以下是相关知识库内容（含私有/角色/公共三层），供参考：\n\n${knowledgeContext}` })
  }

  const tools = getToolSchemasForOpenClaw()
  const pool = getPool()
  const toolCtx: ToolContext = {
    userId: req.context.userId,
    role: req.context.role,
    scope: req.context,
    pool,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.OPENCLAW_TIMEOUT_MS)

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const isFinalRound = round === MAX_TOOL_ROUNDS - 1

      // On the last allowed round, request stream=true so we can
      // stream the final reply even if OpenClaw tries tool calls again
      // (we just won't execute them).
      const useStream = isFinalRound

      const res = await fetch(`${env.OPENCLAW_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENCLAW_API_KEY}`,
        },
        body: JSON.stringify({
          model: req.modelName,
          messages,
          temperature: 0.7,
          // 同 requestOpenClawReply：2048 被 thinking 占满会得到空回复，
          // 提至 8192（与 openclaw.json 模型 maxTokens 对齐）。
          max_tokens: 8192,
          // 同 requestOpenClawReply：用 conversationId 派生稳定 session key。
          user: `conv:${req.conversationId ?? 'default'}`,
          stream: useStream,
          ...(tools.length > 0 ? { tools } : {}),
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`OpenClaw proxy returned ${res.status}: ${body.slice(0, 200)}`)
      }

      if (!useStream) {
        // Non-streaming round: check for tool calls
        const data = await res.json() as {
          choices?: Array<{
            message?: {
              content?: string
              tool_calls?: Array<{
                id: string
                type: 'function'
                function: { name: string; arguments: string }
              }>
            }
          }>
        }

        const choice = data.choices?.[0]
        if (!choice?.message) throw new Error('OpenClaw returned an empty response')

        const assistantMsg = choice.message
        messages.push({
          role: 'assistant',
          content: assistantMsg.content || '',
          ...(assistantMsg.tool_calls ? { tool_calls: assistantMsg.tool_calls } : {}),
        })

        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          const reply = assistantMsg.content
          if (!reply) throw new Error('OpenClaw returned an empty reply')

          onToken(reply)
          writeMemory(`用户: ${req.message}\n\n助手: ${reply}`, req.context).catch(() => {})

          return { reply, modelName: req.modelName }
        }

        // Execute tool calls
        for (const tc of assistantMsg.tool_calls) {
          const toolName = tc.function.name
          let params: unknown
          try { params = JSON.parse(tc.function.arguments) } catch { params = {} }

          const result = await executeTool(toolName, params, toolCtx)
          messages.push({
            role: 'tool',
            content: JSON.stringify(result.ok ? result.result : { error: result.error }),
            tool_call_id: tc.id,
          })
        }
      } else {
        // Streaming round: read SSE chunks and forward tokens
        const reader = res.body?.getReader()
        if (!reader) throw new Error('OpenClaw stream returned no body')

        const decoder = new TextDecoder()
        let fullReply = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const chunk = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>
              }
              const token = chunk.choices?.[0]?.delta?.content || ''
              if (token) {
                fullReply += token
                onToken(token)
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }

        if (!fullReply) throw new Error('OpenClaw stream returned no content')

        writeMemory(`用户: ${req.message}\n\n助手: ${fullReply}`, req.context).catch(() => {})

        return { reply: fullReply, modelName: req.modelName }
      }
    }

    throw new Error('OpenClaw exceeded max tool rounds without a final reply')
  } catch (err) {
    console.warn('[ai-gateway] OpenClaw stream failed, falling back:', (err as Error).message)
    return null
  } finally {
    clearTimeout(timeout)
  }
}
