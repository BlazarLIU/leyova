import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, CalendarRange, User } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type SessionStatus = 'live' | 'ended' | 'scheduled'
type FilterValue = 'all' | SessionStatus

interface SessionItem {
  id: string
  title: string
  anchor: string
  startTime: string
  endTime: string
  gmv: string
  roi: number
  status: SessionStatus
  staff: Array<{ roleCode: string; roleName: string; staffName: string }>
}



const statusBadgeMap: Record<SessionStatus, { variant: 'success' | 'neutral' | 'warning'; label: string }> = {
  live: { variant: 'success', label: '进行中' },
  ended: { variant: 'neutral', label: '已结束' },
  scheduled: { variant: 'warning', label: '待开始' },
}

const PAGE_SIZE = 8

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterValue>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    api.get<Record<string, any>>('/api/overview/sessions')
      .then(data => {
        if (!data?.sessions || !Array.isArray(data.sessions)) return
        const transformed = data.sessions.map((s: any) => ({
          id: `S${String(s.id).padStart(3, '0')}`,
          title: `${s.room} · ${s.date}`,
          anchor: s.anchor ?? '未知',
          startTime: `${s.date} ${s.start_time ?? '00:00'}`,
          endTime: `${s.date} ${s.end_time ?? '00:00'}`,
          gmv: s.status === 'live' || s.status === 'completed' ? `¥${s.gmv ?? 0}` : '-',
          roi: s.roi ?? 0,
          status: s.status === 'live' ? 'live' : 'ended' as SessionStatus,
          staff: Array.isArray(s.staff) ? s.staff : [],
        }))
        setSessions(transformed)
      })
      .catch(() => {})
  }, [])

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      session.title.toLowerCase().includes(searchText.toLowerCase()) ||
      session.anchor.toLowerCase().includes(searchText.toLowerCase()) ||
      session.id.toLowerCase().includes(searchText.toLowerCase())
    const matchesStatus = filterStatus === 'all' || session.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedSessions = filteredSessions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const filters: { value: FilterValue; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'live', label: '进行中' },
    { value: 'ended', label: '已结束' },
    { value: 'scheduled', label: '待开始' },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">场次管理</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">直播场次管理与查看</p>
          </div>
        </div>
      </motion.div>

      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1) }}
            placeholder="搜索场次 ID、标题或主播..."
            className="w-full h-9 pl-9 pr-3 text-sm bg-orbit-surface2 border border-orbit-border rounded-lg text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary/50 transition-colors"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilterStatus(f.value); setCurrentPage(1) }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === f.value
                  ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                  : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Create button */}
        <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
          创建场次
        </Button>
      </motion.div>

      {/* Sessions table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader
            title="直播场次列表"
            subtitle={`共 ${filteredSessions.length} 个场次`}
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">场次 ID</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">直播标题</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">主播</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">开始时间</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">结束时间</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">GMV</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">ROI</th>
                    <th className="text-center text-xs text-[var(--text-muted)] font-medium px-5 py-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-[var(--text-muted)] text-sm">
                        没有匹配的场次记录
                      </td>
                    </tr>
                  ) : (
                    paginatedSessions.map((session) => {
                      const badge = statusBadgeMap[session.status]
                      return (
                        <tr
                          key={session.id}
                          className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <span className="text-[var(--text-muted)] font-mono text-xs">{session.id}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <CalendarRange className="w-4 h-4 text-[var(--text-primary)]" />
                              <span className="text-[var(--text-secondary)] font-medium">{session.title}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                              <span className="text-[var(--text-muted)]">{session.anchor}</span>
                            </div>
                            {/* P0-2：排班与场次联动 —— 展示当班岗位分工 */}
                            {session.staff.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {session.staff.map((st, i) => (
                                  <span
                                    key={i}
                                    title={`${st.roleName}：${st.staffName}`}
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--hover-bg3)] border border-orbit-border/60 text-[var(--text-muted)]"
                                  >
                                    {st.roleName} {st.staffName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{session.startTime}</td>
                          <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{session.endTime}</td>
                          <td className="px-5 py-3.5 text-right text-status-success font-medium">
                            {session.gmv}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[var(--text-secondary)]">
                            {session.roi > 0 ? session.roi.toFixed(2) : '-'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <Badge variant={badge.variant} dot>{badge.label}</Badge>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Pagination */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.35 }}
        className="flex items-center justify-between text-sm"
      >
        <p className="text-[var(--text-muted)] text-xs">
          显示第 {(safePage - 1) * PAGE_SIZE + 1} - {Math.min(safePage * PAGE_SIZE, filteredSessions.length)} 条，共 {filteredSessions.length} 条
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                page === safePage
                  ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                  : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            下一页
          </button>
        </div>
      </motion.div>
    </div>
  )
}