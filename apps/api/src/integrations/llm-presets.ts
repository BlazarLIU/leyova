/**
 * integrations/llm-presets.ts — 豆包（火山方舟）与通义千问（百炼）预设
 *
 * 两家均提供 OpenAI 兼容端点，可直接复用 ai/llm 的 OpenAI 兼容驱动。
 * 连通性测试只使用显式传入或已加密保存的 API Key，绝不读取环境变量。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { requireTenantId } from '../lib/tenant-context.js'
import { recordIntegrationCall } from './call-log.js'

export interface LlmProviderPreset {
  key: 'doubao' | 'dashscope'
  name: string
  protocol: 'openai'
  apiBase: string
  defaultModel: string
  models: string[]
  credentialFields: string[]
  docsUrl: string
}

export const LLM_PROVIDER_PRESETS: LlmProviderPreset[] = [
  {
    key: 'doubao',
    name: '豆包（火山方舟）',
    protocol: 'openai',
    apiBase: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-1-5-pro-32k-250115',
    models: ['doubao-1-5-pro-32k-250115', 'doubao-1-5-lite-32k-250115', 'doubao-seed-1-6-250615'],
    credentialFields: ['apiKey'],
    docsUrl: 'https://www.volcengine.com/docs/82379',
  },
  {
    key: 'dashscope',
    name: '通义千问（百炼）',
    protocol: 'openai',
    apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    credentialFields: ['apiKey'],
    docsUrl: 'https://help.aliyun.com/zh/model-studio/',
  },
]

export function getLlmPreset(key: string): LlmProviderPreset | null {
  return LLM_PROVIDER_PRESETS.find((preset) => preset.key === key) || null
}

export interface LlmProbeResult {
  ok: boolean
  configured: boolean
  preset: string
  model: string
  baseUrlHost: string
  latencyMs: number
  httpStatus?: number
  errorCode?: string
  message: string
}

/**
 * 使用 Chat Completions（max_tokens=1）做轻量连通性测试，并写入调用审计。
 * 未配置密钥时直接返回 configured=false，不发起请求、不报错。
 */
export async function testLlmPresetConnection(input: {
  preset: string
  apiKey?: string | null
  model?: string | null
  tenantId?: number
  actorUserId?: number | null
  timeoutMs?: number
  db?: DbExecutor
}): Promise<LlmProbeResult> {
  const preset = getLlmPreset(input.preset)
  if (!preset) throw new Error(`未知模型预设：${input.preset}`)

  const model = String(input.model || preset.defaultModel)
  const baseUrlHost = new URL(preset.apiBase).host
  const apiKey = String(input.apiKey || '').trim()

  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      preset: preset.key,
      model,
      baseUrlHost,
      latencyMs: 0,
      message: '未配置 API Key，请先保存凭证',
    }
  }

  const started = Date.now()
  const controller = new AbortController()
  const timeoutMs = Math.max(1000, input.timeoutMs || 10000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let ok = false
  let httpStatus: number | undefined
  let errorCode: string | undefined
  let message = ''

  try {
    const res = await fetch(`${preset.apiBase.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: controller.signal,
    })
    httpStatus = res.status
    const text = await res.text().catch(() => '')
    ok = res.ok
    if (ok) {
      message = '连通性正常'
    } else {
      errorCode = `HTTP_${res.status}`
      message = text.slice(0, 300) || `HTTP ${res.status}`
    }
  } catch (err) {
    const name = (err as Error)?.name
    errorCode = name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
    message = name === 'AbortError' ? `连接超时（${timeoutMs}ms）` : (err as Error)?.message || String(err)
  } finally {
    clearTimeout(timer)
  }

  const latencyMs = Date.now() - started
  const result: LlmProbeResult = {
    ok,
    configured: true,
    preset: preset.key,
    model,
    baseUrlHost,
    latencyMs,
    httpStatus,
    errorCode,
    message,
  }

  try {
    await recordIntegrationCall({
      db: input.db || getPool(),
      tenantId: requireTenantId(input.tenantId, 'integrations.llm-presets'),
      platform: preset.key,
      operation: 'llm.test_connection',
      method: 'POST',
      requestSummary: { model, baseUrlHost },
      responseSummary: { ok, message },
      status: ok ? 'success' : 'error',
      httpStatus,
      errorCode,
      latencyMs,
      actorUserId: input.actorUserId,
    })
  } catch {
    // 审计落库失败不应吞掉连通性结果；由调用方日志记录
  }

  return result
}
