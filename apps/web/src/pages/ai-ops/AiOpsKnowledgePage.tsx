import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ContentCenterConfigPage } from '@/pages/content/ContentCenterConfigPage'
import { KnowledgePlatformSection } from './KnowledgePlatformSection'
import { BrainCircuit, ShieldCheck, Database, Server, Radio, Bot } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type Tab = 'platform' | 'external'

const TABS: Array<{ key: Tab; label: string; icon: typeof Database }> = [
  { key: 'platform', label: '本地知识平台', icon: Database },
  { key: 'external', label: '外部知识库', icon: Server },
]

export function AiOpsKnowledgePage() {
  const [tab, setTab] = useState<Tab>('platform')
  const { featureScope, user } = useAuth()
  // 「外部知识库」依赖 /content 模块，core 部署下该路由未注册，直接隐藏避免 404
  const availableTabs = TABS.filter((item) => item.key !== 'external' || featureScope === 'full')

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-orbit-bg h-full">
      <div className="px-6 py-3 border-b border-[var(--border)] bg-orbit-ink/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
            系统治理 · 内核服务
          </span>
          <span className="text-sm text-[var(--text-secondary)] font-bold flex items-center gap-1.5">
            <BrainCircuit className="w-4 h-4 text-status-ai" />
            <span>本地知识库、文档索引与违禁词合规中心</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {user?.role === 'super_admin' && (
            <Link
              to="/system/config?tab=ai"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:border-orbit-primary/50 hover:text-[var(--text-primary)] transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-status-ai" />
              <span>AI 模型与向量配置</span>
            </Link>
          )}
          <Link
            to="/compliance/radar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:border-orbit-primary/50 hover:text-[var(--text-primary)] transition-colors"
          >
            <Radio className="w-3.5 h-3.5 text-orbit-primary" />
            <span>查看平台合规风控雷达</span>
          </Link>
          <span className="hidden md:inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-status-success" />
            <span>无引用结论被 Critic 拒绝机制已启用</span>
          </span>
        </div>
      </div>

      <div className="px-6 pt-3 flex items-center gap-1 border-b border-[var(--border)]">
        {availableTabs.map((item) => {
          const Icon = item.icon
          const active = tab === item.key
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg border-b-2 transition-colors ${
                active
                  ? 'border-status-ai text-[var(--text-primary)] bg-orbit-surface2/60'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {tab === 'external' && featureScope === 'full' ? <ContentCenterConfigPage mode="knowledge" /> : <KnowledgePlatformSection />}
      </div>
    </div>
  )
}