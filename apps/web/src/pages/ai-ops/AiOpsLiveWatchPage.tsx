import { useState, useEffect } from 'react'
import { Sparkles, CheckCircle2, Radio, Loader2 } from 'lucide-react'
import { useAiOpsSession } from '@/contexts/AiOpsSessionContext'
import { api } from '@/services/api'
import { toast } from '@/utils/toast'
import { EmbeddedCopilot } from '@/components/ai/EmbeddedCopilot'

interface LiveSuggestionItem {
  id: string
  toolLogId?: number
  time: string
  type: string
  content: string
  status: 'pending' | 'applied'
}

export function AiOpsLiveWatchPage() {
  const { selectedSessionId, currentSession } = useAiOpsSession()
  const [suggestions, setSuggestions] = useState<LiveSuggestionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.allSettled([api.get<any>('/alerts/events?status=pending'), api.get<any>('/ai/pending-approvals')]).then(
      ([alertsRes, appRes]) => {
        if (!mounted) return
        const alerts =
          alertsRes.status === 'fulfilled'
            ? alertsRes.value?.events || alertsRes.value?.data || (Array.isArray(alertsRes.value) ? alertsRes.value : [])
            : []
        const approvals =
          appRes.status === 'fulfilled'
            ? appRes.value?.data || (Array.isArray(appRes.value) ? appRes.value : [])
            : []

        const mappedAlerts: LiveSuggestionItem[] = alerts.slice(0, 5).map((a: any) => ({
          id: `ALT-${a.id}`,
          time: a.eventTime || a.event_time ? new Date(a.eventTime || a.event_time).toLocaleTimeString().slice(0, 5) : '刚刚',
          type: a.severity === 'critical' ? '紧急熔断' : '指标偏离',
          content: `${a.title}：${a.description || '指标出现异常波动，建议排查干预'}`,
          status: 'pending',
        }))

        const mappedApprovals: LiveSuggestionItem[] = approvals.slice(0, 5).map((app: any) => ({
          id: `APP-${app.tool_log_id || app.approval_id}`,
          toolLogId: app.tool_log_id,
          time: app.created_at ? new Date(app.created_at).toLocaleTimeString().slice(0, 5) : '刚刚',
          type: 'AI调优',
          content: app.result_summary || `建议执行 ${app.tool_name}，提升场中转化效率`,
          status: 'pending',
        }))

        setSuggestions([...mappedAlerts, ...mappedApprovals])
        setLoading(false)
      },
    )

    return () => {
      mounted = false
    }
  }, [selectedSessionId])

  const handleApplySuggestion = async (id: string, type: string, toolLogId?: number) => {
    if (!toolLogId) {
      toast.error(`【${type}】没有可执行的审批单，请前往预警中心处理`)
      return
    }
    try {
      await api.post(`/ai/approve/${toolLogId}`)
    } catch (err) {
      toast.error(`【${type}】执行失败：${(err as Error).message || '请稍后重试'}`)
      return
    }
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'applied' } : s)))
    toast.success(`【${type}】已批准执行。`)
  }

  const sessionGmv = currentSession ? Number(currentSession.gmv) || 0 : 0
  const roomName = currentSession?.roomName || '主号官方直播间'

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-danger/20 text-status-danger border border-orbit-danger/30 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orbit-danger animate-pulse" />
              <span>LIVE 实时盯盘</span>
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Session #{selectedSessionId || 102} · {roomName} · 实时数据巡检
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            场中盯盘驾驶舱
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            以近 7 场同时段中位数为基线，监控流量与转化偏离，异常直推，大额动作进人审。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-orbit-surface border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">实时在线观看</p>
          <p className="text-2xl font-extrabold font-mono text-orbit-info mt-1">
            {currentSession?.status === 'live' ? '2,840 人' : '0 人'}
          </p>
          <span className="text-[10px] text-orbit-success">
            {currentSession?.status === 'live' ? '高于基线 +28%' : '未开播'}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-orbit-surface border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">本场累计支付 GMV</p>
          <p className="text-2xl font-extrabold font-mono text-[var(--text-primary)] mt-1">¥{sessionGmv.toLocaleString()}</p>
          <span className="text-[10px] text-orbit-info">达成率 100%</span>
        </div>
        <div className="p-4 rounded-2xl bg-orbit-surface border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">实时千次转化 GPM</p>
          <p className="text-2xl font-extrabold font-mono text-orbit-success mt-1">
            ¥{currentSession?.status === 'live' ? '2,150' : '0'}
          </p>
          <span className="text-[10px] text-[var(--text-muted)]">基线: ¥1,820</span>
        </div>
        <div className="p-4 rounded-2xl bg-orbit-surface border border-[var(--border)] backdrop-blur-xl">
          <p className="text-xs text-[var(--text-muted)]">平均停留时长</p>
          <p className="text-2xl font-extrabold font-mono text-orbit-warning mt-1">
            {currentSession?.status === 'live' ? '74 秒' : '0 秒'}
          </p>
          <span className="text-[10px] text-orbit-success">
            {currentSession?.status === 'live' ? '平稳健康' : '待播'}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-orbit-surface backdrop-blur-xl p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orbit-info" />
          <span>实时 AI 盯盘建议流（人只处理大额与异常）</span>
        </h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-orbit-info">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-xs font-mono text-[var(--text-muted)]">正在聚合场中基线与异常预警流...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            <Radio className="w-10 h-10 text-[var(--text-primary)] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--text-secondary)]">当前场中指标平稳，暂无偏离告警与干预建议</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">系统以每 5 分钟频率对齐同时段中位数基线进行巡检</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl bg-orbit-surface2 border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orbit-info/10 text-orbit-info border border-orbit-info/25 mt-0.5">
                    {s.time}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-orbit-warning mr-2">[{s.type}]</span>
                    <span className="text-sm text-[var(--text-secondary)]">{s.content}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                  {s.status === 'applied' ? (
                    <span className="text-xs font-bold text-orbit-success flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>已采纳执行</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApplySuggestion(s.id, s.type, s.toolLogId)}
                      className="px-4 py-1.5 rounded-lg bg-orbit-primary hover:bg-orbit-primary-dark text-orbit-snow text-xs font-bold shadow-md shadow-orbit-primary/25 transition-all"
                    >
                      一键采纳执行
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EmbeddedCopilot
        page="live"
        sessionId={selectedSessionId}
        contextLabel={`${roomName}${currentSession?.title ? ` · ${currentSession.title}` : ''}`}
        date={currentSession?.date}
      />
    </div>
  )
}
