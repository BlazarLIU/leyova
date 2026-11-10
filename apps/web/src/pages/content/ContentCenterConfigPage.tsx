import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Server, Plus, Trash2, CheckCircle, XCircle, RefreshCw, BookOpen, Save, Plug,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Provider {
  id: number
  name: string
  provider_type: string
  base_url: string
  is_enabled: boolean
  is_default: boolean
  last_checked_at: string | null
  last_check_result: string | null
}

interface KbConfig {
  provider: 'ragflow' | 'maxkb' | 'none'
  baseUrl: string
  apiKeyConfigured: boolean
  apiKeyMasked: string
  datasetIds: string[]
  topK: number
  similarityThreshold: number
  configured: boolean
}

export function ContentCenterConfigPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [kb, setKb] = useState<KbConfig | null>(null)
  const [kbDraft, setKbDraft] = useState({ provider: 'none' as string, baseUrl: '', apiKey: '', datasetIds: '', topK: 5 })
  const [testing, setTesting] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; message: string }>>({})
  const [kbTesting, setKbTesting] = useState(false)
  const [kbTestResult, setKbTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', providerType: 'comfyui', baseUrl: '' })
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, k] = await Promise.all([
        api.get<Provider[]>('/content/providers'),
        api.get<KbConfig>('/kb/config'),
      ])
      setProviders(p || [])
      setKb(k)
      setKbDraft({
        provider: k.provider,
        baseUrl: k.baseUrl,
        apiKey: '',
        datasetIds: k.datasetIds.join(','),
        topK: k.topK,
      })
    } catch (e: any) {
      setMsg(e?.message || '加载失败')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addProvider = async () => {
    if (!form.name || !form.baseUrl) { setMsg('请填写名称与服务地址'); return }
    try {
      await api.post('/content/providers', form)
      setForm({ name: '', providerType: 'comfyui', baseUrl: '' })
      setMsg('生成服务已添加')
      load()
    } catch (e: any) { setMsg(e?.message || '添加失败') }
  }

  const testProvider = async (id: number) => {
    setTesting(id)
    try {
      const r = await api.post<{ ok: boolean; message: string }>(`/content/providers/${id}/test`)
      setTestResults((t) => ({ ...t, [id]: r }))
    } catch (e: any) {
      setTestResults((t) => ({ ...t, [id]: { ok: false, message: e?.message || '测试失败' } }))
    } finally {
      setTesting(null)
      load()
    }
  }

  const removeProvider = async (id: number) => {
    try {
      await api.delete(`/content/providers/${id}`)
      load()
    } catch (e: any) { setMsg(e?.message || '删除失败') }
  }

  const saveKb = async () => {
    setSaving(true)
    try {
      await api.put('/kb/config', {
        provider: kbDraft.provider,
        baseUrl: kbDraft.baseUrl,
        apiKey: kbDraft.apiKey,
        datasetIds: kbDraft.datasetIds,
        topK: kbDraft.topK,
      })
      setMsg('知识库配置已保存')
      setKbDraft((d) => ({ ...d, apiKey: '' }))
      load()
    } catch (e: any) { setMsg(e?.message || '保存失败') }
    finally { setSaving(false) }
  }

  const testKb = async () => {
    setKbTesting(true)
    try {
      const r = await api.post<{ ok: boolean; message: string }>('/kb/test')
      setKbTestResult(r)
    } catch (e: any) {
      setKbTestResult({ ok: false, message: e?.message || '测试失败' })
    } finally { setKbTesting(false) }
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <h1 className="text-2xl font-semibold text-slate-100">内容中心配置</h1>
        <p className="mt-1 text-sm text-slate-400">
          配置视频生成服务（ComfyUI）与企业知识库（RAGFlow / MaxKB）
        </p>
      </motion.div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-300">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs text-cyan-500 hover:text-cyan-300">关闭</button>
        </div>
      )}

      {/* 生成服务 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              视频生成服务
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="名称，如：本地 ComfyUI"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
              <select
                value={form.providerType}
                onChange={(e) => setForm({ ...form, providerType: e.target.value })}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                <option value="comfyui">ComfyUI</option>
                <option value="mock">Mock（演示用）</option>
              </select>
              <input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="http://192.168.1.10:8188"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              />
              <Button onClick={addProvider}>
                <Plus className="mr-1 h-4 w-4" /> 添加
              </Button>
            </div>

            {providers.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                尚未配置生成服务 · 可在本地部署 ComfyUI 后填入地址接入
              </p>
            ) : (
              <div className="space-y-2">
                {providers.map((p) => {
                  const tr = testResults[p.id]
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2">
                      <span className="text-sm font-medium text-slate-200">{p.name}</span>
                      <Badge variant={p.provider_type === 'mock' ? 'warning' : 'info'}>{p.provider_type}</Badge>
                      {p.is_default && <Badge variant="success">默认</Badge>}
                      <span className="font-mono text-xs text-slate-500">{p.base_url}</span>
                      <div className="ml-auto flex items-center gap-2">
                        {tr && (
                          <span className={cn('flex items-center gap-1 text-xs', tr.ok ? 'text-emerald-400' : 'text-rose-400')}>
                            {tr.ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {tr.message}
                          </span>
                        )}
                        <Button variant="ghost" onClick={() => testProvider(p.id)} disabled={testing === p.id}>
                          <Plug className="mr-1 h-3 w-3" />
                          {testing === p.id ? '测试中…' : '测试连接'}
                        </Button>
                        <Button variant="ghost" onClick={() => removeProvider(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* 企业知识库 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              企业知识库
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-xs text-slate-400">
              本系统<strong className="text-slate-300">不内置、不部署</strong>知识库引擎。
              如需 AI 助手引用运营规则、大促复盘、爆款卖点等资料，
              请自行部署 <span className="text-cyan-400">RAGFlow</span> 或 <span className="text-cyan-400">MaxKB</span>，
              然后在下方填入地址与 API Key 即可接入。
              <br />
              未配置时，AI 助手仅使用当前对话上下文，核心功能不受影响。
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">知识库类型</label>
                <select
                  value={kbDraft.provider}
                  onChange={(e) => setKbDraft({ ...kbDraft, provider: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="none">未启用</option>
                  <option value="ragflow">RAGFlow（推荐）</option>
                  <option value="maxkb">MaxKB</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">服务地址</label>
                <input
                  value={kbDraft.baseUrl}
                  onChange={(e) => setKbDraft({ ...kbDraft, baseUrl: e.target.value })}
                  placeholder="http://192.168.1.10:9380"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  API Key {kb?.apiKeyConfigured && <span className="text-slate-500">（已配置 {kb.apiKeyMasked}，留空则不修改）</span>}
                </label>
                <input
                  type="password"
                  value={kbDraft.apiKey}
                  onChange={(e) => setKbDraft({ ...kbDraft, apiKey: e.target.value })}
                  placeholder={kb?.apiKeyConfigured ? '••••••••（留空保持不变）' : 'ragflow-xxxxxxxx'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">数据集 ID（多个用逗号分隔）</label>
                <input
                  value={kbDraft.datasetIds}
                  onChange={(e) => setKbDraft({ ...kbDraft, datasetIds: e.target.value })}
                  placeholder="ds_xxx,ds_yyy（留空检索全部）"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={saveKb} disabled={saving}>
                <Save className="mr-1 h-4 w-4" />
                {saving ? '保存中…' : '保存配置'}
              </Button>
              <Button variant="ghost" onClick={testKb} disabled={kbTesting}>
                <RefreshCw className={cn('mr-1 h-4 w-4', kbTesting && 'animate-spin')} />
                {kbTesting ? '测试中…' : '测试连接'}
              </Button>
              {kbTestResult && (
                <span className={cn('flex items-center gap-1 text-xs', kbTestResult.ok ? 'text-emerald-400' : 'text-rose-400')}>
                  {kbTestResult.ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {kbTestResult.message}
                </span>
              )}
            </div>

            {kb && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-3 py-2 text-xs">
                <Badge variant={kb.configured ? 'success' : 'neutral'}>
                  {kb.configured ? '已接入' : '未接入'}
                </Badge>
                <span className="text-slate-500">
                  {kb.configured
                    ? `当前使用 ${kb.provider}，检索 TopK=${kb.topK}`
                    : 'AI 助手将仅使用当前对话上下文'}
                </span>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}
