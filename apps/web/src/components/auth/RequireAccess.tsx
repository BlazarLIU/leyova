import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react'
import { useAuth, getDefaultHomePath } from '@/hooks/useAuth'

interface RequireAccessProps {
  children: React.ReactNode
  /** Required single module code in role_modules (unless super_admin) */
  module?: string
  /** Optional list where holding any module satisfies module access */
  anyModules?: string[]
  /** Optional explicit role allowlist (super_admin always allowed) */
  roles?: string[]
  /** Set true on routes accessible to brand_viewer accounts */
  allowBrandViewer?: boolean
}

/**
 * Route-level fail-closed RBAC guard.
 * Prevents mounting unauthorized page components when navigating directly via URL.
 */
export function RequireAccess({
  children,
  module,
  anyModules,
  roles,
  allowBrandViewer = false,
}: RequireAccessProps) {
  const { user, allowedModules, loading, isBrandViewer, isSuperAdmin, hasModule, hasAnyModule, hasRole } = useAuth()
  const navigate = useNavigate()

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Brand viewers are strictly confined to brand-portal routes
  if (isBrandViewer) {
    if (!allowBrandViewer) {
      return <Navigate to="/brand-portal" replace />
    }
    return <>{children}</>
  }

  let authorized = true

  if (!isSuperAdmin) {
    if (roles && roles.length > 0 && !hasRole(roles)) {
      authorized = false
    }
    if (authorized && module && !hasModule(module)) {
      authorized = false
    }
    if (authorized && anyModules && anyModules.length > 0 && !hasAnyModule(anyModules)) {
      authorized = false
    }
    // Fail-closed if route forgot to declare any permission check
    if (!module && (!anyModules || anyModules.length === 0) && (!roles || roles.length === 0)) {
      authorized = false
    }
  }

  if (!authorized) {
    const homePath = getDefaultHomePath(user, allowedModules)
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-orbit-surface/90 p-7 text-center shadow-2xl space-y-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-widest text-rose-400">403 · Forbidden</p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">无权访问此页面</h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              当前账号 <span className="text-[var(--text-secondary)] font-medium">{user.realName || user.username}</span>（角色：<span className="font-mono text-xs text-[var(--text-secondary)]">{user.role}</span>）未获授该功能访问权限。
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-orbit-border text-sm text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回上一页</span>
            </button>
            <button
              onClick={() => navigate(homePath, { replace: true })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orbit-primary hover:bg-orbit-primary/90 text-white text-sm font-medium transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>返回工作台</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

