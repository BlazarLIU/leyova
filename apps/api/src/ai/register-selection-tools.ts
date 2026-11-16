import { z } from 'zod'
import { registerTool } from './tool-registry.js'
import { recommend } from '../services/selection-service.js'
import { generateCampaignPlan } from '../services/campaign-plan-service.js'

// ---------------------------------------------------------------------------
// 选品与方案生成工具（write_with_approval）
// ---------------------------------------------------------------------------

registerTool({
  name: 'generate_selection_plan',
  description: '生成全品类 AI 选品推荐方案。结合指定商品类目、真实气象信号、多因子销售趋势及库存健康度，输出结构化选品建议清单。',
  inputSchema: z.object({
    categoryCode: z.string().describe('一级或二级类目编码，如 APPAREL, BEAUTY, DIGITAL, FOOD, OUTDOOR, HOME 等'),
    city: z.string().optional().describe('目标城市，如 杭州、北京、广州 等，用于采集真实天气'),
    platformCode: z.string().optional().describe('电商平台编码，如 douyin, kuaishou, taobao, tmall, xiaohongshu 等'),
    shopId: z.number().int().positive().optional().describe('店铺 ID'),
  }),
  riskLevel: 'write_with_approval',
  execute: async (params, ctx) => {
    const client = await ctx.pool.connect()
    try {
      const result = await recommend(
        client,
        {
          categoryCode: params.categoryCode,
          city: params.city,
          platformCode: params.platformCode,
          shopId: params.shopId,
          persist: true,
        },
        { id: ctx.userId, tenantId: 1 },
      )
      return {
        success: true,
        recommendationNo: result.recommendationNo,
        strategy: result.strategy,
        city: result.city,
        weather: result.weather,
        itemCount: result.items.length,
        items: result.items.map((i) => ({
          rank: i.rankNo,
          name: i.suggestedName,
          score: i.matchScore,
          price: i.suggestedPrice,
          margin: i.estimatedMarginRate,
          reason: i.reason,
        })),
      }
    } finally {
      client.release()
    }
  },
})

registerTool({
  name: 'generate_campaign_plan',
  description: '基于选品结果与店铺属性，一键生成全域 12 模块直播运营方案（包含场次定位、货盘分层、开播节奏、主播话术、投流策略与风控清单）。',
  inputSchema: z.object({
    shopId: z.number().int().positive().describe('目标店铺 ID'),
    categoryCode: z.string().optional().describe('主营类目编码，如 APPAREL'),
    templateCode: z.string().optional().describe('方案模板编码，默认 TMPL_STANDARD_LIVE'),
    sourceRecommendationId: z.number().int().positive().optional().describe('关联的历史选品推荐 ID'),
    targetGmv: z.number().positive().optional().describe('场次目标 GMV'),
  }),
  riskLevel: 'write_with_approval',
  execute: async (params, ctx) => {
    const client = await ctx.pool.connect()
    try {
      const result = await generateCampaignPlan(
        client,
        {
          shopId: params.shopId,
          categoryCode: params.categoryCode,
          templateCode: params.templateCode,
          sourceRecommendationId: params.sourceRecommendationId,
          targetGmv: params.targetGmv,
        },
        { id: ctx.userId, tenantId: 1 },
      )
      return {
        success: true,
        planNo: result.planNo,
        shopName: result.shopName,
        approvalStatus: result.approvalStatus,
        modulesSummary: {
          theme: result.planPayload?.modules?.m1_positioning?.theme,
          targetGmv: result.planPayload?.modules?.m1_positioning?.targetGmv,
          assortmentCount: result.planPayload?.modules?.m2_assortment?.structure?.length,
          suggestedSlot: result.planPayload?.modules?.m4_timing?.suggestedSlot,
        },
      }
    } finally {
      client.release()
    }
  },
})
