/**
 * test/decision-gates-golden.test.ts
 *
 * WP-A & WP-B 金样契约测试：
 * 1. 广告消耗 Gate (ad_spend) 真实判定：严禁仅有交易流水就假通过；
 * 2. 订单场次归因 Gate (order_attribution)：校验覆盖率是否达到 >= 50%；
 * 3. 商品成本版本 Gate (unit_cost)：必须具备生效成本版本，否则阻断利润增量；
 * 4. 真实结算利润 Gate (settlement_profit)：必须具备扣除 COGS 后的真实净利润；
 * 5. 佣金与扣点 Gate (commission)：真实归集与规则核查；
 * 6. Gate 1 硬性门禁一票否决：未全过禁止 propose / submit；
 * 7. Decision Memo 三态标签强制校验：缺【事实】/【假设】/【预测】禁止 submit。
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getPool, withSystemRlsContext } from '../src/lib/db.js'
import {
  evaluateDecisionGates,
  getDecisionGates,
  transitionDecisionCase,
  createDecisionCase,
  getDecisionCase,
  exportDecisionMemo,
} from '../src/services/decision-cases.js'

describe('WP-A/WP-B 数据可信金样门禁与 Memo 三态标签契约测试', () => {
  const pool = getPool()
  const tenantId = 1
  let testCaseId: number

  before(async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      const res = await createDecisionCase(client, {
        tenantId,
        title: '金样门禁测试用例',
        problemStatement: '【事实】千川广告投流ROI异常波动，【假设】偏离由于人群包未适配，【预测】调整后预计提升净ROI 0.3',
        domain: 'ads',
        sceneKey: 'SCENE-A',
        attributionGrade: 'GRADE_A',
        amountState: 'SETTLEMENT_DERIVED',
        expectedImpact: {
          facts: ['【事实】近 7 天千川消耗 ¥12000，GMV ¥35000'],
          hypotheses: ['【假设】目标人群包转化率从 2.1% 降至 1.4%'],
          forecasts: ['【预测】重新圈选核心高潜人群后 ROI 预计由 2.9 回升至 3.2'],
        },
        options: [
          { key: 'reallocate', label: '再分配人群包', pros: '提升ROI', cons: '需投手调试', riskLevel: 'R1' },
          { key: 'no_action', label: '不做（维持现状）', pros: '零成本', cons: '持续亏损', riskLevel: 'R0' },
        ],
        chosenOption: 'reallocate',
        status: 'INVESTIGATING',
      })
      testCaseId = res.caseRow.id
    })
  })

  after(async () => {
    if (testCaseId) {
      await pool.query('DELETE FROM public.decision_cases WHERE id = $1', [testCaseId]).catch(() => undefined)
    }
  })

  test('金样门禁评估完整返回 7 项门禁且所有判定按真实数据计算', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      const evalRes = await evaluateDecisionGates(client, tenantId, testCaseId, 'SCENE-A')
      assert.equal(evalRes.gates.length, 7, '必须评估完整 7 项门禁')

      const gateMap = new Map(evalRes.gates.map((g) => [g.checkItem, g]))

      // 1. ad_spend: 真实消耗数据
      const adGate = gateMap.get('ad_spend')
      assert.ok(adGate)
      assert.equal(adGate.gateTier, 'GATE_1_HARD')
      assert.equal(adGate.status, 'PASS', '当存在真实投放消耗时应 PASS')

      // 2. order_attribution: 归因覆盖率
      const orderGate = gateMap.get('order_attribution')
      assert.ok(orderGate)
      assert.equal(orderGate.gateTier, 'GATE_1_HARD')
      assert.equal(orderGate.status, 'PASS', '覆盖率 >= 50% 时应 PASS')
      assert.match(orderGate.message, /覆盖率达标/)

      // 3. unit_cost: 成本版本
      const costGate = gateMap.get('unit_cost')
      assert.ok(costGate)
      assert.equal(costGate.gateTier, 'GATE_1_HARD')
      assert.equal(costGate.status, 'PASS', '具备生效版本时应 PASS')

      // 4. refund_maturity: T+7
      const refundGate = gateMap.get('refund_maturity')
      assert.ok(refundGate)
      assert.equal(refundGate.gateTier, 'GATE_2_CONFIDENCE')

      // 5. commission: 佣金/平台费
      const commGate = gateMap.get('commission')
      assert.ok(commGate)
      assert.equal(commGate.gateTier, 'GATE_2_CONFIDENCE')
      assert.equal(commGate.status, 'PASS')

      // 6. session_cost: 全口径单场成本
      const sessionCostGate = gateMap.get('session_cost')
      assert.ok(sessionCostGate)
      assert.equal(sessionCostGate.gateTier, 'GATE_1_HARD')
      assert.equal(sessionCostGate.status, 'PASS')

      // 7. settlement_profit: 扣除 COGS 的真实净利
      const profitGate = gateMap.get('settlement_profit')
      assert.ok(profitGate)
      assert.equal(profitGate.gateTier, 'GATE_2_CONFIDENCE')
      assert.equal(profitGate.status, 'PASS', '具备扣减 COGS 与平台费的已结算真实利润时应 PASS')

      assert.equal(evalRes.overallStatus, 'PASS')
      assert.equal(evalRes.canPropose, true)
    })
  })

  test('Gate 1 硬性阻断：当决策案 Gate 为 FAIL 时，禁止进入提案与审批流程', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      // 临时将该案设为 FAIL
      await client.query(
        `UPDATE public.decision_cases SET data_gate_status = 'FAIL', status = 'INVESTIGATING' WHERE id = $1`,
        [testCaseId],
      )

      const proposeRes = await transitionDecisionCase(client, tenantId, testCaseId, 'propose', null)
      assert.equal(proposeRes.ok, false)
      assert.match(proposeRes.message, /数据 Gate 当前为 FAIL/)

      // 恢复为 PASS 并成功推进至 PROPOSED
      await client.query(
        `UPDATE public.decision_cases SET data_gate_status = 'PASS' WHERE id = $1`,
        [testCaseId],
      )
      const validPropose = await transitionDecisionCase(client, tenantId, testCaseId, 'propose', null)
      assert.equal(validPropose.ok, true)
      assert.equal(validPropose.caseRow.status, 'PROPOSED')
    })
  })

  test('Memo 三态标签强制校验：缺【事实】、【假设】或【预测】标签时禁止提交审批', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      // 创建一个缺失标签的决策案
      const badRes = await createDecisionCase(client, {
        tenantId,
        title: '缺失三态标签案例',
        problemStatement: '未包含任何标签的描述文本',
        domain: 'ads',
        sceneKey: 'SCENE-A',
        expectedImpact: {
          facts: ['纯文本事实说明'],
          hypotheses: ['纯文本假设说明'],
          forecasts: ['纯文本预测说明'],
        },
        options: [
          { key: 'opt1', label: '方案1', pros: '', cons: '', riskLevel: 'R1' },
          { key: 'no_action', label: '不做', pros: '', cons: '', riskLevel: 'R0' },
        ],
        status: 'INVESTIGATING',
      })
      const badCaseId = badRes.caseRow.id

      // 强制更新 memo 使得其确实不含标签
      await client.query(
        `UPDATE public.decision_memo_versions
            SET facts = '["纯文本事实"]'::jsonb,
                hypotheses = '["纯文本假设"]'::jsonb,
                forecasts = '["纯文本预测"]'::jsonb
          WHERE case_id = $1`,
        [badCaseId],
      )
      await client.query(
        `UPDATE public.decision_cases
            SET data_gate_status = 'PASS',
                problem_statement = '无标签内容',
                expected_impact = '{}'::jsonb,
                status = 'PROPOSED'
          WHERE id = $1`,
        [badCaseId],
      )

      // 尝试提交审批：应被拦截
      const submitRes = await transitionDecisionCase(client, tenantId, badCaseId, 'submit', null)
      assert.equal(submitRes.ok, false)
      assert.match(submitRes.message, /必须包含【事实】、【假设】、【预测】三态标签/)

      // 补全标签后允许提交
      await client.query(
        `UPDATE public.decision_memo_versions
            SET facts = '["【事实】 订单GMV达到 50000"]'::jsonb,
                hypotheses = '["【假设】 转化漏斗存在优化空间"]'::jsonb,
                forecasts = '["【预测】 净ROI提升0.2"]'::jsonb
          WHERE case_id = $1`,
        [badCaseId],
      )
      const validSubmit = await transitionDecisionCase(client, tenantId, badCaseId, 'submit', null)
      assert.equal(validSubmit.ok, true)
      assert.equal(validSubmit.caseRow.status, 'AWAITING_APPROVAL')

      // 清理临时测试用例
      await client.query('DELETE FROM public.decision_cases WHERE id = $1', [badCaseId])
    })
  })

  test('Decision Memo 导出包含七段结构、A-D 归因等级、门禁结果与三态标签', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      const exported = await exportDecisionMemo(client, tenantId, testCaseId)
      assert.ok(exported.filename.startsWith('Decision_Memo_'))
      assert.ok(exported.content.includes('# 经营决策备忘录 (Decision Memo)'))
      assert.ok(exported.content.includes('【事实】'), '导出必须保留【事实】标签')
      assert.ok(exported.content.includes('【假设】'), '导出必须保留【假设】标签')
      assert.ok(exported.content.includes('【预测】'), '导出必须保留【预测】标签')
      assert.ok(exported.content.includes('A级 · 平台回传/行级验证'), '导出必须包含归因等级 A-D')
      assert.ok(exported.content.includes('结算推导 (SETTLEMENT_DERIVED)'), '导出必须包含利润三态')
      assert.ok(exported.content.includes('## 1. 决策问题'))
      assert.ok(exported.content.includes('## 2. 事实依据'))
      assert.ok(exported.content.includes('## 3. 归因假设'))
      assert.ok(exported.content.includes('## 4. 选项与影响预测'))
      assert.ok(exported.content.includes('## 5. 证据快照与置信度门禁'))
      assert.ok(exported.content.includes('## 6. 执行与责任人'))
      assert.ok(exported.content.includes('## 7. 复核与学习'))
    })
  })
})
