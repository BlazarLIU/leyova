import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface DimensionData {
  id: string
  label: string
  score: number
  icon: React.ComponentType<{ className?: string }>
  color: 'primary' | 'accent' | 'success' | 'warning'
}

interface AnchorRanking {
  rank: number
  name: string
  overall: number
  expression: number
  interaction: number
  conversion: number
  professionalism: number
}

const getScoreRating = (score: number): { label: string; variant: 'success' | 'primary' | 'warning' | 'danger' } => {
  if (score >= 85) return { label: '优秀', variant: 'success' }
  if (score >= 75) return { label: '良好', variant: 'primary' }
  if (score >= 60) return { label: '一般', variant: 'warning' }
  return { label: '待提升', variant: 'danger' }
}

const colorConfig: Record<string, { bar: string; glow: string }> = {
  primary: { bar: 'bg-orbit-primary', glow: 'shadow-orbit-primary/20' },
  accent: { bar: 'bg-orbit-accent', glow: 'shadow-orbit-accent/20' },
  success: { bar: 'bg-orbit-success', glow: 'shadow-orbit-success/20' },
  warning: { bar: 'bg-orbit-warning', glow: 'shadow-orbit-warning/20' },
}

export function CapabilitiesPage() {
  const [dimensions, setDimensions] = useState<DimensionData[]>([])
  const [anchorRankings, setAnchorRankings] = useState<AnchorRanking[]>([])

  useEffect(() => {
    api.get<any>('/api/v1/ops/capabilities')
      .then((data) => {
        if (data.dimensions) setDimensions(data.dimensions)
        if (data.anchorRankings) setAnchorRankings(data.anchorRankings)
      })
      .catch(() => {})
  }, [])

  const hasData = dimensions.length > 0 || anchorRankings.length > 0

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">能力看板</h1>
            <p className="text-slate-500 text-sm mt-1">主播能力评估</p>
          </div>
        </div>
      </motion.div>

      {!hasData ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center py-16">
                <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
                <p className="text-slate-400 text-sm">暂无能力评估数据</p>
                <p className="text-slate-500 text-xs mt-2">请上传主播分析数据后查看</p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ) : (
        <>
      {/* Dimension cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {dimensions.map((dim, i) => {
          const Icon = dim.icon
          const rating = getScoreRating(dim.score)
          const colors = colorConfig[dim.color]
          return (
            <motion.div
              key={dim.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
            >
              <Card className="hover:border-orbit-border2 transition-colors">
                <CardBody>
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn('p-2 rounded-lg bg-white/5', `text-${dim.color === 'primary' ? 'violet' : dim.color === 'accent' ? 'cyan' : dim.color === 'success' ? 'emerald' : 'amber'}-400`)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <Badge variant={rating.variant}>{rating.label}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mb-1">{dim.label}</p>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-bold text-slate-100">{dim.score}</span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-orbit-surface2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dim.score}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', colors.bar)}
                    />
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Anchor ranking table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader
            title="主播能力排名"
            subtitle="综合各项维度评分排序"
            actions={
              <Badge variant="info" dot>实时更新</Badge>
            }
          />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border text-slate-500 text-xs">
                    <th className="text-center px-5 py-3 font-medium w-12">排名</th>
                    <th className="text-left px-5 py-3 font-medium">主播名</th>
                    <th className="text-center px-5 py-3 font-medium">综合分</th>
                    <th className="text-center px-5 py-3 font-medium">表达能力</th>
                    <th className="text-center px-5 py-3 font-medium">互动能力</th>
                    <th className="text-center px-5 py-3 font-medium">转化能力</th>
                    <th className="text-center px-5 py-3 font-medium">专业度</th>
                  </tr>
                </thead>
                <tbody>
                  {anchorRankings.map((anchor, i) => (
                    <tr
                      key={anchor.rank}
                      className={cn(
                        'border-b border-orbit-border transition-colors hover:bg-white/[0.02]',
                        i === anchorRankings.length - 1 && 'border-b-0'
                      )}
                    >
                      <td className="px-5 py-3.5 text-center">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mx-auto',
                          anchor.rank <= 3
                            ? 'bg-orbit-primary/15 text-orbit-primary-light'
                            : 'bg-orbit-surface2 text-slate-500'
                        )}>
                          {anchor.rank}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-600 flex items-center justify-center text-white text-[10px] font-bold">
                            {anchor.name.slice(0, 1)}
                          </div>
                          <span className="text-sm font-medium text-slate-200">{anchor.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-sm font-bold text-slate-100">{anchor.overall}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <ScoreBar value={anchor.expression} />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <ScoreBar value={anchor.interaction} />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <ScoreBar value={anchor.conversion} />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <ScoreBar value={anchor.professionalism} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>
        </>
      )}
    </div>
  )
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-16 h-1.5 bg-orbit-surface2 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            value >= 85 ? 'bg-orbit-success' : value >= 75 ? 'bg-orbit-primary' : value >= 60 ? 'bg-orbit-warning' : 'bg-orbit-danger'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={cn(
        'text-xs font-medium',
        value >= 85 ? 'text-emerald-400' : value >= 75 ? 'text-violet-400' : value >= 60 ? 'text-amber-400' : 'text-red-400'
      )}>
        {value}
      </span>
    </div>
  )
}