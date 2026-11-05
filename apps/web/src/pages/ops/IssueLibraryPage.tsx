import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { motion } from 'framer-motion'
import { Search, HelpCircle, AlertTriangle, ChevronDown, ChevronRight, ShoppingBag, Truck, RefreshCw, MessageCircle, Activity, Users, Radio } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { cn } from '@/utils/cn'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

type IssueCategory = '全部' | '商品问题' | '物流问题' | '售后问题' | '话术问题'

interface IssueItem {
  id: string
  title: string
  category: Exclude<IssueCategory, '全部'>
  solution: string
  occurrenceCount: number
  detailedSolution?: string
}

interface AutoTag {
  id: string
  type: 'anchor' | 'channel'
  title: string
  category: string
  severity: 'high' | 'medium' | 'low'
  targetName: string
  metric: string
  value: string
  threshold: string
  date: string | null
}

const categories: IssueCategory[] = ['全部', '商品问题', '物流问题', '售后问题', '话术问题']

// 默认空数据 - 从 API 获取后填充

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  '商品问题': ShoppingBag,
  '物流问题': Truck,
  '售后问题': RefreshCw,
  '话术问题': MessageCircle,
}

const categoryColors: Record<string, string> = {
  '商品问题': 'bg-rose-500/15 text-rose-400',
  '物流问题': 'bg-amber-500/15 text-amber-400',
  '售后问题': 'bg-blue-500/15 text-blue-400',
  '话术问题': 'bg-violet-500/15 text-violet-400',
}

const severityConfig = {
  high: { label: '严重', color: 'bg-red-500/15 text-red-400 border-red-500/20', icon: AlertTriangle },
  medium: { label: '中等', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', icon: Activity },
  low: { label: '轻微', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20', icon: Activity },
}

const typeConfig = {
  anchor: { label: '主播', icon: Users, color: 'text-cyan-400' },
  channel: { label: '渠道', icon: Radio, color: 'text-violet-400' },
}

export function IssueLibraryPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory>('全部')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [autoTags, setAutoTags] = useState<AutoTag[]>([])

  useEffect(() => {
    api.get<{ issues: IssueItem[]; autoTags: AutoTag[] }>('/api/ops/issue-library', {
      category: categoryFilter !== '全部' ? categoryFilter : undefined,
      search: search || undefined,
    }).then((res) => {
      setIssues(res.issues && res.issues.length > 0 ? res.issues : [])
      setAutoTags(res.autoTags ?? [])
    }).catch(() => {
      setIssues([])
    })
  }, [categoryFilter, search])

  const filtered = issues.filter((issue) => {
    const matchSearch = issue.title.toLowerCase().includes(search.toLowerCase()) || issue.solution.includes(search)
    const matchCategory = categoryFilter === '全部' || issue.category === categoryFilter
    return matchSearch && matchCategory
  })

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">问题库</h1>
            <p className="text-slate-500 text-sm mt-1">常见问题应对与自动数据异常检测</p>
          </div>
        </div>
      </motion.div>

      {/* Search + Category filter */}
      <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.05 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="搜索问题标题或解决方案..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                categoryFilter === cat
                  ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                  : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Auto-detected issue tags */}
      {autoTags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-slate-200">自动检测数据异常</h2>
                <span className="text-[10px] text-slate-500 bg-orbit-surface2 px-1.5 py-0.5 rounded-full border border-orbit-border">
                  {autoTags.length} 项
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {autoTags.map((tag, i) => {
                  const sev = severityConfig[tag.severity]
                  const typeInfo = typeConfig[tag.type]
                  const SevIcon = sev.icon
                  const TypeIcon = typeInfo.icon
                  return (
                    <motion.div
                      key={tag.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.03 }}
                      className={cn(
                        'rounded-lg border p-3.5',
                        sev.color,
                        'bg-orbit-surface2/30'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <TypeIcon className={cn('w-3.5 h-3.5', typeInfo.color)} />
                          <span className={cn('text-[10px] font-medium', typeInfo.color)}>{typeInfo.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <SevIcon className="w-3 h-3" />
                          <span className="text-[10px] font-medium">{sev.label}</span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-200 mb-2">{tag.title}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {tag.metric}: <span className="text-slate-300 font-medium">{tag.value}</span>
                        </span>
                        <span className="text-slate-600">
                          阈值: {tag.threshold}
                        </span>
                      </div>
                      {tag.date && (
                        <p className="text-[10px] text-slate-600 mt-2">
                          最近检测: {tag.date}
                        </p>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Issue cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((issue, i) => {
          const Icon = categoryIcons[issue.category]
          const isExpanded = expandedId === issue.id
          return (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.03 }}
            >
              <Card
                className={cn(
                  'hover:border-orbit-border2 transition-colors cursor-pointer h-full',
                  isExpanded && 'border-orbit-primary/30'
                )}
                onClick={() => toggleExpand(issue.id)}
              >
                <CardBody>
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-2.5">
                    <div className={cn('p-2 rounded-lg flex-shrink-0', categoryColors[issue.category])}>
                      {Icon && <Icon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-medium mb-1.5', categoryColors[issue.category])}>
                            {issue.category}
                          </span>
                          <h3 className="text-sm font-semibold text-slate-200 leading-snug">{issue.title}</h3>
                        </div>
                        <div className="flex-shrink-0 text-slate-500 mt-1">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Solution preview */}
                  <p className={cn(
                    'text-xs text-slate-400 leading-relaxed',
                    isExpanded ? '' : 'line-clamp-2'
                  )}>
                    {isExpanded && issue.detailedSolution ? issue.detailedSolution : issue.solution}
                  </p>

                  {/* Detailed solution when expanded */}
                  {isExpanded && issue.detailedSolution && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-3 p-3 rounded-lg bg-orbit-primary/5 border border-orbit-primary/10"
                    >
                      <p className="text-[11px] font-medium text-orbit-primary-light mb-1.5">详细应对步骤</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{issue.detailedSolution}</p>
                    </motion.div>
                  )}

                  {/* Footer stats */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-orbit-border">
                    <div className="flex items-center gap-1 text-slate-500">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs">发生次数</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-200">{issue.occurrenceCount}</span>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">未找到匹配的问题记录</p>
        </motion.div>
      )}
    </div>
  )
}