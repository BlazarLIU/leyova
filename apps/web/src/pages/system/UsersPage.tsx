import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Shield,
  CheckCircle2,
  XCircle,
  X,
  UserCheck,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'
import { ROLE_BADGE_VARIANTS, ROLE_CODES, ROLE_LABELS } from '@/constants/roles'

export interface Account {
  id: number
  username: string
  realName: string
  role: string
  status: number
  createdAt: string
}

// 兼容旧引用：角色字典唯一来源见 @/constants/roles
export const ROLE_LABEL: Record<string, string> = ROLE_LABELS
export const ROLE_BADGE_VARIANT: Record<string, 'danger' | 'warning' | 'success' | 'info' | 'neutral'> = ROLE_BADGE_VARIANTS

interface AccountForm {
  username: string
  realName: string
  password: string
  role: string
}

export function UsersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState<AccountForm>({ username: '', realName: '', password: '', role: ROLE_CODES[2] })
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const table = useTable<Account, { role: string; status: string }>({
    initialFilters: { role: 'all', status: 'all' },
    initialPageSize: 20,
    fetchData: async ({ search, filters }) => {
      const list = await api.get<Account[]>('/system/users')
      const rawAccounts: Account[] = Array.isArray(list) ? list : []

      const filtered = rawAccounts.filter((a) => {
        if (filters.role !== 'all' && a.role !== filters.role) return false
        if (filters.status !== 'all' && String(a.status) !== filters.status) return false
        if (!search) return true
        const q = search.toLowerCase()
        return (
          a.username.toLowerCase().includes(q) ||
          (a.realName && a.realName.toLowerCase().includes(q))
        )
      })

      return {
        items: filtered,
        total: filtered.length,
      }
    },
  })

  // Quick stats
  const stats = useMemo(() => {
    const list = table.data
    const total = table.total
    const active = list.filter((a) => a.status === 1).length
    const inactive = list.filter((a) => a.status !== 1).length
    const operators = list.filter((a) => ['ops_staff', 'ops_director'].includes(a.role)).length

    return { total, active, inactive, operators }
  }, [table.data, table.total])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username.trim() || !form.password.trim()) {
      alert('请填写用户名与初始密码')
      return
    }
    setCreating(true)
    try {
      await api.post('/system/users', form)
      setShowCreateModal(false)
      setForm({ username: '', realName: '', password: '', role: ROLE_CODES[2] })
      setMsg('账号已成功创建')
      await table.reload()
    } catch (e: any) {
      alert(e?.message || '创建账号失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`确认删除账号「${username}」？此操作不可撤销。`)) return
    try {
      await api.delete(`/system/users/${id}`)
      setMsg('账号已删除')
      await table.reload()
    } catch (e: any) {
      alert(e?.message || '删除失败')
    }
  }

  const columns: ColumnDef<Account>[] = useMemo(
    () => [
      {
        key: 'username',
        header: '用户名',
        width: 160,
        render: (_, a) => (
          <span className="font-mono font-semibold text-slate-100 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            {a.username}
          </span>
        ),
      },
      {
        key: 'realName',
        header: '姓名',
        width: 140,
        render: (_, a) => (
          <span className="text-slate-200">{a.realName || '-'}</span>
        ),
      },
      {
        key: 'role',
        header: '角色权限分级',
        render: (_, a) => (
          <Badge variant={ROLE_BADGE_VARIANT[a.role] || 'neutral'}>
            {ROLE_LABEL[a.role] || a.role}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: '账号状态',
        width: 120,
        align: 'center',
        render: (_, a) => (
          <Badge variant={a.status === 1 ? 'success' : 'neutral'}>
            {a.status === 1 ? '正常生效' : '已停用'}
          </Badge>
        ),
      },
      {
        key: 'createdAt',
        header: '创建时间',
        width: 160,
        render: (_, a) => (
          <span className="font-mono text-xs text-slate-400">
            {a.createdAt ? new Date(a.createdAt).toLocaleDateString('zh-CN') : '-'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 90,
        align: 'right',
        render: (_, a) => (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleDelete(a.id, a.username)}
            title="删除账号"
            className="text-slate-500 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px] text-gray-100">
      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-300">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs text-cyan-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 统计指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">系统总账号数</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-100">{stats.total}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">已分配角色的登录主体</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">正常生效账号</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.active}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">具备登录与功能鉴权凭证</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">已停用账号</span>
              <XCircle className="w-4 h-4 text-slate-500" />
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-400">{stats.inactive}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">休眠或离职锁定状态</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">运营操盘中心人员</span>
              <UserCheck className="w-4 h-4 text-orbit-primary-light" />
            </div>
            <p className="mt-1 text-2xl font-bold text-orbit-primary-light">{stats.operators}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">操盘手、运营总监与专员</p>
          </CardBody>
        </Card>
      </div>

      <DataPage<Account>
        title="账号与系统用户管理"
        subtitle="集中管理企业各业务角色登录账号、实名绑定与二维权限矩阵访问准入"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-cyan-400 border border-orbit-border">
            DataPage + useTable
          </span>
        }
        table={table}
        columns={columns}
        searchPlaceholder="搜索用户名或真实姓名..."
        exportFilename="system_user_accounts"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              新建系统账号
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.reload()}
              loading={table.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          </div>
        }
        filterControls={
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-gray-400">角色:</span>
              <select
                value={table.filters.role}
                onChange={(e) => table.setFilter('role', e.target.value)}
                className="h-7 px-2 text-xs rounded border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">全部角色</option>
                {Object.entries(ROLE_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-gray-400">状态:</span>
              {[
                { value: 'all', label: '全部' },
                { value: '1', label: '正常' },
                { value: '0', label: '停用' },
              ].map((st) => (
                <button
                  key={st.value}
                  onClick={() => table.setFilter('status', st.value)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    table.filters.status === st.value
                      ? 'bg-cyan-600 text-white font-medium'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400/80">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          删除账号前请确认该账号没有正在进行的排班或审批工作流。账号删除将不可撤销。
        </div>
      </DataPage>

      {/* 新建账号弹窗 */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-400" />
                  新建系统账号
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-300 mb-1 font-medium">登录用户名</label>
                  <input
                    type="text"
                    required
                    placeholder="如 operator_zhang"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-medium">真实姓名</label>
                  <input
                    type="text"
                    placeholder="如 张三"
                    value={form.realName}
                    onChange={(e) => setForm({ ...form, realName: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-medium">初始登录密码</label>
                  <input
                    type="password"
                    required
                    placeholder="至少 6 位安全密码"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-medium">分配系统角色</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {Object.entries(ROLE_LABEL).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={creating}>
                    {creating ? '创建中...' : '确认创建'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default UsersPage
