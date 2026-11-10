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
import { contentRoutes } from './routes/content.js'
import { knowledgeBaseRoutes } from './routes/knowledge-base.js'
import { analysisRoutes } from './routes/analysis.js'
import { closureRoutes } from './routes/closure.js'
import { dictRoutes } from './routes/dict.js'
import { maintenanceRoutes } from './routes/maintenance.js'
import { caliberRoutes } from './routes/caliber.js'
import { taobaoRoutes } from './routes/taobao.js'
import { pddRoutes } from './routes/pdd.js'
import { kuaishouRoutes } from './routes/kuaishou.js'
import { jdRoutes } from './routes/jd.js'
import { xiaohongshuRoutes } from './routes/xiaohongshu.js'
import { costRoutes } from './routes/costs.js'
import { agencyClientsRoutes } from './routes/agency/clients.js'
import { agencyProjectsRoutes } from './routes/agency/projects.js'
import { agencySettlementRoutes } from './routes/agency/settlement.js'
import { agencyPortalRoutes } from './routes/agency/portal.js'
import { weatherRoutes } from './routes/weather.js'
import { scheduleRoutes } from './routes/schedule.js'
import { alertRulesRoutes } from './routes/alerts.js'
import { registerAuthHook } from './lib/auth-hook.js'
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

  // 全局鉴权钩子：注入 request.user，使二维权限矩阵在运行时生效
  registerAuthHook(app)

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
  await app.register(contentRoutes)      // content: providers, projects, tasks, assets, video metrics
  await app.register(knowledgeBaseRoutes) // kb: external RAGFlow/MaxKB client config & search
  await app.register(analysisRoutes)     // analysis: semantic-layer driven AI analyst (P4)
  await app.register(closureRoutes)      // closure: analysis → tasks → knowledge base (P5)
  await app.register(dictRoutes)        // dict: dictionary items management
  await app.register(maintenanceRoutes) // maintenance: aggregation backfill & partition management
  await app.register(caliberRoutes) // caliber: platform amount_type model & cross-platform comparability
  await app.register(taobaoRoutes)   // taobao: 淘宝/天猫专属分析
  await app.register(pddRoutes)      // pdd: 拼多多专属分析
  await app.register(kuaishouRoutes) // kuaishou: 快手专属分析
  await app.register(jdRoutes)       // jd: 京东专属分析（自营/POP/履约）
  await app.register(xiaohongshuRoutes) // xiaohongshu: 小红书专属分析（笔记/搜索/种草）
  await app.register(costRoutes)        // cost: 成本录入与净利计算 (Track 1)
  await app.register(agencyClientsRoutes) // agency: 甲方客户档案与品牌账号 (Track 2)
  await app.register(agencyProjectsRoutes) // agency: 项目合同与专项看板 (Track 2)
  await app.register(agencySettlementRoutes) // agency: 月结对账单与不可变保护 (Track 2)
  await app.register(agencyPortalRoutes) // portal: 甲方品牌只读专属看板 (Track 2)
  await app.register(weatherRoutes)      // weather: 竞品差异化特色 · 天气 AI 穿搭与智能选品 (Track 1)
  await app.register(scheduleRoutes)     // schedule: AI 智能主播排班建议 (Track 1)
  await app.register(alertRulesRoutes)   // alerts: 自定义指标阈值告警与 Webhook 调度 (Track 1)
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