import { getPool } from './db.js'

/**
 * Ensures monthly partition exists for canonical_refund_events before inserting rows under RLS.
 * Executed on the owner pool strictly for DDL partition creation (no user row reads/writes).
 */
export async function ensureRefundMonthPartition(dateStr: string): Promise<void> {
  const ym = dateStr.slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(ym)) return
  const partName = `canonical_refund_events_y${ym.replace('-', '')}`
  const startDate = `${ym}-01`
  const d = new Date(`${startDate}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  const endDate = d.toISOString().slice(0, 10)
  const pool = getPool()
  await pool.query(
    `CREATE TABLE IF NOT EXISTS public.${partName} PARTITION OF public.canonical_refund_events
     FOR VALUES FROM ('${startDate}') TO ('${endDate}')`,
  )
}

