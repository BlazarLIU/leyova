import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API_SRC = path.join(ROOT, 'apps/api/src')
const ROUTES_DIR = path.join(API_SRC, 'routes')
const ALLOWED_POOL_ROUTES = new Set(['auth.ts', 'health.ts', 'setup.ts'])

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

/**
 * Guardrail 2（升级版）：GMV 聚合必须走口径过滤
 *
 * 旧实现（已废弃）：按行扫描 + ±18 行窗口做文本匹配
 *   缺陷：① 子查询旁路 —— 口径条件写在窗口外就漏检
 *        ② 漏检 SUM(pay_amount) —— 只查了 SUM(gmv)
 *        ③ 跨语句误报 —— 窗口可能包含相邻无关 SQL
 *
 * 新实现：先做**字符串级 SQL 提取**（把每个模板字符串/普通字符串当作一条 SQL），
 *   再在整条 SQL 范围内判断，等价于「语句级解析」。
 *   能拦住子查询旁路与跨行写法，且不会因相邻代码误报。
 */

/** 从 TS 源码中提取所有字符串字面量（含模板字符串），返回 { text, startLine } */
function extractSqlStrings(src) {
  const out = []
  let i = 0
  let line = 1
  const n = src.length

  while (i < n) {
    const ch = src[i]

    if (ch === '\n') { line++; i++; continue }

    // 跳过行注释
    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    // 跳过块注释
    if (ch === '/' && src[i + 1] === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++
        i++
      }
      i += 2
      continue
    }

    // 模板字符串 或 普通字符串
    if (ch === '`' || ch === "'" || ch === '"') {
      const quote = ch
      const startLine = line
      let buf = ''
      i++
      while (i < n) {
        const c = src[i]
        if (c === '\\') { buf += src[i + 1] ?? ''; i += 2; continue }
        if (c === quote) { i++; break }
        if (c === '\n') line++
        // 模板字符串里的 ${...}：
        //   · 简单标识符（如 ${DEFAULT_CALIBER_JOIN}）→ 保留标识符名，让口径守卫能识别
        //   · 其余表达式 → 替换为 :param 占位符
        if (quote === '`' && c === '$' && src[i + 1] === '{') {
          let depth = 1
          i += 2
          const exprStart = i
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++
            else if (src[i] === '}') depth--
            if (src[i] === '\n') line++
            i++
          }
          const expr = src.slice(exprStart, i - 1).trim()
          // 纯标识符（可带成员访问）保留原名，其余用占位符
          buf += /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(expr) ? ' ' + expr + ' ' : ' :param '
          continue
        }
        buf += c
        i++
      }
      if (buf.trim().length > 0) out.push({ text: buf, startLine })
      continue
    }

    i++
  }
  return out
}

/** 判断一条 SQL 里出现的所有 GMV 聚合是否都做了口径过滤 */
function checkSqlCaliber(sql) {
  // 只看真正访问裸表的语句（走视图的天然安全）
  if (!/\bFROM\s+(?:public\.)?fact_trade_daily\b/i.test(sql)) return []
  // 完全没做聚合 → 不是统计查询，跳过
  if (!/\b(SUM|AVG)\s*\(/i.test(sql)) return []

  // 聚合的目标列：gmv / pay_amount / gross_gmv 都算金额口径列
  const aggMatches = sql.match(/\b(?:SUM|AVG)\s*\([^)]*\b(gmv|pay_amount|gross_gmv)\b[^)]*\)/gi) || []
  if (aggMatches.length === 0) return []

  const hasCaliberGuard =
    /\bamount_type\b/i.test(sql) ||
    /\bplatform_caliber_config\b/i.test(sql) ||
    /\bDEFAULT_CALIBER_/.test(sql)

  if (hasCaliberGuard) return []

  return aggMatches
}

for (const file of walkTs(API_SRC)) {
  const src = fs.readFileSync(file, 'utf8')
  const sqlStrings = extractSqlStrings(src)
  for (const sql of sqlStrings) {
    const bad = checkSqlCaliber(sql.text)
    if (bad.length > 0) {
      const snippet = sql.text.replace(/\s+/g, ' ').trim().slice(0, 90)
      errors.push(
        `[CALIBER-MIX] ${path.relative(ROOT, file)}:${sql.startLine} aggregates ${bad.join(', ')} ` +
        `from fact_trade_daily without amount_type / platform_caliber_config filtering ` +
        `(use v_fact_trade_default or filter amount_type). SQL: ${snippet}...`,
      )
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

