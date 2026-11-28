import { useState, useCallback, useMemo } from 'react'
import { Shield, Eye, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable, type TableFetchParams } from '@/components/common/useTable'
import { api } from '@/services/api'

interface AuditLogItem {
  id: string
  actorUserId: number | null
  actorUsername: string | null
  actorRealName: string | null
  actorRole: string | null
  action: string
  resourceType: string
  resourceId: string | null
  beforeData: any
  afterData: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

interface AuditLogResponse {
  total: number
  page: number
  pageSize: number
  items: AuditLogItem[]
}

const RESOURCE_OPTIONS = [
  { value: '', label: '全部资源类型' },
  { value: 'user', label: '账号 (user)' },
  { value: 'role_modules', label: '角色模块权限 (role_modules)' },
  { value: 'platform', label: '平台启用状态 (platform)' },
  { value: 'platform_permission', label: '平台权限矩阵 (platform_permission)' },
  { value: 'system_config', label: '系统配置 (system_config)' },
  { value: 'kb_config', label: '知识库配置 (kb_config)' },
  { value: 'cost_entry', label: '经营成本 (cost_entry)' },
  { value: 'live_session', label: '直播场次/排班 (live_session)' },
  { value: 'alert_rules', label: '阈值告警规则 (alert_rules)' },
  { value: 'clean_rule_set', label: '清洗规则 (clean_rule_set)' },
]

function actionBadgeVariant(action: string): 'danger' | 'warning' | 'success' | 'info' | 'neutral' {
  if (action.includes('delete') || action.includes('reverse')) return 'danger'
  if (action.includes('permission') || action.includes('role') || action.includes('config')) return 'warning'
  if (action.includes('create') || action.includes('confirm') || action.includes('finalize') || action.includes('resolve')) return 'success'
  if (action.includes('update')) return 'info'
  return 'neutral'
}

function formatJson(value: any): string {
  if (value === null || value === undefined) return '（无数据）'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

interface AuditLogFilters {
  resourceType: string
  from: string
  to: string
}

export function AuditLogsPage() {
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const fetchLogs = useCallback(
    async (params: TableFetchParams<AuditLogFilters>) => {
      const data = await api.get<AuditLogResponse>('/system/audit-logs', {
        page: params.page,
        pageSize: params.pageSize,
        action: params.search || undefined,
        resourceType: params.filters.resourceType || undefined,
        from: params.filters.from || undefined,
        to: params.filters.to ? `${params.filters.to}T23:59:59Z` : undefined,
      })

      return {
        items: data?.items || [],
        total: data?.total || 0,
      }
    },
    []
  )

  const table = useTable<AuditLogItem, AuditLogFilters>({
    fetchData: fetchLogs,
    initialPageSize: 20,
    initialFilters: {
      resourceType: '',
      from: '',
      to: '',
    },
    getRowId: (row) => row.id,
  })

  const columns = useMemo<ColumnDef<AuditLogItem>[]>(
    () => [
      {
        key: 'createdAt',
        header: '时间',
        sortable: true,
        render: (v) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {v ? new Date(v).toLocaleString('zh-CN') : '-'}
          </span>
        ),
      },
      {
        key: 'actor',
        header: '操作人',
        render: (_, row) => (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-secondary)] font-medium">
                {row.actorRealName || row.actorUsername || `UID:${row.actorUserId ?? 'system'}`}
              </span>
              {row.actorRole && <Badge variant="neutral">{row.actorRole}</Badge>}
            </div>
            {row.actorUsername && (
              <div className="text-[11px] text-[var(--text-muted)] font-mono">@{row.actorUsername}</div>
            )}
          </div>
        ),
      },
      {
        key: 'action',
        header: '动作',
        render: (v) => (
          <Badge variant={actionBadgeVariant(v)}>
            <span className="font-mono text-xs">{v}</span>
          </Badge>
        ),
      },
      {
        key: 'resourceType',
        header: '资源对象',
        render: (v, row) => (
          <div>
            <span className="text-[var(--text-secondary)] font-mono text-xs">{v}</span>
            {row.resourceId && (
              <span className="ml-1.5 text-xs text-[var(--text-muted)] font-mono">#{row.resourceId}</span>
            )}
          </div>
        ),
      },
      {
        key: 'ipAddress',
        header: '来源 IP',
        render: (v) => <span className="font-mono text-xs text-[var(--text-muted)]">{v || '-'}</span>,
      },
      {
        key: 'diff',
        header: '变更详情',
        align: 'right',
        render: (_, row) => (
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedLog(row)
            }}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            <span>对比 Diff</span>
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <>
      <DataPage<AuditLogItem>
        title={
          <span className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-status-ai" />
            <span>操作审计日志</span>
          </span>
        }
        subtitle="追踪账号权限变更、代运营对账、平台配置与核心数据修改的不可篡改记录（PostgreSQL RLS 受控）"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-[var(--text-muted)] border border-orbit-border">
            已接入 DataPage
          </span>
        }
        table={table}
        columns={columns}
        searchPlaceholder="搜索动作关键词 (如 user.create / config.update)..."
        exportFilename="audit_logs"
        emptyMessage="暂无符合条件的审计日志记录"
        filterControls={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={table.filters.resourceType}
              onChange={(e) => table.setFilter('resourceType', e.target.value)}
              className="h-9 px-3 rounded-lg border border-orbit-border bg-orbit-surface2 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-orbit-primary"
            >
              {RESOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <Input
              type="date"
              value={table.filters.from}
              onChange={(e) => table.setFilter('from', e.target.value)}
              className="h-9 text-xs w-36"
              placeholder="开始日期"
            />
            <span className="text-[var(--text-muted)] text-xs">至</span>
            <Input
              type="date"
              value={table.filters.to}
              onChange={(e) => table.setFilter('to', e.target.value)}
              className="h-9 text-xs w-36"
              placeholder="结束日期"
            />
          </div>
        }
      />

      {/* Before / After Diff Drawer Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="w-full max-w-4xl bg-orbit-surface2 border border-orbit-border rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-orbit-border">
              <div className="flex items-center gap-3">
                <Badge variant={actionBadgeVariant(selectedLog.action)}>
                  <span className="font-mono">{selectedLog.action}</span>
                </Badge>
                <span className="text-sm text-[var(--text-secondary)] font-medium">
                  {selectedLog.resourceType}
                  {selectedLog.resourceId ? ` #${selectedLog.resourceId}` : ''}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString('zh-CN') : ''}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white/[0.02] border border-orbit-border/60 rounded-xl p-3">
                <div>
                  <span className="text-[var(--text-muted)]">操作账号：</span>
                  <span className="text-[var(--text-secondary)] font-mono">
                    {selectedLog.actorUsername || `UID:${selectedLog.actorUserId ?? 'system'}`} ({selectedLog.actorRole || '-'})
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">来源 IP：</span>
                  <span className="text-[var(--text-secondary)] font-mono">{selectedLog.ipAddress || '-'}</span>
                </div>
                <div className="truncate">
                  <span className="text-[var(--text-muted)]">User-Agent：</span>
                  <span className="text-[var(--text-secondary)] font-mono" title={selectedLog.userAgent || ''}>
                    {selectedLog.userAgent || '-'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-status-danger">变更前（Before）</div>
                  <pre className="rounded-xl border border-orbit-danger/20 bg-orbit-ink/70 p-3.5 text-xs font-mono text-orbit-snow/80 overflow-x-auto max-h-80">
                    {formatJson(selectedLog.beforeData)}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-status-success">变更后（After）</div>
                  <pre className="rounded-xl border border-orbit-success/20 bg-orbit-ink/70 p-3.5 text-xs font-mono text-orbit-snow/80 overflow-x-auto max-h-80">
                    {formatJson(selectedLog.afterData)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AuditLogsPage
