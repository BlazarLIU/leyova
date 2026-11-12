import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Account {
  id: number
  username: string
  realName: string
  role: string
  status: number
  createdAt: string
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

const ROLE_BADGE_VARIANT: Record<string, 'danger' | 'warning' | 'success' | 'info' | 'neutral'> = {
  super_admin: 'danger',
  admin: 'warning',
  ops_director: 'warning',
  operator: 'info',
  ops_staff: 'info',
  controller: 'neutral',
  ad_buyer: 'info',
  finance: 'success',
  hrbp: 'warning',
  employee: 'neutral',
}

export function UsersPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [filterRole, setFilterRole] = useState<string>('all')
  const [form, setForm] = useState({ username: '', realName: '', password: '', role: 'operator' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<Account[]>('/system/users')
      setAccounts(d || [])
    } catch (e: any) {
      setMsg(e?.message || '加载账号列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.username || !form.password) { setMsg('请填写用户名与密码'); return }
    setCreating(true)
    try {
      await api.post('/system/users', form)
      setMsg('账号已创建')
      setForm({ username: '', realName: '', password: '', role: 'operator' })
      load()
    } catch (e: any) {
      setMsg(e?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const remove = async (id: number, username: string) => {
    if (!confirm(`确认删除账号「${username}」？此操作不可撤销。`)) return
    try {
      await api.delete(`/system/users/${id}`)
      setMsg('账号已删除')
      load()
    } catch (e: any) {
      setMsg(e?.message || '删除失败')
    }
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <h1 className="text-2xl font-semibold text-slate-100">账号管理</h1>
        <p className="mt-1 text-sm text-slate-400">管理系统登录账号与角色分配</p>
      </motion.div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-300">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs text-cyan-500 hover:text-cyan-300">关闭</button>
        </div>
      )}

      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Plus className="h-4 w-4" /> 新建账号</div>
          </CardHeader>
          <CardBody>
            <div className="grid gap-2 sm:grid-cols-5">
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="用户名"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
              <input
                value={form.realName}
                onChange={(e) => setForm({ ...form, realName: e.target.value })}
                placeholder="真实姓名"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="初始密码"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                {Object.entries(ROLE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <Button onClick={create} disabled={creating}>
                {creating ? '创建中…' : '创建'}
              </Button>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-400" />
                <span className="font-semibold text-slate-100">账号列表</span>
                <span className="text-xs text-slate-500 font-mono">({accounts.length})</span>
              </div>
              
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilterRole('all')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    filterRole === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  全部
                </button>
                {Object.entries(ROLE_LABEL).map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => setFilterRole(code)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      filterRole === code ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label.split(' ')[0]}
                  </button>
                ))}
                <button onClick={load} className="ml-2 text-xs text-slate-500 hover:text-slate-300 p-1">
                  <RefreshCw className="inline h-3 w-3" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-500">加载中…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                      <th className="py-2 pr-3">用户名</th>
                      <th className="py-2 pr-3">姓名</th>
                      <th className="py-2 pr-3">角色权限分级</th>
                      <th className="py-2 pr-3">状态</th>
                      <th className="py-2 pr-3">创建时间</th>
                      <th className="py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts
                      .filter((a) => filterRole === 'all' || a.role === filterRole)
                      .map((a) => (
                      <tr key={a.id} className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/30">
                        <td className="py-2 pr-3 font-mono text-slate-200">{a.username}</td>
                        <td className="py-2 pr-3">{a.realName || '-'}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={ROLE_BADGE_VARIANT[a.role] || 'neutral'}>
                            {ROLE_LABEL[a.role] || a.role}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={a.status === 1 ? 'success' : 'neutral'}>
                            {a.status === 1 ? '正常' : '停用'}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-500">
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString('zh-CN') : '-'}
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" onClick={() => remove(a.id, a.username)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {accounts.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-500">暂无账号</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400/80">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        删除账号前请确认该账号没有正在进行的运营工作。删除不可撤销。
      </div>
    </div>
  )
}
