import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History,
  ArrowLeft,
  X,
} from 'lucide-react'
import { api } from '../../services/api'

interface RecommendationRecord {
  id: number
  recommendation_no: string
  category_code: string
  category_name: string
  platform_code: string | null
  shop_name: string | null
  city: string
  strategy: string
  status: string
  created_at: string
  item_count: number
}

export const SelectionHistoryPage: React.FC = () => {
  const navigate = useNavigate()
  const [list, setList] = useState<RecommendationRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [activeDetail, setActiveDetail] = useState<any | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ items: RecommendationRecord[]; total: number }>(
        '/selection/recommendations',
        {
          status: selectedStatus || undefined,
          page: 1,
          pageSize: 20,
        },
      )
      if (res) {
        setList(res.items || [])
        setTotal(res.total || 0)
      }
    } catch (err) {
      console.error('Failed to load history', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedStatus])

  const viewDetail = async (id: number) => {
    try {
      const res = await api.get<any>(`/selection/recommendations/${id}`)
      if (res) {
        setActiveDetail(res)
      }
    } catch (err) {
      console.error('Failed to load detail', err)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 头部 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ai/selection')}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl text-white shadow-md">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              AI 选品推荐历史复盘看板
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                共 {total} 次推演
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              冻结每次选品当下的气温、趋势与因子权重，保障算法决策全链路可审计、可追溯
            </p>
          </div>
        </div>

        {/* 状态筛选 */}
        <div className="flex items-center gap-2">
          {['', 'draft', 'adopted'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedStatus === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {st === '' ? '全部状态' : st === 'adopted' ? '已采纳' : '草稿建议'}
            </button>
          ))}
        </div>
      </div>

      {/* 历史记录表格 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">正在加载选品历史记录...</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">暂无选品推荐记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-800/40 text-gray-500">
                  <th className="py-3 px-4 font-semibold">推演单号</th>
                  <th className="py-3 px-4 font-semibold">类目</th>
                  <th className="py-3 px-4 font-semibold">目标城市</th>
                  <th className="py-3 px-4 font-semibold">生成策略</th>
                  <th className="py-3 px-4 font-semibold">推荐商品数</th>
                  <th className="py-3 px-4 font-semibold">采纳状态</th>
                  <th className="py-3 px-4 font-semibold">运行时间</th>
                  <th className="py-3 px-4 font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                {list.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-gray-900 dark:text-white">
                      {row.recommendation_no}
                    </td>
                    <td className="py-3 px-4 font-medium">{row.category_name}</td>
                    <td className="py-3 px-4">{row.city}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          row.strategy === 'weather_led'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}
                      >
                        {row.strategy === 'weather_led' ? '气象主导' : '趋势主导'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{row.item_count} 款</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          row.status === 'adopted'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {row.status === 'adopted' ? '已采纳' : '草稿'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => viewDetail(row.id)}
                        className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        明细与证据
                      </button>
                      <button
                        onClick={() => navigate('/ops/session-products')}
                        className="px-2.5 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 rounded font-medium"
                      >
                        排品承接
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 明细弹窗 */}
      {activeDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  选品建议详情 · {activeDetail.recommendation_no}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  类目: {activeDetail.category_name} · 城市: {activeDetail.city} · 策略: {activeDetail.strategy}
                </p>
              </div>
              <button
                onClick={() => setActiveDetail(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 推荐 SKU 明细 */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase">推荐货盘列表</h4>
              <div className="space-y-2">
                {activeDetail.items?.map((it: any) => (
                  <div
                    key={it.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                          {it.rank_no}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {it.suggested_name}
                        </span>
                      </div>
                      <p className="text-gray-500 mt-1 pl-7">{it.reason}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-rose-600 dark:text-rose-400">
                        ¥{parseFloat(it.suggested_price).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-emerald-600 font-semibold">
                        评分: {it.match_score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setActiveDetail(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
