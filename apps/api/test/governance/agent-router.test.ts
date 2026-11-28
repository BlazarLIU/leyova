import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeAgentKey, DOMAIN_AGENT_KEYS } from '../../src/ai/run/agent-router.js'

test('agent-router: 按域关键词路由到域 Agent', () => {
  assert.equal(routeAgentKey('复盘昨天直播场次的主播 GPM').agentKey, 'live_ops')
  assert.equal(routeAgentKey('分析千川计划 ROI 和素材 CTR').agentKey, 'ads_ops')
  assert.equal(routeAgentKey('诊断 SKU 库存与价格带动销').agentKey, 'merchandising')
  assert.equal(routeAgentKey('本月现金流和回款账期如何').agentKey, 'finance')
})

test('agent-router: 无域关键词回落到经营分析师', () => {
  assert.equal(routeAgentKey('昨天整体 GMV 多少').agentKey, 'business_analyst')
  assert.equal(routeAgentKey('').agentKey, 'business_analyst')
})

test('agent-router: 显式指定优先，但只接受已注册域 Agent', () => {
  assert.equal(routeAgentKey('昨天整体 GMV 多少', 'finance').agentKey, 'finance')
  assert.equal(routeAgentKey('昨天整体 GMV 多少', 'hacker_agent').agentKey, 'business_analyst')
  for (const key of DOMAIN_AGENT_KEYS.filter((k) => k !== 'business_analyst')) {
    assert.equal(routeAgentKey('复盘昨天直播', key).agentKey, key)
  }
})