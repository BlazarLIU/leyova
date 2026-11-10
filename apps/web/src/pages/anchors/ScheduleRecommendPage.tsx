import React, { useState, useEffect } from 'react'
import { Calendar, Sparkles, Clock, Check } from 'lucide-react'

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
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200/60 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI 智能排班建议与效能矩阵</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                基于历史场次 GMV 产出、停留时长曲线与主播带货类目匹配度，推导全天峰值时段最优主播排班
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleApply}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
        >
          {applied ? <Check className="w-4 h-4 text-emerald-300" /> : <Sparkles className="w-4 h-4" />}
          {applied ? '排班矩阵已应用至考勤中心' : '一键应用本周推荐排班'}
        </button>
      </div>

      {/* 顶部策略概览卡片 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-50">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              AI 时段效能推导模型
            </span>
            <h3 className="text-base font-bold text-gray-900 mt-1">{data?.strategy || '正在分析中...'}</h3>
          </div>
          <div className="flex items-center gap-6 bg-gray-50 px-5 py-3 rounded-xl border border-gray-100">
            <div>
              <div className="text-[11px] text-gray-400">今日全天预期成交</div>
              <div className="text-lg font-bold text-blue-700 tabular-nums">
                ¥{totalExpectedGmv.toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <div className="text-[11px] text-gray-400">规划时段场次</div>
              <div className="text-lg font-bold text-gray-800">4 场连播</div>
            </div>
          </div>
        </div>

        {/* 四大黄金时段排班卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {data?.schedule?.map((item) => (
            <div
              key={item.slotKey}
              className="p-5 rounded-xl border border-gray-100 bg-white shadow-xs hover:border-blue-200 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-gray-900">{item.slotName}</span>
                </div>
                <span className="text-xs font-semibold text-blue-600 tabular-nums">
                  预估 ¥{item.expectedGmv.toLocaleString('zh-CN')}
                </span>
              </div>

              <div className="text-[11px] text-gray-500 bg-gray-50/70 px-3 py-1.5 rounded-lg border border-gray-100">
                🎯 <strong>时段人群与类目特征：</strong>{item.trait}
              </div>

              {/* 主讲主播与中控配置 */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3 rounded-lg bg-blue-50/40 border border-blue-100 space-y-1">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">主讲主播 (Lead)</span>
                  <div className="font-bold text-gray-900 text-sm">{item.leadAnchor.name}</div>
                  <div className="text-[11px] text-gray-500">
                    能力评分 <strong className="text-blue-700">{item.leadAnchor.score}</strong> 分
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">副播/中控 (Support)</span>
                  <div className="font-bold text-gray-900 text-sm">{item.supportAnchor.name}</div>
                  <div className="text-[11px] text-gray-500">
                    协同能力 <strong className="text-gray-700">{item.supportAnchor.score}</strong> 分
                  </div>
                </div>
              </div>

              {/* AI 推荐归因理由 */}
              <div className="text-[11px] text-gray-600 leading-relaxed bg-amber-50/40 p-2.5 rounded-lg border border-amber-100/60">
                💡 <strong className="text-amber-800">推荐逻辑：</strong>{item.aiReason}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
