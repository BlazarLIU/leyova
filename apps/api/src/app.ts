import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import { env } from './config/env.js'
import { healthRoutes } from './routes/health.js'
import { setupRoutes } from './routes/setup.js'
import { authRoutes } from './routes/auth.js'
import { overviewRoutes } from './routes/overview.js'
import { anchorRoutes } from './routes/anchors.js'
import { biRoutes } from './routes/bi.js'
import { opsRoutes } from './routes/ops.js'
import { systemRoutes } from './routes/system.js'
import { systemCompetitorsRoutes } from './routes/system-competitors.js'
import { systemUsersRoutes } from './routes/system-users.js'
import { systemRoomsRoutes } from './routes/system-rooms.js'
import { systemAlertsRoutes } from './routes/system-alerts.js'
import { systemTasksRoutes } from './routes/system-tasks.js'
import { systemAuditRoutes } from './routes/system-audit.js'
import { personnelRoutes } from './routes/personnel.js'
import { sessionRoutes } from './routes/sessions.js'
import { aiRoutes } from './routes/ai.js'
import { assistantRoutes } from './routes/assistant.js'
import { integrationRoutes } from './routes/integrations.js'
import { knowledgePlatformRoutes } from './routes/knowledge-platform.js'
import { generationRoutes } from './routes/generation.js'
import { mediaRoutes } from './routes/media.js'
import { videoRoutes } from './routes/video.js'
import { directorRoutes } from './routes/director.js'
import './ai/tools.js' // register default MCP tools
import { registerMcpRoutes } from './ai/mcp-server.js'
import { dataRoutes } from './routes/data.js'
import { dataLiveRoutes } from './routes/data-live.js'
import { dataUploadedRoutes } from './routes/data-uploaded.js'
import { reviewRoutes } from './routes/review.js'
import { reviewOverviewRoutes } from './routes/review-overview.js'
import { reviewAnalysisRoutes } from './routes/review-analysis.js'
import { liveregRoutes } from './routes/livereg.js'
import { platformRoutes } from './routes/platforms.js'
import { ingestRoutes } from './routes/ingest.js'
import { ingestManualUploadRoutes } from './routes/ingest-upload.js'
import { omnichannelRoutes } from './routes/omnichannel.js'
import { contentRoutes } from './routes/content.js'
import { contentMetricsRoutes } from './routes/content-metrics.js'
import { knowledgeBaseRoutes } from './routes/knowledge-base.js'
import { analysisRoutes } from './routes/analysis.js'
import { closureRoutes } from './routes/closure.js'
import { maintenanceRoutes } from './routes/maintenance.js'
import { caliberRoutes } from './routes/caliber.js'
import { douyinRoutes } from './routes/douyin.js'
import { kuaishouRoutes } from './routes/kuaishou.js'
import { wechatRoutes } from './routes/wechat.js'
import { accessControlRoutes } from './routes/access-control.js'
import { workbenchRoutes } from './routes/workbench.js'
import { opsPrimitivesRoutes } from './routes/ops-primitives.js'
import { qianchuanRoutes } from './routes/qianchuan.js'
import { hrbpRoutes } from './routes/hrbp.js'
import { hrbpEfficiencyRoutes } from './routes/hrbp-efficiency.js'
import { assortmentRoutes } from './routes/assortment.js'
import { platformInsightsRoutes } from './routes/platform-insights.js'
import { insightsDouyinRoutes } from './routes/insights-douyin.js'
import { insightsWechatRoutes } from './routes/insights-wechat.js'
import { scheduleRoutes } from './routes/schedule.js'
import { scheduleSessionsRoutes } from './routes/schedule-sessions.js'
import { alertRulesRoutes } from './routes/alerts.js'
import { governanceRoutes } from './routes/governance.js'
import { governanceMappingRoutes } from './routes/governance-mapping.js'
import { inventoryRoutes } from './routes/inventory.js'
import { inventoryListingsRoutes } from './routes/inventory-listings.js'
import { inventoryReservationsRoutes } from './routes/inventory-reservations.js'
import { fulfillmentRoutes } from './routes/fulfillment.js'
import { afterSalesRoutes } from './routes/after-sales.js'
import { afterSalesRmaRoutes } from './routes/after-sales-rma.js'
import { kolRoutes } from './routes/kol.js'
import { customerServiceRoutes } from './routes/customer-service.js'
import { netRoiRoutes } from './routes/net-roi.js'
import { netRoiPlansRoutes } from './routes/net-roi-plans.js'
import { searchKeywordRoutes } from './routes/search-keywords.js'
import { growthComplianceRoutes } from './routes/growth-compliance.js'
import { selectionRoutes } from './routes/selection.js'
import { campaignPlanRoutes } from './routes/campaign-plan.js'
import { complianceRulesRoutes } from './routes/compliance-rules.js'
import { generalLedgerRoutes } from './routes/general-ledger.js'
import { customFieldRoutes } from './routes/custom-fields.js'
import { metricsRoutes } from './routes/metrics.js'
import { registerMetricsHooks } from './lib/metrics.js'
import { getPrettyTransport } from './lib/logger.js'
import { registerAuthHook } from './lib/auth-hook.js'
import { registerDeprecationHook } from './lib/deprecation-hook.js'
import { dbPlugin } from './lib/db.js'
import { errorHandler } from './lib/error-handler.js'
import { openapiSpec } from './openapi.generated.js'
import { RouteCollector } from './lib/route-collector.js'

export interface BuildAppOptions {
  logger?: boolean
}

export async function buildApp(options: BuildAppOptions = {}) {
  const prettyTransport = options.logger === false
    ? undefined
    : getPrettyTransport({ translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' })
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: env.LOG_LEVEL,
            ...(prettyTransport ? { transport: prettyTransport } : {}),
            redact: ['req.headers.authorization', 'req.body.password'],
          },
  })

  // ── global error handler ──
  app.setErrorHandler(errorHandler)

  // ── 路由清单收集（P2-4 OpenAPI 自动生成） ──
  // onRoute 必须在所有 app.register(...) 之前注册，才能捕获到全部真实路由。
  // 收集结果用于生成 OpenAPI 文档，避免手写文档与代码漂移。
  const routeRegistry = new RouteCollector()
  routeRegistry.attach(app)

  // ── plugins ──
  await app.register(helmet)
  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  })
  await app.register(cookie)
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 1 } })
  await app.register(dbPlugin)

  const isCoreOnly = process.env.FEATURE_SCOPE === 'core'

  if (isCoreOnly) {
    app.log.info('[FeatureScope] Core mode active: non-core ecommerce & retired routes isolated with 404 (core 3 platforms: douyin/kuaishou/wechat retained)')
  }

  // Prometheus Metrics 监控钩子（无侵入全局采样与吞吐指标收集）
  registerMetricsHooks(app)

  // 全局鉴权钩子：注入 request.user，使二维权限矩阵在运行时生效
  registerAuthHook(app)

  // 30 天废弃路由下线观测与告警钩子
  registerDeprecationHook(app)

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
  await app.register(setupRoutes)      // 首次部署初始化（安装凭证保护）
  await app.register(metricsRoutes)   // Prometheus /metrics 端点
  await app.register(authRoutes)
  await app.register(overviewRoutes)  // real DB-backed routes take priority
  await app.register(anchorRoutes)    // anchor/training/scripts routes
  await app.register(opsRoutes)       // ops: product-templates, ad-plans, capabilities, goals, scripts, issues, room-health
  await app.register(systemRoutes)    // system: roles/modules, target-templates, config
  await app.register(systemCompetitorsRoutes) // system 拆分(P2-1): competitors, multi-room
  await app.register(systemUsersRoutes)   // system 拆分(P2-1): users, roles/modules
  await app.register(systemRoomsRoutes)   // system 拆分(P2-1): rooms
  await app.register(systemAlertsRoutes)  // system 拆分(P2-1): alerts
  await app.register(systemTasksRoutes)   // system 拆分(P2-1): tasks, promotions
  await app.register(systemAuditRoutes)   // system 拆分(P2-1): audit-logs, jobs
  await app.register(personnelRoutes) // personnel: anchors, operators, managers, attendance
  await app.register(dataRoutes)      // data: tables, uploads, quality, exports
  await app.register(dataLiveRoutes)  // data 拆分(P2-1): live 登记数据 CRUD
  await app.register(dataUploadedRoutes) // data 拆分(P2-1): uploaded-data 主播/渠道
  await app.register(sessionRoutes)
  await app.register(aiRoutes)
  await app.register(assistantRoutes) // W4: Run Engine / 事件流 / Agent 配置
  await app.register(integrationRoutes) // W8: 集成中心（连接器健康检查 + 凭证 + 调用审计）
  await app.register(registerMcpRoutes) // MCP Server（Streamable HTTP, 供 DeerFlow 调用）
  await app.register(liveregRoutes)   // livereg: form-data, submit
  await app.register(platformRoutes)  // platforms: multi-platform management, permissions & shops
  await app.register(ingestRoutes)    // ingest: sync / jobs / stats / templates / preview
  await app.register(ingestManualUploadRoutes) // ingest 拆分(P2-1): 手动上传正式导入
  await app.register(omnichannelRoutes) // omnichannel: cross-platform dashboard & shelf shop analytics
  await app.register(knowledgeBaseRoutes) // kb: external RAGFlow/MaxKB client config & search
  await app.register(knowledgePlatformRoutes) // W9: 本地知识平台（pgvector / 入库 / 违禁词 / 引用回溯）
  await app.register(generationRoutes) // W10: PromptOps + 脚本/文案生成与审核
  await app.register(analysisRoutes)     // analysis: semantic-layer driven AI analyst (P4)
  await app.register(closureRoutes)      // closure: analysis → tasks → knowledge base (P5)
  await app.register(maintenanceRoutes) // maintenance: aggregation backfill & partition management
  await app.register(caliberRoutes) // caliber: platform amount_type model & cross-platform comparability

  // ── 核心三直播电商平台（抖音 / 快手 / 视频号）在 core 模式下完整保留 ──
  await app.register(douyinRoutes)   // douyin: 抖音专属分析（店铺/渠道/主播）
  await app.register(kuaishouRoutes) // kuaishou: 快手专属分析
  await app.register(wechatRoutes)   // wechat: 视频号专属分析（公私域/全域带货/结算/内容）
  await app.register(insightsDouyinRoutes) // 抖音：三池统一调度
  await app.register(insightsWechatRoutes) // 视频号：全域带货者/短视频与图文

  // ── 非核心电商、重型冗余 ERP 与退役创作/BI/复盘路由（在 FEATURE_SCOPE=core 模式下隔离不暴露，直接返回 404） ──
  if (!isCoreOnly) {
    await app.register(biRoutes)        // BI dashboard, ROI, refund, anomalies
    await app.register(reviewRoutes)    // review: sessions, live-rooms, session-info, products, short-videos, funnel-data, related-issues
    await app.register(reviewOverviewRoutes) // review 拆分(P2-1): overview
    await app.register(reviewAnalysisRoutes) // review 拆分(P2-1): channels, anchors, funnel, compare
    await app.register(contentRoutes)      // content: providers, projects, tasks, assets
    await app.register(contentMetricsRoutes) // content 拆分(P2-1): 视频数据 video-metrics
    await app.register(mediaRoutes) // W11: 媒体流水线（上传/转写/高光/渲染/剪映草稿）
    await app.register(videoRoutes) // F.1: 全类型剪辑（模板 DSL / 装配槽位 / 渲染质检）
    await app.register(directorRoutes) // F.2: 编导工作台（选题/脚本/分镜/日历/回流）
    await app.register(qianchuanRoutes) // 千川投放同步与 R3 预算审批
    await app.register(hrbpRoutes)          // hrbp: HRBP 工作台（人才/考勤/绩效/培训）(S5)
    await app.register(hrbpEfficiencyRoutes) // hrbp 拆分(P3): 人效分析（总览/明细/利用率/成长/风险）
    await app.register(fulfillmentRoutes)  // fulfillment: 多平台48h履约SLA与赔付风控
    await app.register(afterSalesRoutes)   // after-sales: 售后归因与工单闭环
    await app.register(afterSalesRmaRoutes) // after-sales 拆分(P2-1): 行级 RMA 与订单事件流
    await app.register(kolRoutes)          // kol: 外部达人档案与佣金台账
    await app.register(customerServiceRoutes) // cs: 客服咨询会话与响应绩效
    await app.register(searchKeywordRoutes) // search-keywords: 搜索词卡位排名与流量转化追踪
    await app.register(campaignPlanRoutes) // campaign-plan: 12 模块一键运营方案生成器 (FINAL-PLAN Phase 2)
    await app.register(generalLedgerRoutes) // P7 §5.2 #11: 总账与复式记账凭证链 (General Ledger & Voucher Chain)
    await app.register(customFieldRoutes)  // P7 §5.2 #13: 自定义字段元数据引擎 (Custom Field Engine)
  }

  await app.register(accessControlRoutes) // access-control: 模式 × 平台 × 模块 三维权限 (S2)
  await app.register(workbenchRoutes)     // workbench: 角色工作台 + 权限申请/审批 (W2.5)
  await app.register(opsPrimitivesRoutes) // ops primitives: 目标 / 决策案 / 归因 / 值守工作面 (W3)
  await app.register(assortmentRoutes)   // assortment(P3): 基于 GMV/库存/短视频/点击转化的排品推荐
  await app.register(platformInsightsRoutes) // platform-insights: 4 个平台专属洞察 (S7-B)
  await app.register(scheduleRoutes)     // schedule: meta / 日历 / 人员状态 / 请假
  await app.register(scheduleSessionsRoutes) // schedule 拆分(P2-1): 排班场次 CRUD
  await app.register(alertRulesRoutes)   // alerts: 自定义指标阈值告警与 Webhook 调度 (Track 1)
  await app.register(governanceRoutes)   // governance: 平台规范、双轨接入、清洗校验与发布闸门
  await app.register(governanceMappingRoutes) // governance 拆分(P2-1): 主体/字段映射规则
  await app.register(inventoryRoutes)    // inventory: 商品主数据、SKU 映射、库存台账
  await app.register(inventoryListingsRoutes) // inventory 拆分(P2-1): 渠道定价与配额
  await app.register(inventoryReservationsRoutes) // inventory 拆分(P2-1): 防超卖预留
  await app.register(netRoiRoutes)       // net-roi: 归因窗口 / 总览 / 消耗 / 结算账期
  await app.register(netRoiPlansRoutes)  // net-roi 拆分(P2-1): 投流计划与回执
  await app.register(growthComplianceRoutes) // promotions/rules, members/overview, compliance/events
  await app.register(selectionRoutes)    // selection: 全品类多因子 AI 选品与推荐 (FINAL-PLAN Phase 2)
  await app.register(complianceRulesRoutes) // compliance-rules: 平台规则巡检雷达、合规变更与活动提醒 (FINAL-PLAN Phase 3)
  // ── mockRoutes removed — all routes migrated to DB-backed ──

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ success: false, message: 'Not Found' })
  })

  // 暴露路由清单供 OpenAPI 生成脚本使用（P2-4）
  app.__routeCollector = routeRegistry

  return app
}
