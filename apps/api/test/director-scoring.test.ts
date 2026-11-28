/**
 * director-scoring.test.ts — F.2 选题机会分确定性公式
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  SCORE_WEIGHTS,
  computeOpportunityScore,
  normalizeDemand,
  normalizeFeasibility,
  normalizeHistory,
  normalizeMargin,
  normalizeSeason,
} from '../src/director/scoring.js'

describe('F.2 归一化函数', () => {
  test('需求按播放量对数归一化', () => {
    assert.ok((normalizeDemand(100) as number) < 1)
    assert.equal(normalizeDemand(10_000), 50)
    assert.equal(normalizeDemand(1_000_000), 100)
    assert.equal(normalizeDemand(null), null)
    assert.equal(normalizeDemand(0), null)
  })

  test('互动率归一化上限 100', () => {
    assert.equal(normalizeHistory(5), 50)
    assert.equal(normalizeHistory(15), 100)
    assert.equal(normalizeHistory(null), null)
  })

  test('毛利/库存组合归一化', () => {
    assert.equal(normalizeMargin(0.5, 30), 65)
    assert.equal(normalizeMargin(0.5, 100), 47)
    assert.equal(normalizeMargin(null, 30), 100)
    assert.equal(normalizeMargin(null, null), null)
  })

  test('季节节点按重要度与距离衰减', () => {
    assert.equal(normalizeSeason(5, 10), 100)
    assert.equal(normalizeSeason(5, 25), 80)
    assert.equal(normalizeSeason(5, 50), 50)
    assert.equal(normalizeSeason(5, 90), null)
    assert.equal(normalizeSeason(null, 10), null)
  })

  test('制作可行性按商品/模板/素材累加', () => {
    assert.equal(normalizeFeasibility({ hasProduct: true, hasTemplate: true, assetCount: 3 }), 100)
    assert.equal(normalizeFeasibility({ hasProduct: false, hasTemplate: true, assetCount: 1 }), 40)
  })
})

describe('F.2 机会分计算', () => {
  test('权重之和为 1', () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((acc, value) => acc + value, 0)
    assert.equal(Math.round(sum * 100) / 100, 1)
  })

  test('全量因子加权求和', () => {
    const result = computeOpportunityScore({
      demand: 80,
      history: 80,
      margin: 80,
      season: 80,
      feasibility: 80,
    })
    assert.equal(result.score, 80)
    assert.equal(result.recommendation, 'recommended')
    assert.deepEqual(result.missing, [])
  })

  test('缺失因子按剩余权重重归一化，不当作 0 分', () => {
    const result = computeOpportunityScore({
      demand: 80,
      history: null,
      margin: null,
      season: 80,
      feasibility: 80,
    })
    // 可用权重 0.30 + 0.15 + 0.10 = 0.55，全部 80 → 80
    assert.equal(result.score, 80)
    assert.deepEqual(result.missing.sort(), ['history', 'margin'])
    assert.match(result.note, /数据不足项/)
  })

  test('全部缺失明确返回数据不足', () => {
    const result = computeOpportunityScore({
      demand: null,
      history: null,
      margin: null,
      season: null,
      feasibility: null,
    })
    assert.equal(result.score, null)
    assert.equal(result.recommendation, 'insufficient')
    assert.equal(result.missing.length, 5)
    assert.match(result.note, /数据不足/)
  })

  test('低分返回不建议', () => {
    const result = computeOpportunityScore({
      demand: 10,
      history: 10,
      margin: 10,
      season: 10,
      feasibility: 10,
    })
    assert.equal(result.recommendation, 'not_recommended')
    assert.equal(result.score, 10)
  })
})
