import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, LayoutDashboard } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'

interface SystemBranchSwitcherProps {
  collapsed?: boolean
  className?: string
}

export function SystemBranchSwitcher({ collapsed = false, className }: SystemBranchSwitcherProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { canAccessAiOps } = useAuth()

  const isAiOps = location.pathname.startsWith('/ai-ops')

  // 无权访问 AI 运营系统的角色（如主播、中控、客服）不显示切换按钮
  if (!canAccessAiOps) {
    if (collapsed) return null
    return (
      <div className={cn("px-3 py-2", className)}>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-400 text-xs">
          <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium truncate">主页</span>
        </div>
      </div>
    )
  }

  const handleSwitch = (targetBranch: 'classic' | 'ai-ops') => {
    if (targetBranch === 'ai-ops') {
      if (!isAiOps) {
        navigate('/ai-ops/cockpit')
      }
    } else {
      if (isAiOps) {
        navigate('/overview/home')
      }
    }
  }

  if (collapsed) {
    return (
      <div className={cn("flex flex-col items-center gap-1.5 py-2", className)}>
        <button
          title="切换至：主页"
          onClick={() => handleSwitch('classic')}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
            !isAiOps
              ? "bg-orbit-primary/20 text-orbit-primary-light border border-orbit-primary/40 shadow-sm"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>
        <button
          title="切换至：AI 运营"
          onClick={() => handleSwitch('ai-ops')}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all relative",
            isAiOps
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
              : "text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10"
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        </button>
      </div>
    )
  }

  return (
    <div className={cn("px-3 py-2", className)}>
      <div className="p-1 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md grid grid-cols-2 gap-1 shadow-inner">
        <button
          onClick={() => handleSwitch('classic')}
          className={cn(
            "flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
            !isAiOps
              ? "bg-orbit-primary/20 text-orbit-primary-light border border-orbit-primary/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          )}
        >
          <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" />
          <span>主页</span>
        </button>

        <button
          onClick={() => handleSwitch('ai-ops')}
          className={cn(
            "flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 relative whitespace-nowrap",
            isAiOps
              ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
              : "text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-cyan-500/10"
          )}
        >
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
          <span>AI 运营</span>
          <span className="w-1 h-1 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse" />
        </button>
      </div>
    </div>
  )
}
