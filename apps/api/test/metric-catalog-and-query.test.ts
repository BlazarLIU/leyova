/**
 * test/metric-catalog-and-query.test.ts
 *
 * 验证 P1 地基：统一指标注册表与取数原语层
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { getPool } from '../src/lib/db.js'
import { buildApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import { SYSTEM_METRICS, SYSTEM_DIMENSIONS, listAllowedMetrics, getMetricDefinition } from '../src/catalog/index.js'
import { buildSafeQuery, resolveFactSource, getFactTableName } from '../src/query/query-builder.js'
import { queryMetric, comparePeriods, drillDown, detectAnomalies, forecastTrend } from '../src/query/primitives.js'

describe('P1 地基：指标注册表 (Metric Catalog)', () => {
  test('核心指标定义完整且具备标准属性', () => {
    const requiredCodes = ['gmv', 'pay_amount', 'net_sales', 'refund_rate', 'ad_spend', 'roi', 'net_roi', 'ctr', 'gpm']
    for (const code of requiredCodes) {
      const def = getMetricDefinition(code)
      assert.ok(def, `指标 ${code} 必须在指标注册表中`)
      assert.ok(def.expr.length > 0, `指标 ${code} 必须有 SQL 聚合表达式`)
      assert.ok(def.factTable, `指标 ${code} 必须指明所属事实表`)
    }
  })

  test('权限隔离：无投放权限角色不可访问 ad 分类敏感指标', () => {
    const viewerMetrics = listAllowedMetrics({ role: 'brand_viewer' })
    const adCodes = viewerMetrics.filter((m) => m.category === 'ad')
    assert.equal(adCodes.length, 0, 'brand_viewer 默认不可列出 ad 分类指标')

    const adminMetrics = listAllowedMetrics({ role: 'super_admin' })
    const adminAdCodes = adminMetrics.filter((m) => m.category === 'ad')
    assert.ok(adminAdCodes.length > 0, 'super_admin 可以查看投流与 ROI 指标')
  })
})

describe('P1 地基：取数构建器 (Query Builder)', () => {
  test('交易指标严格路由至 v_fact_trade_default 视图，杜绝 2.4x 放大', () => {
    const source = resolveFactSource(['gmv', 'refund_amount'])
    assert.equal(source, 'trade')
    const tableName = getFactTableName(source)
    assert.equal(tableName, 'v_fact_trade_default')
  })

  test('参数化过滤生成正确 SQL 与 params', () => {
    const { sql, params, metrics, dimensions } = buildSafeQuery({
      metrics: ['gmv', 'pay_amount'],
      dimensions: ['platform'],
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      platforms: ['douyin', 'taobao'],
      limit: 10,
    })

    assert.ok(sql.includes('FROM v_fact_trade_default f'), 'SQL 必须基于默认成交口径视图')
    assert.ok(sql.includes('f.biz_date >='), '必须包含日期范围条件')
    assert.ok(sql.includes('f.platform_code = ANY('), '必须包含平台参数化过滤')
    assert.ok(sql.includes('LIMIT'), '必须包含 LIMIT')
    assert.equal(metrics.length, 2)
    assert.equal(dimensions[0], 'platform')
    assert.ok(params.length >= 3)
  })

  test('无投流权限角色请求 ad_spend 触发 fail-closed 拦截', () => {
    assert.throws(
      () => {
        buildSafeQuery(
          { metrics: ['ad_spend'] },
          undefined,
          { role: 'brand_viewer' },
        )
      },
      /无权查询商业化投流与 ROI 敏感数据/,
    )
  })
})

describe('P1 地基：系统级 5 大取数原语 (Query Primitives)', () => {
  const pool = getPool()

  test('1. queryMetric: 成功查询全渠道真实成交与退款指标', async () => {
    const res = await queryMetric(pool, {
      metrics: ['gmv', 'refund_amount', 'net_sales'],
      startDate: '2026-08-01',
      endDate: '2026-11-15',
    })

    assert.equal(res.count, 1)
    const row = res.rows[0]
    assert.ok(Number(row.gmv) > 0, '总 GMV 必须大于 0')
    assert.ok(Number(row.net_sales) <= Number(row.gmv), '净销售额必须小于等于总 GMV')
  })

  test('2. comparePeriods: 正确计算周期环比与变化率', async () => {
    const comp = await comparePeriods(pool, {
      metrics: ['gmv'],
      currentStartDate: '2026-10-01',
      currentEndDate: '2026-10-31',
      previousStartDate: '2026-09-01',
      previousEndDate: '2026-09-30',
    })

    assert.ok(comp.current.gmv !== undefined)
    assert.ok(comp.previous.gmv !== undefined)
    assert.ok(Number.isFinite(comp.changePct.gmv))
  })

  test('3. drillDown: 正确下钻平台维度并计算份额占比', async () => {
    const drill = await drillDown(pool, {
      metric: 'gmv',
      dimension: 'platform',
      startDate: '2026-08-01',
      endDate: '2026-11-15',
    })

    assert.equal(drill.metric, 'gmv')
    assert.equal(drill.dimension, 'platform')
    assert.ok(drill.items.length > 0, '平台下钻至少包含数据')
    assert.ok(drill.items[0].value >= drill.items[drill.items.length - 1].value, '下钻结果降序排列')
  })

  test('4. detectAnomalies: 成功识别时序波动', async () => {
    const anomalies = await detectAnomalies(pool, {
      metric: 'gmv',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      thresholdPct: 30,
    })

    assert.ok(anomalies.length > 0, '应返回时序分析点')
    for (const a of anomalies) {
      assert.ok(a.date)
      assert.ok(typeof a.isAnomaly === 'boolean')
      assert.ok(['up', 'down', 'normal'].includes(a.direction))
    }
  })

  test('5. forecastTrend: 基于历史生成未来趋势外推预测', async () => {
    const trend = await forecastTrend(pool, {
      metric: 'gmv',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      periods: 5,
    })

    assert.ok(trend.history.length > 0, '应包含历史时序')
    assert.equal(trend.forecast.length, 5, '外推期数必须为 5 期')
    assert.ok(Number(trend.forecast[0].forecastValue) > 0, '预测值必须合理')
  })
})

describe('P1/P6 HTTP 接口与闭环验证 (BI Query & Session PnL)', () => {
  let app: FastifyInstance
  let adminSessionId: string
  let adminCookie: string

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    const pool = getPool()
    adminSessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 3600_000)
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, 1, $2)`,
      [adminSessionId, expiresAt],
    )
    adminCookie = `${env.SESSION_COOKIE_NAME}=${adminSessionId}`
  })

  after(async () => {
    const pool = getPool()
    if (adminSessionId) {
      await pool.query(`DELETE FROM user_sessions WHERE id = $1`, [adminSessionId])
    }
    await app.close()
  })

  test('GET /api/v1/bi/metric-query 成功调用统一取数原语返回指标', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bi/metric-query?metrics=gmv,refund_amount&startDate=2026-10-01&endDate=2026-10-15',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(Array.isArray(json.data.metrics))
    assert.ok(json.data.metrics.includes('gmv'))
    assert.ok(Array.isArray(json.data.rows))
    assert.ok(json.data.rows.length > 0)
    assert.ok(Number(json.data.rows[0].gmv) > 0)
  })

  test('GET /api/v1/bi/compare 成功计算周期环比与变动率', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/bi/compare?metrics=gmv&currentStartDate=2026-10-08&currentEndDate=2026-10-14&previousStartDate=2026-10-01&previousEndDate=2026-10-07',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.ok(json.data.current)
    assert.ok(typeof json.data.current.gmv === 'number')
    assert.ok(typeof json.data.previous.gmv === 'number')
    assert.ok(typeof json.data.changePct.gmv === 'number')
  })

  test('GET /api/v1/sessions/:id/pnl 成功返回场次盈亏，缺成本项返回 null 不伪造 0', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sessions/9002/pnl',
      headers: { cookie: adminCookie },
    })

    assert.equal(res.statusCode, 200)
    const json = res.json()
    assert.equal(json.success, true)
    assert.equal(json.data.sessionId, 9002)
    assert.ok(typeof json.data.gmv === 'number')
    assert.ok(typeof json.data.returnAmount === 'number')
    assert.ok(typeof json.data.netRevenue === 'number')
    assert.equal(json.data.netRevenue, Number((json.data.gmv - json.data.returnAmount).toFixed(2)))

    // 核心审计断点断言：缺失的主播佣金返回 null，而非虚假 0
    assert.equal(json.data.anchorCommission, null)
    assert.equal(json.data.isComplete, false)
    assert.ok(json.data.missingCosts.includes('anchor_commission'))
  })
})
