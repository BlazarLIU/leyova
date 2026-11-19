import { useEffect, useState } from 'react'
import { Shield, ToggleLeft, ToggleRight, Loader2, Lock } from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'

interface ModuleRow {
  code: string
  name: string
  icon?: string
  sort_order?: number
  is_enabled: boolean
  is_core: boolean
  assigned_roles?: string[]
}

/**
 * 模块热插拔（P2-3）
 *
 * - 仅超级管理员可开启/关闭模块；
 * - 核心模块（业务主链 + 系统管理 + AI 运营数据引用）受保护，不可关闭；
 * - 关闭的模块对所有角色（含超管）从导航隐藏，接口访问返回 403；
 * - 只影响「可见性/访问」，不删数据、不影响 AI 运营子系统对数据表的直接引用。
 */
export function ModuleManagementPage() {
  const { isSuperAdmin } = useAuth()
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = () => {
    setLoading(true)
    api
      .get<ModuleRow[]>('/system/modules')
      .then((rows) => setModules(rows || []))
      .catch(() => setMsg({ type: 'err', text: '加载模块列表失败' }))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggle = async (m: ModuleRow) => {
    if (!isSuperAdmin) {
      setMsg({ type: 'err', text: '仅超级管理员可开关模块' })
      return
    }
    if (m.is_core) {
      setMsg({ type: 'err', text: '核心模块不可关闭' })
      return
    }
    setSaving(m.code)
    setMsg(null)
    try {
      await api.put(`/system/modules/${m.code}/enabled`, { enabled: !m.is_enabled })
      setModules((prev) => prev.map((x) => (x.code === m.code ? { ...x, is_enabled: !x.is_enabled } : x)))
      setMsg({ type: 'ok', text: `模块「${m.name}」已${!m.is_enabled ? '开启' : '关闭'}` })
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || '操作失败' })
    } finally {
      setSaving(null)
    }
  }

  const core = modules.filter((m) => m.is_core)
  const optional = modules.filter((m) => !m.is_core)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Shield className="w-5 h-5 text-orbit-primary-light" /> 模块热插拔
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          超级管理员可开启 / 关闭非核心模块；核心模块受保护不可关闭。关闭后该模块对所有角色（含超管）从导航隐藏，接口访问返回 403。
        </p>
      </div>

      {msg && (
        <div
          className={`rounded-lg px-4 py-2 text-sm border ${
            msg.type === 'ok'
              ? 'bg-orbit-success/10 text-status-success border-orbit-success/30'
              : 'bg-orbit-danger/10 text-status-danger border-orbit-danger/30'
          }`}
        >
          {msg.text}
        </div>
      )}

      {!isSuperAdmin && (
        <div className="rounded-lg px-4 py-2 text-sm bg-orbit-warning/10 text-status-warning border border-orbit-warning/30">
          当前账号不是超级管理员，只能查看、不能开关模块。
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中…
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <ModuleSection title="核心模块（不可关闭）" rows={core} saving={saving} onToggle={toggle} core />
          <ModuleSection title="可选模块（可开关）" rows={optional} saving={saving} onToggle={toggle} />
        </div>
      )}
    </div>
  )
}

function ModuleSection({
  title,
  rows,
  saving,
  onToggle,
  core = false,
}: {
  title: string
  rows: ModuleRow[]
  saving: string | null
  onToggle: (m: ModuleRow) => void
  core?: boolean
}) {
  return (
    <div className="rounded-xl border border-orbit-border bg-orbit-surface p-4">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
        {title}（{rows.length}）
      </h2>
      <div className="space-y-1">
        {rows.map((m) => (
          <div key={m.code} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[var(--hover-bg)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-secondary)] truncate">{m.name}</span>
                <code className="text-[11px] text-[var(--text-muted)]">{m.code}</code>
                {m.is_core && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-warning/15 text-status-warning border border-orbit-warning/30">
                    核心
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={core || m.is_core || saving === m.code}
              onClick={() => onToggle(m)}
              title={m.is_core ? '核心模块不可关闭' : m.is_enabled ? '点击关闭' : '点击开启'}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                core || m.is_core
                  ? 'text-[var(--text-primary)] cursor-not-allowed'
                  : m.is_enabled
                    ? 'text-status-success hover:bg-orbit-success/10'
                    : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'
              }`}
            >
              {core || m.is_core ? (
                <Lock className="w-4 h-4" />
              ) : m.is_enabled ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              <span>{saving === m.code ? '保存中…' : m.is_enabled ? '已启用' : '已停用'}</span>
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-[var(--text-muted)] px-3 py-2">暂无</p>}
      </div>
    </div>
  )
}
