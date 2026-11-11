/**
 * maintenance.ts — 数据维护路由（聚合回填 / 分区检查）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'
import { aggregateRange, aggregateShopDaily, aggregatePlatformMonthly } from '../cron/aggregate-facts.js'
import { ensureAllPartitions } from '../cron/manage-partitions.js'

export async function maintenanceRoutes(app: FastifyInstance) {
  const pool = getPool()

  // ── POST /api/v1/maintenance/aggregate ── 回填聚合
  app.post<{
    Body: { from?: string; to?: string; date?: string; month?: string }
  }>('/api/v1/maintenance/aggregate', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const b = request.body || ({} as any)

      // 单日
      if (b.date) {
        const r = await aggregateShopDaily(pool, b.date)
        const ym = b.date.slice(0, 7)
        const m = await aggregatePlatformMonthly(pool, ym)
        return sendOk(reply, { mode: 'single-day', day: r, month: m }, '单日聚合完成')
      }

      // 单月
      if (b.month) {
        if (!/^\d{4}-\d{2}$/.test(b.month)) return sendError(reply, 400, 'month 格式应为 YYYY-MM')
        const m = await aggregatePlatformMonthly(pool, b.month)
        return sendOk(reply, { mode: 'single-month', month: m }, '月度聚合完成')
      }

      // 区间
      if (!b.from || !b.to) return sendError(reply, 400, '需要 from 与 to，或提供 date / month')
      const r = await aggregateRange(pool, b.from, b.to)
      return sendOk(
        reply,
        {
          mode: 'range',
          from: b.from,
          to: b.to,
          daysProcessed: r.days.length,
          monthsProcessed: r.months.length,
          days: r.days,
          months: r.months,
        },
        `回填完成：${r.days.length} 天 / ${r.months.length} 个月`,
      )
    } catch (err: any) {
      request.log.error({ err }, 'aggregate backfill failed')
      return sendError(reply, 500, `聚合失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/maintenance/aggregate-status ── 聚合健康度
  app.get('/api/v1/maintenance/aggregate-status', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          (SELECT count(*) FROM fact_trade_daily)::int            AS fact_trade_rows,
          (SELECT count(*) FROM fact_traffic_daily)::int          AS fact_traffic_rows,
          (SELECT count(*) FROM fact_ad_daily)::int               AS fact_ad_rows,
          (SELECT count(*) FROM fact_content_daily)::int          AS fact_content_rows,
          (SELECT count(*) FROM agg_shop_daily)::int              AS agg_shop_rows,
          (SELECT count(*) FROM agg_platform_monthly)::int        AS agg_monthly_rows,
          (SELECT count(DISTINCT biz_date) FROM fact_trade_daily)::int AS distinct_days,
          (SELECT max(biz_date)::text FROM fact_trade_daily)      AS latest_fact_date,
          (SELECT max(biz_date)::text FROM agg_shop_daily)        AS latest_agg_date
      `)
      const s = rows[0]
      const pending =
        Number(s.distinct_days) > 0 && Number(s.agg_shop_rows) < Number(s.distinct_days)
      return sendOk(reply, { ...s, aggregationPending: pending })
    } catch (err) {
      return sendError(reply, 500, '获取聚合状态失败')
    }
  })

  // ── POST /api/v1/maintenance/partitions ── 手动补齐分区
  app.post<{
    Body: { monthsAhead?: number }
  }>('/api/v1/maintenance/partitions', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const months = request.body?.monthsAhead ?? 3
      const r = await ensureAllPartitions(Number(months) || 3)
      return sendOk(reply, r, `分区检查完成：新建 ${r.created.length} 个`)
    } catch (err: any) {
      return sendError(reply, 500, `分区维护失败：${err?.message || err}`)
    }
  })

  // ── GET /api/v1/maintenance/partitions ── 分区清单
  app.get('/api/v1/maintenance/partitions', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await pool.query(`
        SELECT p.relname AS parent, c.relname AS partition,
               pg_get_expr(c.relpartbound, c.oid) AS bounds
          FROM pg_class c
          JOIN pg_inherits i ON i.inhrelid = c.oid
          JOIN pg_class p ON p.oid = i.inhparent
         WHERE p.relname IN ('fact_trade_daily', 'fact_traffic_daily')
         ORDER BY p.relname, c.relname
      `)
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取分区清单失败')
    }
  })
}
