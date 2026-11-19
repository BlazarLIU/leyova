import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react'
import { useAuth, getDefaultHomePath } from '@/hooks/useAuth'
import { AI_OPS_ROLES, FINANCE_ROLES, isRoleCode } from '@/constants/roles'

interface RequireAiOpsAccessProps {
  children: React.ReactNode
  /**
   * 是否属于财务机密板块（P&L 瀑布、结算对账、汇损等）
   * 组织决策：不设独立财务角色，财务口径对超管、运营总监与 HRBP 开放。
   */
  requireFinance?: boolean
}

/**
 * AI 运营系统专属 Fail-Closed 权限守卫
 * 1. 系统级隔离：仅允许超管、运营、财务、HRBP 访问，其余角色直接拦截
 * 2. 财务级隔离：财务专区仅允许财务人员与超管访问，运营与 HRBP 访问拦截
 */
export function RequireAiOpsAccess({
  children,
  requireFinance = false,
}: RequireAiOpsAccessProps) {
  const { user, loading, allowedModules } = useAuth()
  const navigate = useNavigate()

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0b0f19] min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const role = user.role || ''

  // 1. 系统级准入检查
  const canAccessAiOps = isRoleCode(role) && AI_OPS_ROLES.includes(role)
  if (!canAccessAiOps) {
    const homePath = getDefaultHomePath(user, allowedModules)
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-[#0b0f19] min-h-screen">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-orbit-ink/90 backdrop-blur-xl p-8 text-center shadow-2xl space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/20">
              403 · Access Denied
            </span>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">AI 运营系统访问受限</h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              AI 运营系统仅面向 <span className="text-cyan-400 font-medium">超管、运营、财务、HRBP</span> 开放。当前账号（角色：<span className="font-mono text-[var(--text-secondary)] font-medium">{role}</span>）无权进入该独立工作分支。
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-3">
            <button
              onClick={() => navigate(homePath, { replace: true })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-orbit-primary hover:from-cyan-500 hover:to-orbit-primary text-white text-sm font-medium shadow-lg shadow-cyan-900/30 transition-all"
            >
              <Home className="w-4 h-4" />
              <span>返回经典主系统工作台</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 2. 财务专属板块检查
  if (requireFinance) {
    const canAccessFinance = isRoleCode(role) && FINANCE_ROLES.includes(role)
    if (!canAccessFinance) {
      return (
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 bg-[#0b0f19] min-h-screen">
          <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-orbit-ink/90 backdrop-blur-xl p-8 text-center shadow-2xl space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20">
                403 · Financial Confidential
              </span>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">机密财务板块权限隔离</h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                当前板块涉及敏感经营成本、结算对账与单位经济（P&L）。系统策略明确规定：<strong className="text-amber-400">财务板块严格仅允许财务人员访问</strong>。
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-orbit-ink/80 hover:bg-orbit-ink text-sm text-orbit-snow/80 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>返回上一页</span>
              </button>
              <button
                onClick={() => navigate('/ai-ops/cockpit', { replace: true })}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>前往 AI 作战台</span>
              </button>
            </div>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}
