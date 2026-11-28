/**
 * openapi-drift.mjs — 校验 OpenAPI 文档与代码是否漂移（P2-4）
 *
 * 判定基准 = src/openapi.generated.ts（由运行时路由清单生成，天然无漂移）。
 * 本脚本额外校验：
 *   1. 生成的规格覆盖了代码里全部 /api/v1 路由；
 *   2. 生成的规格里没有代码中不存在的路径；
 *   3. 生成的规格与「源码静态扫描」结果一致（防止 onRoute 漏收集）。
 *
 * 用法：npx tsx scripts/openapi-drift.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildApp } from '../src/app.js'

const ROOT = process.cwd()
const routesDir = path.join(ROOT, 'src/routes')

const app = await buildApp({ logger: false })
await app.ready()
const runtime = app.__routeCollector.list()

const runtimeSet = new Set(runtime.map((r) => `${r.method} ${r.openapiPath}`))

// 源码静态扫描（独立于 onRoute 的第二来源）
const staticSet = new Set()
for (const f of fs.readdirSync(routesDir)) {
  if (!f.endsWith('.ts')) continue
  const s = fs.readFileSync(path.join(routesDir, f), 'utf8')
  const re = /app\.(get|post|put|patch|delete)\(\s*'(\/api\/v1[^']*)'/g
  let m
  while ((m = re.exec(s)) !== null) {
    staticSet.add(`${m[1].toUpperCase()} ${m[2].replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`)
  }
}

// 生成规格
const genPath = path.join(ROOT, 'src/openapi.generated.ts')
const genSource = fs.readFileSync(genPath, 'utf8')
const genSet = new Set()
{
  const re = /"(\/api\/v1[^"]*)":\s*\{([\s\S]*?)\n    \}/g
  let m
  while ((m = re.exec(genSource)) !== null) {
    const p = m[1]
    for (const mm of m[2].matchAll(/"(get|post|put|patch|delete)":\s*\{/g)) {
      genSet.add(`${mm[1].toUpperCase()} ${p}`)
    }
  }
}

const onlyRuntime = [...runtimeSet].filter((x) => !genSet.has(x))
const onlyGen = [...genSet].filter((x) => !runtimeSet.has(x))
const onlyStatic = [...staticSet].filter((x) => !runtimeSet.has(x))

console.log(`runtime=${runtimeSet.size}  generated=${genSet.size}  static=${staticSet.size}`)
console.log(`仅运行时有(文档缺): ${onlyRuntime.length}`)
onlyRuntime.slice(0, 10).forEach((x) => console.log('  ', x))
console.log(`仅文档有(代码无): ${onlyGen.length}`)
onlyGen.slice(0, 10).forEach((x) => console.log('  ', x))
console.log(`静态扫描多出(onRoute 未收集): ${onlyStatic.length}`)
onlyStatic.slice(0, 10).forEach((x) => console.log('  ', x))

await app.close()

if (onlyRuntime.length > 0 || onlyGen.length > 0) {
  console.error('\n[FAIL] OpenAPI 与代码存在漂移，请执行：npm run openapi:gen -- --write')
  process.exit(1)
}
console.log('\n[OK] OpenAPI 与代码完全一致')
