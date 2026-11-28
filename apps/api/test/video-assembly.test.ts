/**
 * video-assembly.test.ts — F.1 模板 DSL / 槽位 / 灰度 / 质检门禁
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  assertSlots,
  buildShotPlan,
  parseTemplateDsl,
  runQualityGate,
  selectTemplateVersion,
  validateSlots,
  type TemplateDsl,
} from '../src/video/assembly.js'

const PRODUCT_DSL = {
  template: 'product_seed_v1',
  type: 'assembly',
  aspect: '9:16',
  duration: { min: 15, max: 30 },
  slots: [
    { key: 'hook', type: 'text', required: true, maxLength: 18 },
    { key: 'selling_points', type: 'text_list', required: true, countMin: 3, countMax: 5 },
    { key: 'product_images', type: 'image_list', required: true, countMin: 3, countMax: 5 },
    { key: 'cta', type: 'text', required: true, maxLength: 12 },
  ],
  audio: { loudness: -14 },
  subtitles: { style: 'bold_yellow', safe_area: true },
  rules: { banned_words_check: 'hard', brand_logo: 'bottom_right', ai_label: 'if_generated' },
}

describe('F.1 模板 DSL 校验', () => {
  test('合法 DSL 规范化成功', () => {
    const dsl = parseTemplateDsl(PRODUCT_DSL)
    assert.equal(dsl.type, 'assembly')
    assert.equal(dsl.slots.length, 4)
    assert.equal(dsl.rules.brand_logo, 'bottom_right')
  })

  test('槽位 key 重复被拒绝', () => {
    assert.throws(
      () => parseTemplateDsl({ ...PRODUCT_DSL, slots: [{ key: 'a', type: 'text' }, { key: 'a', type: 'text' }] }),
      /槽位 key 重复/,
    )
  })

  test('非法槽位类型被拒绝', () => {
    assert.throws(
      () => parseTemplateDsl({ ...PRODUCT_DSL, slots: [{ key: 'a', type: 'unknown' }] }),
      /type 不合法/,
    )
  })

  test('rules 支持数组写法并合并为对象', () => {
    const dsl = parseTemplateDsl({ ...PRODUCT_DSL, rules: [{ ai_label: 'always' }, { brand_logo: 'off' }] })
    assert.deepEqual(dsl.rules, { ai_label: 'always', brand_logo: 'off' })
  })
})

describe('F.1 槽位校验（缺必选槽拒绝）', () => {
  const dsl = parseTemplateDsl(PRODUCT_DSL) as TemplateDsl

  test('缺必选槽返回 missing', () => {
    const result = validateSlots(dsl, { hook: '这个真香' })
    assert.equal(result.ok, false)
    assert.deepEqual(result.missing.sort(), ['cta', 'product_images', 'selling_points'])
  })

  test('数量越界返回 issues', () => {
    const result = validateSlots(dsl, {
      hook: '这个真香',
      selling_points: ['a', 'b'],
      product_images: ['a.png', 'b.png', 'c.png'],
      cta: '立即下单',
    })
    assert.equal(result.ok, false)
    assert.equal(result.missing.length, 0)
    assert.ok(result.issues.some((issue) => issue.slot === 'selling_points'))
  })

  test('全部合法通过', () => {
    const result = validateSlots(dsl, {
      hook: '这个真香',
      selling_points: ['a', 'b', 'c'],
      product_images: ['a.png', 'b.png', 'c.png'],
      cta: '立即下单',
    })
    assert.equal(result.ok, true)
    assert.doesNotThrow(() =>
      assertSlots(dsl, {
        hook: '这个真香',
        selling_points: ['a', 'b', 'c'],
        product_images: ['a.png', 'b.png', 'c.png'],
        cta: '立即下单',
      })
    )
  })

  test('assertSlots 对缺必选槽抛错', () => {
    assert.throws(() => assertSlots(dsl, {}), /缺少必选槽位/)
  })
})

describe('F.1 版本灰度', () => {
  const versions = [
    { id: 'v1', version: 1, status: 'archived' },
    { id: 'v2', version: 2, status: 'published', is_canary: false },
    { id: 'v3', version: 3, status: 'published', is_canary: true },
  ]

  test('灰度命中走 canary', () => {
    assert.equal(selectTemplateVersion(versions, 100, 0.5)?.id, 'v3')
  })

  test('灰度未命中走稳定版', () => {
    assert.equal(selectTemplateVersion(versions, 10, 0.5)?.id, 'v2')
  })

  test('无 published 版本返回 null', () => {
    assert.equal(selectTemplateVersion([{ version: 1, status: 'draft' }], 100, 0.5), null)
  })
})

describe('F.1 镜头计划', () => {
  const dsl = parseTemplateDsl(PRODUCT_DSL) as TemplateDsl

  test('钩子/卖点/CTA 依次成镜头', () => {
    const plan = buildShotPlan(dsl, {
      hook: '这个真香',
      selling_points: ['a', 'b', 'c'],
      cta: '立即下单',
    })
    assert.equal(plan[0].shotType, 'hook')
    assert.equal(plan.filter((shot) => shot.shotType === 'selling_point').length, 3)
    assert.equal(plan[plan.length - 1].shotType, 'cta')
    const total = plan.reduce((sum, shot) => sum + shot.durationMs, 0)
    assert.ok(total >= dsl.duration.min * 1000)
  })
})

describe('F.1 质检门禁', () => {
  const dsl = parseTemplateDsl(PRODUCT_DSL) as TemplateDsl

  const valid = {
    dsl,
    durationMs: 20_000,
    width: 1080,
    height: 1920,
    loudness: -14,
    subtitleSegments: [{ startMs: 0, endMs: 3000, text: '这个真香' }],
    logoPresent: true,
    aiLabelPresent: true,
    generated: true,
    bannedHits: [],
    hasBlackFrame: false,
    hasSilence: false,
  }

  test('全部通过', () => {
    const result = runQualityGate(valid)
    assert.equal(result.passed, true)
    assert.equal(result.blockers.length, 0)
  })

  test('时长越界拦截', () => {
    const result = runQualityGate({ ...valid, durationMs: 5000 })
    assert.equal(result.passed, false)
    assert.ok(result.blockers.includes('时长'))
  })

  test('响度缺失与违禁词拦截', () => {
    const result = runQualityGate({
      ...valid,
      loudness: null,
      bannedHits: [{ word: '最', action: 'block', severity: 'high' }],
    })
    assert.equal(result.passed, false)
    assert.ok(result.blockers.includes('响度'))
    assert.ok(result.blockers.includes('违禁词'))
  })

  test('AI 标识与黑帧静音拦截', () => {
    const result = runQualityGate({
      ...valid,
      aiLabelPresent: false,
      hasBlackFrame: true,
      hasSilence: true,
    })
    assert.equal(result.passed, false)
    assert.ok(result.blockers.includes('AI 生成标识'))
    assert.ok(result.blockers.includes('黑帧'))
    assert.ok(result.blockers.includes('静音'))
  })
})
