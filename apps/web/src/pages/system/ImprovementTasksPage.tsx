import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Clock, User, CalendarDays, BarChart3, PlayCircle, CheckCircle2, X } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type TaskStatus = 'all' | 'pending' | 'in_progress' | 'completed'

interface TaskItem {
  id: string
  title: string
  description: string
  assignee: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string
  progress: number
  status: 'pending' | 'in_progress' | 'completed'
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
]

const priorityConfig: Record<string, { label: string; variant: 'danger' | 'warning' | 'info' }> = {
  high: { label: '高优先级', variant: 'danger' },
  medium: { label: '中优先级', variant: 'warning' },
  low: { label: '低优先级', variant: 'info' },
}

const statusConfig: Record<string, { label: string; variant: 'danger' | 'warning' | 'success' }> = {
  pending: { label: '待处理', variant: 'danger' },
  in_progress: { label: '进行中', variant: 'warning' },
  completed: { label: '已完成', variant: 'success' },
}



export function ImprovementTasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('all')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: '', priority: 'medium', dueDate: '' })

  useEffect(() => {
    api.get<any>('/api/system/tasks', {
      status: statusFilter !== 'all' ? statusFilter : undefined,
    })
      .then((res) => {
        if (res.tasks) setTasks(res.tasks)
      })
      .catch(() => {})
  }, [statusFilter])

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.put(`/api/system/tasks/${id}/status`, { status: newStatus })
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: newStatus as TaskItem['status'] } : t))
      )
    } catch {
      // keep current state
    }
  }

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">改进任务</h1>
            <p className="text-slate-500 text-sm mt-1">系统改进任务管理</p>
          </div>
        </div>
      </motion.div>

      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          创建任务
        </Button>

        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-500" />
          <div className="flex items-center gap-1">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                    : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Task cards */}
      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map((task, i) => {
          const { label: pLabel, variant: pVariant } = priorityConfig[task.priority]
          const { label: sLabel, variant: sVariant } = statusConfig[task.status]

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
            >
              <Card className="hover:border-orbit-border2 transition-colors">
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    {/* Left content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-sm font-semibold text-slate-200">{task.title}</h4>
                        <Badge variant={pVariant}>{pLabel}</Badge>
                        <Badge variant={sVariant} dot>{sLabel}</Badge>
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2 mb-3">{task.description}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          <span>截止 {task.dueDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>进度 {task.progress}%</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 bg-orbit-surface3 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            task.progress === 100
                              ? 'bg-emerald-500'
                              : task.progress > 0
                                ? 'bg-gradient-to-r from-orbit-primary to-orbit-accent'
                                : ''
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                          className="flex items-center gap-1 text-xs text-orbit-accent-light hover:text-orbit-accent transition-colors px-3 py-1.5 rounded-lg bg-orbit-accent/10 hover:bg-orbit-accent/20"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          开始处理
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => handleUpdateStatus(task.id, 'completed')}
                          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          标记完成
                        </button>
                      )}
                      {task.status === 'completed' && (
                        <span className="text-xs text-slate-500 px-3 py-1.5">已完成</span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* 创建任务弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-slate-200">创建任务</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">任务标题</label>
                <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="输入任务标题" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">任务描述</label>
                <textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                  className="w-full min-h-[80px] rounded-lg border border-orbit-border bg-orbit-surface2 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 resize-y" placeholder="描述任务内容..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">负责人</label>
                  <input value={newTask.assignee} onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="负责人" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">优先级</label>
                  <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="high">高优先级</option>
                    <option value="medium">中优先级</option>
                    <option value="low">低优先级</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">截止日期</label>
                  <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>取消</Button>
              <Button variant="primary" onClick={async () => {
                if (!newTask.title.trim()) return
                setSaving(true)
                try {
                  await api.post('/api/system/tasks', newTask)
                  setShowCreateModal(false)
                  setNewTask({ title: '', description: '', assignee: '', priority: 'medium', dueDate: '' })
                  const res = await api.get<any>('/api/system/tasks', { status: statusFilter !== 'all' ? statusFilter : undefined })
                  if (res.tasks) setTasks(res.tasks)
                } catch { /* 后端接口未实现时静默处理 */ }
                finally { setSaving(false) }
              }} loading={saving}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}