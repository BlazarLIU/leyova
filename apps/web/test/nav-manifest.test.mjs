import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { parseAllRoutes } from './_route-parser.mjs'

/**
 * route-manifest 导航契约测试（P1 重构）
 *
 * 背景：旧 platform-navigation.ts 有 131 处 href 声明 / 88 个唯一页面 / 43 处重复挂载，
 * 且「运营工具」一组混装 9+ 业务域。本次重构收敛为「route-manifest.ts 一份清单 + 9 大工作面」。
 * 本测试把这条契约锁死，防止后续又退回重复挂载 / 组数膨胀 / 权限漂移。
 */
const SRC_ROOT = path.join(process.cwd(), 'src')
const manifestSource = fs.readFileSync(path.join(SRC_ROOT, 'data/route-manifest.ts'), 'utf8')

/**
 * 「本人级」页面：登录即可访问，由服务端按权限过滤内容，不受模块守卫约束。
 * 例外必须显式登记，避免模块守卫被悄悄绕过。
 */
const SELF_ROUTES = new Set(['/workbench'])

function parseList(raw) {
  return raw ? [...raw.matchAll(/'([^']+)'/g)].map((m) => m[1]) : []
}

function parseEntries() {
  const entries = []
  // manifest 条目含 props 花括号，按行解析（每行一条）
  for (const line of manifestSource.split('\n')) {
    const lm = line.match(/\{\s*label:\s*'([^']+)',\s*href:\s*'([^']+)'(.*)\},\s*$/)
    if (!lm) continue
    const tail = lm[3]
    const mod = tail.match(/\bmodule:\s*'([^']+)'/)
    const grp = tail.match(/\bgroup:\s*'([a-z]+)'/)
    const par = tail.match(/\bparent:\s*'([^']+)'/)
    const any = tail.match(/\banyModules:\s*\[([^\]]+)\]/)
    const roles = tail.match(/\broles:\s*\[([^\]]+)\]/)
    entries.push({
      label: lm[1],
      href: lm[2],
      module: mod ? mod[1] : null,
      group: grp ? grp[1] : null,
      parent: par ? par[1] : null,
      anyModules: parseList(any ? any[1] : null),
      roles: parseList(roles ? roles[1] : null),
    })
  }
  return entries
}

describe('route-manifest 导航契约（收敛后单轨制）', () => {
  const entries = parseEntries()
  const appRoutes = parseAllRoutes()

  test('每个条目结构完整（label / href / group）且不含已下线模块', () => {
    assert.ok(entries.length >= 50, `导航条目应 >= 50，实际 ${entries.length}`)
    const retiredPaths = [
      '/ops/kol', '/ops/cs', '/ops/fulfillment', '/ops/after-sales',
      '/ops/members', '/content/video-create', '/content/video-data',
      '/content/center-config', '/hrbp/workspace', '/bi/dashboard',
      '/bi/refund-analysis', '/bi/anomaly-detection', '/shop/kuaishou/fans-team',
    ]
    for (const e of entries) {
      assert.ok(e.label, `缺少 label: ${e.href}`)
      assert.ok(e.href.startsWith('/'), `href 应以 / 开头: ${e.href}`)
      assert.ok(e.group, `缺少 group（未归属工作面）: ${e.href}`)
      assert.equal(retiredPaths.includes(e.href), false, `不应再包含已下线入口: ${e.href}`)
    }
  })

  test('恰好 8 个核心业务工作面（已清除 fulfillment 下线分组）', () => {
    const groups = new Set(entries.map((e) => e.group))
    assert.equal(groups.size, 8, `分组数应为 8，实际 ${groups.size}: ${[...groups].join(',')}`)
    assert.equal(groups.has('fulfillment'), false, '已下线的 fulfillment 分组不应再有条目')
  })

  test('每个业务路由唯一归属（无重复 href）', () => {
    const hrefs = entries.map((e) => e.href)
    const dup = hrefs.filter((h, i) => hrefs.indexOf(h) !== i)
    assert.deepEqual([...new Set(dup)], [], `存在重复挂载: ${[...new Set(dup)].join(', ')}`)
  })

  test('每个业务路由必须有前端模块守卫（module 非空）', () => {
    for (const e of entries) {
      if (SELF_ROUTES.has(e.href)) continue
      assert.ok(e.module, `导航条目缺少 module（会被 fail-closed 权限过滤掉）: ${e.href}`)
    }
  })

  test('manifest 权限规格与路由注册表完全对等（module / anyModules / roles）', () => {
    for (const e of entries) {
      if (SELF_ROUTES.has(e.href)) continue
      const route = appRoutes.get(e.href)
      assert.ok(route, `路由未注册: ${e.href}`)
      // 迁移期：部分经典路由已改为 <Navigate to="/ai-ops/...">，跳过权限对等校验
      if (route.isRedirect) continue
      if (e.anyModules.length > 0) {
        assert.deepEqual(
          [...route.anyModules].sort(),
          [...e.anyModules].sort(),
          `${e.href} 的 anyModules 与路由不一致`,
        )
      } else if (e.roles.length > 0) {
        assert.deepEqual(
          [...route.roles].sort(),
          [...e.roles].sort(),
          `${e.href} 的 roles 与路由不一致`,
        )
        if (route.module) {
          assert.equal(route.module, e.module, `${e.href} 的 module 与路由不一致`)
        }
      } else {
        assert.equal(route.module, e.module, `${e.href} 的 module 与路由不一致`)
      }
    }
  })
})
