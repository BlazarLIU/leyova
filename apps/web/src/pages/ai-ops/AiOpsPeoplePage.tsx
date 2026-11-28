import { useState, useEffect } from 'react'
import { Award } from 'lucide-react'
import { fetchAnchorPerformanceList, type AnchorPerformanceItem } from '@/services/ai-ops-data'

export function AiOpsPeoplePage() {
  const [anchors, setAnchors] = useState<AnchorPerformanceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnchorPerformanceList().then((res) => {
      setAnchors(res)
      setLoading(false)
    })
  }, [])

  const withHours = anchors.filter((a) => a.liveHours != null)
  const withProfit = anchors.filter((a) => a.netProfitContribution != null)
  const withGpm = anchors.filter((a) => a.gpm != null)

  const avgHours = withHours.length > 0
    ? (withHours.reduce((a, b) => a + (b.liveHours as number), 0) / withHours.length).toFixed(1)
    : '—'
  const avgProfit = withProfit.length > 0
    ? (withProfit.reduce((a, b) => a + (b.netProfitContribution as number), 0) / withProfit.length / 10000).toFixed(2)
    : '—'
  const avgGpm = withGpm.length > 0
    ? Math.round(withGpm.reduce((a, b) => a + (b.gpm as number), 0) / withGpm.length)
    : null

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 4 · 人效看板
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">HRBP / 运营 / 超管可见</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            人效与单场净利贡献看板
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            以人均场次、坑产千次 GPM、单场经营净利为核算锚点。提成基数支持支付/结算/毛利多口径切换。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">平均在播时长 (周均)</p>
          <p className="text-2xl font-bold font-mono text-status-ai mt-1">{avgHours} 小时</p>
        </div>
        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">主播人均贡献净利</p>
          <p className="text-2xl font-bold font-mono text-status-success mt-1">{avgProfit === '—' ? '—' : `¥${avgProfit} 万元`}</p>
        </div>
        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">团队综合 GPM 中位数</p>
          <p className="text-2xl font-bold font-mono text-[var(--text-secondary)] mt-1">{avgGpm != null ? `¥${avgGpm.toLocaleString()}` : '—'}</p>
        </div>
        <div className="p-4 rounded-2xl bg-orbit-ink/60 border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">在册主播人数</p>
          <p className="text-2xl font-bold font-mono text-status-success mt-1">{anchors.length} 位</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-status-ai" />
            <h3 className="text-sm font-bold text-white">主播人效与净利润贡献排行</h3>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono">共 {anchors.length} 位主播带货档案</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-status-ai">
            <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
          </div>
        ) : anchors.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">暂无主播人效数据</div>
        ) : (
          <div className="divide-y divide-[var(--border)] max-h-[600px] overflow-y-auto">
            {anchors.map((anchor, i) => (
              <div key={anchor.id || anchor.name} className="p-5 flex items-center justify-between gap-4 hover:bg-orbit-ink/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orbit-success to-orbit-primary flex items-center justify-center font-bold text-xs text-white">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{anchor.name}</p>
                      <span className="text-xs text-[var(--text-muted)]">({anchor.role})</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      月度直播时长: <span className="font-mono text-[var(--text-secondary)]">{anchor.liveHours != null ? `${anchor.liveHours}h` : '—'}</span> ·
                      千次千川 GPM: <span className="font-mono text-status-ai">{anchor.gpm != null ? `¥${anchor.gpm}` : '—'}</span> ·
                      综合画像评分: <span className="font-mono text-status-success">{anchor.score != null ? `${anchor.score}分` : '—'}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-[var(--text-muted)] block">贡献经营净利</span>
                  <span className="text-base font-extrabold font-mono text-status-success">{anchor.netProfitContribution != null ? `+¥${anchor.netProfitContribution.toLocaleString()}` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
