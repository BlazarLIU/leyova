#!/usr/bin/env node
/**
 * database/demo/backfill.mjs — 聚合表回填子进程
 *
 * 由 init.mjs 通过 spawnSync 调用，把 agg_* 汇总表回填到与事实表一致。
 * 独立成文件（而非 -e 内联）是为了让 pg / tsx 的模块解析正常工作。
 *
 * 用法：node --import tsx database/demo/backfill.mjs <from> <to>
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const pgRequire = createRequire(path.join(rootDir, 'apps/api/package.json'))
const pg = pgRequire('pg')

// 加载 .env（与 init.mjs / migrate.js 同源）
{
  const fs = await import('node:fs')
  const envPath = path.join(rootDir, 'apps/api/.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      const k = t.slice(0, i).trim()
      const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}

const { aggregateRange } = await import(path.join(rootDir, 'apps/api/src/cron/aggregate-facts.ts'))

const [from, to] = process.argv.slice(2)
if (!from || !to) {
  console.error('用法: node --import tsx database/demo/backfill.mjs <from> <to>')
  process.exit(1)
}

const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 55432),
  user: process.env.DB_USER || 'leyova',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'leyova',
})

try {
  const result = await aggregateRange(pool, from, to)
  console.log(JSON.stringify(result))
} catch (err) {
  console.error('聚合回填失败:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
