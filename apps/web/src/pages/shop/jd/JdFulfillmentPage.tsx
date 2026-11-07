import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface Fulfillment {
  range: { from: string; to: string }
  slas: Array<{
    slaType: string
    slaName: string
    thresholdHours: number
    businessHoursOnly: boolean
    note: string
  }>
  orderStatusFlow: Array<{ status: string; name: string; count: number; countsAsGmv: boolean }>
}

function fmtHours(h: number): string {
  if (h === 0) return '—'
  if (h >= 24) {
    const d = h / 24
    return `${d % 1 === 0 ? d : d.toFixed(1)} 天`
  }
  return `${h} 小时`
}

export function JdFulfillmentPage() {
  const [data, setData] = useState<Fulfillment | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - 29)
      const d = await api.get<Fulfillment>('/jd/fulfillment', {
        from: fd.toISOString().slice(0, 10), to,
      })
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <h1 className="text-2xl font-semibold text-slate-100">履约时效监控</h1>
        <p className="mt-1 text-sm text-slate-400">
          京东是全平台履约考核最严的：24h 售后兜底 + 48h 延迟发货 + 9-23 点客服响应
        </p>
      </motion.div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <span className="font-medium">京东的压力点不是「仅退款」，而是「履约与售后时效」</span>
          <p className="mt-1 text-amber-400/80">
            延迟发货超 48 小时的订单量直接计入店铺星级减分；售后审核与收货兜底均已收紧至 24 小时；
            咚咚无响应会话纳入平均响应时长，考核时段 9:00-23:00。这些时效影响搜索排序与活动资格。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500">加载中…</div>
      ) : !data ? (
        <Card><CardBody>
          <div className="py-14 text-center">
            <Clock className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">暂无履约数据</p>
          </div>
        </CardBody></Card>
      ) : (
        <>
          {/* SLA 列表 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> 时效考核标准
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {data.slas.map((s) => (
                    <div
                      key={s.slaType}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2"
                    >
                      <span className="text-sm text-slate-200">{s.slaName}</span>
                      {s.thresholdHours > 0 && (
                        <Badge variant={s.thresholdHours <= 24 ? 'danger' : 'warning'}>
                          {fmtHours(s.thresholdHours)}
                        </Badge>
                      )}
                      {s.businessHoursOnly && (
                        <Badge variant="info">仅营业时段</Badge>
                      )}
                      <span className="ml-auto max-w-[50%] text-right text-[11px] text-slate-500">
                        {s.note}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </motion.div>

          {/* 订单状态流转 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" /> 订单状态分布
                  <span className="text-xs font-normal text-slate-500">（京东特有的「货到付款待收」状态）</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {data.orderStatusFlow.map((s, idx) => (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className="w-5 text-xs text-slate-600">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="flex items-center gap-2 text-sm text-slate-200">
                            {s.name}
                            <span className="font-mono text-[10px] text-slate-600">{s.status}</span>
                            {s.countsAsGmv ? (
                              <Badge variant="success">计入 GMV</Badge>
                            ) : (
                              <Badge variant="neutral">不计入</Badge>
                            )}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-slate-400">{s.count} 单</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {data.orderStatusFlow.every((s) => s.count === 0) && (
                  <p className="mt-3 text-center text-xs text-slate-500">
                    暂无订单明细数据。京东的「货到付款待收」状态需从订单明细导入后才能统计。
                  </p>
                )}
              </CardBody>
            </Card>
          </motion.div>

          {/* 待完善提示 */}
          <motion.div {...fadeIn}>
            <Card>
              <CardHeader>数据完善度</CardHeader>
              <CardBody className="space-y-2">
                <GapRow
                  label="店铺星级四维评分"
                  done={false}
                  note="需从京麦「店铺星级」页面导出：客服咨询、物流履约、商品体验、售后服务"
                />
                <GapRow
                  label="延迟发货单量"
                  done={false}
                  note="需从订单详情导出含发货时间的明细，系统可自动计算超 48h 的订单数"
                />
                <GapRow
                  label="咚咚客服响应时长"
                  done={false}
                  note="需从京麦客服工作台导出，考核时段 9:00-23:00"
                />
                <GapRow
                  label="货到付款占比"
                  done={false}
                  note="需在订单明细中标记支付方式（COD / 在线支付）"
                />
              </CardBody>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  )
}

function GapRow({ label, done, note }: { label: string; done: boolean; note: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-800/40 px-3 py-2">
      {done ? (
        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-300">{label}</span>
          <Badge variant={done ? 'success' : 'neutral'}>{done ? '已接入' : '待接入'}</Badge>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>
      </div>
    </div>
  )
}
