import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Video, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Video {
  videoName: string; sessionCount: number; impressions: number; entries: number; clickRate: number; lastPost: string | null
}
interface Trend { date: string; videoEntries: number; liveGmv: number }
interface Data {
  range: { from: string; to: string }
  summary: {
    videoCount: number; totalImpressions: number; totalEntries: number
    entryRate: number; liveGmv: number; gmvPerEntry: number
  }
  videos: Video[]
  trend: Trend[]
  note: string
}

/** 抖音专属：短视频引流 → 直播承接（三池结构） */
export function DouyinShortVideoFunnelPage() {
  const [data, setData] = useState<Data | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
      setData(await api.get<Data>(`/insights/douyin/short-video-funnel?from=${from}&to=${to}`))
    } catch (e: any) {
      setErr(e?.message || '加载失败')
    } finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <motion.div {...fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Video className="w-6 h-6 text-orbit-primary" /> 抖音 · 短视频引流 → 直播承接
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            抖音三池结构：短视频负责蓄水，直播负责收割。本页回答「短视频到底带来了多少直播观众、又换回多少 GMV」
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

      {err && <ErrBar text={err} />}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="引流短视频数" value={data?.summary.videoCount ?? 0} />
        <Stat label="曝光人次" value={fmt(data?.summary.totalImpressions)} />
        <Stat label="进直播人数" value={fmt(data?.summary.totalEntries)} />
        <Stat label="进房率" value={`${data?.summary.entryRate ?? 0}%`} />
        <Stat label="每进房贡献 GMV" value={`¥${data?.summary.gmvPerEntry ?? 0}`} highlight />
      </div>

      <Card>
        <CardHeader>
          <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> 引流 → 承接趋势</span>
          <Badge variant="info">直播 GMV ¥{fmt(data?.summary.liveGmv)}</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[340px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                <tr className="text-slate-400">
                  <th className="text-left px-4 py-2">日期</th>
                  <th className="text-right px-3 py-2">短视频引流进房</th>
                  <th className="text-right px-4 py-2">直播 GMV</th>
                </tr>
              </thead>
              <tbody>
                {(data?.trend || []).map(t => (
                  <tr key={t.date} className="border-b border-orbit-border/40">
                    <td className="px-4 py-1.5 text-slate-300">{t.date}</td>
                    <td className="px-3 py-1.5 text-right text-slate-300">{fmt(t.videoEntries)}</td>
                    <td className="px-4 py-1.5 text-right text-slate-200">¥{fmt(t.liveGmv)}</td>
                  </tr>
                ))}
                {(data?.trend || []).length === 0 && <Empty colSpan={3} />}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold text-slate-200">短视频引流明细（Top 50）</span></CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                <tr className="text-slate-400">
                  <th className="text-left px-4 py-2">视频</th>
                  <th className="text-right px-3 py-2">关联场次</th>
                  <th className="text-right px-3 py-2">曝光</th>
                  <th className="text-right px-3 py-2">进房</th>
                  <th className="text-right px-4 py-2">点击率</th>
                </tr>
              </thead>
              <tbody>
                {(data?.videos || []).map((v, i) => (
                  <tr key={`${v.videoName}-${i}`} className="border-b border-orbit-border/40">
                    <td className="px-4 py-1.5 text-slate-200 truncate max-w-[320px]">{v.videoName || '(未命名)'}</td>
                    <td className="px-3 py-1.5 text-right text-slate-400">{v.sessionCount}</td>
                    <td className="px-3 py-1.5 text-right text-slate-300">{fmt(v.impressions)}</td>
                    <td className="px-3 py-1.5 text-right text-slate-300">{fmt(v.entries)}</td>
                    <td className="px-4 py-1.5 text-right text-slate-300">{v.clickRate}%</td>
                  </tr>
                ))}
                {(data?.videos || []).length === 0 && <Empty colSpan={5} />}
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

function Stat({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <Card><CardBody>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 tabular-nums ${highlight ? 'text-orbit-primary' : 'text-slate-100'}`}>{value}</div>
    </CardBody></Card>
  )
}
function Spinner() {
  return <div className="flex-1 flex items-center justify-center p-8"><div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" /></div>
}
function ErrBar({ text }: { text: string }) {
  return <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{text}</div>
}
function Empty({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-slate-500">暂无数据</td></tr>
}

export default DouyinShortVideoFunnelPage
