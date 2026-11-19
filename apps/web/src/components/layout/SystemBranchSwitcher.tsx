import { useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, LayoutDashboard } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'

interface SystemBranchSwitcherProps {
  collapsed?: boolean
  className?: string
}

/**
 * 双系统分支切换器（品牌版）
 * 主页 → Orange Red 选中态；AI 运营 → Yellow Punk 选中态（AI 专属色）
 */
export function SystemBranchSwitcher({ collapsed = false, className }: SystemBranchSwitcherProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { canAccessAiOps } = useAuth()

  const isAiOps = location.pathname.startsWith('/ai-ops')

  if (!canAccessAiOps) {
    if (collapsed) return null
    return (
      <div className={cn('px-3 py-2', className)}>
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-muted)]">
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span className="truncate font-medium">主页</span>
        </div>
      </div>
    )
  }

  const handleSwitch = (targetBranch: 'classic' | 'ai-ops') => {
    if (targetBranch === 'ai-ops') {
      if (!isAiOps) navigate('/ai-ops/cockpit')
    } else if (isAiOps) {
      navigate('/overview/home')
    }
  }

  if (collapsed) {
    return (
      <div className={cn('flex flex-col items-center gap-1.5 py-2', className)}>
        <button
          title="切换至：主页"
          onClick={() => handleSwitch('classic')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-[9px] transition-all',
            !isAiOps
              ? 'bg-orbit-primary text-white'
              : 'text-[var(--text-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
        </button>
        <button
          title="切换至：AI 运营"
          onClick={() => handleSwitch('ai-ops')}
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-[9px] transition-all',
            isAiOps
              ? 'bg-orbit-accent text-orbit-ink'
              : 'text-[var(--text-subtle)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
          )}
        >
          <Sparkles className="h-4 w-4" />
          {!isAiOps && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-orbit-accent" />
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={cn('px-3 py-2', className)}>
      <div className="grid grid-cols-2 gap-1 rounded-[11px] border border-[var(--border)] bg-[var(--surface2)] p-1">
        <button
          onClick={() => handleSwitch('classic')}
          className={cn(
            'flex items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-1.5 py-[6px] text-[11px] font-semibold transition-all duration-150',
            !isAiOps
              ? 'bg-orbit-primary text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          <LayoutDashboard className="h-3.5 w-3.5 flex-shrink-0" />
          <span>主页</span>
        </button>

        <button
          onClick={() => handleSwitch('ai-ops')}
          className={cn(
            'relative flex items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-1.5 py-[6px] text-[11px] font-semibold transition-all duration-150',
            isAiOps
              ? 'bg-orbit-accent text-orbit-ink'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
          <span>AI 运营</span>
        </button>
      </div>
    </div>
  )
}
