import { useState, useEffect, useCallback } from 'react'
import { Users, Coins, Plus, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useShops } from '@/hooks/useShops'
import { usePlatform } from '@/hooks/usePlatform'
import { api } from '@/services/api'

interface KolProfile {
  id: number
  kol_name: string
  platform_code: string
  platform_name: string
  platform_uid: string
  tier: string
  fans_count: number
  category: string
  contact_info: string
  default_commission_rate: string
  coop_count: number
  cumulative_net_gmv: string
  cumulative_cost: string
}

interface KolCoop {
  id: number
  kol_id: number
  kol_name: string
  kol_tier: string
  platform_code: string
  platform_name: string
  shop_name: string
  coop_type: string
  campaign_name: string
  publish_date: string
  pit_fee: string
  commission_rate: string
  gmv: string
  refund_amount: string
  net_gmv: string
  commission_amount: string
  settlement_status: string
  roi: string | null
}

interface KolOverview {
  activeKols: number
  totalCoops: number
  totalPitFee: number
  totalGmv: number
  totalNetGmv: number
  totalCommission: number
  unpaidCommission: number
  overallRoi: number | null
}

const TIER_MAP: Record<string, string> = {
  head: '头部达人',
  waist: '腰部达人',
  tail: '尾部达人',
  koc: 'KOC 素人口碑',
}

const SETTLE_BADGE: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'danger' }> = {
  pending: { label: '待确认', variant: 'warning' },
  confirmed: { label: '已对账待打款', variant: 'info' },
  paid: { label: '已打款结算', variant: 'success' },
  disputed: { label: '有争议挂起', variant: 'danger' },
}

export function KolCooperationPage() {
  const { currentPlatform } = usePlatform()
  const [overview, setOverview] = useState<KolOverview | null>(null)
  const [profiles, setProfiles] = useState<KolProfile[]>([])
  const [coops, setCoops] = useState<KolCoop[]>([])
  const [tab, setTab] = useState<'coops' | 'profiles'>('coops')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState<'coop' | 'kol' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const [kolForm, setKolForm] = useState({
    kolName: '',
    platformCode: currentPlatform?.platform_code || 'xiaohongshu',
    platformUid: '',
    tier: 'waist',
    fansCount: '120000',
    category: '时尚穿搭',
    defaultCommissionRate: '0.18',
  })

  const { getShopsByPlatform, getDefaultShopId } = useShops()
  const [coopForm, setCoopForm] = useState({
    kolId: '',
    platformCode: currentPlatform?.platform_code || 'douyin',
    shopId: '',
    coopType: 'live_slot',
    campaignName: '',
    pitFee: '3000',
    commissionRate: '0.15',
    gmv: '50000',
    refundAmount: '2500',
  })

  // 监听顶栏平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      const p = currentPlatform.platform_code
      setKolForm((prev) => ({ ...prev, platformCode: p }))
      setCoopForm((prev) => ({ ...prev, platformCode: p, shopId: getDefaultShopId(p) }))
    }
  }, [currentPlatform?.platform_code, getDefaultShopId])

  useEffect(() => {
    const nextShopId = getDefaultShopId(coopForm.platformCode, coopForm.shopId)
    if (nextShopId && nextShopId !== coopForm.shopId) {
      setCoopForm((prev) => ({ ...prev, shopId: nextShopId }))
    }
  }, [coopForm.platformCode, coopForm.shopId, getDefaultShopId])

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [ov, pf, cp] = await Promise.all([
        api.get<KolOverview>('/kol/overview'),
        api.get<KolProfile[]>('/kol/profiles'),
        api.get<KolCoop[]>('/kol/cooperations'),
      ])
      setOverview(ov)
      setProfiles(pf || [])
      setCoops(cp || [])
      if (pf && pf.length > 0 && !coopForm.kolId) {
        setCoopForm((prev) => ({ ...prev, kolId: String(pf[0].id), platformCode: pf[0].platform_code }))
      }
    } catch (err: any) {
      setErrorMsg(err?.message || '加载达人合作台账失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateKol = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      await api.post('/kol/profiles', {
        ...kolForm,
        fansCount: Number(kolForm.fansCount),
        defaultCommissionRate: Number(kolForm.defaultCommissionRate),
      })
      setShowModal(null)
      setKolForm({ ...kolForm, kolName: '', platformUid: '' })
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.message || '创建达人档案失败')
    }
  }

  const handleCreateCoop = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    try {
      await api.post('/kol/cooperations', {
        kolId: Number(coopForm.kolId),
        platformCode: coopForm.platformCode,
        shopId: Number(coopForm.shopId),
        coopType: coopForm.coopType,
        campaignName: coopForm.campaignName,
        pitFee: Number(coopForm.pitFee),
        commissionRate: Number(coopForm.commissionRate),
        gmv: Number(coopForm.gmv),
        refundAmount: Number(coopForm.refundAmount),
      })
      setShowModal(null)
      setCoopForm({ ...coopForm, campaignName: '' })
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.message || '登记合作记录失败')
    }
  }

  const handleSettle = async (id: number, status: 'confirmed' | 'paid') => {
    setErrorMsg('')
    try {
      await api.patch(`/kol/cooperations/${id}/settle`, { settlementStatus: status })
      await loadData()
    } catch (err: any) {
      setErrorMsg(err?.message || '更新佣金结算状态失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">外部达人合作与佣金台账</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            独立于内部自播员工（anchors），精准管理小红书蒲公英、抖音星图/快手聚星达人坑位费、净GMV CPS佣金与打款状态
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            刷新
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowModal('kol')} icon={<Plus className="w-4 h-4" />}>
            新增达人
          </Button>
          <Button size="sm" onClick={() => setShowModal('coop')} icon={<Plus className="w-4 h-4" />}>
            登记带货合作
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">合作达人 / 场次</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{overview.activeKols} / {overview.totalCoops}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">带货净 GMV（剔退）</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">¥{overview.totalNetGmv.toLocaleString()}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">固定坑位费合计</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-secondary)]">¥{overview.totalPitFee.toLocaleString()}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">应付佣金 / 待结</p>
              <p className="mt-1 text-xl font-bold text-amber-400">
                ¥{overview.totalCommission.toLocaleString()} / <span className="text-red-400">¥{overview.unpaidCommission.toLocaleString()}</span>
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <p className="text-xs text-[var(--text-muted)]">综合投产比 (Net ROI)</p>
              <p className="mt-1 text-2xl font-bold text-cyan-400">{overview.overallRoi ?? '—'}</p>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'coops' ? 'primary' : 'outline'} onClick={() => setTab('coops')} icon={<Coins className="w-4 h-4" />}>
          合作场次与佣金台账
        </Button>
        <Button size="sm" variant={tab === 'profiles' ? 'primary' : 'outline'} onClick={() => setTab('profiles')} icon={<Users className="w-4 h-4" />}>
          达人资源档案库
        </Button>
      </div>

      {tab === 'coops' ? (
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-orbit-border text-xs text-[var(--text-muted)] bg-orbit-surface2/50">
                <tr>
                  <th className="px-4 py-3">达人 / 活动排期</th>
                  <th className="px-4 py-3 text-right">发布日</th>
                  <th className="px-4 py-3 text-right">坑位费</th>
                  <th className="px-4 py-3 text-right">成交 / 净GMV</th>
                  <th className="px-4 py-3 text-right">佣金率 / 实算佣金</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                  <th className="px-4 py-3">结算状态</th>
                  <th className="px-4 py-3 text-right">财务操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orbit-border">
                {coops.map((c) => {
                  const st = SETTLE_BADGE[c.settlement_status] || { label: c.settlement_status, variant: 'neutral' as const }
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="info">{c.platform_name}</Badge>
                          <span className="font-medium text-[var(--text-primary)]">{c.kol_name}</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.campaign_name} · {c.shop_name}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-[var(--text-secondary)]">{c.publish_date?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">¥{Number(c.pit_fee).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="text-[var(--text-muted)] text-xs">¥{Number(c.gmv).toLocaleString()} / </span>
                        <span className="text-emerald-400 font-semibold">¥{Number(c.net_gmv).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="text-xs text-[var(--text-muted)]">{(Number(c.commission_rate) * 100).toFixed(0)}% · </span>
                        <span className="text-amber-400 font-semibold">¥{Number(c.commission_amount).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-cyan-400 tabular-nums">{c.roi ?? '—'}</td>
                      <td className="px-4 py-3"><Badge variant={st.variant} dot>{st.label}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {c.settlement_status === 'pending' && (
                          <Button size="xs" variant="secondary" onClick={() => handleSettle(c.id, 'confirmed')}>确认账单</Button>
                        )}
                        {c.settlement_status === 'confirmed' && (
                          <Button size="xs" variant="primary" onClick={() => handleSettle(c.id, 'paid')} icon={<CheckCircle2 className="w-3 h-3" />}>标记已打款</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {coops.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无达人带货合作记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-orbit-border text-xs text-[var(--text-muted)] bg-orbit-surface2/50">
                <tr>
                  <th className="px-4 py-3">达人名称 / 平台</th>
                  <th className="px-4 py-3">量级 / 类目</th>
                  <th className="px-4 py-3 text-right">粉丝数</th>
                  <th className="px-4 py-3 text-right">默认佣金率</th>
                  <th className="px-4 py-3 text-right">历史合作 / 累计净GMV</th>
                  <th className="px-4 py-3">联系方式</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orbit-border">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="info">{p.platform_name}</Badge>
                        <span className="font-medium text-[var(--text-primary)]">{p.kol_name}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{p.platform_uid}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{TIER_MAP[p.tier] || p.tier} · {p.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">{(p.fans_count / 10000).toFixed(1)} 万</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-400">{(Number(p.default_commission_rate) * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                      {p.coop_count} 次 · ¥{Number(p.cumulative_net_gmv).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{p.contact_info || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {showModal === 'kol' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">新增外部达人档案</h3>
            <form onSubmit={handleCreateKol} className="space-y-3 text-sm">
              <input required placeholder="达人昵称" value={kolForm.kolName} onChange={(e) => setKolForm({ ...kolForm, kolName: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
              <div className="grid grid-cols-2 gap-3">
                <select value={kolForm.platformCode} onChange={(e) => setKolForm({ ...kolForm, platformCode: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]">
                  <option value="douyin">抖音</option>
                  <option value="kuaishou">快手</option>
                  <option value="wechat">视频号</option>
                  <option value="taobao">淘宝</option>
                  <option value="tmall">天猫</option>
                  <option value="xiaohongshu">小红书</option>
                </select>
                <select value={kolForm.tier} onChange={(e) => setKolForm({ ...kolForm, tier: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]">
                  <option value="head">头部达人</option>
                  <option value="waist">腰部达人</option>
                  <option value="tail">尾部达人</option>
                  <option value="koc">KOC素人口碑</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="粉丝数" value={kolForm.fansCount} onChange={(e) => setKolForm({ ...kolForm, fansCount: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
                <input type="number" step="0.01" placeholder="默认佣金率 (如 0.18)" value={kolForm.defaultCommissionRate} onChange={(e) => setKolForm({ ...kolForm, defaultCommissionRate: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(null)}>取消</Button>
                <Button type="submit">保存档案</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'coop' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-orbit-border bg-orbit-surface p-5 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">登记达人带货与佣金排期</h3>
            <form onSubmit={handleCreateCoop} className="space-y-3 text-sm">
              <select
                required
                value={coopForm.kolId}
                onChange={(e) => {
                  const found = profiles.find((p) => String(p.id) === e.target.value)
                  const nextPlatform = found?.platform_code || coopForm.platformCode
                  setCoopForm({
                    ...coopForm,
                    kolId: e.target.value,
                    platformCode: nextPlatform,
                    shopId: getDefaultShopId(nextPlatform),
                    commissionRate: found?.default_commission_rate || coopForm.commissionRate,
                  })
                }}
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
              >
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.kol_name} ({p.platform_name})</option>)}
              </select>
              <select
                required
                value={coopForm.shopId}
                onChange={(e) => setCoopForm({ ...coopForm, shopId: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]"
              >
                {getShopsByPlatform(coopForm.platformCode).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {getShopsByPlatform(coopForm.platformCode).length === 0 && (
                  <option value="">暂无可用店铺</option>
                )}
              </select>
              <input required placeholder="合作专场/笔记名称" value={coopForm.campaignName} onChange={(e) => setCoopForm({ ...coopForm, campaignName: e.target.value })} className="w-full h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.01" placeholder="固定坑位费" value={coopForm.pitFee} onChange={(e) => setCoopForm({ ...coopForm, pitFee: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
                <input type="number" step="0.01" placeholder="CPS佣金率 (如 0.15)" value={coopForm.commissionRate} onChange={(e) => setCoopForm({ ...coopForm, commissionRate: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.01" placeholder="成交 GMV" value={coopForm.gmv} onChange={(e) => setCoopForm({ ...coopForm, gmv: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
                <input type="number" step="0.01" placeholder="退款扣除" value={coopForm.refundAmount} onChange={(e) => setCoopForm({ ...coopForm, refundAmount: e.target.value })} className="h-9 px-3 rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-primary)]" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(null)}>取消</Button>
                <Button type="submit">保存合作排期</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
