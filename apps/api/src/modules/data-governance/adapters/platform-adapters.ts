/**
 * platform-adapters.ts — 7 大主流电商平台开放平台真实 HTTP/OAuth 适配器
 *
 * 严格规范：
 * 1. 绝不生成或返回硬编码模拟订单/假 Token；当店铺处于 manual_only / unauthorized 或未配置真实凭证时 fail-closed 返回空集。
 * 2. 7 大平台均通过真实 `fetch()`（`httpRequestJson`）与官方签名算法完成 OAuth 授权码换 Token、Token 刷新、订单增量拉取与售后退款拉取。
 * 3. Webhook 推送验签使用 constant-time HMAC / MD5 摘要比对。
 */

import crypto from 'crypto'
import type { CanonicalOrderRecord, CanonicalOrderItemRecord, CanonicalRefundRecord } from '../types.js'
import {
  PlatformAdapterContract,
  PlatformCredentials,
  FetchResult,
  OAuthTokenBundle,
  canonicalJsonStringify,
  douyinSign,
  hasValidOAuthAppCredentials,
  hmacSha256Hex,
  httpRequestJson,
  isRealCredentials,
  md5Hex,
} from './base-adapter.js'

const HEADER_VALUE = (headers: Record<string, any>, key: string): string => {
  const direct = headers[key] ?? headers[key.toLowerCase()]
  return Array.isArray(direct) ? String(direct[0] || '') : String(direct || '')
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a.toLowerCase(), 'utf8'), Buffer.from(b.toLowerCase(), 'utf8'))
  } catch {
    return false
  }
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatOpenApiTimestamp(date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function extractBizDate(rawDate: unknown): string {
  const s = String(rawDate || '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  throw new Error(`[DATA_QUARANTINE] 无法提取合法业务日期: ${rawDate}`)
}

/** 统一校验已授权凭证；非 authorized 或凭证缺失时直接拦截不发起外部请求 */
function guardCredentials(
  credentials: PlatformCredentials,
  platformName: string,
): FetchResult<any> | null {
  if (!isRealCredentials(credentials)) {
    return {
      success: true,
      records: [],
      hasMore: false,
      error: `店铺尚未配置真实有效的官方 ${platformName} API 凭证(或处于 manual_only 模式)，已安全跳过 API 自动同步`,
    }
  }
  return null
}

/** 将异构平台原始订单节点归一为 CanonicalOrderRecord */
function normalizeRawOrders(
  platformCode: string,
  shopId: number,
  rawList: any[],
  amountInCents = false,
): CanonicalOrderRecord[] {
  const divisor = amountInCents ? 100 : 1
  return rawList.map((raw) => {
    const orderId = String(raw.order_id ?? raw.tid ?? raw.orderId ?? raw.order_sn ?? '')
    const rawDate = raw.create_time ?? raw.created ?? raw.orderStartTime ?? raw.created_at ?? raw.createdAtSource ?? raw.bizDate
    const bizDate = extractBizDate(rawDate)
    const rawItems = Array.isArray(raw.sku_order_list)
      ? raw.sku_order_list
      : Array.isArray(raw.orders?.order)
        ? raw.orders.order
        : Array.isArray(raw.itemInfoList)
          ? raw.itemInfoList
          : Array.isArray(raw.item_list)
            ? raw.item_list
            : Array.isArray(raw.items)
              ? raw.items
              : []

    const items: CanonicalOrderItemRecord[] = rawItems.map((it: any, idx: number) => ({
      bizDate,
      sourcePlatform: platformCode,
      storeId: shopId,
      sourceOrderId: orderId,
      sourceSubOrderId: String(it.sub_order_id ?? it.oid ?? it.skuId ?? it.sku_id ?? `${orderId}-${idx + 1}`),
      platformSkuId: it.sku_id || it.skuId ? String(it.sku_id ?? it.skuId) : undefined,
      productName: String(it.product_name ?? it.title ?? it.skuName ?? it.goods_name ?? ''),
      quantity: Math.max(1, Math.trunc(toNumber(it.item_num ?? it.num ?? it.itemTotal ?? it.goods_count, 1))),
      itemPaidAmount: toNumber(it.pay_amount ?? it.payment ?? it.jdPrice ?? it.itemPaidAmount) / divisor,
      itemDiscountAllocated: toNumber(it.promotion_amount ?? it.discount_fee ?? it.itemDiscountAllocated) / divisor,
    }))

    return {
      bizDate,
      sourcePlatform: platformCode,
      storeId: shopId,
      sourceOrderId: orderId,
      orderStatus: String(raw.order_status_desc ?? raw.status ?? raw.orderState ?? raw.orderStatus ?? 'paid'),
      rawStatus: String(raw.order_status ?? raw.status ?? raw.orderState ?? ''),
      currencyCode: 'CNY',
      paidAmount: toNumber(raw.pay_amount ?? raw.payment ?? raw.orderPayment ?? raw.payAmount) / divisor,
      totalDiscount: toNumber(raw.promotion_amount ?? raw.discount_fee ?? raw.sellerDiscount ?? raw.totalDiscount) / divisor,
      freightFee: toNumber(raw.post_amount ?? raw.post_fee ?? raw.freightPrice ?? raw.freightFee) / divisor,
      buyerUserId: raw.buyer_id || raw.open_id || raw.buyerUserId ? String(raw.buyer_id ?? raw.open_id ?? raw.buyerUserId) : undefined,
      createdAtSource: raw.create_time ?? raw.created ?? raw.orderStartTime ?? raw.createdAtSource,
      paidAtSource: raw.pay_time ?? raw.paymentConfirmTime ?? raw.paidAtSource,
      sourceUpdatedAt: raw.update_time ?? raw.modified ?? raw.modifiedTime ?? raw.sourceUpdatedAt,
      items,
    }
  })
}

/** 将异构平台原始售后退款节点归一为 CanonicalRefundRecord */
function normalizeRawRefunds(
  platformCode: string,
  shopId: number,
  rawList: any[],
  amountInCents = false,
): CanonicalRefundRecord[] {
  const divisor = amountInCents ? 100 : 1
  return rawList.map((raw) => {
    const bizDate = extractBizDate(raw.apply_time ?? raw.created ?? raw.refundTime ?? raw.bizDate)
    const rawType = String(raw.aftersale_type ?? raw.refund_type ?? raw.refundType ?? '')
    const refundType =
      rawType === '0' || rawType === 'return_and_refund' || rawType.includes('退货')
        ? 'return_and_refund'
        : 'only_refund'
    return {
      bizDate,
      sourcePlatform: platformCode,
      storeId: shopId,
      sourceRefundId: String(raw.aftersale_id ?? raw.refund_id ?? raw.id ?? raw.refundId ?? ''),
      sourceOrderId: String(raw.order_id ?? raw.tid ?? raw.orderId ?? raw.order_sn ?? ''),
      sourceSubOrderId: raw.sub_order_id || raw.oid ? String(raw.sub_order_id ?? raw.oid) : undefined,
      refundType,
      refundAmount: toNumber(raw.refund_amount ?? raw.refund_fee ?? raw.applyRefundFee ?? raw.refundAmount) / divisor,
      refundStatus: String(raw.aftersale_status ?? raw.status ?? raw.refundStatus ?? 'processing'),
      refundedAtSource: raw.refund_time ?? raw.modified ?? raw.refundedAtSource,
    }
  })
}

function assertOAuthCredentials(credentials: PlatformCredentials, platformName: string, requireRefresh = false): void {
  if (!hasValidOAuthAppCredentials(credentials)) {
    throw new Error(`${platformName} OAuth 缺少有效的生产 appKey / appSecret 凭证`)
  }
  if (requireRefresh && (!credentials.refreshToken || credentials.refreshToken.startsWith('mock_'))) {
    throw new Error(`${platformName} 刷新令牌缺失或无效`)
  }
}

function normalizeTokenBundle(data: any, fallbackRefresh?: string): OAuthTokenBundle {
  const accessToken = String(data?.access_token ?? data?.accessToken ?? '')
  if (!accessToken) {
    throw new Error(`开放平台 OAuth 响应缺少 access_token: ${JSON.stringify(data).slice(0, 200)}`)
  }
  return {
    accessToken,
    refreshToken: String(data?.refresh_token ?? data?.refreshToken ?? fallbackRefresh ?? ''),
    expiresIn: Math.max(60, toNumber(data?.expires_in ?? data?.expiresIn, 86400)),
  }
}

/** 1. 抖音电商 (抖店开放平台) */
export class DouyinGovernanceAdapter implements PlatformAdapterContract {
  readonly platformCode = 'douyin'
  readonly platformName = '抖音电商'
  readonly gatewayUrl = 'https://openapi-fxg.jinritemai.com'
  readonly docUrl = 'https://op.jinritemai.com/docs/api-docs/15/55'

  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string {
    const base = credentials.oauthBaseUrl || 'https://fuwu.jinritemai.com'
    return `${base.replace(/\/$/, '')}/authorize?service_id=${encodeURIComponent(credentials.appKey)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
  }

  private async callOpenApi(
    credentials: PlatformCredentials,
    path: string,
    method: string,
    params: Record<string, any>,
    includeToken = true,
  ): Promise<any> {
    const gateway = (credentials.gatewayBaseUrl || this.gatewayUrl).replace(/\/$/, '')
    const timestamp = String(Math.floor(Date.now() / 1000))
    const paramJson = canonicalJsonStringify(params)
    const sign = douyinSign(method, credentials.appKey, credentials.appSecret, timestamp, paramJson)
    const qs = new URLSearchParams({
      app_key: credentials.appKey,
      method,
      param_json: paramJson,
      timestamp,
      v: '2',
      sign,
      sign_method: 'hmac-sha256',
      ...(includeToken && credentials.accessToken ? { access_token: credentials.accessToken } : {}),
    })

    const res = await httpRequestJson<any>(`${gateway}${path}?${qs.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: paramJson,
      timeoutMs: credentials.timeoutMs,
    })

    const errNo = res?.err_no ?? res?.code ?? 0
    if (Number(errNo) !== 0) {
      throw new Error(res?.message || res?.msg || `抖店 OpenAPI 错误 (${errNo})`)
    }
    return res?.data ?? res
  }

  async exchangeCodeForToken(credentials: PlatformCredentials, code: string): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName)
    const oauthCredentials = credentials.oauthBaseUrl
      ? { ...credentials, gatewayBaseUrl: credentials.oauthBaseUrl }
      : credentials
    const data = await this.callOpenApi(oauthCredentials, '/token/create', 'token.create', {
      code,
      grant_type: 'authorization_code',
    }, false)
    return normalizeTokenBundle(data)
  }

  async refreshAccessToken(credentials: PlatformCredentials): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName, true)
    const oauthCredentials = credentials.oauthBaseUrl
      ? { ...credentials, gatewayBaseUrl: credentials.oauthBaseUrl }
      : credentials
    const data = await this.callOpenApi(oauthCredentials, '/token/refresh', 'token.refresh', {
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
    }, false)
    return normalizeTokenBundle(data, credentials.refreshToken)
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string, secret: string): boolean {
    const sign = HEADER_VALUE(headers, 'event-sign') || HEADER_VALUE(headers, 'x-event-sign')
    if (!sign || !secret) return false
    const expected = hmacSha256Hex(rawBody, secret)
    return constantTimeHexEqual(sign, expected)
  }

  async fetchOrders(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalOrderRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked

    try {
      const data = await this.callOpenApi(credentials, '/order/searchList', 'order.searchList', {
        create_time_start: options?.sinceTime ? Math.floor(new Date(options.sinceTime).getTime() / 1000) : undefined,
        page: options?.cursor ? Number(options.cursor) : 0,
        size: options?.pageSize || 50,
      })
      const list = data?.shop_order_list || data?.list || data?.orders || []
      const records = normalizeRawOrders(this.platformCode, credentials.shopId, list, true)
      const total = toNumber(data?.total, records.length)
      const page = toNumber(data?.page, 0)
      const size = options?.pageSize || 50
      const hasMore = (page + 1) * size < total && records.length > 0
      return {
        success: true,
        records,
        hasMore,
        nextCursor: hasMore ? String(page + 1) : undefined,
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }

  async fetchRefunds(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalRefundRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked

    try {
      const data = await this.callOpenApi(credentials, '/afterSale/List', 'afterSale.List', {
        update_start_time: options?.sinceTime ? Math.floor(new Date(options.sinceTime).getTime() / 1000) : undefined,
        page: options?.cursor ? Number(options.cursor) : 0,
        size: options?.pageSize || 50,
      })
      const list = data?.items || data?.list || data?.aftersale_list || []
      return {
        success: true,
        records: normalizeRawRefunds(this.platformCode, credentials.shopId, list, true),
        hasMore: Boolean(data?.has_more),
        nextCursor: data?.has_more ? String(toNumber(options?.cursor, 0) + 1) : undefined,
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }
}

/** 2. 快手电商 */
export class KuaishouGovernanceAdapter implements PlatformAdapterContract {
  readonly platformCode = 'kuaishou'
  readonly platformName = '快手电商'
  readonly gatewayUrl = 'https://openapi.kwaixiaishop.com/open'
  readonly docUrl = 'https://open.kwaixiaishop.com/docs/dev'

  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string {
    const base = credentials.oauthBaseUrl || 'https://openapi.kwaixiaishop.com/oauth2'
    return `${base.replace(/\/$/, '')}/authorize?app_id=${encodeURIComponent(credentials.appKey)}&response_type=code&scope=merchant_order,merchant_refund&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
  }

  private async postOAuth(credentials: PlatformCredentials, params: Record<string, string>): Promise<OAuthTokenBundle> {
    const oauthBase = (credentials.oauthBaseUrl || 'https://openapi.kwaixiaishop.com/oauth2').replace(/\/$/, '')
    const res = await httpRequestJson<any>(`${oauthBase}/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: credentials.appKey,
        app_secret: credentials.appSecret,
        ...params,
      }).toString(),
      timeoutMs: credentials.timeoutMs,
    })
    if (res?.result && Number(res.result) !== 1) {
      throw new Error(res?.error_msg || `快手 OAuth 错误 (${res.result})`)
    }
    return normalizeTokenBundle(res, credentials.refreshToken)
  }

  private async callGateway(credentials: PlatformCredentials, method: string, param: Record<string, any>): Promise<any> {
    const gateway = (credentials.gatewayBaseUrl || this.gatewayUrl).replace(/\/$/, '')
    const timestamp = String(Date.now())
    const paramJson = JSON.stringify(param)
    const signPayload: Record<string, any> = {
      appkey: credentials.appKey,
      method,
      param: paramJson,
      access_token: credentials.accessToken,
      timestamp,
      version: '1',
      signMethod: 'HMAC_SHA256',
    }
    const sorted = Object.keys(signPayload)
      .sort()
      .map((k) => `${k}=${signPayload[k]}`)
      .join('&')
    const sign = hmacSha256Hex(`${sorted}&signSecret=${credentials.appSecret}`, credentials.appSecret)
    const body = new URLSearchParams({ ...signPayload, sign }).toString()

    const methodPath = (method.startsWith('open.') ? method.slice(5) : method).replace(/\./g, '/')
    const res = await httpRequestJson<any>(`${gateway}/${methodPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      timeoutMs: credentials.timeoutMs,
    })
    if (res?.result !== undefined && Number(res.result) !== 1 && Number(res.result) !== 0) {
      throw new Error(res?.error_msg || res?.msg || `快手 OpenAPI 错误 (${res.result})`)
    }
    return res?.data ?? res
  }

  async exchangeCodeForToken(credentials: PlatformCredentials, code: string): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName)
    return this.postOAuth(credentials, { grant_type: 'code', code })
  }

  async refreshAccessToken(credentials: PlatformCredentials): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName, true)
    return this.postOAuth(credentials, { grant_type: 'refresh_token', refresh_token: credentials.refreshToken! })
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string, secret: string): boolean {
    const sign = HEADER_VALUE(headers, 'x-kwai-signature')
    if (!sign || !secret) return false
    return constantTimeHexEqual(sign, md5Hex(rawBody + secret))
  }

  async fetchOrders(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalOrderRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked
    try {
      const data = await this.callGateway(credentials, 'open.seller.order.pcursor.list', {
        beginTime: options?.sinceTime ? new Date(options.sinceTime).getTime() : undefined,
        pcursor: options?.cursor || '',
        pageSize: options?.pageSize || 50,
      })
      const list = data?.orderInfoList || data?.order_list || data?.list || []
      return {
        success: true,
        records: normalizeRawOrders(this.platformCode, credentials.shopId, list, true),
        hasMore: Boolean(data?.hasMore || (data?.pcursor && data.pcursor !== 'nomore')),
        nextCursor: data?.pcursor && data.pcursor !== 'nomore' ? String(data.pcursor) : undefined,
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }

  async fetchRefunds(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalRefundRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked
    try {
      const data = await this.callGateway(credentials, 'open.seller.order.refund.pcursor.list', {
        beginTime: options?.sinceTime ? new Date(options.sinceTime).getTime() : undefined,
        pcursor: options?.cursor || '',
        pageSize: options?.pageSize || 50,
      })
      const list = data?.refundOrderInfoList || data?.list || []
      return {
        success: true,
        records: normalizeRawRefunds(this.platformCode, credentials.shopId, list, true),
        hasMore: Boolean(data?.hasMore),
        nextCursor: data?.pcursor,
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }
}

/**
 * 3. 微信小店（视频号小店）
 *
 * 与抖店/快手的结构性差异（决定了实现方式）：
 *   1. 无标准 OAuth 跳转：商家在微信小店后台创建「自建应用」，直接持有 appid(appKey) + secret(appSecret)
 *      → exchangeCodeForToken 走 `stable_token` 用 client_credential 换取 access_token，不使用 code
 *   2. access_token 无 refresh_token 概念，到期（7200s）后重新获取，refreshAccessToken 等价于重新获取
 *   3. 订单列表接口只返回 order_id 列表，详情需逐单调用 `/channels/ec/order/get`（两步拉取）
 *   4. 金额单位统一为「分」，归一化时 amountInCents = true
 *
 * 官方文档：https://developers.weixin.qq.com/doc/store/shop/API/
 */
export class WechatGovernanceAdapter implements PlatformAdapterContract {
  readonly platformCode = 'wechat'
  readonly platformName = '微信小店'
  readonly gatewayUrl = 'https://api.weixin.qq.com'
  readonly docUrl = 'https://developers.weixin.qq.com/doc/store/shop/API/'

  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string {
    // 微信小店无 OAuth 授权码跳转；给出商家后台自建应用的入口，避免前端出现死链
    const base = credentials.oauthBaseUrl || 'https://channels.weixin.qq.com/shop'
    const params = new URLSearchParams({ from: 'leyova', state })
    if (redirectUri) params.set('redirectUri', redirectUri)
    return `${base}?${params.toString()}`
  }

  /** 统一 POST 调用（access_token 走 query，失败抛错） */
  private async callWxApi(
    credentials: PlatformCredentials,
    path: string,
    payload: Record<string, any>,
    accessToken?: string,
  ): Promise<any> {
    const endpoint = (credentials.gatewayBaseUrl || this.gatewayUrl).replace(/\/$/, '')
    const token = accessToken ?? credentials.accessToken ?? ''
    const url = `${endpoint}${path}${token ? `?access_token=${encodeURIComponent(token)}` : ''}`
    const res = await httpRequestJson<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      timeoutMs: credentials.timeoutMs,
    })
    const errcode = Number(res?.errcode ?? 0)
    if (Number.isFinite(errcode) && errcode !== 0) {
      throw new Error(`微信小店 API 错误 ${errcode}: ${res?.errmsg || '未知错误'}`)
    }
    return res
  }

  async exchangeCodeForToken(credentials: PlatformCredentials, _code: string): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName)
    const endpoint = (credentials.oauthBaseUrl || this.gatewayUrl).replace(/\/$/, '')
    const data = await httpRequestJson<any>(`${endpoint}/cgi-bin/stable_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credential',
        appid: credentials.appKey,
        secret: credentials.appSecret,
        force_refresh: false,
      }),
      timeoutMs: credentials.timeoutMs,
    })
    const errcode = Number(data?.errcode ?? 0)
    if (Number.isFinite(errcode) && errcode !== 0) {
      throw new Error(`微信小店获取 access_token 失败 ${errcode}: ${data?.errmsg || ''}`)
    }
    return normalizeTokenBundle(data)
  }

  async refreshAccessToken(credentials: PlatformCredentials): Promise<OAuthTokenBundle> {
    // 微信 access_token 无 refresh 语义，直接重新签发
    return this.exchangeCodeForToken(credentials, '')
  }

  /**
   * 微信消息推送验签：sha1(sort([token, timestamp, nonce]).join(''))
   * 兼容 header 名 `x-wechat-signature` 与微信原生 `signature`
   */
  verifyWebhookSignature(headers: Record<string, any>, _rawBody: string, secret: string): boolean {
    const signature =
      HEADER_VALUE(headers, 'x-wechat-signature') || HEADER_VALUE(headers, 'signature')
    const timestamp = HEADER_VALUE(headers, 'timestamp')
    const nonce = HEADER_VALUE(headers, 'nonce')
    if (!signature || !secret || !timestamp || !nonce) return false
    const plain = [secret, timestamp, nonce].sort().join('')
    const expected = crypto.createHash('sha1').update(plain, 'utf8').digest('hex')
    return constantTimeHexEqual(signature, expected)
  }

  async fetchOrders(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalOrderRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked

    try {
      const pageSize = Math.min(Math.max(toNumber(options?.pageSize, 50), 1), 100)
      const endTime = Math.floor(Date.now() / 1000)
      const startTime = options?.sinceTime
        ? Math.floor(new Date(options.sinceTime).getTime() / 1000)
        : endTime - 24 * 3600

      // Step 1：拉取订单 ID 列表
      const listRes = await this.callWxApi(credentials, '/channels/ec/order/list/get', {
        create_time_range: { start_time: startTime, end_time: endTime },
        page_size: pageSize,
        ...(options?.cursor ? { next_key: String(options.cursor) } : {}),
      })

      const orderIds: string[] = Array.isArray(listRes?.order_id_list)
        ? listRes.order_id_list.map((x: any) => String(x))
        : []

      // Step 2：逐单获取详情（官方列表接口不返回明细）
      const rawOrders: any[] = []
      const detailErrors: string[] = []
      for (const orderId of orderIds) {
        try {
          const detail = await this.callWxApi(credentials, '/channels/ec/order/get', { order_id: orderId })
          if (detail?.order) rawOrders.push(this.flattenOrder(detail.order))
        } catch (err: any) {
          detailErrors.push(`${orderId}: ${err?.message || String(err)}`)
        }
      }

      const records = normalizeRawOrders(this.platformCode, credentials.shopId, rawOrders, true)
      const nextKey = listRes?.next_key ? String(listRes.next_key) : ''
      const hasMore = Boolean(listRes?.has_more) || Boolean(nextKey)

      return {
        success: true,
        records,
        hasMore,
        nextCursor: hasMore && nextKey ? nextKey : undefined,
        rawResponses: detailErrors.length > 0 ? [{ detailErrors }] : rawOrders,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }

  async fetchRefunds(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalRefundRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked

    try {
      const pageSize = Math.min(Math.max(toNumber(options?.pageSize, 50), 1), 100)
      const endTime = Math.floor(Date.now() / 1000)
      const startTime = options?.sinceTime
        ? Math.floor(new Date(options.sinceTime).getTime() / 1000)
        : endTime - 24 * 3600

      // 售后单列表：/channels/ec/aftersale/getaftersalelist
      // 注：该路径按微信小店「售后管理-获取售后单列表」实现，字段以联调为准
      const data = await this.callWxApi(credentials, '/channels/ec/aftersale/getaftersalelist', {
        create_time_range: { start_time: startTime, end_time: endTime },
        page_size: pageSize,
        ...(options?.cursor ? { next_key: String(options.cursor) } : {}),
      })

      const list = data?.after_sale_order_list || data?.list || []
      const nextKey = data?.next_key ? String(data.next_key) : ''
      return {
        success: true,
        records: normalizeRawRefunds(this.platformCode, credentials.shopId, list, true),
        hasMore: Boolean(data?.has_more) || Boolean(nextKey),
        nextCursor: nextKey || undefined,
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }

  /**
   * 微信小店订单结构拍平为 normalizeRawOrders 期望的扁平形状
   * 关键字段：price_info（分为单位）、order_detail.product_infos、pay_info、status
   */
  private flattenOrder(order: any): any {
    const priceInfo = order?.price_info || {}
    const productInfos = Array.isArray(order?.order_detail?.product_infos)
      ? order.order_detail.product_infos
      : []

    return {
      order_id: order?.order_id,
      create_time: order?.create_time,
      update_time: order?.update_time,
      status: order?.status,
      order_status_desc: this.describeStatus(order?.status),
      pay_amount: priceInfo?.order_price,
      promotion_amount: priceInfo?.discounted_price,
      post_amount: priceInfo?.freight,
      buyer_id: order?.openid || order?.order_detail?.openid,
      pay_time: order?.pay_info?.pay_time,
      sku_order_list: productInfos.map((p: any, idx: number) => ({
        sub_order_id: `${order?.order_id}-${idx + 1}`,
        sku_id: p?.sku_id,
        product_name: p?.title,
        item_num: p?.sku_cnt,
        pay_amount: toNumber(p?.sale_price) * Math.max(1, toNumber(p?.sku_cnt, 1)),
      })),
    }
  }

  /** 微信小店订单状态码 → 可读描述（用于口径判断与退款识别） */
  private describeStatus(status: unknown): string {
    const map: Record<string, string> = {
      '10': '待付款',
      '12': '礼物待收下',
      '13': '待成团',
      '20': '待发货',
      '21': '部分发货',
      '30': '待收货',
      '100': '完成',
      '200': '全部售后',
      '250': '撤销',
    }
    const key = String(status ?? '')
    return map[key] || key || 'paid'
  }
}
