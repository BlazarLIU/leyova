/**
 * test/knowledge-platform.test.ts — W9 知识平台单测
 *
 * 覆盖：分块边界、转写切块、违禁词自动机（含绕过归一化）、引用回溯服务契约。
 * 不依赖数据库的部分全部离线执行，需库的部分由 curl 实测覆盖。
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanText, contentFingerprint, estimateTokens, splitText, splitTranscript } from '../src/knowledge/chunking.js'
import {
  BannedWordAutomaton,
  DEFAULT_BANNED_RULES,
  buildAutomaton,
  normalizeForScan,
} from '../src/knowledge/banned-words.js'
import { toVectorLiteral, testEmbeddingConnection } from '../src/knowledge/embedding.js'
import { isRuleOnlyCollection } from '../src/knowledge/service.js'
import { assertEndpointAllowed } from '../src/integrations/connectors.js'

describe('W9 知识平台：文本分块', () => {
  test('清洗去除控制字符并压缩空白', () => {
    const cleaned = cleanText('  第一行\u0000\u0001  \n\n\n\n第二行   ')
    assert.equal(cleaned, '第一行\n\n第二行')
  })

  test('空文本返回空分块', () => {
    assert.deepEqual(splitText('   '), [])
  })

  test('短文本只产出 1 块且保留原文语义', () => {
    const chunks = splitText('商品名称：春季风衣。卖点：防风保暖。')
    assert.equal(chunks.length, 1)
    assert.equal(chunks[0].seq, 0)
    assert.ok(chunks[0].content.includes('春季风衣'))
    assert.ok(chunks[0].tokenCount > 0)
  })

  test('超长文本按 chunkSize 切分且每块不超限', () => {
    const sentence = '这是一个用于测试分块边界的句子，长度适中。'
    const text = sentence.repeat(120)
    const chunks = splitText(text, { chunkSize: 300, chunkOverlap: 30 })
    assert.ok(chunks.length > 1)
    for (const chunk of chunks) {
      assert.ok(chunk.content.length <= 300 + 60, `块长度超限：${chunk.content.length}`)
    }
    assert.deepEqual(chunks.map((c) => c.seq), chunks.map((_, i) => i))
  })

  test('分页符产生页码', () => {
    const chunks = splitText('第一页内容。\f第二页内容。', { chunkSize: 400 })
    assert.equal(chunks.length, 2)
    assert.equal(chunks[0].pageNo, 1)
    assert.equal(chunks[1].pageNo, 2)
  })

  test('转写按时间戳切块并保留起止时间', () => {
    const chunks = splitTranscript(
      [
        { text: '欢迎来到直播间。', startMs: 0, endMs: 3000, speaker: '主播' },
        { text: '今天推荐这款风衣。', startMs: 3000, endMs: 8000, speaker: '主播' },
        { text: '库存还有多少？', startMs: 8000, endMs: 10000, speaker: '助理' },
      ],
      { chunkSize: 800 }
    )
    assert.equal(chunks.length, 2)
    assert.equal(chunks[0].startMs, 0)
    assert.equal(chunks[0].endMs, 8000)
    assert.ok(chunks[0].content.includes('【主播】'))
    assert.equal(chunks[1].startMs, 8000)
    assert.ok(chunks[1].content.includes('【助理】'))
  })

  test('内容指纹对空白不敏感、对不同内容敏感', () => {
    assert.equal(contentFingerprint('商品 A  卖点'), contentFingerprint('商品 A 卖点'))
    assert.notEqual(contentFingerprint('商品 A'), contentFingerprint('商品 B'))
  })

  test('token 估算对中文按字计', () => {
    assert.equal(estimateTokens('你好世界'), 4)
  })
})

describe('W9 知识平台：违禁词自动机', () => {
  test('归一化处理全角、空格与分隔符绕过', () => {
    assert.equal(normalizeForScan('全　网 第 一'), '全网第一')
    assert.equal(normalizeForScan('ＴＯＰ顶*级'), 'top顶级')
    assert.equal(normalizeForScan('1 0 0 %'), '100')
  })

  test('内置词库可命中并阻断', () => {
    const automaton = buildAutomaton(DEFAULT_BANNED_RULES)
    const result = automaton.scan('本店商品为全网第一，绝对顶级，100%有效。')
    assert.equal(result.blocked, true)
    const words = result.matched.map((m) => m.word)
    assert.ok(words.includes('全网第一'))
    assert.ok(words.includes('顶级'))
    assert.ok(words.includes('100%'))
  })

  test('间隔符绕过仍能命中', () => {
    const automaton = buildAutomaton(DEFAULT_BANNED_RULES)
    const result = automaton.scan('这个产品全 网 第 一！！')
    assert.equal(result.blocked, true)
    assert.equal(result.matched[0].word, '全网第一')
  })

  test('正常文案不误伤', () => {
    const automaton = buildAutomaton(DEFAULT_BANNED_RULES)
    const result = automaton.scan('春季新款风衣，防风保暖，适合通勤穿搭。')
    assert.equal(result.blocked, false)
    assert.equal(result.matched.length, 0)
  })

  test('平台过滤只保留通用与目标平台规则', () => {
    const automaton = new BannedWordAutomaton([
      { id: '1', word: '抖音专属禁词', normalized: '抖音专属禁词', category: 'platform', severity: 'high', action: 'block', platform: 'douyin', wordVersion: 1 },
      { id: '2', word: '通用禁词', normalized: '通用禁词', category: 'other', severity: 'high', action: 'block', platform: 'all', wordVersion: 1 },
    ])
    const douyin = automaton.scan('抖音专属禁词 与 通用禁词', { platform: 'douyin' })
    assert.equal(douyin.matched.length, 2)
    const taobao = automaton.scan('抖音专属禁词 与 通用禁词', { platform: 'taobao' })
    assert.equal(taobao.matched.length, 1)
    assert.equal(taobao.matched[0].word, '通用禁词')
  })

  test('同一词多处出现都记录，且改写替换为占位符', () => {
    const automaton = buildAutomaton(DEFAULT_BANNED_RULES)
    const result = automaton.scan('顶级品质，顶级服务。')
    assert.equal(result.matched.filter((m) => m.word === '顶级').length, 2)
    const rewritten = automaton.rewrite('顶级品质，顶级服务。')
    assert.ok(!rewritten.text.includes('顶级'))
    assert.ok(rewritten.text.includes('**'))
  })

  test('warn 动作不阻断但仍记录', () => {
    const automaton = new BannedWordAutomaton([
      { id: '1', word: '最便宜', normalized: '最便宜', category: 'absolute', severity: 'medium', action: 'warn', platform: 'all', wordVersion: 1 },
    ])
    const result = automaton.scan('全场最便宜')
    assert.equal(result.blocked, false)
    assert.equal(result.matched.length, 1)
    assert.equal(result.matched[0].action, 'warn')
  })

  test('空规则集不崩且不命中', () => {
    const automaton = buildAutomaton([])
    assert.equal(automaton.size, 0)
    const result = automaton.scan('任何内容')
    assert.equal(result.matched.length, 0)
  })
})

describe('W9 知识平台：向量字面量与出站校验', () => {
  test('向量字面量格式符合 pgvector 要求', () => {
    assert.equal(toVectorLiteral([0.1, 0.25, -0.5]), '[0.1,0.25,-0.5]')
    assert.equal(toVectorLiteral([1 / 3]), '[0.333333]')
  })

  test('非有限值被替换为 0，避免 SQL 注入或非法字面量', () => {
    assert.equal(toVectorLiteral([Number.NaN, Number.POSITIVE_INFINITY, 0.5]), '[0,0,0.5]')
  })

  test('公网地址放行', () => {
    assert.equal(assertEndpointAllowed('https://api.openai.com/v1'), null)
    assert.equal(assertEndpointAllowed('https://api.siliconflow.cn/v1'), null)
    assert.equal(assertEndpointAllowed('https://dashscope.aliyuncs.com/compatible-mode/v1'), null)
  })

  test('云元数据与链路本地地址永久拒绝', () => {
    assert.match(String(assertEndpointAllowed('http://169.254.169.254/latest')), /元数据|链路本地/)
    assert.match(String(assertEndpointAllowed('http://[fe80::1]/v1')), /元数据|链路本地/)
  })

  test('内网地址默认拒绝，显式开关后放行', () => {
    const original = process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS
    try {
      delete process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS
      assert.match(String(assertEndpointAllowed('http://127.0.0.1:8799/v1')), /内网/)
      assert.match(String(assertEndpointAllowed('http://192.168.1.10/v1')), /内网/)

      process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS = 'true'
      assert.equal(assertEndpointAllowed('http://127.0.0.1:8799/v1'), null)
      // 元数据地址即使开启开关也必须拒绝
      assert.match(String(assertEndpointAllowed('http://169.254.169.254/latest')), /元数据|链路本地/)
    } finally {
      if (original === undefined) delete process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS
      else process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS = original
    }
  })

  test('非法 URL 被拒绝', () => {
    assert.equal(assertEndpointAllowed('not-a-url'), 'Base URL 不合法')
  })

  test('规则集合识别：违禁词库与 banned 域不启用向量模型', () => {
    assert.equal(isRuleOnlyCollection('banned_words', 'banned'), true)
    assert.equal(isRuleOnlyCollection('banned_words'), true)
    assert.equal(isRuleOnlyCollection('custom_compliance', 'banned'), true)
    assert.equal(isRuleOnlyCollection('products', 'product'), false)
    assert.equal(isRuleOnlyCollection('scripts', 'script'), false)
    assert.equal(isRuleOnlyCollection('replays', 'replay'), false)
  })

  test('向量模型测试器拦截空参数与内网 SSRF 地址', async () => {
    const missingProvider = await testEmbeddingConnection({
      tenantId: 1,
      provider: '',
      model: 'text-embedding-3-small',
    })
    assert.equal(missingProvider.ok, false)
    assert.match(String(missingProvider.error), /供应商/)

    const missingModel = await testEmbeddingConnection({
      tenantId: 1,
      provider: 'openai_compatible',
      apiBase: 'https://api.openai.com/v1',
      model: '',
    })
    assert.equal(missingModel.ok, false)
    assert.match(String(missingModel.error), /模型/)

    const original = process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS
    try {
      delete process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS
      const blocked = await testEmbeddingConnection({
        tenantId: 1,
        provider: 'openai_compatible',
        apiBase: 'http://127.0.0.1:8080/v1',
        model: 'text-embedding-3-small',
        apiKey: 'sk-test',
      })
      assert.equal(blocked.ok, false)
      assert.match(String(blocked.error), /内网/)
    } finally {
      if (original === undefined) delete process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS
      else process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS = original
    }
  })
})