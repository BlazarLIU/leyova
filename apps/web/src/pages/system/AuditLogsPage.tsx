import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Shield, Search, RefreshCw, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
  { value: 'openclaw_config', label: 'OpenClaw 配置 (openclaw_config)' },
  { value: 'agency_client', label: '品牌客户 (agency_client)' },
  { value: 'agency_project', label: '代播项目 (agency_project)' },
  { value: 'settlement_bill', label: '结算对账单 (settlement_bill)' },
  { value: 'cost_entry', label: '经营成本 (cost_entry)' },
  { value: 'live_session', label: '直播场次/排班 (live_session)' },
  { value: 'content_provider', label: '内容生成服务 (content_provider)' },
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

export function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')

  const [applied, setApplied] = useState({ action: '', resourceType: '', from: '', to: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<AuditLogResponse>('/system/audit-logs', {
        page,
        pageSize,
        action: applied.action || undefined,
        resourceType: applied.resourceType || undefined,
        from: applied.from || undefined,
        to: applied.to ? `${applied.to}T23:59:59Z` : undefined,
      })
      setItems(data?.items || [])
      setTotal(data?.total || 0)
    } catch (err: any) {
      setError(err?.message || '获取操作审计日志失败')
    } finally {
      setLoading(false)
    }
  }, [page, applied])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleSearch = () => {
    setPage(1)
    setApplied({
      action: actionFilter.trim(),
      resourceType: resourceFilter,
      from: fromFilter,
      to: toFilter,
    })
  }

  const handleReset = () => {
    setActionFilter('')
    setResourceFilter('')
    setFromFilter('')
    setToFilter('')
    setPage(1)
    setApplied({ action: '', resourceType: '', from: '', to: '' })
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-cyan-400" />
            <span>操作审计日志</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            追踪账号权限变更、代运营对账、平台配置与核心数据修改的不可篡改记录（PostgreSQL RLS 受控）
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </Button>
      </motion.div>

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">动作关键词</label>
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="如 user.create / config.update"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">资源类型</label>
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {RESOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">开始日期</label>
              <input
                type="date"
                value={fromFilter}
                onChange={(e) => setFromFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">结束日期</label>
              <input
                type="date"
                value={toFilter}
                onChange={(e) => setToFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSearch} className="flex-1">
                <Search className="w-4 h-4" />
                <span>查询</span>
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <span>重置</span>
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <span className="font-semibold text-slate-100">审计记录</span>
            <span className="text-xs text-slate-400 font-mono">共 {total} 条</span>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-orbit-border text-xs uppercase text-slate-400 bg-white/[0.02]">
                <th className="py-3 px-4 font-medium">时间</th>
                <th className="py-3 px-4 font-medium">操作人</th>
                <th className="py-3 px-4 font-medium">动作</th>
                <th className="py-3 px-4 font-medium">资源对象</th>
                <th className="py-3 px-4 font-medium">来源 IP</th>
                <th className="py-3 px-4 font-medium text-right">变更详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orbit-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    正在加载审计日志...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    暂无符合条件的审计日志记录
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-medium">
                          {row.actorRealName || row.actorUsername || `UID:${row.actorUserId ?? 'system'}`}
                        </span>
                        {row.actorRole && (
                          <Badge variant="neutral">{row.actorRole}</Badge>
                        )}
                      </div>
                      {row.actorUsername && (
                        <div className="text-xs text-slate-500 font-mono">@{row.actorUsername}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant={actionBadgeVariant(row.action)}>
                        <span className="font-mono">{row.action}</span>
                      </Badge>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-slate-300 font-mono text-xs">{row.resourceType}</span>
                      {row.resourceId && (
                        <span className="ml-1.5 text-xs text-slate-500 font-mono">#{row.resourceId}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                      {row.ipAddress || '-'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button variant="ghost" size="xs" onClick={() => setSelectedLog(row)}>
                        <Eye className="w-3.5 h-3.5" />
                        <span>对比 Diff</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            第 {page} / {totalPages} 页（共 {total} 条）
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>上一页</span>
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>下一页</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

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
                <span className="text-sm text-slate-200 font-medium">
                  {selectedLog.resourceType}
                  {selectedLog.resourceId ? ` #${selectedLog.resourceId}` : ''}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString('zh-CN') : ''}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white/[0.02] border border-orbit-border/60 rounded-xl p-3">
                <div>
                  <span className="text-slate-500">操作账号：</span>
                  <span className="text-slate-200 font-mono">
                    {selectedLog.actorUsername || `UID:${selectedLog.actorUserId ?? 'system'}`} ({selectedLog.actorRole || '-'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">来源 IP：</span>
                  <span className="text-slate-200 font-mono">{selectedLog.ipAddress || '-'}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-500">User-Agent：</span>
                  <span className="text-slate-300 font-mono" title={selectedLog.userAgent || ''}>
                    {selectedLog.userAgent || '-'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-rose-400">变更前（Before）</div>
                  <pre className="rounded-xl border border-rose-500/20 bg-slate-950/70 p-3.5 text-xs font-mono text-slate-300 overflow-x-auto max-h-80">
                    {formatJson(selectedLog.beforeData)}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-emerald-400">变更后（After）</div>
                  <pre className="rounded-xl border border-emerald-500/20 bg-slate-950/70 p-3.5 text-xs font-mono text-slate-300 overflow-x-auto max-h-80">
                    {formatJson(selectedLog.afterData)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
