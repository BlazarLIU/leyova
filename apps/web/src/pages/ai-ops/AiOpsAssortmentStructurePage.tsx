export function AiOpsAssortmentStructurePage() {
  const structure = [
    { type: '主推款 (Hero)', ratio: '45%', gmvShare: '62%', advice: '结构健康，贡献稳定现金流' },
    { type: '引流款 (Traffic)', ratio: '25%', gmvShare: '12%', advice: '转化率 5.4%，成功拉动开场 UV' },
    { type: '清库款 (Clearance)', ratio: '18%', gmvShare: '15%', advice: '库存超期 SKU 占比偏高，建议加大第二轮出清力度' },
    { type: '测新款 (New Test)', ratio: '12%', gmvShare: '11%', advice: '2 款秋冬新品加购率达标，具备打造成下一期爆款潜力' },
  ]

  return (
    <div className="flex-1 bg-[#0b0f19] text-slate-100 min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              工作面 3 · 货与内容
            </span>
            <span className="text-xs text-slate-500 font-mono">周循环视图 · 货盘健康度</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            货盘结构分析（主推 / 清库 / 测新配比）
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            监控全周商品盘结构，防止爆款单腿跳与库存积压死重。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {structure.map((s) => (
          <div key={s.type} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-2">
            <span className="text-xs font-bold text-cyan-300">{s.type}</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-white">{s.ratio}</span>
              <span className="text-xs font-mono text-slate-400">GMV 贡献: {s.gmvShare}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
              {s.advice}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
