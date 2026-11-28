import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decideToolPolicy,
  tierFromRiskLevel,
  isR4ToolName,
  type PolicyRow,
} from '../../src/ai/policy.js'
import { detectIntentByRules } from '../../src/ai/run/intent.js'
import { computePayloadDigest, stableStringify } from '../../src/ai/payload-digest.js'
import { buildReceipt } from '../../src/ai/approvals.js'
import { isLocalOrPrivateHost } from '../../src/ai/llm/provider.js'

// ── R 分级默认策略 ──
test('policy: 风险等级映射为 R0/R2/R3/R4', () => {
  assert.equal(tierFromRiskLevel('read_only'), 'R0')
  assert.equal(tierFromRiskLevel('write_with_approval'), 'R2')
  assert.equal(tierFromRiskLevel('admin_only'), 'R3')
  assert.equal(tierFromRiskLevel('forbidden'), 'R4')
})

test('policy: 只读自动放行，写操作需审批', () => {
  assert.equal(decideToolPolicy({ name: 'get_live_summary', riskLevel: 'read_only' }).effect, 'allow')
  const write = decideToolPolicy({ name: 'create_task_x', riskLevel: 'write_with_approval' })
  assert.equal(write.effect, 'require_approval')
  assert.equal(write.tier, 'R2')
  const admin = decideToolPolicy({ name: 'admin_tool', riskLevel: 'admin_only' })
  assert.equal(admin.effect, 'require_approval')
  assert.equal(admin.tier, 'R3')
})

test('policy: R4 资金/密钥工具永久拒绝，配置 allow 也不行', () => {
  assert.equal(isR4ToolName('payment_create'), true)
  assert.equal(isR4ToolName('api_key_rotate'), true)
  assert.equal(isR4ToolName('get_live_summary'), false)

  const row: PolicyRow = {
    tool_name: 'payment_create',
    risk_tier: 'R0',
    effect: 'allow',
    required_permission: null,
    max_calls_per_run: null,
    is_enabled: true,
  }
  const d = decideToolPolicy({ name: 'payment_create', riskLevel: 'read_only' }, row)
  assert.equal(d.effect, 'deny')
  assert.equal(d.source, 'r4_guard')
})

test('policy: 策略 deny 直接拒绝；写工具即便 allow 仍需审批（fail-closed）', () => {
  const denyRow: PolicyRow = {
    tool_name: 'danger_tool',
    risk_tier: 'R2',
    effect: 'deny',
    required_permission: null,
    max_calls_per_run: null,
    is_enabled: true,
  }
  assert.equal(decideToolPolicy({ name: 'danger_tool', riskLevel: 'write_with_approval' }, denyRow).effect, 'deny')

  const allowWriteRow: PolicyRow = {
    tool_name: 'update_task_status',
    risk_tier: 'R2',
    effect: 'allow',
    required_permission: null,
    max_calls_per_run: null,
    is_enabled: true,
  }
  const d = decideToolPolicy({ name: 'update_task_status', riskLevel: 'write_with_approval' }, allowWriteRow)
  assert.equal(d.effect, 'require_approval')
})

test('policy: R1 草稿策略可自动执行', () => {
  const row: PolicyRow = {
    tool_name: 'generate_selection_plan',
    risk_tier: 'R1',
    effect: 'allow',
    required_permission: null,
    max_calls_per_run: null,
    is_enabled: true,
  }
  const d = decideToolPolicy({ name: 'generate_selection_plan', riskLevel: 'read_only' }, row)
  assert.equal(d.effect, 'allow')
  assert.equal(d.tier, 'R1')
})

// ── 意图路由（规则） ──
test('intent: 写操作 / 分析 / 寒暄 / 澄清 规则分类', () => {
  assert.equal(detectIntentByRules('帮我暂停这个直播间的投放计划').intent, 'ops_action')
  assert.equal(detectIntentByRules('为什么最近 GMV 环比下降？').intent, 'analysis')
  assert.equal(detectIntentByRules('你好').intent, 'smalltalk')
  assert.equal(detectIntentByRules('').intent, 'clarify')
})

test('intent: 无关键词长句默认分析，短句要求澄清', () => {
  assert.equal(detectIntentByRules('看看昨天的整体情况怎么样').intent, 'analysis')
  assert.equal(detectIntentByRules('看下').intent, 'clarify')
})

// ── 审批 payload 摘要与回执 ──
test('digest: 键顺序不影响摘要，内容变化摘要变化', () => {
  const a = computePayloadDigest({ b: 2, a: 1 })
  const b = computePayloadDigest({ a: 1, b: 2 })
  assert.equal(a, b)
  assert.notEqual(a, computePayloadDigest({ a: 2, b: 2 }))
  assert.equal(stableStringify({ b: [3, { d: 4, c: 5 }], a: null }), '{"a":null,"b":[3,{"c":5,"d":4}]}')
})

test('receipt: 成功回执包含摘要、耗时与执行人', () => {
  const receipt = buildReceipt({
    approvalPublicId: '11111111-1111-1111-1111-111111111111',
    toolName: 'update_task_status',
    toolLogId: 42,
    ok: true,
    executedBy: 7,
    payloadDigest: 'abc',
    startedAt: Date.now() - 5,
    result: { updated: true },
  })
  assert.equal(receipt.ok, true)
  assert.equal(receipt.toolLogId, 42)
  assert.equal(receipt.executedBy, 7)
  assert.match(receipt.resultSummary || '', /updated/)
  assert.ok(receipt.durationMs >= 0)
})

// ── 模型网关 SSRF ──
test('gateway: 拒绝 loopback / 内网 / 元数据地址', () => {
  assert.equal(isLocalOrPrivateHost('http://localhost:8788/v1'), true)
  assert.equal(isLocalOrPrivateHost('http://127.0.0.1/v1'), true)
  assert.equal(isLocalOrPrivateHost('http://10.0.0.8/v1'), true)
  assert.equal(isLocalOrPrivateHost('http://192.168.1.10/v1'), true)
  assert.equal(isLocalOrPrivateHost('http://172.20.0.5/v1'), true)
  assert.equal(isLocalOrPrivateHost('http://169.254.169.254/latest/meta-data'), true)
  assert.equal(isLocalOrPrivateHost('https://api.deepseek.com'), false)
})
