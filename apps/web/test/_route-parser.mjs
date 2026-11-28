import fs from 'node:fs'
import path from 'node:path'

/**
 * 测试用路由解析器：合并 App.tsx（AI 分支/非导航/兜底）与 route-manifest.ts（经典业务路由）。
 * P1 收尾后，manifest 同时承载「导航 + 路由规格」，classic-routes 由它生成 <Route>。
 */
const SRC = path.join(process.cwd(), 'src')

export const appSource = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8')
export const manifestSource = fs.readFileSync(path.join(SRC, 'data/route-manifest.ts'), 'utf8')

function parseList(raw) {
  return raw ? [...raw.matchAll(/'([^']+)'/g)].map((m) => m[1]) : []
}

export function parseAllRoutes() {
  const map = new Map()

  // App.tsx 手写路由
  for (const m of appSource.matchAll(/<Route path="([^"]+)" element=\{(.+)\} \/>/g)) {
    const el = m[2]
    const mod = el.match(/\bmodule="([^"]+)"/)
    const any = el.match(/\banyModules=\{\[([^\]]+)\]\}/)
    const roles = el.match(/\broles=\{\[([^\]]+)\]\}/)
    map.set(m[1], {
      module: mod ? mod[1] : null,
      anyModules: parseList(any ? any[1] : null),
      roles: parseList(roles ? roles[1] : null),
      isRedirect: el.includes('<Navigate '),
    })
  }

  // route-manifest.ts（每行一条，含 props 花括号，故按行解析而非花括号块）
  for (const line of manifestSource.split('\n')) {
    if (!line.includes('label:')) continue
    const hm = line.match(/href: '([^']+)'/)
    if (!hm) continue
    const href = hm[1]
    const tail = line.slice(line.indexOf(hm[0]) + hm[0].length)
    const any = tail.match(/anyModules: \[([^\]]+)\]/)
    const roles = tail.match(/roles: \[([^\]]+)\]/)
    map.set(href, {
      module: (tail.match(/\bmodule: '([^']+)'/) || [])[1] ?? null,
      anyModules: parseList(any ? any[1] : null),
      roles: parseList(roles ? roles[1] : null),
      isRedirect: /\bredirect:/.test(tail),
    })
  }

  return map
}

export function allRouteSource() {
  return `${appSource}\n${manifestSource}`
}
