import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import {
  CheckCircle2,
  ClipboardList,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  HelpCircle,
  Database,
  FileText,
} from 'lucide-react'

// ─── Types ───

interface Session {
  id: string
  name: string
  date: string
}

interface Finding {
  id: string
  description: string
  related_metric?: string
  current_value?: string
  severity: 'normal' | 'warning' | 'severe'
  suggested_action?: string
}

interface RelatedIssue {
  id: string
  title: string
  session: string
  type: string
  assignee: string
  status: string
  created_at: string
}

interface ImprovementTask {
  id: string
  title: string
  assignee: string
  related_issue: string
  related_session: string
  deadline: string
  status: 'pending' | 'in_progress' | 'completed' | 'reviewed'
}

interface MetricDiff {
  before: number
  after: number
  change_pct: number
}

interface ComparisonResult {
  gmv: MetricDiff
  gpm: MetricDiff
  exposure_view_rate: MetricDiff
  product_click_deal_rate: MetricDiff
  product_deal_rate: MetricDiff
  new_fans: MetricDiff
  uv_value: MetricDiff
}

// ─── Constants ───

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay },
})

const severityConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger'; borderColor: string }> = {
  normal: { label: '正常', variant: 'success', borderColor: 'var(--color-orbit-success)' },
  warning: { label: '预警', variant: 'warning', borderColor: 'var(--color-orbit-warning)' },
  severe: { label: '严重', variant: 'danger', borderColor: 'var(--color-orbit-danger)' },
}

const taskStatusConfig: Record<string, { label: string; variant: 'warning' | 'primary' | 'success' | 'info' }> = {
  pending: { label: '待处理', variant: 'warning' },
  in_progress: { label: '进行中', variant: 'primary' },
  completed: { label: '已完成', variant: 'success' },
  reviewed: { label: '已复核', variant: 'info' },
}

const COMPARISON_METRICS: { key: keyof ComparisonResult; label: string; format: (v: number) => string }[] = [
  { key: 'gmv', label: 'GMV', format: (v) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` },
  { key: 'gpm', label: 'GPM', format: (v) => `¥${v.toFixed(1)}` },
  { key: 'exposure_view_rate', label: '曝光-观看率', format: (v) => `${v.toFixed(2)}%` },
  { key: 'product_click_deal_rate', label: '商品曝光-点击率', format: (v) => `${v.toFixed(2)}%` },
  { key: 'product_deal_rate', label: '商品点击-成交率', format: (v) => `${v.toFixed(2)}%` },
  { key: 'new_fans', label: '新增粉丝', format: (v) => String(v) },
  { key: 'uv_value', label: '单UV价值', format: (v) => `¥${v.toFixed(2)}` },
]

// ─── Helpers ───

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  // If already formatted like "2025-01-15", show as is
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 10)
  }
  return dateStr
}

// ─── Sub-components ───

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Findings skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-40 bg-[var(--surface3)] rounded mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-[var(--surface3)] rounded-lg" />
          ))}
        </div>
      </div>

      {/* Related issues skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-40 bg-[var(--surface3)] rounded mb-6" />
        <div className="h-40 bg-[var(--surface3)] rounded-lg" />
      </div>

      {/* Improvement tasks skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-40 bg-[var(--surface3)] rounded mb-6" />
        <div className="h-40 bg-[var(--surface3)] rounded-lg" />
      </div>

      {/* Effect validation skeleton */}
      <div className="rounded-xl border border-orbit-border bg-orbit-surface p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface3)] rounded mb-2" />
        <div className="h-3 w-40 bg-[var(--surface3)] rounded mb-6" />
        <div className="h-48 bg-[var(--surface3)] rounded-lg" />
      </div>
    </div>
  )
}

// ─── Section 1: Findings List ───

function FindingsSection({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return (
      <motion.div {...fadeUp(0.1)}>
        <Card>
          <CardHeader title="待落地发现" subtitle="本场直播待改进问题" />
          <CardBody>
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-[var(--text-primary)] mb-3" />
              <p className="text-[var(--text-muted)] text-sm">暂无发现项，表现良好</p>
            </div>
          </CardBody>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div {...fadeUp(0.1)}>
      <Card>
        <CardHeader
          title="待落地发现"
          subtitle="本场直播待改进问题"
          actions={
            <span className="text-xs text-[var(--text-muted)] bg-orbit-surface2 px-2 py-0.5 rounded-full border border-orbit-border">
              {findings.length} 项
            </span>
          }
        />
        <CardBody className="space-y-3">
          {findings.map((finding, i) => {
            const sev = severityConfig[finding.severity]
            return (
              <motion.div
                key={finding.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                className="bg-orbit-surface2/50 rounded-r-lg border border-orbit-border p-4"
                style={{ borderLeft: `2px solid ${sev.borderColor}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="text-sm font-semibold text-[var(--text-secondary)]">{finding.description}</h4>
                      <Badge variant={sev.variant}>{sev.label}</Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                      {finding.related_metric && (
                        <span>
                          关联指标：<span className="text-[var(--text-muted)]">{finding.related_metric}</span>
                        </span>
                      )}
                      {finding.current_value && (
                        <span>
                          当前值：<span className="text-[var(--text-muted)] font-medium">{finding.current_value}</span>
                        </span>
                      )}
                    </div>

                    {finding.suggested_action && (
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        建议动作：<span className="text-[var(--text-muted)]">{finding.suggested_action}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Button size="xs" variant="outline">
                      <Database className="w-3 h-3" />
                      加入问题库
                    </Button>
                    <Button size="xs" variant="secondary">
                      <Target className="w-3 h-3" />
                      创建改进任务
                    </Button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </CardBody>
      </Card>
    </motion.div>
  )
}

// ─── Section 2: Related Issues ───

function RelatedIssuesSection({ issues }: { issues: RelatedIssue[] }) {
  return (
    <motion.div {...fadeUp(0.2)}>
      <Card>
        <CardHeader
          title="关联问题"
          subtitle="同类历史问题追溯"
          actions={
            <a
              href="/ops/issue-library"
              className="text-xs text-orbit-primary-light hover:text-orbit-primary transition-colors flex items-center gap-1"
            >
              前往问题库
              <ArrowRight className="w-3 h-3" />
            </a>
          }
        />
        <CardBody>
          {issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="w-12 h-12 text-[var(--text-primary)] mb-3" />
              <p className="text-[var(--text-muted)] text-sm">暂无关联问题</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 pr-4">问题</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 px-4">关联场次</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 px-4">问题类型</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 px-4">负责人</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 px-4">状态</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 pl-4">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue, i) => (
                    <motion.tr
                      key={issue.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03 }}
                      className="border-b border-orbit-border/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 pr-4 text-[var(--text-secondary)] font-medium whitespace-nowrap">
                        {issue.title}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--text-muted)] whitespace-nowrap">
                        {issue.session}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--text-muted)] whitespace-nowrap">
                        {issue.type}
                      </td>
                      <td className="py-2.5 px-4 text-[var(--text-muted)] whitespace-nowrap">
                        {issue.assignee}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <Badge variant="neutral">{issue.status}</Badge>
                      </td>
                      <td className="py-2.5 pl-4 text-[var(--text-muted)] whitespace-nowrap tabular-nums">
                        {formatDate(issue.created_at)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}

// ─── Section 3: Improvement Tasks ───

function ImprovementTasksSection({ tasks }: { tasks: ImprovementTask[] }) {
  return (
    <motion.div {...fadeUp(0.3)}>
      <Card>
        <CardHeader
          title="改进任务"
          subtitle="分配改进任务与跟踪"
          actions={
            <a
              href="/system/tasks"
              className="text-xs text-orbit-primary-light hover:text-orbit-primary transition-colors flex items-center gap-1"
            >
              前往改进任务
              <ArrowRight className="w-3 h-3" />
            </a>
          }
        />
        <CardBody>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Target className="w-12 h-12 text-[var(--text-primary)] mb-3" />
              <p className="text-[var(--text-muted)] text-sm">暂无改进任务</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 pr-4">任务</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 px-4">负责人</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 px-4">关联问题</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 px-4">关联场次</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 px-4">截止时间</th>
                    <th className="text-left text-[var(--text-muted)] font-medium py-2.5 pl-4">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, i) => {
                    const statusCfg = taskStatusConfig[task.status]
                    return (
                      <motion.tr
                        key={task.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.03 }}
                        className="border-b border-orbit-border/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 pr-4 text-[var(--text-secondary)] font-medium whitespace-nowrap">
                          {task.title}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--text-muted)] whitespace-nowrap">
                          {task.assignee}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--text-muted)] whitespace-nowrap">
                          {task.related_issue}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--text-muted)] whitespace-nowrap">
                          {task.related_session}
                        </td>
                        <td className="py-2.5 px-4 text-[var(--text-muted)] whitespace-nowrap tabular-nums">
                          {formatDate(task.deadline)}
                        </td>
                        <td className="py-2.5 pl-4 whitespace-nowrap">
                          <Badge variant={statusCfg.variant} dot>
                            {statusCfg.label}
                          </Badge>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}

// ─── Section 4: Effect Validation ───

function EffectValidationSection({
  sessions,
}: {
  sessions: Session[]
}) {
  const [sessionA, setSessionA] = useState('')
  const [sessionB, setSessionB] = useState('')
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [comparing, setComparing] = useState(false)

  // Auto-select first two sessions if available
  useEffect(() => {
    if (sessions.length >= 2) {
      setSessionA(sessions[0].id)
      setSessionB(sessions[1].id)
    } else if (sessions.length === 1) {
      setSessionA(sessions[0].id)
    }
  }, [sessions])

  const handleCompare = async () => {
    if (!sessionA || !sessionB) return
    setComparing(true)
    setComparison(null)
    try {
      const result = await api.get<ComparisonResult>('/api/v1/review/compare', {
        session_id_a: sessionA,
        session_id_b: sessionB,
      })
      setComparison(result)
    } catch {
      // Silently fail
    } finally {
      setComparing(false)
    }
  }

  return (
    <motion.div {...fadeUp(0.4)}>
      <Card>
        <CardHeader title="效果验证" subtitle="改进措施效果跟踪" />
        <CardBody>
          {/* Session selectors */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-6">
            <div className="flex-1 w-full">
              <label className="block text-xs text-[var(--text-muted)] font-medium mb-1.5">优化前场次</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                <select
                  value={sessionA}
                  onChange={(e) => setSessionA(e.target.value)}
                  className="appearance-none w-full bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50"
                >
                  <option value="">选择场次</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatDate(s.date)})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center justify-center py-2 px-3">
              <span className="text-sm text-[var(--text-muted)] font-medium">VS</span>
            </div>

            <div className="flex-1 w-full">
              <label className="block text-xs text-[var(--text-muted)] font-medium mb-1.5">优化后场次</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                <select
                  value={sessionB}
                  onChange={(e) => setSessionB(e.target.value)}
                  className="appearance-none w-full bg-orbit-surface border border-orbit-border rounded-lg pl-9 pr-8 py-2 text-sm text-[var(--text-secondary)] cursor-pointer focus:outline-none focus:border-orbit-primary/50"
                >
                  <option value="">选择场次</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatDate(s.date)})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleCompare}
              disabled={!sessionA || !sessionB || comparing}
              loading={comparing}
            >
              对比
            </Button>
          </div>

          {/* Comparison results */}
          {comparison ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {COMPARISON_METRICS.map((metric, i) => {
                const data = comparison[metric.key]
                if (!data) return null
                const isUp = data.change_pct > 0
                const isDown = data.change_pct < 0
                const isNeutral = data.change_pct === 0

                return (
                  <motion.div
                    key={metric.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="rounded-lg border border-orbit-border bg-orbit-surface2/50 p-4"
                  >
                    <p className="text-xs text-[var(--text-muted)] font-medium mb-2">{metric.label}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--text-muted)]">{metric.format(data.before)}</span>
                      <ArrowRight className={cn(
                        'w-3.5 h-3.5 flex-shrink-0',
                        isUp && 'text-status-success',
                        isDown && 'text-status-danger',
                        isNeutral && 'text-[var(--text-muted)]',
                      )} />
                      <span className="text-[var(--text-primary)] font-semibold">{metric.format(data.after)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      {isUp && <TrendingUp className="w-3.5 h-3.5 text-status-success" />}
                      {isDown && <TrendingDown className="w-3.5 h-3.5 text-status-danger" />}
                      {isNeutral && <span className="w-3.5 h-3.5" />}
                      <span
                        className={cn(
                          'text-xs font-medium tabular-nums',
                          isUp && 'text-status-success',
                          isDown && 'text-status-danger',
                          isNeutral && 'text-[var(--text-muted)]',
                        )}
                      >
                        {isUp ? '+' : ''}{data.change_pct.toFixed(1)}%
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : comparing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-orbit-border bg-orbit-surface2/50 p-4 animate-pulse">
                  <div className="h-3 w-16 bg-[var(--surface3)] rounded mb-3" />
                  <div className="h-5 w-32 bg-[var(--surface3)] rounded mb-2" />
                  <div className="h-3 w-20 bg-[var(--surface3)] rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <HelpCircle className="w-12 h-12 text-[var(--text-primary)] mb-3" />
              <p className="text-[var(--text-muted)] text-sm">选择优化前后场次进行对比</p>
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}

// ─── Page Component ───

export function ClosedLoopPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [relatedIssues, setRelatedIssues] = useState<RelatedIssue[]>([])
  const [tasks, setTasks] = useState<ImprovementTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ sessions: Session[]; findings: Finding[] }>('/api/v1/review/sessions'),
      api.get<RelatedIssue[]>('/api/v1/review/related-issues'),
      api.get<ImprovementTask[]>('/api/v1/system/tasks'),
    ])
      .then(([sessionsData, issuesData, tasksData]) => {
        if (sessionsData.sessions) {
          setSessions(sessionsData.sessions)
        }
        if (sessionsData.findings) {
          setFindings(sessionsData.findings)
        }
        if (Array.isArray(issuesData)) {
          setRelatedIssues(issuesData)
        } else if ((issuesData as any)?.issues) {
          setRelatedIssues((issuesData as any).issues)
        }
        if (Array.isArray(tasksData)) {
          setTasks(tasksData)
        } else if ((tasksData as any)?.tasks) {
          setTasks((tasksData as any).tasks)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">改进闭环</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">问题发现 → 任务分配 → 效果验证</p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <FindingsSection findings={findings} />
          <RelatedIssuesSection issues={relatedIssues} />
          <ImprovementTasksSection tasks={tasks} />
          <EffectValidationSection sessions={sessions} />
        </>
      )}
    </div>
  )
}