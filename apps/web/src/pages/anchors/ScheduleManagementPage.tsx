import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Sparkles,
  Trash2,
  Edit2,
  Video,
  SlidersHorizontal,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { api } from '@/services/api'

interface ScheduleSession {
  id: number
  title: string
  date: string
  startTime: string
  endTime: string
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  roomId: number
  roomName: string
  anchorId: number
  anchorName: string
  anchorLevel: string
  controllerId?: number
  controllerName?: string
  operatorId?: number
  operatorName?: string
  projectId?: number
  projectName?: string
  brandName?: string
  gmv?: number
  orders?: number
  durationMin?: number
  remark?: string
}

interface MetaData {
  rooms: Array<{ id: number; name: string; platform?: string }>
  anchors: Array<{ id: number; name: string; level: string }>
  operators: Array<{ id: number; name: string; role?: string }>
  controllers?: Array<{ id: number; name: string; role?: string }>
  projects?: Array<{ id: number; name: string; brandName?: string }>
}

const statusMap: Record<string, { label: string; badge: 'info' | 'success' | 'warning' | 'neutral' }> = {
  scheduled: { label: '待开播', badge: 'info' },
  live: { label: '直播中', badge: 'success' },
  completed: { label: '已完结', badge: 'neutral' },
  cancelled: { label: '已取消', badge: 'warning' },
}

export const ScheduleManagementPage: React.FC = () => {
  const [sessions, setSessions] = useState<ScheduleSession[]>([])
  const [meta, setMeta] = useState<MetaData>({ rooms: [], anchors: [], operators: [], controllers: [], projects: [] })
  const [, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar')

  // 筛选状态
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [filterRoomId, setFilterRoomId] = useState<string>('all')
  const [filterAnchorId, setFilterAnchorId] = useState<string>('all')

  // 新建/编辑排班弹窗
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalForm, setModalForm] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '19:00:00',
    endTime: '23:30:00',
    roomId: '',
    anchorId: '',
    controllerId: '',
    operatorId: '',
    remark: '',
  })

  // AI 智能一键生成排班状态
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [messageNotice, setMessageNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchMeta = async () => {
    try {
      const res = await api.get<MetaData>('/api/v1/schedule/meta')
      if (res) {
        setMeta(res)
        if (res.rooms.length > 0 && !modalForm.roomId) {
          setModalForm((prev) => ({
            ...prev,
            roomId: String(res.rooms[0].id),
            anchorId: res.anchors.length > 0 ? String(res.anchors[0].id) : '',
          }))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterDate) {
        params.startDate = filterDate
      }
      if (filterRoomId !== 'all') params.roomId = filterRoomId
      if (filterAnchorId !== 'all') params.anchorId = filterAnchorId

      const res = await api.get<ScheduleSession[]>('/api/v1/schedule/sessions', params)
      if (Array.isArray(res)) {
        setSessions(res)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeta()
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [filterDate, filterRoomId, filterAnchorId])

  const handleOpenCreateModal = () => {
    setEditingId(null)
    setModalForm({
      title: `常规排期 · ${filterDate}`,
      date: filterDate,
      startTime: '19:00:00',
      endTime: '23:30:00',
      roomId: meta.rooms[0] ? String(meta.rooms[0].id) : '',
      anchorId: meta.anchors[0] ? String(meta.anchors[0].id) : '',
      controllerId: meta.controllers && meta.controllers[0] ? String(meta.controllers[0].id) : '',
      operatorId: meta.operators[0] ? String(meta.operators[0].id) : '',
      remark: '',
    })
    setIsModalOpen(true)
  }

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalForm.roomId) {
      setMessageNotice({ type: 'error', text: '请选择开播直播间' })
      return
    }
    if (!modalForm.anchorId) {
      setMessageNotice({ type: 'error', text: '请选择出镜带货主播' })
      return
    }
    setMessageNotice(null)
    try {
      const payload = {
        title: modalForm.title,
        date: modalForm.date,
        startTime: modalForm.startTime,
        endTime: modalForm.endTime,
        roomId: Number(modalForm.roomId),
        anchorId: Number(modalForm.anchorId),
        controllerId: modalForm.controllerId ? Number(modalForm.controllerId) : null,
        operatorId: modalForm.operatorId ? Number(modalForm.operatorId) : null,
        remark: modalForm.remark,
      }
      if (editingId) {
        await api.put(`/api/v1/schedule/sessions/${editingId}`, payload)
        setMessageNotice({ type: 'success', text: '排班场次已成功更新！' })
      } else {
        await api.post('/api/v1/schedule/sessions', payload)
        setMessageNotice({ type: 'success', text: '新排班场次已创建成功！' })
      }
      setIsModalOpen(false)
      fetchSessions()
    } catch (err: any) {
      setMessageNotice({ type: 'error', text: err.message || '操作失败' })
    }
  }

  const handleDeleteSession = async (id: number) => {
    if (!confirm('确定删除该排班场次？')) return
    try {
      await api.delete(`/api/v1/schedule/sessions/${id}`)
      fetchSessions()
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  const handleApplyAiSchedule = async () => {
    if (!confirm(`确定将 AI 测算的 4 大黄金时段排班一键应用到【${filterDate}】？`)) return
    setIsAiLoading(true)
    setMessageNotice(null)
    try {
      const recRes: any = await api.get('/api/v1/schedule/recommendations')
      if (recRes?.schedule) {
        await api.post('/api/v1/schedule/apply-recommendation', {
          targetDate: filterDate,
          roomId: meta.rooms[0]?.id || 1,
          scheduleItems: recRes.schedule,
        })
        setMessageNotice({ type: 'success', text: `AI 智能排班已全量应用至 ${filterDate}！` })
        fetchSessions()
      }
    } catch (err: any) {
      setMessageNotice({ type: 'error', text: err.message || 'AI 排班应用失败' })
    } finally {
      setIsAiLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px] text-[var(--text-primary)]">
      {/* 顶部标题与主要操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-orbit-primary" />
            直播排班管理中心
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            统筹多直播间、代播项目与在职主播时段排期，智能冲突检测与 AI 测算黄金时段一键排布
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleApplyAiSchedule}
            disabled={isAiLoading}
            className="flex items-center gap-1.5 border border-orbit-primary/40 text-orbit-primary hover:bg-orbit-primary/40"
          >
            <Sparkles className="w-4 h-4 text-orbit-primary" />
            {isAiLoading ? 'AI测算编排中...' : 'AI 智能一键排班'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 bg-orbit-primary hover:bg-orbit-primary-dark"
          >
            <Plus className="w-4 h-4" />
            新增排班场次
          </Button>
        </div>
      </div>

      {messageNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${messageNotice.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
            : 'bg-rose-950/40 border-rose-700/50 text-rose-300'
            }`}
        >
          <span>{messageNotice.text}</span>
          <button onClick={() => setMessageNotice(null)} className="hover:opacity-80">
            ✕
          </button>
        </div>
      )}

      {/* 控制与筛选栏 */}
      <div className="bg-orbit-surface border border-orbit-border p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-secondary)]">排班日期：</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-orbit-surface2 border border-orbit-border rounded-lg px-2.5 py-1 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary/40"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-secondary)]">直播间：</span>
            <select
              value={filterRoomId}
              onChange={(e) => setFilterRoomId(e.target.value)}
              className="bg-orbit-surface2 border border-orbit-border rounded-lg px-2.5 py-1 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary/40"
            >
              <option value="all">全部直播间</option>
              {meta.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-secondary)]">排班主播：</span>
            <select
              value={filterAnchorId}
              onChange={(e) => setFilterAnchorId(e.target.value)}
              className="bg-orbit-surface2 border border-orbit-border rounded-lg px-2.5 py-1 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary/40"
            >
              <option value="all">全部主播</option>
              {meta.anchors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.level}级)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-orbit-surface2 p-1 rounded-lg border border-orbit-border">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1 rounded text-xs transition-colors ${viewMode === 'calendar' ? 'bg-orbit-primary text-white font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
          >
            时段日历看板
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded text-xs transition-colors ${viewMode === 'table' ? 'bg-orbit-primary text-white font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
          >
            排班数据表
          </button>
        </div>
      </div>

      {/* 视图展现 */}
      {viewMode === 'calendar' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: '早间清醒场 (07:00-11:00)', range: ['07:00:00', '11:00:00'] },
              { title: '午间白领场 (11:30-15:30)', range: ['11:30:00', '15:30:00'] },
              { title: '晚间巅峰场 (18:30-23:30)', range: ['18:30:00', '23:30:00'] },
              { title: '深夜长尾场 (23:30-03:00)', range: ['23:30:00', '03:00:00'] },
            ].map((slot, idx) => {
              const matchedSessions = sessions.filter((s) => {
                if (!s.startTime) return false
                if (idx === 0) return s.startTime < '11:30:00'
                if (idx === 1) return s.startTime >= '11:30:00' && s.startTime < '16:00:00'
                if (idx === 2) return s.startTime >= '16:00:00' && s.startTime < '23:30:00'
                return s.startTime >= '23:30:00' || s.startTime < '06:00:00'
              })

              return (
                <div
                  key={slot.title}
                  className="bg-orbit-surface border border-orbit-border rounded-2xl p-4 flex flex-col space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-orbit-border">
                    <h3 className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-orbit-primary" />
                      {slot.title}
                    </h3>
                    <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                      {matchedSessions.length} 场
                    </span>
                  </div>

                  <div className="space-y-2 flex-1">
                    {matchedSessions.length > 0 ? (
                      matchedSessions.map((session) => (
                        <div
                          key={session.id}
                          className="bg-orbit-surface2 border border-orbit-border rounded-xl p-3 space-y-2 hover:border-orbit-primary/50 transition-all text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--text-primary)]">{session.title}</span>
                            <Badge variant={statusMap[session.status]?.badge || 'info'}>
                              {statusMap[session.status]?.label || session.status}
                            </Badge>
                          </div>

                          <div className="text-[var(--text-secondary)] flex items-center justify-between">
                            <span className="text-orbit-primary font-medium flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              {session.anchorName}
                            </span>
                            <span className="text-[var(--text-secondary)] text-[11px] font-mono">
                              {session.startTime?.slice(0, 5)} ~ {session.endTime?.slice(0, 5)}
                            </span>
                          </div>

                          <div className="text-[11px] text-[var(--text-secondary)] flex items-center justify-between pt-1 border-t border-orbit-border">
                            <span className="truncate max-w-[120px]">{session.roomName || '未分配直播间'}</span>
                            <span className="truncate text-orbit-primary font-medium">
                              {session.controllerName ? `中控: ${session.controllerName}` : (session.operatorName ? `运营: ${session.operatorName}` : '团队未齐')}
                            </span>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                setEditingId(session.id)
                                setModalForm({
                                  title: session.title,
                                  date: session.date,
                                  startTime: session.startTime,
                                  endTime: session.endTime,
                                  roomId: String(session.roomId),
                                  anchorId: String(session.anchorId),
                                  controllerId: session.controllerId ? String(session.controllerId) : '',
                                  operatorId: session.operatorId ? String(session.operatorId) : '',
                                  remark: session.remark || '',
                                })
                                setIsModalOpen(true)
                              }}
                              className="text-[var(--text-muted)] hover:text-orbit-primary text-[10px] flex items-center gap-0.5"
                            >
                              <Edit2 className="w-2.5 h-2.5" /> 编辑
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="text-[var(--text-muted)] hover:text-rose-400 text-[10px] flex items-center gap-0.5"
                            >
                              <Trash2 className="w-2.5 h-2.5" /> 删除
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-32 flex flex-col items-center justify-center text-[var(--text-muted)] text-[11px] border border-dashed border-[var(--border)] rounded-xl">
                        <span>此时段暂无排期</span>
                        <button
                          onClick={handleOpenCreateModal}
                          className="mt-1 text-orbit-primary hover:underline"
                        >
                          + 安排主播
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* 表格视图 */
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">排班明细列表</h3>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-orbit-surface2 text-[var(--text-secondary)] border-b border-orbit-border font-medium">
                  <tr>
                    <th className="py-3 px-4">场次主题</th>
                    <th className="py-3 px-4">开播日期与时间</th>
                    <th className="py-3 px-4">开播直播间</th>
                    <th className="py-3 px-4">带货主播</th>
                    <th className="py-3 px-4">现场中控</th>
                    <th className="py-3 px-4">场控运营</th>
                    <th className="py-3 px-4">状态</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sessions.length > 0 ? (
                    sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-orbit-ink/30 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">{s.title}</td>
                        <td className="py-3.5 px-4 font-mono text-[var(--text-secondary)]">
                          {s.date} {s.startTime?.slice(0, 5)} ~ {s.endTime?.slice(0, 5)}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--text-secondary)] font-medium">{s.roomName}</td>
                        <td className="py-3.5 px-4 text-orbit-primary font-medium">
                          {s.anchorName} ({s.anchorLevel}级)
                        </td>
                        <td className="py-3.5 px-4 text-[var(--text-secondary)]">{s.controllerName || <span className="text-[var(--text-muted)]">未指定</span>}</td>
                        <td className="py-3.5 px-4 text-[var(--text-muted)]">{s.operatorName || <span className="text-[var(--text-muted)]">未指定</span>}</td>
                        <td className="py-3.5 px-4">
                          <Badge variant={statusMap[s.status]?.badge || 'info'}>
                            {statusMap[s.status]?.label || s.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingId(s.id)
                              setModalForm({
                                title: s.title,
                                date: s.date,
                                startTime: s.startTime,
                                endTime: s.endTime,
                                roomId: String(s.roomId),
                                anchorId: String(s.anchorId),
                                controllerId: s.controllerId ? String(s.controllerId) : '',
                                operatorId: s.operatorId ? String(s.operatorId) : '',
                                remark: s.remark || '',
                              })
                              setIsModalOpen(true)
                            }}
                            className="text-xs text-orbit-primary hover:text-orbit-primary"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDeleteSession(s.id)}
                            className="text-xs text-rose-400 hover:text-rose-300"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                        当前暂无排班记录，点击右上角新增或使用 AI 智能排班
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 新建/编辑排班弹窗 */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-orbit-surface border border-orbit-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-orbit-border mb-4">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-orbit-primary" />
                  {editingId ? '编辑排班场次' : '新建直播排班'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSession} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">场次主题</label>
                  <input
                    type="text"
                    required
                    value={modalForm.title}
                    onChange={(e) => setModalForm({ ...modalForm, title: e.target.value })}
                    className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-orbit-primary/40"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[var(--text-primary)] mb-1 font-medium">开播日期</label>
                    <input
                      type="date"
                      required
                      value={modalForm.date}
                      onChange={(e) => setModalForm({ ...modalForm, date: e.target.value })}
                      className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-2 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary/40 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-primary)] mb-1 font-medium">开始时间</label>
                    <input
                      type="time"
                      required
                      step="1"
                      value={modalForm.startTime}
                      onChange={(e) => setModalForm({ ...modalForm, startTime: e.target.value })}
                      className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-2 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary/40 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-primary)] mb-1 font-medium">结束时间</label>
                    <input
                      type="time"
                      required
                      step="1"
                      value={modalForm.endTime}
                      onChange={(e) => setModalForm({ ...modalForm, endTime: e.target.value })}
                      className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-2 py-2 text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary/40 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-primary)] mb-1 font-medium text-xs">
                      开播直播间 <span className="text-red-400">*</span>
                    </label>
                    <SearchableSelect
                      options={meta.rooms.map((r) => ({
                        value: String(r.id),
                        label: r.name,
                        subLabel: r.platform ? `${r.platform.toUpperCase()} 平台` : '自建直播间',
                      }))}
                      value={modalForm.roomId}
                      onChange={(val) => setModalForm({ ...modalForm, roomId: val })}
                      placeholder="下拉或搜索选择直播间..."
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-primary)] mb-1 font-medium text-xs">
                      出镜带货主播 <span className="text-red-400">*</span>
                    </label>
                    <SearchableSelect
                      options={meta.anchors.map((a) => ({
                        value: String(a.id),
                        label: a.name,
                        subLabel: `${a.level}级主播`,
                      }))}
                      value={modalForm.anchorId}
                      onChange={(val) => setModalForm({ ...modalForm, anchorId: val })}
                      placeholder="下拉或搜索选择主播..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-primary)] mb-1 font-medium text-xs">现场中控场控 (可选)</label>
                    <SearchableSelect
                      options={(meta.controllers && meta.controllers.length > 0 ? meta.controllers : meta.operators).map((c) => ({
                        value: String(c.id),
                        label: c.name,
                        subLabel: c.role === 'controller' ? '专业中控' : (c.role || '现场场控'),
                      }))}
                      value={modalForm.controllerId}
                      onChange={(val) => setModalForm({ ...modalForm, controllerId: val })}
                      placeholder="下拉或搜索现场中控..."
                      allowClear
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-primary)] mb-1 font-medium text-xs">跟播运营专员 (可选)</label>
                    <SearchableSelect
                      options={meta.operators.map((op) => ({
                        value: String(op.id),
                        label: op.name,
                        subLabel: op.role || '运营专员',
                      }))}
                      value={modalForm.operatorId}
                      onChange={(val) => setModalForm({ ...modalForm, operatorId: val })}
                      placeholder="下拉或搜索跟播运营..."
                      allowClear
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-primary)] mb-1 font-medium">备播说明与备注</label>
                  <textarea
                    rows={2}
                    value={modalForm.remark}
                    onChange={(e) => setModalForm({ ...modalForm, remark: e.target.value })}
                    placeholder="重点主推款、配合中控话术要点..."
                    className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-orbit-primary/40"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-orbit-border">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    {editingId ? '保存修改' : '确认创建'}
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
export default ScheduleManagementPage
