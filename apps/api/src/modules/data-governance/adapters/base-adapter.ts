/**
 * base-adapter.ts — 官方开放平台适配器基础契约
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

export interface PlatformAdapterContract {
  readonly platformCode: string
  readonly platformName: string
  readonly gatewayUrl: string
  readonly docUrl: string

  /** 生成授权跳转 URL */
  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string

  /** 换取 AccessToken */
  exchangeCodeForToken(credentials: PlatformCredentials, code: string): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
  }>

  /** 刷新 AccessToken */
  refreshAccessToken(credentials: PlatformCredentials): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
  }>

  /** Webhook 推送验签 */
  verifyWebhookSignature(headers: Record<string, any>, rawBody: string, secret: string): boolean

  /** 拉取规范订单数据 (如果凭证未就绪，可返回测试规范样例) */
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

/** 通用 TOP 协议 MD5 签名算法 (淘宝/天猫格式: secret + k1v1k2v2 + secret) */
export function topSignMd5(params: Record<string, any>, secret: string): string {
  const sortedKeys = Object.keys(params).sort()
  let query = secret
  for (const k of sortedKeys) {
    if (params[k] !== undefined && params[k] !== null && k !== 'sign') {
      query += `${k}${params[k]}`
    }
  }
  query += secret
  return md5Hex(query).toUpperCase()
}

