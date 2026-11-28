import type { DbExecutor } from './audit.js'

export interface ShopPlatformCheck {
  ok: boolean
  statusCode?: number
  message?: string
  shop?: {
    id: number
    platform_code: string
    tenant_id: number
    shop_name: string
  }
}

/**
 * 校验 shopId 是否存在且归属指定平台（若传入 expectedPlatform），防止跨平台 shop_id 伪造/串台。
 */
export async function assertShopPlatform(
  executor: DbExecutor,
  shopId: number | string | null | undefined,
  expectedPlatform?: string | string[] | null,
): Promise<ShopPlatformCheck> {
  const numericId = Number(shopId)
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return { ok: false, statusCode: 400, message: '无效的店铺 ID (shopId)' }
  }

  const { rows } = await executor.query<{
    id: number
    platform_code: string
    tenant_id: number
    shop_name: string
  }>(
    'SELECT id, platform_code, tenant_id, shop_name FROM public.dim_shop WHERE id = $1 LIMIT 1',
    [numericId],
  )

  const shop = rows[0]
  if (!shop) {
    return { ok: false, statusCode: 404, message: `店铺 #${numericId} 不存在或无权访问` }
  }

  if (expectedPlatform) {
    const allowed = Array.isArray(expectedPlatform) ? expectedPlatform : [expectedPlatform]
    if (!allowed.includes(shop.platform_code)) {
      return {
        ok: false,
        statusCode: 400,
        message: `店铺 #${numericId} (${shop.shop_name}) 属于 ${shop.platform_code}，与目标平台 ${allowed.join('/')} 不匹配`,
      }
    }
  }

  return { ok: true, shop }
}
