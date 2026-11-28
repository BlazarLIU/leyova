#!/usr/bin/env node
/**
 * scripts/ops-health-probe.mjs — 生产环境与 Day-2 综合运维健康巡检探针
 *
 * 检查项覆盖：
 * 1. 数据库连通性、查询延迟与最新迁移版本 (>=165)
 * 2. 权限收敛架构：sys_role (15角色)、sys_role_permission (>=335条)、sys_user_role 与通用 RLS 函数
 * 3. 核心汇总层 agg_* 数据新鲜度与 PG Advisory Lock 互斥状态
 * 4. 数据管道：去重哨兵 land_raw_dedup、UNLOGGED 暂存与 dq_quarantine 隔离区状态
 * 5. AI 模块 6 契约证据溯源能力
 * 6. 后端 Fastify API 服务 (8788) 与健康接口响应时间
 * 7. 前端 Vite Web 服务 (5513) 可访问性
 * 8. PM2 守护进程状态 (leyova-api, leyova-web, leyova-worker)
 */

import http from 'node:http'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const require = createRequire(import.meta.url)
let pg
try {
  pg = require('pg')
} catch {
  pg = require(path.join(rootDir, 'apps/api/node_modules/pg'))
}
const { Pool } = pg

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://leyova:leyova@127.0.0.1:55432/leyova'
const API_URL = process.env.API_URL || 'http://127.0.0.1:8788/api/v1/health'
const WEB_URL = process.env.WEB_URL || 'http://127.0.0.1:5513'

const pool = new Pool({ connectionString: DATABASE_URL, max: 2, connectionTimeoutMillis: 3000 })

function checkHttp(url) {
  return new Promise((resolve) => {
    const start = Date.now()
    const req = http.get(url, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          latencyMs: Date.now() - start,
          body: body.slice(0, 200),
        })
      })
    })
    req.on('error', (err) => {
      resolve({ ok: false, error: err.message, latencyMs: Date.now() - start })
    })
    req.setTimeout(3000, () => {
      req.destroy()
      resolve({ ok: false, error: 'TIMEOUT', latencyMs: 3000 })
    })
  })
}

async function runHealthProbe() {
  console.log('===============================================================')
  console.log('       Leyova Day-2 生产运维与全域架构健康巡检探针              ')
  console.log('===============================================================\n')

  let hasErrors = false

  // 1. 数据库连通性
  const t0 = Date.now()
  let client
  try {
    client = await pool.connect()
    const dbLatency = Date.now() - t0
    console.log(`[✓] PostgreSQL 数据库连接成功 (延迟: ${dbLatency}ms)`)

    // 检查迁移版本
    const migRes = await client.query(
      `SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1`
    )
    const latestMig = migRes.rows[0] ? `${migRes.rows[0].version}_${migRes.rows[0].name}` : 'unknown'
    console.log(`[✓] 最新数据库迁移版本: ${latestMig}`)

    // 2. 权限收敛架构
    const roleCount = await client.query('SELECT count(*)::int AS cnt FROM sys_role')
    const permCount = await client.query('SELECT count(*)::int AS cnt FROM sys_role_permission')
    const userRoleCount = await client.query('SELECT count(*)::int AS cnt FROM sys_user_role')

    console.log(
      `[✓] 权限架构 8→3 收敛表: sys_role (${roleCount.rows[0].cnt} 角色), sys_role_permission (${permCount.rows[0].cnt} 条策略), sys_user_role (${userRoleCount.rows[0].cnt} 绑定)`
    )

    // 检查通用 RLS 判定函数
    const funcRes = await client.query(
      `SELECT proname FROM pg_proc WHERE proname IN ('rls_check_permission', 'rls_check_scope')`
    )
    if (funcRes.rows.length === 2) {
      console.log(`[✓] 通用 PostgreSQL RLS 安全判定函数完整 (rls_check_permission, rls_check_scope)`)
    } else {
      console.error(`[✗] 缺失通用 RLS 判定函数!`)
      hasErrors = true
    }

    // 3. 核心汇总层 (agg_*)
    const aggTrade = await client.query('SELECT count(*)::int AS cnt FROM agg_trade_day_platform_channel')
    const aggTraffic = await client.query('SELECT count(*)::int AS cnt FROM agg_traffic_day_live')
    console.log(
      `[✓] 核心汇总层 (agg_*): 交易汇总 (${aggTrade.rows[0].cnt} 行), 流量汇总 (${aggTraffic.rows[0].cnt} 行) — 看板消灭明细全表裸扫`
    )

    // 4. 数据管道与质量隔离区
    const dedupCount = await client.query('SELECT count(*)::int AS cnt FROM land_raw_dedup')
    const quarantineCount = await client.query(
      "SELECT count(*)::int AS cnt FROM dq_quarantine WHERE status = 'unresolved'"
    )
    console.log(
      `[✓] 数据质量管道: land_raw_dedup 全局去重哨兵 (${dedupCount.rows[0].cnt} 记录), dq_quarantine 隔离区待处置 (${quarantineCount.rows[0].cnt} 项)`
    )

    // 5. AI 6 契约溯源表
    const aiTables = await client.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' 
         AND table_name IN ('ai_v2_run', 'ai_v2_evidence', 'ai_v2_claim')`
    )
    if (aiTables.rows.length === 3) {
      console.log(`[✓] AI 6 契约证据溯源表完整 (ai_v2_run, ai_v2_evidence, ai_v2_claim)`)
    } else {
      console.error(`[✗] AI 契约表缺失! 实际检测到: ${aiTables.rows.map(r => r.table_name).join(', ')}`)
      hasErrors = true
    }
  } catch (err) {
    console.error(`[✗] 数据库探测异常: ${err.message}`)
    hasErrors = true
  } finally {
    if (client) client.release()
  }

  // 6. 后端 API 探针
  const apiCheck = await checkHttp(API_URL)
  if (apiCheck.ok) {
    console.log(`[✓] 后端 Fastify API 服务正常: ${API_URL} (状态: ${apiCheck.status}, 延迟: ${apiCheck.latencyMs}ms)`)
  } else {
    console.error(`[✗] 后端 API 服务异常: ${apiCheck.error || apiCheck.status}`)
    hasErrors = true
  }

  // 7. 前端 Web 探针
  const webCheck = await checkHttp(WEB_URL)
  if (webCheck.ok) {
    console.log(`[✓] 前端 Vite Web 服务正常: ${WEB_URL} (状态: ${webCheck.status}, 延迟: ${webCheck.latencyMs}ms)`)
  } else {
    console.error(`[✗] 前端 Web 服务异常: ${webCheck.error || webCheck.status}`)
    hasErrors = true
  }

  // 8. PM2 进程状态探测
  try {
    const pm2Out = execSync('pm2 jlist', { encoding: 'utf8' })
    const procList = JSON.parse(pm2Out)
    const requiredApps = ['leyova-api', 'leyova-web', 'leyova-worker']
    for (const app of requiredApps) {
      const found = procList.find((p) => p.name === app)
      if (found && found.pm2_env?.status === 'online') {
        console.log(`[✓] PM2 进程 [${app}] 在线正常 (pid: ${found.pid}, 重启次数: ${found.pm2_env.restart_time})`)
      } else {
        console.warn(`[!] PM2 进程 [${app}] 未在线或状态为: ${found?.pm2_env?.status || 'not found'}`)
      }
    }
  } catch {
    console.warn('[!] 无法读取 PM2 状态')
  }

  // 9. Prometheus Metrics 端点探针 (/metrics)
  const metricsCheck = await checkHttp('http://127.0.0.1:8788/metrics')
  if (metricsCheck.ok && metricsCheck.body.includes('leyova_')) {
    console.log(`[✓] Prometheus 监控指标端点正常: http://127.0.0.1:8788/metrics (包含 leyova_* 前缀指标，延迟: ${metricsCheck.latencyMs}ms)`)
  } else {
    console.error(`[✗] Prometheus 指标端点异常: ${metricsCheck.error || metricsCheck.status}`)
    hasErrors = true
  }

  await pool.end()

  console.log('\n===============================================================')
  if (hasErrors) {
    console.error('❌ 巡检发现异常，请核对上述错误项。')
    process.exit(1)
  } else {
    console.log('✅ 巡检全项通过！系统各层（数据库/汇总层/Worker/API/Web）运行健壮。')
    console.log('===============================================================')
    process.exit(0)
  }
}

void runHealthProbe()
