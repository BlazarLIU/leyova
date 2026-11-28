import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, Plus, RefreshCw, Award } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'

interface CsOverview {
  totalAgents: number
  totalSessions: number
  respondedSessions: number
  timeoutSessions: number
  responseRate: number
  timeoutRate: number
  avgFirstResponseSec: number
  inquiryBuyers: number
  convertedBuyers: number
  inquiryConversionRate: number
  convertedGmv: number
  avgSatisfactionRate: number
  byPlatform: Array<{
    platformCode: string
    platformName: string
    totalSessions: number
    timeoutSessions: number
    avgFirstResponseSec: number
    inquiryConversionRate: number
    convertedGmv: number
  }>
}

interface CsAgent {
  id: number
  agent_code: string
  agent_name: string
  platform_code: string
  platform_name: string
  shop_name: string
  shift_group: string
  status: string
  total_sessions: number
  timeout_sessions: number
  avg_first_response_sec: string
  converted_gmv: string
}

interface CsSessionRow {
  id: number
  session_date: string
  agent_code: string
  agent_name: string
  platform_code: string
  platform_name: string
  shop_name: string
  shift_type: string
  total_sessions: number
  responded_sessions: number
  timeout_sessions: number
  avg_first_response_sec: string
  inquiry_buyers: number
  converted_buyers: number
  converted_gmv: string
  satisfaction_rate: string
}

export function CustomerServicePage() {
  const { currentPlatform } = usePlatform()
  const [activeTab, setActiveTab] = useState<'sessions' | 'agents'>('sessions')
  const [overview, setOverview] = useState<CsOverview | null>(null)
  const [agents, setAgents] = useState<CsAgent[]>([])
  const [showModal, setShowModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [form, setForm] = useState({
    agentId: '',
    sessionDate: new Date().toISOString().slice(0, 10),
    shiftType: 'day',
    totalSessions: '150',
    respondedSessions: '148',
    timeoutSessions: '4',
    avgFirstResponseSec: '15.2',
    inquiryBuyers: '120',
    convertedBuyers: '42',
    convertedGmv: '13800',
    satisfactionRate: '97.2',
  })

  const loadAuxData = useCallback(async () => {
    try {
      const [ov, ag] = await Promise.all([
        api.get<CsOverview>('/cs/overview'),
        api.get<CsAgent[]>('/cs/agents'),
      ])
      setOverview(ov)
      setAgents(ag || [])
      if (ag && ag.length > 0 && !form.agentId) {
        setForm((prev) => ({ ...prev, agentId: String(ag[0].id) }))
      }
    } catch (err: any) {
      setErrorMsg(err?.message || '加载客服概览数据失败')
    }
  }, [form.agentId])

  useEffect(() => {
    loadAuxData()
  }, [loadAuxData])

  // Sessions Table
  const sessionsTable = useTable<CsSessionRow, { platformCode: string; shiftType: string }>({
    initialFilters: { platformCode: currentPlatform?.platform_code || '', shiftType: '' },
    initialPageSize: 20,
    fetchData: async ({ filters, search, page, pageSize }) => {
      const ss = await api.get<CsSessionRow[]>('/cs/sessions', {
        platformCode: filters.platformCode || undefined,
        shiftType: filters.shiftType || undefined,
      })
      let list = ss || []
      if (search) {
        const q = search.toLowerCase()
        list = list.filter(
          (s) =>
            s.agent_name.toLowerCase().includes(q) ||
            s.agent_code.toLowerCase().includes(q) ||
            s.platform_name.toLowerCase().includes(q) ||
            s.shop_name.toLowerCase().includes(q)
        )
      }
      return {
        items: list.slice((page - 1) * pageSize, page * pageSize),
        total: list.length,
      }
    },
  })

  // 监听顶栏平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      sessionsTable.setFilter('platformCode', currentPlatform.platform_code)
    }
  }, [currentPlatform?.platform_code])

  // Agents Table
  const agentsTable = useTable<CsAgent, Record<string, any>>({
    initialPageSize: 20,
    fetchData: async ({ search, page, pageSize }) => {
      const ag = await api.get<CsAgent[]>('/cs/agents')
      let list = ag || []
      if (search) {
        const q = search.toLowerCase()
        list = list.filter(
          (a) =>
            a.agent_name.toLowerCase().includes(q) ||
            a.agent_code.toLowerCase().includes(q) ||
            a.platform_name.toLowerCase().includes(q) ||
            a.shop_name.toLowerCase().includes(q)
        )
      }
      return {
        items: list.slice((page - 1) * pageSize, page * pageSize),
        total: list.length,
      }
    },
  })

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      await api.post('/cs/sessions', {
        agentId: Number(form.agentId),
        sessionDate: form.sessionDate,
        shiftType: form.shiftType,
        totalSessions: Number(form.totalSessions),
        respondedSessions: Number(form.respondedSessions),
        timeoutSessions: Number(form.timeoutSessions),
        avgFirstResponseSec: Number(form.avgFirstResponseSec),
        inquiryBuyers: Number(form.inquiryBuyers),
        convertedBuyers: Number(form.convertedBuyers),
        convertedGmv: Number(form.convertedGmv),
        satisfactionRate: Number(form.satisfactionRate),
      })
      setShowModal(false)
      await Promise.all([sessionsTable.reload(), agentsTable.reload(), loadAuxData()])
    } catch (err: any) {
      setErrorMsg(err?.message || '录入班次绩效失败')
    }
  }

  const sessionColumns: ColumnDef<CsSessionRow>[] = useMemo(
    () => [
      {
        key: 'session_date',
        header: '日期 / 班次',
        sortable: true,
        render: (_, s) => (
          <div>
            <span className="font-mono text-[var(--text-secondary)]">{s.session_date?.slice(0, 10)}</span>
            <Badge variant="neutral" className="ml-2 text-xs">
              {s.shift_type === 'night' ? '晚班' : '白班 (9-23)'}
            </Badge>
          </div>
        ),
      },
      {
        key: 'agent_name',
        header: '坐席 / 平台',
        render: (_, s) => (
          <div>
            <span className="font-medium text-[var(--text-primary)]">{s.agent_name}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1">({s.agent_code})</span>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              <Badge variant="info" className="text-[10px] mr-1">
                {s.platform_name}
              </Badge>
              {s.shop_name}
            </div>
          </div>
        ),
      },
      {
        key: 'total_sessions',
        header: '接待 / 响应 / 超时',
        align: 'right',
        sortable: true,
        render: (_, s) => (
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">
            {s.total_sessions} / {s.responded_sessions} /{' '}
            <span className="text-status-danger">{s.timeout_sessions}</span>
          </span>
        ),
      },
      {
        key: 'avg_first_response_sec',
        header: '首响秒数',
        align: 'right',
        sortable: true,
        render: (_, s) => (
          <span className="font-mono tabular-nums text-status-ai font-semibold">
            {s.avg_first_response_sec}s
          </span>
        ),
      },
      {
        key: 'inquiry_buyers',
        header: '询单 → 成交',
        align: 'right',
        sortable: true,
        render: (_, s) => (
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">
            {s.inquiry_buyers} → {s.converted_buyers}
          </span>
        ),
      },
      {
        key: 'converted_gmv',
        header: '转化 GMV / 满意度',
        align: 'right',
        sortable: true,
        render: (_, s) => (
          <span className="font-mono tabular-nums text-status-success font-semibold">
            ¥{Number(s.converted_gmv).toLocaleString()} ({s.satisfaction_rate}%)
          </span>
        ),
      },
    ],
    []
  )

  const agentColumns: ColumnDef<CsAgent>[] = useMemo(
    () => [
      {
        key: 'agent_name',
        header: '工号 / 坐席姓名',
        sortable: true,
        render: (_, a) => (
          <div>
            <span className="font-medium text-[var(--text-primary)]">{a.agent_name}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1 font-mono">({a.agent_code})</span>
          </div>
        ),
      },
      {
        key: 'shop_name',
        header: '服务店铺与班次',
        render: (_, a) => (
          <div className="text-xs">
            <Badge variant="info">{a.platform_name}</Badge>
            <span className="ml-2 text-[var(--text-secondary)]">
              {a.shop_name} · {a.shift_group === 'night' ? '晚班' : '白班 (9-23)'}
            </span>
          </div>
        ),
      },
      {
        key: 'total_sessions',
        header: '累计会话 / 超时数',
        align: 'right',
        sortable: true,
        render: (_, a) => (
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">
            {a.total_sessions} / <span className="text-status-danger">{a.timeout_sessions}</span>
          </span>
        ),
      },
      {
        key: 'avg_first_response_sec',
        header: '加权首响秒数',
        align: 'right',
        sortable: true,
        render: (_, a) => (
          <span className="font-mono tabular-nums text-status-ai font-semibold">
            {a.avg_first_response_sec}s
          </span>
        ),
      },
      {
        key: 'converted_gmv',
        header: '累计询单转化 GMV',
        align: 'right',
        sortable: true,
        render: (_, a) => (
          <span className="font-mono tabular-nums text-status-success font-bold">
            ¥{Number(a.converted_gmv).toLocaleString()}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-lg border border-orbit-danger/30 bg-orbit-danger/10 px-4 py-2.5 text-sm text-status-danger">
          {errorMsg}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">总接待会话 / 坐席</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                {overview.totalSessions} / {overview.totalAgents}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">平均首响时长</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  overview.avgFirstResponseSec > 25 ? 'text-status-warning' : 'text-status-success'
                }`}
              >
                {overview.avgFirstResponseSec}s
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">超时率 (&gt;30s)</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  overview.timeoutRate > 5 ? 'text-status-danger' : 'text-[var(--text-primary)]'
                }`}
              >
                {overview.timeoutRate}%
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">询单下单转化率</p>
              <p className="mt-1 text-2xl font-bold text-status-ai">
                {overview.inquiryConversionRate}%
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">询单转化 GMV / 满意度</p>
              <p className="mt-1 text-xl font-bold text-status-success">
                ¥{overview.convertedGmv.toLocaleString()} · {overview.avgSatisfactionRate}%
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {overview && overview.byPlatform.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {overview.byPlatform.map((p) => (
            <Card key={p.platformCode}>
              <CardBody className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="info">{p.platformName}</Badge>
                  <span className="text-xs text-[var(--text-muted)]">首响 {p.avgFirstResponseSec}s</span>
                </div>
                <p className="text-lg font-bold text-[var(--text-primary)]">¥{p.convertedGmv.toLocaleString()}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  接待 {p.totalSessions} · 转化率 {p.inquiryConversionRate}% · 超时 {p.timeoutSessions}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* View Switcher Bar */}
      <div className="flex items-center justify-between border-b border-orbit-border pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'sessions'
                ? 'bg-orbit-primary/20 text-orbit-primary-light border border-orbit-primary/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Clock className="w-4 h-4" />
            班次会话流水明细
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'agents'
                ? 'bg-orbit-primary/20 text-orbit-primary-light border border-orbit-primary/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Award className="w-4 h-4" />
            客服坐席效能榜
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            录入班次会话绩效
          </Button>
        </div>
      </div>

      {activeTab === 'sessions' ? (
        <DataPage<CsSessionRow>
          title="客服咨询会话流水明细"
          subtitle="覆盖全平台首响时长考核时段、超时率及询单转化 GMV 归因"
          badge={
            <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-status-success border border-orbit-border">
              DataPage + useTable
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => Promise.all([sessionsTable.reload(), loadAuxData()])}
              loading={sessionsTable.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          }
          table={sessionsTable}
          columns={sessionColumns}
          searchPlaceholder="搜索坐席姓名、工号或店铺..."
          exportFilename="cs_sessions_detail"
          filterControls={
            <div className="flex items-center gap-2">
              <select
                value={sessionsTable.filters.platformCode}
                onChange={(e) => sessionsTable.setFilter('platformCode', e.target.value)}
                className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-[var(--text-secondary)]"
              >
                <option value="">全部平台</option>
                <option value="douyin">抖音</option>
                <option value="kuaishou">快手</option>
                <option value="wechat">视频号</option>
              </select>
              <select
                value={sessionsTable.filters.shiftType}
                onChange={(e) => sessionsTable.setFilter('shiftType', e.target.value)}
                className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-xs text-[var(--text-secondary)]"
              >
                <option value="">全部班次</option>
                <option value="day">白班 (9:00–23:00)</option>
                <option value="night">晚班</option>
              </select>
            </div>
          }
        />
      ) : (
        <DataPage<CsAgent>
          title="客服坐席效能排行榜"
          subtitle="全平台坐席累计接待人次、加权平均首响秒数、超时次数与转化 GMV 总榜"
          badge={
            <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-status-ai border border-orbit-border">
              坐席效能榜
            </span>
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => Promise.all([agentsTable.reload(), loadAuxData()])}
              loading={agentsTable.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          }
          table={agentsTable}
          columns={agentColumns}
          searchPlaceholder="搜索坐席姓名、工号或服务店铺..."
          exportFilename="cs_agent_leaderboard"
        />
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">录入每日客服班次绩效</h3>
            <form onSubmit={handleSaveSession} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.agent_name} ({a.platform_name})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={form.sessionDate}
                  onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  placeholder="总会话"
                  value={form.totalSessions}
                  onChange={(e) => setForm({ ...form, totalSessions: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  type="number"
                  placeholder="超时数"
                  value={form.timeoutSessions}
                  onChange={(e) => setForm({ ...form, timeoutSessions: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="首响秒数"
                  value={form.avgFirstResponseSec}
                  onChange={(e) => setForm({ ...form, avgFirstResponseSec: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  placeholder="询单人数"
                  value={form.inquiryBuyers}
                  onChange={(e) => setForm({ ...form, inquiryBuyers: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  type="number"
                  placeholder="成交人数"
                  value={form.convertedBuyers}
                  onChange={(e) => setForm({ ...form, convertedBuyers: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="转化GMV"
                  value={form.convertedGmv}
                  onChange={(e) => setForm({ ...form, convertedGmv: e.target.value })}
                  className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                  取消
                </Button>
                <Button type="submit">保存绩效</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
