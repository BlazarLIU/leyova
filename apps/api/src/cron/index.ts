import { logger } from '../lib/logger.js'
import { getPool } from '../lib/db.js'
import { aggregateDailyStats } from './aggregate-stats.js'
import { searchMemory } from '../lib/openviking-client.js'
import { searchKnowledge } from '../lib/anythingllm-client.js'
import { getLlmProvider } from '../ai/llm/index.js'
import type { AiScopeContext } from '../lib/ai-types.js'

const LEYOVA_SYSTEM_PROMPT = '你是乐友电商经营分析助手，请基于提供的经营指标输出准确的分析报告。'

async function requestLlmReply(prompt: string): Promise<{ reply: string; model: string } | null> {
  const { config, provider } = await getLlmProvider()
  if (provider.isAvailable()) {
    const res = await provider.chat(
      [
        { role: 'system', content: LEYOVA_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      { trace: { operationName: 'cron.requestLlmReply' } }
    )
    if (res?.reply) return { reply: res.reply, model: res.model || config.model || 'llm' }
  }
  return null
}

/**
 * Runs a one-off data sync for initial load / catch-up.
 * Called once at startup if needed.
 */
export async function runInitialDataSync(): Promise<void> {
  logger.info('Running initial data sync (aggregating today\'s stats)...')
  await aggregateDailyStats()
  logger.info('Initial data sync completed')
}

export async function runReviewDrafts(): Promise<void> {
  const pool = getPool()
  const scope: AiScopeContext = {
    userId: 0,
    username: 'system',
    role: 'system',
    scopeType: 'org',
    scopeId: 'org:leyova',
    roomScope: [],
  }

  const { rows: sessions } = await pool.query(
    `SELECT ls.id, ls.title, ls.date, ls.gmv, ls.orders, ls.views,
            ls.uv_value, ls.interaction_rate, ls.retention_rate, ls.gpm,
            a.name AS anchor_name, r.name AS room_name
     FROM live_sessions ls
     LEFT JOIN anchors a ON a.id = ls.anchor_id
     LEFT JOIN live_rooms r ON r.id = ls.room_id
     WHERE ls.status = 'completed'
       AND ls.date = CURRENT_DATE - 1
     ORDER BY ls.gmv DESC
     LIMIT 5`
  )

  if (sessions.length === 0) return

  for (const s of sessions) {
    const reviewTitle = `review-${s.id}-${s.date}`
    const { rows: existing } = await pool.query(
      `SELECT id FROM ai_conversations WHERE title = $1 LIMIT 1`,
      [reviewTitle]
    )
    if (existing.length > 0) continue

    const memory = await searchMemory(
      `复盘 直播 ${s.room_name} ${s.anchor_name} GMV下降`,
      scope
    ).catch(() => null)

    const knowledge = await searchKnowledge(
      `直播复盘 SOP 异常归因`
    ).catch(() => null)

    const prompt = [
      `请为以下直播场次生成一份结构化复盘草稿，输出：`,
      `1. 问题`,
      `2. 原因`,
      `3. 改进建议`,
      ``,
      `场次信息：`,
      `- 场次ID：${s.id}`,
      `- 日期：${s.date}`,
      `- 直播间：${s.room_name || '未知'}`,
      `- 主播：${s.anchor_name || '未知'}`,
      `- GMV：${s.gmv}`,
      `- 订单：${s.orders}`,
      `- 观看：${s.views}`,
      `- UV价值：${s.uv_value}`,
      `- 互动率：${s.interaction_rate}`,
      `- 留存率：${s.retention_rate}`,
      `- GPM：${s.gpm}`,
      memory ? `\n历史记忆参考：\n${memory}` : '',
      knowledge ? `\n知识库参考：\n${knowledge}` : '',
    ].join('\n')

    const llmOutcome = await requestLlmReply(prompt)
    const replyText = llmOutcome?.reply ||
      `### 🎙️ 直播场次自动复盘（确定性汇总）\n- 场次：${s.title}\n- 主播：${s.anchor_name || '未知'}\n- GMV：${s.gmv} 元\n- 订单：${s.orders}\n- 千次展现成交 (GPM)：${s.gpm} 元`
    const modelName = llmOutcome?.model || 'rule-engine-fallback'

    if (replyText) {
      const { rows: convRows } = await pool.query(
        `INSERT INTO ai_conversations (user_id, title, model_name, status)
         VALUES (1, $1, $2, 'active') RETURNING id`,
        [reviewTitle, modelName]
      ).catch(() => ({ rows: [] as any[] }))

      if (convRows.length > 0) {
        await pool.query(
          `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
          [convRows[0].id, replyText]
        ).catch(() => { })
      }
    }
  }
}
