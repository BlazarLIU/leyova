import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, canAccessAdSpend } from '../lib/guard.js'

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
    WHEN '淘宝' THEN 'taobao'
    WHEN '天猫' THEN 'tmall'
    WHEN '京东' THEN 'jd'
    WHEN '拼多多' THEN 'pdd'
    WHEN '快手' THEN 'kuaishou'
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
          `SELECT COALESCE(r.platform, '抖音') AS platform,
                  COALESCE(SUM(lb.payment_amount), 0) AS gmv,
                  COALESCE(SUM(om.deal_users), 0)::int AS orders,
                  COALESCE(SUM(om.refund_amount), 0) AS refund_amount
           FROM session_live_basic_info lb
           LEFT JOIN session_overview_metrics om
             ON om.room_id = lb.room_id AND om.business_date = lb.business_date
           LEFT JOIN live_rooms r ON r.id = lb.room_id
           ${trendWhere}
           GROUP BY r.platform`,
          trendParams
        )
        const platforms = platRows.rows.map((r: any) => ({
          platform: r.platform || '抖音',
          gmv: parseFloat(r.gmv) / 10000,
          orders: parseInt(r.orders),
          refund_rate: parseFloat(r.gmv) > 0 ? +((parseFloat(r.refund_amount) / parseFloat(r.gmv)) * 100).toFixed(2) : 0,
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

  // ── GET /api/v1/bi/roi ── (保留兼容路由并修正列名，建议前端迁移至 /api/v1/net-roi/overview)
  app.get('/api/v1/bi/roi', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!canAccessAdSpend(user) && user.userType !== 'brand_viewer') {
      return sendError(reply, 403, '当前角色无权查看投流消耗与 ROI 数据')
    }

    const query = request.query as { period?: string; month?: string; year?: string }
    const period = query.period || '30d'

    try {
      const now = new Date()
      let startDate: Date
      let endDate: Date

      switch (period) {
        case 'yesterday':
          startDate = new Date(now.getTime() - 86400000)
          endDate = new Date(now.getTime() - 86400000)
          break
        case '7d':
          startDate = new Date(now.getTime() - 7 * 86400000)
          endDate = now
          break
        case '15d':
          startDate = new Date(now.getTime() - 15 * 86400000)
          endDate = now
          break
        case '30d':
          startDate = new Date(now.getTime() - 30 * 86400000)
          endDate = now
          break
        case 'month': {
          if (query.month && query.year) {
            const y = parseInt(query.year)
            const m = parseInt(query.month)
            startDate = new Date(y, m - 1, 1)
            endDate = new Date(y, m, 0)
          } else if (query.month && query.month.includes('-')) {
            const [y, m] = query.month.split('-').map(Number)
            startDate = new Date(y, m - 1, 1)
            endDate = new Date(y, m, 0)
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            endDate = now
          }
          break
        }
        case 'year': {
          const y = parseInt(query.year || String(now.getFullYear()))
          startDate = new Date(y, 0, 1)
          endDate = new Date(y, 11, 31)
          break
        }
        default:
          startDate = new Date(now.getTime() - 30 * 86400000)
          endDate = now
      }

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        startDate = new Date(now.getTime() - 30 * 86400000)
        endDate = now
      }

      const startStr = startDate.toISOString().slice(0, 10)
      const endStr = endDate.toISOString().slice(0, 10)

      const result = await withRlsContext(request, async (client, rlsScope) => {
        if (rlsScope.userType === 'brand_viewer' && !rlsScope.canViewCost) {
          return { forbidden: true as const }
        }

        const allowedPlatforms = rlsScope.allowedPlatforms
        const allowDouyin = allowedPlatforms === null || allowedPlatforms.includes('douyin')
        let liveTotalGmv = 0
        const dailyGmvMap = new Map<string, number>()

        if (allowDouyin) {
          const dailyRows = await client.query(
            `SELECT lb.business_date,
                    COALESCE(SUM(lb.payment_amount), 0) AS daily_gmv
             FROM session_live_basic_info lb
             WHERE lb.business_date >= $1 AND lb.business_date <= $2
             GROUP BY lb.business_date ORDER BY lb.business_date`,
            [startStr, endStr]
          )
          for (const r of dailyRows.rows) {
            const dateStr = typeof r.business_date === 'string' ? r.business_date : r.business_date.toISOString().slice(0, 10)
            const dgmv = parseFloat(r.daily_gmv || '0')
            liveTotalGmv += dgmv
            dailyGmvMap.set(dateStr, dgmv)
          }
        }

        const spendParams: any[] = [startStr, endStr]
        let spendWhere = 'WHERE f.biz_date >= $1 AND f.biz_date <= $2'
        if (allowedPlatforms !== null) {
          if (allowedPlatforms.length === 0) {
            return {
              forbidden: false as const,
              data: { period, overall_roi: 0, ad_roi: 0, organic_roi: 0, overall_rate: 0, change_rates: {}, chartData: [], channels: [] },
            }
          }
          spendParams.push(allowedPlatforms)
          spendWhere += ` AND f.platform_code = ANY($${spendParams.length})`
        }

        const adDailyRes = await client.query(
          `SELECT f.biz_date::text AS biz_date,
                  COALESCE(SUM(f.ad_spend), 0) AS ad_spend,
                  COALESCE(SUM(f.attributed_gross_gmv), 0) AS attributed_gross_gmv
           FROM fact_ad_spend_daily f
           ${spendWhere}
           GROUP BY f.biz_date
           ORDER BY f.biz_date`,
          spendParams
        )

        let factAdSpend = 0
        let factAttributedGmv = 0
        const dailySpendMap = new Map<string, { spend: number; gmv: number }>()
        for (const r of adDailyRes.rows) {
          const sp = parseFloat(r.ad_spend || '0')
          const ag = parseFloat(r.attributed_gross_gmv || '0')
          factAdSpend += sp
          factAttributedGmv += ag
          dailySpendMap.set(String(r.biz_date).slice(0, 10), { spend: sp, gmv: ag })
        }

        const channels: any[] = []
        let douyinChannelSpend = 0
        let douyinChannelOutput = 0

        const toolChannelsRes = await client.query(
          `SELECT COALESCE(sp.platform_name, f.platform_code) || ' · ' || COALESCE(d.name, f.ad_tool_code) AS channel,
                  COALESCE(SUM(f.ad_spend), 0) AS total_spend,
                  COALESCE(SUM(f.attributed_gross_gmv), 0) AS total_output
           FROM fact_ad_spend_daily f
           LEFT JOIN system_platform_configs sp ON sp.platform_code = f.platform_code
           LEFT JOIN ad_tool_dict d ON d.platform_code = f.platform_code AND d.code = f.ad_tool_code
           ${spendWhere}
           GROUP BY sp.platform_name, f.platform_code, d.name, f.ad_tool_code
           ORDER BY total_output DESC`,
          spendParams
        )
        for (const r of toolChannelsRes.rows) {
          const spend = parseFloat(r.total_spend || '0')
          const output = parseFloat(r.total_output || '0')
          const channelRoi = spend > 0 ? +(output / spend).toFixed(2) : 0
          channels.push({
            channel: r.channel,
            investment: +(spend / 10000).toFixed(2),
            output: +(output / 10000).toFixed(2),
            roi: channelRoi,
            change: 0,
            rating: channelRoi >= 3.0 ? '优秀' : channelRoi >= 1.8 ? '良好' : channelRoi >= 1 ? '一般' : '较差',
          })
        }

        if (allowDouyin) {
          await client.query('SAVEPOINT sp_douyin_chan')
          try {
            const channelRows = await client.query(
              `SELECT channel_name AS channel,
                      COALESCE(SUM(ad_cost_bound), 0) AS total_spend,
                      COALESCE(SUM(payment_amount), 0) AS total_output
               FROM douyin_channel_daily_metrics
               WHERE business_date >= $1 AND business_date <= $2
               GROUP BY channel_name ORDER BY total_output DESC`,
              [startStr, endStr]
            )
            await client.query('RELEASE SAVEPOINT sp_douyin_chan')
            for (const r of channelRows.rows) {
              const spend = parseFloat(r.total_spend || '0')
              const output = parseFloat(r.total_output || '0')
              douyinChannelSpend += spend
              douyinChannelOutput += output
              const channelRoi = spend > 0 ? +(output / spend).toFixed(2) : 0
              channels.push({
                channel: r.channel,
                investment: +(spend / 10000).toFixed(2),
                output: +(output / 10000).toFixed(2),
                roi: channelRoi,
                change: 0,
                rating: channelRoi >= 2.5 ? '优秀' : channelRoi >= 1.5 ? '良好' : channelRoi >= 1 ? '一般' : '较差',
              })
            }
          } catch {
            await client.query('ROLLBACK TO SAVEPOINT sp_douyin_chan')
          }
        }

        const totalAdSpend = factAdSpend + douyinChannelSpend
        const totalAttributedGmv = factAttributedGmv + douyinChannelOutput
        const effectiveTotalGmv = Math.max(liveTotalGmv + factAttributedGmv, totalAttributedGmv)
        const overallRoi = totalAdSpend > 0 ? +(effectiveTotalGmv / totalAdSpend).toFixed(2) : 0
        const adRoi = totalAdSpend > 0 ? +(totalAttributedGmv / totalAdSpend).toFixed(2) : 0
        const organicGmv = Math.max(0, effectiveTotalGmv - totalAttributedGmv)
        const organicRoi = totalAdSpend > 0 ? +(organicGmv / totalAdSpend).toFixed(2) : 0
        const overallRate = overallRoi

        const allDates = Array.from(new Set([...dailyGmvMap.keys(), ...dailySpendMap.keys()])).sort()
        const chartData = allDates.map((d) => {
          const ad = dailySpendMap.get(d)
          const liveGmv = dailyGmvMap.get(d) || 0
          const dayGmv = liveGmv + (ad?.gmv || 0)
          const daySpend = ad?.spend || 0
          return {
            label: d.slice(5),
            roi: daySpend > 0 ? +(dayGmv / daySpend).toFixed(2) : 0,
            gmv: dayGmv,
          }
        })

        return {
          forbidden: false as const,
          data: {
            period,
            overall_roi: overallRoi,
            ad_roi: adRoi,
            organic_roi: organicRoi,
            overall_rate: overallRate,
            change_rates: {},
            chartData,
            channels,
          },
        }
      })

      if (result.forbidden) {
        return sendError(reply, 403, '品牌方账号未获成本与消耗明文查看授权')
      }
      return sendOk(reply, result.data)
    } catch (err) {
      request.log.warn({ err }, 'bi/roi query failed')
      return sendError(reply, 500, '查询 BI ROI 数据失败')
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
        const refundRate = totalGmv > 0 ? +((totalRefund / totalGmv) * 100).toFixed(1) : 0

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
}