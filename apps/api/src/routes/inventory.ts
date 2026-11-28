import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'
import { effectivePlatforms } from '../lib/platform-scope.js'

/** 查询商品主数据库存概况与列表，服务于 /api/v1/inventory/* */
export async function queryInventoryProducts(
  executor: DbExecutor,
  filters: { keyword?: string; category?: string; platformCode?: string; lowStockOnly?: boolean; allowedPlatforms?: string[] | null } = {},
) {
  const conds: string[] = []
  const params: any[] = []
  let idx = 1

  if (filters.keyword?.trim()) {
    conds.push(`(p.sku_code ILIKE $${idx} OR p.spu_code ILIKE $${idx} OR p.product_name ILIKE $${idx})`)
    params.push(`%${filters.keyword.trim()}%`)
    idx++
  }
  if (filters.category?.trim()) {
    conds.push(`p.category = $${idx++}`)
    params.push(filters.category.trim())
  }
  if (filters.allowedPlatforms !== undefined) {
    if (filters.allowedPlatforms !== null) {
      conds.push(`EXISTS (SELECT 1 FROM dim_sku_mapping m WHERE m.product_id = p.id AND m.is_active = true AND m.platform_code = ANY($${idx++}::text[]))`)
      params.push(filters.allowedPlatforms)
    }
  } else if (filters.platformCode?.trim()) {
    conds.push(`EXISTS (SELECT 1 FROM dim_sku_mapping m WHERE m.product_id = p.id AND m.platform_code = $${idx++} AND m.is_active = true)`)
    params.push(filters.platformCode.trim())
  }
  if (filters.lowStockOnly) {
    conds.push(`COALESCE(st.available_qty, 0) < COALESCE(st.safety_stock, p.safety_stock)`)
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''

  const { rows } = await executor.query(
    `SELECT
       p.id,
       p.spu_code,
       p.sku_code,
       p.product_name,
       p.category,
       p.brand_name,
       p.unit_cost::numeric AS unit_cost,
       p.retail_price::numeric AS retail_price,
       p.safety_stock AS default_safety_stock,
       p.status,
       COALESCE(st.warehouse_code, 'MAIN_WH') AS warehouse_code,
       COALESCE(st.warehouse_name, '华东中心仓') AS warehouse_name,
       COALESCE(st.on_hand_qty, 0)::int AS on_hand_qty,
       COALESCE(st.locked_qty, 0)::int AS locked_qty,
       COALESCE(st.in_transit_qty, 0)::int AS in_transit_qty,
       COALESCE(st.available_qty, 0)::int AS available_qty,
       COALESCE(st.safety_stock, p.safety_stock)::int AS safety_stock,
       (COALESCE(st.available_qty, 0) < COALESCE(st.safety_stock, p.safety_stock)) AS is_low_stock,
       COALESCE((
         SELECT json_agg(json_build_object(
           'id', m.id,
           'platformCode', m.platform_code,
           'shopId', m.shop_id,
           'shopName', sh.shop_name,
           'platformItemId', m.platform_item_id,
           'platformSkuId', m.platform_sku_id
         ) ORDER BY m.id)
         FROM dim_sku_mapping m
         LEFT JOIN dim_shop sh ON sh.id = m.shop_id
         WHERE m.product_id = p.id AND m.is_active = true
       ), '[]'::json) AS sku_mappings
     FROM dim_product p
     LEFT JOIN fact_inventory_stock st ON st.product_id = p.id
     ${where}
     ORDER BY is_low_stock DESC, p.id ASC`,
    params,
  )

  return rows.map((r: any) => ({
    id: Number(r.id),
    spuCode: r.spu_code,
    skuCode: r.sku_code,
    productName: r.product_name,
    category: r.category,
    brandName: r.brand_name,
    unitCost: Number(r.unit_cost),
    retailPrice: Number(r.retail_price),
    status: r.status,
    warehouseCode: r.warehouse_code,
    warehouseName: r.warehouse_name,
    onHandQty: r.on_hand_qty,
    lockedQty: r.locked_qty,
    inTransitQty: r.in_transit_qty,
    availableQty: r.available_qty,
    safetyStock: r.safety_stock,
    isLowStock: Boolean(r.is_low_stock),
    stockValue: Number((r.on_hand_qty * Number(r.unit_cost)).toFixed(2)),
    skuMappings: r.sku_mappings || [],
  }))
}

export async function inventoryRoutes(app: FastifyInstance) {
  const writeRoles = ['super_admin', 'ops_director', 'ops_staff']

  // ── GET /api/v1/inventory/overview ── 全渠道库存与商品概况
  app.get('/api/v1/inventory/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { rows, mappingStats } = await withRlsContext(request, async (client, scope) => {
        const effPlatforms = effectivePlatforms(undefined, scope.allowedPlatforms)
        const res = await client.query(`
          SELECT
            COUNT(DISTINCT p.id)::int AS total_skus,
            COUNT(DISTINCT p.spu_code)::int AS total_spus,
            COALESCE(SUM(s.on_hand_qty), 0)::int AS total_on_hand,
            COALESCE(SUM(s.locked_qty), 0)::int AS total_locked,
            COALESCE(SUM(s.in_transit_qty), 0)::int AS total_in_transit,
            COALESCE(SUM(s.available_qty), 0)::int AS total_available,
            COUNT(*) FILTER (WHERE s.available_qty < s.safety_stock)::int AS low_stock_count,
            COALESCE(SUM(s.on_hand_qty * p.unit_cost), 0)::numeric(14,2) AS total_stock_value
          FROM dim_product p
          LEFT JOIN fact_inventory_stock s ON s.product_id = p.id
          WHERE p.status = 'active'
        `)
        const mRes = await client.query(`
          SELECT platform_code, COUNT(*)::int AS mapped_skus
          FROM dim_sku_mapping
          WHERE is_active = true
            ${effPlatforms !== null ? 'AND platform_code = ANY($1::text[])' : ''}
          GROUP BY platform_code
          ORDER BY mapped_skus DESC
        `, effPlatforms !== null ? [effPlatforms] : [])
        return { rows: res.rows, mappingStats: mRes.rows }
      })
      const sum = rows[0] || {}
      return sendOk(reply, {
        totalSkus: Number(sum.total_skus || 0),
        totalSpus: Number(sum.total_spus || 0),
        totalOnHand: Number(sum.total_on_hand || 0),
        totalLocked: Number(sum.total_locked || 0),
        totalInTransit: Number(sum.total_in_transit || 0),
        totalAvailable: Number(sum.total_available || 0),
        lowStockCount: Number(sum.low_stock_count || 0),
        totalStockValue: Number(sum.total_stock_value || 0),
        platformMappings: mappingStats,
      })
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch inventory overview')
      return sendError(reply, 500, '获取库存总览失败')
    }
  })

  // ── GET /api/v1/inventory/products ── 商品主数据及多平台 SKU 映射、分仓库存
  app.get('/api/v1/inventory/products', async (request: FastifyRequest<{
    Querystring: { keyword?: string; category?: string; platformCode?: string; lowStockOnly?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { keyword, category, platformCode, lowStockOnly } = request.query
      const list = await withRlsContext(request, (client, scope) =>
        queryInventoryProducts(client, {
          keyword,
          category,
          allowedPlatforms: effectivePlatforms(platformCode, scope.allowedPlatforms),
          lowStockOnly: lowStockOnly === 'true' || lowStockOnly === '1',
        }),
      )
      return sendOk(reply, list)
    } catch (err) {
      request.log.error({ err }, 'Failed to query inventory products')
      return sendError(reply, 500, '查询商品与库存失败')
    }
  })

  // ── POST /api/v1/inventory/products ── 新增主商品 SKU 及期初库存
  app.post('/api/v1/inventory/products', { preHandler: [requireRole(writeRoles)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      spuCode?: string
      skuCode?: string
      productName?: string
      category?: string
      brandName?: string
      unitCost?: number
      retailPrice?: number
      safetyStock?: number
      warehouseCode?: string
      warehouseName?: string
      initialQty?: number
    }
    if (!body?.spuCode?.trim() || !body?.skuCode?.trim() || !body?.productName?.trim()) {
      return sendError(reply, 400, 'SPU编码、SKU编码和商品名称不能为空')
    }

    try {
      const product = await withRlsContext(request, async (client) => {
        const insertProd = await client.query(
          `INSERT INTO dim_product
             (spu_code, sku_code, product_name, category, brand_name, unit_cost, retail_price, safety_stock)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, spu_code, sku_code, product_name`,
          [
            body.spuCode!.trim(),
            body.skuCode!.trim(),
            body.productName!.trim(),
            body.category?.trim() || '通用服饰',
            body.brandName?.trim() || 'Leyova自营',
            Number(body.unitCost || 0),
            Number(body.retailPrice || 0),
            Math.max(0, Number(body.safetyStock ?? 20)),
          ],
        )
        const prod = insertProd.rows[0]
        const initialQty = Math.max(0, Math.trunc(Number(body.initialQty || 0)))
        const whCode = body.warehouseCode?.trim() || 'MAIN_WH'
        const whName = body.warehouseName?.trim() || '华东中心仓'
        const safetyStock = Math.max(0, Math.trunc(Number(body.safetyStock ?? 20)))

        await client.query(
          `INSERT INTO fact_inventory_stock
             (product_id, warehouse_code, warehouse_name, on_hand_qty, locked_qty, in_transit_qty, safety_stock)
           VALUES ($1, $2, $3, $4, 0, 0, $5)
           ON CONFLICT (product_id, warehouse_code) DO NOTHING`,
          [prod.id, whCode, whName, initialQty, safetyStock],
        )
        if (initialQty > 0) {
          await client.query(
            `INSERT INTO fact_inventory_ledger
               (product_id, warehouse_code, change_type, delta_qty, before_on_hand, after_on_hand, ref_type, ref_id, operator_id, remark)
             VALUES ($1, $2, 'inbound', $3, 0, $3, 'init_stock', $4, $5, '建档期初入库')`,
            [prod.id, whCode, initialQty, prod.sku_code, request.user?.id || null],
          )
        }
        return prod
      })
      return sendOk(reply, { id: Number(product.id), spuCode: product.spu_code, skuCode: product.sku_code, productName: product.product_name })
    } catch (err: any) {
      if (err?.code === '23505') return sendError(reply, 409, 'SKU编码已存在，请勿重复创建')
      request.log.error({ err }, 'Failed to create inventory product')
      return sendError(reply, 500, '创建商品档案失败')
    }
  })

  // ── POST /api/v1/inventory/sku-mappings ── 绑定平台 SKU 映射
  app.post('/api/v1/inventory/sku-mappings', { preHandler: [requireRole(writeRoles)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      productId?: number
      platformCode?: string
      shopId?: number
      platformItemId?: string
      platformSkuId?: string
      platformSkuName?: string
    }
    if (!body?.productId || !body?.platformCode || !body?.shopId || !body?.platformItemId || !body?.platformSkuId) {
      return sendError(reply, 400, '商品ID、平台、店铺、平台商品ID和平台SKU ID均为必填项')
    }
    try {
      const result = await withRlsContext(request, async (client, scope) => {
        if (effectivePlatforms(body.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { forbidden: true as const }
        }
        const { rows } = await client.query(
          `INSERT INTO dim_sku_mapping
             (product_id, platform_code, shop_id, platform_item_id, platform_sku_id, platform_sku_name, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           ON CONFLICT (platform_code, shop_id, platform_sku_id) DO UPDATE
           SET product_id = EXCLUDED.product_id,
               platform_item_id = EXCLUDED.platform_item_id,
               platform_sku_name = EXCLUDED.platform_sku_name,
               is_active = true
           RETURNING id, product_id, platform_code, shop_id, platform_item_id, platform_sku_id`,
          [
            Number(body.productId),
            body.platformCode!.trim(),
            Number(body.shopId),
            body.platformItemId!.trim(),
            body.platformSkuId!.trim(),
            body.platformSkuName?.trim() || '',
          ],
        )
        return { row: rows[0] }
      })
      if ('forbidden' in result) return sendError(reply, 403, '无权访问该平台数据')
      return sendOk(reply, result.row)
    } catch (err) {
      request.log.error({ err }, 'Failed to save SKU mapping')
      return sendError(reply, 500, '保存跨平台 SKU 映射失败')
    }
  })

  // ── POST /api/v1/inventory/stock/adjust ── 事务型出入库/锁库调账与流水写入
  app.post('/api/v1/inventory/stock/adjust', { preHandler: [requireRole([...writeRoles])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      productId?: number
      warehouseCode?: string
      changeType?: 'inbound' | 'outbound' | 'lock' | 'unlock' | 'adjust' | 'return_in'
      qty?: number
      refType?: string
      refId?: string
      remark?: string
    }
    const qty = Math.trunc(Number(body?.qty || 0))
    const changeType = body?.changeType
    if (!body?.productId || !changeType || qty === 0) {
      return sendError(reply, 400, '必须指定商品ID、变更类型以及非零数量')
    }

    const whCode = body.warehouseCode?.trim() || 'MAIN_WH'
    try {
      const outcome = await withRlsContext(request, async (client) => {
        let stockRes = await client.query(
          `SELECT id, on_hand_qty, locked_qty, safety_stock
           FROM fact_inventory_stock
           WHERE product_id = $1 AND warehouse_code = $2
           FOR UPDATE`,
          [Number(body.productId), whCode],
        )
        if (stockRes.rows.length === 0) {
          const prodRes = await client.query(`SELECT safety_stock FROM dim_product WHERE id = $1`, [Number(body.productId)])
          if (prodRes.rows.length === 0) return { errorStatus: 404, errorMsg: '商品不存在' }
          stockRes = await client.query(
            `INSERT INTO fact_inventory_stock (product_id, warehouse_code, warehouse_name, on_hand_qty, locked_qty, safety_stock)
             VALUES ($1, $2, $3, 0, 0, $4)
             RETURNING id, on_hand_qty, locked_qty, safety_stock`,
            [Number(body.productId), whCode, whCode === 'MAIN_WH' ? '华东中心仓' : whCode, prodRes.rows[0].safety_stock],
          )
        }

        const cur = stockRes.rows[0]
        const beforeOnHand = Number(cur.on_hand_qty)
        const beforeLocked = Number(cur.locked_qty)
        let afterOnHand = beforeOnHand
        let afterLocked = beforeLocked
        let deltaOnHand = 0

        if (changeType === 'inbound' || changeType === 'return_in') {
          const absQty = Math.abs(qty)
          afterOnHand = beforeOnHand + absQty
          deltaOnHand = absQty
        } else if (changeType === 'outbound') {
          const absQty = Math.abs(qty)
          if (beforeOnHand < absQty) {
            return { errorStatus: 400, errorMsg: `在库库存不足（当前在库 ${beforeOnHand}，试图出库 ${absQty}）` }
          }
          afterOnHand = beforeOnHand - absQty
          afterLocked = Math.max(0, beforeLocked - Math.min(beforeLocked, absQty))
          deltaOnHand = -absQty
        } else if (changeType === 'lock') {
          const absQty = Math.abs(qty)
          if (beforeOnHand - beforeLocked < absQty) {
            return { errorStatus: 400, errorMsg: `可用库存不足（当前可用 ${beforeOnHand - beforeLocked}）` }
          }
          afterLocked = beforeLocked + absQty
          deltaOnHand = 0
        } else if (changeType === 'unlock') {
          const absQty = Math.abs(qty)
          afterLocked = Math.max(0, beforeLocked - absQty)
          deltaOnHand = 0
        } else if (changeType === 'adjust') {
          afterOnHand = beforeOnHand + qty
          if (afterOnHand < beforeLocked) {
            return { errorStatus: 400, errorMsg: `盘点调整后在库(${afterOnHand})不能低于已锁库存(${beforeLocked})` }
          }
          deltaOnHand = qty
        }

        const updated = await client.query(
          `UPDATE fact_inventory_stock
           SET on_hand_qty = $1, locked_qty = $2, updated_at = NOW()
           WHERE id = $3
           RETURNING on_hand_qty, locked_qty, available_qty, safety_stock`,
          [afterOnHand, afterLocked, cur.id],
        )
        await client.query(
          `INSERT INTO fact_inventory_ledger
             (product_id, warehouse_code, change_type, delta_qty, before_on_hand, after_on_hand, ref_type, ref_id, operator_id, remark)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            Number(body.productId),
            whCode,
            changeType,
            changeType === 'lock' ? Math.abs(qty) : changeType === 'unlock' ? -Math.abs(qty) : deltaOnHand,
            beforeOnHand,
            afterOnHand,
            body.refType?.trim() || 'manual_adjust',
            body.refId?.trim() || '',
            request.user?.id || null,
            body.remark?.trim() || '',
          ],
        )
        return { row: updated.rows[0] }
      })
      if ('errorStatus' in outcome && outcome.errorStatus) {
        return sendError(reply, outcome.errorStatus, outcome.errorMsg!)
      }
      return sendOk(reply, outcome.row)
    } catch (err) {
      request.log.error({ err }, 'Inventory stock adjustment failed')
      return sendError(reply, 500, '库存调账失败')
    }
  })

  // ── GET /api/v1/inventory/ledger ── 库存异动审计流水
  app.get('/api/v1/inventory/ledger', async (request: FastifyRequest<{
    Querystring: { productId?: string; limit?: string }
  }>, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { productId, limit } = request.query
      const lim = Math.min(Number(limit || 50) || 50, 200)
      const params: any[] = []
      const where = productId ? (params.push(Number(productId)), 'WHERE l.product_id = $1') : ''
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT l.*, p.sku_code, p.product_name, u.real_name AS operator_name
           FROM fact_inventory_ledger l
           JOIN dim_product p ON p.id = l.product_id
           LEFT JOIN users u ON u.id = l.operator_id
           ${where}
           ORDER BY l.created_at DESC, l.id DESC
           LIMIT ${lim}`,
          params,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch inventory ledger')
      return sendError(reply, 500, '获取库存流水失败')
    }
  })

}

