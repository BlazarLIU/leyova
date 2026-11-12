import { useMemo, useCallback } from 'react'
import { usePlatform } from './usePlatform'

export interface FlatShopOption {
  id: number
  name: string
  platformCode: string
  platformName: string
  status: string
}

/**
 * Dynamically derives active shop options from `/api/v1/platforms` via PlatformContext,
 * replacing hardcoded platform-to-shop ID maps in operational pages.
 */
export function useShops() {
  const { platforms, loading } = usePlatform()

  const shops = useMemo<FlatShopOption[]>(() => {
    const list: FlatShopOption[] = []
    for (const p of platforms) {
      for (const s of p.shops || []) {
        if (s.status && s.status !== 'active') continue
        list.push({
          id: s.id,
          name: s.name,
          platformCode: p.platform_code,
          platformName: p.platform_name,
          status: s.status || 'active',
        })
      }
    }
    return list
  }, [platforms])

  const getShopsByPlatform = useCallback(
    (platformCode?: string) =>
      platformCode ? shops.filter((s) => s.platformCode === platformCode) : shops,
    [shops],
  )

  const getDefaultShopId = useCallback(
    (platformCode: string, currentShopId?: string): string => {
      const candidates = shops.filter((s) => s.platformCode === platformCode)
      if (candidates.length === 0) return currentShopId || ''
      if (currentShopId && candidates.some((s) => String(s.id) === currentShopId)) {
        return currentShopId
      }
      return String(candidates[0].id)
    },
    [shops],
  )

  return { shops, loading, getShopsByPlatform, getDefaultShopId }
}
