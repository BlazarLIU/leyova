import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, UserPlus, Heart, Info } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface FansTeam {
  range: { from: string; to: string }
  followers: { new: number; total: number; note: string }
  fansTeam: { newJoiners: number; total: number; joinRate: number | null; note: string }
  closeFriends: number
  assessment: string
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(2) + '%'
}

export function KsFansTeamPage() {
  const { currentShop } = usePlatform()
  const [data, setData] = useState<FansTeam | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); setData(null); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const d = await api.get<FansTeam>(`/kuaishou/shop/${currentShop.id}/fans`, {
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

  const hasData = !!data && (data.followers.new > 0 || data.fansTeam.newJoiners > 0)
  const joinRate = data?.fansTeam.joinRate ?? 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">粉丝团运营</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {currentShop ? currentShop.name : '未选择店铺'} · 快手独有��粉丝资产运营
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

      <div className="flex items-start gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-cyan-300/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">什么是粉丝团/购物团？</span>
          <p className="mt-1 text-cyan-400/70">
            关注主播后可加入「购物团」，随购物、点赞、分享累积<strong className="text-cyan-300">亲密度</strong>并升级，
            享受梯度权益（专属优惠券、红包、福利品）。主播可在购买前/中/后三段精准触达。
            <strong className="text-cyan-300">这是快手把粉丝关系变成可运营资产的核心机制。</strong>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Users className="mx-auto h-10 w-10 text-[var(--text-primary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">该店铺在选定周期内暂无粉丝数据</p>
            <p className="mt-1 text-xs text-[var(--text-primary)]">需从快手生意通导出粉丝与粉丝团数据</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={UserPlus} label="新增粉丝" value={String(data!.followers.new)} unit="人" />
            <Stat icon={Users} label="粉丝总数" value={String(data!.followers.total)} unit="人" />
            <Stat icon={Heart} label="粉丝团新增" value={String(data!.fansTeam.newJoiners)} unit="人" />
            <Stat icon={Heart} label="粉丝团总数" value={String(data!.fansTeam.total)} unit="人" />
          </motion.div>

          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>入团转化率</CardHeader>
              <CardBody>
                <div className="flex flex-wrap items-center gap-4">
                  <div className={`shrink-0 rounded-lg px-4 py-3 text-center ${
                    joinRate >= 40 ? 'bg-emerald-500/15 text-emerald-400'
                    : joinRate >= 20 ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-rose-500/15 text-rose-400'
                  }`}>
                    <div className="text-2xl font-semibold">{fmtPct(data!.fansTeam.joinRate)}</div>
                    <div className="text-[10px]">新增粉丝中入团</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={joinRate >= 40 ? 'success' : joinRate >= 20 ? 'warning' : 'danger'}>
                        {joinRate >= 40 ? '优秀' : joinRate >= 20 ? '正常' : '偏低'}
                      </Badge>
                      <span className="text-xs text-[var(--text-muted)]">
                        {data!.fansTeam.newJoiners} / {data!.followers.new} 新粉丝加入
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{data!.assessment}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-orbit-ink">
                      <div
                        className={`h-full rounded-full ${joinRate >= 40 ? 'bg-emerald-500' : joinRate >= 20 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(joinRate, 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">{data!.fansTeam.note}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-lg bg-orbit-ink/40 px-3 py-2 text-xs">
                  <span className="text-[var(--text-muted)]">高亲密度粉丝</span>
                  <span className="font-mono text-[var(--text-secondary)]">{data!.closeFriends}</span>
                  <span className="text-[var(--text-primary)]">·</span>
                  <span className="text-[var(--text-muted)]">亲密度达标的核心复购人群</span>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, unit }: {
  icon: any; label: string; value: string; unit: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-orbit-ink/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-lg font-semibold text-[var(--text-primary)]">{value}</span>
        <span className="text-[11px] text-[var(--text-muted)]">{unit}</span>
      </div>
    </div>
  )
}
