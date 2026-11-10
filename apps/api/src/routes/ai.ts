import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { requireAuth } from '../lib/guard.js'
import { env } from '../config/env.js'
import {
  requestDeerFlowReply,
  streamDeerFlowReply,
  requestOpenClawReply,
  streamOpenClawReply,
  toDeerFlowThreadId,
  LEYOVA_SYSTEM_PROMPT,
  type AiScopeContext,
} from '../lib/ai-gateway.js'
import { refreshAiRuntimeConfig } from '../lib/ai-config.js'
import {
  isAdminRole,
  buildSessionsQuery,
  assertConversationOwnership,
  resolveApprovalAction,
  resolveRejectAction,
} from '../lib/ai-access.js'
import { runAnalysis, type AnalysisResult } from '../ai/orchestrator.js'

function formatAnalysisToMarkdown(result: AnalysisResult): string {
  const { conclusion, verification } = result
  const lines: string[] = []

  lines.push(`### 💡 核心结论\n**${conclusion.headline}**\n`)

  if (conclusion.findings && conclusion.findings.length > 0) {
    lines.push(`#### 📊 关键业务指标`)
    for (const f of conclusion.findings) {
      lines.push(`- ${f}`)
    }
    lines.push('')
  }

  if (conclusion.risks && conclusion.risks.length > 0) {
    lines.push(`#### ⚠️ 风险与异动识别`)
    for (const r of conclusion.risks) {
      lines.push(`- ${r}`)
    }
    lines.push('')
  }

  if (conclusion.actions && conclusion.actions.length > 0) {
    lines.push(`#### 🎯 经营决策建议`)
    for (const a of conclusion.actions) {
      lines.push(`1. ${a}`)
    }
    lines.push('')
  }

  const verifyText = verification.passed
    ? `🛡️ **数据真实性核验**：全量 ${verification.checkedNumbers} 个核心数据指标 100% 溯源通过（零大模型幻觉计算）`
    : `🛡️ **数据真实性核验**：${verification.matched}/${verification.checkedNumbers} 个指标已核验`
  lines.push(`> [!NOTE]\n> ${verifyText}\n`)

  return lines.join('\n')
}
export async function aiRoutes(app: FastifyInstance) {
  // ── GET /api/v1/ai/daily-report ── 数据驱动日报简报
  app.get('/api/v1/ai/daily-report', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { rows: todayStats } = await pool.query(
        `SELECT
           COALESCE(SUM(gmv), 0) AS total_gmv,
           COALESCE(SUM(orders), 0) AS total_orders,
           COALESCE(SUM(views), 0) AS total_views,
           COALESCE(AVG(uv_value), 0) AS avg_uv_value,
           COALESCE(AVG(interaction_rate), 0) AS avg_interaction_rate,
           COALESCE(AVG(retention_rate), 0) AS avg_retention_rate,
           COUNT(*) AS session_count
         FROM live_sessions WHERE date = $1::date AND status = 'completed'`,
        [today]
      )
      const ts = todayStats[0]

      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const { rows: yestStats } = await pool.query(
        `SELECT
           COALESCE(SUM(gmv), 0) AS total_gmv,
           COALESCE(SUM(orders), 0) AS total_orders,
           COALESCE(SUM(views), 0) AS total_views,
           COUNT(*) AS session_count
         FROM live_sessions WHERE date = $1::date AND status = 'completed'`,
        [yesterday]
      )
      const ys = yestStats[0]
      const gmvChange = ys.total_gmv > 0 ? ((ts.total_gmv - ys.total_gmv) / ys.total_gmv * 100).toFixed(1) : null
      const ordersChange = ys.total_orders > 0 ? ((ts.total_orders - ys.total_orders) / ys.total_orders * 100).toFixed(1) : null
      const viewsChange = ys.total_views > 0 ? ((ts.total_views - ys.total_views) / ys.total_views * 100).toFixed(1) : null

      const { rows: anchorPerf } = await pool.query(
        `SELECT a.name,
                COALESCE(ls.gmv, 0) AS gmv,
                COALESCE(ls.orders, 0) AS orders,
                COALESCE(ls.views, 0) AS views,
                COALESCE(ls.uv_value, 0) AS uv_value,
                COALESCE(ls.interaction_rate, 0) AS interaction_rate,
                COALESCE(ls.gpm, 0) AS gpm
         FROM anchors a
         LEFT JOIN live_sessions ls ON ls.anchor_id = a.id AND ls.date = $1::date AND ls.status = 'completed'
         WHERE a.status = 1
         ORDER BY ls.gmv DESC NULLS LAST`,
        [today]
      )

      const { rows: channelPerf } = await pool.query(
        `SELECT sc.channel,
                COALESCE(SUM(sc.views), 0) AS views,
                COALESCE(SUM(sc.orders), 0) AS orders,
                COALESCE(SUM(sc.gmv), 0) AS gmv,
                COALESCE(SUM(sc.ad_spend), 0) AS ad_spend,
                COALESCE(SUM(sc.gmv) / NULLIF(SUM(sc.ad_spend), 0), 0) AS roi
         FROM session_channel_metrics sc
         JOIN live_sessions s ON s.id = sc.session_id
         WHERE s.date = $1::date
         GROUP BY sc.channel
         ORDER BY sc.channel`,
        [today]
      )

      const { rows: alerts } = await pool.query(
        `SELECT severity, title, description
         FROM alert_events
         WHERE status = 'pending'
         ORDER BY event_time DESC LIMIT 3`
      )

      const lines: string[] = []
      lines.push(`# 📊 leyova 数据日报 · ${today}`)
      lines.push('')
      lines.push(`## 今日概览`)
      lines.push(`- 直播场次：${ts.session_count} 场`)
      lines.push(`- 总 GMV：¥${(ts.total_gmv / 10000).toFixed(1)}万${gmvChange ? `（${+gmvChange >= 0 ? '↑' : '↓'}${Math.abs(+gmvChange)}%）` : ''}`)
      lines.push(`- 总订单：${ts.total_orders} 单${ordersChange ? `（${+ordersChange >= 0 ? '↑' : '↓'}${Math.abs(+ordersChange)}%）` : ''}`)
      lines.push(`- 总观看：${ts.total_views.toLocaleString()}${viewsChange ? `（${+viewsChange >= 0 ? '↑' : '↓'}${Math.abs(+viewsChange)}%）` : ''}`)
      lines.push(`- 平均 UV 价值：${parseFloat(ts.avg_uv_value).toFixed(2)}`)
      lines.push(`- 平均互动率：${parseFloat(ts.avg_interaction_rate).toFixed(1)}%`)
      lines.push(`- 平均留存率：${parseFloat(ts.avg_retention_rate).toFixed(1)}%`)
      lines.push('')
      lines.push(`## 主播表现`)
      const activeAnchors = anchorPerf.filter((a: any) => a.gmv > 0)
      if (activeAnchors.length > 0) {
        activeAnchors.forEach((a: any, i: number) => {
          lines.push(`- **${i + 1}. ${a.name}** — GMV ¥${(a.gmv / 10000).toFixed(1)}万 | 订单 ${a.orders} | UV ${parseFloat(a.uv_value).toFixed(2)} | 互动 ${parseFloat(a.interaction_rate).toFixed(1)}%`)
        })
      } else {
        lines.push('> 今日暂无活跃主播数据')
      }
      lines.push('')
      lines.push(`## 渠道表现`)
      if (channelPerf.length > 0) {
        channelPerf.forEach((c: any) => {
          const spendInfo = c.ad_spend > 0 ? ` | 投放 ¥${(c.ad_spend / 10000).toFixed(1)}万 | ROI ${parseFloat(c.roi).toFixed(2)}` : ''
          lines.push(`- **${c.channel}** — GMV ¥${(c.gmv / 10000).toFixed(1)}万 | 观看 ${c.views.toLocaleString()} | 订单 ${c.orders}${spendInfo}`)
        })
      } else {
        lines.push('> 暂无渠道数据')
      }
      lines.push('')
      if (alerts.length > 0) {
        lines.push(`## ⚠️ 待处理预警（${alerts.length} 条）`)
        alerts.forEach((a: any) => {
          const icon = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🔵'
          lines.push(`- ${icon} **${a.title}** — ${(a.description || '').slice(0, 80)}`)
        })
      }

      return sendOk(reply, {
        date: today,
        overview: {
          sessionCount: ts.session_count,
          totalGmv: parseFloat(ts.total_gmv),
          totalOrders: parseInt(ts.total_orders),
          totalViews: parseInt(ts.total_views),
          avgUvValue: parseFloat(ts.avg_uv_value),
          avgInteractionRate: parseFloat(ts.avg_interaction_rate),
          avgRetentionRate: parseFloat(ts.avg_retention_rate),
          gmvChange: gmvChange ? parseFloat(gmvChange) : null,
          ordersChange: ordersChange ? parseFloat(ordersChange) : null,
          viewsChange: viewsChange ? parseFloat(viewsChange) : null,
        },
        anchors: anchorPerf.map((a: any) => ({
          name: a.name, gmv: parseFloat(a.gmv), orders: parseInt(a.orders),
          views: parseInt(a.views), uvValue: parseFloat(a.uv_value),
          interactionRate: parseFloat(a.interaction_rate), gpm: parseFloat(a.gpm),
        })),
        channels: channelPerf.map((c: any) => ({
          channel: c.channel, views: parseInt(c.views), orders: parseInt(c.orders),
          gmv: parseFloat(c.gmv), adSpend: parseFloat(c.ad_spend),
          roi: parseFloat(c.roi),
        })),
        alerts: alerts.map((a: any) => ({
          severity: a.severity, title: a.title, description: (a.description || '').slice(0, 200),
        })),
        markdown: lines.join('\n'),
      })
    } catch (err) {
      request.log.warn({ err }, 'ai/daily-report query failed')
      return sendOk(reply, {
        date: new Date().toISOString().slice(0, 10),
        overview: { sessionCount: 0, totalGmv: 0, totalOrders: 0, totalViews: 0, avgUvValue: 0, avgInteractionRate: 0, avgRetentionRate: 0, gmvChange: null, ordersChange: null, viewsChange: null },
        anchors: [], channels: [], alerts: [],
        markdown: '# 📊 数据日报\n\n> 暂无数据，请确认今日数据是否已上传。',
      })
    }
  })

  // ── GET /api/v1/ai/sessions ── 对话列表（仅本人；系统管理员可见全部用户）
  app.get('/api/v1/ai/sessions', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    const isAdmin = isAdminRole(user.role)
    try {
      const { text, params } = buildSessionsQuery(isAdmin, user.id)
      const { rows } = await pool.query(text, params)
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'ai/sessions query failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/ai/chat ── AI 回复
  app.post('/api/v1/ai/chat', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const body = request.body as { message: string; conversationId?: string; thinkingEnabled?: boolean; planMode?: boolean; subagentEnabled?: boolean }
      const message = (body?.message || '').trim()
      if (!message) {
        return sendError(reply, 400, '消息内容不能为空')
      }

      const runOptions = {
        thinkingEnabled: !!body?.thinkingEnabled,
        planMode: !!body?.planMode,
        subagentEnabled: !!body?.subagentEnabled,
      }

      let convId = body.conversationId

      // 1. 如果传入已有 conversationId，必须校验归属
      if (convId && convId !== 'default') {
        const ownership = await assertConversationOwnership(pool, convId, user)
        if (!ownership.ok) {
          return sendError(reply, 403, '会话不可访问')
        }
      }

      // 2. 创建新会话（标题按字符截断，避免在 SQL_ASCII 库上 LEFT(...,50) 按字节截断中文导致无效 UTF-8）
      if (!convId || convId === 'default') {
        const title = message.slice(0, 50)
        const { rows: convRows } = await pool.query(
          `INSERT INTO ai_conversations (user_id, title, model_name, status)
           VALUES ($1, $2, $3, 'active') RETURNING id`,
          [user.id, title, env.DEERFLOW_MODEL]
        )
        convId = convRows[0]?.id?.toString()
        if (!convId) {
          return sendError(reply, 500, '创建会话失败')
        }
        // 记录 DeerFlow 线程 ID（leyova_<convId>，符合 DeerFlow 1-64 位命名约束）
        await pool.query(
          `UPDATE ai_conversations SET deerflow_thread_id = $2 WHERE id = $1`,
          [convId, toDeerFlowThreadId(convId)]
        ).catch(() => {}) // 兼容未执行 016 迁移的环境
      }

      // 3. 保存用户消息
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
        [convId, message]
      )
      await pool.query('UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1', [convId])

      // 4. 加载最近会话历史（供 DeerFlow/OpenClaw 上下文）
      const { rows: recentRows } = await pool.query(
        `SELECT role, content FROM ai_messages
         WHERE conversation_id = $1 AND role IN ('user', 'assistant')
         ORDER BY created_at DESC
         LIMIT 6`,
        [convId]
      )
      const history = recentRows
        .reverse()
        .map((r: any) => ({ role: r.role as 'user' | 'assistant', content: r.content }))

      // 5. 生成回复：OpenClaw 优先（主底座）→ DeerFlow 兜底 → 规则引擎兜底
      // 从 ai_context_bindings 加载用户的外部服务绑定
      const { rows: bindings } = await pool.query(
        `SELECT openviking_account, openviking_user, anythingllm_workspace,
                knowledge_role_workspace, knowledge_public_workspace
         FROM ai_context_bindings
         WHERE user_id = $1 AND scope_type = 'user' AND scope_id = $2
         LIMIT 1`,
        [user.id, `user:${user.id}`]
      ).catch(() => ({ rows: [] as any[] }))

      const scope: AiScopeContext = {
        userId: user.id,
        username: user.username,
        role: user.role,
        scopeType: 'user',
        scopeId: `user:${user.id}`,
        roomScope: [],
        openvikingAccount: bindings[0]?.openviking_account || 'leyova',
        openvikingUser: bindings[0]?.openviking_user || `leyova_${user.id}`,
        anythingllmWorkspace: bindings[0]?.anythingllm_workspace || 'leyova-knowledge',
        knowledgeRoleWorkspace: bindings[0]?.knowledge_role_workspace,
        knowledgePublicWorkspace: bindings[0]?.knowledge_public_workspace,
      }

      // 5. 执行自研 Agentic Orchestrator (四阶受控编排：Planner → Executor → Critic → Reporter)
      let replyText = ''
      let provider = 'agentic-orchestrator'
      let modelName = 'agentic-bi-v4'

      try {
        const analysisRes = await runAnalysis(
          {
            question: message,
            role: user.role,
            userId: user.id,
            conversationId: Number(convId),
          },
          null,
          pool
        )
        replyText = formatAnalysisToMarkdown(analysisRes)
      } catch (orchErr) {
        request.log.warn({ orchErr }, 'Agentic runAnalysis failed, fallback to rule engine')
        replyText = await generateDataDrivenReply(pool, message).catch(() => '')
        provider = 'fallback'
        modelName = 'rule-engine-fallback'
      }

      // 6. 保存 AI 回复
      if (replyText) {
        await pool.query(
          `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
          [convId, replyText]
        )
      }

      // 7. 记录工具调用审计日志（兼容旧库：表不存在时静默跳过）
      await logAiToolCall(pool, {
        conversationId: Number(convId),
        actorUserId: user.id,
        scope,
        toolName: provider === 'agentic-orchestrator'
          ? 'orchestrator.chat'
          : 'fallback.rule_engine',
        riskLevel: 'read_only',
        inputPayload: { message },
        resultSummary: replyText.slice(0, 500),
        modelName,
        status: 'success',
      })

      return sendOk(reply, {
        reply: replyText,
        conversationId: convId,
        provider,
        modelName,
      })
    } catch (err) {
      request.log.warn({ err }, 'ai/chat POST failed')
      const message = (request.body as any)?.message || ''
      const fallbackReply = await generateDataDrivenReply(getPool(), message).catch(() =>
        `感谢您的提问：**"${message}"**\n\n这是 AI 助手的回复。当前数据库查询异常，稍后将自动恢复。`
      )
      return sendOk(reply, {
        reply: fallbackReply,
        conversationId: 'default',
        provider: 'fallback',
      })
    }
  })

  // ── POST /api/v1/ai/chat/stream ── AI 流式回复（SSE）
  app.post('/api/v1/ai/chat/stream', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const body = request.body as { message: string; conversationId?: string; thinkingEnabled?: boolean; planMode?: boolean; subagentEnabled?: boolean }
      const message = (body?.message || '').trim()
      if (!message) {
        return sendError(reply, 400, '消息内容不能为空')
      }

      const runOptions = {
        thinkingEnabled: !!body?.thinkingEnabled,
        planMode: !!body?.planMode,
        subagentEnabled: !!body?.subagentEnabled,
      }

      let convId = body.conversationId

      // 1. 校验已有会话归属
      if (convId && convId !== 'default') {
        const ownership = await assertConversationOwnership(pool, convId, user)
        if (!ownership.ok) {
          return sendError(reply, 403, '会话不可访问')
        }
      }

      // 2. 创建新会话（标题按字符截断，规避 SQL_ASCII 库上 LEFT(...,50) 按字节截断中文导致无效 UTF-8）
      if (!convId || convId === 'default') {
        const title = message.slice(0, 50)
        const { rows: convRows } = await pool.query(
          `INSERT INTO ai_conversations (user_id, title, model_name, status)
           VALUES ($1, $2, $3, 'active') RETURNING id`,
          [user.id, title, env.DEERFLOW_MODEL]
        )
        convId = convRows[0]?.id?.toString()
        if (!convId) {
          return sendError(reply, 500, '创建会话失败')
        }
        // 记录 DeerFlow 线程 ID（leyova_<convId>，符合 DeerFlow 1-64 位命名约束）
        await pool.query(
          `UPDATE ai_conversations SET deerflow_thread_id = $2 WHERE id = $1`,
          [convId, toDeerFlowThreadId(convId)]
        ).catch(() => {}) // 兼容未执行 016 迁移的环境
      }

      // 3. 保存用户消息
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
        [convId, message]
      )
      await pool.query('UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1', [convId])

      // 4. 加载历史
      const { rows: recentRows } = await pool.query(
        `SELECT role, content FROM ai_messages
         WHERE conversation_id = $1 AND role IN ('user', 'assistant')
         ORDER BY created_at DESC LIMIT 6`,
        [convId]
      )
      const history = recentRows
        .reverse()
        .map((r: any) => ({ role: r.role as 'user' | 'assistant', content: r.content }))

      // 5. 加载 scope 绑定
      const { rows: bindings } = await pool.query(
        `SELECT openviking_account, openviking_user, anythingllm_workspace,
                knowledge_role_workspace, knowledge_public_workspace
         FROM ai_context_bindings
         WHERE user_id = $1 AND scope_type = 'user' AND scope_id = $2
         LIMIT 1`,
        [user.id, `user:${user.id}`]
      ).catch(() => ({ rows: [] as any[] }))

      const scope: AiScopeContext = {
        userId: user.id,
        username: user.username,
        role: user.role,
        scopeType: 'user',
        scopeId: `user:${user.id}`,
        roomScope: [],
        openvikingAccount: bindings[0]?.openviking_account || 'leyova',
        openvikingUser: bindings[0]?.openviking_user || `leyova_${user.id}`,
        anythingllmWorkspace: bindings[0]?.anythingllm_workspace || 'leyova-knowledge',
        knowledgeRoleWorkspace: bindings[0]?.knowledge_role_workspace,
        knowledgePublicWorkspace: bindings[0]?.knowledge_public_workspace,
      }

      // 6. 设置 SSE 响应头
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      // 发送 conversationId
      reply.raw.write(`data: ${JSON.stringify({ type: 'conversation', conversationId: convId })}\n\n`)

      // 7. 执行自研 Agentic Orchestrator (四阶受控编排：Planner → Executor → Critic → Reporter)
      let fullReply = ''
      let provider = 'agentic-orchestrator'

      try {
        // 发送规划阶段工具指示
        reply.raw.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'planner: 构建受控分析计划' })}\n\n`)

        const analysisRes = await runAnalysis(
          {
            question: message,
            role: user.role,
            userId: user.id,
            conversationId: Number(convId),
          },
          null,
          pool
        )

        // 转发工具执行步骤指示条（前端实时高亮正在调用的语义工具）
        for (const step of analysisRes.steps) {
          if (step.role === 'executor') {
            reply.raw.write(`data: ${JSON.stringify({ type: 'tool_call', tool: `${step.toolName}: 语义层精确取数` })}\n\n`)
          }
        }

        fullReply = formatAnalysisToMarkdown(analysisRes)

        // 逐块流式推送经过 Critic 100% 验证的分析结论 Markdown
        const chunks = fullReply.match(/[\s\S]{1,15}/g) || [fullReply]
        for (const chunk of chunks) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`)
        }
      } catch (orchErr) {
        request.log.warn({ orchErr }, 'Agentic stream runAnalysis failed, fallback to rule engine')
        provider = 'fallback'
        fullReply = await generateDataDrivenReply(pool, message)
        const chunks = fullReply.match(/[\s\S]{1,20}/g) || [fullReply]
        for (const chunk of chunks) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'token', content: chunk })}\n\n`)
        }
      }

      // 8. 保存 AI 回复
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
        [convId, fullReply]
      )

      // 9. 发送结束事件
      reply.raw.write(`data: ${JSON.stringify({ type: 'done', provider, conversationId: convId })}\n\n`)
      reply.raw.end()
    } catch (err) {
      request.log.warn({ err }, 'ai/chat/stream POST failed')
      // 如果 SSE 已开始，只能发送错误事件
      if (reply.raw.headersSent) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: '生成回复失败' })}\n\n`)
        reply.raw.end()
      } else {
        return sendError(reply, 500, '生成回复失败')
      }
    }
  })

  // ── GET /api/v1/ai/messages/:conversationId ── 获取对话消息（必须校验归属）
  app.get('/api/v1/ai/messages/:conversationId', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const { conversationId } = request.params as { conversationId: string }

      const ownership = await assertConversationOwnership(pool, conversationId, user)
      if (!ownership.ok) {
        return sendError(reply, 403, '会话不可访问')
      }

      const { rows } = await pool.query(
        `SELECT id, role, content, created_at FROM ai_messages
         WHERE conversation_id = $1 ORDER BY created_at`,
        [conversationId]
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'ai/messages query failed')
      return sendOk(reply, [])
    }
  })

  // ── DELETE /api/v1/ai/sessions/:conversationId ── 删除会话（软删除，必须校验归属）
  app.delete('/api/v1/ai/sessions/:conversationId', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const { conversationId } = request.params as { conversationId: string }

      const ownership = await assertConversationOwnership(pool, conversationId, user)
      if (!ownership.ok) {
        return sendError(reply, 403, '会话不可访问')
      }

      await pool.query(
        `UPDATE ai_conversations SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
        [conversationId]
      )
      return sendOk(reply, { id: conversationId }, '会话已删除')
    } catch (err) {
      request.log.warn({ err }, 'DELETE ai/sessions/:id failed')
      return sendError(reply, 500, '删除会话失败')
    }
  })

  // ── GET /api/v1/ai/tool-logs ── AI 工具调用日志（管理员审计）
  app.get('/api/v1/ai/tool-logs', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const query = request.query as { conversationId?: string; limit?: string }
      const limit = Math.min(parseInt(query.limit || '50'), 200)

      if (query.conversationId) {
        const ownership = await assertConversationOwnership(pool, query.conversationId, user)
        if (!ownership.ok) {
          return sendError(reply, 403, '会话不可访问')
        }
        const { rows } = await pool.query(
          `SELECT id, conversation_id, actor_user_id, scope_type, scope_id,
                  skill_code, tool_name, risk_level, approval_status,
                  duration_ms, status, error_code, model_name, created_at
           FROM ai_tool_logs
           WHERE conversation_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [query.conversationId, limit]
        )
        return sendOk(reply, rows)
      }

      // 非管理员只能看自己的日志
      const { rows } = await pool.query(
        `SELECT id, conversation_id, actor_user_id, scope_type, scope_id,
                skill_code, tool_name, risk_level, approval_status,
                duration_ms, status, error_code, model_name, created_at
         FROM ai_tool_logs
         WHERE actor_user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [user.id, limit]
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'ai/tool-logs query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/ai/pending-approvals ── 待审批的写操作列表
  app.get('/api/v1/ai/pending-approvals', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT t.id AS tool_log_id, t.tool_name, t.risk_level,
                t.input_payload, t.result_summary, t.created_at,
                a.id AS approval_id, a.status AS approval_status, a.expires_at
         FROM ai_tool_logs t
         JOIN ai_action_approvals a ON a.tool_log_id = t.id
         WHERE t.actor_user_id = $1 AND a.status = 'pending'
         ORDER BY t.created_at DESC
         LIMIT 50`,
        [user.id]
      )
      return sendOk(reply, rows)
    } catch {
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/ai/approve/:toolLogId ── 批准一个写操作
  app.post('/api/v1/ai/approve/:toolLogId', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const { toolLogId } = request.params as { toolLogId: string }
      const logId = parseInt(toolLogId)

      // 1. 查 tool_log 和 approval
      const { rows } = await pool.query(
        `SELECT t.id, t.actor_user_id, t.tool_name, t.input_payload,
                a.id AS approval_id, a.status AS approval_status, a.expires_at
         FROM ai_tool_logs t
         JOIN ai_action_approvals a ON a.tool_log_id = t.id
         WHERE t.id = $1 AND t.actor_user_id = $2`,
        [logId, user.id]
      )

      const action = resolveApprovalAction(rows[0])
      if (action.kind === 'not_found') {
        return sendError(reply, 404, '审批请求不存在')
      }

      const approval = rows[0]
      if (action.kind === 'not_pending') {
        return sendError(reply, 400, `审批状态为 ${action.status}，无法重复操作`)
      }

      // 2. 检查是否过期
      if (action.kind === 'expired') {
        await pool.query(
          `UPDATE ai_action_approvals SET status = 'expired' WHERE id = $1`,
          [approval.approval_id]
        )
        await pool.query(
          `UPDATE ai_tool_logs SET approval_status = 'expired' WHERE id = $1`,
          [logId]
        )
        return sendError(reply, 400, '审批已过期')
      }

      // 3. 更新审批状态
      await pool.query(
        `UPDATE ai_action_approvals
         SET status = 'approved', approved_by = $2, approved_at = NOW(), executed_at = NOW()
         WHERE id = $1`,
        [approval.approval_id, user.id]
      )
      await pool.query(
        `UPDATE ai_tool_logs SET approval_status = 'approved' WHERE id = $1`,
        [logId]
      )

      // 4. 执行工具（从 tool registry 获取）
      const { executeTool, getTool } = await import('../ai/tool-registry.js')
      const tool = getTool(approval.tool_name)
      if (!tool) {
        return sendError(reply, 500, `工具 ${approval.tool_name} 不存在`)
      }

      const { getPool } = await import('../lib/db.js')
      const result = await executeTool(approval.tool_name, approval.input_payload, {
        userId: user.id,
        role: user.role,
        scope: {
          userId: user.id,
          username: user.username,
          role: user.role,
          scopeType: 'user' as const,
          scopeId: `user:${user.id}`,
          roomScope: [],
        },
        pool: getPool(),
      })

      return sendOk(reply, {
        toolLogId: logId,
        toolName: approval.tool_name,
        result,
      })
    } catch (err) {
      request.log.warn({ err }, 'POST ai/approve failed')
      return sendError(reply, 500, '审批执行失败')
    }
  })

  // ── POST /api/v1/ai/reject/:toolLogId ── 拒绝一个写操作
  app.post('/api/v1/ai/reject/:toolLogId', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const { toolLogId } = request.params as { toolLogId: string }
      const logId = parseInt(toolLogId)

      const { rows } = await pool.query(
        `SELECT t.actor_user_id, a.id AS approval_id, a.status AS approval_status
         FROM ai_tool_logs t
         JOIN ai_action_approvals a ON a.tool_log_id = t.id
         WHERE t.id = $1 AND t.actor_user_id = $2`,
        [logId, user.id]
      )

      const action = resolveRejectAction(rows[0])
      if (action.kind === 'not_found') {
        return sendError(reply, 404, '审批请求不存在')
      }

      if (action.kind === 'not_pending') {
        return sendError(reply, 400, `审批状态为 ${action.status}，无法操作`)
      }

      await pool.query(
        `UPDATE ai_action_approvals
         SET status = 'rejected', approved_by = $2, approved_at = NOW()
         WHERE id = $1`,
        [rows[0].approval_id, user.id]
      )
      await pool.query(
        `UPDATE ai_tool_logs SET approval_status = 'rejected', status = 'rejected' WHERE id = $1`,
        [logId]
      )

      return sendOk(reply, { toolLogId: logId, status: 'rejected' })
    } catch (err) {
      request.log.warn({ err }, 'POST ai/reject failed')
      return sendError(reply, 500, '拒绝操作失败')
    }
  })

  // ── GET /api/v1/ai/context-bindings ── 查看当前用户的外部服务绑定
  app.get('/api/v1/ai/context-bindings', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT id, scope_type, scope_id,
                openviking_account, openviking_user, anythingllm_workspace,
                knowledge_role_workspace, knowledge_public_workspace,
                visibility, created_at, updated_at
         FROM ai_context_bindings
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [user.id]
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'GET ai/context-bindings failed')
      return sendOk(reply, [])
    }
  })

  // ── POST /api/v1/ai/context-bindings ── 创建或更新外部服务绑定
  app.post('/api/v1/ai/context-bindings', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const body = request.body as {
        scopeType?: string
        scopeId?: string
        openvikingAccount?: string
        openvikingUser?: string
        anythingllmWorkspace?: string
        knowledgeRoleWorkspace?: string
        knowledgePublicWorkspace?: string
        visibility?: string
      }

      const scopeType = body.scopeType || 'user'
      const scopeId = body.scopeId || `user:${user.id}`
      const openvikingAccount = body.openvikingAccount || 'leyova'
      const openvikingUser = body.openvikingUser || `leyova_${user.id}`
      const anythingllmWorkspace = body.anythingllmWorkspace || 'leyova-knowledge'
      const knowledgeRoleWorkspace = body.knowledgeRoleWorkspace || null
      const knowledgePublicWorkspace = body.knowledgePublicWorkspace || null
      const visibility = body.visibility || 'private'

      const { rows } = await pool.query(
        `INSERT INTO ai_context_bindings
           (user_id, scope_type, scope_id,
            openviking_account, openviking_user, anythingllm_workspace,
            knowledge_role_workspace, knowledge_public_workspace, visibility)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, scope_type, scope_id) DO UPDATE SET
           openviking_account = EXCLUDED.openviking_account,
           openviking_user = EXCLUDED.openviking_user,
           anythingllm_workspace = EXCLUDED.anythingllm_workspace,
           knowledge_role_workspace = EXCLUDED.knowledge_role_workspace,
           knowledge_public_workspace = EXCLUDED.knowledge_public_workspace,
           visibility = EXCLUDED.visibility,
           updated_at = NOW()
         RETURNING *`,
        [user.id, scopeType, scopeId, openvikingAccount, openvikingUser,
         anythingllmWorkspace, knowledgeRoleWorkspace, knowledgePublicWorkspace, visibility]
      )

      return sendOk(reply, rows[0], '绑定已保存')
    } catch (err) {
      request.log.warn({ err }, 'POST ai/context-bindings failed')
      return sendError(reply, 500, '保存绑定失败')
    }
  })

  // ── DELETE /api/v1/ai/context-bindings/:id ── 删除绑定
  app.delete('/api/v1/ai/context-bindings/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const pool = getPool()
    try {
      const { id } = request.params as { id: string }

      const { rowCount } = await pool.query(
        `DELETE FROM ai_context_bindings WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      )

      if (rowCount === 0) {
        return sendError(reply, 404, '绑定记录不存在或无权删除')
      }

      return sendOk(reply, { id }, '绑定已删除')
    } catch (err) {
      request.log.warn({ err }, 'DELETE ai/context-bindings failed')
      return sendError(reply, 500, '删除绑定失败')
    }
  })
}

// 注：会话归属校验 assertConversationOwnership 已迁移至 src/lib/ai-access.ts

// ── 记录 AI 工具调用审计日志 ──
async function logAiToolCall(
  pool: any,
  params: {
    conversationId: number
    actorUserId: number
    scope: AiScopeContext
    toolName: string
    riskLevel: 'read_only' | 'write_with_approval' | 'admin_only' | 'forbidden'
    inputPayload: Record<string, unknown>
    resultSummary: string
    modelName: string
    status: 'success' | 'failed' | 'rejected' | 'timeout'
  }
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ai_tool_logs
         (conversation_id, actor_user_id, scope_type, scope_id,
          tool_name, risk_level, input_payload, result_summary,
          approval_status, status, model_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'auto', $9, $10)`,
      [
        params.conversationId,
        params.actorUserId,
        params.scope.scopeType,
        params.scope.scopeId,
        params.toolName,
        params.riskLevel,
        JSON.stringify(params.inputPayload),
        params.resultSummary,
        params.status,
        params.modelName,
      ]
    )
  } catch {
    // 表不存在时静默跳过（兼容未执行迁移的环境）
  }
}

// ── 数据驱动回复（只读 fallback，OpenClaw 不可用时使用） ──
async function generateDataDrivenReply(pool: any, message: string): Promise<string> {
  const msg = message.toLowerCase()

  if (msg.includes('主播') || msg.includes('排行') || msg.includes('主播排名')) {
    const { rows } = await pool.query(
      `SELECT a.name,
              COALESCE(SUM(ls.gmv), 0) AS total_gmv,
              COALESCE(SUM(ls.orders), 0) AS total_orders,
              COALESCE(AVG(ls.uv_value), 0) AS avg_uv,
              COALESCE(AVG(ls.interaction_rate), 0) AS avg_interaction
       FROM anchors a
       JOIN live_sessions ls ON ls.anchor_id = a.id AND ls.status = 'completed'
       WHERE a.status = 1
       GROUP BY a.id, a.name
       ORDER BY total_gmv DESC`
    )
    if (rows.length === 0) {
      return '当前暂无主播数据。请确认是否已导入主播分析数据。'
    }
    let reply = '**🎤 主播业绩排行**\n\n'
    rows.forEach((r: any, i: number) => {
      reply += `${i + 1}. **${r.name}** — GMV ¥${(r.total_gmv / 10000).toFixed(1)}万 | 订单 ${r.total_orders} | UV ${parseFloat(r.avg_uv).toFixed(2)} | 互动 ${parseFloat(r.avg_interaction).toFixed(1)}%\n`
    })
    reply += '\n> 数据来源：live_sessions（全部已完成场次）'
    return reply
  }

  if (msg.includes('渠道') || msg.includes('投放') || msg.includes('feed') || msg.includes('短视频')) {
    const { rows } = await pool.query(
      `SELECT sc.channel,
              COALESCE(SUM(sc.gmv), 0) AS total_gmv,
              COALESCE(SUM(sc.orders), 0) AS total_orders,
              COALESCE(SUM(sc.views), 0) AS total_views,
              COALESCE(SUM(sc.ad_spend), 0) AS total_spend,
              COALESCE(SUM(sc.gmv) / NULLIF(SUM(sc.ad_spend), 0), 0) AS roi
       FROM session_channel_metrics sc
       GROUP BY sc.channel
       ORDER BY total_gmv DESC`
    )
    if (rows.length === 0) {
      return '当前暂无渠道数据。请确认是否已导入渠道分析数据。'
    }
    let reply = '**📡 渠道表现总览**\n\n'
    rows.forEach((r: any) => {
      const spendInfo = r.total_spend > 0 ? ` | 投放 ¥${(r.total_spend / 10000).toFixed(1)}万 | ROI ${parseFloat(r.roi).toFixed(2)}` : ''
      reply += `- **${r.channel}** — GMV ¥${(r.total_gmv / 10000).toFixed(1)}万 | 订单 ${r.total_orders} | 观看 ${r.total_views.toLocaleString()}${spendInfo}\n`
    })
    reply += '\n> 数据来源：session_channel_metrics（全部数据）'
    return reply
  }

  if (msg.includes('互动') || msg.includes('留存') || msg.includes('uv')) {
    const { rows } = await pool.query(
      `SELECT a.name,
              COALESCE(AVG(ls.interaction_rate), 0) AS avg_interaction,
              COALESCE(AVG(ls.retention_rate), 0) AS avg_retention,
              COALESCE(AVG(ls.uv_value), 0) AS avg_uv,
              COALESCE(AVG(ls.gpm), 0) AS avg_gpm
       FROM anchors a
       JOIN live_sessions ls ON ls.anchor_id = a.id AND ls.status = 'completed'
       GROUP BY a.id, a.name
       ORDER BY avg_interaction DESC`
    )
    let reply = '**📈 互动与留存数据**\n\n'
    reply += `| 主播 | 互动率 | 留存率 | UV价值 | GPM |\n`
    reply += `|------|--------|--------|--------|------|\n`
    rows.forEach((r: any) => {
      reply += `| ${r.name} | ${parseFloat(r.avg_interaction).toFixed(1)}% | ${parseFloat(r.avg_retention).toFixed(1)}% | ${parseFloat(r.avg_uv).toFixed(2)} | ¥${parseFloat(r.avg_gpm).toFixed(0)} |\n`
    })
    return reply
  }

  if (msg.includes('gmv') || msg.includes('销售') || msg.includes('业绩') || msg.includes('营收')) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(gmv), 0) AS total_gmv,
              COALESCE(SUM(orders), 0) AS total_orders,
              COALESCE(COUNT(*), 0) AS sessions
       FROM live_sessions WHERE status = 'completed'`
    )
    const r = rows[0]
    return `**📊 整体业绩数据**\n\n` +
      `- 总 GMV：**¥${(r.total_gmv / 10000).toFixed(1)}万**\n` +
      `- 总订单：**${r.total_orders} 单**\n` +
      `- 直播场次：**${r.sessions} 场**\n\n` +
      `> 数据来源：live_sessions 表（所有已完成场次）`
  }

  if (msg.includes('你好') || msg.includes('嗨') || msg.includes('hello') || msg.includes('hi')) {
    return `你好！👋 我是 **leyova AI 助手**，可以帮你查询以下实时数据：\n\n` +
      `- **📊 GMV/业绩** — 查询整体销售数据和订单量\n` +
      `- **🎤 主播排行** — 查看主播业绩排名和关键指标\n` +
      `- **📡 渠道分析** — 了解各渠道投放效果和 ROI\n` +
      `- **📈 互动留存** — 查看互动率、留存率、UV价值\n` +
      `- **⚠️ 异常检测** — 了解当前未处理的预警事件\n` +
      `- **📋 日报简报** — 生成今日数据日报\n\n` +
      `请问你想查询什么？`
  }

  if (msg.includes('帮助') || msg.includes('功能') || msg.includes('能力')) {
    return `**🔍 可用分析能力**\n\n` +
      `1. **业绩查询** — 输入"GMV"、"业绩"、"销售" → 查看整体数据\n` +
      `2. **主播排行** — 输入"主播"、"排行"、"表现" → 查看主播排名\n` +
      `3. **渠道分析** — 输入"渠道"、"投放"、"feed" → 查看渠道效果\n` +
      `4. **互动数据** — 输入"互动"、"留存"、"UV" → 查看互动指标\n` +
      `5. **日报简报** — 输入"日报"、"简报" → 生成今日数据日报\n` +
      `6. **异常预警** — 输入"异常"、"预警"、"告警" → 查看待处理事件\n\n` +
      `> 所有数据均来自数据库实时查询，确保分析结果的准确性。`
  }

  if (msg.includes('异常') || msg.includes('预警') || msg.includes('告警')) {
    const { rows } = await pool.query(
      `SELECT severity, title, description, event_time
       FROM alert_events WHERE status = 'pending'
       ORDER BY event_time DESC LIMIT 5`
    )
    if (rows.length === 0) {
      return '✅ 当前没有待处理的预警事件，系统运行正常。'
    }
    let reply = `**⚠️ 待处理预警（${rows.length} 条）**\n\n`
    rows.forEach((r: any) => {
      const icon = r.severity === 'critical' ? '🔴' : r.severity === 'warning' ? '🟡' : '🔵'
      reply += `${icon} **${r.title}**\n  ${(r.description || '').slice(0, 100)}\n`
    })
    reply += '\n> 前往"异常中心"可查看更多详情和处理。'
    return reply
  }

  if (msg.includes('日报') || msg.includes('简报') || msg.includes('summary')) {
    const today = new Date().toISOString().slice(0, 10)
    // 优先返回后台 cron（每日 01:15）生成的「leyova 经营日报」
    const { rows: stored } = await pool.query(
      `SELECT m.content FROM ai_conversations c
       JOIN ai_messages m ON m.conversation_id = c.id
       WHERE c.title = $1 AND m.role = 'assistant'
       ORDER BY m.created_at DESC LIMIT 1`,
      [`daily-${today}`]
    )
    if (stored[0]?.content) {
      return stored[0].content
    }
    // 尚未生成时回退到实时简版，保证用户能看到数据
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(gmv), 0) AS total_gmv,
         COALESCE(SUM(orders), 0) AS total_orders,
         COALESCE(SUM(views), 0) AS total_views,
         COALESCE(AVG(uv_value), 0) AS avg_uv_value,
         COALESCE(AVG(interaction_rate), 0) AS avg_interaction_rate,
         COALESCE(AVG(retention_rate), 0) AS avg_retention_rate,
         COUNT(*) AS session_count
       FROM live_sessions WHERE date = CURRENT_DATE AND status = 'completed'`
    )
    const r = rows[0]
    return `# 📊 leyova 数据日报\n\n` +
      `## 今日概览\n` +
      `- 直播场次：${r.session_count} 场\n` +
      `- 总 GMV：¥${(r.total_gmv / 10000).toFixed(1)}万\n` +
      `- 总订单：${r.total_orders} 单\n` +
      `- 总观看：${r.total_views.toLocaleString()}\n` +
      `- 平均 UV 价值：${parseFloat(r.avg_uv_value).toFixed(2)}\n` +
      `- 平均互动率：${parseFloat(r.avg_interaction_rate).toFixed(1)}%\n` +
      `- 平均留存率：${parseFloat(r.avg_retention_rate).toFixed(1)}%\n\n` +
      `> 📅 ${new Date().toISOString().slice(0, 10)} | 数据来自实时查询`
  }

  // 默认回复
  const { rows: summary } = await pool.query(
    `SELECT COUNT(*)::int AS total_sessions,
            COALESCE(SUM(gmv), 0) AS total_gmv
     FROM live_sessions WHERE status = 'completed'`
  )
  return `已收到您的消息：**"${message}"**\n\n` +
    `当前系统共有 **${summary[0].total_sessions} 场** 已完成直播，累计 GMV **¥${(summary[0].total_gmv / 10000).toFixed(1)}万**。\n\n` +
    `您可以向我询问以下内容：\n` +
    `- **GMV/业绩** — 查询整体销售数据\n` +
    `- **主播排行** — 各主播业绩排名\n` +
    `- **渠道分析** — 各渠道投放效果\n` +
    `- **互动留存** — 互动率、留存率、UV价值\n` +
    `- **异常预警** — 待处理的异常事件\n` +
    `- **日报简报** — 今日数据日报`
}
