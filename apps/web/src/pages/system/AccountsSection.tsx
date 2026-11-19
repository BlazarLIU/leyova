import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api, ApiError } from '@/services/api'
import type { UserAccount, RoleInfo, ModuleInfo } from '@/types'
import { ROLE_LABELS, ROLE_OPTIONS } from '@/constants/roles'

/** 角色字典唯一来源：@/constants/roles */
const roleLabels: Record<string, string> = ROLE_LABELS

const moduleNameMap: Record<string, string> = {
  overview: '总览',
  session: '场次管理',
  anchor: '主播赋能',
  data: '数据管理',
  bi: '商业智能',
  ops: '运营提效',
  ai: 'AI 助手',
  personal_achievement: '个人达成',
  live_registration: '直播登记',
  live_data: '登记数据管理',
  session_products: '场次排品',
  system_users: '账号管理',
  system_personnel_ops: '运营管理',
  system_ai: 'AI 配置',
  system_dict: '字典管理',
  system_rooms: '直播间管理',
  system_config: '系统配置',
  system_alerts: '异常中心',
  system_tasks: '改进任务',
  system_promotions: '大促管理',
  system_competitors: '竞品观察',
  system_multiroom: '多直播间总览',
  content: '内容中心',
  content_schedule: '内容排产',
  compliance: '合规风控',
  fulfillment: '履约SLA',
  after_sales: '售后工单',
  kol: '达人合作',
  customer_service: '客服绩效',
  net_roi: '全域净ROI',
  search_seo: '搜索词卡位',
  members: '会员与私域',
  product_center: '商品中心',
  audit_logs: '审计日志',
  agency: '代运营管理',
  review: '经营复盘',
  review_overview: '复盘总览',
  review_channels: '渠道复盘',
  review_anchors: '主播复盘',
  review_funnel: '转化漏斗',
  review_closed_loop: '闭环改进',
}

interface Props {
  users: UserAccount[]
  roles: RoleInfo[]
  allModules: ModuleInfo[]
  onUsersChange: (users: UserAccount[]) => void
  onRolesChange?: (roles: RoleInfo[]) => void
}

export function AccountsSection({ users, roles, allModules, onUsersChange, onRolesChange }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [form, setForm] = useState<{
    username: string; password: string; realName: string; role: string; status: number; modules: string[]
  }>({ username: '', password: '', realName: '', role: 'ops_staff', status: 1, modules: [] })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('')
  const [roleDraftModules, setRoleDraftModules] = useState<string[]>([])
  const [roleMatrixSaving, setRoleMatrixSaving] = useState(false)
  const [roleMatrixMsg, setRoleMatrixMsg] = useState('')

  useEffect(() => {
    if (!roles.length) return
    const current = roles.find(r => r.code === selectedRoleCode) || roles[0]
    if (!selectedRoleCode || current.code !== selectedRoleCode) {
      setSelectedRoleCode(current.code)
      setRoleDraftModules([...(current.modules || [])])
    } else {
      setRoleDraftModules([...(current.modules || [])])
    }
  }, [roles, selectedRoleCode])

  const handleSelectRoleMatrix = (roleCode: string) => {
    setSelectedRoleCode(roleCode)
    setRoleMatrixMsg('')
    const found = roles.find(r => r.code === roleCode)
    setRoleDraftModules(found ? [...(found.modules || [])] : [])
  }

  const toggleRoleDraftModule = (code: string) => {
    setRoleMatrixMsg('')
    setRoleDraftModules(prev => (prev.includes(code) ? prev.filter(m => m !== code) : [...prev, code]))
  }

  const handleSaveRoleModules = async () => {
    if (!selectedRoleCode) return
    setRoleMatrixSaving(true)
    setRoleMatrixMsg('')
    try {
      await api.put('/system/roles/modules', {
        roleCode: selectedRoleCode,
        moduleCodes: roleDraftModules,
      })
      const updatedRoles = await api.get<RoleInfo[]>('/system/roles')
      onRolesChange?.(updatedRoles)
      setRoleMatrixMsg(`已更新「${roleLabels[selectedRoleCode] || selectedRoleCode}」默认模块权限（共 ${roleDraftModules.length} 项）`)
    } catch (err) {
      setRoleMatrixMsg(err instanceof ApiError ? err.message : '更新角色模块权限失败')
    } finally {
      setRoleMatrixSaving(false)
    }
  }

  const refreshUsers = async () => {
    const list = await api.get<UserAccount[]>('/system/users')
    onUsersChange(list)
  }

  const handleRoleChange = (newRole: string) => {
    const found = roles.find(r => r.code === newRole)
    setForm(p => ({ ...p, role: newRole, modules: found ? [...found.modules] : [] }))
  }

  const toggleModule = (code: string) => {
    setForm(p => ({
      ...p,
      modules: p.modules.includes(code) ? p.modules.filter(m => m !== code) : [...p.modules, code],
    }))
  }

  const handleSave = async () => {
    setSaveError('')
    try {
      const body = { realName: form.realName, role: form.role, status: form.status, modules: form.modules }
      if (editingUser) {
        await api.put(`/system/users/${editingUser.id}`, body)
      } else {
        await api.post('/system/users', { ...body, username: form.username, password: form.password })
      }
      await refreshUsers()
      setShowModal(false)
      setEditingUser(null)
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : '操作失败，请重试')
    }
  }

  const handleDelete = async () => {
    if (deletingId === null) return
    try {
      await api.delete(`/system/users/${deletingId}`)
      await refreshUsers()
      setDeletingId(null)
    } catch { /* ignore */ }
  }

  const openNew = () => {
    setEditingUser(null)
    const defaultRole = 'ops_staff'
    const found = roles.find(r => r.code === defaultRole)
    setForm({ username: '', password: '', realName: '', role: defaultRole, status: 1, modules: found ? [...found.modules] : [] })
    setShowModal(true)
  }

  const openEdit = (u: UserAccount) => {
    setEditingUser(u)
    setSaveError('')
    const found = roles.find(r => r.code === u.role)
    setForm({
      username: u.username, password: '', realName: u.realName, role: u.role, status: u.status,
      modules: u.modules?.length ? u.modules : (found ? [...found.modules] : []),
    })
    setShowModal(true)
  }

  const roleBadgeVariant = (role: string): 'danger' | 'warning' | 'info' | 'neutral' =>
    role === 'super_admin' ? 'danger' : role === 'ops_director' ? 'warning' : role === 'ops_staff' ? 'info' : 'neutral'

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
      <Card>
        <CardHeader
          title="账号管理"
          subtitle="管理系统用户账号与权限"
          actions={<Button size="sm" variant="primary" onClick={openNew}><Plus className="w-3.5 h-3.5" />新增账号</Button>}
        />
        <CardBody className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orbit-border">
                  <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">用户名</th>
                  <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">姓名</th>
                  <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">角色</th>
                  <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">状态</th>
                  <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">最后登录</th>
                  <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--text-muted)]">暂无账号数据</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="border-b border-orbit-border hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3.5 text-[var(--text-secondary)] font-medium">{u.username}</td>
                    <td className="px-5 py-3.5 text-[var(--text-secondary)]">{u.realName}</td>
                    <td className="px-5 py-3.5"><Badge variant={roleBadgeVariant(u.role)}>{roleLabels[u.role] || u.role}</Badge></td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${u.status === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--surface3)] text-[var(--text-muted)]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 1 ? 'bg-emerald-400' : 'bg-[var(--text-subtle)]'}`} />
                        {u.status === 1 ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{u.lastLogin || '-'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors" onClick={() => openEdit(u)}>
                          <Edit className="w-3.5 h-3.5 inline mr-0.5" />编辑
                        </button>
                        <button className="text-xs text-[var(--text-muted)] hover:text-orbit-danger transition-colors" onClick={() => setDeletingId(u.id)}>
                          <Trash2 className="w-3.5 h-3.5 inline mr-0.5" />删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-[var(--text-secondary)]">{editingUser ? '编辑账号' : '新增账号'}</h3>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">用户名</label>
                  <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} disabled={!!editingUser}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 disabled:opacity-50" placeholder="输入用户名" />
                </div>
                {!editingUser && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">密码</label>
                    <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="默认 123456" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">姓名</label>
                  <input value={form.realName} onChange={e => setForm(p => ({ ...p, realName: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="输入姓名" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">角色</label>
                  <select value={form.role} onChange={e => handleRoleChange(e.target.value)}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="super_admin">系统管理员</option>
                    {ROLE_OPTIONS.filter((r) => r.code !== 'super_admin').map((r) => (
                      <option key={r.code} value={r.code}>{r.label.replace(/^\S+\s/, '')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">状态</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: parseInt(e.target.value) }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value={1}>启用</option>
                  <option value={0}>禁用</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                  模块权限 <span className="text-[var(--text-muted)] font-normal">（勾选该账号可见的系统模块）</span>
                </label>
                <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-orbit-surface2 border border-orbit-border">
                  {allModules.map((mod) => (
                    <label key={mod.code} className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${form.modules.includes(mod.code) ? 'bg-orbit-primary/10 text-[var(--text-secondary)]' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>
                      <input type="checkbox" checked={form.modules.includes(mod.code)} onChange={() => toggleModule(mod.code)}
                        className="w-3.5 h-3.5 rounded border-orbit-border bg-orbit-surface3 accent-orbit-primary" />
                      <span className="text-xs">{moduleNameMap[mod.code] || mod.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border">
              {saveError && (
                <p className="text-xs text-orbit-danger mb-3">{saveError}</p>
              )}
              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={() => { setSaveError(''); setShowModal(false) }}>取消</Button>
                <Button variant="primary" onClick={handleSave}>保存</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingId(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-2">确认删除</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">确定要删除该账号吗？此操作不可撤销。</p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingId(null)}>取消</Button>
              <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Role-Module Permission Matrix ─── */}
      {roles.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="角色模块权限矩阵"
            subtitle="配置各角色的默认可见模块（同步保存至 role_modules）"
            actions={
              <Button size="sm" variant="primary" disabled={roleMatrixSaving || !selectedRoleCode} onClick={handleSaveRoleModules}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {roleMatrixSaving ? '保存中…' : '保存角色权限'}
              </Button>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => handleSelectRoleMatrix(r.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedRoleCode === r.code
                      ? 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/40'
                      : 'bg-orbit-surface2 text-[var(--text-muted)] border-orbit-border hover:text-[var(--text-primary)]'
                  }`}
                >
                  {roleLabels[r.code] || r.name || r.code}
                  <span className="ml-1.5 text-[11px] opacity-75">({r.modules?.length ?? 0})</span>
                </button>
              ))}
            </div>

            {roleMatrixMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${
                roleMatrixMsg.includes('失败') || roleMatrixMsg.includes('仅超级管理员')
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}>
                {roleMatrixMsg}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 rounded-lg bg-orbit-surface2 border border-orbit-border">
              {allModules.map((mod) => (
                <label
                  key={mod.code}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                    roleDraftModules.includes(mod.code) ? 'bg-orbit-primary/10 text-[var(--text-secondary)]' : 'text-[var(--text-muted)] hover:bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={roleDraftModules.includes(mod.code)}
                    onChange={() => toggleRoleDraftModule(mod.code)}
                    className="w-3.5 h-3.5 rounded border-orbit-border bg-orbit-surface3 accent-orbit-primary"
                  />
                  <span className="text-xs truncate">{moduleNameMap[mod.code] || mod.name}</span>
                </label>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </motion.div>
  )
}