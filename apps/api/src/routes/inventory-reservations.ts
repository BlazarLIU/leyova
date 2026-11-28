import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { effectivePlatforms } from '../lib/platform-scope.js'
import { requireTenantId } from '../lib/tenant-context.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

const writeRoles = ['super_admin', 'ops_director', 'ops_staff']

/**
 * inventory 域拆分（P2-1）：防超卖库存预留（reservations）
 * 原属 routes/inventory.ts，2026-11-17 拆出。
 */
export async function inventoryReservationsRoutes(app: FastifyInstance) {
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
        if (effectivePlatforms(b.platformCode, scope.allowedPlatforms)?.length === 0) {
          return { errorStatus: 403, errorMsg: '无权访问该平台数据' }
        }
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
            requireTenantId(scope.tenantId, 'routes.inventory-reservations'),
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
      const rows = await withRlsContext(request, async (client, scope) => {
        const conds: string[] = []
        const params: any[] = []
        const eff = effectivePlatforms(undefined, scope.allowedPlatforms)
        if (eff !== null) {
          params.push(eff)
          conds.push(`r.platform_code = ANY($${params.length}::text[])`)
        }
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
