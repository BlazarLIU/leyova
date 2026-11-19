import { useState } from 'react'

export function AiOpsCasesPage() {
  const [cases] = useState([
    { id: 'CASE-202611-01', subject: '排品加时草案', domain: 'live', risk: 'R2', state: 'applied', outcome: 'GMV 达成 +2.4w' },
    { id: 'CASE-202611-02', subject: '千川放量计划追加预算', domain: 'ads', risk: 'R3', state: 'pending_review', outcome: '待审批执行' },
    { id: 'CASE-202611-03', subject: '清库品类 SKU-1092 限时降价', domain: 'assortment', risk: 'R3', state: 'approved', outcome: '排期中' },
  ])

  return (
    <div className="flex-1 bg-[#0b0f19] text-slate-100 min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              内核治理 · 统一决策对象
            </span>
            <span className="text-xs text-slate-500 font-mono">Decision Case 状态机</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Decision Case 统一决策对象流
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            一个业务问题从发现、证据采集、诊断、方案、审批、执行到效果度量的唯一承载。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-2xl divide-y divide-slate-800/60">
        {cases.map((c) => (
          <div key={c.id} className="p-5 flex items-center justify-between gap-4 hover:bg-slate-800/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{c.id}</span>
                <span className="text-sm font-bold text-white">{c.subject}</span>
                <span className="text-xs text-cyan-400 font-mono">[{c.domain}]</span>
                <span className="text-xs text-amber-400 font-mono">风险: {c.risk}</span>
              </div>
              <p className="text-xs text-slate-400">状态：<strong className="text-slate-200 font-mono">{c.state}</strong> · 结果：{c.outcome}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              证据链完整
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
