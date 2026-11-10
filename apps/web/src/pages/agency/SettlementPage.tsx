import React, { useState, useEffect } from 'react'
import { CheckCircle2, Lock, Calculator, Printer } from 'lucide-react'
import { SettlementPrintModal } from '@/components/agency/SettlementPrintModal'

interface SettlementBill {
  id: number
  projectId: number
  projectName: string
  clientName: string
  brandName: string
  periodMonth: string
  totalGmv: number
  flatFee: number
  commissionAmount: number
  slotFeeTotal: number
  anchorCommission: number
  deductionTotal: number
  totalPayable: number
  status: 'draft' | 'review' | 'sent' | 'confirmed' | 'paid'
  pdfUrl?: string
  sentAt?: string
  confirmedAt?: string
}

export const SettlementPage: React.FC = () => {
  const [bills, setBills] = useState<SettlementBill[]>([])
  const [, setLoading] = useState(true)
  const [showCalcModal, setShowCalcModal] = useState(false)
  const [calcProjectId, setCalcProjectId] = useState('1')
  const [calcMonth, setCalcMonth] = useState('2026-11')
  const [previewData, setPreviewData] = useState<any>(null)
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<SettlementBill | null>(null)

  const fetchBills = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/agency/settlement/bills')
      if (res.ok) {
        const json = await res.json()
        setBills(json.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBills()
  }, [])

  const handleCalculate = async () => {
    try {
      const res = await fetch('/api/v1/agency/settlement/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: Number(calcProjectId),
          periodMonth: calcMonth,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        setPreviewData(json.data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveBill = async () => {
    if (!previewData) return
    try {
      const res = await fetch('/api/v1/agency/settlement/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewData),
      })
      if (res.ok) {
        setShowCalcModal(false)
        setPreviewData(null)
        fetchBills()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdateStatus = async (id: number, nextStatus: string) => {
    try {
      const res = await fetch(`/api/v1/agency/settlement/bills/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        fetchBills()
      } else {
        const json = await res.json()
        alert(json.message || '更新失败')
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 头部标题与按钮 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">月结对账单与法律凭单中心</h1>
          <p className="text-xs text-gray-500 mt-1">
            向品牌方正式开具月度履约结算账单。发送后自动进入不可篡改 (IMMUTABLE) 保护状态
          </p>
        </div>
        <button
          onClick={() => {
            setShowCalcModal(true)
            handleCalculate()
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
        >
          <Calculator className="w-4 h-4" />
          核算本月账单
        </button>
      </div>

      {/* 状态安全提醒 Banner */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-1">
          <p className="font-semibold">对账法律凭单不可篡改安全规则：</p>
          <p>
            对账单状态一旦推进至「已发送 (sent)」、「品牌方确认 (confirmed)」或「已结款 (paid)」，后端数据库触发不可逆锁定规则，严禁任何人员直接篡改金额或删除凭证，保障对账真实可信。
          </p>
        </div>
      </div>

      {/* 账单表格 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/60 text-gray-400 font-medium border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">对账周期</th>
                <th className="py-3 px-4">项目与品牌</th>
                <th className="py-3 px-4 text-right">当月总成交 (GMV)</th>
                <th className="py-3 px-4 text-right">固定服务费</th>
                <th className="py-3 px-4 text-right">GMV 佣金</th>
                <th className="py-3 px-4 text-right">坑位费/代垫款</th>
                <th className="py-3 px-4 text-right font-bold text-gray-900">应收合计</th>
                <th className="py-3 px-4 text-center">状态</th>
                <th className="py-3 px-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    暂无对账单记录，点击右上角核算并生成月结单
                  </td>
                </tr>
              ) : (
                bills.map((b) => {
                  const isLocked = ['sent', 'confirmed', 'paid'].includes(b.status)
                  let statusBadge = 'bg-gray-100 text-gray-600'
                  let statusText = '草稿 (draft)'
                  if (b.status === 'review') {
                    statusBadge = 'bg-amber-50 text-amber-600 border border-amber-200'
                    statusText = '内部复核中'
                  } else if (b.status === 'sent') {
                    statusBadge = 'bg-blue-50 text-blue-600 border border-blue-200'
                    statusText = '已发送品牌方 (已锁定)'
                  } else if (b.status === 'confirmed') {
                    statusBadge = 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    statusText = '品牌方已确认'
                  } else if (b.status === 'paid') {
                    statusBadge = 'bg-purple-50 text-purple-600 border border-purple-200'
                    statusText = '款项已结清'
                  }

                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{b.periodMonth}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-gray-800">{b.projectName}</div>
                        <div className="text-[11px] text-gray-400">{b.brandName || b.clientName}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-gray-700">
                        ¥{b.totalGmv.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-gray-700">
                        ¥{b.flatFee.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-gray-700">
                        ¥{b.commissionAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-gray-700">
                        ¥{b.slotFeeTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-blue-700 text-sm">
                        ¥{b.totalPayable.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${statusBadge}`}>
                          {isLocked && <Lock className="w-3 h-3" />}
                          {statusText}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          {b.status === 'draft' && (
                            <button
                              onClick={() => handleUpdateStatus(b.id, 'review')}
                              className="px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 rounded"
                            >
                              提交复核
                            </button>
                          )}
                          {b.status === 'review' && (
                            <button
                              onClick={() => handleUpdateStatus(b.id, 'sent')}
                              className="px-2 py-1 text-[11px] bg-blue-600 text-white hover:bg-blue-700 rounded shadow-2xs"
                            >
                              发送品牌方
                            </button>
                          )}
                          {b.status === 'sent' && (
                            <button
                              onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                              className="px-2 py-1 text-[11px] bg-emerald-600 text-white hover:bg-emerald-700 rounded shadow-2xs"
                            >
                              确认收款
                            </button>
                          )}
                          {b.status === 'confirmed' && (
                            <span className="text-emerald-600 text-[11px] font-medium flex items-center gap-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 已生效
                            </span>
                          )}
                          <button
                            onClick={() => setSelectedBillForPrint(b)}
                            title="打印 / 预览法律凭证"
                            className="px-2 py-1 text-[11px] text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded inline-flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            凭证
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 核算弹窗 */}
      {showCalcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">核算月度对账单</h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-gray-600 mb-1">项目 ID</label>
                <input
                  type="number"
                  value={calcProjectId}
                  onChange={(e) => setCalcProjectId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">结算月份</label>
                <input
                  type="month"
                  value={calcMonth}
                  onChange={(e) => setCalcMonth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCalculate}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200"
              >
                从直播场次重新拉取计算
              </button>
            </div>

            {previewData && (
              <div className="p-4 bg-gray-50 rounded-xl space-y-2 text-xs border border-gray-200/60">
                <div className="font-semibold text-gray-900 text-sm mb-2">{previewData.projectName}</div>
                <div className="flex justify-between text-gray-600">
                  <span>总播出成交 (GMV):</span>
                  <span className="font-medium text-gray-900">¥{previewData.totalGmv?.toLocaleString('zh-CN')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>固定月服务费:</span>
                  <span className="font-medium text-gray-900">¥{previewData.flatFee?.toLocaleString('zh-CN')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>GMV 阶梯佣金:</span>
                  <span className="font-medium text-gray-900">¥{previewData.commissionAmount?.toLocaleString('zh-CN')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>坑位费与代垫款:</span>
                  <span className="font-medium text-gray-900">¥{previewData.slotFeeTotal?.toLocaleString('zh-CN')}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-blue-700">
                  <span>应收结算总额:</span>
                  <span>¥{previewData.totalPayable?.toLocaleString('zh-CN')}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCalcModal(false)}
                className="px-4 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveBill}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 font-medium"
              >
                生成正式草稿账单
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 法律凭证打印与预览模态框 */}
      <SettlementPrintModal
        isOpen={!!selectedBillForPrint}
        bill={selectedBillForPrint}
        onClose={() => setSelectedBillForPrint(null)}
      />
    </div>
  )
}
