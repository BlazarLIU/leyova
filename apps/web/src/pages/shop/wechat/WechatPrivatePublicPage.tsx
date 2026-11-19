import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Share2, RefreshCw, AlertTriangle, Globe, Lock, Users } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Bucket { gmv: number; views: number; sessions: number; channels: string[] }
interface ChannelRow {
  channel: string; bucket: 'public' | 'private' | 'social'
  sessions: number; impressions: number; views: number
  productClicks: number; orders: number; gmv: number; newFans: number; avgWatchSec: number
}
interface Data {
  range: { from: string; to: string }
  summary: {
    totalGmv: number; totalViews: number
    publicGmvPct: number; privateGmvPct: number; socialGmvPct: number
    publicViewPct: number; privateViewPct: number; socialViewPct: number
  }
  buckets: { public: Bucket; private: Bucket; social: Bucket }
  channels: ChannelRow[]
  note: string
}

const BUCKET_META = {
  public: { label: '公域', icon: Globe, color: 'sky', desc: '视频号推荐 / 直播广场' },
  private: { label: '私域', icon: Lock, color: 'emerald', desc: '朋友圈 / 社群 / 公众号' },
  social: { label: '社交裂变', icon: Users, color: 'violet', desc: '朋友点赞 / 分享' },
} as const

/** 视频号专属：公私域流量拆分（视频号最核心的差异） */
export function WechatPrivatePublicPage() {
  const [data, setData] = useState<Data | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
      setData(await api.get<Data>(`/wechat/private-public?from=${from}&to=${to}`))
    } catch (e: any) {
      setErr(e?.message || '加载失败')
    } finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex-1 flex items-center justify-center p-8"><div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" /></div>

  const s = data?.summary

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <motion.div {...fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Share2 className="w-6 h-6 text-orbit-primary" /> 视频号 · 公私域流量拆分
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            视频号是公私域混合度最高的平台：朋友点赞/分享是独有流量，必须与公域推荐、私域社群分开看
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

      {err && <div className="rounded-lg border border-orbit-danger/30 bg-orbit-danger/10 px-3 py-2 text-xs text-status-danger flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err}</div>}

      {/* 三桶 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['public', 'private', 'social'] as const).map(k => {
          const meta = BUCKET_META[k]
          const b = data?.buckets[k]
          const gmvPct = k === 'public' ? s?.publicGmvPct : k === 'private' ? s?.privateGmvPct : s?.socialGmvPct
          const viewPct = k === 'public' ? s?.publicViewPct : k === 'private' ? s?.privateViewPct : s?.socialViewPct
          const Icon = meta.icon
          const colorCls = meta.color === 'sky' ? 'border-orbit-info/30 bg-orbit-info/5'
            : meta.color === 'emerald' ? 'border-orbit-success/30 bg-orbit-success/5'
            : 'border-orbit-primary/30 bg-orbit-primary/5'
          const textCls = meta.color === 'sky' ? 'text-status-info'
            : meta.color === 'emerald' ? 'text-status-success' : 'text-orbit-primary'
          return (
            <Card key={k}>
              <CardBody className={`border ${colorCls} rounded-lg`}>
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${textCls}`}>
                  <Icon className="w-4 h-4" /> {meta.label}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{meta.desc}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">GMV</div>
                    <div className="text-base font-semibold text-[var(--text-primary)] tabular-nums">¥{fmt(b?.gmv)}</div>
                    <div className={`text-[10px] ${textCls}`}>{gmvPct ?? 0}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)]">观看</div>
                    <div className="text-base font-semibold text-[var(--text-primary)] tabular-nums">{fmt(b?.views)}</div>
                    <div className={`text-[10px] ${textCls}`}>{viewPct ?? 0}%</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(b?.channels || []).slice(0, 4).map(c => (
                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--hover-bg3)] border border-orbit-border/60 text-[var(--text-muted)]">{c}</span>
                  ))}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardBody><div className="text-[11px] text-[var(--text-muted)]">总 GMV</div>
          <div className="text-lg font-semibold text-orbit-primary mt-0.5 tabular-nums">¥{fmt(s?.totalGmv)}</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-[var(--text-muted)]">总观看</div>
          <div className="text-lg font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">{fmt(s?.totalViews)}</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-[var(--text-muted)]">私域+社交 GMV 占比</div>
          <div className="text-lg font-semibold text-status-success mt-0.5 tabular-nums">
            {Number((s?.privateGmvPct ?? 0) + (s?.socialGmvPct ?? 0)).toFixed(2)}%
          </div></CardBody></Card>
      </div>

      <Card>
        <CardHeader><span className="text-sm font-semibold text-[var(--text-secondary)]">渠道明细</span>
          <Badge variant="neutral">{data?.channels.length ?? 0} 个渠道</Badge></CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                <tr className="text-[var(--text-muted)]">
                  <th className="text-left px-4 py-2">渠道</th>
                  <th className="text-left px-3 py-2">归类</th>
                  <th className="text-right px-3 py-2">场次</th>
                  <th className="text-right px-3 py-2">观看</th>
                  <th className="text-right px-3 py-2">商品点击</th>
                  <th className="text-right px-3 py-2">订单</th>
                  <th className="text-right px-3 py-2">GMV</th>
                  <th className="text-right px-4 py-2">平均停留(秒)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.channels || []).map((c, i) => {
                  const meta = BUCKET_META[c.bucket]
                  const cls = c.bucket === 'public' ? 'text-status-info' : c.bucket === 'private' ? 'text-status-success' : 'text-orbit-primary'
                  return (
                    <tr key={`${c.channel}-${i}`} className="border-b border-orbit-border/40">
                      <td className="px-4 py-1.5 text-[var(--text-secondary)]">{c.channel || '(未命名)'}</td>
                      <td className={`px-3 py-1.5 ${cls}`}>{meta.label}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text-muted)]">{c.sessions}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmt(c.views)}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmt(c.productClicks)}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">{fmt(c.orders)}</td>
                      <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">¥{fmt(c.gmv)}</td>
                      <td className="px-4 py-1.5 text-right text-[var(--text-muted)]">{c.avgWatchSec}</td>
                    </tr>
                  )
                })}
                {(data?.channels || []).length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-[var(--text-muted)]">暂无渠道数据</td></tr>}
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

export default WechatPrivatePublicPage
