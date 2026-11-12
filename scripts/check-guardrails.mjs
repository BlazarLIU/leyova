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

console.log('CI Guardrail checks passed: 0 RLS-bypass routes, 0 unguarded fact_trade_daily GMV aggregations.')

