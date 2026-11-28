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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-orbit-border dark:border-[var(--border)] pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ai/selection')}
            className="p-2 border border-orbit-border dark:border-[var(--border)] rounded-lg hover:bg-[var(--surface2)] dark:hover:bg-orbit-ink text-[var(--text-muted)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2.5 bg-gradient-to-tr from-orbit-primary to-orbit-primary-dark rounded-xl text-white shadow-md">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] dark:text-white flex items-center gap-2">
              AI 选品推荐历史复盘看板
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-orbit-primary text-orbit-primary dark:bg-orbit-primary dark:text-orbit-primary">
                共 {total} 次推演
              </span>
            </h1>
            <p className="text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)] mt-0.5">
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
                  ? 'bg-orbit-primary text-white shadow-sm'
                  : 'border border-orbit-border dark:border-[var(--border)] text-[var(--text-primary)] dark:text-[var(--text-muted)] hover:bg-[var(--surface2)] dark:hover:bg-orbit-ink'
              }`}
            >
              {st === '' ? '全部状态' : st === 'adopted' ? '已采纳' : '草稿建议'}
            </button>
          ))}
        </div>
      </div>

      {/* 历史记录表格 */}
      <div className="bg-orbit-surface rounded-xl border border-orbit-border dark:border-[var(--border)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">正在加载选品历史记录...</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)]">暂无选品推荐记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-orbit-border dark:border-[var(--border)] bg-[var(--surface2)]/75 dark:bg-orbit-ink/40 text-[var(--text-muted)]">
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
              <tbody className="divide-y divide-orbit-border dark:divide-[var(--border)] text-[var(--text-primary)]">
                {list.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--surface2)] dark:hover:bg-orbit-ink/50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-[var(--text-primary)] dark:text-white">
                      {row.recommendation_no}
                    </td>
                    <td className="py-3 px-4 font-medium">{row.category_name}</td>
                    <td className="py-3 px-4">{row.city}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          row.strategy === 'weather_led'
                            ? 'bg-orbit-danger/10 text-status-danger dark:bg-orbit-danger/15 dark:text-status-danger'
                            : 'bg-orbit-info text-orbit-info dark:bg-orbit-info/60 dark:text-orbit-info'
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
                            ? 'bg-orbit-success/10 text-status-success dark:bg-orbit-success/15 dark:text-status-success'
                            : 'bg-[var(--surface2)] text-[var(--text-primary)] dark:bg-orbit-ink dark:text-[var(--text-muted)]'
                        }`}
                      >
                        {row.status === 'adopted' ? '已采纳' : '草稿'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)]">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => viewDetail(row.id)}
                        className="px-2.5 py-1 text-xs border border-orbit-border dark:border-[var(--border)] rounded hover:bg-[var(--surface2)] dark:hover:bg-orbit-ink text-[var(--text-primary)]"
                      >
                        明细与证据
                      </button>
                      <button
                        onClick={() => navigate('/ops/session-products')}
                        className="px-2.5 py-1 text-xs bg-orbit-primary hover:bg-orbit-primary text-orbit-primary dark:bg-orbit-primary dark:hover:bg-orbit-primary dark:text-orbit-primary rounded font-medium"
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
          <div className="bg-orbit-surface rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-orbit-border dark:border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between border-b border-orbit-border dark:border-[var(--border)] pb-3">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] dark:text-white flex items-center gap-2">
                  选品建议详情 · {activeDetail.recommendation_no}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  类目: {activeDetail.category_name} · 城市: {activeDetail.city} · 策略: {activeDetail.strategy}
                </p>
              </div>
              <button
                onClick={() => setActiveDetail(null)}
                className="p-1 rounded-lg hover:bg-[var(--surface2)] dark:hover:bg-orbit-ink text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 推荐 SKU 明细 */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase">推荐货盘列表</h4>
              <div className="space-y-2">
                {activeDetail.items?.map((it: any) => (
                  <div
                    key={it.id}
                    className="p-3 bg-[var(--surface2)] dark:bg-orbit-ink/60 rounded-lg border border-orbit-border dark:border-[var(--border)] flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-orbit-primary dark:bg-orbit-primary text-orbit-primary dark:text-orbit-primary text-[10px] font-bold flex items-center justify-center">
                          {it.rank_no}
                        </span>
                        <span className="font-semibold text-[var(--text-primary)] dark:text-white">
                          {it.suggested_name}
                        </span>
                      </div>
                      <p className="text-[var(--text-muted)] mt-1 pl-7">{it.reason}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-status-danger dark:text-status-danger">
                        ¥{parseFloat(it.suggested_price).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-status-success font-semibold">
                        评分: {it.match_score}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-orbit-border dark:border-[var(--border)]">
              <button
                onClick={() => setActiveDetail(null)}
                className="px-4 py-2 border border-orbit-border dark:border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-primary)]"
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
