/**
 * apps/api/src/worker.ts — 独立后台任务与队列 Worker 守护进程
 *
 * 职责：
 * 1. 与 Fastify HTTP 业务进程解耦，独立运行，杜绝大批量清洗/汇总聚合占用 API 进程 CPU 与事件循环
 * 2. 基于 PostgreSQL 分布式 Advisory Lock (`hashtext('worker:master_leader')`) 进行多实例 Leader 选举，防并发重复执行
 * 3. 调度与执行：日汇总聚合 (agg_*)、七段清洗、合规巡检、冷数据归档、分区预建维护与日志轮转
 * 4. 监听与轮询 system_jobs 待执行异步队列，统一受控执行并回写执行耗时与状态
 * 5. 监听 SIGINT / SIGTERM 信号，支持平滑优雅停机 (Graceful Shutdown)
 */

import { logger } from './lib/logger.js'
import { getPool } from './lib/db.js'
import { registerCronJobs, runInitialDataSync } from './cron/index.js'
import { backfillDailyStats } from './cron/aggregate-stats.js'
import { runFactAggregation } from './cron/aggregate-facts.js'
import { runCompliancePatrolJob } from './cron/compliance-patrol.js'
import { detectAnomalies } from './cron/detect-anomalies.js'
import { ensureAllPartitions } from './cron/manage-partitions.js'
import { archiveOldData } from './cron/archive-old-data.js'
import { SqlQualityGateEngine } from './modules/data-governance/validation/sql-quality-gates.js'

let isRunning = true
let isLeader = false
let activeLockKey = 98234125
let leaderClient: any = null

const LEADER_LOCK_KEY = 98234125 // hash for 'worker:master_leader'

async function acquireLeaderLock(lockKey: number = LEADER_LOCK_KEY): Promise<boolean> {
  const pool = getPool()
  try {
    const client = await pool.connect()
    const res = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [lockKey]
    )

    if (res.rows[0]?.acquired) {
      leaderClient = client
      isLeader = true
      activeLockKey = lockKey
      logger.info({ lockKey }, '[Worker] Successfully acquired leader advisory lock, active as MASTER')
      return true
    } else {
      client.release()
      isLeader = false
      logger.info({ lockKey }, '[Worker] Another worker instance is currently MASTER, running in STANDBY mode')
      return false
    }
  } catch (err) {
    logger.error({ err }, '[Worker] Failed to acquire leader advisory lock')
    return false
  }
}

async function releaseLeaderLock(lockKey: number = activeLockKey): Promise<void> {
  if (leaderClient && isLeader) {
    try {
      await leaderClient.query('SELECT pg_advisory_unlock($1)', [lockKey])
      leaderClient.release()
      logger.info({ lockKey }, '[Worker] Released leader advisory lock')
    } catch (err) {
      logger.warn({ err }, '[Worker] Error releasing leader advisory lock')
    } finally {
      leaderClient = null
      isLeader = false
    }
  }
}

async function pollPendingSystemJobs(): Promise<void> {
  if (!isLeader || !isRunning) return

  const pool = getPool()
  try {
    // Atomically claim the oldest pending job using SELECT ... FOR UPDATE SKIP LOCKED
    const claimRes = await pool.query<{ id: number; job_type: string; job_name: string; input_payload: any }>(
      `UPDATE system_jobs
       SET status = 'running',
           started_at = NOW(),
           updated_at = NOW()
       WHERE id = (
         SELECT id FROM system_jobs
         WHERE status = 'pending' AND (run_at IS NULL OR run_at <= NOW())
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, job_type, job_name, input_payload`
    )

    if (claimRes.rows.length === 0) return

    const job = claimRes.rows[0]
    logger.info({ jobId: job.id, jobType: job.job_type, jobName: job.job_name }, '[Worker] Claimed pending job from queue')
    const startedAt = Date.now()

    try {
      // Process job according to type
      let result: any = { message: 'Processed by dedicated worker' }

      if (job.job_type === 'initial_sync') {
        await backfillDailyStats()
        await runInitialDataSync()
        result = { message: 'Initial data sync completed' }
      } else if (job.job_type === 'fact_aggregation' || job.job_type === 'aggregate_facts') {
        result = await runFactAggregation()
      } else if (job.job_type === 'compliance_patrol') {
        result = await runCompliancePatrolJob()
      } else if (job.job_type === 'anomaly_detection' || job.job_type === 'detect_anomalies') {
        await detectAnomalies()
        result = { message: 'Anomaly detection executed' }
      } else if (job.job_type === 'partition_maintenance') {
        result = await ensureAllPartitions(3)
      } else if (job.job_type === 'archive_old_data') {
        await archiveOldData()
        result = { message: 'Archive old data completed' }
      } else if (job.job_type === 'quality_gate') {
        const batchId = Number(job.input_payload?.batchId)
        if (!batchId) throw new Error('Missing batchId in input_payload for quality_gate job')
        const client = await pool.connect()
        try {
          result = await SqlQualityGateEngine.evaluateBatch(client, batchId)
        } finally {
          client.release()
        }
      }

      await pool.query(
        `UPDATE system_jobs
         SET status = 'completed',
             finished_at = NOW(),
             updated_at = NOW(),
             result_payload = $2::jsonb
         WHERE id = $1`,
        [job.id, JSON.stringify({ durationMs: Date.now() - startedAt, ...result })]
      )
      logger.info({ jobId: job.id, durationMs: Date.now() - startedAt }, '[Worker] Job completed successfully')
    } catch (execErr: any) {
      logger.error({ err: execErr, jobId: job.id }, '[Worker] Job execution failed')
      await pool.query(
        `UPDATE system_jobs
         SET status = 'failed',
             finished_at = NOW(),
             updated_at = NOW(),
             error_message = $2
         WHERE id = $1`,
        [job.id, String(execErr?.message || execErr).slice(0, 2000)]
      )
    }
  } catch (err) {
    logger.warn({ err }, '[Worker] Error polling pending system_jobs')
  }
}

async function startWorker(): Promise<void> {
  logger.info('[Worker] Starting background worker process (pid: %d)...', process.pid)

  // Try acquiring master leader role
  const isMaster = await acquireLeaderLock()

  if (isMaster) {
    // Register all cron jobs in this dedicated worker
    registerCronJobs()
    logger.info('[Worker] Cron schedules registered in background worker process')

    // Run initial data sync
    setImmediate(async () => {
      try {
        await backfillDailyStats()
        await runInitialDataSync()
        logger.info('[Worker] Initial data sync completed successfully')
      } catch (err) {
        logger.warn({ err }, '[Worker] Initial data sync completed with warnings')
      }
    })
  }

  // Periodic loop: maintain lock / poll pending jobs
  const intervalId = setInterval(async () => {
    if (!isRunning) return

    if (!isLeader) {
      // Standby worker attempts to acquire master lock periodically
      await acquireLeaderLock()
      if (isLeader) {
        registerCronJobs()
      }
    } else {
      await pollPendingSystemJobs()
    }
  }, 5000)

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '[Worker] Received shutdown signal, draining jobs...')
    isRunning = false
    clearInterval(intervalId)
    await releaseLeaderLock()

    try {
      const pool = getPool()
      await pool.end()
    } catch {
      // ignore
    }

    logger.info('[Worker] Background worker process gracefully stopped')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

// Start worker process (auto-start when running standalone or under PM2, avoid running during unit tests)
if (process.env.NODE_ENV !== 'test' && !process.argv.some((a) => a.includes('test'))) {
  void startWorker()
}

export { startWorker, acquireLeaderLock, releaseLeaderLock }
