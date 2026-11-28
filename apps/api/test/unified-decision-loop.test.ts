import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { withSystemRlsContext } from '../src/lib/rls.js'
import {
  evaluateDecisionGates,
  getDecisionGates,
  transitionDecisionCase,
  getDecisionCase,
} from '../src/services/decision-cases.js'
import {
  createAnchorCompetencyProfile,
  listAnchorCompetencyProfiles,
  updateAnchorCompetencyProfile,
} from '../src/services/anchor-profiles.js'
import {
  createComplianceLearningTask,
  listComplianceLearningTasks,
  completeComplianceLearningTask,
} from '../src/services/compliance-tasks.js'
import { checkScriptCompliance } from '../src/services/controlled-compliance.js'
import { recommendProductSequence, exportChecklistCsv } from '../src/services/assortment-sequencing.js'

describe('Leyova 统一落地实施方案：核心能力测试', () => {
  const tenantId = 1

  it('1. Gate 1 硬性数据门禁评估与阻断逻辑', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      // 创建测试决策案
      const options = JSON.stringify([
        { key: 'reallocate', label: '再分配' },
        { key: 'no_action', label: '不做' },
      ])
      const caseNo = `TEST-GATE-${Date.now()}`
      const insRes = await client.query(
        `INSERT INTO public.decision_cases
           (tenant_id, case_no, title, problem_statement, domain, status, scene_key, options)
         VALUES ($1, $2, '投流门禁测试', '验证硬性门禁阻断', 'ads', 'DRAFT', 'SCENE-A', $3::jsonb)
         RETURNING id`,
        [tenantId, caseNo, options],
      )
      const caseId = Number(insRes.rows[0].id)

      // 评估门禁
      const result = await evaluateDecisionGates(client, tenantId, caseId, 'SCENE-A')
      assert.ok(result.gates.length >= 3, '至少应评估 3 条门禁规则')
      assert.ok(
        result.gates.some((g) => g.checkItem === 'ad_spend' && g.gateTier === 'GATE_1_HARD'),
        '必须包含广告消耗硬性门禁',
      )

      // 查询持久化明细
      const persistedGates = await getDecisionGates(client, tenantId, caseId)
      assert.ok(persistedGates.length >= 3, '持久化门禁明细记录应存在')

      // 测试未通过 Gate 1 时禁止进入提案阶段
      if (result.overallStatus === 'FAIL') {
        const transRes = await transitionDecisionCase(client, tenantId, caseId, 'propose', null)
        assert.equal(transRes.ok, false, 'Gate 1 FAIL 时禁止推进至 PROPOSED')
      }
    })
  })

  it('2. 决策案 LEARNED 终态流转与复盘经验沉淀', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      const options = JSON.stringify([
        { key: 'reallocate', label: '再分配' },
        { key: 'no_action', label: '不做' },
      ])
      const caseNo = `TEST-LEARN-${Date.now()}`
      const insRes = await client.query(
        `INSERT INTO public.decision_cases
           (tenant_id, case_no, title, problem_statement, domain, status, scene_key, options, data_gate_status)
         VALUES ($1, $2, '复盘沉淀测试', '验证 LEARNED 状态机', 'ads', 'REVIEWED', 'SCENE-A', $3::jsonb, 'PASS')
         RETURNING id`,
        [tenantId, caseNo, options],
      )
      const caseId = Number(insRes.rows[0].id)

      // 从 REVIEWED 流转至 LEARNED
      const transRes = await transitionDecisionCase(client, tenantId, caseId, 'learn', 1)
      assert.ok(transRes.ok, '流转至 LEARNED 应该成功')
      if (transRes.ok) {
        assert.equal(transRes.caseRow.status, 'LEARNED')
        assert.ok(transRes.caseRow.learnedAt, 'learnedAt 必须被填充')
        assert.ok(transRes.caseRow.learningSummary, 'learningSummary 必须被填充')
      }

      // 从 LEARNED 还可以流转至 ARCHIVED 归档
      const closeRes = await transitionDecisionCase(client, tenantId, caseId, 'close', 1)
      assert.ok(closeRes.ok, '从 LEARNED 归档应该成功')
      if (closeRes.ok) {
        assert.equal(closeRes.caseRow.status, 'ARCHIVED')
      }
    })
  })

  it('3. 主播轻量能力画像与适用品类标签', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      const anchorName = `测试主播_${Date.now()}`
      const created = await createAnchorCompetencyProfile(client, tenantId, {
        anchorName,
        suitableCategories: ['美妆', '服饰'],
        styleTags: ['快节奏', '激情带货'],
        hourlyRate: 500,
      })
      assert.equal(created.anchorName, anchorName)
      assert.deepEqual(created.suitableCategories, ['美妆', '服饰'])

      const list = await listAnchorCompetencyProfiles(client, tenantId)
      assert.ok(list.some((a) => a.anchorName === anchorName))

      const updated = await updateAnchorCompetencyProfile(client, tenantId, created.id, {
        hourlyRate: 600,
        styleTags: ['沉稳专业'],
      })
      assert.equal(updated?.hourlyRate, 600)
      assert.deepEqual(updated?.styleTags, ['沉稳专业'])
    })
  })

  it('4. 合规新规学习与整改任务下发及闭环', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      const taskTitle = `新广告法直播违禁词专项学习_${Date.now()}`
      const task = await createComplianceLearningTask(client, tenantId, {
        title: taskTitle,
        ruleReference: '平台直播违规词公告 2026-11 版',
        assigneeName: '主播团队负责人',
        dueDate: '2026-11-30',
      })
      assert.equal(task.title, taskTitle)
      assert.equal(task.status, 'PENDING')

      const tasks = await listComplianceLearningTasks(client, tenantId, 'PENDING')
      assert.ok(tasks.some((t) => t.id === task.id))

      const completed = await completeComplianceLearningTask(
        client,
        tenantId,
        task.id,
        '已组织全员背诵并完成随堂测试',
      )
      assert.equal(completed?.status, 'COMPLETED')
      assert.ok(completed?.completedAt)
    })
  })

  it('5. 词级受控合规检查与官方替换词推荐（无大模型幻觉）', async () => {
    await withSystemRlsContext(tenantId, async (client) => {
      // 包含违禁词“全网第一”和“保证有效”
      const testScript = '各位宝子们，这款精华液是全网第一的抗老神霜，绝对保证有效，而且还是顶级品质！'
      const auditResult = await checkScriptCompliance(client, tenantId, testScript)

      assert.equal(auditResult.passed, false, '存在 BLOCK 级敏感词应判定未通过')
      assert.equal(auditResult.riskLevel, 'BLOCK')
      assert.ok(auditResult.matchedCount >= 2, '应至少命中 2 个违规短语')

      const blockMatch = auditResult.matches.find((m) => m.word === '全网第一')
      assert.ok(blockMatch, '必须命中“全网第一”')
      assert.equal(blockMatch?.riskLevel, 'BLOCK')
      assert.ok(blockMatch?.suggestedReplacement.includes('热销爆款'), '必须给出合规推荐短语')

      // 安全合规文本
      const safeScript = '这是一款甄选品质的高端热销面霜，深层滋养肌肤。'
      const safeResult = await checkScriptCompliance(client, tenantId, safeScript)
      assert.equal(safeResult.passed, true, '安全文本应通过合规检查')
    })
  })

  it('6. 排品测算推荐算法与直播执行清单 CSV 导出', () => {
    const products = [
      { sku: 'SKU-001', name: '高毛利面霜', unitPrice: 299, costPrice: 50, stock: 500, refundRate: 0.08 },
      { sku: 'SKU-002', name: '引流爆款纸巾', unitPrice: 19.9, costPrice: 15, stock: 3000, refundRate: 0.02 },
      { sku: 'SKU-003', name: '清仓羽绒服', unitPrice: 399, costPrice: 200, stock: 120, refundRate: 0.25 },
    ]

    // 利润优先测算
    const profitResult = recommendProductSequence({
      goal: 'profit',
      durationMinutes: 60,
      products,
    })
    assert.equal(profitResult.productCount, 3)
    assert.ok(profitResult.sequence.length === 3)
    assert.equal(profitResult.sequence[0].sku, 'SKU-001', '利润优先下高毛利面霜应排第一')

    // 导出清单 CSV
    const csv = exportChecklistCsv(profitResult.sequence)
    assert.ok(csv.includes('出场顺序,商品名称,SKU,售价(元)'))
    assert.ok(csv.includes('高毛利面霜'))
  })
})
