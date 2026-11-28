/**
 * base-adapter.ts — 官方开放平台适配器基础契约与通用签名 / HTTP 传输工具
 */

import crypto from 'crypto'
import type { CanonicalOrderRecord, CanonicalRefundRecord } from '../types.js'

export interface PlatformCredentials {
  appKey: string
  appSecret: string
  accessToken?: string
  refreshToken?: string
  shopId: number
  platformCode: string
  authStatus?: 'authorized' | 'unauthorized' | 'manual_only'
  /** 可选自定义网关根地址（用于企业代理网关或本地集成测试服务器；未设置时使用官方 HTTPS 网关） */
  gatewayBaseUrl?: string
  /** 可选自定义 OAuth 根地址（用于企业代理或本地集成测试服务器） */
  oauthBaseUrl?: string
  /** HTTP 请求超时时间（毫秒，默认 15000） */
  timeoutMs?: number
  extra?: Record<string, any>
}

export interface FetchResult<T> {
  success: boolean
  records: T[]
  hasMore: boolean
  nextCursor?: string
  rawResponses?: any[]
  error?: string
}

export interface OAuthTokenBundle {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface PlatformAdapterContract {
  readonly platformCode: string
  readonly platformName: string
  readonly gatewayUrl: string
  readonly docUrl: string

  /** 生成授权跳转 URL */
  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string

  /** 换取 AccessToken */
  exchangeCodeForToken(credentials: PlatformCredentials, code: string): Promise<OAuthTokenBundle>

  /** 刷新 AccessToken */
  refreshAccessToken(credentials: PlatformCredentials): Promise<OAuthTokenBundle>

  /** Webhook 推送验签 */
  verifyWebhookSignature(headers: Record<string, any>, rawBody: string, secret: string): boolean

  /** 拉取规范订单数据（未授权或处于 manual_only 时安全返回空集，不发起外网请求） */
  fetchOrders(credentials: PlatformCredentials, options: {
    sinceTime?: string
    cursor?: string
    pageSize?: number
  }): Promise<FetchResult<CanonicalOrderRecord>>

  /** 拉取规范售后退款数据 */
  fetchRefunds(credentials: PlatformCredentials, options: {
    sinceTime?: string
    cursor?: string
    pageSize?: number
  }): Promise<FetchResult<CanonicalRefundRecord>>
}

/** 通用 MD5 签名生成器 */
export function md5Hex(content: string): string {
  return crypto.createHash('md5').update(content, 'utf8').digest('hex')
}

/** 通用 HMAC-SHA256 签名生成器 */
export function hmacSha256Hex(content: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(content, 'utf8').digest('hex')
}

/** 通用货架电商 MD5 签名算法 (secret + sorted k1v1k2v2 + secret -> UPPER HEX) */
export function topSignMd5(params: Record<string, any>, secret: string): string {
  const sortedKeys = Object.keys(params).sort()
  let query = secret
  for (const k of sortedKeys) {
    if (params[k] !== undefined && params[k] !== null && k !== 'sign') {
      const val = typeof params[k] === 'object' ? JSON.stringify(params[k]) : String(params[k])
      query += `${k}${val}`
    }
  }
  query += secret
  return md5Hex(query).toUpperCase()
}

/** 规范 JSON 序列化（递归按 key 字典序排序，适配抖店 v2 验签） */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonStringify(item)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const entries = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`)
  return `{${entries.join(',')}}`
}

/** 抖店开放平台 v2 HMAC-SHA256 签名 */
export function douyinSign(
  method: string,
  appKey: string,
  appSecret: string,
  timestamp: string,
  paramJson: string,
): string {
  const plain = `${appSecret}app_key${appKey}method${method}param_json${paramJson}timestamp${timestamp}v2${appSecret}`
  return hmacSha256Hex(plain, appSecret)
}

function isPlaceholderSecret(val: string | undefined): boolean {
  if (!val) return true
  const trimmed = val.trim()
  if (!trimmed) return true
  return trimmed.startsWith('mock_') || trimmed.startsWith('demo_')
}

/**
 * 校验 OAuth 应用凭证 (appKey + appSecret)，用于授权换码/刷新阶段
 */
export function hasValidOAuthAppCredentials(credentials: Pick<PlatformCredentials, 'appKey' | 'appSecret'>): boolean {
  return !isPlaceholderSecret(credentials.appKey) && !isPlaceholderSecret(credentials.appSecret)
}

/**
 * 校验是否为真实生产商户凭证 (杜绝 mock/demo 假数据流入生产库)
 */
export function isRealCredentials(credentials: PlatformCredentials): boolean {
  if (credentials.authStatus === 'manual_only' || credentials.authStatus === 'unauthorized') {
    return false
  }
  if (!hasValidOAuthAppCredentials(credentials)) {
    return false
  }
  if (isPlaceholderSecret(credentials.accessToken)) {
    return false
  }
  return true
}

/**
 * 带超时与指数退避重试的 JSON HTTP 客户端
 */
export async function httpRequestJson<T = any>(
  url: string,
  options: RequestInit & { timeoutMs?: number; maxRetries?: number } = {},
): Promise<T> {
  const { timeoutMs = 15_000, maxRetries = 2, ...fetchInit } = options
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      })

      const rawText = await response.text()
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500
        const err = new Error(`OpenAPI HTTP ${response.status}: ${rawText.slice(0, 300)}`)
        if (retryable && attempt < maxRetries) {
          lastError = err
          await new Promise((r) => setTimeout(r, 150 * 2 ** attempt))
          continue
        }
        throw err
      }

      if (!rawText.trim()) {
        return {} as T
      }
      try {
        return JSON.parse(rawText) as T
      } catch {
        throw new Error(`OpenAPI 响应非合法 JSON: ${rawText.slice(0, 200)}`)
      }
    } catch (err: any) {
      const wrapped = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries && (wrapped.name === 'AbortError' || wrapped.message.includes('fetch failed'))) {
        lastError = wrapped
        await new Promise((r) => setTimeout(r, 150 * 2 ** attempt))
        continue
      }
      throw wrapped
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError || new Error('OpenAPI HTTP 请求失败')
}
