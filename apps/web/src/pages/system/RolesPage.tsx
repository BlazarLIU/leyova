import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Shield, Save, RefreshCw, Check, Ban, Info, Layers } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

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

const ROLE_LABEL: Record<string, string> = {
  super_admin: '👑 系统管理员',
  admin: '🏢 管理员 (总监)',
  ops_director: '🧭 运营总监',
  operator: '🚀 运营 (操盘手)',
  ops_staff: '📋 运营专员',
  controller: '🎛️ 直播中控',
  ad_buyer: '🎯 投放专员',
  finance: '💰 财务主管',
  hrbp: '👥 HRBP',
  employee: '🎙️ 员工 (主播/中控)',
}

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
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-orbit-primary" />
            角色与模块权限
          </h1>
          <p className="text-slate-400 text-xs mt-1">
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
            <span className="text-sm font-semibold text-slate-200">角色</span>
            <Badge variant="neutral">{roles.length}</Badge>
          </CardHeader>
          <CardBody className="p-2 max-h-[70vh] overflow-y-auto">
            {roles.map((r) => (
              <button
                key={r.code}
                onClick={() => setSelectedRole(r.code)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs mb-1 transition ${
                  selectedRole === r.code
                    ? 'bg-orbit-primary/15 text-orbit-primary border border-orbit-primary/30'
                    : 'text-slate-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="font-medium">{ROLE_LABEL[r.code] || r.name}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{r.code}</div>
              </button>
            ))}
          </CardBody>
        </Card>

        {/* 模块矩阵 */}
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4" /> 模块权限
            </span>
            <div className="flex items-center gap-2">
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1 text-slate-300"
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
                      <div className="text-slate-200 truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{m.code}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        title="允许"
                        onClick={() => toggleAllow(m.code)}
                        className={`p-1 rounded transition ${isAllow ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-600 hover:text-slate-300'}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="禁止"
                        onClick={() => toggleDeny(m.code)}
                        className={`p-1 rounded transition ${isDeny ? 'bg-rose-500/20 text-rose-300' : 'text-slate-600 hover:text-slate-300'}`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {platformFilter !== 'all' && (
              <p className="mt-3 text-[11px] text-slate-500 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                当前按「{platforms.find(p => p.code === platformFilter)?.name}」过滤：该平台不适用的模块（如淘宝的直播场次类）已自动隐藏。
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

export default RolesPage
