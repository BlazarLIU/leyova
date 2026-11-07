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

/** 需要按月分区的父表 */
const PARTITIONED_TABLES = ['fact_trade_daily', 'fact_traffic_daily']

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

/**
 * 确保某父表在未来 N 个月内有分区。
 */
export async function ensureFuturePartitions(
  pool: Pool,
  parentTable: string,
  monthsAhead = 3,
): Promise<PartitionResult> {
  const result: PartitionResult = { created: [], existing: [], errors: [] }

  const now = new Date()
  for (let offset = 0; offset <= monthsAhead; offset++) {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
    const name = `${parentTable}_y${ym(start)}`

    const exists = await pool.query(
      `SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = 'r'`,
      [name],
    )
    if (exists.rows.length > 0) {
      result.existing.push(name)
      continue
    }

    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS public.${name} PARTITION OF public.${parentTable}
           FOR VALUES FROM ('${firstDay(start)}') TO ('${firstDay(end)}')`,
      )
      result.created.push(name)
      logger.info({ partition: name }, '[partition] created')
    } catch (err: any) {
      // 并发创建会报 duplicate_table，视为已存在
      if (err?.code === '42P07') {
        result.existing.push(name)
      } else {
        result.errors.push({ table: parentTable, partition: name, error: String(err?.message || err) })
        logger.warn({ err, partition: name }, '[partition] create failed')
      }
    }
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
