import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { getPool } from '../lib/db.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/v1/health', async (_request, reply) => {
    let dbOk = false
    const start = Date.now()
    try {
      const pool = getPool()
      const result = await pool.query('SELECT 1 AS ok')
      dbOk = result.rows[0]?.ok === 1
    } catch {
      /* db not available */
    }

    const mem = process.memoryUsage()
    const status = {
      ok: dbOk,
      db: dbOk ? 'connected' : 'unavailable',
      latencyMs: Date.now() - start,
      uptimeSec: Math.floor(process.uptime()),
      rssMb: Math.round(mem.rss / 1024 / 1024),
      timestamp: new Date().toISOString(),
    }

    if (!dbOk) {
      return reply.code(503).send({ success: false, ...status })
    }
    return sendOk(reply, status)
  })

  app.get('/api/v1/ready', async (_request, reply) => {
    let dbOk = false
    let schemaOk = false
    try {
      const pool = getPool()
      const ping = await pool.query('SELECT 1 AS ok')
      dbOk = ping.rows[0]?.ok === 1
      if (dbOk) {
        const meta = await pool.query<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name IN ('users', 'roles', 'dim_shop')`,
        )
        schemaOk = Number(meta.rows[0]?.cnt || 0) === 3
      }
    } catch {
      /* db not available */
    }

    if (!dbOk || !schemaOk) {
      return reply.code(503).send({
        success: false,
        message: !dbOk ? 'Database not ready' : 'Core schema tables missing',
        db: dbOk ? 'connected' : 'unavailable',
        schemaReady: schemaOk,
      })
    }

    return sendOk(reply, {
      ok: true,
      db: 'connected',
      schemaReady: true,
      timestamp: new Date().toISOString(),
    })
  })
}
