/**
 * ops-jobs.ts — 主动值守（W3 / §5.6）
 *
 * 扫描全部由确定性任务完成，Agent 不在对话里循环扫库：
 *   assistant.scheduled_review  昨天下播场次自动归因并生成决策案（指纹去重）
 *   alert.scan                  公司日目标缺口扫描，缺口 < -10% 落告警事件（24h 去重）
 *   action.measure              到期动作自动度量，回写 improvement_tasks / decision_cases
 */

import { getPool } from '../lib/db.js'
import { getSessionAttribution } from './attribution-engine.js'
import { generateDecisionCasesFromReview, measureDecisionCase } from './decision-cases.js'
import { logger } from '../lib/logger.js'

const round2 = (n: number) => Math.round(n * 100) / 100

export async function runScheduledReview(date?: string): Promise<Record<string, any>> {
  const pool = getPool()
  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : new Date(Date.now() - 86400_000).toISOString().slice(0, 10)

  const { rows } = await pool.query(
    `SELECT id FROM public.live_sessions
      WHERE status = 'completed' AND date = $1::date
      ORDER BY id ASC`,
    [targetDate],
  )

  let created = 0
  let skipped = 0
  let insufficient = 0
  for (const row of rows) {
    const attribution = await getSessionAttribution(pool, 1, Number(row.id))
    if (!attribution || attribution.insufficient) {
      insufficient++
      continue
    }
    const res = await generateDecisionCasesFromReview(pool, 1, null, attribution, `scheduled_review:${targetDate}`)
    created += res.created
    skipped += res.skipped
  }

  return { date: targetDate, sessions: rows.length, created, skipped, insufficient }
}

export async function runAlertScan(date?: string): Promise<Record<string, any>> {
  const pool = getPool()
  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10)

  const { rows: targetRows } = await pool.query(
    `SELECT target_value, (period_end - period_start + 1)::int AS days
       FROM public.biz_targets
      WHERE tenant_id = 1 AND metric_code = 'gmv' AND status = 'active'
        AND scope_type = 'company'
        AND period_start <= $1::date AND period_end >= $1::date
      ORDER BY period_start DESC LIMIT 1`,
    [targetDate],
  )
  if (targetRows.length === 0) {
    return { date: targetDate, skipped: true, reason: '未配置公司 GMV 目标' }
  }
  const dailyTarget = round2(Number(targetRows[0].target_value) / Math.max(1, Number(targetRows[0].days)))
  const { rows: actualRows } = await pool.query(
    `SELECT COALESCE(SUM(gmv), 0)::numeric AS actual FROM public.live_sessions
      WHERE date = $1::date AND status IN ('completed', 'live')`,
    [targetDate],
  )
  const actual = round2(Number(actualRows[0]?.actual) || 0)
  if (dailyTarget <= 0) {
    return { date: targetDate, skipped: true, reason: '目标值为 0' }
  }
  const gapRatio = (actual - dailyTarget) / dailyTarget

  if (gapRatio >= -0.1) {
    return { date: targetDate, dailyTarget, actual, gapRatio: round2(gapRatio * 100) / 100, alerted: false }
  }

  const title = `GMV 目标缺口告警 ${targetDate}`
  const { rows: existing } = await pool.query(
    `SELECT id FROM public.alert_events
      WHERE title = $1 AND created_at >= now() - INTERVAL '24 hours' LIMIT 1`,
    [title],
  )
  if (existing.length > 0) {
    return { date: targetDate, dailyTarget, actual, gapRatio, alerted: false, deduped: true }
  }

  const severity = gapRatio < -0.3 ? 'critical' : 'warning'
  await pool.query(
    `INSERT INTO public.alert_events (severity, title, description, event_time, status, ack_status)
     VALUES ($1, $2, $3, now(), 'pending', 'pending')`,
    [
      severity,
      title,
      `当日实际 GMV ¥${actual.toLocaleString()}，日目标 ¥${dailyTarget.toLocaleString()}，缺口 ${(gapRatio * 100).toFixed(1)}%。目标来源：biz_targets。`,
    ],
  )
  return { date: targetDate, dailyTarget, actual, gapRatio, alerted: true, severity }
}

export async function runActionMeasure(): Promise<Record<string, any>> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT DISTINCT decision_case_id
       FROM public.improvement_tasks
      WHERE decision_case_id IS NOT NULL
        AND measure_at IS NOT NULL
        AND measure_at <= CURRENT_DATE
        AND (outcome_status IS NULL OR outcome_status = 'pending')
      LIMIT 100`,
  )
  let measured = 0
  let inconclusive = 0
  let failed = 0
  for (const row of rows) {
    try {
      const res = await measureDecisionCase(pool, 1, Number(row.decision_case_id))
      if (!res.ok) {
        failed++
        continue
      }
      if (res.caseRow.outcomeStatus === 'measured') measured++
      else inconclusive++
    } catch (err) {
      logger.warn({ err, caseId: row.decision_case_id }, '[ops-jobs] measure failed')
      failed++
    }
  }
  return { candidates: rows.length, measured, inconclusive, failed }
}
