import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, MessageSquare, Clock, Eye, Edit, Play } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface ScriptTemplate {
  id: string
  category: 'opening' | 'intro' | 'promo' | 'closing'
  title: string
  scenario: string
  content: string
  usageCount: number
  lastUsed: string
}

const categoryOptions = [
  { value: 'all', label: '全部' },
  { value: 'opening', label: '开场' },
  { value: 'intro', label: '介绍' },
  { value: 'promo', label: '促销' },
  { value: 'closing', label: '结束' },
] as const

type CategoryValue = (typeof categoryOptions)[number]['value']

const categoryBadgeMap: Record<string, 'primary' | 'accent' | 'warning' | 'info'> = {
  opening: 'primary',
  intro: 'accent',
  promo: 'warning',
  closing: 'info',
}

const categoryLabelMap: Record<string, string> = {
  opening: '开场',
  intro: '介绍',
  promo: '促销',
  closing: '结束',
}

export function ScriptTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryValue>('all')
  const [templates, setTemplates] = useState<ScriptTemplate[]>([])
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ category: 'opening', title: '', scenario: '', content: '' })

  const loadTemplates = () => {
    const params: Record<string, string | number | undefined> = {}
    if (categoryFilter !== 'all') params.category = categoryFilter

    api.get<{ templates: any[] }>('/api/scripts/templates', params)
      .then((res) => {
        const list = res?.templates ?? []
        setTemplates(list.length > 0
          ? list.map((item: any) => ({
              id: String(item.id ?? ''),
              category: item.category as 'opening' | 'intro' | 'promo' | 'closing',
              title: item.title ?? '',
              scenario: item.scenario ?? '',
              content: item.content ?? '',
              usageCount: item.usageCount ?? item.usage_count ?? 0,
              lastUsed: item.lastUsed ?? item.last_used ?? '',
            }))
          : [])
      })
      .catch(() => { /* 保持默认数据 */ })
  }

  useEffect(() => { loadTemplates() }, [categoryFilter])

  const openCreateModal = () => {
    setForm({ category: 'opening', title: '', scenario: '', content: '' })
    setShowModal(true)
  }

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await api.post('/api/scripts/templates', {
        category: form.category,
        title: form.title.trim(),
        scenario: form.scenario.trim(),
        content: form.content.trim(),
      })
      setShowModal(false)
      loadTemplates()
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.title.includes(searchQuery) ||
      template.scenario.includes(searchQuery) ||
      template.content.slice(0, 50).includes(searchQuery)
    return matchesSearch
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">话术模板</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">直播话术模板管理</p>
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
            placeholder="搜索话术..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center gap-2">
          {categoryOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCategoryFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                categoryFilter === opt.value
                  ? 'bg-orbit-accent/15 text-orbit-accent-light border border-orbit-accent/30'
                  : 'text-[var(--text-muted)] bg-orbit-surface2 border border-orbit-border hover:text-[var(--text-primary)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <Button icon={<Plus className="w-4 h-4" />} size="sm" onClick={openCreateModal}>
            新建模板
          </Button>
        </div>
      </motion.div>

      {/* Template cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <MessageSquare className="w-12 h-12 text-[var(--text-primary)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)] text-sm">没有匹配的话术模板</p>
          </div>
        ) : (
          filteredTemplates.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 * i }}
            >
              <Card className="h-full hover:border-orbit-border2 transition-colors">
                <CardBody className="flex flex-col h-full">
                  {/* Category badge + title */}
                  <div className="mb-3">
                    <Badge variant={categoryBadgeMap[template.category]} className="mb-2">
                      {categoryLabelMap[template.category]}
                    </Badge>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{template.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{template.scenario}</p>
                  </div>

                  {/* Content preview */}
                  <div className="flex-1 mb-4">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-4">
                      {template.content.slice(0, 100)}...
                    </p>
                  </div>

                  {/* Usage info */}
                  <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-4">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>使用 {template.usageCount} 次</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{template.lastUsed}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-orbit-border">
                    <Button variant="outline" size="xs" className="flex-1" icon={<Edit className="w-3 h-3" />}>
                      编辑
                    </Button>
                    <Button variant="primary" size="xs" className="flex-1" icon={<Play className="w-3 h-3" />}>
                      使用
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-[var(--text-secondary)]">新建话术模板</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">分类</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30">
                  <option value="opening">开场</option>
                  <option value="intro">介绍</option>
                  <option value="promo">促销</option>
                  <option value="closing">结束</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">标题</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="输入话术标题" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">场景描述</label>
                <input value={form.scenario} onChange={e => setForm(p => ({ ...p, scenario: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="适用的直播场景" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">话术内容</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  className="w-full min-h-[120px] rounded-lg border border-orbit-border bg-orbit-surface2 px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30 resize-y" placeholder="输入话术内容..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
              <Button variant="primary" onClick={handleCreate} loading={saving}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}