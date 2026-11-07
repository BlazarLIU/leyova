import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Filter, ArrowRight, Search, Split, Users } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Funnel {
  range: { from: string; to: string }
  stages: {
    impressions: { count: number; label: string; note: string }
    reads: { count: number; rate: number | null; label: string; note: string }
    productClicks: { count: number; rate: number | null; label: string; note: string }
    conversions: { count: number; rate: number | null; label: string; note: string }
  }
  gmv: { onsite: number; offsite: number; total: number; offsiteShare: number | null }
}

interface SearchAnalysis {
  range: { from: string; to: string }
  search: { impressions: number; searchShare: number | null; note: string }
  recommend: { impressions: number; share: number | null }
  assessment: string
}

interface Aips {
  available: boolean
  stages: Array<{ code: string; name: string; description: string }>
  note: string
}

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return String(n)
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(2) + '%'
}
function fmtMoney(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}

export function XhsConversionPage() {
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [search, setSearch] = useState<SearchAnalysis | null>(null)
  const [aips, setAips] = useState<Aips | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const from = fd.toISOString().slice(0, 10)
      const [f, s, a] = await Promise.all([
        api.get<Funnel>('/xiaohongshu/funnel', { from, to }).catch(() => null),
        api.get<SearchAnalysis>('/xiaohongshu/search', { from, to }).catch(() => null),
        api.get<Aips>('/xiaohongshu/aips').catch(() => null),
      ])
      setFunnel(f)
      setSearch(s)
      setAips(a)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const hasData = !!funnel && funnel.stages.impressions.count > 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">种草转化链路</h1>
            <p className="mt-1 text-sm text-slate-400">
              曝光 → 阅读 → 商品点击 → 成交 · 含搜索分析与站内外拆分
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

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Filter className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">暂无笔记数据</p>
            <p className="mt-1 text-xs text-slate-600">需从千帆导出笔记数据后导入</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 转化漏斗 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Filter className="h-4 w-4" /> 种草转化漏斗</div>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  <FunnelStage
                    label={funnel!.stages.impressions.label}
                    count={funnel!.stages.impressions.count}
                    rate={null}
                    max={funnel!.stages.impressions.count}
                    note={funnel!.stages.impressions.note}
                    color="bg-slate-600"
                  />
                  <FunnelStage
                    label={funnel!.stages.reads.label}
                    count={funnel!.stages.reads.count}
                    rate={funnel!.stages.reads.rate}
                    max={funnel!.stages.impressions.count}
                    note={funnel!.stages.reads.note}
                    color="bg-cyan-600"
                  />
                  <FunnelStage
                    label={funnel!.stages.productClicks.label}
                    count={funnel!.stages.productClicks.count}
                    rate={funnel!.stages.productClicks.rate}
                    max={funnel!.stages.impressions.count}
                    note={funnel!.stages.productClicks.note}
                    color="bg-violet-600"
                  />
                  <FunnelStage
                    label={funnel!.stages.conversions.label}
                    count={funnel!.stages.conversions.count}
                    rate={funnel!.stages.conversions.rate}
                    max={funnel!.stages.impressions.count}
                    note={funnel!.stages.conversions.note}
                    color="bg-emerald-600"
                    unit="篇"
                  />
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 站内外拆分 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Split className="h-4 w-4" /> 站内外成交拆分
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-cyan-600/40 bg-cyan-500/5 p-3">
                    <div className="text-xs text-cyan-400">站内成交</div>
                    <div className="mt-1.5 text-xl font-semibold text-cyan-300">{fmtMoney(funnel!.gmv.onsite)}</div>
                    <div className="mt-1 text-[11px] text-cyan-500/70">
                      占比 {fmtPct(funnel!.gmv.onsite > 0 ? (100 - (funnel!.gmv.offsiteShare ?? 0)) : null)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-violet-600/40 bg-violet-500/5 p-3">
                    <div className="text-xs text-violet-400">站外成交</div>
                    <div className="mt-1.5 text-xl font-semibold text-violet-300">
                      {funnel!.gmv.offsite > 0 ? fmtMoney(funnel!.gmv.offsite) : '—'}
                    </div>
                    <div className="mt-1 text-[11px] text-violet-500/70">
                      {funnel!.gmv.offsite > 0 ? `占比 ${fmtPct(funnel!.gmv.offsiteShare)}` : '未接入小红星回传数据'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
                    <div className="text-xs text-slate-400">总成交</div>
                    <div className="mt-1.5 text-xl font-semibold text-slate-100">{fmtMoney(funnel!.gmv.total)}</div>
                    <div className="mt-1 text-[11px] text-slate-500">站内 + 站外</div>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                  小红书的 GMV 天然有两个口径：站内成交（店铺/直播内完成）与站外成交（通过红猫/红京/红美等广告挂链跳转外部平台完成，
                  依赖小红星/小红盟回传）。若站外数据为 0，说明尚未接入对应回传渠道。
                </p>
              </CardBody>
            </Card>
          </motion.div>

          {/* 搜索分析 */}
          {search && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" /> 搜索流量分析
                    <Badge variant="info">小红书独立维度</Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-emerald-600/40 bg-emerald-500/5 p-3">
                      <div className="text-xs text-emerald-400">搜索曝光</div>
                      <div className="mt-1.5 text-xl font-semibold text-emerald-300">{fmt(search.search.impressions)}</div>
                      <div className="mt-1 text-[11px] text-emerald-500/70">占比 {fmtPct(search.search.searchShare)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
                      <div className="text-xs text-slate-400">推荐曝光</div>
                      <div className="mt-1.5 text-xl font-semibold text-slate-100">{fmt(search.recommend.impressions)}</div>
                      <div className="mt-1 text-[11px] text-slate-500">占比 {fmtPct(search.recommend.share)}</div>
                    </div>
                    <div className="flex items-center rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
                      <p className="text-xs text-slate-300">{search.assessment}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{search.search.note}</p>
                </CardBody>
              </Card>
            </motion.div>
          )}

          {/* AIPS */}
          {aips && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> AIPS 人群资产模型
                    {!aips.available && <Badge variant="neutral">待接入</Badge>}
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {aips.stages.map((s, i) => (
                      <div key={s.code} className="relative rounded-lg border border-slate-700/60 bg-slate-800/40 p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-cyan-500/20 text-[10px] font-bold text-cyan-300">
                            {s.code}
                          </span>
                          <span className="text-xs font-medium text-slate-200">{s.name}</span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{s.description}</p>
                        {i < aips.stages.length - 1 && (
                          <ArrowRight className="absolute -right-2 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-slate-700 sm:block" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{aips.note}</p>
                </CardBody>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

function FunnelStage({ label, count, rate, max, note, color, unit }: {
  label: string
  count: number
  rate: number | null
  max: number
  note: string
  color: string
  unit?: string
}) {
  const width = max > 0 ? Math.max((count / max) * 100, 2) : 2
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-slate-200">{fmt(count)}{unit || ''}</span>
          {rate !== null && <Badge variant="info">{fmtPct(rate)}</Badge>}
        </span>
      </div>
      <div className="mt-1 h-6 overflow-hidden rounded bg-slate-800">
        <div className={`h-full ${color} transition-all`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] text-slate-600">{note}</p>
    </div>
  )
}
