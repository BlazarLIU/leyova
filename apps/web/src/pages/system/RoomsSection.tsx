import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import type { LiveRoom } from '@/types'

interface Props {
  rooms: LiveRoom[]
  onRoomsChange: (rooms: LiveRoom[]) => void
}

export function RoomsSection({ rooms, onRoomsChange }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<LiveRoom | null>(null)
  const [form, setForm] = useState({ name: '', platform: '抖音', status: 'active' })
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleSave = async () => {
    try {
      const body = { name: form.name, platform: form.platform, status: form.status }
      if (editingRoom) {
        await api.put(`/system/rooms/${editingRoom.id}`, body)
        onRoomsChange(rooms.map(r => r.id === editingRoom.id ? { ...r, ...body } : r))
      } else {
        const newRoom = await api.post<LiveRoom>('/system/rooms', body)
        onRoomsChange([...rooms, newRoom])
      }
      setShowModal(false)
      setEditingRoom(null)
      setForm({ name: '', platform: '抖音', status: 'active' })
    } catch { /* ignore */ }
  }

  const handleDelete = async () => {
    if (deletingId === null) return
    try {
      await api.delete(`/system/rooms/${deletingId}`)
      onRoomsChange(rooms.filter(r => r.id !== deletingId))
      setDeletingId(null)
    } catch { /* ignore */ }
  }

  const openNew = () => {
    setEditingRoom(null)
    setForm({ name: '', platform: '抖音', status: 'active' })
    setShowModal(true)
  }

  const openEdit = (r: LiveRoom) => {
    setEditingRoom(r)
    setForm({ name: r.name, platform: r.platform, status: r.status })
    setShowModal(true)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
      <Card>
        <CardHeader
          title="直播间管理"
          subtitle="管理直播间信息"
          actions={<Button size="sm" variant="primary" onClick={openNew}><Plus className="w-3.5 h-3.5" />新增直播间</Button>}
        />
        <CardBody className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orbit-border">
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">ID</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">直播间名称</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">平台</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">状态</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">创建时间</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">暂无直播间数据</td></tr>
                ) : rooms.map((r) => (
                  <tr key={r.id} className="border-b border-orbit-border hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">{r.id}</td>
                    <td className="px-5 py-3.5 text-slate-200 font-medium">{r.name}</td>
                    <td className="px-5 py-3.5 text-slate-300">{r.platform}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${r.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {r.status === 'active' ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{r.created_at || '-'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors" onClick={() => openEdit(r)}>
                          <Edit className="w-3.5 h-3.5 inline mr-0.5" />编辑
                        </button>
                        <button className="text-xs text-slate-500 hover:text-orbit-danger transition-colors" onClick={() => setDeletingId(r.id)}>
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
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-slate-200">{editingRoom ? '编辑直播间' : '新增直播间'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">直播间名称</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="输入直播间名称" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">平台</label>
                <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value="抖音">抖音</option>
                  <option value="视频号">视频号</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">状态</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
              <Button variant="primary" onClick={handleSave}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {deletingId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingId(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-200 mb-2">确认删除</h3>
            <p className="text-sm text-slate-400 mb-6">确定要删除该直播间吗？此操作不可撤销。</p>
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