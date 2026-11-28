import type { FastifyInstance } from 'fastify'
import { sendError, sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { AD_SPEND_ROLES, canAccessAdSpend, canAccessCost, canAccessCostAsync, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import { effectivePlatforms } from '../lib/platform-scope.js'
import { DecisionMetricsService } from '../services/decision-metrics.js'

const SETTLEMENT_WRITE_ROLES = ['super_admin', 'ad_buyer']
const AD_PLAN_WRITE_ROLES = ['super_admin', 'ops_director', 'ad_buyer']

function defaultDateRange(from?: string, to?: string): { fromDate: string; toDate: string } {
  const end = to || new Date().toISOString().slice(0, 10)
  const startDate = from ? new Date(from) : new Date(Date.now() - 29 * 86400_000)
  const fromDate = from || startDate.toISOString().slice(0, 10)
  return { fromDate, toDate: end }
}

/**
 * 注册全域投流消耗、官方归因窗口字典与 T+7 净成交 ROI 双时间线路由
 */
export async function netRoiRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/net-roi/attribution-windows ── 各平台官方归因窗口与结算周期字典
  app.get('/api/v1/net-roi/attribution-windows', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT d.code, d.name, d.platform_code, p.platform_name,
                  d.default_attribution_hours, d.impression_window_hours,
                  d.supported_windows, d.settlement_cycle_days,
                  d.has_indirect, d.is_verified, d.description
           FROM public.ad_tool_dict d
           LEFT JOIN public.system_platform_configs p ON p.platform_code = d.platform_code
           ORDER BY d.platform_code, d.code`,
        )
        return res.rows
      })
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'net-roi/attribution-windows query failed')
      return sendError(reply, 500, '查询平台官方归因窗口字典失败')
    }
  })

  // ── GET /api/v1/net-roi/overview ── T+0 消耗归因 vs T+N 净成交 ROI 双时间线总览
  app.get<{
    Querystring: { platform?: string; shopId?: string; from?: string; to?: string }
  }>('/api/v1/net-roi/overview', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    // P0-D-2：入口条件放宽为「能看投流消耗」或「能看成本」二者之一。
    // 老大要求投手/运营/HRBP 需评估成本，因此运营类角色即使不在 AD_SPEND_ROLES
    // 也允许进入本页；具体字段仍由 costMasked 脱敏控制（两层正交）。
    const costAllowed = await canAccessCostAsync(
      (user as any).id, user?.role, user?.userType, undefined)
    if (!canAccessAdSpend(user) && !costAllowed && user?.userType !== 'brand_viewer') {
      return sendError(reply, 403, '当前角色无权查看投流消耗与净利 ROI 数据')
    }

    const { platform, shopId, from, to } = request.query || {}
    const { fromDate, toDate } = defaultDateRange(from, to)
    const allowProfit = await canAccessCostAsync(
      (user as any).id, user.role, user.userType, undefined)

    try {
      const result = await withRlsContext(request, async (client, scope) => {
        if (scope.userType === 'brand_viewer' && !scope.canViewCost) {
          return { forbidden: true as const }
        }

        const params: any[] = [fromDate, toDate]
        let filterSql = ''
        const eff = effectivePlatforms(platform, scope.allowedPlatforms)
        if (eff !== null) {
          params.push(eff)
          filterSql += ` AND f.platform_code = ANY($${params.length}::text[])`
        }
        if (shopId) {
          params.push(Number(shopId))
          filterSql += ` AND f.shop_id = $${params.length}`
        }

        const summaryRes = await client.query(
          `SELECT
             COALESCE(SUM(f.ad_spend), 0)::numeric(14,2) AS total_ad_spend,
             COALESCE(SUM(f.attributed_gross_gmv), 0)::numeric(14,2) AS total_attributed_gross_gmv,
             COALESCE(SUM(f.attributed_settled_gmv), 0)::numeric(14,2) AS total_attributed_settled_gmv,
             COALESCE(SUM(f.refund_reserve_amount), 0)::numeric(14,2) AS total_refund_reserve,
             COALESCE(SUM(f.impressions), 0)::bigint AS total_impressions,
             COALESCE(SUM(f.clicks), 0)::bigint AS total_clicks,
             COALESCE(SUM(f.attributed_orders), 0)::int AS total_attributed_orders
           FROM public.fact_ad_spend_daily f
           WHERE f.biz_date >= $1::date AND f.biz_date <= $2::date ${filterSql}`,
          params,
        )

        const cycleFilterSql = filterSql.replaceAll('f.', 'c.')
        const timelineRes = await client.query(
          `SELECT c.id, c.platform_code, p.platform_name, c.shop_id, s.shop_name,
                  COALESCE(c.business_mode, 'standard') AS business_mode,
                  c.order_date, c.settle_date, c.settlement_cycle_days,
                  c.gross_gmv, c.settled_gmv, c.refund_deducted, c.reserve_held,
                  c.platform_fee, c.ad_spend,
                  c.settlement_status, c.note
           FROM public.fact_settlement_cycles c
           LEFT JOIN public.system_platform_configs p ON p.platform_code = c.platform_code
           LEFT JOIN public.dim_shop s ON s.id = c.shop_id
           WHERE c.order_date >= $1::date AND c.order_date <= $2::date ${cycleFilterSql}
           ORDER BY c.order_date ASC, c.id ASC`,
          params,
        )

        // 按官方归因窗口分组并折算 7d 可比基准 ROI（让 attribution_window_hours 真正参与计算）
        const byWindowRes = await client.query(
          `SELECT
             COALESCE(f.attribution_window_hours, d.default_attribution_hours, 168)::int AS attribution_window_hours,
             COUNT(*)::int AS row_count,
             array_agg(DISTINCT f.platform_code ORDER BY f.platform_code) AS platforms,
             COALESCE(SUM(f.ad_spend), 0)::numeric(14,2) AS ad_spend,
             COALESCE(SUM(f.attributed_gross_gmv), 0)::numeric(14,2) AS attributed_gross_gmv,
             COALESCE(SUM(f.attributed_settled_gmv), 0)::numeric(14,2) AS attributed_settled_gmv
           FROM public.fact_ad_spend_daily f
           LEFT JOIN public.ad_tool_dict d ON d.code = f.ad_tool_code
           WHERE f.biz_date >= $1::date AND f.biz_date <= $2::date ${filterSql}
           GROUP BY COALESCE(f.attribution_window_hours, d.default_attribution_hours, 168)
           ORDER BY attribution_window_hours ASC`,
          params,
        )

        // 按财务结算模式拆分（如 T+45 长账期 vs T+1 短账期 vs 标准）
        const byBusinessModeRes = await client.query(
          `SELECT
             COALESCE(c.business_mode, 'standard') AS business_mode,
             COUNT(*)::int AS cycle_count,
             COALESCE(ROUND(AVG(c.settlement_cycle_days)), 0)::int AS avg_settle_days,
             COALESCE(SUM(c.gross_gmv), 0)::numeric(14,2) AS gross_gmv,
             COALESCE(SUM(c.settled_gmv), 0)::numeric(14,2) AS settled_gmv,
             COALESCE(SUM(c.ad_spend), 0)::numeric(14,2) AS ad_spend
           FROM public.fact_settlement_cycles c
           WHERE c.order_date >= $1::date AND c.order_date <= $2::date ${cycleFilterSql}
           GROUP BY COALESCE(c.business_mode, 'standard')
           ORDER BY business_mode ASC`,
          params,
        )

        const byToolRes = await client.query(
          `SELECT f.ad_tool_code,
                  d.name AS ad_tool_name,
                  f.platform_code,
                  COALESCE(f.attribution_window_hours, d.default_attribution_hours, 168)::int AS attribution_window_hours,
                  d.default_attribution_hours,
                  d.impression_window_hours,
                  d.supported_windows,
                  d.settlement_cycle_days,
                  COALESCE(SUM(f.ad_spend), 0)::numeric(14,2) AS ad_spend,
                  COALESCE(SUM(f.attributed_gross_gmv), 0)::numeric(14,2) AS attributed_gross_gmv,
                  COALESCE(SUM(f.attributed_settled_gmv), 0)::numeric(14,2) AS attributed_settled_gmv,
                  COALESCE(SUM(f.refund_reserve_amount), 0)::numeric(14,2) AS refund_reserve_amount,
                  COALESCE(SUM(f.impressions), 0)::bigint AS impressions,
                  COALESCE(SUM(f.clicks), 0)::bigint AS clicks,
                  COALESCE(SUM(f.attributed_orders), 0)::int AS attributed_orders
           FROM public.fact_ad_spend_daily f
           LEFT JOIN public.ad_tool_dict d ON d.code = f.ad_tool_code
           WHERE f.biz_date >= $1::date AND f.biz_date <= $2::date ${filterSql}
           GROUP BY f.ad_tool_code, d.name, f.platform_code, COALESCE(f.attribution_window_hours, d.default_attribution_hours, 168), d.default_attribution_hours,
                    d.impression_window_hours, d.supported_windows, d.settlement_cycle_days
           ORDER BY ad_spend DESC`,
          params,
        )

        const rawSummary = summaryRes.rows[0] || {}
        const spend = Number(rawSummary.total_ad_spend || 0)
        const grossGmv = Number(rawSummary.total_attributed_gross_gmv || 0)
        const settledGmv = Number(rawSummary.total_attributed_settled_gmv || 0)
        const clicks = Number(rawSummary.total_clicks || 0)

        const showMargin = allowProfit || (scope.userType === 'brand_viewer' && scope.canViewCost)
        // S4-B：结算净利已随财务板块移除，仅保留投放 ROI 与平台费
        const totalPlatformFee = showMargin
          ? timelineRes.rows.reduce((acc, r) => acc + Number(r.platform_fee || 0), 0)
          : null

        const dualTimeline = timelineRes.rows.map((r) => {
          const rowSpend = Number(r.ad_spend || 0)
          const rowGross = Number(r.gross_gmv || 0)
          const rowSettled = Number(r.settled_gmv || 0)
          const settledGmvRatio = DecisionMetricsService.calculateSettledGmvAdRatio(rowSettled, rowSpend)
          return {
            ...r,
            pay_roi: rowSpend > 0 ? Number((rowGross / rowSpend).toFixed(2)) : 0,
            settled_gmv_ad_ratio: settledGmvRatio.value,
            settled_gmv_ad_ratio_status: settledGmvRatio.status,
            platform_fee: showMargin ? Number(r.platform_fee || 0) : null,
          }
        })

        // 统一说明：废弃未经批准的魔数归一化，如需跨窗口比较须以确定性归因版本为准
        const byTool = byToolRes.rows.map((r) => {
          const tSpend = Number(r.ad_spend || 0)
          const tGross = Number(r.attributed_gross_gmv || 0)
          const tSettled = Number(r.attributed_settled_gmv || 0)
          const ratio = DecisionMetricsService.calculateSettledGmvAdRatio(tSettled, tSpend)
          return {
            ...r,
            pay_roi: tSpend > 0 ? Number((tGross / tSpend).toFixed(2)) : 0,
            settled_gmv_ad_ratio: ratio.value,
            settled_gmv_ad_ratio_status: ratio.status,
            normalized_7d_roi: tSpend > 0 ? Number((tGross / tSpend).toFixed(2)) : 0,
          }
        })

        const byAttributionWindow = byWindowRes.rows.map((r) => {
          const wSpend = Number(r.ad_spend || 0)
          const wGross = Number(r.attributed_gross_gmv || 0)
          const wSettled = Number(r.attributed_settled_gmv || 0)
          const winHours = Number(r.attribution_window_hours || 168)
          const ratio = DecisionMetricsService.calculateSettledGmvAdRatio(wSettled, wSpend)
          return {
            attribution_window_hours: winHours,
            window_days: Number((winHours / 24).toFixed(1)),
            platforms: r.platforms || [],
            row_count: Number(r.row_count || 0),
            ad_spend: wSpend,
            attributed_gross_gmv: wGross,
            attributed_settled_gmv: wSettled,
            raw_pay_roi: wSpend > 0 ? Number((wGross / wSpend).toFixed(2)) : 0,
            settled_gmv_ad_ratio: ratio.value,
            settled_gmv_ad_ratio_status: ratio.status,
            normalized_7d_roi: wSpend > 0 ? Number((wGross / wSpend).toFixed(2)) : 0,
          }
        })

        const byBusinessMode = byBusinessModeRes.rows.map((r) => {
          const mSpend = Number(r.ad_spend || 0)
          const mSettled = Number(r.settled_gmv || 0)
          const ratio = DecisionMetricsService.calculateSettledGmvAdRatio(mSettled, mSpend)
          return {
            business_mode: r.business_mode,
            cycle_count: Number(r.cycle_count || 0),
            avg_settle_days: Number(r.avg_settle_days || 0),
            gross_gmv: Number(r.gross_gmv || 0),
            settled_gmv: mSettled,
            ad_spend: mSpend,
            settled_gmv_ad_ratio: ratio.value,
            settled_gmv_ad_ratio_status: ratio.status,
          }
        })

        return {
          forbidden: false as const,
          data: {
            range: { from: fromDate, to: toDate },
            costMasked: !showMargin,
            summary: {
              total_ad_spend: spend,
              total_attributed_gross_gmv: grossGmv,
              total_attributed_settled_gmv: settledGmv,
              total_refund_reserve: Number(rawSummary.total_refund_reserve || 0),
              pay_roi: spend > 0 ? Number((grossGmv / spend).toFixed(2)) : 0,
              settled_gmv_ad_ratio: DecisionMetricsService.calculateSettledGmvAdRatio(settledGmv, spend).value,
              total_impressions: Number(rawSummary.total_impressions || 0),
              total_clicks: clicks,
              avg_cpc: clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0,
              total_attributed_orders: Number(rawSummary.total_attributed_orders || 0),
              total_platform_fee: totalPlatformFee,
            },
            dualTimeline,
            byTool,
            byAttributionWindow,
            byBusinessMode,
          },
        }
      })

      if (result.forbidden) {
        return sendError(reply, 403, '未授权查看投流净成交与成本指标')
      }
      return sendOk(reply, result.data)
    } catch (err) {
      request.log.warn({ err }, 'net-roi/overview query failed')
      return sendError(reply, 500, '查询 T+7 净成交 ROI 总览失败')
    }
  })

  // ── GET /api/v1/net-roi/ad-spend ── 投流消耗流水
  app.get<{
    Querystring: { platform?: string; shopId?: string; from?: string; to?: string; limit?: string }
  }>('/api/v1/net-roi/ad-spend', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    if (!canAccessAdSpend(user) && user?.userType !== 'brand_viewer') {
      return sendError(reply, 403, '当前角色无权查看投流明细')
    }
    const { platform, shopId, from, to, limit } = request.query || {}
    const { fromDate, toDate } = defaultDateRange(from, to)
    const lim = Math.min(Number(limit) || 100, 300)

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        if (scope.userType === 'brand_viewer' && !scope.canViewCost) {
          return { forbidden: true as const, rows: [] as any[] }
        }
        const params: any[] = [fromDate, toDate]
        let filterSql = ''
        const eff = effectivePlatforms(platform, scope.allowedPlatforms)
        if (eff !== null) {
          params.push(eff)
          filterSql += ` AND f.platform_code = ANY($${params.length}::text[])`
        }
        if (shopId) {
          params.push(Number(shopId))
          filterSql += ` AND f.shop_id = $${params.length}`
        }
        const res = await client.query(
          `SELECT f.*, d.name AS ad_tool_name, s.shop_name, p.platform_name,
                  CASE WHEN f.ad_spend > 0 THEN ROUND(f.attributed_gross_gmv / f.ad_spend, 2) ELSE 0 END AS pay_roi,
                  CASE WHEN f.ad_spend > 0 THEN ROUND(f.attributed_settled_gmv / f.ad_spend, 2) END AS settled_gmv_ad_ratio
           FROM public.fact_ad_spend_daily f
           LEFT JOIN public.ad_tool_dict d ON d.code = f.ad_tool_code
           LEFT JOIN public.dim_shop s ON s.id = f.shop_id
           LEFT JOIN public.system_platform_configs p ON p.platform_code = f.platform_code
           WHERE f.biz_date >= $1::date AND f.biz_date <= $2::date ${filterSql}
           ORDER BY f.biz_date DESC, f.ad_spend DESC
           LIMIT ${lim}`,
          params,
        )
        return { forbidden: false as const, rows: res.rows }
      })

      if (outcome.forbidden) return sendError(reply, 403, '无权查看投流消耗')
      return sendOk(reply, outcome.rows)
    } catch (err) {
      request.log.warn({ err }, 'net-roi/ad-spend query failed')
      return sendError(reply, 500, '获取投流明细失败')
    }
  })

  // ── POST /api/v1/net-roi/ad-spend ── 录入/更新投流日耗与预估结算口径
  app.post<{
    Body: {
      platformCode: string
      shopId: number
      bizDate: string
      adToolCode: string
      attributionWindowHours?: number
      adSpend: number
      impressions?: number
      clicks?: number
      attributedOrders?: number
      attributedGrossGmv?: number
      attributedSettledGmv?: number
      refundReserveAmount?: number
      settlementCycleDays?: number
    }
  }>('/api/v1/net-roi/ad-spend', { preHandler: [requireRole(AD_SPEND_ROLES)] }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.platformCode || !b.shopId || !b.bizDate || !b.adToolCode) {
      return sendError(reply, 400, '缺少必要参数 (platformCode, shopId, bizDate, adToolCode)')
    }

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        if (effectivePlatforms(b.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { error: { code: 403, msg: '无权访问该平台数据' } }
        }
        const shopCheck = await assertShopPlatform(client, b.shopId, b.platformCode)
        if (!shopCheck.ok) {
          return { error: { code: shopCheck.statusCode || 400, msg: shopCheck.message || '店铺校验失败' } }
        }

        const toolRes = await client.query<{
          default_attribution_hours: number | null
          settlement_cycle_days: number
          platform_code: string
        }>(
          'SELECT default_attribution_hours, settlement_cycle_days, platform_code FROM public.ad_tool_dict WHERE code = $1',
          [b.adToolCode],
        )
        const tool = toolRes.rows[0]
        if (!tool || tool.platform_code !== b.platformCode) {
          return { error: { code: 400, msg: `投流工具 ${b.adToolCode} 与平台 ${b.platformCode} 不匹配或不存在` } }
        }

        const windowHours = Number(b.attributionWindowHours || tool.default_attribution_hours || 168)
        const cycleDays = Number(b.settlementCycleDays ?? tool.settlement_cycle_days ?? 7)

        const { rows } = await client.query(
          `INSERT INTO public.fact_ad_spend_daily
             (tenant_id, platform_code, shop_id, biz_date, ad_tool_code,
              attribution_window_hours, ad_spend, impressions, clicks,
              attributed_orders, attributed_gross_gmv, attributed_settled_gmv,
              refund_reserve_amount, settlement_cycle_days, estimated_settle_date)
           VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, ($4::date + $14 * INTERVAL '1 day')::date)
           ON CONFLICT (tenant_id, platform_code, shop_id, biz_date, ad_tool_code) DO UPDATE SET
             attribution_window_hours = EXCLUDED.attribution_window_hours,
             ad_spend = EXCLUDED.ad_spend,
             impressions = EXCLUDED.impressions,
             clicks = EXCLUDED.clicks,
             attributed_orders = EXCLUDED.attributed_orders,
             attributed_gross_gmv = EXCLUDED.attributed_gross_gmv,
             attributed_settled_gmv = EXCLUDED.attributed_settled_gmv,
             refund_reserve_amount = EXCLUDED.refund_reserve_amount,
             settlement_cycle_days = EXCLUDED.settlement_cycle_days,
             estimated_settle_date = EXCLUDED.estimated_settle_date,
             updated_at = NOW()
           RETURNING *`,
          [
            scope.tenantId,
            b.platformCode,
            Number(b.shopId),
            b.bizDate,
            b.adToolCode,
            windowHours,
            Number(b.adSpend || 0),
            Number(b.impressions || 0),
            Number(b.clicks || 0),
            Number(b.attributedOrders || 0),
            Number(b.attributedGrossGmv || 0),
            Number(b.attributedSettledGmv || 0),
            Number(b.refundReserveAmount || 0),
            cycleDays,
          ],
        )

        await writeAuditLog(client, {
          request,
          action: 'net_roi.ad_spend.upsert',
          resourceType: 'fact_ad_spend_daily',
          resourceId: rows[0].id,
          afterData: rows[0],
        })

        return { row: rows[0] }
      })

      if ('error' in outcome && outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }
      return sendOk(reply, outcome.row, '投流记录已保存')
    } catch (err) {
      request.log.warn({ err }, 'net-roi/ad-spend upsert failed')
      return sendError(reply, 500, '保存投流消耗失败')
    }
  })

  // ── GET /api/v1/net-roi/settlement-cycles ── 结算账期与回款明细
  app.get<{
    Querystring: { platform?: string; shopId?: string; status?: string; from?: string; to?: string }
  }>('/api/v1/net-roi/settlement-cycles', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    if (!canAccessAdSpend(user) && user?.userType !== 'brand_viewer') {
      return sendError(reply, 403, '无权查看结算周期明细')
    }
    const { platform, shopId, status, from, to } = request.query || {}
    const { fromDate, toDate } = defaultDateRange(from, to)
    const allowProfit = await canAccessCostAsync(
      (user as any).id, user.role, user.userType, undefined)

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        if (scope.userType === 'brand_viewer' && !scope.canViewCost) {
          return { forbidden: true as const, rows: [] as any[] }
        }
        const params: any[] = [fromDate, toDate]
        let filterSql = ''
        const eff = effectivePlatforms(platform, scope.allowedPlatforms)
        if (eff !== null) {
          params.push(eff)
          filterSql += ` AND c.platform_code = ANY($${params.length}::text[])`
        }
        if (shopId) {
          params.push(Number(shopId))
          filterSql += ` AND c.shop_id = $${params.length}`
        }
        if (status) {
          params.push(status)
          filterSql += ` AND c.settlement_status = $${params.length}`
        }

        const res = await client.query(
          `SELECT c.*, s.shop_name, p.platform_name
           FROM public.fact_settlement_cycles c
           LEFT JOIN public.dim_shop s ON s.id = c.shop_id
           LEFT JOIN public.system_platform_configs p ON p.platform_code = c.platform_code
           WHERE c.order_date >= $1::date AND c.order_date <= $2::date ${filterSql}
           ORDER BY c.order_date DESC, c.id DESC`,
          params,
        )

        const showMargin = allowProfit || (scope.userType === 'brand_viewer' && scope.canViewCost)
        return {
          forbidden: false as const,
          rows: res.rows.map((r) => {
            const spend = Number(r.ad_spend || 0)
            return {
              ...r,
              pay_roi: spend > 0 ? Number((Number(r.gross_gmv || 0) / spend).toFixed(2)) : 0,
              net_roi: spend > 0 ? Number((Number(r.settled_gmv || 0) / spend).toFixed(2)) : 0,
              platform_fee: showMargin ? Number(r.platform_fee || 0) : null,
            }
          }),
        }
      })

      if (outcome.forbidden) return sendError(reply, 403, '无权查看结算数据')
      return sendOk(reply, outcome.rows)
    } catch (err) {
      request.log.warn({ err }, 'net-roi/settlement-cycles query failed')
      return sendError(reply, 500, '查询结算周期失败')
    }
  })

  // ── POST /api/v1/net-roi/settlement-cycles ── 录入/核销 T+N 结算账期记录
  app.post<{
    Body: {
      platformCode: string
      shopId: number
      orderDate: string
      settleDate?: string
      settlementCycleDays?: number
      grossGmv?: number
      settledGmv?: number
      refundDeducted?: number
      reserveHeld?: number
      platformFee?: number
      adSpend?: number
      netProfit?: number
      settlementStatus?: 'pending' | 'partial' | 'settled' | 'frozen'
      note?: string
    }
  }>('/api/v1/net-roi/settlement-cycles', { preHandler: [requireRole(SETTLEMENT_WRITE_ROLES)] }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.platformCode || !b.shopId || !b.orderDate) {
      return sendError(reply, 400, '缺少必要参数 (platformCode, shopId, orderDate)')
    }

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        if (effectivePlatforms(b.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { error: { code: 403, msg: '无权访问该平台数据' } }
        }
        const shopCheck = await assertShopPlatform(client, b.shopId, b.platformCode)
        if (!shopCheck.ok) {
          return { error: { code: shopCheck.statusCode || 400, msg: shopCheck.message || '店铺校验失败' } }
        }
        const cycleDays = Number(b.settlementCycleDays ?? 7)
        const grossGmv = Number(b.grossGmv || 0)
        const refundDeducted = Number(b.refundDeducted || 0)
        const reserveHeld = Number(b.reserveHeld || 0)
        const settledGmv =
          b.settledGmv !== undefined ? Number(b.settledGmv) : Math.max(grossGmv - refundDeducted - reserveHeld, 0)
        const platformFee = Number(b.platformFee || 0)
        const adSpend = Number(b.adSpend || 0)
        if (b.netProfit === undefined || b.netProfit === null) {
          return {
            error: {
              code: 400,
              msg: '必须显式提供完整口径 netProfit（含商品成本、平台佣金、履约等），禁止用收入减平台费与投流替代',
            },
          }
        }
        const netProfit = Number(b.netProfit)
        const status = b.settlementStatus || 'pending'

        const { rows } = await client.query(
          `INSERT INTO public.fact_settlement_cycles
             (tenant_id, platform_code, shop_id, order_date, settle_date, settlement_cycle_days,
              gross_gmv, settled_gmv, refund_deducted, reserve_held, platform_fee, ad_spend,
              net_profit, settlement_status, note)
           VALUES ($1, $2, $3, $4::date,
                   COALESCE($5::date, ($4::date + $6 * INTERVAL '1 day')::date),
                   $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (tenant_id, platform_code, shop_id, order_date) DO UPDATE SET
             settle_date = EXCLUDED.settle_date,
             settlement_cycle_days = EXCLUDED.settlement_cycle_days,
             gross_gmv = EXCLUDED.gross_gmv,
             settled_gmv = EXCLUDED.settled_gmv,
             refund_deducted = EXCLUDED.refund_deducted,
             reserve_held = EXCLUDED.reserve_held,
             platform_fee = EXCLUDED.platform_fee,
             ad_spend = EXCLUDED.ad_spend,
             net_profit = EXCLUDED.net_profit,
             settlement_status = EXCLUDED.settlement_status,
             note = EXCLUDED.note,
             updated_at = NOW()
           RETURNING *`,
          [
            scope.tenantId,
            b.platformCode,
            Number(b.shopId),
            b.orderDate,
            b.settleDate || null,
            cycleDays,
            grossGmv,
            settledGmv,
            refundDeducted,
            reserveHeld,
            platformFee,
            adSpend,
            netProfit,
            status,
            b.note || '',
          ],
        )

        await writeAuditLog(client, {
          request,
          action: 'net_roi.settlement.upsert',
          resourceType: 'fact_settlement_cycles',
          resourceId: rows[0].id,
          afterData: rows[0],
        })

        return { row: rows[0] }
      })

      if ('error' in outcome && outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }
      return sendOk(reply, outcome.row, '结算账期记录已更新')
    } catch (err) {
      request.log.warn({ err }, 'net-roi/settlement-cycles upsert failed')
      return sendError(reply, 500, '保存结算账期失败')
    }
  })

}
