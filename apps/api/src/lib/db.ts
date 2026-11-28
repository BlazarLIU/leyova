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
    const connectionString =
      env.NODE_ENV === 'test' && env.TEST_DATABASE_URL
        ? env.TEST_DATABASE_URL
        : env.DATABASE_URL
    pool = connectionString
      ? new pg.Pool({ connectionString })
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
    await closePool()
  })
}

export async function closePool() {
  if (pool) {
    const active = pool
    pool = null
    await active.end()
  }
}

export { dbPlugin }
export default fp(dbPlugin, { name: 'db' })
export { withRlsContext, withRlsPool, withSystemRlsContext, resolveUserRlsScope, type ResolvedRlsScope } from './rls.js'
export type { DbExecutor } from './audit.js'