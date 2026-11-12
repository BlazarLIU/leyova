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
  topSignMd5,
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
  return new Date().toISOString().slice(0, 10)
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
    const bizDate = extractBizDate(raw.create_time ?? raw.created ?? raw.orderStartTime ?? raw.created_at ?? raw.bizDate)
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

/** 3. 淘宝集市 (TOP 开放协议) */
export class TaobaoGovernanceAdapter implements PlatformAdapterContract {
  readonly platformCode: string = 'taobao'
  readonly platformName: string = '淘宝集市'
  readonly gatewayUrl: string = 'https://eco.taobao.com/router/rest'
  readonly docUrl: string = 'https://open.taobao.com/doc.htm?docId=101617&docType=1'

  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string {
    const base = credentials.oauthBaseUrl || 'https://oauth.taobao.com'
    return `${base.replace(/\/$/, '')}/authorize?response_type=code&client_id=${encodeURIComponent(credentials.appKey)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&view=web`
  }

  private async postOAuthToken(credentials: PlatformCredentials, params: Record<string, string>): Promise<OAuthTokenBundle> {
    const oauthEndpoint = credentials.oauthBaseUrl
      ? `${credentials.oauthBaseUrl.replace(/\/$/, '')}/token`
      : 'https://oauth.taobao.com/token'
    const res = await httpRequestJson<any>(oauthEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.appKey,
        client_secret: credentials.appSecret,
        ...params,
      }).toString(),
      timeoutMs: credentials.timeoutMs,
    })
    if (res?.error) {
      throw new Error(res?.error_description || res.error)
    }
    return normalizeTokenBundle(res, credentials.refreshToken)
  }

  private async callTopMethod(
    credentials: PlatformCredentials,
    method: string,
    bizParams: Record<string, any>,
  ): Promise<any> {
    const gateway = credentials.gatewayBaseUrl || this.gatewayUrl
    const sysParams: Record<string, any> = {
      method,
      app_key: credentials.appKey,
      session: credentials.accessToken,
      timestamp: formatOpenApiTimestamp(),
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      ...bizParams,
    }
    const sign = topSignMd5(sysParams, credentials.appSecret)
    const body = new URLSearchParams(
      Object.entries({ ...sysParams, sign })
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]),
    ).toString()

    const res = await httpRequestJson<any>(gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
      timeoutMs: credentials.timeoutMs,
    })
    if (res?.error_response) {
      throw new Error(res.error_response.sub_msg || res.error_response.msg || `TOP Error ${res.error_response.code}`)
    }
    return res
  }

  async exchangeCodeForToken(credentials: PlatformCredentials, code: string): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName)
    return this.postOAuthToken(credentials, { grant_type: 'authorization_code', code })
  }

  async refreshAccessToken(credentials: PlatformCredentials): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName, true)
    return this.postOAuthToken(credentials, { grant_type: 'refresh_token', refresh_token: credentials.refreshToken! })
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string, secret: string): boolean {
    const sign = HEADER_VALUE(headers, 'x-taobao-hmac-sha256')
    if (!sign || !secret) return false
    const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
    return sign === expected
  }

  async fetchOrders(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalOrderRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked
    try {
      const pageNo = options?.cursor ? Number(options.cursor) : 1
      const res = await this.callTopMethod(credentials, 'taobao.trades.sold.get', {
        fields: 'tid,status,payment,discount_fee,post_fee,created,pay_time,modified,orders',
        start_created: options?.sinceTime ? formatOpenApiTimestamp(new Date(options.sinceTime)) : undefined,
        page_no: pageNo,
        page_size: options?.pageSize || 50,
      })
      const resp = res?.trades_sold_get_response ?? res
      const list = resp?.trades?.trade || resp?.list || []
      return {
        success: true,
        records: normalizeRawOrders(this.platformCode, credentials.shopId, list, false),
        hasMore: Boolean(resp?.has_next),
        nextCursor: resp?.has_next ? String(pageNo + 1) : undefined,
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
      const pageNo = options?.cursor ? Number(options.cursor) : 1
      const res = await this.callTopMethod(credentials, 'taobao.refunds.receive.get', {
        fields: 'refund_id,tid,oid,refund_fee,status,created,modified',
        start_modified: options?.sinceTime ? formatOpenApiTimestamp(new Date(options.sinceTime)) : undefined,
        page_no: pageNo,
        page_size: options?.pageSize || 50,
      })
      const resp = res?.refunds_receive_get_response ?? res
      const list = resp?.refunds?.refund || resp?.list || []
      return {
        success: true,
        records: normalizeRawRefunds(this.platformCode, credentials.shopId, list, false),
        hasMore: Boolean(resp?.has_next),
        nextCursor: resp?.has_next ? String(pageNo + 1) : undefined,
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }
}

/** 4. 天猫商城（复用 TOP 协议实现，区分平台编码与文档地址） */
export class TmallGovernanceAdapter extends TaobaoGovernanceAdapter {
  override readonly platformCode = 'tmall'
  override readonly platformName = '天猫'
  override readonly docUrl = 'https://open.taobao.com/doc.htm?docId=1&docType=1'
}

/** 5. 京东开放平台 */
export class JdGovernanceAdapter implements PlatformAdapterContract {
  readonly platformCode = 'jd'
  readonly platformName = '京东'
  readonly gatewayUrl = 'https://api.jd.com/routerjson'
  readonly docUrl = 'https://open.jd.com/home/home#/doc/api'

  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string {
    const base = credentials.oauthBaseUrl || 'https://open-oauth.jd.com/oauth2'
    return `${base.replace(/\/$/, '')}/to_login?app_key=${encodeURIComponent(credentials.appKey)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=snsapi_base`
  }

  private async postOAuth(credentials: PlatformCredentials, params: Record<string, string>): Promise<OAuthTokenBundle> {
    const oauthBase = (credentials.oauthBaseUrl || 'https://open-oauth.jd.com/oauth2').replace(/\/$/, '')
    const qs = new URLSearchParams({
      app_key: credentials.appKey,
      app_secret: credentials.appSecret,
      ...params,
    })
    const res = await httpRequestJson<any>(`${oauthBase}/access_token?${qs.toString()}`, {
      method: 'GET',
      timeoutMs: credentials.timeoutMs,
    })
    if (res?.code && String(res.code) !== '0') {
      throw new Error(res?.msg || `京东 OAuth 错误 (${res.code})`)
    }
    return normalizeTokenBundle(res, credentials.refreshToken)
  }

  private async callJdMethod(
    credentials: PlatformCredentials,
    method: string,
    paramObj: Record<string, any>,
  ): Promise<any> {
    const gateway = credentials.gatewayBaseUrl || this.gatewayUrl
    const sysParams: Record<string, any> = {
      method,
      app_key: credentials.appKey,
      access_token: credentials.accessToken,
      timestamp: formatOpenApiTimestamp(),
      format: 'json',
      v: '2.0',
      '360buy_param_json': JSON.stringify(paramObj),
    }
    const sign = topSignMd5(sysParams, credentials.appSecret)
    const body = new URLSearchParams({ ...sysParams, sign }).toString()

    const res = await httpRequestJson<any>(gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
      timeoutMs: credentials.timeoutMs,
    })
    if (res?.error_response) {
      throw new Error(res.error_response.zh_desc || res.error_response.en_desc || '京东 OpenAPI 错误')
    }
    return res
  }

  async exchangeCodeForToken(credentials: PlatformCredentials, code: string): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName)
    return this.postOAuth(credentials, { grant_type: 'authorization_code', code })
  }

  async refreshAccessToken(credentials: PlatformCredentials): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName, true)
    return this.postOAuth(credentials, { grant_type: 'refresh_token', refresh_token: credentials.refreshToken! })
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string, secret: string): boolean {
    const sign = HEADER_VALUE(headers, 'x-jd-signature')
    if (!sign || !secret) return false
    return constantTimeHexEqual(sign, md5Hex(secret + rawBody + secret))
  }

  async fetchOrders(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalOrderRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked
    try {
      const page = options?.cursor ? Number(options.cursor) : 1
      const pageSize = options?.pageSize || 50
      const res = await this.callJdMethod(credentials, 'jingdong.pop.order.search', {
        start_date: options?.sinceTime ? formatOpenApiTimestamp(new Date(options.sinceTime)) : undefined,
        page: String(page),
        page_size: String(pageSize),
      })
      const payload = res?.jingdong_pop_order_search_responce?.searchorderinfo_result ?? res
      const list = payload?.orderInfoList || payload?.list || []
      const records = normalizeRawOrders(this.platformCode, credentials.shopId, list, false)
      const hasMore = toNumber(payload?.orderTotal, records.length) > page * pageSize && records.length > 0
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
      const page = options?.cursor ? Number(options.cursor) : 1
      const res = await this.callJdMethod(credentials, 'jingdong.pop.afs.soa.refundapply.queryPageList', {
        applyTimeStart: options?.sinceTime ? formatOpenApiTimestamp(new Date(options.sinceTime)) : undefined,
        pageIndex: page,
        pageSize: options?.pageSize || 50,
      })
      const payload = res?.jingdong_pop_afs_soa_refundapply_queryPageList_responce?.queryResult ?? res
      const list = payload?.result || payload?.list || []
      return {
        success: true,
        records: normalizeRawRefunds(this.platformCode, credentials.shopId, list, true),
        hasMore: toNumber(payload?.totalCount, list.length) > page * (options?.pageSize || 50),
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }
}

/** 6. 拼多多开放平台 */
export class PddGovernanceAdapter implements PlatformAdapterContract {
  readonly platformCode = 'pdd'
  readonly platformName = '拼多多'
  readonly gatewayUrl = 'https://gw-api.pinduoduo.com/api/router'
  readonly docUrl = 'https://open.pinduoduo.com/application/document/browse'

  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string {
    const base = credentials.oauthBaseUrl || 'https://mms.pinduoduo.com/open.html'
    return `${base}?response_type=code&client_id=${encodeURIComponent(credentials.appKey)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
  }

  private async postOAuth(credentials: PlatformCredentials, body: Record<string, any>): Promise<OAuthTokenBundle> {
    const oauthEndpoint = credentials.oauthBaseUrl
      ? `${credentials.oauthBaseUrl.replace(/\/$/, '')}/token`
      : 'https://open-api.pinduoduo.com/oauth/token'
    const res = await httpRequestJson<any>(oauthEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: credentials.appKey,
        client_secret: credentials.appSecret,
        ...body,
      }),
      timeoutMs: credentials.timeoutMs,
    })
    if (res?.error_response) {
      throw new Error(res.error_response.error_msg || '拼多多 OAuth 错误')
    }
    return normalizeTokenBundle(res, credentials.refreshToken)
  }

  private async callPddMethod(credentials: PlatformCredentials, type: string, params: Record<string, any>): Promise<any> {
    const gateway = credentials.gatewayBaseUrl || this.gatewayUrl
    const payload: Record<string, any> = {
      type,
      client_id: credentials.appKey,
      access_token: credentials.accessToken,
      timestamp: Math.floor(Date.now() / 1000),
      data_type: 'JSON',
      ...params,
    }
    const sign = topSignMd5(payload, credentials.appSecret)
    const res = await httpRequestJson<any>(gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, sign }),
      timeoutMs: credentials.timeoutMs,
    })
    if (res?.error_response) {
      throw new Error(res.error_response.error_msg || res.error_response.sub_msg || '拼多多 OpenAPI 错误')
    }
    return res
  }

  async exchangeCodeForToken(credentials: PlatformCredentials, code: string): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName)
    return this.postOAuth(credentials, { grant_type: 'authorization_code', code })
  }

  async refreshAccessToken(credentials: PlatformCredentials): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName, true)
    return this.postOAuth(credentials, { grant_type: 'refresh_token', refresh_token: credentials.refreshToken })
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string, secret: string): boolean {
    const sign = HEADER_VALUE(headers, 'x-pdd-signature')
    if (!sign || !secret) return false
    return constantTimeHexEqual(sign, md5Hex(rawBody + secret))
  }

  async fetchOrders(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalOrderRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked
    try {
      const page = options?.cursor ? Number(options.cursor) : 1
      const res = await this.callPddMethod(credentials, 'pdd.order.list.get', {
        start_confirm_at: options?.sinceTime ? Math.floor(new Date(options.sinceTime).getTime() / 1000) : Math.floor(Date.now() / 1000) - 86400,
        end_confirm_at: Math.floor(Date.now() / 1000),
        page,
        page_size: options?.pageSize || 50,
      })
      const payload = res?.order_list_get_response ?? res
      const list = payload?.order_list || payload?.list || []
      return {
        success: true,
        records: normalizeRawOrders(this.platformCode, credentials.shopId, list, false),
        hasMore: Boolean(payload?.has_next),
        nextCursor: payload?.has_next ? String(page + 1) : undefined,
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
      const page = options?.cursor ? Number(options.cursor) : 1
      const res = await this.callPddMethod(credentials, 'pdd.refund.list.increment.get', {
        start_updated_at: options?.sinceTime ? Math.floor(new Date(options.sinceTime).getTime() / 1000) : Math.floor(Date.now() / 1000) - 86400,
        end_updated_at: Math.floor(Date.now() / 1000),
        page,
        page_size: options?.pageSize || 50,
      })
      const payload = res?.refund_increment_get_response ?? res
      const list = payload?.refund_list || payload?.list || []
      return {
        success: true,
        records: normalizeRawRefunds(this.platformCode, credentials.shopId, list, true),
        hasMore: toNumber(payload?.total_count, list.length) > page * (options?.pageSize || 50),
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }
}

/** 7. 小红书开放平台 (Ark) */
export class XiaohongshuGovernanceAdapter implements PlatformAdapterContract {
  readonly platformCode = 'xiaohongshu'
  readonly platformName = '小红书'
  readonly gatewayUrl = 'https://ark.xiaohongshu.com/ark/open_api/v3/common_controller'
  readonly docUrl = 'https://open.xiaohongshu.com/document/developer/file/43'

  getOAuthUrl(credentials: PlatformCredentials, redirectUri: string, state: string): string {
    const base = credentials.oauthBaseUrl || 'https://ark.xiaohongshu.com/ark/authorization'
    return `${base}?appId=${encodeURIComponent(credentials.appKey)}&redirectUri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
  }

  private async callArkMethod(
    credentials: PlatformCredentials,
    method: string,
    payload: Record<string, any>,
    includeToken = true,
  ): Promise<any> {
    const endpoint = credentials.gatewayBaseUrl || this.gatewayUrl
    const timestamp = String(Date.now())
    const version = '2.0'
    const signPlain = `${method}?appId=${credentials.appKey}&timestamp=${timestamp}&version=${version}${credentials.appSecret}`
    const sign = md5Hex(signPlain)

    const res = await httpRequestJson<any>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        appId: credentials.appKey,
        version,
        timestamp,
        sign,
        ...(includeToken && credentials.accessToken ? { accessToken: credentials.accessToken } : {}),
        ...payload,
      }),
      timeoutMs: credentials.timeoutMs,
    })

    if (res?.success === false || (res?.error_code && Number(res.error_code) !== 0)) {
      throw new Error(res?.error_msg || res?.msg || `小红书 Ark API 错误 (${res.error_code})`)
    }
    return res?.data ?? res
  }

  async exchangeCodeForToken(credentials: PlatformCredentials, code: string): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName)
    const oauthCredentials = credentials.oauthBaseUrl
      ? { ...credentials, gatewayBaseUrl: credentials.oauthBaseUrl }
      : credentials
    const data = await this.callArkMethod(oauthCredentials, 'oauth.getAccessToken', { code }, false)
    return normalizeTokenBundle(data)
  }

  async refreshAccessToken(credentials: PlatformCredentials): Promise<OAuthTokenBundle> {
    assertOAuthCredentials(credentials, this.platformName, true)
    const oauthCredentials = credentials.oauthBaseUrl
      ? { ...credentials, gatewayBaseUrl: credentials.oauthBaseUrl }
      : credentials
    const data = await this.callArkMethod(oauthCredentials, 'oauth.refreshToken', {
      refreshToken: credentials.refreshToken,
    }, false)
    return normalizeTokenBundle(data, credentials.refreshToken)
  }

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string, secret: string): boolean {
    const sign = HEADER_VALUE(headers, 'x-xhs-signature')
    if (!sign || !secret) return false
    return constantTimeHexEqual(sign, hmacSha256Hex(rawBody, secret))
  }

  async fetchOrders(credentials: PlatformCredentials, options: any): Promise<FetchResult<CanonicalOrderRecord>> {
    const blocked = guardCredentials(credentials, this.platformName)
    if (blocked) return blocked
    try {
      const pageNo = options?.cursor ? Number(options.cursor) : 1
      const data = await this.callArkMethod(credentials, 'order.getOrderList', {
        startTime: options?.sinceTime ? Math.floor(new Date(options.sinceTime).getTime() / 1000) : undefined,
        pageNo,
        pageSize: options?.pageSize || 50,
      })
      const list = data?.orderList || data?.list || []
      const records = normalizeRawOrders(this.platformCode, credentials.shopId, list, true)
      const total = toNumber(data?.total, records.length)
      const hasMore = pageNo * (options?.pageSize || 50) < total && records.length > 0
      return {
        success: true,
        records,
        hasMore,
        nextCursor: hasMore ? String(pageNo + 1) : undefined,
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
      const pageNo = options?.cursor ? Number(options.cursor) : 1
      const data = await this.callArkMethod(credentials, 'afterSale.listAfterSaleInfos', {
        startTime: options?.sinceTime ? Math.floor(new Date(options.sinceTime).getTime() / 1000) : undefined,
        pageNo,
        pageSize: options?.pageSize || 50,
      })
      const list = data?.simpleAfterSaleList || data?.list || []
      return {
        success: true,
        records: normalizeRawRefunds(this.platformCode, credentials.shopId, list, true),
        hasMore: Boolean(data?.hasMore),
        rawResponses: list,
      }
    } catch (err: any) {
      return { success: false, records: [], hasMore: false, error: err?.message || String(err) }
    }
  }
}
