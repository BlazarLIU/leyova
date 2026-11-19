/**
 * generate-openapi.ts — 生成与代码一致的 OpenAPI 规格（P2-4）
 *
 * 用法：
 *   npx tsx scripts/generate-openapi.ts            # 打印到 stdout
 *   npx tsx scripts/generate-openapi.ts --write    # 写回 src/openapi.generated.ts
 *
 * 原理：
 *   1. 运行 buildApp()，用 onRoute 收集器拿到**全部真实注册路由**（方法 + 路径 + schema）。
 *   2. 以 src/openapi.ts（手写规格）为「文案来源」：保留其中已写好的 summary/description/参数说明。
 *   3. 输出 = 真实路由清单 × 手写文案（命中则用文案，未命中则用路径推断的保守描述）。
 *   → 文档不再可能包含「代码里没有的接口」，也不会遗漏「代码里新增的接口」。
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildApp } from '../src/app.js'
import { openapiSpec } from '../src/openapi.js'

const WRITE = process.argv.includes('--write')
const OUT = path.resolve(process.cwd(), 'src/openapi.generated.ts')

const app = await buildApp({ logger: false })
await app.ready()
const routes = app.__routeCollector.list()

/** 手写规格里的 path → 各 method 的文案 */
const docPaths: Record<string, any> = (openapiSpec as any).paths ?? {}

/** 把 Fastify 的 :id 转成 OpenAPI 的 {id}（与 route-collector 一致） */
function toOpenApiPath(url: string): string {
  return url.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

/** 按路径首段推断业务域，用作 tag */
function inferTag(openapiPath: string): string {
  const seg = openapiPath.split('/').filter(Boolean)[1] ?? 'misc'
  const map: Record<string, string> = {
    health: 'Health', ready: 'Health', metrics: 'Health',
    auth: 'Auth', access: 'Access', system: 'System', users: 'System', roles: 'System',
    data: 'Data', ingest: 'Data', governance: 'Data',
    sessions: 'Session', session: 'Session', review: 'Review', anchors: 'Anchor',
    personnel: 'Personnel', hrbp: 'HRBP', schedule: 'Schedule',
    overview: 'Overview', omnichannel: 'Omnichannel', bi: 'BI', analysis: 'BI',
    net_roi: 'NetROI', 'net-roi': 'NetROI', ads: 'Ads',
    inventory: 'Inventory', fulfillment: 'Fulfillment', 'after-sales': 'AfterSales',
    kol: 'KOL', cs: 'CustomerService', members: 'Members',
    content: 'Content', ai: 'AI', selection: 'AI', 'campaign-plan': 'AI',
    compliance: 'Compliance', platforms: 'Platforms', platform: 'Platforms',
    douyin: 'Platform-Douyin', kuaishou: 'Platform-Kuaishou', taobao: 'Platform-Taobao',
    tmall: 'Platform-Tmall', wechat: 'Platform-Wechat', xiaohongshu: 'Platform-XHS',
    insights: 'Insights', resources: 'Resources', dict: 'System', maintenance: 'System',
    alerts: 'Alerts', closure: 'Closure', caliber: 'Caliber', weather: 'Weather',
    ops: 'Ops', kb: 'KnowledgeBase', metrics_caliber: 'Caliber', finance: 'Finance',
  }
  return map[seg] ?? seg.replace(/(^|-)([a-z])/g, (_m, _p, c) => c.toUpperCase())
}

/** 从手写文案里提取该 method 的 description / summary */
function pickDoc(openapiPath: string, method: string): { summary?: string; description?: string; tags?: string[] } {
  const entry = docPaths[openapiPath]
  if (!entry) return {}
  const op = entry[method.toLowerCase()]
  if (!op) return {}
  return { summary: op.summary, description: op.description, tags: op.tags }
}

/** 保守的通用响应（不臆造业务字段） */
function genericResponses(hasSchema: boolean) {
  return {
    '200': {
      description: '请求成功',
      content: {
        'application/json': {
          schema: hasSchema
            ? { type: 'object' }
            : { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } },
        },
      },
    },
    '401': { description: '未登录或会话过期' },
    '403': { description: '无权访问该资源' },
    '404': { description: '资源不存在' },
    '500': { description: '服务内部错误' },
  }
}

const paths: Record<string, any> = {}
for (const r of routes) {
  const p = r.openapiPath
  if (!paths[p]) paths[p] = {}
  const doc = pickDoc(p, r.method)
  const op: any = {
    tags: doc.tags?.length ? doc.tags : [inferTag(p)],
    summary: doc.summary || `${r.method} ${p}`,
    description: doc.description || `${r.method} ${p}`,
    responses: genericResponses(r.hasSchema),
  }
  if (r.hasSchema) op['x-has-schema'] = true
  paths[p][r.method.toLowerCase()] = op
}

const spec = {
  openapi: '3.0.3',
  info: {
    ...(openapiSpec as any).info,
    description:
      (openapiSpec as any).info?.description +
      '\n\n> 本文档由 `npm run openapi:gen` 从运行时路由清单自动生成（P2-4），路径与代码保持一致。',
  },
  servers: (openapiSpec as any).servers,
  components: (openapiSpec as any).components ?? {},
  security: [{ cookieAuth: [] }],
  paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
}

const opCount = Object.values(paths).reduce((n, p: any) => n + Object.keys(p).length, 0)
console.error(`[openapi:gen] paths=${Object.keys(paths).length} operations=${opCount}`)

if (WRITE) {
  const json = JSON.stringify(spec, null, 2)
  const content = `/**
 * openapi.generated.ts — 自动生成的 OpenAPI 规格（P2-4）
 *
 * 由 scripts/generate-openapi.ts 从运行时真实路由清单生成，请勿手工编辑。
 * 重新生成：npm run openapi:gen -- --write
 */
export const openapiSpec = ${json} as const
`
  fs.writeFileSync(OUT, content)
  console.error(`[openapi:gen] written -> ${OUT} (${(json.length / 1024).toFixed(0)} KB)`)
} else {
  process.stdout.write(JSON.stringify(spec, null, 2) + '\n')
}

await app.close()
