import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Sparkles,
  CloudSun,
  TrendingUp,
  ShieldCheck,
  Package,
  Search,
  CheckCircle2,
  ArrowRight,
  History,
  Layers,
  Thermometer,
  Percent,
} from 'lucide-react'
import { api } from '../../services/api'

interface Category {
  code: string
  parent_code: string | null
  level: number
  name: string
  weather_sensitivity: 'high' | 'medium' | 'low'
  lifecycle_days: number
}

interface SelectionItem {
  rankNo: number
  productId: number | null
  suggestedName: string
  suggestedSpecs: string
  matchScore: number
  reason: string
  suggestedPrice: number
  estimatedMarginRate: number
  riskFlags: string[]
}

interface RecommendationResult {
  id?: number
  recommendationNo: string
  categoryCode: string
  categoryName: string
  city: string
  weather: {
    city: string
    weather: string
    tempCurrent: number
    tempMin: number
    tempMax: number
    humidity: number
    wind: string
    source?: string
  }
  strategy: 'weather_led' | 'trend_led' | 'degraded'
  status: string
  insufficientReason?: string
  signalsSnapshot: {
    weights: Record<string, number>
  }
  items: SelectionItem[]
}

export const SelectionPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCategory = searchParams.get('category') || 'APPAREL'

  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [selectedCity, setSelectedCity] = useState<string>('杭州')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [adopted, setAdopted] = useState(false)

  const presetCities = ['杭州', '上海', '北京', '广州', '深圳', '成都', '武汉', '西安', '全国']
  const platforms = [
    { code: '', name: '全部全网平台' },
    { code: 'douyin', name: '抖音电商' },
    { code: 'tmall', name: '天猫旗舰' },
    { code: 'taobao', name: '淘宝企业' },
    { code: 'jd', name: '京东自营/POP' },
    { code: 'pdd', name: '拼多多' },
    { code: 'kuaishou', name: '快手小店' },
    { code: 'xiaohongshu', name: '小红书' },
  ]

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await api.get<{ data: Category[] }>('/selection/categories')
        if (res && res.data) {
          setCategories(res.data)
        }
      } catch (err) {
        console.error('Failed to load categories', err)
      }
    }
    fetchCategories()
  }, [])

  const handleRunRecommend = async () => {
    if (!selectedCategory) return
    setLoading(true)
    setAdopted(false)
    try {
      const res = await api.post<{ data: RecommendationResult }>('/selection/recommend', {
        categoryCode: selectedCategory,
        city: selectedCity,
        platformCode: selectedPlatform || undefined,
        persist: true,
      })
      if (res && res.data) {
        setResult(res.data)
      }
    } catch (err) {
      console.error('Recommendation failed', err)
    } finally {
      setLoading(false)
    }
  }

  // 初始加载一次推荐
  useEffect(() => {
    handleRunRecommend()
  }, [selectedCategory])

  const handleAdopt = async () => {
    if (!result?.id) return
    try {
      await api.post(`/selection/recommendations/${result.id}/adopt`, {})
      setAdopted(true)
    } catch (err) {
      console.error('Failed to adopt', err)
    }
  }

  const curCat = categories.find((c) => c.code === selectedCategory)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 顶部标题与操作 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl text-white shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                全品类 AI 智能选品
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  9信号多因子引擎
                </span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                接驳真实 Open-Meteo 实时气象与趋势数据，覆盖服饰、美妆、3C、食品等全品类，精准推演爆品组合
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ai/selection/history')}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <History className="w-4 h-4 text-gray-400" />
            选品历史复盘
          </button>
        </div>
      </div>

      {/* 选品条件筛选栏 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 类目选择 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">
              商品类目选择
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <optgroup label="一级主类目">
                {categories.filter((c) => c.level === 1).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.weather_sensitivity === 'high' ? '强气象' : c.weather_sensitivity === 'medium' ? '中气象' : '弱气象'})
                  </option>
                ))}
              </optgroup>
              <optgroup label="二级精细类目">
                {categories.filter((c) => c.level === 2).map((c) => (
                  <option key={c.code} value={c.code}>
                    └─ {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 城市选择 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">
              目标播报/受众城市 (真实天气)
            </label>
            <div className="flex gap-2">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                {presetCities.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 平台选择 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">
              销售平台偏好
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              {platforms.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>当前类目敏感度：</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded ${
                curCat?.weather_sensitivity === 'high'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : curCat?.weather_sensitivity === 'medium'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              }`}
            >
              {curCat?.weather_sensitivity === 'high'
                ? '强气象敏感 (天气主导)'
                : curCat?.weather_sensitivity === 'medium'
                ? '中度相关 (辅助信号)'
                : '弱/无相关 (趋势主导)'}
            </span>
          </div>

          <button
            onClick={handleRunRecommend}
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? '多因子计算中...' : '重新推演选品'}
          </button>
        </div>
      </div>

      {/* 选品结果看板 */}
      {result && (
        <div className="space-y-6">
          {/* 信号冻结卡片 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 真实天气看板 */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white shadow-md flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold tracking-wider text-blue-100 flex items-center gap-1.5">
                  <CloudSun className="w-4 h-4" /> 真实气象源 ({result.weather.source || 'Open-Meteo'})
                </span>
                <span className="text-xs px-2 py-0.5 bg-white/20 rounded-full">{result.city}</span>
              </div>
              <div className="my-4">
                <div className="text-4xl font-extrabold flex items-baseline gap-2">
                  {result.weather.tempCurrent}°C
                  <span className="text-base font-normal text-blue-100">{result.weather.weather}</span>
                </div>
                <div className="text-xs text-blue-100 mt-2 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5" /> 范围: {result.weather.tempMin} ~ {result.weather.tempMax}°C
                  </span>
                  <span>湿度: {result.weather.humidity}%</span>
                  <span>{result.weather.wind}</span>
                </div>
              </div>
              <div className="text-xs text-blue-100 border-t border-white/20 pt-2.5 flex items-center justify-between">
                <span>策略机制: {result.strategy === 'weather_led' ? '气温驱动换季' : '销售大盘趋势'}</span>
                <span>编号: {result.recommendationNo}</span>
              </div>
            </div>

            {/* 5 因子权重权重图谱 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  当前类目多因子打分权重构成 (总和 100%)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  类目权重规则由 `signal_source` 驱动，动态平衡外部气温、站内动销与货盘库存
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <CloudSun className="w-3.5 h-3.5 text-blue-500" /> 气象信号
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {Math.round((result.signalsSnapshot?.weights?.weather || 0.2) * 100)}%
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> 销售趋势
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {Math.round((result.signalsSnapshot?.weights?.sales_trend || 0.35) * 100)}%
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> 低退款率
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {Math.round((result.signalsSnapshot?.weights?.refund_rate_inverse || 0.15) * 100)}%
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Package className="w-3.5 h-3.5 text-purple-500" /> 库存深度
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {Math.round((result.signalsSnapshot?.weights?.inventory_health || 0.15) * 100)}%
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Search className="w-3.5 h-3.5 text-indigo-500" /> 搜索热词
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {Math.round((result.signalsSnapshot?.weights?.keyword_demand || 0.15) * 100)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2">
                <span>策略模式：{result.strategy}</span>
                <span>候选池已筛选 {result.items.length} 款核心优选品</span>
              </div>
            </div>
          </div>

          {/* 推荐商品明细卡片列表 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                优选推荐货盘清单 ({result.items.length})
              </h2>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAdopt}
                  disabled={adopted || !result.id}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                    adopted
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {adopted ? '已采纳此方案' : '采纳选品结果'}
                </button>

                <button
                  onClick={() => navigate('/ops/session-products')}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium text-sm rounded-lg shadow-sm flex items-center gap-2 transition"
                >
                  去场次排品承接
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.items.map((item) => (
                <div
                  key={item.rankNo}
                  className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                          {item.rankNo}
                        </span>
                        <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1">
                          {item.suggestedName}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold">
                        {item.matchScore}分
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2.5 line-clamp-2 leading-relaxed">
                      {item.reason}
                    </p>

                    {item.suggestedSpecs && (
                      <div className="text-[11px] text-gray-400 mt-2 bg-gray-50 dark:bg-gray-800/60 p-2 rounded line-clamp-1 font-mono">
                        {item.suggestedSpecs}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-400">建议售价: </span>
                      <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                        ¥{item.suggestedPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-gray-400" />
                      预估毛利: <span className="font-semibold">{Math.round(item.estimatedMarginRate * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
