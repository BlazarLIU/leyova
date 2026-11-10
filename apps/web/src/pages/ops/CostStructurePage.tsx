import React, { useState, useEffect } from 'react'
import { Plus, DollarSign, Users, Megaphone, Box, Receipt } from 'lucide-react'

interface CostItem {
  id: number
  shopId: number
  shopName: string
  platformCode: string
  platformName: string
  costDate: string
  costType: 'labor' | 'ad' | 'goods' | 'platform_fee' | 'other'
  costName: string
  amount: number
  remark: string
  createdByName: string
  createdAt: string
}

interface CostSummary {
  totalGmv: number
  totalRefund: number
  effectiveSales: number
  totalCost: number
  netProfit: number
  netProfitMargin: number
  costsByType: {
    labor: number
    ad: number
    goods: number
    platform_fee: number
    other: number
  }
}

const COST_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  labor: { label: '人力成本', icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ad: { label: '广告投流', icon: Megaphone, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  goods: { label: '货品成本', icon: Box, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  platform_fee: { label: '平台扣点', icon: Receipt, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  other: { label: '其他杂费', icon: DollarSign, color: 'text-gray-600 bg-gray-50 border-gray-200' },
}

export const CostStructurePage: React.FC = () => {
  const [costs, setCosts] = useState<CostItem[]>([])
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCostType, setSelectedCostType] = useState<string>('')

  // 新增表单
  const [formShopId] = useState('1')
  const [formPlatform, setFormPlatform] = useState('douyin')
  const [formCostDate, setFormCostDate] = useState(new Date().toISOString().slice(0, 10))
  const [formCostType, setFormCostType] = useState('labor')
  const [formCostName, setFormCostName] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formRemark, setFormRemark] = useState('')

  const fetchCostsAndSummary = async () => {
    setLoading(true)
    try {
      const queryParams = selectedCostType ? `?costType=${selectedCostType}` : ''
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/v1/costs${queryParams}`),
        fetch(`/api/v1/costs/summary`),
      ])

      if (listRes.ok) {
        const json = await listRes.json()
        setCosts(json.data?.items || [])
      }
      if (sumRes.ok) {
        const json = await sumRes.json()
        setSummary(json.data)
      }
    } catch (e) {
      console.error('Failed to load costs', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCostsAndSummary()
  }, [selectedCostType])

  const handleCreateCost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCostName || !formAmount) return

    try {
      const res = await fetch('/api/v1/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: Number(formShopId),
          platformCode: formPlatform,
          costDate: formCostDate,
          costType: formCostType,
          costName: formCostName,
          amount: parseFloat(formAmount),
          remark: formRemark,
        }),
      })

      if (res.ok) {
        setShowAddModal(false)
        setFormCostName('')
        setFormAmount('')
        setFormRemark('')
        fetchCostsAndSummary()
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 顶部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">成本结构与净利分析</h1>
          <p className="text-xs text-gray-500 mt-1">
            结构化录入人力、广告、货品与平台扣点，驱动运营驾驶舱真实净利润实时计算
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          录入经营成本
        </button>
      </div>

      {/* 净利润核心指标卡 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <span className="text-xs text-gray-400 font-medium">总成交额 (GMV)</span>
            <div className="text-xl font-bold text-gray-900 mt-2 tabular-nums">
              ¥{summary.totalGmv.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">退款 ¥{summary.totalRefund.toLocaleString('zh-CN')}</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <span className="text-xs text-gray-400 font-medium">全口径经营总成本</span>
            <div className="text-xl font-bold text-rose-600 mt-2 tabular-nums">
              ¥{summary.totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">含人力、广告、佣金分摊</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-xs bg-gradient-to-br from-blue-50/40 to-white">
            <span className="text-xs text-blue-700 font-medium">实际净利润 (Net Profit)</span>
            <div className="text-xl font-bold text-blue-700 mt-2 tabular-nums">
              ¥{summary.netProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-blue-600/80 mt-1">已扣除实际退款及全部成本</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <span className="text-xs text-gray-400 font-medium">净利润率</span>
            <div className="text-xl font-bold text-emerald-600 mt-2 tabular-nums">
              {summary.netProfitMargin}%
            </div>
            <div className="text-[11px] text-gray-400 mt-1">健康阈值 &gt; 15%</div>
          </div>
        </div>
      )}

      {/* 成本分类卡片 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(summary.costsByType).map(([type, amount]) => {
            const conf = COST_TYPE_MAP[type] || COST_TYPE_MAP.other
            const Icon = conf.icon
            return (
              <div
                key={type}
                onClick={() => setSelectedCostType(selectedCostType === type ? '' : type)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedCostType === type ? 'ring-2 ring-blue-500 border-transparent bg-blue-50/20' : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${conf.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{conf.label}</span>
                </div>
                <div className="text-base font-semibold text-gray-900 mt-2 tabular-nums">
                  ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 成本明细列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">成本录入明细</h3>
          </div>
          {selectedCostType && (
            <button
              onClick={() => setSelectedCostType('')}
              className="text-xs text-blue-600 hover:underline"
            >
              清除分类筛选
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/60 text-gray-400 font-medium border-b border-gray-100">
              <tr>
                <th className="py-2.5 px-4">日期</th>
                <th className="py-2.5 px-4">店铺 / 平台</th>
                <th className="py-2.5 px-4">分类</th>
                <th className="py-2.5 px-4">项目名称</th>
                <th className="py-2.5 px-4 text-right">金额 (元)</th>
                <th className="py-2.5 px-4">备注说明</th>
                <th className="py-2.5 px-4">录入人</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {costs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    暂无成本明细记录，点击右上角录入第一笔经营成本
                  </td>
                </tr>
              ) : (
                costs.map((c) => {
                  const conf = COST_TYPE_MAP[c.costType] || COST_TYPE_MAP.other
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900">{c.costDate}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {c.shopName || '默认店铺'} · {c.platformName || c.platformCode}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] border font-medium ${conf.color}`}>
                          {conf.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-800 font-medium">{c.costName}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 tabular-nums">
                        ¥{c.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-gray-400 max-w-xs truncate">{c.remark || '-'}</td>
                      <td className="py-3 px-4 text-gray-500">{c.createdByName || '管理员'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增成本弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">录入经营成本</h3>
            <form onSubmit={handleCreateCost} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 mb-1">费用发生日期</label>
                <input
                  type="date"
                  value={formCostDate}
                  onChange={(e) => setFormCostDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">成本分类</label>
                <select
                  value={formCostType}
                  onChange={(e) => setFormCostType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="labor">人力成本 (主播/中控薪资与提成)</option>
                  <option value="ad">广告投流 (千川/磁力金牛/万相台)</option>
                  <option value="goods">货品成本 (采购成本/发货耗材)</option>
                  <option value="platform_fee">平台扣点 (佣金/服务费)</option>
                  <option value="other">其他杂费 (场地/水电/折旧)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">所属平台</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="douyin">抖音电商</option>
                  <option value="kuaishou">快手电商</option>
                  <option value="taobao">淘宝集市</option>
                  <option value="tmall">天猫商城</option>
                  <option value="jd">京东</option>
                  <option value="pdd">拼多多</option>
                  <option value="xiaohongshu">小红书电商</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">费用名称与摘要</label>
                <input
                  type="text"
                  placeholder="例如：11月主播基础底薪包"
                  value={formCostName}
                  onChange={(e) => setFormCostName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">金额 (元)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">备注信息</label>
                <textarea
                  rows={2}
                  placeholder="可记录分摊规则或核算明细..."
                  value={formRemark}
                  onChange={(e) => setFormRemark(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  确认保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
