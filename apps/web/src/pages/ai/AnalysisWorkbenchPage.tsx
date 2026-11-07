import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, Play, ChevronDown, ChevronRight, CheckCircle, AlertTriangle,
  Database, Target, Lightbulb, History,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Step {
  seq: number
  role: string
  toolName: string
  input: any
  outputRef: any
  rowCount: number
  durationMs: number
  status: string
  error?: string
}

interface Evidence {
  id: string
  metric: string
  label: string
  value: number
  unit: string
  scope: string
  timeRange: string
}

interface AnalysisResult {
  runId: number | null
  mode: string
  question: string
  steps: Step[]
  evidence: Evidence[]
  conclusion: {
    headline: string
    findings: string[]
    evidenceRefs: string[]
    risks: string[]
    actions: string[]
  }
  verification: {
    checkedNumbers: number
    matched: number
    unmatched: Array<{ number: number; context: string }>
    passed: boolean
  }
  knowledgeUsed: number
  durationMs: number
}

interface RunRecord {
  id: number
  mode: string
  question: string
  status: string
  created_at: string
}

const MODE_LABEL: Record<string, string> = {
  S1_query: '经营问数',
  S2_attribution: '同环比归因',
  S3_compare: '跨平台对比',
  S4_anomaly: '异常诊断',
  S5_forecast: '预测与目标',
  S6_review: '复盘报告',
}

const ROLE_LABEL: Record<string, string> = {
  planner: '规划',
  executor: '取数',
  critic: '自检',
  reporter: '成稿',
}

const EXAMPLES = [
  '本期各平台经营情况怎么样',
  '为什么最近 GMV 变化这么大',
  '淘宝和拼多多哪个更赚钱',
  '有没有异常波动',
  '未来一周 GMV 会是什么趋势',
  '生成本期经营复盘报告',
]

function todayRange(days = 7) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days + 1)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function AnalysisWorkbenchPage() {
  const [question, setQuestion] = useState('')
  const [range, setRange] = useState(todayRange())
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<RunRecord[]>([])
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [showEvidence, setShowEvidence] = useState(false)

  const loadHistory = async () => {
    try {
      const d = await api.get<RunRecord[]>('/analysis/runs', { limit: 10 })
      setHistory(d || [])
    } catch { /* ignore */ }
  }

  useEffect(() => { loadHistory() }, [])

  const run = async (q?: string) => {
    const text = (q ?? question).trim()
    if (!text) { setError('请输入分析问题'); return }
    setLoading(true)
    setError(null)
    try {
      const r = await api.post<AnalysisResult>('/analysis/run', {
        question: text,
        timeRange: range,
      })
      setResult(r)
      setQuestion(text)
      loadHistory()
    } catch (e: any) {
      setError(e?.message || '分析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <h1 className="text-2xl font-semibold text-slate-100">经营分析工作台</h1>
        <p className="mt-1 text-sm text-slate-400">
          四阶受控编排：规划 → 取数 → 自检 → 成稿，所有数字由数据库计算并可溯源
        </p>
      </motion.div>

      {/* 输入区 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardBody className="space-y-3">
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run() } }}
                placeholder="问一个经营问题，例如：为什么这周 GMV 掉了？"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600"
              />
              <Button onClick={() => run()} disabled={loading}>
                <Play className="mr-1 h-4 w-4" />
                {loading ? '分析中…' : '开始分析'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
              />
              <span className="text-xs text-slate-600">至</span>
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => run(ex)}
                  disabled={loading}
                  className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-cyan-600 hover:text-cyan-300"
                >
                  {ex}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
      )}

      {result && (
        <>
          {/* 结论卡片 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>分析结论</span>
                  <Badge variant="info">{MODE_LABEL[result.mode] || result.mode}</Badge>
                  <Badge variant={result.verification.passed ? 'success' : 'danger'}>
                    {result.verification.passed
                      ? `数字全部可溯源 (${result.verification.matched}/${result.verification.checkedNumbers})`
                      : `${result.verification.unmatched.length} 个数字无法溯源`}
                  </Badge>
                  {result.knowledgeUsed > 0 && (
                    <Badge variant="neutral">已参考知识库 {result.knowledgeUsed} 条</Badge>
                  )}
                  <span className="ml-auto text-xs text-slate-500">{result.durationMs}ms</span>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-base font-medium text-slate-100">{result.conclusion.headline}</p>

                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Target className="h-3.5 w-3.5" /> 主要发现
                  </div>
                  <ul className="space-y-1">
                    {result.conclusion.findings.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-cyan-500">·</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {result.conclusion.risks.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> 风险提示
                    </div>
                    <ul className="space-y-1">
                      {result.conclusion.risks.map((r, i) => (
                        <li key={i} className="rounded bg-amber-500/10 px-2 py-1 text-sm text-amber-300">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.conclusion.actions.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <Lightbulb className="h-3.5 w-3.5" /> 行动建议
                    </div>
                    <ul className="space-y-1">
                      {result.conclusion.actions.map((a, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                          <span className="text-emerald-500">{i + 1}.</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!result.verification.passed && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2">
                    <div className="mb-1 flex items-center gap-1 text-xs text-rose-400">
                      <AlertTriangle className="h-3 w-3" /> 以下数字未能在取数结果中命中，请谨慎采信
                    </div>
                    {result.verification.unmatched.slice(0, 5).map((u, i) => (
                      <div key={i} className="text-[11px] text-rose-300/80">
                        {u.number} — {u.context}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* 执行轨迹 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4" /> 执行轨迹
                  <span className="text-xs text-slate-500">（点击展开每步输入输出）</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-1">
                  {result.steps.map((s) => {
                    const open = expandedStep === s.seq
                    return (
                      <div key={s.seq} className="rounded-lg border border-slate-700/50">
                        <button
                          onClick={() => setExpandedStep(open ? null : s.seq)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-800/40"
                        >
                          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <span className="w-5 text-slate-600">{s.seq}</span>
                          <Badge variant={
                            s.role === 'planner' ? 'info' :
                            s.role === 'critic' ? (s.status === 'ok' ? 'success' : 'danger') :
                            s.role === 'reporter' ? 'warning' : 'neutral'
                          }>
                            {ROLE_LABEL[s.role] || s.role}
                          </Badge>
                          <span className="font-mono text-slate-300">{s.toolName}</span>
                          <span className="text-slate-600">{s.rowCount} 行</span>
                          <span className="ml-auto text-slate-600">{s.durationMs}ms</span>
                          {s.status === 'ok'
                            ? <CheckCircle className="h-3 w-3 text-emerald-500" />
                            : <AlertTriangle className="h-3 w-3 text-rose-500" />}
                        </button>
                        {open && (
                          <div className="border-t border-slate-700/50 px-3 py-2">
                            {s.error && <div className="mb-1 text-[11px] text-rose-400">{s.error}</div>}
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <div className="mb-0.5 text-[10px] uppercase text-slate-600">输入</div>
                                <pre className="max-h-40 overflow-auto rounded bg-slate-900/70 p-2 text-[10px] text-slate-400">
{JSON.stringify(s.input, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="mb-0.5 text-[10px] uppercase text-slate-600">输出</div>
                                <pre className="max-h-40 overflow-auto rounded bg-slate-900/70 p-2 text-[10px] text-emerald-400/70">
{JSON.stringify(s.outputRef, null, 2).slice(0, 3000)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 数据凭证 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <button
                  onClick={() => setShowEvidence(!showEvidence)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <Database className="h-4 w-4" />
                  <span>数据凭证（{result.evidence.length} 条）</span>
                  <span className="text-xs text-slate-500">结论中的每个数字都对应这里的某一行</span>
                  <ChevronDown className={cn('ml-auto h-4 w-4 transition', showEvidence && 'rotate-180')} />
                </button>
              </CardHeader>
              {showEvidence && (
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-slate-400">
                          <th className="py-1.5 pr-2">编号</th>
                          <th className="py-1.5 pr-2">指标</th>
                          <th className="py-1.5 pr-2 text-right">数值</th>
                          <th className="py-1.5 pr-2">单位</th>
                          <th className="py-1.5 pr-2">范围</th>
                          <th className="py-1.5">时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.evidence.map((e) => (
                          <tr key={e.id} className="border-b border-slate-800/60 text-slate-300">
                            <td className="py-1 pr-2 font-mono text-cyan-500">{e.id}</td>
                            <td className="py-1 pr-2">{e.label}</td>
                            <td className="py-1 pr-2 text-right font-mono">{e.value}</td>
                            <td className="py-1 pr-2 text-slate-500">{e.unit}</td>
                            <td className="py-1 pr-2 text-slate-500">{e.scope}</td>
                            <td className="py-1 text-slate-600">{e.timeRange}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              )}
            </Card>
          </motion.div>
        </>
      )}

      {/* 历史记录 */}
      {history.length > 0 && (
        <motion.div {...fadeIn}>
          <Card>
            <CardHeader>最近分析记录</CardHeader>
            <CardBody>
              <div className="space-y-1">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => run(h.question)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800/40"
                  >
                    <Badge variant="neutral">{MODE_LABEL[h.mode] || h.mode}</Badge>
                    <span className="truncate text-slate-300">{h.question}</span>
                    <span className="ml-auto shrink-0 text-slate-600">
                      {new Date(h.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
