import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  X,
  RotateCcw,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  Inbox,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { StatCard } from '@/components/ui/StatCard'
import { cn } from '@/utils/cn'
import type { UseTableReturn } from './useTable'
import type { StatCardData } from '@/types'

export interface ColumnDef<T> {
  key: string
  header: React.ReactNode
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string | number
  className?: string
  render?: (value: any, row: T, index: number) => React.ReactNode
}

export interface DataPageProps<T> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  stats?: StatCardData[]
  table: UseTableReturn<T, any>
  columns: ColumnDef<T>[]
  getRowId?: (row: T, index: number) => string | number
  selectable?: boolean
  batchActions?: (selectedRows: T[], clearSelection: () => void) => React.ReactNode
  searchPlaceholder?: string
  filterControls?: React.ReactNode
  extraToolbar?: React.ReactNode
  emptyMessage?: string
  emptyAction?: React.ReactNode
  onRowClick?: (row: T) => void
  loadingText?: string
  className?: string
  cardClassName?: string
  tableClassName?: string
  showPagination?: boolean
  showSearch?: boolean
  showExport?: boolean
  exportFilename?: string
  children?: React.ReactNode
}



export function DataPage<T>({
  title,
  subtitle,
  badge,
  actions,
  stats,
  table,
  columns,
  getRowId = (row: any, idx: number) => row?.id ?? row?.key ?? row?.code ?? idx,
  selectable = false,
  batchActions,
  searchPlaceholder = '搜索关键词...',
  filterControls,
  extraToolbar,
  emptyMessage = '暂无符合条件的数据',
  emptyAction,
  onRowClick,
  loadingText = '正在加载数据...',
  className,
  cardClassName,
  tableClassName,
  showPagination = true,
  showSearch = true,
  showExport = true,
  exportFilename = 'export_data',
  children,
}: DataPageProps<T>) {
  const {
    data,
    total,
    totalPages,
    loading,
    error,
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
    hasActiveFilters,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    resetFilters,
    reload,
    selectedRowKeys,
    selectedRows,
    toggleSelectRow,
    toggleSelectAll,
    clearSelection,
    exportCsv,
  } = table

  // Selection calculations
  const allCurrentKeys = useMemo(
    () => data.map((r, i) => getRowId(r, i)),
    [data, getRowId]
  )

  const isAllSelected =
    data.length > 0 && allCurrentKeys.every((k) => selectedRowKeys.has(k))

  const isSomeSelected =
    !isAllSelected && allCurrentKeys.some((k) => selectedRowKeys.has(k))

  // Handle CSV export with current columns
  const handleExport = () => {
    const exportCols = columns.map((c) => ({
      key: c.key,
      label: typeof c.header === 'string' ? c.header : c.key,
    }))
    exportCsv(exportFilename, exportCols)
  }

  // Generate pagination number list (e.g. [1, 2, 3, '...', 10])
  const paginationRange = useMemo(() => {
    const totalP = Math.max(1, totalPages)
    const curP = page
    const delta = 2

    const range: (number | string)[] = []
    const rangeWithDots: (number | string)[] = []
    let l: number | undefined

    for (let i = 1; i <= totalP; i++) {
      if (i === 1 || i === totalP || (i >= curP - delta && i <= curP + delta)) {
        range.push(i)
      }
    }

    for (const i of range) {
      if (l) {
        if (typeof i === 'number' && i - l === 2) {
          rangeWithDots.push(l + 1)
        } else if (typeof i === 'number' && i - l !== 1) {
          rangeWithDots.push('...')
        }
      }
      rangeWithDots.push(i)
      if (typeof i === 'number') l = i
    }

    return rangeWithDots
  }, [page, totalPages])

  return (
    <div className={cn('space-y-6', className)}>
      {/* ─── 1. Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">{title}</h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>
        )}
      </div>

      {/* ─── 2. Stat Cards (Optional) ─── */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, idx) => (
            <StatCard key={s.id || idx} data={s} />
          ))}
        </div>
      )}

      {/* ─── 3. Optional Extra Top Content ─── */}
      {children}

      {/* ─── 4. Filter Toolbar ─── */}
      <Card className="p-4 bg-orbit-surface/80 border-orbit-border backdrop-blur">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {showSearch && (
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  prefix={<Search className="w-4 h-4 text-slate-400" />}
                  suffix={
                    search ? (
                      <button
                        onClick={() => setSearch('')}
                        className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
                        title="清空搜索"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : undefined
                  }
                  className="h-9 text-xs"
                />
              </div>
            )}

            {filterControls}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 text-xs text-slate-400 hover:text-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                重置筛选
              </Button>
            )}
          </div>

          {/* Right: Actions, Refresh & Export */}
          <div className="flex items-center gap-2 self-end lg:self-auto flex-shrink-0">
            {extraToolbar}

            <Button
              variant="outline"
              size="sm"
              onClick={() => reload()}
              disabled={loading}
              className="h-9 text-xs"
              title="刷新数据"
            >
              <RotateCcw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
              刷新
            </Button>

            {showExport && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={data.length === 0}
                className="h-9 text-xs"
                title="导出当前表格数据为 CSV"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                导出 CSV
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ─── 5. Batch Action Bar ─── */}
      <AnimatePresence>
        {selectable && selectedRowKeys.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-orbit-primary/10 border border-orbit-primary/30 text-xs">
              <div className="flex items-center gap-2 text-slate-200">
                <span className="font-semibold text-orbit-primary-light">
                  已选中 {selectedRowKeys.size} 项
                </span>
                <span className="text-slate-500">|</span>
                <button
                  onClick={clearSelection}
                  className="text-slate-400 hover:text-slate-200 underline transition-colors"
                >
                  取消选择
                </button>
              </div>

              {batchActions && (
                <div className="flex items-center gap-2">
                  {batchActions(selectedRows, clearSelection)}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 6. Main Data Table ─── */}
      <Card className={cn('overflow-hidden border-orbit-border bg-orbit-surface', cardClassName)}>
        <div className="overflow-x-auto">
          <table className={cn('w-full border-collapse text-left text-xs', tableClassName)}>
            <thead>
              <tr className="border-b border-orbit-border bg-orbit-surface2/50 text-slate-400 font-medium">
                {selectable && (
                  <th className="w-10 px-4 py-3 text-center">
                    <Checkbox
                      checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                      onCheckedChange={() => toggleSelectAll()}
                      aria-label="全选"
                    />
                  </th>
                )}
                {columns.map((col) => {
                  const isSorted = sortBy === col.key
                  const alignCls =
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'

                  return (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className={cn(
                        'px-4 py-3 font-medium transition-colors select-none whitespace-nowrap',
                        alignCls,
                        col.sortable && 'cursor-pointer hover:text-slate-200 hover:bg-white/5',
                        col.className
                      )}
                      onClick={() => col.sortable && setSort(col.key)}
                    >
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          col.align === 'right' && 'flex-row-reverse'
                        )}
                      >
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-slate-500">
                            {isSorted && sortOrder === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-orbit-primary-light" />
                            ) : isSorted && sortOrder === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-orbit-primary-light" />
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-orbit-border/40">
              {/* Error State */}
              {error ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-12 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orbit-danger/10 text-orbit-danger flex items-center justify-center">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-medium text-slate-300">加载数据失败</div>
                      <p className="text-xs text-slate-500 max-w-md">{error.message}</p>
                      <Button variant="secondary" size="sm" onClick={() => reload()} className="mt-2 text-xs">
                        重新尝试
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : loading && data.length === 0 ? (
                /* Initial Loading State */
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-16 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin text-orbit-primary-light" />
                      <span className="text-xs">{loadingText}</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                /* Empty State */
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-16 text-center"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orbit-surface2 text-slate-500 flex items-center justify-center">
                        <Inbox className="w-5 h-5" />
                      </div>
                      <div className="text-xs text-slate-400">{emptyMessage}</div>
                      {emptyAction && <div className="mt-2">{emptyAction}</div>}
                    </div>
                  </td>
                </tr>
              ) : (
                /* Data Rows */
                data.map((row, idx) => {
                  const rowId = getRowId(row, idx)
                  const isSelected = selectedRowKeys.has(rowId)

                  return (
                    <tr
                      key={String(rowId)}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        'transition-colors text-slate-300',
                        onRowClick && 'cursor-pointer',
                        isSelected
                          ? 'bg-orbit-primary/5 hover:bg-orbit-primary/10'
                          : 'hover:bg-orbit-surface2/40'
                      )}
                    >
                      {selectable && (
                        <td
                          className="w-10 px-4 py-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectRow(rowId, row)}
                            aria-label={`选择第 ${idx + 1} 行`}
                          />
                        </td>
                      )}
                      {columns.map((col) => {
                        const val = (row as any)[col.key]
                        const alignCls =
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'

                        return (
                          <td
                            key={col.key}
                            className={cn('px-4 py-3 whitespace-nowrap', alignCls, col.className)}
                          >
                            {col.render ? col.render(val, row, idx) : val != null ? String(val) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 7. Pagination Footer ─── */}
        {showPagination && total > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-orbit-border/60 bg-orbit-surface2/30 gap-3 text-xs text-slate-400">
            {/* Left: Total records summary */}
            <div className="flex items-center gap-3">
              <span>
                共 <span className="font-semibold text-slate-200">{total.toLocaleString('zh-CN')}</span> 条记录
              </span>
              <span className="text-slate-600">|</span>
              <span>
                每页显示
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="ml-1.5 px-2 py-1 rounded bg-orbit-surface border border-orbit-border text-slate-200 text-xs focus:outline-none focus:border-orbit-primary"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                条
              </span>
            </div>

            {/* Right: Page Navigation Buttons */}
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <span className="mr-2 text-slate-500">
                第 {page} / {Math.max(1, totalPages)} 页
              </span>

              {/* First page */}
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="首页"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Prev page */}
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || loading}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1 px-1">
                {paginationRange.map((p, i) =>
                  typeof p === 'number' ? (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      disabled={loading}
                      className={cn(
                        'min-w-[28px] h-7 px-1.5 rounded text-xs font-medium transition-colors',
                        page === p
                          ? 'bg-orbit-primary text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      )}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={`dots-${i}`} className="px-1 text-slate-600">
                      {p}
                    </span>
                  )
                )}
              </div>

              {/* Next page */}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="下一页"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Last page */}
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="末页"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
