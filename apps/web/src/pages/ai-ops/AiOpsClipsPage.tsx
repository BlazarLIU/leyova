import { useState } from 'react'
import { ShieldCheck, AlertCircle } from 'lucide-react'

export function AiOpsClipsPage() {
  const [clips] = useState([
    { id: 'CLIP-01', sourceRun: '11-15 晚间大爆场', start: '18:40', end: '19:50', hook: '价格对比逼单段', ctr: '4.8%', authorized: true, status: 'ready_to_publish' },
    { id: 'CLIP-02', sourceRun: '11-15 晚间大爆场', start: '20:15', end: '21:30', hook: '水乳质地手部实测', ctr: '5.2%', authorized: true, status: 'published' },
    { id: 'CLIP-03', sourceRun: '11-14 达人场', start: '22:10', end: '23:00', hook: '达人连麦互动段', ctr: '3.1%', authorized: false, status: 'blocked_no_auth' },
  ])

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              工作面 3 · 内容与切片
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">内容 Agent 驱动</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            切片队列与授权分发
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            高光切片自动截取、违禁词零漏检扫描与授权校验。无授权切片 100% 阻断入库。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden shadow-2xl divide-y divide-[var(--border)]">
        {clips.map((clip) => (
          <div key={clip.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-orbit-ink/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80">{clip.id}</span>
                <span className="text-sm font-bold text-white">{clip.hook}</span>
                <span className="text-xs text-[var(--text-muted)] font-mono">来源：{clip.sourceRun} ({clip.start}~{clip.end})</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">历史高光点击率预估：<strong className="text-emerald-400 font-mono">{clip.ctr}</strong></p>
            </div>

            <div className="flex items-center gap-3">
              {clip.authorized ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>授权有效</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>无授权阻断</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
