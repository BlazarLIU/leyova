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
import { douyinRoutes } from './routes/douyin.js'
import { kuaishouRoutes } from './routes/kuaishou.js'
import { wechatRoutes } from './routes/wechat.js'
import { tmallRoutes } from './routes/tmall.js'
import { xiaohongshuRoutes } from './routes/xiaohongshu.js'
import { weatherRoutes } from './routes/weather.js'
import { accessControlRoutes } from './routes/access-control.js'
import { hrbpRoutes } from './routes/hrbp.js'
import { platformInsightsRoutes } from './routes/platform-insights.js'
import { platformDedicatedRoutes } from './routes/platform-dedicated.js'
import { scheduleRoutes } from './routes/schedule.js'
import { alertRulesRoutes } from './routes/alerts.js'
import { governanceRoutes } from './routes/governance.js'
import { inventoryRoutes } from './routes/inventory.js'
import { fulfillmentRoutes } from './routes/fulfillment.js'
import { afterSalesRoutes } from './routes/after-sales.js'
import { kolRoutes } from './routes/kol.js'
import { customerServiceRoutes } from './routes/customer-service.js'
import { netRoiRoutes } from './routes/net-roi.js'
import { searchKeywordRoutes } from './routes/search-keywords.js'
import { growthComplianceRoutes } from './routes/growth-compliance.js'
import { selectionRoutes } from './routes/selection.js'
import { campaignPlanRoutes } from './routes/campaign-plan.js'
import { complianceRulesRoutes } from './routes/compliance-rules.js'
import { resourceRoutes } from './routes/resources.js'
import { generalLedgerRoutes } from './routes/general-ledger.js'
import { customFieldRoutes } from './routes/custom-fields.js'
import { metricsRoutes } from './routes/metrics.js'
import { registerMetricsHooks } from './lib/metrics.js'
import { registerAuthHook } from './lib/auth-hook.js'
import { dbPlugin } from './lib/db.js'
import { errorHandler } from './lib/error-handler.js'
import { openapiSpec } from './openapi.js'

export interface BuildAppOptions {
  logger?: boolean
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
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

  // Prometheus Metrics 监控钩子（无侵入全局采样与吞吐指标收集）
  registerMetricsHooks(app)

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
  await app.register(metricsRoutes)   // Prometheus /metrics 端点
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
  await app.register(douyinRoutes)   // douyin: 抖音专属分析（店铺/渠道/主播）
  await app.register(taobaoRoutes)   // taobao: 淘宝/天猫专属分析
  await app.register(kuaishouRoutes) // kuaishou: 快手专属分析
  await app.register(wechatRoutes)   // wechat: 视频号专属分析（公私域/全域带货/结算/内容）
  await app.register(tmallRoutes)    // tmall: 天猫专属分析（品牌场次/五层抵扣/大促对比）
  await app.register(xiaohongshuRoutes) // xiaohongshu: 小红书专属分析（笔记/搜索/种草）
  await app.register(accessControlRoutes) // access-control: 模式 × 平台 × 模块 三维权限 (S2)
  await app.register(hrbpRoutes)          // hrbp: HRBP 工作台（人才/考勤/绩效/培训）(S5)
  await app.register(platformInsightsRoutes) // platform-insights: 4 个平台专属洞察 (S7-B)
  await app.register(platformDedicatedRoutes) // platform-dedicated: 10 个平台专属洞察 (S7-B 第二批)
  await app.register(weatherRoutes)      // weather: 竞品差异化特色 · 天气 AI 穿搭与智能选品 (Track 1)
  await app.register(scheduleRoutes)     // schedule: AI 智能主播排班建议 (Track 1)
  await app.register(alertRulesRoutes)   // alerts: 自定义指标阈值告警与 Webhook 调度 (Track 1)
  await app.register(governanceRoutes)   // governance: 7大平台API、双轨接入、数据清洗、质量校验与发布闸门
  await app.register(inventoryRoutes)    // inventory: 商品主数据与全渠道库存中心
  await app.register(fulfillmentRoutes)  // fulfillment: 多平台48h履约SLA与赔付风控
  await app.register(afterSalesRoutes)   // after-sales: 售后退货原因归因与工单闭环
  await app.register(kolRoutes)          // kol: 外部达人档案与佣金台账
  await app.register(customerServiceRoutes) // cs: 客服咨询会话与响应绩效
  await app.register(netRoiRoutes)       // net-roi: 官方归因窗口与 T+7 净成交 ROI 双时间线
  await app.register(searchKeywordRoutes) // search-keywords: 搜索词卡位排名与小红书词包同步
  await app.register(growthComplianceRoutes) // promotions/rules, members/overview, compliance/events
  await app.register(selectionRoutes)    // selection: 全品类多因子 AI 选品与推荐 (FINAL-PLAN Phase 2)
  await app.register(campaignPlanRoutes) // campaign-plan: 12 模块一键运营方案生成器 (FINAL-PLAN Phase 2)
  await app.register(complianceRulesRoutes) // compliance-rules: 平台规则巡检雷达、合规变更与活动提醒 (FINAL-PLAN Phase 3)
  await app.register(resourceRoutes)   // P9-4: 通用资源层（registerResource 生成的 CRUD）
  await app.register(generalLedgerRoutes) // P7 §5.2 #11: 总账与复式记账凭证链 (General Ledger & Voucher Chain)
  await app.register(customFieldRoutes)  // P7 §5.2 #13: 自定义字段元数据引擎 (Custom Field Engine)
  // ── mockRoutes removed — all routes migrated to DB-backed ──

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ success: false, message: 'Not Found' })
  })

  return app
}
