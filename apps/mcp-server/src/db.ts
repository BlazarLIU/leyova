import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('缺少数据库配置：请设置环境变量 DATABASE_URL（例如 postgresql://user:pass@localhost:5432/leyova）')
}

export const pool = new Pool({ connectionString })

export async function query(text: string, params: unknown[] = []) {
  return pool.query(text, params)
}
