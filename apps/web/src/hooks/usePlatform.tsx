import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'
import type { PlatformInfo, ShopInfo } from '@/types'

interface PlatformContextValue {
  platforms: PlatformInfo[]
  enabledPlatforms: PlatformInfo[]
  currentPlatform: PlatformInfo | null
  currentShop: ShopInfo | null
  loading: boolean
  setPlatformCode: (code: string) => void
  setShopId: (id: number) => void
  togglePlatformEnabled: (code: string, isEnabled: boolean) => Promise<void>
  refreshPlatforms: () => Promise<void>
  isModuleSupported: (moduleCode?: string) => boolean
}

const PlatformContext = createContext<PlatformContextValue>({
  platforms: [],
  enabledPlatforms: [],
  currentPlatform: null,
  currentShop: null,
  loading: true,
  setPlatformCode: () => {},
  setShopId: () => {},
  togglePlatformEnabled: async () => {},
  refreshPlatforms: async () => {},
  isModuleSupported: () => true,
})

const LIVE_ONLY_MODULES = new Set([
  'personal_achievement',
  'live_registration',
  'live_data',
  'review',
  'review_products',
  'review_short_video',
  'review_channels',
  'review_anchors',
  'review_funnel',
  'review_loop',
])

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPlatformCode, setCurrentPlatformCode] = useState<string>(() => {
    return localStorage.getItem('leyova_current_platform') || 'douyin'
  })
  const [currentShopId, setCurrentShopId] = useState<number | null>(() => {
    const saved = localStorage.getItem('leyova_current_shop_id')
    return saved ? Number(saved) : null
  })

  const refreshPlatforms = useCallback(async () => {
    try {
      const data = await api.get<PlatformInfo[]>('/platforms')
      setPlatforms(data || [])
    } catch (err) {
      console.warn('Failed to fetch platforms', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshPlatforms()
  }, [refreshPlatforms])

  const enabledPlatforms = platforms.filter(p => p.is_enabled && p.isPermitted)

  // Find active platform object
  const currentPlatform = enabledPlatforms.find(p => p.platform_code === currentPlatformCode) 
    || enabledPlatforms[0] 
    || platforms[0] 
    || null

  // Find active shop object
  const currentShops = currentPlatform?.shops || []
  const currentShop = currentShops.find(s => s.id === currentShopId) 
    || currentShops[0] 
    || null

  const setPlatformCode = (code: string) => {
    setCurrentPlatformCode(code)
    localStorage.setItem('leyova_current_platform', code)
    // Reset shop to the first shop of this platform
    const targetPlatform = platforms.find(p => p.platform_code === code)
    if (targetPlatform && targetPlatform.shops.length > 0) {
      setCurrentShopId(targetPlatform.shops[0].id)
      localStorage.setItem('leyova_current_shop_id', String(targetPlatform.shops[0].id))
    }
  }

  const setShopId = (id: number) => {
    setCurrentShopId(id)
    localStorage.setItem('leyova_current_shop_id', String(id))
  }

  const togglePlatformEnabled = async (code: string, isEnabled: boolean) => {
    await api.put(`/platforms/${code}`, { is_enabled: isEnabled })
    await refreshPlatforms()
  }

  const isModuleSupported = (moduleCode?: string): boolean => {
    if (!moduleCode) return true
    if (!currentPlatform) return true

    // If current platform does not support live, hide live-only modules
    if (!currentPlatform.capabilities?.supportsLive && LIVE_ONLY_MODULES.has(moduleCode)) {
      return false
    }

    return true
  }

  return (
    <PlatformContext.Provider
      value={{
        platforms,
        enabledPlatforms,
        currentPlatform,
        currentShop,
        loading,
        setPlatformCode,
        setShopId,
        togglePlatformEnabled,
        refreshPlatforms,
        isModuleSupported,
      }}
    >
      {children}
    </PlatformContext.Provider>
  )
}

export function usePlatform() {
  return useContext(PlatformContext)
}

