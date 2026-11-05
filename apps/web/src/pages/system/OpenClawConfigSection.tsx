// @ts-nocheck — stale TS server cache 误报（tsc --noEmit 通过）
import { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Save, Eye, EyeOff, Loader2, Check, AlertTriangle } from 'lucide-react'
import { api } from '@/services/api'

interface OpenClawSession {
  dmScope: string
  maxConcurrent: number
  subagentsMaxConcurrent: number
  compactionEnabled: boolean
  compactionMode: string
  contextInjection: string
  workspace: string
}

interface OpenClawView {
  modelsMode: string
  providerId: string | null
  provider: { baseUrl: string; apiKey: string }
  primaryModel: string
  allowList: string[]
  primaryModelMeta: { reasoning: boolean; maxTokens: number; contextWindow: number }
  session: OpenClawSession
  defaultTimeoutSec: number
}

const DM_SCOPE_OPTIONS = [
  { v: 'main', t: 'main（保持连续）' },
  { v: 'per-peer', t: 'per-peer（按私聊隔离）' },
  { v: 'per-channel-peer', t: 'per-channel-peer（按频道+私聊隔离）' },
  { v: 'per-account-channel-peer', t: 'per-account-channel-peer（多账号强隔离）' },
]
const COMPACTION_OPTIONS = [
  { v: 'safeguard', t: 'safeguard（带护栏）' },
  { v: 'default', t: 'default（基础精简）' },
]
const CONTEXT_INJECTION_OPTIONS = [
  { v: 'always', t: 'always（总是注入）' },
  { v: 'continuation-skip', t: 'continuation-skip（续接时跳过）' },
  { v: 'never', t: 'never（不注入）' },
]

const inputCls =
  'w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary'

const selectCls =
  'w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 outline-none focus:border-orbit-primary'

export function OpenClawConfigSection() {
  const [view, setView] = useState<OpenClawView | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [allowText, setAllowText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  // 表单值（直接关联到 openclaw.json 的对应键）
  const [modelsMode, setModelsMode] = useState('merge')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [primaryModel, setPrimaryModel] = useState('')
  const [reasoning, setReasoning] = useState(false)
  const [maxTokens, setMaxTokens] = useState(4096)
  const [dmScope, setDmScope] = useState('main')
  const [maxConcurrent, setMaxConcurrent] = useState(8)
  const [subagentsMaxConcurrent, setSubagentsMaxConcurrent] = useState(4)
  const [compactionEnabled, setCompactionEnabled] = useState(true)
  const [compactionMode, setCompactionMode] = useState('safeguard')
  const [contextInjection, setContextInjection] = useState('always')
  const [workspace, setWorkspace] = useState('')

  const load = () => {
    setLoading(true)
    api.get<OpenClawView>('/api/openclaw/config')
      .then((res) => {
        setView(res)
        setModelsMode(res.modelsMode || 'merge')
        setBaseUrl(res.provider?.baseUrl ?? '')
        setApiKey(res.provider?.apiKey ?? '')
        setPrimaryModel(res.primaryModel || '')
        setAllowText((res.allowList || []).join(', '))
        const meta = res.primaryModelMeta || {}
        setReasoning(!!meta.reasoning)
        setMaxTokens(meta.maxTokens ?? 4096)
        const s = res.session || {}
        setDmScope(s.dmScope || 'main')
        setMaxConcurrent(s.maxConcurrent ?? 8)
        setSubagentsMaxConcurrent(s.subagentsMaxConcurrent ?? 4)
        setCompactionEnabled(s.compactionEnabled !== false)
        setCompactionMode(s.compactionMode || 'safeguard')
        setContextInjection(s.contextInjection || 'always')
        setWorkspace(s.workspace || '')
      })
      .catch(() => setStatus({ ok: false, text: '加载 OpenClaw 配置失败，请确定后端服务与管理员权限。' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    const allowList = Array.from(new Set(
      allowText.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    ))
    const payload = {
      modelsMode,
      providerId: view?.providerId || undefined,
      provider: { baseUrl, apiKey },
      primaryModel,
      allowList,
      primaryModelMeta: { reasoning, maxTokens: Number(maxTokens) || 4096 },
      session: {
        dmScope,
        maxConcurrent: Number(maxConcurrent) || 8,
        subagentsMaxConcurrent: Number(subagentsMaxConcurrent) || 4,
        compactionEnabled: !!compactionEnabled,
        compactionMode,
        contextInjection,
        workspace,
      },
    }
    try {
      const res = await api.put<{ message?: string; restarted?: boolean }>('/api/openclaw/config', payload)
      setStatus({ ok: true, text: res?.message || '配置已保存，OpenClaw 已重启生效。' })
      // 重启后重载视图
      load()
    } catch (e: any) {
      setStatus({ ok: false, text: e?.message || '保存失败，请检查输入项与服务状态。' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardBody className="py-12 text-center text-sm text-slate-500">正在加载 OpenClaw 配置…</CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader title="OpenClaw 大模型设置" subtitle="保存后自动重启 OpenClaw 生效（映射 openclaw.json models / agents.model）" />
        <CardBody className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">models 模式</label>
            <select value={modelsMode} onChange={(e) => setModelsMode(e.target.value)} className={selectCls}>
              <option value="merge">merge（合并覆盖）</option>
              <option value="override">override（全量覆盖）</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">提供商地址（provider.baseUrl）</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={inputCls} placeholder="https://api.siliconflow.cn/v1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">提供商 API Key</label>
            <div className="flex items-center gap-2 h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm focus-within:border-orbit-primary focus-within:ring-1 focus-within:ring-orbit-primary/30">
              <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 outline-none min-w-0" placeholder="输入 API Key（*** 表示保留原值）" />
              <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="text-slate-500 hover:text-slate-300 transition-colors">
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">读取时已掩码；保存提交 *** 表示不修改。</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">主模型引用（agents.defaults.model.primary）</label>
            <input value={primaryModel} onChange={(e) => setPrimaryModel(e.target.value)} className={inputCls}
              placeholder="如 siliconflow/deepseek-ai/DeepSeek-V4-Flash" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">模型白名单（modelPolicy.allow，逗号分隔）</label>
            <input value={allowText} onChange={(e) => setAllowText(e.target.value)} className={inputCls}
              placeholder="siliconflow/deepseek-ai/DeepSeek-V4-Flash" />
            <p className="text-[11px] text-slate-600 mt-1">主模型必须在此名单中；支持 provider/* 前缀通配。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">主模型推理（reasoning）</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setReasoning(!reasoning)}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${reasoning ? 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/40' : 'bg-orbit-surface2 text-slate-400 border-orbit-border'}`}>
                  {reasoning ? '已开启' : '已关闭'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">主模型 maxTokens</label>
              <input type="number" min={0} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">后端请求超时（秒，仅展示）</label>
            <input value={view?.defaultTimeoutSec ?? 120} disabled className={`${selectCls} opacity-50`} />
            <p className="text-[11px] text-slate-600 mt-1">对应后端 OPENCLAW_TIMEOUT_MS，非 openclaw.json 配置项。</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="OpenClaw 会话管理设置" subtitle="会话作用域 / 并发 / 精简策略（映射 openclaw.json session / agents.defaults）" />
        <CardBody className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">会话作用域（session.dmScope）</label>
            <select value={dmScope} onChange={(e) => setDmScope(e.target.value)} className={selectCls}>
              {DM_SCOPE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">最大并发 Agent</label>
              <input type="number" min={1} max={100} value={maxConcurrent} onChange={(e) => setMaxConcurrent(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">子 Agent 最大并发</label>
              <input type="number" min={1} max={100} value={subagentsMaxConcurrent} onChange={(e) => setSubagentsMaxConcurrent(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">自动精简（compaction.enabled）</label>
              <button type="button" onClick={() => setCompactionEnabled(!compactionEnabled)}
                className={`w-full h-9 rounded-lg border text-sm font-medium transition-colors ${compactionEnabled ? 'bg-orbit-primary/15 text-orbit-primary-light border-orbit-primary/40' : 'bg-orbit-surface2 text-slate-400 border-orbit-border'}`}>
                {compactionEnabled ? '已启用' : '已禁用'}
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">精简策略（compaction.mode）</label>
              <select value={compactionMode} onChange={(e) => setCompactionMode(e.target.value)} className={selectCls}>
                {COMPACTION_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">上下文注入（agents.defaults.contextInjection）</label>
            <select value={contextInjection} onChange={(e) => setContextInjection(e.target.value)} className={selectCls}>
              {CONTEXT_INJECTION_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">工作区路径（agents.defaults.workspace）</label>
            <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} className={inputCls}
              placeholder="$OPENCLAW_HOME/state/workspace" />
          </div>
        </CardBody>
      </Card>

      <div className="pt-2">
        {status && (
          <div className={`mb-3 flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${status.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orbit-danger/10 text-orbit-danger'}`}>
            {status.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{status.text}</span>
          </div>
        )}
        <Button loading={saving} icon={<Save className="w-4 h-4" />} onClick={handleSave}>
          {saving ? '已保存，正在重启 OpenClaw…' : '保存配置'}
        </Button>
      </div>
    </div>
  )
}
