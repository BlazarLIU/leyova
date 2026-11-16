/**
 * PlatformInsightPage — 平台专属洞察通用渲染页（P9 合并项）
 *
 * 根据当前 URL 路径从 INSIGHT_PAGE_CONFIG 查找配置，
 * 渲染 DedicatedInsightShell。模块权限检查由 App.tsx 的 RequireAccess 统一完成。
 */
import { useMemo } from 'react'
import { findInsightConfig } from './PlatformInsightConfig'
import { DedicatedInsightShell } from '@/components/insights/DedicatedInsightShell'

export function PlatformInsightPage() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const config = useMemo(() => findInsightConfig(pathname), [pathname])

  if (!config) {
    return (
      <div className="p-6 text-sm text-slate-400">
        未找到页面配置（路径：{pathname}）。请检查 INSIGHT_PAGE_CONFIG。
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