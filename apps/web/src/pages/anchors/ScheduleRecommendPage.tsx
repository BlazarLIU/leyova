import React, { useState, useEffect } from 'react'
import { Calendar, Sparkles, Clock, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface ScheduleItem {
  slotKey: string
  slotName: string
  trait: string
  leadAnchor: {
    id: number
    name: string
    score: number
    historicalGmv: number
  }
  supportAnchor: {
    id: number
    name: string
    score: number
  }
  expectedGmv: number
  aiReason: string
}

interface ScheduleResponse {
  platform: string
  strategy: string
  generatedAt: string
  schedule: ScheduleItem[]
}

export const ScheduleRecommendPage: React.FC = () => {
  const [data, setData] = useState<ScheduleResponse | null>(null)
  const [, setLoading] = useState(true)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    async function loadSchedule() {
      setLoading(true)
      try {
        const res = await fetch('/api/v1/schedule/recommendations')
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadSchedule()
  }, [])

  const handleApply = () => {
    setApplied(true)
    setTimeout(() => setApplied(false), 3000)
  }

  const totalExpectedGmv = data?.schedule?.reduce((sum, item) => sum + item.expectedGmv, 0) || 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 头部标题与应用按钮 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orbit-primary/[0.08] text-orbit-primary rounded-xl border border-orbit-primary/25 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">AI 智能排班建议与效能矩阵</h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                基于历史场次 GMV 产出、停留时长曲线与主播带货类目匹配度，推导全天峰值时段最优主播排班
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleApply}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-orbit-primary hover:bg-orbit-primary-dark text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
        >
          {applied ? <Check className="w-4 h-4 text-status-success" /> : <Sparkles className="w-4 h-4" />}
          {applied ? '排班矩阵已应用至考勤中心' : '一键应用本周推荐排班'}
        </button>
      </div>

      {/* 顶部策略概览卡片 */}
      <div className="bg-orbit-surface rounded-2xl border border-orbit-border shadow-xs p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-orbit-border">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-orbit-primary bg-orbit-primary/[0.08] px-2.5 py-0.5 rounded-full border border-orbit-primary/25">
              AI 时段效能推导模型
            </span>
            <h3 className="text-base font-bold text-[var(--text-primary)] mt-1">{data?.strategy || '正在分析中...'}</h3>
          </div>
          <div className="flex items-center gap-6 bg-[var(--surface2)] px-5 py-3 rounded-xl border border-orbit-border">
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">今日全天预期成交</div>
              <div className="text-lg font-bold text-orbit-info tabular-nums">
                ¥{totalExpectedGmv.toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--surface2)]" />
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">规划时段场次</div>
              <div className="text-lg font-bold text-[var(--text-primary)]">4 场连播</div>
            </div>
          </div>
        </div>

        {/* 四大黄金时段排班卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {data?.schedule?.map((item) => (
            <Card
              key={item.slotKey}
              className="p-5 shadow-xs hover:border-orbit-info/40 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orbit-primary" />
                  <span className="text-sm font-bold text-[var(--text-primary)]">{item.slotName}</span>
                </div>
                <span className="text-xs font-semibold text-orbit-primary tabular-nums">
                  预估 ¥{item.expectedGmv.toLocaleString('zh-CN')}
                </span>
              </div>

              <div className="text-[11px] text-[var(--text-muted)] bg-[var(--surface2)]/70 px-3 py-1.5 rounded-lg border border-orbit-border">
                🎯 <strong>时段人群与类目特征：</strong>{item.trait}
              </div>

              {/* 主讲主播与中控配置 */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3 rounded-lg bg-orbit-info/40 border border-orbit-info/40 space-y-1">
                  <span className="text-[10px] font-bold text-orbit-info uppercase tracking-wider">主讲主播 (Lead)</span>
                  <div className="font-bold text-[var(--text-primary)] text-sm">{item.leadAnchor.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    能力评分 <strong className="text-orbit-info">{item.leadAnchor.score}</strong> 分
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--surface2)] border border-orbit-border space-y-1">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">副播/中控 (Support)</span>
                  <div className="font-bold text-[var(--text-primary)] text-sm">{item.supportAnchor.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    协同能力 <strong className="text-[var(--text-primary)]">{item.supportAnchor.score}</strong> 分
                  </div>
                </div>
              </div>

              {/* AI 推荐归因理由 */}
              <div className="text-[11px] text-[var(--text-primary)] leading-relaxed bg-orbit-warning/10 p-2.5 rounded-lg border border-orbit-warning/60">
                💡 <strong className="text-status-warning">推荐逻辑：</strong>{item.aiReason}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
