import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import pg from 'pg'
import { env } from '../config/env.js'

declare module 'fastify' {
  interface FastifyInstance {
    pgPool: pg.Pool
  }
}

let pool: pg.Pool | null = null

export function getPool() {
  if (!pool) {
    pool = env.DATABASE_URL
      ? new pg.Pool({ connectionString: env.DATABASE_URL })
      : new pg.Pool({
          host: env.DB_HOST,
          port: env.DB_PORT,
          user: env.DB_USER,
          database: env.DB_NAME,
          password: env.DB_PASSWORD || undefined,
        })
  }
  return pool
}

async function dbPlugin(app: FastifyInstance) {
  const pgPool = getPool()
  app.decorate('pgPool', pgPool)

  try {
    const client = await pgPool.connect()
    await client.query('SELECT 1')
    client.release()
    app.log.info('PostgreSQL connected')
  } catch (err) {
    app.log.warn({ err }, 'PostgreSQL not available – running without DB')
  }

  app.addHook('onClose', async () => {
    await pgPool.end()
  })
}

export { dbPlugin }
export default fp(dbPlugin, { name: 'db' })