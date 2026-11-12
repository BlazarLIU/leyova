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
import { resolve, dirname, join } from 'path'
import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'

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

const __dirname = dirname(fileURLToPath(import.meta.url))
const target = resolveDbTarget()
const outputDir = resolve(
  process.argv.find((a) => a.startsWith('--output='))?.split('=')[1] ?? resolve(__dirname, '../../../../.backup')
)
const retainArg = process.argv.find((a) => a.startsWith('--retain='))?.split('=')[1]
const retainCount = Math.max(parseInt(retainArg || '7', 10) || 7, 1)
const verifyDump = !process.argv.includes('--no-verify')
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

  const stat = statSync(outputFile)
  if (verifyDump) {
    if (stat.size < 128) {
      throw new Error(`Backup file unexpectedly small (${stat.size} bytes): ${outputFile}`)
    }
    const head = readFileSync(outputFile, 'utf8').slice(0, 512)
    if (!head.includes('PostgreSQL database dump')) {
      throw new Error(`Backup header verification failed: ${outputFile}`)
    }
    console.log(`[backup] Verified dump (${(stat.size / 1024).toFixed(1)} KB)`)
  }

  // Prune older dumps beyond retention count
  const prefix = `${target.database}_`
  const oldFiles = readdirSync(outputDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.sql'))
    .map((f) => ({ path: join(outputDir, f), mtime: statSync(join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(retainCount)

  for (const old of oldFiles) {
    unlinkSync(old.path)
    console.log(`[backup] Pruned expired backup: ${old.path}`)
  }

  console.log(`[backup] Backup completed: ${outputFile}`)
} catch (err) {
  console.error('[backup] Backup failed:', err)
  process.exit(1)
}
