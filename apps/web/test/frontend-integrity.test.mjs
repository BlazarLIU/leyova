import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAllRoutes } from './_route-parser.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, '..')
const SRC_ROOT = path.join(WEB_ROOT, 'src')

const appSource = fs.readFileSync(path.join(SRC_ROOT, 'App.tsx'), 'utf8')
const manifestSource = fs.readFileSync(path.join(SRC_ROOT, 'data/route-manifest.ts'), 'utf8')
const navSource = fs.readFileSync(path.join(SRC_ROOT, 'data/route-manifest.ts'), 'utf8')
const topbarSource = fs.readFileSync(path.join(SRC_ROOT, 'components/layout/Topbar.tsx'), 'utf8')
const searchSource = fs.readFileSync(path.join(SRC_ROOT, 'components/common/GlobalSearch.tsx'), 'utf8')
const accountsSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/AccountsSection.tsx'), 'utf8')
const apiSource = fs.readFileSync(path.join(SRC_ROOT, 'services/api.ts'), 'utf8')

function extractAppRoutes() {
  const routes = new Map()
  const routeRegex = /<Route\s+path="([^"]+)"\s+element=\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\s*\/>/g
  let m
  while ((m = routeRegex.exec(appSource)) !== null) {
    const routePath = m[1]
    const elementExpr = m[2]
    const modMatch = elementExpr.match(/\bmodule="([^"]+)"/)
    const anyMatch = elementExpr.match(/\banyModules=\{\[([^\]]+)\]\}/)
    const isRedirect = elementExpr.includes('<Navigate ')
    routes.set(routePath, {
      module: modMatch ? modMatch[1] : null,
      anyModules: anyMatch
        ? [...anyMatch[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
        : [],
      isRedirect,
    })
  }
  return routes
}

function extractNavLinks() {
  const items = []
  const itemRegex = /\{\s*label:\s*'[^']+',[^}]*?\bhref:\s*'([^']+)'([^}]*)\}/g
  let m
  while ((m = itemRegex.exec(navSource)) !== null) {
    const href = m[1]
    const tail = m[2]
    const modMatch = tail.match(/\bmodule:\s*'([^']+)'/)
    items.push({ href, module: modMatch ? modMatch[1] : null })
  }
  return items
}

function extractTopbarModuleRequirements() {
  const blockMatch = topbarSource.match(/const ROUTE_MODULE_REQUIREMENTS:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\}/)
  assert.ok(blockMatch, 'Topbar.tsx should declare ROUTE_MODULE_REQUIREMENTS')
  const map = new Map()
  for (const m of blockMatch[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
    map.set(m[1], m[2])
  }
  return map
}

function extractAccountModuleNames() {
  const blockMatch = accountsSource.match(/const moduleNameMap:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\}/)
  assert.ok(blockMatch, 'AccountsSection.tsx should declare moduleNameMap')
  const set = new Set()
  for (const m of blockMatch[1].matchAll(/^\s*([a-z0-9_]+)\s*:/gm)) {
    set.add(m[1])
  }
  return set
}

describe('@leyova/web 前端架构、导航路由与权限契约测试', () => {
  const appRoutes = parseAllRoutes()
  const navLinks = extractNavLinks()
  const topbarModules = extractTopbarModuleRequirements()
  const moduleNames = extractAccountModuleNames()

  test('App.tsx 声明完整主路由且所有懒加载页面路径真实存在', () => {
    assert.ok(appRoutes.size >= 70, `预期至少 70 条前端路由，实际 ${appRoutes.size}`)

    const lazyImportRegex = /import\('@\/([^']+)'\)/g
    let checkedImports = 0
    let m
    // 经典业务路由已并入 route-manifest.ts，懒加载路径需同时在 App.tsx 与 manifest 中校验
    const allSource = `${appSource}\n${manifestSource}`
    while ((m = lazyImportRegex.exec(allSource)) !== null) {
      const rel = m[1]
      const tsxPath = path.join(SRC_ROOT, `${rel}.tsx`)
      const tsPath = path.join(SRC_ROOT, `${rel}.ts`)
      assert.ok(fs.existsSync(tsxPath) || fs.existsSync(tsPath), `懒加载目标模块缺失: @/${rel}`)
      checkedImports++
    }
    assert.ok(checkedImports >= 60, `预期至少检查 60 个懒加载导入，实际 ${checkedImports}`)
  })

  test('ops/ 业务域子目录已完成拆分，专属页面不再平铺在 pages/ops/ 根目录', () => {
    const movedPages = [
      ['session-products', 'SessionProductsPage.tsx'],
      ['product-center', 'InventoryCenterPage.tsx'],
      ['fulfillment', 'FulfillmentSlaPage.tsx'],
      ['after-sales', 'AfterSalesPage.tsx'],
      ['kol', 'KolCooperationPage.tsx'],
      ['customer-service', 'CustomerServicePage.tsx'],
      ['net-roi', 'NetRoiPage.tsx'],
      ['search-seo', 'SearchKeywordsPage.tsx'],
      ['members', 'MembersPage.tsx'],
    ]
    for (const [subdir, file] of movedPages) {
      const expected = path.join(SRC_ROOT, 'pages/ops', subdir, file)
      const legacy = path.join(SRC_ROOT, 'pages/ops', file)
      assert.ok(fs.existsSync(expected), `业务域页面应位于 ${subdir}/${file}`)
      assert.equal(fs.existsSync(legacy), false, `不应残留旧平铺文件 pages/ops/${file}`)
    }
  })

  test('route-manifest.ts 全量导航链接 100% 命中 App.tsx 有效路由', () => {
    assert.ok(navLinks.length > 0, 'route-manifest.ts 应解析出导航项')
    for (const { href, module } of navLinks) {
      assert.ok(href.startsWith('/'), `导航路径应以 / 开头: ${href}`)
      const route = appRoutes.get(href)
      assert.ok(route, `导航链接指向未注册路由: ${href}`)
      // 迁移期说明：AI 运营分支上线过程中，经典路由会以 <Navigate to="/ai-ops/..."> 作兼容跳转，
      // 因此这里只保证目标路径已注册（不出现 404），不强制要求非重定向。
      if (module && route.module) {
        assert.equal(module, route.module, `导航 (${href}) module=${module} 与 App.tsx module=${route.module} 不一致`)
      }
      if (module && route.anyModules.length > 0) {
        assert.ok(
          route.anyModules.includes(module),
          `导航 (${href}) module=${module} 应包含在 App.tsx anyModules=${route.anyModules.join(',')} 中`,
        )
      }
    }
  })

  test('独立模块路由 (/system/personnel, /system/rooms) 已挂载，废弃页面 (/content/config, RoiDashboardPage) 已清理', () => {
    assert.equal(appRoutes.get('/system/personnel')?.module, 'system_personnel_ops')
    assert.equal(appRoutes.get('/system/rooms')?.module, 'system_rooms')
    assert.equal(appRoutes.has('/content/config'), false, '/content/config 死路由应已移除')
    assert.equal(appRoutes.get('/bi/roi')?.isRedirect, true, '/bi/roi 应重定向至 /ops/net-roi')
    assert.equal(fs.existsSync(path.join(SRC_ROOT, 'pages/bi/RoiDashboardPage.tsx')), false)
    assert.equal(topbarSource.includes("'/bi/roi'"), false, 'Topbar 不应再包含已下线 /bi/roi')
    assert.equal(topbarSource.includes("'/content/config'"), false, 'Topbar 不应再包含已下线 /content/config')
  })

  test('GlobalSearch 快捷跳转与 Topbar 模块权限要求与 App.tsx 完全对齐', () => {
    for (const m of searchSource.matchAll(/url:\s*'([^']+)'/g)) {
      const targetUrl = m[1]
      const route = appRoutes.get(targetUrl)
      assert.ok(route && !route.isRedirect, `GlobalSearch 快捷路径失效: ${targetUrl}`)
    }

    for (const [routePath, reqModule] of topbarModules.entries()) {
      const route = appRoutes.get(routePath)
      if (!route || route.isRedirect) continue
      if (route.module) {
        assert.equal(reqModule, route.module, `Topbar (${routePath}) module=${reqModule} 与 App.tsx (${route.module}) 漂移`)
      } else if (route.anyModules.length > 0) {
        assert.ok(
          route.anyModules.includes(reqModule),
          `Topbar (${routePath}) module=${reqModule} 未被 App.tsx anyModules 覆盖`,
        )
      }
    }
  })

  test('AccountsSection moduleNameMap 覆盖全部前端引用模块且不包含已删除死模块 system_inventory', () => {
    assert.equal(moduleNames.has('system_inventory'), false, 'AccountsSection 不应保留已下线的 system_inventory')

    for (const route of appRoutes.values()) {
      if (route.module) assert.ok(moduleNames.has(route.module), `moduleNameMap 缺少模块文案: ${route.module}`)
      for (const m of route.anyModules) {
        assert.ok(moduleNames.has(m), `moduleNameMap 缺少模块文案: ${m}`)
      }
    }
    for (const { module } of navLinks) {
      if (module) assert.ok(moduleNames.has(module), `导航使用的模块 ${module} 缺少 moduleNameMap 文案`)
    }
  })

  test('API 客户端统一自动归一化 /api/ 与 /v1/ 前缀且携带 credentials', () => {
    assert.match(apiSource, /endpoint\.startsWith\('\/api\/'\)/)
    assert.match(apiSource, /clean\.startsWith\('\/v1\/'\)/)
    assert.match(apiSource, /credentials:\s*'include'/)
  })
})

