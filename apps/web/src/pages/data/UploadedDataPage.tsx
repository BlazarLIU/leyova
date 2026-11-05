import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Database, Search, X, Trash2, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

type TabKey = 'anchor' | 'channel'

interface AnchorRow {
  id: number
  business_date: string
  account_name: string
  anchor_name: string
  payment_amount: string
  hourly_payment: string
  peak_online: number
  avg_online: number
  avg_item_price: string
  exposure_view_rate: string
  retention_rate: string
  interaction_rate: string
  new_followers: number
  uv_value: string
  buyers: number
  upload_id: number
  created_at: string
}

interface ChannelRow {
  id: number
  business_date: string
  channel_name: string
  live_duration_seconds: number
  avg_watch_seconds: number
  impressions: number
  viewers: number
  interactions: number
  new_followers: number
  product_impressions: number
  product_clicks: number
  order_count: number
  buyer_count: number
  payment_amount: string
  thousand_view_payment: string
  avg_order_value: string
  upload_id: number
  created_at: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const tabs: { key: TabKey; label: string }[] = [
  { key: 'anchor', label: '主播分析数据' },
  { key: 'channel', label: '渠道分析数据' },
]

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

function formatNum(n: number | string | null | undefined): string {
  if (n == null) return '-'
  const v = typeof n === 'string' ? parseFloat(n) : n
  return Number.isFinite(v) ? v.toLocaleString('zh-CN') : '-'
}

function formatMoney(n: number | string | null | undefined): string {
  if (n == null) return '-'
  const v = typeof n === 'string' ? parseFloat(n) : n
  return Number.isFinite(v) ? `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'
}

function formatRate(n: number | string | null | undefined): string {
  if (n == null) return '-'
  const v = typeof n === 'string' ? parseFloat(n) : n
  return Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : '-'
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-'
  return d.slice(0, 10)
}

export function UploadedDataPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('anchor')

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Data
  const [anchorData, setAnchorData] = useState<PaginatedResponse<AnchorRow> | null>(null)
  const [channelData, setChannelData] = useState<PaginatedResponse<ChannelRow> | null>(null)
  const [loading, setLoading] = useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Delete
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deletingBatch, setDeletingBatch] = useState(false)

  // Detail modal
  const [detailRow, setDetailRow] = useState<AnchorRow | ChannelRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (keyword) params.set('keyword', keyword)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      const endpoint = activeTab === 'anchor'
        ? `/api/data/uploaded-data/anchor?${params.toString()}`
        : `/api/data/uploaded-data/channel?${params.toString()}`

      const res = await api.get<any>(endpoint)
      const data = res?.data ?? res ?? { items: [], total: 0, page, pageSize }

      if (activeTab === 'anchor') {
        setAnchorData(data as PaginatedResponse<AnchorRow>)
      } else {
        setChannelData(data as PaginatedResponse<ChannelRow>)
      }
      setSelectedIds(new Set())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [activeTab, startDate, endDate, keyword, page, pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = useCallback(() => {
    setPage(1)
    fetchData()
  }, [fetchData])

  const handleReset = useCallback(() => {
    setStartDate('')
    setEndDate('')
    setKeyword('')
    setPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab)
    setPage(1)
    setSelectedIds(new Set())
    setDetailRow(null)
  }, [])

  // Selection
  const handleSelectAll = useCallback((checked: boolean) => {
    const items = activeTab === 'anchor' ? anchorData?.items : channelData?.items
    if (!items) return
    if (checked) {
      setSelectedIds(new Set(items.map(i => i.id)))
    } else {
      setSelectedIds(new Set())
    }
  }, [activeTab, anchorData, channelData])

  const handleSelectOne = useCallback((id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  // Delete single
  const handleDeleteSingle = useCallback(async () => {
    if (!deletingId) return
    try {
      const endpoint = activeTab === 'anchor'
        ? `/api/data/uploaded-data/anchor/${deletingId}`
        : `/api/data/uploaded-data/channel/${deletingId}`
      await api.delete(endpoint)
      setDeletingId(null)
      fetchData()
    } catch {
      alert('删除失败')
      setDeletingId(null)
    }
  }, [deletingId, activeTab, fetchData])

  // Delete batch
  const handleDeleteBatch = useCallback(async () => {
    if (selectedIds.size === 0) return
    setDeletingBatch(true)
    try {
      const endpoint = activeTab === 'anchor'
        ? '/api/data/uploaded-data/anchor/batch-delete'
        : '/api/data/uploaded-data/channel/batch-delete'
      await api.post(endpoint, { ids: Array.from(selectedIds) })
      setSelectedIds(new Set())
      fetchData()
    } catch {
      alert('批量删除失败')
    } finally {
      setDeletingBatch(false)
    }
  }, [selectedIds, activeTab, fetchData])

  const currentData = activeTab === 'anchor' ? anchorData : channelData
  const totalPages = currentData ? Math.ceil(currentData.total / currentData.pageSize) : 0

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">上传数据管理</h1>
            <p className="text-slate-500 text-sm mt-1">管理已导入的主播分析与渠道分析数据</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="flex gap-1 border-b border-orbit-border"
      >
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium transition-colors relative',
              activeTab === tab.key
                ? 'text-orbit-primary-light'
                : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-orbit-primary-light rounded-full"
              />
            )}
          </button>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 text-slate-300 outline-none w-36"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 text-slate-300 outline-none w-36"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-slate-500 mb-1">
                  {activeTab === 'anchor' ? '主播名称' : '渠道名称'}
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder={activeTab === 'anchor' ? '搜索主播名称…' : '搜索渠道名称…'}
                  className="text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 text-slate-300 outline-none w-full"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSearch} icon={<Search className="w-3.5 h-3.5" />}>
                  查询
                </Button>
                <Button size="sm" variant="outline" onClick={handleReset} icon={<X className="w-3.5 h-3.5" />}>
                  重置
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card>
          <CardHeader
            title={activeTab === 'anchor' ? '主播分析数据' : '渠道分析数据'}
            subtitle={currentData ? `共 ${currentData.total} 条记录` : '加载中…'}
            actions={
              selectedIds.size > 0 ? (
                <Button
                  size="sm"
                  variant="destructive"
                  loading={deletingBatch}
                  onClick={handleDeleteBatch}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  删除选中 ({selectedIds.size})
                </Button>
              ) : undefined
            }
          />
          <CardBody className="px-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : currentData && currentData.items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-orbit-border">
                        <th className="w-10 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={currentData.items.length > 0 && selectedIds.size === currentData.items.length}
                            onChange={e => handleSelectAll(e.target.checked)}
                            className="rounded border-orbit-border bg-orbit-surface2 accent-orbit-primary"
                          />
                        </th>
                        {activeTab === 'anchor' ? (
                          <>
                            <th className="text-left text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">日期</th>
                            <th className="text-left text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">主播名称</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">成交金额</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">小时成交</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">最高在线</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">平均在线</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">平均客单价</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">UV价值</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">成交人数</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">互动率</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">新增粉丝</th>
                            <th className="w-20 text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">操作</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">日期</th>
                            <th className="text-left text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">渠道名称</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">曝光次数</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">观看人数</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">互动次数</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">订单数</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">成交金额</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">成交人数</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">客单价</th>
                            <th className="text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">新增关注</th>
                            <th className="w-20 text-right text-xs text-slate-500 font-medium px-3 py-3 whitespace-nowrap">操作</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.items.map((row, i) => (
                        <motion.tr
                          key={row.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3, delay: i * 0.02 }}
                          className="border-b border-orbit-border/50 hover:bg-white/5 transition-colors"
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={e => handleSelectOne(row.id, e.target.checked)}
                              className="rounded border-orbit-border bg-orbit-surface2 accent-orbit-primary"
                            />
                          </td>
                          {activeTab === 'anchor' ? (
                            <>
                              <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">
                                {formatDate((row as AnchorRow).business_date)}
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-slate-200 font-medium">
                                  {(row as AnchorRow).anchor_name}
                                </span>
                                {(row as AnchorRow).account_name && (
                                  <span className="text-slate-600 text-xs ml-1">
                                    ({(row as AnchorRow).account_name})
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-200 tabular-nums text-xs">
                                {formatMoney((row as AnchorRow).payment_amount)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatMoney((row as AnchorRow).hourly_payment)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as AnchorRow).peak_online)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as AnchorRow).avg_online)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatMoney((row as AnchorRow).avg_item_price)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatMoney((row as AnchorRow).uv_value)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as AnchorRow).buyers)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatRate((row as AnchorRow).interaction_rate)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as AnchorRow).new_followers)}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">
                                {formatDate((row as ChannelRow).business_date)}
                              </td>
                              <td className="px-3 py-3">
                                <span className="text-slate-200 font-medium">
                                  {(row as ChannelRow).channel_name}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as ChannelRow).impressions)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as ChannelRow).viewers)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as ChannelRow).interactions)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as ChannelRow).order_count)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-200 tabular-nums text-xs">
                                {formatMoney((row as ChannelRow).payment_amount)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as ChannelRow).buyer_count)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatMoney((row as ChannelRow).avg_order_value)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-300 tabular-nums text-xs">
                                {formatNum((row as ChannelRow).new_followers)}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setDetailRow(row)}
                                className="p-1.5 text-slate-600 hover:text-cyan-400 transition-colors rounded-lg hover:bg-white/5"
                                title="查看详情"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingId(row.id)}
                                className="p-1.5 text-slate-600 hover:text-orbit-danger transition-colors rounded-lg hover:bg-white/5"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-orbit-border">
                  <span className="text-xs text-slate-500">
                    共 {currentData.total} 条，第 {currentData.page}/{totalPages} 页
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="p-1.5 text-slate-600 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-white/5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 7) {
                        pageNum = i + 1
                      } else if (page <= 4) {
                        pageNum = i + 1
                      } else if (page >= totalPages - 3) {
                        pageNum = totalPages - 6 + i
                      } else {
                        pageNum = page - 3 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={cn(
                            'w-7 h-7 text-xs rounded-lg transition-colors',
                            pageNum === page
                              ? 'bg-orbit-primary/20 text-orbit-primary-light font-medium'
                              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5',
                          )}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                      className="p-1.5 text-slate-600 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-white/5"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Database className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-sm text-slate-500">暂无数据</p>
                <p className="text-xs text-slate-600 mt-1">
                  请先通过「数据上传」页面导入{activeTab === 'anchor' ? '主播分析' : '渠道分析'}数据
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Delete single confirm */}
      {deletingId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingId(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-200 mb-2">确认删除</h3>
            <p className="text-sm text-slate-400 mb-6">确定要删除这条记录吗？此操作不可撤销。</p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingId(null)}>取消</Button>
              <Button variant="destructive" onClick={handleDeleteSingle}>确认删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailRow !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDetailRow(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-orbit-border">
              <h3 className="text-base font-semibold text-slate-200">数据详情</h3>
              <button onClick={() => setDetailRow(null)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {activeTab === 'anchor' ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <DetailItem label="日期" value={formatDate((detailRow as AnchorRow).business_date)} />
                  <DetailItem label="主播名称" value={(detailRow as AnchorRow).anchor_name} />
                  <DetailItem label="账号名称" value={(detailRow as AnchorRow).account_name || '-'} />
                  <DetailItem label="成交金额" value={formatMoney((detailRow as AnchorRow).payment_amount)} />
                  <DetailItem label="小时成交" value={formatMoney((detailRow as AnchorRow).hourly_payment)} />
                  <DetailItem label="最高在线" value={formatNum((detailRow as AnchorRow).peak_online)} />
                  <DetailItem label="平均在线" value={formatNum((detailRow as AnchorRow).avg_online)} />
                  <DetailItem label="平均客单价" value={formatMoney((detailRow as AnchorRow).avg_item_price)} />
                  <DetailItem label="曝光观看率" value={formatRate((detailRow as AnchorRow).exposure_view_rate)} />
                  <DetailItem label="留存率" value={formatRate((detailRow as AnchorRow).retention_rate)} />
                  <DetailItem label="互动率" value={formatRate((detailRow as AnchorRow).interaction_rate)} />
                  <DetailItem label="新增粉丝" value={formatNum((detailRow as AnchorRow).new_followers)} />
                  <DetailItem label="UV价值" value={formatMoney((detailRow as AnchorRow).uv_value)} />
                  <DetailItem label="成交人数" value={formatNum((detailRow as AnchorRow).buyers)} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <DetailItem label="日期" value={formatDate((detailRow as ChannelRow).business_date)} />
                  <DetailItem label="渠道名称" value={(detailRow as ChannelRow).channel_name} />
                  <DetailItem label="曝光次数" value={formatNum((detailRow as ChannelRow).impressions)} />
                  <DetailItem label="观看人数" value={formatNum((detailRow as ChannelRow).viewers)} />
                  <DetailItem label="互动次数" value={formatNum((detailRow as ChannelRow).interactions)} />
                  <DetailItem label="新增关注" value={formatNum((detailRow as ChannelRow).new_followers)} />
                  <DetailItem label="商品曝光" value={formatNum((detailRow as ChannelRow).product_impressions)} />
                  <DetailItem label="商品点击" value={formatNum((detailRow as ChannelRow).product_clicks)} />
                  <DetailItem label="订单数" value={formatNum((detailRow as ChannelRow).order_count)} />
                  <DetailItem label="成交人数" value={formatNum((detailRow as ChannelRow).buyer_count)} />
                  <DetailItem label="成交金额" value={formatMoney((detailRow as ChannelRow).payment_amount)} />
                  <DetailItem label="千次观看成交" value={formatMoney((detailRow as ChannelRow).thousand_view_payment)} />
                  <DetailItem label="平均客单价" value={formatMoney((detailRow as ChannelRow).avg_order_value)} />
                  <DetailItem label="直播时长(秒)" value={formatNum((detailRow as ChannelRow).live_duration_seconds)} />
                  <DetailItem label="平均观看(秒)" value={formatNum((detailRow as ChannelRow).avg_watch_seconds)} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500 text-xs">{label}</span>
      <p className="text-slate-200 mt-0.5">{value || '-'}</p>
    </div>
  )
}