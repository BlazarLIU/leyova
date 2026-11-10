import React, { useState, useEffect } from 'react'
import { TrendingUp, Clock, ShoppingBag, Receipt, ShieldCheck, Printer } from 'lucide-react'
import { SettlementPrintModal, SettlementBillPrintData } from '@/components/agency/SettlementPrintModal'

interface PortalData {
  projects: Array<{
    id: number
    name: string
    platformCode: string
    platformName: string
    brandName: string
    gmvTarget: number
    status: string
  }>
  canViewCost: boolean
  stats: {
    sessionCount: number
    totalGmv: number
    totalHours: number
    orderCount: number
  }
  recentSessions: Array<{
    id: number
    projectName: string
    date: string
    title: string
    anchorName: string
    durationMin: number
    gmv: number
    orders: number
  }>
  bills: Array<{
    id: number
    periodMonth: string
    totalGmv: number
    totalPayable: number
    status: string
    pdfUrl?: string
    sentAt?: string
  }>
}

export const BrandDashboardPage: React.FC = () => {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState<SettlementBillPrintData | null>(null)

  useEffect(() => {
    async function loadPortal() {
      try {
        const res = await fetch('/api/v1/portal/dashboard')
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
        }
      } catch (e) {
        console.error('Failed to load brand portal', e)
      } finally {
        setLoading(false)
      }
    }
    loadPortal()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-xs text-gray-400">
        加载品牌专属运营看板中...
      </div>
    )
  }

  const primaryProject = data?.projects?.[0]
  const brandName = primaryProject?.brandName || '品牌客户'

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 max-w-7xl mx-auto space-y-6">
      {/* 顶部品牌身份 Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {brandName.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{brandName} · 品牌履约驾驶舱</h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> 品牌自播受限只读视角
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              代播签约项目：{primaryProject?.name || 'GAP抖音官方旗舰店代播项目'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI 指标卡 */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>履约总成交额 (GMV)</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2 tabular-nums">
              ¥{data.stats.totalGmv.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">全周期真实对账口径</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>播出总时长</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2 tabular-nums">
              {data.stats.totalHours} 小时
            </div>
            <div className="text-[11px] text-gray-400 mt-1">共计 {data.stats.sessionCount} 场直播</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>成交订单量</span>
              <ShoppingBag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2 tabular-nums">
              {data.stats.orderCount.toLocaleString('zh-CN')} 单
            </div>
            <div className="text-[11px] text-gray-400 mt-1">有效买家支付订单</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>对账单生效数</span>
              <Receipt className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-xl font-bold text-purple-700 mt-2 tabular-nums">
              {data.bills.length} 期
            </div>
            <div className="text-[11px] text-gray-400 mt-1">已出具法律结算凭证</div>
          </div>
        </div>
      )}

      {/* 两栏：左侧最近场次，右侧对账凭据 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：最近直播场次 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">近期直播场次明细</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/60 text-gray-400 font-medium border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">日期</th>
                  <th className="py-2.5 px-3">场次标题</th>
                  <th className="py-2.5 px-3">主讲主播</th>
                  <th className="py-2.5 px-3 text-right">时长</th>
                  <th className="py-2.5 px-3 text-right">GMV (元)</th>
                  <th className="py-2.5 px-3 text-right">订单数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.recentSessions?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      近期无直播记录
                    </td>
                  </tr>
                ) : (
                  data?.recentSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{s.date}</td>
                      <td className="py-2.5 px-3 text-gray-800">{s.title}</td>
                      <td className="py-2.5 px-3 text-gray-600">{s.anchorName || '排班主播'}</td>
                      <td className="py-2.5 px-3 text-right text-gray-500">{s.durationMin} 分钟</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-gray-900 tabular-nums">
                        ¥{s.gmv?.toLocaleString('zh-CN')}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{s.orders}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右侧：月度结算对账单列表 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">月结对账单凭据</h3>
          <div className="space-y-3">
            {data?.bills?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">暂无已出具的月结账单</p>
            ) : (
              data?.bills.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:border-blue-200 transition-all space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{b.periodMonth} 期结算</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {b.status === 'sent' ? '代播已开具' : b.status === 'confirmed' ? '已确认' : '已结清'}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-[11px] items-center">
                    <span>当月成交: ¥{b.totalGmv.toLocaleString('zh-CN')}</span>
                    <span className="font-semibold text-gray-900">应付: ¥{b.totalPayable.toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() =>
                        setSelectedBill({
                          id: b.id,
                          projectName: primaryProject?.name || '品牌代播项目',
                          clientName: brandName,
                          brandName: brandName,
                          periodMonth: b.periodMonth,
                          totalGmv: b.totalGmv,
                          flatFee: 20000,
                          commissionAmount: Math.max(0, b.totalPayable - 20000),
                          slotFeeTotal: 0,
                          totalPayable: b.totalPayable,
                          status: b.status,
                          sentAt: b.sentAt,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Printer className="w-3 h-3" />
                      预览并打印法律凭单
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <SettlementPrintModal
        isOpen={!!selectedBill}
        bill={selectedBill}
        onClose={() => setSelectedBill(null)}
      />
    </div>
  )
}
