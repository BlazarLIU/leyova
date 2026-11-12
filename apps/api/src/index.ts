import { env } from './config/env.js'
import { buildApp } from './app.js'
import { registerCronJobs, runInitialDataSync } from './cron/index.js'
import { backfillDailyStats } from './cron/aggregate-stats.js'

async function main() {
  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: env.HOST })
    app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`)
    app.log.info(`API docs at http://localhost:${env.PORT}/docs`)
    registerCronJobs()
    app.log.info('Cron jobs registered')

    // ══ Initial data sync at startup ══
    setImmediate(async () => {
      try {
        await backfillDailyStats()
        await runInitialDataSync()
        app.log.info('Initial data sync completed')
      } catch (syncErr) {
        app.log.warn({ err: syncErr }, 'Initial data sync had errors (non-fatal)')
      }
    })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void main()
