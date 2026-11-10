import React, { useState, useEffect } from 'react'
import { Trophy, TrendingUp, Calendar, ShoppingBag, Clock, Star } from 'lucide-react'

interface AnchorData {
  id: number
  name: string
  level: string
  platform: string
  platformCode: string
  radar: {
    expression: number
    interaction: number
    conversion: number
    professionalism: number
    overall: number
  }
}

interface PerformanceKpis {
  monthlyGmv: number
  monthlySessions: number
  monthlyOrders: number
  avgDurationMin: number
  teamRank: number
  targetGmv: number
  targetCompletionRate: number
}

interface SessionItem {
  id: number
  date: string
  title: string
  durationMin: number
  gmv: number
  orders: number
  status: string
}

export const MyPerformancePage: React.FC = () => {
  const [anchor, setAnchor] = useState<AnchorData | null>(null)
  const [kpis, setKpis] = useState<PerformanceKpis | null>(null)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const res = await fetch('/api/v1/anchors/my/performance')
        if (res.ok) {
          const json = await res.json()
          setAnchor(json.data.anchor)
          setKpis(json.data.kpis)
          setSessions(json.data.recentSessions || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 顶部个人身份与勋章 Header */}
      {anchor && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-amber-500/20">
              {anchor.name.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{anchor.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {anchor.level} 主播
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {anchor.platform || '抖音电商'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                主播专属个人自驱看板 · 综合带货力评分：<strong className="text-gray-700 font-bold">{anchor.radar.overall} 分</strong>
              </p>
            </div>
          </div>

          {/* 团队排名荣誉勋章 */}
          {kpis && (
            <div className="flex items-center gap-4 bg-amber-50/60 border border-amber-200/80 px-5 py-3.5 rounded-xl">
              <div className="p-2 rounded-lg bg-amber-500 text-white">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-amber-700 font-medium">全团队主播业绩排行榜</div>
                <div className="text-lg font-black text-amber-900 mt-0.5">
                  第 {kpis.teamRank} 名 <span className="text-xs font-normal text-amber-600">/ 保持领先</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4 大核心 KPI 指标卡 */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>本月个人累计成交 (GMV)</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">
              ¥{kpis.monthlyGmv.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              月度目标 ¥{kpis.targetGmv.toLocaleString('zh-CN')}
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, kpis.targetCompletionRate)}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>开播总场次</span>
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">
              {kpis.monthlySessions} <span className="text-xs font-normal text-gray-400">场</span>
            </div>
            <div className="text-[11px] text-emerald-600 mt-1">出勤履约率 100%</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>支付订单数</span>
              <ShoppingBag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">
              {kpis.monthlyOrders.toLocaleString('zh-CN')} <span className="text-xs font-normal text-gray-400">单</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">有效买家支付成交</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>平均单场直播时长</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-700 mt-2 tabular-nums">
              {kpis.avgDurationMin} <span className="text-xs font-normal text-gray-400">分钟</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">约 {(kpis.avgDurationMin / 60).toFixed(1)} 小时/场</div>
          </div>
        </div>
      )}

      {/* 两栏：左侧主播雷达五维评分，右侧近期场次明细 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：主播能力五维评分 */}
        {anchor && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
              <Star className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900">主播五维能力量化</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>镜头表达与语言感染力</span>
                  <span className="font-bold text-blue-600 tabular-nums">{anchor.radar.expression} 分</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${anchor.radar.expression}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>公屏互动与停留拉长</span>
                  <span className="font-bold text-emerald-600 tabular-nums">{anchor.radar.interaction} 分</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${anchor.radar.interaction}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>高潮逼单与转化爆发力</span>
                  <span className="font-bold text-amber-600 tabular-nums">{anchor.radar.conversion} 分</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: `${anchor.radar.conversion}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>产品知识与面料专业度</span>
                  <span className="font-bold text-purple-600 tabular-nums">{anchor.radar.professionalism} 分</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${anchor.radar.professionalism}%` }} />
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl text-[11px] text-gray-500 leading-relaxed border border-gray-100">
              💡 <strong>运营建议：</strong>转化爆发力与专业度处于第一梯队，适合担当黄金晚场（19:00 - 23:30）爆款主讲位，持续拉大 GMV 领先优势。
            </div>
          </div>
        )}

        {/* 右侧：个人近期待播/已播场次列表 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-900">个人近期场次战报</h3>
            <span className="text-xs text-gray-400">已播出 {sessions.length} 场</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/60 text-gray-400 font-medium border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">开播日期</th>
                  <th className="py-2.5 px-3">场次标题</th>
                  <th className="py-2.5 px-3 text-right">时长</th>
                  <th className="py-2.5 px-3 text-right">本场 GMV</th>
                  <th className="py-2.5 px-3 text-right">订单量</th>
                  <th className="py-2.5 px-3 text-center">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      近期无开播场次记录
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{s.date}</td>
                      <td className="py-2.5 px-3 text-gray-800">{s.title}</td>
                      <td className="py-2.5 px-3 text-right text-gray-500">{s.durationMin} 分钟</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-gray-900 tabular-nums">
                        ¥{s.gmv?.toLocaleString('zh-CN')}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{s.orders}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          已完成
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
