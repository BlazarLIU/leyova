import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Store, RefreshCw, AlertTriangle, Layers } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
// Badge 未使用（S7-B）
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Shop {
  shopId: number; shopName: string; sessions: number; sessionGmv: number
  sessionOrders: number; totalMinutes: number; hasLive: boolean
}
interface OrderTrend { date: string; parentOrders: number; subOrders: number; payAmount: number; refundAmount: number }
interface Data {
  range: { from: string; to: string }
  summary: {
    shopsWithLive: number; totalShops: number; totalSessions: number
    totalSessionGmv: number; parentOrders: number; subOrders: number; skuPerOrder: number
  }
  shops: Shop[]
  orderTrend: OrderTrend[]
  note: string
}

/** 淘宝专属：店铺 × 场次联动（淘宝直播按店铺组织，非按直播间） */
export function TaobaoShopSessionPage() {
  const [data, setData] = useState<Data | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
      setData(await api.get<Data>(`/insights/taobao/shop-session-link?from=${from}&to=${to}`))
    } catch (e: any) {
      setErr(e?.message || '加载失败')
    } finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex-1 flex items-center justify-center p-8"><div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <motion.div {...fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Store className="w-6 h-6 text-orbit-primary" /> 淘宝 · 店铺 × 场次联动
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            淘宝直播按「店铺」组织而非「直播间」，且订单是父子结构（父单=一次付款，子单=商品×SKU）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-[var(--text-secondary)]">
            <option value={7}>近 7 天</option><option value={30}>近 30 天</option><option value={90}>近 90 天</option>
          </select>
          <Button variant="secondary" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </motion.div>

      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardBody><div className="text-[11px] text-[var(--text-muted)]">开播店铺 / 总店铺</div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">{data?.summary.shopsWithLive ?? 0} / {data?.summary.totalShops ?? 0}</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-[var(--text-muted)]">总场次</div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">{data?.summary.totalSessions ?? 0}</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-[var(--text-muted)]">直播间 GMV</div>
          <div className="text-lg font-semibold text-orbit-primary mt-0.5 tabular-nums">¥{fmt(data?.summary.totalSessionGmv)}</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-[var(--text-muted)]">父单 / 子单</div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">{fmt(data?.summary.parentOrders)} / {fmt(data?.summary.subOrders)}</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-[var(--text-muted)]">连带率（子单/父单）</div>
          <div className="text-lg font-semibold text-emerald-400 mt-0.5 tabular-nums">{data?.summary.skuPerOrder ?? 0}</div></CardBody></Card>
      </div>

      <Card>
        <CardHeader><span className="text-sm font-semibold text-[var(--text-secondary)]">店铺 × 场次明细</span></CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                <tr className="text-[var(--text-muted)]">
                  <th className="text-left px-4 py-2">店铺</th>
                  <th className="text-center px-3 py-2">开播</th>
                  <th className="text-right px-3 py-2">场次</th>
                  <th className="text-right px-3 py-2">总时长(分)</th>
                  <th className="text-right px-3 py-2">订单</th>
                  <th className="text-right px-4 py-2">直播间 GMV</th>
                </tr>
              </thead>
              <tbody>
                {(data?.shops || []).map(s => (
                  <tr key={s.shopId} className={`border-b border-orbit-border/40 ${!s.hasLive ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-4 py-1.5 text-[var(--text-secondary)]">{s.shopName}</td>
                    <td className="px-3 py-1.5 text-center">{s.hasLive ? <span className="text-emerald-400">是</span> : <span className="text-amber-400">否</span>}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{s.sessions}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-muted)]">{fmt(s.totalMinutes)}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmt(s.sessionOrders)}</td>
                    <td className="px-4 py-1.5 text-right text-[var(--text-secondary)]">¥{fmt(s.sessionGmv)}</td>
                  </tr>
                ))}
                {(data?.shops || []).length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--text-muted)]">暂无店铺数据</td></tr>}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-1.5"><Layers className="w-4 h-4" /> 父子订单结构趋势</span></CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[320px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                <tr className="text-[var(--text-muted)]">
                  <th className="text-left px-4 py-2">日期</th>
                  <th className="text-right px-3 py-2">父单</th>
                  <th className="text-right px-3 py-2">子单</th>
                  <th className="text-right px-3 py-2">子单支付额</th>
                  <th className="text-right px-4 py-2">退款额</th>
                </tr>
              </thead>
              <tbody>
                {(data?.orderTrend || []).map(o => (
                  <tr key={o.date} className="border-b border-orbit-border/40">
                    <td className="px-4 py-1.5 text-[var(--text-secondary)]">{o.date}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmt(o.parentOrders)}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmt(o.subOrders)}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">¥{fmt(o.payAmount)}</td>
                    <td className="px-4 py-1.5 text-right text-amber-400">¥{fmt(o.refundAmount)}</td>
                  </tr>
                ))}
                {(data?.orderTrend || []).length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--text-muted)]">暂无订单层级数据</td></tr>}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <p className="text-[11px] text-[var(--text-muted)]">{data?.note}</p>
    </div>
  )
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))

export default TaobaoShopSessionPage
