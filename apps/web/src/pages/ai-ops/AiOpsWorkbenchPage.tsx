import { AnalysisWorkbenchPage } from '@/pages/ai/AnalysisWorkbenchPage'
import { Sparkles } from 'lucide-react'

export function AiOpsWorkbenchPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-orbit-bg h-full">
      <div className="px-6 py-3 border-b border-[var(--border)] bg-orbit-ink/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
            工作面 1 · 作战台
          </span>
          <span className="text-xs text-[var(--text-secondary)] font-bold">经营诊断分析工作台</span>
          <span className="text-xs text-[var(--text-muted)]">(主系统 AI 诊断核心引擎同源驱动)</span>
        </div>
        <span className="text-xs text-status-success font-mono flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>实时连通主系统数据</span>
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnalysisWorkbenchPage />
      </div>
    </div>
  )
}
