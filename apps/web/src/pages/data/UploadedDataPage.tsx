import { useState, useCallback, useMemo } from 'react'
import { Eye, Trash2, Database } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/AlertDialog'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable, type TableFetchParams } from '@/components/common/useTable'
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
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [detailRow, setDetailRow] = useState<AnchorRow | ChannelRow | null>(null)

  // Fetch data provider for useTable
  const fetchTableData = useCallback(async (params: TableFetchParams<{ startDate: string; endDate: string }>) => {
    const qp: Record<string, string | number | undefined> = {
      page: params.page,
      pageSize: params.pageSize,
      startDate: params.filters.startDate || undefined,
      endDate: params.filters.endDate || undefined,
      keyword: params.search || undefined,
    }

    if (activeTab === 'anchor') {
      const res = await api.get<any>('/api/data/uploaded-data/anchor', qp)
      return res?.data ?? res ?? { items: [], total: 0 }
    } else {
      const res = await api.get<any>('/api/data/uploaded-data/channel', qp)
      return res?.data ?? res ?? { items: [], total: 0 }
    }
  }, [activeTab])

  const table = useTable<AnchorRow | ChannelRow, { startDate: string; endDate: string }>({
    fetchData: fetchTableData,
    initialPageSize: 15,
    initialFilters: { startDate: '', endDate: '' },
    getRowId: (row) => row.id,
  })

  // Single delete handler
  const handleDeleteSingle = async () => {
    if (!deletingId) return
    try {
      if (activeTab === 'anchor') {
        await api.delete(`/api/data/uploaded-data/anchor/${deletingId}`)
      } else {
        await api.delete(`/api/data/uploaded-data/channel/${deletingId}`)
      }
      setDeletingId(null)
      table.reload()
    } catch {
      alert('删除失败')
      setDeletingId(null)
    }
  }

  // Batch delete handler
  const handleBatchDelete = async (selectedRows: (AnchorRow | ChannelRow)[], clearSelection: () => void) => {
    const ids = selectedRows.map((r) => r.id)
    if (ids.length === 0) return
    if (!confirm(`确定要批量删除选中的 ${ids.length} 条数据吗？此操作不可恢复。`)) return

    try {
      if (activeTab === 'anchor') {
        await api.post('/api/data/uploaded-data/anchor/batch-delete', { ids })
      } else {
        await api.post('/api/data/uploaded-data/channel/batch-delete', { ids })
      }
      clearSelection()
      table.reload()
    } catch {
      alert('批量删除失败')
    }
  }

  // Column definitions for Anchor
  const anchorColumns = useMemo<ColumnDef<AnchorRow>[]>(() => [
    { key: 'business_date', header: '日期', sortable: true, render: (v) => formatDate(v) },
    {
      key: 'anchor_name',
      header: '主播名称',
      render: (_, r) => (
        <div>
          <span className="text-[var(--text-secondary)] font-medium">{r.anchor_name}</span>
          {r.account_name && <span className="text-[var(--text-muted)] text-xs ml-1">({r.account_name})</span>}
        </div>
      ),
    },
    { key: 'payment_amount', header: '成交金额', align: 'right', render: (v) => formatMoney(v) },
    { key: 'hourly_payment', header: '小时成交', align: 'right', render: (v) => formatMoney(v) },
    { key: 'peak_online', header: '最高在线', align: 'right', render: (v) => formatNum(v) },
    { key: 'avg_online', header: '平均在线', align: 'right', render: (v) => formatNum(v) },
    { key: 'avg_item_price', header: '客单价', align: 'right', render: (v) => formatMoney(v) },
    { key: 'uv_value', header: 'UV价值', align: 'right', render: (v) => formatMoney(v) },
    { key: 'buyers', header: '成交人数', align: 'right', render: (v) => formatNum(v) },
    { key: 'interaction_rate', header: '互动率', align: 'right', render: (v) => formatRate(v) },
    { key: 'new_followers', header: '新增粉丝', align: 'right', render: (v) => formatNum(v) },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (_, r) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setDetailRow(r)}
            className="p-1 text-[var(--text-muted)] hover:text-status-ai transition-colors rounded"
            title="查看详情"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeletingId(r.id)}
            className="p-1 text-[var(--text-muted)] hover:text-orbit-danger transition-colors rounded"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [])

  // Column definitions for Channel
  const channelColumns = useMemo<ColumnDef<ChannelRow>[]>(() => [
    { key: 'business_date', header: '日期', sortable: true, render: (v) => formatDate(v) },
    { key: 'channel_name', header: '渠道名称', render: (v) => <span className="text-[var(--text-secondary)] font-medium">{v}</span> },
    { key: 'impressions', header: '曝光次数', align: 'right', render: (v) => formatNum(v) },
    { key: 'viewers', header: '观看人数', align: 'right', render: (v) => formatNum(v) },
    { key: 'interactions', header: '互动次数', align: 'right', render: (v) => formatNum(v) },
    { key: 'order_count', header: '订单数', align: 'right', render: (v) => formatNum(v) },
    { key: 'payment_amount', header: '成交金额', align: 'right', render: (v) => formatMoney(v) },
    { key: 'buyer_count', header: '成交人数', align: 'right', render: (v) => formatNum(v) },
    { key: 'avg_order_value', header: '客单价', align: 'right', render: (v) => formatMoney(v) },
    { key: 'new_followers', header: '新增关注', align: 'right', render: (v) => formatNum(v) },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (_, r) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setDetailRow(r)}
            className="p-1 text-[var(--text-muted)] hover:text-status-ai transition-colors rounded"
            title="查看详情"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeletingId(r.id)}
            className="p-1 text-[var(--text-muted)] hover:text-orbit-danger transition-colors rounded"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [])

  return (
    <>
      <DataPage<any>
        title="已上传数据管理"
        subtitle="浏览、筛选、校验已入库的主播与渠道运营分析明细数据"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-[var(--text-muted)] border border-orbit-border">
            已接入 DataPage + useTable
          </span>
        }
        table={table}
        columns={activeTab === 'anchor' ? anchorColumns : channelColumns}
        selectable
        searchPlaceholder={activeTab === 'anchor' ? '搜索主播/账号名称...' : '搜索渠道名称...'}
        exportFilename={`uploaded_${activeTab}_data`}
        emptyMessage={`暂无${activeTab === 'anchor' ? '主播分析' : '渠道分析'}数据，可通过「数据上传」导入`}
        batchActions={(selectedRows, clearSelection) => (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleBatchDelete(selectedRows, clearSelection)}
            className="h-7 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            批量删除 ({selectedRows.length})
          </Button>
        )}
        filterControls={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={table.filters.startDate}
              onChange={(e) => table.setFilter('startDate', e.target.value)}
              className="h-9 text-xs w-36"
              placeholder="开始日期"
            />
            <span className="text-[var(--text-muted)] text-xs">至</span>
            <Input
              type="date"
              value={table.filters.endDate}
              onChange={(e) => table.setFilter('endDate', e.target.value)}
              className="h-9 text-xs w-36"
              placeholder="结束日期"
            />
          </div>
        }
      >
        {/* Tab switcher */}
        <div className="flex items-center gap-2 border-b border-orbit-border/80 pb-2">
          <button
            onClick={() => {
              setActiveTab('anchor')
              table.clearSelection()
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'anchor'
                ? 'bg-orbit-primary text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            主播分析数据
          </button>
          <button
            onClick={() => {
              setActiveTab('channel')
              table.clearSelection()
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'channel'
                ? 'bg-orbit-primary text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            渠道分析数据
          </button>
        </div>
      </DataPage>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除记录？</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的这条记录吗？此操作不可撤销，并将同时更新聚合事实缓存。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSingle} className="bg-orbit-danger hover:bg-orbit-danger/80 text-white">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail View Dialog */}
      <Dialog open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>运营明细数据详情</DialogTitle>
          </DialogHeader>
          <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
            {detailRow && activeTab === 'anchor' && (
              <>
                <DetailItem label="日期" value={formatDate((detailRow as AnchorRow).business_date)} />
                <DetailItem label="主播名称" value={(detailRow as AnchorRow).anchor_name} />
                <DetailItem label="账号名称" value={(detailRow as AnchorRow).account_name || '-'} />
                <DetailItem label="成交金额" value={formatMoney((detailRow as AnchorRow).payment_amount)} />
                <DetailItem label="小时成交" value={formatMoney((detailRow as AnchorRow).hourly_payment)} />
                <DetailItem label="最高在线" value={formatNum((detailRow as AnchorRow).peak_online)} />
                <DetailItem label="平均在线" value={formatNum((detailRow as AnchorRow).avg_online)} />
                <DetailItem label="客单价" value={formatMoney((detailRow as AnchorRow).avg_item_price)} />
                <DetailItem label="曝光观看率" value={formatRate((detailRow as AnchorRow).exposure_view_rate)} />
                <DetailItem label="留存率" value={formatRate((detailRow as AnchorRow).retention_rate)} />
                <DetailItem label="互动率" value={formatRate((detailRow as AnchorRow).interaction_rate)} />
                <DetailItem label="新增粉丝" value={formatNum((detailRow as AnchorRow).new_followers)} />
                <DetailItem label="UV价值" value={formatMoney((detailRow as AnchorRow).uv_value)} />
                <DetailItem label="成交人数" value={formatNum((detailRow as AnchorRow).buyers)} />
              </>
            )}
            {detailRow && activeTab === 'channel' && (
              <>
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-orbit-border/40 pb-2">
      <span className="text-[var(--text-muted)] text-[11px]">{label}</span>
      <p className="text-[var(--text-secondary)] font-medium mt-0.5">{value || '-'}</p>
    </div>
  )
}

export default UploadedDataPage
