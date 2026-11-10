import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Star, Truck, Headphones, Package, Wrench, AlertTriangle, Info } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface StoreRating {
  range: { from: string; to: string }
  dimensions: {
    customerService: { score: number | null; note: string }
    logistics: { score: number | null; note: string }
    productExperience: { score: number | null; note: string }
    afterSale: { score: number | null; note: string }
  }
  delayedShipments: { count: number; thresholdHours: number; note: string }
  codRatio: { ratio: number | null; note: string }
}

const DIMENSIONS = [
  { key: 'customerService' as const, label: '客服咨询', icon: Headphones },
  { key: 'logistics' as const, label: '物流履约', icon: Truck },
  { key: 'productExperience' as const, label: '商品体验', icon: Package },
  { key: 'afterSale' as const, label: '售后服务', icon: Wrench },
]

export function JdStoreRatingPage() {
  const [data, setData] = useState<StoreRating | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const d = await api.get<StoreRating>('/jd/store-rating', {
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

  const hasAnyScore = data
    ? DIMENSIONS.some((d) => data.dimensions[d.key].score !== null)
    : false

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">京东店铺星级</h1>
            <p className="mt-1 text-sm text-slate-400">
              四维考核：客服咨询 / 物流履约 / 商品体验 / 售后服务
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

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">京东考核的是「履约与服务时效」，不是「仅退款」</span>
          <p className="mt-1 text-amber-400/80">
            四维中「物流履约」含延迟发货单量减分项（超 48 小时），「客服咨询」考核咚咚无响应会话（9:00-23:00）；
            「售后服务」审核兜底已收紧至 24 小时。星级直接影响搜索排序与活动资格。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !data ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Star className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">暂无店铺星级数据</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {!hasAnyScore && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-700/60 bg-slate-800/30 p-3 text-xs text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                系统尚未接入四维评分数据源。需从京麦「店铺星级」页面导出后导入，
                或通过京东商智 API 同步。下方展示的是各维度的考核口径说明。
              </div>
            </div>
          )}

          {/* 四维评分 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DIMENSIONS.map((dim) => {
              const Icon = dim.icon
              const v = data!.dimensions[dim.key]
              return (
                <div key={dim.key} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Icon className="h-4 w-4" />{dim.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-100">
                    {v.score !== null ? v.score.toFixed(2) : '—'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {v.score === null ? '待接入' : '分'}
                  </div>
                  <p className="mt-2 border-t border-slate-700/50 pt-2 text-[11px] leading-relaxed text-slate-500">
                    {v.note}
                  </p>
                </div>
              )
            })}
          </motion.div>

          {/* 履约与 COD */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4" /> 履约与货到付款
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2">
                  <span className="text-xs text-slate-400">延迟发货单量</span>
                  <span className="font-mono text-sm text-slate-200">{data!.delayedShipments.count}</span>
                  <Badge variant="warning">超 {data!.delayedShipments.thresholdHours}h 计为延迟</Badge>
                  <span className="w-full text-[11px] text-slate-500">{data!.delayedShipments.note}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2">
                  <span className="text-xs text-slate-400">货到付款占比</span>
                  <span className="font-mono text-sm text-slate-200">
                    {data!.codRatio.ratio !== null ? `${data!.codRatio.ratio}%` : '—'}
                  </span>
                  <Badge variant={data!.codRatio.ratio !== null ? 'info' : 'neutral'}>
                    {data!.codRatio.ratio !== null ? '已计算' : '待接入'}
                  </Badge>
                  <span className="w-full text-[11px] leading-relaxed text-slate-500">{data!.codRatio.note}</span>
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 数据接入说明 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>数据接入说明</CardHeader>
              <CardBody className="space-y-2 text-xs text-slate-400">
                <div className="rounded-lg bg-slate-800/40 px-3 py-2">
                  <span className="text-slate-300">四维评分</span>
                  <span className="ml-2 text-slate-500">来源：京麦 → 店铺星级 → 导出报表（含客服/物流/商品/售后四项得分）</span>
                </div>
                <div className="rounded-lg bg-slate-800/40 px-3 py-2">
                  <span className="text-slate-300">延迟发货单量</span>
                  <span className="ml-2 text-slate-500">来源：京麦 → 订单管理 → 导出含「发货时间」的订单明细，系统按 48h 阈值自动统计</span>
                </div>
                <div className="rounded-lg bg-slate-800/40 px-3 py-2">
                  <span className="text-slate-300">货到付款占比</span>
                  <span className="ml-2 text-slate-500">来源：订单明细需包含「支付方式」字段（COD / 在线支付 / 公司转账）</span>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}
