/**
 * test/feature-scope-core.test.ts
 *
 * 验证 WP-00A 与决策点 6：
 * 当 FEATURE_SCOPE=core 时，非核心电商渠道与重型 ERP 路由彻底隔离，返回 404；
 * 核心三前台决策闭环、合规与治理路由正常注册并对外服务。
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { getPool } from '../src/lib/db.js'
import { env } from '../src/config/env.js'

describe('FEATURE_SCOPE=core 运行时范围隔离契约测试', () => {
  let app: FastifyInstance
  let adminCookie: string
  const origScope = process.env.FEATURE_SCOPE

  before(async () => {
    process.env.FEATURE_SCOPE = 'core'
    app = await buildApp({ logger: false })
    await app.ready()

    const pool = getPool()
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 3600_000)
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, 1, $2)`,
      [sessionId, expiresAt],
    )
    adminCookie = `${env.SESSION_COOKIE_NAME}=${sessionId}`
  })

  after(async () => {
    if (origScope !== undefined) {
      process.env.FEATURE_SCOPE = origScope
    } else {
      delete process.env.FEATURE_SCOPE
    }
    await app.close()
  })

  test('非核心重型 ERP（总账/凭证）在 core 模式下返回 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/general-ledger/accounts',
      headers: { cookie: adminCookie },
    })
    assert.equal(res.statusCode, 404, '总账接口在 core 模式下必须 404 隔离')
  })

  test('非核心平台（淘宝专属分析）在 core 模式下返回 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/taobao/overview',
      headers: { cookie: adminCookie },
    })
    assert.equal(res.statusCode, 404, '淘宝专属分析接口在 core 模式下必须 404 隔离')
  })

  test('非核心售后 RMA 接口在 core 模式下返回 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/after-sales/rma',
      headers: { cookie: adminCookie },
    })
    assert.equal(res.statusCode, 404, '售后 RMA 接口在 core 模式下必须 404 隔离')
  })

  test('退役重型创作与编导/视频/工作流在 core 模式下返回 404', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/v1/video/templates',
      headers: { cookie: adminCookie },
    })
    assert.equal(res1.statusCode, 404, '视频制作接口在 core 模式下必须 404 隔离')

    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/director/overview',
      headers: { cookie: adminCookie },
    })
    assert.equal(res2.statusCode, 404, '编导工作台在 core 模式下必须 404 隔离')

    const res3 = await app.inject({
      method: 'GET',
      url: '/api/v1/content/schedules',
      headers: { cookie: adminCookie },
    })
    assert.equal(res3.statusCode, 404, '内容中心接口在 core 模式下必须 404 隔离')
  })

  test('核心三平台（抖音/快手/视频号）在 core 模式下正常注册服务（非 404）', async () => {
    const dyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/douyin/shop/1/metrics',
      headers: { cookie: adminCookie },
    })
    assert.notEqual(dyRes.statusCode, 404, '抖音分析接口在 core 模式下必须保留')

    const ksRes = await app.inject({
      method: 'GET',
      url: '/api/v1/kuaishou/shop/1/traffic-split',
      headers: { cookie: adminCookie },
    })
    assert.notEqual(ksRes.statusCode, 404, '快手分析接口在 core 模式下必须保留')

    const wxRes = await app.inject({
      method: 'GET',
      url: '/api/v1/wechat/private-public',
      headers: { cookie: adminCookie },
    })
    assert.notEqual(wxRes.statusCode, 404, '视频号分析接口在 core 模式下必须保留')
  })

  test('核心决策闭环门禁接口正常注册（非 404）', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/decision-cases/1/gates',
      headers: { cookie: adminCookie },
    })
    assert.notEqual(res.statusCode, 404, '核心决策门禁路由必须正常暴露')
  })

  test('核心受控合规校验接口正常注册（非 404）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compliance/check-script',
      headers: { cookie: adminCookie },
      payload: { scriptText: '正常脚本' },
    })
    assert.notEqual(res.statusCode, 404, '受控合规检查接口必须正常暴露')
  })
})
