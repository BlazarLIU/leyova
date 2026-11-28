import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'
import { AlertCircle, MessageSquare, Users, ShoppingCart, Award, Star, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils/cn'
import { getDefaultRouteForPlatform } from '@/utils/platformRoute'

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

const DIMENSION_CONFIG: Record<string, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: 'primary' | 'accent' | 'success' | 'warning'
}> = {
  expression: { label: '表达能力', icon: MessageSquare, color: 'primary' },
  interaction: { label: '互动能力', icon: Users, color: 'accent' },
  conversion: { label: '转化能力', icon: ShoppingCart, color: 'success' },
  professionalism: { label: '专业度', icon: Award, color: 'warning' },
}

const getScoreRating = (score: number): { label: string; variant: 'success' | 'primary' | 'warning' | 'danger' } => {
  if (score >= 85) return { label: '优秀', variant: 'success' }
  if (score >= 75) return { label: '良好', variant: 'primary' }
  if (score >= 60) return { label: '一般', variant: 'warning' }
  return { label: '待提升', variant: 'danger' }
}

const colorConfig: Record<string, { bar: string; glow: string; text: string }> = {
  primary: { bar: 'bg-orbit-primary', glow: 'shadow-orbit-primary/20', text: 'text-orbit-primary' },
  accent: { bar: 'bg-orbit-accent', glow: 'shadow-orbit-accent/20', text: 'text-status-ai' },
  success: { bar: 'bg-orbit-success', glow: 'shadow-orbit-success/20', text: 'text-status-success' },
  warning: { bar: 'bg-orbit-warning', glow: 'shadow-orbit-warning/20', text: 'text-status-warning' },
}

export function CapabilitiesPage() {
  const { currentPlatform, setPlatformCode } = usePlatform()
  const navigate = useNavigate()
  const [dimensions, setDimensions] = useState<DimensionData[]>([])
  const [anchorRankings, setAnchorRankings] = useState<AnchorRanking[]>([])

  const isLiveSupported = currentPlatform ? currentPlatform.capabilities?.supportsLive !== false : true

  useEffect(() => {
    if (!isLiveSupported) {
      setDimensions([])
      setAnchorRankings([])
      return
    }

    api.get<any>('/api/v1/ops/capabilities', { platform: currentPlatform?.platform_code })
      .then((data) => {
        if (!data) return

        // 1. 解析排行榜数据
        const rawRankings = Array.isArray(data.anchorRankings)
          ? data.anchorRankings
          : Array.isArray(data.rankings)
          ? data.rankings
          : Array.isArray(data.capabilities)
          ? data.capabilities
          : []

        const parsedRankings: AnchorRanking[] = rawRankings.map((r: any, i: number) => ({
          rank: Number(r.rank) || i + 1,
          name: String(r.name || r.anchor_name || `主播 ${i + 1}`),
          overall: Number(r.overall) || 0,
          expression: Number(r.expression) || 0,
          interaction: Number(r.interaction) || 0,
          conversion: Number(r.conversion) || 0,
          professionalism: Number(r.professionalism) || 0,
        }))
        setAnchorRankings(parsedRankings)

        // 2. 解析能力维度卡片数据
        let parsedDimensions: DimensionData[] = []
        if (Array.isArray(data.dimensions) && data.dimensions.length > 0 && data.dimensions[0]?.score !== undefined) {
          parsedDimensions = data.dimensions.map((dim: any) => {
            const conf = DIMENSION_CONFIG[dim.id]
            const color = (dim.color && colorConfig[dim.color] ? dim.color : conf?.color || 'primary') as DimensionData['color']
            return {
              id: String(dim.id || ''),
              label: String(dim.label || conf?.label || dim.id),
              score: Math.max(0, Math.min(100, Math.round(Number(dim.score) || 0))),
              icon: dim.icon || conf?.icon || Star,
              color,
            }
          })
        } else {
          // 兼容后端返回原始主播列表的情况，按维度计算团队平均分
          const sourceList = Array.isArray(data.dimensions) && data.dimensions.length > 0
            ? data.dimensions
            : Array.isArray(data.capabilities) && data.capabilities.length > 0
            ? data.capabilities
            : parsedRankings

          if (sourceList.length > 0) {
            const avg = (key: 'expression' | 'interaction' | 'conversion' | 'professionalism') =>
              Math.round(sourceList.reduce((sum: number, c: any) => sum + (Number(c[key]) || 0), 0) / sourceList.length)

            parsedDimensions = [
              { id: 'expression', label: '表达能力', score: avg('expression'), icon: MessageSquare, color: 'primary' },
              { id: 'interaction', label: '互动能力', score: avg('interaction'), icon: Users, color: 'accent' },
              { id: 'conversion', label: '转化能力', score: avg('conversion'), icon: ShoppingCart, color: 'success' },
              { id: 'professionalism', label: '专业度', score: avg('professionalism'), icon: Award, color: 'warning' },
            ]
          }
        }

        setDimensions(parsedDimensions)
      })
      .catch(() => {})
  }, [currentPlatform?.platform_code, isLiveSupported])

  const hasData = dimensions.length > 0 || anchorRankings.length > 0

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">能力看板</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">主播能力评估</p>
          </div>
        </div>
      </motion.div>

      {!isLiveSupported ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="border-orbit-warning/20 bg-orbit-surface/80">
            <CardBody>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-orbit-warning/10 text-status-warning flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-secondary)]">
                  当前平台（{currentPlatform?.platform_name || '当前渠道'}）不支持主播能力评估
                </h3>
                <p className="text-[var(--text-muted)] text-sm mt-1 max-w-md">
                  当前平台为货架电商业态，不涉及直播间与主播业务。主播能力评估仅适用于直播电商平台（如抖音、快手）。
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => navigate(getDefaultRouteForPlatform(currentPlatform?.platform_code))}
                    className="px-4 py-2 rounded-lg bg-orbit-primary text-white text-xs font-medium hover:bg-orbit-primary/90 transition shadow-sm flex items-center gap-1.5"
                  >
                    前往{currentPlatform?.platform_name || '平台'}经营看板
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPlatformCode('douyin')}
                    className="px-4 py-2 rounded-lg bg-[var(--hover-bg3)] border border-orbit-border text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--hover-bg)] transition"
                  >
                    切换至抖音电商
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ) : !hasData ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card>
            <CardBody>
              <div className="flex flex-col items-center justify-center py-16">
                <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                <p className="text-[var(--text-muted)] text-sm">暂无能力评估数据</p>
                <p className="text-[var(--text-muted)] text-xs mt-2">请上传主播分析数据后查看</p>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ) : (
        <>
      {/* Dimension cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {dimensions.map((dim, i) => {
          const Icon = dim.icon || Star
          const rating = getScoreRating(dim.score)
          const colors = colorConfig[dim.color] || colorConfig.primary
          return (
            <motion.div
              key={dim.id || i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
            >
              <Card className="hover:border-orbit-border2 transition-colors">
                <CardBody>
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn('p-2 rounded-lg bg-[var(--hover-bg3)]', colors.text)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <Badge variant={rating.variant}>{rating.label}</Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-1">{dim.label}</p>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-bold text-[var(--text-primary)]">{dim.score}</span>
                    <span className="text-xs text-[var(--text-muted)]">/ 100</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-orbit-surface2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, dim.score))}%` }}
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
                  <tr className="border-b border-orbit-border text-[var(--text-muted)] text-xs">
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
                      key={anchor.rank ?? i}
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
                            : 'bg-orbit-surface2 text-[var(--text-muted)]'
                        )}>
                          {anchor.rank}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orbit-primary to-orbit-success flex items-center justify-center text-white text-[10px] font-bold">
                            {(anchor.name || '主').slice(0, 1)}
                          </div>
                          <span className="text-sm font-medium text-[var(--text-secondary)]">{anchor.name || '未知主播'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-sm font-bold text-[var(--text-primary)]">{anchor.overall}</span>
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
  const score = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-16 h-1.5 bg-orbit-surface2 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            score >= 85 ? 'bg-orbit-success' : score >= 75 ? 'bg-orbit-primary' : score >= 60 ? 'bg-orbit-warning' : 'bg-orbit-danger'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn(
        'text-xs font-medium',
        score >= 85 ? 'text-status-success' : score >= 75 ? 'text-orbit-primary' : score >= 60 ? 'text-status-warning' : 'text-status-danger'
      )}>
        {score}
      </span>
    </div>
  )
}
