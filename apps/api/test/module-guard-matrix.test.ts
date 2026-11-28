/**
 * module-guard-matrix.test.ts — 角色 × 端点权限矩阵（W2.5 / 验收项 F-12）
 *
 * 两类断言：
 *   1. 契约：所有非公开 API 路由都必须能解析出模块，且该模块存在于 system_modules。
 *      （fail-closed 守卫下，漏配映射 = 非超管全 403，属最高优先级缺陷）
 *   2. 矩阵：8 个角色 × 代表性端点，逐条核对「放行 / 拒绝」是否符合角色基线授权。
 *
 * 数据来自真实库（resolveAccess 读 sys_role_permission / platform_capability_matrix），
 * 不 mock，改动授权表即可让本测试失败提示回归。
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'

import { buildApp } from '../src/app.js'
import { getPool } from '../src/lib/db.js'
import { resolveAccess, canAccessModule } from '../src/lib/access-resolver.js'
import {
  getModuleMapForAudit,
  isPublicPath,
  resolveEffectiveModule,
  resolveRequiredModule,
  resolveRequiredModules
} from '../src/lib/module-guard.js'

/** 登录即可访问、不属于任何业务模块的路径 */
const EXEMPT_PREFIXES = [
  '/api/v1/auth/',
  '/api/v1/health',
  '/api/v1/ready',
  '/api/v1/system/modules',
  '/api/v1/system/roles',
]

const isExempt = (p: string) => EXEMPT_PREFIXES.some((x) => p.startsWith(x))

describe('模块映射契约', () => {
  let app: FastifyInstance

  before(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  after(async () => {
    await app.close()
  })

  test('所有业务路由都能解析出模块（无 fail-closed 漏配）', async () => {
    const orphans: string[] = []
    for (const r of app.__routeCollector.list()) {
      const p = r.openapiPath
      if (isPublicPath(p) || isExempt(p)) continue
      if (!resolveRequiredModule(p)) orphans.push(`${r.method} ${p}`)
    }
    assert.deepEqual(
      orphans,
      [],
      `以下路径未在 MODULE_MAP 声明，非超管会被 403：\n${orphans.join('\n')}`,
    )
  })

  test('映射到的模块全部存在于 system_modules（无幽灵模块码）', async () => {
    const { rows } = await getPool().query<{ code: string; is_enabled: boolean }>(
      'SELECT code, is_enabled FROM public.system_modules',
    )
    const known = new Map(rows.map((r) => [r.code, r.is_enabled]))

    const unknown: string[] = []
    const disabled: string[] = []
    for (const { prefix, module } of getModuleMapForAudit()) {
      if (module === '__self__') continue
      if (!known.has(module)) unknown.push(`${prefix} → ${module}`)
      else if (!known.get(module)) disabled.push(`${prefix} → ${module}`)
    }
    assert.deepEqual(unknown, [], `映射了不存在的模块码：\n${unknown.join('\n')}`)
    assert.deepEqual(disabled, [], `映射了已停用的模块：\n${disabled.join('\n')}`)
  })

  test('映射顺序：更具体的前缀必须先于宽泛前缀', () => {
    const map = getModuleMapForAudit()
    for (let i = 0; i < map.length; i++) {
      for (let j = i + 1; j < map.length; j++) {
        const a = map[i]
        const b = map[j]
        // 后面的 b 比前面的 a 更具体（a 是 b 的前缀）→ a 会抢先匹配，属配置错误
        assert.ok(
          !(b.prefix.startsWith(a.prefix) && b.prefix !== a.prefix),
          `前缀顺序错误：「${a.prefix}」排在更具体的「${b.prefix}」之前`,
        )
      }
    }
  })
})

describe('角色 × 端点权限矩阵', () => {
  const ROLES = [
    'super_admin',
    'ops_director',
    'ops_staff',
    'ad_buyer',
    'controller',
    'hrbp',
  ] as const

  /** 代表性端点：覆盖 W8–W13 新域与审计遗留路径 */
  const ENDPOINTS: Array<{ path: string; expect: Record<string, boolean> }> = [
    // 媒体流水线（ai_content）
    //   注：hrbp 持有父模块 ai，按 resolveEffectiveModule 的继承规则覆盖全部 ai_* 子模块。
    {
      path: '/api/v1/media/assets',
      expect: { super_admin: true, ops_staff: true, ad_buyer: false, controller: false, hrbp: true, ops_director: true }
    },
    // 脚本生成（ai_content）
    {
      path: '/api/v1/generation/drafts',
      expect: { super_admin: true, ops_staff: true, ad_buyer: false }
    },
    // F.1 全类型剪辑模板（ai_content）
    {
      path: '/api/v1/video/templates',
      expect: { super_admin: true, ops_director: true, ops_staff: true, ad_buyer: false, controller: false, hrbp: true }
    },
    // F.2 编导工作台（ai_content）
    {
      path: '/api/v1/director/overview',
      expect: { super_admin: true, ops_director: true, ops_staff: true, ad_buyer: false, controller: false, hrbp: true }
    },
    // 千川投放（net_roi）
    {
      path: '/api/v1/qianchuan/overview',
      expect: { super_admin: true, ad_buyer: true, ops_director: true, ops_staff: true, hrbp: true, controller: false }
    },
    // 集成中心（system_ai）：仅超管
    {
      path: '/api/v1/integrations',
      expect: { super_admin: true, ops_director: false, ops_staff: false, ad_buyer: false, controller: false, hrbp: false }
    },
    // 知识平台（system_ai）：仅超管
    {
      path: '/api/v1/kb/collections',
      expect: { super_admin: true, ops_staff: false }
    },
    // AI 助手配置（ai_governance）：仅超管
    {
      path: '/api/v1/assistant/agents',
      expect: { super_admin: true, ops_director: false, ops_staff: false }
    },
    // AI 对话（ai_chat / 父模块继承）
    {
      path: '/api/v1/assistant/runs',
      expect: { super_admin: true, ops_staff: true, controller: true, ad_buyer: true, ops_director: true, hrbp: true }
    },
    // 财务总账（net_roi）：审计遗留路径
    {
      path: '/api/v1/finance/gl-vouchers',
      expect: { super_admin: true, ad_buyer: true, hrbp: true, ops_director: true, ops_staff: true, controller: false }
    },
    // 话术库模板（ops）：审计遗留路径
    {
      path: '/api/v1/scripts/templates',
      expect: { super_admin: true, ops_staff: true, ops_director: true, ad_buyer: true, controller: false, hrbp: true }
    },
    // 指标注册（bi）：审计遗留路径
    {
      path: '/api/v1/metrics',
      expect: { super_admin: true, ops_staff: true, ops_director: true, ad_buyer: true, hrbp: true, controller: false }
    },
    // 选品推荐（ai_assortment / 父模块继承）
    {
      path: '/api/v1/assortment/recommend',
      expect: { super_admin: true, ops_staff: true, ops_director: true, hrbp: true, controller: false }
    },
    // 售后订单时间轴（after_sales）
    {
      path: '/api/v1/orders/1/timeline',
      expect: { super_admin: true, ops_staff: true, ops_director: true, controller: false, ad_buyer: false }
    },
    // 系统账号（system_users）：仅超管
    {
      path: '/api/v1/system/users',
      expect: { super_admin: true, ops_director: false, ops_staff: false }
    },
    // 主播管理（anchor）
    {
      path: '/api/v1/anchors',
      expect: { super_admin: true, hrbp: true, ops_staff: true, ops_director: true, controller: true, ad_buyer: false }
    },
    // 客服会话（customer_service）
    {
      path: '/api/v1/customer-service/conversations',
      expect: { super_admin: true, ops_staff: true, ad_buyer: false }
    },
    // 能力看板：前端按 ops 或 anchor 开放，后端任一模块即放行
    {
      path: '/api/v1/ops/capabilities',
      expect: { super_admin: true, ops_director: true, ops_staff: true, ad_buyer: true, hrbp: true, controller: true }
    },
    // 改进任务：页面按 system_tasks 或 ops 开放，后端与页面同口径
    {
      path: '/api/v1/system/tasks',
      expect: { super_admin: true, ops_director: true, ops_staff: true, ad_buyer: true, hrbp: true, controller: false }
    },
    // 业务化自动化健康度：对应 ops 模块（超管/运营/投放等可用，中控按 ops 隔离），写补偿另受 requireRole 约束
    {
      path: '/api/v1/system/automation-health',
      expect: { super_admin: true, ops_director: true, ops_staff: true, ad_buyer: true, hrbp: true, controller: false }
    },
  ]

  let accessByRole: Map<string, Awaited<ReturnType<typeof resolveAccess>>>

  before(async () => {
    const pool = getPool()
    const { rows } = await pool.query<{ id: number }>(
      `SELECT DISTINCT ON (role) id, role FROM public.users
        WHERE status = 1 AND role = ANY($1::text[])
        ORDER BY role, id`,
      [ROLES as unknown as string[]],
    )
    const userIdByRole = new Map(rows.map((r: any) => [r.role as string, Number(r.id)]))

    accessByRole = new Map()
    for (const role of ROLES) {
      const userId = userIdByRole.get(role)
      if (!userId) continue // 该角色暂无真实账号，矩阵跳过（由下面的覆盖率断言兜底）
      accessByRole.set(
        role,
        await resolveAccess({ userId, role, userType: 'agency_staff', tenantId: 1 }),
      )
    }
  })

  after(async () => {
    // 纯只读，无需清理
  })

  test('矩阵覆盖至少 6 个角色（真实账号存在性）', () => {
    assert.ok(
      accessByRole.size >= 6,
      `可验证角色仅 ${accessByRole.size} 个：${[...accessByRole.keys()].join(',')}。` +
      '角色矩阵需要每个角色至少一个真实账号，否则权限回归无法验证。',
    )
  })

  for (const endpoint of ENDPOINTS) {
    test(`端点 ${endpoint.path} 的跨角色放行符合预期`, () => {
      const moduleCodes = resolveRequiredModules(endpoint.path)
      assert.ok(moduleCodes, `端点 ${endpoint.path} 未映射模块`)
      assert.ok(!moduleCodes!.includes('__self__'), `端点 ${endpoint.path} 不应为 __self__`)

      const mismatches: string[] = []
      for (const [role, expected] of Object.entries(endpoint.expect)) {
        const access = accessByRole.get(role)
        if (!access) continue // 无真实账号，跳过该角色
        const actual = moduleCodes!.some((m) =>
          canAccessModule(access, null, resolveEffectiveModule(access, m)),
        )
        if (actual !== expected) {
          mismatches.push(`${role}: 期望 ${expected ? '放行' : '拒绝'}，实际 ${actual ? '放行' : '拒绝'}（模块 ${moduleCodes!.join('|')}）`)
        }
      }
      assert.deepEqual(mismatches, [], `${endpoint.path} 权限不符：\n${mismatches.join('\n')}`)
    })
  }

  /**
   * 回归：P0 侧栏/导航「可见但进去就 403」。
   *
   * 事故形态：菜单按 A 模块渲染，页面主数据却走 B 模块的接口，
   * 于是用户能点进页面，里面全部 403 或空白（平台切换器、场次排品下拉、
   * AI 运营分支 19–22 项导航均曾如此）。
   *
   * 这里锁死几条「页面壳层基础数据」必须对所有登录角色可达，
   * 防止再把它们挂到管理员专属模块下。
   */
  const SHELL_DATA_ENDPOINTS: Array<{ path: string; why: string }> = [
    { path: '/api/v1/platforms', why: '顶栏平台切换器 / 首页平台上下文（所有角色都要）' },
    { path: '/api/v1/platforms/douyin/shops', why: '店铺选择器（所有角色都要）' },
    { path: '/api/v1/system/promotions', why: '场次排品/活动管理的大促活动下拉（controller、video_editor 无 system_promotions）' },
    { path: '/api/v1/system/rooms', why: '活动管理的直播间下拉（ad_buyer 无 system_rooms）' },
  ]

  for (const item of SHELL_DATA_ENDPOINTS) {
    test(`基础数据端点 ${item.path} 对所有角色可达（${item.why}）`, () => {
      const moduleCode = resolveRequiredModule(item.path)
      assert.equal(
        moduleCode,
        '__self__',
        `${item.path} 应映射为 __self__（登录即可），当前为 ${moduleCode}：` +
        '挂到具体模块会让未授权的角色连页面壳层都渲染不出来',
      )
      // __self__ 在 checkModuleAccess 中直接放行，不依赖角色授权
      assert.ok(accessByRole.size >= 6, '角色矩阵应至少覆盖 6 个真实角色')
    })
  }
})
