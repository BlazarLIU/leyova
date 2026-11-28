import { useState, useEffect, type ComponentType } from 'react'
import { motion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import { Settings, ShieldCheck, Target, User, Globe, Radio, Sliders, ArrowRight, Bot, Plus, Brain, Check, X } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { ModuleParametersSection } from './ModuleParametersSection'
import { AiModelsConfigSection } from './AiModelsConfigSection'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

// 目标周期文案
const PERIOD_LABELS: Record<string, string> = { monthly: '月度', quarterly: '季度', yearly: '年度' }

// 目标模板可选的业务指标
const METRIC_OPTIONS = [
  'GMV', '场均GMV', '平均UV价值', '互动率', '关注转化率',
  '下单转化率', '成交转化率', '平均GPM', '商品点击率',
  '平均停留时长', '场均订单数', '人气峰值',
]

const CONDITION_LABELS: Record<string, string> = {
  gt: '大于 (>)',
  lt: '小于 (<)',
  eq: '等于 (=)',
}

type TabKey = 'module_params' | 'threshold' | 'target' | 'ai' | 'memory'

const tabs: { key: TabKey; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'module_params', label: '模块参数', icon: Sliders },
  { key: 'threshold', label: '阈值规则', icon: ShieldCheck },
  { key: 'target', label: '目标管理', icon: Target },
  { key: 'ai', label: 'AI 模型', icon: Bot },
  { key: 'memory', label: '记忆审核', icon: Brain },
]

const severityColorMap: Record<string, 'danger' | 'warning' | 'info'> = {
  '严重': 'danger',
  '警告': 'warning',
  '提示': 'info',
}

const MEMORY_ROLE_OPTIONS = [
  { key: 'ops_director', label: '运营主管' },
  { key: 'ops_staff', label: '运营专员' },
  { key: 'controller', label: '中控/场控' },
  { key: 'ad_buyer', label: '投手' },
]

const roleTabMap: Record<string, TabKey[]> = {
  super_admin: ['module_params', 'threshold', 'target', 'ai', 'memory'],
  ops_director: ['module_params', 'threshold', 'target'],
  ops_staff: ['module_params', 'threshold', 'target'],
  controller: ['module_params', 'threshold', 'target'],
  ad_buyer: ['module_params', 'threshold', 'target'],
  hrbp: ['module_params', 'threshold', 'target'],
}

export function SystemConfigPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as TabKey | null
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam && tabs.some((t) => t.key === tabParam) ? tabParam : 'module_params'
  )
  const [rules, setRules] = useState<any[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [ruleError, setRuleError] = useState('')
  const [ruleSaving, setRuleSaving] = useState(false)
  const [targetTemplates, setTargetTemplates] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>(user?.role || 'super_admin')

  useEffect(() => {
    if (tabParam && tabs.some((t) => t.key === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [tabParam, activeTab])

  // 记忆审核（超管）：角色记忆先进审核，组织术语人工策展后直接生效
  const [memoryItems, setMemoryItems] = useState<any[]>([])
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [memoryMessage, setMemoryMessage] = useState('')
  const [memorySaving, setMemorySaving] = useState(false)
  const [reviewingId, setReviewingId] = useState('')
  const [memoryForm, setMemoryForm] = useState({
    scope: 'role', roleKey: 'ops_staff', memoryKey: '', content: '',
  })

  // Edit states for threshold rules
  const [editingRule, setEditingRule] = useState<any | null>(null)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [ruleForm, setRuleForm] = useState({
    ruleName: '',
    metricCode: 'refund_rate',
    condition: 'gt',
    threshold: '15',
    severity: '警告',
    isActive: true,
  })
  const [deletingRule, setDeletingRule] = useState<any | null>(null)

  // Edit states for target templates
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', period: 'monthly' as 'monthly' | 'quarterly' | 'yearly', metrics: [] as any[] })
  const [templateCustomMetric, setTemplateCustomMetric] = useState('')
  const [templateError, setTemplateError] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<any | null>(null)
  const [deleteTemplateError, setDeleteTemplateError] = useState('')
  const [applyingTemplate, setApplyingTemplate] = useState<any | null>(null)
  const [applyError, setApplyError] = useState('')

  useEffect(() => {
    if (user?.role) setUserRole(user.role)
  }, [user?.role])

  useEffect(() => {
    api.get<any[]>('/system/target-templates').then(setTargetTemplates).catch(() => { })
  }, [])

  useEffect(() => {
    api.get<any>('/auth/me')
      .then((res) => { if (res?.user?.role) setUserRole(res.user.role) })
      .catch(() => { })
  }, [])

  const loadRules = async () => {
    setRulesLoading(true)
    setRuleError('')
    try {
      const list = await api.get<any[]>('/alerts/rules')
      setRules(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setRuleError(e?.message || '加载阈值规则失败')
    } finally {
      setRulesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'threshold') return
    void loadRules()
  }, [activeTab])

  const openCreateRuleModal = () => {
    setEditingRule(null)
    setRuleError('')
    setRuleForm({
      ruleName: '',
      metricCode: 'refund_rate',
      condition: 'gt',
      threshold: '15',
      severity: '警告',
      isActive: true,
    })
    setShowRuleModal(true)
  }

  const handleSaveRule = async () => {
    const ruleName = ruleForm.ruleName.trim()
    const metricCode = ruleForm.metricCode.trim()
    const thresholdNum = Number(ruleForm.threshold)
    if (!ruleName || !metricCode) {
      setRuleError('规则名称和指标不能为空')
      return
    }
    if (Number.isNaN(thresholdNum)) {
      setRuleError('阈值必须是有效数字')
      return
    }
    setRuleSaving(true)
    setRuleError('')
    try {
      if (editingRule?.id) {
        await api.put(`/alerts/rules/${editingRule.id}`, {
          ruleName,
          condition: ruleForm.condition,
          threshold: thresholdNum,
          severity: ruleForm.severity,
          isActive: ruleForm.isActive,
        })
      } else {
        await api.post('/alerts/rules', {
          ruleName,
          metricCode,
          condition: ruleForm.condition,
          threshold: thresholdNum,
          severity: ruleForm.severity,
          isActive: ruleForm.isActive,
        })
      }
      await loadRules()
      setShowRuleModal(false)
    } catch (e: any) {
      setRuleError(e?.message || '保存阈值规则失败')
    } finally {
      setRuleSaving(false)
    }
  }

  const handleDeleteRule = async () => {
    if (!deletingRule?.id) return
    setRuleSaving(true)
    setRuleError('')
    try {
      await api.delete(`/alerts/rules/${deletingRule.id}`)
      setRules(prev => prev.filter(r => r.id !== deletingRule.id))
      setDeletingRule(null)
    } catch (e: any) {
      setRuleError(e?.message || '删除阈值规则失败')
    } finally {
      setRuleSaving(false)
    }
  }

  // 记忆审核队列：进入页签即加载待确认的角色/组织记忆
  useEffect(() => {
    if (activeTab !== 'memory') return
    let cancelled = false
    setMemoryLoading(true)
    setMemoryMessage('')
    api.get<any>('/assistant/memories/review')
      .then((res) => {
        if (cancelled) return
        setMemoryItems(Array.isArray(res?.items) ? res.items : [])
      })
      .catch(() => {
        if (!cancelled) setMemoryMessage('加载记忆审核队列失败')
      })
      .finally(() => {
        if (!cancelled) setMemoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab])

  const reloadMemories = async () => {
    const res = await api.get<any>('/assistant/memories/review').catch(() => null)
    if (res) setMemoryItems(Array.isArray(res?.items) ? res.items : [])
  }

  const handleReviewMemory = async (memoryId: string, action: 'approve' | 'reject') => {
    if (reviewingId) return
    setReviewingId(memoryId)
    setMemoryMessage('')
    try {
      await api.post(`/assistant/memories/review/${memoryId}`, { action })
      setMemoryItems((prev) => prev.filter((m) => m.id !== memoryId))
      setMemoryMessage(action === 'approve' ? '已通过，下一次 Run 即可生效' : '已驳回，保留审计记录')
    } catch (err: any) {
      setMemoryMessage(err?.message || '审核失败')
    } finally {
      setReviewingId('')
    }
  }

  const handleCreateMemory = async () => {
    if (memorySaving) return
    const content = memoryForm.content.trim()
    if (content.length < 4) {
      setMemoryMessage('记忆内容至少 4 个字')
      return
    }
    if (memoryForm.scope === 'role' && !memoryForm.roleKey) {
      setMemoryMessage('请选择角色')
      return
    }
    setMemorySaving(true)
    setMemoryMessage('')
    try {
      const res = await api.post<any>('/assistant/memories/admin', {
        scope: memoryForm.scope,
        roleKey: memoryForm.scope === 'role' ? memoryForm.roleKey : undefined,
        memoryKey: memoryForm.memoryKey.trim() || undefined,
        content,
      })
      setMemoryForm((f) => ({ ...f, memoryKey: '', content: '' }))
      setMemoryMessage(
        res?.status === 'pending' ? '已提交角色记忆，等待审核确认' : '组织术语已保存并立即生效'
      )
      await reloadMemories()
    } catch (err: any) {
      setMemoryMessage(err?.message || '写入记忆失败')
    } finally {
      setMemorySaving(false)
    }
  }

  const metricDefaultUnit = (m: string) => {
    const map: Record<string, string> = {
      'GMV': '万元', '场均GMV': '万元', '平均UV价值': '元', '互动率': '%',
      '关注转化率': '%', '下单转化率': '%', '成交转化率': '%', '平均GPM': '元',
      '商品点击率': '%', '平均停留时长': '分钟', '场均订单数': '单', '人气峰值': '人',
    }
    return map[m] || '%'
  }

  const toggleMetric = (m: string) => {
    setTemplateForm(p => ({
      ...p,
      metrics: p.metrics.some(x => x.metric === m)
        ? p.metrics.filter(x => x.metric !== m)
        : [...p.metrics, { metric: m, target: undefined, unit: metricDefaultUnit(m) }],
    }))
  }

  const addCustomMetric = () => {
    const m = templateCustomMetric.trim()
    if (!m || templateForm.metrics.some(x => x.metric === m)) return
    setTemplateForm(p => ({ ...p, metrics: [...p.metrics, { metric: m, target: undefined, unit: '%' }] }))
    setTemplateCustomMetric('')
  }

  const updateMetric = (m: string, key: 'target' | 'unit', value: string) => {
    setTemplateForm(p => ({
      ...p,
      metrics: p.metrics.map(x => (x.metric === m ? { ...x, [key]: value } : x)),
    }))
  }

  const handleApplyTemplate = async () => {
    if (!applyingTemplate) return
    setTemplateSaving(true)
    setApplyError('')
    try {
      const res = await api.post<any>(`/system/target-templates/${applyingTemplate.id}/apply`, {
        period: applyingTemplate.period || 'monthly',
      })
      window.alert(`已应用 ${res?.applied ?? 0} 个目标到目标达成追踪表`)
      setApplyingTemplate(null)
    } catch (e: any) {
      setApplyError(e?.message || '应用到目标达成失败')
    } finally {
      setTemplateSaving(false)
    }
  }

  const handleSaveTemplate = async () => {
    const name = templateForm.name.trim()
    if (!name) { setTemplateError('请输入目标名称'); return }
    const items = templateForm.metrics.filter((it: any) => it?.metric)
    if (items.length === 0) { setTemplateError('请至少选择一个指标'); return }
    if (items.some((it: any) => it.target == null || it.target === '')) { setTemplateError('请为每个指标填写目标值'); return }
    setTemplateSaving(true)
    setTemplateError('')
    try {
      if (editingTemplate) {
        await api.put(`/system/target-templates/${editingTemplate.id}`, { name, period: templateForm.period, metrics: templateForm.metrics })
      } else {
        await api.post('/system/target-templates', { name, period: templateForm.period, metrics: templateForm.metrics })
      }
      const list = await api.get<any[]>('/system/target-templates')
      setTargetTemplates(list)
      setShowTemplateModal(false)
    } catch (e: any) {
      setTemplateError(e?.message || '保存失败，请重试')
    } finally {
      setTemplateSaving(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return
    setTemplateSaving(true)
    setDeleteTemplateError('')
    try {
      await api.delete(`/system/target-templates/${deletingTemplate.id}`)
      setTargetTemplates(prev => prev.filter(t => t.id !== deletingTemplate.id))
      setDeletingTemplate(null)
    } catch (e: any) {
      setDeleteTemplateError(e?.message || '删除失败，请重试')
    } finally {
      setTemplateSaving(false)
    }
  }

  const visibleTabs = (roleTabMap[userRole] || ['module_params', 'threshold', 'target'])
    .map(key => tabs.find(t => t.key === key))
    .filter((tab): tab is (typeof tabs)[number] => Boolean(tab))

  const currentTab = visibleTabs.some(t => t.key === activeTab) ? activeTab : (visibleTabs[0]?.key || 'module_params')

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">系统配置与 AI</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">业务模块参数、指标阈值规则、目标模板与大模型/记忆中心</p>
          </div>
        </div>
      </motion.div>

      {/* 快捷导航：主数据独立管理入口 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link
          to="/system/users"
          className="flex items-center justify-between p-3.5 bg-orbit-surface/70 hover:bg-orbit-surface2 border border-orbit-border/80 rounded-xl transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orbit-primary/10 text-orbit-primary flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] group-hover:text-orbit-primary transition-colors">
                账号与权限中心
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">统一维护系统操作员、登录口令与数据权限</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-orbit-primary transition-colors" />
        </Link>

        <Link
          to="/system/platforms"
          className="flex items-center justify-between p-3.5 bg-orbit-surface/70 hover:bg-orbit-surface2 border border-orbit-border/80 rounded-xl transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orbit-primary/10 text-orbit-primary flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] group-hover:text-orbit-primary transition-colors">
                平台与渠道管理
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">抖音、快手、视频号三平台开关与授权状态</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-orbit-primary transition-colors" />
        </Link>

        <Link
          to="/system/rooms"
          className="flex items-center justify-between p-3.5 bg-orbit-surface/70 hover:bg-orbit-surface2 border border-orbit-border/80 rounded-xl transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orbit-success/10 text-status-success flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] group-hover:text-status-success transition-colors">
                直播间与机位
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">自建与多平台直播间物理档案与绑定状态</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-status-success transition-colors" />
        </Link>
      </div>

      {/* Tab bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center gap-2 flex-wrap">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                setSearchParams(tab.key === 'module_params' ? {} : { tab: tab.key }, { replace: true })
              }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${currentTab === tab.key
                ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
                }`}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          )
        })}
      </motion.div>

      {/* ─── threshold ─── */}
      {currentTab === 'threshold' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card>
            <CardHeader title="阈值规则管理" subtitle="配置各项业务指标的告警阈值（接入后端告警规则引擎）"
              actions={<Button size="sm" variant="primary" onClick={openCreateRuleModal}><Settings className="w-3.5 h-3.5" />新增规则</Button>} />
            <CardBody className="px-0">
              {ruleError && <p className="px-5 pb-3 text-xs text-orbit-danger">{ruleError}</p>}
              {rulesLoading ? (
                <p className="px-5 py-8 text-sm text-[var(--text-muted)]">加载阈值规则中…</p>
              ) : rules.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">暂无阈值告警规则，点击右上角「新增规则」添加</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-orbit-border">
                        {['规则名称', '指标', '触发条件', '阈值', '严重程度', '启用', '操作'].map(h => <th key={h} className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id} className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors">
                          <td className="px-5 py-3.5 text-[var(--text-secondary)] font-medium">{rule.ruleName}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-secondary)]">{rule.metricCode}</td>
                          <td className="px-5 py-3.5 text-[var(--text-secondary)]">{CONDITION_LABELS[rule.condition] || rule.condition}</td>
                          <td className="px-5 py-3.5 font-mono text-[var(--text-secondary)]">{rule.threshold}</td>
                          <td className="px-5 py-3.5"><Badge variant={severityColorMap[rule.severity] || 'warning'}>{rule.severity}</Badge></td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${rule.isActive ? 'bg-orbit-success/10 text-status-success' : 'bg-[var(--surface3)] text-[var(--text-muted)]'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${rule.isActive ? 'bg-orbit-success' : 'bg-[var(--text-subtle)]'}`} />{rule.isActive ? '已启用' : '已禁用'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors"
                                onClick={() => {
                                  setEditingRule(rule)
                                  setRuleError('')
                                  setRuleForm({
                                    ruleName: rule.ruleName || '',
                                    metricCode: rule.metricCode || '',
                                    condition: rule.condition || 'gt',
                                    threshold: String(rule.threshold ?? ''),
                                    severity: rule.severity || '警告',
                                    isActive: Boolean(rule.isActive),
                                  })
                                  setShowRuleModal(true)
                                }}>编辑</button>
                              <button className="text-xs text-[var(--text-muted)] hover:text-orbit-danger transition-colors"
                                onClick={() => { setRuleError(''); setDeletingRule(rule) }}>删除</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ─── threshold rule edit modal ─── */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowRuleModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-[var(--text-secondary)]">{editingRule ? '编辑规则' : '新增规则'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">规则名称</label>
                  <input value={ruleForm.ruleName} onChange={e => setRuleForm(p => ({ ...p, ruleName: e.target.value }))}
                    placeholder="如：全店退款率超标告警"
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">指标代码</label>
                  <input value={ruleForm.metricCode} onChange={e => setRuleForm(p => ({ ...p, metricCode: e.target.value }))}
                    disabled={Boolean(editingRule)}
                    placeholder="refund_rate / session_gmv"
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 disabled:opacity-60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">触发条件</label>
                  <select value={ruleForm.condition} onChange={e => setRuleForm(p => ({ ...p, condition: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="gt">大于 (&gt;)</option>
                    <option value="lt">小于 (&lt;)</option>
                    <option value="eq">等于 (=)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">阈值数值</label>
                  <input type="number" step="any" value={ruleForm.threshold} onChange={e => setRuleForm(p => ({ ...p, threshold: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">严重程度</label>
                  <select value={ruleForm.severity} onChange={e => setRuleForm(p => ({ ...p, severity: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="严重">严重</option><option value="警告">警告</option><option value="提示">提示</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">启用</label>
                  <select value={ruleForm.isActive ? '1' : '0'} onChange={e => setRuleForm(p => ({ ...p, isActive: e.target.value === '1' }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="1">启用</option><option value="0">禁用</option>
                  </select>
                </div>
              </div>
              {ruleError && <p className="text-xs text-orbit-danger">{ruleError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowRuleModal(false)}>取消</Button>
              <Button variant="primary" disabled={ruleSaving} onClick={handleSaveRule}>{ruleSaving ? '保存中…' : '保存'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── target（目标管理）─── */}
      {currentTab === 'target' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card>
            <CardHeader title="目标管理" subtitle="设定 KPI 目标数值与季度模板"
              actions={<Button size="sm" variant="primary" onClick={() => {
                setEditingTemplate(null)
                setTemplateForm({ name: '', period: 'monthly', metrics: [] })
                setTemplateError('')
                setShowTemplateModal(true)
              }}><Target className="w-3.5 h-3.5" />新增目标</Button>} />
            <CardBody>
              {targetTemplates.length === 0 ? (
                <div className="py-14 text-center">
                  <Target className="w-10 h-10 mx-auto text-[var(--text-primary)] mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">暂无目标，点击右上角「新增目标」创建</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {targetTemplates.map((tmpl) => (
                    <div key={tmpl.id} className="p-4 rounded-xl bg-orbit-surface2 border border-orbit-border hover:border-orbit-border2 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-[var(--text-secondary)]">{tmpl.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-accent/10 text-status-ai shrink-0">{PERIOD_LABELS[tmpl.period] || '月度'}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors"
                            onClick={() => { setEditingTemplate(tmpl); setTemplateForm({ name: tmpl.name, period: tmpl.period || 'monthly', metrics: (tmpl.metrics || []).map((m: any) => ({ ...m })) }); setTemplateError(''); setShowTemplateModal(true) }}>编辑</button>
                          <button className="text-xs text-[var(--text-muted)] hover:text-orbit-danger transition-colors"
                            onClick={() => { setDeletingTemplate(tmpl); setDeleteTemplateError('') }}>删除</button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {(tmpl.metrics || []).length === 0 ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface3)] text-[var(--text-muted)]">未配置指标</span>
                        ) : tmpl.metrics.map((m: any) => (
                          <div key={m.metric} className="flex items-center gap-2">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orbit-primary/10 text-orbit-primary-light shrink-0">{m.metric}</span>
                            <span className="text-xs text-[var(--text-secondary)] font-medium">{m.target ?? '-'}<span className="text-[var(--text-muted)] font-normal"> {m.unit || ''}</span></span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button className="text-xs px-2.5 py-1 rounded-lg bg-orbit-primary/10 text-orbit-primary-light border border-orbit-primary/30 hover:bg-orbit-primary/20 transition-colors"
                          onClick={() => { setApplyingTemplate(tmpl); setApplyError('') }}>应用到目标达成</button>
                        <span className="text-xs text-[var(--text-muted)]">更新于 {tmpl.updatedAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ─── target template edit modal ─── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-[var(--text-secondary)]">{editingTemplate ? '编辑目标' : '新增目标'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">目标名称</label>
                <input value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="如：Q3 运营目标"
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">目标周期</label>
                <div className="flex items-center gap-1.5 bg-orbit-surface rounded-lg border border-orbit-border p-1">
                  {([['monthly', '月度'], ['quarterly', '季度'], ['yearly', '年度']] as const).map(([v, label]) => (
                    <button key={v} type="button"
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${templateForm.period === v ? 'bg-orbit-primary/15 text-orbit-primary-light' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      onClick={() => setTemplateForm(p => ({ ...p, period: v }))}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">指标（可多选）</label>
                <div className="flex flex-wrap gap-1.5">
                  {METRIC_OPTIONS.map((m) => (
                    <button key={m} type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${templateForm.metrics.some(x => x.metric === m) ? 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/40' : 'bg-orbit-surface2 text-[var(--text-muted)] border-orbit-border hover:text-[var(--text-primary)]'}`}
                      onClick={() => toggleMetric(m)}>{m}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">自定义指标</label>
                <div className="flex items-center gap-2">
                  <input value={templateCustomMetric} onChange={e => setTemplateCustomMetric(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomMetric() } }} placeholder="输入指标名，回车添加"
                    className="flex-1 h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary" />
                  <Button size="sm" variant="ghost" onClick={addCustomMetric}>添加</Button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">目标值设定（每个指标填写目标数值与单位）</label>
                <div className="space-y-2">
                  {templateForm.metrics.length === 0 ? (
                    <p className="text-xs text-[var(--text-primary)] py-1">请先在上方选择指标</p>
                  ) : templateForm.metrics.map((it) => (
                    <div key={it.metric} className="flex items-center gap-2 bg-orbit-surface2 border border-orbit-border rounded-lg px-2.5 py-2">
                      <span className="text-xs font-medium text-orbit-primary-light shrink-0 w-28 truncate">{it.metric}</span>
                      <input value={it.target ?? ''} onChange={e => updateMetric(it.metric, 'target', e.target.value)} placeholder="目标值"
                        className="flex-1 min-w-0 h-8 rounded-md border border-orbit-border bg-orbit-surface px-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary" />
                      <input value={it.unit || ''} onChange={e => updateMetric(it.metric, 'unit', e.target.value)} placeholder="单位"
                        className="w-20 h-8 rounded-md border border-orbit-border bg-orbit-surface px-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary" />
                      <button className="text-[var(--text-muted)] hover:text-orbit-danger transition-colors shrink-0 text-sm" onClick={() => toggleMetric(it.metric)}>×</button>
                    </div>
                  ))}
                </div>
              </div>
              {templateError && <p className="text-xs text-orbit-danger">{templateError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>取消</Button>
              <Button variant="primary" disabled={templateSaving} onClick={handleSaveTemplate}>{templateSaving ? '保存中…' : '保存'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ai（AI 模型统一配置）─── */}
      {currentTab === 'ai' && <AiModelsConfigSection />}

      {/* ─── memory（记忆审核）─── */}
      {currentTab === 'memory' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="记忆审核队列"
                subtitle="角色记忆需审核后生效；组织术语人工策展后直接生效。个人与会话记忆仅本人可见，不在此展示。"
              />
              <CardBody className="space-y-2">
                {memoryLoading ? (
                  <p className="text-sm text-[var(--text-muted)]">加载中…</p>
                ) : memoryItems.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">暂无待处理记忆</p>
                ) : (
                  memoryItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant={item.scope === 'org' ? 'info' : 'neutral'}>
                          {item.scope === 'org' ? '组织术语' : '角色记忆'}
                        </Badge>
                        <Badge variant={item.status === 'pending' ? 'warning' : 'success'}>
                          {item.status === 'pending' ? '待审核' : '已生效'}
                        </Badge>
                        {item.role_key && (
                          <span className="font-mono text-[var(--text-muted)]">{item.role_key}</span>
                        )}
                        <span className="font-mono text-[var(--text-muted)]">{item.memory_key}</span>
                        {item.status === 'pending' && (
                          <div className="ml-auto flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={reviewingId === item.id}
                              onClick={() => handleReviewMemory(item.id, 'approve')}
                            >
                              <Check className="w-3.5 h-3.5" /> 通过
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reviewingId === item.id}
                              onClick={() => handleReviewMemory(item.id, 'reject')}
                            >
                              <X className="w-3.5 h-3.5" /> 驳回
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-[var(--text-secondary)] break-words">{item.content}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        来源 {item.source_type || '未知'}
                        {item.source_id ? ` · ${item.source_id}` : ''}
                      </p>
                    </div>
                  ))
                )}
                {memoryMessage && (
                  <p className={`text-sm ${memoryMessage.includes('失败') || memoryMessage.includes('至少') ? 'text-status-danger' : 'text-status-success'}`}>
                    {memoryMessage}
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="新增策展记忆"
                subtitle="用于沉淀角色术语或组织口径；数字与经营事实仍以工具取数与事实层为准，不写入记忆。"
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">记忆范围</label>
                    <select
                      value={memoryForm.scope}
                      onChange={(e) => setMemoryForm((f) => ({ ...f, scope: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-orbit-ink border border-orbit-border text-sm text-[var(--text-primary)] focus:outline-none focus:border-status-ai"
                    >
                      <option value="role">角色记忆（需审核）</option>
                      <option value="org">组织术语（直接生效）</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">角色</label>
                    <select
                      value={memoryForm.roleKey}
                      disabled={memoryForm.scope === 'org'}
                      onChange={(e) => setMemoryForm((f) => ({ ...f, roleKey: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-orbit-ink border border-orbit-border text-sm text-[var(--text-primary)] focus:outline-none focus:border-status-ai disabled:opacity-50"
                    >
                      {MEMORY_ROLE_OPTIONS.map((role) => (
                        <option key={role.key} value={role.key}>{role.label}（{role.key}）</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Memory Key（可选）</label>
                    <input
                      value={memoryForm.memoryKey}
                      onChange={(e) => setMemoryForm((f) => ({ ...f, memoryKey: e.target.value }))}
                      placeholder="如 term:gmv"
                      className="w-full px-3 py-2 rounded-lg bg-orbit-ink border border-orbit-border text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-status-ai"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">记忆内容</label>
                  <textarea
                    value={memoryForm.content}
                    onChange={(e) => setMemoryForm((f) => ({ ...f, content: e.target.value }))}
                    rows={3}
                    placeholder="如：本店 GMV 口径为支付成功订单金额，不含退款。"
                    className="w-full px-3 py-2 rounded-lg bg-orbit-ink border border-orbit-border text-sm text-[var(--text-primary)] focus:outline-none focus:border-status-ai resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" disabled={memorySaving} onClick={handleCreateMemory}>
                    <Plus className="w-3.5 h-3.5" /> {memorySaving ? '保存中…' : '保存记忆'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ─── module_params（模块参数）─── */}
      {currentTab === 'module_params' && (
        <ModuleParametersSection userRole={userRole} />
      )}

      {/* ─── target template apply confirm modal ─── */}
      {applyingTemplate !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setApplyingTemplate(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-2">应用到目标达成</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">将目标「{applyingTemplate.name}」的
              {(applyingTemplate.metrics || []).length} 个指标目标（周期：{PERIOD_LABELS[applyingTemplate.period] || '月度'}）写入目标追踪表？</p>
            {applyError && <p className="text-xs text-orbit-danger mb-4">{applyError}</p>}
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setApplyingTemplate(null)}>取消</Button>
              <Button variant="primary" disabled={templateSaving} onClick={handleApplyTemplate}>{templateSaving ? '应用中…' : '确认应用'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── target template delete confirm modal ─── */}
      {deletingTemplate !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingTemplate(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-2">确认删除</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">确定要删除目标「{deletingTemplate.name}」吗？此操作不可撤销。</p>
            {deleteTemplateError && <p className="text-xs text-orbit-danger mb-4">{deleteTemplateError}</p>}
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingTemplate(null)}>取消</Button>
              <Button variant="destructive" disabled={templateSaving} onClick={handleDeleteTemplate}>{templateSaving ? '删除中…' : '确认删除'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── rule delete confirm modal ─── */}
      {deletingRule !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingRule(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-2">确认删除</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">确定要删除规则「{deletingRule.ruleName}」吗？此操作不可撤销。</p>
            {ruleError && <p className="text-xs text-orbit-danger mb-4">{ruleError}</p>}
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingRule(null)}>取消</Button>
              <Button variant="destructive" disabled={ruleSaving} onClick={handleDeleteRule}>{ruleSaving ? '删除中…' : '确认删除'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
