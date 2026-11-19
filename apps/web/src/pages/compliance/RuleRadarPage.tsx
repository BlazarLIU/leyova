import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  Plus,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { api } from '../../services/api'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { usePlatform } from '../../hooks/usePlatform'

interface RuleSnapshot {
  id: number
  platform_code: string
  platform_name: string
  external_id: string
  title: string
  category: string
  source_url: string
  published_at: string | null
  effective_at: string | null
  fetched_at: string
  fetch_method: string
  content_preview: string
}

interface RuleChange {
  id: number
  snapshot_id: number
  platform_code: string
  platform_name: string
  external_id: string
  change_type: 'new' | 'revised' | 'repealed'
  diff_summary: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  is_read: boolean
  read_at: string | null
  read_by_name: string | null
  rule_title: string
  rule_category: string
  source_url: string
  effective_at: string | null
  created_at: string
  risk_summary: string | null
}

interface ActivityReminder {
  id: number
  platform_code: string
  platform_name: string
  activity_name: string
  activity_type: string
  signup_deadline: string
  activity_start: string | null
  activity_end: string | null
  requirements: string
  status: 'pending' | 'reminded' | 'done' | 'expired'
}

export function RuleRadarPage() {
  const navigate = useNavigate()
  const { currentPlatform } = usePlatform()
  const [activeTab, setActiveTab] = useState<'changes' | 'rules' | 'reminders'>('changes')

  // Stats
  const [unreadCount, setUnreadCount] = useState(0)
  const [criticalUnreadCount, setCriticalUnreadCount] = useState(0)
  const [totalRules, setTotalRules] = useState(0)

  // Data
  const [changes, setChanges] = useState<RuleChange[]>([])
  const [rules, setRules] = useState<RuleSnapshot[]>([])
  const [reminders, setReminders] = useState<ActivityReminder[]>([])

  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState<string>(() => currentPlatform?.platform_code || 'all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Loading & Scanning states
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  // Manual entry modal
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualForm, setManualForm] = useState({
    platformCode: currentPlatform?.platform_code || 'douyin',
    externalId: '',
    title: '',
    category: '平台招商与营销',
    sourceUrl: '',
    effectiveAt: '',
    contentText: '',
    severity: 'medium' as 'critical' | 'high' | 'medium' | 'low',
    operationalImpact: '',
  })
  const [manualSubmitting, setManualSubmitting] = useState(false)

  // 监听顶栏平台切换，联动刷新
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      setSelectedPlatform(currentPlatform.platform_code)
      setManualForm((prev) => ({ ...prev, platformCode: currentPlatform.platform_code }))
    }
  }, [currentPlatform?.platform_code])

  // Fetch changes
  const fetchChanges = async () => {
    try {
      const params: Record<string, any> = { pageSize: 50 }
      if (selectedPlatform !== 'all') params.platformCode = selectedPlatform
      if (selectedSeverity !== 'all') params.severity = selectedSeverity
      if (unreadOnly) params.unreadOnly = 'true'

      const res = await api.get<{
        total: number
        unreadCount: number
        criticalUnreadCount: number
        items: RuleChange[]
      }>('/compliance/changes', params)

      setChanges(res.items || [])
      setUnreadCount(res.unreadCount || 0)
      setCriticalUnreadCount(res.criticalUnreadCount || 0)
    } catch (err) {
      console.error('Failed to load compliance changes:', err)
    }
  }

  // Fetch rules
  const fetchRules = async () => {
    try {
      const params: Record<string, any> = { pageSize: 50 }
      if (selectedPlatform !== 'all') params.platformCode = selectedPlatform
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await api.get<{
        total: number
        items: RuleSnapshot[]
      }>('/compliance/rules', params)

      setRules(res.items || [])
      setTotalRules(res.total || 0)
    } catch (err) {
      console.error('Failed to load rules:', err)
    }
  }

  // Fetch reminders
  const fetchReminders = async () => {
    try {
      const params: Record<string, any> = {}
      if (selectedPlatform !== 'all') params.platformCode = selectedPlatform
      const res = await api.get<ActivityReminder[]>('/compliance/reminders', params)
      setReminders(res || [])
    } catch (err) {
      console.error('Failed to load reminders:', err)
    }
  }

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([fetchChanges(), fetchRules(), fetchReminders()])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [selectedPlatform, selectedSeverity, unreadOnly])

  // Run on-demand scan
  const handleTriggerScan = async () => {
    setScanning(true)
    setScanMessage(null)
    try {
      const res = await api.post<{
        locked: boolean
        scannedCount: number
        newCount: number
        revisedCount: number
        durationMs: number
      }>('/compliance/scan', {})

      setScanMessage(
        `巡检完成（耗时 ${(res.durationMs / 1000).toFixed(1)}s）：扫描 ${res.scannedCount} 条规则，发现新规 ${res.newCount} 条，规则修订 ${res.revisedCount} 条。`
      )
      await loadAll()
    } catch (err: any) {
      setScanMessage(`巡检失败: ${err.message || '网络异常'}`)
    } finally {
      setScanning(false)
    }
  }

  // Acknowledge change
  const handleAckChange = async (id: number) => {
    try {
      await api.post(`/compliance/changes/${id}/ack`, {})
      setChanges((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_read: true, read_at: new Date().toISOString() } : c))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to ack change:', err)
    }
  }

  // Submit manual rule
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualForm.title.trim() || !manualForm.contentText.trim()) return

    setManualSubmitting(true)
    try {
      await api.post('/compliance/rules/manual', {
        platformCode: manualForm.platformCode,
        externalId: manualForm.externalId || `MANUAL-${Date.now()}`,
        title: manualForm.title.trim(),
        category: manualForm.category,
        sourceUrl: manualForm.sourceUrl.trim() || 'manual-entry',
        effectiveAt: manualForm.effectiveAt ? new Date(manualForm.effectiveAt).toISOString() : undefined,
        contentText: manualForm.contentText.trim(),
        severity: manualForm.severity,
        operationalImpact: manualForm.operationalImpact.trim() || undefined,
      })

      setShowManualModal(false)
      setManualForm({
        platformCode: currentPlatform?.platform_code || 'douyin',
        externalId: '',
        title: '',
        category: '平台招商与营销',
        sourceUrl: '',
        effectiveAt: '',
        contentText: '',
        severity: 'medium',
        operationalImpact: '',
      })
      await loadAll()
    } catch (err: any) {
      alert(`录入失败: ${err.message || '未知错误'}`)
    } finally {
      setManualSubmitting(false)
    }
  }

  const platforms = [
    { code: 'all', name: '全网平台' },
    { code: 'douyin', name: '抖音电商' },
    { code: 'kuaishou', name: '快手电商' },
    { code: 'wechat', name: '视频号小店' },
    { code: 'taobao', name: '淘宝集市' },
    { code: 'tmall', name: '天猫商城' },
    { code: 'xiaohongshu', name: '小红书' },
  ]

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="danger" dot>极高危阻断</Badge>
      case 'high':
        return <Badge variant="warning" dot>高危警示</Badge>
      case 'medium':
        return <Badge variant="info">中度合规</Badge>
      default:
        return <Badge variant="neutral">普通参考</Badge>
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-orbit-border/50 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orbit-primary/10 border border-orbit-primary/20 text-orbit-primary">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-orbit-text tracking-tight flex items-center gap-2">
                平台合规规则雷达
                <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-primary/20 text-orbit-primary font-mono">
                  3x Patrol / Day
                </span>
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                每日 3 次 (09:30 / 13:00 / 18:30) 自动化全网合规巡检，支持拼多多合规红线人工录入与 AI 选品话术注入
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            手工补录新规
          </Button>

          <Button
            variant="primary"
            onClick={handleTriggerScan}
            disabled={scanning}
            className="flex items-center gap-2 bg-gradient-to-r from-orbit-primary to-orbit-primary-dark hover:from-orbit-primary hover:to-orbit-primary-dark text-white shadow-lg shadow-violet-500/20"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? '正在巡检全网规则...' : '立即执行全网巡检'}
          </Button>
        </div>
      </div>

      {/* Scan Message Alert */}
      {scanMessage && (
        <div className="p-4 rounded-xl bg-orbit-primary/30 border border-orbit-primary/30 text-orbit-primary text-sm flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-orbit-primary flex-shrink-0" />
            <span>{scanMessage}</span>
          </div>
          <button
            onClick={() => setScanMessage(null)}
            className="text-xs text-orbit-primary hover:text-orbit-primary underline"
          >
            关闭
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-orbit-surface/80 border-orbit-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">规则快照总量</span>
            <Layers className="w-4 h-4 text-orbit-primary" />
          </div>
          <div className="text-2xl font-bold text-orbit-text mt-2">{totalRules || rules.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">覆盖 7 大主流电商平台规范</div>
        </Card>

        <Card className="p-5 bg-orbit-surface/80 border-orbit-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">未读合规变更</span>
            <AlertTriangle className="w-4 h-4 text-status-warning" />
          </div>
          <div className="text-2xl font-bold text-status-warning mt-2">{unreadCount}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">包含新发与修订差量事件</div>
        </Card>

        <Card className="p-5 bg-orbit-surface/80 border-orbit-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">高危/阻断级预警</span>
            <Shield className="w-4 h-4 text-status-danger" />
          </div>
          <div className="text-2xl font-bold text-status-danger mt-2">{criticalUnreadCount}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">涉及违禁词/限流/清退红线</div>
        </Card>

        <Card className="p-5 bg-orbit-surface/80 border-orbit-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">临近大促报名</span>
            <Calendar className="w-4 h-4 text-status-success" />
          </div>
          <div className="text-2xl font-bold text-status-success mt-2">{reminders.length}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">待申报活动与规则节点</div>
        </Card>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-orbit-border pb-3">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'changes'
                ? 'bg-orbit-primary text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-orbit-text hover:bg-orbit-surface'
            }`}
          >
            合规变更流 ({changes.length})
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'rules'
                ? 'bg-orbit-primary text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-orbit-text hover:bg-orbit-surface'
            }`}
          >
            各平台规则库 ({rules.length})
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'reminders'
                ? 'bg-orbit-primary text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-orbit-text hover:bg-orbit-surface'
            }`}
          >
            大促活动提醒 ({reminders.length})
          </button>
        </div>

        {/* Global Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Platform select */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-orbit-surface border border-orbit-border text-orbit-text focus:outline-none focus:ring-1 focus:ring-orbit-primary/40"
          >
            {platforms.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>

          {activeTab === 'changes' && (
            <>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg bg-orbit-surface border border-orbit-border text-orbit-text focus:outline-none focus:ring-1 focus:ring-orbit-primary/40"
              >
                <option value="all">全风险等级</option>
                <option value="critical">极高危 (Critical)</option>
                <option value="high">高危 (High)</option>
                <option value="medium">中度 (Medium)</option>
                <option value="low">低度 (Low)</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="rounded border-orbit-border text-orbit-primary focus:ring-orbit-primary bg-orbit-surface"
                />
                仅看未读
              </label>
            </>
          )}

          {activeTab === 'rules' && (
            <div className="relative">
              <input
                type="text"
                placeholder="搜索规则标题或条款..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchRules()}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-orbit-surface border border-orbit-border text-orbit-text placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-1 focus:ring-orbit-primary/40 w-48"
              />
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="py-20 text-center text-[var(--text-muted)] flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-orbit-primary" />
          <span>正在加载合规雷达数据...</span>
        </div>
      ) : (
        <>
          {/* Tab 1: Changes Stream */}
          {activeTab === 'changes' && (
            <div className="space-y-4">
              {changes.length === 0 ? (
                <div className="py-16 text-center text-[var(--text-muted)] bg-orbit-surface/30 rounded-xl border border-orbit-border">
                  暂无匹配的合规规则变更记录
                </div>
              ) : (
                changes.map((item) => (
                  <div
                    key={item.id}
                    className={`p-5 rounded-xl border transition-all ${
                      item.is_read
                        ? 'bg-orbit-surface/40 border-orbit-border/60 opacity-80 hover:opacity-100'
                        : 'bg-orbit-surface border-orbit-primary/40 shadow-sm shadow-violet-900/10'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orbit-primary/15 text-orbit-primary">
                          {item.platform_name || item.platform_code}
                        </span>
                        {getSeverityBadge(item.severity)}
                        <span className="text-xs px-2 py-0.5 rounded bg-orbit-surface2 text-[var(--text-secondary)] font-mono">
                          {item.change_type === 'new' ? '全新发布' : item.change_type === 'revised' ? '规则修订' : '废止'}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(item.created_at).toLocaleString('zh-CN')}
                        </span>
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-orbit-danger animate-pulse" title="未读变更" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!item.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAckChange(item.id)}
                            className="text-xs text-[var(--text-muted)] hover:text-status-success"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            标记已读
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/compliance/changes/${item.id}`)}
                          className="text-xs flex items-center gap-1 bg-orbit-primary hover:bg-orbit-primary-dark text-white"
                        >
                          AI 风险评估详情
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <h3 className="text-base font-semibold text-orbit-text flex items-center gap-2">
                        {item.rule_title}
                        {item.source_url && item.source_url.startsWith('http') && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--text-muted)] hover:text-orbit-primary inline-flex items-center"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">{item.diff_summary}</p>
                    </div>

                    {item.risk_summary && (
                      <div className="mt-3 p-3 rounded-lg bg-orbit-primary/20 border border-orbit-primary/20 text-xs text-orbit-primary flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-orbit-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-orbit-primary">AI 预警摘要：</strong>
                          {item.risk_summary}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Rules Library */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules.map((rule) => (
                  <Card key={rule.id} className="p-5 bg-orbit-surface border-orbit-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orbit-primary/15 text-orbit-primary">
                        {rule.platform_name || rule.platform_code}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        抓取方式: {rule.fetch_method}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-orbit-text">{rule.title}</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">编号: {rule.external_id} | 类别: {rule.category}</p>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] bg-orbit-surface2/50 p-2.5 rounded-lg border border-orbit-border/40 line-clamp-3">
                      {rule.content_preview}...
                    </p>

                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
                      <span>生效时间: {rule.effective_at ? new Date(rule.effective_at).toLocaleDateString('zh-CN') : '即时'}</span>
                      {rule.source_url && rule.source_url.startsWith('http') && (
                        <a
                          href={rule.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orbit-primary hover:text-orbit-primary flex items-center gap-1"
                        >
                          平台原文
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Reminders */}
          {activeTab === 'reminders' && (
            <div className="space-y-4">
              {reminders.map((rem) => {
                const deadline = new Date(rem.signup_deadline)
                const now = new Date()
                const daysDiff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 3600 * 24))

                return (
                  <div
                    key={rem.id}
                    className="p-5 rounded-xl bg-orbit-surface border border-orbit-border flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orbit-primary/15 text-orbit-primary">
                          {rem.platform_name || rem.platform_code}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-orbit-success/15 text-status-success">
                          {rem.activity_type}
                        </span>
                        <h4 className="text-sm font-bold text-orbit-text">{rem.activity_name}</h4>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">{rem.requirements || '无特殊准入门槛要求'}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)]">报名截止倒计时</div>
                        <div className={`text-base font-bold ${daysDiff <= 3 ? 'text-status-danger' : 'text-status-success'}`}>
                          {daysDiff > 0 ? `剩余 ${daysDiff} 天` : '已截止'}
                        </div>
                      </div>
                      <Badge variant={rem.status === 'done' ? 'success' : 'warning'}>
                        {rem.status === 'done' ? '已申报' : '待组织申报'}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-orbit-border pb-3">
              <h3 className="text-lg font-bold text-orbit-text flex items-center gap-2">
                <Plus className="w-5 h-5 text-orbit-primary" />
                手工补录平台合规新规（合规红线零爬虫兜底）
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">平台选择</label>
                  <select
                    value={manualForm.platformCode}
                    onChange={(e) => setManualForm({ ...manualForm, platformCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                  >
                    <option value="pdd">拼多多 (PDD 登录墙规则人工录入)</option>
                    <option value="douyin">抖音电商</option>
                    <option value="taobao">淘宝集市</option>
                    <option value="tmall">天猫商城</option>
                    <option value="jd">京东</option>
                    <option value="kuaishou">快手电商</option>
                    <option value="xiaohongshu">小红书</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">风险级别判定</label>
                  <select
                    value={manualForm.severity}
                    onChange={(e) => setManualForm({ ...manualForm, severity: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                  >
                    <option value="critical">极高危 (阻断/扣分/封店)</option>
                    <option value="high">高危 (限流/下架/罚金)</option>
                    <option value="medium">中度 (考核/售后SLA)</option>
                    <option value="low">低度 (常规公示建议)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">规则标题</label>
                <input
                  type="text"
                  required
                  placeholder="例如：关于拼多多大促商品极速退款服务考核规范更新通知"
                  value={manualForm.title}
                  onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">规则外部编号 (选填)</label>
                  <input
                    type="text"
                    placeholder="PDD-NOTICE-2026-X"
                    value={manualForm.externalId}
                    onChange={(e) => setManualForm({ ...manualForm, externalId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">预计生效日期</label>
                  <input
                    type="date"
                    value={manualForm.effectiveAt}
                    onChange={(e) => setManualForm({ ...manualForm, effectiveAt: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">原文链接 / 来源</label>
                <input
                  type="text"
                  placeholder="https://mms.pinduoduo.com/..."
                  value={manualForm.sourceUrl}
                  onChange={(e) => setManualForm({ ...manualForm, sourceUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">规则正文条款 (全文或关键段落)</label>
                <textarea
                  required
                  rows={4}
                  placeholder="粘贴平台公告全文或关键条款，系统将自动计算 SHA-256 内容哈希防重..."
                  value={manualForm.contentText}
                  onChange={(e) => setManualForm({ ...manualForm, contentText: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">运营影响与应对指导 (选填)</label>
                <input
                  type="text"
                  placeholder="对排班、选品价格管控或客服响应的指引..."
                  value={manualForm.operationalImpact}
                  onChange={(e) => setManualForm({ ...manualForm, operationalImpact: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-orbit-border">
                <Button variant="ghost" type="button" onClick={() => setShowManualModal(false)}>
                  取消
                </Button>
                <Button variant="primary" type="submit" disabled={manualSubmitting}>
                  {manualSubmitting ? '保存中...' : '确认录入并派发预警'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default RuleRadarPage
