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
  rooms: Array<{ id: number; name: string }>
  anchors: Array<{ id: number; name: string; level: string }>
  operators: Array<{ id: number; name: string }>
  projects: Array<{ id: number; name: string; brandName: string }>
}

const statusMap: Record<string, { label: string; badge: 'info' | 'success' | 'warning' | 'neutral' }> = {
  scheduled: { label: '待开播', badge: 'info' },
  live: { label: '直播中', badge: 'success' },
  completed: { label: '已完结', badge: 'neutral' },
  cancelled: { label: '已取消', badge: 'warning' },
}

export const ScheduleManagementPage: React.FC = () => {
  const [sessions, setSessions] = useState<ScheduleSession[]>([])
  const [meta, setMeta] = useState<MetaData>({ rooms: [], anchors: [], operators: [], projects: [] })
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
    operatorId: '',
    projectId: '',
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
      operatorId: meta.operators[0] ? String(meta.operators[0].id) : '',
      projectId: meta.projects[0] ? String(meta.projects[0].id) : '',
      remark: '',
    })
    setIsModalOpen(true)
  }

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessageNotice(null)
    try {
      if (editingId) {
        await api.put(`/api/v1/schedule/sessions/${editingId}`, {
          title: modalForm.title,
          date: modalForm.date,
          startTime: modalForm.startTime,
          endTime: modalForm.endTime,
          roomId: Number(modalForm.roomId),
          anchorId: Number(modalForm.anchorId),
          operatorId: modalForm.operatorId ? Number(modalForm.operatorId) : null,
          projectId: modalForm.projectId ? Number(modalForm.projectId) : null,
          remark: modalForm.remark,
        })
        setMessageNotice({ type: 'success', text: '排班场次已成功更新！' })
      } else {
        await api.post('/api/v1/schedule/sessions', {
          title: modalForm.title,
          date: modalForm.date,
          startTime: modalForm.startTime,
          endTime: modalForm.endTime,
          roomId: Number(modalForm.roomId),
          anchorId: Number(modalForm.anchorId),
          operatorId: modalForm.operatorId ? Number(modalForm.operatorId) : null,
          projectId: modalForm.projectId ? Number(modalForm.projectId) : null,
          remark: modalForm.remark,
        })
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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px] text-gray-100">
      {/* 顶部标题与主要操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-indigo-400" />
            直播排班管理中心
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            统筹多直播间、代播项目与在职主播时段排期，智能冲突检测与 AI 测算黄金时段一键排布
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleApplyAiSchedule}
            disabled={isAiLoading}
            className="flex items-center gap-1.5 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/40"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            {isAiLoading ? 'AI测算编排中...' : 'AI 智能一键排班'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500"
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
      <div className="bg-gray-900/70 border border-gray-800/80 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">排班日期：</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">直播间：</span>
            <select
              value={filterRoomId}
              onChange={(e) => setFilterRoomId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-indigo-500"
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
            <span className="text-gray-400">排班主播：</span>
            <select
              value={filterAnchorId}
              onChange={(e) => setFilterAnchorId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-indigo-500"
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

        <div className="flex items-center gap-1 bg-gray-800/80 p-1 rounded-lg border border-gray-700">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1 rounded text-xs transition-colors ${viewMode === 'calendar' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-white'
              }`}
          >
            时段日历看板
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded text-xs transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-white'
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
                  className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 flex flex-col space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                    <h3 className="font-semibold text-xs text-gray-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      {slot.title}
                    </h3>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {matchedSessions.length} 场
                    </span>
                  </div>

                  <div className="space-y-2 flex-1">
                    {matchedSessions.length > 0 ? (
                      matchedSessions.map((session) => (
                        <div
                          key={session.id}
                          className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-3 space-y-2 hover:border-indigo-500/50 transition-all text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-100">{session.title}</span>
                            <Badge variant={statusMap[session.status]?.badge || 'info'}>
                              {statusMap[session.status]?.label || session.status}
                            </Badge>
                          </div>

                          <div className="text-gray-300 flex items-center justify-between">
                            <span className="text-indigo-300 font-medium flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              {session.anchorName}
                            </span>
                            <span className="text-gray-400 text-[11px] font-mono">
                              {session.startTime?.slice(0, 5)} ~ {session.endTime?.slice(0, 5)}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-700/50">
                            <span>{session.roomName || '未分配直播间'}</span>
                            <span>{session.projectName ? session.projectName.slice(0, 8) : '自播'}</span>
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
                                  operatorId: session.operatorId ? String(session.operatorId) : '',
                                  projectId: session.projectId ? String(session.projectId) : '',
                                  remark: session.remark || '',
                                })
                                setIsModalOpen(true)
                              }}
                              className="text-gray-400 hover:text-indigo-300 text-[10px] flex items-center gap-0.5"
                            >
                              <Edit2 className="w-2.5 h-2.5" /> 编辑
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="text-gray-400 hover:text-rose-400 text-[10px] flex items-center gap-0.5"
                            >
                              <Trash2 className="w-2.5 h-2.5" /> 删除
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-32 flex flex-col items-center justify-center text-gray-500 text-[11px] border border-dashed border-gray-800 rounded-xl">
                        <span>此时段暂无排期</span>
                        <button
                          onClick={handleOpenCreateModal}
                          className="mt-1 text-indigo-400 hover:underline"
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
            <h3 className="text-sm font-semibold text-gray-200">排班明细列表</h3>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-medium">
                  <tr>
                    <th className="py-3 px-4">场次主题</th>
                    <th className="py-3 px-4">开播日期与时间</th>
                    <th className="py-3 px-4">直播间</th>
                    <th className="py-3 px-4">执棒主播</th>
                    <th className="py-3 px-4">场控运营</th>
                    <th className="py-3 px-4">项目归属</th>
                    <th className="py-3 px-4">状态</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {sessions.length > 0 ? (
                    sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-gray-200">{s.title}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-300">
                          {s.date} {s.startTime?.slice(0, 5)} ~ {s.endTime?.slice(0, 5)}
                        </td>
                        <td className="py-3.5 px-4 text-gray-300">{s.roomName}</td>
                        <td className="py-3.5 px-4 text-indigo-300 font-medium">
                          {s.anchorName} ({s.anchorLevel}级)
                        </td>
                        <td className="py-3.5 px-4 text-gray-400">{s.operatorName || '未指定'}</td>
                        <td className="py-3.5 px-4 text-gray-400">{s.projectName || '自营自播'}</td>
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
                                operatorId: s.operatorId ? String(s.operatorId) : '',
                                projectId: s.projectId ? String(s.projectId) : '',
                                remark: s.remark || '',
                              })
                              setIsModalOpen(true)
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
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
                      <td colSpan={8} className="py-12 text-center text-gray-500">
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
              className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                  {editingId ? '编辑排班场次' : '新建直播排班'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSession} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-300 mb-1 font-medium">场次主题</label>
                  <input
                    type="text"
                    required
                    value={modalForm.title}
                    onChange={(e) => setModalForm({ ...modalForm, title: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">开播日期</label>
                    <input
                      type="date"
                      required
                      value={modalForm.date}
                      onChange={(e) => setModalForm({ ...modalForm, date: e.target.value })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">开始时间</label>
                    <input
                      type="time"
                      required
                      step="1"
                      value={modalForm.startTime}
                      onChange={(e) => setModalForm({ ...modalForm, startTime: e.target.value })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">结束时间</label>
                    <input
                      type="time"
                      required
                      step="1"
                      value={modalForm.endTime}
                      onChange={(e) => setModalForm({ ...modalForm, endTime: e.target.value })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">直播间</label>
                    <select
                      required
                      value={modalForm.roomId}
                      onChange={(e) => setModalForm({ ...modalForm, roomId: e.target.value })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      {meta.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">执棒主播</label>
                    <select
                      required
                      value={modalForm.anchorId}
                      onChange={(e) => setModalForm({ ...modalForm, anchorId: e.target.value })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      {meta.anchors.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.level}级)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">运营场控 (可选)</label>
                    <select
                      value={modalForm.operatorId}
                      onChange={(e) => setModalForm({ ...modalForm, operatorId: e.target.value })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">未指定</option>
                      {meta.operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">代播项目 (可选)</label>
                    <select
                      value={modalForm.projectId}
                      onChange={(e) => setModalForm({ ...modalForm, projectId: e.target.value })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">品牌自播</option>
                      {meta.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-medium">备播说明与备注</label>
                  <textarea
                    rows={2}
                    value={modalForm.remark}
                    onChange={(e) => setModalForm({ ...modalForm, remark: e.target.value })}
                    placeholder="重点主推款、配合中控话术要点..."
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
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
