import React, { useState, useEffect } from 'react'
import { Plus, Building2, ChevronRight } from 'lucide-react'

interface AgencyProject {
  id: number
  name: string
  clientName: string
  brandName: string
  platformCode: string
  platformName: string
  contractStart: string
  contractEnd: string
  billingModel: string
  flatFee: number
  gmvTarget: number
  playHoursTarget: number
  status: string
  sessionCount: number
  totalActualGmv: number
}

interface AgencyClient {
  id: number
  name: string
  brandName: string
}

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<AgencyProject[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // 表单状态
  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [platformCode, setPlatformCode] = useState('douyin')
  const [contractStart, setContractStart] = useState('2026-01-01')
  const [contractEnd, setContractEnd] = useState('2026-12-31')
  const [billingModel, setBillingModel] = useState('hybrid')
  const [flatFee, setFlatFee] = useState('30000')
  const [gmvTarget, setGmvTarget] = useState('5000000')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [projRes, clientRes] = await Promise.all([
        fetch('/api/v1/agency/projects'),
        fetch('/api/v1/agency/clients'),
      ])
      if (projRes.ok) {
        const json = await projRes.json()
        setProjects(json.data || [])
      }
      if (clientRes.ok) {
        const json = await clientRes.json()
        setClients(json.data || [])
        if (json.data?.length > 0 && !clientId) {
          setClientId(String(json.data[0].id))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !name) return

    try {
      const res = await fetch('/api/v1/agency/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientId),
          name,
          platformCode,
          contractStart,
          contractEnd,
          billingModel,
          flatFee: parseFloat(flatFee) || 0,
          gmvTarget: parseFloat(gmvTarget) || null,
        }),
      })

      if (res.ok) {
        setShowModal(false)
        setName('')
        fetchData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">代播项目与客户合同管理</h1>
          <p className="text-xs text-gray-500 mt-1">
            MCN 代播服务商视角：管理多品牌合同履约、排班调度、坑位费与月结对账单
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          签约新项目
        </button>
      </div>

      {/* 项目卡片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => {
          const completionRate = p.gmvTarget > 0 ? ((p.totalActualGmv / p.gmvTarget) * 100).toFixed(1) : '0'
          return (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {p.platformName || p.platformCode}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {p.status === 'active' ? '履约中' : p.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">{p.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{p.brandName || p.clientName}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-50 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>计费模式</span>
                    <span className="font-medium text-gray-800">
                      {p.billingModel === 'hybrid' ? '固定月费 + GMV佣金' : p.billingModel}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>固定服务费</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      ¥{p.flatFee.toLocaleString('zh-CN')}/月
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>合同目标 GMV</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      ¥{p.gmvTarget ? p.gmvTarget.toLocaleString('zh-CN') : '未设定'}
                    </span>
                  </div>
                </div>

                {/* 达成进度 */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400">履约累计成交额</span>
                    <span className="font-bold text-blue-600 tabular-nums">
                      ¥{p.totalActualGmv.toLocaleString('zh-CN')} ({completionRate}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, Number(completionRate))}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-50 flex items-center justify-between text-xs">
                <span className="text-gray-400">已播出 {p.sessionCount} 场次</span>
                <span className="text-blue-600 font-medium inline-flex items-center gap-0.5 hover:underline cursor-pointer">
                  查看月结账单
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 新建项目模态框 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">签约代播项目合同</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 mb-1">所属自播品牌</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.brandName || c.name} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">项目合同全称</label>
                <input
                  type="text"
                  placeholder="例如：Calvin Klein官方旗舰店2026代运营项目"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">直播电商平台</label>
                  <select
                    value={platformCode}
                    onChange={(e) => setPlatformCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="douyin">抖音电商</option>
                    <option value="kuaishou">快手电商</option>
                    <option value="taobao">淘宝直播</option>
                    <option value="xiaohongshu">小红书直播</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-600 mb-1">结算模式</label>
                  <select
                    value={billingModel}
                    onChange={(e) => setBillingModel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="hybrid">固定月费 + GMV佣金</option>
                    <option value="monthly_flat">仅固定服务费</option>
                    <option value="gmv_commission">仅纯佣金提成</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">固定服务费 (元/月)</label>
                  <input
                    type="number"
                    value={flatFee}
                    onChange={(e) => setFlatFee(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-1">合同周期目标 GMV</label>
                  <input
                    type="number"
                    value={gmvTarget}
                    onChange={(e) => setGmvTarget(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">合同起期</label>
                  <input
                    type="date"
                    value={contractStart}
                    onChange={(e) => setContractStart(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-1">合同止期</label>
                  <input
                    type="date"
                    value={contractEnd}
                    onChange={(e) => setContractEnd(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  签署保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
