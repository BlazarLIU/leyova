import { useState, useEffect, type ComponentType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarCheck,
  Package,
  ShieldAlert,
  Save,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Target,
  Radio,
  BarChart4,
  Layers,
  Cpu,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useModuleParams, type ModuleParamItem } from '@/hooks/useModuleParams'

interface Props {
  userRole: string
}

type ModuleKey =
  | 'schedule'
  | 'goal_alerts'
  | 'session_reg'
  | 'review_funnel'
  | 'omnichannel_traffic'
  | 'assortment_products'
  | 'compliance'
  | 'system_infra'

interface ModuleTabMeta {
  key: ModuleKey
  name: string
  icon: ComponentType<{ className?: string }>
  desc: string
  badge?: string
}

const MODULE_TABS: ModuleTabMeta[] = [
  { key: 'schedule', name: '1. 直播排班与现场调度', icon: CalendarCheck, desc: '连续开播疲劳熔断、单场标准工时、轮休间隔与夜班津贴', badge: '核心' },
  { key: 'goal_alerts', name: '2. 目标达成与异常中心', icon: Target, desc: '严重告警自动升级时效、闭环改进任务SLA时限、目标严重滞后偏差' },
  { key: 'session_reg', name: '3. 场次调度与直播登记', icon: Radio, desc: '开播未关自动完结超时、人工直播登记补录宽限期、对账容错率' },
  { key: 'review_funnel', name: '4. 直播复盘与转化闭环', icon: BarChart4, desc: '在线人数骤降报警比、曝光点击率CTR及格线、下单转化及格线、爆款单品集中度上限' },
  { key: 'omnichannel_traffic', name: '5. 多平台流量与全域投流', icon: Layers, desc: '抖音三池自然:搜索:商流调度比、快手间接成交归因天数、视频号私域进播占比' },
  { key: 'assortment_products', name: '6. 货盘排品与选品商品', icon: Package, desc: '标准排品结构引流:主推:高利配比、滞销库存周转天数红线、选品毛利率底线' },
  { key: 'compliance', name: '7. 合规风控雷达', icon: ShieldAlert, desc: '直播间违规停播扣分熔断阀、独家签约与竞业到期提前预警天数' },
  { key: 'system_infra', name: '8. 系统底层与运维队列', icon: Cpu, desc: '异步任务最大重试次数、全系统操作审计日志保存留存期' },
]

interface DefaultParamSpec {
  param_key: string
  param_name: string
  param_type: ModuleParamItem['param_type']
  param_value: string | number
  unit: string
  description: string
}

const DEFAULT_MODULE_PARAMS: Record<ModuleKey, DefaultParamSpec[]> = {
  schedule: [
    { param_key: 'max_consecutive_stream_hours', param_name: '连续开播疲劳熔断上限', param_type: 'number', param_value: 4, unit: '小时', description: '单名主播连续直播超过此时长触发排班预警' },
    { param_key: 'single_session_standard_hours', param_name: '单场标准播长', param_type: 'number', param_value: 3, unit: '小时', description: 'AI 智能排班推荐拆班基准时长' },
    { param_key: 'rest_interval_hours', param_name: '班次间最低轮休间隔', param_type: 'number', param_value: 12, unit: '小时', description: '同一主播相邻两场直播间隔保护线' },
    { param_key: 'night_shift_allowance', param_name: '夜班场次津贴标准', param_type: 'number', param_value: 100, unit: '元/场', description: '22:00 后开播或跨零点场次额外补贴' },
  ],
  goal_alerts: [
    { param_key: 'critical_alert_escalation_minutes', param_name: '严重告警自动升级时限', param_type: 'number', param_value: 30, unit: '分钟', description: '超期未认领的严重异常自动升级给运营主管' },
    { param_key: 'action_item_sla_hours', param_name: '决策改进任务 SLA 时限', param_type: 'number', param_value: 24, unit: '小时', description: '决策案落地动作项默认跟进期限' },
    { param_key: 'target_deviation_alert_rate', param_name: '目标严重滞后偏差阈值', param_type: 'percentage', param_value: 15, unit: '%', description: '实际达成低于阶段进度超过此比例标红' },
  ],
  session_reg: [
    { param_key: 'auto_complete_timeout_minutes', param_name: '开播未关播自动完结超时', param_type: 'number', param_value: 60, unit: '分钟', description: '场次状态停留在播超时无心跳后的兜底完结等待时间' },
    { param_key: 'manual_entry_grace_period_days', param_name: '人工登记补录宽限期', param_type: 'number', param_value: 3, unit: '天', description: '允许运营补录历史场次直播登记的最大回溯天数' },
    { param_key: 'reconciliation_tolerance_rate', param_name: '登记与平台核对容错率', param_type: 'percentage', param_value: 1, unit: '%', description: '人工填报 GMV 与平台回传数据差异预警线' },
  ],
  review_funnel: [
    { param_key: 'drop_off_alarm_ratio', param_name: '在线人数骤降报警比', param_type: 'percentage', param_value: 30, unit: '%', description: '5 分钟窗内场观流失超过该比例触发话术调整建议' },
    { param_key: 'ctr_pass_rate', param_name: '商品曝光点击率及格线', param_type: 'percentage', param_value: 8.5, unit: '%', description: '低于该值视为短视频或封面素材承接不足' },
    { param_key: 'conversion_pass_rate', param_name: '点击下单转化率及格线', param_type: 'percentage', param_value: 3.2, unit: '%', description: '低于该值触发讲解逼单与价格锚点复盘' },
    { param_key: 'hero_sku_concentration_cap', param_name: '爆款单品集中度上限', param_type: 'percentage', param_value: 40, unit: '%', description: '单品 GMV 占比超出时建议补充矩阵中腰部款分摊风险' },
  ],
  omnichannel_traffic: [
    { param_key: 'natural_search_ad_ratio', param_name: '抖音三池自然:搜索:商流目标比', param_type: 'string', param_value: '5:2:3', unit: '比例', description: '标准场次健康流量结构参考值' },
    { param_key: 'indirect_gmv_attribution_days', param_name: '快手间接成交归因窗口', param_type: 'number', param_value: 7, unit: '天', description: '直播种草后延后下单统计回溯天数' },
    { param_key: 'private_domain_entry_rate', param_name: '视频号私域进播占比目标', param_type: 'percentage', param_value: 25, unit: '%', description: '社群/企微预约引流进直播间占比基准' },
  ],
  assortment_products: [
    { param_key: 'traffic_main_profit_ratio', param_name: '排品引流:主推:高利标准配比', param_type: 'string', param_value: '3:5:2', unit: '比例', description: '场次货盘排品健康度结构建议' },
    { param_key: 'inventory_turnover_days_cap', param_name: '滞销库存周转天数红线', param_type: 'number', param_value: 45, unit: '天', description: '超过此周转天数触发清仓选品提示' },
    { param_key: 'minimum_gross_margin_rate', param_name: '选品毛利率底线', param_type: 'percentage', param_value: 20, unit: '%', description: '智能选品推荐与排品校验最低毛利率门槛' },
  ],
  compliance: [
    { param_key: 'stream_violation_fuse_score', param_name: '直播间违规停播扣分熔断阀', param_type: 'number', param_value: 10, unit: '分', description: '累计合规扣分达阈值触发场次紧急复核' },
    { param_key: 'contract_expiry_alert_days', param_name: '主播签约到期提前预警天数', param_type: 'number', param_value: 30, unit: '天', description: '提前提醒续约或档期调整' },
  ],
  system_infra: [
    { param_key: 'job_max_retry_times', param_name: '异步任务最大重试次数', param_type: 'number', param_value: 3, unit: '次', description: '定时同步/清洗作业失败退避重试上限' },
    { param_key: 'audit_log_retention_days', param_name: '操作审计日志保存留存期', param_type: 'number', param_value: 180, unit: '天', description: '系统审计日志最小保留天数' },
  ],
}

export function ModuleParametersSection({ userRole }: Props) {
  const isReadOnly = userRole !== 'super_admin'
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('schedule')

  const { params, updateParameters } = useModuleParams(selectedModule)

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [genericForm, setGenericForm] = useState<Record<string, any>>({})

  const effectiveParams: Array<Partial<ModuleParamItem> & DefaultParamSpec> = params.length > 0
    ? params.map((p) => ({
        ...p,
        unit: p.unit || '',
        description: p.description || '',
      }))
    : DEFAULT_MODULE_PARAMS[selectedModule]

  useEffect(() => {
    const form: Record<string, any> = {}
    for (const p of effectiveParams) {
      form[p.param_key] = p.param_value
    }
    setGenericForm(form)
  }, [params, selectedModule])

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text })
    setTimeout(() => setToastMsg(null), 3500)
  }

  const handleSaveGenericParams = async () => {
    if (isReadOnly) {
      showToast('error', '只有系统管理员具备参数保存权限')
      return
    }
    setSaving(true)
    try {
      const itemsToUpdate: Partial<ModuleParamItem>[] = []
      for (const p of effectiveParams) {
        if (genericForm[p.param_key] !== undefined) {
          const rawVal = genericForm[p.param_key]
          const normalizedVal =
            (p.param_type === 'number' || p.param_type === 'percentage') && rawVal !== ''
              ? Number(rawVal)
              : rawVal
          itemsToUpdate.push({
            module_code: selectedModule,
            param_key: p.param_key,
            param_name: p.param_name,
            param_type: p.param_type,
            scope_type: 'global',
            scope_id: 'default',
            param_value: normalizedVal,
            unit: p.unit,
            description: p.description,
          })
        }
      }
      await updateParameters(itemsToUpdate)
      showToast('success', `「${MODULE_TABS.find((t) => t.key === selectedModule)?.name}」参数已更新并生效`)
    } catch (e: any) {
      showToast('error', e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="space-y-6">
      {/* 顶部模块分类切换（对齐当前 7 大业务场景） */}
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
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-accent/15 text-status-ai font-bold">
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
            <strong>模块业务参数中心：</strong>已收敛至当前 7 大核心场景关联的 8 组参数配置，修改保存后立即同步给业务规则与 AI 分析上下文。
          </span>
        </div>
        {isReadOnly && (
          <Badge variant="warning" className="shrink-0">
            只读浏览模式
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
              ? 'bg-orbit-success/15 text-status-success border-orbit-success/30'
              : 'bg-orbit-danger/15 text-status-danger border-orbit-danger/30'
              }`}
          >
            {toastMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 参数维护卡片 */}
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
          {effectiveParams.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)] text-xs">暂无配置参数项</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {effectiveParams.map((p) => (
                <div key={p.param_key} className="p-4 rounded-xl bg-orbit-surface2/60 border border-orbit-border space-y-2">
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
                    {p.unit && <span className="text-xs text-[var(--text-muted)] font-mono w-14">{p.unit}</span>}
                  </div>
                  {p.description && <p className="text-[11px] text-[var(--text-muted)]">{p.description}</p>}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}
