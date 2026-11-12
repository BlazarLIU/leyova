/**
 * manage-partitions.ts — 事实表分区自动维护
 *
 * 计划第六章 6.1 要求：定时任务提前创建未来 3 个月的新分区，过往冷数据可 Detach 归档。
 *
 * 策略：
 *   - 每天检查 fact_trade_daily / fact_traffic_daily 分区
 *   - 确保「当前月 + 未来 3 个月」分区存在，缺则自动创建
 *   - 不自动删除历史分区（归档由 archive-old-data 单独负责）
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'
import { logger } from '../lib/logger.js'

/** 需要按月分区的父表（涵盖核心事实表与企业数据治理全链路分层表） */
const PARTITIONED_TABLES = [
  'fact_trade_daily',
  'fact_traffic_daily',
  'raw_records',
  'clean_records',
  'canonical_orders',
  'canonical_order_items',
  'canonical_refund_events',
]

/** yyyymm 形状 */
function ym(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

function firstDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export interface PartitionResult {
  created: string[]
  existing: string[]
  errors: Array<{ table: string; partition: string; error: string }>
}

async function hasRangePartitionBound(
  pool: Pool,
  parentTable: string,
  fromDate: string,
  toDate: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ relname: string; bound: string }>(
    `SELECT c.relname, pg_get_expr(c.relpartbound, c.oid) AS bound
     FROM pg_inherits i
     JOIN pg_class p ON p.oid = i.inhparent
     JOIN pg_class c ON c.oid = i.inhrelid
     JOIN pg_namespace n ON n.oid = p.relnamespace
     WHERE n.nspname = 'public' AND p.relname = $1`,
    [parentTable],
  )
  for (const row of rows) {
    if (row.bound && row.bound.includes(`'${fromDate}'`) && row.bound.includes(`'${toDate}'`)) {
      return row.relname
    }
  }
  return null
}

async function ensureDefaultPartition(pool: Pool, parentTable: string): Promise<string | null> {
  const { rows } = await pool.query<{ relname: string }>(
    `SELECT c.relname
     FROM pg_inherits i
     JOIN pg_class p ON p.oid = i.inhparent
     JOIN pg_class c ON c.oid = i.inhrelid
     JOIN pg_namespace n ON n.oid = p.relnamespace
     WHERE n.nspname = 'public' AND p.relname = $1
       AND pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT'`,
    [parentTable],
  )
  if (rows.length > 0) return null
  const defName = `${parentTable}_default`
  await pool.query(
    `CREATE TABLE IF NOT EXISTS public.${defName} PARTITION OF public.${parentTable} DEFAULT`,
  )
  logger.info({ partition: defName }, '[partition] ensured DEFAULT partition')
  return defName
}

/**
 * 确保某父表在未来 N 个月内有分区，并确保 DEFAULT 兜底分区存在。
 */
export async function ensureFuturePartitions(
  pool: Pool,
  parentTable: string,
  monthsAhead = 3,
): Promise<PartitionResult> {
  const result: PartitionResult = { created: [], existing: [], errors: [] }

  try {
    const createdDef = await ensureDefaultPartition(pool, parentTable)
    if (createdDef) result.created.push(createdDef)
  } catch (err: any) {
    if (err?.code !== '42P07') {
      result.errors.push({ table: parentTable, partition: `${parentTable}_default`, error: String(err?.message || err) })
    }
  }

  const now = new Date()
  for (let offset = 0; offset <= monthsAhead; offset++) {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
    const rangeStart = firstDay(start)
    const rangeEnd = firstDay(end)
    const name = `${parentTable}_y${ym(start)}`

    const existingBoundName = await hasRangePartitionBound(pool, parentTable, rangeStart, rangeEnd)
    if (existingBoundName) {
      result.existing.push(existingBoundName)
      continue
    }

    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS public.${name} PARTITION OF public.${parentTable}
           FOR VALUES FROM ('${rangeStart}') TO ('${rangeEnd}')`,
      )
      result.created.push(name)
      logger.info({ partition: name }, '[partition] created')
    } catch (err: any) {
      if (err?.code === '42P07' || err?.code === '42P17') {
        result.existing.push(name)
      } else {
        result.errors.push({ table: parentTable, partition: name, error: String(err?.message || err) })
        logger.warn({ err, partition: name }, '[partition] create failed')
      }
    }
  }

  return result
}

/**
 * 补齐过去某个月的分区。
 * 用于历史数据回溯导入（如抖音数据从 2026-08 开始）。
 */
export async function ensurePartitionForMonth(
  pool: Pool,
  parentTable: string,
  year: number,
  month: number,
): Promise<{ name: string; created: boolean; error?: string }> {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  const rangeStart = firstDay(start)
  const rangeEnd = firstDay(end)
  const name = `${parentTable}_y${ym(start)}`

  const existingBoundName = await hasRangePartitionBound(pool, parentTable, rangeStart, rangeEnd)
  if (existingBoundName) return { name: existingBoundName, created: false }

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS public.${name} PARTITION OF public.${parentTable}
         FOR VALUES FROM ('${rangeStart}') TO ('${rangeEnd}')`,
    )
    logger.info({ partition: name }, '[partition] created (backfill)')
    return { name, created: true }
  } catch (err: any) {
    if (err?.code === '42P07' || err?.code === '42P17') return { name, created: false }
    return { name, created: false, error: String(err?.message || err) }
  }
}

/** 为指定日期范围确保分区存在（回溯 + 前瞻） */
export async function ensurePartitionsForRange(
  from: string,
  to: string,
  pool?: Pool,
): Promise<PartitionResult> {
  const p = pool || getPool()
  const result: PartitionResult = { created: [], existing: [], errors: [] }

  const fromDate = new Date(from)
  const toDate = new Date(to)
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
  const endLimit = new Date(toDate.getFullYear(), toDate.getMonth(), 1)

  while (cursor <= endLimit) {
    for (const table of PARTITIONED_TABLES) {
      const r = await ensurePartitionForMonth(
        p, table, cursor.getFullYear(), cursor.getMonth() + 1,
      )
      if (r.error) result.errors.push({ table, partition: r.name, error: r.error })
      else if (r.created) result.created.push(r.name)
      else result.existing.push(r.name)
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return result
}

/** 为所有分区表补齐分区 */
export async function ensureAllPartitions(monthsAhead = 3): Promise<PartitionResult> {
  const pool = getPool()
  const merged: PartitionResult = { created: [], existing: [], errors: [] }
  for (const table of PARTITIONED_TABLES) {
    const r = await ensureFuturePartitions(pool, table, monthsAhead)
    merged.created.push(...r.created)
    merged.existing.push(...r.existing)
    merged.errors.push(...r.errors)
  }
  return merged
}
