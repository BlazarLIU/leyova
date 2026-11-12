import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_SRC = path.join(ROOT, 'apps/api/src')
const ROUTES_DIR = path.join(API_SRC, 'routes')
const ALLOWED_POOL_ROUTES = new Set(['auth.ts', 'health.ts'])

function walkTs(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkTs(full))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

const errors = []

// Guardrail 1: Disallow direct getPool() usage in business route files (must use withRlsContext/withRlsPool)
for (const file of walkTs(ROUTES_DIR)) {
  const rel = path.relative(ROUTES_DIR, file).replace(/\\/g, '/')
  if (ALLOWED_POOL_ROUTES.has(rel)) continue
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, idx) => {
    if (/\bgetPool\b/.test(line)) {
      errors.push(`[RLS-BYPASS] ${path.relative(ROOT, file)}:${idx + 1} uses getPool() directly; use withRlsContext()/withRlsPool() instead.`)
    }
  })
}

// Guardrail 2: Any query summing gmv against raw fact_trade_daily must apply caliber/amount_type filtering
for (const file of walkTs(API_SRC)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/\bFROM\s+(?:public\.)?fact_trade_daily\b/i.test(lines[i])) continue
    // Ignore comments explaining architecture
    if (/^\s*(\*|\/\/)/.test(lines[i])) continue
    const start = Math.max(0, i - 18)
    const end = Math.min(lines.length, i + 15)
    const windowSql = lines.slice(start, end).join('\n')
    if (/\bSUM\s*\([^)]*\bgmv\b/i.test(windowSql)) {
      const hasCaliberGuard =
        /\bamount_type\b/i.test(windowSql) ||
        /\bplatform_caliber_config\b/i.test(windowSql) ||
        /\bDEFAULT_CALIBER_/.test(windowSql)
      if (!hasCaliberGuard) {
        errors.push(`[CALIBER-MIX] ${path.relative(ROOT, file)}:${i + 1} aggregates GMV from fact_trade_daily without amount_type or platform_caliber_config filtering (use v_fact_trade_default or filter amount_type).`)
      }
    }
  }
}

if (errors.length > 0) {
  console.error('CI Guardrail checks failed:')
  for (const err of errors) console.error(' -', err)
  process.exit(1)
}

// Guardrail 3: Frontend api.get/post/put/patch/delete literal/templated calls must match a registered backend route
function normalizeBackendRoute(rawPath) {
  return rawPath
    .split('?')[0]
    .replace(/^\/api\/v1/, '')
    .replace(/:[^/]+/g, ':param')
    .replace(/\/+$/, '') || '/'
}

function frontendCallToRegex(rawPath) {
  // Mirrors apps/web/src/services/api.ts buildUrl()
  const clean = rawPath
    .split('?')[0]
    .replace(/^\/api(?=\/)/, '')
    .replace(/^\/v1(?=\/)/, '')
    .replace(/\/+$/, '') || '/'
  const parts = clean.split('/').filter(Boolean).map((seg) =>
    seg.includes('${') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
  return new RegExp(`^/${parts.join('/')}$`)
}

const backendRoutes = []
const routeDeclRegex = /\bapp\.(get|post|put|patch|delete)\s*(?:<[\s\S]*?>)?\s*\(\s*['"`]([^'"`]+)['"`]/g
for (const file of walkTs(ROUTES_DIR)) {
  const src = fs.readFileSync(file, 'utf8')
  let m
  while ((m = routeDeclRegex.exec(src)) !== null) {
    const method = m[1].toUpperCase()
    const pathNorm = normalizeBackendRoute(m[2])
    const beRegex = new RegExp(
      `^${pathNorm.split('/').filter(Boolean).map((s) => (s === ':param' ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/') ? '/' + pathNorm.split('/').filter(Boolean).map((s) => (s === ':param' ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/') : '/'}$`,
    )
    backendRoutes.push({ method, pathNorm, beRegex })
  }
}

function matchesBackend(method, rawFrontendPath) {
  const feClean = rawFrontendPath
    .split('?')[0]
    .replace(/^\/api(?=\/)/, '')
    .replace(/^\/v1(?=\/)/, '')
    .replace(/\/+$/, '') || '/'
  const feRegex = frontendCallToRegex(rawFrontendPath)
  return backendRoutes.some((b) => {
    if (b.method !== method) return false
    if (b.pathNorm === feClean) return true
    if (b.beRegex.test(feClean)) return true
    if (feClean.includes('${') && feRegex.test(b.pathNorm)) return true
    return false
  })
}

const WEB_SRC = path.join(ROOT, 'apps/web/src')
function walkWeb(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walkWeb(full))
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) results.push(full)
  }
  return results
}

const webCallRegex = /\bapi\.(get|post|put|patch|delete)\s*(?:<[^()]*>)?\s*\(\s*(['"`])(\/[^'"`]+)\2/g
let checkedFrontendCalls = 0
for (const file of walkWeb(WEB_SRC)) {
  const src = fs.readFileSync(file, 'utf8')
  let m
  while ((m = webCallRegex.exec(src)) !== null) {
    const method = m[1].toUpperCase()
    const rawTarget = m[3]
    checkedFrontendCalls++
    if (!matchesBackend(method, rawTarget)) {
      errors.push(`[ENDPOINT-PARITY] ${path.relative(ROOT, file)} calls ${method} ${rawTarget}, which does not match any registered Fastify route.`)
    }
  }
}

if (errors.length > 0) {
  console.error('CI Guardrail checks failed:')
  for (const err of errors) console.error(' -', err)
  process.exit(1)
}

console.log(`CI Guardrail checks passed: 0 RLS-bypass routes, 0 unguarded fact_trade_daily GMV aggregations, ${checkedFrontendCalls} frontend API calls matched (${backendRoutes.length} backend routes).`)

