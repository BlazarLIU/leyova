import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, PenLine } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

type ActivePersonnelTab = 'anchor' | 'operator' | 'manager'

const personnelSubTabs: { key: ActivePersonnelTab; label: string; visible: (role: string) => boolean }[] = [
  { key: 'anchor', label: '主播管理', visible: () => true },
  { key: 'operator', label: '中控管理', visible: () => true },
  { key: 'manager', label: '运营管理', visible: (r) => r === 'super_admin' },
]

interface Props {
  userRole: string
  anchors: any[]
  operators: any[]
  managers: any[]
  onDataChange: (tab: ActivePersonnelTab, data: any[]) => void
}

export function PersonnelSection({ userRole, anchors, operators, managers, onDataChange }: Props) {
  const [activeTab, setActiveTab] = useState<ActivePersonnelTab>('anchor')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', employeeId: '', level: 'B' })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingPerson, setEditingPerson] = useState<any | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', employeeId: '', level: 'B', status: 1 })

  const currentData = activeTab === 'anchor' ? anchors : activeTab === 'operator' ? operators : managers

  const plural = (t: ActivePersonnelTab) => t === 'anchor' ? 'anchors' : t === 'operator' ? 'operators' : 'managers'
  const label = (t: ActivePersonnelTab) => t === 'anchor' ? '主播' : t === 'operator' ? '中控' : '运营'

  const handleSave = async () => {
    try {
      const body = { ...form, type: activeTab }
      await api.post(`/personnel/${plural(activeTab)}`, body)
      const updated = await api.get<any[]>(`/personnel/${plural(activeTab)}`)
      onDataChange(activeTab, updated)
      setShowModal(false)
    } catch { /* ignore */ }
  }

  const handleDelete = async () => {
    if (deletingId === null) return
    try {
      await api.delete(`/personnel/${plural(activeTab)}/${deletingId}`)
      const updated = await api.get<any[]>(`/personnel/${plural(activeTab)}`)
      onDataChange(activeTab, updated)
      setDeletingId(null)
    } catch { /* ignore */ }
  }

  const openEdit = (p: any) => {
    setEditingPerson(p)
    setEditForm({ name: p.name || '', employeeId: p.employeeId || '', level: p.level || 'B', status: p.status ?? 1 })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingPerson) return
    try {
      const body: any = { name: editForm.name, status: editForm.status }
      if (activeTab === 'anchor') body.level = editForm.level
      if (activeTab === 'operator') body.employeeId = editForm.employeeId
      await api.put(`/personnel/${plural(activeTab)}/${editingPerson.id}`, body)
      const updated = await api.get<any[]>(`/personnel/${plural(activeTab)}`)
      onDataChange(activeTab, updated)
      setShowEditModal(false)
      setEditingPerson(null)
    } catch { /* ignore */ }
  }

  const renderCells = (p: any, tab: ActivePersonnelTab) => {
    const statusCell = (
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          p.status === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.status === 1 ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          {p.status === 1 ? '启用' : '禁用'}
        </span>
      </td>
    )
    const actionBtns = (
      <div className="flex items-center gap-2">
        <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors" onClick={() => openEdit(p)}>
          <PenLine className="w-3.5 h-3.5 inline mr-0.5" />编辑
        </button>
        <button className="text-xs text-slate-500 hover:text-orbit-danger transition-colors" onClick={() => setDeletingId(p.id)}>
          <Trash2 className="w-3.5 h-3.5 inline mr-0.5" />删除
        </button>
      </div>
    )
    if (tab === 'anchor') {
      return (
        <><td className="px-5 py-3.5 text-slate-200 font-medium">{p.name}</td><td className="px-5 py-3.5 text-slate-300">{p.level || '-'}</td>{statusCell}<td className="px-5 py-3.5 text-slate-500 text-xs">{p.createdAt || '-'}</td><td className="px-5 py-3.5">{actionBtns}</td></>
      )
    }
    if (tab === 'operator') {
      return (
        <><td className="px-5 py-3.5 text-slate-200 font-medium">{p.name}</td><td className="px-5 py-3.5 text-slate-300">{p.employeeId || '-'}</td>{statusCell}<td className="px-5 py-3.5 text-slate-500 text-xs">{p.createdAt || '-'}</td><td className="px-5 py-3.5">{actionBtns}</td></>
      )
    }
    return (
      <><td className="px-5 py-3.5 text-slate-200 font-medium">{p.username || p.name || '-'}</td><td className="px-5 py-3.5 text-slate-300">{p.realName || p.name || '-'}</td>{statusCell}<td className="px-5 py-3.5 text-slate-500 text-xs">{p.createdAt || '-'}</td><td className="px-5 py-3.5">{actionBtns}</td></>
    )
  }

  const visibleTabs = personnelSubTabs.filter(t => t.visible(userRole))

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
      <Card>
        <CardHeader
          title="人员管理"
          subtitle="管理主播、中控与运营人员"
          actions={
            <Button size="sm" variant="primary" onClick={() => { setForm({ name: '', employeeId: '', level: 'B' }); setShowModal(true) }}>
              <Plus className="w-3.5 h-3.5" />新增{label(activeTab)}
            </Button>
          }
        />
        <CardBody>
          <div className="flex items-center gap-2 mb-4">
            {visibleTabs.map((sub) => (
              <button
                key={sub.key}
                onClick={() => setActiveTab(sub.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === sub.key
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                }`}
              >{sub.label}</button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orbit-border">
                  {activeTab === 'anchor' && (<>{[['主播名称'],['评级'],['状态'],['创建时间'],['操作']].map(([h]) => <th key={h} className="px-5 py-3 text-xs font-medium text-left text-slate-500">{h}</th>)}</>)}
                  {activeTab === 'operator' && (<>{[['中控名称'],['工号'],['状态'],['创建时间'],['操作']].map(([h]) => <th key={h} className="px-5 py-3 text-xs font-medium text-left text-slate-500">{h}</th>)}</>)}
                  {activeTab === 'manager' && (<>{[['用户名'],['姓名'],['状态'],['创建时间'],['操作']].map(([h]) => <th key={h} className="px-5 py-3 text-xs font-medium text-left text-slate-500">{h}</th>)}</>)}
                </tr>
              </thead>
              <tbody>
                {currentData.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">暂无数据</td></tr>
                ) : (
                  currentData.map((p: any) => (
                    <tr key={p.id} className="border-b border-orbit-border hover:bg-white/5 transition-colors">
                      {renderCells(p, activeTab)}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-slate-200">新增{label(activeTab)}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">名称</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30"
                  placeholder="输入名称" />
              </div>
              {activeTab === 'anchor' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">评级</label>
                  <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="S">S级</option><option value="A">A级</option><option value="B">B级</option><option value="C">C级</option><option value="D">D级</option>
                  </select>
                </div>
              )}
              {activeTab === 'operator' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">工号</label>
                  <input value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30"
                    placeholder="输入工号" />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
              <Button variant="primary" onClick={handleSave}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingPerson && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowEditModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-slate-200">编辑{label(activeTab)}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">名称</label>
                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
              </div>
              {activeTab === 'anchor' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">评级</label>
                  <select value={editForm.level} onChange={e => setEditForm(p => ({ ...p, level: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="S">S级</option><option value="A">A级</option><option value="B">B级</option><option value="C">C级</option><option value="D">D级</option>
                  </select>
                </div>
              )}
              {activeTab === 'operator' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">工号</label>
                  <input value={editForm.employeeId} onChange={e => setEditForm(p => ({ ...p, employeeId: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">状态</label>
                <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: parseInt(e.target.value) }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value={1}>启用</option><option value={0}>禁用</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowEditModal(false)}>取消</Button>
              <Button variant="primary" onClick={handleSaveEdit}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {deletingId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingId(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-200 mb-2">确认删除</h3>
            <p className="text-sm text-slate-400 mb-6">确定要从人员管理中移除该{label(activeTab)}吗？<br />已登记的出勤数据将保留，不受影响。</p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingId(null)}>取消</Button>
              <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}