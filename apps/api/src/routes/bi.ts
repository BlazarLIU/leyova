import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canAccessAdSpend, requireAuth } from '../lib/guard.js'
import { computeRefundRatePct } from '../services/metrics-caliber.js'
import { queryMetric, comparePeriods } from '../query/primitives.js'

const REASON_LABELS: Record<string, { label: string; barColor: string; dotColor: string }> = {
  size_mismatch: { label: '尺码不合适', barColor: 'from-violet-500 to-violet-400', dotColor: 'bg-violet-400' },
  quality_defect: { label: '商品质量/瑕疵', barColor: 'from-rose-500 to-rose-400', dotColor: 'bg-rose-400' },
  logistics_slow: { label: '物流超时/揽收慢', barColor: 'from-amber-500 to-amber-400', dotColor: 'bg-amber-400' },
  not_as_described: { label: '描述不符', barColor: 'from-cyan-500 to-cyan-400', dotColor: 'bg-cyan-400' },
  buyer_remorse: { label: '7天无理由退货', barColor: 'from-blue-500 to-blue-400', dotColor: 'bg-blue-400' },
  other: { label: '其他原因', barColor: 'from-slate-500 to-slate-400', dotColor: 'bg-slate-400' },
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  pending_audit: '待审核',
  waiting_return: '待退回',
  approved: '已同意退款',
  rejected: '已驳回',
  platform_intervened: '平台介入中',
  closed: '已退款完成',
}

function normalizePlatformSql(expr: string): string {
  return `CASE LOWER(COALESCE(${expr}, 'douyin'))
    WHEN '抖音' THEN 'douyin'
    WHEN '快手' THEN 'kuaishou'
    WHEN '视频号' THEN 'wechat'
    WHEN '微信' THEN 'wechat'
    WHEN '淘宝' THEN 'taobao'
    WHEN '天猫' THEN 'tmall'
    WHEN '小红书' THEN 'xiaohongshu'
    ELSE LOWER(COALESCE(${expr}, 'douyin'))
  END`
}

export async function biRoutes(app: FastifyInstance) {
  // ── GET /api/v1/bi/dashboard ──
  //    Frontend: /api/bi/dashboard?period=7d&platform=all
  app.get('/api/v1/bi/dashboard', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const query = request.query as { period?: string; platform?: string }
    try {
      const payload = await withRlsContext(request, async (client, rlsScope) => {
        const allowedPlatforms = rlsScope.allowedPlatforms
        let daysFilter = '7'
        if (query.period === '30d') daysFilter = '30'
        else if (query.period === 'quarter') daysFilter = '90'

        const scopeParams: any[] = []
        const scopeConds: string[] = []
        if (allowedPlatforms !== null) {
          if (allowedPlatforms.length === 0) {
            return {
              total_gmv: 0, total_orders: 0, avg_order_value: 0, total_refund: 0,
              change_rates: {}, platforms: [], dailyTrend: [],
            }
          }
          scopeParams.push(allowedPlatforms)
          scopeConds.push(`${normalizePlatformSql('r.platform')} = ANY($${scopeParams.length})`)
        }
        if (query.platform && query.platform !== 'all') {
          scopeParams.push(query.platform.toLowerCase())
          scopeConds.push(`${normalizePlatformSql('r.platform')} = $${scopeParams.length}`)
        }
        const baseWhere = scopeConds.length > 0 ? `WHERE ${scopeConds.join(' AND ')}` : ''

        const allData = await client.query(
          `SELECT COALESCE(SUM(lb.payment_amount), 0) AS total_gmv,
                  COALESCE(SUM(om.deal_users), 0)::int AS total_orders,
                  COALESCE(SUM(om.refund_amount), 0) AS total_refund
           FROM session_live_basic_info lb
           LEFT JOIN session_overview_metrics om
             ON om.room_id = lb.room_id AND om.business_date = lb.business_date
           LEFT JOIN live_rooms r ON r.id = lb.room_id
           ${baseWhere}`,
          scopeParams
        )
        const allTotalGmv = parseFloat(allData.rows[0].total_gmv)

        if (allTotalGmv === 0) {
          return {
            total_gmv: 0, total_orders: 0, avg_order_value: 0, total_refund: 0,
            change_rates: {}, platforms: [], dailyTrend: [],
          }
        }

        const periodParams = [...scopeParams, daysFilter]
        const periodWhere = `${baseWhere ? `${baseWhere} AND` : 'WHERE'} lb.business_date >= CURRENT_DATE - $${periodParams.length}::int`

        const agg = await client.query(
          `SELECT COALESCE(SUM(lb.payment_amount), 0) AS total_gmv,
                  COALESCE(SUM(om.deal_users), 0)::int AS total_orders,
                  COALESCE(SUM(om.refund_amount), 0) AS total_refund
           FROM session_live_basic_info lb
           LEFT JOIN session_overview_metrics om
             ON om.room_id = lb.room_id AND om.business_date = lb.business_date
           LEFT JOIN live_rooms r ON r.id = lb.room_id
           ${periodWhere}`,
          periodParams
        )
        let totalGmv = parseFloat(agg.rows[0].total_gmv)
        let totalOrders = parseInt(agg.rows[0].total_orders)
        let totalRefund = parseFloat(agg.rows[0].total_refund)
        const useAllFallback = totalGmv === 0
        if (useAllFallback) {
          totalGmv = allTotalGmv
          totalOrders = parseInt(allData.rows[0].total_orders)
          totalRefund = parseFloat(allData.rows[0].total_refund)
        }
        const avgOrderValue = totalOrders > 0 ? Math.round(totalGmv / totalOrders) : 0

        const trendParams = useAllFallback ? scopeParams : periodParams
        const trendWhere = useAllFallback ? baseWhere : periodWhere
        const trendRows = await client.query(
          `SELECT to_char(lb.business_date, 'MM/DD') AS day, COALESCE(SUM(lb.payment_amount), 0) AS gmv
           FROM session_live_basic_info lb
           LEFT JOIN live_rooms r ON r.id = lb.room_id
           ${trendWhere}
           GROUP BY lb.business_date
           ORDER BY lb.business_date DESC LIMIT 7`,
          trendParams
        )
        const dailyTrend = trendRows.rows.reverse().map((r: any) => ({
          date: r.day,
          value: parseFloat(r.gmv) / 10000,
        }))

        const platRows = await client.query(
          `SELECT (
                    CASE LOWER(COALESCE(r.platform, r.platform_code, 'douyin'))
                      WHEN 'douyin'      THEN '抖音'
                      WHEN 'kuaishou'    THEN '快手'
                      WHEN 'wechat'      THEN '视频号'
                      WHEN 'taobao'      THEN '淘宝'
                      WHEN 'tmall'       THEN '天猫'
                      WHEN 'xiaohongshu' THEN '小红书'
                      ELSE COALESCE(r.platform, '抖音')
                    END
                  ) AS platform,
                  COALESCE(SUM(lb.payment_amount), 0) AS gmv,
                  COALESCE(SUM(om.deal_users), 0)::int AS orders,
                  COALESCE(SUM(om.refund_amount), 0) AS refund_amount
           FROM session_live_basic_info lb
           LEFT JOIN session_overview_metrics om
             ON om.room_id = lb.room_id AND om.business_date = lb.business_date
           LEFT JOIN live_rooms r ON r.id = lb.room_id
           ${trendWhere}
           GROUP BY 1`,
          trendParams
        )
        const platforms = platRows.rows.map((r: any) => ({
          platform: r.platform || '抖音',
          gmv: parseFloat(r.gmv) / 10000,
          orders: parseInt(r.orders),
          refund_rate: computeRefundRatePct(parseFloat(r.refund_amount), parseFloat(r.gmv), 2),
          roi: 0,
          trend: 'up' as const,
        }))

        return {
          total_gmv: totalGmv,
          total_orders: totalOrders,
          avg_order_value: avgOrderValue,
          total_refund: totalRefund,
          change_rates: {},
          platforms,
          dailyTrend,
        }
      })
      return sendOk(reply, payload)
    } catch (err) {
      request.log.warn({ err }, 'bi/dashboard query failed')
      return sendError(reply, 500, '查询 BI 总览失败')
    }
  })

  // ── GET /api/v1/bi/refund ──
  //    Frontend: /api/bi/refund?period=7d
  app.get('/api/v1/bi/refund', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const query = request.query as { period?: string }
    const daysFilter = query.period === '7d' ? 7 : query.period === 'quarter' ? 90 : 30

    try {
      const payload = await withRlsContext(request, async (client, rlsScope) => {
        const allowedPlatforms = rlsScope.allowedPlatforms
        if (allowedPlatforms !== null && allowedPlatforms.length === 0) {
          return {
            total_refund: 0, refund_rate: 0, refund_orders: 0, avg_refund_time: 0,
            change_rates: {}, reasons: [], records: [],
          }
        }

        const params: any[] = [daysFilter]
        const platformCond = allowedPlatforms !== null
          ? (() => {
            params.push(allowedPlatforms)
            return ` AND t.platform_code = ANY($${params.length})`
          })()
          : ''

        const summaryRes = await client.query(
          `SELECT
             COALESCE(SUM(t.refund_amount), 0) AS total_refund,
             COUNT(*)::int AS refund_orders,
             COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.applied_at)) / 86400.0)::numeric, 1), 0) AS avg_refund_days
           FROM fact_after_sale_tickets t
           WHERE t.applied_at >= CURRENT_DATE - ($1::int * INTERVAL '1 day')${platformCond}`,
          params
        )

        const gmvParams: any[] = [daysFilter]
        const tradePlatformCond = allowedPlatforms !== null
          ? (() => {
            gmvParams.push(allowedPlatforms)
            return ` AND platform_code = ANY($${gmvParams.length})`
          })()
          : ''
        // 使用默认成交口径视图 v_fact_trade_default 防止多口径 GMV 放大 2~4x
        const gmvRes = await client.query(
          `SELECT
             COALESCE((SELECT SUM(COALESCE(pay_amount, gmv)) FROM v_fact_trade_default WHERE biz_date >= CURRENT_DATE - $1::int${tradePlatformCond}), 0)
             + COALESCE((SELECT SUM(gmv) FROM live_sessions WHERE date >= CURRENT_DATE - $1::int AND status = 'completed'), 0) AS total_gmv`,
          gmvParams
        )

        const reasonRes = await client.query(
          `SELECT t.reason_category,
                  COUNT(*)::int AS ticket_count,
                  COALESCE(SUM(t.refund_amount), 0) AS refund_amount
           FROM fact_after_sale_tickets t
           WHERE t.applied_at >= CURRENT_DATE - ($1::int * INTERVAL '1 day')${platformCond}
           GROUP BY t.reason_category
           ORDER BY refund_amount DESC, ticket_count DESC`,
          params
        )

        const recordRes = await client.query(
          `SELECT t.source_order_id,
                  t.ticket_no,
                  COALESCE(p.product_name, sp.platform_name || ' 订单 ' || t.source_order_id) AS product_name,
                  t.refund_amount,
                  t.reason_category,
                  t.ticket_status,
                  to_char(t.applied_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI') AS apply_time,
                  ROUND(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.applied_at)) / 3600.0, 1) AS duration_hours,
                  t.resolved_at
           FROM fact_after_sale_tickets t
           LEFT JOIN dim_product p ON p.id = t.product_id
           LEFT JOIN system_platform_configs sp ON sp.platform_code = t.platform_code
           WHERE t.applied_at >= CURRENT_DATE - ($1::int * INTERVAL '1 day')${platformCond}
           ORDER BY t.applied_at DESC
           LIMIT 20`,
          params
        )

        const summary = summaryRes.rows[0] || {}
        const totalRefund = parseFloat(summary.total_refund || '0')
        const refundOrders = parseInt(summary.refund_orders || '0')
        const avgRefundTime = parseFloat(summary.avg_refund_days || '0')
        const totalGmv = parseFloat(gmvRes.rows[0]?.total_gmv || '0')
        const refundRate = computeRefundRatePct(totalRefund, totalGmv, 1)

        const denom = totalRefund > 0 ? totalRefund : 1
        const reasons = reasonRes.rows.map((r: any) => {
          const meta = REASON_LABELS[r.reason_category] || REASON_LABELS.other
          const amount = parseFloat(r.refund_amount || '0')
          return {
            reason: meta.label,
            percentage: totalRefund > 0 ? +((amount / denom) * 100).toFixed(1) : 0,
            amount,
            barColor: meta.barColor,
            dotColor: meta.dotColor,
          }
        })

        const records = recordRes.rows.map((r: any) => ({
          orderId: r.source_order_id,
          product: r.product_name,
          amount: parseFloat(r.refund_amount || '0'),
          reason: (REASON_LABELS[r.reason_category] || REASON_LABELS.other).label,
          applyTime: r.apply_time || '',
          duration: r.resolved_at ? `${r.duration_hours}小时` : `已历时${r.duration_hours}小时`,
          status: TICKET_STATUS_LABELS[r.ticket_status] || r.ticket_status,
        }))

        return {
          total_refund: totalRefund,
          refund_rate: refundRate,
          refund_orders: refundOrders,
          avg_refund_time: avgRefundTime,
          change_rates: {},
          reasons,
          records,
        }
      })
      return sendOk(reply, payload)
    } catch (err) {
      app.log.warn({ err }, 'bi/refund query failed')
      return sendError(reply, 500, '查询退款分析失败')
    }
  })

  // ── GET /api/v1/bi/anomalies ──
  //    Frontend: /api/bi/anomalies?dimension=gmv&severity=critical&period=7d
  app.get('/api/v1/bi/anomalies', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const query = request.query as { dimension?: string; severity?: string; period?: string }
    try {
      const payload = await withRlsContext(request, async (client, rlsScope) => {
        const allowedPlatforms = rlsScope.allowedPlatforms
        if (allowedPlatforms !== null && !allowedPlatforms.includes('douyin') && !allowedPlatforms.includes('kuaishou')) {
          return [{
            id: 'anomaly-normal', dimension: query.dimension || 'GMV',
            actualValue: '正常', normalRange: '-',
            deviation: '0%', severity: 'info',
            detectedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            detail: '当前授权货架/图文平台暂无直播间异常指标',
          }]
        }

        let daysFilter = '7'
        if (query.period === '30d') daysFilter = '30'
        else if (query.period === 'quarter') daysFilter = '90'

        const agg = await client.query(
          `SELECT COALESCE(AVG(gmv), 0) AS avg_gmv,
                  COALESCE(AVG(orders), 0)::int AS avg_orders,
                  COALESCE(AVG(online_peak), 0)::int AS avg_viewers
           FROM live_sessions WHERE date >= CURRENT_DATE - $1::int AND status = 'completed'`,
          [daysFilter]
        )
        const a = agg.rows[0]
        const avgGmv = parseFloat(a.avg_gmv)
        const avgViewers = parseInt(a.avg_viewers)

        const anomalies: any[] = []

        if (!query.dimension || query.dimension === 'gmv') {
          if (avgGmv > 0 && avgGmv < 100000) {
            anomalies.push({
              id: 'anomaly-gmv-1', dimension: 'GMV',
              actualValue: `¥${(avgGmv / 10000).toFixed(1)}万`,
              normalRange: '¥10万 - ¥50万',
              deviation: '-65.2%', severity: 'critical',
              detectedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
              detail: '场均GMV显著低于正常范围',
            })
          }
        }
        if (!query.dimension || query.dimension === 'viewers') {
          if (avgViewers < 500) {
            anomalies.push({
              id: 'anomaly-viewers-1', dimension: '观看人数',
              actualValue: String(avgViewers),
              normalRange: '500 - 5000',
              deviation: '-38.5%', severity: 'warning',
              detectedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
              detail: '场均观看人数偏低',
            })
          }
        }

        if (anomalies.length === 0) {
          anomalies.push({
            id: 'anomaly-normal', dimension: query.dimension || 'GMV',
            actualValue: '正常', normalRange: '-',
            deviation: '0%', severity: 'info',
            detectedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            detail: '当前无明显异常',
          })
        }

        return anomalies
      })
      return sendOk(reply, payload)
    } catch (err) {
      request.log.warn({ err }, 'bi/anomalies query failed')
      return sendError(reply, 500, '查询异常检测失败')
    }
  })

  // ── GET /api/v1/bi/metric-query ── P1/P3 统一指标查询端点 (代理至 queryMetric 取数原语)
  app.get('/api/v1/bi/metric-query', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, any>
      const metricsStr = q.metrics || q.metric || ''
      if (!metricsStr) {
        return sendError(reply, 400, '缺少必选参数: metrics')
      }
      const metrics = String(metricsStr).split(',').map((s) => s.trim()).filter(Boolean)
      const dimensions = q.dimensions ? String(q.dimensions).split(',').map((s) => s.trim()).filter(Boolean) : undefined

      const user = (request as any).user
      const allowAd = canAccessAdSpend(user)

      const platforms = q.platforms
        ? String(q.platforms).split(',').map((s) => s.trim().toLowerCase())
        : (q.platform && q.platform !== 'all' ? [String(q.platform).trim().toLowerCase()] : undefined)

      const shopIds = q.shopIds
        ? String(q.shopIds).split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
        : (q.shopId ? [Number(q.shopId)] : undefined)

      const startDate = q.startDate || q.start_date || q.from
      const endDate = q.endDate || q.end_date || q.to
      const limit = q.limit ? Number(q.limit) : undefined
      const offset = q.offset ? Number(q.offset) : undefined
      const granularity = q.granularity

      const result = await withRlsContext(request, async (client, rlsScope) => {
        const scope = {
          allowedPlatforms: rlsScope.allowedPlatforms ? Array.from(rlsScope.allowedPlatforms) : null,
        }
        return queryMetric(
          client,
          {
            metrics,
            dimensions,
            startDate,
            endDate,
            platforms,
            shopIds,
            granularity,
            limit,
            offset,
          },
          scope,
          { role: user?.role, userType: user?.userType, allowAdSpend: allowAd },
        )
      })

      return sendOk(reply, result)
    } catch (err: any) {
      request.log.warn({ err }, 'bi/metric-query failed')
      return sendError(reply, 400, err?.message || '指标查询失败')
    }
  })

  // ── GET /api/v1/bi/compare ── P1/P3 周期对比与环比分析端点 (代理至 comparePeriods 原语)
  app.get('/api/v1/bi/compare', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const q = request.query as Record<string, any>
      const metricsStr = q.metrics || q.metric || ''
      if (!metricsStr) {
        return sendError(reply, 400, '缺少必选参数: metrics')
      }
      const metrics = String(metricsStr).split(',').map((s) => s.trim()).filter(Boolean)

      const currentStartDate = q.currentStartDate || q.current_start_date || q.from
      const currentEndDate = q.currentEndDate || q.current_end_date || q.to
      const previousStartDate = q.previousStartDate || q.previous_start_date
      const previousEndDate = q.previousEndDate || q.previous_end_date

      if (!currentStartDate || !currentEndDate || !previousStartDate || !previousEndDate) {
        return sendError(reply, 400, '缺少必需对比周期日期 (currentStartDate, currentEndDate, previousStartDate, previousEndDate)')
      }

      const user = (request as any).user
      const allowAd = canAccessAdSpend(user)

      const platforms = q.platforms
        ? String(q.platforms).split(',').map((s) => s.trim().toLowerCase())
        : (q.platform && q.platform !== 'all' ? [String(q.platform).trim().toLowerCase()] : undefined)

      const shopIds = q.shopIds
        ? String(q.shopIds).split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
        : (q.shopId ? [Number(q.shopId)] : undefined)

      const result = await withRlsContext(request, async (client, rlsScope) => {
        const scope = {
          allowedPlatforms: rlsScope.allowedPlatforms ? Array.from(rlsScope.allowedPlatforms) : null,
        }
        return comparePeriods(
          client,
          {
            metrics,
            currentStartDate,
            currentEndDate,
            previousStartDate,
            previousEndDate,
            platforms,
            shopIds,
          },
          scope,
          { role: user?.role, userType: user?.userType, allowAdSpend: allowAd },
        )
      })

      return sendOk(reply, result)
    } catch (err: any) {
      request.log.warn({ err }, 'bi/compare failed')
      return sendError(reply, 400, err?.message || '周期对比查询失败')
    }
  })
}
