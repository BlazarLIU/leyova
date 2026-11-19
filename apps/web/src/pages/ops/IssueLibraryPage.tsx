import { useCallback, useEffect, useState } from 'react'
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
  '售后问题': 'bg-orbit-info/15 text-orbit-info',
  '话术问题': 'bg-orbit-primary/15 text-orbit-primary',
}

const severityConfig = {
  high: { label: '严重', color: 'bg-red-500/15 text-red-400 border-red-500/20', icon: AlertTriangle },
  medium: { label: '中等', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', icon: Activity },
  low: { label: '轻微', color: 'bg-orbit-info/15 text-orbit-info border-orbit-info/20', icon: Activity },
}

const typeConfig = {
  anchor: { label: '主播', icon: Users, color: 'text-cyan-400' },
  channel: { label: '渠道', icon: Radio, color: 'text-orbit-primary' },
}

export function IssueLibraryPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory>('全部')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [issues, setIssues] = useState<IssueItem[]>([])
  const [autoTags, setAutoTags] = useState<AutoTag[]>([])
  const [converting, setConverting] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const reload = useCallback(() => {
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

  useEffect(() => { reload() }, [reload])

  // 「自动检测一键转问题」：把检测到的异常固化为可追踪的问题条目
  const convertTagToIssue = async (tag: AutoTag) => {
    setConverting(tag.id)
    try {
      const res = await api.post<{ id: number; occurrenceCount: number; merged: boolean }>('/api/ops/issue-library', {
        title: tag.title,
        category: '其他',
        solution: `针对「${tag.metric} ${tag.value}（阈值 ${tag.threshold}）」制定改进措施并跟进`,
        detailedSolution: `自动检测来源：${tag.type === 'anchor' ? '主播' : '渠道'}维度 · ${tag.targetName}\n指标：${tag.metric}\n实测：${tag.value}\n阈值：${tag.threshold}\n严重度：${tag.severity === 'high' ? '严重' : tag.severity === 'medium' ? '中等' : '轻微'}`,
      })
      setToast(res.merged
        ? `已合并到既有问题（累计 ${res.occurrenceCount} 次）`
        : '已转为问题条目，可指派改进任务')
      reload()
    } catch (e: any) {
      setToast(e?.message || '转换失败')
    } finally {
      setConverting(null)
      setTimeout(() => setToast(''), 3000)
    }
  }

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
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">问题库</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">常见问题应对与自动数据异常检测</p>
          </div>
        </div>
      </motion.div>

      {/* Search + Category filter */}
      <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.05 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="搜索问题标题或解决方案..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 pl-9 pr-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 transition-colors"
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
                  : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </motion.div>

      {/* 转换结果提示 */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
        >
          {toast}
        </motion.div>
      )}

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
                <h2 className="text-sm font-semibold text-[var(--text-secondary)]">自动检测数据异常</h2>
                <span className="text-[10px] text-[var(--text-muted)] bg-orbit-surface2 px-1.5 py-0.5 rounded-full border border-orbit-border">
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
                      <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">{tag.title}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">
                          {tag.metric}: <span className="text-[var(--text-secondary)] font-medium">{tag.value}</span>
                        </span>
                        <span className="text-[var(--text-primary)]">
                          阈值: {tag.threshold}
                        </span>
                      </div>
                      {tag.date && (
                        <p className="text-[10px] text-[var(--text-primary)] mt-2">
                          最近检测: {tag.date}
                        </p>
                      )}
                      <button
                        onClick={() => convertTagToIssue(tag)}
                        disabled={converting === tag.id}
                        className="mt-2.5 w-full px-2 py-1.5 rounded text-[11px] font-medium bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30 hover:bg-orbit-primary/25 disabled:opacity-50 transition-colors"
                      >
                        {converting === tag.id ? '转换中…' : '转为问题条目'}
                      </button>
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
                          <h3 className="text-sm font-semibold text-[var(--text-secondary)] leading-snug">{issue.title}</h3>
                        </div>
                        <div className="flex-shrink-0 text-[var(--text-muted)] mt-1">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Solution preview */}
                  <p className={cn(
                    'text-xs text-[var(--text-muted)] leading-relaxed',
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
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{issue.detailedSolution}</p>
                    </motion.div>
                  )}

                  {/* Footer stats */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-orbit-border">
                    <div className="flex items-center gap-1 text-[var(--text-muted)]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs">发生次数</span>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-secondary)]">{issue.occurrenceCount}</span>
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
          <HelpCircle className="w-12 h-12 text-[var(--text-primary)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm">未找到匹配的问题记录</p>
        </motion.div>
      )}
    </div>
  )
}