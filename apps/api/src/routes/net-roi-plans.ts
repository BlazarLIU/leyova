import type { FastifyInstance } from 'fastify'
import { requireTenantId } from '../lib/tenant-context.js'
import { sendError, sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { AD_SPEND_ROLES, canAccessAdSpend, canAccessCost, canAccessCostAsync, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { assertShopPlatform } from '../lib/shop-guard.js'
import { effectivePlatforms } from '../lib/platform-scope.js'

const AD_PLAN_WRITE_ROLES = ['super_admin', 'ops_director', 'ad_buyer']

/**
 * net-roi 域拆分（P2-1）：投流计划列表 / 新建 / 更新 / 回执
 * 原属 routes/net-roi.ts，2026-11-17 拆出。
 */
export async function netRoiPlansRoutes(app: FastifyInstance) {
  // ── GET /api/v1/net-roi/ad-plans ── 投流计划列表与三列可比对账（P6 闭环）
  app.get<{
    Querystring: { platform?: string; shopId?: string; from?: string; to?: string; status?: string }
  }>('/api/v1/net-roi/ad-plans', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    const costAllowed = await canAccessCostAsync(user?.id, user?.role, user?.userType, undefined)
    if (!canAccessAdSpend(user) && !costAllowed && user?.userType !== 'brand_viewer') {
      return sendError(reply, 403, '当前角色无权查看投流计划数据')
    }

    const { platform, shopId, from, to, status } = request.query || {}
    try {
      const rows = await withRlsContext(request, async (client, scope) => {
        const conds: string[] = []
        const params: any[] = []

        const eff = effectivePlatforms(platform === 'all' ? undefined : platform, scope.allowedPlatforms)
        if (eff !== null) {
          params.push(eff)
          conds.push(`p.platform_code = ANY($${params.length}::text[])`)
        }
        if (shopId) {
          params.push(Number(shopId))
          conds.push(`p.shop_id = $${params.length}`)
        }
        if (from) {
          params.push(from)
          conds.push(`p.plan_date >= $${params.length}::date`)
        }
        if (to) {
          params.push(to)
          conds.push(`p.plan_date <= $${params.length}::date`)
        }
        if (status) {
          params.push(status)
          conds.push(`p.status = $${params.length}`)
        }

        const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
        const res = await client.query(
          `SELECT p.* FROM public.v_ad_plan_comparison p
           ${whereClause}
           ORDER BY p.plan_date DESC, p.plan_id DESC`,
          params,
        )
        return res.rows
      })

      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'net-roi/ad-plans query failed')
      return sendError(reply, 500, '查询投流计划列表失败')
    }
  })

  // ── POST /api/v1/net-roi/ad-plans ── 新建投流计划（P6 闭环）
  app.post<{
    Body: {
      planNo?: string
      planName: string
      shopId: number
      platformCode: string
      adToolCode: string
      sessionId?: number
      planDate: string
      plannedBudget: number
      targetRoi?: number
      preHeatRatio?: number
      livePeakRatio?: number
      tailPushRatio?: number
      targetingTags?: any[]
      bidStrategy?: string
      status?: string
    }
  }>('/api/v1/net-roi/ad-plans', { preHandler: [requireRole(AD_PLAN_WRITE_ROLES)] }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.planName || !b.shopId || !b.platformCode || !b.adToolCode || !b.planDate || b.plannedBudget === undefined) {
      return sendError(reply, 400, '缺少必填字段: planName, shopId, platformCode, adToolCode, planDate, plannedBudget')
    }

    const planNo = b.planNo || `PLAN-AD-${b.planDate.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const user = (request as any).user

    try {
      const row = await withRlsContext(request, async (client, scope) => {
        if (effectivePlatforms(b.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { forbidden: true as const }
        }
        const res = await client.query(
          `INSERT INTO public.ad_plan (
            tenant_id, plan_no, session_id, shop_id, platform_code, ad_tool_code,
            plan_name, plan_date, planned_budget, target_roi,
            pre_heat_ratio, live_peak_ratio, tail_push_ratio,
            targeting_tags, bid_strategy, status, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10,
            $11, $12, $13, $14, $15, $16, $17
          )
          RETURNING *`,
          [
            requireTenantId(scope.tenantId, 'routes.net-roi-plans'),
            planNo,
            b.sessionId || null,
            Number(b.shopId),
            b.platformCode,
            b.adToolCode,
            b.planName,
            b.planDate,
            Number(b.plannedBudget),
            Number(b.targetRoi ?? 2.0),
            Number(b.preHeatRatio ?? 0.20),
            Number(b.livePeakRatio ?? 0.60),
            Number(b.tailPushRatio ?? 0.20),
            JSON.stringify(b.targetingTags || []),
            b.bidStrategy || 'auto_bid',
            b.status || 'draft',
            user?.id || null,
          ],
        )

        await writeAuditLog(client, {
          request,
          action: 'ad_plan.create',
          resourceType: 'ad_plan',
          resourceId: String(res.rows[0].id),
          afterData: res.rows[0],
        })

        return res.rows[0]
      })

      if ('forbidden' in row) return sendError(reply, 403, '无权访问该平台数据')
      return sendOk(reply, row, '投流计划创建成功')
    } catch (err: any) {
      request.log.warn({ err }, 'POST /net-roi/ad-plans failed')
      if (err?.code === '23505') {
        return sendError(reply, 409, `计划编号已存在: ${planNo}`)
      }
      return sendError(reply, 500, err?.message || '创建投流计划失败')
    }
  })

  // ── PUT /api/v1/net-roi/ad-plans/:id ── 更新投流计划
  app.put<{
    Params: { id: string }
    Body: Partial<{
      planName: string
      plannedBudget: number
      targetRoi: number
      preHeatRatio: number
      livePeakRatio: number
      tailPushRatio: number
      targetingTags: any[]
      bidStrategy: string
      status: string
    }>
  }>('/api/v1/net-roi/ad-plans/:id', { preHandler: [requireRole(AD_PLAN_WRITE_ROLES)] }, async (request, reply) => {
    const id = Number(request.params.id)
    if (!Number.isFinite(id)) return sendError(reply, 400, 'ID 非法')
    const b = request.body || {}

    try {
      const row = await withRlsContext(request, async (client) => {
        const fields: string[] = []
        const params: any[] = [id]
        let idx = 2

        if (b.planName !== undefined) { fields.push(`plan_name = $${idx++}`); params.push(b.planName) }
        if (b.plannedBudget !== undefined) { fields.push(`planned_budget = $${idx++}`); params.push(Number(b.plannedBudget)) }
        if (b.targetRoi !== undefined) { fields.push(`target_roi = $${idx++}`); params.push(Number(b.targetRoi)) }
        if (b.preHeatRatio !== undefined) { fields.push(`pre_heat_ratio = $${idx++}`); params.push(Number(b.preHeatRatio)) }
        if (b.livePeakRatio !== undefined) { fields.push(`live_peak_ratio = $${idx++}`); params.push(Number(b.livePeakRatio)) }
        if (b.tailPushRatio !== undefined) { fields.push(`tail_push_ratio = $${idx++}`); params.push(Number(b.tailPushRatio)) }
        if (b.targetingTags !== undefined) { fields.push(`targeting_tags = $${idx++}`); params.push(JSON.stringify(b.targetingTags)) }
        if (b.bidStrategy !== undefined) { fields.push(`bid_strategy = $${idx++}`); params.push(b.bidStrategy) }
        if (b.status !== undefined) { fields.push(`status = $${idx++}`); params.push(b.status) }

        if (fields.length === 0) return null

        fields.push(`updated_at = now()`)
        const res = await client.query(
          `UPDATE public.ad_plan SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
          params,
        )
        if (res.rows.length === 0) return null

        await writeAuditLog(client, {
          request,
          action: 'ad_plan.update',
          resourceType: 'ad_plan',
          resourceId: String(id),
          afterData: res.rows[0],
        })
        return res.rows[0]
      })

      if (!row) return sendError(reply, 404, '投流计划不存在或未提交修改内容')
      return sendOk(reply, row, '投流计划已更新')
    } catch (err: any) {
      request.log.warn({ err }, 'PUT /net-roi/ad-plans/:id failed')
      return sendError(reply, 500, err?.message || '更新投流计划失败')
    }
  })

  // ── POST /api/v1/net-roi/ad-plans/:id/receipt ── 录入或回传实际执行回执
  app.post<{
    Params: { id: string }
    Body: {
      bizDate: string
      actualSpend: number
      actualGmv?: number
      netGmv?: number
      attributedOrders?: number
      note?: string
    }
  }>('/api/v1/net-roi/ad-plans/:id/receipt', { preHandler: [requireRole(AD_PLAN_WRITE_ROLES)] }, async (request, reply) => {
    const planId = Number(request.params.id)
    if (!Number.isFinite(planId)) return sendError(reply, 400, 'ID 非法')
    const b = request.body || ({} as any)
    if (!b.bizDate || b.actualSpend === undefined) {
      return sendError(reply, 400, '缺少必填字段: bizDate, actualSpend')
    }

    try {
      const row = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `INSERT INTO public.ad_plan_receipts (
            plan_id, biz_date, actual_spend, actual_gmv, net_gmv, attributed_orders, receipt_source, note
          ) VALUES ($1, $2::date, $3, $4, $5, $6, 'manual_entry', $7)
          ON CONFLICT (plan_id, biz_date) DO UPDATE SET
            actual_spend = EXCLUDED.actual_spend,
            actual_gmv = EXCLUDED.actual_gmv,
            net_gmv = EXCLUDED.net_gmv,
            attributed_orders = EXCLUDED.attributed_orders,
            note = EXCLUDED.note,
            updated_at = now()
          RETURNING *`,
          [
            planId,
            b.bizDate,
            Number(b.actualSpend),
            Number(b.actualGmv ?? 0),
            Number(b.netGmv ?? (b.actualGmv ?? 0)),
            Number(b.attributedOrders ?? 0),
            b.note || '',
          ],
        )

        // 自动将对应 plan 状态更新为 active 或 completed
        await client.query(
          `UPDATE public.ad_plan SET status = 'active', updated_at = now()
           WHERE id = $1 AND status = 'draft'`,
          [planId],
        )

        await writeAuditLog(client, {
          request,
          action: 'ad_plan_receipt.upsert',
          resourceType: 'ad_plan_receipts',
          resourceId: String(res.rows[0].id),
          afterData: res.rows[0],
        })

        return res.rows[0]
      })

      return sendOk(reply, row, '投流回执已保存')
    } catch (err: any) {
      request.log.warn({ err }, 'POST /net-roi/ad-plans/:id/receipt failed')
      return sendError(reply, 500, err?.message || '保存投流回执失败')
    }
  })
}
