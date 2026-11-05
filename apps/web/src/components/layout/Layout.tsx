import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Footer } from './Footer'
import { SidebarContext, useSidebarState } from '@/hooks/useSidebar'
import { api } from '@/services/api'
import { ApiError } from '@/services/api'

export function Layout() {
  const sidebarState = useSidebarState()
  const navigate = useNavigate()
  const [authChecking, setAuthChecking] = useState(true)
  const [authUser, setAuthUser] = useState<any>(null)

  useEffect(() => {
    api.get('/auth/me')
      .then((res: any) => {
        if (res?.user?.role) {
          setAuthUser(res.user)
        } else {
          navigate('/sign-in', { replace: true })
        }
      })
      .catch((err: ApiError) => {
        // 只有 401（未登录/会话过期）才跳转登录页
        if (err.status === 401) {
          navigate('/sign-in', { replace: true })
        }
        // 其他错误（网络中断、500 等）不做跳转，保持当前页面
      })
      .finally(() => setAuthChecking(false))
  }, [navigate])

  return (
    <SidebarContext.Provider value={sidebarState}>
      {authChecking ? (
        <div className="flex h-screen bg-orbit-bg items-center justify-center">
          <div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex h-screen bg-orbit-bg overflow-hidden">
          <div className="orbit-glow-bg" />

          <Sidebar user={authUser} />

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
              marginLeft: sidebarState.isMobile ? 0 : (sidebarState.collapsed ? 72 : 200),
            }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden"
          >
            <Topbar user={authUser} />

            {/* Each page manages its own padding and scroll */}
            <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <ErrorBoundary>
                <div className="flex-1 min-h-0 flex flex-col">
                  <Outlet />
                </div>
              </ErrorBoundary>
            </main>
              <Footer />
          </motion.div>
        </div>
      )}
    </SidebarContext.Provider>
  )
}