/**
 * AiOpsDirectorPage.tsx — F.2 编导 AI 工作台
 *
 * 五区：今日选题 / 脚本工坊 / 素材参考 / 发布日历 / 数据回看
 * 机会分由后端确定性公式计算；缺失数据显式标注「数据不足」。
 */

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Lightbulb, PenLine, Library, CalendarDays, BarChart3, Sparkles, RefreshCw, Wand2, CheckCircle2,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

interface IdeaItem {
  id: string
  title: string
  category: string
  platformCode: string | null
  source: string
  opportunityScore: number | null
  missingItems: string[]
  scoreDetail?: { note?: string; recommendation?: string }
  status: string
}

interface ScriptItem {
  id: string
  version: number
  variant: string
  title: string
  briefTitle?: string
  status: string
  complianceStatus: string
  createdAt: string
}

interface CalendarItem {
  id: string
  name: string
  eventType: string
  startDate: string
  endDate: string
  importance: number
}

interface Overview {
  ideas: IdeaItem[]
  scripts: ScriptItem[]
  calendar: CalendarItem[]
  performance: { links: number; avgPlays: number }
  assets: { mediaCount: number; bgmCount: number; templateCount: number }
}

interface BriefListItem {
  id: string
  ideaId: string | null
  ideaTitle: string | null
  title: string
  status: string
  scriptCount: number
  keyPoints: string[]
}

interface BriefDetail extends BriefListItem {
  objective: string
  audience: string
  constraints: string
  scripts: Array<{
    id: string
    version: number
    variant: string
    title: string
    hook: string
    body: string[]
    proof: string
    cta: string
    wordsCount: number
    complianceStatus: string
    status: string
  }>
}

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

const MISSING_LABEL: Record<string, string> = {
  demand: '品类需求',
  history: '历史表现',
  margin: '毛利库存',
  season: '季节节点',
  feasibility: '制作可行性',
}

function scoreVariant(score: number | null): 'success' | 'warning' | 'danger' | 'info' {
  if (score == null) return 'info'
  if (score >= 60) return 'success'
  if (score >= 45) return 'warning'
  return 'danger'
}

export function AiOpsDirectorPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [briefs, setBriefs] = useState<BriefListItem[]>([])
  const [brief, setBrief] = useState<BriefDetail | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')

  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaCategory, setIdeaCategory] = useState('通用')

  const [hook, setHook] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [cta, setCta] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [ov, br] = await Promise.all([
      api.get<Overview>('/director/overview').catch(() => null),
      api.get<any>('/director/briefs', { limit: 20 }).catch(() => null),
    ])
    if (ov) setOverview(ov)
    if (br) setBriefs(Array.isArray(br.items) ? br.items : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const openBrief = async (briefId: string) => {
    const res = await api.get<BriefDetail>(`/director/briefs/${briefId}`).catch(() => null)
    if (res) setBrief(res)
  }

  const handleCreateIdea = async () => {
    if (!ideaTitle.trim() || busy) return
    setBusy('idea')
    setMessage('')
    try {
      const res = await api.post<any>('/director/ideas', {
        title: ideaTitle.trim(),
        category: ideaCategory.trim() || '通用',
        source: 'manual',
      })
      setIdeaTitle('')
      setMessage(`选题已创建：${res.id}`)
      await loadAll()
    } catch (err: any) {
      setMessage(err?.message || '创建选题失败')
    } finally {
      setBusy('')
    }
  }

  const handleScore = async (ideaId: string) => {
    if (busy) return
    setBusy(`score:${ideaId}`)
    setMessage('')
    try {
      const res = await api.post<any>(`/director/ideas/${ideaId}/score`, { days: 30 })
      setMessage(res.score == null
        ? `机会分：数据不足（${res.note}）`
        : `机会分 ${res.score} · ${res.recommendation === 'recommended' ? '建议制作' : res.recommendation === 'neutral' ? '可观察' : '不建议'}${res.missing.length ? ` · 缺 ${res.missing.map((key: string) => MISSING_LABEL[key] || key).join('、')}` : ''}`)
      await loadAll()
    } catch (err: any) {
      setMessage(err?.message || '评分失败')
    } finally {
      setBusy('')
    }
  }

  const handleCreateBrief = async (idea: IdeaItem) => {
    if (busy) return
    setBusy(`brief:${idea.id}`)
    setMessage('')
    try {
      const res = await api.post<any>('/director/briefs', {
        ideaId: idea.id,
        title: `${idea.title} · 创作简报`,
        objective: '围绕商品事实完成一条可发布的短视频',
      })
      setMessage(`简报已生成：${res.id}${res.keyPoints?.length ? `，事实要点 ${res.keyPoints.length} 条` : '（缺少商品事实，需人工补充）'}`)
      await loadAll()
      await openBrief(res.id)
    } catch (err: any) {
      setMessage(err?.message || '生成简报失败')
    } finally {
      setBusy('')
    }
  }

  const handleCreateScript = async () => {
    if (!brief || busy) return
    setBusy('script')
    setMessage('')
    try {
      const res = await api.post<any>(`/director/briefs/${brief.id}/scripts`, {
        hook: hook.trim(),
        body: bodyText.split('\n').map((item) => item.trim()).filter(Boolean),
        cta: cta.trim(),
      })
      setMessage(res.complianceStatus === 'passed'
        ? `脚本 v${res.version} 已生成，违禁词检查通过`
        : `脚本 v${res.version} 未通过违禁词检查，不能审核通过`)
      setHook('')
      setBodyText('')
      setCta('')
      await openBrief(brief.id)
      await loadAll()
    } catch (err: any) {
      setMessage(err?.message || '创建脚本失败')
    } finally {
      setBusy('')
    }
  }

  const handleStoryboard = async (scriptId: string) => {
    if (busy) return
    setBusy(`storyboard:${scriptId}`)
    setMessage('')
    try {
      const res = await api.post<any>(`/director/scripts/${scriptId}/storyboard`, {})
      setMessage(`分镜已生成：${res.shots.length} 个镜头，总时长 ${res.totalDurationSec}s`)
      if (brief) await openBrief(brief.id)
    } catch (err: any) {
      setMessage(err?.message || '生成分镜失败')
    } finally {
      setBusy('')
    }
  }

  const handleApprove = async (scriptId: string) => {
    if (busy) return
    setBusy(`approve:${scriptId}`)
    try {
      await api.patch(`/director/scripts/${scriptId}`, { status: 'approved' })
      setMessage('脚本已审核通过')
      if (brief) await openBrief(brief.id)
      await loadAll()
    } catch (err: any) {
      setMessage(err?.message || '审核失败')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <motion.div {...fadeIn} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 3 · 内容与切片
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">选题 → 脚本 → 分镜 → 发布 → 回看</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">编导工作台</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            机会分由确定性公式计算；事实只来自商品库与历史视频数据，缺失项明确标注。
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadAll()}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? '加载中…' : '刷新'}
        </Button>
      </motion.div>

      {message && <p className="text-xs text-[var(--text-muted)]">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ① 今日选题 */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="今日选题"
            subtitle="机会分 = 0.30 品类需求 + 0.25 历史表现 + 0.20 毛利库存 + 0.15 季节节点 + 0.10 制作可行性"
            actions={<Badge variant="info">{overview?.ideas.length ?? 0} 条</Badge>}
          />
          <CardBody className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={ideaTitle}
                onChange={(event) => setIdeaTitle(event.target.value)}
                placeholder="新选题标题"
                className="min-w-[200px] flex-1 rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <input
                value={ideaCategory}
                onChange={(event) => setIdeaCategory(event.target.value)}
                placeholder="品类"
                className="w-32 rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <Button size="sm" variant="primary" disabled={busy === 'idea'} onClick={handleCreateIdea}>
                <Lightbulb className="mr-1 h-3.5 w-3.5" />新建选题
              </Button>
            </div>
            {(overview?.ideas || []).length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">暂无选题，先新建一条并计算机会分。</p>
            ) : (
              overview?.ideas.map((idea) => (
                <div key={idea.id} className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge variant={scoreVariant(idea.opportunityScore)}>
                      {idea.opportunityScore == null ? '数据不足' : `${idea.opportunityScore} 分`}
                    </Badge>
                    <span className="text-sm text-[var(--text-primary)]">{idea.title}</span>
                    <span className="text-[var(--text-muted)]">{idea.category}{idea.platformCode ? ` · ${idea.platformCode}` : ''}</span>
                    <Badge variant={idea.status === 'briefed' ? 'success' : 'info'}>{idea.status}</Badge>
                    {idea.missingItems.length > 0 && (
                      <span className="text-[10px] text-status-warning">
                        缺：{idea.missingItems.map((key) => MISSING_LABEL[key] || key).join('、')}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="outline" disabled={busy === `score:${idea.id}`} onClick={() => void handleScore(idea.id)}>
                        <Sparkles className="mr-1 h-3 w-3" />{busy === `score:${idea.id}` ? '计算中…' : '算机会分'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === `brief:${idea.id}`} onClick={() => void handleCreateBrief(idea)}>
                        <PenLine className="mr-1 h-3 w-3" />生成简报
                      </Button>
                    </div>
                  </div>
                  {idea.scoreDetail?.note && (
                    <p className="mt-1 text-[10px] text-[var(--text-subtle)]">{idea.scoreDetail.note}</p>
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* ② 脚本工坊 */}
        <Card>
          <CardHeader title="脚本工坊" subtitle="版本留痕 + 违禁词门禁 + 分镜" actions={<Badge variant="info">{briefs.length} 份简报</Badge>} />
          <CardBody className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {briefs.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void openBrief(item.id)}
                  className={`rounded border px-2 py-1 text-[11px] ${
                    brief?.id === item.id
                      ? 'border-status-ai text-status-ai'
                      : 'border-orbit-border text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {item.title}
                  <span className="ml-1 text-[10px] text-[var(--text-subtle)]">({item.scriptCount})</span>
                </button>
              ))}
            </div>
            {brief ? (
              <>
                <div className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  <p className="text-[var(--text-primary)]">{brief.title}</p>
                  <p>{brief.objective || '未填写目标'} · 要点 {brief.keyPoints.length} 条</p>
                  {brief.keyPoints.length > 0 && (
                    <p className="mt-1 text-[10px] text-[var(--text-subtle)]">{brief.keyPoints.join(' / ')}</p>
                  )}
                </div>
                <div className="space-y-1">
                  {brief.scripts.map((script) => (
                    <div key={script.id} className="rounded border border-orbit-border px-3 py-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">v{script.version}{script.variant}</Badge>
                        <span className="text-[var(--text-primary)]">{script.title}</span>
                        <Badge variant={script.complianceStatus === 'passed' ? 'success' : 'danger'}>
                          {script.complianceStatus === 'passed' ? '合规' : '违禁词未过'}
                        </Badge>
                        <Badge variant={script.status === 'approved' ? 'success' : 'info'}>{script.status}</Badge>
                        <span className="text-[var(--text-subtle)]">{script.wordsCount} 字</span>
                        <div className="ml-auto flex gap-1">
                          <Button size="sm" variant="outline" disabled={busy === `storyboard:${script.id}`} onClick={() => void handleStoryboard(script.id)}>
                            <Wand2 className="mr-1 h-3 w-3" />分镜
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={script.complianceStatus !== 'passed' || script.status === 'approved' || busy === `approve:${script.id}`}
                            onClick={() => void handleApprove(script.id)}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />通过
                          </Button>
                        </div>
                      </div>
                      <p className="mt-1 truncate text-[var(--text-muted)]">{script.hook}</p>
                      <p className="truncate text-[10px] text-[var(--text-subtle)]">{script.body.join(' / ')}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 border-t border-[var(--border)] pt-2">
                  <input
                    value={hook}
                    onChange={(event) => setHook(event.target.value)}
                    placeholder="钩子（首句）"
                    className="w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-1.5 text-xs text-[var(--text-primary)]"
                  />
                  <textarea
                    rows={3}
                    value={bodyText}
                    onChange={(event) => setBodyText(event.target.value)}
                    placeholder="正文要点，每行一条"
                    className="w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-1.5 text-xs text-[var(--text-primary)]"
                  />
                  <div className="flex gap-2">
                    <input
                      value={cta}
                      onChange={(event) => setCta(event.target.value)}
                      placeholder="行动号召"
                      className="flex-1 rounded-lg border border-orbit-border bg-orbit-ink px-3 py-1.5 text-xs text-[var(--text-primary)]"
                    />
                    <Button size="sm" variant="primary" disabled={busy === 'script'} onClick={handleCreateScript}>
                      生成脚本
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">选择一份简报查看脚本与分镜。</p>
            )}
          </CardBody>
        </Card>

        {/* ③ 素材参考 */}
        <Card>
          <CardHeader title="素材参考" subtitle="素材、BGM 与可用模板" />
          <CardBody className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: '媒体素材', value: overview?.assets.mediaCount ?? 0, icon: Library },
                { label: 'BGM', value: overview?.assets.bgmCount ?? 0, icon: Sparkles },
                { label: '可用模板', value: overview?.assets.templateCount ?? 0, icon: PenLine },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-2 py-3">
                  <item.icon className="mx-auto mb-1 h-4 w-4 text-[var(--text-muted)]" />
                  <p className="text-lg font-bold text-[var(--text-primary)]">{item.value}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              脚本事实必须来自商品库；素材不足时先补充素材，不生成无法落地的镜头。
            </p>
          </CardBody>
        </Card>

        {/* ④ 发布日历 */}
        <Card>
          <CardHeader title="发布日历" subtitle="未来节点与平台大促" actions={<Badge variant="info">{overview?.calendar.length ?? 0} 个</Badge>} />
          <CardBody className="space-y-1">
            {(overview?.calendar || []).length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">暂无节点，可在日历中补充。</p>
            ) : (
              overview?.calendar.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-2 rounded border border-orbit-border px-3 py-1.5 text-[11px]">
                  <CalendarDays className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-primary)]">{item.name}</span>
                  <span className="text-[var(--text-muted)]">{item.startDate} → {item.endDate}</span>
                  <Badge variant={item.importance >= 5 ? 'danger' : item.importance >= 4 ? 'warning' : 'info'}>
                    重要度 {item.importance}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* ⑤ 数据回看 */}
        <Card className="lg:col-span-2">
          <CardHeader title="数据回看" subtitle="脚本版本 ↔ 视频指标回流" actions={<Badge variant="info">{overview?.performance.links ?? 0} 条关联</Badge>} />
          <CardBody className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                <p className="text-[10px] text-[var(--text-muted)]">近 30 天平均播放</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{Math.round(overview?.performance.avgPlays ?? 0).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                <p className="text-[10px] text-[var(--text-muted)]">脚本 ↔ 指标关联</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{overview?.performance.links ?? 0}</p>
              </div>
              <div className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                <p className="text-[10px] text-[var(--text-muted)]">最近脚本</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{overview?.scripts.length ?? 0}</p>
              </div>
            </div>
            <div className="space-y-1">
              {(overview?.scripts || []).slice(0, 6).map((script) => (
                <div key={script.id} className="flex flex-wrap items-center gap-2 rounded border border-orbit-border px-3 py-1.5 text-[11px]">
                  <BarChart3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span className="text-[var(--text-primary)]">{script.title || script.briefTitle || '未命名脚本'}</span>
                  <Badge variant="info">v{script.version}{script.variant}</Badge>
                  <Badge variant={script.complianceStatus === 'passed' ? 'success' : 'danger'}>{script.complianceStatus}</Badge>
                  <span className="ml-auto text-[var(--text-subtle)]">{String(script.createdAt).slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
