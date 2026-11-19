import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RefreshCw, AlertTriangle, Package, TrendingUp, Video, MousePointerClick, Warehouse } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Candidate {
  productId: number
  spuCode: string
  skuCode: string
  productName: string
  category: string
  unitCost: number
  retailPrice: number
  margin: number
  totalScore: number
  factors: { gmvSales: number; inventory: number; shortVideo: number; clickConversion: number; marginProfit: number }
  suggestedRole: 'T' | 'B' | 'P'
  reasons: string[]
  metrics: {
    recentSoldCount: number
    recentPayment: number
    availableQty: number
    safetyStock: number
    shortVideoTraffic: number
    avgEntryClickRate: number
    historicalClickRate: number
  }
}

interface AssortmentResult {
  candidates: Candidate[]
  suggested: { traffic: Candidate[]; benefit: Candidate[]; profit: Candidate[] }
  meta: {
    days: number
    candidateCount: number
    dataSufficiency: { hasSales: boolean; hasInventory: boolean; hasShortVideo: boolean; hasClick: boolean }
  }
}

const fmtNum = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))
const fmtPct = (n: number | null | undefined) => (n == null ? '—' : `${(Number(n) * 100).toFixed(2)}%`)
const ROLE_LABEL: Record<string, string> = { T: '引流款', B: '福利款', P: '利润款' }
const ROLE_COLOR: Record<string, string> = {
  T: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  B: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  P: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
}

/**
 * 智能排品推荐（P3）
 *
 * 老大原话：「排品的逻辑是根据直播带货的 GMV销量、库存、短视频数据、点击转化等数据来」
 *
 * 本页基于真实业务数据计算排品建议：
 *   - GMV 销量   近 N 天历史成交（件数 / 金额）
 *   - 库存       可用库存 vs 安全库存（fail-closed：无档案不推荐）
 *   - 短视频     场次预热短视频的进房流量与进入点击率
 *   - 点击转化   历史曝光→点击率
 */
export function AssortmentRecommendPage() {
  const [result, setResult] = useState<AssortmentResult | null>(null)
  const [days, setDays] = useState(30)
  const [topN, setTopN] = useState(3)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await api.get<AssortmentResult>(`/assortment/recommend?days=${days}&topN=${topN}`)
      setResult(res)
    } catch (e: any) {
      setErr(e?.message || '加载排品推荐失败')
    } finally {
      setLoading(false)
    }
  }, [days, topN])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const suff = result?.meta.dataSufficiency

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <motion.div {...fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-orbit-primary" /> 智能排品推荐
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            基于直播带货 GMV 销量 · 库存 · 短视频引流 · 点击转化 的真实数据计算货盘结构建议
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-slate-300">
            <option value={7}>近 7 天</option>
            <option value={30}>近 30 天</option>
            <option value={60}>近 60 天</option>
            <option value={90}>近 90 天</option>
          </select>
          <select value={topN} onChange={(e) => setTopN(Number(e.target.value))}
            className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-slate-300">
            <option value={3}>每组 3 款</option>
            <option value={5}>每组 5 款</option>
          </select>
          <Button variant="secondary" onClick={load}><RefreshCw className="w-4 h-4" /> 刷新</Button>
        </div>
      </motion.div>

      {err && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {/* 数据充分性 */}
      <motion.div {...fadeIn} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Sufficiency icon={TrendingUp} label="GMV 销量" ok={!!suff?.hasSales} hint="历史成交数据" />
        <Sufficiency icon={Warehouse} label="库存" ok={!!suff?.hasInventory} hint="可用库存档案" />
        <Sufficiency icon={Video} label="短视频引流" ok={!!suff?.hasShortVideo} hint="预热短视频流量" />
        <Sufficiency icon={MousePointerClick} label="点击转化" ok={!!suff?.hasClick} hint="曝光→点击率" />
      </motion.div>

      {/* T/B/P 分组建议 */}
      <div className="grid gap-5 lg:grid-cols-3">
        <RoleGroup title="T · 引流款" desc="低价高点击，负责拉人进房" items={result?.suggested.traffic ?? []} />
        <RoleGroup title="B · 福利款" desc="性价比主打，承接转化" items={result?.suggested.benefit ?? []} />
        <RoleGroup title="P · 利润款" desc="高毛利，负责赚钱" items={result?.suggested.profit ?? []} />
      </div>

      {/* 全量候选明细 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader>
            <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <Package className="w-4 h-4" /> 全量候选打分（{result?.meta.candidateCount ?? 0} 个商品）
            </span>
            <Badge variant="neutral">按综合分排序</Badge>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
                  <tr className="text-slate-400">
                    <th className="text-left px-4 py-2">商品</th>
                    <th className="text-left px-3 py-2">角色</th>
                    <th className="text-right px-3 py-2">综合分</th>
                    <th className="text-right px-3 py-2">售价</th>
                    <th className="text-right px-3 py-2">近 {days} 天销量</th>
                    <th className="text-right px-3 py-2">成交额</th>
                    <th className="text-right px-3 py-2">可用库存</th>
                    <th className="text-right px-3 py-2">点击率</th>
                    <th className="text-right px-3 py-2">短视频引流</th>
                    <th className="text-right px-4 py-2">毛利率</th>
                  </tr>
                </thead>
                <tbody>
                  {(result?.candidates || []).map((c) => (
                    <tr key={c.productId} className="border-b border-orbit-border/40 hover:bg-white/5">
                      <td className="px-4 py-1.5 text-slate-200">{c.productName}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] border ${ROLE_COLOR[c.suggestedRole]}`}>
                          {c.suggestedRole} {ROLE_LABEL[c.suggestedRole]}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-orbit-primary font-medium">{c.totalScore}</td>
                      <td className="px-3 py-1.5 text-right text-slate-300">¥{fmtNum(c.retailPrice)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-300">{fmtNum(c.metrics.recentSoldCount)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{fmtNum(c.metrics.recentPayment)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={c.metrics.availableQty <= 0 ? 'text-rose-400' : 'text-slate-300'}>
                          {fmtNum(c.metrics.availableQty)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{fmtPct(c.metrics.historicalClickRate)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{fmtNum(c.metrics.shortVideoTraffic)}</td>
                      <td className="px-4 py-1.5 text-right text-slate-400">{(c.margin * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* 因子权重说明 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader><span className="text-sm font-semibold text-slate-200">打分口径</span></CardHeader>
          <CardBody className="text-xs text-slate-400 space-y-1.5">
            <p>综合分 = GMV销量 × 30% + 点击转化 × 25% + 库存健康 × 20% + 短视频引流 × 15% + 毛利 × 10%</p>
            <p>· <b className="text-slate-300">GMV 销量</b>：近 {days} 天该商品在历史场次排品中的销量与成交额（归一化）</p>
            <p>· <b className="text-slate-300">点击转化</b>：历史曝光→点击率，行业基准按 12% 记满分</p>
            <p>· <b className="text-slate-300">库存健康</b>：可用库存 /（安全库存 × 3）；<b className="text-rose-300">无库存档案记 0 分，不可排（防超卖）</b></p>
            <p>· <b className="text-slate-300">短视频引流</b>：同期预热短视频进房流量强度</p>
            <p>· <b className="text-slate-300">毛利</b>：（售价 − 成本）/ 售价，50% 记满分</p>
            <p className="text-slate-500">· 引流款限定售价 ≤ ¥129（低价是引流角色的定义）；任一口径缺数据时降级为 0 分并标注，不伪造。</p>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}

function Sufficiency({ icon: Icon, label, ok, hint }: { icon: any; label: string; ok: boolean; hint: string }) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${ok ? 'text-emerald-400' : 'text-amber-400'}`} />
        <span className="text-xs text-slate-200">{label}</span>
        <span className={`ml-auto text-[10px] ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>
          {ok ? '充足' : '不足'}
        </span>
      </div>
      <div className="text-[10px] text-slate-500 mt-1">{hint}</div>
    </div>
  )
}

function RoleGroup({ title, desc, items }: { title: string; desc: string; items: Candidate[] }) {
  return (
    <motion.div {...fadeIn}>
      <Card>
        <CardHeader>
          <span className="text-sm font-semibold text-slate-200">{title}</span>
          <Badge variant="neutral">{items.length} 款</Badge>
        </CardHeader>
        <CardBody className="space-y-2">
          <p className="text-[11px] text-slate-500">{desc}</p>
          {items.length === 0 && (
            <p className="text-xs text-slate-500 py-4 text-center">暂无符合条件的商品</p>
          )}
          {items.map((c) => (
            <div key={c.productId} className="rounded-lg border border-orbit-border/60 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-200 truncate">{c.productName}</span>
                <span className="text-xs text-orbit-primary font-semibold">{c.totalScore} 分</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-orbit-border/60 text-slate-300">
                  ¥{fmtNum(c.retailPrice)}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-orbit-border/60 text-slate-300">
                  售出 {fmtNum(c.metrics.recentSoldCount)}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-orbit-border/60 text-slate-300">
                  点击 {fmtPct(c.metrics.historicalClickRate)}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-orbit-border/60 text-slate-300">
                  库存 {fmtNum(c.metrics.availableQty)}
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries({
                  GMV: c.factors.gmvSales, 点击: c.factors.clickConversion,
                  库存: c.factors.inventory, 短视频: c.factors.shortVideo, 毛利: c.factors.marginProfit,
                }).map(([k, v]) => (
                  <span key={k} className="text-[10px] text-slate-500">
                    {k} <span className="text-slate-300">{(v * 100).toFixed(0)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </motion.div>
  )
}

export default AssortmentRecommendPage
