import { useEffect, useState } from 'react'
import { ChatPage } from '@/pages/ai/ChatPage'
import { MessageSquareCode } from 'lucide-react'
import { fetchAssistantCapabilities } from '@/services/ai-ops-data'

export function AiOpsChatPage() {
  const [capabilities, setCapabilities] = useState<{ tools: number; engine: string; llmAvailable: boolean | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAssistantCapabilities()
      .then((caps) => {
        if (!cancelled) {
          setCapabilities({
            tools: caps.tools.available,
            engine: caps.engine,
            llmAvailable: caps.llm.health ? caps.llm.health.available : null,
          })
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-orbit-bg h-full overflow-hidden">
      <div className="px-6 py-2.5 border-b border-[var(--border)] bg-orbit-ink/60 backdrop-blur-md flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
            工作面 1 · 作战台
          </span>
          <span className="text-xs text-[var(--text-secondary)] font-bold flex items-center gap-1.5">
            <MessageSquareCode className="w-4 h-4 text-status-ai" />
            <span>AI 交互副驾 · 全局 Copilot</span>
          </span>
          <span className="text-xs text-[var(--text-muted)]">(主系统 AI 助手已全面升级迁移至此)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-orbit-success/10 text-status-ai border border-orbit-success/20 font-mono">
            {capabilities
              ? `已注册 ${capabilities.tools} 个可用工具 · 引擎 ${capabilities.engine} · 模型${
                  capabilities.llmAvailable === null ? '未探活' : capabilities.llmAvailable ? '可用' : '不可用'
                } · 永不发裸 SQL`
              : '能力清单加载中…'}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ChatPage />
      </div>
    </div>
  )
}
