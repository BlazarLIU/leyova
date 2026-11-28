import { useState } from 'react'
import { UserRound, BarChart3 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { AnchorProfilePage } from './AnchorProfilePage'
import { CapabilitiesPage } from '@/pages/ops/CapabilitiesPage'

export function AnchorCenterPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'capabilities'>('profile')

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
      {/* 顶部标签切换栏 */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-6 pt-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors',
              activeTab === 'profile'
                ? 'border-orbit-primary text-orbit-primary'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <UserRound className="h-4 w-4" />
            <span>档案详情</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('capabilities')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors',
              activeTab === 'capabilities'
                ? 'border-orbit-primary text-orbit-primary'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            <BarChart3 className="h-4 w-4" />
            <span>能力看板</span>
          </button>
        </div>
      </div>

      {/* 内容区：保证子页面内部正常滚动 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {activeTab === 'profile' ? <AnchorProfilePage /> : <CapabilitiesPage />}
      </div>
    </div>
  )
}
