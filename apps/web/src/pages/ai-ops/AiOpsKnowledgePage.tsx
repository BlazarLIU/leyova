import { ContentCenterConfigPage } from '@/pages/content/ContentCenterConfigPage'
import { BrainCircuit, ShieldCheck } from 'lucide-react'

export function AiOpsKnowledgePage() {
  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] min-h-screen">
      <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            系统治理 · 内核服务
          </span>
          <span className="text-sm text-slate-200 font-bold flex items-center gap-1.5">
            <BrainCircuit className="w-4 h-4 text-cyan-400" />
            <span>知识库、模型网关与 AI 策略配置</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>无引用结论被 Critic 拒绝机制已启用</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <ContentCenterConfigPage />
      </div>
    </div>
  )
}
