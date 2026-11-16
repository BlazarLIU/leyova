import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  FileText,
  Sparkles,
  Layers,
  Clock,
  MessageSquare,
  Users,
  Radio,
  Package,
  ShieldCheck,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Send,
} from 'lucide-react'
import { api } from '../../services/api'
import { useShops } from '../../hooks/useShops'

interface PlanTemplate {
  id: number
  template_code: string
  name: string
  version: number
  blocks: any
}

interface CampaignPlanDetail {
  id: number
  planNo: string
  shopName: string
  categoryCode: string
  templateCode: string
  approvalStatus: 'pending' | 'approved' | 'rejected'
  dispatchedAt?: string | null
  dispatchSummary?: any
  planPayload: {
    planNo: string
    generatedAt: string
    shop: { id: number; name: string; platform: string }
    modules: Record<string, any>
  }
}

export const CampaignPlanPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillRecId = searchParams.get('recommendationId')
  const prefillCategory = searchParams.get('categoryCode') || 'APPAREL'

  const { shops } = useShops()
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [selectedShopId, setSelectedShopId] = useState<number>(shops[0]?.id || 1)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('TMPL_STANDARD_LIVE')
  const [targetGmv, setTargetGmv] = useState<number>(50000)
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<CampaignPlanDetail | null>(null)

  useEffect(() => {
    if (shops.length > 0 && !selectedShopId) {
      setSelectedShopId(shops[0].id)
    }
  }, [shops])

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await api.get<{ data: PlanTemplate[] }>('/campaign-plan/templates')
        if (res && res.data) {
          setTemplates(res.data)
        }
      } catch (err) {
        console.error('Failed to load templates', err)
      }
    }
    loadTemplates()
  }, [])

  const handleGenerate = async () => {
    if (!selectedShopId) return
    setLoading(true)
    try {
      const res = await api.post<{ data: CampaignPlanDetail }>('/campaign-plan/generate', {
        shopId: selectedShopId,
        categoryCode: prefillCategory,
        templateCode: selectedTemplate,
        sourceRecommendationId: prefillRecId ? parseInt(prefillRecId, 10) : undefined,
        targetGmv,
      })
      if (res && res.data) {
        setPlan(res.data)
      }
    } catch (err) {
      console.error('Plan generation failed', err)
    } finally {
      setLoading(false)
    }
  }

  // 初始如果从选品页跳来，自动生成一次
  useEffect(() => {
    if (prefillRecId && selectedShopId) {
      handleGenerate()
    }
  }, [prefillRecId])

  const handleUpdateStatus = async (status: 'approved' | 'rejected') => {
    if (!plan?.id) return
    try {
      await api.patch(`/campaign-plan/plans/${plan.id}`, { status })
      setPlan((prev) => (prev ? { ...prev, approvalStatus: status } : null))
    } catch (err) {
      console.error('Status update failed', err)
    }
  }

  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<any>(null)

  const handleDispatch = async () => {
    if (!plan?.id) return
    setDispatchLoading(true)
    try {
      const res = await api.post<{ data: any }>(`/campaign-plan/plans/${plan.id}/dispatch`, {})
      if (res && res.data) {
        setDispatchResult(res.data)
        setPlan((prev) => (prev ? { ...prev, dispatchedAt: res.data.dispatchedAt, dispatchSummary: res.data } : null))
      }
    } catch (err: any) {
      console.error('Dispatch failed', err)
      alert(err?.response?.data?.message || err?.message || '拆解下发失败')
    } finally {
      setDispatchLoading(false)
    }
  }

  const mods = plan?.planPayload?.modules || {}

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 头部导航 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ai/selection')}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2.5 bg-gradient-to-tr from-purple-500 to-indigo-600 rounded-xl text-white shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              一键生成 12 模块全域运营方案
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                标准化大促模板
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              整合场次目标、货盘分层、开播分段、话术剧本、投流策略与风控合规，生成可落地执行的运营方案
            </p>
          </div>
        </div>

        {plan && (
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                plan.approvalStatus === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : plan.approvalStatus === 'rejected'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {plan.approvalStatus === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
              {plan.approvalStatus === 'rejected' && <XCircle className="w-4 h-4 text-rose-600" />}
              状态：{plan.approvalStatus === 'approved' ? '已审核通过' : plan.approvalStatus === 'rejected' ? '已驳回修改' : '待总监审批'}
            </span>

            {plan.approvalStatus === 'pending' && (
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => handleUpdateStatus('approved')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition"
                >
                  审批通过
                </button>
                <button
                  onClick={() => handleUpdateStatus('rejected')}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition"
                >
                  驳回
                </button>
              </div>
            )}

            {plan.approvalStatus === 'approved' && (
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={handleDispatch}
                  disabled={dispatchLoading}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  {dispatchLoading ? '正在拆解下发...' : plan.dispatchedAt ? '重新拆解下发' : '一键下游自动拆解'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 拆解下发成功公示条 */}
      {(dispatchResult || plan?.dispatchSummary?.scripts) && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <span className="font-semibold">方案已成功拆解并下发至 3 个下游业务系统：</span>
              <span className="ml-1 text-indigo-700 dark:text-indigo-300">
                主播话术库 (已注入 {dispatchResult?.scripts?.count || plan?.dispatchSummary?.scripts?.count || 4} 条) · 
                排品计划货盘 (已锁定 {dispatchResult?.sessionPlan?.productsCount || plan?.dispatchSummary?.sessionPlan?.productsCount || 2} 款) · 
                投放中心投流计划 (预算 ¥{dispatchResult?.adPlan?.plannedBudget || plan?.dispatchSummary?.adPlan?.plannedBudget || 0})
              </span>
            </div>
          </div>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 shrink-0 font-mono">
            编号: {dispatchResult?.adPlan?.planNo || plan?.dispatchSummary?.adPlan?.planNo || plan?.planNo}
          </span>
        </div>
      )}

      {/* 参数选择卡片 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">
              目标运营店铺
            </label>
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.platformName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">
              运营方案模板
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            >
              {templates.map((t) => (
                <option key={t.template_code} value={t.template_code}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">
              目标 GMV (元)
            </label>
            <input
              type="number"
              step="5000"
              value={targetGmv}
              onChange={(e) => setTargetGmv(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? '正在编排方案...' : '立即一键生成方案'}
            </button>
          </div>
        </div>

        {prefillRecId && (
          <div className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 p-2.5 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            已成功载入选品推荐结果 (ID: {prefillRecId})，货盘与依据将自动关联进本场方案
          </div>
        )}
      </div>

      {/* 方案展示区域 */}
      {plan && (
        <div className="space-y-6">
          {/* 方案速览卡片 */}
          <div className="bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 rounded-xl p-6 text-white border border-indigo-900/50 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {plan.planPayload?.shop?.name} 官方方案
                </span>
                <h2 className="text-xl font-bold mt-2 text-white">
                  {mods.m1_positioning?.theme || '直播运营方案'}
                </h2>
                <p className="text-xs text-indigo-200 mt-1">
                  方案编号: {plan.planNo} · 生成时间: {new Date(plan.planPayload.generatedAt).toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-xs text-gray-400">目标 GMV</div>
                  <div className="text-lg font-bold text-amber-400">
                    ¥{mods.m1_positioning?.targetGmv?.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-xs text-gray-400">预估订单</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {mods.m1_positioning?.targetOrders} 单
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-xs text-gray-400">场观预期</div>
                  <div className="text-lg font-bold text-blue-400">
                    {mods.m1_positioning?.targetViewers?.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-xs text-gray-400">目标 ROI</div>
                  <div className="text-lg font-bold text-purple-400">
                    {mods.m1_positioning?.expectedRoi}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 12 模块卡片列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* M2 货盘结构 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  M2. 货盘分层结构
                </h3>
              </div>
              <div className="space-y-2">
                {mods.m2_assortment?.structure?.map((st: any, i: number) => (
                  <div key={i} className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-xs space-y-1">
                    <div className="font-semibold text-gray-800 dark:text-gray-200 flex justify-between">
                      <span>{st.role}</span>
                      <span className="text-gray-400">{st.count} 款</span>
                    </div>
                    <div className="text-gray-500 line-clamp-1">{st.skus?.join(' · ')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* M4 时段节奏 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-blue-500" />
                  M4. 开播时段与节奏分段
                </h3>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {mods.m4_timing?.suggestedSlot}
                </span>
              </div>
              <div className="space-y-2">
                {mods.m4_timing?.loops?.map((lp: any, i: number) => (
                  <div key={i} className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-xs flex gap-3">
                    <span className="font-mono font-semibold text-gray-700 dark:text-gray-300 w-24 shrink-0">
                      {lp.period}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{lp.focus}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* M5 主播话术剧本 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 md:col-span-2">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  M5. 主播四阶实战话术设计 (AI 润色)
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg space-y-1">
                  <div className="font-semibold text-emerald-800 dark:text-emerald-300">① 开场钩子话术</div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{mods.m5_scripts?.opening}</p>
                </div>
                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-lg space-y-1">
                  <div className="font-semibold text-indigo-800 dark:text-indigo-300">② 憋单停留连带</div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{mods.m5_scripts?.hookAndHold}</p>
                </div>
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-lg space-y-1">
                  <div className="font-semibold text-amber-800 dark:text-amber-300">③ 痛点价值转化</div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{mods.m5_scripts?.pitch}</p>
                </div>
                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-lg space-y-1">
                  <div className="font-semibold text-rose-800 dark:text-rose-300">④ 逼单紧迫促单</div>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{mods.m5_scripts?.urgency}</p>
                </div>
              </div>
            </div>

            {/* M6 岗位协同 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm border-b border-gray-100 dark:border-gray-800 pb-3">
                <Users className="w-4 h-4 text-purple-500" />
                M6. 岗位职责与配合
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">主推主播：</span>
                  <span className="text-gray-600 dark:text-gray-400">{mods.m6_staffing?.anchor}</span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">现场中控：</span>
                  <span className="text-gray-600 dark:text-gray-400">{mods.m6_staffing?.controller}</span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-lg">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">付费投手：</span>
                  <span className="text-gray-600 dark:text-gray-400">{mods.m6_staffing?.operator}</span>
                </div>
              </div>
            </div>

            {/* M7 投流计划 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm border-b border-gray-100 dark:border-gray-800 pb-3">
                <Radio className="w-4 h-4 text-blue-500" />
                M7. 付费投流与追投策略
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg">
                  <span className="font-semibold text-blue-800 dark:text-blue-300">追投触发条件：</span>
                  <span className="text-gray-600 dark:text-gray-300">{mods.m7_ad_traffic?.chasingCondition}</span>
                </div>
                <div className="p-2.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-lg">
                  <span className="font-semibold text-rose-800 dark:text-rose-300">止损停投条件：</span>
                  <span className="text-gray-600 dark:text-gray-300">{mods.m7_ad_traffic?.stopCondition}</span>
                </div>
              </div>
            </div>

            {/* M8 库存与 M9 促销 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm border-b border-gray-100 dark:border-gray-800 pb-3">
                <Package className="w-4 h-4 text-amber-500" />
                M8. 货品库存预警与备货
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {mods.m8_inventory_risk?.rule}
              </p>
            </div>

            {/* M10 合规风控与 M11 应急预案 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm border-b border-gray-100 dark:border-gray-800 pb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                M10. 合规巡检与风控自查
              </h3>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-disc pl-4">
                {mods.m10_compliance_checklist?.rulesChecked?.map((r: string, idx: number) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
