import { Pool, type PoolClient } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('缺少数据库配置：请设置环境变量 DATABASE_URL（例如 postgresql://user:pass@localhost:5432/leyova）。初始化方法见 database/README.md')
}

export const pool = new Pool({ connectionString })

export async function query(text: string, params: unknown[] = []) {
  return pool.query(text, params)
}

/**
 * 在事务级租户上下文中执行查询。缺失租户时由调用方负责拒绝，本函数不做默认回退。
 */
export async function withTenantContext<T>(
  tenantId: number,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error('[TENANT_SECURITY_FAIL_CLOSED] 缺少有效租户上下文，拒绝执行 MCP 查询')
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenantId)])
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function queryWithTenant<T = any>(
  tenantId: number,
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[] }> {
  return withTenantContext(tenantId, async (client) => {
    const res = await client.query(text, params)
    return { rows: res.rows as T[] }
  })
}
