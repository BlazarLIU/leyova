import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Settings, CheckCircle, XCircle, Store, Shield } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface PlatformRow {
  platform_code: string
  platform_name: string
  category: 'live' | 'shelf' | 'content'
  is_enabled: boolean
  sort_order: number
  shops: Array<{ id: number; name: string; status: string; authStatus: string }>
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
  const [msg, setMsg] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <h1 className="text-2xl font-semibold text-slate-100">平台与渠道管理</h1>
        <p className="mt-1 text-sm text-slate-400">
          管理全站平台的启用状态、店铺接入情况与角色权限矩阵
        </p>
      </motion.div>

      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-300">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs text-cyan-500 hover:text-cyan-300">关闭</button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : (
        <>
          {/* 平台总控 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" /> 平台启停总控
                  <span className="text-xs text-slate-500">停用后，全站导航、大盘、AI 问答、上传模板中的该平台将全部隐藏</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {platforms.map((p) => (
                    <div
                      key={p.platform_code}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-slate-200">{p.platform_name}</span>
                      <Badge variant={CATEGORY_VARIANT[p.category] || 'neutral'}>
                        {CATEGORY_LABEL[p.category] || p.category}
                      </Badge>
                      <span className="font-mono text-[11px] text-slate-600">{p.platform_code}</span>

                      {p.capabilities && (
                        <span className="flex gap-1 text-[10px] text-slate-500">
                          {p.capabilities.supportsLive && <span className="rounded bg-slate-700/60 px-1.5 py-0.5">直播</span>}
                          {p.capabilities.supportsShelf && <span className="rounded bg-slate-700/60 px-1.5 py-0.5">货架</span>}
                          {p.capabilities.supportsContent && <span className="rounded bg-slate-700/60 px-1.5 py-0.5">内容</span>}
                          {p.capabilities.supportsAutoSync && <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-emerald-400">API</span>}
                        </span>
                      )}

                      <span className="text-xs text-slate-500">{p.shops.length} 个店铺</span>

                      <div className="ml-auto flex items-center gap-2">
                        <span className={cn('flex items-center gap-1 text-xs', p.is_enabled ? 'text-emerald-400' : 'text-slate-500')}>
                          {p.is_enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {p.is_enabled ? '已启用' : '已停用'}
                        </span>
                        <button
                          onClick={() => togglePlatform(p.platform_code, !p.is_enabled)}
                          disabled={saving === p.platform_code}
                          className={cn(
                            'relative h-5 w-9 rounded-full transition',
                            p.is_enabled ? 'bg-emerald-600' : 'bg-slate-700',
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

          {/* 店铺接入情况 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" /> 店铺接入情况
                </div>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
                        <th className="py-2 pr-3">平台</th>
                        <th className="py-2 pr-3">店铺</th>
                        <th className="py-2 pr-3">状态</th>
                        <th className="py-2">授权方式</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platforms.flatMap((p) =>
                        p.shops.map((s) => (
                          <tr key={`${p.platform_code}-${s.id}`} className="border-b border-slate-800/60 text-slate-300">
                            <td className="py-2 pr-3">{p.platform_name}</td>
                            <td className="py-2 pr-3 text-slate-200">{s.name}</td>
                            <td className="py-2 pr-3">
                              <Badge variant={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</Badge>
                            </td>
                            <td className="py-2">
                              <Badge variant={s.authStatus === 'authorized' ? 'success' : 'warning'}>
                                {s.authStatus === 'authorized' ? 'API 已授权' : s.authStatus === 'manual_only' ? '仅手动上传' : s.authStatus}
                              </Badge>
                            </td>
                          </tr>
                        )),
                      )}
                      {platforms.every((p) => p.shops.length === 0) && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-xs text-slate-500">暂无店铺</td>
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
                  <span className="text-xs text-slate-500">（只读展示，修改请使用权限编辑接口）</span>
                </div>
              </CardHeader>
              <CardBody>
                {perms.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">暂无权限配置</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left text-xs text-slate-400">
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
                          <tr key={roleLabel} className="border-b border-slate-800/60 text-slate-300">
                            <td className="py-2 pr-3 text-slate-200">{roleLabel}</td>
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1">
                                {rows.map((r) => (
                                  <span key={r.id} className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px]">
                                    {r.platform_name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 text-xs text-slate-500">
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
    </div>
  )
}
