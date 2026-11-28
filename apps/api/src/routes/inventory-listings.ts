import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { effectivePlatforms } from '../lib/platform-scope.js'
import { requireTenantId } from '../lib/tenant-context.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

const writeRoles = ['super_admin', 'ops_director', 'ops_staff']

/**
 * inventory 域拆分（P2-1）：渠道定价与库存配额（channel-listings）
 * 原属 routes/inventory.ts，2026-11-17 拆出。
 */
export async function inventoryListingsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/inventory/channel-listings ── 获取各销售渠道商品定价与库存配额 (Master Plan §5.2 #9)
  app.get('/api/v1/inventory/channel-listings', { preHandler: [requireAuth] }, async (request, reply) => {
    const { platform, shopId, productId, isActive } = (request.query || {}) as {
      platform?: string
      shopId?: string
      productId?: string
      isActive?: string
    }
    try {
      const rows = await withRlsContext(request, async (client, scope) => {
        const conds: string[] = []
        const params: any[] = []
        const eff = effectivePlatforms(platform === 'all' ? undefined : platform, scope.allowedPlatforms)
        if (eff !== null) {
          params.push(eff)
          conds.push(`cl.platform_code = ANY($${params.length}::text[])`)
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
        if (effectivePlatforms(b.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { forbidden: true as const }
        }
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
            requireTenantId(scope.tenantId, 'routes.inventory-listings'),
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
      if ('forbidden' in row) return sendError(reply, 403, '无权访问该平台数据')
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
      const outcome = await withRlsContext(request, async (client, scope) => {
        const curRes = await client.query(`SELECT * FROM public.dim_product_channel_listing WHERE id = $1 FOR UPDATE`, [id])
        if (curRes.rows.length === 0) return { errorStatus: 404, errorMsg: '渠道商品配置不存在' }
        const cur = curRes.rows[0]
        if (effectivePlatforms(cur.platform_code, scope.allowedPlatforms)?.length === 0) {
          return { errorStatus: 403, errorMsg: '无权访问该平台数据' }
        }

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

}
