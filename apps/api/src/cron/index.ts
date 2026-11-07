import cron from 'node-cron'
import { logger } from '../lib/logger.js'
import { getPool } from '../lib/db.js'
import { aggregateDailyStats } from './aggregate-stats.js'
import { detectAnomalies } from './detect-anomalies.js'
import { archiveOldData } from './archive-old-data.js'
import { ensureAllPartitions } from './manage-partitions.js'
import { runFactAggregation } from './aggregate-facts.js'
import { runAllPlatformsSync } from '../ingest/sync-job.js'
import { searchMemory } from '../lib/openviking-client.js'
import { searchKnowledge } from '../lib/anythingllm-client.js'
import { requestOpenClawReply, LEYOVA_SYSTEM_PROMPT, type AiScopeContext } from '../lib/ai-gateway.js'

/**
 * Registers all recurring cron jobs.
 * Call this once during server startup.
 */
export function registerCronJobs(): void {
  logger.info('Registering cron jobs...')

  // ── Aggregate daily stats: daily at 01:00 ──
  cron.schedule('0 1 * * *', async () => {
    logger.info('[cron] Running aggregateDailyStats')
    await aggregateDailyStats()
  })

  // ── Anomaly detection: every hour ──
  cron.schedule('0 * * * *', async () => {
    logger.info('[cron] Running detectAnomalies')
    await detectAnomalies()
  })

  // ── Archive old data: daily at 03:00 ──
  cron.schedule('0 3 * * *', async () => {
    logger.info('[cron] Running archiveOldData')
    await archiveOldData()
  })

  // ── Partition maintenance: daily at 04:00，提前创建未来 3 个月分区 ──
  cron.schedule('0 4 * * *', async () => {
    logger.info('[cron] Running ensureAllPartitions')
    try {
      const r = await ensureAllPartitions(3)
      logger.info({ created: r.created, errors: r.errors.length }, '[cron] partition maintenance done')
    } catch (err) {
      logger.error({ err }, '[cron] ensureAllPartitions failed')
    }
  })

  // ── 多平台事实表聚合：每天 01:30（在 01:00 旧链路聚合之后）──
  cron.schedule('30 1 * * *', async () => {
    logger.info('[cron] Running fact aggregation (agg_shop_daily / agg_platform_monthly)')
    try {
      const r = await runFactAggregation()
      logger.info({ days: r.dates.length, months: r.months.length }, '[cron] fact aggregation done')
    } catch (err) {
      logger.error({ err }, '[cron] fact aggregation failed')
    }
  })

  // ── Multi-platform API sync: daily at 05:00（仅已授权店铺实际拉数，未授权自动跳过）──
  cron.schedule('0 5 * * *', async () => {
    logger.info('[cron] Running multi-platform trade sync')
    try {
      const results = await runAllPlatformsSync(getPool(), 'trade')
      const done = results.filter((r) => r.status === 'completed').length
      logger.info({ total: results.length, completed: done }, '[cron] multi-platform sync done')
    } catch (err) {
      logger.error({ err }, '[cron] multi-platform sync failed')
    }
  })

  // ── AI automation jobs ──
  // 已暂停（按需求）：AI 经营日报 与 巡检记录 定时任务暂不注册。
  // 原配置（代码保留，如需恢复取消注释即可）：
  //   日报：cron.schedule('15 1 * * *', ...) → runDailyAiBriefing()
  //   巡检：cron.schedule('30 12 / 0 17 / 30 21 / 0 2 * * *', ...) → runAnomalyPatrol()
  //     （08:00–02:00 段每 4.5h 一次，08:00 不巡，02:00 最后一次）

  // ── AI review draft: daily at 02:30 ──
  cron.schedule('30 2 * * *', async () => {
    logger.info('[cron-ai] Generating review drafts for completed sessions')
    await runReviewDrafts()
  })

  // ── Health check for dev: every 5 min in development ──
  if (process.env.NODE_ENV !== 'production') {
    cron.schedule('*/5 * * * *', () => {
      logger.debug('[cron] Health check tick')
    })
  }

  logger.info('All cron jobs registered')
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

// ---------------------------------------------------------------------------
// AI automation jobs
// ---------------------------------------------------------------------------

async function runDailyAiBriefing(): Promise<void> {
  const pool = getPool()
  const today = new Date().toISOString().slice(0, 10)
  const scope: AiScopeContext = {
    userId: 0,
    username: 'system',
    role: 'system',
    scopeType: 'org',
    scopeId: 'org:leyova',
    roomScope: [],
  }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total_sessions,
            COALESCE(SUM(gmv), 0) AS total_gmv,
            COALESCE(SUM(orders), 0) AS total_orders
     FROM live_sessions WHERE date = CURRENT_DATE AND status = 'completed'`
  )
  const summary = rows[0]
  const prompt = `请基于今日经营数据生成一份简短日报，输出：概览、异常、建议。\n\n数据：\n- 日期：${today}\n- 直播场次：${summary.total_sessions}\n- GMV：${summary.total_gmv}\n- 订单：${summary.total_orders}`

  const reply = await requestOpenClawReply({
    message: prompt,
    conversationId: `daily-${today}`,
    modelName: process.env.OPENCLAW_MODEL || 'claude-opus-4.6',
    context: scope,
    systemPrompt: LEYOVA_SYSTEM_PROMPT,
    history: [],
  })

  if (reply?.reply) {
    const { rows: convRows } = await pool.query(
      `INSERT INTO ai_conversations (user_id, title, model_name, status)
       VALUES (1, $1, $2, 'active') RETURNING id`,
      [`daily-${today}`, process.env.OPENCLAW_MODEL || 'claude-opus-4.6']
    ).catch(() => ({ rows: [] as any[] }))

    if (convRows.length > 0) {
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
        [convRows[0].id, reply.reply]
      ).catch(() => {})
    }
  }
}

async function runAnomalyPatrol(): Promise<void> {
  const pool = getPool()
  const scope: AiScopeContext = {
    userId: 0,
    username: 'system',
    role: 'system',
    scopeType: 'org',
    scopeId: 'org:leyova',
    roomScope: [],
  }

  const { rows } = await pool.query(
    `SELECT title, description, severity, event_time
     FROM alert_events
     WHERE status = 'pending'
     ORDER BY event_time DESC
     LIMIT 10`
  )

  if (rows.length === 0) return

  const memory = await searchMemory('异常巡检 待处理预警', scope).catch(() => null)
  const knowledge = await searchKnowledge('异常巡检 运营建议').catch(() => null)
  const prompt = [
    '请根据以下待处理预警，生成一份巡检摘要，包含：',
    '1. 关键异常',
    '2. 可能原因',
    '3. 建议处理动作',
    '',
    '预警列表：',
    JSON.stringify(rows, null, 2),
    memory ? `\n历史记忆参考：\n${memory}` : '',
    knowledge ? `\n知识库参考：\n${knowledge}` : '',
  ].join('\n')

  const reply = await requestOpenClawReply({
    message: prompt,
    conversationId: `patrol-${Date.now()}`,
    modelName: process.env.OPENCLAW_MODEL || 'claude-opus-4.6',
    context: scope,
    systemPrompt: LEYOVA_SYSTEM_PROMPT,
    history: [],
  })

  if (reply?.reply) {
    const { rows: convRows } = await pool.query(
      `INSERT INTO ai_conversations (user_id, title, model_name, status)
       VALUES (1, $1, $2, 'active') RETURNING id`,
      [`patrol-${new Date().toISOString().slice(0,10)}`, process.env.OPENCLAW_MODEL || 'claude-opus-4.6']
    ).catch(() => ({ rows: [] as any[] }))

    if (convRows.length > 0) {
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
        [convRows[0].id, reply.reply]
      ).catch(() => {})
    }
  }
}

async function runReviewDrafts(): Promise<void> {
  const pool = getPool()
  const scope: AiScopeContext = {
    userId: 0,
    username: 'system',
    role: 'system',
    scopeType: 'org',
    scopeId: 'org:leyova',
    roomScope: [],
  }

  // Find sessions completed yesterday that don't have a review yet.
  // We check ai_conversations titles to avoid duplicating.
  const { rows: sessions } = await pool.query(
    `SELECT ls.id, ls.date, ls.gmv, ls.orders, ls.views,
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
    // Skip if review already exists
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

    const reply = await requestOpenClawReply({
      message: prompt,
      conversationId: reviewTitle,
      modelName: process.env.OPENCLAW_MODEL || 'claude-opus-4.6',
      context: scope,
      systemPrompt: LEYOVA_SYSTEM_PROMPT,
      history: [],
    })

    if (reply?.reply) {
      const { rows: convRows } = await pool.query(
        `INSERT INTO ai_conversations (user_id, title, model_name, status)
         VALUES (1, $1, $2, 'active') RETURNING id`,
        [reviewTitle, process.env.HERMES_MODEL || 'claude-opus-4.6']
      ).catch(() => ({ rows: [] as any[] }))

      if (convRows.length > 0) {
        await pool.query(
          `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
          [convRows[0].id, reply.reply]
        ).catch(() => {})
      }
    }
  }
}
