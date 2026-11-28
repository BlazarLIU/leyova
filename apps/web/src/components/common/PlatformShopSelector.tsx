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
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-orbit-surface2 border border-orbit-border text-xs text-[var(--text-muted)]">
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
          "flex items-center gap-2.5 px-3 py-1.5 rounded-[10px] border transition-colors text-xs font-medium",
          open
            ? "bg-orbit-primary/[0.08] border-orbit-primary/40 text-[var(--text-primary)]"
            : "bg-orbit-surface2 border-orbit-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-orbit-border2 hover:bg-[var(--surface3)]"
        )}
      >
        <span className={cn(
          "w-2 h-2 rounded-full",
          currentPlatform.category === 'live' ? "bg-orbit-danger animate-pulse" :
          currentPlatform.category === 'shelf' ? "bg-orbit-warning" : "bg-orbit-success"
        )} />
        <span className="font-semibold text-[var(--text-primary)]">{currentPlatform.platform_name}</span>
        <span className="text-[var(--text-subtle)]">/</span>
        <span className="max-w-[120px] truncate text-[var(--text-muted)]">{currentShop?.name || '默认店铺'}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-[var(--text-subtle)] transition-transform duration-200", open && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-2 w-80 space-y-3 rounded-[14px] border border-orbit-border bg-orbit-surface p-3 shadow-[0_24px_60px_-24px_rgba(23,23,23,0.4)]"
          >
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-orbit-border/60 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                切换经营渠道与店铺
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-subtle)]">
                <ShieldCheck className="w-3 h-3 text-status-success" />
                权限已过滤
              </span>
            </div>

            {/* Platform Selector Grid */}
            <div className="space-y-1">
              <span className="block px-1 text-[10px] text-[var(--text-subtle)]">电商平台</span>
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
                        "flex items-center justify-between rounded-[9px] border px-2.5 py-2 text-left text-xs transition-colors",
                        active
                          ? "border-orbit-primary/30 bg-orbit-primary/[0.08] font-semibold text-orbit-primary dark:text-orbit-primary-light"
                          : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
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
              <span className="block px-1 text-[10px] text-[var(--text-subtle)]">关联店铺 / 主体</span>
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
                        "flex w-full items-center justify-between rounded-[9px] px-2.5 py-1.5 text-left text-xs transition-colors",
                        isCurrent
                          ? "bg-orbit-primary/[0.08] font-medium text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Store className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-subtle)]" />
                        <span className="truncate">{shop.name}</span>
                      </div>
                      {isCurrent && <Check className="w-3 h-3 text-status-success flex-shrink-0" />}
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

