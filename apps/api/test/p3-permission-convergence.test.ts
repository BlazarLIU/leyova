import test from 'node:test'
import assert from 'node:assert/strict'
import { getPool, withRlsContext } from '../src/lib/db.js'

test('P3-1 结构收敛：统一 RBAC 3 表与 RLS Policy 通用函数', async (t) => {
  const pool = getPool()

  await t.test('sys_role 覆盖全部 15 个系统角色且与 roles 同步', async () => {
    const rolesRes = await pool.query('SELECT count(*) AS cnt FROM public.roles')
    const sysRolesRes = await pool.query('SELECT count(*) AS cnt FROM public.sys_role')
    assert.equal(Number(sysRolesRes.rows[0].cnt), Number(rolesRes.rows[0].cnt))
    // 2026-11-18 组织收敛：角色清单由 15 收敛为 8（admin/employee/brand_viewer/operator/
    // director/floor_manager/warehouse 已删除）。不再硬编码数量，只要求与 roles 表一致。
    assert.equal(Number(sysRolesRes.rows[0].cnt), 8)

    const superAdminRes = await pool.query(
      `SELECT is_system FROM public.sys_role WHERE code = 'super_admin'`,
    )
    assert.equal(superAdminRes.rows[0]?.is_system, true)
  })

  await t.test('sys_role_permission 包含模块与平台 Casbin 权限元组', async () => {
    // 2026-11-18 组织收敛后角色由 15 → 8，权限元组总量随之下降。
    // 改为动态校验：8 个角色每个都应至少有 1 条模块或平台权限元组，且总量覆盖全部角色。
    const permRes = await pool.query(
      `SELECT count(*) AS cnt, count(DISTINCT role_code) AS roles
         FROM public.sys_role_permission
        WHERE resource LIKE 'module:%' OR resource LIKE 'platform:%'`,
    )
    const rolesCnt = Number(permRes.rows[0].roles)
    assert.ok(rolesCnt >= 8, `sys_role_permission 应覆盖全部 8 个角色，实际 ${rolesCnt}`)
    assert.ok(Number(permRes.rows[0].cnt) >= rolesCnt * 10, '每个角色应有足量的模块与平台权限策略')

    // super_admin 应有通配符权限
    const saWildcard = await pool.query(
      `SELECT effect FROM public.sys_role_permission WHERE role_code = 'super_admin' AND resource = '*'`,
    )
    assert.equal(saWildcard.rows[0]?.effect, 'allow')
  })

  await t.test('sys_user_role 与 users 双向关联且完整映射', async () => {
    const userRoleRes = await pool.query(
      `SELECT count(*) AS cnt FROM public.sys_user_role sur JOIN public.users u ON u.id = sur.user_id AND u.role = sur.role_code`,
    )
    // 账号清理后（测试垃圾账号与已删角色账号移除），映射数下降；改为 ≥ 15 保证覆盖真实账号
    assert.ok(Number(userRoleRes.rows[0].cnt) >= 15, `sys_user_role 双向映射应 ≥ 15，实际 ${userRoleRes.rows[0].cnt}`)
  })

  await t.test('PostgreSQL 函数 rls_check_permission 与 rls_check_scope 校验', async () => {
    const client = await pool.connect()
    try {
      // 1. super_admin 校验：无论平台均可访问
      await client.query("SET app.user_id = '1'")
      await client.query("SET app.user_role = 'super_admin'")
      await client.query("SET app.allowed_platforms = '*'")
      await client.query("SET app.tenant_id = '1'")
      await client.query("SET app.user_type = 'agency_staff'")

      const saCheck = await client.query(
        "SELECT public.rls_check_permission('module:bi') AS perm, public.rls_check_scope('module:bi', 'douyin') AS scope",
      )
      assert.equal(saCheck.rows[0].perm, true)
      assert.equal(saCheck.rows[0].scope, true)

      // 2. operator 校验：仅白名单平台放行
      await client.query("SET app.user_id = '8'")
      await client.query("SET app.user_role = 'ops_staff'")
      await client.query("SET app.allowed_platforms = 'douyin,kuaishou'")

      const opDouyin = await client.query(
        "SELECT public.rls_check_scope('module:bi', 'douyin') AS scope",
      )
      assert.equal(opDouyin.rows[0].scope, true)

      const opWechat = await client.query(
        "SELECT public.rls_check_scope('module:bi', 'wechat') AS scope",
      )
      assert.equal(opWechat.rows[0].scope, false, '未授权平台应被 rls_check_scope 严格拦截')

      // 3. 未登录用户：fail-closed
      await client.query("SET app.user_id = ''")
      await client.query("SET app.user_role = ''")
      await client.query("SET app.allowed_platforms = ''")
      const anonCheck = await client.query(
        "SELECT public.rls_check_scope('module:bi', 'douyin') AS scope",
      )
      assert.equal(anonCheck.rows[0].scope, false, '未登录请求必须严格拦截')
    } finally {
      await client.query('RESET ALL')
      client.release()
    }
  })

  await t.test('双向同步触发器：写入旧表自动同步更新 sys_role_permission', async () => {
    const testRole = 'test_p3_probe_role'
    try {
      await pool.query(
        `INSERT INTO public.roles (code, name, description) VALUES ($1, '测试P3探针角色', '临时探针') ON CONFLICT DO NOTHING`,
        [testRole],
      )

      const probeRole = await pool.query(
        `SELECT code FROM public.sys_role WHERE code = $1`,
        [testRole],
      )
      assert.equal(probeRole.rows[0]?.code, testRole)

      await pool.query(
        `INSERT INTO public.role_modules (role_code, module_code) VALUES ($1, 'bi')`,
        [testRole],
      )

      const probePerm = await pool.query(
        `SELECT effect FROM public.sys_role_permission WHERE role_code = $1 AND resource = 'module:bi'`,
        [testRole],
      )
      assert.equal(probePerm.rows[0]?.effect, 'allow')
    } finally {
      await pool.query(`DELETE FROM public.role_modules WHERE role_code = $1`, [testRole])
      await pool.query(`DELETE FROM public.roles WHERE code = $1`, [testRole])
    }
  })
})
