import type { FastifyInstance } from 'fastify'
import {
  metricsRegistry,
  collectDynamicDatabaseMetrics,
} from '../lib/metrics.js'

export async function metricsRoutes(app: FastifyInstance) {
  const handler = async (_request: any, reply: any) => {
    collectDynamicDatabaseMetrics()
    const metricsData = await metricsRegistry.metrics()
    return reply
      .header('Content-Type', metricsRegistry.contentType)
      .send(metricsData)
  }

  // Standard root Prometheus scrape endpoint
  app.get('/metrics', handler)

  // API v1 namespaced scrape endpoint
  app.get('/api/v1/metrics', handler)
}
