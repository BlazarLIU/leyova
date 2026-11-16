/**
 * Drizzle client —— Resource 层的类型安全查询入口
 *
 * P9-4：与现有 pg Pool 并存。
 *  · Pool 仍是唯一连接来源（`getPool()`），保证 RLS 角色降权路径唯一。
 *  · Drizzle 只作为「类型安全的查询构造器」，不自己管理连接。
 *
 * 关键点：RLS 上下文是 **session 级 GUC + 角色降权**，
 * 所以必须复用 withRlsContext() 提供的同一个 PoolClient，
 * 不能另开连接（否则 app.tenant_id 等 GUC 丢失，RLS 会 fail-closed 拒掉所有行）。
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PoolClient } from 'pg'
import * as schema from './schema.js'

export type LeyovaDb = NodePgDatabase<typeof schema>

/**
 * 从一个已经处于 RLS 上下文中的 client 构造 Drizzle 实例。
 *
 * @param client withRlsContext() 内的 PoolClient
 */
export function dbFromClient(client: PoolClient): LeyovaDb {
  return drizzle(client, { schema })
}

/**
 * 从 Pool 构造 Drizzle 实例（**仅用于无 RLS 要求的内部任务**，如迁移校验、后台聚合）。
 * 涉及业务数据的查询一律走 dbFromClient()。
 */
export function dbFromPool(pool: {
  query: (sql: string, params?: unknown[]) => Promise<unknown>
}): LeyovaDb {
  return drizzle(pool as never, { schema })
}

export { schema }
