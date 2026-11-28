import { useEffect, useState } from 'react'
import { PackageSearch, AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '@/services/api'

interface AssortmentCandidate {
  productId: number
  spuCode: string
  skuCode: string
  productName: string
  totalScore: number
  suggestedRole: 'T' | 'B' | 'P'
  reasons: string[]
  metrics: {
    recentSoldCount: number
    recentPayment: number
    availableQty: number
    safetyStock: number
    historicalClickRate: number
  }
}

interface AssortmentResponse {
  candidates: AssortmentCandidate[]
  suggested: {
    traffic: AssortmentCandidate[]
    benefit: AssortmentCandidate[]
    profit: AssortmentCandidate[]
  }
  meta: {
    days: number
    candidateCount: number
    dataSufficiency: {
      hasSales: boolean
      hasInventory: boolean
      hasShortVideo: boolean
      hasClick: boolean
    }
  }
}

const GROUPS: Array<{ key: 'traffic' | 'benefit' | 'profit'; label: string; role: string }> = [
  { key: 'traffic', label: '引流品 (Traffic)', role: 'T' },
  { key: 'benefit', label: '福利品 (Benefit)', role: 'B' },
  { key: 'profit', label: '利润品 (Profit)', role: 'P' },
]

export function AiOpsAssortmentStructurePage() {
  const [data, setData] = useState<AssortmentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<AssortmentResponse>('/assortment/recommend', { days: 30, topN: 5 })
      setData(res)
    } catch (err) {
      setError((err as Error)?.message || '加载货盘结构失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sufficiency = data?.meta?.dataSufficiency
  const insufficient =
    !sufficiency || !sufficiency.hasSales || !sufficiency.hasInventory

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 3 · 货与内容
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">近 {data?.meta.days ?? 30} 天真实成交/库存/短视频/点击</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            货盘结构分析（引流 / 福利 / 利润）
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            基于真实 GMV 销量、库存、短视频引流与点击转化计算，不展示模拟数据。
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-orbit-ink/60 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-orbit-danger/30 bg-orbit-danger/10 px-4 py-3 text-sm text-status-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/40 p-10 text-center text-sm text-[var(--text-muted)]">
          正在计算货盘结构…
        </div>
      )}

      {!loading && (!data || data.candidates.length === 0) && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-orbit-ink/40 backdrop-blur-xl p-10 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orbit-warning/10 border border-orbit-warning/30 flex items-center justify-center">
            <PackageSearch className="w-6 h-6 text-status-warning" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">暂无可计算的货盘数据</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-xl leading-relaxed">
            排品引擎依赖近 30 天真实成交、库存与流量样本。当前样本不足，因此不展示推荐结果，避免误导。
          </p>
        </div>
      )}

      {data && data.candidates.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`px-2 py-0.5 rounded-full border ${
                insufficient
                  ? 'bg-orbit-warning/10 text-status-warning border-orbit-warning/30'
                  : 'bg-orbit-success/10 text-status-success border-orbit-success/30'
              }`}
            >
              {insufficient ? '数据充分性：部分口径缺失' : '数据充分性：达标'}
            </span>
            <span className="text-[var(--text-muted)]">候选商品 {data.meta.candidateCount} 个</span>
            <span className="text-[var(--text-muted)]">
              成交 {sufficiency?.hasSales ? '✓' : '✗'} · 库存 {sufficiency?.hasInventory ? '✓' : '✗'} ·
              短视频 {sufficiency?.hasShortVideo ? '✓' : '✗'} · 点击 {sufficiency?.hasClick ? '✓' : '✗'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GROUPS.map((group) => {
              const items = data.suggested[group.key] || []
              return (
                <div key={group.key} className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="text-sm font-bold text-status-ai">{group.label}</span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">{items.length} 个</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">
                      该角色暂无达到阈值的商品
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {items.map((item) => (
                        <div key={`${group.key}-${item.productId}`} className="px-5 py-4 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-white leading-tight">{item.productName}</span>
                            <span className="text-xs font-mono font-bold text-status-ai shrink-0">{item.totalScore.toFixed(1)}</span>
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] font-mono">
                            {item.spuCode || item.skuCode} · 可用库存 {item.metrics.availableQty}
                          </div>
                          {item.reasons.length > 0 && (
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed border-t border-[var(--border)] pt-1.5">
                              {item.reasons[0]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            说明：后端排品引擎当前按 T/B/P 三角色输出；「爆款 / 清库 / 测新」独立口径尚未提供，页面不展示推算值。
          </p>
        </>
      )}
    </div>
  )
}
