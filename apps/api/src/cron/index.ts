import cron from 'node-cron'
import { logger } from '../lib/logger.js'
import { getPool } from '../lib/db.js'
import { aggregateDailyStats } from './aggregate-stats.js'
import { detectAnomalies } from './detect-anomalies.js'
import { archiveOldData } from './archive-old-data.js'
import { ensureAllPartitions } from './manage-partitions.js'
import { runFactAggregation } from './aggregate-facts.js'
import { runAllPlatformsSync } from '../ingest/sync-job.js'
import { rotateAllFiles } from '../cli/cleanup-logs.js'
import { searchMemory } from '../lib/openviking-client.js'
import { searchKnowledge } from '../lib/anythingllm-client.js'
import { defaultLlmProvider } from '../ai/llm/openai-compatible.js'
import type { AiScopeContext } from '../lib/ai-types.js'

const LEYOVA_SYSTEM_PROMPT = '你是乐友电商经营分析助手，请基于提供的经营指标输出准确的分析报告。'

async function requestLlmReply(prompt: string): Promise<string | null> {
  if (defaultLlmProvider.isAvailable()) {
    const res = await defaultLlmProvider.chat([
      { role: 'system', content: LEYOVA_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ])
    if (res?.reply) return res.reply
  }
  return null
}

import { runCompliancePatrolJob } from './compliance-patrol.js'

/**
 * 统一受控任务执行包装：将每次定时任务运行状态/耗时/异常持久化写入 system_jobs
 */
async function runTrackedJob<T>(
  jobType: string,
  jobName: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const pool = getPool()
  const startedAt = Date.now()
  let jobId: number | null = null
  try {
    const ins = await pool.query<{ id: number }>(
      `INSERT INTO system_jobs (job_type, job_name, status, run_at, started_at)
       VALUES ($1, $2, 'running', NOW(), NOW())
       RETURNING id`,
      [jobType, jobName],
    )
    jobId = ins.rows[0]?.id ?? null
  } catch (err) {
    logger.warn({ err, jobType }, '[cron] failed to record system_jobs start')
  }

  try {
    const result = await fn()
    if (jobId !== null) {
      await pool.query(
        `UPDATE system_jobs
         SET status = 'completed',
             finished_at = NOW(),
             updated_at = NOW(),
             result_payload = $2::jsonb
         WHERE id = $1`,
        [jobId, JSON.stringify({ durationMs: Date.now() - startedAt, summary: result ?? {} })],
      ).catch((err) => logger.warn({ err, jobId }, '[cron] failed to record system_jobs completion'))
    }
    return result
  } catch (err: any) {
    logger.error({ err, jobType }, `[cron] ${jobName} failed`)
    if (jobId !== null) {
      await pool.query(
        `UPDATE system_jobs
         SET status = 'failed',
             finished_at = NOW(),
             updated_at = NOW(),
             error_message = $2
         WHERE id = $1`,
        [jobId, String(err?.message || err).slice(0, 2000)],
      ).catch((uErr) => logger.warn({ uErr, jobId }, '[cron] failed to record system_jobs error'))
    }
    return null
  }
}

/**
 * Registers all recurring cron jobs.
 * Call this once during server startup.
 */
export function registerCronJobs(): void {
  logger.info('Registering cron jobs...')

  // ── Aggregate daily stats: daily at 01:00 ──
  cron.schedule('0 1 * * *', async () => {
    await runTrackedJob('aggregate_daily_stats', '日汇总统计', () => aggregateDailyStats())
  })

  // ── Anomaly detection: every hour ──
  cron.schedule('0 * * * *', async () => {
    await runTrackedJob('anomaly_detection', '小时级异常检测', () => detectAnomalies())
  })

  // ── Archive old data: daily at 03:00 ──
  cron.schedule('0 3 * * *', async () => {
    await runTrackedJob('archive_old_data', '冷数据归档', () => archiveOldData())
  })

  // ── Partition maintenance: daily at 04:00，提前创建未来 3 个月分区 ──
  cron.schedule('0 4 * * *', async () => {
    await runTrackedJob('partition_maintenance', '分区自动预建与DEFAULT守护', async () => {
      const r = await ensureAllPartitions(3)
      logger.info({ created: r.created, errors: r.errors.length }, '[cron] partition maintenance done')
      return { createdCount: r.created.length, existingCount: r.existing.length, errorCount: r.errors.length }
    })
  })

  // ── Log rotation: weekly on Sunday at 02:00 ──
  cron.schedule('0 2 * * 0', async () => {
    await runTrackedJob('log_rotation', 'PM2与系统日志滚写清理', async () => rotateAllFiles())
  })

  // ── 多平台事实表聚合：每天 01:30（在 01:00 旧链路聚合之后）──
  cron.schedule('30 1 * * *', async () => {
    await runTrackedJob('fact_aggregation', '多平台事实表聚合', async () => {
      const r = await runFactAggregation()
      logger.info({ days: r.dates.length, months: r.months.length }, '[cron] fact aggregation done')
      return { dates: r.dates.length, months: r.months.length }
    })
  })

  // ── Multi-platform API sync: daily at 05:00（仅已授权店铺实际拉数，未授权自动跳过）──
  cron.schedule('0 5 * * *', async () => {
    await runTrackedJob('platform_api_sync', '多平台自动同步任务', async () => {
      const results = await runAllPlatformsSync(getPool(), 'trade')
      const done = results.filter((r) => r.status === 'completed').length
      logger.info({ total: results.length, completed: done }, '[cron] multi-platform sync done')
      return { total: results.length, completed: done }
    })
  })

  // ── AI automation jobs ──
  // 已暂停（按需求）：AI 经营日报 与 巡检记录 定时任务暂不注册。
  // 原配置（代码保留，如需恢复取消注释即可）：
  //   日报：cron.schedule('15 1 * * *', ...) → runDailyAiBriefing()
  //   巡检：cron.schedule('30 12 / 0 17 / 30 21 / 0 2 * * *', ...) → runAnomalyPatrol()
  //     （08:00–02:00 段每 4.5h 一次，08:00 不巡，02:00 最后一次）

  // ── AI review draft: daily at 02:30 ──
  cron.schedule('30 2 * * *', async () => {
    await runTrackedJob('ai_review_drafts', 'AI 复盘草稿生成', () => runReviewDrafts())
  })

  // ── Compliance patrol scan: daily 3x (09:30, 13:00, 18:30) (FINAL-PLAN Phase 3) ──
  cron.schedule('30 9,13,18 * * *', async () => {
    await runTrackedJob('compliance_patrol', '每日3次全网合规风控巡检', () => runCompliancePatrolJob())
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

  const replyText = await requestLlmReply(prompt) ||
    `### 📊 今日经营日报（自动汇总）\n- 日期：${today}\n- 直播场次：${summary.total_sessions || 0}\n- 总体 GMV：${summary.total_gmv || 0} 元\n- 支付订单数：${summary.total_orders || 0}\n> 注：系统以底层事实表进行确定性汇总生成。`

  if (replyText) {
    const { rows: convRows } = await pool.query(
      `INSERT INTO ai_conversations (user_id, title, model_name, status)
       VALUES (1, $1, $2, 'active') RETURNING id`,
      [`daily-${today}`, process.env.LLM_MODEL || 'deepseek-chat']
    ).catch(() => ({ rows: [] as any[] }))

    if (convRows.length > 0) {
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
        [convRows[0].id, replyText]
      ).catch(() => { })
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
    `SELECT id, title, description, severity, event_time
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

  const replyText = await requestLlmReply(prompt) ||
    `### ⚠️ 系统异常巡检摘要\n共检测到 ${rows.length} 项待处理业务预警。\n- 建议：请相关运营人员前往预警中心进行复核与核销。`

  if (replyText) {
    const { rows: convRows } = await pool.query(
      `INSERT INTO ai_conversations (user_id, title, model_name, status)
       VALUES (1, $1, $2, 'active') RETURNING id`,
      [`patrol-${new Date().toISOString().slice(0, 10)}`, process.env.LLM_MODEL || 'deepseek-chat']
    ).catch(() => ({ rows: [] as any[] }))

    if (convRows.length > 0) {
      await pool.query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
        [convRows[0].id, replyText]
      ).catch(() => { })
    }

    // 修复 P0-4 消费闭环：将已完成 AI 巡检分析的 pending 告警推进至 processing 状态，避免无限次重复巡检
    const eventIds = rows.map((r: any) => r.id).filter(Boolean)
    if (eventIds.length > 0) {
      await pool.query(
        `UPDATE alert_events SET status = 'processing', updated_at = NOW() WHERE id = ANY($1::int[])`,
        [eventIds]
      )
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

    const replyText = await requestLlmReply(prompt) ||
      `### 🎙️ 直播场次自动复盘（确定性汇总）\n- 场次：${s.title}\n- 主播：${s.anchor_name || '未知'}\n- GMV：${s.gmv} 元\n- 订单：${s.orders}\n- 千次展现成交 (GPM)：${s.gpm} 元`

    if (replyText) {
      const { rows: convRows } = await pool.query(
        `INSERT INTO ai_conversations (user_id, title, model_name, status)
         VALUES (1, $1, $2, 'active') RETURNING id`,
        [reviewTitle, process.env.LLM_MODEL || 'deepseek-chat']
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
