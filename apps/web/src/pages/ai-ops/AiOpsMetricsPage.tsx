import { useState, useEffect } from 'react'
import { api } from '@/services/api'
import { BookOpen, Loader2 } from 'lucide-react'

interface CaliberMetricItem {
  code: string
  name: string
  formula: string
  caliber: string
  maturity: string
  unit: string
}

export function AiOpsMetricsPage() {
  const [metrics, setMetrics] = useState<CaliberMetricItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api
      .get('/caliber/metrics')
      .then((res: any) => {
        if (!mounted) return
        const list = res?.metrics || res?.data || (Array.isArray(res) ? res : [])
        if (Array.isArray(list) && list.length > 0) {
          setMetrics(
            list.map((m: any) => ({
              code: m.code || m.metric_code,
              name: m.name,
              formula: m.formula || m.description || '基础原子聚合指标',
              caliber: m.extra?.caliber || 'v1.0 (统一法定口径)',
              maturity: m.extra?.maturity || (m.category === 'ad' ? 'T+15 (对账成熟)' : 'T+0 (实时更新)'),
              unit: m.unit || '元',
            })),
          )
        } else {
          setMetrics([])
        }
      })
      .catch(() => {
        if (mounted) setMetrics([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              内核治理 · 指标注册表
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              法定注册指标字典 (metric_definition)
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            指标注册表与口径版本字典
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            任何报表、API 与 AI 结论必须带 caliber_version；未注册指标严禁在系统中出现。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-cyan-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-xs font-mono text-[var(--text-muted)]">正在调取系统全局法定口径版本注册表...</p>
        </div>
      ) : metrics.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 p-12 text-center text-orbit-snow/60">
          <BookOpen className="w-10 h-10 text-[var(--text-primary)] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[var(--text-secondary)]">暂无已注册口径定义</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">请在指标元数据配置中注册业务与财务指标口径</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden shadow-2xl divide-y divide-[var(--border)]">
          {metrics.map((m) => (
            <div
              key={m.code}
              className="p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-orbit-ink/20 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400 font-bold text-sm">{m.code}</span>
                  <span className="text-white font-medium text-sm">({m.name})</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/60 font-mono">
                    {m.unit}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-mono">标准计算公式：{m.formula}</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-[var(--text-muted)]">口径：{m.caliber}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {m.maturity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
