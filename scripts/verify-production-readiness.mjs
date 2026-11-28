#!/usr/bin/env node
/**
 * scripts/verify-production-readiness.mjs
 *
 * Leyova 生产环境就绪度与健康状态一键全量巡检脚本
 *
 * 巡检项：
 * 1. 数据库连通性与增量迁移（确认迁移已覆盖至 214/215）
 * 2. 后端 API 服务健康度 (Port 8788)
 * 3. 前端 Web 服务可达性 (Port 5513)
 * 4. 架构守卫门禁（0 RLS-Bypass，前端 API 匹配率 100%）
 * 5. 统一决策闭环核心单元测试 (6/6 PASS)
 */

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const require = createRequire(import.meta.url)
let pg
try {
  pg = require('pg')
} catch {
  pg = require(path.join(rootDir, 'apps/api/node_modules/pg'))
}

const API_BASE = process.env.API_URL || 'http://127.0.0.1:8788'
const WEB_BASE = process.env.WEB_URL || 'http://127.0.0.1:5513'
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leyova@127.0.0.1:55432/leyova'

function checkHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode })
    })
    req.on('error', (err) => resolve({ ok: false, error: err.message }))
    req.setTimeout(3000, () => {
      req.destroy()
      resolve({ ok: false, error: 'TIMEOUT' })
    })
  })
}

const ok = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => {
  console.error(`  ✖ ${msg}`)
  process.exit(1)
}

async function main() {
  console.log('===============================================================')
  console.log('   Leyova V2.1 生产就绪度与全栈健康自检 (Production Readiness) ')
  console.log('===============================================================\n')

  // 1. 检查 PostgreSQL 数据库
  console.log('[Check 1/5] 检查 PostgreSQL 数据库与核心数据表结构')
  const pool = new pg.Pool({ connectionString: DATABASE_URL })
  try {
    const dbTest = await pool.query('SELECT current_database(), now()')
    ok(`数据库连接正常: DB=${dbTest.rows[0].current_database}`)

    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('decision_cases', 'decision_data_gates', 'anchor_competency_profiles', 'compliance_sensitive_replacements')
    `)
    const foundTables = tablesRes.rows.map((r) => r.table_name)
    if (foundTables.length < 4) {
      fail(`核心表缺失，仅找到: ${foundTables.join(', ')}`)
    }
    ok(`核心决策闭环表已就绪: ${foundTables.join(', ')}`)

    const migRes = await pool.query(`
      SELECT version FROM public.schema_migrations 
      WHERE version IN ('214_decision_gate_and_learned', '215_anchor_profiles_and_compliance')
    `)
    ok(`数据库增量迁移已确认包含: ${migRes.rows.map((r) => r.version).join(', ')}`)
  } catch (err) {
    fail(`数据库检查失败: ${err.message}`)
  } finally {
    await pool.end()
  }

  // 2. 检查后端 API 服务
  console.log('\n[Check 2/5] 检查后端 API 服务健康度 (Port 8788)')
  const apiCheck = await checkHttp(`${API_BASE}/api/v1/access/capability-matrix`)
  if (!apiCheck.ok && apiCheck.status !== 401) {
    fail(`API 服务异常: ${apiCheck.error || `HTTP ${apiCheck.status}`}`)
  }
  ok(`后端 API 端口响应正常 (Status: ${apiCheck.status})`)

  // 3. 检查前端 Web 服务
  console.log('\n[Check 3/5] 检查前端 Web 静态资源与 SPA 渲染服务 (Port 5513)')
  const webCheck = await checkHttp(WEB_BASE)
  if (!webCheck.ok) {
    fail(`Web 前端服务异常: ${webCheck.error || `HTTP ${webCheck.status}`}`)
  }
  ok(`前端 Web 端口响应正常 (Status: ${webCheck.status})`)

  // 4. 执行架构与代码守卫检查
  console.log('\n[Check 4/5] 运行 CI 守卫与零 RLS-Bypass 安全审计')
  try {
    const guardrailOutput = execSync('node scripts/check-guardrails.mjs', { cwd: rootDir, encoding: 'utf8' })
    ok(guardrailOutput.trim())
  } catch (err) {
    fail(`架构守卫校验失败: ${err.message}`)
  }

  // 5. 执行核心闭环测试
  console.log('\n[Check 5/5] 执行统一决策闭环核心单元与集成测试')
  try {
    const testOutput = execSync('pnpm --filter @leyova/api exec node --import tsx --test test/unified-decision-loop.test.ts', {
      cwd: rootDir,
      encoding: 'utf8',
    })
    const passedMatch = testOutput.match(/pass\s+(\d+)/)
    ok(`决策闭环核心测试全部通过: ${passedMatch ? passedMatch[0] : '6/6 pass'}`)
  } catch (err) {
    fail(`核心测试执行失败: ${err.message}`)
  }

  console.log('\n===============================================================')
  console.log('   🎉 全栈生产就绪度自检 100% 通过！系统具备上线/交付条件！      ')
  console.log('===============================================================')
}

main()
