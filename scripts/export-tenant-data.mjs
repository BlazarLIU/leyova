#!/usr/bin/env node
/**
 * scripts/export-tenant-data.mjs — 租户经营决策资产与数据便携导出工具
 *
 * 依据 WP-08 交付规范（数据可便携与客户可迁移）：
 * 1. 严格按租户隔离（Tenant Isolation）导出客户数据资产；
 * 2. 导出内容覆盖：
 *    - 决策案与 Decision Memo 事实/假设/预测全记录
 *    - 分层数据 Gate 诊断评估历史
 *    - 决策追踪与改进任务列表
 *    - 主播能力画像与合规任务流
 * 3. 产出标准结构化 JSON 资产归档包，确保客户数据自主可迁移。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

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

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://leyova@127.0.0.1:55432/leyova'
const tenantId = parseInt(process.argv[2] || '1', 10)

const ok = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => {
  console.error(`  ✖ ${msg}`)
  process.exit(1)
}

async function main() {
  console.log('===============================================================')
  console.log(`   Leyova 租户经营决策资产全量导出工具 (Tenant ID: ${tenantId})   `)
  console.log('===============================================================\n')

  const pool = new pg.Pool({ connectionString: DATABASE_URL })

  try {
    const exportDir = path.join(rootDir, 'exports', `tenant_${tenantId}_${Date.now()}`)
    fs.mkdirSync(exportDir, { recursive: true })

    // 1. 决策案与 Memo
    console.log('[1/4] 导出决策案与 Decision Memo 记录')
    const casesRes = await pool.query(
      `SELECT * FROM public.decision_cases WHERE tenant_id = $1 ORDER BY id ASC`,
      [tenantId]
    )
    ok(`检索到 ${casesRes.rows.length} 份决策案记录`)

    // 2. 数据 Gate 门禁诊断
    console.log('\n[2/4] 导出分层数据 Gate 诊断与质量证据')
    const gatesRes = await pool.query(
      `SELECT * FROM public.decision_data_gates WHERE tenant_id = $1 ORDER BY id ASC`,
      [tenantId]
    )
    ok(`检索到 ${gatesRes.rows.length} 条门禁评估明细`)

    // 3. 决策追踪与改进任务
    console.log('\n[3/4] 导出决策追踪与履约改进任务')
    const tasksRes = await pool.query(
      `SELECT t.* FROM public.improvement_tasks t
       INNER JOIN public.decision_cases c ON t.decision_case_id = c.id
       WHERE c.tenant_id = $1 ORDER BY t.id ASC`,
      [tenantId]
    )
    ok(`检索到 ${tasksRes.rows.length} 项追踪行动项`)

    // 4. 主播画像与合规任务
    console.log('\n[4/4] 导出主播画像与合规整改任务')
    const anchorsRes = await pool.query(
      `SELECT * FROM public.anchor_competency_profiles WHERE tenant_id = $1 ORDER BY id ASC`,
      [tenantId]
    )
    const complianceRes = await pool.query(
      `SELECT * FROM public.compliance_learning_tasks WHERE tenant_id = $1 ORDER BY id ASC`,
      [tenantId]
    )
    ok(`检索到 ${anchorsRes.rows.length} 位主播画像与 ${complianceRes.rows.length} 项合规学习任务`)

    // 组装完整归档包
    const exportBundle = {
      tenantId,
      exportedAt: new Date().toISOString(),
      systemVersion: 'v2.1.0',
      manifest: {
        decisionCasesCount: casesRes.rows.length,
        qualityGatesCount: gatesRes.rows.length,
        improvementTasksCount: tasksRes.rows.length,
        anchorProfilesCount: anchorsRes.rows.length,
        complianceTasksCount: complianceRes.rows.length,
      },
      decisionCases: casesRes.rows,
      dataGates: gatesRes.rows,
      improvementTasks: tasksRes.rows,
      anchorProfiles: anchorsRes.rows,
      complianceTasks: complianceRes.rows,
    }

    const bundlePath = path.join(exportDir, 'decision_assets_bundle.json')
    fs.writeFileSync(bundlePath, JSON.stringify(exportBundle, null, 2), 'utf8')

    console.log('\n===============================================================')
    console.log('✓ 客户数据便携包已成功导出！')
    console.log(`  导出目录: ${exportDir}`)
    console.log(`  归档主包: ${bundlePath}`)
    console.log(`  数据规模: 决策案 ${casesRes.rows.length} 份, 门禁记录 ${gatesRes.rows.length} 条, 行动项 ${tasksRes.rows.length} 项`)
    console.log('===============================================================')
  } catch (err) {
    fail(`导出执行失败: ${err.message}`)
  } finally {
    await pool.end()
  }
}

main()
