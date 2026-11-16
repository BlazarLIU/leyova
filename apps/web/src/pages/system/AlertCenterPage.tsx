import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Bell,
  Sliders,
  Plus,
  Trash2,
  Send,
  Radio,
  ShieldAlert,
  RefreshCw,
  X,
  Activity,
  AlertCircle,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'

export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'
export type StatusFilter = 'all' | 'pending' | 'resolved'

export interface AlertItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  time: string
  status: 'pending' | 'resolved'
}

export interface AlertRule {
  id: number
  ruleName: string
  shopId?: number
  shopName?: string
  platformCode?: string
  platformName?: string
  metricCode: string
  condition: string
  threshold: number
  notifyChannels: Array<{
    type: 'feishu' | 'dingtalk' | 'wechat'
    webhookUrl: string
  }>
  isActive: boolean
  severity: string
  lastTriggeredAt?: string
  createdAt?: string
}

const severityBadgeMap: Record<string, 'danger' | 'warning' | 'info'> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
  '严重': 'danger',
  '警告': 'warning',
  '提示': 'info',
}

const METRICS_OPTIONS = [
  { code: 'gmv_drop_rate', name: '小时 GMV 环比暴跌率 (%)', defaultCondition: 'gt', defaultThreshold: 30 },
  { code: 'refund_rate', name: '整场退款率 (%)', defaultCondition: 'gt', defaultThreshold: 15 },
  { code: 'roi', name: '实时千川投流 ROI', defaultCondition: 'lt', defaultThreshold: 2.0 },
  { code: 'cost_exceed', name: '单日千川投流消耗超限 (元)', defaultCondition: 'gt', defaultThreshold: 50000 },
  { code: 'online_users_drop', name: '直播间在线人数骤降 (%)', defaultCondition: 'gt', defaultThreshold: 40 },
  { code: 'stay_duration', name: '人均停留时长偏低 (秒)', defaultCondition: 'lt', defaultThreshold: 45 },
]

export function AlertCenterPage() {
  const [activeTab, setActiveTab] = useState<'events' | 'rules'>('events')

  // Rule Form State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [ruleForm, setRuleForm] = useState({
    ruleName: '',
    metricCode: 'refund_rate',
    condition: 'gt',
    threshold: 15,
    severity: '警告',
    channelType: 'feishu' as 'feishu' | 'dingtalk' | 'wechat',
    webhookUrl: '',
    isActive: true,
  })

  // 1. Events Table via useTable
  const eventsTable = useTable<AlertItem, { severity: string; status: string; period: string }>({
    initialFilters: { severity: 'all', status: 'all', period: '全部' },
    initialPageSize: 20,
    fetchData: async ({ search, filters }) => {
      const res = await api.get<any>('/api/system/alerts', {
        severity: filters.severity !== 'all' ? filters.severity : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        period: filters.period !== '全部' ? filters.period : undefined,
      })

      const rawAlerts: AlertItem[] = Array.isArray(res?.alerts) ? res.alerts : []
      const filtered = rawAlerts.filter((item) => {
        if (!search) return true
        const q = search.toLowerCase()
        return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      })

      return {
        items: filtered,
        total: filtered.length,
      }
    },
  })

  // 2. Rules Table via useTable
  const rulesTable = useTable<AlertRule, { severity: string; isActive: string }>({
    initialFilters: { severity: 'all', isActive: 'all' },
    initialPageSize: 20,
    fetchData: async ({ search, filters }) => {
      const res = await api.get<AlertRule[]>('/api/v1/alerts/rules')
      const rawRules: AlertRule[] = Array.isArray(res) ? res : []

      const filtered = rawRules.filter((r) => {
        if (filters.severity !== 'all' && r.severity !== filters.severity) return false
        if (filters.isActive === 'active' && !r.isActive) return false
        if (filters.isActive === 'inactive' && r.isActive) return false
        if (!search) return true
        const q = search.toLowerCase()
        return r.ruleName.toLowerCase().includes(q) || r.metricCode.toLowerCase().includes(q)
      })

      return {
        items: filtered,
        total: filtered.length,
      }
    },
  })

  // Events Stats
  const eventsStats = useMemo(() => {
    const list = eventsTable.data
    const total = eventsTable.total
    const critical = list.filter((i) => i.severity === 'critical').length
    const pending = list.filter((i) => i.status === 'pending').length
    const resolved = list.filter((i) => i.status === 'resolved').length

    return { total, critical, pending, resolved }
  }, [eventsTable.data, eventsTable.total])

  // Rules Stats
  const rulesStats = useMemo(() => {
    const list = rulesTable.data
    const total = rulesTable.total
    const active = list.filter((r) => r.isActive).length
    const inactive = list.filter((r) => !r.isActive).length
    const webhooks = list.filter((r) => r.notifyChannels && r.notifyChannels.length > 0).length

    return { total, active, inactive, webhooks }
  }, [rulesTable.data, rulesTable.total])

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleForm.ruleName) {
      alert('请填写规则名称')
      return
    }

    try {
      await api.post('/api/v1/alerts/rules', {
        ruleName: ruleForm.ruleName,
        metricCode: ruleForm.metricCode,
        condition: ruleForm.condition,
        threshold: Number(ruleForm.threshold),
        severity: ruleForm.severity,
        notifyChannels: ruleForm.webhookUrl
          ? [{ type: ruleForm.channelType, webhookUrl: ruleForm.webhookUrl }]
          : [],
        isActive: ruleForm.isActive,
      })
      setIsRuleModalOpen(false)
      setRuleForm({
        ruleName: '',
        metricCode: 'refund_rate',
        condition: 'gt',
        threshold: 15,
        severity: '警告',
        channelType: 'feishu',
        webhookUrl: '',
        isActive: true,
      })
      await rulesTable.reload()
    } catch (err: any) {
      alert(err.message || '创建规则失败')
    }
  }

  const handleDeleteRule = async (id: number) => {
    if (!confirm('确定删除该预警规则？')) return
    try {
      await api.delete(`/api/v1/alerts/rules/${id}`)
      await rulesTable.reload()
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  const handleToggleRuleStatus = async (rule: AlertRule) => {
    try {
      await api.put(`/api/v1/alerts/rules/${rule.id}`, {
        isActive: !rule.isActive,
      })
      await rulesTable.reload()
    } catch (err: any) {
      alert(err.message || '操作失败')
    }
  }

  const handleTestWebhook = async (rule: AlertRule) => {
    const channel = rule.notifyChannels?.[0]
    if (!channel?.webhookUrl) {
      alert('该规则尚未配置 Webhook 机器人地址')
      return
    }
    setTestingId(rule.id)
    setTestResult(null)
    try {
      const res: any = await api.post('/api/v1/alerts/rules/test-webhook', {
        webhookUrl: channel.webhookUrl,
        channelType: channel.type,
        ruleName: rule.ruleName,
      })
      setTestResult(res?.message || '测试消息发送成功！')
    } catch (err: any) {
      setTestResult(`发送失败: ${err.message}`)
    } finally {
      setTestingId(null)
    }
  }

  // Events Table Columns
  const eventColumns: ColumnDef<AlertItem>[] = useMemo(
    () => [
      {
        key: 'severity',
        header: '严重级别',
        width: 100,
        align: 'center',
        render: (_, item) => (
          <Badge variant={severityBadgeMap[item.severity] || 'warning'}>
            {item.severity === 'critical' ? '严重' : item.severity === 'warning' ? '警告' : '提示'}
          </Badge>
        ),
      },
      {
        key: 'title',
        header: '告警事件与明细',
        render: (_, item) => (
          <div className="py-0.5">
            <div className="font-semibold text-slate-100 flex items-center gap-2">
              {item.title}
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>
          </div>
        ),
      },
      {
        key: 'time',
        header: '发生时间',
        width: 140,
        render: (_, item) => (
          <span className="text-xs text-slate-400 inline-flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {item.time}
          </span>
        ),
      },
      {
        key: 'status',
        header: '处置状态',
        width: 140,
        render: (_, item) => (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              item.status === 'resolved' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {item.status === 'resolved' ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> 已处置解决
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" /> 待运营处置
              </>
            )}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 120,
        align: 'right',
        render: () => (
          <button className="text-xs text-slate-400 hover:text-white transition-colors">
            查看现场数据 →
          </button>
        ),
      },
    ],
    []
  )

  // Rules Table Columns
  const ruleColumns: ColumnDef<AlertRule>[] = useMemo(
    () => [
      {
        key: 'ruleName',
        header: '规则名称',
        render: (_, rule) => (
          <span className="font-semibold text-slate-100">{rule.ruleName}</span>
        ),
      },
      {
        key: 'metricCode',
        header: '监控指标',
        render: (_, rule) => {
          const metricInfo = METRICS_OPTIONS.find((m) => m.code === rule.metricCode)
          return (
            <span className="text-slate-300 text-xs">
              {metricInfo?.name || rule.metricCode}
            </span>
          )
        },
      },
      {
        key: 'threshold',
        header: '触发条件与阈值',
        render: (_, rule) => (
          <span className="font-mono text-xs text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            {rule.condition === 'gt' ? '大于' : '小于'} {rule.threshold}
          </span>
        ),
      },
      {
        key: 'severity',
        header: '级别',
        width: 90,
        render: (_, rule) => (
          <Badge variant={severityBadgeMap[rule.severity] || 'warning'}>
            {rule.severity}
          </Badge>
        ),
      },
      {
        key: 'notifyChannels',
        header: '推送通道 (Webhook)',
        render: (_, rule) => {
          const channel = rule.notifyChannels?.[0]
          if (!channel) {
            return <span className="text-slate-500 text-xs">仅站内通知</span>
          }
          return (
            <span className="inline-flex items-center gap-1.5 text-slate-300 text-xs">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              {channel.type === 'feishu'
                ? '飞书群机器人'
                : channel.type === 'dingtalk'
                ? '钉钉群机器人'
                : '企业微信群'}
            </span>
          )
        },
      },
      {
        key: 'isActive',
        header: '状态',
        width: 100,
        render: (_, rule) => (
          <button
            onClick={() => handleToggleRuleStatus(rule)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
              rule.isActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            {rule.isActive ? '运行中' : '已停用'}
          </button>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 170,
        align: 'right',
        render: (_, rule) => {
          const channel = rule.notifyChannels?.[0]
          return (
            <div className="flex items-center justify-end gap-2">
              {channel && (
                <button
                  onClick={() => handleTestWebhook(rule)}
                  disabled={testingId === rule.id}
                  title="向 Webhook 发送一条模拟告警"
                  className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  {testingId === rule.id ? '推送中...' : '测试通知'}
                </button>
              )}
              <button
                onClick={() => handleDeleteRule(rule.id)}
                title="删除规则"
                className="text-xs text-rose-400 hover:text-rose-300 inline-flex items-center gap-0.5 ml-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        },
      },
    ],
    [testingId]
  )

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px] text-gray-100">
      {/* 顶部标题与 Tab 切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-rose-400" />
            指标预警与通知中心
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            全渠道核心经营指标实时监控、阈值异常自愈与飞书/钉钉群机器人极速推送
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-900/80 p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'events'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            告警事件动态
            {eventsTable.total > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500/30 text-rose-300 rounded-full text-[10px]">
                {eventsTable.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'rules'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            指标规则与 Webhook 配置
            <span className="px-1.5 py-0.2 bg-gray-800 text-gray-300 rounded-full text-[10px]">
              {rulesTable.total}
            </span>
          </button>
        </div>
      </div>

      {testResult && (
        <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-700/50 text-indigo-300 text-xs flex items-center justify-between">
          <span>{testResult}</span>
          <button onClick={() => setTestResult(null)} className="text-indigo-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab 1: 告警事件动态 */}
      {activeTab === 'events' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">告警事件总数</span>
                  <Activity className="w-4 h-4 text-rose-400" />
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-100">{eventsStats.total}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">当前监控周期捕获的异常记录</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">严重级别告警</span>
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                </div>
                <p className="mt-1 text-2xl font-bold text-rose-400">{eventsStats.critical}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">需立即介入的高风险指标突破</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">待运营处置</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <p className="mt-1 text-2xl font-bold text-amber-400">{eventsStats.pending}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">排队处置中的异常工单</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">已处置解决</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{eventsStats.resolved}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">已完成自愈或运营闭环</p>
              </CardBody>
            </Card>
          </div>

          <DataPage<AlertItem>
            title="告警事件动态流水"
            subtitle="实时捕获退款率暴跌、ROI离群与直播间流量波动异常，支持即时响应与处置追踪"
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-rose-400 border border-orbit-border">
                DataPage + useTable
              </span>
            }
            table={eventsTable}
            columns={eventColumns}
            searchPlaceholder="搜索告警标题、异常指标或描述..."
            exportFilename="alert_events"
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => eventsTable.reload()}
                loading={eventsTable.loading}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                刷新
              </Button>
            }
            filterControls={
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">严重级别:</span>
                  {(['all', 'critical', 'warning', 'info'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => eventsTable.setFilter('severity', s)}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        eventsTable.filters.severity === s
                          ? 'bg-rose-600 text-white font-medium'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {s === 'all' ? '全部' : s === 'critical' ? '严重' : s === 'warning' ? '警告' : '提示'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-gray-400">处置状态:</span>
                  {(['all', 'pending', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => eventsTable.setFilter('status', st)}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        eventsTable.filters.status === st
                          ? 'bg-rose-600 text-white font-medium'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {st === 'all' ? '全部' : st === 'pending' ? '待处理' : '已解决'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-gray-400">时间周期:</span>
                  <select
                    value={eventsTable.filters.period}
                    onChange={(e) => eventsTable.setFilter('period', e.target.value)}
                    className="h-7 px-2 text-xs rounded border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:border-rose-500"
                  >
                    {['全部', '近1小时', '近24小时', '近7天'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">监控规则总数</span>
                  <Sliders className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-100">{rulesStats.total}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">已注册的核心指标预警逻辑</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">运行中规则</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{rulesStats.active}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">实时对齐数据流守护中</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">已停用规则</span>
                  <Clock className="w-4 h-4 text-slate-500" />
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-400">{rulesStats.inactive}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">休眠或临时下线规则</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Webhook 机器人通道</span>
                  <Radio className="w-4 h-4 text-sky-400" />
                </div>
                <p className="mt-1 text-2xl font-bold text-sky-400">{rulesStats.webhooks}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">已挂接飞书/钉钉/企微自动化推送</p>
              </CardBody>
            </Card>
          </div>

          <DataPage<AlertRule>
            title="自动预警触发规则"
            subtitle="当直播间/货架经营数据突破设定阈值时，自动记录告警事件并向指定群机器人推送通知"
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-emerald-400 border border-orbit-border">
                DataPage + useTable
              </span>
            }
            table={rulesTable}
            columns={ruleColumns}
            searchPlaceholder="搜索规则名称或监控指标..."
            exportFilename="alert_rules"
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsRuleModalOpen(true)}
                  icon={<Plus className="w-4 h-4" />}
                >
                  新建指标告警规则
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rulesTable.reload()}
                  loading={rulesTable.loading}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  刷新
                </Button>
              </div>
            }
            filterControls={
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">告警级别:</span>
                  {['all', '提示', '警告', '严重'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => rulesTable.setFilter('severity', sev)}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        rulesTable.filters.severity === sev
                          ? 'bg-rose-600 text-white font-medium'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {sev === 'all' ? '全部' : sev}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-gray-400">运行状态:</span>
                  {[
                    { value: 'all', label: '全部' },
                    { value: 'active', label: '运行中' },
                    { value: 'inactive', label: '已停用' },
                  ].map((st) => (
                    <button
                      key={st.value}
                      onClick={() => rulesTable.setFilter('isActive', st.value)}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        rulesTable.filters.isActive === st.value
                          ? 'bg-rose-600 text-white font-medium'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            }
          />
        </div>
      )}

      {/* 新建规则弹窗 */}
      <AnimatePresence>
        {isRuleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-rose-400" />
                  新建指标预警与通知规则
                </h3>
                <button
                  onClick={() => setIsRuleModalOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-300 mb-1 font-medium">规则名称</label>
                  <input
                    type="text"
                    required
                    placeholder="例如：晚高峰直播间退款率飙升告警"
                    value={ruleForm.ruleName}
                    onChange={(e) => setRuleForm({ ...ruleForm, ruleName: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-medium">监控指标</label>
                  <select
                    value={ruleForm.metricCode}
                    onChange={(e) => {
                      const item = METRICS_OPTIONS.find((m) => m.code === e.target.value)
                      setRuleForm({
                        ...ruleForm,
                        metricCode: e.target.value,
                        condition: item?.defaultCondition || 'gt',
                        threshold: item?.defaultThreshold || 0,
                      })
                    }}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                  >
                    {METRICS_OPTIONS.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">触发条件</label>
                    <select
                      value={ruleForm.condition}
                      onChange={(e) => setRuleForm({ ...ruleForm, condition: e.target.value })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="gt">大于 (&gt;)</option>
                      <option value="lt">小于 (&lt;)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1 font-medium">阈值数值</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={ruleForm.threshold}
                      onChange={(e) => setRuleForm({ ...ruleForm, threshold: Number(e.target.value) })}
                      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-medium">告警级别</label>
                  <select
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="提示">提示 (普通监控)</option>
                    <option value="警告">警告 (需要关注)</option>
                    <option value="严重">严重 (需立即介入)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-gray-800">
                  <label className="block text-gray-300 mb-1 font-medium flex items-center justify-between">
                    <span>外部推送 Webhook 机器人 (可选)</span>
                    <span className="text-[11px] text-gray-500">支持飞书/钉钉/企微自定义机器人</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {(['feishu', 'dingtalk', 'wechat'] as const).map((ch) => (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => setRuleForm({ ...ruleForm, channelType: ch })}
                        className={`py-1.5 px-2 rounded-lg text-center font-medium border transition-all ${
                          ruleForm.channelType === ch
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        {ch === 'feishu' ? '飞书群' : ch === 'dingtalk' ? '钉钉群' : '企业微信'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="url"
                    placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                    value={ruleForm.webhookUrl}
                    onChange={(e) => setRuleForm({ ...ruleForm, webhookUrl: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRuleModalOpen(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    保存规则
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AlertCenterPage
