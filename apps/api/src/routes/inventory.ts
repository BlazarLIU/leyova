import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

/** 查询商品主数据库存概况与列表，服务于 /api/v1/inventory/* */
export async function queryInventoryProducts(
  executor: DbExecutor,
  filters: { keyword?: string; category?: string; platformCode?: string; lowStockOnly?: boolean } = {},
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
  if (filters.platformCode?.trim()) {
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
  const writeRoles = ['super_admin', 'admin', 'ops_director', 'operator', 'ops_staff']

  // ── GET /api/v1/inventory/overview ── 全渠道库存与商品概况
  app.get('/api/v1/inventory/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    try {
      const { rows, mappingStats } = await withRlsContext(request, async (client) => {
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
          GROUP BY platform_code
          ORDER BY mapped_skus DESC
        `)
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
      const list = await withRlsContext(request, (client) =>
        queryInventoryProducts(client, {
          keyword,
          category,
          platformCode,
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
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
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
        ),
      )
      return sendOk(reply, rows[0])
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

  // ── GET /api/v1/inventory/channel-listings ── 获取各销售渠道商品定价与库存配额 (Master Plan §5.2 #9)
  app.get('/api/v1/inventory/channel-listings', { preHandler: [requireAuth] }, async (request, reply) => {
    const { platform, shopId, productId, isActive } = (request.query || {}) as {
      platform?: string
      shopId?: string
      productId?: string
      isActive?: string
    }
    try {
      const rows = await withRlsContext(request, async (client) => {
        const conds: string[] = []
        const params: any[] = []
        if (platform && platform !== 'all') {
          params.push(platform)
          conds.push(`cl.platform_code = $${params.length}`)
        }
        if (shopId) {
          params.push(Number(shopId))
          conds.push(`cl.shop_id = $${params.length}`)
        }
        if (productId) {
          params.push(Number(productId))
          conds.push(`cl.product_id = $${params.length}`)
        }
        if (isActive !== undefined && isActive !== '') {
          params.push(isActive === 'true')
          conds.push(`cl.is_active = $${params.length}`)
        }
        const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
        const res = await client.query(
          `SELECT cl.id, cl.product_id, p.sku_code, p.product_name, p.retail_price AS base_retail_price,
                  cl.platform_code, spc.platform_name, cl.shop_id, ds.shop_name,
                  cl.channel_sku_id, cl.channel_price, cl.allocated_stock, cl.reserved_stock,
                  (cl.allocated_stock - cl.reserved_stock) AS available_channel_stock,
                  cl.safety_stock, cl.is_active, cl.created_at, cl.updated_at
           FROM public.dim_product_channel_listing cl
           JOIN public.dim_product p ON p.id = cl.product_id
           JOIN public.dim_shop ds ON ds.id = cl.shop_id
           LEFT JOIN public.system_platform_configs spc ON spc.platform_code = cl.platform_code
           ${whereClause}
           ORDER BY cl.product_id ASC, cl.platform_code ASC`,
          params,
        )
        return res.rows.map((r) => ({
          id: Number(r.id),
          productId: Number(r.product_id),
          skuCode: r.sku_code,
          productName: r.product_name,
          baseRetailPrice: Number(r.base_retail_price),
          platformCode: r.platform_code,
          platformName: r.platform_name,
          shopId: Number(r.shop_id),
          shopName: r.shop_name,
          channelSkuId: r.channel_sku_id,
          channelPrice: Number(r.channel_price),
          allocatedStock: Number(r.allocated_stock),
          reservedStock: Number(r.reserved_stock),
          availableChannelStock: Number(r.available_channel_stock),
          safetyStock: Number(r.safety_stock),
          isActive: Boolean(r.is_active),
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      })
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch channel listings')
      return sendError(reply, 500, '获取渠道商品定价与配额失败')
    }
  })

  // ── POST /api/v1/inventory/channel-listings ── 创建/绑定渠道定价与配额 (Master Plan §5.2 #9)
  app.post('/api/v1/inventory/channel-listings', { preHandler: [requireRole(writeRoles)] }, async (request, reply) => {
    const b = (request.body || {}) as {
      productId?: number
      platformCode?: string
      shopId?: number
      channelSkuId?: string
      channelPrice?: number
      allocatedStock?: number
      safetyStock?: number
      isActive?: boolean
    }
    if (!b.productId || !b.platformCode || !b.shopId || !b.channelSkuId || b.channelPrice === undefined) {
      return sendError(reply, 400, '缺少必填字段: productId, platformCode, shopId, channelSkuId, channelPrice')
    }
    if (Number(b.channelPrice) <= 0) {
      return sendError(reply, 400, '渠道销售价必须大于 0')
    }
    const allocated = Math.max(0, Math.trunc(Number(b.allocatedStock || 0)))
    const safety = Math.max(0, Math.trunc(Number(b.safetyStock ?? 10)))

    try {
      const row = await withRlsContext(request, async (client, scope) => {
        const res = await client.query(
          `INSERT INTO public.dim_product_channel_listing (
            tenant_id, product_id, platform_code, shop_id, channel_sku_id,
            channel_price, allocated_stock, reserved_stock, safety_stock, is_active,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, 0, $8, $9,
            now(), now()
          )
          ON CONFLICT (shop_id, platform_code, channel_sku_id) DO UPDATE SET
            channel_price = EXCLUDED.channel_price,
            allocated_stock = EXCLUDED.allocated_stock,
            safety_stock = EXCLUDED.safety_stock,
            is_active = EXCLUDED.is_active,
            updated_at = now()
          RETURNING *`,
          [
            scope.tenantId || 1,
            Number(b.productId),
            b.platformCode!.trim().toLowerCase(),
            Number(b.shopId),
            b.channelSkuId!.trim(),
            Number(b.channelPrice),
            allocated,
            safety,
            b.isActive ?? true,
          ],
        )
        return res.rows[0]
      })
      return sendOk(reply, row)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to save channel listing')
      return sendError(reply, 500, err?.message || '保存渠道定价与库存配额失败')
    }
  })

  // ── PUT /api/v1/inventory/channel-listings/:id ── 调整渠道定价与配额 (Master Plan §5.2 #9)
  app.put('/api/v1/inventory/channel-listings/:id', { preHandler: [requireRole(writeRoles)] }, async (request, reply) => {
    const id = Number((request.params as any).id)
    if (!Number.isFinite(id)) return sendError(reply, 400, '非法 ID')
    const b = (request.body || {}) as {
      channelPrice?: number
      allocatedStock?: number
      safetyStock?: number
      isActive?: boolean
    }
    try {
      const outcome = await withRlsContext(request, async (client) => {
        const curRes = await client.query(`SELECT * FROM public.dim_product_channel_listing WHERE id = $1 FOR UPDATE`, [id])
        if (curRes.rows.length === 0) return { errorStatus: 404, errorMsg: '渠道商品配置不存在' }
        const cur = curRes.rows[0]

        const fields: string[] = []
        const params: any[] = [id]
        let idx = 2

        if (b.channelPrice !== undefined) {
          if (Number(b.channelPrice) <= 0) return { errorStatus: 400, errorMsg: '渠道售价必须大于 0' }
          fields.push(`channel_price = $${idx++}`)
          params.push(Number(b.channelPrice))
        }
        if (b.allocatedStock !== undefined) {
          const newAlloc = Math.max(0, Math.trunc(Number(b.allocatedStock)))
          if (newAlloc < Number(cur.reserved_stock)) {
            return { errorStatus: 400, errorMsg: `配额库存(${newAlloc})不能低于当前已预留占用量(${cur.reserved_stock})` }
          }
          fields.push(`allocated_stock = $${idx++}`)
          params.push(newAlloc)
        }
        if (b.safetyStock !== undefined) {
          fields.push(`safety_stock = $${idx++}`)
          params.push(Math.max(0, Math.trunc(Number(b.safetyStock))))
        }
        if (b.isActive !== undefined) {
          fields.push(`is_active = $${idx++}`)
          params.push(Boolean(b.isActive))
        }
        if (fields.length === 0) return { row: cur }

        fields.push(`updated_at = now()`)
        const upd = await client.query(
          `UPDATE public.dim_product_channel_listing SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
          params,
        )
        return { row: upd.rows[0] }
      })
      if ('errorStatus' in outcome && outcome.errorStatus) {
        return sendError(reply, outcome.errorStatus, outcome.errorMsg!)
      }
      return sendOk(reply, outcome.row)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to update channel listing')
      return sendError(reply, 500, err?.message || '更新渠道配置失败')
    }
  })

  // ── POST /api/v1/inventory/reservations/reserve ── 原子锁定并占用库存（Master Plan §5.2 #10 防超卖）
  app.post('/api/v1/inventory/reservations/reserve', { preHandler: [requireRole(writeRoles)] }, async (request, reply) => {
    const b = (request.body || {}) as {
      orderNo: string
      productId: number
      platformCode: string
      shopId: number
      reservedQty: number
      warehouseCode?: string
      ttlMinutes?: number
    }
    if (!b.orderNo || !b.productId || !b.platformCode || !b.shopId || !b.reservedQty) {
      return sendError(reply, 400, '缺少必填字段: orderNo, productId, platformCode, shopId, reservedQty')
    }
    const qty = Math.trunc(Number(b.reservedQty))
    if (qty <= 0) return sendError(reply, 400, '预留数量必须大于 0')

    const whCode = b.warehouseCode?.trim() || 'MAIN_WH'
    const ttlMin = Math.max(1, Math.min(Number(b.ttlMinutes || 15), 1440))

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        // 检查是否存在重复的未释放预留单
        const existRes = await client.query(
          `SELECT id, reservation_no, status FROM public.fact_inventory_reservation
           WHERE order_no = $1 AND product_id = $2 AND status = 'reserved' LIMIT 1`,
          [b.orderNo.trim(), Number(b.productId)],
        )
        if (existRes.rows.length > 0) {
          return { errorStatus: 409, errorMsg: `该订单商品已有生效中的预留单: ${existRes.rows[0].reservation_no}` }
        }

        // 1. 悲观行锁锁定物理总仓库存
        const stockRes = await client.query(
          `SELECT id, on_hand_qty, locked_qty FROM public.fact_inventory_stock
           WHERE product_id = $1 AND warehouse_code = $2 FOR UPDATE`,
          [Number(b.productId), whCode],
        )
        if (stockRes.rows.length === 0) {
          return { errorStatus: 404, errorMsg: `该商品在仓库(${whCode})未初始化库存档案` }
        }
        const stock = stockRes.rows[0]
        const availableWhStock = Number(stock.on_hand_qty) - Number(stock.locked_qty)
        if (availableWhStock < qty) {
          return {
            errorStatus: 400,
            errorMsg: `总仓可用库存不足（仓库当前可用 ${availableWhStock}，试图预留 ${qty}）`,
            shortage: { available: availableWhStock, requested: qty },
          }
        }

        // 2. 检查是否有该渠道的独立配额限制
        const listingRes = await client.query(
          `SELECT id, allocated_stock, reserved_stock, is_active FROM public.dim_product_channel_listing
           WHERE shop_id = $1 AND platform_code = $2 AND product_id = $3 FOR UPDATE`,
          [Number(b.shopId), b.platformCode.trim().toLowerCase(), Number(b.productId)],
        )
        let channelListingId: number | null = null
        if (listingRes.rows.length > 0) {
          const listing = listingRes.rows[0]
          if (!listing.is_active) {
            return { errorStatus: 400, errorMsg: '该商品在对应销售渠道已被下架停售' }
          }
          const availableChannel = Number(listing.allocated_stock) - Number(listing.reserved_stock)
          if (availableChannel < qty) {
            return {
              errorStatus: 400,
              errorMsg: `渠道专享配额不足（渠道当前可用 ${availableChannel}，试图预留 ${qty}）`,
              shortage: { available: availableChannel, requested: qty },
            }
          }
          channelListingId = Number(listing.id)
        }

        // 3. 原子扣减可用/增加锁定
        const rsvNo = `RSV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        await client.query(
          `UPDATE public.fact_inventory_stock
           SET locked_qty = locked_qty + $1, updated_at = now()
           WHERE id = $2`,
          [qty, stock.id],
        )

        if (channelListingId) {
          await client.query(
            `UPDATE public.dim_product_channel_listing
             SET reserved_stock = reserved_stock + $1, updated_at = now()
             WHERE id = $2`,
            [qty, channelListingId],
          )
        }

        // 4. 插入预留单
        const insRes = await client.query(
          `INSERT INTO public.fact_inventory_reservation (
            tenant_id, reservation_no, order_no, product_id, platform_code,
            shop_id, warehouse_code, channel_listing_id, reserved_qty,
            status, expires_at, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            'reserved', now() + ($10 * interval '1 minute'), now(), now()
          ) RETURNING *`,
          [
            scope.tenantId || 1,
            rsvNo,
            b.orderNo.trim(),
            Number(b.productId),
            b.platformCode.trim().toLowerCase(),
            Number(b.shopId),
            whCode,
            channelListingId,
            qty,
            ttlMin,
          ],
        )

        // 5. 写入审计出入库流水
        await client.query(
          `INSERT INTO public.fact_inventory_ledger (
            product_id, warehouse_code, change_type, delta_qty,
            before_on_hand, after_on_hand, ref_type, ref_id, operator_id, remark
          ) VALUES ($1, $2, 'lock', $3, $4, $4, 'inventory_reservation', $5, $6, $7)`,
          [
            Number(b.productId),
            whCode,
            qty,
            Number(stock.on_hand_qty),
            rsvNo,
            request.user?.id || null,
            `大促并发下单锁定 ${qty} 件 (订单: ${b.orderNo})`,
          ],
        )

        return { reservation: insRes.rows[0] }
      })

      if ('errorStatus' in outcome && outcome.errorStatus) {
        return reply.status(outcome.errorStatus).send({ error: outcome.errorMsg, shortage: outcome.shortage })
      }
      return sendOk(reply, outcome.reservation)
    } catch (err: any) {
      request.log.error({ err }, 'Stock reservation failed')
      return sendError(reply, 500, err?.message || '库存预留操作失败')
    }
  })

  // ── POST /api/v1/inventory/reservations/:reservationNo/commit ── 预留核销出库 (Master Plan §5.2 #10)
  app.post('/api/v1/inventory/reservations/:reservationNo/commit', { preHandler: [requireRole(writeRoles)] }, async (request, reply) => {
    const { reservationNo } = request.params as { reservationNo: string }
    if (!reservationNo) return sendError(reply, 400, '缺少预留单号')

    try {
      const outcome = await withRlsContext(request, async (client) => {
        const rsvRes = await client.query(
          `SELECT * FROM public.fact_inventory_reservation WHERE reservation_no = $1 FOR UPDATE`,
          [reservationNo.trim()],
        )
        if (rsvRes.rows.length === 0) return { errorStatus: 404, errorMsg: '预留单不存在' }
        const rsv = rsvRes.rows[0]

        if (rsv.status === 'committed') return { errorStatus: 400, errorMsg: '该预留单已核销出库，不可重复核销' }
        if (rsv.status === 'released') return { errorStatus: 400, errorMsg: '该预留单已释放取消，无法完成核销' }

        const qty = Number(rsv.reserved_qty)

        // 扣减总仓在库与锁定
        const stockRes = await client.query(
          `UPDATE public.fact_inventory_stock
           SET on_hand_qty = GREATEST(0, on_hand_qty - $1),
               locked_qty = GREATEST(0, locked_qty - $1),
               updated_at = now()
           WHERE product_id = $2 AND warehouse_code = $3
           RETURNING on_hand_qty, locked_qty`,
          [qty, rsv.product_id, rsv.warehouse_code],
        )

        // 扣减渠道配额在库与锁定
        if (rsv.channel_listing_id) {
          await client.query(
            `UPDATE public.dim_product_channel_listing
             SET allocated_stock = GREATEST(0, allocated_stock - $1),
                 reserved_stock = GREATEST(0, reserved_stock - $1),
                 updated_at = now()
             WHERE id = $2`,
            [qty, rsv.channel_listing_id],
          )
        }

        // 更新预留单状态为 committed
        const updRsv = await client.query(
          `UPDATE public.fact_inventory_reservation
           SET status = 'committed', committed_at = now(), updated_at = now()
           WHERE id = $1
           RETURNING *`,
          [rsv.id],
        )

        // 记流水
        await client.query(
          `INSERT INTO public.fact_inventory_ledger (
            product_id, warehouse_code, change_type, delta_qty,
            before_on_hand, after_on_hand, ref_type, ref_id, operator_id, remark
          ) VALUES ($1, $2, 'outbound', $3, $4, $5, 'reservation_commit', $6, $7, $8)`,
          [
            rsv.product_id,
            rsv.warehouse_code,
            -qty,
            Number(stockRes.rows[0]?.on_hand_qty || 0) + qty,
            Number(stockRes.rows[0]?.on_hand_qty || 0),
            rsv.reservation_no,
            request.user?.id || null,
            `预留核销出库 (订单: ${rsv.order_no})`,
          ],
        )

        return { reservation: updRsv.rows[0] }
      })

      if ('errorStatus' in outcome && outcome.errorStatus) {
        return sendError(reply, outcome.errorStatus, outcome.errorMsg!)
      }
      return sendOk(reply, outcome.reservation)
    } catch (err: any) {
      request.log.error({ err }, 'Commit reservation failed')
      return sendError(reply, 500, err?.message || '预留核销失败')
    }
  })

  // ── POST /api/v1/inventory/reservations/:reservationNo/release ── 预留超时/取消释放 (Master Plan §5.2 #10)
  app.post('/api/v1/inventory/reservations/:reservationNo/release', { preHandler: [requireRole(writeRoles)] }, async (request, reply) => {
    const { reservationNo } = request.params as { reservationNo: string }
    const { reason = '用户取消或未在时限内支付' } = (request.body || {}) as { reason?: string }
    if (!reservationNo) return sendError(reply, 400, '缺少预留单号')

    try {
      const outcome = await withRlsContext(request, async (client) => {
        const rsvRes = await client.query(
          `SELECT * FROM public.fact_inventory_reservation WHERE reservation_no = $1 FOR UPDATE`,
          [reservationNo.trim()],
        )
        if (rsvRes.rows.length === 0) return { errorStatus: 404, errorMsg: '预留单不存在' }
        const rsv = rsvRes.rows[0]

        if (rsv.status === 'released') return { errorStatus: 400, errorMsg: '该预留单已释放，不可重复释放' }
        if (rsv.status === 'committed') return { errorStatus: 400, errorMsg: '该预留单已核销出库，不可取消释放' }

        const qty = Number(rsv.reserved_qty)

        // 释放总仓锁定
        await client.query(
          `UPDATE public.fact_inventory_stock
           SET locked_qty = GREATEST(0, locked_qty - $1), updated_at = now()
           WHERE product_id = $2 AND warehouse_code = $3`,
          [qty, rsv.product_id, rsv.warehouse_code],
        )

        // 释放渠道锁定
        if (rsv.channel_listing_id) {
          await client.query(
            `UPDATE public.dim_product_channel_listing
             SET reserved_stock = GREATEST(0, reserved_stock - $1), updated_at = now()
             WHERE id = $2`,
            [qty, rsv.channel_listing_id],
          )
        }

        // 更新预留单状态为 released
        const updRsv = await client.query(
          `UPDATE public.fact_inventory_reservation
           SET status = 'released', released_at = now(), release_reason = $1, updated_at = now()
           WHERE id = $2
           RETURNING *`,
          [reason, rsv.id],
        )

        // 记流水
        await client.query(
          `INSERT INTO public.fact_inventory_ledger (
            product_id, warehouse_code, change_type, delta_qty,
            before_on_hand, after_on_hand, ref_type, ref_id, operator_id, remark
          ) VALUES ($1, $2, 'unlock', $3, 0, 0, 'reservation_release', $4, $5, $6)`,
          [
            rsv.product_id,
            rsv.warehouse_code,
            -qty,
            rsv.reservation_no,
            request.user?.id || null,
            `预留释放解锁 (原因: ${reason})`,
          ],
        )

        return { reservation: updRsv.rows[0] }
      })

      if ('errorStatus' in outcome && outcome.errorStatus) {
        return sendError(reply, outcome.errorStatus, outcome.errorMsg!)
      }
      return sendOk(reply, outcome.reservation)
    } catch (err: any) {
      request.log.error({ err }, 'Release reservation failed')
      return sendError(reply, 500, err?.message || '预留释放失败')
    }
  })

  // ── GET /api/v1/inventory/reservations ── 查询预留单列表 (Master Plan §5.2 #10)
  app.get('/api/v1/inventory/reservations', { preHandler: [requireAuth] }, async (request, reply) => {
    const { orderNo, status, shopId, productId, limit } = (request.query || {}) as {
      orderNo?: string
      status?: string
      shopId?: string
      productId?: string
      limit?: string
    }
    const lim = Math.min(Number(limit || 50) || 50, 200)

    try {
      const rows = await withRlsContext(request, async (client) => {
        const conds: string[] = []
        const params: any[] = []
        if (orderNo) {
          params.push(`%${orderNo.trim()}%`)
          conds.push(`r.order_no ILIKE $${params.length}`)
        }
        if (status) {
          params.push(status.trim())
          conds.push(`r.status = $${params.length}`)
        }
        if (shopId) {
          params.push(Number(shopId))
          conds.push(`r.shop_id = $${params.length}`)
        }
        if (productId) {
          params.push(Number(productId))
          conds.push(`r.product_id = $${params.length}`)
        }
        const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''
        const res = await client.query(
          `SELECT r.*, p.sku_code, p.product_name, ds.shop_name, spc.platform_name
           FROM public.fact_inventory_reservation r
           JOIN public.dim_product p ON p.id = r.product_id
           JOIN public.dim_shop ds ON ds.id = r.shop_id
           LEFT JOIN public.system_platform_configs spc ON spc.platform_code = r.platform_code
           ${whereClause}
           ORDER BY r.created_at DESC, r.id DESC
           LIMIT ${lim}`,
          params,
        )
        return res.rows.map((row) => ({
          id: Number(row.id),
          reservationNo: row.reservation_no,
          orderNo: row.order_no,
          productId: Number(row.product_id),
          skuCode: row.sku_code,
          productName: row.product_name,
          platformCode: row.platform_code,
          platformName: row.platform_name,
          shopId: Number(row.shop_id),
          shopName: row.shop_name,
          warehouseCode: row.warehouse_code,
          reservedQty: Number(row.reserved_qty),
          status: row.status,
          expiresAt: row.expires_at,
          committedAt: row.committed_at,
          releasedAt: row.released_at,
          releaseReason: row.release_reason,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      })
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch inventory reservations')
      return sendError(reply, 500, '获取库存预留记录失败')
    }
  })
}

