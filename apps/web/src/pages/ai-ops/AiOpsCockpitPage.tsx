import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Flame,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { fetchTodayBattleData, type TodayBattleData } from '@/services/ai-ops-data'

export function AiOpsCockpitPage() {
  const [data, setData] = useState<TodayBattleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'executed'>('pending')
  const [decidedCases, setDecidedCases] = useState<Record<string, 'approved' | 'rejected'>>({})

  useEffect(() => {
    fetchTodayBattleData().then((res) => {
      setData(res)
      setLoading(false)
    })
  }, [])

  const handleDecision = (id: string, decision: 'approved' | 'rejected') => {
    setDecidedCases(prev => ({ ...prev, [id]: decision }))
  }

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-[#0b0f19] min-h-screen text-cyan-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-mono tracking-wider">AI 运营引擎载入实时经营数据中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-[#0b0f19] text-slate-100 min-h-screen overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* 顶部标题栏 & 核心哲学 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30">
              工作面 1 · 作战台
            </span>
            <span className="text-xs text-slate-500 font-mono">{data.date} 日循环</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            今日经营作战单
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
              AI 默认执行 · 人管例外
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            第一性问题：<span className="text-slate-200 font-medium">今天这场怎么打</span>。AI 持续观察经营、诊断问题、产出可执行决策草案供您拍板。
          </p>
        </div>

        {/* 顶部指标速览 */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
            <p className="text-xs text-slate-400">今日目标支付 GMV</p>
            <p className="text-lg font-bold font-mono text-cyan-400">¥{(data.targetGmv / 10000).toFixed(1)}万</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
            <p className="text-xs text-slate-400">AI 预测达成 (MAPE 8%)</p>
            <p className="text-lg font-bold font-mono text-emerald-400">¥{(data.predictedGmv / 10000).toFixed(1)}万</p>
          </div>
        </div>
      </div>

      {/* 核心分栏布局：左侧待拍板/已执行，右侧今日场次与排品直通车 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：AI 决策中心 (8 列) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Tab 切换 */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
                  activeTab === 'pending'
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Flame className="w-4 h-4 text-amber-400" />
                <span>待我拍板决策 (L3/R3)</span>
                <span className="px-1.5 py-0.2 rounded-full text-xs bg-amber-500/20 text-amber-300 font-mono">
                  {data.pendingDecisionCases.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('executed')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
                  activeTab === 'executed'
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>AI 今日替你做了什么 (L1/L2)</span>
                <span className="px-1.5 py-0.2 rounded-full text-xs bg-slate-800 text-slate-400 font-mono">
                  {data.aiActionsExecutedToday.length}
                </span>
              </button>
            </div>
          </div>

          {/* 选项卡内容：待拍板决策 */}
          {activeTab === 'pending' ? (
            <div className="space-y-4">
              {data.pendingDecisionCases.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-500">
                  暂无待拍板的 AI 决策案
                </div>
              )}
              {data.pendingDecisionCases.map((caseItem) => {
                const decided = decidedCases[caseItem.id]
                return (
                  <motion.div
                    key={caseItem.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-2xl border p-5 backdrop-blur-xl transition-all shadow-xl",
                      decided === 'approved'
                        ? "border-emerald-500/40 bg-emerald-950/20"
                        : decided === 'rejected'
                          ? "border-slate-700/50 bg-slate-900/40 opacity-60"
                          : "border-cyan-500/20 bg-slate-900/70 hover:border-cyan-500/40"
                    )}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {caseItem.id}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            caseItem.proposal.risk === 'R3' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          )}>
                            风险级别 {caseItem.proposal.risk}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">置信度 {(caseItem.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <h3 className="text-base font-bold text-white tracking-wide">{caseItem.subject}</h3>
                      </div>

                      {/* 拍板按钮组 */}
                      {!decided ? (
                        <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                          <button
                            onClick={() => handleDecision(caseItem.id, 'rejected')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 text-xs text-slate-300 hover:text-rose-300 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>驳回</span>
                          </button>
                          <button
                            onClick={() => handleDecision(caseItem.id, 'approved')}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-xs font-semibold text-white shadow-md shadow-cyan-900/30 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>采纳并执行</span>
                          </button>
                        </div>
                      ) : (
                        <div className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          decided === 'approved' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
                        )}>
                          {decided === 'approved' ? '已采纳 · 动作已入库执行' : '已驳回'}
                        </div>
                      )}
                    </div>

                    {/* 问题与诊断 */}
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3 space-y-1.5">
                      <p className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        <span>核心问题：{caseItem.question}</span>
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed pl-5">
                        <strong className="text-slate-400">AI 诊断：</strong>{caseItem.diagnosis}
                      </p>
                    </div>

                    {/* 建议动作与收益预估 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 text-xs mb-3">
                      <div>
                        <span className="text-slate-500 block">候选提案</span>
                        <span className="text-slate-200 font-medium">{caseItem.proposal.action}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">预期增量</span>
                        <span className="text-emerald-400 font-mono font-medium">{caseItem.proposal.expectedGain}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">成本 / 影响</span>
                        <span className="text-amber-400 font-medium">{caseItem.proposal.cost}</span>
                      </div>
                    </div>

                    {/* 事实证据链 (Critic Verified Evidence Packet) */}
                    <div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mb-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Critic 数字复算证据链 (三口径已对齐，不可篡改)：</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {caseItem.evidence.map((ev, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950 border border-cyan-500/20 text-xs font-mono"
                          >
                            <span className="text-slate-400">{ev.metric}</span>
                            <span className="text-cyan-300 font-bold">{ev.value}</span>
                            <span className="text-[10px] text-slate-600 border-l border-slate-800 pl-1.5">{ev.caliber}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            /* 已自动执行清单 */
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-5 divide-y divide-slate-800/60">
              {data.aiActionsExecutedToday.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">今日暂无 AI 自动执行动作</div>
              )}
              {data.aiActionsExecutedToday.map((act) => (
                <div key={act.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                      {act.level}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200">{act.title}</p>
                        <span className="text-xs text-slate-500 font-mono">{act.time}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        类型：<span className="text-slate-300">{act.type}</span> · 效果：<span className="text-emerald-400">{act.impact}</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                    已生效
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：今日场次 & 快捷工作流 (4 列) */}
        <div className="lg:col-span-4 space-y-6">
          {/* 今日 3 场直播追踪 */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>今日作战场次</span>
              </h3>
              <a href="/ai-ops/session/planning" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <span>排品台</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-3">
              {data.todaySessions.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500">今日暂无排期场次</div>
              )}
              {data.todaySessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all",
                    session.status === 'live'
                      ? "border-cyan-500/40 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      : "border-slate-800 bg-slate-950/60"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-300 truncate">{session.title}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      session.status === 'live' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' :
                        session.status === 'ended' ? 'bg-slate-800 text-slate-400' : 'bg-blue-500/20 text-blue-300'
                    )}>
                      {session.status === 'live' ? '● 直播盯盘中' : session.status === 'ended' ? '已下播待复盘' : '待开播'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>主播：{session.anchorName}</span>
                    <span className="font-mono text-cyan-400">目标 ¥{(session.targetGmv / 10000).toFixed(1)}w</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 border-t border-slate-800/60 pt-1.5">
                    <span>{session.timeRange}</span>
                    {session.status === 'ended' ? (
                      <a href="/ai-ops/session/review" className="text-cyan-400 hover:underline flex items-center gap-0.5">
                        <span>生成五段复盘</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    ) : session.status === 'live' ? (
                      <a href="/ai-ops/session/live-watch" className="text-cyan-400 hover:underline flex items-center gap-0.5">
                        <span>进入盯盘驾驶舱</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    ) : (
                      <a href="/ai-ops/session/planning" className="text-slate-400 hover:text-white flex items-center gap-0.5">
                        <span>检查排品表</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6 条反 ERP 质量判据卡片 */}
          <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>AI 运营系统核心原则</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>主语永远是<strong>动作</strong>，绝不把报表单据当主角</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>产出必须是<strong>可执行物</strong>（可入库、可审批）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>下播 30 分钟出复盘，<strong>行动项自动验证效果</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>底层数据 100% 消费主系统真实流水，双向闭环</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
