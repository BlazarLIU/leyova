import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, RefreshCw, CalendarDays, Users, AlertTriangle,
  Pencil, X, Save, Plus, Trash2, Coffee,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface StaffItem {
  roleCode: string
  roleName: string
  color: string
  name: string
}

interface CalendarSession {
  id: number
  date: string
  title: string
  startTime: string | null
  endTime: string | null
  status: string
  durationMin: number | null
  gmv: number
  roomId: number | null
  roomName: string | null
  platformCode: string | null
  staff: StaffItem[]
}

interface CalendarData {
  range: { from: string; to: string }
  totals: { sessions: number; fullyStaffed: number; rolesCovered: string[] }
  byDate: Record<string, CalendarSession[]>
  sessions: CalendarSession[]
}

interface StaffRole {
  code: string
  name: string
  sort_order: number
  color: string
  is_multi: boolean
  description: string
  requires_attendance?: boolean
}

interface DayStatusEntry { staffName: string; status: string; note: string }
interface DayStatusData { range: { from: string; to: string }; byDate: Record<string, DayStatusEntry[]> }

const ROLE_COLOR: Record<string, string> = {
  anchor: 'bg-orbit-danger/15 text-status-danger dark:text-status-danger border-orbit-danger/30',
  controller: 'bg-orbit-info/15 text-status-info dark:text-status-info border-orbit-info/30',
  operator: 'bg-orbit-success/15 text-status-success dark:text-status-success border-orbit-success/30',
  ad_buyer: 'bg-orbit-warning/15 text-status-warning dark:text-status-warning border-orbit-warning/30',
  video_editor: 'bg-orbit-primary/15 text-orbit-primary dark:text-orbit-primary border-orbit-primary/30',
  director: 'bg-orbit-success/15 text-status-ai dark:text-status-ai border-orbit-success/30',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '待开播', live: '直播中', completed: '已完成', cancelled: '已取消',
}

const DAY_STATUS_LABEL: Record<string, string> = {
  work: '上班', rest: '排休', leave: '请假', sick: '病假',
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export interface DateTag {
  text: string
  type: 'promo' | 'holiday' | 'weekend'
}

export function getDateTag(dateStr: string): DateTag | null {
  const md = dateStr.slice(5) // MM-DD
  // 电商关键大促节点
  if (md === '06-18') return { text: '618狂欢', type: 'promo' }
  if (md >= '06-01' && md <= '06-17') return { text: '618大促', type: 'promo' }
  if (md === '11-11') return { text: '双11狂欢', type: 'promo' }
  if (md >= '11-01' && md <= '11-10') return { text: '双11预热', type: 'promo' }
  if (md === '12-12') return { text: '双12年终', type: 'promo' }
  if (md === '03-08') return { text: '3.8女王节', type: 'promo' }
  if (md === '05-20') return { text: '520告白季', type: 'promo' }
  if (md === '09-09') return { text: '99超值节', type: 'promo' }

  // 国家法定节假日
  if (md === '01-01') return { text: '元旦', type: 'holiday' }
  if (md === '05-01') return { text: '五一', type: 'holiday' }
  if (md === '05-02' || md === '05-03') return { text: '五一休', type: 'holiday' }
  if (md === '10-01') return { text: '国庆节', type: 'holiday' }
  if (md >= '10-02' && md <= '10-07') return { text: '国庆休', type: 'holiday' }

  // 周末 (周六、周日)
  const [y, m, d] = dateStr.split('-').map(Number)
  const dayOfWeek = new Date(y, m - 1, d).getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { text: dayOfWeek === 6 ? '周六' : '周日', type: 'weekend' }
  }

  return null
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildMonthGrid(year: number, month: number): Array<{ date: string; inMonth: boolean }> {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  const cells: Array<{ date: string; inMonth: boolean }> = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({ date: ymd(d), inMonth: d.getMonth() === month })
  }
  return cells
}

/**
 * 直播排班日历（S6 + S4-C/D）
 *
 * 能力：
 *   1. 月历视图，每格显示场次 + 岗位色块
 *   2. 显示当天排休/请假人员（休息不挂场次，按人×天）
 *   3. 点击场次可编辑岗位编排（主播/中控/运营/投手/拍剪/编导）
 *   4. 可标记人员当日为「排休/请假/病假」
 */
export function LiveScheduleCalendarPage() {
  const { currentPlatform } = usePlatform()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [data, setData] = useState<CalendarData | null>(null)
  const [dayStatus, setDayStatus] = useState<DayStatusData | null>(null)
  const [roles, setRoles] = useState<StaffRole[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  // 视图模式：sessions=场次格视图 / roles=按岗位视图（老大要求：所有岗位都要在日历里体现）
  const [viewMode, setViewMode] = useState<'sessions' | 'roles'>('sessions')

  // 编辑弹窗
  const [editing, setEditing] = useState<CalendarSession | null>(null)
  const [draft, setDraft] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 排休弹窗
  const [restOpen, setRestOpen] = useState(false)
  const [restStaff, setRestStaff] = useState('')
  const [restStatus, setRestStatus] = useState('rest')
  const [restDate, setRestDate] = useState('')

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])
  const rangeFrom = grid[0].date
  const rangeTo = grid[grid.length - 1].date

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams({ from: rangeFrom, to: rangeTo })
      const code = currentPlatform?.platform_code
      if (code) params.set('platform', code)

      const [cal, ds, rl] = await Promise.all([
        api.get<CalendarData>(`/schedule/calendar?${params.toString()}`),
        api.get<DayStatusData>(`/schedule/day-status?from=${rangeFrom}&to=${rangeTo}`).catch(() => null),
        api.get<StaffRole[]>('/schedule/staff-roles').catch(() => [] as StaffRole[]),
      ])
      setData(cal)
      setDayStatus(ds)
      setRoles(rl || [])
    } catch (e: any) {
      setErr(e?.message || '加载排班日历失败')
    } finally {
      setLoading(false)
    }
  }, [rangeFrom, rangeTo, currentPlatform?.platform_code])

  useEffect(() => { load() }, [load])

  const goPrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  const goNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDate(null)
  }
  const goToday = () => {
    const t = new Date(); setYear(t.getFullYear()); setMonth(t.getMonth()); setSelectedDate(ymd(t))
  }

  /** 打开编辑弹窗，把该场次现有岗位转成 draft */
  const openEdit = (s: CalendarSession) => {
    const d: Record<string, string[]> = {}
    for (const r of roles) d[r.code] = []
    for (const st of s.staff) {
      if (!d[st.roleCode]) d[st.roleCode] = []
      d[st.roleCode].push(st.name)
    }
    setDraft(d)
    setEditing(s)
    setMsg(null)
  }

  const addStaff = (roleCode: string) => {
    setDraft(prev => ({ ...prev, [roleCode]: [...(prev[roleCode] || []), ''] }))
  }
  const setStaffAt = (roleCode: string, idx: number, name: string) => {
    setDraft(prev => {
      const arr = [...(prev[roleCode] || [])]
      arr[idx] = name
      return { ...prev, [roleCode]: arr }
    })
  }
  const removeStaff = (roleCode: string, idx: number) => {
    setDraft(prev => {
      const arr = [...(prev[roleCode] || [])]
      arr.splice(idx, 1)
      return { ...prev, [roleCode]: arr }
    })
  }

  const handleSaveStaff = async () => {
    if (!editing) return
    const payload: Array<{ roleCode: string; staffName: string }> = []
    for (const [roleCode, names] of Object.entries(draft)) {
      for (const n of names) {
        const trimmed = (n || '').trim()
        if (trimmed) payload.push({ roleCode, staffName: trimmed })
      }
    }
    if (payload.length === 0) {
      setMsg({ type: 'err', text: '至少填写一个岗位人员' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await api.post(`/schedule/sessions/${editing.id}/staff`, { staff: payload })
      setMsg({ type: 'ok', text: `已保存 ${payload.length} 个岗位编排` })
      setEditing(null)
      await load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRest = async () => {
    if (!restStaff.trim() || !restDate) {
      setMsg({ type: 'err', text: '请填写人员与日期' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await api.put('/schedule/day-status', {
        entries: [{ staffName: restStaff.trim(), bizDate: restDate, status: restStatus }],
      })
      setMsg({ type: 'ok', text: `已标记 ${restStaff} ${restDate} 为${DAY_STATUS_LABEL[restStatus]}` })
      setRestOpen(false)
      setRestStaff('')
      await load()
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  /** 岗位 → 日期 → 人员集合（用于「按岗位视图」） */
  const roleByDate = useMemo(() => {
    const map = new Map<string, Map<string, Set<string>>>()
    for (const s of data?.sessions || []) {
      for (const st of s.staff) {
        if (!map.has(st.roleCode)) map.set(st.roleCode, new Map())
        const byDate = map.get(st.roleCode)!
        if (!byDate.has(s.date)) byDate.set(s.date, new Set())
        byDate.get(s.date)!.add(st.name)
      }
    }
    return map
  }, [data])

  /** 当月日期列（1..月末） */
  const monthDays = useMemo(() => {
    const last = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: last }, (_, i) => {
      const d = String(i + 1).padStart(2, '0')
      return `${year}-${String(month + 1).padStart(2, '0')}-${d}`
    })
  }, [year, month])

  /** 某日休息人员（按岗位无关，人×天） */
  const restByDate = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const [d, list] of Object.entries(dayStatus?.byDate || {})) {
      const rests = list.filter(x => x.status !== 'work')
      if (rests.length > 0) m.set(d, rests.map(x => `${x.staffName}(${DAY_STATUS_LABEL[x.status] || x.status})`))
    }
    return m
  }, [dayStatus])

  const todayStr = ymd(today)
  const selectedSessions = selectedDate ? (data?.byDate?.[selectedDate] || []) : []
  const selectedRests = selectedDate ? (dayStatus?.byDate?.[selectedDate] || []) : []
  const monthSessionCount = Object.entries(data?.byDate || {})
    .filter(([d]) => d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .reduce((a, [, list]) => a + list.length, 0)

  return (
    <div className="space-y-4">
      <motion.div {...fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-orbit-primary" /> 直播排班
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            月历查看每场直播的岗位编排（主播/中控/运营/投手/拍剪/编导）；休息按「人 × 天」单独标记，不挂场次
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={goToday}>今天</Button>
          <div className="flex items-center rounded-lg border border-orbit-border overflow-hidden">
            <button onClick={goPrev} className="px-2 py-1.5 hover:bg-[var(--hover-bg)] text-[var(--text-secondary)]"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 py-1.5 text-xs text-[var(--text-secondary)] font-medium tabular-nums">{year} 年 {month + 1} 月</span>
            <button onClick={goNext} className="px-2 py-1.5 hover:bg-[var(--hover-bg)] text-[var(--text-secondary)]"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <Button variant="secondary" onClick={() => { setRestDate(selectedDate || todayStr); setRestOpen(true) }}>
            <Coffee className="w-4 h-4" /> 排休
          </Button>
          <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </motion.div>

      {err && (
        <div className="rounded-lg border border-orbit-danger/30 bg-orbit-danger/10 px-3 py-2 text-xs text-status-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}
      {msg && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${msg.type === 'ok' ? 'border-orbit-success/30 bg-orbit-success/10 text-status-success' : 'border-orbit-danger/30 bg-orbit-danger/10 text-status-danger'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">本月场次 {monthSessionCount}</Badge>
        <Badge variant="info">全月记录 {data?.totals.sessions ?? 0}</Badge>
        <Badge variant="success">核心岗位齐备 {data?.totals.fullyStaffed ?? 0}</Badge>
        <span className="text-[11px] text-[var(--text-muted)] ml-1">已覆盖：{(data?.totals.rolesCovered || []).join(' / ') || '—'}</span>
      </div>

      {/* 视图切换 */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-orbit-border overflow-hidden">
          <button
            onClick={() => setViewMode('sessions')}
            className={`px-3 py-1.5 text-xs transition ${viewMode === 'sessions' ? 'bg-orbit-primary/15 text-orbit-primary' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
          >
            场次视图
          </button>
          <button
            onClick={() => setViewMode('roles')}
            className={`px-3 py-1.5 text-xs transition ${viewMode === 'roles' ? 'bg-orbit-primary/15 text-orbit-primary' : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'}`}
          >
            按岗位视图
          </button>
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">
          {viewMode === 'sessions' ? '按场次查看岗位色块' : '按岗位查看每天在岗人员（6 个岗位全部体现）'}
        </span>
      </div>

      {viewMode === 'roles' ? (
        /* ─── 按岗位视图：纵向 6 个岗位，横向整月日期 ─── */
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-[var(--text-secondary)]">按岗位排班表（{year} 年 {month + 1} 月）</span>
            <Badge variant="info">{roles.length} 个岗位</Badge>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-orbit-surface px-2 py-1.5 text-left text-[var(--text-muted)] font-medium border-b border-r border-orbit-border min-w-[64px]">
                      岗位
                    </th>
                    {monthDays.map(d => {
                      const day = Number(d.slice(8, 10))
                      const isToday = d === todayStr
                      const tag = getDateTag(d)
                      const [dy, dm, dd] = d.split('-').map(Number)
                      const isW = new Date(dy, dm - 1, dd).getDay() === 0 || new Date(dy, dm - 1, dd).getDay() === 6
                      return (
                        <th
                          key={d}
                          className={`px-1 py-1.5 text-center font-normal border-b border-orbit-border min-w-[72px] ${
                            isToday ? 'text-orbit-primary font-bold bg-orbit-primary/5' :
                            isW ? 'text-status-warning font-semibold bg-orbit-warning/5' :
                            'text-[var(--text-primary)] dark:text-[var(--text-muted)] font-medium'
                          }`}
                        >
                          <div>{day}</div>
                          {tag && (
                            <div className={`text-[8px] font-semibold leading-tight ${
                              tag.type === 'promo' ? 'text-red-500 font-bold' :
                              tag.type === 'holiday' ? 'text-red-400' : 'text-amber-500'
                            }`}>
                              {tag.text}
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {roles.map(r => {
                    const byDate = roleByDate.get(r.code)
                    return (
                      <tr key={r.code}>
                        <td className="sticky left-0 z-10 bg-orbit-surface px-2 py-1 border-b border-r border-orbit-border">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ROLE_COLOR[r.code] || 'bg-[var(--hover-bg3)] text-[var(--text-secondary)] border-orbit-border/60'}`}>
                            {r.name}
                          </span>
                        </td>
                        {monthDays.map(d => {
                          const names = byDate?.get(d) ? Array.from(byDate.get(d)!) : []
                          const isToday = d === todayStr
                          return (
                            <td key={d} className={`px-1 py-1 align-top border-b border-r border-orbit-border/40 ${isToday ? 'bg-orbit-primary/5' : ''}`}>
                              {names.length === 0 ? (
                                <span className="text-[var(--text-muted)] dark:text-[var(--text-primary)] font-bold">·</span>
                              ) : (
                                <div className="space-y-0.5">
                                  {names.map((n, i) => (
                                    <div key={i} className="text-[10px] text-[var(--text-primary)] truncate" title={n}>{n}</div>
                                  ))}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {/* 休息行 */}
                  <tr>
                    <td className="sticky left-0 z-10 bg-orbit-surface px-2 py-1 border-b border-r border-orbit-border">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-orbit-warning/30 text-status-warning dark:text-status-warning font-medium">休息</span>
                    </td>
                    {monthDays.map(d => {
                      const rests = restByDate.get(d) || []
                      return (
                        <td key={d} className="px-1 py-1 align-top border-b border-r border-orbit-border/40">
                          {rests.length === 0 ? <span className="text-[var(--text-muted)] dark:text-[var(--text-primary)] font-bold">·</span> : (
                            <div className="space-y-0.5">
                              {rests.map((n, i) => (
                                <div key={i} className="text-[10px] text-status-warning dark:text-status-warning font-medium truncate" title={n}>{n}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="px-3 py-2 text-[10px] text-[var(--text-muted)] border-t border-orbit-border">
              左右滚动查看整月；每个岗位一行，格内为该日该岗位在岗人员。最后一行是当日排休/请假人员。
            </p>
          </CardBody>
        </Card>
      ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-7 border-b border-orbit-border">
              {WEEKDAYS.map((w, idx) => (
                <div
                  key={w}
                  className={`px-2 py-2 text-center text-[11px] font-semibold ${
                    idx >= 5
                      ? 'text-status-warning dark:text-amber-400 bg-orbit-warning/5'
                      : 'text-[var(--text-primary)] dark:text-[var(--text-muted)]'
                  }`}
                >
                  周{w} {idx >= 5 ? '(周末)' : ''}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map(cell => {
                const list = data?.byDate?.[cell.date] || []
                const rests = (dayStatus?.byDate?.[cell.date] || []).filter(r => r.status !== 'work')
                const isToday = cell.date === todayStr
                const isSelected = cell.date === selectedDate
                const dateTag = getDateTag(cell.date)
                const [cy, cm, cd] = cell.date.split('-').map(Number)
                const isWeekend = new Date(cy, cm - 1, cd).getDay() === 0 || new Date(cy, cm - 1, cd).getDay() === 6
                return (
                  <button
                    key={cell.date}
                    onClick={() => setSelectedDate(cell.date)}
                    className={`min-h-[118px] border-b border-r border-orbit-border/50 p-1.5 text-left align-top transition ${
                      isSelected ? 'bg-orbit-primary/10 ring-1 ring-inset ring-orbit-primary/40' :
                      isWeekend ? 'bg-orbit-surface2/30 hover:bg-orbit-surface2/60' : 'hover:bg-orbit-surface2/60'
                    } ${cell.inMonth ? '' : 'opacity-40'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-[11px] tabular-nums ${
                          isToday ? 'text-orbit-primary font-bold' :
                          isWeekend ? 'text-status-warning font-semibold' :
                          'text-[var(--text-primary)] font-medium'
                        }`}>
                          {Number(cell.date.slice(8, 10))}
                        </span>
                        {dateTag && dateTag.type === 'promo' && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold tracking-tight shadow-sm">
                            {dateTag.text}
                          </span>
                        )}
                        {dateTag && dateTag.type === 'holiday' && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-red-500/20 text-red-500 border border-red-500/30 font-semibold">
                            {dateTag.text}
                          </span>
                        )}
                        {dateTag && dateTag.type === 'weekend' && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/15 text-status-warning border border-amber-500/20 font-medium">
                            {dateTag.text}
                          </span>
                        )}
                      </div>
                      {list.length > 0 && <span className="text-[10px] text-[var(--text-muted)] font-medium">{list.length} 场</span>}
                    </div>
                    <div className="space-y-1">
                      {list.slice(0, 2).map((s: CalendarSession) => (
                        <div key={s.id} className="rounded px-1 py-0.5 bg-orbit-surface2 border border-orbit-border">
                          <div className="text-[10px] text-[var(--text-primary)] font-medium truncate">
                            {s.startTime ? String(s.startTime).slice(0, 5) : '—'} {s.roomName || s.title}
                          </div>
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {s.staff.slice(0, 3).map((st, i) => (
                              <span key={`${st.roleCode}-${st.name}-${i}`}
                                className={`text-[9px] px-1 rounded border font-medium ${ROLE_COLOR[st.roleCode] || 'bg-orbit-surface3 text-[var(--text-primary)] border-orbit-border'}`}
                                title={`${st.roleName}：${st.name}`}>
                                {st.roleName}
                              </span>
                            ))}
                            {s.staff.length > 3 && <span className="text-[9px] text-[var(--text-muted)]">+{s.staff.length - 3}</span>}
                          </div>
                        </div>
                      ))}
                      {list.length > 2 && <div className="text-[10px] text-[var(--text-muted)] pl-1">还有 {list.length - 2} 场…</div>}
                      {rests.length > 0 && (
                        <div className="text-[9px] text-status-warning dark:text-status-warning pl-0.5 font-medium truncate" title={rests.map(r => `${r.staffName}(${DAY_STATUS_LABEL[r.status]})`).join('、')}>
                          休 {rests.length} 人
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Users className="w-4 h-4" /> {selectedDate || '选择日期'}
            </span>
            {selectedSessions.length > 0 && <Badge variant="neutral">{selectedSessions.length} 场</Badge>}
          </CardHeader>
          <CardBody className="max-h-[72vh] overflow-y-auto space-y-2">
            {!selectedDate && <p className="text-xs text-[var(--text-muted)] py-8 text-center">点击日历中的某一天查看岗位编排</p>}
            {selectedDate && selectedSessions.length === 0 && selectedRests.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] py-8 text-center">当天没有排班</p>
            )}

            {selectedRests.length > 0 && (
              <div className="rounded-lg border border-orbit-warning/30 bg-orbit-warning/5 p-2.5">
                <div className="text-[11px] text-status-warning dark:text-status-warning font-medium mb-1 flex items-center gap-1"><Coffee className="w-3 h-3" /> 当日休息</div>
                <div className="flex flex-wrap gap-1">
                  {selectedRests.map((r, i) => (
                    <span key={`${r.staffName}-${i}`} className="text-[10px] px-1.5 py-0.5 rounded border border-orbit-warning/30 text-status-warning dark:text-status-warning font-medium">
                      {r.staffName}：{DAY_STATUS_LABEL[r.status] || r.status}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedSessions.map(s => (
              <div key={s.id} className="rounded-lg border border-orbit-border/60 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">{s.roomName || s.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      s.status === 'completed' ? 'border-orbit-success/30 text-status-success dark:text-status-success'
                      : s.status === 'live' ? 'border-orbit-danger/30 text-status-danger dark:text-status-danger'
                      : 'border-orbit-border text-[var(--text-primary)] dark:text-[var(--text-muted)]'}`}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                    <button onClick={() => openEdit(s)} className="p-1 rounded text-[var(--text-muted)] hover:text-orbit-primary hover:bg-[var(--hover-bg)]" title="编辑岗位">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {s.startTime ? String(s.startTime).slice(0, 5) : '—'} – {s.endTime ? String(s.endTime).slice(0, 5) : '—'}
                  {s.durationMin ? ` · ${s.durationMin} 分钟` : ''}
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {s.staff.length === 0 && <span className="text-[11px] text-status-warning">未编排岗位</span>}
                  {s.staff.map((st, i) => (
                    <span key={`${st.roleCode}-${st.name}-${i}`}
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${ROLE_COLOR[st.roleCode] || 'bg-[var(--hover-bg3)] text-[var(--text-secondary)] border-orbit-border/60'}`}>
                      {st.roleName}：{st.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      )}

      {/* 岗位编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-orbit-border">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">编辑岗位编排</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {editing.date} · {editing.roomName || editing.title}
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--text-muted)]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              {roles.map(r => (
                <div key={r.code} className="rounded-lg border border-orbit-border/60 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${ROLE_COLOR[r.code] || 'bg-[var(--hover-bg3)] text-[var(--text-secondary)] border-orbit-border/60'}`}>
                      {r.name}
                    </span>
                    <button onClick={() => addStaff(r.code)} className="text-[11px] text-orbit-primary hover:underline flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> 添加
                    </button>
                  </div>
                  <div className="space-y-1">
                    {(draft[r.code] || []).length === 0 && (
                      <span className="text-[11px] text-[var(--text-primary)]">未指定</span>
                    )}
                    {(draft[r.code] || []).map((name, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <input
                          value={name}
                          onChange={e => setStaffAt(r.code, idx, e.target.value)}
                          placeholder={`${r.name}姓名`}
                          className="flex-1 text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1 text-[var(--text-secondary)]"
                        />
                        <button onClick={() => removeStaff(r.code, idx)} className="p-1 rounded text-status-danger hover:bg-orbit-danger/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-orbit-border">
              <Button variant="secondary" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={handleSaveStaff} disabled={saving}>
                <Save className="w-4 h-4" /> {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 排休弹窗 */}
      {restOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setRestOpen(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-orbit-border">
              <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5"><Coffee className="w-4 h-4" /> 标记排休 / 请假</div>
              <button onClick={() => setRestOpen(false)} className="p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--text-muted)]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1">人员姓名</label>
                <input value={restStaff} onChange={e => setRestStaff(e.target.value)}
                  placeholder="如：沈知微"
                  className="w-full text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-[var(--text-secondary)]" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1">日期</label>
                <input type="date" value={restDate} onChange={e => setRestDate(e.target.value)}
                  className="w-full text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-[var(--text-secondary)]" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1">状态</label>
                <select value={restStatus} onChange={e => setRestStatus(e.target.value)}
                  className="w-full text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-[var(--text-secondary)]">
                  <option value="rest">排休</option>
                  <option value="leave">请假</option>
                  <option value="sick">病假</option>
                </select>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                休息不关联场次；标记后该人在此日不计入缺勤统计。
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-orbit-border">
              <Button variant="secondary" onClick={() => setRestOpen(false)}>取消</Button>
              <Button onClick={handleSaveRest} disabled={saving}>
                <Save className="w-4 h-4" /> {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveScheduleCalendarPage
