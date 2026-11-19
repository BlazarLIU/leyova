import { useEffect, useState, useMemo, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Footer } from './Footer'
import { SidebarContext, useSidebarState } from '@/hooks/useSidebar'
import { AuthContext, type AuthUser, type AccessInfo } from '@/hooks/useAuth'
import { AiOpsSessionProvider } from '@/contexts/AiOpsSessionContext'
import { usePlatform } from '@/hooks/usePlatform'
import { checkRoutePlatformCompatibility } from '@/utils/platformRoute'
import { AI_OPS_ROLES, FINANCE_ROLES, isRoleCode } from '@/constants/roles'
import { PlatformMismatchNotice } from '@/components/common/PlatformMismatchNotice'
import { api } from '@/services/api'
import { ApiError } from '@/services/api'
import type { RoleInfo } from '@/types'

export function Layout() {
  const sidebarState = useSidebarState()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentPlatform, setPlatformCode } = usePlatform()
  const [authChecking, setAuthChecking] = useState(true)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [roles, setRoles] = useState<RoleInfo[]>([])
  // S2：服务端解析后的「模式 × 平台 × 模块」权限
  const [access, setAccess] = useState<AccessInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    async function bootstrapAuth() {
      try {
        const res: any = await api.get('/auth/me')
        if (cancelled) return
        if (!res?.user?.role) {
          navigate('/sign-in', { replace: true })
          return
        }
        setAuthUser(res.user)
        if (res.access) setAccess(res.access as AccessInfo)
        try {
          const roleList = await api.get<RoleInfo[]>('/system/roles')
          if (!cancelled && Array.isArray(roleList)) {
            setRoles(roleList)
          }
        } catch {
          // Fail closed on module list load failure
          if (!cancelled) setRoles([])
        }
      } catch (err: any) {
        if (!cancelled && err instanceof ApiError && err.status === 401) {
          navigate('/sign-in', { replace: true })
        }
      } finally {
        if (!cancelled) setAuthChecking(false)
      }
    }
    bootstrapAuth()
    return () => { cancelled = true }
  }, [navigate])

  const isBrandViewer = Boolean(authUser && (authUser.role === 'brand_viewer' || authUser.userType === 'brand_viewer'))
  const isSuperAdmin = authUser?.role === 'super_admin'

  const role = authUser?.role || ''
  const canAccessAiOps = isRoleCode(role) && AI_OPS_ROLES.includes(role)
  const canAccessFinance = isRoleCode(role) && FINANCE_ROLES.includes(role)
  const isOpsUser = isRoleCode(role) && ['ops_director', 'ops_staff'].includes(role)
  const isFinanceUser = canAccessFinance
  const isHrbpUser = role === 'hrbp'

  const allowedModules = useMemo(() => {
    if (!authUser || isBrandViewer) return []
    // 优先用服务端解析后的权限（含模式、用户覆盖、平台能力过滤）
    if (access?.modules) return access.modules
    // 回退：旧路径（/auth/me 未返回 access 时）
    const found = roles.find(r => r.code === authUser.role)
    return Array.isArray(found?.modules) ? found.modules : []
  }, [authUser, roles, isBrandViewer, access])

  /** 当前平台下实际可用的模块（平台能力矩阵已扣除非适用项） */
  const platformModules = useMemo(() => {
    if (!authUser || isBrandViewer) return []
    if (isSuperAdmin) return allowedModules
    const code = currentPlatform?.platform_code
    if (!code || !access?.modulesByPlatform) return allowedModules
    return access.modulesByPlatform[code] ?? allowedModules
  }, [authUser, isBrandViewer, isSuperAdmin, currentPlatform, access, allowedModules])

  const hasModule = useCallback((moduleCode?: string): boolean => {
    if (!authUser || authChecking || isBrandViewer) return false
    if (isSuperAdmin) return true
    if (!moduleCode || platformModules.length === 0) return false
    return platformModules.includes(moduleCode)
  }, [authUser, authChecking, isBrandViewer, isSuperAdmin, platformModules])

  const hasAnyModule = useCallback((moduleCodes: string[]): boolean => {
    return moduleCodes.some(m => hasModule(m))
  }, [hasModule])

  const hasRole = useCallback((allowedRoles: string[]): boolean => {
    if (!authUser || authChecking) return false
    if (isSuperAdmin) return true
    return allowedRoles.includes(authUser.role)
  }, [authUser, authChecking, isSuperAdmin])

  const authValue = useMemo(() => ({
    user: authUser,
    roles,
    allowedModules,
    platformModules,
    access,
    disabledModules: access?.disabledModules ?? [],
    loading: authChecking,
    isBrandViewer,
    isSuperAdmin,
    canAccessAiOps,
    canAccessFinance,
    isOpsUser,
    isFinanceUser,
    isHrbpUser,
    hasModule,
    hasAnyModule,
    hasRole,
  }), [
    authUser,
    roles,
    allowedModules,
    platformModules,
    access,
    authChecking,
    isBrandViewer,
    isSuperAdmin,
    canAccessAiOps,
    canAccessFinance,
    isOpsUser,
    isFinanceUser,
    isHrbpUser,
    hasModule,
    hasAnyModule,
    hasRole,
  ])

  return (
    <AuthContext.Provider value={authValue}>
      <SidebarContext.Provider value={sidebarState}>
        <AiOpsSessionProvider>
          {authChecking ? (
            <div className="flex h-screen bg-orbit-bg items-center justify-center">
              <div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex h-screen bg-orbit-bg overflow-hidden">
              <div className="orbit-glow-bg" />

              <Sidebar user={authUser || undefined} />

              {/* Mobile overlay backdrop */}
              <AnimatePresence>
                {sidebarState.isMobile && sidebarState.mobileOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/60 z-30"
                    onClick={sidebarState.closeMobile}
                  />
                )}
              </AnimatePresence>

              {/* Main content — no margin on mobile, sidebar-width margin on desktop */}
              <motion.div
                animate={{
                  marginLeft: sidebarState.isMobile ? 0 : (sidebarState.collapsed ? 72 : 220),
                }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden"
              >
                <Topbar user={authUser || undefined} />

                {/* Each page manages its own padding and scroll */}
                <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <ErrorBoundary>
                    <div className="flex-1 min-h-0 flex flex-col">
                      {(() => {
                        const compatibility = checkRoutePlatformCompatibility(
                          location.pathname,
                          currentPlatform?.platform_code,
                          currentPlatform?.capabilities,
                          currentPlatform?.platform_name
                        )
                        if (!isBrandViewer && !compatibility.supported) {
                          return (
                            <PlatformMismatchNotice
                              compatibility={compatibility}
                              currentPlatformName={currentPlatform?.platform_name}
                              onSwitchPlatform={(code) => setPlatformCode(code)}
                              onGoToDashboard={() => navigate(compatibility.redirectUrl, { replace: true })}
                            />
                          )
                        }
                        return <Outlet />
                      })()}
                    </div>
                  </ErrorBoundary>
                </main>
                <Footer />
              </motion.div>
            </div>
          )}
        </AiOpsSessionProvider>
      </SidebarContext.Provider>
    </AuthContext.Provider>
  )
}