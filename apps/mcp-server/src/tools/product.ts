import { z } from 'zod'
import { registerTool } from '../registry.js'
import { query } from '../db.js'

registerTool({
  name: 'get_product_sales',
  description: 'Get product sales data including GMV, units sold, and conversion by product.',
  inputSchema: z.object({
    sessionId: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.sessionId) {
      conditions.push(`ps.session_id = $${idx++}`)
      values.push(params.sessionId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await query(
      `SELECT p.id, p.name, p.sku, p.category,
              COALESCE(SUM(ps.quantity), 0) AS units_sold,
              COALESCE(SUM(ps.gmv), 0) AS total_gmv,
              COALESCE(AVG(ps.conversion_rate), 0) AS avg_conversion
       FROM products p
       LEFT JOIN product_sales ps ON ps.product_id = p.id
       ${where}
       GROUP BY p.id, p.name, p.sku, p.category
       ORDER BY total_gmv DESC
       LIMIT $${idx}`,
      [...values, params.limit]
    )
    return rows
  },
})

registerTool({
  name: 'get_product_conversion',
  description: 'Get product conversion funnel data: views, clicks, cart adds, orders.',
  inputSchema: z.object({
    productId: z.number().int().positive().optional(),
    sessionId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.productId) {
      conditions.push(`product_id = $${idx++}`)
      values.push(params.productId)
    }
    if (params.sessionId) {
      conditions.push(`session_id = $${idx++}`)
      values.push(params.sessionId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await query(
      `SELECT product_id,
              COALESCE(SUM(views), 0) AS views,
              COALESCE(SUM(clicks), 0) AS clicks,
              COALESCE(SUM(cart_adds), 0) AS cart_adds,
              COALESCE(SUM(orders), 0) AS orders,
              COALESCE(AVG(conversion_rate), 0) AS avg_conversion
       FROM product_sales
       ${where}
       GROUP BY product_id
       ORDER BY orders DESC`,
      values
    )
    return rows
  },
})

registerTool({
  name: 'get_product_mix',
  description: 'Get product mix performance by category and contribution.',
  inputSchema: z.object({
    sessionId: z.number().int().positive().optional(),
  }),
  riskLevel: 'read_only',
  execute: async (params) => {
    const conditions: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (params.sessionId) {
      conditions.push(`ps.session_id = $${idx++}`)
      values.push(params.sessionId)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await query(
      `SELECT p.category,
              COUNT(DISTINCT p.id) AS product_count,
              COALESCE(SUM(ps.gmv), 0) AS total_gmv,
              COALESCE(SUM(ps.orders), 0) AS total_orders
       FROM products p
       LEFT JOIN product_sales ps ON ps.product_id = p.id
       ${where}
       GROUP BY p.category
       ORDER BY total_gmv DESC`,
      values
    )
    return rows
  },
})
