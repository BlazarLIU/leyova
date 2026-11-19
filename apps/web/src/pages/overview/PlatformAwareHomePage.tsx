import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  DollarSign, ShoppingCart, Users, ArrowRight, Sparkles,
  Store, FileText, Zap, Package, Megaphone, TrendingUp, AlertTriangle,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'
import { resolvePlatformMode, type PlatformMode } from '@/data/platform-navigation'
import { HomePage as DouyinHomePage } from './HomePage'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

interface PlatformStats {
  gmv: number
  payAmount: number
  orders: number
  buyers: number
  refundAmount: number
  refundRate: number
  avgOrderValue: number
  days: number
  shops: number
}

/**
 * 平台感知的首页
 *
 * 抖音 → 复用原有的直播电商首页（读 live_sessions 旧表）
 * 其他平台 → 显示该平台的通用经营概览 + 专属功能入口
 */
export function PlatformAwareHomePage() {
  const { currentPlatform } = usePlatform()

  const platformCode = currentPlatform?.platform_code
  const isDouyin = platformCode === 'douyin'

  // 抖音走原首页
  if (isDouyin) {
    return <DouyinHomePage />
  }

  // 其他平台走平台首页
  return <GenericPlatformHome />
}

function GenericPlatformHome() {
  const { currentPlatform, currentShop } = usePlatform()
  const navigate = useNavigate()
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const platformCode = currentPlatform?.platform_code || ''
  const platformName = currentPlatform?.platform_name || ''

  // 判断业态
  const cap = currentPlatform?.capabilities
  const mode: PlatformMode = resolvePlatformMode(cap, platformCode)

  const load = useCallback(async () => {
    if (!platformCode) { setLoading(false); return }
    setLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fd = new Date()
      fd.setDate(fd.getDate() - days + 1)
      const r = await api.get<{
        current: {
          gmv: number; payAmount: number; paidOrderCount: number; paidBuyerCount: number
          refundAmount: number; refundRate: number; avgOrderValue: number
        }
        range: { from: string; to: string }
      }>('/omnichannel/overview', {
        from: fd.toISOString().slice(0, 10),
        to,
        platform: platformCode,
        shopId: currentShop?.id,
      }).catch(() => null)

      if (r?.current) {
        setStats({
          gmv: r.current.gmv,
          payAmount: r.current.payAmount,
          orders: r.current.paidOrderCount,
          buyers: r.current.paidBuyerCount,
          refundAmount: r.current.refundAmount,
          refundRate: r.current.refundRate,
          avgOrderValue: r.current.avgOrderValue,
          days,
          shops: currentShop ? 1 : 0,
        })
      } else {
        setStats(null)
      }
    } finally {
      setLoading(false)
    }
  }, [platformCode, currentShop?.id, days])

  useEffect(() => { load() }, [load])

  // 各平台的专属快捷入口
  const quickEntries = buildQuickEntries(platformCode)

  const hasData = !!stats && stats.gmv > 0

  return (
    <div className="space-y-6">
      {/* 顶部标题 */}
      <motion.div {...fadeIn}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="display-eyebrow text-[var(--text-subtle)]">{platformCode || 'OVERVIEW'}</p>
            <h1 className="mt-1.5 text-[24px] font-extrabold tracking-[-0.035em] text-[var(--text-primary)]">
              {platformName || '经营总览'}
            </h1>
            <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
              {currentShop ? currentShop.name : '未选择店铺'}
              <span className="ml-2 text-[var(--text-subtle)]">· 近 {days} 天</span>
            </p>
          </div>
          <div className="flex items-center gap-0.5 rounded-[8px] border border-orbit-border bg-orbit-surface2 p-0.5">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded-[6px] px-3 py-1.5 text-[11.5px] font-semibold transition ${
                  days === d
                    ? 'bg-orbit-primary text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}>近 {d} 天</button>
            ))}
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="py-16 text-center text-[13px] text-[var(--text-muted)]">加载中…</div>
      ) : hasData ? (
        <>
          {/* 核心指标 */}
          <motion.div {...fadeIn} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={DollarSign} label="成交金额" value={fmtMoney(stats!.gmv)} unit="元" />
            <Stat icon={ShoppingCart} label="订单数" value={String(stats!.orders)} unit="单" />
            <Stat icon={Users} label="买家数" value={String(stats!.buyers)} unit="人" />
            <Stat icon={TrendingUp} label="客单价" value={fmtMoney(stats!.avgOrderValue)} unit="元" />
          </motion.div>

          {/* 退款提示 */}
          {stats!.refundRate > 0 && (
            <motion.div {...fadeIn}>
              <div className={`flex items-center gap-2 rounded-[8px] border p-3 text-[12px] ${
                stats!.refundRate > 10
                  ? 'border-orbit-danger/25 bg-orbit-danger/8 text-orbit-danger'
                  : 'border-orbit-border bg-orbit-surface2 text-[var(--text-muted)]'
              }`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>退款金额 {fmtMoney(stats!.refundAmount)} 元，退款率 {stats!.refundRate.toFixed(2)}%</span>
                {stats!.refundRate > 10 && <Badge variant="danger">偏高</Badge>}
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <motion.div {...fadeIn}>
          <Card><CardBody>
            <div className="py-12 text-center">
              <Store className="mx-auto h-9 w-9 text-[var(--text-subtle)]" />
              <p className="mt-3 text-[13px] font-medium text-[var(--text-secondary)]">该平台暂无经营数据</p>
              <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">请先通过「多平台接入」导入数据</p>
              <Button className="mt-4" onClick={() => navigate('/data/ingest')}>
                去导入数据 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardBody></Card>
        </motion.div>
      )}

      {/* 平台专属功能入口 */}
      <motion.div {...fadeIn}>
        <Card>
          <CardHeader title={`${platformName} 专属功能`} actions={<Zap className="h-4 w-4 text-orbit-primary" />} />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickEntries.map((e) => {
                const Icon = e.icon
                return (
                  <button
                    key={e.href + e.label}
                    onClick={() => navigate(e.href)}
                    className="group flex items-center gap-3 rounded-[8px] border border-orbit-border bg-orbit-surface p-4 text-left transition-colors hover:border-orbit-ink/30"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-orbit-stone text-orbit-ink transition-colors group-hover:bg-orbit-primary group-hover:text-white dark:bg-orbit-surface3 dark:text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">{e.label}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--text-subtle)]">{e.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* 业态提示 */}
      <motion.div {...fadeIn}>
        <div className="rounded-[8px] border-l-2 border-orbit-primary bg-orbit-surface2 px-3.5 py-3 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
          {mode === 'live' && '当前为直播电商业态：核心链路是「场次 → 流量 → 转化 → 复盘」。'}
          {mode === 'shelf' && '当前为货架电商业态：核心链路是「店铺成交 → 商品结构 → 流量渠道 → 投放 ROI」。'}
          {mode === 'content' && '当前为内容电商业态：核心链路是「笔记曝光 → 兴趣互动 → 搜索决策 → 站内外成交」。'}
        </div>
      </motion.div>
    </div>
  )
}

interface QuickEntry {
  label: string
  desc: string
  icon: any
  href: string
  color: string
  border: string
  textColor: string
}

function buildQuickEntries(platformCode: string): QuickEntry[] {
  const base: QuickEntry[] = []

  // 各平台专属
  if (platformCode === 'kuaishou') {
    base.push(
      { label: '公私域分析', desc: '关注页 vs 发现页成交', icon: Users, href: '/shop/kuaishou/traffic-split', color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', textColor: 'text-emerald-300' },
      { label: '间接成交', desc: '广告触达后的二次转化', icon: Megaphone, href: '/shop/kuaishou/indirect-gmv', color: 'from-orbit-primary/20 to-orbit-primary-dark/10', border: 'border-orbit-primary/30', textColor: 'text-orbit-primary' },
      { label: '粉丝团运营', desc: '入团率与亲密度', icon: Users, href: '/shop/kuaishou/fans-team', color: 'from-pink-500/20 to-pink-600/10', border: 'border-pink-500/30', textColor: 'text-pink-300' },
    )
  } else if (platformCode === 'pdd') {
    base.push(
      { label: '成团转化', desc: '支付→待成团→已成团', icon: Users, href: '/shop/pdd/group-funnel', color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', textColor: 'text-amber-300' },
      { label: '三口径对账', desc: '交易额/结算/净成交', icon: Package, href: '/shop/pdd/caliber-compare', color: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/30', textColor: 'text-cyan-300' },
    )
  } else if (platformCode === 'jd') {
    base.push(
      { label: '自营/POP 看板', desc: '两种模式分开核算', icon: Store, href: '/shop/jd/board', color: 'from-rose-500/20 to-rose-600/10', border: 'border-rose-500/30', textColor: 'text-rose-300' },
      { label: '履约时效', desc: '24h售后/48h发货', icon: AlertTriangle, href: '/shop/jd/fulfillment', color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', textColor: 'text-amber-300' },
    )
  } else if (platformCode === 'taobao' || platformCode === 'tmall') {
    base.push(
      { label: '淘系经营看板', desc: '父子订单与支付转化', icon: Store, href: '/shop/taobao/board', color: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/30', textColor: 'text-orange-300' },
      { label: '万相台对账', desc: '广告vs经营双源', icon: Megaphone, href: '/shop/taobao/ad-reconciliation', color: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/30', textColor: 'text-cyan-300' },
    )
  } else if (platformCode === 'xiaohongshu') {
    base.push(
      { label: '笔记经营', desc: '曝光阅读互动', icon: FileText, href: '/shop/xiaohongshu/notes', color: 'from-pink-500/20 to-pink-600/10', border: 'border-pink-500/30', textColor: 'text-pink-300' },
      { label: '种草转化', desc: '搜索与站内外成交', icon: TrendingUp, href: '/shop/xiaohongshu/conversion', color: 'from-rose-500/20 to-rose-600/10', border: 'border-rose-500/30', textColor: 'text-rose-300' },
    )
  }

  // 通用入口
  base.push(
    { label: '经营分析工作台', desc: 'AI 四阶分析', icon: Sparkles, href: '/ai/workbench', color: 'from-orbit-primary/20 to-orbit-primary-dark/10', border: 'border-orbit-primary/30', textColor: 'text-orbit-primary' },
    { label: '全渠道大盘', desc: '跨平台对比', icon: TrendingUp, href: '/omnichannel/dashboard', color: 'from-[var(--surface3)] to-[var(--surface2)]', border: 'border-orbit-border', textColor: 'text-[var(--text-secondary)]' },
  )

  return base.slice(0, 8)
}

function fmtMoney(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2) + ' 万'
  return n.toFixed(2)
}

function Stat({ icon: Icon, label, value, unit }: {
  icon: any; label: string; value: string; unit: string
}) {
  return (
    <div className="rounded-xl border border-orbit-border bg-orbit-surface p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5 text-orbit-primary" />{label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="metric-num text-[22px] leading-none text-[var(--text-primary)]">{value}</span>
        <span className="text-[10.5px] text-[var(--text-subtle)]">{unit}</span>
      </div>
    </div>
  )
}
