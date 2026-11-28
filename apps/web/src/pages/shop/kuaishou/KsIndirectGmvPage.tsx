import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Zap, Info, ArrowRight, Megaphone } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface IndirectGmv {
  range: { from: string; to: string }
  direct: { gmv: number; share: number | null; note: string }
  indirect: { gmv: number; share: number | null; note: string }
  total: number
  indirectRatio: number | null
  assessment: string
}

interface AdRoi {
  range: { from: string; to: string }
  spend: number
  rois: {
    totalRoi: number | null
    directRoi: number | null
    netRoi: number | null
    roi7d: number | null
  }
  gmv: { total: number; direct: number; indirect: number; net: number }
  comparison: {
    adPlatformGmv: number
    merchantGmv: number
    diffPct: number | null
    warning: string
  }
}

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(2) + '%'
}

export function KsIndirectGmvPage() {
  const { currentShop } = usePlatform()
  const [indirect, setIndirect] = useState<IndirectGmv | null>(null)
  const [adRoi, setAdRoi] = useState<AdRoi | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const from = fd.toISOString().slice(0, 10)
      const [i, a] = await Promise.all([
        api.get<IndirectGmv>(`/kuaishou/shop/${currentShop.id}/indirect-gmv`, { from, to }).catch(() => null),
        api.get<AdRoi>(`/kuaishou/shop/${currentShop.id}/ad-roi`, { from, to }).catch(() => null),
      ])
      setIndirect(i)
      setAdRoi(a)
    } finally {
      setLoading(false)
    }
  }, [currentShop?.id, days])

  useEffect(() => { load() }, [load])

  const hasData = !!indirect && indirect.total > 0
  const ratio = indirect?.indirectRatio ?? 0

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">间接成交分析</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {currentShop ? currentShop.name : '未选择店铺'} · 快手独有的一级指标
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded px-3 py-1.5 text-xs transition ${
                  days === d ? 'bg-orbit-success/20 text-status-ai' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}>近 {d} 天</button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 概念说明 */}
      <div className="flex items-start gap-2 rounded-lg border border-orbit-success/25 bg-orbit-success/5 p-3 text-xs text-status-ai/90">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">什么是「间接成交」？</span>
          <p className="mt-1 text-status-ai/70">
            用户点击广告后<strong className="text-status-ai">没有直接下单</strong>，
            但在<strong className="text-status-ai">当天内</strong>通过关注页、搜索、购物车、个人主页或橱窗再次触达店铺并成交。
            快手把它列为官方一级指标，因为它体现了私域承接能力——<em>广告不只是即时转化，更在养鱼塘</em>。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Zap className="mx-auto h-10 w-10 text-[var(--text-primary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">该店铺在选定周期内暂无投放数据</p>
            <p className="mt-1 text-xs text-[var(--text-primary)]">需从磁力金牛导出投放报表（含直接/间接成交拆分）</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 直接 vs 间接 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>直接成交 vs 间接成交</CardHeader>
              <CardBody>
                <div className="mb-4 flex h-10 overflow-hidden rounded-lg">
                  <div
                    className="flex items-center justify-center bg-orbit-success/70 text-xs font-medium text-white"
                    style={{ width: `${100 - ratio}%` }}
                  >
                    {(100 - ratio) >= 15 && `直接 ${(100 - ratio).toFixed(1)}%`}
                  </div>
                  <div
                    className="flex items-center justify-center bg-orbit-primary/70 text-xs font-medium text-white"
                    style={{ width: `${ratio}%` }}
                  >
                    {ratio >= 15 && `间接 ${ratio.toFixed(1)}%`}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-orbit-success/40 bg-orbit-success/5 p-3">
                    <div className="text-xs text-status-ai">直接成交</div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-xl font-semibold text-status-ai">{fmt(indirect!.direct.gmv)}</span>
                      <span className="text-xs text-status-ai/70">{fmtPct(indirect!.direct.share)}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-status-ai/60">{indirect!.direct.note}</p>
                  </div>
                  <div className="rounded-lg border border-orbit-primary/40 bg-orbit-primary/5 p-3">
                    <div className="text-xs text-orbit-primary">间接成交（快手特色）</div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-xl font-semibold text-orbit-primary">{fmt(indirect!.indirect.gmv)}</span>
                      <span className="text-xs text-orbit-primary/70">{fmtPct(indirect!.indirect.share)}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-orbit-primary/60">{indirect!.indirect.note}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg bg-orbit-ink/40 px-3 py-2 text-xs">
                  <Badge variant={ratio >= 30 ? 'success' : ratio >= 15 ? 'info' : 'neutral'}>
                    {ratio >= 30 ? '私域承接强' : ratio >= 15 ? '衔接良好' : '沉淀较弱'}
                  </Badge>
                  <span className="text-[var(--text-muted)]">{indirect!.assessment}</span>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 磁力金牛 ROI 多口径 */}
          {adRoi && adRoi.spend > 0 && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4" /> 磁力金牛 ROI（多口径）
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <RoiCard label="当日总 ROI" value={adRoi.rois.totalRoi} note="总成交 / 花费" highlight />
                    <RoiCard label="直接 ROI" value={adRoi.rois.directRoi} note="直接成交 / 花费" />
                    <RoiCard label="净成交 ROI" value={adRoi.rois.netRoi} note="剔除1h内退款" />
                    <RoiCard label="7日累计 ROI" value={adRoi.rois.roi7d} note="需7日累计数据" />
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-lg bg-orbit-ink/40 px-3 py-2 text-xs">
                    <span className="text-[var(--text-muted)]">花费</span>
                    <span className="font-mono text-[var(--text-secondary)]">{fmt(adRoi.spend)}</span>
                    <ArrowRight className="h-3 w-3 text-[var(--text-primary)]" />
                    <span className="text-[var(--text-muted)]">总成交</span>
                    <span className="font-mono text-[var(--text-secondary)]">{fmt(adRoi.gmv.total)}</span>
                  </div>

                  {/* 双源对账 */}
                  {adRoi.comparison.merchantGmv > 0 && (
                    <div className="mt-3 rounded-lg border border-orbit-warning/25 bg-orbit-warning/5 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-status-warning">双源对比</span>
                        <span className="text-[var(--text-muted)]">金牛口径:</span>
                        <span className="font-mono text-[var(--text-secondary)]">{fmt(adRoi.comparison.adPlatformGmv)}</span>
                        <span className="text-[var(--text-muted)]">生意通口径:</span>
                        <span className="font-mono text-[var(--text-secondary)]">{fmt(adRoi.comparison.merchantGmv)}</span>
                        {adRoi.comparison.diffPct !== null && (
                          <Badge variant={Math.abs(adRoi.comparison.diffPct) > 20 ? 'warning' : 'neutral'}>
                            差异 {adRoi.comparison.diffPct > 0 ? '+' : ''}{adRoi.comparison.diffPct}%
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-status-warning/70">
                        {adRoi.comparison.warning}
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

function RoiCard({ label, value, note, highlight }: {
  label: string; value: number | null; note: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 ${
      highlight ? 'border-orbit-success/40 bg-orbit-success/5' : 'border-[var(--border)] bg-orbit-ink/40'
    }`}>
      <div className={`text-xs ${highlight ? 'text-status-ai' : 'text-[var(--text-muted)]'}`}>{label}</div>
      <div className={`mt-1.5 text-xl font-semibold ${
        value === null ? 'text-[var(--text-primary)]' : highlight ? 'text-status-ai' : 'text-[var(--text-primary)]'
      }`}>
        {value === null ? '—' : value.toFixed(2)}
      </div>
      <div className="mt-1 text-[10px] text-[var(--text-muted)]">{note}</div>
    </div>
  )
}
