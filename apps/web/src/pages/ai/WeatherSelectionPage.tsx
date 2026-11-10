import React, { useState, useEffect } from 'react'
import { CloudSun, Sparkles, MapPin, Thermometer, Wind, Droplets, ShoppingBag, MessageSquare, Copy, Check, Tag } from 'lucide-react'

interface WeatherData {
  city: string
  weather: string
  tempCurrent: number
  tempMin: number
  tempMax: number
  humidity: number
  wind: string
  season: string
  date: string
}

interface PrimarySku {
  name: string
  category: string
  reason: string
  suggestedPrice: number
  marginRate: number
}

interface OutfitRecommendation {
  weather: WeatherData
  headline: string
  recommendedCategories: string[]
  primarySkus: PrimarySku[]
  talkingPoints: {
    openingHook: string
    valuePitch: string
    urgencyClose: string
  }
}

export const WeatherSelectionPage: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState('杭州')
  const [data, setData] = useState<OutfitRecommendation | null>(null)
  const [, setLoading] = useState(true)
  const [copiedType, setCopiedType] = useState<string | null>(null)

  const cities = ['杭州', '广州', '上海', '北京', '成都']

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const res = await fetch(`/api/v1/weather/recommendation?city=${encodeURIComponent(selectedCity)}`)
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
    loadData()
  }, [selectedCity])

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 头部标题与城市切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200/60 shadow-2xs">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">天气 AI 穿搭与智能选品</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                实时抓取目标城市气象指标 × 季节温差 × 服饰类目矩阵，智能生成今日主推商品组合与开播话术
              </p>
            </div>
          </div>
        </div>

        {/* 城市切换 Tabs */}
        <div className="flex items-center gap-1.5 bg-gray-100/80 p-1 rounded-xl">
          {cities.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCity(c)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCity === c ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {c}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <>
          {/* 天气概况 Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 backdrop-blur-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                AI 气象感知驱动模式
              </div>
              <h2 className="text-xl font-bold leading-snug">{data.headline}</h2>
              <p className="text-xs text-white/80">
                数据更新于 {data.weather.date} · 针对服装、保暖内衣与深秋冬装品类自动编排
              </p>
            </div>

            <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-6 py-4 rounded-xl border border-white/15 shrink-0">
              <div className="text-center">
                <div className="text-3xl font-extrabold tabular-nums">{data.weather.tempCurrent}°</div>
                <div className="text-[11px] text-white/80 mt-1">{data.weather.weather}</div>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div className="space-y-1.5 text-xs text-white/90">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-amber-300" />
                  <span>{data.weather.tempMin}° ~ {data.weather.tempMax}°C</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-300" />
                  <span>湿度 {data.weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{data.weather.wind}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 推荐类目标签 */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-gray-400 font-medium">今日高转化类目：</span>
            {data.recommendedCategories.map((cat, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200"
              >
                <Tag className="w-3 h-3" />
                {cat}
              </span>
            ))}
          </div>

          {/* 核心内容区：主推穿搭 SKU + 主播精选话术 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 今日主推穿搭与选品商品池 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900">今日主推商品与搭配建议</h3>
                </div>
                <span className="text-xs text-gray-400">{data.primarySkus.length} 个核心推荐款</span>
              </div>

              <div className="space-y-3">
                {data.primarySkus.map((sku, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-gray-100 hover:border-blue-200 transition-colors bg-gray-50/30 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100/70 text-blue-700 mr-2">
                          {sku.category}
                        </span>
                        <span className="text-xs font-bold text-gray-900">{sku.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-blue-700 tabular-nums">
                          ¥{sku.suggestedPrice}
                        </div>
                        <div className="text-[10px] text-gray-400">毛利 ~{Math.round(sku.marginRate * 100)}%</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed bg-white p-2.5 rounded-lg border border-gray-100">
                      💡 <strong className="text-gray-700">选品理由：</strong>{sku.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI 匹配开播话术要点 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-900">主播天气实景带货话术模板</h3>
                </div>
                <span className="text-xs text-gray-400">一键复制至提词器</span>
              </div>

              <div className="space-y-4 text-xs">
                {/* 1. 开场钩子 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-gray-700 font-semibold">
                    <span>1. 天气开场留人钩子 (Opening Hook)</span>
                    <button
                      onClick={() => copyToClipboard(data.talkingPoints.openingHook, 'hook')}
                      className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 text-[11px]"
                    >
                      {copiedType === 'hook' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedType === 'hook' ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl text-gray-700 leading-relaxed border border-gray-100">
                    "{data.talkingPoints.openingHook}"
                  </div>
                </div>

                {/* 2. 痛点转化 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-gray-700 font-semibold">
                    <span>2. 保暖痛点与实景穿搭卖点 (Value Pitch)</span>
                    <button
                      onClick={() => copyToClipboard(data.talkingPoints.valuePitch, 'pitch')}
                      className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 text-[11px]"
                    >
                      {copiedType === 'pitch' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedType === 'pitch' ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl text-gray-700 leading-relaxed border border-gray-100">
                    "{data.talkingPoints.valuePitch}"
                  </div>
                </div>

                {/* 3. 促发逼单 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-gray-700 font-semibold">
                    <span>3. 降温顺丰抢发逼单话术 (Urgency Close)</span>
                    <button
                      onClick={() => copyToClipboard(data.talkingPoints.urgencyClose, 'close')}
                      className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 text-[11px]"
                    >
                      {copiedType === 'close' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedType === 'close' ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl text-gray-700 leading-relaxed border border-gray-100">
                    "{data.talkingPoints.urgencyClose}"
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

