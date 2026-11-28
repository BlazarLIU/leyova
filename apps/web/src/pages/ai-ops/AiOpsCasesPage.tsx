import { useCallback, useEffect, useState } from 'react'
import {
  GitBranch,
  CheckCircle2,
  XCircle,
  Play,
  Gauge,
  Search,
  FileText,
  Send,
  ShieldAlert,
  Ban,
  Archive,
  ClipboardCheck,
  Download,
  Calendar,
} from 'lucide-react'
import { toast } from '@/utils/toast'
import {
  fetchDecisionCases,
  decisionCaseAction,
  evalDecisionGates,
  fetchDecisionReviews,
  fetchDecisionMetricSnapshots,
  type DecisionCaseItem,
  type DecisionCaseAction,
  type DecisionCaseStatus,
  type DecisionGateItem,
  type DecisionReviewItem,
  type DecisionMetricSnapshotItem,
} from '@/services/ai-ops-data'

const ATTRIBUTION_GRADE_MAP: Record<string, { label: string; style: string }> = {
  GRADE_A: { label: 'A级 · 平台回传/行级验证', style: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  GRADE_B: { label: 'B级 · 规则推导/可复算', style: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  GRADE_C: { label: 'C级 · 人工估算/有依据', style: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  GRADE_D: { label: 'D级 · 纯业务假设', style: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  EXPERIMENTAL: { label: 'A级 · 强因果实验', style: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  ADJUSTED: { label: 'B级 · 统计校准/规则推导', style: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  OBSERVED: { label: 'C级 · 纯观测数据', style: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
}

const STATUS_LABEL: Record<DecisionCaseStatus, string> = {
  DRAFT: '草稿',
  INVESTIGATING: '调查中',
  PROPOSED: '已提案',
  AWAITING_APPROVAL: '待审批',
  APPROVED: '已批准',
  EXECUTING: '执行中',
  AWAITING_REVIEW: '待复核',
  REVIEWED: '已复核',
  LEARNED: '已沉淀 (Learned)',
  ARCHIVED: '已归档',
  DATA_INSUFFICIENT: '数据不足',
  BLOCKED: '已阻断',
  REJECTED: '已驳回',
  CANCELLED: '已取消',
}

const STATUS_STYLE: Record<DecisionCaseStatus, string> = {
  DRAFT: 'text-[var(--text-muted)] border-[var(--border)] bg-orbit-surface2',
  INVESTIGATING: 'text-status-ai border-orbit-success/30 bg-orbit-success/10',
  PROPOSED: 'text-status-ai border-orbit-success/30 bg-orbit-success/10',
  AWAITING_APPROVAL: 'text-status-warning border-orbit-warning/30 bg-orbit-warning/10',
  APPROVED: 'text-status-ai border-orbit-success/30 bg-orbit-success/10',
  EXECUTING: 'text-status-ai border-orbit-success/30 bg-orbit-success/10',
  AWAITING_REVIEW: 'text-status-warning border-orbit-warning/30 bg-orbit-warning/10',
  REVIEWED: 'text-status-success border-orbit-success/30 bg-orbit-success/10',
  LEARNED: 'text-status-ai border-orbit-success/40 bg-orbit-success/20',
  ARCHIVED: 'text-[var(--text-muted)] border-[var(--border)] bg-orbit-surface2',
  DATA_INSUFFICIENT: 'text-status-danger border-orbit-danger/30 bg-orbit-danger/10',
  BLOCKED: 'text-status-danger border-orbit-danger/30 bg-orbit-danger/10',
  REJECTED: 'text-status-danger border-orbit-danger/30 bg-orbit-danger/10',
  CANCELLED: 'text-[var(--text-muted)] border-[var(--border)] bg-orbit-surface2',
}

const GATE_LABEL: Record<string, string> = {
  PASS: '通过',
  FAIL: '未通过',
  NOT_EVALUABLE: '不可评估',
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'INVESTIGATING', label: '调查中' },
  { key: 'AWAITING_APPROVAL', label: '待审批' },
  { key: 'APPROVED', label: '已批准' },
  { key: 'EXECUTING', label: '执行中' },
  { key: 'AWAITING_REVIEW', label: '待复核' },
  { key: 'REVIEWED', label: '已复核' },
  { key: 'LEARNED', label: '已沉淀 (Learned)' },
  { key: 'ARCHIVED', label: '已归档' },
]

const ACTION_LABEL: Record<string, string> = {
  investigate: '开始调查',
  propose: '形成提案',
  submit: '提交审批',
  approve: '批准',
  reject: '驳回',
  apply: '执行',
  measure: '度量',
  review: '复核',
  learn: '沉淀经验',
  close: '归档',
  block: '阻断',
  cancel: '取消',
  'mark-data-insufficient': '标记数据不足',
}

function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function renderFactsSection(title: string, value: unknown) {
  if (value == null) return null
  const list = Array.isArray(value) ? value : [value]
  if (list.length === 0) return null
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-1.5">
      <p className="text-xs font-bold">{title}</p>
      {list.map((entry, i) => (
        <p key={i} className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">
          {typeof entry === 'string'
            ? entry
            : entry && typeof entry === 'object'
              ? Object.entries(entry as Record<string, unknown>)
                  .map(([k, v]) => `${k}: ${formatValue(v)}`)
                  .join(' · ')
              : formatValue(entry)}
        </p>
      ))}
    </div>
  )
}

export function AiOpsCasesPage() {
  const [cases, setCases] = useState<DecisionCaseItem[]>([])
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [gatesMap, setGatesMap] = useState<Record<number, DecisionGateItem[]>>({})
  const [evaluatingGateId, setEvaluatingGateId] = useState<number | null>(null)
  const [reviewsMap, setReviewsMap] = useState<Record<number, DecisionReviewItem[]>>({})
  const [snapshotsMap, setSnapshotsMap] = useState<Record<number, DecisionMetricSnapshotItem[]>>({})
  const [reviewWindow, setReviewWindow] = useState<number | null>(null)

  useEffect(() => {
    if (expanded) {
      fetchDecisionReviews(expanded).then((revs) => setReviewsMap((prev) => ({ ...prev, [expanded]: revs })))
      fetchDecisionMetricSnapshots(expanded).then((snaps) => setSnapshotsMap((prev) => ({ ...prev, [expanded]: snaps })))
    }
  }, [expanded])

  const load = useCallback(() => {
    setLoading(true)
    fetchDecisionCases(status)
      .then(setCases)
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => { load() }, [load])

  const handleExportMemo = async (caseId: number, caseNo: string) => {
    try {
      const res = await fetch(`/api/v1/decision-cases/${caseId}/export`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('导出失败')
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Decision_Memo_${caseNo}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`决策备忘录 ${caseNo} 导出成功`)
    } catch {
      toast.error('导出决策备忘录失败')
    }
  }

  const handleEvalGates = async (caseId: number) => {
    setEvaluatingGateId(caseId)
    try {
      const res = await evalDecisionGates(caseId)
      if (res?.gates) {
        setGatesMap((prev) => ({ ...prev, [caseId]: res.gates }))
        toast.success(`门禁校验完成：${res.overallStatus === 'PASS' ? 'Gate 1 全部通过' : 'Gate 1 存在未满足硬性项'}`)
        load()
      }
    } catch {
      toast.error('评估门禁失败')
    } finally {
      setEvaluatingGateId(null)
    }
  }

  const run = async (item: DecisionCaseItem, action: DecisionCaseAction) => {
    setBusyId(item.id)
    const res = await decisionCaseAction(item.id, action)
    setBusyId(null)
    if (!res.ok) {
      toast.error(res.message || '操作失败')
      return
    }
    toast.success(`决策案 ${item.caseNo} 已${ACTION_LABEL[action] || '更新'}`)
    load()
  }

  const renderActions = (item: DecisionCaseItem) => {
    const disabled = busyId === item.id
    const gateBlocked = item.dataGateStatus !== 'PASS'
    const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
    const secondary = 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-orbit-surface2'

    const gateHint = gateBlocked
      ? `数据门禁为「${GATE_LABEL[item.dataGateStatus] || item.dataGateStatus}」，不可提案 / 提交 / 审批`
      : undefined

    const body = (() => {
      switch (item.status) {
        case 'DRAFT':
          return (
            <div className="flex flex-wrap gap-2">
              <button disabled={disabled} className={`${btn} border-orbit-success/40 text-status-ai`} onClick={() => run(item, 'investigate')}>
                <Search className="inline w-3.5 h-3.5 mr-1" />开始调查
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'mark-data-insufficient')}>
                数据不足
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'cancel')}>取消</button>
            </div>
          )
        case 'INVESTIGATING':
          return (
            <div className="flex flex-wrap gap-2">
              <button
                disabled={disabled || gateBlocked}
                title={gateHint}
                className={`${btn} border-orbit-success/40 text-status-ai`}
                onClick={() => run(item, 'propose')}
              >
                <FileText className="inline w-3.5 h-3.5 mr-1" />形成提案
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'block')}>
                <ShieldAlert className="inline w-3.5 h-3.5 mr-1" />阻断
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'cancel')}>取消</button>
            </div>
          )
        case 'PROPOSED':
          return (
            <div className="flex flex-wrap gap-2">
              <button
                disabled={disabled || gateBlocked}
                title={gateHint}
                className={`${btn} border-orbit-success/40 text-status-ai`}
                onClick={() => run(item, 'submit')}
              >
                <Send className="inline w-3.5 h-3.5 mr-1" />提交审批
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'block')}>
                <ShieldAlert className="inline w-3.5 h-3.5 mr-1" />阻断
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'cancel')}>取消</button>
            </div>
          )
        case 'AWAITING_APPROVAL':
          return (
            <div className="flex flex-wrap gap-2">
              <button
                disabled={disabled || gateBlocked}
                title={gateHint}
                className={`${btn} border-orbit-success/40 text-status-ai`}
                onClick={() => run(item, 'approve')}
              >
                <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />批准
              </button>
              <button disabled={disabled} className={`${btn} border-orbit-danger/40 text-status-danger`} onClick={() => run(item, 'reject')}>
                <XCircle className="inline w-3.5 h-3.5 mr-1" />驳回
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'block')}>
                <ShieldAlert className="inline w-3.5 h-3.5 mr-1" />阻断
              </button>
            </div>
          )
        case 'APPROVED':
          return (
            <div className="flex flex-wrap gap-2">
              <button disabled={disabled} className={`${btn} border-orbit-success/40 text-status-ai`} onClick={() => run(item, 'apply')}>
                <Play className="inline w-3.5 h-3.5 mr-1" />执行并入库
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'block')}>
                <ShieldAlert className="inline w-3.5 h-3.5 mr-1" />阻断
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'cancel')}>取消</button>
            </div>
          )
        case 'EXECUTING':
          return (
            <div className="flex flex-wrap gap-2">
              <button disabled={disabled} className={`${btn} border-orbit-warning/40 text-status-warning`} onClick={() => run(item, 'measure')}>
                <Gauge className="inline w-3.5 h-3.5 mr-1" />立即度量
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'block')}>
                <ShieldAlert className="inline w-3.5 h-3.5 mr-1" />阻断
              </button>
            </div>
          )
        case 'AWAITING_REVIEW':
          return (
            <div className="flex flex-wrap gap-2">
              <button disabled={disabled} className={`${btn} border-orbit-success/40 text-status-ai`} onClick={() => run(item, 'review')}>
                <ClipboardCheck className="inline w-3.5 h-3.5 mr-1" />复核
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'block')}>
                <ShieldAlert className="inline w-3.5 h-3.5 mr-1" />阻断
              </button>
            </div>
          )
        case 'REVIEWED':
          return (
            <div className="flex flex-wrap gap-2">
              <button disabled={disabled} className={`${btn} border-orbit-success/40 text-status-ai`} onClick={() => run(item, 'learn')}>
                <ClipboardCheck className="inline w-3.5 h-3.5 mr-1" />沉淀经验 (Learn)
              </button>
              <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'close')}>
                <Archive className="inline w-3.5 h-3.5 mr-1" />归档
              </button>
            </div>
          )
        case 'LEARNED':
          return (
            <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'close')}>
              <Archive className="inline w-3.5 h-3.5 mr-1" />归档
            </button>
          )
        case 'BLOCKED':
          return (
            <button disabled={disabled} className={`${btn} ${secondary}`} onClick={() => run(item, 'cancel')}>
              <Ban className="inline w-3.5 h-3.5 mr-1" />取消
            </button>
          )
        default:
          return null
      }
    })()
    return body
  }

  const displayCases = cases.filter((item) => {
    if (reviewWindow === null) return true
    if (!item.measureAfter) return false
    const target = new Date(item.measureAfter).getTime()
    const now = Date.now()
    const diffDays = Math.ceil((target - now) / (86400 * 1000))
    return diffDays >= 0 && diffDays <= reviewWindow
  })

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              治理 · 决策案
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              DRAFT → INVESTIGATING → PROPOSED → AWAITING_APPROVAL → APPROVED → EXECUTING → AWAITING_REVIEW → REVIEWED → ARCHIVED
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-status-ai" />
            调查与决策
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            每个决策案至少两个方案并包含「不做」；数据门禁非 PASS 时不可提案、提交或审批（异常态：数据不足 / 阻断 / 驳回 / 取消）。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setStatus(f.key); setReviewWindow(null) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                status === f.key && reviewWindow === null
                  ? 'bg-orbit-ink text-orbit-snow border-orbit-ink'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-orbit-surface2'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs border border-[var(--border)] rounded-lg p-1 bg-orbit-surface2/30">
          <span className="text-[11px] text-[var(--text-muted)] px-1.5 flex items-center gap-1 font-semibold">
            <Calendar className="w-3.5 h-3.5 text-status-ai" />
            复核调度:
          </span>
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setReviewWindow(reviewWindow === days ? null : days)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                reviewWindow === days
                  ? 'bg-orbit-primary text-white'
                  : 'text-[var(--text-secondary)] hover:bg-orbit-surface2'
              }`}
            >
              T+{days}天
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-status-ai">
          <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayCases.length === 0 ? (
        <div className="p-10 rounded-2xl border border-[var(--border)] bg-orbit-ink/60 text-center text-sm text-[var(--text-muted)]">
          暂无决策案。在复盘页点击「行动项生成决策案」即可产生。
        </div>
      ) : (
        <div className="space-y-3">
          {displayCases.map((item) => {
            const impact = item.expectedImpact || {}
            const isOpen = expanded === item.id
            const gateBlocked = item.dataGateStatus !== 'PASS'
            return (
              <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl p-5 space-y-3">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80">{item.caseNo}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${STATUS_STYLE[item.status] || STATUS_STYLE.DRAFT}`}>
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                          gateBlocked
                            ? 'text-status-danger border-orbit-danger/30 bg-orbit-danger/10'
                            : 'text-status-success border-orbit-success/30 bg-orbit-success/10'
                        }`}
                      >
                        数据门禁 {GATE_LABEL[item.dataGateStatus] || item.dataGateStatus}
                      </span>
                      <span className="text-[11px] font-bold text-status-warning border border-orbit-warning/30 bg-orbit-warning/10 px-2 py-0.5 rounded">
                        {item.riskLevel}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">{item.domain}</span>
                    </div>
                    <h3 className="text-[15px] font-bold truncate">{item.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">{item.problemStatement}</p>
                  </div>
                  <div className="flex-shrink-0">{renderActions(item)}</div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs rounded-lg border border-[var(--border)] bg-orbit-surface2 p-3">
                  <div>
                    <span className="block text-[10.5px] text-[var(--text-subtle)]">预期影响</span>
                    <span className="font-mono">
                      {impact.metricCode
                        ? `${impact.metricCode}: ${impact.from} → ${impact.to}${impact.unit || ''}`
                        : '未填写'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10.5px] text-[var(--text-subtle)]">责任岗</span>
                    <span>{item.ownerName || '未指定'}</span>
                  </div>
                  <div>
                    <span className="block text-[10.5px] text-[var(--text-subtle)]">度量日</span>
                    <span className="font-mono">{item.measureAfter}</span>
                  </div>
                  <div>
                    <span className="block text-[10.5px] text-[var(--text-subtle)]">度量结果</span>
                    <span className="font-mono">
                      {item.outcome?.actual != null ? `${item.outcome.actual}（${item.outcome.samples} 场）` : item.outcomeStatus}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="text-[11.5px] font-semibold text-status-ai hover:underline"
                >
                  {isOpen ? '收起事实/方案/证据' : '展开事实/方案/证据'}
                </button>

                {isOpen && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs rounded-lg border border-[var(--border)] p-3">
                      <div>
                        <span className="block text-[10.5px] text-[var(--text-subtle)]">场景</span>
                        <span className="font-mono">{item.sceneKey}</span>
                      </div>
                      <div>
                        <span className="block text-[10.5px] text-[var(--text-subtle)]">归因等级</span>
                        <span className={`inline-block font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${ATTRIBUTION_GRADE_MAP[item.attributionGrade]?.style || 'border-[var(--border)]'}`}>
                          {ATTRIBUTION_GRADE_MAP[item.attributionGrade]?.label || item.attributionGrade}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10.5px] text-[var(--text-subtle)]">金额状态</span>
                        <span className="font-mono">{item.amountState}</span>
                      </div>
                      <div>
                        <span className="block text-[10.5px] text-[var(--text-subtle)]">指标合同</span>
                        <span className="font-mono">{item.metricContractVersion}</span>
                      </div>
                      <div>
                        <span className="block text-[10.5px] text-[var(--text-subtle)]">Memo 版本</span>
                        <span className="font-mono">v{item.memoVersion}</span>
                      </div>
                    </div>

                    {item.status === 'LEARNED' && (
                      <div className="rounded-lg border border-orbit-success/40 bg-orbit-success/10 p-3 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-status-ai">
                          <ClipboardCheck className="w-4 h-4" />
                          已沉淀为决策记忆 (Learned)
                        </div>
                        <p className="text-[var(--text-secondary)]">{item.learningSummary || '复盘结论已固化，纳入系统决策记忆。'}</p>
                      </div>
                    )}

                    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2 bg-orbit-surface2/60">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-status-ai" />
                          分层数据门禁（Gate 1 硬性一票否决 / Gate 2 可信度）
                        </p>
                        <button
                          type="button"
                          disabled={evaluatingGateId === item.id}
                          onClick={() => handleEvalGates(item.id)}
                          className="text-[11px] px-2.5 py-0.5 rounded border border-orbit-success/40 text-status-ai hover:bg-orbit-success/10 transition"
                        >
                          {evaluatingGateId === item.id ? '正在校验...' : '执行门禁诊断'}
                        </button>
                      </div>
                      {gatesMap[item.id] ? (
                        <div className="space-y-1.5 pt-1">
                          {gatesMap[item.id].map((g, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] p-2 rounded bg-orbit-ink/40 border border-[var(--border)]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${g.gateTier === 'GATE_1_HARD' ? 'bg-orbit-danger/20 text-status-danger border border-orbit-danger/30' : 'bg-orbit-warning/20 text-status-warning border border-orbit-warning/30'}`}>
                                  {g.gateTier === 'GATE_1_HARD' ? 'Gate 1 硬性' : 'Gate 2 可信度'}
                                </span>
                                <span className="font-mono text-[var(--text-primary)] font-semibold">{g.checkItem}</span>
                                <span className="text-[var(--text-muted)] text-[10.5px]">{g.message}</span>
                              </div>
                              <span className={`font-bold px-2 py-0.5 rounded text-[10px] self-start sm:self-auto ${g.status === 'PASS' ? 'text-status-success bg-orbit-success/15' : 'text-status-danger bg-orbit-danger/15'}`}>
                                {g.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[var(--text-muted)]">点击右上角“执行门禁诊断”即可对广告消耗、订单归因、商品成本等硬性门禁进行秒级核查。</p>
                      )}
                    </div>

                    {/* ── 结构化决策备忘录 (Decision Memo 八段结构) ── */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                        <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-status-ai" />
                          结构化决策备忘录 (Decision Memo 八段全量结构)
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-[var(--text-subtle)]">
                            Memo v{item.memoVersion} · {item.metricContractVersion}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleExportMemo(item.id, item.caseNo)}
                            className="inline-flex items-center gap-1 rounded bg-orbit-surface2 hover:bg-orbit-surface3 border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors"
                          >
                            <Download className="w-3 h-3 text-status-ai" />
                            <span>导出 Memo</span>
                          </button>
                        </div>
                      </div>

                      {/* 1. 核心问题 */}
                      <div className="rounded-lg border border-[var(--border)] p-3 bg-orbit-surface2/40">
                        <span className="text-[10px] font-bold text-status-ai uppercase tracking-wider block mb-1">
                          【1. 核心问题 / Core Question】
                        </span>
                        <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">
                          {impact.core_question || item.problemStatement}
                        </p>
                      </div>

                      {/* 2、3、4: 事实、假设、预测 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {renderFactsSection('【2. 事实依据 / Facts】', impact.facts || '基于近期全量交易流水与广告消耗真实数据沉淀')}
                        {renderFactsSection('【3. 归因假设 / Hypotheses】', impact.hypotheses || '归因于计划投放偏离度与主播商品转化匹配度')}
                        {renderFactsSection('【4. 预测影响 / Forecasts】', impact.forecasts ?? impact.prediction ?? (impact.metricCode ? `${impact.metricCode}: ${impact.from} → ${impact.to}${impact.unit || ''}` : '待门禁通过后量化测算'))}
                      </div>

                      {/* 5. 方案对比 */}
                      <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-status-ai uppercase tracking-wider">
                            【5. 决策方案对比 / Options】（共 {item.options.length} 个方案）
                          </span>
                          {item.options.length < 2 && (
                            <span className="text-[11px] text-status-danger font-semibold">
                              方案不足 2 个（必须包含「不做 / 维持现状」），不可提案
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {item.options.map((o) => (
                            <div
                              key={o.key}
                              className={`rounded-md p-2.5 text-xs border ${
                                item.chosenOption === o.key
                                  ? 'border-orbit-success/40 bg-orbit-success/10'
                                  : 'border-[var(--border)]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-[var(--text-primary)]">{o.label}</span>
                                {item.chosenOption === o.key ? (
                                  <span className="text-[10px] text-status-ai font-bold px-1.5 py-0.5 rounded bg-orbit-success/20">
                                    已选执行方案
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[var(--text-muted)] font-mono">{o.key}</span>
                                )}
                              </div>
                              {o.pros && (
                                <p className="text-[var(--text-muted)] mt-1 text-[11.5px]">
                                  <span className="text-emerald-400 font-medium">优点：</span>{o.pros}
                                </p>
                              )}
                              {o.cons && (
                                <p className="text-[var(--text-muted)] text-[11.5px]">
                                  <span className="text-rose-400 font-medium">代价/风险：</span>{o.cons}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 6. 证据链条 */}
                      <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
                        <span className="text-[10px] font-bold text-status-ai uppercase tracking-wider block">
                          【6. 证据快照与指标合同 / Evidence Items】
                        </span>
                        {item.evidence.length === 0 ? (
                          <p className="text-xs text-[var(--text-muted)]">无独立指标快照引用，数据由底层事实表直接汇总</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {item.evidence.map((e: any, i: number) => (
                              <div
                                key={i}
                                className="text-[11px] p-2 rounded bg-orbit-ink/30 border border-[var(--border)] font-mono flex items-center justify-between"
                              >
                                <span className="text-[var(--text-muted)] truncate">{e.metric}</span>
                                <span className="font-bold text-[var(--text-primary)]">{String(e.value ?? '')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 7. 执行与责任人 */}
                      <div className="rounded-lg border border-[var(--border)] p-3 bg-orbit-surface2/30">
                        <span className="text-[10px] font-bold text-status-ai uppercase tracking-wider block mb-1">
                          【7. 执行与责任人 / Execution & Owners】
                        </span>
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <div>
                            <span className="text-[var(--text-muted)]">核心责任人：</span>
                            <span className="font-semibold text-[var(--text-primary)]">{item.ownerName || '运营操盘负责人'}</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)]">度量验证周期：</span>
                            <span className="font-mono text-status-ai">{item.measureAfter || 'T+7 天复核'}</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)]">协同团队：</span>
                            <span>
                              {Array.isArray(impact.execution_owners)
                                ? impact.execution_owners.join(', ')
                                : '直播中控团队、投手团队'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 8. 复核与学习 */}
                      <div className="rounded-lg border border-[var(--border)] p-3 bg-orbit-surface2/30">
                        <span className="text-[10px] font-bold text-status-ai uppercase tracking-wider block mb-1">
                          【8. 复核与学习 / Review & Learning】
                        </span>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {item.learningSummary ||
                            impact.review_learning ||
                            (item.status === 'LEARNED'
                              ? '复盘经验已固化，纳入企业经验库。'
                              : '待度量验证期结束后由负责人完成复核与经验沉淀。')}
                        </p>
                      </div>
                    </div>

                    {/* ── 决策复核记录与阶段指标快照 (Migration 216 原语) ── */}
                    {((reviewsMap[item.id] && reviewsMap[item.id].length > 0) ||
                      (snapshotsMap[item.id] && snapshotsMap[item.id].length > 0)) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {reviewsMap[item.id]?.length > 0 && (
                          <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
                            <p className="text-xs font-bold text-[var(--text-primary)]">
                              决策复核历史 ({reviewsMap[item.id].length})
                            </p>
                            {reviewsMap[item.id].map((rev) => (
                              <div
                                key={rev.id}
                                className="text-[11px] p-2 rounded bg-orbit-ink/40 border border-[var(--border)] space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-[var(--text-subtle)]">
                                    {new Date(rev.reviewDate || rev.createdAt).toLocaleDateString()}
                                  </span>
                                  <span className="font-bold text-status-ai">{rev.status}</span>
                                </div>
                                <p className="text-[var(--text-muted)]">{rev.learnings || '无复盘总结记录'}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {snapshotsMap[item.id]?.length > 0 && (
                          <div className="rounded-lg border border-[var(--border)] p-3 space-y-2">
                            <p className="text-xs font-bold text-[var(--text-primary)]">
                              阶段指标快照 ({snapshotsMap[item.id].length})
                            </p>
                            <div className="space-y-1">
                              {snapshotsMap[item.id].map((snap) => (
                                <div
                                  key={snap.id}
                                  className="flex items-center justify-between text-[11px] p-1.5 rounded bg-orbit-ink/30 font-mono"
                                >
                                  <span className="text-[var(--text-muted)]">
                                    [{snap.snapshotStage}] {snap.metricCode}
                                  </span>
                                  <span className="font-bold text-[var(--text-primary)]">{snap.metricValue}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
