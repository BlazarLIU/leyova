/**
 * test/generation.test.ts — W10 PromptOps 与生成链路单测
 *
 * 覆盖：模板渲染（不执行表达式）、必填变量校验、灰度选择确定性、
 *      版本不可变性（DB 触发器由 curl 实测覆盖）。
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bucketOf,
  missingVariables,
  pickVersion,
  renderTemplate,
  type PromptTemplateView,
} from '../src/generation/prompts.js'
import { scanBannedWords } from '../src/knowledge/service.js'

function makeTemplate(overrides: Partial<PromptTemplateView> = {}): PromptTemplateView {
  return {
    id: 'tpl-1',
    key: 'live_script',
    name: '直播脚本',
    scene: 'script',
    platform: 'all',
    category: 'all',
    description: '',
    variables: [
      { name: 'product', required: true },
      { name: 'audience', required: false },
    ],
    activeVersion: 1,
    canaryVersion: null,
    canaryRatio: 0,
    status: 'active',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('W10 PromptOps：模板渲染', () => {
  test('替换具名变量', () => {
    const text = renderTemplate('商品：{{product}}，人群：{{ audience }}', {
      product: '春季风衣',
      audience: '通勤女性',
    })
    assert.equal(text, '商品：春季风衣，人群：通勤女性')
  })

  test('缺失变量替换为空串而不是保留占位符', () => {
    assert.equal(renderTemplate('你好 {{name}}', {}), '你好 ')
  })

  test('数组变量按行拼接，对象变量序列化', () => {
    assert.equal(renderTemplate('{{list}}', { list: ['A', 'B'] }), 'A\nB')
    assert.equal(renderTemplate('{{obj}}', { obj: { a: 1 } }), '{"a":1}')
  })

  test('不执行表达式，避免模板注入', () => {
    const text = renderTemplate('{{process.exit(1)}}', {})
    assert.equal(text, '')
    const text2 = renderTemplate('{{a + b}}', { a: '1', b: '2' })
    assert.equal(text2, '')
  })

  test('同一变量多次出现全部替换', () => {
    assert.equal(renderTemplate('{{p}}-{{p}}', { p: 'X' }), 'X-X')
  })
})

describe('W10 PromptOps：必填变量校验', () => {
  test('缺少必填变量时返回变量名列表', () => {
    assert.deepEqual(missingVariables(makeTemplate(), {}), ['product'])
    assert.deepEqual(missingVariables(makeTemplate(), { product: '   ' }), ['product'])
  })

  test('必填变量齐全时不报缺失', () => {
    assert.deepEqual(missingVariables(makeTemplate(), { product: '风衣' }), [])
  })

  test('可选变量缺失不影响', () => {
    assert.deepEqual(missingVariables(makeTemplate(), { product: '风衣', audience: undefined }), [])
  })
})

describe('W10 PromptOps：灰度版本选择', () => {
  test('无灰度时恒用生效版本', () => {
    const template = makeTemplate({ activeVersion: 3 })
    for (const seed of ['a', 'b', 'c', 'SPU-1']) {
      assert.deepEqual(pickVersion(template, seed), { version: 3, isCanary: false })
    }
  })

  test('灰度 100% 时全部命中灰度版本', () => {
    const template = makeTemplate({ activeVersion: 1, canaryVersion: 2, canaryRatio: 100 })
    assert.deepEqual(pickVersion(template, 'anything'), { version: 2, isCanary: true })
  })

  test('灰度 0 时全部走生效版本', () => {
    const template = makeTemplate({ activeVersion: 1, canaryVersion: 2, canaryRatio: 0 })
    assert.deepEqual(pickVersion(template, 'anything'), { version: 1, isCanary: false })
  })

  test('同一业务键稳定命中同一版本（可对比效果）', () => {
    const template = makeTemplate({ activeVersion: 1, canaryVersion: 2, canaryRatio: 30 })
    const first = pickVersion(template, 'SPU-A1')
    for (let i = 0; i < 20; i += 1) {
      assert.deepEqual(pickVersion(template, 'SPU-A1'), first)
    }
  })

  test('灰度比例大致符合配置（30% 允许 ±20 个百分点误差）', () => {
    const template = makeTemplate({ activeVersion: 1, canaryVersion: 2, canaryRatio: 30 })
    let canary = 0
    const total = 400
    for (let i = 0; i < total; i += 1) {
      if (pickVersion(template, `SPU-${i}`).isCanary) canary += 1
    }
    const ratio = (canary / total) * 100
    assert.ok(ratio >= 10 && ratio <= 50, `灰度比例异常：${ratio}`)
  })

  test('相邻业务键不会整批落在同一侧（防止哈希退化）', () => {
    const buckets = new Set<number>()
    for (let i = 1; i <= 30; i += 1) buckets.add(bucketOf(`SPU-${i}`))
    // 30 个相邻键应至少覆盖 10 个不同桶
    assert.ok(buckets.size >= 10, `桶分布过于集中：${buckets.size}`)
  })

  test('bucketOf 稳定且落在 [0,100)', () => {
    for (const seed of ['SPU-A1', '商品A', '', 'a'.repeat(200)]) {
      const first = bucketOf(seed)
      assert.equal(bucketOf(seed), first)
      assert.ok(first >= 0 && first < 100)
    }
  })
})

describe('W10 生成链路：合规闸门', () => {
  test('生成内容命中违禁词时 blocked 为 true（不依赖数据库的内置词库）', async () => {
    // scanBannedWords 会查库；库不可用时降级为内置词库，仍能拦截
    const result = await scanBannedWords({ tenantId: 1, text: '本商品全网第一，100%根治。' })
    assert.equal(result.blocked, true)
    const words = result.matched.map((m) => m.word)
    assert.ok(words.includes('全网第一'))
    assert.ok(words.includes('100%'))
  })

  test('合规文案不被阻断', async () => {
    const result = await scanBannedWords({
      tenantId: 1,
      text: '春季风衣采用防风面料，适合通勤与旅行，尺码齐全。',
    })
    assert.equal(result.blocked, false)
  })

  test('违规生成被闸门拦下且不进入审核队列（stub 模型直返违规文案）', async () => {
    const { generateDraft } = await import('../src/generation/service.js')
    const stub = async () => ({
      ok: true,
      usedFallback: false,
      attempts: [{ profileKey: 'stub', model: 'stub', ok: true }],
      result: {
        reply: '本产品全网第一，100%根治，绝对顶级，无副作用。',
        model: 'stub',
        inputTokens: 10,
        outputTokens: 20,
        costCny: 0.0001,
        durationMs: 5,
      },
    })
    const result = await generateDraft({
      tenantId: 1,
      templateKey: 'live_script',
      variables: { product: '合规测试商品' },
      userId: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generateFn: stub as any,
    })
    assert.equal(result.status, 'blocked')
    assert.equal(result.compliance.blocked, true)
    assert.ok(result.compliance.hits.some((hit) => hit.word === '全网第一'))
    assert.ok(result.compliance.hits.some((hit) => hit.word === '100%'))
    assert.ok(result.compliance.hits.every((hit) => hit.action === 'block'))
  })

  test('合规生成进入待审核并带模型与耗时', async () => {
    const { generateDraft } = await import('../src/generation/service.js')
    const stub = async () => ({
      ok: true,
      usedFallback: false,
      attempts: [{ profileKey: 'stub', model: 'stub', ok: true }],
      result: {
        reply: '【开场】这件风衣防风保暖。\n【卖点】轻盈透气，适合通勤。\n【收尾】尺码齐全，欢迎咨询。',
        model: 'stub-model',
        inputTokens: 100,
        outputTokens: 50,
        costCny: 0.0002,
        durationMs: 12,
      },
    })
    const result = await generateDraft({
      tenantId: 1,
      templateKey: 'live_script',
      variables: { product: '春季风衣 A1', audience: '通勤女性' },
      businessKey: 'SPU-A1',
      userId: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generateFn: stub as any,
    })
    assert.equal(result.status, 'pending_review')
    assert.equal(result.compliance.blocked, false)
    assert.equal(result.model, 'stub-model')
    assert.equal(result.tokensUsed, 150)
    assert.ok(result.content.includes('防风保暖'))
  })

  test('模型返回空内容时报错，不落空草稿', async () => {
    const { generateDraft } = await import('../src/generation/service.js')
    const stub = async () => ({
      ok: false,
      result: null,
      usedFallback: false,
      attempts: [],
      reason: 'all_profiles_failed' as const,
    })
    await assert.rejects(
      generateDraft({
        tenantId: 1,
        templateKey: 'live_script',
        variables: { product: '空内容测试' },
        userId: 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generateFn: stub as any,
      }),
      /模型不可用|模型返回为空/
    )
  })
})