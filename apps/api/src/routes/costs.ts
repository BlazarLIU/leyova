import type { FastifyInstance } from 'fastify'
import { getPool } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireAuth, requireRole } from '../lib/guard.js'

export async function costRoutes(app: FastifyInstance) {
  // ── GET /api/v1/costs ── 成本明细列表
  app.get('/api/v1/costs', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const pool = getPool()
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

      const totalResult = await pool.query(
        `SELECT COUNT(*) FROM public.cost_entries c ${whereClause}`,
        params
      )
      const total = Number(totalResult.rows[0].count)

      params.push(Number(limit), Number(offset))
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
        LIMIT $${pIdx++} OFFSET $${pIdx++}
      `
      const { rows } = await pool.query(querySql, params)

      return sendOk(reply, {
        total,
        limit: Number(limit),
        offset: Number(offset),
        items: rows,
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch cost entries')
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/costs/summary ── 成本汇总与净利计算
  app.get('/api/v1/costs/summary', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const pool = getPool()
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

      // 1. 各类成本明细汇总
      const costTypeSummary = await pool.query(`
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
        tradeConditions.push(`shop_id = $${tIdx++}`)
        tradeParams.push(Number(shopId))
      }
      if (platformCode) {
        tradeConditions.push(`platform_code = $${tIdx++}`)
        tradeParams.push(platformCode)
      }
      if (startDate) {
        tradeConditions.push(`biz_date >= $${tIdx++}`)
        tradeParams.push(startDate)
      }
      if (endDate) {
        tradeConditions.push(`biz_date <= $${tIdx++}`)
        tradeParams.push(endDate)
      }
      const tradeWhere = tradeConditions.length > 0 ? `WHERE ${tradeConditions.join(' AND ')}` : ''

      const tradeResult = await pool.query(`
        SELECT 
          COALESCE(SUM(gmv), 0)::float AS "totalGmv",
          COALESCE(SUM(refund_amount), 0)::float AS "totalRefund"
        FROM public.fact_trade_daily
        ${tradeWhere}
      `, tradeParams)

      const totalGmv = tradeResult.rows[0]?.totalGmv || 0
      const totalRefund = tradeResult.rows[0]?.totalRefund || 0
      const effectiveSales = Math.max(0, totalGmv - totalRefund)
      const netProfit = effectiveSales - totalCost
      const netProfitMargin = totalGmv > 0 ? (netProfit / totalGmv) * 100 : 0

      return sendOk(reply, {
        totalGmv,
        totalRefund,
        effectiveSales,
        totalCost,
        netProfit,
        netProfitMargin: Number(netProfitMargin.toFixed(2)),
        costsByType: costMap,
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch cost summary')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/costs ── 录入成本
  app.post('/api/v1/costs', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const pool = getPool()
    const user = (request as any).user
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
      const { rows } = await pool.query(
        `
        INSERT INTO public.cost_entries 
          (shop_id, platform_code, cost_date, cost_type, cost_name, amount, remark, created_by)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, shop_id, platform_code, cost_date, cost_type, cost_name, amount, remark, created_at
        `,
        [shopId, platformCode || null, costDate, costType, costName, amount, remark || null, user?.id || null]
      )

      return sendOk(reply, rows[0], '成本录入成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create cost entry')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/costs/:id ── 修改成本
  app.put('/api/v1/costs/:id', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const pool = getPool()
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

      const sql = `UPDATE public.cost_entries SET ${updates.join(', ')} WHERE id = $1 RETURNING *`
      const { rows } = await pool.query(sql, params)

      if (rows.length === 0) {
        return sendError(reply, 404, '成本记录不存在')
      }

      return sendOk(reply, rows[0], '成本更新成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to update cost entry')
      return sendError(reply, 500, err.message)
    }
  })

  // ── DELETE /api/v1/costs/:id ── 删除成本
  app.delete('/api/v1/costs/:id', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const pool = getPool()
    const { id } = request.params as { id: string }

    try {
      const { rowCount } = await pool.query('DELETE FROM public.cost_entries WHERE id = $1', [Number(id)])
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
