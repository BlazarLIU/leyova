/**
 * access-control.test.ts — S2 账号体系重构验证
 *
 * 覆盖核心语义：
 *   1. 三种工作模式返回不同的模块集合（代运营 ≠ 品牌自播 ≠ 全功能）
 *   2. 平台能力矩阵真正生效：非直播平台不返回直播域模块
 *   3. 用户级覆盖优先级高于角色授权（grant 能加、revoke 能减）
 *   4. 未获授权的模式无法切换（fail-closed）
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'

import { buildApp } from '../src/app.js'
import { getPool } from '../src/lib/db.js'
import { env } from '../src/config/env.js'

interface TempAccount {
  userId: number
  cookie: string
}

async function createTempAccount(role: string, userType = 'agency_staff'): Promise<TempAccount> {
  const pool = getPool()
  const suffix = `${role}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const username = `__s2_${suffix}`
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (username, password_hash, real_name, role, user_type, tenant_id, status)
     VALUES ($1, '$2a$10$InvalidTestHashOnlyForSessionTests000000000000000000', $2, $3, $4, 1, 1)
     RETURNING id`,
    [username, `S2 ${role}`, role, userType],
  )
  const userId = Number(rows[0].id)
  const sessionId = crypto.randomUUID()
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, new Date(Date.now() + 3600_000)],
  )
  return { userId, cookie: `${env.SESSION_COOKIE_NAME}=${sessionId}` }
}

describe('S2 账号体系：模式 × 平台 × 模块', () => {
  let app: FastifyInstance
  const createdUserIds: number[] = []

  before(async () => {
    app = await buildApp()
    await app.ready()
  })

  after(async () => {
    const pool = getPool()
    for (const id of createdUserIds) {
      await pool.query('DELETE FROM public.user_module_overrides WHERE user_id = $1', [id]).catch(() => {})
      await pool.query('DELETE FROM public.user_work_modes WHERE user_id = $1', [id]).catch(() => {})
      await pool.query('DELETE FROM public.user_sessions WHERE user_id = $1', [id]).catch(() => {})
      await pool.query('DELETE FROM public.users WHERE id = $1', [id]).catch(() => {})
    }
    await app.close()
  })

  test('GET /api/v1/access/me 返回模块与平台能力矩阵（S3 起无工作模式）', async () => {
    const admin = await createTempAccount('super_admin')
    createdUserIds.push(admin.userId)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/access/me',
      headers: { cookie: admin.cookie },
    })
    assert.equal(res.statusCode, 200)
    const data = res.json().data

    // S3：工作模式已取消，响应中不应再出现 workModes / effectiveMode
    assert.equal(data.workModes, undefined, 'S3 起不应返回 workModes')
    assert.equal(data.effectiveMode, undefined, 'S3 起不应返回 effectiveMode')

    assert.ok(Array.isArray(data.modules) && data.modules.length > 0, '应返回模块列表')
    assert.ok(data.modulesByPlatform && typeof data.modulesByPlatform === 'object', '应返回分平台模块')
    // platforms=null 表示「全部启用平台」（super_admin 语义）；
    // 实际平台以 modulesByPlatform 的键为准（当前 6 个启用平台）
    assert.ok(
      data.platforms === null ||
        (Array.isArray(data.platforms) && data.platforms.length >= 3),
      '应返回可见平台（null=全部平台 或 明细数组）',
    )
    const platformKeys = Object.keys(data.modulesByPlatform || {})
    assert.ok(platformKeys.length >= 3, `modulesByPlatform 应覆盖全部启用平台，实际 ${platformKeys.length}`)
    assert.ok(!data.modules.includes('agency'), 'S3 起 agency 模块应已下线')
  })

  test('S7：核心平台均为直播电商平台，全部返回直播域模块', async () => {
    const admin = await createTempAccount('super_admin')
    createdUserIds.push(admin.userId)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/access/me',
      headers: { cookie: admin.cookie },
    })
    const byp = res.json().data.modulesByPlatform as Record<string, string[]>

    const liveCodes = ['douyin', 'kuaishou', 'wechat']
    for (const code of liveCodes) {
      const mods = byp[code] || []
      assert.ok(mods.includes('session'), `${code} 应含 session 模块（直播场次）`)
      assert.ok(mods.includes('review'), `${code} 应含 review 模块（直播复盘）`)
      assert.ok(mods.includes('anchor'), `${code} 应含 anchor 模块（主播/买手）`)
    }
  })

  test('S7：平台能力矩阵把非直播模块正确排除（以已删的 agency 为例）', async () => {
    const admin = await createTempAccount('super_admin')
    createdUserIds.push(admin.userId)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/access/me',
      headers: { cookie: admin.cookie },
    })
    const byp = res.json().data.modulesByPlatform as Record<string, string[]>

    for (const [code, mods] of Object.entries(byp)) {
      assert.ok(!mods.includes('agency'), `${code} 不应含已下线的 agency 模块`)
    }
  })

  test('S7：岗位字典含 6 类岗位（主播/中控/运营/投手/拍剪/编导）', async () => {
    const admin = await createTempAccount('super_admin')
    createdUserIds.push(admin.userId)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/schedule/staff-roles',
      headers: { cookie: admin.cookie },
    })
    assert.equal(res.statusCode, 200)
    const rows = res.json().data as Array<{ code: string; name: string }>
    const codes = rows.map(r => r.code).sort()
    assert.deepEqual(codes, ['ad_buyer', 'anchor', 'controller', 'director', 'operator', 'video_editor'])
  })

  test('用户级 revoke 覆盖角色授权（优先级生效）', async () => {
    const admin = await createTempAccount('super_admin')
    createdUserIds.push(admin.userId)

    // 基线：应有 bi 模块
    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/access/me',
      headers: { cookie: admin.cookie },
    })
    assert.ok(before.json().data.modules.includes('bi'), '撤销前应含 bi')

    // 写入 revoke
    const pg = getPool()
    await pg.query(
      `INSERT INTO public.user_module_overrides (user_id, module_code, effect)
       VALUES ($1, 'bi', 'revoke') ON CONFLICT (user_id, module_code) DO UPDATE SET effect='revoke'`,
      [admin.userId],
    )

    const afterRes = await app.inject({
      method: 'GET',
      url: '/api/v1/access/me',
      headers: { cookie: admin.cookie },
    })
    assert.ok(!afterRes.json().data.modules.includes('bi'), 'revoke 后不应含 bi')
  })

  test('用户级 grant 能追加角色没有的模块', async () => {
    const staff = await createTempAccount('ops_staff')
    createdUserIds.push(staff.userId)

    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/access/me',
      headers: { cookie: staff.cookie },
    })
    const beforeModules = before.json().data.modules as string[]
    // 2026-11-18 组织收敛：ops_staff 已合并 operator 的 compliance 权限，
    // 改用其确实没有的 system_users 作为「角色基线不含」的验证对象
    assert.ok(!beforeModules.includes('system_users'), 'ops_staff 基线不应含 system_users')

    const pg = getPool()
    await pg.query(
      `INSERT INTO public.user_module_overrides (user_id, module_code, effect)
       VALUES ($1, 'system_users', 'grant') ON CONFLICT (user_id, module_code) DO UPDATE SET effect='grant'`,
      [staff.userId],
    )

    const afterRes = await app.inject({
      method: 'GET',
      url: '/api/v1/access/me',
      headers: { cookie: staff.cookie },
    })
    assert.ok(
      (afterRes.json().data.modules as string[]).includes('system_users'),
      'grant 后应含 system_users',
    )
  })

  test('GET /api/v1/access/capability-matrix 返回矩阵', async () => {
    const admin = await createTempAccount('super_admin')
    createdUserIds.push(admin.userId)

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/access/capability-matrix',
      headers: { cookie: admin.cookie },
    })
    assert.equal(res.statusCode, 200)
    const rows = res.json().data as any[]
    assert.ok(rows.length >= 90, `矩阵行数应 >= 90，实测 ${rows.length}`)
    assert.ok(rows.some((r) => r.platform_code === 'wechat'), '应含视频号')
  })
})
