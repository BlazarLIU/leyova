#!/usr/bin/env node
/**
 * Database backup CLI tool.
 * Usage: npx tsx src/cli/backup.ts [--output=/path/to/dump]
 *
 * Creates a pg_dump of the configured database.
 * Connection info comes from env: DATABASE_URL or DB_HOST / DB_PORT / DB_USER / DB_NAME,
 * password from PGPASSWORD or DB_PASSWORD. Nothing is hardcoded.
 */

import { execFileSync } from 'child_process'
import { resolve } from 'path'
import { mkdirSync } from 'fs'

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

interface DbTarget {
  host: string
  port: string
  user: string
  database: string
  password: string
}

/** 从环境变量解析出 pg_dump 所需连接参数（DATABASE_URL 优先） */
function resolveDbTarget(): DbTarget {
  const url = process.env.DATABASE_URL
  if (url) {
    const u = new URL(url)
    // libpq 风格的 unix socket 写法：postgresql://user@/db?host=/var/run/postgresql
    const socketHost = u.searchParams.get('host')
    const host = socketHost
      ? decodeURIComponent(socketHost)
      : decodeURIComponent(u.hostname) || 'localhost'
    return {
      host,
      port: u.port || u.searchParams.get('port') || '5432',
      user: decodeURIComponent(u.username || 'postgres'),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
      password: decodeURIComponent(u.password || ''),
    }
  }
  const database = process.env.DB_NAME
  if (!database) {
    console.error('[backup] 缺少数据库配置：请设置 DATABASE_URL 或 DB_NAME')
    process.exit(1)
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    user: process.env.DB_USER || 'postgres',
    database,
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
  }
}

const target = resolveDbTarget()
const outputDir = resolve(
  process.argv.find((a) => a.startsWith('--output='))?.split('=')[1] ?? resolve(process.cwd(), 'backups')
)
const ts = timestamp()
const outputFile = resolve(outputDir, `${target.database}_${ts}.sql`)

console.log(`[backup] Starting backup of ${target.database} → ${outputFile}`)

try {
  mkdirSync(outputDir, { recursive: true })

  execFileSync(
    'pg_dump',
    [
      '-h', target.host,
      '-p', target.port,
      '-U', target.user,
      '-d', target.database,
      '-F', 'p',
      '-f', outputFile,
    ],
    { stdio: 'inherit', env: { ...process.env, PGPASSWORD: target.password } }
  )

  console.log(`[backup] Backup completed: ${outputFile}`)
} catch (err) {
  console.error('[backup] Backup failed:', err)
  process.exit(1)
}
