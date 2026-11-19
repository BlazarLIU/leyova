import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FileText, Heart, Bookmark, MessageSquare, TrendingUp, Info, Sprout } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface NoteBoard {
  range: { from: string; to: string }
  summary: {
    noteCount: number
    totalImpressions: number
    totalReads: number
    totalLikes: number
    totalCollects: number
    totalComments: number
    totalFollows: number
    avgReadRate: number | null
    avgEngagementRate: number | null
  }
  notes: Array<{
    noteId: string
    title: string
    noteType: string
    impressions: number
    reads: number
    readRate: number | null
    likes: number
    collects: number
    comments: number
    engagementRate: number | null
    onsiteGmv: number
    offsiteGmv: number
    isSeedingOnly: boolean
  }>
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

export function XhsNoteBoardPage() {
  const [data, setData] = useState<NoteBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const d = await api.get<NoteBoard>('/xiaohongshu/notes', {
        from: fd.toISOString().slice(0, 10), to,
      })
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const hasData = !!data && data.summary.noteCount > 0
  const seedingCount = data?.notes.filter((n) => n.isSeedingOnly).length ?? 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">笔记经营看板</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              小红书的核心经营单元是「笔记」，不是店铺
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded px-3 py-1.5 text-xs transition ${
                  days === d ? 'bg-cyan-500/20 text-cyan-300' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}>近 {d} 天</button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 概念说明 */}
      <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">小红书的经营逻辑：NPL 方法论</span>
          <p className="mt-1 text-cyan-400/70">
            <strong className="text-cyan-300">N（笔记）</strong>形成基础认知、激发潜在购买需求 →
            <strong className="text-cyan-300">P（人/群聊）</strong>把粉丝转化为用户资产 →
            <strong className="text-cyan-300">L（直播）</strong>锁定高意向用户放大成交。
            官方核心公式是「LTV × 用户数」，不是「访客×转化率×客单价」。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <FileText className="mx-auto h-10 w-10 text-[var(--text-primary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">暂无笔记数据</p>
            <p className="mt-1 text-xs text-[var(--text-primary)]">需从千帆「笔记数据」导出后导入</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 汇总指标 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={FileText} label="笔记数" value={String(data!.summary.noteCount)} unit="篇" />
            <Stat icon={TrendingUp} label="总曝光" value={fmt(data!.summary.totalImpressions)} unit="次" />
            <Stat icon={TrendingUp} label="总阅读" value={fmt(data!.summary.totalReads)} unit="次" extra={`阅读率 ${fmtPct(data!.summary.avgReadRate)}`} />
            <Stat icon={Heart} label="互动率" value={fmtPct(data!.summary.avgEngagementRate)} extra="赞+藏+评 / 阅读" />
          </motion.div>

          {/* 种草笔记提示 */}
          {seedingCount > 0 && (
            <motion.div {...fadeIn}>
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-emerald-300/90">
                <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <span className="font-medium">{seedingCount} 篇笔记暂无成交，但这是正常的</span>
                  <p className="mt-1 text-emerald-400/70">
                    小红书的笔记首先承担「种草」职能——形成认知、激发需求，成交可能延后到搜索或站外。
                    <strong className="text-emerald-300">零成交的笔记不应被过滤，它们是人群资产的基础。</strong>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 笔记列表 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> 笔记明细
                  <span className="text-xs font-normal text-[var(--text-muted)]">（按阅读量排序）</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                        <th className="py-2 pr-3">笔记标题</th>
                        <th className="py-2 pr-3 text-right">曝光</th>
                        <th className="py-2 pr-3 text-right">阅读</th>
                        <th className="py-2 pr-3 text-right">阅读率</th>
                        <th className="py-2 pr-3 text-right">赞</th>
                        <th className="py-2 pr-3 text-right">藏</th>
                        <th className="py-2 pr-3 text-right">互动率</th>
                        <th className="py-2 text-right">站内/站外 GMV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.notes.map((n) => (
                        <tr key={n.noteId} className="border-b border-[var(--border)] text-[var(--text-secondary)] hover:bg-orbit-ink/30">
                          <td className="max-w-[240px] truncate py-2 pr-3">
                            <span className="text-[var(--text-secondary)]">{n.title}</span>
                            {n.isSeedingOnly && (
                              <span className="ml-1.5 inline-block">
                                <Badge variant="success">种草</Badge>
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">{fmt(n.impressions)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">{fmt(n.reads)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-xs text-cyan-400">{fmtPct(n.readRate)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">{fmt(n.likes)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">{fmt(n.collects)}</td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">{fmtPct(n.engagementRate)}</td>
                          <td className="py-2 text-right font-mono text-xs">
                            {n.onsiteGmv > 0 || n.offsiteGmv > 0
                              ? `${fmt(n.onsiteGmv)} / ${fmt(n.offsiteGmv)}`
                              : <span className="text-[var(--text-primary)]">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[11px] text-[var(--text-muted)]">{data!.note}</p>
              </CardBody>
            </Card>
          </motion.div>

          {/* 互动明细 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-3">
            <SmallStat icon={Heart} label="总点赞" value={fmt(data!.summary.totalLikes)} />
            <SmallStat icon={Bookmark} label="总收藏" value={fmt(data!.summary.totalCollects)} />
            <SmallStat icon={MessageSquare} label="总评论" value={fmt(data!.summary.totalComments)} />
          </motion.div>
        </>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, unit, extra }: {
  icon: any; label: string; value: string; unit?: string; extra?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-orbit-ink/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-lg font-semibold text-[var(--text-primary)]">{value}</span>
        {unit && <span className="text-[11px] text-[var(--text-muted)]">{unit}</span>}
      </div>
      {extra && <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{extra}</div>}
    </div>
  )
}

function SmallStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-orbit-ink/40 px-3 py-2">
      <Icon className="h-4 w-4 text-[var(--text-muted)]" />
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="ml-auto font-mono text-sm text-[var(--text-secondary)]">{value}</span>
    </div>
  )
}
