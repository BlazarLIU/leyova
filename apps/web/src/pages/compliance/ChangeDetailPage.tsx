import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Layers,
  ShoppingBag,
  FileText,
} from 'lucide-react'
import { api } from '../../services/api'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

interface ChangeDetail {
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
  content_text: string
  effective_at: string | null
  published_at: string | null
  created_at: string
}

interface AssessmentDetail {
  id: number
  change_id: number
  risk_summary: string
  operational_impact: string
  recommended_actions: string[]
  evidence_refs: Array<{ source: string; url?: string }>
  assessed_by: string
  created_at: string
}

export function ChangeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [change, setChange] = useState<ChangeDetail | null>(null)
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acking, setAcking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const res = await api.get<{
          change: ChangeDetail
          assessment: AssessmentDetail | null
        }>(`/compliance/changes/${id}/assessment`)

        setChange(res.change)
        setAssessment(res.assessment)
      } catch (err: any) {
        setError(err.message || '获取变更评估失败')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchDetail()
    }
  }, [id])

  const handleAck = async () => {
    if (!id || !change) return
    setAcking(true)
    try {
      await api.post(`/compliance/changes/${id}/ack`, {})
      setChange({
        ...change,
        is_read: true,
        read_at: new Date().toISOString(),
      })
    } catch (err: any) {
      alert(`标记失败: ${err.message || '未知错误'}`)
    } finally {
      setAcking(false)
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="danger" dot>极高危阻断 (Critical)</Badge>
      case 'high':
        return <Badge variant="warning" dot>高危警示 (High)</Badge>
      case 'medium':
        return <Badge variant="info">中度合规 (Medium)</Badge>
      default:
        return <Badge variant="neutral">普通参考 (Low)</Badge>
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Sparkles className="w-8 h-8 animate-spin text-violet-400 mx-auto mb-3" />
        加载合规变更及 AI 风险评估中...
      </div>
    )
  }

  if (error || !change) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="text-red-400 font-bold">{error || '未找到该变更记录'}</div>
        <Button variant="outline" onClick={() => navigate('/compliance/rules')}>
          返回规则雷达
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Bar / Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/compliance/rules')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回平台规则雷达
        </button>

        <div className="flex items-center gap-3">
          {change.is_read ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>已于 {new Date(change.read_at!).toLocaleString('zh-CN')} 确认知晓</span>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={handleAck}
              disabled={acking}
              className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              {acking ? '提交中...' : '确认已读并同步排班/选品团队'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Header Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-orbit-surface to-orbit-surface/60 border border-orbit-border space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
            {change.platform_name || change.platform_code}
          </span>
          {getSeverityBadge(change.severity)}
          <span className="text-xs px-2.5 py-1 rounded bg-orbit-surface2 text-slate-300 font-mono">
            {change.change_type === 'new' ? '全新发布' : change.change_type === 'revised' ? '规则修订' : '废止'}
          </span>
          <span className="text-xs text-slate-400">
            检出时间: {new Date(change.created_at).toLocaleString('zh-CN')}
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-orbit-text tracking-tight flex items-center gap-3">
            {change.rule_title}
            {change.source_url && change.source_url.startsWith('http') && (
              <a
                href={change.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-violet-400 text-sm font-normal inline-flex items-center gap-1"
              >
                平台原文
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </h1>
          <p className="text-sm text-slate-300 mt-2 font-mono">
            外部编号: {change.external_id} | 类目分类: {change.rule_category} | 预计生效时间:{' '}
            {change.effective_at ? new Date(change.effective_at).toLocaleDateString('zh-CN') : '即时生效'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 text-violet-200 text-sm leading-relaxed">
          <strong className="text-violet-300">变更差量摘要：</strong>
          {change.diff_summary}
        </div>
      </div>

      {/* Two Column Layout: Left = Full Text / Right = AI Risk Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Snapshot Full Text */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 bg-orbit-surface border-orbit-border space-y-3">
            <div className="flex items-center justify-between border-b border-orbit-border pb-3">
              <h3 className="text-sm font-bold text-orbit-text flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                规则原文快照 (SHA-256 哈希防伪)
              </h3>
            </div>

            <div className="text-xs text-slate-300 font-mono bg-orbit-surface2/60 p-4 rounded-xl border border-orbit-border/40 whitespace-pre-wrap leading-relaxed max-h-[550px] overflow-y-auto">
              {change.content_text}
            </div>
          </Card>
        </div>

        {/* Right Column (7 cols): AI Risk Assessment & Actions */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-6 bg-orbit-surface border-violet-500/30 shadow-xl shadow-violet-950/20 space-y-5">
            <div className="flex items-center justify-between border-b border-orbit-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-orbit-text">AI 风险与运营影响智能研判</h3>
                  <div className="text-xs text-slate-400">
                    评估引擎: {assessment?.assessed_by || 'AI_RISK_ENGINE'}
                  </div>
                </div>
              </div>
            </div>

            {assessment ? (
              <div className="space-y-4">
                {/* Risk Summary */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    核心风险摘要
                  </h4>
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm font-medium">
                    {assessment.risk_summary}
                  </div>
                </div>

                {/* Operational Impact */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    对业务与排班的实质影响
                  </h4>
                  <p className="text-sm text-slate-300 bg-orbit-surface2/40 p-3.5 rounded-xl border border-orbit-border/40 leading-relaxed">
                    {assessment.operational_impact}
                  </p>
                </div>

                {/* Recommended Actions */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    建议应对闭环措施 (Checklist)
                  </h4>
                  <div className="space-y-2">
                    {assessment.recommended_actions?.map((act, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-orbit-surface2/60 border border-orbit-border/50 text-xs text-slate-200 flex items-start gap-2.5"
                      >
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence citation */}
                {assessment.evidence_refs && assessment.evidence_refs.length > 0 && (
                  <div className="text-xs text-slate-400 pt-2 border-t border-orbit-border flex items-center gap-2">
                    <span>证据链原文引用:</span>
                    {assessment.evidence_refs.map((ref, idx) => (
                      <span key={idx} className="font-mono text-violet-400">
                        {ref.source}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                暂无专门生成的 AI 风险评估记录
              </div>
            )}
          </Card>

          {/* Quick Integration Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              onClick={() => navigate('/ai/selection')}
              className="p-4 bg-orbit-surface border-orbit-border hover:border-violet-500 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 group-hover:scale-105 transition-transform">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-orbit-text group-hover:text-violet-300">
                    去多因子 AI 选品
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    基于合规红线过滤不可售/违禁品类
                  </p>
                </div>
              </div>
            </Card>

            <Card
              onClick={() => navigate('/ops/script-library')}
              className="p-4 bg-orbit-surface border-orbit-border hover:border-violet-500 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-orbit-text group-hover:text-indigo-300">
                    话术模板库合规校验
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    核验话术模板中的违禁词与合规规范
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
export default ChangeDetailPage
