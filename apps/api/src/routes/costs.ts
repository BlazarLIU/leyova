import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

export async function costRoutes(app: FastifyInstance) {
  // ── GET /api/v1/costs ── 成本明细列表
  app.get('/api/v1/costs', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const { shopId, platformCode, costType, startDate, endDate, limit = 50, offset = 0 } = request.query as {
      shopId?: string
      platformCode?: string
      costType?: string
      startDate?: string
      endDate?: string
      limit?: number
      offset?: number
    }

    try {
      const conditions: string[] = []
      const params: any[] = []
      let pIdx = 1

      if (shopId) {
        conditions.push(`c.shop_id = $${pIdx++}`)
        params.push(Number(shopId))
      }
      if (platformCode) {
        conditions.push(`c.platform_code = $${pIdx++}`)
        params.push(platformCode)
      }
      if (costType) {
        conditions.push(`c.cost_type = $${pIdx++}`)
        params.push(costType)
      }
      if (startDate) {
        conditions.push(`c.cost_date >= $${pIdx++}`)
        params.push(startDate)
      }
      if (endDate) {
        conditions.push(`c.cost_date <= $${pIdx++}`)
        params.push(endDate)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const result = await withRlsContext(request, async (client) => {
        const totalResult = await client.query(
          `SELECT COUNT(*) FROM public.cost_entries c ${whereClause}`,
          params
        )
        const total = Number(totalResult.rows[0].count)

        const listParams = [...params, Number(limit), Number(offset)]
        const querySql = `
          SELECT 
            c.id,
            c.shop_id AS "shopId",
            s.shop_name AS "shopName",
            c.platform_code AS "platformCode",
            p.platform_name AS "platformName",
            c.cost_date::text AS "costDate",
            c.cost_type AS "costType",
            c.cost_name AS "costName",
            c.amount::float AS "amount",
            c.remark,
            u.real_name AS "createdByName",
            c.created_at AS "createdAt"
          FROM public.cost_entries c
          LEFT JOIN public.dim_shop s ON c.shop_id = s.id
          LEFT JOIN public.system_platform_configs p ON c.platform_code = p.platform_code
          LEFT JOIN public.users u ON c.created_by = u.id
          ${whereClause}
          ORDER BY c.cost_date DESC, c.id DESC
          LIMIT $${pIdx} OFFSET $${pIdx + 1}
        `
        const { rows } = await client.query(querySql, listParams)
        return { total, items: rows }
      })

      return sendOk(reply, {
        total: result.total,
        limit: Number(limit),
        offset: Number(offset),
        items: result.items,
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch cost entries')
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/costs/summary ── 成本汇总与净利计算
  app.get('/api/v1/costs/summary', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const { shopId, platformCode, startDate, endDate } = request.query as {
      shopId?: string
      platformCode?: string
      startDate?: string
      endDate?: string
    }

    try {
      const conditions: string[] = []
      const params: any[] = []
      let pIdx = 1

      if (shopId) {
        conditions.push(`shop_id = $${pIdx++}`)
        params.push(Number(shopId))
      }
      if (platformCode) {
        conditions.push(`platform_code = $${pIdx++}`)
        params.push(platformCode)
      }
      if (startDate) {
        conditions.push(`cost_date >= $${pIdx++}`)
        params.push(startDate)
      }
      if (endDate) {
        conditions.push(`cost_date <= $${pIdx++}`)
        params.push(endDate)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const outcome = await withRlsContext(request, async (client) => {
        // 1. 各类成本明细汇总
        const costTypeSummary = await client.query(`
          SELECT 
            cost_type AS "costType",
            COALESCE(SUM(amount), 0)::float AS "totalAmount"
          FROM public.cost_entries
          ${whereClause}
          GROUP BY cost_type
        `, params)

        const costMap: Record<string, number> = {
          labor: 0,
          ad: 0,
          goods: 0,
          platform_fee: 0,
          other: 0,
        }
        let totalCost = 0
        for (const row of costTypeSummary.rows) {
          costMap[row.costType] = row.totalAmount
          totalCost += row.totalAmount
        }

        // 2. 统计同期 GMV 与退款
        const tradeConditions: string[] = []
        const tradeParams: any[] = []
        let tIdx = 1

        if (shopId) {
          tradeConditions.push(`f.shop_id = $${tIdx++}`)
          tradeParams.push(Number(shopId))
        }
        if (platformCode) {
          tradeConditions.push(`f.platform_code = $${tIdx++}`)
          tradeParams.push(platformCode)
        }
        if (startDate) {
          tradeConditions.push(`f.biz_date >= $${tIdx++}`)
          tradeParams.push(startDate)
        }
        if (endDate) {
          tradeConditions.push(`f.biz_date <= $${tIdx++}`)
          tradeParams.push(endDate)
        }
        tradeConditions.push(`(pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type)`)
        const tradeWhere = tradeConditions.length > 0 ? `WHERE ${tradeConditions.join(' AND ')}` : ''

        const tradeResult = await client.query(`
          SELECT 
            COALESCE(SUM(f.gmv), 0)::float AS "totalGmv",
            COALESCE(SUM(f.refund_amount), 0)::float AS "totalRefund"
          FROM public.fact_trade_daily f
          LEFT JOIN public.platform_caliber_config pcc
            ON pcc.platform_code = f.platform_code
           AND pcc.metric_code = 'gmv'
           AND pcc.is_default = true
          ${tradeWhere}
        `, tradeParams)

        const totalGmv = tradeResult.rows[0]?.totalGmv || 0
        const totalRefund = tradeResult.rows[0]?.totalRefund || 0
        const effectiveSales = Math.max(0, totalGmv - totalRefund)
        const netProfit = effectiveSales - totalCost
        const netProfitMargin = totalGmv > 0 ? (netProfit / totalGmv) * 100 : 0

        return {
          totalGmv,
          totalRefund,
          effectiveSales,
          totalCost,
          netProfit,
          netProfitMargin: Number(netProfitMargin.toFixed(2)),
          costsByType: costMap,
        }
      })

      return sendOk(reply, outcome)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch cost summary')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/costs ── 录入成本
  app.post('/api/v1/costs', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1
    const { shopId, platformCode, costDate, costType, costName, amount, remark } = request.body as {
      shopId: number
      platformCode?: string
      costDate: string
      costType: string
      costName: string
      amount: number
      remark?: string
    }

    if (!shopId || !costDate || !costType || !costName || amount === undefined) {
      return sendError(reply, 400, '缺少必要字段: shopId, costDate, costType, costName, amount')
    }

    try {
      const { rows } = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `
          INSERT INTO public.cost_entries 
            (tenant_id, shop_id, platform_code, cost_date, cost_type, cost_name, amount, remark, created_by)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, shop_id, platform_code, cost_date, cost_type, cost_name, amount, remark, created_at
          `,
          [tenantId, shopId, platformCode || null, costDate, costType, costName, amount, remark || null, user?.id || null]
        )
        await writeAuditLog(client, {
          request,
          action: 'cost.entry.create',
          resourceType: 'cost_entries',
          resourceId: res.rows[0].id,
          afterData: res.rows[0],
        })
        return res
      })

      return sendOk(reply, rows[0], '成本录入成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create cost entry')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/costs/:id ── 修改成本
  app.put('/api/v1/costs/:id', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { shopId, platformCode, costDate, costType, costName, amount, remark } = request.body as {
      shopId?: number
      platformCode?: string
      costDate?: string
      costType?: string
      costName?: string
      amount?: number
      remark?: string
    }

    try {
      const updates: string[] = ['updated_at = NOW()']
      const params: any[] = [Number(id)]
      let pIdx = 2

      if (shopId !== undefined) {
        updates.push(`shop_id = $${pIdx++}`)
        params.push(shopId)
      }
      if (platformCode !== undefined) {
        updates.push(`platform_code = $${pIdx++}`)
        params.push(platformCode)
      }
      if (costDate !== undefined) {
        updates.push(`cost_date = $${pIdx++}`)
        params.push(costDate)
      }
      if (costType !== undefined) {
        updates.push(`cost_type = $${pIdx++}`)
        params.push(costType)
      }
      if (costName !== undefined) {
        updates.push(`cost_name = $${pIdx++}`)
        params.push(costName)
      }
      if (amount !== undefined) {
        updates.push(`amount = $${pIdx++}`)
        params.push(amount)
      }
      if (remark !== undefined) {
        updates.push(`remark = $${pIdx++}`)
        params.push(remark)
      }

      const outcome = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT * FROM public.cost_entries WHERE id = $1', [Number(id)])
        if (beforeRes.rows.length === 0) return { rows: [] }
        const sql = `UPDATE public.cost_entries SET ${updates.join(', ')} WHERE id = $1 RETURNING *`
        const res = await client.query(sql, params)
        if (res.rows.length > 0) {
          await writeAuditLog(client, {
            request,
            action: 'cost.entry.update',
            resourceType: 'cost_entries',
            resourceId: id,
            beforeData: beforeRes.rows[0],
            afterData: res.rows[0],
          })
        }
        return res
      })

      if (outcome.rows.length === 0) {
        return sendError(reply, 404, '成本记录不存在')
      }

      return sendOk(reply, outcome.rows[0], '成本更新成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to update cost entry')
      return sendError(reply, 500, err.message)
    }
  })

  // ── DELETE /api/v1/costs/:id ── 删除成本
  app.delete('/api/v1/costs/:id', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const rowCount = await withRlsContext(request, async (client) => {
        const beforeRes = await client.query('SELECT * FROM public.cost_entries WHERE id = $1', [Number(id)])
        const res = await client.query('DELETE FROM public.cost_entries WHERE id = $1', [Number(id)])
        if ((res.rowCount ?? 0) > 0) {
          await writeAuditLog(client, {
            request,
            action: 'cost.entry.delete',
            resourceType: 'cost_entries',
            resourceId: id,
            beforeData: beforeRes.rows[0] ?? null,
          })
        }
        return res.rowCount ?? 0
      })
      if (rowCount === 0) {
        return sendError(reply, 404, '成本记录不存在')
      }
      return sendOk(reply, { success: true }, '成本记录已删除')
    } catch (err: any) {
      request.log.error(err, 'Failed to delete cost entry')
      return sendError(reply, 500, err.message)
    }
  })
}
