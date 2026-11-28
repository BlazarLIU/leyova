import { env } from './config/env.js'
import { buildApp } from './app.js'
import { startJobEngine, stopJobEngine } from './jobs/boss.js'
import { logger } from './lib/logger.js'
import { getPool } from './lib/db.js'
import { ensureInstallToken } from './services/setup.js'

async function main() {
  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: env.HOST })
    app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`)
    app.log.info(`API docs at http://localhost:${env.PORT}/docs`)

    await ensureInstallToken(getPool()).catch((err) => {
      app.log.warn({ err }, '[Setup] Failed to ensure initial setup token')
    })

    const useSeparateWorker =
      process.env.DISABLE_CRON === 'true' || process.env.EMBEDDED_JOBS === 'false'

    if (useSeparateWorker) {
      // 只开启轻量 pg-boss 客户端（仅用于入队，不启动本地消费者/定时器，交由 worker 进程）
      await startJobEngine({
        enableWorkers: false,
        enableSchedules: false,
        runStartupSync: false,
      })
      app.log.info('[API] Embedded job workers disabled (delegated to standalone worker process)')
    } else {
      // 方案 A 默认单盒零运维模式：pg-boss 内嵌于 API 进程，开箱即自愈运行
      await startJobEngine({
        enableWorkers: true,
        enableSchedules: true,
        runStartupSync: true,
      })
      app.log.info('[API] Embedded pg-boss engine started (zero-ops single-container mode)')
    }

    const shutdown = async (signal: string) => {
      logger.info({ signal }, '[API] Received shutdown signal, draining background jobs & closing server...')
      await stopJobEngine()
      await app.close()
      process.exit(0)
    }

    process.on('SIGTERM', () => void shutdown('SIGTERM'))
    process.on('SIGINT', () => void shutdown('SIGINT'))
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void main()
