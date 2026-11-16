/**
 * platform-adapters.test.ts — 7 大平台开放平台 HTTP/OAuth 传输、加密绑定与同步收敛测试
 *
 * 使用临时本地 node:http 测试服务 (127.0.0.1:0) 验证：
 *  1. Douyin / Kuaishou / Taobao / Tmall / JD / PDD / Xiaohongshu 的真实 HTTP OAuth 与订单/退款拉取及签名
 *  2. manual_only / unauthorized / mock_* 凭证 fail-closed 拦截（0 次 HTTP 请求）
 *  3. platformRegistry 与 governancePlatformRegistry 收敛：规范订单汇总写入 StandardTradeRecord
 *  4. /api/v1/platforms/:code/oauth/url, /oauth/callback, /shops/:shopId/credentials 的 RBAC、AES-256-GCM 加密落库与 runSyncJob 端到端链路
 */

import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import http from 'node:http'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { getPool } from '../src/lib/db.js'
import { runSyncJob } from '../src/ingest/sync-job.js'
import {
  governancePlatformRegistry,
  type PlatformCredentials,
} from '../src/modules/data-governance/adapters/index.js'
import { decryptCredential } from '../src/modules/data-governance/security.js'
import { platformRegistry } from '../src/platform/index.js'

interface TempUser {
  userId: number
  cookie: string
}

async function createTempUser(role: string): Promise<TempUser> {
  const pool = getPool()
  const username = `__t_plat_${role}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (username, password_hash, real_name, role, user_type, tenant_id, status)
     VALUES ($1, '$2a$10$InvalidTestHashOnlyForSessionTests000000000000000000', $2, $3, 'agency_staff', 1, 1)
     RETURNING id`,
    [username, `Temp ${role}`, role],
  )
  const userId = Number(rows[0].id)
  const sessionId = crypto.randomUUID()
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, new Date(Date.now() + 3600_000)],
  )
  return { userId, cookie: `${env.SESSION_COOKIE_NAME}=${sessionId}` }
}

describe('开放平台 HTTP/OAuth 传输与适配器收敛测试', () => {
  let mockServer: http.Server
  let baseUrl = ''
  let requestLog: Array<{ url: string; method?: string; body: string }> = []
  let failNextRequest = false

  let app: FastifyInstance
  let adminUser: TempUser
  let operatorUser: TempUser
  let tempShopId = 0

  before(async () => {
    mockServer = http.createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c)
      const body = Buffer.concat(chunks).toString('utf8')
      const url = req.url || '/'
      requestLog.push({ url, method: req.method, body })

      if (failNextRequest) {
        failNextRequest = false
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ err_no: 40001, message: 'simulated bad request' }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })

      // 抖音
      if (url.startsWith('/token/create') || url.startsWith('/token/refresh')) {
        res.end(JSON.stringify({
          err_no: 0,
          data: { access_token: 'real_dy_access_token_xyz', refresh_token: 'real_dy_refresh_xyz', expires_in: 7200 },
        }))
        return
      }
      if (url.startsWith('/order/searchList')) {
        res.end(JSON.stringify({
          err_no: 0,
          data: {
            total: 2,
            page: 0,
            shop_order_list: [
              {
                order_id: 'DY-ORD-1001',
                order_status_desc: 'paid',
                pay_amount: 19900,
                promotion_amount: 1000,
                post_amount: 0,
                buyer_id: 'buyer_dy_1',
                create_time: '2026-11-11 10:00:00',
                sku_order_list: [{ sub_order_id: 'DY-SUB-1', product_name: '真丝连衣裙', item_num: 1, pay_amount: 19900 }],
              },
              {
                order_id: 'DY-ORD-1002',
                order_status_desc: 'paid',
                pay_amount: 29900,
                promotion_amount: 2000,
                post_amount: 0,
                buyer_id: 'buyer_dy_2',
                create_time: '2026-11-11 11:00:00',
                sku_order_list: [{ sub_order_id: 'DY-SUB-2', product_name: '羊绒大衣', item_num: 1, pay_amount: 29900 }],
              },
            ],
          },
        }))
        return
      }
      if (url.startsWith('/afterSale/List')) {
        res.end(JSON.stringify({
          err_no: 0,
          data: {
            has_more: false,
            items: [
              { aftersale_id: 'DY-RF-9001', order_id: 'DY-ORD-1001', aftersale_type: '0', refund_amount: 19900, aftersale_status: 'success', apply_time: '2026-11-11 15:00:00' },
            ],
          },
        }))
        return
      }

      // 快手
      if (url.startsWith('/oauth2/access_token') && req.method === 'POST') {
        res.end(JSON.stringify({ result: 1, access_token: 'real_ks_tok', refresh_token: 'real_ks_ref', expires_in: 3600 }))
        return
      }
      if (url.startsWith('/open/seller/order/pcursor/list')) {
        res.end(JSON.stringify({
          result: 1,
          data: {
            hasMore: false,
            pcursor: 'nomore',
            orderInfoList: [{ order_id: 'KS-ORD-1', pay_amount: 15000, create_time: '2026-11-11 09:00:00' }],
          },
        }))
        return
      }

      // 淘宝/天猫
      if (url === '/token') {
        res.end(JSON.stringify({ access_token: 'real_tb_tok', refresh_token: 'real_tb_ref', expires_in: 86400 }))
        return
      }
      if (url === '/top' && body.includes('taobao.trades.sold.get')) {
        res.end(JSON.stringify({
          trades_sold_get_response: {
            has_next: false,
            trades: { trade: [{ tid: 'TB-ORD-1', status: 'WAIT_SELLER_SEND_GOODS', payment: '320.50', created: '2026-11-11 12:00:00' }] },
          },
        }))
        return
      }

      // 小红书 Ark
      if (url === '/xhs') {
        const parsed = JSON.parse(body || '{}')
        if (parsed.method === 'oauth.getAccessToken') {
          res.end(JSON.stringify({ success: true, data: { accessToken: 'real_xhs_tok', refreshToken: 'real_xhs_ref', expiresIn: 7200 } }))
          return
        }
        res.end(JSON.stringify({
          success: true,
          data: {
            total: 1,
            orderList: [{ orderId: 'XHS-ORD-1', payAmount: 25800, createdAtSource: '2026-11-11 16:00:00' }],
          },
        }))
        return
      }

      res.end(JSON.stringify({ ok: true }))
    })

    await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', () => resolve()))
    const addr = mockServer.address() as { port: number }
    baseUrl = `http://127.0.0.1:${addr.port}`

    app = await buildApp({ logger: false })
    await app.ready()
    adminUser = await createTempUser('admin')
    operatorUser = await createTempUser('operator')

    const pool = getPool()
    const shopRes = await pool.query<{ id: number }>(
      `INSERT INTO dim_shop (platform_code, shop_name, external_shop_id, status, auth_status, tenant_id)
       VALUES ('douyin', '__test_oauth_shop', 'ext_test_001', 'active', 'manual_only', 1)
       RETURNING id`,
    )
    tempShopId = Number(shopRes.rows[0].id)
  })

  after(async () => {
    const pool = getPool()
    if (tempShopId > 0) {
      await pool.query(`DELETE FROM fact_trade_daily WHERE shop_id = $1`, [tempShopId])
      await pool.query(`DELETE FROM ingest_sync_jobs WHERE shop_id = $1`, [tempShopId])
      await pool.query(`DELETE FROM audit_logs WHERE resource_id = $1`, [String(tempShopId)])
      await pool.query(`DELETE FROM dim_shop WHERE id = $1`, [tempShopId])
    }
    const uids = [adminUser?.userId, operatorUser?.userId].filter(Boolean) as number[]
    if (uids.length > 0) {
      await pool.query(`DELETE FROM audit_logs WHERE actor_user_id = ANY($1::int[])`, [uids])
      await pool.query(`DELETE FROM user_sessions WHERE user_id = ANY($1::int[])`, [uids])
      await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [uids])
    }
    await app.close()
    await new Promise<void>((resolve) => mockServer.close(() => resolve()))
  })

  test('fail-closed：manual_only 或 mock_* 凭证严格拦截且不发出任何 HTTP 请求', async () => {
    requestLog = []
    for (const code of ['douyin', 'kuaishou', 'wechat', 'taobao', 'tmall', 'xiaohongshu']) {
      const adapter = governancePlatformRegistry.get(code)!
      const manualCreds: PlatformCredentials = {
        appKey: 'real_app_key',
        appSecret: 'real_secret',
        accessToken: 'real_token',
        shopId: 1,
        platformCode: code,
        authStatus: 'manual_only',
        gatewayBaseUrl: baseUrl,
      }
      const r1 = await adapter.fetchOrders(manualCreds, {})
      assert.equal(r1.success, true)
      assert.equal(r1.records.length, 0)

      const mockCreds: PlatformCredentials = {
        ...manualCreds,
        authStatus: 'authorized',
        accessToken: 'mock_token_123',
      }
      const r2 = await adapter.fetchRefunds(mockCreds, {})
      assert.equal(r2.success, true)
      assert.equal(r2.records.length, 0)

      const legacyAdapter = platformRegistry.get(code)!
      const emptyTrade = await legacyAdapter.fetchTradeData!(1, '2026-11-01')
      assert.deepEqual(emptyTrade, [])
    }
    assert.equal(requestLog.length, 0, '未授权/占位凭证绝不能触发外网 HTTP 请求')
  })

  test('真实 HTTP OAuth 换码、刷新与多平台订单/退款拉取及上游错误透传', async () => {
    requestLog = []
    const dy = governancePlatformRegistry.get('douyin')!
    const dyToken = await dy.exchangeCodeForToken(
      { appKey: 'dy_k', appSecret: 'dy_s', shopId: 1, platformCode: 'douyin', oauthBaseUrl: baseUrl, gatewayBaseUrl: baseUrl },
      'auth_code_123',
    )
    assert.equal(dyToken.accessToken, 'real_dy_access_token_xyz')
    assert.equal(dyToken.refreshToken, 'real_dy_refresh_xyz')

    const dyRefreshed = await dy.refreshAccessToken({
      appKey: 'dy_k',
      appSecret: 'dy_s',
      refreshToken: dyToken.refreshToken,
      shopId: 1,
      platformCode: 'douyin',
      oauthBaseUrl: baseUrl,
      gatewayBaseUrl: baseUrl,
    })
    assert.equal(dyRefreshed.accessToken, 'real_dy_access_token_xyz')

    const dyCreds: PlatformCredentials = {
      appKey: 'dy_k',
      appSecret: 'dy_s',
      accessToken: dyToken.accessToken,
      shopId: 99,
      platformCode: 'douyin',
      authStatus: 'authorized',
      gatewayBaseUrl: baseUrl,
    }
    const ordersRes = await dy.fetchOrders(dyCreds, { sinceTime: '2026-11-10T00:00:00Z' })
    assert.equal(ordersRes.success, true)
    assert.equal(ordersRes.records.length, 2)
    assert.equal(ordersRes.records[0].sourceOrderId, 'DY-ORD-1001')
    assert.equal(ordersRes.records[0].paidAmount, 199)
    assert.equal(ordersRes.records[0].items[0].productName, '真丝连衣裙')

    const refundsRes = await dy.fetchRefunds(dyCreds, {})
    assert.equal(refundsRes.success, true)
    assert.equal(refundsRes.records.length, 1)
    assert.equal(refundsRes.records[0].refundAmount, 199)
    assert.equal(refundsRes.records[0].refundType, 'return_and_refund')

    // 校验上游 400 错误如实返回 success=false（不伪造记录）
    failNextRequest = true
    const errRes = await dy.fetchOrders(dyCreds, {})
    assert.equal(errRes.success, false)
    assert.ok(errRes.error?.includes('400'))

    // 校验 platformRegistry 收敛：抖音订单聚合为 StandardTradeRecord
    const legacyDy = platformRegistry.get('douyin')!
    const tradeRows = await legacyDy.fetchTradeData!(99, '2026-11-10', dyCreds)
    assert.equal(tradeRows.length, 1)
    assert.equal(tradeRows[0].payAmount, 498)
    assert.equal(tradeRows[0].paidOrderCount, 2)
    assert.equal(tradeRows[0].paidBuyerCount, 2)

    // 校验淘宝 / 快手 / 京东 / 拼多多 / 小红书 HTTP 网关调用
    const tb = governancePlatformRegistry.get('taobao')!
    const tbOrders = await tb.fetchOrders({
      appKey: 'tb_k', appSecret: 'tb_s', accessToken: 'real_tb_tok', shopId: 2, platformCode: 'taobao',
      authStatus: 'authorized', gatewayBaseUrl: `${baseUrl}/top`, oauthBaseUrl: baseUrl,
    }, {})
    assert.equal(tbOrders.records[0].sourceOrderId, 'TB-ORD-1')
    assert.equal(tbOrders.records[0].paidAmount, 320.5)

    const ks = governancePlatformRegistry.get('kuaishou')!
    const ksOrders = await ks.fetchOrders({
      appKey: 'ks_k', appSecret: 'ks_s', accessToken: 'real_ks_tok', shopId: 3, platformCode: 'kuaishou',
      authStatus: 'authorized', gatewayBaseUrl: `${baseUrl}/open`, oauthBaseUrl: `${baseUrl}/oauth2`,
    }, {})
    assert.equal(ksOrders.records[0].sourceOrderId, 'KS-ORD-1')

    const xhs = governancePlatformRegistry.get('xiaohongshu')!
    const xhsToken = await xhs.exchangeCodeForToken({
      appKey: 'xhs_k', appSecret: 'xhs_s', shopId: 6, platformCode: 'xiaohongshu', oauthBaseUrl: `${baseUrl}/xhs`, gatewayBaseUrl: `${baseUrl}/xhs`,
    }, 'xhs_code')
    assert.equal(xhsToken.accessToken, 'real_xhs_tok')
    const xhsOrders = await xhs.fetchOrders({
      appKey: 'xhs_k', appSecret: 'xhs_s', accessToken: xhsToken.accessToken, shopId: 6, platformCode: 'xiaohongshu',
      authStatus: 'authorized', gatewayBaseUrl: `${baseUrl}/xhs`,
    }, {})
    assert.equal(xhsOrders.records[0].sourceOrderId, 'XHS-ORD-1')
  })

  test('HTTP 路由 RBAC、AES-256-GCM 凭证加密绑定、OAuth 回调与 runSyncJob 端到端', async () => {
    // 1. 非管理员 operator 被拦截
    const forbidUrl = await app.inject({
      method: 'GET',
      url: `/api/v1/platforms/douyin/oauth/url?shopId=${tempShopId}&appKey=dy_k`,
      headers: { cookie: operatorUser.cookie },
    })
    assert.equal(forbidUrl.statusCode, 403)

    // 2. 管理员绑定 mock_ 占位 token 被 fail-closed 拦截 (400)
    const rejectMock = await app.inject({
      method: 'POST',
      url: `/api/v1/platforms/douyin/shops/${tempShopId}/credentials`,
      headers: { cookie: adminUser.cookie },
      payload: {
        appKey: 'dy_prod_key',
        appSecret: 'dy_prod_secret',
        accessToken: 'mock_placeholder',
        authStatus: 'authorized',
      },
    })
    assert.equal(rejectMock.statusCode, 400)

    // 3. 管理员执行 OAuth callback：HTTP 换取 Token 并 AES-256-GCM 加密写入 dim_shop
    const cbRes = await app.inject({
      method: 'POST',
      url: '/api/v1/platforms/douyin/oauth/callback',
      headers: { cookie: adminUser.cookie },
      payload: {
        shopId: tempShopId,
        code: 'oauth_code_live_001',
        appKey: 'dy_prod_key_9999',
        appSecret: 'dy_prod_secret_8888',
        oauthBaseUrl: baseUrl,
        gatewayBaseUrl: baseUrl,
      },
    })
    assert.equal(cbRes.statusCode, 200)
    const cbData = cbRes.json().data
    assert.equal(cbData.authStatus, 'authorized')
    assert.ok(cbData.accessTokenMasked.includes('***'))
    assert.ok(!cbData.accessTokenMasked.includes('real_dy_access_token_xyz'))

    // 验证数据库中确为 AES-256-GCM 密文且可解密还原
    const pool = getPool()
    const dbShop = await pool.query<{ auth_status: string; auth_token_info: any }>(
      `SELECT auth_status, auth_token_info FROM dim_shop WHERE id = $1`,
      [tempShopId],
    )
    assert.equal(dbShop.rows[0].auth_status, 'authorized')
    const rawStoredToken = String(dbShop.rows[0].auth_token_info.accessToken)
    assert.equal(rawStoredToken.split(':').length, 3, 'accessToken 应以 iv:tag:enc 密文形式存储')
    assert.equal(decryptCredential(rawStoredToken), 'real_dy_access_token_xyz')

    // 4. GET /api/v1/platforms 返回脱敏凭证状态（绝不泄漏明文密钥），并可生成 OAuth 授权跳转 URL
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/platforms',
      headers: { cookie: adminUser.cookie },
    })
    assert.equal(listRes.statusCode, 200)
    assert.ok(!listRes.body.includes('dy_prod_secret_8888'))
    assert.ok(!listRes.body.includes('real_dy_access_token_xyz'))
    const dyPlat = listRes.json().data.find((p: any) => p.platform_code === 'douyin')
    const boundShop = dyPlat.shops.find((s: any) => s.id === tempShopId)
    assert.equal(boundShop.hasCredentials, true)
    assert.ok(boundShop.appKeyMasked.includes('****'))

    const urlRes = await app.inject({
      method: 'GET',
      url: `/api/v1/platforms/douyin/oauth/url?shopId=${tempShopId}`,
      headers: { cookie: adminUser.cookie },
    })
    assert.equal(urlRes.statusCode, 200)
    assert.ok(urlRes.json().data.authorizeUrl.includes('service_id=dy_prod_key_9999'))

    // 5. runSyncJob 解密持久化凭证并通过统一 OpenAPI 客户端拉取写入 fact_trade_daily
    const syncRes = await runSyncJob(pool, 'douyin', tempShopId, 'trade', '2026-11-10')
    assert.equal(syncRes.status, 'completed')
    assert.equal(syncRes.fetchedRows, 1)
    assert.equal(syncRes.insertedRows, 1)

    const factRows = await pool.query<{ pay_amount: string; paid_order_count: number }>(
      `SELECT pay_amount, paid_order_count FROM fact_trade_daily WHERE shop_id = $1 AND biz_date = '2026-11-11'`,
      [tempShopId],
    )
    assert.equal(Number(factRows.rows[0].pay_amount), 498)
    assert.equal(Number(factRows.rows[0].paid_order_count), 2)
  })
})

