/**
 * test/integrations.test.ts — W8 集成中心契约测试
 *
 * 覆盖：连接器注册、健康检查降级、凭证加密与掩码、调用摘要脱敏、限流与重试。
 */

import { describe, test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONNECTORS,
  checkConnectorHealth,
  getConnector,
  connectorCatalog,
} from '../src/integrations/connectors.js'
import type { IntegrationConnector } from '../src/integrations/types.js'
import {
  buildSecretHint,
  decryptSecretBundle,
  encryptSecretBundle,
} from '../src/integrations/credentials.js'
import {
  consumeRateLimit,
  executeWithRetry,
  resetRateLimits,
  sanitizeIntegrationSummary,
} from '../src/integrations/call-log.js'
import { LLM_PROVIDER_PRESETS, getLlmPreset } from '../src/integrations/llm-presets.js'

function makeConnector(overrides: Partial<IntegrationConnector> = {}): IntegrationConnector {
  return {
    key: 'test_connector',
    name: '测试连接器',
    category: 'platform',
    authType: 'api_key',
    credentialFields: ['apiKey'],
    defaultConfig: {},
    capabilities: () => [
      { key: 'read.one', name: '读取', description: '只读', risk: 'R0', write: false },
      { key: 'write.one', name: '写入', description: '写入', risk: 'R2', write: true },
    ],
    ...overrides,
  }
}

describe('W8 集成中心：连接器契约与健康检查', () => {
  test('至少注册 3 个连接器，且能力键唯一、写能力风险 >= R1', () => {
    assert.ok(CONNECTORS.length >= 3)
    const keys = new Set<string>()
    for (const connector of CONNECTORS) {
      assert.ok(!keys.has(connector.key), `连接器 key 重复：${connector.key}`)
      keys.add(connector.key)
      const capabilities = connector.capabilities()
      assert.ok(capabilities.length > 0, `${connector.key} 缺少能力清单`)
      const capKeys = new Set(capabilities.map((item) => item.key))
      assert.equal(capKeys.size, capabilities.length, `${connector.key} 能力 key 重复`)
      for (const capability of capabilities) {
        if (capability.write) {
          assert.ok(['R1', 'R2', 'R3'].includes(capability.risk), `写能力 ${capability.key} 风险等级不足`)
        }
      }
    }
    assert.ok(getConnector('douyin_open'))
    assert.ok(getConnector('qianchuan'))
    assert.ok(getConnector('doubao'))
    assert.ok(getConnector('dashscope'))
    assert.ok(getConnector('siliconflow'))
    assert.equal(getConnector('not_exists'), null)
  })

  test('目录不暴露任何凭证值', () => {
    const catalog = connectorCatalog()
    const text = JSON.stringify(catalog)
    assert.ok(text.includes('credentialFields'))
    assert.ok(!text.includes('apiKeyValue'))
    assert.ok(!text.includes('secretValue'))
  })

  test('缺少凭证时返回 unconfigured，不抛错、不发起请求', async () => {
    const connector = getConnector('doubao')!
    const health = await checkConnectorHealth(connector, {
      tenantId: 1,
      config: {},
      secrets: null,
      probe: true,
    })
    assert.equal(health.status, 'unconfigured')
    assert.deepEqual(health.missingFields, ['apiKey'])
    assert.equal(health.latencyMs, 0)
    assert.match(health.detail, /缺少凭证/)
  })

  test('配置完整但 probe=false 时返回 unknown', async () => {
    const health = await checkConnectorHealth(makeConnector(), {
      tenantId: 1,
      config: {},
      secrets: { apiKey: 'sk-test' },
      probe: false,
    })
    assert.equal(health.status, 'unknown')
    assert.equal(health.missingFields.length, 0)
  })

  test('探测成功为 healthy，HTTP 失败为 degraded，超时为 down', async () => {
    const okConnector = makeConnector({ probe: async () => ({ ok: true, status: 200 }) })
    const ok = await checkConnectorHealth(okConnector, {
      tenantId: 1,
      config: {},
      secrets: { apiKey: 'sk-test' },
      probe: true,
    })
    assert.equal(ok.status, 'healthy')
    assert.equal(ok.httpStatus, 200)

    const httpConnector = makeConnector({
      probe: async () => ({ ok: false, status: 401, errorCode: 'HTTP_401', message: 'unauthorized' }),
    })
    const degraded = await checkConnectorHealth(httpConnector, {
      tenantId: 1,
      config: {},
      secrets: { apiKey: 'sk-test' },
      probe: true,
    })
    assert.equal(degraded.status, 'degraded')
    assert.equal(degraded.errorCode, 'HTTP_401')

    const timeoutConnector = makeConnector({
      probe: async () => ({ ok: false, errorCode: 'TIMEOUT', message: 'timeout' }),
    })
    const down = await checkConnectorHealth(timeoutConnector, {
      tenantId: 1,
      config: {},
      secrets: { apiKey: 'sk-test' },
      probe: true,
    })
    assert.equal(down.status, 'down')
  })

  test('探测器抛异常时降级为 down，不向上抛', async () => {
    const connector = makeConnector({
      probe: async () => {
        throw new Error('boom')
      },
    })
    const health = await checkConnectorHealth(connector, {
      tenantId: 1,
      config: {},
      secrets: { apiKey: 'sk-test' },
      probe: true,
    })
    assert.equal(health.status, 'down')
    assert.equal(health.errorCode, 'PROBE_EXCEPTION')
  })
})

describe('W8 集成中心：凭证加密与调用脱敏', () => {
  test('凭证整包加密后可解密，密文不包含明文', () => {
    const secrets = { appKey: 'ak_1234567890', appSecret: 'super-secret-value' }
    const encrypted = encryptSecretBundle(secrets)
    assert.ok(encrypted.includes(':'))
    assert.ok(!encrypted.includes('super-secret-value'))
    assert.deepEqual(decryptSecretBundle(encrypted), secrets)
  })

  test('损坏密文解密返回空对象而不是抛错', () => {
    assert.deepEqual(decryptSecretBundle('bad-payload'), {})
    assert.deepEqual(decryptSecretBundle(''), {})
  })

  test('凭证提示只返回掩码', () => {
    const hint = buildSecretHint({ apiKey: 'sk-1234567890abcdef' }, ['apiKey'])
    assert.equal(hint, 'sk-1****cdef')
    assert.ok(!hint.includes('234567890'))
  })

  test('调用摘要按敏感键名与 Bearer token 脱敏', () => {
    const summary = sanitizeIntegrationSummary({
      accessToken: 'token-abc',
      nested: { apiKey: 'key-abc', password: 'pwd-abc' },
      message: 'Bearer abc.def.ghi',
      url: 'https://example.com/cb?access_token=secret123&id=1',
    })
    assert.ok(!summary.includes('token-abc'))
    assert.ok(!summary.includes('key-abc'))
    assert.ok(!summary.includes('pwd-abc'))
    assert.ok(!summary.includes('abc.def.ghi'))
    assert.ok(!summary.includes('secret123'))
    assert.ok(summary.includes('***'))
  })

  test('超长摘要被截断', () => {
    const summary = sanitizeIntegrationSummary('x'.repeat(900), 100)
    assert.equal(summary.length, 101)
    assert.ok(summary.endsWith('…'))
  })
})

describe('W8 集成中心：限流与重试', () => {
  beforeEach(() => resetRateLimits())

  test('令牌桶按分钟限流并给出重试时间', () => {
    const first = consumeRateLimit('conn-1', 2, 1000)
    const second = consumeRateLimit('conn-1', 2, 1000)
    const third = consumeRateLimit('conn-1', 2, 1000)
    assert.equal(first.allowed, true)
    assert.equal(second.allowed, true)
    assert.equal(third.allowed, false)
    assert.ok(third.retryAfterMs > 0)
  })

  test('时间推进后令牌恢复', () => {
    consumeRateLimit('conn-2', 1, 1000)
    const blocked = consumeRateLimit('conn-2', 1, 1000)
    assert.equal(blocked.allowed, false)
    const recovered = consumeRateLimit('conn-2', 1, 61_000)
    assert.equal(recovered.allowed, true)
  })

  test('executeWithRetry 在可恢复失败后成功并报告次数', async () => {
    let calls = 0
    const { value, attempts } = await executeWithRetry(
      async () => {
        calls += 1
        if (calls < 3) throw new Error('temporary')
        return 'ok'
      },
      { retries: 2, baseDelayMs: 0 }
    )
    assert.equal(value, 'ok')
    assert.equal(attempts, 3)
  })

  test('executeWithRetry 用尽重试后抛出最后一次错误', async () => {
    await assert.rejects(
      executeWithRetry(async () => {
        throw new Error('always-fail')
      }, { retries: 1, baseDelayMs: 0 }),
      /always-fail/
    )
  })
})

describe('W8 模型 Provider 预设', () => {
  test('豆包与通义预设齐备且地址为 HTTPS', () => {
    assert.equal(LLM_PROVIDER_PRESETS.length, 2)
    for (const preset of LLM_PROVIDER_PRESETS) {
      assert.equal(preset.protocol, 'openai')
      assert.match(preset.apiBase, /^https:\/\//)
      assert.ok(preset.defaultModel)
      assert.ok(preset.models.includes(preset.defaultModel))
      assert.deepEqual(preset.credentialFields, ['apiKey'])
    }
    assert.ok(getLlmPreset('doubao'))
    assert.ok(getLlmPreset('dashscope'))
    assert.equal(getLlmPreset('unknown'), null)
  })
})
