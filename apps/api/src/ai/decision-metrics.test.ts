import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DecisionMetricsService } from '../services/decision-metrics.js'

describe('DecisionMetricsService (WP-01 & AUD-01)', () => {
  it('结算成交广告比：adSpend > 0 时正常计算', () => {
    const res = DecisionMetricsService.calculateSettledGmvAdRatio(10000, 2000)
    assert.equal(res.status, 'FACT')
    assert.equal(res.value, 5.0)
    assert.equal(res.metricCode, 'settled_gmv_ad_ratio')
  })

  it('结算成交广告比：adSpend <= 0 时返回 NOT_EVALUABLE，杜绝除以零', () => {
    const res = DecisionMetricsService.calculateSettledGmvAdRatio(10000, 0)
    assert.equal(res.status, 'NOT_EVALUABLE')
    assert.equal(res.value, null)
  })

  it('真实 Net ROI：缺少商品成本或佣金时，返回 NOT_EVALUABLE 并列出缺失项', () => {
    const res = DecisionMetricsService.calculateNetRoi({
      revenue: 50000,
      adSpend: 10000,
      cogs: null, // missing
      platformFee: 2000,
      fulfillmentCost: 1000,
    })
    assert.equal(res.status, 'NOT_EVALUABLE')
    assert.equal(res.value, null)
    assert.ok(res.missingInputs?.includes('cogs (商品销售成本)'))
  })

  it('真实 Net ROI：全成本齐备时准确输出净利 ROI', () => {
    const res = DecisionMetricsService.calculateNetRoi({
      revenue: 50000,
      adSpend: 10000,
      cogs: 20000,
      platformFee: 2500,
      fulfillmentCost: 2500,
    })
    // 净利 = 50000 - 10000 - 20000 - 2500 - 2500 = 15000
    // Net ROI = 15000 / 10000 = 1.5
    assert.equal(res.status, 'FACT')
    assert.equal(res.value, 1.5)
  })
})
