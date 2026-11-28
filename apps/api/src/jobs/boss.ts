/**
 * jobs/boss.ts — 基于 PostgreSQL pg-boss 的统一异步任务与定时调度引擎（方案 A）
 *
 * 商业化定位（去视频/编导 + 面向无 IT 运维中小公司）：
 * 1. 零新增中间件：全量托管于现有 PostgreSQL（pgboss schema），支持单容器开箱自愈运行；
 * 2. 自动具备：SKIP LOCKED 防重抢占、指数退避重试、僵尸超时回收（expireInSeconds）、过期记录自动清理（TTL）；
 * 3. 内置漏跑补偿（catchup）：中小公司夜间关机或服务器重启错过凌晨定时点时，启动或日间自动静默补跑昨日聚合与值守；
 * 4. 彻底移除视频/编导 FFmpeg 渲染队列依赖，保留轻量 SQL 聚合、开放平台同步、合规巡检与 AI Run 兜底。
 */

import PgBoss from 'pg-boss'
import type { Pool, PoolClient } from 'pg'
import { env } from '../config/env.js'
import { getPool, type DbExecutor } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { systemJobsCounter } from '../lib/metrics.js'
import { aggregateDailyStats, backfillDailyStats } from '../cron/aggregate-stats.js'
import { runFactAggregation } from '../cron/aggregate-facts.js'
import { detectAnomalies } from '../cron/detect-anomalies.js'
import { archiveOldData } from '../cron/archive-old-data.js'
import { ensureAllPartitions } from '../cron/manage-partitions.js'
import { runCompliancePatrolJob } from '../cron/compliance-patrol.js'
import { runInitialDataSync, runReviewDrafts } from '../cron/index.js'
import { runAllPlatformsSync } from '../ingest/sync-job.js'
import { rotateAllFiles } from '../cli/cleanup-logs.js'
import { runScheduledReview, runAlertScan, runActionMeasure } from '../services/ops-jobs.js'
import { executeAssistantRun, resumeStaleRuns } from '../ai/run/engine.js'
import { SqlQualityGateEngine } from '../modules/data-governance/validation/sql-quality-gates.js'

export const QUEUE_NAMES = {
  AGGREGATE_DAILY_STATS: 'aggregate_daily_stats',
  FACT_AGGREGATION: 'fact_aggregation',
  ANOMALY_DETECTION: 'anomaly_detection',
  ARCHIVE_OLD_DATA: 'archive_old_data',
  PARTITION_MAINTENANCE: 'partition_maintenance',
  LOG_ROTATION: 'log_rotation',
  PLATFORM_API_SYNC: 'platform_api_sync',
  COMPLIANCE_PATROL: 'compliance_patrol',
  AI_REVIEW_DRAFTS: 'ai_review_drafts',
  ASSISTANT_SCHEDULED_REVIEW: 'assistant.scheduled_review',
  ALERT_SCAN: 'alert.scan',
  ACTION_MEASURE: 'action.measure',
  ASSISTANT_RUN: 'assistant.run',
  ASSISTANT_STALE_RECOVERY: 'assistant.stale_recovery',
  AUTOMATION_CATCHUP: 'automation.catchup',
  QUALITY_GATE: 'quality_gate',
} as const

export const QUEUE_LABELS: Record<string, string> = {
  [QUEUE_NAMES.AGGREGATE_DAILY_STATS]: '经营日指标汇总',
  [QUEUE_NAMES.FACT_AGGREGATION]: '多平台事实数据聚合',
  [QUEUE_NAMES.ANOMALY_DETECTION]: '经营指标异常波动检测',
  [QUEUE_NAMES.ARCHIVE_OLD_DATA]: '历史冷数据自动归档',
  [QUEUE_NAMES.PARTITION_MAINTENANCE]: '数据库分区自动预建',
  [QUEUE_NAMES.LOG_ROTATION]: '系统日志滚写清理',
  [QUEUE_NAMES.PLATFORM_API_SYNC]: '店铺平台数据自动同步',
  [QUEUE_NAMES.COMPLIANCE_PATROL]: '平台合规规则自动巡检',
  [QUEUE_NAMES.AI_REVIEW_DRAFTS]: 'AI 场次复盘草稿生成',
  [QUEUE_NAMES.ASSISTANT_SCHEDULED_REVIEW]: '昨日场次归因与决策案生成',
  [QUEUE_NAMES.ALERT_SCAN]: '日目标达成缺口扫描',
  [QUEUE_NAMES.ACTION_MEASURE]: '改进措施到期效果度量',
  [QUEUE_NAMES.ASSISTANT_RUN]: 'AI 助手断点恢复执行',
  [QUEUE_NAMES.ASSISTANT_STALE_RECOVERY]: 'AI 超时会话巡检恢复',
  [QUEUE_NAMES.AUTOMATION_CATCHUP]: '漏跑数据自动补偿检查',
  [QUEUE_NAMES.QUALITY_GATE]: '导入批次数据质量门禁校验',
}

interface ScheduleSpec {
  queue: string
  cron: string
  data?: Record<string, unknown>
}

const SCHEDULE_SPECS: ScheduleSpec[] = [
  { queue: QUEUE_NAMES.AGGREGATE_DAILY_STATS, cron: '0 1 * * *' },
  { queue: QUEUE_NAMES.FACT_AGGREGATION, cron: '30 1 * * *' },
  { queue: QUEUE_NAMES.ASSISTANT_SCHEDULED_REVIEW, cron: '45 1 * * *' },
  { queue: QUEUE_NAMES.LOG_ROTATION, cron: '0 2 * * 0' },
  { queue: QUEUE_NAMES.AI_REVIEW_DRAFTS, cron: '30 2 * * *' },
  { queue: QUEUE_NAMES.ARCHIVE_OLD_DATA, cron: '0 3 * * *' },
  { queue: QUEUE_NAMES.PARTITION_MAINTENANCE, cron: '0 4 * * *' },
  { queue: QUEUE_NAMES.PLATFORM_API_SYNC, cron: '0 5 * * *' },
  { queue: QUEUE_NAMES.ACTION_MEASURE, cron: '0 6 * * *' },
  { queue: QUEUE_NAMES.ANOMALY_DETECTION, cron: '0 * * * *' },
  { queue: QUEUE_NAMES.ALERT_SCAN, cron: '15 * * * *' },
  { queue: QUEUE_NAMES.COMPLIANCE_PATROL, cron: '30 9,13,18 * * *' },
  { queue: QUEUE_NAMES.ASSISTANT_STALE_RECOVERY, cron: '*/1 * * * *' },
  { queue: QUEUE_NAMES.AUTOMATION_CATCHUP, cron: '10 9,14 * * *' },
]

let bossInstance: PgBoss | null = null
let engineStarted = false

function buildConnectionOptions(): PgBoss.ConstructorOptions {
  const connStr =
    env.NODE_ENV === 'test' && env.TEST_DATABASE_URL
      ? env.TEST_DATABASE_URL
      : env.DATABASE_URL

  const base: PgBoss.ConstructorOptions = {
    schema: 'pgboss',
    max: 5,
    retentionDays: 14,
    deleteAfterDays: 30,
    archiveCompletedAfterSeconds: 3600 * 24,
    archiveFailedAfterSeconds: 3600 * 24 * 7,
    cronWorkerIntervalSeconds: 30,
    monitorStateIntervalSeconds: 60,
  }

  if (connStr) {
    return { ...base, connectionString: connStr }
  }
  return {
    ...base,
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    database: env.DB_NAME,
    password: env.DB_PASSWORD || undefined,
  }
}

/** 获取北京时间昨日日期 YYYY-MM-DD */
function getShanghaiYesterday(): string {
  const shanghaiNow = new Date(Date.now() + 8 * 3600_000 - 86400_000)
  return shanghaiNow.toISOString().slice(0, 10)
}

/**
 * 漏跑自检补偿：针对中小公司夜间关机或服务器重启错过凌晨定时任务的情况，
 * 检查昨日事实表是否已有数据但汇总表缺失，以及昨日复盘是否遗漏，缺则自动静默补跑。
 */
export async function runAutomationCatchup(force = false): Promise<{
  targetDate: string
  ranFactAggregation: boolean
  ranScheduledReview: boolean
  ranPlatformSync: boolean
}> {
  const pool = getPool()
  const targetDate = getShanghaiYesterday()
  let ranFactAggregation = false
  let ranScheduledReview = false
  let ranPlatformSync = false

  try {
    if (force) {
      await runFactAggregation()
      ranFactAggregation = true
      await runAllPlatformsSync(pool, 'trade').catch((err) => {
        logger.warn({ err }, '[Jobs] force catchup platform sync failed')
      })
      ranPlatformSync = true
      await runScheduledReview(targetDate)
      ranScheduledReview = true
      return { targetDate, ranFactAggregation, ranScheduledReview, ranPlatformSync }
    }

    const { rows } = await pool.query<{ fact_cnt: number; agg_cnt: number }>(
      `SELECT
         (SELECT count(*)::int FROM public.fact_trade_daily WHERE biz_date = $1::date) AS fact_cnt,
         (SELECT count(*)::int FROM public.agg_shop_daily WHERE biz_date = $1::date) AS agg_cnt`,
      [targetDate],
    )
    const factCnt = Number(rows[0]?.fact_cnt || 0)
    const aggCnt = Number(rows[0]?.agg_cnt || 0)

    if (factCnt > 0 && aggCnt === 0) {
      logger.info({ targetDate, factCnt }, '[Jobs] Detected missing yesterday agg_shop_daily, running catchup aggregation')
      await runFactAggregation()
      ranFactAggregation = true
    }

    const { rows: sessionRows } = await pool.query<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM public.live_sessions
        WHERE date = $1::date AND status = 'completed'`,
      [targetDate],
    )
    if (Number(sessionRows[0]?.cnt || 0) > 0) {
      const { rows: caseRows } = await pool.query<{ cnt: number }>(
        `SELECT count(*)::int AS cnt FROM public.decision_cases
          WHERE created_at::date >= $1::date AND source_ref LIKE 'scheduled_review:%'`,
        [targetDate],
      ).catch(() => ({ rows: [{ cnt: 1 }] }))
      if (Number(caseRows[0]?.cnt || 0) === 0) {
        await runScheduledReview(targetDate)
        ranScheduledReview = true
      }
    }
  } catch (err) {
    logger.warn({ err, targetDate }, '[Jobs] automation catchup check failed')
  }

  return { targetDate, ranFactAggregation, ranScheduledReview, ranPlatformSync }
}

const JOB_HANDLERS: Record<string, (data: Record<string, any>) => Promise<unknown>> = {
  [QUEUE_NAMES.AGGREGATE_DAILY_STATS]: async () => {
    await aggregateDailyStats()
    return { ok: true }
  },
  [QUEUE_NAMES.FACT_AGGREGATION]: async () => runFactAggregation(),
  [QUEUE_NAMES.ANOMALY_DETECTION]: async () => {
    await detectAnomalies()
    return { ok: true }
  },
  [QUEUE_NAMES.ARCHIVE_OLD_DATA]: async () => {
    await archiveOldData()
    return { ok: true }
  },
  [QUEUE_NAMES.PARTITION_MAINTENANCE]: async (data) => ensureAllPartitions(Number(data?.monthsAhead) || 3),
  [QUEUE_NAMES.LOG_ROTATION]: async () => rotateAllFiles(),
  [QUEUE_NAMES.PLATFORM_API_SYNC]: async () => runAllPlatformsSync(getPool(), 'trade'),
  [QUEUE_NAMES.COMPLIANCE_PATROL]: async () => runCompliancePatrolJob(),
  [QUEUE_NAMES.AI_REVIEW_DRAFTS]: async () => {
    await runReviewDrafts()
    return { ok: true }
  },
  [QUEUE_NAMES.ASSISTANT_SCHEDULED_REVIEW]: async (data) => runScheduledReview(data?.date),
  [QUEUE_NAMES.ALERT_SCAN]: async (data) => runAlertScan(data?.date),
  [QUEUE_NAMES.ACTION_MEASURE]: async () => runActionMeasure(),
  [QUEUE_NAMES.ASSISTANT_RUN]: async (data) => {
    const runId = String(data?.runId || '')
    if (!runId) throw new Error('Missing runId for assistant.run job')
    return executeAssistantRun(runId)
  },
  [QUEUE_NAMES.ASSISTANT_STALE_RECOVERY]: async () => {
    const count = await resumeStaleRuns(5)
    return { resumed: count }
  },
  [QUEUE_NAMES.AUTOMATION_CATCHUP]: async (data) => runAutomationCatchup(Boolean(data?.force)),
  [QUEUE_NAMES.QUALITY_GATE]: async (data) => {
    const batchId = Number(data?.batchId)
    if (!batchId) throw new Error('Missing batchId for quality_gate job')
    const client = await getPool().connect()
    try {
      return await SqlQualityGateEngine.evaluateBatch(client, batchId)
    } finally {
      client.release()
    }
  },
}

export interface StartJobEngineOptions {
  enableWorkers?: boolean
  enableSchedules?: boolean
  runStartupSync?: boolean
}

export async function startJobEngine(options: StartJobEngineOptions = {}): Promise<PgBoss> {
  const { enableWorkers = true, enableSchedules = true, runStartupSync = true } = options

  if (bossInstance && engineStarted) {
    return bossInstance
  }

  const boss = bossInstance ?? new PgBoss(buildConnectionOptions())
  boss.on('error', (err) => {
    logger.error({ err }, '[Jobs] pg-boss error')
  })

  await boss.start()
  bossInstance = boss
  engineStarted = true

  // 确保所有业务队列在 pgboss v10 中完成创建（幂等）
  for (const queueName of Object.values(QUEUE_NAMES)) {
    await boss.createQueue(queueName, {
      name: queueName,
      retryLimit: queueName === QUEUE_NAMES.COMPLIANCE_PATROL ? 1 : 3,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: queueName === QUEUE_NAMES.COMPLIANCE_PATROL ? 900 : 300,
      retentionDays: 14,
    })
  }

  if (enableSchedules) {
    for (const spec of SCHEDULE_SPECS) {
      await boss.schedule(spec.queue, spec.cron, spec.data || {}, {
        tz: 'Asia/Shanghai',
      })
    }
    logger.info({ schedules: SCHEDULE_SPECS.length }, '[Jobs] pg-boss recurring schedules registered (Asia/Shanghai)')
  }

  if (enableWorkers) {
    for (const [queueName, handler] of Object.entries(JOB_HANDLERS)) {
      await boss.work<Record<string, any>>(
        queueName,
        { batchSize: 1, pollingIntervalSeconds: queueName === QUEUE_NAMES.ASSISTANT_RUN ? 2 : 5 },
        async (jobs) => {
          for (const job of jobs) {
            const startedAt = Date.now()
            try {
              const res = await handler(job.data || {})
              systemJobsCounter.inc({ job_type: queueName, status: 'completed' })
              logger.debug(
                { jobId: job.id, queue: queueName, durationMs: Date.now() - startedAt },
                '[Jobs] pg-boss job completed',
              )
              return res
            } catch (err) {
              systemJobsCounter.inc({ job_type: queueName, status: 'failed' })
              logger.error({ err, jobId: job.id, queue: queueName }, '[Jobs] pg-boss job failed')
              throw err
            }
          }
        },
      )
    }
    logger.info({ queues: Object.keys(JOB_HANDLERS).length }, '[Jobs] pg-boss workers listening')
  }

  if (runStartupSync) {
    setImmediate(async () => {
      try {
        await backfillDailyStats()
        await runInitialDataSync()
        await runAutomationCatchup(false)
        logger.info('[Jobs] Startup data sync & catchup check completed')
      } catch (err) {
        logger.warn({ err }, '[Jobs] Startup data sync completed with warnings')
      }
    })
  }

  return boss
}

export async function stopJobEngine(): Promise<void> {
  if (!bossInstance) return
  const active = bossInstance
  bossInstance = null
  engineStarted = false
  try {
    await active.stop({ graceful: true, timeout: 25000 })
    logger.info('[Jobs] pg-boss gracefully stopped')
  } catch (err) {
    logger.warn({ err }, '[Jobs] Error while stopping pg-boss')
  }
}

export function isJobEngineRunning(): boolean {
  return engineStarted && bossInstance !== null
}

/**
 * 安全向 pg-boss 投递任务。
 * 若后台引擎未启动（例如单元测试中只测路由而不启动守护定时器），返回 null 不抛出错误。
 */
export async function sendJob(
  queueName: string,
  data: Record<string, unknown> = {},
  options: PgBoss.SendOptions = {},
): Promise<string | null> {
  if (!bossInstance || !engineStarted) {
    return null
  }
  return bossInstance.send(queueName, data, options)
}

/** 把常见技术异常翻译为中小公司运营人员能看懂的人话提示 */
export function translateSyncErrorToHuman(rawError: string | null | undefined): {
  title: string
  hint: string
} {
  const text = String(rawError || '')
  if (!text) return { title: '正常', hint: '' }
  if (/401|unauthorized|token|授权|expired|invalid_grant/i.test(text)) {
    return {
      title: '店铺授权已失效',
      hint: '请点击右侧「配置 OAuth / 凭证」重新授权，系统将在次日自动恢复拉数。',
    }
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|502|503|429/i.test(text)) {
    return {
      title: '平台接口暂时繁忙',
      hint: '属于平台网络波动，系统会自动重试；若急需数据可点击「立即同步」。',
    }
  }
  return {
    title: '同步异常',
    hint: '可先点击「立即同步」重试，若仍失败可在数据上传页先导出表格手工导入。',
  }
}

export interface AutomationHealthSnapshot {
  engineActive: boolean
  mode: 'embedded' | 'worker' | 'inactive'
  yesterdayDate: string
  yesterdayAggregated: boolean
  yesterdayFactRows: number
  yesterdayAggRows: number
  lastComplianceScanAt: string | null
  shopSyncStatus: Array<{
    shopId: number
    shopName: string
    platformCode: string
    platformName: string
    authStatus: string
    lastSyncAt: string | null
    lastStatus: 'ok' | 'manual_only' | 'needs_auth' | 'error' | 'pending'
    insertedRows: number
    humanTitle: string
    humanHint: string
  }>
  recentActivities: Array<{
    id: string
    label: string
    status: string
    statusLabel: string
    time: string
    summary: string
  }>
}

export async function getAutomationHealthSnapshot(executor: DbExecutor | Pool | PoolClient): Promise<AutomationHealthSnapshot> {
  const yesterdayDate = getShanghaiYesterday()

  const aggRes = await executor.query<{ fact_cnt: number; agg_cnt: number }>(
    `SELECT
       (SELECT count(*)::int FROM public.fact_trade_daily WHERE biz_date = $1::date) AS fact_cnt,
       (SELECT count(*)::int FROM public.agg_shop_daily WHERE biz_date = $1::date) AS agg_cnt`,
    [yesterdayDate],
  ).catch(() => ({ rows: [{ fact_cnt: 0, agg_cnt: 0 }] }))

  const factCnt = Number(aggRes.rows[0]?.fact_cnt || 0)
  const aggCnt = Number(aggRes.rows[0]?.agg_cnt || 0)

  const patrolRes = await executor.query<{ last_at: string | null }>(
    `SELECT max(fetched_at)::text AS last_at FROM public.compliance_rule_snapshot`,
  ).catch(() => ({ rows: [{ last_at: null }] }))

  const shopSyncRes = await executor.query<{
    shop_id: number
    shop_name: string
    platform_code: string
    platform_name: string
    auth_status: string
    sync_status: string | null
    inserted_rows: number | null
    error_summary: string | null
    completed_at: string | null
  }>(
    `SELECT
       s.id AS shop_id,
       s.shop_name,
       s.platform_code,
       COALESCE(p.platform_name, s.platform_code) AS platform_name,
       COALESCE(s.auth_status, 'manual_only') AS auth_status,
       j.status AS sync_status,
       j.rows_inserted AS inserted_rows,
       j.error_summary,
       COALESCE(j.completed_at, j.started_at)::text AS completed_at
     FROM public.dim_shop s
     JOIN public.system_platform_configs p ON p.platform_code = s.platform_code AND p.is_enabled = true
     LEFT JOIN LATERAL (
       SELECT status, rows_inserted, error_summary, completed_at, started_at
       FROM public.ingest_sync_jobs
       WHERE shop_id = s.id AND platform_code = s.platform_code
       ORDER BY COALESCE(completed_at, started_at) DESC NULLS LAST, id DESC
       LIMIT 1
     ) j ON true
     WHERE s.status = 'active'
     ORDER BY s.platform_code, s.id`,
  ).catch(() => ({ rows: [] as any[] }))

  const shopSyncStatus = shopSyncRes.rows.map((r) => {
    if (r.auth_status === 'manual_only') {
      return {
        shopId: Number(r.shop_id),
        shopName: r.shop_name,
        platformCode: r.platform_code,
        platformName: r.platform_name,
        authStatus: r.auth_status,
        lastSyncAt: r.completed_at,
        lastStatus: 'manual_only' as const,
        insertedRows: Number(r.inserted_rows || 0),
        humanTitle: '人工表格上传模式',
        humanHint: '可在右侧配置 API 授权后实现每日凌晨自动同步',
      }
    }
    if (r.auth_status !== 'authorized') {
      return {
        shopId: Number(r.shop_id),
        shopName: r.shop_name,
        platformCode: r.platform_code,
        platformName: r.platform_name,
        authStatus: r.auth_status,
        lastSyncAt: r.completed_at,
        lastStatus: 'needs_auth' as const,
        insertedRows: 0,
        humanTitle: '尚未完成 API 授权',
        humanHint: '请配置店铺授权凭证或切换为人工上传',
      }
    }
    if (r.sync_status === 'failed') {
      const translated = translateSyncErrorToHuman(r.error_summary)
      return {
        shopId: Number(r.shop_id),
        shopName: r.shop_name,
        platformCode: r.platform_code,
        platformName: r.platform_name,
        authStatus: r.auth_status,
        lastSyncAt: r.completed_at,
        lastStatus: 'error' as const,
        insertedRows: 0,
        humanTitle: translated.title,
        humanHint: translated.hint,
      }
    }
    if (r.sync_status === 'completed') {
      return {
        shopId: Number(r.shop_id),
        shopName: r.shop_name,
        platformCode: r.platform_code,
        platformName: r.platform_name,
        authStatus: r.auth_status,
        lastSyncAt: r.completed_at,
        lastStatus: 'ok' as const,
        insertedRows: Number(r.inserted_rows || 0),
        humanTitle: '自动同步正常',
        humanHint: '',
      }
    }
    return {
      shopId: Number(r.shop_id),
      shopName: r.shop_name,
      platformCode: r.platform_code,
      platformName: r.platform_name,
      authStatus: r.auth_status,
      lastSyncAt: r.completed_at,
      lastStatus: 'pending' as const,
      insertedRows: 0,
      humanTitle: '等待首次自动同步',
      humanHint: '系统每日 05:00 自动拉取昨日数据，也可点击「立即同步」',
    }
  })

  // 查询最近 8 条自动化执行概览（如 pgboss schema 已就绪）
  const recentRes = await executor.query<{
    id: string
    name: string
    state: string
    created_on: string
    completed_on: string | null
  }>(
    `SELECT id::text, name, state, created_on::text, completed_on::text
       FROM pgboss.job
      WHERE name <> 'assistant.stale_recovery'
      ORDER BY created_on DESC
      LIMIT 8`,
  ).catch(() => ({
    rows: [] as Array<{
      id: string
      name: string
      state: string
      created_on: string
      completed_on: string | null
    }>,
  }))

  const stateMap: Record<string, string> = {
    created: '待处理',
    retry: '自动重试中',
    active: '执行中',
    completed: '已完成',
    cancelled: '已取消',
    failed: '需关注',
  }

  const recentActivities = recentRes.rows.map((r) => ({
    id: r.id,
    label: QUEUE_LABELS[r.name] || r.name,
    status: r.state,
    statusLabel: stateMap[r.state] || r.state,
    time: r.completed_on || r.created_on,
    summary: QUEUE_LABELS[r.name] ? `任务状态：${stateMap[r.state] || r.state}` : r.name,
  }))

  const mode =
    process.env.DISABLE_CRON === 'true' || process.env.EMBEDDED_JOBS === 'false'
      ? 'worker'
      : isJobEngineRunning()
        ? 'embedded'
        : 'inactive'

  return {
    engineActive: isJobEngineRunning() || mode === 'worker',
    mode,
    yesterdayDate,
    yesterdayAggregated: factCnt === 0 || aggCnt > 0,
    yesterdayFactRows: factCnt,
    yesterdayAggRows: aggCnt,
    lastComplianceScanAt: patrolRes.rows[0]?.last_at ?? null,
    shopSyncStatus,
    recentActivities,
  }
}
