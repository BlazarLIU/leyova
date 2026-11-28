import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Building2, TrendingUp, ShoppingCart, Percent, Undo2, AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface OverviewResp {
  range: { from: string; to: string }
  current: {
    gmv: number; payAmount: number; paidOrderCount: number; paidBuyerCount: number
    refundAmount: number; refundRate: number; netSales: number; avgOrderValue: number
  }
  previous?: { gmv: number }
  growth?: Record<string, number | null>
}

interface ShopRow {
  shopId: number; shopName: string; platformCode: string
  gmv: number; orders: number; refundAmount?: number
}

/**
 * 品牌方只读门户（P1-B16）
 *
 * 背景：brand_viewer 角色此前是「幽灵角色」——users_role_check 允许、
 *      getDefaultHomePath 和 RequireAccess 都跳 /brand-portal，但该路由不存在 → 登录白屏。
 *
 * 本页是品牌方登录后的落地页：
 *   · 只读，无任何写操作入口
 *   · 不含成本字段（canAccessCost 对 brand_viewer 恒为 false）
 *   · 数据范围由 RLS 的 brand_viewer_permissions.project_ids 隔离
 */
export function BrandPortalPage() {
  const { user } = useAuth()
  const [overview, setOverview] = useState<OverviewResp | null>(null)
  const [shops, setShops] = useState<ShopRow[]>([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
      const [ov, sh] = await Promise.all([
        api.get<OverviewResp>(`/omnichannel/overview?from=${from}&to=${to}`).catch(() => null),
        api.get<ShopRow[]>(`/omnichannel/shops?from=${from}&to=${to}`).catch(() => []),
      ])
      setOverview(ov)
      setShops(Array.isArray(sh) ? sh : [])
    } catch (e: any) {
      setErr(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const c = overview?.current

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <motion.div {...fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Building2 className="w-6 h-6 text-orbit-primary" /> 品牌方经营看板
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            {user?.realName || user?.username} · 只读视角 · 数据范围为本品牌授权店铺
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-[var(--text-secondary)]">
            <option value={7}>近 7 天</option>
            <option value={30}>近 30 天</option>
            <option value={90}>近 90 天</option>
          </select>
          <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </motion.div>

      {err && (
        <div className="rounded-lg border border-orbit-danger/30 bg-orbit-danger/10 px-3 py-2 text-xs text-status-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="GMV" value={`¥${fmt(c?.gmv)}`} icon={TrendingUp} accent="primary" />
        <KpiCard label="支付金额" value={`¥${fmt(c?.payAmount)}`} icon={ShoppingCart} />
        <KpiCard label="支付订单" value={fmt(c?.paidOrderCount)} />
        <KpiCard label="买家数" value={fmt(c?.paidBuyerCount)} />
        <KpiCard label="退款率" value={`${c?.refundRate ?? 0}%`} icon={Percent} accent="warn" />
        <KpiCard label="客单价" value={`¥${fmt(c?.avgOrderValue)}`} icon={Undo2} />
      </div>

      <Card>
        <CardHeader>
          <span className="text-sm font-semibold text-[var(--text-secondary)]">店铺明细</span>
          <Badge variant="neutral">{shops.length} 家</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                <tr className="text-[var(--text-muted)]">
                  <th className="text-left px-4 py-2">店铺</th>
                  <th className="text-left px-3 py-2">平台</th>
                  <th className="text-right px-3 py-2">GMV</th>
                  <th className="text-right px-4 py-2">订单</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((s, i) => (
                  <tr key={`${s.shopId}-${i}`} className="border-b border-orbit-border/40">
                    <td className="px-4 py-1.5 text-[var(--text-secondary)]">{s.shopName || `店铺 ${s.shopId}`}</td>
                    <td className="px-3 py-1.5 text-[var(--text-muted)]">{s.platformCode || '—'}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-secondary)] tabular-nums">¥{fmt(s.gmv)}</td>
                    <td className="px-4 py-1.5 text-right text-[var(--text-secondary)] tabular-nums">{fmt(s.orders)}</td>
                  </tr>
                ))}
                {shops.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    暂无可见店铺（品牌方数据范围由管理员在品牌项目中授权）
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <p className="text-[11px] text-[var(--text-muted)]">
        品牌方视角为<strong>只读</strong>：不可写入、不可查看成本与毛利。数据范围受行级安全（RLS）约束。
      </p>
    </div>
  )
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))

function KpiCard({ label, value, icon: Icon, accent }: {
  label: string; value: React.ReactNode; icon?: any; accent?: 'primary' | 'warn'
}) {
  const cls = accent === 'primary' ? 'text-orbit-primary' : accent === 'warn' ? 'text-status-warning' : 'text-[var(--text-primary)]'
  return (
    <Card><CardBody>
      <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </div>
      <div className={`text-lg font-semibold mt-0.5 tabular-nums ${cls}`}>{value}</div>
    </CardBody></Card>
  )
}

export default BrandPortalPage
