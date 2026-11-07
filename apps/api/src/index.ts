import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import { env } from './config/env.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { overviewRoutes } from './routes/overview.js'
import { anchorRoutes } from './routes/anchors.js'
import { biRoutes } from './routes/bi.js'
import { opsRoutes } from './routes/ops.js'
import { systemRoutes } from './routes/system.js'
import { openclawRoutes } from './routes/openclaw.js'
import { personnelRoutes } from './routes/personnel.js'
import { sessionRoutes } from './routes/sessions.js'
import { aiRoutes } from './routes/ai.js'
import './ai/tools.js' // register default MCP tools
import { registerMcpRoutes } from './ai/mcp-server.js'
import { dataRoutes } from './routes/data.js'
import { reviewRoutes } from './routes/review.js'
import { liveregRoutes } from './routes/livereg.js'
import { platformRoutes } from './routes/platforms.js'
import { ingestRoutes } from './routes/ingest.js'
import { omnichannelRoutes } from './routes/omnichannel.js'
import { dbPlugin } from './lib/db.js'
import { registerCronJobs, runInitialDataSync } from './cron/index.js'
import { backfillDailyStats } from './cron/aggregate-stats.js'
import { errorHandler } from './lib/error-handler.js'
import { openapiSpec } from './openapi.js'

async function main() {
  const app = Fastify({ 
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    },
  })

  // ── global error handler ──
  app.setErrorHandler(errorHandler)

  // ── plugins ──
  await app.register(helmet)
  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  })
  await app.register(cookie)
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 1 } })
  await app.register(dbPlugin)

  // ── Swagger ──
  await app.register(fastifySwagger, {
    openapi: {
      ...openapiSpec,
      components: {
        ...openapiSpec.components,
        securitySchemes: {
          cookieAuth: { type: 'apiKey' as const, in: 'cookie' as const, name: env.SESSION_COOKIE_NAME },
        },
      },
    },
  } as any)
  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  })

  // ── routes ──
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(overviewRoutes)  // real DB-backed routes take priority
  await app.register(anchorRoutes)    // anchor/training/scripts routes
  await app.register(biRoutes)        // BI dashboard, ROI, refund, anomalies
  await app.register(opsRoutes)       // ops: product-templates, ad-plans, capabilities, goals, scripts, issues, room-health
  await app.register(systemRoutes)    // system: config, alerts, competitors, multi-room, inventory
  await app.register(openclawRoutes)   // openclaw: config (大模型/会话管理，写入 openclaw.json)
  await app.register(personnelRoutes) // personnel: anchors, operators, managers, attendance
  await app.register(dataRoutes)      // data: tables, uploads, quality, exports
  await app.register(reviewRoutes)    // review: overview, channels, anchors, funnel, compare
  await app.register(sessionRoutes)
  await app.register(aiRoutes)
  await app.register(registerMcpRoutes) // MCP Server（Streamable HTTP, 供 DeerFlow 调用）
  await app.register(liveregRoutes)   // livereg: form-data, submit
  await app.register(platformRoutes)  // platforms: multi-platform management, permissions & shops
  await app.register(ingestRoutes)    // ingest: dual-track data access, cleaning pipeline & sync jobs
  await app.register(omnichannelRoutes) // omnichannel: cross-platform dashboard & shelf shop analytics
  // ── mockRoutes removed — all routes migrated to DB-backed ──

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ success: false, message: 'Not Found' })
  })

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