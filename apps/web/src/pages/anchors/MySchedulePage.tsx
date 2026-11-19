import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  Clock,
  Video,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { useNavigate } from 'react-router-dom'

interface MySession {
  id: number
  title: string
  date: string
  startTime: string
  endTime: string
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  roomId: number
  roomName: string
  projectId?: number
  projectName?: string
  brandName?: string
  gmv?: number
  orders?: number
  durationMin?: number
  remark?: string
}

export const MySchedulePage: React.FC = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<MySession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<{ anchorId: number; sessions: MySession[] }>('/api/v1/schedule/my')
      .then((res) => {
        if (res?.sessions) {
          setSessions(res.sessions)
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  const scheduledSessions = sessions.filter((s) => s.status === 'scheduled')
  const completedSessions = sessions.filter((s) => s.status === 'completed')

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px] text-[var(--text-primary)]">
      {/* 顶部标题与快速概览 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-orbit-primary" />
            我的排班日程
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            主播个人专属排期行程，实时掌握近期开播时段、演播室安排与专属备播选品
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/ops/script-library')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-orbit-primary to-orbit-primary-dark hover:from-orbit-primary hover:to-orbit-primary-dark text-white shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            查看今日带货话术模板
          </Button>
        </div>
      </div>

      {/* KPI 概览指标卡 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-orbit-surface border border-orbit-border rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-[var(--text-secondary)]">待开播排期场次</span>
            <div className="text-2xl font-bold text-orbit-primary mt-1 font-mono">
              {scheduledSessions.length}
            </div>
            <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">近期准备开播任务</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orbit-primary/10 border border-orbit-primary/20 flex items-center justify-center text-orbit-primary">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-orbit-surface border border-orbit-border rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-[var(--text-secondary)]">已完结直播场次</span>
            <div className="text-2xl font-bold text-status-success mt-1 font-mono">
              {completedSessions.length}
            </div>
            <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">本周期实播记录</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orbit-success/10 border border-orbit-success/20 flex items-center justify-center text-status-success">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-orbit-surface border border-orbit-border rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-[var(--text-secondary)]">个人业绩中心</span>
            <div className="text-sm font-semibold text-[var(--text-primary)] mt-2">
              查看带货 GMV 与五维雷达
            </div>
            <button
              onClick={() => navigate('/anchors/my-performance')}
              className="text-[11px] text-orbit-primary hover:text-orbit-primary mt-1 flex items-center gap-0.5"
            >
              前往我的业绩看板 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orbit-primary/10 border border-orbit-primary/20 flex items-center justify-center text-orbit-primary">
            <Video className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 排班行程卡片列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧两列：我的排班明细列表 */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-secondary)] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-orbit-primary" />
            排期行程表
          </h2>

          {loading ? (
            <div className="p-12 text-center text-xs text-[var(--text-secondary)] bg-orbit-surface rounded-2xl border border-orbit-border">
              加载排班行程中...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--text-secondary)] bg-orbit-surface rounded-2xl border border-orbit-border">
              暂无分配给您的排班记录
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const isUpcoming = s.status === 'scheduled'

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl border transition-all text-xs ${isUpcoming
                      ? 'bg-orbit-surface border-orbit-primary/40 shadow-sm'
                      : 'bg-orbit-surface2 border-orbit-border opacity-90'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-orbit-border">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{s.title}</span>
                        <Badge variant={isUpcoming ? 'info' : 'neutral'}>
                          {isUpcoming ? '待开播' : s.status === 'live' ? '直播中' : '已完结'}
                        </Badge>
                      </div>
                      <div className="text-[var(--text-secondary)] font-mono text-[11px] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-orbit-primary" />
                        {s.date} {s.startTime?.slice(0, 5)} ~ {s.endTime?.slice(0, 5)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 text-[var(--text-primary)]">
                      <div>
                        <span className="text-[var(--text-secondary)] block text-[11px]">直播间演播室</span>
                        <span className="font-medium flex items-center gap-1 text-[var(--text-primary)] mt-0.5">
                          <MapPin className="w-3 h-3 text-status-danger" />
                          {s.roomName || '演播厅1号'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[var(--text-secondary)] block text-[11px]">项目归属</span>
                        <span className="font-medium text-[var(--text-primary)] mt-0.5 block">
                          {s.projectName || '自营自播'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[var(--text-secondary)] block text-[11px]">预计时长</span>
                        <span className="font-mono text-[var(--text-primary)] mt-0.5 block">
                          {s.durationMin ? `${(s.durationMin / 60).toFixed(1)} 小时` : '4.0 小时'}
                        </span>
                      </div>
                    </div>

                    {s.remark && (
                      <div className="mt-3 pt-2 border-t border-orbit-border text-[11px] text-[var(--text-secondary)] bg-orbit-surface2 p-2 rounded-lg">
                        <span className="text-orbit-primary font-medium">备播提示：</span>
                        {s.remark}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* 右侧一列：开播前准备指引与知识赋能 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-status-warning" />
                开播前 30 分钟检查清单
              </h3>
            </CardHeader>
            <CardBody className="text-xs space-y-3 text-[var(--text-secondary)]">
              <div className="flex items-start gap-2">
                <input type="checkbox" defaultChecked className="mt-0.5 rounded border-[var(--border)]" />
                <div>
                  <span className="font-medium text-[var(--text-secondary)]">声画设备测试</span>
                  <p className="text-[11px] text-[var(--text-muted)]">无线麦克风电量、补光灯色温及提词器脚本</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input type="checkbox" defaultChecked className="mt-0.5 rounded border-[var(--border)]" />
                <div>
                  <span className="font-medium text-[var(--text-secondary)]">主推样品陈列</span>
                  <p className="text-[11px] text-[var(--text-muted)]">前 3 款引流款与爆款实物熨烫平整，挂板就绪</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 rounded border-[var(--border)]" />
                <div>
                  <span className="font-medium text-[var(--text-secondary)]">气象选品话术核对</span>
                  <p className="text-[11px] text-[var(--text-muted)]">掌握今日目标城市降温情况与开场三段式话术</p>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border)]">
                <button
                  onClick={() => navigate('/ai/weather')}
                  className="w-full py-2 bg-orbit-primary/10 hover:bg-orbit-primary/20 text-orbit-primary dark:text-orbit-primary-light border border-orbit-primary/30 rounded-lg text-center font-medium flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  提取今日主推款话术
                </button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">主播常用工具</h3>
            </CardHeader>
            <CardBody className="p-2 space-y-1 text-xs">
              <button
                onClick={() => navigate('/ops/script-library')}
                className="w-full p-2.5 rounded-lg hover:bg-orbit-ink/60 text-left flex items-center justify-between text-[var(--text-secondary)] hover:text-white"
              >
                <span>话术模板库</span>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
              <button
                onClick={() => navigate('/anchors/training')}
                className="w-full p-2.5 rounded-lg hover:bg-orbit-ink/60 text-left flex items-center justify-between text-[var(--text-secondary)] hover:text-white"
              >
                <span>培训与话术通关</span>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
              <button
                onClick={() => navigate('/anchors/my-performance')}
                className="w-full p-2.5 rounded-lg hover:bg-orbit-ink/60 text-left flex items-center justify-between text-[var(--text-secondary)] hover:text-white"
              >
                <span>我的带货绩效与排名</span>
                <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
export default MySchedulePage
