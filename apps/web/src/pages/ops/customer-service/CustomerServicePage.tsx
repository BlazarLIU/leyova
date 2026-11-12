import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, RefreshCw, Award } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

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
  const [overview, setOverview] = useState<CsOverview | null>(null)
  const [agents, setAgents] = useState<CsAgent[]>([])
  const [sessions, setSessions] = useState<CsSessionRow[]>([])
  const [loading, setLoading] = useState(true)
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

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [ov, ag, ss] = await Promise.all([
        api.get<CsOverview>('/cs/overview'),
        api.get<CsAgent[]>('/cs/agents'),
        api.get<CsSessionRow[]>('/cs/sessions'),
      ])
      setOverview(ov)
      setAgents(ag || [])
      setSessions(ss || [])
      if (ag && ag.length > 0 && !form.agentId) {
        setForm((prev) => ({ ...prev, agentId: String(ag[0].id) }))
      }
    } catch (err: any) {
      setErrorMsg(err?.message || '加载客服会话与绩效失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.message || '录入班次绩效失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">客服咨询会话与响应绩效中心</h1>
          <p className="mt-1 text-sm text-slate-400">
            覆盖京东 9:00–23:00 咚咚响应考核时段与全平台首响时长、超时率、询单转化率及客服静默转化 GMV 归因
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            刷新
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)} icon={<Plus className="w-4 h-4" />}>
            录入班次会话绩效
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">总接待会话 / 坐席</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{overview.totalSessions} / {overview.totalAgents}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">平均首响时长</p>
              <p className={`mt-1 text-2xl font-bold ${overview.avgFirstResponseSec > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {overview.avgFirstResponseSec}s
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">超时率 (&gt;30s)</p>
              <p className={`mt-1 text-2xl font-bold ${overview.timeoutRate > 5 ? 'text-red-400' : 'text-slate-100'}`}>
                {overview.timeoutRate}%
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">询单下单转化率</p>
              <p className="mt-1 text-2xl font-bold text-cyan-400">{overview.inquiryConversionRate}%</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-slate-400">询单转化 GMV / 满意度</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">
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
                  <span className="text-xs text-slate-400">首响 {p.avgFirstResponseSec}s</span>
                </div>
                <p className="text-lg font-bold text-slate-100">¥{p.convertedGmv.toLocaleString()}</p>
                <p className="text-xs text-slate-400">
                  接待 {p.totalSessions} · 转化率 {p.inquiryConversionRate}% · 超时 {p.timeoutSessions}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-100">客服坐席效能榜</span>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-orbit-border text-xs text-slate-400 bg-orbit-surface2/50">
              <tr>
                <th className="px-4 py-3">工号 / 坐席姓名</th>
                <th className="px-4 py-3">服务店铺与班次</th>
                <th className="px-4 py-3 text-right">累计会话 / 超时数</th>
                <th className="px-4 py-3 text-right">加权首响秒数</th>
                <th className="px-4 py-3 text-right">累计询单转化 GMV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orbit-border">
              {agents.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-slate-100">
                    {a.agent_name} <span className="text-xs text-slate-500 ml-1">({a.agent_code})</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Badge variant="info">{a.platform_name}</Badge>
                    <span className="ml-2 text-slate-300">{a.shop_name} · {a.shift_group === 'night' ? '晚班' : '白班 (9-23)'}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                    {a.total_sessions} / <span className="text-red-400">{a.timeout_sessions}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-cyan-400">{a.avg_first_response_sec}s</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-400">
                    ¥{Number(a.converted_gmv).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orbit-primary-light" />
          <span className="font-semibold text-slate-100">班次会话流水明细</span>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-orbit-border text-slate-400 bg-orbit-surface2/50">
              <tr>
                <th className="px-4 py-2.5">日期 / 班次</th>
                <th className="px-4 py-2.5">坐席 / 平台</th>
                <th className="px-4 py-2.5 text-right">接待 / 响应 / 超时</th>
                <th className="px-4 py-2.5 text-right">首响秒数</th>
                <th className="px-4 py-2.5 text-right">询单 → 成交人数</th>
                <th className="px-4 py-2.5 text-right">转化 GMV / 满意度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orbit-border">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-slate-300">{s.session_date?.slice(0, 10)} · {s.shift_type === 'night' ? '晚班' : '白班'}</td>
                  <td className="px-4 py-2.5 text-slate-200">{s.agent_name} ({s.platform_name})</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.total_sessions} / {s.responded_sessions} / <span className="text-red-400">{s.timeout_sessions}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-cyan-400">{s.avg_first_response_sec}s</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.inquiry_buyers} → {s.converted_buyers}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">¥{Number(s.converted_gmv).toLocaleString()} ({s.satisfaction_rate}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">录入每日客服班次绩效</h3>
            <form onSubmit={handleSaveSession} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100">
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.agent_name} ({a.platform_name})</option>)}
                </select>
                <input type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" placeholder="总会话" value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input type="number" placeholder="超时数" value={form.timeoutSessions} onChange={(e) => setForm({ ...form, timeoutSessions: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input type="number" step="0.1" placeholder="首响秒数" value={form.avgFirstResponseSec} onChange={(e) => setForm({ ...form, avgFirstResponseSec: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" placeholder="询单人数" value={form.inquiryBuyers} onChange={(e) => setForm({ ...form, inquiryBuyers: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input type="number" placeholder="成交人数" value={form.convertedBuyers} onChange={(e) => setForm({ ...form, convertedBuyers: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
                <input type="number" step="0.01" placeholder="转化GMV" value={form.convertedGmv} onChange={(e) => setForm({ ...form, convertedGmv: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-slate-100" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
                <Button type="submit">保存绩效</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
