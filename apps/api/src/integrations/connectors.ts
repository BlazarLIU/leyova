/**
 * integrations/connectors.ts — 首批连接器实现与注册表
 *
 * 覆盖 Plan D.10 退出标准：抖音开放平台、巨量千川、豆包/通义（LLM）。
 * 健康检查在缺少凭证时返回 unconfigured；只有显式 probe 才发起外网请求。
 */

import type {
  ConnectorProbeResult,
  HealthCheckContext,
  HealthCheckResult,
  IntegrationConnector,
} from './types.js'
import { isLocalOrPrivateHost } from '../ai/llm/provider.js'

const DEFAULT_TIMEOUT_MS = 6000

/**
 * 自定义 Base URL 的出站校验：
 *   - 云元数据 / 链路本地地址永久拒绝（169.254.x、fe80::）；
 *   - 内网地址默认拒绝；私有化部署的内网网关可通过
 *     INTEGRATION_ALLOW_PRIVATE_HOSTS=true 显式放开（例如自建 vLLM 网关）。
 */
export function assertEndpointAllowed(baseUrl: string): string | null {
  let host = ''
  try {
    host = new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return 'Base URL 不合法'
  }
  if (!host) return 'Base URL 不合法'
  if (/^169\.254\./.test(host) || /^\[?fe80/i.test(host)) return '拒绝访问云元数据/链路本地地址'
  if (isLocalOrPrivateHost(baseUrl)) {
    const allowPrivate = String(process.env.INTEGRATION_ALLOW_PRIVATE_HOSTS || '').toLowerCase() === 'true'
    if (!allowPrivate) return '默认禁止内网地址；私有化部署可设置 INTEGRATION_ALLOW_PRIVATE_HOSTS=true'
  }
  return null
}

/**
 * 固定地址的探活请求：超时、HTTP 错误与网络异常都转成结构化结果，不向上抛。
 */
async function probeRequest(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ConnectorProbeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        errorCode: `HTTP_${res.status}`,
        message: text.slice(0, 300) || `HTTP ${res.status}`,
      }
    }
    return { ok: true, status: res.status, message: text.slice(0, 200) }
  } catch (err) {
    const name = (err as Error)?.name
    return {
      ok: false,
      errorCode: name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: name === 'AbortError' ? `请求超时（${timeoutMs}ms）` : (err as Error)?.message || String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}

/** 抖音开放平台：client_credential 换 token 作为轻量探活 */
const douyinOpenConnector: IntegrationConnector = {
  key: 'douyin_open',
  name: '抖音开放平台',
  category: 'platform',
  authType: 'app_secret',
  credentialFields: ['appKey', 'appSecret'],
  defaultConfig: { baseUrl: 'https://open.douyin.com' },
  docsUrl: 'https://developer.open-douyin.com/',
  capabilities: () => [
    { key: 'account.profile', name: '账号资料', description: '读取授权账号基础信息', risk: 'R0', write: false },
    { key: 'video.list', name: '视频数据', description: '读取视频列表与播放互动数据', risk: 'R0', write: false },
    { key: 'order.list', name: '订单查询', description: '读取店铺订单与售后单', risk: 'R0', write: false },
    { key: 'content.publish', name: '内容发布', description: '代发布视频或图文（需人工确认）', risk: 'R2', write: true },
    { key: 'message.reply', name: '私信回复', description: '回复用户私信（需人工确认）', risk: 'R1', write: true },
  ],
  async probe(ctx) {
    const secrets = ctx.secrets || {}
    return probeRequest(
      'https://open.douyin.com/oauth/client_token/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_key: secrets.appKey,
          client_secret: secrets.appSecret,
          grant_type: 'client_credential',
        }),
      },
      ctx.timeoutMs
    )
  },
}

/** 巨量千川：广告主信息接口探活 */
const qianchuanConnector: IntegrationConnector = {
  key: 'qianchuan',
  name: '巨量千川',
  category: 'advertising',
  authType: 'oauth2',
  credentialFields: ['accessToken'],
  defaultConfig: { baseUrl: 'https://api.oceanengine.com' },
  docsUrl: 'https://open.oceanengine.com/',
  capabilities: () => [
    { key: 'ad.campaign.list', name: '计划列表', description: '读取投放计划与状态', risk: 'R0', write: false },
    { key: 'ad.report.get', name: '投放报表', description: '读取消耗、ROI 与转化报表', risk: 'R0', write: false },
    { key: 'ad.budget.update', name: '预算调整', description: '修改计划预算（先 diff 再确认）', risk: 'R2', write: true },
    { key: 'ad.creative.create', name: '创意创建', description: '创建投放创意（先 diff 再确认）', risk: 'R2', write: true },
  ],
  async probe(ctx) {
    const secrets = ctx.secrets || {}
    return probeRequest(
      'https://api.oceanengine.com/open_api/2/user/info/',
      {
        method: 'GET',
        headers: { 'Access-Token': secrets.accessToken },
      },
      ctx.timeoutMs
    )
  },
}

function buildLlmProbe(baseUrl: string, defaultModel: string) {
  return async (ctx: HealthCheckContext): Promise<ConnectorProbeResult> => {
    const secrets = ctx.secrets || {}
    const model = String(ctx.config.model || defaultModel)
    return probeRequest(
      `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secrets.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          temperature: 0,
        }),
      },
      ctx.timeoutMs
    )
  }
}

/** 豆包（火山方舟）：OpenAI 兼容 Chat Completions 探活 */
const doubaoConnector: IntegrationConnector = {
  key: 'doubao',
  name: '豆包（火山方舟）',
  category: 'llm',
  authType: 'api_key',
  credentialFields: ['apiKey'],
  configFields: ['baseUrl', 'model', 'embeddingModel'],
  defaultConfig: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-1-5-pro-32k-250115',
    embeddingModel: 'doubao-embedding-text-240715',
  },
  docsUrl: 'https://www.volcengine.com/docs/82379',
  capabilities: () => [
    { key: 'llm.chat', name: '对话生成', description: 'OpenAI 兼容 Chat Completions', risk: 'R0', write: false },
    { key: 'llm.embedding', name: '文本向量', description: '语义检索向量化', risk: 'R0', write: false },
    { key: 'llm.function_call', name: '工具调用', description: 'Function Calling 结构化输出', risk: 'R1', write: false },
  ],
  probe: buildLlmProbe('https://ark.cn-beijing.volces.com/api/v3', 'doubao-1-5-pro-32k-250115'),
}

/** 通义千问（百炼）：OpenAI 兼容模式探活 */
const dashscopeConnector: IntegrationConnector = {
  key: 'dashscope',
  name: '通义千问（百炼）',
  category: 'llm',
  authType: 'api_key',
  credentialFields: ['apiKey'],
  configFields: ['baseUrl', 'model', 'embeddingModel'],
  defaultConfig: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    embeddingModel: 'text-embedding-v3',
  },
  docsUrl: 'https://help.aliyun.com/zh/model-studio/',
  capabilities: () => [
    { key: 'llm.chat', name: '对话生成', description: 'OpenAI 兼容 Chat Completions', risk: 'R0', write: false },
    { key: 'llm.embedding', name: '文本向量', description: '语义检索向量化', risk: 'R0', write: false },
    { key: 'llm.function_call', name: '工具调用', description: 'Function Calling 结构化输出', risk: 'R1', write: false },
  ],
  probe: buildLlmProbe('https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-plus'),
}

/**
 * 通用 OpenAI 兼容连接器：任意提供 /chat/completions 与 /embeddings 的厂商。
 * baseUrl 与 model 由用户填写（非敏感，落 integration_connections.config），
 * 密钥仍走加密凭证表，永不回显。
 */
const openaiCompatibleConnector: IntegrationConnector = {
  key: 'openai_compatible',
  name: 'OpenAI 兼容（自定义）',
  category: 'llm',
  authType: 'api_key',
  credentialFields: ['apiKey'],
  requiredConfigFields: ['baseUrl'],
  configFields: ['baseUrl', 'model', 'embeddingModel'],
  defaultConfig: {
    baseUrl: '',
    model: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
  },
  docsUrl: 'https://platform.openai.com/docs/api-reference',
  capabilities: () => [
    { key: 'llm.chat', name: '对话生成', description: 'OpenAI 兼容 Chat Completions', risk: 'R0', write: false },
    { key: 'llm.embedding', name: '文本向量', description: 'OpenAI 兼容 Embeddings，用于知识平台检索', risk: 'R0', write: false },
    { key: 'llm.function_call', name: '工具调用', description: 'Function Calling 结构化输出', risk: 'R1', write: false },
  ],
  async probe(ctx) {
    const secrets = ctx.secrets || {}
    const baseUrl = String(ctx.config.baseUrl || '').replace(/\/+$/, '')
    const model = String(ctx.config.model || 'gpt-4o-mini')
    if (!baseUrl) {
      return { ok: false, errorCode: 'MISSING_BASE_URL', message: '未配置 Base URL' }
    }
    const rejected = assertEndpointAllowed(baseUrl)
    if (rejected) return { ok: false, errorCode: 'ENDPOINT_BLOCKED', message: rejected }
    return probeRequest(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secrets.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          temperature: 0,
        }),
      },
      ctx.timeoutMs
    )
  },
}

/** 硅基流动（SiliconFlow CN）：OpenAI 兼容 Chat Completions & Embeddings */
const siliconflowConnector: IntegrationConnector = {
  key: 'siliconflow',
  name: '硅基流动（SiliconFlow CN）',
  category: 'llm',
  authType: 'api_key',
  credentialFields: ['apiKey'],
  configFields: ['baseUrl', 'model', 'embeddingModel'],
  defaultConfig: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    embeddingModel: 'BAAI/bge-m3',
  },
  docsUrl: 'https://docs.siliconflow.cn',
  capabilities: () => [
    { key: 'llm.chat', name: '对话生成', description: 'OpenAI 兼容 Chat Completions', risk: 'R0', write: false },
    { key: 'llm.embedding', name: '文本向量', description: 'OpenAI 兼容 Embeddings（支持 BAAI/bge-m3 等）', risk: 'R0', write: false },
    { key: 'llm.function_call', name: '工具调用', description: 'Function Calling 结构化输出', risk: 'R1', write: false },
  ],
  probe: buildLlmProbe('https://api.siliconflow.cn/v1', 'deepseek-ai/DeepSeek-V3'),
}

export const CONNECTORS: IntegrationConnector[] = [
  douyinOpenConnector,
  qianchuanConnector,
  doubaoConnector,
  dashscopeConnector,
  siliconflowConnector,
  openaiCompatibleConnector,
]

const CONNECTOR_MAP = new Map(CONNECTORS.map((c) => [c.key, c]))

export function getConnector(platform: string): IntegrationConnector | null {
  return CONNECTOR_MAP.get(String(platform || '')) || null
}

export function listConnectors(): IntegrationConnector[] {
  return CONNECTORS.slice()
}

/** 对外目录：只暴露非敏感元数据与能力清单 */
export function connectorCatalog() {
  return CONNECTORS.map((connector) => ({
    platform: connector.key,
    name: connector.name,
    category: connector.category,
    authType: connector.authType,
    credentialFields: connector.credentialFields,
    requiredConfigFields: connector.requiredConfigFields || [],
    configFields: connector.configFields || [],
    defaultConfig: connector.defaultConfig,
    docsUrl: connector.docsUrl,
    capabilities: connector.capabilities(),
  }))
}

/**
 * 统一健康检查：
 * 1. 凭证缺失 → unconfigured（不抛错、不发起请求）
 * 2. probe=false → unknown（配置完整但未探测）
 * 3. probe=true → healthy / degraded / down
 */
export async function checkConnectorHealth(
  connector: IntegrationConnector,
  ctx: HealthCheckContext
): Promise<HealthCheckResult> {
  const secrets = ctx.secrets || {}
  const missingFields = connector.credentialFields.filter((field) => !String(secrets[field] || '').trim())
  const config = { ...connector.defaultConfig, ...(ctx.config || {}) }
  const missingConfig = (connector.requiredConfigFields || []).filter((field) => !String(config[field] || '').trim())
  const checkedAt = new Date().toISOString()

  if (missingFields.length > 0 || missingConfig.length > 0) {
    const parts: string[] = []
    if (missingFields.length > 0) parts.push(`凭证：${missingFields.join('、')}`)
    if (missingConfig.length > 0) parts.push(`配置：${missingConfig.join('、')}`)
    return {
      status: 'unconfigured',
      detail: `缺少${parts.join('；')}`,
      latencyMs: 0,
      checkedAt,
      missingFields: [...missingFields, ...missingConfig],
    }
  }

  if (!ctx.probe || !connector.probe) {
    return {
      status: 'unknown',
      detail: '配置完整，尚未发起外网探测',
      latencyMs: 0,
      checkedAt,
      missingFields: [],
    }
  }

  const started = Date.now()
  try {
    const probe = await connector.probe(ctx)
    const latencyMs = Date.now() - started
    if (probe.ok) {
      return {
        status: 'healthy',
        detail: '连通性正常',
        latencyMs,
        checkedAt,
        missingFields: [],
        httpStatus: probe.status,
      }
    }
    const down = probe.errorCode === 'TIMEOUT' || probe.errorCode === 'NETWORK_ERROR'
    return {
      status: down ? 'down' : 'degraded',
      detail: probe.message || '连通性异常',
      latencyMs,
      checkedAt,
      missingFields: [],
      httpStatus: probe.status,
      errorCode: probe.errorCode,
    }
  } catch (err) {
    return {
      status: 'down',
      detail: (err as Error)?.message || String(err),
      latencyMs: Date.now() - started,
      checkedAt,
      missingFields: [],
      errorCode: 'PROBE_EXCEPTION',
    }
  }
}
