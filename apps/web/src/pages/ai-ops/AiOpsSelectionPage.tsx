import { useState } from 'react'
import { SelectionPage } from '@/pages/ai/SelectionPage'
import { SelectionHistoryPage } from '@/pages/ai/SelectionHistoryPage'
import { History, ShoppingBag } from 'lucide-react'
import { cn } from '@/utils/cn'

export function AiOpsSelectionPage() {
  const [subTab, setSubTab] = useState<'selection' | 'history'>('selection')

  return (
    <div className="flex-1 flex flex-col bg-orbit-bg min-h-screen">
      <div className="px-6 py-3 border-b border-[var(--border)] bg-orbit-ink/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
            工作面 3 · 货与内容
          </span>
          <span className="text-sm text-[var(--text-secondary)] font-bold flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-status-ai" />
            <span>AI 全品类选品与智能提案</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('selection')}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
              subTab === 'selection'
                ? "bg-orbit-success/20 text-status-ai border border-orbit-success/40"
                : "text-[var(--text-muted)] hover:text-white"
            )}
          >
            选品提案工作台
          </button>
          <button
            onClick={() => setSubTab('history')}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
              subTab === 'history'
                ? "bg-orbit-success/20 text-status-ai border border-orbit-success/40"
                : "text-[var(--text-muted)] hover:text-white"
            )}
          >
            <History className="w-3.5 h-3.5" />
            <span>历史生成归档</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {subTab === 'selection' ? <SelectionPage /> : <SelectionHistoryPage />}
      </div>
    </div>
  )
}
