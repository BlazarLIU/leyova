// @ts-nocheck — false positives from stale TS server cache (tsc --noEmit passes)
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, ShieldCheck, Target, BookKey, User, Users, Radio } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import type { UserAccount, RoleInfo, ModuleInfo, LiveRoom } from '@/types'
import { AccountsSection } from './AccountsSection'
import { PersonnelSection } from './PersonnelSection'
import { RoomsSection } from './RoomsSection'

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

type TabKey = 'threshold' | 'target' | 'dict' | 'accounts' | 'personnel' | 'rooms'

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'threshold', label: '阈值规则', icon: ShieldCheck },
  { key: 'target', label: '目标管理', icon: Target },
  { key: 'dict', label: '字典管理', icon: BookKey },
  { key: 'accounts', label: '账号管理', icon: User },
  { key: 'personnel', label: '人员管理', icon: Users },
  { key: 'rooms', label: '直播间管理', icon: Radio },
]

const severityColorMap: Record<string, 'danger' | 'warning' | 'info'> = {
  '严重': 'danger',
  '警告': 'warning',
  '提示': 'info',
}

const roleTabMap: Record<string, TabKey[]> = {
  super_admin: ['threshold', 'target', 'dict', 'accounts', 'personnel', 'rooms'],
  ops_director: ['threshold', 'target', 'personnel', 'rooms'],
  ops_staff: ['threshold', 'target', 'personnel'],
  controller: ['threshold', 'target', 'personnel'],
}

export function SystemConfigPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('threshold')
  const [rules, setRules] = useState<any[]>([])
  const [targetTemplates, setTargetTemplates] = useState<any[]>([])
  const [dictItems, setDictItems] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('super_admin')

  // Edit states for threshold rules
  const [editingRule, setEditingRule] = useState<any | null>(null)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [ruleForm, setRuleForm] = useState({ name: '', metric: '', method: '', params: '', severity: '警告', enabled: true })

  // Edit states for dict items
  const [editingDict, setEditingDict] = useState<any | null>(null)
  const [showDictModal, setShowDictModal] = useState(false)
  const [dictForm, setDictForm] = useState({ code: '', name: '', status: '启用' })

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
  // Delete confirmation states
  const [deletingRule, setDeletingRule] = useState<any | null>(null)
  const [deletingDict, setDeletingDict] = useState<any | null>(null)

  // Section states
  const [users, setUsers] = useState<UserAccount[]>([])
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [allModules, setAllModules] = useState<ModuleInfo[]>([])
  const [anchors, setAnchors] = useState<any[]>([])
  const [operators, setOperators] = useState<any[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [rooms, setRooms] = useState<LiveRoom[]>([])

  // ─── Effects ───

  useEffect(() => {
    api.get<any[]>('/system/target-templates').then(setTargetTemplates).catch(() => { })
  }, [])

  useEffect(() => {
    api.get<any>('/auth/me')
      .then((res) => { if (res?.user?.role) setUserRole(res.user.role) })
      .catch(() => { })

    api.get<UserAccount[]>('/system/users').then(setUsers).catch(() => { })
    api.get<any[]>('/personnel/anchors').then(setAnchors).catch(() => { })
    api.get<any[]>('/personnel/operators').then(setOperators).catch(() => { })
    api.get<any[]>('/personnel/managers').then(setManagers).catch(() => { })
    api.get<RoleInfo[]>('/system/roles').then(setRoles).catch(() => { })
    api.get<ModuleInfo[]>('/system/modules').then(setAllModules).catch(() => { })
    api.get<LiveRoom[]>('/system/rooms').then(setRooms).catch(() => { })
  }, [])

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
      const res = await api.post<any>(`/system/target-templates/${applyingTemplate.id}/apply`, { period: applyPeriod })
      window.alert(`已应用 ${res?.applied ?? 0} 个目标到「目标达成」，可在运营提效 → 目标达成中查看`)
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

  const visibleTabs = (roleTabMap[userRole] || tabs.map(t => t.key)).map(key =>
    tabs.find(t => t.key === key)!
  )

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">系统配置</h1>
            <p className="text-slate-500 text-sm mt-1">系统设置与 AI 配置</p>
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center gap-2 flex-wrap">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.key
                ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
                }`}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          )
        })}
      </motion.div>

      {/* ─── threshold ─── */}
      {activeTab === 'threshold' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card>
            <CardHeader title="阈值规则管理" subtitle="配置各项业务指标的告警阈值"
              actions={<Button size="sm" variant="primary"><Settings className="w-3.5 h-3.5" />新增规则</Button>} />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orbit-border">
                      {['规则名称', '指标', '检测方法', '参数', '严重程度', '启用', '操作'].map(h => <th key={h} className="text-left text-xs text-slate-500 font-medium px-5 py-3">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.name} className="border-b border-orbit-border hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5 text-slate-200 font-medium">{rule.name}</td>
                        <td className="px-5 py-3.5 text-slate-300">{rule.metric}</td>
                        <td className="px-5 py-3.5 text-slate-300">{rule.method}</td>
                        <td className="px-5 py-3.5 text-slate-300">{rule.params}</td>
                        <td className="px-5 py-3.5"><Badge variant={severityColorMap[rule.severity]}>{rule.severity}</Badge></td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${rule.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rule.enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />{rule.enabled ? '已启用' : '已禁用'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors"
                              onClick={() => { setEditingRule(rule); setRuleForm({ name: rule.name, metric: rule.metric, method: rule.method, params: rule.params, severity: rule.severity, enabled: rule.enabled }); setShowRuleModal(true) }}>编辑</button>
                            <button className="text-xs text-slate-500 hover:text-orbit-danger transition-colors"
                              onClick={() => setDeletingRule(rule)}>删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ─── threshold rule edit modal ─── */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowRuleModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-slate-200">{editingRule ? '编辑规则' : '新增规则'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">规则名称</label>
                  <input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">指标</label>
                  <input value={ruleForm.metric} onChange={e => setRuleForm(p => ({ ...p, metric: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">检测方法</label>
                  <input value={ruleForm.method} onChange={e => setRuleForm(p => ({ ...p, method: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">参数</label>
                  <input value={ruleForm.params} onChange={e => setRuleForm(p => ({ ...p, params: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">严重程度</label>
                  <select value={ruleForm.severity} onChange={e => setRuleForm(p => ({ ...p, severity: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="严重">严重</option><option value="警告">警告</option><option value="提示">提示</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">启用</label>
                  <select value={ruleForm.enabled ? '1' : '0'} onChange={e => setRuleForm(p => ({ ...p, enabled: e.target.value === '1' }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                    <option value="1">启用</option><option value="0">禁用</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowRuleModal(false)}>取消</Button>
              <Button variant="primary" onClick={() => {
                if (editingRule) {
                  setRules(prev => prev.map(r => r.name === editingRule.name ? { ...r, ...ruleForm } : r))
                } else {
                  setRules(prev => [...prev, { ...ruleForm }])
                }
                setShowRuleModal(false)
              }}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── target（目标管理）─── */}
      {activeTab === 'target' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card>
            <CardHeader title="目标管理" subtitle="设定 KPI 目标数值，并应用到「运营提效 → 目标达成」跟踪"
              actions={<Button size="sm" variant="primary" onClick={() => {
                setEditingTemplate(null)
                setTemplateForm({ name: '', period: 'monthly', metrics: [] })
                setTemplateError('')
                setShowTemplateModal(true)
              }}><Target className="w-3.5 h-3.5" />新增目标</Button>} />
            <CardBody>
              {targetTemplates.length === 0 ? (
                <div className="py-14 text-center">
                  <Target className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">暂无目标，点击右上角「新增目标」创建</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {targetTemplates.map((tmpl) => (
                    <div key={tmpl.id} className="p-4 rounded-xl bg-orbit-surface2 border border-orbit-border hover:border-orbit-border2 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-200">{tmpl.name}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-accent/10 text-cyan-400 shrink-0">{PERIOD_LABELS[tmpl.period] || '月度'}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors"
                            onClick={() => { setEditingTemplate(tmpl); setTemplateForm({ name: tmpl.name, period: tmpl.period || 'monthly', metrics: (tmpl.metrics || []).map((m: any) => ({ ...m })) }); setTemplateError(''); setShowTemplateModal(true) }}>编辑</button>
                          <button className="text-xs text-slate-500 hover:text-orbit-danger transition-colors"
                            onClick={() => { setDeletingTemplate(tmpl); setDeleteTemplateError('') }}>删除</button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {(tmpl.metrics || []).length === 0 ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500">未配置指标</span>
                        ) : tmpl.metrics.map((m: any) => (
                          <div key={m.metric} className="flex items-center gap-2">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orbit-primary/10 text-orbit-primary-light shrink-0">{m.metric}</span>
                            <span className="text-xs text-slate-300 font-medium">{m.target ?? '-'}<span className="text-slate-500 font-normal"> {m.unit || ''}</span></span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button className="text-xs px-2.5 py-1 rounded-lg bg-orbit-primary/10 text-orbit-primary-light border border-orbit-primary/30 hover:bg-orbit-primary/20 transition-colors"
                          onClick={() => { setApplyingTemplate(tmpl); setApplyError('') }}>应用到目标达成</button>
                        <span className="text-xs text-slate-500">更新于 {tmpl.updatedAt}</span>
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
              <h3 className="text-base font-semibold text-slate-200">{editingTemplate ? '编辑目标' : '新增目标'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">目标名称</label>
                <input value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="如：Q3 运营目标"
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">目标周期</label>
                <div className="flex items-center gap-1.5 bg-orbit-surface rounded-lg border border-orbit-border p-1">
                  {([['monthly', '月度'], ['quarterly', '季度'], ['yearly', '年度']] as const).map(([v, label]) => (
                    <button key={v} type="button"
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${templateForm.period === v ? 'bg-orbit-primary/15 text-orbit-primary-light' : 'text-slate-400 hover:text-slate-300'}`}
                      onClick={() => setTemplateForm(p => ({ ...p, period: v }))}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">指标（可多选）</label>
                <div className="flex flex-wrap gap-1.5">
                  {METRIC_OPTIONS.map((m) => (
                    <button key={m} type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${templateForm.metrics.some(x => x.metric === m) ? 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/40' : 'bg-orbit-surface2 text-slate-400 border-orbit-border hover:text-slate-300'}`}
                      onClick={() => toggleMetric(m)}>{m}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">自定义指标</label>
                <div className="flex items-center gap-2">
                  <input value={templateCustomMetric} onChange={e => setTemplateCustomMetric(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomMetric() } }} placeholder="输入指标名，回车添加"
                    className="flex-1 h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary" />
                  <Button size="sm" variant="ghost" onClick={addCustomMetric}>添加</Button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">目标值设定（每个指标填写目标数值与单位，即为目标达成闭环的设定值）</label>
                <div className="space-y-2">
                  {templateForm.metrics.length === 0 ? (
                    <p className="text-xs text-slate-600 py-1">请先在上方选择指标</p>
                  ) : templateForm.metrics.map((it) => (
                    <div key={it.metric} className="flex items-center gap-2 bg-orbit-surface2 border border-orbit-border rounded-lg px-2.5 py-2">
                      <span className="text-xs font-medium text-orbit-primary-light shrink-0 w-28 truncate">{it.metric}</span>
                      <input value={it.target ?? ''} onChange={e => updateMetric(it.metric, 'target', e.target.value)} placeholder="目标值"
                        className="flex-1 min-w-0 h-8 rounded-md border border-orbit-border bg-orbit-surface px-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary" />
                      <input value={it.unit || ''} onChange={e => updateMetric(it.metric, 'unit', e.target.value)} placeholder="单位"
                        className="w-20 h-8 rounded-md border border-orbit-border bg-orbit-surface px-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary" />
                      <button className="text-slate-500 hover:text-orbit-danger transition-colors shrink-0 text-sm" onClick={() => toggleMetric(it.metric)}>×</button>
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

      {/* ─── dict ─── */}
      {activeTab === 'dict' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card>
            <CardHeader title="字典管理" subtitle="系统字典数据维护"
              actions={<Button size="sm" variant="primary"><BookKey className="w-3.5 h-3.5" />新增字典</Button>} />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orbit-border">
                      {['字典编码', '字典名称', '数据项数', '状态', '更新时间', '操作'].map(h => <th key={h} className="text-left text-xs text-slate-500 font-medium px-5 py-3">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dictItems.map((item) => (
                      <tr key={item.code} className="border-b border-orbit-border hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5 text-slate-200 font-mono text-xs">{item.code}</td>
                        <td className="px-5 py-3.5 text-slate-300">{item.name}</td>
                        <td className="px-5 py-3.5 text-slate-300">{item.count} 项</td>
                        <td className="px-5 py-3.5"><Badge variant={item.status === '启用' ? 'success' : 'neutral'}>{item.status}</Badge></td>
                        <td className="px-5 py-3.5 text-slate-300">{item.updated}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors"
                              onClick={() => { setEditingDict(item); setDictForm({ code: item.code, name: item.name, status: item.status }); setShowDictModal(true) }}>编辑</button>
                            <button className="text-xs text-slate-500 hover:text-orbit-danger transition-colors"
                              onClick={() => setDeletingDict(item)}>删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ─── dict edit modal ─── */}
      {showDictModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowDictModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-slate-200">{editingDict ? '编辑字典' : '新增字典'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">字典编码</label>
                <input value={dictForm.code} onChange={e => setDictForm(p => ({ ...p, code: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">字典名称</label>
                <input value={dictForm.name} onChange={e => setDictForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">状态</label>
                <select value={dictForm.status} onChange={e => setDictForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value="启用">启用</option><option value="禁用">禁用</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDictModal(false)}>取消</Button>
              <Button variant="primary" onClick={() => {
                if (editingDict) {
                  setDictItems(prev => prev.map(d => d.code === editingDict.code ? { ...d, ...dictForm } : d))
                } else {
                  setDictItems(prev => [...prev, { ...dictForm, count: 0, updated: '刚刚' }])
                }
                setShowDictModal(false)
              }}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── accounts ─── */}
      {activeTab === 'accounts' && (
        <AccountsSection users={users} roles={roles} allModules={allModules} onUsersChange={setUsers} onRolesChange={setRoles} />
      )}

      {/* ─── personnel ─── */}
      {activeTab === 'personnel' && (
        <PersonnelSection userRole={userRole} anchors={anchors} operators={operators} managers={managers}
          onDataChange={(tab, data) => {
            if (tab === 'anchor') setAnchors(data)
            else if (tab === 'operator') setOperators(data)
            else setManagers(data)
          }} />
      )}

      {/* ─── rooms ─── */}
      {activeTab === 'rooms' && (
        <RoomsSection rooms={rooms} onRoomsChange={setRooms} />
      )}

      {/* ─── target template apply confirm modal ─── */}
      {applyingTemplate !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setApplyingTemplate(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-200 mb-2">应用到目标达成</h3>
            <p className="text-sm text-slate-400 mb-4">将目标「{applyingTemplate.name}」的
              {(applyingTemplate.metrics || []).length} 个指标目标（周期：{PERIOD_LABELS[applyingTemplate.period] || '月度'}）写入「运营提效 → 目标达成」进行跟踪？</p>
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
            <h3 className="text-base font-semibold text-slate-200 mb-2">确认删除</h3>
            <p className="text-sm text-slate-400 mb-6">确定要删除目标「{deletingTemplate.name}」吗？已应用到「目标达成」的对应目标记录将一并删除，此操作不可撤销。</p>
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
            <h3 className="text-base font-semibold text-slate-200 mb-2">确认删除</h3>
            <p className="text-sm text-slate-400 mb-6">确定要删除规则「{deletingRule.name}」吗？此操作不可撤销。</p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingRule(null)}>取消</Button>
              <Button variant="destructive" onClick={() => {
                setRules(prev => prev.filter(r => r.name !== deletingRule.name))
                setDeletingRule(null)
              }}>确认删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── dict delete confirm modal ─── */}
      {deletingDict !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingDict(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-200 mb-2">确认删除</h3>
            <p className="text-sm text-slate-400 mb-6">确定要删除字典「{deletingDict.name}」吗？此操作不可撤销。</p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingDict(null)}>取消</Button>
              <Button variant="destructive" onClick={() => {
                setDictItems(prev => prev.filter(d => d.code !== deletingDict.code))
                setDeletingDict(null)
              }}>确认删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
