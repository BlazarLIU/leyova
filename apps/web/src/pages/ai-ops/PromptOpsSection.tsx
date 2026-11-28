/**
 * PromptOpsSection.tsx — W10 提示词模板、版本、灰度与生成工作台
 *
 * 三块：
 *   1. 模板与版本：查看版本历史、新增版本、灰度比例、回滚；
 *   2. 生成：选模板填变量 → 生成 → 展示引用与合规命中；
 *   3. 审核队列：采纳（同步入库话术库）/ 驳回，展示采纳率。
 */

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, FileText, CheckCircle2, XCircle, RefreshCw, ShieldAlert, GitBranch } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

interface PromptVariable {
  name: string
  required?: boolean
  description?: string
}

interface PromptTemplate {
  id: string
  key: string
  name: string
  scene: string
  platform: string
  category: string
  description: string
  variables: PromptVariable[]
  activeVersion: number
  canaryVersion: number | null
  canaryRatio: number
  status: string
}

interface PromptVersion {
  id: string
  version: number
  systemPrompt: string
  userTemplate: string
  notes: string
  createdAt: string
}

interface Draft {
  id: string
  templateKey: string
  templateVersion: number
  scene: string
  title: string
  content: string
  citations: Array<{ chunkId: string; documentName: string; score: number }>
  compliance: { blocked?: boolean; hits?: Array<{ word: string; action: string }> }
  status: string
  reviewNote: string
  model: string
  tokensUsed: number
  latencyMs: number
  degraded: boolean
  createdAt: string
}

interface Stats {
  pending: number
  approved: number
  rejected: number
  blocked: number
  total: number
  adoptionRate: number
  avgLatencyMs: number
  totalCostCny: number
}

interface GenerateResult {
  draftId: string
  templateKey: string
  templateVersion: number
  isCanary: boolean
  title: string
  content: string
  citations: Array<{ chunkId: string; documentName: string; snippet: string; score: number }>
  compliance: { blocked: boolean; hits: Array<{ word: string; action: string }>; ruleCount: number }
  status: string
  model: string
  tokensUsed: number
  costCny: number
  latencyMs: number
  degraded: boolean
  degradedReason?: string
}

const SCENE_LABEL: Record<string, string> = {
  script: '脚本',
  copy: '文案',
  title: '标题',
  reply: '回复',
  analysis: '分析',
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: '待审核',
  approved: '已采纳',
  rejected: '已驳回',
  blocked: '违规阻断',
}

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export function PromptOpsSection() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [activeTemplate, setActiveTemplate] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [variables, setVariables] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GenerateResult | null>(null)

  const [canaryVersion, setCanaryVersion] = useState('')
  const [canaryRatio, setCanaryRatio] = useState('30')

  const currentTemplate = templates.find((t) => t.key === activeTemplate) || null

  const load = useCallback(async (templateKey?: string) => {
    setLoading(true)
    const [tpl, draftList, st] = await Promise.all([
      api.get<any>('/prompts/templates').catch(() => null),
      api.get<any>('/generation/drafts', { limit: 20 }).catch(() => null),
      api.get<Stats>('/generation/stats').catch(() => null),
    ])
    const items: PromptTemplate[] = Array.isArray(tpl?.items) ? tpl.items : []
    if (tpl) setTemplates(items)
    if (draftList) setDrafts(Array.isArray(draftList.items) ? draftList.items : [])
    if (st) setStats(st)

    const target = templateKey || activeTemplate || items[0]?.key
    if (target) {
      setActiveTemplate(target)
      const v = await api.get<any>(`/prompts/templates/${target}/versions`).catch(() => null)
      if (v) setVersions(Array.isArray(v.items) ? v.items : [])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectTemplate = async (key: string) => {
    setActiveTemplate(key)
    setGenerated(null)
    setVariables({})
    const v = await api.get<any>(`/prompts/templates/${key}/versions`).catch(() => null)
    if (v) setVersions(Array.isArray(v.items) ? v.items : [])
  }

  const handleGenerate = async () => {
    if (!currentTemplate || generating) return
    setGenerating(true)
    setMessage('')
    setGenerated(null)
    try {
      const res = await api.post<GenerateResult>('/generation/drafts', {
        templateKey: currentTemplate.key,
        variables,
      })
      setGenerated(res)
      setMessage(
        res.compliance.blocked
          ? `已生成但被合规阻断：${res.compliance.hits.map((h) => h.word).join('、')}`
          : res.degraded
            ? `已生成（模型降级：${res.degradedReason || '未配置模型'}），待人工审核`
            : '已生成，待人工审核'
      )
      await load(currentTemplate.key)
    } catch (err: any) {
      setMessage(err?.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleReview = async (draftId: string, decision: 'approve' | 'reject') => {
    setMessage('')
    try {
      const res = await api.post<any>(`/generation/drafts/${draftId}/review`, { decision })
      setMessage(
        decision === 'approve'
          ? `已采纳${res?.scriptId ? `，同步写入话术库 #${res.scriptId}` : ''}`
          : '已驳回'
      )
      await load()
    } catch (err: any) {
      setMessage(err?.message || '审核失败')
    }
  }

  const handleCanary = async () => {
    if (!currentTemplate) return
    const version = Number(canaryVersion)
    const ratio = Number(canaryRatio)
    if (!Number.isFinite(version) || version < 1) {
      setMessage('请填写灰度版本号')
      return
    }
    try {
      await api.post(`/prompts/templates/${currentTemplate.key}/canary`, { version, ratio })
      setMessage(`已设置灰度：v${version} 占 ${ratio}%`)
      await load(currentTemplate.key)
    } catch (err: any) {
      setMessage(err?.message || '设置灰度失败')
    }
  }

  const handleRollback = async (version: number) => {
    if (!currentTemplate) return
    try {
      await api.post(`/prompts/templates/${currentTemplate.key}/rollback`, { version })
      setMessage(`已回滚到 v${version}，灰度已清空`)
      await load(currentTemplate.key)
    } catch (err: any) {
      setMessage(err?.message || '回滚失败')
    }
  }

  return (
    <motion.div {...fadeIn} className="space-y-5">
      {message && <p className="text-xs text-[var(--text-muted)]">{message}</p>}

      {/* 采纳率 */}
      <Card>
        <CardHeader
          title="PromptOps"
          subtitle="版本不可变、支持灰度与回滚；生成内容必须先过合规闸门，采纳后才入话术库。"
          actions={<Button size="sm" variant="outline" onClick={() => void load()}>{loading ? '加载中…' : '刷新'}</Button>}
        />
        <CardBody className="space-y-3">
          {stats && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {[
                ['采纳率', `${(stats.adoptionRate * 100).toFixed(1)}%`],
                ['待审核', stats.pending],
                ['已采纳', stats.approved],
                ['违规阻断', stats.blocked],
                ['平均耗时', `${stats.avgLatencyMs}ms`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                  <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{String(value)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => (
              <button
                key={tpl.key}
                onClick={() => void selectTemplate(tpl.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  activeTemplate === tpl.key
                    ? 'border-status-ai text-[var(--text-primary)] bg-orbit-surface2'
                    : 'border-orbit-border text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tpl.name}
                <span className="ml-1.5 text-[10px] text-[var(--text-subtle)]">
                  {SCENE_LABEL[tpl.scene] || tpl.scene} · v{tpl.activeVersion}
                  {tpl.canaryVersion ? ` / 灰度v${tpl.canaryVersion}@${tpl.canaryRatio}%` : ''}
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {currentTemplate && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* 生成 */}
          <Card>
            <CardHeader
              title={`生成 · ${currentTemplate.name}`}
              subtitle={currentTemplate.description || '填写变量后生成，结果进入审核队列'}
            />
            <CardBody className="space-y-2">
              {currentTemplate.variables.map((v) => (
                <input
                  key={v.name}
                  placeholder={`${v.name}${v.required ? '（必填）' : ''}${v.description ? ` — ${v.description}` : ''}`}
                  value={variables[v.name] || ''}
                  onChange={(e) => setVariables((prev) => ({ ...prev, [v.name]: e.target.value }))}
                  className="w-full rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              ))}
              <Button size="sm" variant="primary" disabled={generating} onClick={handleGenerate}>
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                {generating ? '生成中…' : '生成'}
              </Button>

              {generated && (
                <div className="space-y-2 rounded-lg border border-orbit-border bg-orbit-surface2/40 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge variant={generated.compliance.blocked ? 'danger' : 'success'}>
                      {generated.compliance.blocked ? '合规阻断' : '合规通过'}
                    </Badge>
                    <Badge variant="info">v{generated.templateVersion}{generated.isCanary ? ' · 灰度' : ''}</Badge>
                    {generated.degraded && <Badge variant="warning">模型降级</Badge>}
                    <span className="text-[var(--text-muted)]">
                      {generated.model || '—'} · {generated.tokensUsed} tokens · {generated.latencyMs}ms
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-[var(--text-secondary)]">{generated.content || '（无内容）'}</pre>
                  {generated.compliance.hits.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {generated.compliance.hits.map((hit, i) => (
                        <Badge key={`${hit.word}-${i}`} variant="danger">{hit.word} · {hit.action}</Badge>
                      ))}
                    </div>
                  )}
                  {generated.citations.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-[var(--text-muted)]">引用 {generated.citations.length} 条</p>
                      {generated.citations.map((c) => (
                        <p key={c.chunkId} className="text-[11px] text-[var(--text-subtle)] truncate">
                          《{c.documentName}》 · {Math.round(c.score * 100)}%
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* 版本与灰度 */}
          <Card>
            <CardHeader title="版本与灰度" subtitle="历史版本不可改；灰度按业务键稳定分配，便于对比效果。" />
            <CardBody className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  placeholder="灰度版本号"
                  value={canaryVersion}
                  onChange={(e) => setCanaryVersion(e.target.value)}
                  className="w-28 rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <input
                  placeholder="比例 %"
                  value={canaryRatio}
                  onChange={(e) => setCanaryRatio(e.target.value)}
                  className="w-20 rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <Button size="sm" variant="outline" onClick={handleCanary}>
                  <GitBranch className="mr-1 h-3 w-3" />设置灰度
                </Button>
              </div>
              <div className="space-y-1">
                {versions.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-2 rounded border border-orbit-border px-2 py-1.5 text-[11px]">
                    <Badge variant={v.version === currentTemplate.activeVersion ? 'success' : 'info'}>v{v.version}</Badge>
                    {v.version === currentTemplate.activeVersion && <span className="text-status-success">生效中</span>}
                    {v.version === currentTemplate.canaryVersion && <span className="text-status-warning">灰度中</span>}
                    <span className="text-[var(--text-muted)]">{v.notes || '—'}</span>
                    <span className="ml-auto text-[var(--text-subtle)]">{String(v.createdAt).slice(0, 19).replace('T', ' ')}</span>
                    {v.version !== currentTemplate.activeVersion && (
                      <Button size="sm" variant="outline" onClick={() => handleRollback(v.version)}>回滚</Button>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* 审核队列 */}
      <Card>
        <CardHeader
          title="审核队列"
          subtitle="采纳会同步写入话术库；命中阻断词的草稿不可采纳。"
          actions={<Badge variant="info">{drafts.length} 条</Badge>}
        />
        <CardBody className="space-y-2">
          {drafts.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">暂无草稿，先在上方生成一条</p>
          ) : (
            drafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-primary)]">{draft.title}</span>
                  <Badge variant="info">{draft.templateKey} v{draft.templateVersion}</Badge>
                  <Badge
                    variant={
                      draft.status === 'approved' ? 'success'
                        : draft.status === 'blocked' ? 'danger'
                          : draft.status === 'rejected' ? 'warning' : 'info'
                    }
                  >
                    {STATUS_LABEL[draft.status] || draft.status}
                  </Badge>
                  {draft.degraded && <Badge variant="warning">降级</Badge>}
                  <span className="text-[var(--text-muted)]">{draft.tokensUsed} tokens · {draft.latencyMs}ms</span>
                  <span className="ml-auto text-[var(--text-subtle)]">{String(draft.createdAt).slice(0, 19).replace('T', ' ')}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{draft.content}</p>
                {Array.isArray(draft.compliance?.hits) && draft.compliance.hits.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {draft.compliance.hits.map((hit: any, i: number) => (
                      <Badge key={`${hit.word}-${i}`} variant="danger">
                        <ShieldAlert className="mr-1 h-3 w-3" />{hit.word}
                      </Badge>
                    ))}
                  </div>
                )}
                {draft.status === 'pending_review' && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="primary" onClick={() => handleReview(draft.id, 'approve')}>
                      <CheckCircle2 className="mr-1 h-3 w-3" />采纳并入库
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReview(draft.id, 'reject')}>
                      <XCircle className="mr-1 h-3 w-3" />驳回
                    </Button>
                  </div>
                )}
                {draft.reviewNote && <p className="mt-1 text-[11px] text-[var(--text-subtle)]">备注：{draft.reviewNote}</p>}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
        <RefreshCw className="h-3 w-3" />
        <span>采纳率 = 已采纳 /（已采纳 + 已驳回），违规阻断不计入分母。</span>
      </div>
    </motion.div>
  )
}