import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, CalendarClock, TrendingUp, GraduationCap, RefreshCw, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Overview {
  totalActive: number
  byLevel: Array<{ level: string; n: number }>
  newbieLast30d: number
  profiles: { withProfile: number; withoutProfile: number }
  byPlatform: Array<{ platform: string; n: number }>
  fans: { total: number; avg: number }
}

interface Attendance {
  range: { days: number }
  totals: { sessions: number; totalMinutes: number; absent: number; idleAnchors: number; avgSessionsPerAnchor: number }
  anchors: Array<{ id: number; name: string; level: string; sessions: number; total_minutes: number; avg_minutes: number; absent: number; gmv: string }>
}

interface Performance {
  evaluatedCount: number
  dimensions: { expression: number | null; interaction: number | null; conversion: number | null; professionalism: number | null; overall: number | null }
  gmvBands: { top: number; mid: number; low: number; none: number }
}

interface Training {
  planCount: number
  avgProgress: number
  inProgress: number
  completed: number
  recordCount: number
  plans: Array<{ id: number; name: string; anchor_count: number; start_date: string; end_date: string; progress: number; status: string }>
}

const fmtNum = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))

/**
 * HRBP 工作台（S5）
 * 老大原话：「有 HRBP 的角色，但是没有相应的功能」
 * 本页把原本分散在主播档案/考勤登记/能力评估/培训计划里的数据，聚合成 HRBP 视角的四个板块。
 */
export function HrbpWorkspacePage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [performance, setPerformance] = useState<Performance | null>(null)
  const [training, setTraining] = useState<Training | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [ov, at, pf, tr] = await Promise.all([
        api.get<Overview>('/hrbp/overview'),
        api.get<Attendance>(`/hrbp/attendance?days=${days}`),
        api.get<Performance>('/hrbp/performance'),
        api.get<Training>('/hrbp/training'),
      ])
      setOverview(ov); setAttendance(at); setPerformance(pf); setTraining(tr)
    } catch (e: any) {
      setErr(e?.message || '加载 HRBP 数据失败')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <motion.div {...fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-orbit-primary" /> HRBP 工作台
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            人才画像 · 考勤出勤 · 绩效分布 · 培训进度 —— 主播人才经营的一站式视图
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-slate-300"
          >
            <option value={7}>近 7 天</option>
            <option value={30}>近 30 天</option>
            <option value={90}>近 90 天</option>
          </select>
          <Button variant="secondary" onClick={load}><RefreshCw className="w-4 h-4" /> 刷新</Button>
        </div>
      </motion.div>

      {err && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {/* 板块 1：人才画像 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader><span className="text-sm font-semibold text-slate-200">一、人才画像</span><Badge variant="info">在岗 {overview?.totalActive ?? 0}</Badge></CardHeader>
          <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="在岗主播" value={fmtNum(overview?.totalActive)} hint="status=1" />
            <Stat label="近 30 天新人" value={fmtNum(overview?.newbieLast30d)} hint="入职 30 天内" />
            <Stat label="已建档案 / 未建" value={`${overview?.profiles.withProfile ?? 0} / ${overview?.profiles.withoutProfile ?? 0}`} hint="档案完整度" warn={(overview?.profiles.withoutProfile ?? 0) > 0} />
            <Stat label="粉丝总量 / 人均" value={`${fmtNum(overview?.fans.total)} / ${fmtNum(overview?.fans.avg)}`} hint="profile.followers" />
            <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-orbit-border/60 p-3">
                <div className="text-[11px] text-slate-400 mb-2">层级分布</div>
                <div className="flex flex-wrap gap-1.5">
                  {(overview?.byLevel || []).map(l => (
                    <span key={l.level} className="px-2 py-0.5 rounded text-[11px] bg-white/5 border border-orbit-border/60 text-slate-300">
                      {l.level} <span className="text-orbit-primary font-semibold">{l.n}</span>
                    </span>
                  ))}
                  {(overview?.byLevel || []).length === 0 && <span className="text-xs text-slate-500">暂无数据</span>}
                </div>
              </div>
              <div className="rounded-lg border border-orbit-border/60 p-3">
                <div className="text-[11px] text-slate-400 mb-2">平台分布</div>
                <div className="flex flex-wrap gap-1.5">
                  {(overview?.byPlatform || []).map(p => (
                    <span key={p.platform} className="px-2 py-0.5 rounded text-[11px] bg-white/5 border border-orbit-border/60 text-slate-300">
                      {p.platform} <span className="text-orbit-primary font-semibold">{p.n}</span>
                    </span>
                  ))}
                  {(overview?.byPlatform || []).length === 0 && <span className="text-xs text-slate-500">暂无数据</span>}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* 板块 2：考勤出勤 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> 二、考勤与出勤（近 {attendance?.range.days ?? days} 天）</span>
            <div className="flex gap-1.5">
              <Badge variant="neutral">场次 {fmtNum(attendance?.totals.sessions)}</Badge>
              <Badge variant="neutral">时长 {fmtNum(attendance?.totals.totalMinutes)} 分</Badge>
              {(attendance?.totals.idleAnchors ?? 0) > 0 && <Badge variant="warning">零出勤 {attendance?.totals.idleAnchors}</Badge>}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                  <tr className="text-slate-400">
                    <th className="text-left px-4 py-2">主播</th>
                    <th className="text-left px-3 py-2">层级</th>
                    <th className="text-right px-3 py-2">场次</th>
                    <th className="text-right px-3 py-2">总时长(分)</th>
                    <th className="text-right px-3 py-2">场均(分)</th>
                    <th className="text-right px-3 py-2">缺勤</th>
                    <th className="text-right px-4 py-2">GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendance?.anchors || []).map(a => (
                    <tr key={a.id} className={`border-b border-orbit-border/40 ${a.sessions === 0 ? 'bg-amber-500/5' : ''}`}>
                      <td className="px-4 py-1.5 text-slate-200">{a.name}</td>
                      <td className="px-3 py-1.5 text-slate-400">{a.level}</td>
                      <td className="px-3 py-1.5 text-right text-slate-300">{a.sessions}</td>
                      <td className="px-3 py-1.5 text-right text-slate-300">{fmtNum(a.total_minutes)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{a.avg_minutes}</td>
                      <td className="px-3 py-1.5 text-right">{a.absent > 0 ? <span className="text-rose-400">{a.absent}</span> : <span className="text-slate-600">0</span>}</td>
                      <td className="px-4 py-1.5 text-right text-slate-300">{Number(a.gmv).toLocaleString('zh-CN')}</td>
                    </tr>
                  ))}
                  {(attendance?.anchors || []).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">暂无考勤数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* 板块 3：绩效分布 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> 三、绩效分布</span>
            <Badge variant="neutral">已评估 {performance?.evaluatedCount ?? 0} 人</Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Stat label="表现力" value={performance?.dimensions.expression ?? '—'} />
              <Stat label="互动" value={performance?.dimensions.interaction ?? '—'} />
              <Stat label="转化" value={performance?.dimensions.conversion ?? '—'} />
              <Stat label="专业度" value={performance?.dimensions.professionalism ?? '—'} />
              <Stat label="综合" value={performance?.dimensions.overall ?? '—'} highlight />
            </div>
            <div className="rounded-lg border border-orbit-border/60 p-3">
              <div className="text-[11px] text-slate-400 mb-2">近 30 天 GMV 分档</div>
              <div className="flex flex-wrap gap-2">
                <Band label="头部（前 1/3）" n={performance?.gmvBands.top ?? 0} color="text-emerald-400" />
                <Band label="腰部（中 1/3）" n={performance?.gmvBands.mid ?? 0} color="text-sky-400" />
                <Band label="尾部（后 1/3）" n={performance?.gmvBands.low ?? 0} color="text-amber-400" />
                <Band label="零产出" n={performance?.gmvBands.none ?? 0} color="text-rose-400" />
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* 板块 4：培训进度 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5"><GraduationCap className="w-4 h-4" /> 四、培训进度</span>
            <div className="flex gap-1.5">
              <Badge variant="neutral">计划 {training?.planCount ?? 0}</Badge>
              <Badge variant="info">平均完成 {training?.avgProgress ?? 0}%</Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {(training?.plans || []).map(p => (
              <div key={p.id} className="rounded-lg border border-orbit-border/60 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-200">{p.name}</span>
                  <span className="text-[11px] text-slate-400">{p.anchor_count} 人 · {p.status}</span>
                </div>
                <div className="h-1.5 rounded bg-white/5 overflow-hidden">
                  <div className="h-full bg-orbit-primary/70" style={{ width: `${Math.min(100, Math.max(0, p.progress || 0))}%` }} />
                </div>
              </div>
            ))}
            {(training?.plans || []).length === 0 && (
              <p className="text-xs text-slate-500 py-4 text-center">暂无培训计划</p>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}

function Stat({ label, value, hint, warn, highlight }: { label: string; value: React.ReactNode; hint?: string; warn?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? 'border-amber-500/40 bg-amber-500/5' : highlight ? 'border-orbit-primary/40 bg-orbit-primary/5' : 'border-orbit-border/60'}`}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${warn ? 'text-amber-300' : highlight ? 'text-orbit-primary' : 'text-slate-100'}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  )
}

function Band({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <span className="px-2 py-1 rounded text-[11px] bg-white/5 border border-orbit-border/60 text-slate-300">
      {label} <span className={`font-semibold ${color}`}>{n}</span>
    </span>
  )
}

export default HrbpWorkspacePage
