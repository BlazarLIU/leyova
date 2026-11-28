import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2, ShieldCheck } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui'
import { api } from '@/services/api'

interface SetupStatus {
  initialized: boolean
  status: string
  installTokenRequired: boolean
}

interface ModuleRow {
  code: string
  name: string
  is_core: boolean
  is_enabled: boolean
}

interface PlatformRow {
  platform_code: string
  platform_name: string
  is_enabled: boolean
}

const STEPS = ['安装凭证', '站点信息', '超级管理员', '业务域与平台', '完成']

function setupFetch<T>(path: string, token: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'X-Leyova-Setup-Token': token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (res) => {
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`)
    return (json?.data ?? json) as T
  })
}

export function SetupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [token, setToken] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [siteName, setSiteName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [realName, setRealName] = useState('')

  const [modules, setModules] = useState<ModuleRow[]>([])
  const [platforms, setPlatforms] = useState<PlatformRow[]>([])
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['douyin'])

  const [mode, setMode] = useState<'manual' | 'ai'>('manual')
  const [entityType, setEntityType] = useState('brand_self')
  const [channel, setChannel] = useState('live')
  const [teamSize, setTeamSize] = useState(5)
  const [targetGmvBand, setTargetGmvBand] = useState('under_100w')
  const [category, setCategory] = useState('')
  const [painPoints, setPainPoints] = useState<string[]>([])
  const [crossBorder, setCrossBorder] = useState(false)
  const [narrative, setNarrative] = useState('')
  const [generating, setGenerating] = useState(false)

  const [modelBaseUrl, setModelBaseUrl] = useState('')
  const [modelName, setModelName] = useState('')
  const [modelApiKey, setModelApiKey] = useState('')
  const [modelTest, setModelTest] = useState('')

  useEffect(() => {
    api
      .get<SetupStatus>('/v1/setup/status')
      .then((s) => setStatus(s))
      .catch((err: any) => setError(err?.message || '无法连接服务端'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (status?.initialized) return
    api
      .get<ModuleRow[]>('/v1/setup/modules')
      .then((rows) => {
        setModules(rows)
        setSelectedModules((prev) =>
          prev.length > 0 ? prev : rows.filter((m) => !m.is_core && m.is_enabled).map((m) => m.code)
        )
      })
      .catch(() => undefined)
    api.get<PlatformRow[]>('/v1/setup/platforms').then(setPlatforms).catch(() => undefined)
  }, [status?.initialized])

  const optionalModules = useMemo(() => modules.filter((m) => !m.is_core), [modules])

  const canNext = useMemo(() => {
    if (step === 0) return token.trim().length >= 8
    if (step === 1) return tenantName.trim().length > 0
    if (step === 2) return username.trim().length >= 3 && password.length >= 12 && password === confirmPassword
    return true
  }, [step, token, tenantName, username, password, confirmPassword])

  const submitTenant = async () => {
    setSaving(true)
    setError('')
    try {
      await setupFetch('/api/v1/setup/tenant', token, {
        name: tenantName.trim(),
        siteName: siteName.trim() || undefined,
      })
      setStep(2)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const submitAdmin = async () => {
    setSaving(true)
    setError('')
    try {
      await setupFetch('/api/v1/setup/admin', token, {
        username: username.trim(),
        password,
        realName: realName.trim() || undefined,
      })
      setStep(3)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const submitApply = async () => {
    setSaving(true)
    setError('')
    try {
      const answers =
        mode === 'ai'
          ? {
              entityType,
              platforms: selectedPlatforms,
              channel,
              teamSize,
              targetGmvBand,
              category: category.trim() || undefined,
              painPoints,
              needsCrossBorder: crossBorder,
            }
          : undefined
      await setupFetch('/api/v1/setup/apply', token, {
        tenant: { name: tenantName.trim(), siteName: siteName.trim() || undefined },
        modules: selectedModules,
        platforms: selectedPlatforms,
        setupSource: mode,
        ...(answers ? { aiProfile: answers } : {}),
      })
      setStep(4)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const generatePlan = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await setupFetch<{
        plan: { modules: string[]; platforms: string[] }
        recommendation: { reasons: Record<string, string>; notes: string[] }
        narrative: string
      }>('/api/v1/setup/ai/plan', token, {
        tenant: { name: tenantName.trim(), siteName: siteName.trim() || undefined },
        answers: {
          entityType,
          platforms: selectedPlatforms,
          channel,
          teamSize,
          targetGmvBand,
          category: category.trim() || undefined,
          painPoints,
          needsCrossBorder: crossBorder,
        },
      })
      setSelectedModules(res.plan.modules)
      setSelectedPlatforms(res.plan.platforms)
      setNarrative(res.narrative)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const testModel = async () => {
    setModelTest('测试中…')
    try {
      const res = await setupFetch<{ ok: boolean; latencyMs: number; error?: string }>(
        '/api/v1/setup/ai/models/test',
        token,
        { baseUrl: modelBaseUrl, apiKey: modelApiKey || undefined, modelName }
      )
      setModelTest(res.ok ? `连接成功（${res.latencyMs}ms）` : `连接失败：${res.error || '未知错误'}`)
    } catch (err: any) {
      setModelTest(`连接失败：${err.message}`)
    }
  }

  const saveModel = async () => {
    setModelTest('保存中…')
    try {
      const res = await setupFetch<{ activationRequired?: string }>(
        '/api/v1/setup/ai/models',
        token,
        { baseUrl: modelBaseUrl, apiKey: modelApiKey || undefined, modelName, provider: 'openai_compatible', profile: 'fast-chat' }
      )
      setModelTest(res.activationRequired ? `已保存；需设置 ${res.activationRequired} 并重启 API` : '已保存')
    } catch (err: any) {
      setModelTest(`保存失败：${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text-secondary)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 正在检测系统状态
      </div>
    )
  }

  if (status?.initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-orbit-primary" />
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">系统已完成初始化</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">安装入口已永久关闭。</p>
          <Button className="mt-6 w-full" onClick={() => navigate('/sign-in')}>
            前往登录
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)]">Leyova Setup</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">初始化你的运营系统</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            安装凭证可在服务端启动日志中找到；已有部署请直接登录。
          </p>
        </div>

        <ol className="mb-8 flex flex-wrap gap-2 text-xs">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                index === step
                  ? 'border-orbit-primary text-orbit-primary'
                  : index < step
                    ? 'border-emerald-500/40 text-emerald-600'
                    : 'border-[var(--border)] text-[var(--text-tertiary)]'
              }`}
            >
              {index < step ? <Check className="h-3 w-3" /> : <span>{index + 1}</span>}
              {label}
            </li>
          ))}
        </ol>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="setup-token">安装凭证</Label>
              <Input
                id="setup-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="X-Leyova-Setup-Token"
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              凭证 24 小时有效、单次初始化后失效。生产环境可通过 LEYOVA_SETUP_TOKEN 预先指定。
            </p>
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">配置方式</p>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { key: 'manual' as const, title: '手动配置', desc: '自己选择模块与平台，适合已明确业务边界的团队' },
                  { key: 'ai' as const, title: 'AI 辅助配置', desc: '回答几个问题，系统生成模块/平台方案并可解释' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMode(item.key)}
                    className={`rounded-xl border p-4 text-left transition ${
                      mode === item.key
                        ? 'border-orbit-primary bg-orbit-primary/5'
                        : 'border-[var(--border)] hover:border-orbit-primary/40'
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <Button disabled={!canNext} onClick={() => setStep(1)}>
              下一步
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="tenant-name">企业/团队名称</Label>
              <Input
                id="tenant-name"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="例如：某某品牌电商部"
              />
            </div>
            <div>
              <Label htmlFor="site-name">系统显示名称（可选）</Label>
              <Input
                id="site-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="默认使用企业名称"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)}>
                上一步
              </Button>
              <Button disabled={!canNext || saving} onClick={submitTenant}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存并继续
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="admin-username">超级管理员账号</Label>
              <Input
                id="admin-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="字母、数字、下划线"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="admin-realname">姓名（可选）</Label>
              <Input id="admin-realname" value={realName} onChange={(e) => setRealName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="admin-password">密码</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 12 位，含大小写、数字、符号"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="admin-password2">确认密码</Label>
              <Input
                id="admin-password2"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                上一步
              </Button>
              <Button disabled={!canNext || saving} onClick={submitAdmin}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}创建管理员
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            {mode === 'ai' && (
              <div className="space-y-4 rounded-xl border border-orbit-primary/30 bg-orbit-primary/5 p-4">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">AI 业务画像</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    回答后生成可解释的模块与平台方案；推荐结果仍可手动调整。
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-[var(--text-secondary)]">
                    主体类型
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={entityType}
                      onChange={(e) => setEntityType(e.target.value)}
                    >
                      <option value="brand_self">品牌自播</option>
                      <option value="mcn">MCN 机构</option>
                      <option value="agency">代运营服务商</option>
                      <option value="individual">个人/小团队</option>
                    </select>
                  </label>
                  <label className="text-sm text-[var(--text-secondary)]">
                    主要渠道
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    >
                      <option value="live">直播</option>
                      <option value="short_video">短视频</option>
                      <option value="both">直播 + 短视频</option>
                    </select>
                  </label>
                  <label className="text-sm text-[var(--text-secondary)]">
                    团队人数
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={teamSize}
                      onChange={(e) => setTeamSize(Number(e.target.value) || 1)}
                    />
                  </label>
                  <label className="text-sm text-[var(--text-secondary)]">
                    目标 GMV 区间
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={targetGmvBand}
                      onChange={(e) => setTargetGmvBand(e.target.value)}
                    >
                      <option value="under_100w">100 万以下</option>
                      <option value="100w_500w">100–500 万</option>
                      <option value="500w_3000w">500–3000 万</option>
                      <option value="above_3000w">3000 万以上</option>
                    </select>
                  </label>
                  <label className="text-sm text-[var(--text-secondary)]">
                    主营品类（可选）
                    <input
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="例如：女装、食品、美妆"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end text-sm text-[var(--text-secondary)]">
                    <input type="checkbox" checked={crossBorder} onChange={(e) => setCrossBorder(e.target.checked)} />
                    涉及跨境业务
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm text-[var(--text-secondary)]">当前痛点</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      ['low_traffic', '流量不足'],
                      ['low_conversion', '转化偏低'],
                      ['high_refund', '退款偏高'],
                      ['inventory', '库存压力'],
                      ['content', '内容产能不足'],
                      ['ads_roi', '投放 ROI 低'],
                      ['staff', '人效/排班'],
                      ['compliance', '合规风险'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={painPoints.includes(key)}
                          onChange={(e) =>
                            setPainPoints((prev) =>
                              e.target.checked ? [...prev, key] : prev.filter((p) => p !== key)
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <Button variant="outline" disabled={generating} onClick={generatePlan}>
                  {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}生成推荐方案
                </Button>

                {narrative && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {narrative}
                  </div>
                )}

                <details className="rounded-lg border border-[var(--border)] p-3">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)]">
                    配置大模型（可选）
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <input
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={modelBaseUrl}
                      onChange={(e) => setModelBaseUrl(e.target.value)}
                      placeholder="Base URL（如 https://api.example.com/v1）"
                    />
                    <input
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="模型 ID"
                    />
                    <input
                      type="password"
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={modelApiKey}
                      onChange={(e) => setModelApiKey(e.target.value)}
                      placeholder="API Key"
                      autoComplete="off"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="outline" onClick={testModel}>测试连接</Button>
                    <Button variant="outline" onClick={saveModel}>保存配置</Button>
                    {modelTest && <span className="text-xs text-[var(--text-secondary)]">{modelTest}</span>}
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    兼容 OpenAI 协议的第三方或自建模型服务；密钥加密存储，不回显，也可在登录后进入「系统配置与 AI」再行配置。
                  </p>
                </details>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">启用业务模块</p>
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-auto rounded-lg border border-[var(--border)] p-3 md:grid-cols-3">
                {optionalModules.length === 0 && (
                  <p className="col-span-full text-xs text-[var(--text-tertiary)]">暂无可选模块</p>
                )}
                {optionalModules.map((m) => (
                  <label key={m.code} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={selectedModules.includes(m.code)}
                      onChange={(e) =>
                        setSelectedModules((prev) =>
                          e.target.checked ? [...prev, m.code] : prev.filter((c) => c !== m.code)
                        )
                      }
                    />
                    {m.name || m.code}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                系统必需模块已默认启用；关闭模块只隐藏入口，不影响事实数据入库。
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">启用平台</p>
              <div className="flex flex-wrap gap-3">
                {platforms.map((p) => (
                  <label key={p.platform_code} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(p.platform_code)}
                      onChange={(e) =>
                        setSelectedPlatforms((prev) =>
                          e.target.checked
                            ? [...prev, p.platform_code]
                            : prev.filter((c) => c !== p.platform_code)
                        )
                      }
                    />
                    {p.platform_name || p.platform_code}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                上一步
              </Button>
              <Button disabled={saving} onClick={submitApply}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}应用配置
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
              初始化完成。安装入口已关闭，请使用刚创建的超级管理员登录。
              登录后系统会引导上传数据并生成首份经营复盘。
            </div>
            <Button onClick={() => navigate('/sign-in')}>前往登录</Button>
          </div>
        )}
      </div>
    </div>
  )
}
