import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { getPool } from '../lib/db.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/v1/health', async (_request, reply) => {
    let dbOk = false
    try {
      const pool = getPool()
      const result = await pool.query('SELECT 1 AS ok')
      dbOk = result.rows[0]?.ok === 1
    } catch { /* db not available */ }

    return sendOk(reply, {
      ok: true,
      db: dbOk ? 'connected' : 'unavailable',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/api/v1/ready', async (_request, reply) => {
    let dbOk = false
    try {
      const pool = getPool()
      const result = await pool.query('SELECT 1 AS ok')
      dbOk = result.rows[0]?.ok === 1
    } catch { /* db not available */ }

    if (!dbOk) {
      return reply.code(503).send({
        success: false,
        message: 'Database not ready',
        db: 'unavailable',
      })
    }

    return sendOk(reply, {
      ok: true,
      db: 'connected',
      timestamp: new Date().toISOString(),
    })
  })
}