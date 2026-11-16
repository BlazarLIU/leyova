import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Note {
  noteId: string; title: string; noteType: string; author: string
  impressions: number; reads: number; likes: number; collects: number
  productClicks: number; onsiteGmv: number; offsiteGmv: number
}
interface Data {
  range: { from: string; to: string }
  summary: {
    noteCount: number; impressions: number; reads: number; readRate: number
    productClicks: number; clickRate: number
    onsiteGmv: number; offsiteGmv: number; totalGmv: number; offsiteRatio: number
    searchImpressionShare: number; liveSessions: number; liveGmv: number
  }
  notes: Note[]
  note: string
}

/** 小红书专属：笔记 → 直播 → 成交（含站内/站外双口径） */
export function XhsNoteToLivePage() {
  const [data, setData] = useState<Data | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
      setData(await api.get<Data>(`/insights/xiaohongshu/note-to-live?from=${from}&to=${to}`))
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
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-orbit-primary" /> 小红书 · 笔记 → 直播 → 成交
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            小红书核心链路：笔记种草蓄水 → 商品点击 → 站内/站外成交。站外成交占比越高，说明种草外溢到其他平台越强
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-slate-300">
            <option value={7}>近 7 天</option><option value={30}>近 30 天</option><option value={90}>近 90 天</option>
          </select>
          <Button variant="secondary" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </motion.div>

      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err}</div>}

      {/* 转化链 */}
      <Card>
        <CardHeader><span className="text-sm font-semibold text-slate-200">种草转化链</span></CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ChainNode label="笔记曝光" value={fmt(s?.impressions)} />
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <ChainNode label="阅读" value={fmt(s?.reads)} sub={`${s?.readRate ?? 0}%`} />
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <ChainNode label="商品点击" value={fmt(s?.productClicks)} sub={`${s?.clickRate ?? 0}%`} />
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <ChainNode label="站内成交" value={`¥${fmt(s?.onsiteGmv)}`} />
            <span className="text-slate-600">+</span>
            <ChainNode label="站外成交" value={`¥${fmt(s?.offsiteGmv)}`} accent />
            <span className="text-slate-600">=</span>
            <ChainNode label="总成交" value={`¥${fmt(s?.totalGmv)}`} highlight />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardBody><div className="text-[11px] text-slate-400">笔记数</div>
          <div className="text-lg font-semibold text-slate-100 mt-0.5 tabular-nums">{s?.noteCount ?? 0}</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-slate-400">站外成交占比</div>
          <div className="text-lg font-semibold text-amber-400 mt-0.5 tabular-nums">{s?.offsiteRatio ?? 0}%</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-slate-400">搜索曝光占比</div>
          <div className="text-lg font-semibold text-slate-100 mt-0.5 tabular-nums">{s?.searchImpressionShare ?? 0}%</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-slate-400">买手直播场次</div>
          <div className="text-lg font-semibold text-slate-100 mt-0.5 tabular-nums">{s?.liveSessions ?? 0}</div></CardBody></Card>
        <Card><CardBody><div className="text-[11px] text-slate-400">直播 GMV</div>
          <div className="text-lg font-semibold text-orbit-primary mt-0.5 tabular-nums">¥{fmt(s?.liveGmv)}</div></CardBody></Card>
      </div>

      <Card>
        <CardHeader><span className="text-sm font-semibold text-slate-200">笔记明细（按成交排序）</span>
          <Badge variant="info">Top {data?.notes.length ?? 0}</Badge></CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                <tr className="text-slate-400">
                  <th className="text-left px-4 py-2">笔记</th>
                  <th className="text-left px-3 py-2">作者</th>
                  <th className="text-right px-3 py-2">曝光</th>
                  <th className="text-right px-3 py-2">阅读</th>
                  <th className="text-right px-3 py-2">点赞/收藏</th>
                  <th className="text-right px-3 py-2">商品点击</th>
                  <th className="text-right px-3 py-2">站内</th>
                  <th className="text-right px-4 py-2">站外</th>
                </tr>
              </thead>
              <tbody>
                {(data?.notes || []).map(n => (
                  <tr key={n.noteId} className="border-b border-orbit-border/40">
                    <td className="px-4 py-1.5 text-slate-200 truncate max-w-[260px]">{n.title || n.noteId}</td>
                    <td className="px-3 py-1.5 text-slate-400 truncate max-w-[100px]">{n.author || '—'}</td>
                    <td className="px-3 py-1.5 text-right text-slate-300">{fmt(n.impressions)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-300">{fmt(n.reads)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-400">{fmt(n.likes)}/{fmt(n.collects)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-300">{fmt(n.productClicks)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-200">¥{fmt(n.onsiteGmv)}</td>
                    <td className="px-4 py-1.5 text-right text-amber-400">¥{fmt(n.offsiteGmv)}</td>
                  </tr>
                ))}
                {(data?.notes || []).length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">暂无笔记数据</td></tr>}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <p className="text-[11px] text-slate-500">{data?.note}</p>
    </div>
  )
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))

function ChainNode({ label, value, sub, accent, highlight }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? 'border-orbit-primary/40 bg-orbit-primary/5' : accent ? 'border-amber-500/30 bg-amber-500/5' : 'border-orbit-border/60 bg-white/[0.02]'}`}>
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${highlight ? 'text-orbit-primary' : accent ? 'text-amber-300' : 'text-slate-100'}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  )
}

export default XhsNoteToLivePage
