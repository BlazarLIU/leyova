import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import * as XLSX from 'xlsx'
import { getPool, closePool } from '../src/lib/db.js'
import { env } from '../src/config/env.js'
import { IngestionService } from '../src/modules/data-governance/ingestion/ingestion-service.js'
import { buildApp } from '../src/app.js'

after(async () => {
  await closePool()
})

test('管道统一: IngestionService.ingestFromFile 联动 UnifiedDataPipelineService 暂存与 8 门禁评估', async () => {
  const pool = getPool()
  const ingestion = new IngestionService(pool)
  const ts = Date.now()
  const orderId = `CONV_TEST_${ts}`

  const testData = [
    { 平台订单号: orderId, 实付款: '￥299.00', 商品编码: 'SKU-001', 订单状态: '已付款', 日期: '2026-11-20' },
  ]

  const ws = XLSX.utils.json_to_sheet(testData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '订单明细')
  const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `pipeline_conv_test_${ts}.xlsx`

  let batchId: number | null = null
  try {
    const res = await ingestion.ingestFromFile({
      platformCode: 'douyin',
      shopId: 1,
      fileBuffer,
      originalFilename: filename,
    })

    assert.equal(res.success, true)
    assert.ok(res.batchId)
    batchId = res.batchId!

    // 验证返回了 pipelineResult 与 qualityGates
    assert.ok(res.pipelineResult, '返回结果应包含统一管道暂存结果 pipelineResult')
    assert.equal(res.pipelineResult.stagedCount, 1)
    assert.ok(res.qualityGates, '返回结果应包含 8 门禁评估结果 qualityGates')
    assert.ok(Array.isArray(res.qualityGates.gates))

    // 验证 stg_order_import 与 land_raw_dedup 中真实存在该批次数据
    const client = await pool.connect()
    try {
      const stgRes = await client.query(
        `SELECT source_order_id, paid_amount FROM public.stg_order_import WHERE batch_id = $1`,
        [batchId],
      )
      assert.equal(stgRes.rows.length, 1)
      assert.equal(stgRes.rows[0].source_order_id, orderId)
      assert.equal(Number(stgRes.rows[0].paid_amount), 299)

      const dedupRes = await client.query(
        `SELECT source_platform FROM public.land_raw_dedup WHERE batch_id = $1`,
        [batchId],
      )
      assert.equal(dedupRes.rows.length, 1)
      assert.equal(dedupRes.rows[0].source_platform, 'douyin')
    } finally {
      client.release()
    }
  } finally {
    if (batchId) {
      await pool.query(`DELETE FROM clean_records WHERE batch_id = $1`, [batchId])
      await pool.query(`DELETE FROM raw_records WHERE batch_id = $1`, [batchId])
      await pool.query(`DELETE FROM dq_quarantine WHERE batch_id = $1`, [batchId])
      await pool.query(`DELETE FROM stg_order_import WHERE batch_id = $1`, [batchId])
      await pool.query(`DELETE FROM land_raw_dedup WHERE batch_id = $1`, [batchId])
      await pool.query(`DELETE FROM import_batches WHERE id = $1`, [batchId])
    }
  }
})

test('AI 统一: POST /api/v1/ai/chat 经由 Assistant Run Engine 统一执行并生成运行与断言记录', async () => {
  const app = await buildApp({ logger: false })
  await app.ready()

  const pool = getPool()
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 3600_000)
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, 1, $2)`,
    [sessionId, expiresAt],
  )
  const adminCookie = `${env.SESSION_COOKIE_NAME}=${sessionId}`

  // 调用 /api/v1/ai/chat
  const chatRes = await app.inject({
    method: 'POST',
    url: '/api/v1/ai/chat',
    headers: { cookie: adminCookie },
    payload: {
      message: '本月 GMV 是多少？',
    },
  })

  assert.equal(chatRes.statusCode, 200)
  const body = JSON.parse(chatRes.payload)
  assert.equal(body.success, true)
  assert.ok(body.data.reply)
  assert.ok(body.data.conversationId)
  assert.equal(body.data.provider, 'agentic-run-engine')

  // 验证底层的 ai_v2_run 中确实记录了该 Run
  const convId = body.data.conversationId
  const runRes = await pool.query(
    `SELECT id, status, question FROM public.ai_v2_run WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1`,
    [convId],
  )
  assert.equal(runRes.rows.length, 1)
  assert.equal(runRes.rows[0].status, 'succeeded')

  await pool.query(`DELETE FROM user_sessions WHERE id = $1`, [sessionId])
  await app.close()
})
