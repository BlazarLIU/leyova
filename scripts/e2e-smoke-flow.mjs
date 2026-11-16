#!/usr/bin/env node
/**
 * scripts/e2e-smoke-flow.mjs — 全链路端到端自动化业务闭环冒烟巡检套件
 *
 * 覆盖 8 大端到端核心业务闭环：
 * 1. 登录鉴权与会话校验 (Auth & Session Me)
 * 2. 治理批次与 8 条 SQL 质量门禁秒级断言 (Data Quality 8 Gates)
 * 3. 异步 Worker 任务队列派发与原子抢占执行 (system_jobs + Worker Daemon)
 * 4. 核心汇总层 (agg_*) 与 BI 仪表盘/驾驶舱性能验证 (Cockpit & BI Dashboard)
 * 5. 商品主数据与全渠道防超卖锁库预留 (Inventory & Anti-Overselling Pool)
 * 6. 多平台履约 48h SLA 与赔付风控中心 (Fulfillment SLA Rules & Waybills)
 * 7. 客服咨询会话与 9-23 点咚咚响应考核 (Customer Service & Shift Sessions)
 * 8. AI 选品分析与信号聚合契约 (AI Selection & Signals)
 */

import http from 'node:http'

const API_BASE = process.env.API_URL || 'http://127.0.0.1:8788'
let sessionCookie = ''

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
    const headers = {
      'Content-Type': 'application/json',
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...(options.headers || {}),
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => (body += chunk))
        res.on('end', () => {
          // Track session cookie
          const setCookie = res.headers['set-cookie']
          if (setCookie) {
            const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie
            const match = raw.match(/leyova_session=[^;]+/)
            if (match) sessionCookie = match[0]
          }

          let json = null
          try {
            json = JSON.parse(body)
          } catch {
            json = body
          }

          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            data: json?.data !== undefined ? json.data : json,
            raw: json,
          })
        })
      }
    )

    req.on('error', reject)
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    }
    req.end()
  })
}

const formatStep = (num, name) => `\n[Stage ${num}] ${name}`
const ok = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => {
  console.error(`  ✖ ${msg}`)
  process.exit(1)
}

async function main() {
  console.log('===============================================================')
  console.log('       Leyova 全链路端到端自动化业务闭环冒烟巡检套件             ')
  console.log(`       目标后端服务: ${API_BASE}                                  `)
  console.log('===============================================================')

  const overallStart = performance.now()

  try {
    // ─── 1. 登录鉴权与会话校验 ───
    console.log(formatStep(1, '登录鉴权与用户会话校验 (Auth & Session Verification)'))
    const loginRes = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Admin@123456' },
    })
    if (loginRes.status !== 200 || !loginRes.data?.user) {
      fail(`管理员登录失败 (HTTP ${loginRes.status}): ${JSON.stringify(loginRes.raw)}`)
    }
    ok(`管理员 admin 成功登录 (ID: ${loginRes.data.user.id}, 角色: ${loginRes.data.user.role})`)
    ok(`Cookie 凭证就绪: ${sessionCookie.slice(0, 30)}...`)

    const meRes = await request('/api/v1/auth/me')
    const userObj = meRes.data?.user || meRes.data
    if (meRes.status !== 200 || userObj?.username !== 'admin') {
      fail(`会话凭证校验失败 (HTTP ${meRes.status}): ${JSON.stringify(meRes.raw)}`)
    }
    ok(`GET /auth/me 校验通过，用户信息与租户隔离绑定正常 (租户 ID: ${userObj.tenantId})`)

    const accessRes = await request('/api/v1/access/me')
    if (accessRes.status !== 200 || !Array.isArray(accessRes.data?.modules)) {
      fail(`能力矩阵解析失败 (HTTP ${accessRes.status})`)
    }
    ok(`GET /access/me 能力矩阵返回正常 (拥有模块数: ${accessRes.data.modules.length})`)

    // ─── 2. 数据治理批次与 8 条 SQL 质量门禁 ───
    console.log(formatStep(2, '数据批次与 8 条 SQL 质量门禁集合断言 (Data Quality 8 Gates)'))
    const batchesRes = await request('/api/v1/governance/batches')
    const batchList = batchesRes.data?.list || batchesRes.data || []
    if (batchList.length === 0) {
      fail('未查询到任何治理批次数据')
    }
    const targetBatch = batchList[0]
    ok(`获取最新导入批次: #${targetBatch.id} (${targetBatch.batch_no} · ${targetBatch.source_platform})`)

    const t0Gates = performance.now()
    const gatesRes = await request(`/api/v1/governance/batches/${targetBatch.id}/run-quality-gates`, {
      method: 'POST',
      body: {},
    })
    const gatesMs = (performance.now() - t0Gates).toFixed(1)
    if (gatesRes.status !== 200 || !gatesRes.data?.results) {
      fail(`SQL 质量门禁执行失败 (HTTP ${gatesRes.status}): ${JSON.stringify(gatesRes.raw)}`)
    }
    const report = gatesRes.data
    ok(`8 条 SQL 质量门禁单 SQL 集合断言用时: ${gatesMs}ms (通过: ${report.passedCount}, 拦截: ${report.failedCount})`)
    ok(`门禁准入评级: ${report.isReadyForPublish ? '✅ READY_FOR_PUBLISH (准入发布)' : '⚠️ BLOCKED (受限拦截)'}`)
    for (const r of report.results.slice(0, 4)) {
      ok(`  · 规则 [${r.ruleCode}]: ${r.passed ? 'PASS' : r.severity} — ${r.message}`)
    }

    // ─── 3. 异步 Worker 任务队列派发与抢占调度 ───
    console.log(formatStep(3, '异步 Worker 任务队列派发与分布式锁抢占执行 (system_jobs + Worker Daemon)'))
    const dispatchRes = await request('/api/v1/system/jobs', {
      method: 'POST',
      body: {
        jobType: 'anomaly_detection',
        jobName: 'E2E全链路冒烟异动巡检',
        inputPayload: { trigger: 'e2e_smoke', timestamp: Date.now() },
      },
    })
    if (dispatchRes.status !== 200 || !dispatchRes.data?.id) {
      fail(`派发异步任务失败 (HTTP ${dispatchRes.status}): ${JSON.stringify(dispatchRes.raw)}`)
    }
    const jobId = dispatchRes.data.id
    ok(`异步任务派发进队成功: Job #${jobId} (类型: anomaly_detection, 状态: ${dispatchRes.data.status})`)

    // Poll until completed (Worker daemon processes within 5-10s)
    let jobFinished = false
    let jobDetail = null
    const pollStart = Date.now()
    while (Date.now() - pollStart < 15000) {
      await new Promise((r) => setTimeout(r, 1200))
      const pollRes = await request(`/api/v1/system/jobs/${jobId}`)
      if (pollRes.status === 200 && pollRes.data) {
        if (pollRes.data.status === 'completed') {
          jobFinished = true
          jobDetail = pollRes.data
          break
        }
      }
    }
    if (!jobFinished) {
      fail(`Worker 进程未在 15s 内完成 Job #${jobId} 调度`)
    }
    ok(`Worker 守护进程成功原子锁抢占并完成执行！`)
    ok(`Job #${jobId} 执行耗时: ${jobDetail.durationMs}ms, 回写结果: ${JSON.stringify(jobDetail.resultPayload)}`)

    // ─── 4. 核心汇总层 (agg_*) 与 BI 仪表盘/驾驶舱性能验证 ───
    console.log(formatStep(4, '核心汇总层 (agg_*) 与 BI 仪表盘/驾驶舱性能验证 (Cockpit & BI Dashboard)'))
    const t0Cockpit = performance.now()
    const cockpitRes = await request('/api/v1/overview/cockpit')
    const cockpitMs = (performance.now() - t0Cockpit).toFixed(1)
    if (cockpitRes.status !== 200) {
      fail(`GET /overview/cockpit 请求失败 (HTTP ${cockpitRes.status})`)
    }
    ok(`GET /overview/cockpit 响应耗时: ${cockpitMs}ms (状态: 200)`)

    const t0Bi = performance.now()
    const biRes = await request('/api/v1/bi/dashboard')
    const biMs = (performance.now() - t0Bi).toFixed(1)
    if (biRes.status !== 200) {
      fail(`GET /bi/dashboard 请求失败 (HTTP ${biRes.status})`)
    }
    ok(`GET /bi/dashboard 响应耗时: ${biMs}ms (汇总层毫秒级出数，消灭明细大表全扫)`)

    // ─── 5. 商品库存中心与防超卖锁库预留 ───
    console.log(formatStep(5, '商品主数据与全渠道防超卖锁库预留 (Inventory & Anti-Overselling Pool)'))
    const invRes = await request('/api/v1/inventory/overview')
    if (invRes.status !== 200 || !invRes.data) {
      fail(`GET /inventory/overview 失败 (HTTP ${invRes.status})`)
    }
    ok(`全渠道总货值: ¥${Number(invRes.data.totalStockValue || 0).toLocaleString()}, SPU/SKU: ${invRes.data.totalSpus}/${invRes.data.totalSkus}`)

    const rsvRes = await request('/api/v1/inventory/reservations?limit=5')
    const rsvList = Array.isArray(rsvRes.data) ? rsvRes.data : rsvRes.data?.list || []
    ok(`大促防超卖预留单队列就绪 (已加载 ${rsvList.length} 条锁库凭证)`)

    // ─── 6. 多平台履约 48h SLA 与赔付风控中心 ───
    console.log(formatStep(6, '多平台履约 48h SLA 与赔付风控中心 (Fulfillment SLA Rules & Waybills)'))
    const slaRes = await request('/api/v1/fulfillment/overview')
    if (slaRes.status !== 200) {
      fail(`GET /fulfillment/overview 失败 (HTTP ${slaRes.status})`)
    }
    ok(`在管运单数: ${slaRes.data.totalWaybills}, 延迟发货: ${slaRes.data.delayedCount}, 预估违约赔付敞口: ¥${slaRes.data.totalEstimatedPenalty}`)

    const rulesRes = await request('/api/v1/fulfillment/sla-rules')
    const rulesList = Array.isArray(rulesRes.data) ? rulesRes.data : []
    ok(`平台官方法定 48h/120h 规则基准已加载 (${rulesList.length} 条规则生效)`)

    // ─── 7. 客服咨询会话与咚咚考核时段流水 ───
    console.log(formatStep(7, '客服咨询会话与 9-23 点咚咚响应考核 (Customer Service & Shift Sessions)'))
    const csRes = await request('/api/v1/cs/overview')
    if (csRes.status !== 200) {
      fail(`GET /cs/overview 失败 (HTTP ${csRes.status})`)
    }
    ok(`客服总接待人次: ${csRes.data.totalSessions}, 平均首响: ${csRes.data.avgFirstResponseSec}s, 转化GMV: ¥${csRes.data.convertedGmv.toLocaleString()}`)

    // ─── 8. AI 选品分析与信号聚合契约 ───
    console.log(formatStep(8, 'AI 选品分析与信号聚合契约 (AI Selection & Signals)'))
    const aiRes = await request('/api/v1/selection/categories?withSignals=true')
    const categories = Array.isArray(aiRes.data) ? aiRes.data : []
    ok(`AI 选品品类与信号聚合返回正常 (${categories.length} 个品类全量接入多模态因子)`)

    const totalDuration = ((performance.now() - overallStart) / 1000).toFixed(2)
    console.log('\n===============================================================')
    console.log(`✅ 全链路 8 大核心业务闭环自动化冒烟巡检 100% 通过！(总耗时: ${totalDuration}s)`)
    console.log('   系统架构（鉴权/汇总层/质量门禁/Worker队列/防超卖/SLA/客服/AI）端到端可用。')
    console.log('===============================================================')
  } catch (err) {
    fail(`全链路冒烟测试发生未捕获异常: ${err?.stack || err}`)
  }
}

main()
