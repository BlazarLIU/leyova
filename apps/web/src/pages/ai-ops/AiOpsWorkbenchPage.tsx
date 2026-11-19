import { AnalysisWorkbenchPage } from '@/pages/ai/AnalysisWorkbenchPage'
import { Sparkles } from 'lucide-react'

export function AiOpsWorkbenchPage() {
  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] min-h-screen">
      <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            工作面 1 · 作战台
          </span>
          <span className="text-xs text-slate-300 font-bold">经营诊断分析工作台</span>
          <span className="text-xs text-slate-500">(主系统 AI 诊断核心引擎同源驱动)</span>
        </div>
        <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>实时连通主系统数据</span>
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <AnalysisWorkbenchPage />
      </div>
    </div>
  )
}
