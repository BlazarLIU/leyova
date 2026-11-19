#!/usr/bin/env node
/**
 * database/demo/init.mjs — 部署时数据库初始化入口（含可选演示数据）
 *
 * 老大决策（2026-11-18）：
 *   1. 演示数据单独保存，部署时自动初始化；
 *   2. 数据由用户自己接入或手动上传 —— 所以正式部署**默认不灌演示数据**。
 *
 * 用法：
 *   node database/demo/init.mjs              # 正式部署：建库 + 迁移，不灌演示数据
 *   node database/demo/init.mjs --with-demo  # 演示环境：额外灌入演示数据 + 聚合回填
 *   node database/demo/init.mjs --reset-demo # 用户接入真实数据后，清空演示数据
 *
 * 步骤：
 *   1. 确保数据库存在（连 postgres 库 CREATE DATABASE IF NOT EXISTS）
 *   2. 执行 database/migrate.js（schema + 全部迁移）
 *   3. [--with-demo] 执行 generate.mjs 灌演示数据
 *   4. [--with-demo] 触发聚合回填（agg_* 表）
 *   5. [--reset-demo] 清空演示数据表
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../..')

const pgRequire = createRequire(path.join(rootDir, 'apps/api/package.json'))
const pg = pgRequire('pg')

const args = process.argv.slice(2)
const WITH_DEMO = args.includes('--with-demo')
const RESET_DEMO = args.includes('--reset-demo')

const log = (...a) => console.log('[demo-init]', ...a)

// ── 环境变量（与 migrate.js 同源）─────────────────────────────────
function loadEnv() {
  const envPath = path.join(rootDir, 'apps/api/.env')
  if (!fs.existsSync(envPath)) return
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
loadEnv()

const dbName = process.env.DB_NAME || 'leyova'
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env_PORT_DB || process.env.DB_PORT || 55432),
  user: process.env.DB_USER || 'leyova',
  password: process.env.DB_PASSWORD,
}

function run(cmd, cmdArgs, label) {
  log(`→ ${label}`)
  const r = spawnSync(cmd, cmdArgs, { cwd: rootDir, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`[demo-init] ✗ ${label} 失败（exit ${r.status}）`)
    process.exit(r.status ?? 1)
  }
  log(`✓ ${label}`)
}

async function main() {
  const mode = RESET_DEMO ? 'reset-demo' : WITH_DEMO ? 'with-demo' : 'production'
  log(`模式：${mode}`)
  log(`目标库：${dbConfig.host}:${dbConfig.port}/${dbName}`)

  // ── 1. 确保数据库存在 ──────────────────────────────────────────
  const admin = new pg.Pool({ ...dbConfig, database: 'postgres' })
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if (rows.length === 0) {
      log(`数据库 ${dbName} 不存在，创建中…`)
      await admin.query(`CREATE DATABASE ${dbName}`)
      log(`✓ 数据库 ${dbName} 已创建`)
    } else {
      log(`✓ 数据库 ${dbName} 已存在`)
    }
  } catch (err) {
    // 连不上 postgres 库时降级：直接尝试连目标库
    log(`（无法连接 postgres 管理库：${err.message}，跳过创建检查）`)
  } finally {
    await admin.end()
  }

  // ── 2. 迁移 ────────────────────────────────────────────────────
  //    已初始化的库直接跳过：schema_migrations 历史上有漏记的迁移，
  //    重跑 migrate.js 会因「policy 已存在」等报错中断。
  //    新库（schema_migrations 无记录）才执行全量迁移。
  const initCheck = new pg.Pool({ ...dbConfig, database: dbName })
  let alreadyInitialized = false
  try {
    const { rows } = await initCheck.query(
      `SELECT COUNT(*)::int AS n FROM public.schema_migrations`,
    )
    alreadyInitialized = Number(rows[0]?.n || 0) > 0
  } catch {
    alreadyInitialized = false // 表不存在 = 全新库
  } finally {
    await initCheck.end()
  }

  if (alreadyInitialized) {
    log('✓ 数据库已初始化（schema_migrations 有记录），跳过迁移')
  } else {
    run('node', ['database/migrate.js'], '执行数据库迁移（schema + migrations）')
  }

  // ── 3a. 灌演示数据 ─────────────────────────────────────────────
  if (WITH_DEMO) {
    run('node', ['database/demo/generate.mjs'], '生成演示数据')

    // 聚合回填：agg_* 表依赖事实表，需在全量数据插入后触发
    log('→ 触发聚合回填（agg_* 表）…')
    const pool = new pg.Pool({ ...dbConfig, database: dbName })
    try {
      // 取演示数据的日期范围（toISOString 保证输出 YYYY-MM-DD）
      const { rows } = await pool.query(
        `SELECT to_char(MIN(biz_date), 'YYYY-MM-DD') AS from_date,
                to_char(MAX(biz_date), 'YYYY-MM-DD') AS to_date
           FROM public.fact_trade_daily`,
      )
      if (rows[0]?.from_date) {
        const from = rows[0].from_date
        const to = rows[0].to_date
        log(`  回填区间：${from} ~ ${to}`)
        // 直接调聚合服务（在 api workspace 下用其 tsx，避免根目录无 tsx）
        const apiDir = path.join(rootDir, 'apps/api')
        const aggRes = spawnSync('node', [
          '--import', path.join(apiDir, 'node_modules/tsx/dist/loader.mjs'),
          path.join(rootDir, 'database/demo/backfill.mjs'), from, to,
        ], { cwd: apiDir, encoding: 'utf8' })
        if (aggRes.status === 0) {
          const { rows: agg } = await pool.query(
            `SELECT (SELECT COUNT(*)::int FROM agg_shop_daily) AS shop,
                    (SELECT COUNT(*)::int FROM agg_trade_day_platform_channel) AS trade,
                    (SELECT COUNT(*)::int FROM agg_traffic_day_live) AS traffic`,
          )
          log(`  ✓ 聚合回填完成（shop_daily ${agg[0].shop} / trade ${agg[0].trade} / traffic ${agg[0].traffic}）`)
        } else {
          log(`  （直接聚合失败：${(aggRes.stderr || '').split('\n')[0]}）`)
          log(`  请启动 API 后手动执行：`)
          log(`     curl -X POST http://127.0.0.1:${process.env.API_PORT || 8788}/api/v1/maintenance/aggregate \\`)
          log(`       -H 'Content-Type: application/json' -d '{"from":"${from}","to":"${to}"}'`)
        }
      } else {
        log('  （无事实数据，跳过）')
      }
    } catch (err) {
      log(`  （聚合回填检查失败：${err.message}，可由 API /maintenance/aggregate 补偿）`)
    } finally {
      await pool.end()
    }
    log('✓ 演示数据初始化完成')
  }

  // ── 3b. 清空演示数据 ───────────────────────────────────────────
  if (RESET_DEMO) {
    run('node', ['database/demo/reset.mjs'], '清空演示数据')
  }

  if (!WITH_DEMO && !RESET_DEMO) {
    log('')
    log('✓ 正式部署初始化完成（未灌入演示数据）')
    log('')
    log('下一步（数据由用户自己接入）：')
    log('  A. 用户手动上传：前端「数据管理 → 上传」，或')
    log('     POST /api/v1/ingest/manual-upload')
    log('  B. 官方平台 API 接入：前端「系统配置 → 平台授权」配置店铺凭证，或')
    log('     POST /api/v1/ingest/sync')
    log('')
    log('如需演示环境数据：node database/demo/init.mjs --with-demo')
  }
}

main().catch((err) => {
  console.error('[demo-init] 失败：', err)
  process.exit(1)
})
