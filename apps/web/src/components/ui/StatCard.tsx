import { TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { CHART_SERIES } from '@/constants/chartPalette'
import type { StatCardData } from '@/types'

/**
 * 指标卡（品牌版）
 * 白底细边框 + 大字号数字 + 极简 sparkline，不使用彩色渐变块。
 */
const colorMap = {
  primary: { chart: CHART_SERIES[0], tint: 'text-orbit-primary' },
  accent:  { chart: CHART_SERIES[1], tint: 'text-orbit-accent-deep' },
  success: { chart: 'var(--color-orbit-success)', tint: 'text-orbit-success' },
  warning: { chart: 'var(--color-orbit-warning)', tint: 'text-orbit-warning' },
}

interface StatCardProps {
  data: StatCardData
  index?: number
}

export function StatCard({ data, index = 0 }: StatCardProps) {
  const colors = colorMap[data.color]
  const isPositive = data.change >= 0
  const isNegativeGood = data.id === 'churn'
  const changeIsGood = isNegativeGood ? !isPositive : isPositive
  const Icon = data.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-xl border border-orbit-border bg-orbit-surface transition-colors hover:border-orbit-border2"
    >
      <div className="p-4">
        <div className="mb-3.5 flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <Icon className={cn('h-3.5 w-3.5', colors.tint)} />
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {data.label}
            </p>
          </div>
          <div
            className={cn(
              'flex items-center gap-0.5 text-[10.5px] font-bold tabular-nums',
              changeIsGood ? 'text-orbit-success' : 'text-orbit-danger'
            )}
          >
            {changeIsGood ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(data.change)}%
          </div>
        </div>

        <p className="metric-num text-[26px] leading-none text-[var(--text-primary)]">{data.value}</p>
        <p className="mt-1.5 text-[11px] text-[var(--text-subtle)]">{data.changeLabel}</p>
      </div>

      <div className="h-11 opacity-80 transition-opacity group-hover:opacity-100">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`spark-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.chart} stopOpacity={0.22} />
                <stop offset="100%" stopColor={colors.chart} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.chart}
              strokeWidth={1.75}
              fill={`url(#spark-${data.id})`}
              dot={false}
              isAnimationActive={true}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
