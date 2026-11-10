import React, { useState, useEffect } from 'react'
import { Plus, Building2, UserPlus, Phone, FileText, ShieldCheck, ChevronRight } from 'lucide-react'

interface AgencyClient {
  id: number
  name: string
  brandName: string
  contact: string
  contactPhone: string
  contractNo: string
  status: string
  createdAt: string
  projectCount: number
}

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [, setLoading] = useState(true)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [selectedClientName, setSelectedClientName] = useState('')

  // 新增客户表单
  const [clientName, setClientName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [contact, setContact] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contractNo, setContractNo] = useState('')

  // 品牌自播账号表单
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [viewerName, setViewerName] = useState('')

  const fetchClients = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/agency/clients')
      if (res.ok) {
        const json = await res.json()
        setClients(json.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName) return

    try {
      const res = await fetch('/api/v1/agency/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clientName,
          brandName: brandName || clientName,
          contact,
          contactPhone,
          contractNo,
        }),
      })

      if (res.ok) {
        setShowClientModal(false)
        setClientName('')
        setBrandName('')
        setContact('')
        setContactPhone('')
        setContractNo('')
        fetchClients()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateViewerAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClientId || !username || !password) return

    try {
      const res = await fetch(`/api/v1/agency/clients/${selectedClientId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          name: viewerName || `${selectedClientName}品牌代表`,
          canViewCost: false,
        }),
      })

      if (res.ok) {
        setShowUserModal(false)
        setUsername('')
        setPassword('')
        setViewerName('')
        alert('品牌自播专属登录账号开通成功！品牌方可使用该账号登录 /brand-portal 查看专属看板。')
      } else {
        const json = await res.json()
        alert(json.message || '开通账号失败')
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">品牌自播档案管理</h1>
          <p className="text-xs text-gray-500 mt-1">
            品牌自播档案库：统一管理自播品牌合同、开通专属受限登录账号与项目权限隔离
          </p>
        </div>
        <button
          onClick={() => setShowClientModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          录入新品牌客户
        </button>
      </div>

      {/* 客户卡片列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {c.status === 'active' ? '合作中' : c.status}
                </span>
                <span className="text-xs text-gray-400">已签约 {c.projectCount} 个代播项目</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 leading-snug">{c.brandName || c.name}</h3>
                <div className="text-xs text-gray-500 mt-0.5">{c.name}</div>
              </div>

              <div className="pt-3 border-t border-gray-50 space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>对接人：{c.contact || '未填写'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span>联系电话：{c.contactPhone || '未填写'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span>主合同编号：{c.contractNo || '暂无'}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-50 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setSelectedClientId(c.id)
                  setSelectedClientName(c.brandName || c.name)
                  setShowUserModal(true)
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50/80 hover:bg-blue-100/80 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                开通自播账号
              </button>

              <a
                href="/agency/projects"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
              >
                查看代播项目
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* 新增客户弹窗 */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">签约新品牌客户档案</h3>
            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 mb-1">企业/客户全称</label>
                <input
                  type="text"
                  placeholder="例如：杭州星辉品牌管理有限公司"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">品牌简称 / 商标名</label>
                <input
                  type="text"
                  placeholder="例如：GAP、Calvin Klein、李宁"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">品牌对接人</label>
                  <input
                    type="text"
                    placeholder="姓名/职位"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">对接联系电话</label>
                  <input
                    type="text"
                    placeholder="手机号"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1">代播框架主合同号</label>
                <input
                  type="text"
                  placeholder="例如：AGY-2026-GAP-001"
                  value={contractNo}
                  onChange={(e) => setContractNo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
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

      {/* 开通品牌自播账号弹窗 */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">开通品牌自播专属登录账号</h3>
              <p className="text-xs text-gray-500 mt-1">
                为【{selectedClientName}】生成独立登录凭证。该账号登录后自动受到项目范围与数据敏感字段隔离保护。
              </p>
            </div>

            <form onSubmit={handleCreateViewerAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 mb-1">登录用户名</label>
                <input
                  type="text"
                  placeholder="例如：gap_brand_lead"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">初始登录密码</label>
                <input
                  type="password"
                  placeholder="建议 8 位以上包含字母与数字"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1">账号使用者称呼</label>
                <input
                  type="text"
                  placeholder="例如：陈总监 (GAP电商部)"
                  value={viewerName}
                  onChange={(e) => setViewerName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="bg-blue-50/60 border border-blue-200/60 rounded-lg p-3 space-y-1 text-[11px] text-blue-800">
                <div className="flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  权限安全保障说明：
                </div>
                <p>• 品牌自播账号无法查看其他品牌的数据与直播场次（数据库 RLS 强隔离）；</p>
                <p>• 内部人力薪资与代播真实成本默认隐藏，仅开放成交 GMV、时长与正式月结单。</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  确认开通并生效
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
