import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, User, Moon, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import type { AttendanceResponse, DateInfo } from './types'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function createEmptyAttendance(year: number, month: number): AttendanceResponse {
  return {
    year,
    month,
    daysInMonth: new Date(year, month, 0).getDate(),
    dates: [],
    anchors: [],
    operators: [],
    attendanceData: {},
    anchorStats: [],
    operatorStats: [],
  }
}

export function AttendancePage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<AttendanceResponse>(() => createEmptyAttendance(now.getFullYear(), now.getMonth() + 1))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAttendance = useCallback(() => {
    setLoading(true)
    setError(null)
    api.get<AttendanceResponse>('/attendance', { year, month })
      .then((res) => {
        if (res && res.anchors) {
          setData(res)
        } else {
          setData(createEmptyAttendance(year, month))
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '考勤数据加载失败，请检查后端服务状态或权限')
        setData(createEmptyAttendance(year, month))
      })
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  const daysInMonth = new Date(year, month, 0).getDate()
  const dates: DateInfo[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const weekdayIdx = new Date(year, month - 1, day).getDay()
    return {
      date: dateStr,
      day,
      weekday: WEEKDAYS[weekdayIdx],
      isWeekend: weekdayIdx === 0 || weekdayIdx === 6,
    }
  })

  const prevMonth = () => {
    if (month === 1) {
      setYear(y => y - 1)
      setMonth(12)
    } else {
      setMonth(m => m - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setYear(y => y + 1)
      setMonth(1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const getAttendance = (role: string, id: number, date: string) => {
    const key = `${role}_${id}`
    return data.attendanceData[key]?.[date]
  }

  // 仅显示当月有出勤数据的人员
  const anchorsWithData = data.anchors.filter(a => {
    const key = `anchor_${a.id}`
    return data.attendanceData[key] && Object.keys(data.attendanceData[key]).length > 0
  })
  const operatorsWithData = data.operators.filter(o => {
    const key = `operator_${o.id}`
    return data.attendanceData[key] && Object.keys(data.attendanceData[key]).length > 0
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">个人达成</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">主播和中控人员月度出勤与数据统计</p>
          </div>
        </div>
      </motion.div>

      {/* Month selector */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {year}年{month}月
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上月
                </button>
                <button
                  onClick={nextMonth}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)] transition-colors"
                >
                  下月
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-orbit-danger/30 bg-orbit-danger/10 px-4 py-3 text-sm text-status-danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button
            onClick={loadAttendance}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-orbit-danger/30 bg-orbit-danger/15 px-3 py-1 text-xs font-medium text-status-danger hover:bg-orbit-danger/25 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            重试
          </button>
        </div>
      )}

      {/* Attendance table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader title="出勤状态表" subtitle={`${year}年${month}月主播与中控出勤明细`} />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: dates.length * 40 + 200 }}>
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-3 py-2 sticky left-0 bg-orbit-surface z-10" style={{ width: 80, minWidth: 80 }}>
                      姓名
                    </th>
                    <th className="text-center text-xs text-[var(--text-muted)] font-medium px-2 py-2 sticky left-[80px] bg-orbit-surface z-10" style={{ width: 50, minWidth: 50 }}>
                      角色
                    </th>
                    {dates.map((d) => (
                      <th
                        key={d.date}
                        className={`text-center text-[11px] px-1 py-2 font-medium ${
                          d.isWeekend ? 'text-status-warning bg-orbit-warning/5' : 'text-[var(--text-muted)]'
                        }`}
                        style={{ width: 40, minWidth: 40 }}
                      >
                        {d.day}
                        <br />
                        <span className="text-[10px]">{d.weekday}</span>
                      </th>
                    ))}
                    <th className="text-center text-xs text-[var(--text-muted)] font-medium px-2 py-2" style={{ width: 45, minWidth: 45 }}>
                      出勤
                    </th>
                    <th className="text-center text-xs text-[var(--text-muted)] font-medium px-2 py-2" style={{ width: 55, minWidth: 55 }}>
                      总时长
                    </th>
                    <th className="text-center text-xs text-[var(--text-muted)] font-medium px-2 py-2" style={{ width: 45, minWidth: 45 }}>
                      夜班
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* 主播区域标题 */}
                  <tr className="border-b border-orbit-border bg-orbit-primary/5">
                    <td colSpan={dates.length + 4} className="px-3 py-2 text-sm font-semibold text-orbit-primary-light">
                      👤 主播
                    </td>
                  </tr>
                  {anchorsWithData.length === 0 ? (
                    <tr>
                      <td colSpan={dates.length + 4} className="text-center py-8 text-[var(--text-muted)]">当月暂无主播出勤数据</td>
                    </tr>
                  ) : anchorsWithData.map((anchor) => {
                    let attendedDays = 0
                    let totalDuration = 0
                    let nightShifts = 0

                    return (
                      <tr key={`anchor_${anchor.id}`} className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-3 py-2 text-[var(--text-secondary)] font-medium sticky left-0 bg-orbit-surface">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                            {anchor.name}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Badge variant="success">主播</Badge>
                        </td>
                        {dates.map((d) => {
                          const att = getAttendance('anchor', anchor.id, d.date)
                          if (att) {
                            attendedDays++
                            totalDuration += att.duration
                            if (att.nightShift) nightShifts++
                            return (
                              <td
                                key={d.date}
                                className={`text-center px-1 py-2 ${
                                  d.isWeekend ? 'bg-orbit-warning/5' : 'bg-orbit-success/5'
                                }`}
                              >
                                <div className="text-xs">✅</div>
                                <div className="text-[10px] text-[var(--text-muted)]">
                                  {att.nightShift && <Moon className="w-3 h-3 inline text-orbit-primary" />}
                                  {(att.duration / 60).toFixed(1)}h
                                </div>
                              </td>
                            )
                          }
                          return (
                            <td
                              key={d.date}
                              className={`text-center px-1 py-2 ${
                                d.isWeekend ? 'bg-orbit-warning/5' : 'bg-orbit-danger/5'
                              }`}
                            >
                              <div className="text-xs">❌</div>
                              <div className="text-[10px] text-[var(--text-muted)]">-</div>
                            </td>
                          )
                        })}
                        <td className="text-center px-2 py-2 text-[var(--text-secondary)] font-medium">{attendedDays}</td>
                        <td className="text-center px-2 py-2 text-[var(--text-secondary)]">{(totalDuration / 60).toFixed(1)}</td>
                        <td className="text-center px-2 py-2 text-[var(--text-secondary)]">{nightShifts}</td>
                      </tr>
                    )
                  })}

                  {/* 中控区域标题 */}
                  <tr className="border-b border-orbit-border bg-orbit-accent/5">
                    <td colSpan={dates.length + 4} className="px-3 py-2 text-sm font-semibold text-orbit-accent-light">
                      👥 中控
                    </td>
                  </tr>
                  {operatorsWithData.length === 0 ? (
                    <tr>
                      <td colSpan={dates.length + 4} className="text-center py-8 text-[var(--text-muted)]">当月暂无中控出勤数据</td>
                    </tr>
                  ) : operatorsWithData.map((op) => {
                    let attendedDays = 0
                    let nightShifts = 0

                    return (
                      <tr key={`operator_${op.id}`} className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-3 py-2 text-[var(--text-secondary)] font-medium sticky left-0 bg-orbit-surface">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                            {op.name}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Badge variant="info">中控</Badge>
                        </td>
                        {dates.map((d) => {
                          const att = getAttendance('operator', op.id, d.date)
                          if (att) {
                            attendedDays++
                            if (att.nightShift) nightShifts++
                            return (
                              <td
                                key={d.date}
                                className={`text-center px-1 py-2 ${
                                  d.isWeekend ? 'bg-orbit-warning/5' : 'bg-orbit-success/5'
                                }`}
                              >
                                <div className="text-xs">✅</div>
                                <div className="text-[10px] text-[var(--text-muted)]">
                                  {att.nightShift && <Moon className="w-3 h-3 inline text-orbit-primary" />}
                                </div>
                              </td>
                            )
                          }
                          return (
                            <td
                              key={d.date}
                              className={`text-center px-1 py-2 ${
                                d.isWeekend ? 'bg-orbit-warning/5' : 'bg-orbit-danger/5'
                              }`}
                            >
                              <div className="text-xs">❌</div>
                            </td>
                          )
                        })}
                        <td className="text-center px-2 py-2 text-[var(--text-secondary)] font-medium">{attendedDays}</td>
                        <td className="text-center px-2 py-2 text-[var(--text-secondary)]">-</td>
                        <td className="text-center px-2 py-2 text-[var(--text-secondary)]">{nightShifts}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Statistics tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Anchor stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader title="主播数据统计" subtitle={`${year}年${month}月`} />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orbit-border">
                      <th className="text-left text-xs text-[var(--text-muted)] font-medium px-4 py-2">主播</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">总时长(h)</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">总GMV</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">总GSV</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">单场GSV</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">总退货</th>
                      <th className="text-center text-xs text-[var(--text-muted)] font-medium px-4 py-2">夜班</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.anchorStats.map((stat) => (
                      <tr key={stat.id} className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{stat.name}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">{(stat.totalDuration / 60).toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-right text-status-success">{stat.totalGmv.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-status-success">{stat.totalGsv.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">{stat.avgGsv.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-status-danger">{stat.totalReturn.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{stat.nightShiftCount}</td>
                      </tr>
                    ))}
                    {data.anchorStats.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-[var(--text-muted)]">暂无数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Operator stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card>
            <CardHeader title="中控数据统计" subtitle={`${year}年${month}月`} />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orbit-border">
                      <th className="text-left text-xs text-[var(--text-muted)] font-medium px-4 py-2">中控</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">直播场次</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">总GMV</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">总GSV</th>
                      <th className="text-right text-xs text-[var(--text-muted)] font-medium px-4 py-2">平均GSV</th>
                      <th className="text-center text-xs text-[var(--text-muted)] font-medium px-4 py-2">夜班</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.operatorStats.map((stat) => (
                      <tr key={stat.id} className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors">
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{stat.name}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">{stat.streamCount}</td>
                        <td className="px-4 py-2.5 text-right text-status-success">{stat.totalGmv.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-status-success">{stat.totalGsv.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">{stat.avgGsv.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{stat.nightShiftCount}</td>
                      </tr>
                    ))}
                    {data.operatorStats.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-[var(--text-muted)]">暂无数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}