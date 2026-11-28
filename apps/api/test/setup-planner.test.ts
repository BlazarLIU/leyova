import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildProfile, composePlan, recommend } from '../src/services/setup-planner.js'

test('buildProfile: 缺省值归一化', () => {
  const p = buildProfile({})
  assert.equal(p.entityType, 'brand_self')
  assert.deepEqual(p.platforms, ['douyin'])
  assert.equal(p.channel, 'live')
  assert.equal(p.teamSize, 5)
})

test('recommend: 品牌自播包含货场复盘与库存', () => {
  const rec = recommend(buildProfile({ entityType: 'brand_self', platforms: ['douyin'] }))
  for (const code of ['session', 'product_center', 'system_inventory', 'net_roi', 'review']) {
    assert.ok(rec.modules.includes(code), `缺少 ${code}`)
  }
  assert.ok(rec.reasons.session)
})

test('recommend: MCN 不推荐库存，推荐主播与内容', () => {
  const rec = recommend(buildProfile({ entityType: 'mcn', platforms: ['douyin', 'xiaohongshu'] }))
  assert.ok(!rec.modules.includes('system_inventory'))
  for (const code of ['anchor', 'personal_achievement', 'content', 'content_schedule']) {
    assert.ok(rec.modules.includes(code), `缺少 ${code}`)
  }
})

test('recommend: 痛点追加对应模块', () => {
  const rec = recommend(
    buildProfile({ entityType: 'agency', painPoints: ['high_refund', 'ads_roi'] })
  )
  assert.ok(rec.modules.includes('after_sales'))
  assert.ok(rec.modules.includes('net_roi'))
})

test('recommend: 跨境强制合规模块并给出提示', () => {
  const rec = recommend(buildProfile({ entityType: 'brand_self', needsCrossBorder: true }))
  assert.ok(rec.modules.includes('compliance'))
  assert.ok(rec.notes.some((n) => n.includes('合规')))
})

test('recommend: 未知平台被过滤，空平台回退抖音', () => {
  const rec = recommend(buildProfile({ platforms: ['unknown' as any] }))
  assert.deepEqual(rec.platforms, ['douyin'])
})

test('composePlan: 输出可被 apply 接受的结构', () => {
  const profile = buildProfile({ entityType: 'brand_self', platforms: ['douyin'] })
  const rec = recommend(profile)
  const plan = composePlan({ name: '测试企业' }, profile, rec)
  assert.equal(plan.tenant.name, '测试企业')
  assert.equal(plan.setupSource, 'ai')
  assert.ok(Array.isArray(plan.modules))
  assert.ok(plan.aiProfile)
})
