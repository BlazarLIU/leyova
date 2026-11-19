import { buildApp } from '../src/app.js'

const app = await buildApp({ logger: false })
await app.ready()

const collector = app.__routeCollector
const routes = collector.list()

console.log('collected routes:', routes.length)
for (const r of routes.slice(0, 8)) {
  console.log(' ', r.method, r.openapiPath, r.hasSchema ? '[schema]' : '')
}
console.log('paths:', new Set(routes.map((r) => r.openapiPath)).size)
console.log('with schema:', routes.filter((r) => r.hasSchema).length)

await app.close()
