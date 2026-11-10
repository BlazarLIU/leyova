import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'
type StatusFilter = 'all' | 'pending' | 'resolved'

interface AlertItem {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  time: string
  status: 'pending' | 'resolved'
}

interface AlertRule {
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

  // Events State
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [timeFilter, setTimeFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  // Rules State
  const [rules, setRules] = useState<AlertRule[]>([])
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)

  // Rule Form State
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

  useEffect(() => {
    fetchAlertEvents()
    fetchRules()
  }, [severityFilter, statusFilter, timeFilter])

  const fetchAlertEvents = () => {
    api
      .get<any>('/api/system/alerts', {
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        period: timeFilter !== '全部' ? timeFilter : undefined,
      })
      .then((res) => {
        if (res.alerts) setAlerts(res.alerts)
      })
      .catch(() => {})
  }

  const fetchRules = () => {
    api
      .get<AlertRule[]>('/api/v1/alerts/rules')
      .then((res) => {
        if (Array.isArray(res)) {
          setRules(res)
        }
      })
      .catch(() => {})
  }

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
      fetchRules()
    } catch (err: any) {
      alert(err.message || '创建规则失败')
    }
  }

  const handleDeleteRule = async (id: number) => {
    if (!confirm('确定删除该预警规则？')) return
    try {
      await api.delete(`/api/v1/alerts/rules/${id}`)
      fetchRules()
    } catch (err: any) {
      alert(err.message || '删除失败')
    }
  }

  const handleToggleRuleStatus = async (rule: AlertRule) => {
    try {
      await api.put(`/api/v1/alerts/rules/${rule.id}`, {
        isActive: !rule.isActive,
      })
      fetchRules()
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

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px] text-gray-100">
      {/* 顶部标题与 Tab 切换 */}
      <motion.div {...fadeIn} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            {alerts.length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500/30 text-rose-300 rounded-full text-[10px]">
                {alerts.length}
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
              {rules.length}
            </span>
          </button>
        </div>
      </motion.div>

      {/* Tab 1: 告警事件动态 */}
      {activeTab === 'events' && (
        <motion.div {...fadeIn} className="space-y-6">
          {/* 筛选条 */}
          <div className="flex flex-wrap items-center gap-3 bg-gray-900/60 p-3 rounded-xl border border-gray-800/80 text-xs">
            <span className="text-gray-400">严重级别：</span>
            <div className="flex gap-1">
              {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    severityFilter === s ? 'bg-rose-600 text-white font-medium' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {s === 'all' ? '全部' : s === 'critical' ? '严重' : s === 'warning' ? '警告' : '提示'}
                </button>
              ))}
            </div>

            <span className="text-gray-400 ml-4">处理状态：</span>
            <div className="flex gap-1">
              {(['all', 'pending', 'resolved'] as StatusFilter[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    statusFilter === st ? 'bg-rose-600 text-white font-medium' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {st === 'all' ? '全部' : st === 'pending' ? '待处理' : '已解决'}
                </button>
              ))}
            </div>

            <span className="text-gray-400 ml-4">时间周期：</span>
            <div className="flex gap-1">
              {['全部', '近1小时', '近24小时', '近7天'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    timeFilter === t ? 'bg-rose-600 text-white font-medium' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 告警列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-900/60 border border-gray-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-gray-700 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={severityBadgeMap[item.severity] || 'warning'}>
                          {item.severity === 'critical' ? '严重' : item.severity === 'warning' ? '警告' : '提示'}
                        </Badge>
                        <h3 className="font-semibold text-sm text-gray-200">{item.title}</h3>
                      </div>
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.time}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between text-xs">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        item.status === 'resolved' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {item.status === 'resolved' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> 已处置解决
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" /> 待运营处置
                        </>
                      )}
                    </span>
                    <button className="text-gray-400 hover:text-white transition-colors">
                      查看现场数据 →
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center text-gray-500 bg-gray-900/30 rounded-xl border border-gray-800/40">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                当前没有未处理的告警事件，各直播间与货架运转正常
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab 2: 自定义指标规则与 Webhook 配置 */}
      {activeTab === 'rules' && (
        <motion.div {...fadeIn} className="space-y-6">
          <div className="flex items-center justify-between bg-gray-900/60 p-4 rounded-xl border border-gray-800/80">
            <div>
              <h2 className="text-sm font-semibold text-gray-200">自动预警触发规则</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                当直播间/货架经营数据突破设定阈值时，自动记录告警事件并向指定群机器人推送通知
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsRuleModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              新建指标告警规则
            </Button>
          </div>

          {testResult && (
            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-700/50 text-indigo-300 text-xs flex items-center justify-between">
              <span>{testResult}</span>
              <button onClick={() => setTestResult(null)} className="text-indigo-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* 规则表格卡片 */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-200">生效中的预警规则</h3>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800 font-medium">
                    <tr>
                      <th className="py-3 px-4">规则名称</th>
                      <th className="py-3 px-4">监控指标</th>
                      <th className="py-3 px-4">触发条件与阈值</th>
                      <th className="py-3 px-4">级别</th>
                      <th className="py-3 px-4">推送通道 (Webhook)</th>
                      <th className="py-3 px-4">状态</th>
                      <th className="py-3 px-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {rules.length > 0 ? (
                      rules.map((rule) => {
                        const metricInfo = METRICS_OPTIONS.find((m) => m.code === rule.metricCode)
                        const channel = rule.notifyChannels?.[0]

                        return (
                          <tr key={rule.id} className="hover:bg-gray-800/30 transition-colors">
                            <td className="py-3.5 px-4 font-medium text-gray-200">
                              {rule.ruleName}
                            </td>
                            <td className="py-3.5 px-4 text-gray-300">
                              {metricInfo?.name || rule.metricCode}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                {rule.condition === 'gt' ? '大于' : '小于'} {rule.threshold}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge variant={severityBadgeMap[rule.severity] || 'warning'}>
                                {rule.severity}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4">
                              {channel ? (
                                <span className="inline-flex items-center gap-1 text-gray-300">
                                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                  {channel.type === 'feishu'
                                    ? '飞书群机器人'
                                    : channel.type === 'dingtalk'
                                    ? '钉钉群机器人'
                                    : '企业微信群'}
                                </span>
                              ) : (
                                <span className="text-gray-500">仅站内通知</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => handleToggleRuleStatus(rule)}
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                                  rule.isActive
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-gray-800 text-gray-500 border border-gray-700'
                                }`}
                              >
                                {rule.isActive ? '运行中' : '已停用'}
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
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
                                className="text-xs text-rose-400 hover:text-rose-300 inline-flex items-center gap-0.5 ml-2"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500">
                          暂无自定义告警规则，请点击右上角新建规则
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>
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
                  ✕
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
