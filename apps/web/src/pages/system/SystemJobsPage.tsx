import { useState, useMemo } from 'react'
import {
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  RefreshCw,
  Ban,
  Eye,
  Terminal,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'

export interface SystemJob {
  id: string
  jobType: string
  jobName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  inputPayload: any
  resultPayload: any
  errorMessage: string
  runAt: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  durationMs: number | null
}

interface JobsResponse {
  items: SystemJob[]
  total: number
  page: number
  pageSize: number
}

const JOB_TYPE_PRESETS: Array<{ type: string; label: string; defaultPayload: Record<string, any> }> = [
  { type: 'fact_aggregation', label: '多平台事实与渠道日汇总聚合 (agg_*)', defaultPayload: {} },
  { type: 'compliance_patrol', label: '合规巡检与违规雷达扫描', defaultPayload: {} },
  { type: 'anomaly_detection', label: '数据异常与指标离群波动检测', defaultPayload: {} },
  { type: 'partition_maintenance', label: '分区自动预建与 DEFAULT 守护', defaultPayload: { monthsAhead: 3 } },
  { type: 'archive_old_data', label: '冷数据归档与历史暂存清理', defaultPayload: {} },
  { type: 'quality_gate', label: '批次 SQL 质量门禁断言', defaultPayload: { batchId: 1 } },
  { type: 'initial_sync', label: '全量历史数据对齐与指标重算', defaultPayload: {} },
]

export function SystemJobsPage() {
  const [selectedJob, setSelectedJob] = useState<SystemJob | null>(null)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [dispatchType, setDispatchType] = useState('fact_aggregation')
  const [dispatchName, setDispatchName] = useState('')
  const [dispatchPayload, setDispatchPayload] = useState('{}')
  const [submittingDispatch, setSubmittingDispatch] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const table = useTable<SystemJob, { status: string; jobType: string }>({
    initialFilters: { status: '', jobType: '' },
    initialPageSize: 20,
    fetchData: async ({ page, pageSize, search, filters }) => {
      const res = await api.get<JobsResponse>('/system/jobs', {
        page: String(page),
        pageSize: String(pageSize),
        status: filters.status || undefined,
        jobType: filters.jobType || undefined,
        search: search || undefined,
      })
      return {
        items: res.items || [],
        total: res.total || 0,
      }
    },
  })

  // Quick stats derived from table items or counters
  const stats = useMemo(() => {
    const list = table.data
    const total = table.total
    const running = list.filter((j) => j.status === 'running').length
    const pending = list.filter((j) => j.status === 'pending').length
    const completed = list.filter((j) => j.status === 'completed').length
    const failed = list.filter((j) => j.status === 'failed').length
    const durations = list.filter((j) => j.durationMs !== null).map((j) => j.durationMs!)
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0

    return { total, running, pending, completed, failed, avgDuration }
  }, [table.data, table.total])

  const handleCancelJob = async (job: SystemJob) => {
    if (!window.confirm(`确认取消任务 #${job.id} (${job.jobName}) 吗？`)) return
    setErrorMsg('')
    try {
      await api.post(`/system/jobs/${job.id}/cancel`, {})
      await table.reload()
    } catch (err: any) {
      setErrorMsg(err?.message || '取消任务失败')
    }
  }

  const handleDispatchJob = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSubmittingDispatch(true)
    try {
      let parsedPayload = {}
      try {
        parsedPayload = JSON.parse(dispatchPayload || '{}')
      } catch {
        setErrorMsg('参数 Payload 不是合法的 JSON 格式')
        setSubmittingDispatch(false)
        return
      }

      await api.post('/system/jobs', {
        jobType: dispatchType,
        jobName: dispatchName || undefined,
        inputPayload: parsedPayload,
      })

      setShowDispatchModal(false)
      setDispatchName('')
      setDispatchPayload('{}')
      await table.reload()
    } catch (err: any) {
      setErrorMsg(err?.message || '派发任务失败')
    } finally {
      setSubmittingDispatch(false)
    }
  }

  const columns: ColumnDef<SystemJob>[] = useMemo(
    () => [
      {
        key: 'id',
        header: '任务 ID',
        width: 100,
        render: (_, job) => (
          <span className="font-mono text-xs text-[var(--text-muted)] font-semibold">#{job.id}</span>
        ),
      },
      {
        key: 'jobName',
        header: '任务名称与类型',
        sortable: true,
        render: (_, job) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-primary)]">{job.jobName}</span>
              <Badge variant="info" className="text-[10px] font-mono">
                {job.jobType}
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
              提交于 {new Date(job.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
        ),
      },
      {
        key: 'status',
        header: '执行状态',
        render: (_, job) => {
          switch (job.status) {
            case 'pending':
              return <Badge variant="warning" dot>排队中</Badge>
            case 'running':
              return <Badge variant="info" dot>执行中</Badge>
            case 'completed':
              return <Badge variant="success">已完成</Badge>
            case 'failed':
              return <Badge variant="danger">执行失败</Badge>
            case 'cancelled':
              return <Badge variant="neutral">已取消</Badge>
            default:
              return <Badge variant="neutral">{job.status}</Badge>
          }
        },
      },
      {
        key: 'durationMs',
        header: '执行耗时',
        align: 'right',
        sortable: true,
        render: (_, job) => {
          if (job.durationMs === null) {
            return <span className="text-[var(--text-muted)] text-xs">-</span>
          }
          if (job.durationMs < 1000) {
            return <span className="font-mono text-xs text-emerald-400">{job.durationMs}ms</span>
          }
          return <span className="font-mono text-xs text-cyan-400">{(job.durationMs / 1000).toFixed(2)}s</span>
        },
      },
      {
        key: 'finishedAt',
        header: '开始 / 结束时间',
        render: (_, job) => (
          <div className="text-xs text-[var(--text-muted)] space-y-0.5">
            <div>始: {job.startedAt ? new Date(job.startedAt).toLocaleTimeString('zh-CN') : '-'}</div>
            <div>终: {job.finishedAt ? new Date(job.finishedAt).toLocaleTimeString('zh-CN') : '-'}</div>
          </div>
        ),
      },
      {
        key: 'resultPayload',
        header: '执行结果 / 异常摘要',
        render: (_, job) => {
          if (job.errorMessage) {
            return (
              <span className="text-xs text-red-400 line-clamp-1 max-w-xs" title={job.errorMessage}>
                {job.errorMessage}
              </span>
            )
          }
          if (job.resultPayload && Object.keys(job.resultPayload).length > 0) {
            return (
              <span className="text-xs font-mono text-[var(--text-muted)] line-clamp-1 max-w-xs">
                {JSON.stringify(job.resultPayload)}
              </span>
            )
          }
          return <span className="text-xs text-[var(--text-muted)]">-</span>
        },
      },
      {
        key: 'actions',
        header: '操作',
        align: 'right',
        render: (_, job) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setSelectedJob(job)}
              icon={<Eye className="w-3 h-3" />}
            >
              详情
            </Button>
            {job.status === 'pending' && (
              <Button
                size="xs"
                variant="destructive"
                onClick={() => handleCancelJob(job)}
                icon={<Ban className="w-3 h-3" />}
              >
                取消
              </Button>
            )}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {/* 5-in-1 Quick Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">总任务登记数</span>
              <Activity className="w-4 h-4 text-orbit-primary-light" />
            </div>
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">队列待办 / 运行中</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="mt-1 text-2xl font-bold text-amber-400">
              {stats.pending} / <span className="text-sky-400">{stats.running}</span>
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">成功完成</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.completed}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">执行失败</span>
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <p
              className={`mt-1 text-2xl font-bold ${
                stats.failed > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'
              }`}
            >
              {stats.failed}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">当前页平均耗时</span>
              <Terminal className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="mt-1 text-2xl font-bold text-cyan-400">{stats.avgDuration}ms</p>
          </CardBody>
        </Card>
      </div>

      <DataPage<SystemJob>
        title="后台异步任务与运维队列中心"
        subtitle="基于 PostgreSQL Advisory Lock + SKIP LOCKED 解耦架构，统一调度执行日汇总计算、合规巡检与数据治理"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-emerald-400 border border-orbit-border">
            Worker 守护进程驱动
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.reload()}
              loading={table.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新队列
            </Button>
            <Button
              size="sm"
              onClick={() => setShowDispatchModal(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              派发运维任务
            </Button>
          </>
        }
        table={table}
        columns={columns}
        searchPlaceholder="搜索任务名称或类型..."
        exportFilename="system_jobs_queue"
        filterControls={
          <div className="flex items-center gap-2">
            <select
              value={table.filters.status}
              onChange={(e) => table.setFilter('status', e.target.value)}
              className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-[var(--text-secondary)]"
            >
              <option value="">全部状态</option>
              <option value="pending">排队中 (Pending)</option>
              <option value="running">执行中 (Running)</option>
              <option value="completed">已完成 (Completed)</option>
              <option value="failed">执行失败 (Failed)</option>
              <option value="cancelled">已取消 (Cancelled)</option>
            </select>
            <select
              value={table.filters.jobType}
              onChange={(e) => table.setFilter('jobType', e.target.value)}
              className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-[var(--text-secondary)]"
            >
              <option value="">全部任务类型</option>
              {JOB_TYPE_PRESETS.map((p) => (
                <option key={p.type} value={p.type}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Modal: Job Details Inspector */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-orbit-border bg-orbit-surface p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-orbit-border pb-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span>任务详情 · #{selectedJob.id}</span>
                  <Badge variant="info">{selectedJob.jobType}</Badge>
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedJob.jobName}</p>
              </div>
              <Button size="xs" variant="ghost" onClick={() => setSelectedJob(null)}>
                关闭
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-orbit-surface2/40 p-3 rounded-lg border border-orbit-border">
                <div>
                  <span className="text-[var(--text-muted)] block">状态</span>
                  <span className="font-semibold text-[var(--text-secondary)]">{selectedJob.status}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">耗时</span>
                  <span className="font-mono text-cyan-400">
                    {selectedJob.durationMs !== null ? `${selectedJob.durationMs}ms` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">开始时间</span>
                  <span className="text-[var(--text-secondary)] font-mono">
                    {selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleString() : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">结束时间</span>
                  <span className="text-[var(--text-secondary)] font-mono">
                    {selectedJob.finishedAt ? new Date(selectedJob.finishedAt).toLocaleString() : '-'}
                  </span>
                </div>
              </div>

              {selectedJob.errorMessage && (
                <div>
                  <span className="font-semibold text-red-400 block mb-1">执行异常日志:</span>
                  <pre className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                    {selectedJob.errorMessage}
                  </pre>
                </div>
              )}

              <div>
                <span className="font-semibold text-[var(--text-secondary)] block mb-1">输入参数 (input_payload):</span>
                <pre className="p-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-secondary)] font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedJob.inputPayload, null, 2)}
                </pre>
              </div>

              <div>
                <span className="font-semibold text-[var(--text-secondary)] block mb-1">执行回写 (result_payload):</span>
                <pre className="p-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-secondary)] font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedJob.resultPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dispatch Job */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-orbit-border bg-orbit-surface p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">派发异步运维任务进队</h3>
            <p className="text-xs text-[var(--text-muted)]">
              任务将以原子锁方式由独立 Worker 守护进程抢占调度，不阻塞 HTTP 业务响应。
            </p>
            <form onSubmit={handleDispatchJob} className="space-y-4 text-sm">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">选择任务类型 (job_type):</label>
                <select
                  value={dispatchType}
                  onChange={(e) => {
                    const nextType = e.target.value
                    setDispatchType(nextType)
                    const preset = JOB_TYPE_PRESETS.find((p) => p.type === nextType)
                    if (preset) {
                      setDispatchName(preset.label)
                      setDispatchPayload(JSON.stringify(preset.defaultPayload, null, 2))
                    }
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                >
                  {JOB_TYPE_PRESETS.map((p) => (
                    <option key={p.type} value={p.type}>
                      {p.label} ({p.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">自定义任务名称 (选填):</label>
                <input
                  placeholder="例如: 补录多平台日汇总聚合"
                  value={dispatchName}
                  onChange={(e) => setDispatchName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">输入参数 Payload (JSON):</label>
                <textarea
                  rows={4}
                  value={dispatchPayload}
                  onChange={(e) => setDispatchPayload(e.target.value)}
                  className="w-full p-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-orbit-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDispatchModal(false)}
                >
                  取消
                </Button>
                <Button type="submit" loading={submittingDispatch}>
                  提交派发进队
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default SystemJobsPage
