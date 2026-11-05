import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Plus, Users, DollarSign, Eye, ExternalLink, Edit, Target, TrendingUp, Star } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface AnchorItem {
  id: string
  name: string
  initials: string
  level: string
  tags: string[]
  status: 'live' | 'offline' | 'resting'
  followers: number
  avgGMV: number
  avgViews: number
  avgUvValue: number
  avgInteractionRate: number
  avgRetentionRate: number
  avgGpm: number
  avgNewFans: number
  overallScore: number | null
  weakness: string
}

const statusFilters = [
  { value: 'all', label: '全部' },
  { value: 'live', label: '直播中' },
  { value: 'offline', label: '离线' },
  { value: 'resting', label: '休息' },
] as const

type StatusFilterValue = (typeof statusFilters)[number]['value']

const statusLabelMap: Record<string, string> = {
  live: '直播中',
  offline: '离线',
  resting: '休息',
}

const statusBadgeVariantMap: Record<string, 'success' | 'neutral' | 'warning'> = {
  live: 'success',
  offline: 'neutral',
  resting: 'warning',
}



function getScoreColor(score: number | null): string {
  if (score == null) return 'text-slate-500'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-400'
  return 'text-red-400'
}

function getWeaknessColor(weakness: string): string {
  if (!weakness) return 'bg-slate-500/15 text-slate-400'
  if (weakness === '引流') return 'bg-violet-500/15 text-violet-300'
  if (weakness === '互动') return 'bg-cyan-500/15 text-cyan-300'
  if (weakness === '转化') return 'bg-emerald-500/15 text-emerald-300'
  return 'bg-amber-500/15 text-amber-300'
}

export function AnchorListPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all')
  const [anchors, setAnchors] = useState<AnchorItem[]>([])

  // 状态筛选变化时重新请求
  useEffect(() => {
    const params: Record<string, string | number | undefined> = {}
    if (statusFilter !== 'all') params.status = statusFilter

    api.get<any>('/api/anchors', params)
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.anchors ?? res?.data ?? [])
        if (list.length > 0) {
          setAnchors(list.map((item: any) => ({
            id: String(item.id ?? item.anchor_id),
            name: item.name,
            initials: item.name?.slice(0, 2) ?? '',
            level: item.level ?? '',
            tags: item.tags ?? [],
            status: item.status as 'live' | 'offline' | 'resting',
            followers: item.followers ?? 0,
            avgGMV: item.avgGMV ?? 0,
            avgViews: item.avgViews ?? 0,
            avgUvValue: item.avgUvValue ?? 0,
            avgInteractionRate: item.avgInteractionRate ?? 0,
            avgRetentionRate: item.avgRetentionRate ?? 0,
            avgGpm: item.avgGpm ?? 0,
            avgNewFans: item.avgNewFans ?? 0,
            overallScore: item.overallScore ?? null,
            weakness: item.weakness ?? '',
          })))
        }
      })
      .catch(() => {
        /* 保持默认数据 */
      })
  }, [statusFilter])

  const filteredAnchors = anchors.filter((anchor) => {
    const matchesSearch = anchor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      anchor.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">主播列表</h1>
            <p className="text-slate-500 text-sm mt-1">主播信息管理与KPI监控</p>
          </div>
        </div>
      </motion.div>

      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <div className="w-full sm:w-64">
          <Input
            placeholder="搜索主播..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                statusFilter === f.value
                  ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                  : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <Button icon={<Plus className="w-4 h-4" />} size="sm">
            添加主播
          </Button>
        </div>
      </motion.div>

      {/* Anchor cards grid */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {filteredAnchors.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 text-sm">没有匹配的主播</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAnchors.map((anchor, i) => (
              <motion.div
                key={anchor.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
              >
                <Card className="h-full hover:border-orbit-border2 transition-colors">
                  <CardBody className="flex flex-col h-full">
                    {/* Avatar + Name + Level + Weakness */}
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar initials={anchor.initials} size="xl" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-slate-100 truncate">
                          {anchor.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-orbit-primary-light font-medium bg-orbit-primary/10 px-1.5 py-0.5 rounded">
                            {anchor.level}
                          </span>
                          {anchor.tags.map((tag) => (
                            <span key={tag} className="text-xs text-slate-500">
                              {tag}
                            </span>
                          ))}
                          {anchor.weakness && (
                            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', getWeaknessColor(anchor.weakness))}>
                              短板:{anchor.weakness}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* KPI Grid: 2 cols x 4 rows */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          粉丝
                        </span>
                        <span className="text-slate-200 font-medium tabular-nums text-xs">
                          {(anchor.followers / 10000).toFixed(0)}万
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          场均GMV
                        </span>
                        <span className="text-emerald-400 font-medium tabular-nums text-xs">
                          ¥{(anchor.avgGMV / 10000).toFixed(1)}万
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          场均观看
                        </span>
                        <span className="text-slate-200 font-medium tabular-nums text-xs">
                          {anchor.avgViews.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5" />
                          UV价值
                        </span>
                        <span className="text-cyan-400 font-medium tabular-nums text-xs">
                          {anchor.avgUvValue.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          互动率
                        </span>
                        <span className="text-slate-200 font-medium tabular-nums text-xs">
                          {anchor.avgInteractionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          留存率
                        </span>
                        <span className="text-slate-200 font-medium tabular-nums text-xs">
                          {anchor.avgRetentionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          GPM
                        </span>
                        <span className="text-amber-400 font-medium tabular-nums text-xs">
                          {anchor.avgGpm > 0 ? `¥${anchor.avgGpm.toFixed(0)}` : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5" />
                          综合分
                        </span>
                        <span className={cn('font-medium tabular-nums text-xs', getScoreColor(anchor.overallScore))}>
                          {anchor.overallScore ?? '-'}
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="mb-3">
                      <Badge variant={statusBadgeVariantMap[anchor.status]} dot>
                        {statusLabelMap[anchor.status]}
                      </Badge>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-orbit-border">
                      <Button variant="outline" size="sm" className="flex-1" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={() => navigate('/anchors/profile?id=' + anchor.id)}>
                        查看档案
                      </Button>
                      <Button variant="ghost" size="sm" icon={<Edit className="w-3.5 h-3.5" />}>
                        编辑
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}