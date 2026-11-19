import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Flame,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
      <div className="flex min-h-screen flex-1 items-center justify-center bg-orbit-bg p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orbit-primary border-t-transparent" />
          <p className="text-[12.5px] font-medium tracking-wide text-[var(--text-muted)]">
            AI 运营引擎载入实时经营数据中...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen space-y-6 overflow-y-auto bg-orbit-bg p-6 text-[var(--text-primary)] lg:p-8">
      {/* ── 顶部标题栏 ── */}
      <div className="flex flex-col justify-between gap-5 border-b border-orbit-border pb-5 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-orbit-accent-deep/40 bg-orbit-accent/35 px-2 py-0.5 text-[10.5px] font-bold tracking-[0.04em] text-[#14532D] dark:bg-orbit-accent/15 dark:text-orbit-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-orbit-accent-deep" />
              工作面 1 · 作战台
            </span>
            <span className="font-mono text-[11px] text-[var(--text-subtle)]">{data.date} 日循环</span>
          </div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-[26px] font-extrabold leading-none tracking-[-0.04em]">
            今日经营作战单
            <Badge variant="accent">AI 默认执行 · 人管例外</Badge>
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            第一性问题：<span className="font-semibold text-[var(--text-primary)]">今天这场怎么打</span>。AI
            持续观察经营、诊断问题、产出可执行决策草案供您拍板。
          </p>
        </div>

        {/* 顶部指标速览 */}
        <div className="flex items-stretch gap-2.5">
          <div className="min-w-[150px] rounded-[10px] border border-orbit-border bg-orbit-surface px-4 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
              今日目标支付 GMV
            </p>
            <p className="metric-num mt-0.5 text-[20px] font-extrabold leading-tight text-orbit-primary">
              ¥{(data.targetGmv / 10000).toFixed(1)}万
            </p>
          </div>
          <div className="min-w-[150px] rounded-[10px] border border-orbit-border bg-orbit-surface px-4 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
              AI 预测达成 (MAPE 8%)
            </p>
            <p className="metric-num mt-0.5 text-[20px] font-extrabold leading-tight text-[#15803D] dark:text-orbit-accent">
              ¥{(data.predictedGmv / 10000).toFixed(1)}万
            </p>
          </div>
        </div>
      </div>

      {/* ── 核心分栏 ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 左侧：AI 决策中心 */}
        <div className="space-y-5 lg:col-span-8">
          {/* Tab 切换 */}
          <div className="flex items-center gap-1.5 rounded-[9px] border border-orbit-border bg-orbit-surface2 p-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-[7px] px-3.5 py-2 text-[12.5px] font-semibold transition-all sm:flex-none',
                activeTab === 'pending'
                  ? 'bg-orbit-ink text-orbit-snow shadow-[0_1px_2px_rgba(23,23,23,0.14)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <Flame className={cn('h-3.5 w-3.5', activeTab === 'pending' ? 'text-orbit-primary-light' : 'text-orbit-primary')} />
              <span>待我拍板决策 (L3/R3)</span>
              <span
                className={cn(
                  'rounded-[3px] px-1.5 py-px font-mono text-[10.5px]',
                  activeTab === 'pending' ? 'bg-white/15 text-orbit-snow' : 'bg-orbit-primary/10 text-orbit-primary'
                )}
              >
                {data.pendingDecisionCases.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('executed')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-[7px] px-3.5 py-2 text-[12.5px] font-semibold transition-all sm:flex-none',
                activeTab === 'executed'
                  ? 'bg-orbit-ink text-orbit-snow shadow-[0_1px_2px_rgba(23,23,23,0.14)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <CheckCircle2 className={cn('h-3.5 w-3.5', activeTab === 'executed' ? 'text-orbit-accent' : 'text-[#15803D] dark:text-orbit-accent')} />
              <span>AI 今日替你做了什么 (L1/L2)</span>
              <span
                className={cn(
                  'rounded-[3px] px-1.5 py-px font-mono text-[10.5px]',
                  activeTab === 'executed' ? 'bg-white/15 text-orbit-snow' : 'bg-[var(--text-subtle)]/10 text-[var(--text-muted)]'
                )}
              >
                {data.aiActionsExecutedToday.length}
              </span>
            </button>
          </div>

          {/* 待拍板决策 */}
          {activeTab === 'pending' ? (
            <div className="space-y-3.5">
              {data.pendingDecisionCases.length === 0 && (
                <div className="rounded-xl border border-orbit-border bg-orbit-surface p-10 text-center text-[12.5px] text-[var(--text-muted)]">
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
                      'relative overflow-hidden rounded-xl border p-5 transition-all',
                      decided === 'approved'
                        ? 'border-orbit-accent-deep/40 bg-orbit-accent/[0.07]'
                        : decided === 'rejected'
                          ? 'border-orbit-border bg-orbit-surface2/60 opacity-60'
                          : 'border-orbit-border bg-orbit-surface hover:border-orbit-border2'
                    )}
                  >
                    {/* 左侧状态条：待处理橙红 / 已采纳荧光绿 */}
                    <span
                      className={cn(
                        'absolute inset-y-0 left-0 w-[3px]',
                        decided === 'approved'
                          ? 'bg-orbit-accent-deep'
                          : decided === 'rejected'
                            ? 'bg-[var(--text-subtle)]'
                            : 'bg-orbit-primary'
                      )}
                    />

                    <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-[3px] border border-orbit-border bg-orbit-surface3 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                            {caseItem.id}
                          </span>
                          <Badge variant={caseItem.proposal.risk === 'R3' ? 'warning' : 'neutral'}>
                            风险级别 {caseItem.proposal.risk}
                          </Badge>
                          <span className="font-mono text-[11px] text-[var(--text-subtle)]">
                            置信度 {(caseItem.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <h3 className="truncate text-[15px] font-bold tracking-tight">{caseItem.subject}</h3>
                      </div>

                      {!decided ? (
                        <div className="flex flex-shrink-0 items-center gap-2 self-end md:self-auto">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDecision(caseItem.id, 'rejected')}
                          >
                            <X className="h-3.5 w-3.5" />
                            驳回
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleDecision(caseItem.id, 'approved')}
                          >
                            <Check className="h-3.5 w-3.5" />
                            采纳并执行
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={decided === 'approved' ? 'accent' : 'neutral'} dot className="self-end md:self-auto">
                          {decided === 'approved' ? '已采纳 · 动作已入库执行' : '已驳回'}
                        </Badge>
                      )}
                    </div>

                    {/* AI 诊断（荧光绿语言） */}
                    <div className="mb-3 space-y-1.5 rounded-lg border-l-2 border-orbit-accent-deep bg-orbit-accent/[0.08] p-3.5">
                      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#15803D] dark:text-orbit-accent">
                        <span className="h-1.5 w-1.5 rounded-full bg-orbit-accent-deep" />
                        核心问题：{caseItem.question}
                      </p>
                      <p className="pl-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                        <strong className="font-semibold text-[var(--text-muted)]">AI 诊断：</strong>
                        {caseItem.diagnosis}
                      </p>
                    </div>

                    {/* 建议动作与收益预估 */}
                    <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-orbit-border bg-orbit-surface2 p-3 text-[12px] sm:grid-cols-3">
                      <div>
                        <span className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                          候选提案
                        </span>
                        <span className="mt-0.5 block font-medium">{caseItem.proposal.action}</span>
                      </div>
                      <div>
                        <span className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                          预期增量
                        </span>
                        <span className="metric-num mt-0.5 block font-bold text-[#15803D] dark:text-orbit-accent">
                          {caseItem.proposal.expectedGain}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                          成本 / 影响
                        </span>
                        <span className="metric-num mt-0.5 block font-medium text-[#A16207] dark:text-orbit-warning">
                          {caseItem.proposal.cost}
                        </span>
                      </div>
                    </div>

                    {/* 证据链 */}
                    <div>
                      <div className="mb-1.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-subtle)]">
                        <ShieldCheck className="h-3.5 w-3.5 text-orbit-primary" />
                        <span>Critic 数字复算证据链（三口径已对齐，不可篡改）</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {caseItem.evidence.map((ev, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-2 rounded-[5px] border border-orbit-border bg-orbit-surface px-2 py-1 font-mono text-[11px]"
                          >
                            <span className="text-[var(--text-muted)]">{ev.metric}</span>
                            <span className="font-bold text-[var(--text-primary)]">{ev.value}</span>
                            <span className="border-l border-orbit-border pl-1.5 text-[9.5px] text-[var(--text-subtle)]">
                              {ev.caliber}
                            </span>
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
            <Card className="divide-y divide-orbit-border p-5">
              {data.aiActionsExecutedToday.length === 0 && (
                <div className="py-8 text-center text-[12.5px] text-[var(--text-muted)]">今日暂无 AI 自动执行动作</div>
              )}
              {data.aiActionsExecutedToday.map((act) => (
                <div key={act.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-[3px] border border-orbit-accent-deep/35 bg-orbit-accent/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#14532D] dark:bg-orbit-accent/15 dark:text-orbit-accent">
                      {act.level}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[12.5px] font-semibold">{act.title}</p>
                        <span className="font-mono text-[11px] text-[var(--text-subtle)]">{act.time}</span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                        类型：<span className="text-[var(--text-secondary)]">{act.type}</span> · 效果：
                        <span className="font-semibold text-[#15803D] dark:text-orbit-accent">{act.impact}</span>
                      </p>
                    </div>
                  </div>
                  <Badge variant="accent" className="flex-shrink-0">已生效</Badge>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* 右侧：今日场次 & 原则 */}
        <div className="space-y-5 lg:col-span-4">
          {/* 今日作战场次 */}
          <Card className="p-5">
            <div className="mb-3.5 flex items-center justify-between border-b border-orbit-border pb-3">
              <h3 className="flex items-center gap-2 text-[13px] font-bold tracking-tight">
                <Calendar className="h-3.5 w-3.5 text-orbit-primary" />
                今日作战场次
              </h3>
              <a
                href="/ai-ops/session/planning"
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-orbit-primary hover:text-orbit-primary-dark"
              >
                排品台
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-2.5">
              {data.todaySessions.length === 0 && (
                <div className="py-6 text-center text-[11.5px] text-[var(--text-muted)]">今日暂无排期场次</div>
              )}
              {data.todaySessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'rounded-[9px] border p-3.5 transition-all',
                    session.status === 'live'
                      ? 'border-orbit-accent-deep/45 bg-orbit-accent/[0.1]'
                      : 'border-orbit-border bg-orbit-surface2/70'
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-semibold">{session.title}</span>
                    {session.status === 'live' ? (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-[3px] bg-orbit-accent px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-orbit-ink">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orbit-ink" />
                        直播盯盘中
                      </span>
                    ) : (
                      <Badge variant={session.status === 'ended' ? 'neutral' : 'primary'}>
                        {session.status === 'ended' ? '已下播待复盘' : '待开播'}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11.5px] text-[var(--text-muted)]">
                    <span>主播：{session.anchorName}</span>
                    <span className="metric-num font-bold text-[var(--text-primary)]">
                      目标 ¥{(session.targetGmv / 10000).toFixed(1)}w
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between border-t border-orbit-border pt-1.5 text-[10.5px] text-[var(--text-subtle)]">
                    <span>{session.timeRange}</span>
                    {session.status === 'ended' ? (
                      <a href="/ai-ops/session/review" className="inline-flex items-center gap-0.5 font-semibold text-orbit-primary hover:underline">
                        生成五段复盘
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    ) : session.status === 'live' ? (
                      <a href="/ai-ops/session/live-watch" className="inline-flex items-center gap-0.5 font-semibold text-[#15803D] hover:underline dark:text-orbit-accent">
                        进入盯盘驾驶舱
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    ) : (
                      <a href="/ai-ops/session/planning" className="inline-flex items-center gap-0.5 font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        检查排品表
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 核心原则（墨黑底 + 荧光绿点） */}
          <div className="rounded-xl border border-orbit-ink bg-orbit-ink p-5">
            <h4 className="mb-3 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-orbit-snow/55">
              <Sparkles className="h-3.5 w-3.5 text-orbit-accent" />
              AI 运营系统核心原则
            </h4>
            <div className="space-y-2.5 text-[11.5px] leading-relaxed text-orbit-snow/70">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orbit-accent" />
                <span>主语永远是<strong className="font-semibold text-orbit-snow">动作</strong>，绝不把报表单据当主角</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orbit-accent" />
                <span>产出必须是<strong className="font-semibold text-orbit-snow">可执行物</strong>（可入库、可审批）</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orbit-accent" />
                <span>下播 30 分钟出复盘，<strong className="font-semibold text-orbit-snow">行动项自动验证效果</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orbit-accent" />
                <span>底层数据 100% 消费主系统真实流水，双向闭环</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
