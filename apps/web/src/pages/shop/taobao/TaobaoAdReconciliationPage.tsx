import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Megaphone, AlertTriangle, TrendingUp, ArrowLeftRight } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface AdReconciliation {
  range: { from: string; to: string }
  adPlatform: { spend: number; gmv: number; roi: number }
  merchant: { gmv: number; roi: number }
  diffPct: number | null
  warning: string
  byTool: Array<{ tool: string; spend: number; adGmv: number; roi: number }>
}

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}

export function TaobaoAdReconciliationPage() {
  const { currentShop } = usePlatform()
  const [data, setData] = useState<AdReconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    if (!currentShop?.id) { setLoading(false); setData(null); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const d = await api.get<AdReconciliation>(`/taobao/shop/${currentShop.id}/ad-reconciliation`, {
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

  const hasData = !!data && (data.adPlatform.spend > 0 || data.merchant.gmv > 0)

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">万相台投放对账</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {currentShop ? currentShop.name : '未选择店铺'} · 广告后台 vs 经营后台口径对比
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

      {/* 关键提醒：两个后台天然不一致 */}
      <div className="flex items-start gap-2 rounded-lg border border-orbit-warning/30 bg-orbit-warning/10 p-3 text-xs text-status-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">为什么两个数不一样？</span>
          <p className="mt-1 text-status-warning/80">
            万相台（广告后台）按末次点击归因、不去重跨渠道曝光；生意参谋（经营后台）按实际支付归因、按访客去重。
            <strong className="text-status-warning">两者天然存在差异，这是行业常态，不应强行对齐。</strong>
            复盘时必须先声明用哪个后台的数。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--text-muted)]">加载中…</div>
      ) : !hasData ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-[var(--text-primary)]" />
            <p className="mt-3 text-sm text-[var(--text-muted)]">该店铺在选定周期内暂无投放或交易数据</p>
            <p className="mt-1 text-xs text-[var(--text-primary)]">需导入万相台报表（含花费/成交）与生意参谋交易数据</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* 双源对比 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4" /> 双源对比
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-[var(--border)] bg-orbit-ink/40 p-4">
                    <div className="text-xs text-[var(--text-muted)]">投放花费</div>
                    <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{fmt(data!.adPlatform.spend)}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">万相台后台</div>
                  </div>
                  <div className="rounded-lg border border-orbit-success/40 bg-orbit-success/5 p-4">
                    <div className="text-xs text-status-ai">万相台口径 GMV</div>
                    <div className="mt-1 text-xl font-semibold text-status-ai">{fmt(data!.adPlatform.gmv)}</div>
                    <div className="mt-1 text-[11px] text-status-ai/70">ROI {data!.adPlatform.roi}</div>
                  </div>
                  <div className="rounded-lg border border-orbit-success/40 bg-orbit-success/5 p-4">
                    <div className="text-xs text-status-success">生意参谋口径 GMV</div>
                    <div className="mt-1 text-xl font-semibold text-status-success">{fmt(data!.merchant.gmv)}</div>
                    <div className="mt-1 text-[11px] text-status-success/70">ROI {data!.merchant.roi}</div>
                  </div>
                </div>

                {data!.diffPct !== null && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-orbit-ink/40 px-3 py-2 text-xs">
                    <span className="text-[var(--text-muted)]">差异率：</span>
                    <span className={`font-mono font-medium ${
                      Math.abs(data!.diffPct) > 20 ? 'text-status-danger' : 'text-[var(--text-secondary)]'
                    }`}>
                      {data!.diffPct > 0 ? '+' : ''}{data!.diffPct}%
                    </span>
                    {Math.abs(data!.diffPct) > 20 && (
                      <Badge variant="warning">差异较大，建议核查归因设置</Badge>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* 按投放工具拆分 */}
          {data!.byTool.length > 0 && (
            <motion.div {...fadeIn}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> 按投放工具拆分
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                          <th className="py-2 pr-3">投放工具</th>
                          <th className="py-2 pr-3 text-right">花费</th>
                          <th className="py-2 pr-3 text-right">成交金额</th>
                          <th className="py-2 text-right">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.byTool.map((t) => (
                          <tr key={t.tool} className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                            <td className="py-2 pr-3 text-[var(--text-secondary)]">{t.tool}</td>
                            <td className="py-2 pr-3 text-right font-mono">{fmt(t.spend)}</td>
                            <td className="py-2 pr-3 text-right font-mono">{fmt(t.adGmv)}</td>
                            <td className="py-2 text-right font-mono text-status-ai">{t.roi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
