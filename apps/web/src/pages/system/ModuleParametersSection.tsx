import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  CalendarCheck,
  TrendingUp,
  Package,
  ClipboardList,
  ShieldAlert,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Award,
  Clock,
  Calculator,
  LayoutDashboard,
  Target,
  Radio,
  BarChart4,
  Layers,
  Megaphone,
  Video,
  GraduationCap,
  Cpu,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  useModuleParams,
  type ModuleParamItem,
  type CommissionTierItem,
  type CategoryBenchmarkItem,
} from '@/hooks/useModuleParams'

interface Props {
  userRole: string
  anchors?: any[]
  rooms?: any[]
}

type ModuleKey =
  | 'hrbp'
  | 'schedule'
  | 'overview_bi'
  | 'goal_alerts'
  | 'session_reg'
  | 'review_funnel'
  | 'omnichannel_traffic'
  | 'promotions_competitor'
  | 'assortment_products'
  | 'fulfillment_rma'
  | 'content_kol'
  | 'anchor_training'
  | 'compliance'
  | 'system_infra'

interface ModuleTabMeta {
  key: ModuleKey
  name: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
  badge?: string
}

const MODULE_TABS: ModuleTabMeta[] = [
  { key: 'hrbp', name: '1. HRBP 与绩效激励', icon: Users, desc: '主播分层提成矩阵、铁三角岗位分成、品类退货率阈值、薪效比警戒线', badge: '核心' },
  { key: 'schedule', name: '2. 直播排班与现场调度', icon: CalendarCheck, desc: '连续开播疲劳熔断、单场标准工时、轮休间隔与夜班津贴' },
  { key: 'overview_bi', name: '3. 经营看板与商业智能', icon: LayoutDashboard, desc: '大屏刷新间隔、进店平均UV价值达标线、全渠道大盘退款警戒' },
  { key: 'goal_alerts', name: '4. 目标达成与异常中心', icon: Target, desc: '严重告警自动升级时效、闭环改进任务SLA时限、目标严重滞后偏差' },
  { key: 'session_reg', name: '5. 场次调度与直播登记', icon: Radio, desc: '开播未关自动完结超时、人工直播登记补录宽限期、对账容错率' },
  { key: 'review_funnel', name: '6. 直播复盘与转化闭环', icon: BarChart4, desc: '在线人数骤降报警比、曝光点击率CTR及格线、下单转化及格线、爆款单品集中度上限' },
  { key: 'omnichannel_traffic', name: '7. 多平台流量与全域投流', icon: Layers, desc: '抖音三池自然:搜索:商流调度比、快手间接成交归因天数、视频号私域进播占比' },
  { key: 'promotions_competitor', name: '8. 营销大促与竞品观察', icon: Megaphone, desc: '全场多重促销叠加最大折扣深度、竞品同款降价预警触发差额、竞品抓取轮询频次' },
  { key: 'assortment_products', name: '9. 货盘排品与选品商品', icon: Package, desc: '标准排品结构引流:主推:高利配比、滞销库存周转天数红线、选品毛利率底线' },
  { key: 'fulfillment_rma', name: '10. 履约 SLA 与售后客服', icon: ClipboardList, desc: '48h发货SLA达标率、客服首次响应超时红线、极速退款审核限额、超时发货赔付比例' },
  { key: 'content_kol', name: '11. 内容创作与达人短视频', icon: Video, desc: '带货短视频完播率达标门线、外部达人合作佣金封顶线、小红书笔记种草归因天数' },
  { key: 'anchor_training', name: '12. 主播赋能与能力训战', icon: GraduationCap, desc: '主播五维胜任力雷达考评权重、新主播试播考核准入合格分' },
  { key: 'compliance', name: '13. 平台规则雷达与风控', icon: ShieldAlert, desc: '直播间违规停播扣分熔断阀、独家签约与竞业到期提前预警天数' },
  { key: 'system_infra', name: '14. 系统底层与运维队列', icon: Cpu, desc: '异步任务最大重试次数、全系统操作审计日志保存留存期' },
]

export function ModuleParametersSection({ userRole, anchors = [], rooms = [] }: Props) {
  const isReadOnly = userRole !== 'super_admin'
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('hrbp')

  // Hook 管理该模块参数
  const { params, updateParameters, deleteParameter } = useModuleParams(selectedModule)

  // 成功/错误反馈提示
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 3500)
  }

  // ════════════════════════════════════════════════════════════════
  // 1. HRBP 模块特定状态（由用户自由设定）
  // ════════════════════════════════════════════════════════════════

  // 全局铁三角参数
  const [operatorProfitShare, setOperatorProfitShare] = useState<number>(8.0)
  const [adBuyerRate, setAdBuyerRate] = useState<number>(1.2)
  const [adBuyerTargetRoi, setAdBuyerTargetRoi] = useState<number>(3.2)
  const [controllerPerSession, setControllerPerSession] = useState<number>(150)
  const [controllerBonus, setControllerBonus] = useState<number>(1000)
  const [laborAlert, setLaborAlert] = useState<number>(10.0)

  // 主播等级基准（用户可自由增删改层级和阶梯）
  interface EditableTier {
    tierCode: string
    tierName: string
    baseSalary: number
    tiers: CommissionTierItem[]
  }

  const [anchorTiers, setAnchorTiers] = useState<EditableTier[]>([])

  // 5大品类退货率阈值（用户可自由增删改）
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<CategoryBenchmarkItem[]>([])

  // 个人专属覆盖弹窗状态
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideForm, setOverrideForm] = useState<{
    targetType: 'anchor' | 'room'
    targetId: string
    targetName: string
    baseSalary: number
    commissionMode: 'tiered' | 'flat'
    flatRate: number
    tiers: CommissionTierItem[]
    note: string
  }>({
    targetType: 'anchor',
    targetId: '',
    targetName: '',
    baseSalary: 12000,
    commissionMode: 'flat',
    flatRate: 8.5,
    tiers: [
      { max_gmv: 50, rate: 4.0 },
      { max_gmv: 150, rate: 6.5 },
      { max_gmv: 999999, rate: 9.0 },
    ],
    note: '头部战略合伙人对赌协议',
  })

  // ════════════════════════════════════════════════════════════════
  // 2. 其他模块参数状态（通用表单驱动）
  // ════════════════════════════════════════════════════════════════
  const [genericForm, setGenericForm] = useState<Record<string, any>>({})

  // 同步 params 到局部可编辑状态
  useEffect(() => {
    if (!params || params.length === 0) return

    if (selectedModule === 'hrbp') {
      // 提取铁三角全局参数
      const op = params.find((p) => p.param_key === 'operator_profit_share' && p.scope_type === 'global')
      if (op) setOperatorProfitShare(Number(op.param_value))

      const ad = params.find((p) => p.param_key === 'ad_buyer_incentive' && p.scope_type === 'global')
      if (ad && ad.param_value) {
        setAdBuyerRate(Number(ad.param_value.rate ?? 1.2))
        setAdBuyerTargetRoi(Number(ad.param_value.target_roi ?? 3.2))
      }

      const ctrl = params.find((p) => p.param_key === 'controller_allowance' && p.scope_type === 'global')
      if (ctrl && ctrl.param_value) {
        setControllerPerSession(Number(ctrl.param_value.per_session ?? 150))
        setControllerBonus(Number(ctrl.param_value.bonus ?? 1000))
      }

      const alertP = params.find((p) => p.param_key === 'labor_efficiency_alert' && p.scope_type === 'global')
      if (alertP) setLaborAlert(Number(alertP.param_value))

      // 提取主播等级基准 (scope_type = 'tier')
      const tierRows = params.filter((p) => p.scope_type === 'tier' && p.param_key === 'anchor_tier_commission')
      if (tierRows.length > 0) {
        setAnchorTiers(
          tierRows.map((r) => ({
            tierCode: r.scope_id,
            tierName: r.param_value?.tier_name || `${r.scope_id}级主播`,
            baseSalary: Number(r.param_value?.base_salary ?? 8000),
            tiers: Array.isArray(r.param_value?.tiers) ? r.param_value.tiers : [],
          }))
        )
      } else {
        // 兜底初始阶梯
        setAnchorTiers([
          { tierCode: 'S', tierName: 'S级标杆主播', baseSalary: 15000, tiers: [{ max_gmv: 100, rate: 5.0 }, { max_gmv: 300, rate: 8.0 }, { max_gmv: 999999, rate: 10.0 }] },
          { tierCode: 'A', tierName: 'A级骨干主播', baseSalary: 10000, tiers: [{ max_gmv: 50, rate: 3.5 }, { max_gmv: 150, rate: 5.5 }, { max_gmv: 999999, rate: 7.5 }] },
          { tierCode: 'B', tierName: 'B级腰部主播', baseSalary: 7000, tiers: [{ max_gmv: 30, rate: 2.0 }, { max_gmv: 80, rate: 3.5 }, { max_gmv: 999999, rate: 5.0 }] },
          { tierCode: 'C', tierName: 'C级成长新秀', baseSalary: 5500, tiers: [{ max_gmv: 20, rate: 1.0 }, { max_gmv: 999999, rate: 2.0 }] },
        ])
      }

      // 提取 5 大品类退货率与毛利基准
      const catP = params.find((p) => p.param_key === 'category_benchmarks' && p.scope_type === 'global')
      if (catP && Array.isArray(catP.param_value)) {
        setCategoryBenchmarks(catP.param_value)
      } else {
        setCategoryBenchmarks([
          { category: '美妆护肤', max_return_rate: 25.0, target_margin: 45.0, desc: '保质期敏感、退货率低' },
          { category: '服装', max_return_rate: 60.0, target_margin: 55.0, desc: '试穿尺码效应明显、退货率高' },
          { category: '食品生鲜', max_return_rate: 20.0, target_margin: 30.0, desc: '客单适中、退款需快速拦截' },
          { category: '3C数码', max_return_rate: 15.0, target_margin: 18.0, desc: '高客单、标品低退货' },
          { category: '鞋箱包', max_return_rate: 35.0, target_margin: 40.0, desc: '时尚搭配品类、退货率居中' },
        ])
      }
    } else {
      // 通用模块参数初始化
      const form: Record<string, any> = {}
      for (const p of params) {
        form[p.param_key] = p.param_value
      }
      setGenericForm(form)
    }
  }, [params, selectedModule])

  // ════════════════════════════════════════════════════════════════
  // 3. 个人/直播间专属覆盖列表
  // ════════════════════════════════════════════════════════════════
  const entityOverrides = useMemo(() => {
    return params.filter((p) => p.scope_type === 'entity')
  }, [params])

  // ════════════════════════════════════════════════════════════════
  // 4. 即时生效沙盘试算器 (Sandbox Live Test)
  // ════════════════════════════════════════════════════════════════
  const [simAnchorId, setSimAnchorId] = useState<string>('anchor:1')
  const [simGmv, setSimGmv] = useState<number>(120) // 万元

  const simulationResult = useMemo(() => {
    if (!simAnchorId) return null

    // 1. 查找是否存在该主播的专属对赌覆盖 (L3)
    const override = entityOverrides.find((p) => p.scope_id === simAnchorId)
    if (override && override.param_value) {
      const val = override.param_value
      const baseSalary = Number(val.base_salary ?? 0)
      let commission = 0
      if (val.commission_mode === 'flat') {
        commission = simGmv * 10000 * ((Number(val.rate) || 0) / 100)
      } else if (Array.isArray(val.tiers)) {
        // 阶梯提成计算
        let remainingGmv = simGmv
        let prevMax = 0
        for (const t of val.tiers) {
          const tierCap = t.max_gmv - prevMax
          const gmvInTier = Math.min(remainingGmv, tierCap)
          if (gmvInTier > 0) {
            commission += gmvInTier * 10000 * (t.rate / 100)
            remainingGmv -= gmvInTier
          }
          prevMax = t.max_gmv
          if (remainingGmv <= 0) break
        }
      }
      const totalPay = baseSalary + commission
      const costRatio = simGmv > 0 ? (totalPay / (simGmv * 10000)) * 100 : 0
      return {
        matchedLevel: 'L3: 个人专属对赌协议 (Override)',
        matchedName: val.target_name || override.param_name,
        baseSalary,
        commission,
        totalPay,
        costRatio,
        rateDesc: val.commission_mode === 'flat' ? `净 GMV 单一提成 ${val.rate}%` : '专属多阶梯',
        isOverride: true,
      }
    }

    // 2. 匹配主播的等级基准 (L2: S / A / B / C)
    // 从 anchor 列表中找出该主播等级
    const realAnchor = anchors.find((a) => `anchor:${a.id}` === simAnchorId)
    const tierCode = realAnchor?.level || 'A'
    const matchedTier = anchorTiers.find((t) => t.tierCode.toUpperCase() === tierCode.toUpperCase()) || anchorTiers[0]

    if (matchedTier) {
      const baseSalary = matchedTier.baseSalary
      let commission = 0
      let remainingGmv = simGmv
      let prevMax = 0
      for (const t of matchedTier.tiers) {
        const tierCap = t.max_gmv - prevMax
        const gmvInTier = Math.min(remainingGmv, tierCap)
        if (gmvInTier > 0) {
          commission += gmvInTier * 10000 * (t.rate / 100)
          remainingGmv -= gmvInTier
        }
        prevMax = t.max_gmv
        if (remainingGmv <= 0) break
      }
      const totalPay = baseSalary + commission
      const costRatio = simGmv > 0 ? (totalPay / (simGmv * 10000)) * 100 : 0
      return {
        matchedLevel: `L2: ${matchedTier.tierName} (${matchedTier.tierCode}级基准)`,
        matchedName: `${realAnchor?.name || '主播'} · ${matchedTier.tierName}`,
        baseSalary,
        commission,
        totalPay,
        costRatio,
        rateDesc: matchedTier.tiers.map((t) => `<${t.max_gmv > 10000 ? '超额' : t.max_gmv + '万'}:${t.rate}%`).join(' / '),
        isOverride: false,
      }
    }

    return null
  }, [simAnchorId, simGmv, entityOverrides, anchorTiers, anchors])

  // ════════════════════════════════════════════════════════════════
  // 5. 保存与修改操作
  // ════════════════════════════════════════════════════════════════

  // 保存 HRBP 模块参数
  const handleSaveHrbpParams = async () => {
    if (isReadOnly) {
      showToast('error', '只有系统管理员具备参数保存权限')
      return
    }
    setSaving(true)
    try {
      const itemsToUpdate: Partial<ModuleParamItem>[] = [
        // 铁三角全局
        { module_code: 'hrbp', param_key: 'operator_profit_share', param_name: '操盘手净利润分红比例', param_type: 'percentage', scope_type: 'global', scope_id: 'default', param_value: operatorProfitShare, unit: '%' },
        { module_code: 'hrbp', param_key: 'ad_buyer_incentive', param_name: '千川投手消耗提成与目标ROI', param_type: 'json', scope_type: 'global', scope_id: 'default', param_value: { rate: adBuyerRate, target_roi: adBuyerTargetRoi }, unit: '%' },
        { module_code: 'hrbp', param_key: 'controller_allowance', param_name: '中控场次津贴与安全奖', param_type: 'json', scope_type: 'global', scope_id: 'default', param_value: { per_session: controllerPerSession, bonus: controllerBonus }, unit: '元' },
        { module_code: 'hrbp', param_key: 'labor_efficiency_alert', param_name: '薪效比红线阈值', param_type: 'percentage', scope_type: 'global', scope_id: 'default', param_value: laborAlert, unit: '%' },
        // 5大品类退货率与毛利基准
        { module_code: 'hrbp', param_key: 'category_benchmarks', param_name: '5大品类退货率与毛利基准', param_type: 'json', scope_type: 'global', scope_id: 'default', param_value: categoryBenchmarks, unit: '多指标' },
      ]

      // 主播等级阶梯基准
      for (const t of anchorTiers) {
        itemsToUpdate.push({
          module_code: 'hrbp',
          param_key: 'anchor_tier_commission',
          param_name: `${t.tierName}提成阶梯`,
          param_type: 'json',
          scope_type: 'tier',
          scope_id: t.tierCode,
          param_value: {
            tier_name: t.tierName,
            base_salary: t.baseSalary,
            tiers: t.tiers,
          },
          unit: '阶梯',
          description: `由用户自定义配置的 ${t.tierName} 标准基准`,
        })
      }

      await updateParameters(itemsToUpdate)
      showToast('success', 'HRBP 模块参数及主播分层阶梯已全量保存！全系统各模块已即时生效')
    } catch (e: any) {
      showToast('error', e?.message || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 保存通用模块参数
  const handleSaveGenericParams = async () => {
    if (isReadOnly) {
      showToast('error', '只有系统管理员具备参数保存权限')
      return
    }
    setSaving(true)
    try {
      const itemsToUpdate: Partial<ModuleParamItem>[] = []
      for (const p of params) {
        if (p.scope_type === 'global' && genericForm[p.param_key] !== undefined) {
          itemsToUpdate.push({
            module_code: selectedModule,
            param_key: p.param_key,
            param_name: p.param_name,
            param_type: p.param_type,
            scope_type: 'global',
            scope_id: 'default',
            param_value: Number(genericForm[p.param_key]) || genericForm[p.param_key],
            unit: p.unit,
          })
        }
      }
      await updateParameters(itemsToUpdate)
      showToast('success', `「${MODULE_TABS.find((t) => t.key === selectedModule)?.name}」参数已更新，系统各模块已联动更新！`)
    } catch (e: any) {
      showToast('error', e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 新增/编辑个人专属覆盖
  const handleSaveOverride = async () => {
    if (!overrideForm.targetId) {
      showToast('error', '请先选择需要定制参数的人员或直播间')
      return
    }
    setSaving(true)
    try {
      await updateParameters([
        {
          module_code: 'hrbp',
          param_key: 'anchor_individual_override',
          param_name: `${overrideForm.targetName}专属对赌协议`,
          param_type: 'json',
          scope_type: 'entity',
          scope_id: overrideForm.targetId,
          param_value: {
            target_name: overrideForm.targetName,
            base_salary: overrideForm.baseSalary,
            commission_mode: overrideForm.commissionMode,
            rate: overrideForm.flatRate,
            tiers: overrideForm.tiers,
            note: overrideForm.note,
          },
          unit: overrideForm.commissionMode === 'flat' ? '%' : '阶梯',
          description: `针对 ${overrideForm.targetName} 单独签署的专属合同，覆盖通用阶梯`,
        },
      ])
      setShowOverrideModal(false)
      showToast('success', `已成功为「${overrideForm.targetName}」创建个人专属覆盖参数！`)
    } catch (e: any) {
      showToast('error', e?.message || '保存覆盖失败')
    } finally {
      setSaving(false)
    }
  }

  // 恢复继承（删除个人覆盖）
  const handleDeleteOverride = async (paramId: number, targetName?: string) => {
    if (isReadOnly) return
    if (!window.confirm(`确定要移除「${targetName || '该条目'}」的专属覆盖吗？移除后将自动恢复继承上级层级基准。`)) return
    try {
      await deleteParameter(paramId)
      showToast('success', '已移除个人专属覆盖，该人员已自动恢复继承通用层级标准！')
    } catch (e: any) {
      showToast('error', e?.message || '删除失败')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="space-y-6">
      {/* 顶部模块分类切换 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {MODULE_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = selectedModule === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setSelectedModule(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium shrink-0 transition-all border ${isActive
                ? 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/40 shadow-sm shadow-orbit-primary/10'
                : 'bg-orbit-surface2 text-[var(--text-muted)] border-orbit-border hover:text-[var(--text-primary)] hover:border-orbit-border2'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.name}</span>
              {tab.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-accent/15 text-cyan-400 font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 提示条 */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-orbit-primary/10 border border-orbit-primary/20 text-xs text-orbit-primary-light">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-orbit-accent" />
          <span>
            <strong>三层参数覆盖架构生效中：</strong> 系统优先匹配【个人/实体专属覆盖】，无覆盖时继承【层级/岗位基准】，无基准时回退【全局默认】。
            全部标准由您根据业务自主决定与设定！
          </span>
        </div>
        {isReadOnly && (
          <Badge variant="warning" className="shrink-0">
            只读试算模式
          </Badge>
        )}
      </div>

      {/* 反馈 Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${toastMsg.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}
          >
            {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 模块 1：HRBP 与绩效激励 (核心精细化分层配置) */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {selectedModule === 'hrbp' && (
        <div className="space-y-6">
          {/* Section 1: 全局基准与铁三角分润 */}
          <Card>
            <CardHeader
              title="1. 直播间铁三角全岗激励基准与经营红线"
              subtitle="操盘手、千川投手、中控场控岗位分成比例与全局人效警戒线"
              actions={
                !isReadOnly && (
                  <Button size="sm" variant="primary" disabled={saving} onClick={handleSaveHrbpParams}>
                    <Save className="w-3.5 h-3.5" />
                    {saving ? '保存中…' : '保存全部配置'}
                  </Button>
                )
              }
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border border-orbit-border bg-orbit-surface2/40">
                {/* 操盘手 */}
                <div className="space-y-2 border-r border-orbit-border/40 pr-3">
                  <div className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-400" /> 操盘运营分红比例
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">净利润分红比例 (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={isReadOnly}
                      value={operatorProfitShare}
                      onChange={(e) => setOperatorProfitShare(Number(e.target.value))}
                      className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2.5 py-1.5 font-mono font-bold text-[var(--text-secondary)]"
                    />
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">经营毛利扣减投流与履约后的净利润分红</p>
                </div>

                {/* 千川投手 */}
                <div className="space-y-2 border-r border-orbit-border/40 pr-3">
                  <div className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> 千川投手激励基准
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] block mb-1">消耗提成 (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        disabled={isReadOnly}
                        value={adBuyerRate}
                        onChange={(e) => setAdBuyerRate(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1.5 font-mono font-bold text-[var(--text-secondary)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] block mb-1">保本目标 ROI</label>
                      <input
                        type="number"
                        step="0.1"
                        disabled={isReadOnly}
                        value={adBuyerTargetRoi}
                        onChange={(e) => setAdBuyerTargetRoi(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1.5 font-mono font-bold text-[var(--text-secondary)]"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">按实际消耗比例提成，挂钩 ROI 达成</p>
                </div>

                {/* 中控场控 */}
                <div className="space-y-2 border-r border-orbit-border/40 pr-3">
                  <div className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" /> 中控/场控出勤津贴
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] block mb-1">场次津贴 (元/场)</label>
                      <input
                        type="number"
                        step="10"
                        disabled={isReadOnly}
                        value={controllerPerSession}
                        onChange={(e) => setControllerPerSession(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1.5 font-mono font-bold text-[var(--text-secondary)]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] block mb-1">安全奖金 (元/月)</label>
                      <input
                        type="number"
                        step="100"
                        disabled={isReadOnly}
                        value={controllerBonus}
                        onChange={(e) => setControllerBonus(Number(e.target.value))}
                        className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2 py-1.5 font-mono font-bold text-[var(--text-secondary)]"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">出勤场次按劳分配及月度零失误奖</p>
                </div>

                {/* 人效红线 */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> 经营人效罗盘警戒线
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">全员薪效比红线 (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={isReadOnly}
                      value={laborAlert}
                      onChange={(e) => setLaborAlert(Number(e.target.value))}
                      className="w-full text-xs bg-orbit-surface border border-orbit-border rounded-lg px-2.5 py-1.5 font-mono font-bold text-rose-400"
                    />
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">团队总薪酬占净成交比例超过此值在罗盘标红</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Section 2: 用户自由定义主播等级提成矩阵 (User Custom Tier Matrix) */}
          <Card>
            <CardHeader
              title="2. 主播等级基准与提成阶梯矩阵（由用户自由设定）"
              subtitle="支持自由增加/删除等级，自定义底薪与阶梯提成率，彻底杜绝一锅烩拉通"
              actions={
                !isReadOnly && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const code = prompt('请输入新等级标识代码 (如 S+, Star, D):', 'S+')
                        if (!code) return
                        const name = prompt('请输入等级显示名称 (如 特约超级合伙人):', '特约合伙人主播') || `${code}级主播`
                        setAnchorTiers((prev) => [
                          ...prev,
                          {
                            tierCode: code.toUpperCase(),
                            tierName: name,
                            baseSalary: 18000,
                            tiers: [
                              { max_gmv: 100, rate: 6.0 },
                              { max_gmv: 300, rate: 9.0 },
                              { max_gmv: 999999, rate: 12.0 },
                            ],
                          },
                        ])
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> 新增自定义层级
                    </Button>
                    <Button size="sm" variant="primary" disabled={saving} onClick={handleSaveHrbpParams}>
                      <Save className="w-3.5 h-3.5" /> 保存阶梯配置
                    </Button>
                  </div>
                )
              }
            />
            <CardBody className="p-0">
              <div className="divide-y divide-orbit-border">
                {anchorTiers.map((tier, tIdx) => (
                  <div key={tier.tierCode} className="p-4 hover:bg-white/[0.015] transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-orbit-primary/20 text-orbit-primary-light font-bold flex items-center justify-center text-sm border border-orbit-primary/30">
                          {tier.tierCode}
                        </span>
                        <div>
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={tier.tierName}
                            onChange={(e) => {
                              const val = e.target.value
                              setAnchorTiers((prev) => prev.map((t, i) => (i === tIdx ? { ...t, tierName: val } : t)))
                            }}
                            className="text-sm font-semibold bg-transparent border-b border-dashed border-orbit-border hover:border-orbit-primary text-[var(--text-secondary)] outline-none px-1"
                          />
                          <span className="text-[11px] text-[var(--text-muted)] ml-2">基准标识: {tier.tierCode}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--text-muted)]">保底底薪:</span>
                          <input
                            type="number"
                            step="500"
                            disabled={isReadOnly}
                            value={tier.baseSalary}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              setAnchorTiers((prev) => prev.map((t, i) => (i === tIdx ? { ...t, baseSalary: val } : t)))
                            }}
                            className="w-24 text-xs bg-orbit-surface border border-orbit-border rounded px-2 py-1 font-mono font-bold text-[var(--text-secondary)]"
                          />
                          <span className="text-xs text-[var(--text-muted)]">元/月</span>
                        </div>

                        {!isReadOnly && anchorTiers.length > 1 && (
                          <button
                            onClick={() => {
                              if (window.confirm(`确定删除「${tier.tierName}」等级配置吗？`)) {
                                setAnchorTiers((prev) => prev.filter((_, i) => i !== tIdx))
                              }
                            }}
                            className="text-xs text-[var(--text-muted)] hover:text-rose-400 transition-colors p-1"
                            title="删除该等级"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 阶梯表格 */}
                    <div className="bg-orbit-surface2/60 rounded-xl p-3 border border-orbit-border/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[var(--text-muted)] font-medium">GMV 达成阶梯提成率设置：</span>
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              setAnchorTiers((prev) =>
                                prev.map((t, i) => {
                                  if (i !== tIdx) return t
                                  const lastTier = t.tiers[t.tiers.length - 1]
                                  const newMax = lastTier ? lastTier.max_gmv + 100 : 100
                                  const newRate = lastTier ? Number((lastTier.rate + 2.0).toFixed(1)) : 5.0
                                  return {
                                    ...t,
                                    tiers: [...t.tiers, { max_gmv: newMax, rate: newRate }],
                                  }
                                })
                              )
                            }}
                            className="text-[11px] text-orbit-primary-light hover:text-orbit-accent flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> 增加一级阶梯
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        {tier.tiers.map((step, sIdx) => (
                          <div key={sIdx} className="bg-orbit-surface border border-orbit-border rounded-lg p-2.5 flex flex-col gap-1.5 relative group">
                            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                              <span>阶梯 {sIdx + 1}</span>
                              {!isReadOnly && tier.tiers.length > 1 && (
                                <button
                                  onClick={() => {
                                    setAnchorTiers((prev) =>
                                      prev.map((t, i) =>
                                        i === tIdx ? { ...t, tiers: t.tiers.filter((_, idx) => idx !== sIdx) } : t
                                      )
                                    )
                                  }}
                                  className="text-[var(--text-muted)] hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[var(--text-muted)]">区间上限:</span>
                              <input
                                type="number"
                                step="10"
                                disabled={isReadOnly}
                                value={step.max_gmv >= 99999 ? '' : step.max_gmv}
                                placeholder="不限/以上"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 999999 : Number(e.target.value)
                                  setAnchorTiers((prev) =>
                                    prev.map((t, i) =>
                                      i === tIdx
                                        ? {
                                          ...t,
                                          tiers: t.tiers.map((st, idx) => (idx === sIdx ? { ...st, max_gmv: val } : st)),
                                        }
                                        : t
                                    )
                                  )
                                }}
                                className="w-20 text-xs bg-orbit-surface2 border border-orbit-border rounded px-1.5 py-1 font-mono text-[var(--text-secondary)]"
                              />
                              <span className="text-[10px] text-[var(--text-muted)]">万元</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[var(--text-muted)]">提成比例:</span>
                              <input
                                type="number"
                                step="0.5"
                                disabled={isReadOnly}
                                value={step.rate}
                                onChange={(e) => {
                                  const val = Number(e.target.value)
                                  setAnchorTiers((prev) =>
                                    prev.map((t, i) =>
                                      i === tIdx
                                        ? {
                                          ...t,
                                          tiers: t.tiers.map((st, idx) => (idx === sIdx ? { ...st, rate: val } : st)),
                                        }
                                        : t
                                    )
                                  )
                                }}
                                className="w-20 text-xs bg-orbit-surface2 border border-orbit-border rounded px-1.5 py-1 font-mono font-bold text-orbit-primary-light"
                              />
                              <span className="text-[10px] text-[var(--text-muted)]">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Section 3: 5 大品类退货率与毛利基准（由用户自由设定） */}
          <Card>
            <CardHeader
              title="3. 5 大品类退货率预警阈值与毛利基准（由用户自主设定）"
              subtitle="每个品类、每个业务的标准均由用户完全掌控，超出阈值在人效全景榜与复盘分析中实时标红预警"
              actions={
                !isReadOnly && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const name = prompt('请输入新增品类名称 (如 珠宝文玩、家居百货):', '')
                        if (!name) return
                        setCategoryBenchmarks((prev) => [
                          ...prev,
                          { category: name, max_return_rate: 30.0, target_margin: 40.0, desc: '用户自定义业务品类' },
                        ])
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> 新增品类
                    </Button>
                    <Button size="sm" variant="primary" disabled={saving} onClick={handleSaveHrbpParams}>
                      <Save className="w-3.5 h-3.5" /> 保存品类阈值
                    </Button>
                  </div>
                )
              }
            />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orbit-border text-[var(--text-muted)] text-xs">
                      <th className="text-left px-5 py-3 font-medium">类目名称</th>
                      <th className="text-left px-5 py-3 font-medium">退货率警戒红线 (%)</th>
                      <th className="text-left px-5 py-3 font-medium">基准毛利率 (%)</th>
                      <th className="text-left px-5 py-3 font-medium">业务特征与考评逻辑</th>
                      {!isReadOnly && <th className="text-right px-5 py-3 font-medium">操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBenchmarks.map((cat, idx) => (
                      <tr key={cat.category} className="border-b border-orbit-border/60 hover:bg-white/[0.015] transition-colors">
                        <td className="px-5 py-3.5 font-bold text-[var(--text-secondary)]">
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={cat.category}
                            onChange={(e) => {
                              const v = e.target.value
                              setCategoryBenchmarks((prev) => prev.map((c, i) => (i === idx ? { ...c, category: v } : c)))
                            }}
                            className="bg-transparent border-b border-dashed border-orbit-border text-[var(--text-secondary)] text-xs outline-none px-1"
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="1"
                              disabled={isReadOnly}
                              value={cat.max_return_rate}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                setCategoryBenchmarks((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, max_return_rate: v } : c))
                                )
                              }}
                              className="w-20 text-xs bg-orbit-surface border border-orbit-border rounded px-2 py-1 font-mono font-bold text-rose-400"
                            />
                            <span className="text-xs text-[var(--text-muted)]">%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="1"
                              disabled={isReadOnly}
                              value={cat.target_margin}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                setCategoryBenchmarks((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, target_margin: v } : c))
                                )
                              }}
                              className="w-20 text-xs bg-orbit-surface border border-orbit-border rounded px-2 py-1 font-mono font-bold text-emerald-400"
                            />
                            <span className="text-xs text-[var(--text-muted)]">%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={cat.desc || ''}
                            placeholder="填写业务特征说明…"
                            onChange={(e) => {
                              const v = e.target.value
                              setCategoryBenchmarks((prev) => prev.map((c, i) => (i === idx ? { ...c, desc: v } : c)))
                            }}
                            className="w-full bg-transparent border-b border-orbit-border/40 text-[var(--text-muted)] text-xs outline-none px-1 py-0.5"
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => {
                                if (window.confirm(`确定删除「${cat.category}」品类阈值吗？`)) {
                                  setCategoryBenchmarks((prev) => prev.filter((_, i) => i !== idx))
                                }
                              }}
                              className="text-xs text-[var(--text-muted)] hover:text-rose-400 p-1 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Section 4: 个人 / 直播间专属覆盖管理 (Individual Overrides) */}
          <Card>
            <CardHeader
              title="4. 核心人员 / 战略直播间专属覆盖对赌管理 (L3 Entity Overrides)"
              subtitle="针对特殊头部主播、特约合伙人单独签署的合同协议，优先级高于通用层级标准，彻底解决特殊人员个性化测算"
              actions={
                !isReadOnly && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const firstAnchor = anchors[0]
                      setOverrideForm({
                        targetType: 'anchor',
                        targetId: firstAnchor ? `anchor:${firstAnchor.id}` : 'anchor:1',
                        targetName: firstAnchor ? `${firstAnchor.name} (${firstAnchor.level || 'S'}级)` : '特约主播',
                        baseSalary: 20000,
                        commissionMode: 'flat',
                        flatRate: 8.5,
                        tiers: [
                          { max_gmv: 50, rate: 4.0 },
                          { max_gmv: 150, rate: 7.0 },
                          { max_gmv: 999999, rate: 10.0 },
                        ],
                        note: '2026年度头部战略合伙人协议',
                      })
                      setShowOverrideModal(true)
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> 为指定人员新增专属对赌覆盖
                  </Button>
                )
              }
            />
            <CardBody className="px-0">
              {entityOverrides.length === 0 ? (
                <div className="py-10 text-center text-[var(--text-muted)] text-xs">
                  暂无个人专属覆盖记录。当前全员按等级基准阶梯正常继承生效。点击右上角可为核心大主播或战略直播间创建专属对赌协议。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-orbit-border text-[var(--text-muted)] text-xs">
                        <th className="text-left px-5 py-3 font-medium">覆盖对象</th>
                        <th className="text-left px-5 py-3 font-medium">保底底薪</th>
                        <th className="text-left px-5 py-3 font-medium">专属提成模式</th>
                        <th className="text-left px-5 py-3 font-medium">费率 / 阶梯设置</th>
                        <th className="text-left px-5 py-3 font-medium">协议备注</th>
                        <th className="text-left px-5 py-3 font-medium">生效层级</th>
                        {!isReadOnly && <th className="text-right px-5 py-3 font-medium">操作</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {entityOverrides.map((ov) => {
                        const val = ov.param_value || {}
                        return (
                          <tr key={ov.id} className="border-b border-orbit-border/60 hover:bg-white/[0.015] transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-[var(--text-secondary)] block text-xs">{val.target_name || ov.param_name}</span>
                              <span className="text-[10px] font-mono text-[var(--text-muted)]">ID: {ov.scope_id}</span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-secondary)] font-bold">
                              ¥{(val.base_salary ?? 0).toLocaleString()} <span className="text-[10px] font-normal text-[var(--text-muted)]">/月</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge variant={val.commission_mode === 'flat' ? 'warning' : 'info'}>
                                {val.commission_mode === 'flat' ? '单一比例提成' : '专属多阶梯'}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-xs text-orbit-primary-light font-bold">
                              {val.commission_mode === 'flat'
                                ? `净 GMV × ${val.rate}%`
                                : (val.tiers || []).map((t: any) => `<${t.max_gmv > 10000 ? '超额' : t.max_gmv + '万'}:${t.rate}%`).join(' / ')}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-[var(--text-muted)] max-w-xs truncate">{val.note || '-'}</td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> L3 覆盖生效中
                              </span>
                            </td>
                            {!isReadOnly && (
                              <td className="px-5 py-3.5 text-right">
                                <button
                                  onClick={() => handleDeleteOverride(ov.id, val.target_name || ov.param_name)}
                                  className="text-xs text-[var(--text-muted)] hover:text-rose-400 transition-colors flex items-center gap-1 ml-auto"
                                  title="移除专属覆盖，恢复继承通用等级标准"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> 恢复继承
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Section 5: 即时生效沙盘试算模拟器 (Parameter Sandbox & Live Resolver) */}
          <Card className="border-orbit-accent/30 bg-gradient-to-br from-orbit-surface to-orbit-surface2/80">
            <CardHeader
              title="5. 三层参数动态解析引擎与即时试算沙盘 (Live Resolver Sandbox)"
              subtitle="选择任意主播，系统自动执行「L3个人覆盖 -> L2等级基准 -> L1全局默认」解析链路，实时验证测算结果"
              actions={
                <Badge variant="accent" className="flex items-center gap-1">
                  <Calculator className="w-3 h-3" /> 实时算力校验
                </Badge>
              }
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 左侧：输入模拟器 */}
                <div className="p-4 rounded-xl bg-orbit-surface border border-orbit-border space-y-3">
                  <div className="text-xs font-bold text-[var(--text-secondary)]">第一步：选择试算对象与模拟业绩</div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">选择试算主播 (共 {anchors.length} 名主播可供验证)</label>
                    <select
                      value={simAnchorId}
                      onChange={(e) => setSimAnchorId(e.target.value)}
                      className="w-full text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                    >
                      {anchors.map((a) => (
                        <option key={a.id} value={`anchor:${a.id}`}>
                          {a.name} ({a.level || 'A'}级) - {entityOverrides.some((o) => o.scope_id === `anchor:${a.id}`) ? '【已设L3专属覆盖】' : '【按等级基准继承】'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-[var(--text-muted)]">当月净成交 GMV (扣退货)</label>
                      <span className="text-xs font-mono font-bold text-orbit-primary-light">{simGmv} 万元</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="5"
                      value={simGmv}
                      onChange={(e) => setSimGmv(Number(e.target.value))}
                      className="w-full accent-orbit-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono mt-1">
                      <span>10万 (起步)</span>
                      <span>100万 (百万场)</span>
                      <span>300万 (核心)</span>
                      <span>500万 (大促顶峰)</span>
                    </div>
                  </div>
                </div>

                {/* 右侧：三层解析引擎输出 */}
                {simulationResult && (
                  <div className="p-4 rounded-xl bg-orbit-surface border border-orbit-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-secondary)]">第二步：引擎解析与激励分润产出</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${simulationResult.isOverride
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/30'
                          }`}
                      >
                        {simulationResult.matchedLevel}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center py-2 bg-orbit-surface2/60 rounded-lg border border-orbit-border/60">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block">保底底薪</span>
                        <span className="text-sm font-mono font-bold text-[var(--text-secondary)]">¥{simulationResult.baseSalary.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block">提成测算金额</span>
                        <span className="text-sm font-mono font-bold text-orbit-primary-light">
                          ¥{Math.round(simulationResult.commission).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block">预计全月总薪酬</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">
                          ¥{Math.round(simulationResult.totalPay).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>提成费率说明:</span>
                        <span className="font-mono text-[var(--text-secondary)] font-bold">{simulationResult.rateDesc}</span>
                      </div>
                      <div className="flex justify-between text-[var(--text-muted)]">
                        <span>测算薪效比:</span>
                        <span
                          className={`font-mono font-bold ${simulationResult.costRatio > laborAlert ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                        >
                          {simulationResult.costRatio.toFixed(2)}% {simulationResult.costRatio > laborAlert && '(超过红线!)'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 模块 2~6：其他业务模块的参数维护卡片 */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {selectedModule !== 'hrbp' && (
        <Card>
          <CardHeader
            title={`${MODULE_TABS.find((t) => t.key === selectedModule)?.name} — 参数配置`}
            subtitle={MODULE_TABS.find((t) => t.key === selectedModule)?.desc || '业务运维规则配置'}
            actions={
              !isReadOnly && (
                <Button size="sm" variant="primary" disabled={saving} onClick={handleSaveGenericParams}>
                  <Save className="w-3.5 h-3.5" />
                  {saving ? '保存中…' : '保存本模块参数'}
                </Button>
              )
            }
          />
          <CardBody>
            {params.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-muted)] text-xs">暂无配置参数项</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {params.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-orbit-surface2/60 border border-orbit-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-secondary)]">{p.param_name}</span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">{p.param_key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type={p.param_type === 'number' || p.param_type === 'percentage' ? 'number' : 'text'}
                        step="any"
                        disabled={isReadOnly}
                        value={genericForm[p.param_key] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setGenericForm((prev) => ({ ...prev, [p.param_key]: val }))
                        }}
                        className="flex-1 text-xs bg-orbit-surface border border-orbit-border rounded-lg px-3 py-2 font-mono font-bold text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                      />
                      {p.unit && <span className="text-xs text-[var(--text-muted)] font-mono w-12">{p.unit}</span>}
                    </div>
                    {p.description && <p className="text-[11px] text-[var(--text-muted)]">{p.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 弹窗：为指定人员/直播间定制个人专属覆盖 (Override Modal) */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowOverrideModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orbit-accent" />
                新增个人专属对赌覆盖 (L3 Override)
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ×
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">选择覆盖对象类型与目标</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const f = anchors[0]
                      setOverrideForm((p) => ({
                        ...p,
                        targetType: 'anchor',
                        targetId: f ? `anchor:${f.id}` : 'anchor:1',
                        targetName: f ? `${f.name} (${f.level || 'S'}级)` : '主播',
                      }))
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${overrideForm.targetType === 'anchor'
                      ? 'bg-orbit-primary/20 text-orbit-primary-light border-orbit-primary'
                      : 'bg-orbit-surface2 text-[var(--text-muted)] border-orbit-border'
                      }`}
                  >
                    按主播个人覆盖
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const r = rooms[0]
                      setOverrideForm((p) => ({
                        ...p,
                        targetType: 'room',
                        targetId: r ? `room:${r.id}` : 'room:1',
                        targetName: r ? `${r.name || '旗舰直播间'}` : '直播间',
                      }))
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${overrideForm.targetType === 'room'
                      ? 'bg-orbit-primary/20 text-orbit-primary-light border-orbit-primary'
                      : 'bg-orbit-surface2 text-[var(--text-muted)] border-orbit-border'
                      }`}
                  >
                    按直播间覆盖
                  </button>
                </div>
                {overrideForm.targetType === 'anchor' ? (
                  <select
                    value={overrideForm.targetId}
                    onChange={(e) => {
                      const id = e.target.value
                      const target = anchors.find((a) => `anchor:${a.id}` === id)
                      setOverrideForm((prev) => ({
                        ...prev,
                        targetId: id,
                        targetName: target ? `${target.name} (${target.level || 'S'}级)` : '指定对象',
                      }))
                    }}
                    className="w-full text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                  >
                    {anchors.map((a) => (
                      <option key={a.id} value={`anchor:${a.id}`}>
                        {a.name} ({a.level || 'A'}级) - ID: anchor:{a.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={overrideForm.targetId}
                    onChange={(e) => {
                      const id = e.target.value
                      const target = rooms.find((r) => `room:${r.id}` === id)
                      setOverrideForm((prev) => ({
                        ...prev,
                        targetId: id,
                        targetName: target ? target.name || `直播间 ${target.id}` : '直播间',
                      }))
                    }}
                    className="w-full text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={`room:${r.id}`}>
                        {r.name || `直播间 ${r.id}`} - ID: room:{r.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">协议专属底薪 (元/月)</label>
                <input
                  type="number"
                  step="1000"
                  value={overrideForm.baseSalary}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, baseSalary: Number(e.target.value) }))}
                  className="w-full text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 font-mono text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">专属提成模式</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideForm((prev) => ({ ...prev, commissionMode: 'flat' }))}
                    className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${overrideForm.commissionMode === 'flat'
                      ? 'bg-orbit-primary/20 text-orbit-primary-light border-orbit-primary'
                      : 'bg-orbit-surface2 text-[var(--text-muted)] border-orbit-border'
                      }`}
                  >
                    单一固定比例 (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideForm((prev) => ({ ...prev, commissionMode: 'tiered' }))}
                    className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${overrideForm.commissionMode === 'tiered'
                      ? 'bg-orbit-primary/20 text-orbit-primary-light border-orbit-primary'
                      : 'bg-orbit-surface2 text-[var(--text-muted)] border-orbit-border'
                      }`}
                  >
                    专属多阶梯累进制
                  </button>
                </div>
              </div>

              {overrideForm.commissionMode === 'flat' ? (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">净 GMV 提成比例 (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={overrideForm.flatRate}
                    onChange={(e) => setOverrideForm((prev) => ({ ...prev, flatRate: Number(e.target.value) }))}
                    className="w-full text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 font-mono font-bold text-orbit-primary-light outline-none focus:border-orbit-primary"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">适用于大主播单一包干比例，如净成交 GMV 直接提 8.5%</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--text-muted)]">专属阶梯设置</label>
                    <button
                      type="button"
                      onClick={() =>
                        setOverrideForm((prev) => ({
                          ...prev,
                          tiers: [...prev.tiers, { max_gmv: 200, rate: 8.0 }],
                        }))
                      }
                      className="text-[11px] text-orbit-primary-light hover:text-orbit-accent flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> 加一级
                    </button>
                  </div>
                  {overrideForm.tiers.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-orbit-surface2 p-2 rounded-lg border border-orbit-border">
                      <span className="text-[11px] text-[var(--text-muted)]">上限:</span>
                      <input
                        type="number"
                        value={t.max_gmv >= 99999 ? '' : t.max_gmv}
                        placeholder="以上"
                        onChange={(e) => {
                          const v = e.target.value === '' ? 999999 : Number(e.target.value)
                          setOverrideForm((prev) => ({
                            ...prev,
                            tiers: prev.tiers.map((st, i) => (i === idx ? { ...st, max_gmv: v } : st)),
                          }))
                        }}
                        className="w-20 text-xs bg-orbit-surface border border-orbit-border rounded px-1.5 py-1 text-[var(--text-secondary)] font-mono"
                      />
                      <span className="text-[11px] text-[var(--text-muted)]">万元，比例:</span>
                      <input
                        type="number"
                        step="0.5"
                        value={t.rate}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setOverrideForm((prev) => ({
                            ...prev,
                            tiers: prev.tiers.map((st, i) => (i === idx ? { ...st, rate: v } : st)),
                          }))
                        }}
                        className="w-16 text-xs bg-orbit-surface border border-orbit-border rounded px-1.5 py-1 text-orbit-primary-light font-mono font-bold"
                      />
                      <span className="text-[11px] text-[var(--text-muted)]">%</span>
                      {overrideForm.tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setOverrideForm((prev) => ({
                              ...prev,
                              tiers: prev.tiers.filter((_, i) => i !== idx),
                            }))
                          }
                          className="text-[var(--text-muted)] hover:text-rose-400 text-xs ml-auto"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">对赌协议说明 / 签署批号</label>
                <textarea
                  rows={2}
                  value={overrideForm.note}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="如：2026年年度S级特约合伙人对赌协议..."
                  className="w-full text-xs bg-orbit-surface2 border border-orbit-border rounded-lg p-2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowOverrideModal(false)}>
                取消
              </Button>
              <Button variant="primary" disabled={saving} onClick={handleSaveOverride}>
                {saving ? '保存中…' : '确认创建专属覆盖'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
