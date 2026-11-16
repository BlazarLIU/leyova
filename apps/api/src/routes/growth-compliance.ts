import type { FastifyInstance } from 'fastify'
import { sendError, sendOk } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canAccessCost, canAccessCostAsync, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { assertShopPlatform } from '../lib/shop-guard.js'

const PROMO_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'operator', 'ad_buyer']
const MEMBER_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'operator', 'ops_staff']
const COMPLIANCE_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'operator']

interface SimRuleInput {
  ruleLayer: number
  ruleName: string
  discountMode: string
  discountValue: number
  isExclusive?: boolean
  merchantCostRatio?: number
  platformCostRatio?: number
}

/**
 * 大促 5 层叠加规则试算 + 会员私域分层 + 2026 合规台账路由
 */
export async function growthComplianceRoutes(app: FastifyInstance): Promise<void> {
  // ═══════════════════════════════════════════════════════════════
  // 1. 大促 5 层优惠叠加规则与折后净毛利试算
  // ═══════════════════════════════════════════════════════════════
  app.get<{
    Querystring: { platform?: string; promotionId?: string }
  }>('/api/v1/promotions/rules', { preHandler: [requireAuth] }, async (request, reply) => {
    const { platform, shopId } = request.query as { platform?: string; shopId?: string }
    try {
      const rows = await withRlsContext(request, async (client) => {
        const params: any[] = []
        const conds: string[] = ['r.is_active = true']
        if (platform) {
          params.push(platform)
          conds.push(`r.platform_code = $${params.length}`)
        }
        if (shopId) {
          params.push(Number(shopId))
          conds.push(`r.shop_id = $${params.length}`)
        }
        const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
        const res = await client.query(
          `SELECT r.*, pc.platform_name, s.shop_name
           FROM public.pricing_rules r
           LEFT JOIN public.system_platform_configs pc ON pc.platform_code = r.platform_code
           LEFT JOIN public.dim_shop s ON s.id = r.shop_id
           ${whereSql}
           ORDER BY r.rule_layer ASC, r.id ASC`,
          params,
        )
        return res.rows
      })
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'pricing_rules query failed')
      return sendError(reply, 500, '查询价格叠加规则失败')
    }
  })

  app.post<{
    Body: {
      shopId?: number | null
      platformCode: string
      ruleLayer: number
      ruleName: string
      discountMode: string
      discountValue: number
      isExclusive?: boolean
      merchantCostRatio?: number
      platformCostRatio?: number
      note?: string
    }
  }>('/api/v1/promotions/rules', { preHandler: [requireRole(PROMO_WRITE_ROLES)] }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.platformCode || !b.ruleLayer || !b.ruleName || !b.discountMode) {
      return sendError(reply, 400, '缺少必要参数 (platformCode, ruleLayer, ruleName, discountMode)')
    }
    const layer = Number(b.ruleLayer)
    if (!Number.isInteger(layer) || layer < 1 || layer > 5) {
      return sendError(reply, 400, 'ruleLayer 必须在 1 到 5 之间')
    }

    try {
      const row = await withRlsContext(request, async (client, scope) => {
        const merchantRatio = Number(b.merchantCostRatio ?? 1)
        const platformRatio = Number(b.platformCostRatio ?? Math.max(0, 1 - merchantRatio))
        const res = await client.query(
          `INSERT INTO public.pricing_rules
             (tenant_id, shop_id, platform_code, rule_layer, rule_name, discount_mode,
              discount_value, is_exclusive, merchant_cost_ratio, platform_cost_ratio, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            scope.tenantId,
            b.shopId ? Number(b.shopId) : null,
            b.platformCode,
            layer,
            b.ruleName.trim(),
            b.discountMode,
            Number(b.discountValue || 0),
            Boolean(b.isExclusive),
            merchantRatio,
            platformRatio,
            b.note || '',
          ],
        )
        await writeAuditLog(client, {
          request,
          action: 'pricing_rule.create',
          resourceType: 'pricing_rules',
          resourceId: res.rows[0].id,
          afterData: res.rows[0],
        })
        return res.rows[0]
      })
      return sendOk(reply, row, '价格叠加规则已保存')
    } catch (err) {
      request.log.warn({ err }, 'pricing_rules create failed')
      return sendError(reply, 500, '保存价格叠加规则失败')
    }
  })

  app.delete<{ Params: { id: string } }>(
    '/api/v1/promotions/rules/:id',
    { preHandler: [requireRole(PROMO_WRITE_ROLES)] },
    async (request, reply) => {
      const id = Number(request.params.id)
      if (!Number.isInteger(id) || id <= 0) {
        return sendError(reply, 400, '无效的规则 ID')
      }
      try {
        const deleted = await withRlsContext(request, async (client) => {
          const beforeRes = await client.query('SELECT * FROM public.pricing_rules WHERE id = $1', [id])
          if (beforeRes.rows.length === 0) return null
          await client.query('DELETE FROM public.pricing_rules WHERE id = $1', [id])
          await writeAuditLog(client, {
            request,
            action: 'pricing_rule.delete',
            resourceType: 'pricing_rules',
            resourceId: id,
            beforeData: beforeRes.rows[0],
          })
          return beforeRes.rows[0]
        })
        if (!deleted) return sendError(reply, 404, '规则不存在或无权删除')
        return sendOk(reply, { deleted: true, id })
      } catch (err) {
        request.log.warn({ err }, 'pricing_rules delete failed')
        return sendError(reply, 500, '删除价格叠加规则失败')
      }
    },
  )

  // ── POST /api/v1/promotions/simulate ── 5 层叠加折后价与商家让利拆解试算
  app.post<{
    Body: {
      platformCode?: string
      shopId?: number
      retailPrice: number
      costPrice?: number
      platformFeeRate?: number
      rules?: SimRuleInput[]
    }
  }>('/api/v1/promotions/simulate', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user
    const showCost = await canAccessCostAsync(
      (user as any).id, user.role, user.userType, undefined)
    const b = request.body || ({} as any)
    const retailPrice = Number(b.retailPrice)
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      return sendError(reply, 400, 'retailPrice 必须为大于 0 的数字')
    }

    try {
      let rules: SimRuleInput[] = Array.isArray(b.rules) ? b.rules : []
      if (rules.length === 0) {
        rules = await withRlsContext(request, async (client) => {
          const params: any[] = []
          const conds: string[] = ['is_active = true']
          if (b.platformCode) {
            params.push(b.platformCode)
            conds.push(`platform_code = $${params.length}`)
          }
          if (b.shopId) {
            params.push(Number(b.shopId))
            conds.push(`(shop_id IS NULL OR shop_id = $${params.length})`)
          }
          const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
          const res = await client.query(
            `SELECT rule_layer AS "ruleLayer", rule_name AS "ruleName",
                    discount_mode AS "discountMode", discount_value::float8 AS "discountValue",
                    is_exclusive AS "isExclusive",
                    merchant_cost_ratio::float8 AS "merchantCostRatio",
                    platform_cost_ratio::float8 AS "platformCostRatio"
             FROM public.pricing_rules
             ${whereSql}
             ORDER BY rule_layer ASC, id ASC`,
            params,
          )
          return res.rows
        })
      }

      const sorted = [...rules].sort((a, x) => Number(a.ruleLayer) - Number(x.ruleLayer))
      let currentPrice = retailPrice
      let totalMerchantSubsidy = 0
      let totalPlatformSubsidy = 0
      let blockedByExclusive = false
      const exclusiveConflicts: string[] = []

      const steps = sorted.map((rule) => {
        const startPrice = currentPrice
        if (blockedByExclusive) {
          exclusiveConflicts.push(`Layer ${rule.ruleLayer} (${rule.ruleName}) 因上层独占锁生效被跳过`)
          return {
            ruleLayer: rule.ruleLayer,
            ruleName: rule.ruleName,
            discountMode: rule.discountMode,
            applied: false,
            discountAmount: 0,
            merchantCost: 0,
            platformCost: 0,
            priceAfter: Number(currentPrice.toFixed(2)),
          }
        }

        const val = Number(rule.discountValue || 0)
        // 若 discountValue <= 1，视为比例折扣（如 0.85 表示 85 折 -> 减让 15%）；若 > 1 视为定额满减（如 30 元）
        const rawDiscount = val > 0 && val < 1 ? startPrice * (1 - val) : Math.min(val, startPrice)
        const discountAmount = Math.max(0, Math.min(rawDiscount, currentPrice))
        const mRatio = Number(rule.merchantCostRatio ?? 1)
        const pRatio = Number(rule.platformCostRatio ?? Math.max(0, 1 - mRatio))
        const merchantCost = discountAmount * mRatio
        const platformCost = discountAmount * pRatio

        currentPrice = Math.max(0, currentPrice - discountAmount)
        totalMerchantSubsidy += merchantCost
        totalPlatformSubsidy += platformCost

        if (rule.isExclusive) {
          blockedByExclusive = true
        }

        return {
          ruleLayer: rule.ruleLayer,
          ruleName: rule.ruleName,
          discountMode: rule.discountMode,
          applied: true,
          discountAmount: Number(discountAmount.toFixed(2)),
          merchantCost: Number(merchantCost.toFixed(2)),
          platformCost: Number(platformCost.toFixed(2)),
          priceAfter: Number(currentPrice.toFixed(2)),
        }
      })

      const feeRate = Number(b.platformFeeRate ?? 0.05)
      const merchantReceipts = Number((currentPrice + totalPlatformSubsidy).toFixed(2))
      const platformFee = Number((merchantReceipts * feeRate).toFixed(2))
      const costPrice = showCost && b.costPrice !== undefined ? Number(b.costPrice) : null
      const netMargin =
        showCost && costPrice !== null
          ? Number((merchantReceipts - platformFee - costPrice).toFixed(2))
          : null

      return sendOk(reply, {
        retailPrice: Number(retailPrice.toFixed(2)),
        finalConsumerPrice: Number(currentPrice.toFixed(2)),
        totalDiscount: Number((retailPrice - currentPrice).toFixed(2)),
        totalMerchantSubsidy: Number(totalMerchantSubsidy.toFixed(2)),
        totalPlatformSubsidy: Number(totalPlatformSubsidy.toFixed(2)),
        merchantReceipts,
        platformFee,
        costMasked: !showCost,
        costPrice,
        netMargin,
        exclusiveConflicts,
        steps,
      })
    } catch (err) {
      request.log.warn({ err }, 'promotions/simulate failed')
      return sendError(reply, 500, '大促叠加试算失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 2. 会员私域与复购分层监控
  // ═══════════════════════════════════════════════════════════════
  app.get<{
    Querystring: { platform?: string; shopId?: string; from?: string; to?: string }
  }>('/api/v1/members/overview', { preHandler: [requireAuth] }, async (request, reply) => {
    const { platform, shopId, from, to } = request.query || {}
    const toDate = to || new Date().toISOString().slice(0, 10)
    const fromDate = from || new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10)

    try {
      const data = await withRlsContext(request, async (client) => {
        const params: any[] = [fromDate, toDate]
        let filterSql = ''
        if (platform) {
          params.push(platform)
          filterSql += ` AND m.platform_code = $${params.length}`
        }
        if (shopId) {
          params.push(Number(shopId))
          filterSql += ` AND m.shop_id = $${params.length}`
        }

        const { rows: items } = await client.query(
          `SELECT m.*, s.shop_name, p.platform_name
           FROM public.platform_members_summary m
           LEFT JOIN public.dim_shop s ON s.id = m.shop_id
           LEFT JOIN public.system_platform_configs p ON p.platform_code = m.platform_code
           WHERE m.biz_date >= $1::date AND m.biz_date <= $2::date ${filterSql}
           ORDER BY m.biz_date DESC, m.total_members DESC`,
          params,
        )

        const { rows: byTier } = await client.query(
          `SELECT m.member_tier,
                  SUM(m.total_members)::int AS total_members,
                  SUM(m.new_members)::int AS new_members,
                  SUM(m.active_buyers)::int AS active_buyers,
                  SUM(m.repurchase_orders)::int AS repurchase_orders,
                  ROUND(AVG(m.repurchase_rate), 2) AS avg_repurchase_rate,
                  ROUND(AVG(m.followers_gmv_share), 2) AS avg_followers_gmv_share,
                  ROUND(AVG(m.private_domain_cvr), 2) AS avg_private_domain_cvr
           FROM public.platform_members_summary m
           WHERE m.biz_date >= $1::date AND m.biz_date <= $2::date ${filterSql}
           GROUP BY m.member_tier
           ORDER BY total_members DESC`,
          params,
        )

        const totalMembers = items.reduce((a, r) => a + Number(r.total_members || 0), 0)
        const newMembers = items.reduce((a, r) => a + Number(r.new_members || 0), 0)
        const activeBuyers = items.reduce((a, r) => a + Number(r.active_buyers || 0), 0)
        const repurchaseOrders = items.reduce((a, r) => a + Number(r.repurchase_orders || 0), 0)
        const avgRepurchaseRate = items.length > 0
          ? Number((items.reduce((a, r) => a + Number(r.repurchase_rate || 0), 0) / items.length).toFixed(2))
          : 0
        const avgFollowersGmvShare = items.length > 0
          ? Number((items.reduce((a, r) => a + Number(r.followers_gmv_share || 0), 0) / items.length).toFixed(2))
          : 0
        const avgPrivateDomainCvr = items.length > 0
          ? Number((items.reduce((a, r) => a + Number(r.private_domain_cvr || 0), 0) / items.length).toFixed(2))
          : 0

        return {
          range: { from: fromDate, to: toDate },
          summary: {
            total_members: totalMembers,
            new_members: newMembers,
            active_buyers: activeBuyers,
            repurchase_orders: repurchaseOrders,
            avg_repurchase_rate: avgRepurchaseRate,
            avg_followers_gmv_share: avgFollowersGmvShare,
            avg_private_domain_cvr: avgPrivateDomainCvr,
          },
          byTier,
          items,
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'members/overview query failed')
      return sendError(reply, 500, '查询会员私域数据失败')
    }
  })

  app.post<{
    Body: {
      platformCode: string
      shopId: number
      bizDate: string
      memberTier?: string
      totalMembers?: number
      newMembers?: number
      activeBuyers?: number
      repurchaseOrders?: number
      repurchaseRate?: number
      followersGmvShare?: number
      privateDomainCvr?: number
    }
  }>('/api/v1/members/summary', { preHandler: [requireRole(MEMBER_WRITE_ROLES)] }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.platformCode || !b.shopId || !b.bizDate) {
      return sendError(reply, 400, '缺少必要参数 (platformCode, shopId, bizDate)')
    }

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        const shopCheck = await assertShopPlatform(client, b.shopId, b.platformCode)
        if (!shopCheck.ok) {
          return { error: { code: shopCheck.statusCode || 400, msg: shopCheck.message || '店铺校验失败' } }
        }

        const { rows } = await client.query(
          `INSERT INTO public.platform_members_summary
             (tenant_id, platform_code, shop_id, biz_date, member_tier,
              total_members, new_members, active_buyers, repurchase_orders,
              repurchase_rate, followers_gmv_share, private_domain_cvr)
           VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (tenant_id, platform_code, shop_id, biz_date, member_tier) DO UPDATE SET
             total_members = EXCLUDED.total_members,
             new_members = EXCLUDED.new_members,
             active_buyers = EXCLUDED.active_buyers,
             repurchase_orders = EXCLUDED.repurchase_orders,
             repurchase_rate = EXCLUDED.repurchase_rate,
             followers_gmv_share = EXCLUDED.followers_gmv_share,
             private_domain_cvr = EXCLUDED.private_domain_cvr
           RETURNING *`,
          [
            scope.tenantId,
            b.platformCode,
            Number(b.shopId),
            b.bizDate,
            b.memberTier || 'all',
            Number(b.totalMembers || 0),
            Number(b.newMembers || 0),
            Number(b.activeBuyers || 0),
            Number(b.repurchaseOrders || 0),
            Number(b.repurchaseRate || 0),
            Number(b.followersGmvShare || 0),
            Number(b.privateDomainCvr || 0),
          ],
        )

        await writeAuditLog(client, {
          request,
          action: 'members.summary.upsert',
          resourceType: 'platform_members_summary',
          resourceId: rows[0].id,
          afterData: rows[0],
        })
        return { row: rows[0] }
      })

      if ('error' in outcome && outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }
      return sendOk(reply, outcome.row, '会员分层数据已保存')
    } catch (err) {
      request.log.warn({ err }, 'members/summary upsert failed')
      return sendError(reply, 500, '保存会员数据失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 3. 2026 合规与风控事件台账（自动跟价/主体一致性/流量限流预警）
  // ═══════════════════════════════════════════════════════════════
  app.get<{
    Querystring: { platform?: string; status?: string; severity?: string }
  }>('/api/v1/compliance/events', { preHandler: [requireAuth] }, async (request, reply) => {
    const { platform, status, severity } = request.query || {}
    try {
      const data = await withRlsContext(request, async (client) => {
        const params: any[] = []
        const conds: string[] = []
        if (platform) {
          params.push(platform)
          conds.push(`e.platform_code = $${params.length}`)
        }
        if (status) {
          params.push(status)
          conds.push(`e.status = $${params.length}`)
        }
        if (severity) {
          params.push(severity)
          conds.push(`e.severity = $${params.length}`)
        }
        const whereSql = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
        const { rows: events } = await client.query(
          `SELECT e.*, s.shop_name, p.platform_name
           FROM public.compliance_events e
           LEFT JOIN public.dim_shop s ON s.id = e.shop_id
           LEFT JOIN public.system_platform_configs p ON p.platform_code = e.platform_code
           ${whereSql}
           ORDER BY e.occurred_at DESC, e.id DESC`,
          params,
        )

        const summary = {
          total: events.length,
          open_count: events.filter((r) => r.status === 'open' || r.status === 'remediating').length,
          critical_count: events.filter((r) => r.severity === 'critical' && r.status !== 'resolved').length,
          total_points_deducted: events.reduce((a, r) => a + Number(r.credit_points_deducted || 0), 0),
          traffic_restricted_count: events.filter((r) => Boolean(r.traffic_restricted) && r.status !== 'resolved').length,
          auto_price_follow_risk_count: events.filter((r) => Boolean(r.auto_price_follow_risk)).length,
          entity_inconsistent_count: events.filter((r) => r.entity_consistency_ok === false).length,
        }

        return { summary, events }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'compliance/events query failed')
      return sendError(reply, 500, '查询合规风控台账失败')
    }
  })

  app.post<{
    Body: {
      platformCode: string
      shopId?: number | null
      regulationCode: string
      eventType: string
      severity?: 'info' | 'warning' | 'critical'
      creditPointsDeducted?: number
      trafficRestricted?: boolean
      autoPriceFollowRisk?: boolean
      entityConsistencyOk?: boolean
      summary: string
    }
  }>('/api/v1/compliance/events', { preHandler: [requireRole(COMPLIANCE_WRITE_ROLES)] }, async (request, reply) => {
    const b = request.body || ({} as any)
    if (!b.platformCode || !b.regulationCode || !b.eventType || !b.summary) {
      return sendError(reply, 400, '缺少必要参数 (platformCode, regulationCode, eventType, summary)')
    }

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        if (b.shopId) {
          const shopCheck = await assertShopPlatform(client, b.shopId, b.platformCode)
          if (!shopCheck.ok) {
            return { error: { code: shopCheck.statusCode || 400, msg: shopCheck.message || '店铺校验失败' } }
          }
        }
        const { rows } = await client.query(
          `INSERT INTO public.compliance_events
             (tenant_id, platform_code, shop_id, regulation_code, event_type, severity,
              credit_points_deducted, traffic_restricted, auto_price_follow_risk, entity_consistency_ok, summary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            scope.tenantId,
            b.platformCode,
            b.shopId ? Number(b.shopId) : null,
            b.regulationCode.trim(),
            b.eventType.trim(),
            b.severity || 'warning',
            Number(b.creditPointsDeducted || 0),
            Boolean(b.trafficRestricted),
            Boolean(b.autoPriceFollowRisk),
            b.entityConsistencyOk === undefined ? true : Boolean(b.entityConsistencyOk),
            b.summary.trim(),
          ],
        )

        await writeAuditLog(client, {
          request,
          action: 'compliance_event.create',
          resourceType: 'compliance_events',
          resourceId: rows[0].id,
          afterData: rows[0],
        })
        return { row: rows[0] }
      })

      if ('error' in outcome && outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }
      return sendOk(reply, outcome.row, '合规风控事件已登记')
    } catch (err) {
      request.log.warn({ err }, 'compliance/events create failed')
      return sendError(reply, 500, '登记合规风控事件失败')
    }
  })

  app.patch<{
    Params: { id: string }
    Body: { status: 'open' | 'remediating' | 'resolved' | 'appealed'; summary?: string }
  }>('/api/v1/compliance/events/:id', { preHandler: [requireRole(COMPLIANCE_WRITE_ROLES)] }, async (request, reply) => {
    const id = Number(request.params.id)
    const { status, summary } = request.body || ({} as any)
    if (!Number.isInteger(id) || id <= 0 || !['open', 'remediating', 'resolved', 'appealed'].includes(status)) {
      return sendError(reply, 400, '无效的合规事件 ID 或状态')
    }

    try {
      const updated = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT * FROM public.compliance_events WHERE id = $1', [id])
        if (beforeRes.rows.length === 0) return null

        const { rows } = await client.query(
          `UPDATE public.compliance_events
           SET status = $1,
               summary = COALESCE($2, summary),
               resolved_at = CASE WHEN $1 = 'resolved' THEN COALESCE(resolved_at, NOW()) ELSE NULL END,
               updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [status, summary ? summary.trim() : null, id],
        )

        await writeAuditLog(client, {
          request,
          action: 'compliance_event.update_status',
          resourceType: 'compliance_events',
          resourceId: id,
          beforeData: beforeRes.rows[0],
          afterData: rows[0],
        })
        return rows[0]
      })

      if (!updated) return sendError(reply, 404, '合规事件不存在或无权访问')
      return sendOk(reply, updated, '合规状态已更新')
    } catch (err) {
      request.log.warn({ err }, 'compliance/events patch failed')
      return sendError(reply, 500, '更新合规状态失败')
    }
  })
}
