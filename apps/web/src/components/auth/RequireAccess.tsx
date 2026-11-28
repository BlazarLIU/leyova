import React, { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, Home, Send } from 'lucide-react'
import { useAuth, getDefaultHomePath } from '@/hooks/useAuth'
import { api } from '@/services/api'

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
  const location = useLocation()
  const [requestState, setRequestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const applyForAccess = async () => {
    if (!module) return
    setRequestState('sending')
    try {
      await api.post('/permission-requests', {
        moduleCode: module,
        reason: `访问受限页面 ${location.pathname} 时申请`,
      })
      setRequestState('sent')
    } catch {
      setRequestState('error')
    }
  }

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
        <div className="max-w-md w-full rounded-2xl border border-orbit-danger/30 bg-orbit-surface/90 p-7 text-center shadow-2xl space-y-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-orbit-danger/15 border border-orbit-danger/30 flex items-center justify-center text-status-danger">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-widest text-status-danger">403 · Forbidden</p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">无权访问此页面</h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              当前账号 <span className="text-[var(--text-secondary)] font-medium">{user.realName || user.username}</span>（角色：<span className="font-mono text-xs text-[var(--text-secondary)]">{user.role}</span>）未获授该功能访问权限。
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-orbit-border text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
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

          {module && (
            <div className="pt-1">
              {requestState === 'sent' ? (
                <p className="text-xs text-status-success">申请已提交，等待管理员审批。</p>
              ) : (
                <button
                  onClick={applyForAccess}
                  disabled={requestState === 'sending'}
                  className="inline-flex items-center gap-1.5 text-xs text-orbit-primary hover:text-orbit-primary-light disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {requestState === 'sending' ? '提交中…' : `申请「${module}」模块权限`}
                </button>
              )}
              {requestState === 'error' && (
                <p className="text-xs text-status-danger mt-1">提交失败，可能已有待审申请。</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}

