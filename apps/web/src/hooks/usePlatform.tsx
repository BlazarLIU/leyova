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
})

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

  // 当前经营范围：抖音 / 快手 / 视频号。其他平台代码与数据保留，但不进入经营渠道切换。
  const ACTIVE_PLATFORM_CODES = new Set(['douyin', 'kuaishou', 'wechat'])
  const enabledPlatforms = platforms.filter(
    p => p.is_enabled && p.isPermitted && ACTIVE_PLATFORM_CODES.has(p.platform_code)
  )

  // Find active platform object（不回退到已隐藏的平台）
  const currentPlatform = enabledPlatforms.find(p => p.platform_code === currentPlatformCode) 
    || enabledPlatforms[0] 
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
      }}
    >
      {children}
    </PlatformContext.Provider>
  )
}

export function usePlatform() {
  return useContext(PlatformContext)
}

