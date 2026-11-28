/**
 * apps/api/src/worker.ts — 可选独立 Worker 进程（兼容 PM2 多进程拆分布署）
 *
 * 方案 A 说明：
 * - 单机/Docker 中小公司场景默认由 index.ts 内嵌 pg-boss 运行，无需单独启动本进程；
 * - 若大型现场通过 PM2 (DISABLE_CRON=true) 显式拆分 API 与后台进程，本进程提供纯消费与定时调度能力。
 * - 已全面基于 pg-boss + PostgreSQL Advisory Lock 兼容层实现，移除视频/编导渲染轮询。
 */

import { logger } from './lib/logger.js'
import { getPool } from './lib/db.js'
import { startJobEngine, stopJobEngine } from './jobs/boss.js'

let isLeader = false
let activeLockKey = 98234125
let leaderClient: any = null
const LEADER_LOCK_KEY = 98234125

async function acquireLeaderLock(lockKey: number = LEADER_LOCK_KEY): Promise<boolean> {
  const pool = getPool()
  try {
    const client = await pool.connect()
    const res = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [lockKey],
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

async function startWorker(): Promise<void> {
  logger.info('[Worker] Starting pg-boss background worker process (pid: %d)...', process.pid)

  await startJobEngine({
    enableWorkers: true,
    enableSchedules: true,
    runStartupSync: true,
  })

  const shutdown = async (signal: string) => {
    logger.info({ signal }, '[Worker] Received shutdown signal, gracefully stopping pg-boss...')
    await stopJobEngine()
    await releaseLeaderLock()
    try {
      await getPool().end()
    } catch {
      // ignore
    }
    logger.info('[Worker] Background worker process gracefully stopped')
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

if (process.env.NODE_ENV !== 'test' && !process.argv.some((a) => a.includes('test'))) {
  void startWorker()
}

export { startWorker, acquireLeaderLock, releaseLeaderLock }
