import { useState } from 'react'

export function AiOpsCampaignsPage() {
  const [campaigns] = useState([
    { id: 'CAMP-881', name: '秋冬服饰大场 · 精准达人拉新', budget: 5000, spend: 3820, payRoi: 3.2, settleRoi: 2.6, status: 'active', advice: '结算 ROI 良好，建议持续放量' },
    { id: 'CAMP-882', name: '美妆防晒福利 · 爆款秒杀承接', budget: 2000, spend: 1840, payRoi: 2.1, settleRoi: 1.5, status: 'warning', advice: '退款率偏高导致结算 ROI 下滑，已触发单次 +30% 预算限额保护' },
    { id: 'CAMP-883', name: '品牌官方主号 · 基础人群破圈', budget: 3000, spend: 950, payRoi: 1.8, settleRoi: 1.4, status: 'active', advice: '处于测试期，按时段平滑消耗' },
  ])

  return (
    <div className="flex-1 bg-[#0b0f19] text-slate-100 min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              工作面 3 · 投放协同
            </span>
            <span className="text-xs text-slate-500 font-mono">投流 Agent + 异常熔断</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            投放协同与熔断中心
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            三种 ROI 必须分列（支付 ROI / 结算 ROI / 综合营销 ROI）。结算未成熟禁盲目加预算，单次预算调整 ≤±30%。
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {campaigns.map((c) => (
          <div key={c.id} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{c.id}</span>
                <span className="text-sm font-bold text-white">{c.name}</span>
              </div>
              <p className="text-xs text-slate-400">
                日预算: <span className="font-mono text-white">¥{c.budget}</span> ·
                当前消耗: <span className="font-mono text-cyan-400">¥{c.spend}</span>
              </p>
              <p className="text-xs text-amber-300/90 pt-1">
                AI 建议：{c.advice}
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block">支付 ROI (T+0)</span>
                <span className="text-cyan-400 font-bold">{c.payRoi}</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-500 block">结算 ROI (T+15)</span>
                <span className="text-amber-400 font-bold">{c.settleRoi}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
