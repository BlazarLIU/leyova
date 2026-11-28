import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Inbox,
  ClipboardCheck,
  Check,
  X,
  LayoutGrid,
} from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { roleLabel } from '@/constants/roles'
import { cn } from '@/utils/cn'

interface WorkbenchWidget {
  id: string
  widgetKey: string
  title: string
  description: string | null
  moduleCode: string | null
  route: string | null
  widgetType: 'link' | 'metric' | 'action' | 'list' | 'ai'
  size: 'sm' | 'md' | 'lg' | 'full'
  sortOrder: number
}

interface WorkbenchPayload {
  workbench: { roleKey: string; variant: string; name: string; description: string | null } | null
  dataScope: 'self' | 'team' | 'org' | 'all'
  modules: string[]
  platforms: string[] | null
  widgets: WorkbenchWidget[]
}

interface PermissionRequest {
  id: string
  user_id?: number
  user_name?: string
  user_role?: string
  module_code: string
  module_name?: string | null
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  review_note?: string | null
  created_at: string
}

const SCOPE_LABELS: Record<string, string> = {
  self: '仅本人数据',
  team: '本团队数据',
  org: '本组织数据',
  all: '全部数据',
}

const SIZE_CLASS: Record<string, string> = {
  sm: 'sm:col-span-1',
  md: 'sm:col-span-1',
  lg: 'sm:col-span-2',
  full: 'sm:col-span-2 xl:col-span-3',
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  link: { label: '功能', className: 'bg-orbit-primary/15 text-orbit-primary' },
  metric: { label: '指标', className: 'bg-orbit-success/15 text-status-success' },
  action: { label: '待办', className: 'bg-orbit-warning/15 text-status-warning' },
  list: { label: '列表', className: 'bg-orbit-info/15 text-orbit-info' },
  ai: { label: 'AI', className: 'bg-orbit-accent/15 text-status-ai' },
}

const REVIEW_ROLES = ['super_admin', 'ops_director']

const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

function WidgetCard({ widget }: { widget: WorkbenchWidget }) {
  const badge = TYPE_BADGE[widget.widgetType] || TYPE_BADGE.link
  const isAi = widget.widgetType === 'ai'
  const body = (
    <div
      className={cn(
        'h-full rounded-2xl border p-5 flex flex-col gap-3 transition-colors',
        isAi
          ? 'border-orbit-accent/40 bg-orbit-accent/5 hover:border-orbit-accent/70'
          : 'border-orbit-border bg-orbit-surface/70 hover:border-orbit-primary/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isAi && <Sparkles className="w-4 h-4 text-status-ai flex-shrink-0" />}
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{widget.title}</h3>
        </div>
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0', badge.className)}>
          {badge.label}
        </span>
      </div>
      {widget.description && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{widget.description}</p>
      )}
      <div className="mt-auto flex items-center justify-between text-xs text-[var(--text-subtle)]">
        <span className="font-mono truncate">{widget.moduleCode || '公共'}</span>
        {widget.route && (
          <span className="inline-flex items-center gap-1 text-orbit-primary-light">
            进入 <ArrowRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  )

  if (!widget.route) {
    return <div className="h-full opacity-90">{body}</div>
  }
  return (
    <Link to={widget.route} className="block h-full">
      {body}
    </Link>
  )
}

export function WorkbenchPage() {
  const { user } = useAuth()
  const [payload, setPayload] = useState<WorkbenchPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mine, setMine] = useState<PermissionRequest[]>([])
  const [pending, setPending] = useState<PermissionRequest[]>([])
  const [reviewing, setReviewing] = useState(false)

  const canReview = Boolean(user && REVIEW_ROLES.includes(user.role))

  const loadWorkbench = useCallback(() => {
    setLoading(true)
    api
      .get<WorkbenchPayload>('/workbench/me')
      .then((res) => setPayload(res))
      .catch((err: any) => setError(err?.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  const loadMine = useCallback(() => {
    api.get<PermissionRequest[]>('/permission-requests/mine').then(setMine).catch(() => {})
  }, [])

  const loadPending = useCallback(() => {
    if (!canReview) return
    api
      .get<PermissionRequest[]>('/permission-requests', { status: 'pending' })
      .then(setPending)
      .catch(() => {})
  }, [canReview])

  useEffect(() => {
    loadWorkbench()
    loadMine()
    loadPending()
  }, [loadWorkbench, loadMine, loadPending])

  const review = async (id: string, action: 'approve' | 'reject') => {
    setReviewing(true)
    try {
      await api.post(`/permission-requests/${id}/${action}`, {})
      loadPending()
      loadMine()
    } catch (err: any) {
      setError(err?.message || '审批失败')
    } finally {
      setReviewing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const widgets = payload?.widgets ?? []
  const wb = payload?.workbench

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      <motion.div {...fadeIn} className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {wb?.name || '我的工作台'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {wb?.description || '按当前账号权限聚合的常用功能'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs bg-orbit-surface border border-orbit-border text-[var(--text-secondary)]">
            {roleLabel(user?.role)}
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs bg-orbit-success/10 border border-orbit-success/30 text-status-success inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            {SCOPE_LABELS[payload?.dataScope || 'self']}
          </span>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-orbit-danger/30 bg-orbit-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {widgets.length === 0 ? (
        <div className="rounded-2xl border border-orbit-border bg-orbit-surface/60 p-10 text-center space-y-3">
          <LayoutGrid className="w-8 h-8 mx-auto text-[var(--text-subtle)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            {wb ? '当前角色暂未配置可用的工作台组件' : '当前角色暂未配置工作台'}
          </p>
          <Link to="/overview/home" className="inline-flex items-center gap-1 text-sm text-orbit-primary">
            前往总览 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <motion.div {...fadeIn} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {widgets.map((w) => (
            <div key={w.id} className={SIZE_CLASS[w.size] || SIZE_CLASS.md}>
              <WidgetCard widget={w} />
            </div>
          ))}
        </motion.div>
      )}

      {/* 我的权限申请 */}
      <motion.section {...fadeIn} className="rounded-2xl border border-orbit-border bg-orbit-surface/60 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-4 h-4 text-[var(--text-subtle)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">我的权限申请</h2>
        </div>
        {mine.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            暂无申请。遇到 403 页面时可直接点击「申请权限」。
          </p>
        ) : (
          <div className="space-y-2">
            {mine.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orbit-border/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text-primary)]">
                    {r.module_name || r.module_code}
                    <span className="ml-2 font-mono text-[11px] text-[var(--text-subtle)]">{r.module_code}</span>
                  </p>
                  {r.reason && <p className="text-xs text-[var(--text-muted)] truncate">{r.reason}</p>}
                </div>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium',
                    r.status === 'pending' && 'bg-orbit-warning/15 text-status-warning',
                    r.status === 'approved' && 'bg-orbit-success/15 text-status-success',
                    r.status === 'rejected' && 'bg-orbit-danger/15 text-status-danger',
                    r.status === 'cancelled' && 'bg-orbit-border text-[var(--text-subtle)]',
                  )}
                >
                  {r.status === 'pending' ? '待审批' : r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '已驳回' : '已取消'}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* 管理端审批面板 */}
      {canReview && (
        <motion.section {...fadeIn} className="rounded-2xl border border-orbit-border bg-orbit-surface/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="w-4 h-4 text-[var(--text-subtle)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">权限申请审批</h2>
            <span className="px-1.5 py-0.5 rounded bg-orbit-primary/15 text-orbit-primary text-[10px]">
              {pending.length}
            </span>
          </div>
          {pending.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">没有待审批的申请。</p>
          ) : (
            <div className="space-y-2">
              {pending.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orbit-border/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">{r.user_name || r.user_id}</span>
                      <span className="mx-1.5 text-[var(--text-subtle)]">申请</span>
                      {r.module_name || r.module_code}
                      <span className="ml-2 font-mono text-[11px] text-[var(--text-subtle)]">{r.module_code}</span>
                    </p>
                    {r.reason && <p className="text-xs text-[var(--text-muted)] truncate">{r.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={reviewing}
                      onClick={() => review(r.id, 'approve')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orbit-success/15 text-status-success border border-orbit-success/30 text-xs hover:bg-orbit-success/25 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> 通过
                    </button>
                    <button
                      disabled={reviewing}
                      onClick={() => review(r.id, 'reject')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orbit-danger/10 text-status-danger border border-orbit-danger/30 text-xs hover:bg-orbit-danger/20 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> 驳回
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      )}
    </div>
  )
}
