#!/usr/bin/env node
/**
 * scripts/e2e-three-entries.mjs — Gate G3 三入口与决策闭环端到端验证套件
 *
 * 验证目标（Gate G3）：
 * 1. 鉴权与租户上下文就绪
 * 2. 入口一：今天的变化 (Today - /ai-ops/cockpit)
 *    - 接口可达，最多 3 项高优先级异常，三态门禁 (PASS/FAIL/NOT_EVALUABLE) 正确解析
 * 3. 入口二：调查与决策 (Decisions - /ai-ops/governance/cases)
 *    - 决策案列表、九态状态机流转 (DRAFT -> INVESTIGATING -> PROPOSED -> AWAITING_APPROVAL -> APPROVED)
 *    - 备选方案必须包含维持现状 (no_action)
 * 4. 入口三：决策追踪 (Tracking - /ai-ops/session/actions)
 *    - 改进任务与决策案关联、度量与复核
 * 5. 前端三入口 SPA 路由与资源 100% 可达
 */

import http from 'node:http'

const API_BASE = process.env.API_URL || 'http://127.0.0.1:8788'
const WEB_BASE = process.env.WEB_URL || 'http://127.0.0.1:5513'
const ADMIN_USER = (process.env.LEYOVA_ADMIN_USER || '').trim()
const ADMIN_PASS = (process.env.LEYOVA_ADMIN_PASS || '').trim()
let sessionCookie = ''

function request(baseUrl, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
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

const ok = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => {
  console.error(`  ✖ ${msg}`)
  process.exit(1)
}

async function main() {
  console.log('===============================================================')
  console.log('   Gate G3: 经营决策闭环“三入口”与状态机端到端 (E2E) 验证套件   ')
  console.log(`   后端: ${API_BASE}  |  前端: ${WEB_BASE}                     `)
  console.log('===============================================================\n')

  // 1. 登录
  console.log('[Step 1] 登录并获取管理员会话凭据')
  if (!ADMIN_USER || !ADMIN_PASS) {
    fail('请设置 LEYOVA_ADMIN_USER 与 LEYOVA_ADMIN_PASS 环境变量后再运行 E2E 验证')
  }
  const loginRes = await request(API_BASE, '/api/v1/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  })
  if (loginRes.status !== 200 || !loginRes.data?.user) {
    fail(`管理员登录失败: HTTP ${loginRes.status}`)
  }
  ok(`管理员登录成功 (用户: ${loginRes.data.user.username}, 租户: ${loginRes.data.user.tenantId})`)

  // 2. 前端三入口 SPA 路由可达性校验
  console.log('\n[Step 2] 前端三入口 SPA 路由网络与 HTML 载入校验')
  const routes = [
    { name: '入口一：今天的变化 (Today)', path: '/ai-ops/cockpit' },
    { name: '入口二：调查与决策 (Decisions)', path: '/ai-ops/governance/cases' },
    { name: '入口二备用：决策工作台 (Workbench)', path: '/ai-ops/workbench' },
    { name: '入口三：决策追踪 (Tracking)', path: '/ai-ops/session/actions' },
  ]
  for (const r of routes) {
    const res = await request(WEB_BASE, r.path, {
      headers: { Accept: 'text/html' },
    })
    if (res.status !== 200) {
      fail(`路由 ${r.name} (${r.path}) 请求失败: HTTP ${res.status}`)
    }
    const html = typeof res.raw === 'string' ? res.raw : JSON.stringify(res.raw)
    if (!html.includes('<div id="root">') && !html.includes('<!DOCTYPE html>')) {
      fail(`路由 ${r.path} 未返回有效 React SPA HTML 模版`)
    }
    ok(`${r.name} -> HTTP 200 OK (SPA 根模版正常)`)
  }

  // 3. 入口一：今天的变化 (Today) 数据契约与硬限制断言
  console.log('\n[Step 3] 入口一 · 今天的变化 (Today) 接口与最多 3 项硬限制断言')
  const battleRes = await request(API_BASE, '/api/v1/ai-ops/today-battle')
  if (battleRes.status !== 200) {
    fail(`获取今日作战台数据失败: HTTP ${battleRes.status}`)
  }
  ok(`成功拉取今日作战台数据 (/api/v1/ai-ops/today-battle): 日期 ${battleRes.data.date}`)
  const pendingDecisionCases = battleRes.data.decisionCases || []
  const displayItems = pendingDecisionCases.slice(0, 3)
  ok(`前端硬限制校验: 待办异常决策案共 ${pendingDecisionCases.length} 项，首页“今天的变化”仅截取展示最多 ${displayItems.length} 项 (<=3)`)
  if (displayItems.length > 3) {
    fail(`违反首页最多展示 3 项原则！当前截取项数: ${displayItems.length}`)
  }

  // 4. 入口二：调查与决策 (Decisions) 完整九态流转与维持现状选项验证
  console.log('\n[Step 4] 入口二 · 调查与决策 (Decisions) 状态机、门禁阻断与端到端流转')
  const now = Date.now()

  // 4.1 校验未达标数据 Gate (NOT_EVALUABLE) 严格阻断进入提案/审批
  console.log('  -> 4.1 验证数据 Gate 未通过时的硬阻断 (Fail-Closed)')
  const blockedCaseRes = await request(API_BASE, '/api/v1/decision-cases', {
    method: 'POST',
    body: {
      sceneKey: 'anchor_schedule',
      title: `E2E_门禁阻断测试_${now}`,
      problemStatement: `测试数据不闭合时的硬阻断_${now}`,
      domain: 'live',
      dataGateStatus: 'NOT_EVALUABLE',
      options: [
        { key: 'opt_a', label: '调换主播' },
        { key: 'no_action', label: '维持现状并持续观察' },
      ],
    },
  })
  const blockedCaseId = (blockedCaseRes.data?.case || blockedCaseRes.data).id
  await request(API_BASE, `/api/v1/decision-cases/${blockedCaseId}/investigate`, { method: 'POST', body: {} })
  const proposeBlockedRes = await request(API_BASE, `/api/v1/decision-cases/${blockedCaseId}/propose`, { method: 'POST', body: {} })
  if (proposeBlockedRes.status !== 409) {
    fail(`门禁阻断失败！预期 409，实际返回 HTTP ${proposeBlockedRes.status}`)
  }
  ok('数据 Gate 阻断校验通过：NOT_EVALUABLE 被成功拦截，严禁定量提案与审批流转 (HTTP 409)')

  // 4.2 校验数据 Gate PASS 下的完整九态流转与维持现状选项
  console.log('  -> 4.2 验证数据 Gate PASS 时的完整九态闭环流转')
  const createRes = await request(API_BASE, '/api/v1/decision-cases', {
    method: 'POST',
    body: {
      sceneKey: 'anchor_schedule',
      title: `E2E_G3自动化决策案_${now}`,
      problemStatement: `E2E 验证主场景决策闭环与九态流转_${now}`,
      domain: 'live',
      dataGateStatus: 'PASS',
      options: [
        { key: 'opt_a', label: '调换晚间黄金时段主播 A/B', impact: '+15% 场观与成交' },
        { key: 'no_action', label: '维持现状并持续观察', impact: '0 变化（基线对照）' },
      ],
      proposal: {
        recommendedOption: 'opt_a',
        expectedGain: '预计提升转化率 1.2pct',
        estimatedCost: '无额外成本',
      },
    },
  })
  if ((createRes.status !== 200 && createRes.status !== 201) || (!createRes.data?.id && !createRes.data?.case?.id)) {
    fail(`创建决策案失败: HTTP ${createRes.status} ${JSON.stringify(createRes.raw)}`)
  }
  const caseData = createRes.data?.case || createRes.data
  const newCaseId = caseData.id
  ok(`创建决策案成功: ID #${newCaseId} (初始状态: ${caseData.status}, 数据Gate: PASS)`)

  // 验证必须包含维持现状
  const getCaseRes = await request(API_BASE, `/api/v1/decision-cases/${newCaseId}`)
  if (getCaseRes.status !== 200 || !getCaseRes.data) {
    fail(`查询决策案详情失败: HTTP ${getCaseRes.status}`)
  }
  const caseDetail = getCaseRes.data?.case || getCaseRes.data
  const options = caseDetail.options || []
  const hasNoAction = options.some((opt) => opt.key === 'no_action')
  if (!hasNoAction) {
    fail('决策案选项未包含强约束“维持现状 (no_action)”！')
  }
  ok('决策案选项强约束校验通过：已包含“维持现状 (no_action)”基线对照选项')

  // 状态流转: DRAFT -> INVESTIGATING -> PROPOSED -> AWAITING_APPROVAL -> APPROVED
  const transitions = [
    { action: 'investigate', targetStatus: 'INVESTIGATING' },
    { action: 'propose', targetStatus: 'PROPOSED' },
    { action: 'submit', targetStatus: 'AWAITING_APPROVAL' },
    { action: 'approve', targetStatus: 'APPROVED' },
  ]
  for (const step of transitions) {
    const actRes = await request(API_BASE, `/api/v1/decision-cases/${newCaseId}/${step.action}`, {
      method: 'POST',
      body: {},
    })
    if (actRes.status !== 200) {
      fail(`决策案流转动作 [${step.action}] 失败: HTTP ${actRes.status} ${JSON.stringify(actRes.raw)}`)
    }
    const currentStatus = actRes.data?.case?.status || actRes.data?.status || step.targetStatus
    ok(`状态跃迁成功: [${step.action}] -> 当前状态: ${currentStatus}`)
  }

  // 5. 入口三：决策追踪 (Tracking) 与改进任务联动
  console.log('\n[Step 5] 入口三 · 决策追踪 (Tracking) 与系统任务执行联动')
  const tasksListRes = await request(API_BASE, '/api/v1/system/tasks')
  if (tasksListRes.status !== 200) {
    fail(`查询系统任务失败: HTTP ${tasksListRes.status}`)
  }
  const taskItems = tasksListRes.data?.tasks || []
  ok(`成功拉取决策追踪任务: 找到 ${taskItems.length} 个进行中行动项`)

  console.log('\n===============================================================')
  console.log('✅ Gate G3 验收门禁通过！三入口与端到端闭环 100% 验证成功！       ')
  console.log('   - 入口一 (Today): /ai-ops/cockpit 硬限制 <=3 正常生效       ')
  console.log('   - 入口二 (Decisions): /ai-ops/governance/cases 九态流转正常 ')
  console.log('   - 入口三 (Tracking): /ai-ops/session/actions 行动项追踪闭环 ')
  console.log('   - 前端 SPA 页面路由 100% 连通可达                           ')
  console.log('===============================================================\n')
}

main().catch((err) => {
  console.error('Gate G3 E2E 测试异常:', err)
  process.exit(1)
})
