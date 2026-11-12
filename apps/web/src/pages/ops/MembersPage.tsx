import { useState, useEffect, useCallback } from 'react'
import { Users, RefreshCw, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

interface MembersOverviewResponse {
  summary: {
    total_members: number
    new_members: number
    active_buyers: number
    repurchase_orders: number
    avg_repurchase_rate: number
    avg_followers_gmv_share: number
    avg_private_domain_cvr: number
  }
  byTier: Array<{
    member_tier: string
    total_members: number
    new_members: number
    active_buyers: number
    repurchase_orders: number
    avg_repurchase_rate: string
    avg_followers_gmv_share: string
    avg_private_domain_cvr: string
  }>
  items: Array<{
    id: number
    platform_code: string
    platform_name: string
    shop_name: string
    biz_date: string
    member_tier: string
    total_members: number
    new_members: number
    active_buyers: number
    repurchase_orders: number
    repurchase_rate: string
    followers_gmv_share: string
    private_domain_cvr: string
  }>
}

export function MembersPage() {
  const [platform, setPlatform] = useState('')
  const [data, setData] = useState<MembersOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<MembersOverviewResponse>('/members/overview', platform ? { platform } : undefined)
      setData(res)
    } catch (err: any) {
      setError(err?.message || '加载会员与私域复购数据失败')
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            会员与私域复购监测
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            跨平台店铺会员资产分层、拉新激活、粉丝成交占比（快手老铁/抖店会员/天猫88VIP）与复购转化率
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-xs text-slate-200"
          >
            <option value="">全部平台</option>
            <option value="douyin">抖音</option>
            <option value="tmall">天猫</option>
            <option value="jd">京东</option>
            <option value="kuaishou">快手</option>
            <option value="xiaohongshu">小红书</option>
          </select>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="secondary" onClick={load}>重试</Button>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card><CardBody>
              <div className="text-xs text-slate-400">总沉淀会员数</div>
              <div className="text-xl font-bold text-slate-100 mt-1 tabular-nums">{data.summary.total_members.toLocaleString()}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">周期新增会员</div>
              <div className="text-xl font-bold text-cyan-400 mt-1 tabular-nums">+{data.summary.new_members.toLocaleString()}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">复购订单数</div>
              <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">{data.summary.repurchase_orders.toLocaleString()}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">平均会员复购率</div>
              <div className="text-xl font-bold text-slate-200 mt-1 tabular-nums">{data.summary.avg_repurchase_rate}%</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">粉丝成交贡献比</div>
              <div className="text-xl font-bold text-amber-400 mt-1 tabular-nums">{data.summary.avg_followers_gmv_share}%</div>
            </CardBody></Card>
          </div>

          <Card>
            <CardHeader title="会员分层汇总与私域留存明细" />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-orbit-border text-slate-500">
                      <th className="text-left px-4 py-2.5">平台/店铺</th>
                      <th className="text-left px-4 py-2.5">会员等级</th>
                      <th className="text-right px-4 py-2.5">会员规模</th>
                      <th className="text-right px-4 py-2.5">新增 / 活跃买家</th>
                      <th className="text-right px-4 py-2.5">复购单数</th>
                      <th className="text-right px-4 py-2.5">复购率</th>
                      <th className="text-right px-4 py-2.5">粉丝 GMV 占比</th>
                      <th className="text-right px-4 py-2.5">私域 CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.id} className="border-b border-orbit-border/60 hover:bg-white/5">
                        <td className="px-4 py-2.5 text-slate-200">{r.platform_name} · {r.shop_name}</td>
                        <td className="px-4 py-2.5"><Badge variant="info">{r.member_tier}</Badge></td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-100">{r.total_members.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">+{r.new_members} / {r.active_buyers}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">{r.repurchase_orders}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{Number(r.repurchase_rate).toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-300">{Number(r.followers_gmv_share).toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-cyan-300">{Number(r.private_domain_cvr).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
