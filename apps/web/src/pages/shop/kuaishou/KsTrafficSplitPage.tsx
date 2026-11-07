import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Home, Compass, Info, TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface TrafficSplit {
  range: { from: string; to: string }
  privateTraffic: { gmv: number; share: number | null; note: string }
  publicTraffic: { gmv: number; share: number | null; note: string }
  otherTraffic: { gmv: number; share: number | null }
  totalGmv: number
  privateRatio: number | null
  healthAssessment: string
}

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(2) + '%'
}

export function KsTrafficSplitPage() {
  const { currentShop } = usePlatform()
  const [data, setData] = useState<TrafficSplit | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); setData(null); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const d = await api.get<TrafficSplit>(`/kuaishou/shop/${currentShop.id}/traffic-split`, {
        from: fd.toISOString().slice(0, 10), to,
      })
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, days])

  useEffect(() => { load() }, [load])

  const hasData = !!data && data.totalGmv > 0
  const privatePct = data?.privateRatio ?? 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">公私域流量分析</h1>
            <p className="mt-1 text-sm text-slate-400">
              {currentShop ? currentShop.name : '未选择店铺'} · 快手「先关注后成交」的私域电商
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded px-3 py-1.5 text-xs transition ${
                  days === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}>近 {d} 天</button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 概念说明 */}
      <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">快手与抖音的根本差异</span>
          <p className="mt-1 text-cyan-400/70">
            快手是「<strong className="text-cyan-300">先关注后成交</strong>」：发现页（公域）拉新 → 沉淀粉丝 → 关注页（私域）复购。
            抖音是「<strong className="text-cyan-300">先成交再沉淀</strong>」：推荐算法把货推给可能感兴趣的人。
            一句话：<em>快手算「一个粉丝三年值多少钱」，抖音算「一次曝光值多少 GMV」</em>。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">该店铺在选定周期内暂无数据</p>
            <p className="mt-1 text-xs text-slate-600">需从快手小店生意通导出数据后导入</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 公私域占比可视化 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> 公私域成交结构
                </div>
              </CardHeader>
              <CardBody>
                {/* 占比条 */}
                <div className="mb-4 flex h-10 overflow-hidden rounded-lg">
                  {data!.privateTraffic.gmv > 0 && (
                    <div
                      className="flex items-center justify-center bg-emerald-600/70 text-xs font-medium text-white"
                      style={{ width: `${privatePct}%` }}
                    >
                      {privatePct >= 12 && `私域 ${privatePct.toFixed(1)}%`}
                    </div>
                  )}
                  {(data!.publicTraffic.share ?? 0) > 0 && (
                    <div
                      className="flex items-center justify-center bg-cyan-600/70 text-xs font-medium text-white"
                      style={{ width: `${data!.publicTraffic.share}%` }}
                    >
                      {(data!.publicTraffic.share ?? 0) >= 12 && `公域 ${data!.publicTraffic.share}%`}
                    </div>
                  )}
                  {(data!.otherTraffic.share ?? 0) > 0 && (
                    <div
                      className="flex items-center justify-center bg-slate-600/70 text-xs text-white"
                      style={{ width: `${data!.otherTraffic.share}%` }}
                    >
                      {(data!.otherTraffic.share ?? 0) >= 12 && `其他 ${data!.otherTraffic.share}%`}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* 私域 */}
                  <div className="rounded-lg border border-emerald-600/40 bg-emerald-500/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <Home className="h-3.5 w-3.5" /> 关注页（私域）
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-xl font-semibold text-emerald-300">{fmt(data!.privateTraffic.gmv)}</span>
                      <span className="text-xs text-emerald-500/70">{fmtPct(data!.privateTraffic.share)}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-500/60">{data!.privateTraffic.note}</p>
                  </div>

                  {/* 公域 */}
                  <div className="rounded-lg border border-cyan-600/40 bg-cyan-500/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-cyan-400">
                      <Compass className="h-3.5 w-3.5" /> 发现页 + 搜索（公域）
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-xl font-semibold text-cyan-300">{fmt(data!.publicTraffic.gmv)}</span>
                      <span className="text-xs text-cyan-500/70">{fmtPct(data!.publicTraffic.share)}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-cyan-500/60">{data!.publicTraffic.note}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-slate-800/40 px-3 py-2 text-xs">
                  <span className="text-slate-400">总成交：</span>
                  <span className="font-mono text-slate-200">{fmt(data!.totalGmv)} 元</span>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 健康度评估 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>私域经营健康度</CardHeader>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 rounded-lg px-3 py-2 text-center ${
                    privatePct >= 50 ? 'bg-emerald-500/15 text-emerald-400'
                    : privatePct >= 30 ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-rose-500/15 text-rose-400'
                  }`}>
                    <div className="text-2xl font-semibold">{privatePct.toFixed(1)}%</div>
                    <div className="text-[10px]">私域占比</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={privatePct >= 50 ? 'success' : privatePct >= 30 ? 'warning' : 'danger'}>
                        {privatePct >= 50 ? '健康' : privatePct >= 30 ? '一般' : '薄弱'}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-300">{data!.healthAssessment}</p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      评估标准：私域占比 ≥50% 为健康，30-50% 为一般，&lt;30% 为薄弱。
                      该标准基于行业普遍认知，非快手官方口径，供参考。
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}
