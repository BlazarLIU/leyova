import { useState, useEffect } from 'react'
import { toast } from '@/utils/toast'
import { fetchAlertEventsList, acknowledgeAlert, type AlertItem } from '@/services/ai-ops-data'

export function AiOpsAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlertEventsList().then((res) => {
      setAlerts(res)
      setLoading(false)
    })
  }, [])

  const handleAcknowledge = async (alert: AlertItem) => {
    if (alert.alertId == null) {
      toast.error('该预警缺少 ID，无法确认')
      return
    }
    const ok = await acknowledgeAlert(alert.alertId, 'acknowledged')
    if (!ok) {
      toast.error('确认预警失败，请稍后重试')
      return
    }
    setAlerts(prev => prev.filter(a => a.id !== alert.id))
    toast.info(`已确认并标记处理预警：【${alert.title}】`)
  }

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 1 · 实时告警流
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">内核统一告警 · 10分钟去重静默</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            异常预警与风险熔断中心
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            预警负责“发现”，Agent 负责“解释与出方案”。同规则同主体 10 分钟内去重不轰炸。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12 text-status-ai">
          <div className="w-8 h-8 border-2 border-orbit-success border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((a) => (
            <div key={a.id} className="p-5 rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80">{a.id}</span>
                  <span className="text-xs font-bold text-status-danger bg-orbit-danger/10 px-2 py-0.5 rounded border border-orbit-danger/20">{a.level}</span>
                  <span className="text-sm font-bold text-white">{a.title}</span>
                  <span className="text-xs text-[var(--text-muted)]">{a.time}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{a.detail}</p>
              </div>

              <button
                onClick={() => handleAcknowledge(a)}
                className="px-4 py-1.5 rounded-lg bg-orbit-ink hover:bg-orbit-ink/85 text-xs font-semibold text-orbit-snow/80 border border-[var(--border)] flex-shrink-0 transition-colors"
              >
                知悉并标记处理
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
