import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, Plus, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { usePlatform } from '@/hooks/usePlatform'

interface ComplianceResponse {
  summary: {
    total: number
    open_count: number
    critical_count: number
    total_points_deducted: number
    traffic_restricted_count: number
    auto_price_follow_risk_count: number
    entity_inconsistent_count: number
  }
  events: Array<{
    id: number
    platform_code: string
    platform_name: string
    shop_id: number | null
    shop_name: string | null
    regulation_code: string
    event_type: string
    severity: 'info' | 'warning' | 'critical'
    credit_points_deducted: number
    traffic_restricted: boolean
    auto_price_follow_risk: boolean
    entity_consistency_ok: boolean
    summary: string
    status: 'open' | 'remediating' | 'resolved' | 'appealed'
    occurred_at: string
  }>
}

const WRITE_ROLES = ['super_admin', 'ops_director', 'ops_staff']

export function CompliancePage() {
  const { hasRole } = useAuth()
  const { currentPlatform } = usePlatform()
  const canWrite = hasRole(WRITE_ROLES)

  const [data, setData] = useState<ComplianceResponse | null>(null)
  const [platform, setPlatform] = useState(() => currentPlatform?.platform_code || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    platformCode: currentPlatform?.platform_code || 'douyin',
    regulationCode: 'AUTO-PRICE-FOLLOW-2026',
    eventType: 'auto_price_follow_risk',
    severity: 'warning',
    creditPointsDeducted: '0',
    trafficRestricted: false,
    autoPriceFollowRisk: true,
    entityConsistencyOk: true,
    summary: '',
  })

  // 监听顶栏全局平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      setPlatform(currentPlatform.platform_code)
      setForm((prev) => ({ ...prev, platformCode: currentPlatform.platform_code }))
    }
  }, [currentPlatform?.platform_code])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<ComplianceResponse>('/compliance/events', platform ? { platform } : undefined)
      setData(res)
    } catch (err: any) {
      setError(err?.message || '加载 2026 合规台账失败')
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => {
    load()
  }, [load])

  const submitEvent = async () => {
    if (!form.summary.trim()) return
    try {
      await api.post('/compliance/events', {
        ...form,
        creditPointsDeducted: Number(form.creditPointsDeducted || 0),
        summary: form.summary.trim(),
      })
      setShowAdd(false)
      setForm({ ...form, summary: '' })
      await load()
    } catch (err: any) {
      setError(err?.message || '登记合规风险失败')
    }
  }

  const updateStatus = async (id: number, status: 'remediating' | 'resolved' | 'appealed') => {
    try {
      await api.patch(`/compliance/events/${id}`, { status })
      await load()
    } catch (err: any) {
      setError(err?.message || '更新合规事件状态失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            2026 平台合规与风控台账
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            聚焦 2026 年网络交易平台新规：仅退款/自动跟价风险监测、工商税务主体一致性核验、信用扣分与限流申诉闭环
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-xs text-[var(--text-secondary)]"
          >
            <option value="">全部平台</option>
            <option value="douyin">抖音</option>
            <option value="kuaishou">快手</option>
            <option value="wechat">视频号</option>
            <option value="taobao">淘宝</option>
            <option value="tmall">天猫</option>
            <option value="xiaohongshu">小红书</option>
          </select>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {canWrite && (
            <Button size="sm" variant="primary" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="w-3.5 h-3.5" />
              登记风险事件
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="secondary" onClick={load}>重试</Button>
        </div>
      )}

      {showAdd && canWrite && (
        <Card>
          <CardHeader title="新增 2026 平台合规风险登记" />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[var(--text-muted)] block mb-1">平台</label>
                <select value={form.platformCode} onChange={(e) => setForm({ ...form, platformCode: e.target.value })} className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-[var(--text-secondary)]">
                  {['douyin', 'kuaishou', 'wechat', 'taobao', 'tmall', 'xiaohongshu'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[var(--text-muted)] block mb-1">法规/规则编号</label>
                <input value={form.regulationCode} onChange={(e) => setForm({ ...form, regulationCode: e.target.value })} className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-[var(--text-secondary)]" />
              </div>
              <div>
                <label className="text-[var(--text-muted)] block mb-1">严重程度 & 扣分</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]">
                    <option value="info">info</option>
                    <option value="warning">warning</option>
                    <option value="critical">critical</option>
                  </select>
                  <input type="number" value={form.creditPointsDeducted} onChange={(e) => setForm({ ...form, creditPointsDeducted: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]" />
                </div>
              </div>
              <div className="flex flex-col justify-end gap-1.5">
                <label className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                  <input type="checkbox" checked={form.autoPriceFollowRisk} onChange={(e) => setForm({ ...form, autoPriceFollowRisk: e.target.checked })} />
                  涉及自动跟价/强制降价风险
                </label>
                <label className="inline-flex items-center gap-2 text-[var(--text-secondary)]">
                  <input type="checkbox" checked={!form.entityConsistencyOk} onChange={(e) => setForm({ ...form, entityConsistencyOk: !e.target.checked })} />
                  资质主体不一致警告
                </label>
              </div>
              <div className="md:col-span-4">
                <label className="text-[var(--text-muted)] block mb-1">风险摘要与整改要求</label>
                <input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="描述具体触发场景、影响店铺及申诉截止日" className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-[var(--text-secondary)]" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowAdd(false)}>取消</Button>
              <Button size="sm" variant="primary" onClick={submitEvent}>提交台账</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card><CardBody>
              <div className="text-xs text-[var(--text-muted)]">待处置合规事项</div>
              <div className="text-xl font-bold text-amber-400 mt-1 tabular-nums">{data.summary.open_count}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-[var(--text-muted)]">严重告警 (Critical)</div>
              <div className="text-xl font-bold text-rose-400 mt-1 tabular-nums">{data.summary.critical_count}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-[var(--text-muted)]">累计信用扣分</div>
              <div className="text-xl font-bold text-[var(--text-primary)] mt-1 tabular-nums">{data.summary.total_points_deducted}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-[var(--text-muted)]">自动跟价风险单</div>
              <div className="text-xl font-bold text-cyan-400 mt-1 tabular-nums">{data.summary.auto_price_follow_risk_count}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-[var(--text-muted)]">主体不一致异常</div>
              <div className="text-xl font-bold text-rose-300 mt-1 tabular-nums">{data.summary.entity_inconsistent_count}</div>
            </CardBody></Card>
          </div>

          <Card>
            <CardHeader title="合规风控事件与整改闭环记录" />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-orbit-border text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5">平台/店铺</th>
                      <th className="text-left px-4 py-2.5">规则与事件类型</th>
                      <th className="text-left px-4 py-2.5">风控标签</th>
                      <th className="text-left px-4 py-2.5">摘要</th>
                      <th className="text-left px-4 py-2.5">状态</th>
                      <th className="text-left px-4 py-2.5">处置动作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e) => (
                      <tr key={e.id} className="border-b border-orbit-border/60 hover:bg-white/5">
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{e.platform_name} {e.shop_name ? `· ${e.shop_name}` : ''}</td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-cyan-300">{e.regulation_code}</div>
                          <div className="text-[var(--text-muted)]">{e.event_type}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={e.severity === 'critical' ? 'danger' : e.severity === 'warning' ? 'warning' : 'info'}>{e.severity}</Badge>
                            {e.auto_price_follow_risk && <Badge variant="warning">自动跟价</Badge>}
                            {e.traffic_restricted && <Badge variant="danger">流量受限</Badge>}
                            {!e.entity_consistency_ok && <Badge variant="danger">主体不一致</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] max-w-md">{e.summary}</td>
                        <td className="px-4 py-3">
                          <Badge variant={e.status === 'resolved' ? 'success' : e.status === 'remediating' ? 'info' : 'warning'}>{e.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {canWrite && e.status !== 'resolved' ? (
                            <div className="flex items-center gap-1.5">
                              {e.status === 'open' && (
                                <Button size="sm" variant="secondary" onClick={() => updateStatus(e.id, 'remediating')}>整改中</Button>
                              )}
                              <Button size="sm" variant="primary" onClick={() => updateStatus(e.id, 'resolved')}>
                                <CheckCircle2 className="w-3 h-3" />结案
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)]">已归档</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
