/**
 * AiModelsConfigSection.tsx — 系统配置与 AI「AI 模型」统一管理工作台
 *
 * 整合全系统所有 AI 模型配置到单一入口：
 *   1. 对话与推理大模型（Chat / Agent LLM，OpenAI / Anthropic 兼容协议）；
 *   2. 向量模型供应商与加密凭证（Embedding Providers：openai_compatible / doubao / siliconflow + 实测探活）；
 *   3. 知识库向量集合分配（自动过滤违禁词规则库，支持一键批量绑定或单集合微调）。
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  KeyRound,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

interface IntegrationConnectionItem {
  id: string
  platform: string
  name: string
  category: string
  credentialHint: string
  secretsConfigured: boolean
  config: Record<string, unknown>
  docsUrl?: string
}

interface CollectionItem {
  id: string
  code: string
  name: string
  domain: string
  embeddingModel: string
  embeddingDim: number
  documentCount: number
  chunkCount: number
  config?: Record<string, unknown>
}

interface EmbeddingTestResult {
  ok: boolean
  provider: string
  model: string
  dim: number
  latencyMs: number
  baseUrlHost: string
  error?: string
}

interface ProviderDraft {
  baseUrl: string
  embeddingModel: string
  apiKey: string
}

interface CollectionDraft {
  embeddingProvider: string
  embeddingApiBase: string
  embeddingModel: string
}

const PROVIDER_DEFAULTS: Record<string, { label: string; baseUrl: string; embeddingModel: string; placeholder: string; modelPlaceholder: string }> = {
  openai_compatible: {
    label: 'OpenAI 兼容（自定义）',
    baseUrl: '',
    embeddingModel: '',
    placeholder: 'https://api.example.com/v1',
    modelPlaceholder: '例如：text-embedding-3-small',
  },
  doubao: {
    label: '豆包（火山方舟）',
    baseUrl: '',
    embeddingModel: '',
    placeholder: 'https://ark.cn-beijing.volces.com/api/v3',
    modelPlaceholder: '例如：doubao-embedding-text-240715',
  },
  siliconflow: {
    label: '硅基流动（SiliconFlow CN）',
    baseUrl: '',
    embeddingModel: '',
    placeholder: 'https://api.siliconflow.cn/v1',
    modelPlaceholder: '例如：BAAI/bge-m3',
  },
}

const PROVIDER_KEYS = ['openai_compatible', 'doubao', 'siliconflow'] as const

const DOMAIN_LABEL: Record<string, string> = {
  product: '商品知识',
  script: '直播脚本',
  replay: '复盘回放',
  document: '通用文档',
}

const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg bg-orbit-ink border border-orbit-border text-sm text-[var(--text-primary)] focus:outline-none focus:border-status-ai'

const COMPACT_INPUT_CLS =
  'w-full px-2.5 py-1.5 rounded-lg bg-orbit-ink border border-orbit-border text-xs text-[var(--text-primary)] focus:outline-none focus:border-status-ai'

const isRuleOnlyCollection = (col: Pick<CollectionItem, 'code' | 'domain'>) =>
  col.code === 'banned_words' || col.domain === 'banned'

export function AiModelsConfigSection() {
  // ── 1. 对话与推理大模型（Chat / Agent LLM） ──
  const [aiConfig, setAiConfig] = useState<any | null>(null)
  const [aiForm, setAiForm] = useState({ enabled: true, protocol: 'openai', apiBase: '', model: '', apiKey: '' })
  const [aiSaving, setAiSaving] = useState(false)
  const [aiTesting, setAiTesting] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiHealth, setAiHealth] = useState<any | null>(null)

  // ── 2. 向量模型供应商与 API 凭证 ──
  const [providers, setProviders] = useState<IntegrationConnectionItem[]>([])
  const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderDraft>>({})
  const [savingProvider, setSavingProvider] = useState('')
  const [revokingProvider, setRevokingProvider] = useState('')
  const [testingProvider, setTestingProvider] = useState('')
  const [providerTestResults, setProviderTestResults] = useState<Record<string, EmbeddingTestResult>>({})
  const [providerMsg, setProviderMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ── 3. 知识集合向量模型分配 ──
  const [collections, setCollections] = useState<CollectionItem[]>([])
  const [collectionDrafts, setCollectionDrafts] = useState<Record<string, CollectionDraft>>({})
  const [savingColCode, setSavingColCode] = useState('')
  const [batchForm, setBatchForm] = useState<CollectionDraft>({
    embeddingProvider: 'openai_compatible',
    embeddingApiBase: '',
    embeddingModel: '',
  })
  const [batchSaving, setBatchSaving] = useState(false)
  const [colMsg, setColMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [loadingExtra, setLoadingExtra] = useState(false)

  const loadLlmConfig = useCallback(async () => {
    try {
      const cfg = await api.get<any>('/assistant/llm-config')
      setAiConfig(cfg)
      setAiForm({
        enabled: Boolean(cfg?.enabled),
        protocol: cfg?.protocol === 'anthropic' ? 'anthropic' : 'openai',
        apiBase: cfg?.apiBase || '',
        model: cfg?.model || '',
        apiKey: '',
      })
      setAiHealth(null)
    } catch {
      setAiMessage('加载对话大模型配置失败')
    }
  }, [])

  const loadEmbeddingAndCollections = useCallback(async () => {
    setLoadingExtra(true)
    try {
      const [connRes, colRes] = await Promise.all([
        api.get<{ items: IntegrationConnectionItem[] }>('/integrations').catch(() => null),
        api.get<{ items: CollectionItem[] }>('/kb/collections').catch(() => null),
      ])

      if (connRes?.items) {
        const llmConns = connRes.items.filter((item) => item.category === 'llm')
        setProviders(llmConns)
        const nextDrafts: Record<string, ProviderDraft> = {}
        for (const key of PROVIDER_KEYS) {
          const found = llmConns.find((c) => c.platform === key)
          const defaults = PROVIDER_DEFAULTS[key]
          nextDrafts[key] = {
            baseUrl: String(found?.config?.baseUrl ?? defaults.baseUrl ?? ''),
            embeddingModel: String(found?.config?.embeddingModel ?? defaults.embeddingModel ?? ''),
            apiKey: '',
          }
        }
        setProviderDrafts(nextDrafts)
      }

      if (colRes?.items) {
        setCollections(colRes.items)
        const nextColDrafts: Record<string, CollectionDraft> = {}
        for (const col of colRes.items) {
          if (isRuleOnlyCollection(col)) continue
          nextColDrafts[col.code] = {
            embeddingProvider: String(col.config?.embeddingProvider || ''),
            embeddingApiBase: String(col.config?.embeddingApiBase || ''),
            embeddingModel: col.embeddingModel || '',
          }
        }
        setCollectionDrafts(nextColDrafts)
      }
    } finally {
      setLoadingExtra(false)
    }
  }, [])

  useEffect(() => {
    void loadLlmConfig()
    void loadEmbeddingAndCollections()
  }, [loadLlmConfig, loadEmbeddingAndCollections])

  // ── 对话大模型操作 ──
  const handleSaveAiConfig = async () => {
    setAiSaving(true)
    setAiMessage('')
    try {
      const saved = await api.put<any>('/assistant/llm-config', {
        ...aiForm,
        apiKey: aiForm.apiKey.trim() || undefined,
      })
      setAiConfig(saved)
      setAiForm((f) => ({ ...f, apiKey: '' }))
      setAiHealth(null)
      setAiMessage('保存成功，运行时已生效')
    } catch (err: any) {
      setAiMessage(err?.message || '保存失败')
    } finally {
      setAiSaving(false)
    }
  }

  const handleClearAiKey = async () => {
    setAiSaving(true)
    setAiMessage('')
    try {
      const saved = await api.put<any>('/assistant/llm-config', {
        ...aiForm,
        apiKey: undefined,
        clearApiKey: true,
      })
      setAiConfig(saved)
      setAiForm((f) => ({ ...f, apiKey: '' }))
      setAiHealth(null)
      setAiMessage('已清除存储密钥，将回退到环境变量中的密钥')
    } catch (err: any) {
      setAiMessage(err?.message || '清除失败')
    } finally {
      setAiSaving(false)
    }
  }

  const handleTestAiConfig = async () => {
    setAiTesting(true)
    setAiMessage('')
    setAiHealth(null)
    try {
      const health = await api.post<any>('/assistant/llm/test', {
        protocol: aiForm.protocol,
        apiBase: aiForm.apiBase,
        model: aiForm.model,
        apiKey: aiForm.apiKey.trim() || undefined,
      })
      setAiHealth(health)
      setAiMessage(health?.available ? '连接成功' : `连接失败：${health?.error || '未知原因'}`)
    } catch (err: any) {
      setAiMessage(err?.message || '探活失败')
    } finally {
      setAiTesting(false)
    }
  }

  // ── 向量供应商凭证操作 ──
  const handleSaveProvider = async (platform: string) => {
    const draft = providerDrafts[platform]
    if (!draft || savingProvider) return
    setSavingProvider(platform)
    setProviderMsg(null)
    try {
      await api.put(`/integrations/${platform}/credentials`, {
        secrets: draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {},
        config: {
          ...(draft.baseUrl.trim() ? { baseUrl: draft.baseUrl.trim().replace(/\/+$/, '') } : {}),
          ...(draft.embeddingModel.trim() ? { embeddingModel: draft.embeddingModel.trim() } : {}),
        },
      })
      setProviderMsg({ ok: true, text: `${PROVIDER_DEFAULTS[platform]?.label || platform} 向量配置与凭证已保存` })
      await loadEmbeddingAndCollections()
    } catch (err: any) {
      setProviderMsg({ ok: false, text: err?.message || '保存供应商凭证失败' })
    } finally {
      setSavingProvider('')
    }
  }

  const handleRevokeProvider = async (platform: string) => {
    if (revokingProvider) return
    setRevokingProvider(platform)
    setProviderMsg(null)
    try {
      await api.delete(`/integrations/${platform}/credentials`)
      setProviderMsg({ ok: true, text: `已吊销 ${PROVIDER_DEFAULTS[platform]?.label || platform} 的加密密钥` })
      await loadEmbeddingAndCollections()
    } catch (err: any) {
      setProviderMsg({ ok: false, text: err?.message || '吊销凭证失败' })
    } finally {
      setRevokingProvider('')
    }
  }

  const handleTestEmbedding = async (platform: string) => {
    const draft = providerDrafts[platform]
    if (!draft || testingProvider) return
    setTestingProvider(platform)
    setProviderMsg(null)
    try {
      const res = await api.post<EmbeddingTestResult>('/kb/embedding/test', {
        provider: platform,
        apiBase: draft.baseUrl.trim() || undefined,
        model: draft.embeddingModel.trim(),
        apiKey: draft.apiKey.trim() || undefined,
      })
      setProviderTestResults((prev) => ({ ...prev, [platform]: res }))
      setProviderMsg({
        ok: res.ok,
        text: res.ok
          ? `向量模型 ${res.model} 探活成功（输出维度 ${res.dim}d，耗时 ${res.latencyMs}ms）`
          : `向量探活失败：${res.error || '未知原因'}`,
      })
    } catch (err: any) {
      setProviderMsg({ ok: false, text: err?.message || '向量探活失败' })
    } finally {
      setTestingProvider('')
    }
  }

  // ── 知识集合向量分配操作 ──
  const vectorCollections = collections.filter((c) => !isRuleOnlyCollection(c))

  const handleBatchSelectProvider = (provider: string) => {
    const provConn = providers.find((p) => p.platform === provider)
    const defaults = PROVIDER_DEFAULTS[provider]
    setBatchForm({
      embeddingProvider: provider,
      embeddingApiBase: String(provConn?.config?.baseUrl ?? defaults?.baseUrl ?? ''),
      embeddingModel: String(provConn?.config?.embeddingModel ?? defaults?.embeddingModel ?? ''),
    })
  }

  const handleSaveCollectionEmbedding = async (code: string, clear = false) => {
    const draft = collectionDrafts[code]
    if (!draft || savingColCode) return
    setSavingColCode(code)
    setColMsg(null)
    try {
      const payload = clear
        ? { embeddingProvider: '', embeddingApiBase: '', embeddingModel: '' }
        : {
            embeddingProvider: draft.embeddingProvider.trim(),
            embeddingApiBase: draft.embeddingApiBase.trim(),
            embeddingModel: draft.embeddingModel.trim(),
          }
      await api.put(`/kb/collections/${code}`, payload)
      setColMsg({
        ok: true,
        text: clear
          ? `已清空集合「${code}」向量模型，切换为纯关键词检索`
          : `集合「${code}」向量模型已更新；旧文档可在「知识与规则库」重新保存以生成新索引`,
      })
      await loadEmbeddingAndCollections()
    } catch (err: any) {
      setColMsg({ ok: false, text: err?.message || '更新集合向量配置失败' })
    } finally {
      setSavingColCode('')
    }
  }

  const handleBatchApplyAll = async () => {
    if (batchSaving || vectorCollections.length === 0) return
    if (!batchForm.embeddingProvider || !batchForm.embeddingModel.trim()) {
      setColMsg({ ok: false, text: '请先选择供应商并填写向量模型名称' })
      return
    }
    setBatchSaving(true)
    setColMsg(null)
    try {
      await Promise.all(
        vectorCollections.map((col) =>
          api.put(`/kb/collections/${col.code}`, {
            embeddingProvider: batchForm.embeddingProvider.trim(),
            embeddingApiBase: batchForm.embeddingApiBase.trim(),
            embeddingModel: batchForm.embeddingModel.trim(),
          })
        )
      )
      setColMsg({
        ok: true,
        text: `已将 ${batchForm.embeddingModel.trim()} 统一应用至全部 ${vectorCollections.length} 个向量知识集合（已自动跳过违禁词规则库）`,
      })
      await loadEmbeddingAndCollections()
    } catch (err: any) {
      setColMsg({ ok: false, text: err?.message || '批量应用失败' })
    } finally {
      setBatchSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* ─── 模块 1：对话与推理大模型 ─── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-status-ai" />
              <span>对话与推理大模型（Chat / Agent LLM）</span>
            </span>
          }
          subtitle="负责 AI 助手对话、经营诊断分析、排班建议与脚本生成；支持 OpenAI 或 Anthropic 兼容协议，保存后立即生效。"
        />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">协议格式</label>
              <select
                value={aiForm.protocol}
                onChange={(e) => setAiForm((f) => ({ ...f, protocol: e.target.value }))}
                className={INPUT_CLS}
              >
                <option value="openai">OpenAI 兼容（/chat/completions）</option>
                <option value="anthropic">Anthropic 兼容（/v1/messages）</option>
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {aiForm.protocol === 'anthropic'
                  ? '填写兼容 /v1/messages 的模型网关 Base URL'
                  : '填写兼容 /chat/completions 的模型网关 Base URL'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">模型 ID</label>
              <input
                value={aiForm.model}
                onChange={(e) => setAiForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="请输入模型 ID"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">API Base URL</label>
              <input
                value={aiForm.apiBase}
                onChange={(e) => setAiForm((f) => ({ ...f, apiBase: e.target.value }))}
                placeholder="https://api.example.com/v1"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">API Key</label>
                {aiConfig?.keySource === 'database' && (
                  <button
                    type="button"
                    onClick={handleClearAiKey}
                    className="text-xs text-status-danger hover:underline"
                  >
                    清除密钥
                  </button>
                )}
              </div>
              <input
                type="password"
                value={aiForm.apiKey}
                onChange={(e) => setAiForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={aiConfig?.hasApiKey ? `已配置 ${aiConfig.apiKeyMasked}，留空保持不变` : '请输入 API Key'}
                className={INPUT_CLS}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">密钥仅 AES-256-GCM 加密存储，接口不回显。</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-orbit-border">
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={aiForm.enabled}
                onChange={(e) => setAiForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="w-4 h-4 rounded border-orbit-border"
              />
              启用真实大模型调用（关闭后仅走规则引擎）
            </label>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={aiTesting} onClick={handleTestAiConfig}>
                {aiTesting ? '探活中…' : '测试连接'}
              </Button>
              <Button size="sm" variant="primary" disabled={aiSaving} onClick={handleSaveAiConfig}>
                {aiSaving ? '保存中…' : '保存对话模型配置'}
              </Button>
            </div>
          </div>

          {aiMessage && (
            <p className={`text-sm ${aiMessage.includes('成功') ? 'text-status-success' : 'text-status-danger'}`}>
              {aiMessage}
            </p>
          )}

          {aiHealth && (
            <div className="rounded-lg border border-orbit-border bg-orbit-ink/40 px-4 py-3 text-xs text-[var(--text-secondary)] space-y-1">
              <div>协议：<span className="font-mono text-[var(--text-primary)]">{aiHealth.protocol}</span></div>
              <div>模型：<span className="font-mono text-[var(--text-primary)]">{aiHealth.model}</span>（{aiHealth.modelPresent === false ? '服务端不存在' : '存在'}）</div>
              <div>延迟：<span className="font-mono text-[var(--text-primary)]">{aiHealth.latencyMs}ms</span></div>
              {aiHealth.error && <div className="text-status-danger">错误：{aiHealth.error}</div>}
            </div>
          )}

          {aiConfig && (
            <p className="text-xs text-[var(--text-muted)]">
              配置来源：{aiConfig.source === 'database' ? '数据库（界面配置）' : '环境变量'} · 密钥来源：
              {aiConfig.keySource === 'database' ? '加密存储' : '环境变量'} · 更新时间：
              {aiConfig.updatedAt ? new Date(aiConfig.updatedAt).toLocaleString() : '—'}
            </p>
          )}
        </CardBody>
      </Card>

      {/* ─── 模块 2：向量模型供应商与 API 凭证 ─── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-status-ai" />
              <span>向量模型供应商与 API 凭证（Embedding Providers）</span>
            </span>
          }
          subtitle="为知识库语义检索统一配置 OpenAI 兼容、豆包或硅基流动（api.siliconflow.cn）的 /embeddings 凭证与默认向量模型；密钥独立加密落库。"
          actions={
            <Button
              size="sm"
              variant="outline"
              disabled={loadingExtra}
              onClick={() => void loadEmbeddingAndCollections()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              刷新状态
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {providerMsg && (
            <p className={`text-xs ${providerMsg.ok ? 'text-status-success' : 'text-status-danger'}`}>
              {providerMsg.text}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {PROVIDER_KEYS.map((platform) => {
              const conn = providers.find((p) => p.platform === platform)
              const defaults = PROVIDER_DEFAULTS[platform]
              const draft = providerDrafts[platform] || {
                baseUrl: defaults.baseUrl,
                embeddingModel: defaults.embeddingModel,
                apiKey: '',
              }
              const testRes = providerTestResults[platform]

              return (
                <div
                  key={platform}
                  className="flex flex-col justify-between rounded-xl border border-orbit-border bg-orbit-ink/40 p-4 space-y-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{defaults.label}</p>
                        <code className="text-[10px] text-[var(--text-subtle)]">{platform}</code>
                      </div>
                      {conn?.secretsConfigured ? (
                        <Badge variant="success">已配置 {conn.credentialHint}</Badge>
                      ) : (
                        <Badge variant="neutral">未配置密钥</Badge>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                        API Base URL
                      </label>
                      <input
                        value={draft.baseUrl}
                        onChange={(e) =>
                          setProviderDrafts((prev) => ({
                            ...prev,
                            [platform]: { ...draft, baseUrl: e.target.value },
                          }))
                        }
                        placeholder={defaults.placeholder}
                        className={COMPACT_INPUT_CLS}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                        默认向量模型（Embedding Model）
                      </label>
                      <input
                        value={draft.embeddingModel}
                        onChange={(e) =>
                          setProviderDrafts((prev) => ({
                            ...prev,
                            [platform]: { ...draft, embeddingModel: e.target.value },
                          }))
                        }
                        placeholder={defaults.modelPlaceholder}
                        className={COMPACT_INPUT_CLS}
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-[11px] font-medium text-[var(--text-secondary)]">API Key</label>
                        {conn?.secretsConfigured && (
                          <button
                            type="button"
                            disabled={revokingProvider === platform}
                            onClick={() => void handleRevokeProvider(platform)}
                            className="inline-flex items-center gap-0.5 text-[11px] text-status-danger hover:underline"
                          >
                            <Trash2 className="h-3 w-3" />
                            吊销密钥
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={draft.apiKey}
                        onChange={(e) =>
                          setProviderDrafts((prev) => ({
                            ...prev,
                            [platform]: { ...draft, apiKey: e.target.value },
                          }))
                        }
                        placeholder={
                          conn?.secretsConfigured
                            ? `已加密保存 ${conn.credentialHint}，留空保留原密钥`
                            : '输入供应商 API Key'
                        }
                        className={COMPACT_INPUT_CLS}
                      />
                    </div>

                    {testRes && (
                      <div
                        className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                          testRes.ok
                            ? 'border-orbit-success/30 bg-orbit-success/10 text-status-success'
                            : 'border-orbit-danger/30 bg-orbit-danger/10 text-status-danger'
                        }`}
                      >
                        {testRes.ok
                          ? `可用 · ${testRes.model} · ${testRes.dim} 维 (${testRes.latencyMs}ms)`
                          : `失败 · ${testRes.error}`}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-orbit-border/60">
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={testingProvider === platform}
                      onClick={() => void handleTestEmbedding(platform)}
                    >
                      <Zap className="mr-1 h-3 w-3" />
                      {testingProvider === platform ? '探测中…' : '测试向量'}
                    </Button>
                    <Button
                      size="xs"
                      variant="primary"
                      disabled={savingProvider === platform}
                      onClick={() => void handleSaveProvider(platform)}
                    >
                      {savingProvider === platform ? '保存中…' : '保存凭证'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      {/* ─── 模块 3：知识集合向量模型分配 ─── */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-status-ai" />
              <span>知识库集合向量模型分配</span>
            </span>
          }
          subtitle="仅管理需语义向量检索的知识集合；「违禁词库」采用 DFA 确定性规则匹配，无需配置任何 AI 向量模型。"
          actions={
            <Link
              to="/ai-ops/governance/knowledge"
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-orbit-border px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-orbit-primary/45 hover:text-orbit-primary"
            >
              <span>前往知识与规则库</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CardBody className="space-y-4">
          {colMsg && (
            <p className={`text-xs ${colMsg.ok ? 'text-status-success' : 'text-status-danger'}`}>
              {colMsg.text}
            </p>
          )}

          {/* 一键批量应用栏 */}
          <div className="rounded-xl border border-orbit-primary/25 bg-orbit-primary/5 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <Sparkles className="h-3.5 w-3.5 text-orbit-primary" />
                <span>一键批量绑定到全部向量知识集合</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                适合中小团队快速统一：一次配置同步商品、脚本、回放等全部向量集合
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <select
                value={batchForm.embeddingProvider}
                onChange={(e) => handleBatchSelectProvider(e.target.value)}
                className={COMPACT_INPUT_CLS}
              >
                {PROVIDER_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PROVIDER_DEFAULTS[key].label}
                  </option>
                ))}
              </select>
              <input
                value={batchForm.embeddingApiBase}
                onChange={(e) => setBatchForm((p) => ({ ...p, embeddingApiBase: e.target.value }))}
                placeholder="Base URL（可留空继承供应商配置）"
                className={COMPACT_INPUT_CLS}
              />
              <input
                value={batchForm.embeddingModel}
                onChange={(e) => setBatchForm((p) => ({ ...p, embeddingModel: e.target.value }))}
                placeholder="请输入向量模型 ID"
                className={COMPACT_INPUT_CLS}
              />
              <Button
                size="sm"
                variant="primary"
                disabled={batchSaving || vectorCollections.length === 0}
                onClick={() => void handleBatchApplyAll()}
              >
                {batchSaving ? '应用中…' : `应用到全部 (${vectorCollections.length})`}
              </Button>
            </div>
          </div>

          {/* 单集合微调列表 */}
          <div className="overflow-x-auto rounded-lg border border-orbit-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-orbit-border bg-orbit-surface2/60 text-[11px] text-[var(--text-muted)]">
                  <th className="px-3 py-2 font-semibold">知识集合</th>
                  <th className="px-3 py-2 font-semibold">向量供应商</th>
                  <th className="px-3 py-2 font-semibold">自定义 Base URL（选填）</th>
                  <th className="px-3 py-2 font-semibold">Embedding 模型 ID</th>
                  <th className="px-3 py-2 font-semibold">索引状态</th>
                  <th className="px-3 py-2 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orbit-border/60">
                {vectorCollections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                      暂无可配置向量的知识集合
                    </td>
                  </tr>
                ) : (
                  vectorCollections.map((col) => {
                    const draft = collectionDrafts[col.code] || {
                      embeddingProvider: '',
                      embeddingApiBase: '',
                      embeddingModel: '',
                    }
                    return (
                      <tr key={col.id} className="hover:bg-orbit-surface2/30">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Database className="h-3.5 w-3.5 text-status-ai" />
                            <span className="font-semibold text-[var(--text-primary)]">{col.name}</span>
                            <code className="rounded bg-orbit-surface2 px-1 py-0.5 text-[10px] text-[var(--text-muted)]">
                              {col.code}
                            </code>
                          </div>
                          <p className="mt-0.5 pl-5 text-[10px] text-[var(--text-subtle)]">
                            {DOMAIN_LABEL[col.domain] || col.domain} · {col.documentCount} 文档 / {col.chunkCount} 切片
                          </p>
                        </td>
                        <td className="px-3 py-2.5 min-w-[165px]">
                          <select
                            value={draft.embeddingProvider}
                            onChange={(e) => {
                              const nextProv = e.target.value
                              const defaults = PROVIDER_DEFAULTS[nextProv]
                              setCollectionDrafts((prev) => ({
                                ...prev,
                                [col.code]: {
                                  embeddingProvider: nextProv,
                                  embeddingApiBase: draft.embeddingApiBase || defaults?.baseUrl || '',
                                  embeddingModel: draft.embeddingModel || defaults?.embeddingModel || '',
                                },
                              }))
                            }}
                            className={COMPACT_INPUT_CLS}
                          >
                            <option value="">未绑定（仅关键词检索）</option>
                            {PROVIDER_KEYS.map((key) => (
                              <option key={key} value={key}>
                                {PROVIDER_DEFAULTS[key].label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 min-w-[180px]">
                          <input
                            value={draft.embeddingApiBase}
                            onChange={(e) =>
                              setCollectionDrafts((prev) => ({
                                ...prev,
                                [col.code]: { ...draft, embeddingApiBase: e.target.value },
                              }))
                            }
                            placeholder="留空继承供应商默认地址"
                            className={COMPACT_INPUT_CLS}
                          />
                        </td>
                        <td className="px-3 py-2.5 min-w-[180px]">
                          <input
                            value={draft.embeddingModel}
                            onChange={(e) =>
                              setCollectionDrafts((prev) => ({
                                ...prev,
                                [col.code]: { ...draft, embeddingModel: e.target.value },
                              }))
                            }
                            placeholder="请输入向量模型 ID"
                            className={COMPACT_INPUT_CLS}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          {col.embeddingModel ? (
                            <Badge variant="success">
                              <CheckCircle2 className="h-3 w-3" />
                              {col.embeddingDim ? `${col.embeddingDim}d` : '已绑定'}
                            </Badge>
                          ) : (
                            <Badge variant="neutral">关键词检索</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              size="xs"
                              variant="primary"
                              disabled={savingColCode === col.code}
                              onClick={() => void handleSaveCollectionEmbedding(col.code, false)}
                            >
                              {savingColCode === col.code ? '保存中…' : '保存'}
                            </Button>
                            {col.embeddingModel && (
                              <Button
                                size="xs"
                                variant="ghost"
                                disabled={savingColCode === col.code}
                                onClick={() => void handleSaveCollectionEmbedding(col.code, true)}
                              >
                                清空
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orbit-info/25 bg-orbit-info/10 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-orbit-info" />
            <span>
              <strong>说明：</strong>「违禁词库（banned_words）」走确定性 DFA/ACF 规则自动机拦截，不经过向量模型，故未列入上表；切换任意集合的向量模型后会自动清空旧维度，避免跨模型向量混用。
            </span>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}
