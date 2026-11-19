/**
 * PlatformInsightPage — 平台专属洞察通用渲染页（P9 合并项）
 *
 * 根据当前 URL 路径从 INSIGHT_PAGE_CONFIG 查找配置，
 * 渲染 DedicatedInsightShell。模块权限检查由 App.tsx 的 RequireAccess 统一完成。
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { findInsightConfig } from './PlatformInsightConfig'
import { DedicatedInsightShell } from '@/components/insights/DedicatedInsightShell'

export function PlatformInsightPage() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const navigate = useNavigate()
  const config = useMemo(() => findInsightConfig(pathname), [pathname])

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full rounded-2xl border border-orbit-border bg-orbit-surface p-8 text-center space-y-3">
          <Compass className="w-10 h-10 mx-auto text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-200">该洞察页暂不可用</h2>
          <p className="text-sm text-slate-400">页面入口可能已调整，请从左侧菜单重新进入。</p>
          <button
            onClick={() => navigate('/overview')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orbit-primary text-white text-sm"
          >
            返回经营总览
          </button>
        </div>
      </div>
    )
  }

  return (
    <DedicatedInsightShell
      title={config.title}
      subtitle={config.subtitle}
      icon={config.icon}
      endpoint={config.endpoint}
      withRange={config.withRange}
    />
  )
}

export default PlatformInsightPage