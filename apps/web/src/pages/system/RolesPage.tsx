import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Shield, Save, RefreshCw, Check, Ban, Info, Layers, Plus, Trash2, X } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { ROLE_CODES, ROLE_LABELS } from '@/constants/roles'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface RoleInfo {
  id: number
  code: string
  name: string
  description?: string
  modules?: string[]
}

interface ModuleInfo {
  code: string
  name: string
}

interface CapabilityRow {
  platform_code: string
  platform_name: string
  category: string
  is_enabled: boolean
  module_code: string
  is_applicable: boolean
  needs_dedicated_page: boolean
  note: string
}

/** 角色字典唯一来源：@/constants/roles */
const ROLE_LABEL: Record<string, string> = ROLE_LABELS

/** 内置角色：不可删除（与 roles 表一致） */
const BUILTIN_ROLES: string[] = [...ROLE_CODES]

/**
 * 角色与模块权限配置页（S3）
 *
 * 核心能力：
 *   1. 角色 × 模块 allow/deny 勾选
 *   2. 实时显示「该模块在哪些平台适用」（来自 platform_capability_matrix）
 *   3. 按平台维度预览：某角色在某平台实际能看到哪些模块
 */
export function RolesPage() {
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [modules, setModules] = useState<ModuleInfo[]>([])
  const [caps, setCaps] = useState<CapabilityRow[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [allowDraft, setAllowDraft] = useState<string[]>([])
  const [denyDraft, setDenyDraft] = useState<string[]>([])
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newRole, setNewRole] = useState({ code: '', name: '', description: '', modules: [] as string[] })
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [roleList, modList, capList] = await Promise.all([
        api.get<RoleInfo[]>('/system/roles'),
        api.get<ModuleInfo[]>('/system/modules'),
        api.get<CapabilityRow[]>('/access/capability-matrix').catch(() => [] as CapabilityRow[]),
      ])
      setRoles(roleList || [])
      setModules(modList || [])
      setCaps(capList || [])
    } catch {
      setMsg({ type: 'err', text: '加载角色或模块列表失败' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // 选中角色后拉取该角色的 grants
  useEffect(() => {
    if (!selectedRole) return
    let cancelled = false
    ;(async () => {
      try {
        const grants = await api.get<{ allow: string[]; deny: string[] }>(`/access/roles/${selectedRole}/grants`)
        if (cancelled) return
        // 若角色尚无 grants 记录，用 role_modules 作为初始基线
        if ((grants.allow?.length || 0) === 0 && (grants.deny?.length || 0) === 0) {
          const found = roles.find(r => r.code === selectedRole)
          setAllowDraft([...(found?.modules || [])])
          setDenyDraft([])
        } else {
          setAllowDraft([...(grants.allow || [])])
          setDenyDraft([...(grants.deny || [])])
        }
      } catch {
        const found = roles.find(r => r.code === selectedRole)
        setAllowDraft([...(found?.modules || [])])
        setDenyDraft([])
      }
    })()
    return () => { cancelled = true }
  }, [selectedRole, roles])

  // 默认选中第一个角色
  useEffect(() => {
    if (!selectedRole && roles.length > 0) setSelectedRole(roles[0].code)
  }, [roles, selectedRole])

  /** 平台 → 该平台适用模块集合 */
  const moduleByPlatform = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of caps) {
      if (!c.is_applicable) continue
      if (!map.has(c.platform_code)) map.set(c.platform_code, new Set())
      map.get(c.platform_code)!.add(c.module_code)
    }
    return map
  }, [caps])

  const platforms = useMemo(() => {
    const seen = new Map<string, { code: string; name: string; enabled: boolean }>()
    for (const c of caps) {
      if (!seen.has(c.platform_code)) {
        seen.set(c.platform_code, { code: c.platform_code, name: c.platform_name, enabled: c.is_enabled })
      }
    }
    return Array.from(seen.values()).filter(p => p.enabled)
  }, [caps])

  /** 按平台过滤后的模块清单 */
  const visibleModules = useMemo(() => {
    if (platformFilter === 'all') return modules
    const allowed = moduleByPlatform.get(platformFilter)
    if (!allowed) return modules
    return modules.filter(m => allowed.has(m.code))
  }, [modules, platformFilter, moduleByPlatform])

  const toggleAllow = (code: string) => {
    setMsg(null)
    setDenyDraft(d => d.filter(m => m !== code))
    setAllowDraft(a => (a.includes(code) ? a.filter(m => m !== code) : [...a, code]))
  }

  /** 新增自定义角色（含初始模块授权） */
  const createRole = async () => {
    const code = newRole.code.trim()
    const name = newRole.name.trim()
    if (!/^[a-z][a-z0-9_]{2,31}$/.test(code)) {
      setMsg({ type: 'err', text: '角色编码须为 3-32 位小写字母、数字或下划线，且以字母开头' })
      return
    }
    if (!name) {
      setMsg({ type: 'err', text: '角色名称不能为空' })
      return
    }
    setCreating(true)
    try {
      await api.post('/system/roles', {
        code,
        name,
        description: newRole.description.trim() || undefined,
        moduleCodes: newRole.modules,
      })
      setMsg({ type: 'ok', text: `角色「${name}」创建成功，已授予 ${newRole.modules.length} 个模块` })
      setShowCreate(false)
      setNewRole({ code: '', name: '', description: '', modules: [] })
      // 重新拉取角色列表并选中新建角色，便于继续微调权限
      const roleList = await api.get<RoleInfo[]>('/system/roles')
      setRoles(roleList)
      setSelectedRole(code)
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || '创建角色失败' })
    } finally {
      setCreating(false)
    }
  }

  /** 删除自定义角色 */
  const removeRole = async (code: string) => {
    setDeleting(code)
    try {
      await api.delete(`/system/roles/${code}`)
      setMsg({ type: 'ok', text: `角色 ${code} 已删除` })
      const roleList = await api.get<RoleInfo[]>('/system/roles')
      setRoles(roleList)
      if (selectedRole === code) setSelectedRole(roleList[0]?.code ?? '')
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || '删除角色失败' })
    } finally {
      setDeleting(null)
    }
  }

  const toggleDeny = (code: string) => {
    setMsg(null)
    setAllowDraft(a => a.filter(m => m !== code))
    setDenyDraft(d => (d.includes(code) ? d.filter(m => m !== code) : [...d, code]))
  }

  const handleSave = async () => {
    if (!selectedRole) return
    setSaving(true)
    setMsg(null)
    try {
      await api.put(`/access/roles/${selectedRole}/grants`, { modules: allowDraft, effect: 'allow' })
      await api.put(`/access/roles/${selectedRole}/grants`, { modules: denyDraft, effect: 'deny' })
      // 同步落库到 role_modules（保持旧读取路径一致）
      await api.put('/system/roles/modules', { roleCode: selectedRole, moduleCodes: allowDraft })
      setMsg({ type: 'ok', text: `已保存「${ROLE_LABEL[selectedRole] || selectedRole}」：授权 ${allowDraft.length} 项，禁止 ${denyDraft.length} 项` })
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

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
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Shield className="w-6 h-6 text-orbit-primary" />
            角色与模块权限
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            勾选角色可见模块；带 <Ban className="inline w-3 h-3 text-rose-400" /> 的为显式禁止。
            右侧「按平台」可预览某平台下实际生效的模块。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadAll} disabled={saving}>
            <RefreshCw className="w-4 h-4" /> 刷新
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedRole}>
            <Save className="w-4 h-4" /> {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </motion.div>

      {msg && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${
          msg.type === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
        }`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* 角色列表 */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-[var(--text-secondary)]">角色</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="neutral">{roles.length}</Badge>
              <Button variant="secondary" onClick={() => setShowCreate(true)} className="!px-2 !py-1 !text-[11px]">
                <Plus className="w-3 h-3" /> 新增
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-2 max-h-[70vh] overflow-y-auto">
            {roles.map((r) => {
              const isBuiltin = BUILTIN_ROLES.includes(r.code)
              return (
                <div key={r.code} className="relative group mb-1">
                  <button
                    onClick={() => setSelectedRole(r.code)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${
                      selectedRole === r.code
                        ? 'bg-orbit-primary/15 text-orbit-primary border border-orbit-primary/30'
                        : 'text-[var(--text-secondary)] hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="font-medium pr-6">{ROLE_LABEL[r.code] || r.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{r.code}</div>
                  </button>
                  {!isBuiltin && (
                    <button
                      onClick={() => {
                        if (confirm(`确定删除角色「${r.name}」？\n\n删除后该角色的模块授权将一并移除。若仍有账号使用该角色，系统会拒绝删除。`)) {
                          removeRole(r.code)
                        }
                      }}
                      disabled={deleting === r.code}
                      title="删除自定义角色"
                      className="absolute top-1.5 right-1.5 p-1 rounded text-[var(--text-primary)] hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </CardBody>
        </Card>

        {/* 模块矩阵 */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
              <Layers className="w-4 h-4" /> 模块权限
            </span>
            <div className="flex items-center gap-2">
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1 text-[var(--text-secondary)]"
              >
                <option value="all">全部平台（{modules.length} 模块）</option>
                {platforms.map(p => (
                  <option key={p.code} value={p.code}>
                    {p.name}（{moduleByPlatform.get(p.code)?.size ?? 0} 模块）
                  </option>
                ))}
              </select>
              <Badge variant="info">授权 {allowDraft.length}</Badge>
              <Badge variant="danger">禁止 {denyDraft.length}</Badge>
            </div>
          </CardHeader>
          <CardBody className="max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
              {visibleModules.map((m) => {
                const isAllow = allowDraft.includes(m.code)
                const isDeny = denyDraft.includes(m.code)
                return (
                  <div
                    key={m.code}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs ${
                      isDeny
                        ? 'border-rose-500/40 bg-rose-500/10'
                        : isAllow
                        ? 'border-emerald-500/30 bg-emerald-500/8'
                        : 'border-orbit-border/60 bg-white/[0.02]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[var(--text-secondary)] truncate">{m.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">{m.code}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        title="允许"
                        onClick={() => toggleAllow(m.code)}
                        className={`p-1 rounded transition ${isAllow ? 'bg-emerald-500/20 text-emerald-300' : 'text-[var(--text-primary)] hover:text-[var(--text-primary)]'}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="禁止"
                        onClick={() => toggleDeny(m.code)}
                        className={`p-1 rounded transition ${isDeny ? 'bg-rose-500/20 text-rose-300' : 'text-[var(--text-primary)] hover:text-[var(--text-primary)]'}`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {platformFilter !== 'all' && (
              <p className="mt-3 text-[11px] text-[var(--text-muted)] flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                当前按「{platforms.find(p => p.code === platformFilter)?.name}」过滤：该平台不适用的模块（如淘宝的直播场次类）已自动隐藏。
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 新增角色弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl border border-orbit-border bg-orbit-surface p-5 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Shield className="w-4 h-4 text-orbit-primary" /> 新增自定义角色
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  角色编码 <span className="text-rose-400">*</span>
                  <span className="text-[var(--text-primary)] ml-1">（3-32 位小写字母/数字/下划线，建后不可修改）</span>
                </label>
                <input
                  value={newRole.code}
                  onChange={(e) => setNewRole(r => ({ ...r, code: e.target.value }))}
                  placeholder="如 night_ops"
                  className="w-full px-3 py-2 rounded-lg bg-orbit-bg border border-orbit-border text-xs text-[var(--text-secondary)] font-mono focus:border-orbit-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  角色名称 <span className="text-rose-400">*</span>
                </label>
                <input
                  value={newRole.name}
                  onChange={(e) => setNewRole(r => ({ ...r, name: e.target.value }))}
                  placeholder="如 夜班运营"
                  className="w-full px-3 py-2 rounded-lg bg-orbit-bg border border-orbit-border text-xs text-[var(--text-secondary)] focus:border-orbit-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">职责描述</label>
                <input
                  value={newRole.description}
                  onChange={(e) => setNewRole(r => ({ ...r, description: e.target.value }))}
                  placeholder="选填，说明该角色的业务职责"
                  className="w-full px-3 py-2 rounded-lg bg-orbit-bg border border-orbit-border text-xs text-[var(--text-secondary)] focus:border-orbit-primary outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] text-[var(--text-muted)]">
                    初始模块授权 <span className="text-[var(--text-primary)]">（可稍后在右侧微调）</span>
                  </label>
                  <span className="text-[10px] text-orbit-primary">已选 {newRole.modules.length}</span>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-orbit-border bg-orbit-bg p-2 grid grid-cols-2 gap-1">
                  {modules.map(m => (
                    <label
                      key={m.code}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] cursor-pointer transition ${
                        newRole.modules.includes(m.code)
                          ? 'bg-orbit-primary/15 text-orbit-primary'
                          : 'text-[var(--text-muted)] hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newRole.modules.includes(m.code)}
                        onChange={() => setNewRole(r => ({
                          ...r,
                          modules: r.modules.includes(m.code)
                            ? r.modules.filter(x => x !== m.code)
                            : [...r.modules, m.code],
                        }))}
                        className="w-3 h-3 accent-orbit-primary"
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>取消</Button>
              <Button onClick={createRole} disabled={creating}>
                {creating ? '创建中…' : '创建角色'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default RolesPage
