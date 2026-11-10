import type { FastifyInstance } from 'fastify'
import { generateOutfitRecommendation, getCityWeather } from '../lib/weather-client.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireAuth } from '../lib/guard.js'

export async function weatherRoutes(app: FastifyInstance) {
  // ── GET /api/v1/weather/cities ── 支持的城市列表
  app.get('/api/v1/weather/cities', async (_request, reply) => {
    return sendOk(reply, [
      { name: '杭州', isHub: true, desc: '电商直播总部集聚区' },
      { name: '广州', isHub: true, desc: '华南服饰供应链中心' },
      { name: '上海', isHub: true, desc: '高端品牌旗舰店中心' },
      { name: '北京', isHub: true, desc: '北方降温与大促前线' },
      { name: '成都', isHub: true, desc: '西南女装消费高地' },
    ])
  })

  // ── GET /api/v1/weather/recommendation ── 天气 AI 穿搭与智能选品建议
  app.get('/api/v1/weather/recommendation', { preHandler: [requireAuth] }, async (request, reply) => {
    const { city = '杭州' } = request.query as { city?: string }
    try {
      const recommendation = await generateOutfitRecommendation(city)
      return sendOk(reply, recommendation)
    } catch (err: any) {
      request.log.error(err, 'Failed to generate weather outfit recommendation')
      return sendError(reply, 500, err.message)
    }
  })
}

