import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Settings, CheckCircle, XCircle, Store, Shield, KeyRound, RefreshCw, ExternalLink, X, Lock } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface ShopAccessInfo {
  id: number
  name: string
  status: string
  authStatus: 'authorized' | 'manual_only' | 'unauthorized' | string
  hasCredentials?: boolean
  appKeyMasked?: string
  authorizedAt?: string | null
}

interface PlatformRow {
  platform_code: string
  platform_name: string
  category: 'live' | 'shelf' | 'content'
  is_enabled: boolean
  sort_order: number
  shops: ShopAccessInfo[]
  capabilities: {
    supportsLive: boolean
    supportsShelf: boolean
    supportsContent: boolean
    supportsAds: boolean
    supportsAutoSync: boolean
    supportsManualUpload: boolean
  } | null
}

interface PermissionRow {
  id: number
  role_id: number
  role_code: string
  role_name: string
  platform_code: string
  platform_name: string
  allowed_modules: string[]
}

const CATEGORY_LABEL: Record<string, string> = { live: '直播电商', shelf: '货架电商', content: '内容种草' }
const CATEGORY_VARIANT: Record<string, 'info' | 'success' | 'warning'> = {
  live: 'info', shelf: 'success', content: 'warning',
}

export function PlatformManagementPage() {
  const { refreshPlatforms } = usePlatform()
  const [platforms, setPlatforms] = useState<PlatformRow[]>([])
  const [perms, setPerms] = useState<PermissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [syncingShopId, setSyncingShopId] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // 凭证 / OAuth 弹窗状态
  const [activeShop, setActiveShop] = useState<{ platformCode: string; platformName: string; shop: ShopAccessInfo } | null>(null)
  const [modalTab, setModalTab] = useState<'oauth' | 'direct'>('oauth')
  const [appKey, setAppKey] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [authStatus, setAuthStatus] = useState<'authorized' | 'manual_only' | 'unauthorized'>('authorized')
  const [redirectUri, setRedirectUri] = useState('')
  const [oauthUrl, setOauthUrl] = useState('')
  const [oauthCode, setOauthCode] = useState('')
  const [submittingCreds, setSubmittingCreds] = useState(false)
  const [modalErr, setModalErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, m] = await Promise.all([
        api.get<PlatformRow[]>('/platforms'),
        api.get<PermissionRow[]>('/platforms/permissions').catch(() => []),
      ])
      setPlatforms(p || [])
      setPerms(m || [])
    } catch (e: any) {
      setMsg(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCredentialModal = (platformCode: string, platformName: string, shop: ShopAccessInfo) => {
    setActiveShop({ platformCode, platformName, shop })
    setModalTab('oauth')
    setAppKey('')
    setAppSecret('')
    setAccessToken('')
    setRefreshToken('')
    setAuthStatus(shop.authStatus === 'manual_only' ? 'authorized' : (shop.authStatus as any) || 'authorized')
    setRedirectUri(`${window.location.origin}/api/v1/platforms/${platformCode}/oauth/callback`)
    setOauthUrl('')
    setOauthCode('')
    setModalErr(null)
  }

  const togglePlatform = async (code: string, enabled: boolean) => {
    setSaving(code)
    try {
      await api.put(`/platforms/${code}`, { is_enabled: enabled })
      setMsg(`已${enabled ? '启用' : '停用'}该平台，全站相关入口将同步${enabled ? '显示' : '隐藏'}`)
      await load()
      await refreshPlatforms()
    } catch (e: any) {
      setMsg(e?.message || '操作失败')
    } finally {
      setSaving(null)
    }
  }

  const handleGenerateOAuthUrl = async () => {
    if (!activeShop) return
    setSubmittingCreds(true)
    setModalErr(null)
    try {
      const params = new URLSearchParams({ shopId: String(activeShop.shop.id) })
      if (redirectUri.trim()) params.set('redirectUri', redirectUri.trim())
      if (appKey.trim()) params.set('appKey', appKey.trim())
      const res = await api.get<{ authorizeUrl: string }>(
        `/platforms/${activeShop.platformCode}/oauth/url?${params.toString()}`,
      )
      setOauthUrl(res.authorizeUrl)
    } catch (e: any) {
      setModalErr(e?.message || '生成授权地址失败')
    } finally {
      setSubmittingCreds(false)
    }
  }

  const handleOAuthExchange = async () => {
    if (!activeShop) return
    setSubmittingCreds(true)
    setModalErr(null)
    try {
      const res = await api.post<{ appKeyMasked: string; accessTokenMasked: string }>(
        `/platforms/${activeShop.platformCode}/oauth/callback`,
        {
          shopId: activeShop.shop.id,
          code: oauthCode.trim(),
          ...(appKey.trim() ? { appKey: appKey.trim() } : {}),
          ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}),
        },
      )
      setMsg(`店铺 [${activeShop.shop.name}] OAuth 授权绑定成功（AccessToken: ${res.accessTokenMasked}）`)
      setActiveShop(null)
      await load()
    } catch (e: any) {
      setModalErr(e?.message || 'OAuth 授权码换取 Token 失败')
    } finally {
      setSubmittingCreds(false)
    }
  }

  const handleSaveDirectCredentials = async () => {
    if (!activeShop) return
    setSubmittingCreds(true)
    setModalErr(null)
    try {
      const res = await api.post<{ authStatus: string; accessTokenMasked: string }>(
        `/platforms/${activeShop.platformCode}/shops/${activeShop.shop.id}/credentials`,
        {
          authStatus,
          ...(appKey.trim() ? { appKey: appKey.trim() } : {}),
          ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}),
          ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
          ...(refreshToken.trim() ? { refreshToken: refreshToken.trim() } : {}),
        },
      )
      setMsg(
        authStatus === 'manual_only'
          ? `店铺 [${activeShop.shop.name}] 已切回仅手动上传模式`
          : `店铺 [${activeShop.shop.name}] API 凭证已 AES-256-GCM 加密更新（状态: ${res.authStatus}）`,
      )
      setActiveShop(null)
      await load()
    } catch (e: any) {
      setModalErr(e?.message || '凭证保存失败')
    } finally {
      setSubmittingCreds(false)
    }
  }

  const handleTriggerSync = async (platformCode: string, shop: ShopAccessInfo) => {
    setSyncingShopId(shop.id)
    try {
      const res = await api.post<{
        summary: { completed: number; skipped: number; failed: number }
        results: Array<{ status: string; insertedRows: number; reason?: string; error?: string }>
      }>('/ingest/sync', { platformCode, shopId: shop.id, dataType: 'trade' })
      const job = res?.results?.[0]
      if (job?.status === 'completed') {
        setMsg(`店铺 [${shop.name}] 交易 API 同步完成：入库 ${job.insertedRows} 条日维度记录`)
      } else if (job?.status === 'skipped') {
        setMsg(`店铺 [${shop.name}] 已安全跳过同步：${job.reason || '未启用或仅手动上传'}`)
      } else {
        setMsg(`店铺 [${shop.name}] 同步未完成：${job?.error || job?.reason || '未知原因'}`)
      }
    } catch (e: any) {
      setMsg(e?.message || '触发同步失败')
    } finally {
      setSyncingShopId(null)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">平台与渠道管理</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          管理全站平台的启用状态、店铺 OAuth/AES-256-GCM API 凭证绑定与角色权限矩阵
        </p>
      </motion.div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-300">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs text-cyan-500 hover:text-cyan-300">关闭</button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">加载中…</div>
      ) : (
        <>
          {/* 平台总控 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" /> 平台启停总控
                  <span className="text-xs text-[var(--text-muted)]">停用后，全站导航、大盘、AI 问答、上传模板中的该平台将全部隐藏</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {platforms.map((p) => (
                    <div
                      key={p.platform_code}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-orbit-ink/40 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-[var(--text-secondary)]">{p.platform_name}</span>
                      <Badge variant={CATEGORY_VARIANT[p.category] || 'neutral'}>
                        {CATEGORY_LABEL[p.category] || p.category}
                      </Badge>
                      <span className="font-mono text-[11px] text-[var(--text-primary)]">{p.platform_code}</span>

                      {p.capabilities && (
                        <span className="flex gap-1 text-[10px] text-[var(--text-muted)]">
                          {p.capabilities.supportsLive && <span className="rounded bg-[var(--surface3)] px-1.5 py-0.5">直播</span>}
                          {p.capabilities.supportsShelf && <span className="rounded bg-[var(--surface3)] px-1.5 py-0.5">货架</span>}
                          {p.capabilities.supportsContent && <span className="rounded bg-[var(--surface3)] px-1.5 py-0.5">内容</span>}
                          {p.capabilities.supportsAutoSync && <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-emerald-400">API</span>}
                        </span>
                      )}

                      <span className="text-xs text-[var(--text-muted)]">{p.shops.length} 个店铺</span>

                      <div className="ml-auto flex items-center gap-2">
                        <span className={cn('flex items-center gap-1 text-xs', p.is_enabled ? 'text-emerald-400' : 'text-[var(--text-muted)]')}>
                          {p.is_enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {p.is_enabled ? '已启用' : '已停用'}
                        </span>
                        <button
                          onClick={() => togglePlatform(p.platform_code, !p.is_enabled)}
                          disabled={saving === p.platform_code}
                          className={cn(
                            'relative h-5 w-9 rounded-full transition',
                            p.is_enabled ? 'bg-emerald-600' : 'bg-[var(--border2)]',
                            saving === p.platform_code && 'opacity-50',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                              p.is_enabled ? 'left-4.5' : 'left-0.5',
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 店铺接入与 OAuth/加密凭证管理 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" /> 店铺接入情况与 OpenAPI 授权
                  <span className="text-xs text-[var(--text-muted)]">所有敏感密钥采用 AES-256-GCM 密文存储，未授权店铺自动 fail-closed 跳过外部请求</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                        <th className="py-2 pr-3">平台</th>
                        <th className="py-2 pr-3">店铺</th>
                        <th className="py-2 pr-3">状态</th>
                        <th className="py-2 pr-3">授权方式</th>
                        <th className="py-2 pr-3">已绑凭证 (脱敏)</th>
                        <th className="py-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platforms.flatMap((p) =>
                        p.shops.map((s) => (
                          <tr key={`${p.platform_code}-${s.id}`} className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                            <td className="py-2.5 pr-3">{p.platform_name}</td>
                            <td className="py-2.5 pr-3 text-[var(--text-secondary)]">{s.name}</td>
                            <td className="py-2.5 pr-3">
                              <Badge variant={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</Badge>
                            </td>
                            <td className="py-2.5 pr-3">
                              <Badge variant={s.authStatus === 'authorized' ? 'success' : 'warning'}>
                                {s.authStatus === 'authorized' ? 'API 已授权' : s.authStatus === 'manual_only' ? '仅手动上传' : s.authStatus}
                              </Badge>
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-xs text-[var(--text-muted)]">
                              {s.hasCredentials ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <Lock className="h-3 w-3" /> {s.appKeyMasked || '已加密'}
                                </span>
                              ) : (
                                <span className="text-[var(--text-primary)]">未配置</span>
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => openCredentialModal(p.platform_code, p.platform_name, s)}
                                  className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20"
                                >
                                  <KeyRound className="h-3 w-3" /> 配置 OAuth / 凭证
                                </button>
                                <button
                                  onClick={() => handleTriggerSync(p.platform_code, s)}
                                  disabled={syncingShopId === s.id}
                                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-orbit-ink px-2.5 py-1 text-xs text-orbit-snow/80 hover:bg-orbit-ink/85 disabled:opacity-50"
                                >
                                  <RefreshCw className={cn('h-3 w-3', syncingShopId === s.id && 'animate-spin')} />
                                  {syncingShopId === s.id ? '同步中…' : '立即同步'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )),
                      )}
                      {platforms.every((p) => p.shops.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">暂无店铺</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 权限矩阵 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> 角色平台权限矩阵
                  <span className="text-xs text-[var(--text-muted)]">（只读展示，修改请使用权限编辑接口）</span>
                </div>
              </CardHeader>
              <CardBody>
                {perms.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)]">暂无权限配置</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                          <th className="py-2 pr-3">角色</th>
                          <th className="py-2 pr-3">可访问平台</th>
                          <th className="py-2">模块限制</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(
                          perms.reduce<Record<string, PermissionRow[]>>((acc, r) => {
                            const key = `${r.role_code}(${r.role_name})`
                            ;(acc[key] ||= []).push(r)
                            return acc
                          }, {}),
                        ).map(([roleLabel, rows]) => (
                          <tr key={roleLabel} className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                            <td className="py-2 pr-3 text-[var(--text-secondary)]">{roleLabel}</td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1">
                                {rows.map((r) => (
                                  <span key={r.id} className="rounded bg-[var(--surface3)] px-1.5 py-0.5 text-[10px]">
                                    {r.platform_name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 text-xs text-[var(--text-muted)]">
                              {rows.every((r) => r.allowed_modules.length === 0)
                                ? '全部模块'
                                : Array.from(new Set(rows.flatMap((r) => r.allowed_modules))).join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}

      {/* OAuth / 凭证绑定弹窗 */}
      {activeShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-orbit-ink p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-orbit-snow">
                  {activeShop.platformName} · {activeShop.shop.name}
                </h2>
                <p className="text-xs text-orbit-snow/60">选择通过官方 OAuth 换取 Token 或直接绑定加密 API 凭据</p>
              </div>
              <button onClick={() => setActiveShop(null)} className="rounded p-1 text-orbit-snow/60 hover:bg-orbit-ink hover:text-orbit-snow">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex gap-2 border-b border-[var(--border)] pb-2">
              <button
                onClick={() => { setModalTab('oauth'); setModalErr(null) }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium',
                  modalTab === 'oauth' ? 'bg-cyan-500/20 text-cyan-300' : 'text-orbit-snow/60 hover:text-orbit-snow',
                )}
              >
                官方 OAuth 授权码换 Token
              </button>
              <button
                onClick={() => { setModalTab('direct'); setModalErr(null) }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium',
                  modalTab === 'direct' ? 'bg-cyan-500/20 text-cyan-300' : 'text-orbit-snow/60 hover:text-orbit-snow',
                )}
              >
                直接绑定凭证 / 模式切换
              </button>
            </div>

            {modalErr && (
              <div className="mb-3 rounded border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {modalErr}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-orbit-snow/60">AppKey</span>
                  <input
                    value={appKey}
                    onChange={(e) => setAppKey(e.target.value)}
                    placeholder="填写开放平台真实 AppKey"
                    className="w-full rounded border border-[var(--border)] bg-orbit-ink/80 px-2.5 py-1.5 text-orbit-snow outline-none focus:border-cyan-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-orbit-snow/60">AppSecret</span>
                  <input
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="将使用 AES-256-GCM 加密存储"
                    className="w-full rounded border border-[var(--border)] bg-orbit-ink/80 px-2.5 py-1.5 text-orbit-snow outline-none focus:border-cyan-500"
                  />
                </label>
              </div>

              {modalTab === 'oauth' ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-orbit-snow/60">回调地址 (Redirect URI)</span>
                    <input
                      value={redirectUri}
                      onChange={(e) => setRedirectUri(e.target.value)}
                      className="w-full rounded border border-[var(--border)] bg-orbit-ink/80 px-2.5 py-1.5 text-orbit-snow outline-none focus:border-cyan-500"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGenerateOAuthUrl}
                      disabled={submittingCreds}
                      className="rounded border border-[var(--border)] bg-orbit-ink px-3 py-1.5 text-orbit-snow/80 hover:bg-orbit-ink/85 disabled:opacity-50"
                    >
                      1. 生成官方授权链接
                    </button>
                    {oauthUrl && (
                      <a
                        href={oauthUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                      >
                        前往平台授权 <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {oauthUrl && (
                    <div className="break-all rounded border border-[var(--border)] bg-orbit-snow/10 p-2 font-mono text-[11px] text-orbit-snow/60">
                      {oauthUrl}
                    </div>
                  )}
                  <label className="block space-y-1">
                    <span className="text-orbit-snow/60">2. 输入授权回调得到的 Code</span>
                    <input
                      value={oauthCode}
                      onChange={(e) => setOauthCode(e.target.value)}
                      placeholder="粘贴回跳 URL 中的 ?code=..."
                      className="w-full rounded border border-[var(--border)] bg-orbit-ink/80 px-2.5 py-1.5 text-orbit-snow outline-none focus:border-cyan-500"
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setActiveShop(null)} className="rounded px-3 py-1.5 text-orbit-snow/60 hover:text-orbit-snow">
                      取消
                    </button>
                    <button
                      onClick={handleOAuthExchange}
                      disabled={submittingCreds || !oauthCode.trim()}
                      className="rounded bg-cyan-600 px-3.5 py-1.5 font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                    >
                      {submittingCreds ? '提交中…' : '换取 Token 并绑定'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="block space-y-1">
                    <span className="text-orbit-snow/60">授权状态</span>
                    <select
                      value={authStatus}
                      onChange={(e) => setAuthStatus(e.target.value as any)}
                      className="w-full rounded border border-[var(--border)] bg-orbit-ink/80 px-2.5 py-1.5 text-orbit-snow outline-none focus:border-cyan-500"
                    >
                      <option value="authorized">authorized（启用 API 自动同步）</option>
                      <option value="manual_only">manual_only（清空凭证，仅手动上传）</option>
                      <option value="unauthorized">unauthorized（暂停自动拉取）</option>
                    </select>
                  </label>
                  {authStatus !== 'manual_only' && (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-orbit-snow/60">AccessToken</span>
                        <input
                          type="password"
                          value={accessToken}
                          onChange={(e) => setAccessToken(e.target.value)}
                          placeholder="真实商户 AccessToken"
                          className="w-full rounded border border-[var(--border)] bg-orbit-ink/80 px-2.5 py-1.5 text-orbit-snow outline-none focus:border-cyan-500"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-orbit-snow/60">RefreshToken（可选）</span>
                        <input
                          type="password"
                          value={refreshToken}
                          onChange={(e) => setRefreshToken(e.target.value)}
                          placeholder="用于后续刷新续期"
                          className="w-full rounded border border-[var(--border)] bg-orbit-ink/80 px-2.5 py-1.5 text-orbit-snow outline-none focus:border-cyan-500"
                        />
                      </label>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setActiveShop(null)} className="rounded px-3 py-1.5 text-orbit-snow/60 hover:text-orbit-snow">
                      取消
                    </button>
                    <button
                      onClick={handleSaveDirectCredentials}
                      disabled={submittingCreds}
                      className="rounded bg-cyan-600 px-3.5 py-1.5 font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                    >
                      {submittingCreds ? '保存中…' : 'AES-256-GCM 加密保存'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
