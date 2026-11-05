import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, TrendingUp, TrendingDown, Minus, BarChart3, ShoppingCart, ExternalLink, X } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface Competitor {
  id: string
  brand: string
  industry: string
  monitoredProducts: number
  avgPrice: string
  estimatedSales: string
  trend: 'up' | 'down' | 'stable'
}

const trendConfig: Record<string, { label: string; variant: 'success' | 'danger' | 'neutral'; icon: React.ComponentType<{ className?: string }> }> = {
  up: { label: '上升', variant: 'danger', icon: TrendingUp },
  down: { label: '下降', variant: 'success', icon: TrendingDown },
  stable: { label: '稳定', variant: 'neutral', icon: Minus },
}

interface ComparisonDetail {
  brand: string
  priceData: { label: string; ours: number; theirs: number }[]
  salesData: { label: string; ours: number; theirs: number }[]
}

const maxPriceValue = 400
const maxSalesValue = 30000

export function CompetitorWatchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [comparisonData, setComparisonData] = useState<Record<string, ComparisonDetail>>({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newCompetitor, setNewCompetitor] = useState({ brand: '', industry: '' })

  useEffect(() => {
    api.get<any>('/api/system/competitors', {
      search: searchQuery || undefined,
    })
      .then((res) => {
        if (res.competitors) setCompetitors(res.competitors)
        if (res.comparisonData) setComparisonData(res.comparisonData)
      })
      .catch(() => {})
  }, [searchQuery])

  const filteredCompetitors = competitors.filter((c) =>
    c.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industry.includes(searchQuery)
  )

  const comparisonDetail = selectedBrand ? comparisonData[selectedBrand] : null

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">竞品观察</h1>
            <p className="text-slate-500 text-sm mt-1">竞品动态监测</p>
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
        {/* Search */}
        <div className="flex items-center gap-2 h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm focus-within:border-orbit-primary focus-within:ring-1 focus-within:ring-orbit-primary/30 w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索品牌或行业..."
            className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 outline-none min-w-0"
          />
        </div>

        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          添加竞品
        </Button>
      </motion.div>

      {/* Competitor table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader
            title="竞品品牌列表"
            subtitle="监测中的品牌动态数据"
            actions={
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-orbit-surface2 px-2 py-1 rounded-md border border-orbit-border">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>共 {filteredCompetitors.length} 个品牌</span>
              </div>
            }
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">品牌名称</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">行业</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">监测商品数</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">均价</th>
                    <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">预估销量</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">趋势</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompetitors.map((competitor) => {
                    const trend = trendConfig[competitor.trend]
                    const TrendIcon = trend.icon
                    return (
                      <tr
                        key={competitor.id}
                        className={`border-b border-orbit-border transition-colors cursor-pointer ${
                          selectedBrand === competitor.brand
                            ? 'bg-orbit-primary/5'
                            : 'hover:bg-white/5'
                        }`}
                        onClick={() => setSelectedBrand(selectedBrand === competitor.brand ? null : competitor.brand)}
                      >
                        <td className="px-5 py-3.5">
                          <span className="text-slate-200 font-medium">{competitor.brand}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">{competitor.industry}</td>
                        <td className="px-5 py-3.5 text-right text-slate-300 tabular-nums">{competitor.monitoredProducts}</td>
                        <td className="px-5 py-3.5 text-right text-slate-300">{competitor.avgPrice}</td>
                        <td className="px-5 py-3.5 text-right text-emerald-400 font-medium">{competitor.estimatedSales}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={trend.variant}>
                            <TrendIcon className="w-3 h-3" />
                            {trend.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedBrand(selectedBrand === competitor.brand ? null : competitor.brand) }}
                            className="flex items-center gap-1 text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            详情
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Comparison detail section */}
      {comparisonDetail && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card gradient>
            <CardHeader
              title={`${comparisonDetail.brand} 详细对比`}
              subtitle="价格与销量对比分析"
              actions={
                <button
                  onClick={() => setSelectedBrand(null)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-white/5"
                >
                  关闭
                </button>
              }
            />
            <CardBody>
              {/* Price comparison bar chart */}
              <div className="mb-6">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  价格对比 (元)
                </h4>
                <div className="space-y-4">
                  {comparisonDetail.priceData.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">{item.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-orbit-primary-light font-medium">我方: ¥{item.ours}</span>
                          <span className="text-orbit-accent-light font-medium">竞品: ¥{item.theirs}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 h-6">
                        <div
                          className="bg-orbit-primary/70 rounded-l-md transition-all duration-500 flex items-center justify-end pr-1.5"
                          style={{ width: `${(item.ours / maxPriceValue) * 50}%` }}
                        >
                          <span className="text-[10px] text-white font-medium">¥{item.ours}</span>
                        </div>
                        <div
                          className="bg-orbit-accent/70 rounded-r-md transition-all duration-500 flex items-center pl-1.5"
                          style={{ width: `${(item.theirs / maxPriceValue) * 50}%` }}
                        >
                          <span className="text-[10px] text-white font-medium">¥{item.theirs}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sales comparison */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  销量对比
                </h4>
                <div className="space-y-4">
                  {comparisonDetail.salesData.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">{item.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-orbit-primary-light font-medium">我方: {item.ours.toLocaleString()}</span>
                          <span className="text-orbit-accent-light font-medium">竞品: {item.theirs.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5 h-6">
                        <div
                          className="bg-orbit-primary/70 rounded-l-md transition-all duration-500 flex items-center justify-end pr-1.5"
                          style={{ width: `${(item.ours / maxSalesValue) * 50}%` }}
                        >
                          <span className="text-[10px] text-white font-medium">{item.ours.toLocaleString()}</span>
                        </div>
                        <div
                          className="bg-orbit-accent/70 rounded-r-md transition-all duration-500 flex items-center pl-1.5"
                          style={{ width: `${(item.theirs / maxSalesValue) * 50}%` }}
                        >
                          <span className="text-[10px] text-white font-medium">{item.theirs.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* 添加竞品弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowAddModal(false)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-slate-200">添加竞品</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">品牌名称</label>
                <input value={newCompetitor.brand} onChange={e => setNewCompetitor(p => ({ ...p, brand: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="输入品牌名称" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">所属行业</label>
                <input value={newCompetitor.industry} onChange={e => setNewCompetitor(p => ({ ...p, industry: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary focus:ring-1 focus:ring-orbit-primary/30" placeholder="输入所属行业" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orbit-border flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>取消</Button>
              <Button variant="primary" onClick={async () => {
                if (!newCompetitor.brand.trim()) return
                setSaving(true)
                try {
                  await api.post('/api/system/competitors', newCompetitor)
                  setShowAddModal(false)
                  setNewCompetitor({ brand: '', industry: '' })
                  const res = await api.get<any>('/api/system/competitors', { search: searchQuery || undefined })
                  if (res.competitors) setCompetitors(res.competitors)
                  if (res.comparisonData) setComparisonData(res.comparisonData)
                } catch { /* 后端接口未实现时静默处理 */ }
                finally { setSaving(false) }
              }} loading={saving}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}