import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import crypto from 'node:crypto'
import { withRlsContext, withSystemRlsContext } from '../src/lib/rls.js'
import { getPool } from '../src/lib/db.js'

describe('双租户交叉隔离集成测试 (Gate G2)', () => {
  const pool = getPool()
  const tenantA = 1
  const tenantB = 2

  it('租户 A 创建的决策闭环数据，租户 B 经由 RLS 上下文无法查询', async () => {
    // 1. 在租户 A 上下文插入一条 decision_case
    const defaultOptions = JSON.stringify([
      { key: 'exec', label: '执行预算再分配' },
      { key: 'no_action', label: '维持现状不做' },
    ])
    const caseId = await withSystemRlsContext(tenantA, async (client) => {
      const res = await client.query(
        `INSERT INTO public.decision_cases
           (tenant_id, case_no, title, problem_statement, domain, status, scene_key, options)
         VALUES ($1, 'TEST-DC-A-01', 'Tenant A Secret Case', 'Tenant A Problem', 'ads', 'DRAFT', 'SCENE-A', $2::jsonb)
         RETURNING id`,
        [tenantA, defaultOptions]
      )
      return res.rows[0].id
    })

    // 2. 插入对应的 decision_memo_versions
    await withSystemRlsContext(tenantA, async (client) => {
      await client.query(
        `INSERT INTO public.decision_memo_versions
           (case_id, tenant_id, version, question)
         VALUES ($1, $2, 1, 'Secret Question of Tenant A')`,
        [caseId, tenantA]
      )
    })

    // 3. 在租户 A 查询：可查到
    const resA = await withSystemRlsContext(tenantA, async (client) => {
      const r = await client.query(
        `SELECT id, title FROM public.decision_cases WHERE id = $1`,
        [caseId]
      )
      return r.rows
    })
    assert.equal(resA.length, 1)
    assert.equal(resA[0].title, 'Tenant A Secret Case')

    // 4. 在租户 B 上下文使用 leyova_app 角色执行相同查询：RLS 强制隔离返回空
    const resB = await withRlsContext(
      {
        id: 9999,
        tenantId: tenantB,
        role: 'operator',
        userType: 'agency_staff',
      } as any,
      async (client) => {
        const r = await client.query(
          `SELECT id, title FROM public.decision_cases WHERE id = $1`,
          [caseId]
        )
        return r.rows
      }
    )
    assert.equal(resB.length, 0, '租户 B 绝不能越权读到租户 A 的决策数据')

    // 5. 租户 B 查询租户 A 的 decision_memo_versions 也必须为空
    const memoB = await withRlsContext(
      {
        id: 9999,
        tenantId: tenantB,
        role: 'operator',
        userType: 'agency_staff',
      } as any,
      async (client) => {
        const r = await client.query(
          `SELECT id FROM public.decision_memo_versions WHERE case_id = $1`,
          [caseId]
        )
        return r.rows
      }
    )
    assert.equal(memoB.length, 0, '租户 B 绝不能越权读到租户 A 的 Memo 版本记录')

    // 清理测试数据
    await withSystemRlsContext(tenantA, async (client) => {
      await client.query(`DELETE FROM public.decision_cases WHERE id = $1`, [caseId])
    })
  })

  it('缺失租户上下文时（未设置 app.tenant_id），RLS 策略 fail-closed', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE leyova_app')
      // 未执行 set_config('app.tenant_id', ...)
      const r = await client.query(`SELECT id FROM public.decision_memo_versions LIMIT 5`)
      assert.equal(r.rows.length, 0, '未设置租户上下文时必须默认拦截')
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })
})
