import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Store, Globe, Check, ShieldCheck } from 'lucide-react'
import { usePlatform } from '@/hooks/usePlatform'
import { cn } from '@/utils/cn'
import { checkRoutePlatformCompatibility } from '@/utils/platformRoute'

export function PlatformShopSelector() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    enabledPlatforms,
    currentPlatform,
    currentShop,
    setPlatformCode,
    setShopId,
    loading,
  } = usePlatform()

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  if (loading || !currentPlatform) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orbit-surface/50 border border-orbit-border text-xs text-slate-400">
        <Globe className="w-3.5 h-3.5 animate-spin" />
        <span>加载渠道...</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium",
          open
            ? "bg-orbit-primary/10 border-orbit-primary/40 text-slate-100 shadow-sm"
            : "bg-orbit-surface/70 border-orbit-border/80 text-slate-300 hover:text-slate-100 hover:border-orbit-border hover:bg-orbit-surface"
        )}
      >
        <span className={cn(
          "w-2 h-2 rounded-full",
          currentPlatform.category === 'live' ? "bg-rose-500 animate-pulse" :
          currentPlatform.category === 'shelf' ? "bg-amber-500" : "bg-emerald-500"
        )} />
        <span className="font-semibold text-slate-200">{currentPlatform.platform_name}</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-400 max-w-[120px] truncate">{currentShop?.name || '默认店铺'}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-500 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-80 rounded-xl bg-orbit-surface2/95 backdrop-blur-xl border border-orbit-border shadow-2xl p-3 z-50 space-y-3"
          >
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-orbit-border/60 pb-2">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                切换经营渠道与店铺
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                权限已过滤
              </span>
            </div>

            {/* Platform Selector Grid */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 block px-1">电商平台</span>
              <div className="grid grid-cols-2 gap-1.5">
                {enabledPlatforms.map(platform => {
                  const active = platform.platform_code === currentPlatform.platform_code
                  return (
                    <button
                      key={platform.platform_code}
                      onClick={() => {
                        setPlatformCode(platform.platform_code)
                        setOpen(false)

                        // 检查当前路由是否与新平台兼容，若不兼容则自动重定向至新平台专属首页
                        const compatibility = checkRoutePlatformCompatibility(
                          location.pathname,
                          platform.platform_code,
                          platform.capabilities,
                          platform.platform_name
                        )
                        if (!compatibility.supported && compatibility.redirectUrl) {
                          navigate(compatibility.redirectUrl, { replace: true })
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left",
                        active
                          ? "bg-orbit-primary/20 text-orbit-primary-light font-semibold border border-orbit-primary/30"
                          : "text-slate-300 hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <span className="truncate">{platform.platform_name}</span>
                      {active && <Check className="w-3 h-3 text-orbit-primary-light flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Shops List for Current Platform */}
            <div className="space-y-1 pt-1 border-t border-orbit-border/40">
              <span className="text-[10px] text-slate-500 block px-1">关联店铺 / 主体</span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {currentPlatform.shops.map(shop => {
                  const isCurrent = shop.id === currentShop?.id
                  return (
                    <button
                      key={shop.id}
                      onClick={() => {
                        setShopId(shop.id)
                        setOpen(false)
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                        isCurrent
                          ? "bg-white/10 text-slate-100 font-medium"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Store className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{shop.name}</span>
                      </div>
                      {isCurrent && <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

