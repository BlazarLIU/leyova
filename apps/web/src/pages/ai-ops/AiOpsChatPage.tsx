import { ChatPage } from '@/pages/ai/ChatPage'
import { MessageSquareCode } from 'lucide-react'

export function AiOpsChatPage() {
  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] min-h-screen">
      <div className="px-6 py-3 border-b border-[var(--border)] bg-orbit-ink/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            工作面 1 · 作战台
          </span>
          <span className="text-xs text-[var(--text-secondary)] font-bold flex items-center gap-1.5">
            <MessageSquareCode className="w-4 h-4 text-cyan-400" />
            <span>AI 交互副驾 · 全局 Copilot</span>
          </span>
          <span className="text-xs text-[var(--text-muted)]">(主系统 AI 助手已全面升级迁移至此)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            已注册 27 个指标工具 · 永不发裸 SQL
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <ChatPage />
      </div>
    </div>
  )
}
