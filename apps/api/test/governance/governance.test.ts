/**
 * governance.test.ts — 数据治理与清洗校验引擎全套端到端自动化测试
 * 
 * 涵盖：
 * 1. 安全加密、脱敏与防 CSV 注入测试
 * 2. 财务级余额归底分摊测试 (防一分钱偏差)
 * 3. 7 大平台 API 规范与签名适配测试
 * 4. 字段标准化 Normalizer 与 Golden Dataset 测试 (附录 A 案例)
 * 5. 独立质量校验引擎 P0/P1/P2 严重性与阻断闸门测试
 * 6. 多层对账测试
 * 7. 人工审核工作台与修复测试
 * 8. 原子发布闸门与反向冲正测试
 */

import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  encryptCredential,
  decryptCredential,
  maskCredential,
  sanitizeCsvCell,
  computeSha256,
} from '../../src/modules/data-governance/security.js'
import { allocateDiscountWithRemainder } from '../../src/modules/data-governance/allocation.js'
import {
  governancePlatformRegistry,
  topSignMd5,
  hmacSha256Hex,
} from '../../src/modules/data-governance/adapters/index.js'
import {
  normalizeDateTimeString,
  normalizeCurrencyAmount,
  mapCanonicalOrderStatus,
} from '../../src/modules/data-governance/cleaning/cleaner-service.js'
import { closePool, getPool } from '../../src/lib/db.js'
import { IngestionService } from '../../src/modules/data-governance/ingestion/ingestion-service.js'
import { ReviewService } from '../../src/modules/data-governance/review/review-service.js'
import { ReconciliationService } from '../../src/modules/data-governance/reconciliation/reconciliation-service.js'
import { PublishingService } from '../../src/modules/data-governance/publishing/publishing-service.js'
import { ValidationService } from '../../src/modules/data-governance/validation/validation-service.js'
import * as XLSX from 'xlsx'

after(async () => {
  await closePool()
})

// ═══════════════════════════════════════════════════════════════
// 1. 安全机制与防 CSV 注入测试
// ═══════════════════════════════════════════════════════════════
test('安全机制: AES-256-GCM 凭证加密与解密闭环', () => {
  const secret = 'app_secret_dy_88726315481_super_secure'
  const encrypted = encryptCredential(secret)
  assert.notEqual(encrypted, secret)
  assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)

  const decrypted = decryptCredential(encrypted)
  assert.equal(decrypted, secret)
})

test('安全机制: 凭证掩码脱敏', () => {
  assert.equal(maskCredential('1234567890abcdef'), '1234****cdef')
  assert.equal(maskCredential('short'), '****')
  assert.equal(maskCredential(null), '')
})

test('安全机制: CSV 与导出公式注入安全转义', () => {
  assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)")
  assert.equal(sanitizeCsvCell('+cmd|/c calc'), "'+cmd|/c calc")
  assert.equal(sanitizeCsvCell('-cmd|/c calc'), "'-cmd|/c calc")
  assert.equal(sanitizeCsvCell('@malicious'), "'@malicious")
  assert.equal(sanitizeCsvCell('-100'), '-100') // 合法负数不应被转义
  assert.equal(sanitizeCsvCell(1234.5), '1234.5')
})

test('安全机制: SHA-256 哈希计算', () => {
  const hash1 = computeSha256('test_order_content')
  const hash2 = computeSha256('test_order_content')
  const hash3 = computeSha256('other_content')
  assert.equal(hash1, hash2)
  assert.notEqual(hash1, hash3)
})

// ═══════════════════════════════════════════════════════════════
// 2. 财务级余额归底分摊测试 (防一分钱偏差)
// ═══════════════════════════════════════════════════════════════
test('财务分摊: 100元满减优惠平摊在3件商品，明细之和严格等于100.00', () => {
  const items = [{ id: '1', amount: 100 }, { id: '2', amount: 100 }, { id: '3', amount: 100 }]
  const res = allocateDiscountWithRemainder(100, items)

  assert.equal(res.length, 3)
  const sumDiscount = Math.round(res.reduce((s, it) => s + it.allocatedDiscount, 0) * 100) / 100
  assert.equal(sumDiscount, 100.0)

  // 验证具体分摊：前两项各 33.33，最后一项自动归底为 33.34
  assert.equal(res[0].allocatedDiscount, 33.33)
  assert.equal(res[1].allocatedDiscount, 33.33)
  assert.equal(res[2].allocatedDiscount, 33.34)
})

test('财务分摊: 50元优惠分摊在不同金额商品上，明细之和严格等于50.00', () => {
  const items = [{ id: 'a', amount: 199 }, { id: 'b', amount: 99 }, { id: 'c', amount: 49 }]
  const res = allocateDiscountWithRemainder(50, items)

  const sumDiscount = Math.round(res.reduce((s, it) => s + it.allocatedDiscount, 0) * 100) / 100
  assert.equal(sumDiscount, 50.0)
})

test('财务分摊: 0元优惠分摊，全部分摊为0', () => {
  const items = [{ id: '1', amount: 100 }]
  const res = allocateDiscountWithRemainder(0, items)
  assert.equal(res[0].allocatedDiscount, 0)
  assert.equal(res[0].netAmount, 100)
})

// ═══════════════════════════════════════════════════════════════
// 3. 7 大主流电商平台 API 技术规范与签名测试
// ═══════════════════════════════════════════════════════════════
test('7大平台规范: 平台注册中心包含全部 7 个平台且网关规范正确', () => {
  const codes = ['douyin', 'kuaishou', 'taobao', 'tmall', 'jd', 'pdd', 'xiaohongshu']
  for (const c of codes) {
    const adapter = governancePlatformRegistry.get(c)
    assert.ok(adapter, `平台未注册: ${c}`)
    assert.ok(adapter.gatewayUrl.startsWith('https://'), `网关地址异常: ${adapter.gatewayUrl}`)
    assert.ok(adapter.docUrl.startsWith('https://'), `文档地址异常: ${adapter.docUrl}`)
  }
})

test('7大平台规范: 淘系 TOP 协议 MD5 签名算法一致性', () => {
  const params = { app_key: '12345', method: 'taobao.trade.get', timestamp: '2026-11-10 20:00:00', v: '2.0' }
  const sign = topSignMd5(params, 'secret123')
  assert.ok(typeof sign === 'string')
  assert.equal(sign.length, 32)
})

test('7大平台规范: 抖音 HMAC-SHA256 Webhook 验签逻辑', () => {
  const dy = governancePlatformRegistry.get('douyin')!
  const secret = 'my_dy_secret'
  const body = JSON.stringify({ event: 'order.paid', order_id: '123456' })
  const sig = hmacSha256Hex(body, secret)

  assert.equal(dy.verifyWebhookSignature({ 'event-sign': sig }, body, secret), true)
  assert.equal(dy.verifyWebhookSignature({ 'event-sign': 'wrong_sig' }, body, secret), false)
})

// ═══════════════════════════════════════════════════════════════
// 4. 清洗字段标准化 Normalizer 测试
// ═══════════════════════════════════════════════════════════════
test('清洗标准化: 日期时间格式解析与时区归一', () => {
  assert.equal(normalizeDateTimeString('2026/11/10 20:15:10'), '2026-11-10T20:15:10.000Z')
  assert.equal(normalizeDateTimeString('2026年11月10日 20:15:10'), '2026-11-10T20:15:10.000Z')
  assert.ok(normalizeDateTimeString('46336.84')?.startsWith('2026-'))
  assert.equal(normalizeDateTimeString(''), null)
  assert.equal(normalizeDateTimeString(null), null)
})

test('清洗标准化: 货币金额单位转换与空值不补0原则', () => {
  // 正常金额与符号
  assert.deepEqual(normalizeCurrencyAmount('￥399.00'), { amount: 399.0, unit: 'CNY' })
  assert.deepEqual(normalizeCurrencyAmount('1,200.50元'), { amount: 1200.5, unit: 'CNY' })

  // “万” 单位识别
  assert.deepEqual(normalizeCurrencyAmount('1.2万'), { amount: 12000.0, unit: 'CNY' })

  // 空值绝不自动填补为 0
  assert.deepEqual(normalizeCurrencyAmount(''), { amount: null, unit: 'CNY' })
  assert.deepEqual(normalizeCurrencyAmount(null), { amount: null, unit: 'CNY' })

  // 只有明确为 0 时才为 0
  assert.deepEqual(normalizeCurrencyAmount('0'), { amount: 0, unit: 'CNY' })
  assert.deepEqual(normalizeCurrencyAmount(0), { amount: 0, unit: 'CNY' })

  // 负数保留供校验引擎隔离
  assert.deepEqual(normalizeCurrencyAmount('-199'), { amount: -199.0, unit: 'CNY' })
})

test('清洗标准化: 订单状态映射', () => {
  assert.equal(mapCanonicalOrderStatus('已付款').canonical, 'PAID')
  assert.equal(mapCanonicalOrderStatus('WAIT_SELLER_SEND_GOODS').canonical, 'PAID')
  assert.equal(mapCanonicalOrderStatus('退款成功').canonical, 'REFUNDED')
  assert.equal(mapCanonicalOrderStatus('未知状态xxx').canonical, 'OTHER')
})

async function cleanupGovernanceBatch(pool: ReturnType<typeof getPool>, batchId: number) {
  await pool.query(
    `DELETE FROM canonical_order_items coi
     USING canonical_orders co
     WHERE coi.biz_date = co.biz_date
       AND coi.source_platform = co.source_platform
       AND coi.store_id = co.store_id
       AND coi.source_order_id = co.source_order_id
       AND co.batch_id = $1`,
    [batchId],
  )
  await pool.query(`DELETE FROM canonical_orders WHERE batch_id = $1`, [batchId])
  await pool.query(`DELETE FROM canonical_refund_events WHERE batch_id = $1`, [batchId])
  await pool.query(
    `DELETE FROM publish_reversals WHERE publish_run_id IN (SELECT id FROM publish_runs WHERE batch_id = $1)`,
    [batchId],
  )
  const batchUploadName = `governance_batch_${batchId}`
  await pool.query(
    `DELETE FROM fact_trade_daily
     WHERE upload_id IN (SELECT id FROM data_uploads WHERE file_name = $1)
       AND gmv = 0 AND paid_order_count = 0`,
    [batchUploadName],
  )
  await pool.query(`DELETE FROM data_uploads WHERE file_name = $1`, [batchUploadName])
  await pool.query(`DELETE FROM clean_records WHERE batch_id = $1`, [batchId])
  await pool.query(`DELETE FROM raw_records WHERE batch_id = $1`, [batchId])
  await pool.query(`DELETE FROM import_batches WHERE id = $1`, [batchId])
}

// ═══════════════════════════════════════════════════════════════
// 5. 端到端全流程集成测试: API 未授权 fail-closed 拦截 与 手动上传->审核->发布->冲正闭环
// ═══════════════════════════════════════════════════════════════
test('端到端全链路: 客户类型 1 (API 直连) 对 manual_only / 无真实 Token 店铺 fail-closed 拒绝生成假数据', async () => {
  const pool = getPool()
  const ingestion = new IngestionService(pool)

  // dim_shop#1 默认处于 manual_only，严禁拉取/生成伪造订单污染生产数据库
  const ingestRes = await ingestion.ingestFromApi({
    platformCode: 'douyin',
    shopId: 1, // 抖音主营旗舰店
    datasetType: 'orders',
  })

  assert.equal(ingestRes.success, true)
  assert.equal(ingestRes.batchId, null)
  assert.equal(ingestRes.recordsCount, 0)
})

test('端到端全链路: 客户类型 2 (手动上传包含附录A异常案例) 触发 P0 闸门阻断，经人工审核修复、对账发布、血缘绑定与冲正后清理', async () => {
  const pool = getPool()
  const ingestion = new IngestionService(pool)
  const review = new ReviewService(pool)
  const validation = new ValidationService(pool)
  const reconciliation = new ReconciliationService(pool)
  const publishing = new PublishingService(pool)

  const ts = Date.now()
  // 构造附录 A 黄金测试数据集 Excel (含正常单、万元单位单、负金额异常单)
  const testData = [
    { 平台订单号: `TEST_GOLDEN_${ts}_01`, 实付款: '￥399.00', 商品编码: 'SKU-0098', 订单状态: '已付款' },
    { 平台订单号: `TEST_GOLDEN_${ts}_02`, 实付款: '1.2万', 商品编码: 'SKU-0102', 订单状态: '已付款' },
    { 平台订单号: `TEST_GOLDEN_${ts}_03`, 实付款: '-199.00', 商品编码: 'SKU-0105', 订单状态: '已付款' }, // 触发 P0 异常金额
  ]

  const ws = XLSX.utils.json_to_sheet(testData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '订单明细')
  const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `golden_appendix_a_test_${ts}.xlsx`

  let batchId: number | null = null
  try {
    // 1. 上传文件
    const uploadRes = await ingestion.ingestFromFile({
      platformCode: 'douyin',
      shopId: 1,
      fileBuffer,
      originalFilename: filename,
    })

    assert.equal(uploadRes.success, true)
    assert.ok(uploadRes.batchId)
    batchId = uploadRes.batchId!

    // 2. 重复上传相同文件应被 SHA-256 识别并拦截
    const dupUploadRes = await ingestion.ingestFromFile({
      platformCode: 'douyin',
      shopId: 1,
      fileBuffer,
      originalFilename: filename,
    })
    assert.equal(dupUploadRes.isDuplicateFile, true, '相同文件应被哈希去重拦截')

    // 3. 验证校验引擎产生了 P0 致命错误 (负数金额 -199)
    const issues = await review.getBatchIssues(batchId)
    assert.ok(issues.length > 0)
    const p0Issue = issues.find((i) => i.severity === 'P0' && i.ruleId === 'ORD-003')
    assert.ok(p0Issue, '应产生 ORD-003 P0 严重性错误')

    // 4. 尝试在存在未解决 P0 问题时发布 -> 验证发布闸门拒绝放行！
    await assert.rejects(
      publishing.publishBatch({ batchId, userId: 1 }),
      /PUBLISH_BLOCKED/,
      '存在未解决 P0 质量问题时必须阻断发布'
    )

    // 5. 人工审核工作台提交修复：纠正负数金额为 199.00 并记录原因
    const resolveRes = await review.resolveIssue({
      issueId: p0Issue.id,
      reviewerId: 1,
      decision: 'CONFIRM_FIX',
      reason: '核实平台来源报表，原始负数系退款冲销录入失误，更正为实际应付 199.00',
      fixedValues: {
        paidAmount: 199.0,
      },
    })
    assert.equal(resolveRes.success, true)

    // 6. 重新执行独立质量校验并执行对账 (399 + 12000 + 199 = 12598.00)
    const revalRes = await validation.validateCleaningRun(uploadRes.cleanResult.runId)
    assert.equal(revalRes.p0Count, 0, '修复后 P0 错误计数应为 0')

    const reconRes = await reconciliation.reconcileBatch({
      batchId,
      controlTotals: {
        expectedRowCount: 3,
        expectedTotalAmount: 12598.0,
      },
    })
    assert.ok(reconRes.length >= 2)
    assert.equal(reconRes.find((r) => r.metricCode === 'TOTAL_PAID_AMOUNT')?.status, 'MATCHED')

    // 7. 再次执行发布 -> 闸门放行，原子发布成功并绑定 data_uploads 血缘！
    const pubRes = await publishing.publishBatch({ batchId, userId: 1 })
    assert.equal(pubRes.success, true)
    assert.equal(pubRes.finalMaturityStatus, 'FINAL')

    const { rows: uploadRows } = await pool.query(
      `SELECT id, status, row_count FROM data_uploads WHERE file_name = $1`,
      [`governance_batch_${batchId}`],
    )
    assert.equal(uploadRows.length, 1)
    assert.equal(uploadRows[0].status, 'completed')

    // 8. 测试反向冲正/撤销，并还原 fact_trade_daily 数值
    const revRes = await publishing.reverseBatch(pubRes.publishRunId, '测试审计撤销冲正', 1)
    assert.equal(revRes.success, true)
    const { rows: checkBatch } = await pool.query(`SELECT status FROM import_batches WHERE id = $1`, [batchId])
    assert.equal(checkBatch[0].status, 'SUPERSEDED')
  } finally {
    if (batchId !== null) {
      await cleanupGovernanceBatch(pool, batchId)
    }
  }
})
