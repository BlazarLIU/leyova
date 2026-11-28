import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getPool } from './db.js'

// Create dedicated registry to prevent global metric collisions
export const metricsRegistry = new Registry()

// Standard Node.js process and runtime metrics
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'leyova_',
})

// HTTP Request Total Counter
export const httpRequestsTotal = new Counter({
  name: 'leyova_http_requests_total',
  help: 'Total number of HTTP requests processed by Fastify',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [metricsRegistry],
})

// HTTP Request Duration Histogram (in seconds)
export const httpRequestDurationSeconds = new Histogram({
  name: 'leyova_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
})

// HTTP Active In-flight Requests Gauge
export const httpActiveRequests = new Gauge({
  name: 'leyova_http_active_requests',
  help: 'Number of active HTTP requests currently being handled',
  registers: [metricsRegistry],
})

// Database Connection Pool Metrics
export const pgPoolClientsGauge = new Gauge({
  name: 'leyova_pg_pool_clients',
  help: 'PostgreSQL connection pool client status',
  labelNames: ['state'] as const,
  registers: [metricsRegistry],
})

// Background Worker Jobs Counter
export const systemJobsCounter = new Counter({
  name: 'leyova_system_jobs_processed_total',
  help: 'Total background system jobs processed by worker daemon',
  labelNames: ['job_type', 'status'] as const,
  registers: [metricsRegistry],
})

/**
 * Normalize route path to prevent high-cardinality label explosions
 */
function normalizeRoutePath(req: FastifyRequest): string {
  if (req.routeOptions && req.routeOptions.url) {
    return req.routeOptions.url
  }
  const raw = req.url.split('?')[0] || '/'
  return raw
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/BATCH-[A-Z0-9-]+(?=\/|$)/g, '/:batchId')
    .replace(/\/01[0-9A-Z]{24}(?=\/|$)/g, '/:ulid')
}

declare module 'fastify' {
  interface FastifyRequest {
    _metricsStartTime?: [number, number]
  }
}

/**
 * Register Prometheus metrics hooks into Fastify
 */
export function registerMetricsHooks(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request._metricsStartTime = process.hrtime()
    httpActiveRequests.inc()
  })

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    httpActiveRequests.dec()
    if (request._metricsStartTime) {
      const diff = process.hrtime(request._metricsStartTime)
      const durationSeconds = diff[0] + diff[1] / 1e9
      const route = normalizeRoutePath(request)
      const method = request.method
      const status = String(reply.statusCode)

      httpRequestsTotal.inc({ method, route, status })
      httpRequestDurationSeconds.observe({ method, route, status }, durationSeconds)
    }
  })
}

/**
 * Update dynamic pool stats prior to scrape
 */
export function collectDynamicDatabaseMetrics() {
  try {
    const pool = getPool()
    pgPoolClientsGauge.set({ state: 'total' }, pool.totalCount)
    pgPoolClientsGauge.set({ state: 'idle' }, pool.idleCount)
    pgPoolClientsGauge.set({ state: 'waiting' }, pool.waitingCount)
  } catch {
    // Pool not yet initialized
  }
}
