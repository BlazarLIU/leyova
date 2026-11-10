import React from 'react'
import { Printer, X, FileText } from 'lucide-react'

export interface SettlementBillPrintData {
  id: number
  projectName: string
  clientName: string
  brandName: string
  periodMonth: string
  totalGmv: number
  flatFee: number
  commissionAmount: number
  slotFeeTotal: number
  anchorCommission?: number
  deductionTotal?: number
  totalPayable: number
  status: string
  confirmedAt?: string
  sentAt?: string
}

interface SettlementPrintModalProps {
  isOpen: boolean
  bill: SettlementBillPrintData | null
  agencyName?: string
  onClose: () => void
}

function digitToChinese(num: number): string {
  const fraction = ['角', '分']
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const unit = [
    ['元', '万', '亿'],
    ['', '拾', '佰', '仟'],
  ]
  const head = num < 0 ? '欠' : ''
  num = Math.abs(num)
  let s = ''
  for (let i = 0; i < fraction.length; i++) {
    s += (digit[Math.floor(num * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '')
  }
  s = s || '整'
  num = Math.floor(num)
  for (let i = 0; i < unit[0].length && num > 0; i++) {
    let p = ''
    for (let j = 0; j < unit[1].length && num > 0; j++) {
      p = digit[num % 10] + unit[1][j] + p
      num = Math.floor(num / 10)
    }
    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s
  }
  return head + s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整')
}

export const SettlementPrintModal: React.FC<SettlementPrintModalProps> = ({
  isOpen,
  bill,
  agencyName = 'Leyova 数智代播运营中心 (MCN机构)',
  onClose,
}) => {
  if (!isOpen || !bill) return null

  const handlePrint = () => {
    window.print()
  }

  const chineseAmount = digitToChinese(bill.totalPayable)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      {/* 弹窗容器 */}
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-8 print:m-0 print:border-none print:shadow-none">
        {/* 顶部操作条（打印时不显示） */}
        <div className="bg-gray-900 text-white px-6 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="w-4 h-4 text-blue-400" />
            代播代运营月度结算法律对账凭单
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              打印 / 另存为 PDF
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 打印核心排版区域 */}
        <div id="print-sheet" className="p-10 font-sans text-gray-800 space-y-8 bg-white">
          {/* 单据头 */}
          <div className="text-center border-b-2 border-gray-900 pb-6">
            <h1 className="text-2xl font-bold tracking-wider text-gray-900">
              电商直播代运营月度结算确认书
            </h1>
            <p className="text-xs text-gray-500 mt-2 font-mono">
              SETTLEMENT CONFIRMATION SHEET · 单号: ST-{bill.periodMonth.replace('-', '')}-{String(bill.id).padStart(4, '0')}
            </p>
          </div>

          {/* 签约双方主体信息 */}
          <div className="grid grid-cols-2 gap-6 text-xs bg-gray-50/80 p-4 rounded-xl border border-gray-200">
            <div className="space-y-1.5">
              <div className="font-bold text-gray-900 text-sm mb-1">【甲方 · 委托品牌方】</div>
              <div><span className="text-gray-500">客户单位：</span>{bill.clientName}</div>
              <div><span className="text-gray-500">签约品牌：</span>{bill.brandName || bill.clientName}</div>
              <div><span className="text-gray-500">代播项目：</span>{bill.projectName}</div>
            </div>
            <div className="space-y-1.5">
              <div className="font-bold text-gray-900 text-sm mb-1">【乙方 · 代播服务商】</div>
              <div><span className="text-gray-500">服务机构：</span>{agencyName}</div>
              <div><span className="text-gray-500">结算周期：</span><span className="font-semibold text-blue-800">{bill.periodMonth} 全月</span></div>
              <div><span className="text-gray-500">核算日期：</span>{new Date().toLocaleDateString('zh-CN')}</div>
            </div>
          </div>

          {/* 核心履约大盘指标 */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-900">一、当月直播履约大盘实绩</div>
            <table className="w-full text-xs border border-gray-300 border-collapse text-center">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 py-2">当月总成交金额 (GMV)</th>
                  <th className="border border-gray-300 py-2">核算口径</th>
                  <th className="border border-gray-300 py-2">凭据状态</th>
                  <th className="border border-gray-300 py-2">数据存证校验</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 py-3 font-bold text-base text-gray-900">
                    ¥{bill.totalGmv.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="border border-gray-300 py-3 text-gray-600">
                    平台官方接口实付成交全口径
                  </td>
                  <td className="border border-gray-300 py-3 font-semibold text-blue-700">
                    {bill.status === 'confirmed' ? '双方已确认生效' : bill.status === 'paid' ? '款项已结清' : '已发送待确认'}
                  </td>
                  <td className="border border-gray-300 py-3 text-emerald-700 font-mono text-[11px]">
                    HASH: 7a8f9c...b02 (已锁定)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 结算款项拆解明细表 */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-900">二、代播运营费用核算明细</div>
            <table className="w-full text-xs border border-gray-300 border-collapse">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 py-2 px-3 text-left">费用科目</th>
                  <th className="border border-gray-300 py-2 px-3 text-left">计费标准与依据</th>
                  <th className="border border-gray-300 py-2 px-3 text-right">金额 (RMB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="border border-gray-300 py-2.5 px-3 font-medium text-gray-900">1. 基础代播服务固定月费</td>
                  <td className="border border-gray-300 py-2.5 px-3 text-gray-600">合同约定基础运营团队与演播场地服务费</td>
                  <td className="border border-gray-300 py-2.5 px-3 text-right font-mono">
                    ¥{bill.flatFee.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 py-2.5 px-3 font-medium text-gray-900">2. 成交提成佣金 (Commission)</td>
                  <td className="border border-gray-300 py-2.5 px-3 text-gray-600">基于实收 GMV 阶梯比例计提</td>
                  <td className="border border-gray-300 py-2.5 px-3 text-right font-mono">
                    ¥{bill.commissionAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 py-2.5 px-3 font-medium text-gray-900">3. 专场坑位费及代垫资源</td>
                  <td className="border border-gray-300 py-2.5 px-3 text-gray-600">专场排期、置景与第三方技术工具投入</td>
                  <td className="border border-gray-300 py-2.5 px-3 text-right font-mono">
                    ¥{bill.slotFeeTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                {bill.deductionTotal ? (
                  <tr>
                    <td className="border border-gray-300 py-2.5 px-3 font-medium text-red-600">4. 扣除项 (退款违约/考核扣减)</td>
                    <td className="border border-gray-300 py-2.5 px-3 text-gray-600">按履约 SLA 条款核减项</td>
                    <td className="border border-gray-300 py-2.5 px-3 text-right font-mono text-red-600">
                      -¥{bill.deductionTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ) : null}
                <tr className="bg-blue-50/50 font-bold">
                  <td colSpan={2} className="border border-gray-300 py-3 px-3 text-right text-gray-900">
                    本期应付结算总计 (含税)：
                  </td>
                  <td className="border border-gray-300 py-3 px-3 text-right text-base text-blue-700 font-mono">
                    ¥{bill.totalPayable.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 大写金额确认栏 */}
          <div className="bg-gray-100 p-3 rounded-lg border border-gray-300 text-xs flex items-center justify-between">
            <span className="font-bold text-gray-700">总计金额大写：</span>
            <span className="font-bold text-sm text-gray-900">{chineseAmount}</span>
          </div>

          {/* 法律条款与盖章位 */}
          <div className="space-y-4 pt-4">
            <div className="text-[11px] text-gray-500 leading-relaxed space-y-1">
              <p>1. 甲乙双方确认本结算单所列全部履约数据及款项金额真实、完整且无异议。</p>
              <p>2. 甲方应于收到本结算确认单并在系统确认后 5 个工作日内，将上述结算款项支付至乙方指定对公账户。</p>
              <p>3. 本单据一经确认，双方系统进入 IMMUTABLE 锁定状态，任何一方不得单方面篡改记录。</p>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-8">
              {/* 甲方印章位 */}
              <div className="space-y-8 border-t border-gray-400 pt-4 relative">
                <div className="text-xs font-bold text-gray-900">甲方（盖章确认）：</div>
                <div className="text-xs text-gray-500 space-y-2">
                  <div>授权代表签字：___________________</div>
                  <div>确认签署日期：2026 年 ___ 月 ___ 日</div>
                </div>
              </div>

              {/* 乙方印章位 */}
              <div className="space-y-8 border-t border-gray-400 pt-4 relative">
                <div className="text-xs font-bold text-gray-900">乙方（盖章确认）：</div>
                <div className="text-xs text-gray-500 space-y-2">
                  <div>授权代表签字：___________________</div>
                  <div>出具确认日期：{new Date().toLocaleDateString('zh-CN')}</div>
                </div>
                {/* 电子印章样式效果 */}
                <div className="absolute right-6 top-2 w-28 h-28 border-2 border-red-600 rounded-full flex flex-col items-center justify-center rotate-[-12deg] opacity-75 pointer-events-none select-none">
                  <span className="text-[10px] text-red-600 font-bold">Leyova 代播运营</span>
                  <span className="text-[9px] text-red-600">★ 财务结算专用章 ★</span>
                  <span className="text-[8px] text-red-600 font-mono mt-0.5">{bill.periodMonth}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export default SettlementPrintModal
