#!/usr/bin/env node
/**
 * database/generate-schema.js — 从数据库当前状态生成 01_schema.sql（P9 合并项）
 *
 * 背景：01_schema.sql 原为手工维护，与 54 个迁移的真实结果已严重漂移
 *      （手工版 59 张表 vs 实际 213 张表，缺失 72%）。
 *      本脚本改为「从迁移重放后的数据库导出」，消除 DDL 漂移。
 *
 * 用法：
 *   node database/generate-schema.js            # 生成 database/01_schema.sql
 *   node database/generate-schema.js --check    # 只校验，不写文件（CI 用）
 *
 * 输出顺序（依赖安全）：
 *   1. 表结构（CREATE TABLE）
 *   2. 序列（CREATE SEQUENCE）
 *   3. 索引（CREATE INDEX）
 *   4. 视图（CREATE VIEW）
 *   5. 函数（CREATE FUNCTION）
 *   6. 触发器（CREATE TRIGGER）
 *   7. 权限/策略（ALTER TABLE / CREATE POLICY / ENABLE ROW LEVEL SECURITY）
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function loadEnv() {
  const envPath = path.join(rootDir, 'apps/api/.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL 未设置（请检查 apps/api/.env）')
  process.exit(1)
}

const CHECK_ONLY = process.argv.includes('--check')
const OUTPUT = path.join(__dirname, '01_schema.sql')

/** pg_dump 原始输出 → 清洗 */
function dump() {
  const raw = execFileSync(
    'pg_dump',
    ['--schema-only', '--no-owner', '--no-privileges', '--no-comments', DATABASE_URL],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
  )
  // 去掉 pg_dump 元数据噪音
  return raw
    .split('\n')
    .filter((l) => !/^SET |^SELECT pg_catalog|^SHOW |^-- Dumped (from|by)|^-- PostgreSQL|^--  Dumped|^-- Name: |^-- OID|^-- Data for|^-- TOC entry|^-- \\.\./.test(l))
    .filter((l) => !l.startsWith('\\$libdir') && !l.startsWith('\\restrict') && !l.startsWith('\\unrestrict'))
    .join('\n')
}

/**
 * 按语句切分（以分号结尾的顶层语句；函数体 $ ... $ 内部的分号需特殊处理）
 *
 * pg_dump 会在语句前插入注释与空行，切分后需剥离这些噪音，
 * 否则语句不以 CREATE/ALTER 开头，分类会全部落到 other。
 */
function splitStatements(sql) {
  const stmts = []
  let buf = ''
  let inDollarQuote = false
  let dollarTag = ''
  for (const line of sql.split('\n')) {
    buf += line + '\n'
    const tagMatch = line.match(/\$[A-Za-z_0-9]*\$/)
    if (tagMatch) {
      const tag = tagMatch[0]
      if (!inDollarQuote) {
        inDollarQuote = true
        dollarTag = tag
      } else if (tag === dollarTag) {
        inDollarQuote = false
        dollarTag = ''
      }
    }
    if (!inDollarQuote && line.trimEnd().endsWith(';')) {
      const s = buf.trim()
      if (s) stmts.push(s)
      buf = ''
    }
  }
  const tail = buf.trim()
  if (tail) stmts.push(tail)
  return stmts.map(stripNoise)
}

/** 剥离语句前的注释行与空行（保留语句体内部的注释） */
function stripNoise(stmt) {
  const lines = stmt.split('\n')
  let start = 0
  while (start < lines.length) {
    const t = lines[start].trim()
    if (t === '' || t.startsWith('--')) start++
    else break
  }
  return lines.slice(start).join('\n').trim()
}

/** 语句分类（顺序即输出顺序） */
const ORDER = [
  { key: 'table', test: /^CREATE TABLE / },
  { key: 'sequence', test: /^CREATE SEQUENCE / },
  { key: 'index', test: /^CREATE (UNIQUE )?INDEX / },
  { key: 'matview', test: /^CREATE MATERIALIZED VIEW / },
  { key: 'view', test: /^CREATE VIEW / },
  { key: 'function', test: /^CREATE (OR REPLACE )?FUNCTION / },
  { key: 'type', test: /^CREATE TYPE / },
  { key: 'trigger', test: /^CREATE (CONSTRAINT )?TRIGGER / },
  { key: 'addconstraint', test: /^ALTER TABLE ONLY[\s\S]*?ADD CONSTRAINT / },
  { key: 'tableattach', test: /^ALTER TABLE ONLY .* ATTACH PARTITION / },
  { key: 'alter', test: /^ALTER (TABLE|FUNCTION|VIEW|SEQUENCE|TYPE|DEFAULT)(?! ONLY .* ATTACH PARTITION)/ },
  { key: 'attach', test: /^ALTER INDEX .* ATTACH PARTITION / },
  { key: 'policy', test: /^CREATE POLICY / },
  { key: 'rls', test: /^ENABLE ROW LEVEL SECURITY / },
  { key: 'grant', test: /^GRANT |^REVOKE / },
  { key: 'comment', test: /^COMMENT ON / },
]

function classify(stmt) {
  for (const { key, test } of ORDER) {
    if (test.test(stmt)) return key
  }
  return 'other'
}

/** 依赖修正：类型必须在表之前（枚举类型被列引用） */
function build(dumpSql) {
  const stmts = splitStatements(dumpSql)
  const buckets = {}
  for (const s of stmts) {
    const k = classify(s)
    ;(buckets[k] ||= []).push(s)
  }

  const header = `--\n-- leyova 数据库结构（schema-only，由迁移系统自动生成）\n--\n-- 生成方式：node database/generate-schema.js（pg_dump --schema-only --no-owner --no-privileges）\n-- 基    准：全部迁移应用后的数据库真实状态\n-- 生成日期：${new Date().toISOString().slice(0, 10)}\n-- 兼容版本：PostgreSQL 14+\n--\n-- 已移除：SET 配置指令、pg_dump 元数据注释、对象 OWNER / PRIVILEGE 声明\n--\n-- ⚠️ 本文件由 database/generate-schema.js 自动生成，请勿手改；\n--    如需修改结构，请新增迁移文件，然后重新生成本文件。\n--\n`

  // type → sequence → table → addconstraint → matview → view → index → attach → function → trigger → alter → policy → rls → grant → comment → other
  // 注意：
  //  · sequence 必须早于 table（表列的 DEFAULT nextval(...) 直接引用序列名）
  //  · addconstraint 必须早于 attach（分区子索引 ATTACH 的父索引来自 ADD CONSTRAINT）
  //  · matview 必须早于 index（物化视图的 UNIQUE INDEX 依赖视图本身）
  const seq = ['type', 'sequence', 'table', 'addconstraint', 'matview', 'view', 'index', 'tableattach', 'attach', 'function', 'trigger', 'alter', 'policy', 'rls', 'grant', 'comment', 'other']
  const parts = [header, '-- 关闭函数体校验：函数体引用的辅助函数可能在后续语句中才创建\n', 'SET check_function_bodies = false;\n\n']
  for (const k of seq) {
    if (!buckets[k]?.length) continue
    parts.push(`-- ===== ${k} (${buckets[k].length}) =====\n`)
    for (const s of buckets[k]) parts.push(s + '\n\n')
  }
  return { sql: parts.join(''), counts: Object.fromEntries(seq.map((k) => [k, buckets[k]?.length || 0])) }
}

const dumpSql = dump()
const { sql, counts } = build(dumpSql)

console.log('生成统计：')
for (const [k, v] of Object.entries(counts)) {
  if (v > 0) console.log(`  ${k.padEnd(10)} ${v}`)
}
console.log(`  合计        ${Object.values(counts).reduce((a, b) => a + b, 0)} 条语句 / ${sql.split('\n').length} 行`)

if (CHECK_ONLY) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : ''
  // 比较时忽略 header 的生成日期行
  const strip = (s) => s.replace(/-- 生成日期：.*\n/, '')
  if (strip(current) === strip(sql)) {
    console.log('✓ 01_schema.sql 与数据库当前状态一致')
    process.exit(0)
  }
  console.error('✗ 01_schema.sql 与数据库当前状态不一致，需要重新生成')
  process.exit(1)
}

fs.writeFileSync(OUTPUT, sql)
console.log(`\n✓ 已写入 ${OUTPUT}（${sql.length} 字节）`)
