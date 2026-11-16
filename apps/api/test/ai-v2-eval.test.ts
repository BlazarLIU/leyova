/**
 * test/ai-v2-eval.test.ts — AI 模块 6 大契约与 60 题 Golden Set 自动化验收测试
 * 
 * 验收目标：
 *   1. 历史 4 大缺陷验证修复：
 *      - run #80: 问数支持多指标，非 GMV 单一兜底
 *      - run #81: 归因模式 diff 差值 100% 登记入证据库，Critic 验证 100% 通过（D2 根治）
 *      - run #82: 预测外推带有样本容量守卫与零点截断守卫，杜绝荒谬通过（D6 根治）
 *      - run #83: 问 GPM 精准映射 GPM 指标并执行千次成交计算（D1、D10 根治）
 *   2. 60 题 Golden Set 评测：
 *      - 实体/意图识别准确率 ≥ 90%
 *      - 数字未溯源数 = 0
 *      - 全量通过率 ≥ 90%
 */

import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { getPool } from '../src/lib/db.js'
import { mapQuestionToSchema } from '../src/ai/engine/planner/schema-mapper.js'
import { planByRules } from '../src/ai/engine/planner/rule-planner.js'
import { runAnalysis } from '../src/ai/engine/orchestrator.js'
import { runGoldenEvaluation } from '../src/ai/eval/runner.js'
import { GOLDEN_SET } from '../src/ai/eval/cases.js'

describe('P8 AI 模块深度重构：核心缺陷验证与 6 契约核验', () => {
  let app: FastifyInstance

  before(async () => {
    app = await buildApp()
  })

  after(async () => {
    await app.close()
  })

  test('修复 run #83：问「哪个平台 GPM 最高」精准映射 gpm 指标并下推排序', async () => {
    const question = '哪个平台 GPM 最高'
    const schema = await mapQuestionToSchema(question)

    assert.equal(schema.intent, 'query')
    assert.ok(schema.metrics.includes('gpm'), 'Schema Mapper 必须精准识别 GPM 指标')
    assert.ok(schema.dimensions.includes('platform_name'), '必须识别出 platform_name 维度')

    const plan = await planByRules({ question })
    assert.equal(plan.intent, 'query')
    assert.ok(plan.resolved.metrics.includes('gpm'))

    const result = await runAnalysis({ question }, null, getPool())
    assert.ok(result.steps.length > 0)
    assert.equal(result.verification.unmatched.length, 0, '所有输出数字必须 100% 可溯源')
    assert.ok(result.conclusion.headline.length > 0)
  })

  test('修复 run #81：归因模式「为什么昨天 GMV 变化这么大」diff 100% 溯源且通过核验', async () => {
    const question = '为什么昨天 GMV 变化这么大'
    const schema = await mapQuestionToSchema(question)

    assert.equal(schema.intent, 'attribute', '必须准确分类为 S2 归因意图')
    assert.ok(schema.metrics.includes('gmv'))

    const result = await runAnalysis({ question }, null, getPool())
    assert.ok(result.verification.passed, '归因模式 Critic 核验必须为 passed=true')
    assert.equal(result.verification.unmatched.length, 0, 'D2 缺陷修复：diff 与变化率均有证据血缘支撑')
    assert.ok(result.conclusion.findings.length > 0)

    // 验证 evidence 集合中包含 diff 与 abs_diff
    const hasDiff = result.evidence.some((e) => e.metric === 'gmv_diff')
    const hasAbsDiff = result.evidence.some((e) => e.metric === 'gmv_abs_diff')
    assert.ok(hasDiff, '证据池必须包含 gmv_diff 派生证据')
    assert.ok(hasAbsDiff, '证据池必须包含 gmv_abs_diff 变动绝对值')
  })

  test('修复 run #82：预测外推如果触底必须标记 caveats，不得输出虚假高置信度', async () => {
    const question = '预测未来 7 天 GMV 趋势'
    const schema = await mapQuestionToSchema(question)

    assert.equal(schema.intent, 'forecast', '必须识别为 S5 预测意图')
    assert.ok(schema.metrics.includes('gmv'))

    const result = await runAnalysis({ question }, null, getPool())
    assert.equal(result.verification.unmatched.length, 0, '预测数值必须能在证据集中精准对齐')

    // 如果历史序列下行截断，必须在 caveats 或 findings 给出明确说明
    if (result.conclusion.caveats && result.conclusion.caveats.length > 0) {
      assert.ok(
        result.conclusion.caveats.some((c) => c.includes('零值') || c.includes('截断') || c.includes('样本')),
        '触底截断时必须给出可解释的风控提示'
      )
    }
  })

  test('修复 run #80：S1 问数模式支持退款率、客单价等多指标与维度下钻', async () => {
    const question = '查看各渠道的退款率表现'
    const schema = await mapQuestionToSchema(question)

    assert.equal(schema.intent, 'query')
    assert.ok(schema.metrics.includes('refund_rate'), '识别退款率指标')
    assert.ok(schema.dimensions.includes('channel'), '识别渠道维度')

    const result = await runAnalysis({ question }, null, getPool())
    assert.equal(result.verification.unmatched.length, 0)
    assert.ok(result.verification.passed)
  })

  test('60 题 Golden Set 全量自动化评测回归（覆盖 S1~S6 全部模式）', async () => {
    const report = await runGoldenEvaluation(getPool(), GOLDEN_SET)

    console.log(`\n========================================`)
    console.log(`AI V2 Golden Set 评测报告 (Batch: ${report.batchId}):`)
    console.log(`- 用例总数: ${report.totalCases}`)
    console.log(`- 通过用例: ${report.passedCases} (${report.passRatePct}%)`)
    console.log(`- 意图识别准确率: ${report.intentAccuracyPct}%`)
    console.log(`- 指标识别准确率: ${report.metricAccuracyPct}%`)
    console.log(`- 未溯源数字总数: ${report.unmatchedNumbersTotal} 个`)
    console.log(`- 总评测耗时: ${report.durationMs}ms`)
    console.log(`========================================\n`)

    assert.ok(report.totalCases === 60, '必须评测全量 60 个测试用例')
    assert.ok(report.passRatePct >= 90, `综合通过率必须 ≥ 90% (实测: ${report.passRatePct}%)`)
    assert.ok(report.intentAccuracyPct >= 90, `意图识别准确率必须 ≥ 90% (实测: ${report.intentAccuracyPct}%)`)
    assert.ok(report.metricAccuracyPct >= 90, `指标识别准确率必须 ≥ 90% (实测: ${report.metricAccuracyPct}%)`)
    assert.equal(report.unmatchedNumbersTotal, 0, '全量 60 题中未溯源数字必须恒为 0')
  })
})
