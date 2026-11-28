import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Plus, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, GitBranch } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { usePlatform } from '@/hooks/usePlatform'

interface ScheduleRow {
  id: number
  title: string
  topic_category: string
  stage: string
  platform_code: string
  platform_name: string
  target_platforms: string[]
  script_summary: string
  owner_name: string | null
  reviewer_name: string | null
  planned_publish_at: string | null
  published_at: string | null
  asset_id: number | null
  asset_name: string | null
  compliance_checked: boolean
  compliance_note: string
}

interface AttributionResponse {
  spendMasked: boolean
  summary: {
    total_views: number
    total_engagements: number
    total_search_back: number
    total_orders: number
    total_attributed_gmv: number
    total_settled_gmv: number
    total_ad_spend: number | null
  }
  items: Array<{
    id: number
    content_id: string
    schedule_title: string | null
    platform_name: string
    shop_name: string
    biz_date: string
    attribution_channel: string
    attribution_window_hours: number
    views: string
    search_back_count: number
    attributed_orders: number
    attributed_gmv: string
    settled_gmv: string
    ad_spend: number | null
  }>
}

const STAGES: Array<{ code: string; label: string; next?: string }> = [
  { code: 'topic_planned', label: '选题规划', next: 'script_drafted' },
  { code: 'script_drafted', label: '脚本初稿', next: 'shooting' },
  { code: 'shooting', label: '拍摄制作', next: 'editing' },
  { code: 'editing', label: '剪辑精修', next: 'compliance_review' },
  { code: 'compliance_review', label: '广审合规', next: 'approved' },
  { code: 'approved', label: '审批通过', next: 'scheduled' },
  { code: 'scheduled', label: '定时待发', next: 'published' },
  { code: 'published', label: '已全端发布' },
]

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.code, s.label]))
const WRITE_ROLES = ['super_admin', 'ops_director', 'ops_staff']

export function ContentSchedulePage() {
  const { hasRole } = useAuth()
  const { currentPlatform } = usePlatform()
  const canWrite = hasRole(WRITE_ROLES)

  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [attribution, setAttribution] = useState<AttributionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    title: '',
    topicCategory: '商品测评',
    platformCode: currentPlatform?.platform_code || 'douyin',
    targetPlatforms: [currentPlatform?.platform_code || 'douyin'],
    scriptSummary: '',
    plannedPublishAt: new Date(Date.now() + 86400_000).toISOString().slice(0, 16),
  })

  // 监听顶栏平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      setForm((prev) => ({
        ...prev,
        platformCode: currentPlatform.platform_code,
        targetPlatforms: [currentPlatform.platform_code],
      }))
    }
  }, [currentPlatform?.platform_code])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sc, attr] = await Promise.all([
        api.get<ScheduleRow[]>('/content/schedules'),
        api.get<AttributionResponse>('/content/attribution'),
      ])
      setSchedules(Array.isArray(sc) ? sc : [])
      setAttribution(attr)
    } catch (err: any) {
      setError(err?.message || '加载内容排产与归因数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createSchedule = async () => {
    if (!form.title.trim()) return
    try {
      await api.post('/content/schedules', {
        ...form,
        title: form.title.trim(),
        plannedPublishAt: form.plannedPublishAt ? new Date(form.plannedPublishAt).toISOString() : undefined,
      })
      setShowCreate(false)
      setForm({ ...form, title: '', scriptSummary: '' })
      await load()
    } catch (err: any) {
      setError(err?.message || '创建内容排期失败')
    }
  }

  const advanceStage = async (row: ScheduleRow, nextStage: string, forceCompliance = false) => {
    try {
      setNotice(null)
      await api.patch(`/content/schedules/${row.id}/stage`, {
        stage: nextStage,
        complianceChecked: forceCompliance ? true : row.compliance_checked,
        complianceNote: forceCompliance ? '已完成违禁词与资质一致性机审确认' : row.compliance_note,
      })
      await load()
    } catch (err: any) {
      setError(err?.message || '推进内容排期失败')
    }
  }

  const deriveAsset = async (assetId: number, targetPlatform: string) => {
    try {
      await api.post(`/content/assets/${assetId}/derive`, { targetPlatform })
      setNotice(`已为素材 #${assetId} 生成 ${targetPlatform} 分发衍生版本`)
    } catch (err: any) {
      setError(err?.message || '派生多端素材失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-status-ai" />
            内容排产工作流、广审校验与多端归因台账
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            选题 → 脚本 → 拍摄 → 剪辑 → 广审强制闸门 → 多端一鱼多吃派生 → 搜索回搜/种草成交 GMV 归因
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {canWrite && (
            <Button size="sm" variant="primary" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="w-3.5 h-3.5" />
              新建内容排期
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-orbit-success/40 bg-orbit-success/10 px-4 py-2.5 text-xs text-status-success">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-orbit-danger/40 bg-orbit-danger/10 px-4 py-3 text-xs text-status-danger flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="secondary" onClick={load}>重试</Button>
        </div>
      )}

      {showCreate && canWrite && (
        <Card>
          <CardHeader title="新建内容创作与合规排期" />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[var(--text-muted)] block mb-1">选题标题</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例如：轻薄防晒衣水洗30次对比实测"
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-[var(--text-secondary)]"
                />
              </div>
              <div>
                <label className="text-[var(--text-muted)] block mb-1">首发主平台 / 类目</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={form.platformCode}
                    onChange={(e) => setForm({ ...form, platformCode: e.target.value })}
                    className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]"
                  >
                    {['douyin', 'kuaishou', 'wechat'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <input
                    value={form.topicCategory}
                    onChange={(e) => setForm({ ...form, topicCategory: e.target.value })}
                    className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-[var(--text-secondary)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[var(--text-muted)] block mb-1">计划发布时间</label>
                <input
                  type="datetime-local"
                  value={form.plannedPublishAt}
                  onChange={(e) => setForm({ ...form, plannedPublishAt: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-[var(--text-secondary)]"
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-[var(--text-muted)] block mb-1">脚本要点与合规约束</label>
                <input
                  value={form.scriptSummary}
                  onChange={(e) => setForm({ ...form, scriptSummary: e.target.value })}
                  placeholder="列出核心卖点分镜与禁用夸大宣传词自检项"
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-[var(--text-secondary)]"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>取消</Button>
              <Button size="sm" variant="primary" onClick={createSchedule}>保存排期</Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="全流程排期工作台（含广审强制前置闸门）" />
        <CardBody className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-orbit-border text-[var(--text-muted)]">
                  <th className="text-left px-4 py-2.5">内容选题</th>
                  <th className="text-left px-4 py-2.5">首发与分发矩阵</th>
                  <th className="text-left px-4 py-2.5">当前阶段</th>
                  <th className="text-left px-4 py-2.5">广审合规</th>
                  <th className="text-left px-4 py-2.5">操作与一鱼多吃派生</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((row) => {
                  const stageObj = STAGES.find((s) => s.code === row.stage)
                  return (
                    <tr key={row.id} className="border-b border-orbit-border/60 hover:bg-[var(--hover-bg)]">
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        <div className="font-medium">{row.title}</div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{row.topic_category} · {row.script_summary}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="info">主: {row.platform_name || row.platform_code}</Badge>
                          {row.target_platforms?.map((tp) => (
                            <Badge key={tp} variant="neutral">{tp}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.stage === 'published' ? 'success' : row.stage === 'approved' ? 'info' : 'warning'}>
                          {STAGE_LABEL[row.stage] || row.stage}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {row.compliance_checked ? (
                          <span className="inline-flex items-center gap-1 text-status-success">
                            <CheckCircle2 className="w-3.5 h-3.5" />已核验
                          </span>
                        ) : (
                          <span className="text-status-warning">待广审确认</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canWrite && stageObj?.next && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                advanceStage(row, stageObj.next!, !row.compliance_checked && stageObj.next === 'approved')
                              }
                            >
                              推进至 {STAGE_LABEL[stageObj.next]} <ArrowRight className="w-3 h-3" />
                            </Button>
                          )}
                          {canWrite && row.asset_id && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => deriveAsset(row.asset_id!, row.platform_code === 'douyin' ? 'kuaishou' : 'douyin')}
                            >
                              <GitBranch className="w-3 h-3" /> 派生分发版
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {attribution && (
        <Card>
          <CardHeader
            title="内容 → 搜索回搜 → 交易 GMV 归因台账"
            subtitle={`总曝光 ${attribution.summary.total_views.toLocaleString()} · 站内外搜索回搜 ${attribution.summary.total_search_back.toLocaleString()} 次 · 归因 GMV ¥${attribution.summary.total_attributed_gmv.toLocaleString()}`}
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-orbit-border text-[var(--text-muted)]">
                    <th className="text-left px-4 py-2.5">内容 ID / 关联排期</th>
                    <th className="text-left px-4 py-2.5">平台/店铺</th>
                    <th className="text-left px-4 py-2.5">归因链路 / 窗口</th>
                    <th className="text-right px-4 py-2.5">播放量</th>
                    <th className="text-right px-4 py-2.5">搜索回搜</th>
                    <th className="text-right px-4 py-2.5">转化订单</th>
                    <th className="text-right px-4 py-2.5">归因 / 结算 GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.items.map((it) => (
                    <tr key={it.id} className="border-b border-orbit-border/60 hover:bg-[var(--hover-bg)]">
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                        <div className="font-mono text-[11px]">{it.content_id}</div>
                        <div className="text-[var(--text-muted)]">{it.schedule_title || '-'}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{it.platform_name} · {it.shop_name}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="info">{it.attribution_channel}</Badge>
                        <span className="ml-1.5 text-[var(--text-muted)]">{it.attribution_window_hours}h</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{Number(it.views).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-status-ai">{it.search_back_count.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{it.attributed_orders}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-status-success">
                        ¥{Number(it.attributed_gmv).toLocaleString()} <span className="text-[var(--text-muted)]">(净 ¥{Number(it.settled_gmv).toLocaleString()})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
