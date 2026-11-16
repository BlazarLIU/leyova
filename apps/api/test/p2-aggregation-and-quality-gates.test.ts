/**
 * test/p2-aggregation-and-quality-gates.test.ts
 *
 * 验证 Master Plan P2 阶段：
 * 1. 核心汇总层 agg_*（agg_trade_day_platform_channel、agg_traffic_day_live、PG Advisory Lock 防并发）
 * 2. 七段清洗管道与 8 条 SQL 质量门禁（stg_order_import 暂存、land_raw_dedup 去重哨兵、dq_quarantine 隔离区与 8 门禁秒级断言）
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { getPool } from '../src/lib/db.js'
import { buildApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { runFactAggregation, runManualAggregate } from '../src/cron/aggregate-facts.ts'

describe('P2 阶段：核心汇总层 agg_* + 七段清洗管道与 8 门禁', () => {
  let app: FastifyInstance
  let adminSessionId: string
  let adminCookie: string
  let testBatchId: number
  let testShopId: number

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    const pool = getPool()
    adminSessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 3600_000)
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, 1, $2)`,
      [adminSessionId, expiresAt],
    )
    adminCookie = `${env.SESSION_COOKIE_NAME}=${adminSessionId}`

    const shopRes = await pool.query(`SELECT id FROM dim_shop LIMIT 1`)
    testShopId = Number(shopRes.rows[0]?.id || 1)

    // 创建测试导入批次
    const batchNo = `TEST_BATCH_${Date.now().toString().slice(-6)}`
    const batchRes = await pool.query(
      `INSERT INTO import_batches (
         batch_no, source_platform, store_id, dataset_type, source_channel, status, total_raw_rows
       ) VALUES ($1, 'douyin', $2, 'orders', 'manual_file', 'VALIDATING', 0)
       RETURNING id`,
      [batchNo, testShopId],
    )
    testBatchId = Number(batchRes.rows[0].id)
  })

  after(async () => {
    const pool = getPool()
    if (adminSessionId) {
      await pool.query(`DELETE FROM user_sessions WHERE id = $1`, [adminSessionId])
    }
    if (testBatchId) {
      await pool.query(`DELETE FROM import_batches WHERE id = $1`, [testBatchId])
    }
    await app.close()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 1. 核心汇总层 agg_* 与 PG Advisory Lock
  // ──────────────────────────────────────────────────────────────────────────

  test('agg_trade_day_platform_channel 与 agg_traffic_day_live 汇总表已建立并有回填数据', async () => {
    const pool = getPool()
    const cRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM agg_trade_day_platform_channel`)
    assert.ok(cRes.rows[0].cnt > 0, '平台/渠道汇总表应包含已回填数据')

    const lRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM agg_traffic_day_live`)
    assert.ok(lRes.rows[0].cnt > 0, '直播间流量汇总表应包含已回填数据')
  })

  test('runManualAggregate 增量聚合单日，同步更新 3 张汇总表', async () => {
    const pool = getPool()
    // 获取事实表中最近的有效日期
    const dateRes = await pool.query(`SELECT biz_date::text AS d FROM fact_trade_daily ORDER BY biz_date DESC LIMIT 1`)
    const targetDate = dateRes.rows[0]?.d || '2026-10-15'

    const res = await runManualAggregate({ date: targetDate })
    assert.equal(res.mode, 'single-day')
    assert.equal(res.day.date, targetDate)

    // 验证平台渠道汇总表已更新
    const rowRes = await pool.query(
      `SELECT total_gmv, overall_roi FROM agg_trade_day_platform_channel WHERE biz_date = $1::date LIMIT 1`,
      [targetDate],
    )
    assert.ok(rowRes.rows.length > 0, '应存在该日的渠道汇总数据')
  })

  test('PG Advisory Lock 并发互斥：锁被持有时防重复运行', async () => {
    const pool = getPool()
    // 独立连接持久持有该会话级 advisory lock
    const holderClient = await pool.connect()
    try {
      const lockRes = await holderClient.query<{ acquired: boolean }>(
        `SELECT pg_try_advisory_lock(hashtext('job:agg_daily')) AS acquired`,
      )
      assert.equal(lockRes.rows[0].acquired, true)

      // 此时由连接池其他连接执行 runManualAggregate 应该被阻断抛错
      await assert.rejects(
        async () => {
          await runManualAggregate({ date: '2026-10-15' })
        },
        /汇总任务正由后台或其他 Worker 执行中/,
      )
    } finally {
      // 释放锁并归还连接
      await holderClient.query(`SELECT pg_advisory_unlock(hashtext('job:agg_daily'))`)
      holderClient.release()
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 2. 七段清洗管道与 8 条 SQL 质量门禁
  // ──────────────────────────────────────────────────────────────────────────

  test('POST /api/v1/governance/batches/:id/staging-load 批量暂存订单行并校验哨兵去重', async () => {
    const order1 = `ORD-P2-${Date.now()}-01`
    const order2 = `ORD-P2-${Date.now()}-02`

    // 第一次导入 2 行
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/batches/${testBatchId}/staging-load`,
      headers: { cookie: adminCookie },
      payload: {
        rows: [
          {
            sourceOrderId: order1,
            sourceSubOrderId: 'SUB-1',
            orderStatus: 'PAID',
            paidAmount: 199.00,
            orderDate: '2026-11-16',
            rawJson: { orderId: order1, subId: 'SUB-1', amount: 199.00 },
          },
          {
            sourceOrderId: order2,
            sourceSubOrderId: 'SUB-2',
            orderStatus: 'PAID',
            paidAmount: 299.00,
            orderDate: '2026-11-16',
            rawJson: { orderId: order2, subId: 'SUB-2', amount: 299.00 },
          },
        ],
      },
    })

    assert.equal(res1.statusCode, 200)
    const json1 = res1.json()
    assert.equal(json1.success, true)
    assert.equal(json1.data.loadedCount, 2)
    assert.equal(json1.data.uniqueCount, 2)
    assert.equal(json1.data.duplicateCount, 0)

    // 第二次传入包含相同行内容的数据，验证哨兵去重并自动进隔离区
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/batches/${testBatchId}/staging-load`,
      headers: { cookie: adminCookie },
      payload: {
        rows: [
          {
            sourceOrderId: order1,
            sourceSubOrderId: 'SUB-1',
            orderStatus: 'PAID',
            paidAmount: 199.00,
            orderDate: '2026-11-16',
            rawJson: { orderId: order1, subId: 'SUB-1', amount: 199.00 },
          },
        ],
      },
    })

    assert.equal(res2.statusCode, 200)
    const json2 = res2.json()
    assert.equal(json2.data.duplicateCount, 1, '重复行应被哨兵拦截')
  })

  test('GET & PUT /api/v1/governance/batches/:id/quarantine 隔离区查看与处置', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/batches/${testBatchId}/quarantine`,
      headers: { cookie: adminCookie },
    })

    assert.equal(listRes.statusCode, 200)
    const listJson = listRes.json()
    assert.equal(listJson.success, true)
    assert.ok(listJson.data.total >= 1)
    const qItem = listJson.data.items[0]
    assert.equal(qItem.status, 'quarantined')

    // 处置隔离区行
    const updRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/governance/quarantine/${qItem.id}/status`,
      headers: { cookie: adminCookie },
      payload: { status: 'resolved', remark: '已核实去重逻辑正确' },
    })

    assert.equal(updRes.statusCode, 200)
    const updJson = updRes.json()
    assert.equal(updJson.data.status, 'resolved')
  })

  test('POST /api/v1/governance/batches/:id/run-quality-gates 运行 8 条 SQL 质量门禁评估', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/batches/${testBatchId}/run-quality-gates`,
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    const report = json.data
    assert.equal(report.batchId, testBatchId)
    assert.equal(report.totalRulesChecked, 8, '必须完整执行 8 条 SQL 门禁断言')

    const ruleCodes = report.results.map((r: any) => r.ruleCode)
    assert.ok(ruleCodes.includes('RULE_LINE_COUNT_CONSERVED'))
    assert.ok(ruleCodes.includes('RULE_AMOUNT_CONSERVED'))
    assert.ok(ruleCodes.includes('RULE_BATCH_KEY_UNIQUE'))
    assert.ok(ruleCodes.includes('RULE_ENUM_LEGAL'))
    assert.ok(ruleCodes.includes('RULE_TIME_CONTINUOUS'))
    assert.ok(ruleCodes.includes('RULE_CROSS_TABLE_RECONCILE'))
    assert.ok(ruleCodes.includes('RULE_PLATFORM_RECONCILE'))
    assert.ok(ruleCodes.includes('RULE_FRESHNESS_SLA'))
  })
})
