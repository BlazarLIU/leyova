import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Plus, Database, Columns, RowsIcon,
  CalendarDays, ChevronRight, Table2,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
}

interface DataTable {
  id: string
  name: string
  rows: number
  columns: number
  updatedAt: string
  status: 'active' | 'inactive' | 'error'
  columnDetails: ColumnInfo[]
  sampleData: Record<string, string | number>[]
}

const statusConfig: Record<string, { variant: 'success' | 'danger' | 'neutral'; label: string }> = {
  active: { variant: 'success', label: '正常' },
  error: { variant: 'danger', label: '异常' },
  inactive: { variant: 'neutral', label: '停用' },
}

const typeColorMap: Record<string, string> = {
  VARCHAR: 'text-emerald-400',
  DECIMAL: 'text-cyan-400',
  INT: 'text-violet-400',
  BIGINT: 'text-violet-500',
  DATETIME: 'text-amber-400',
  CHAR: 'text-slate-400',
  TEXT: 'text-slate-300',
  BOOLEAN: 'text-blue-400',
}

function getTypeColor(type: string): string {
  const base = type.split('(')[0].toUpperCase()
  return typeColorMap[base] ?? 'text-slate-400'
}

export function DataManagementPage() {
  const [search, setSearch] = useState('')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [tables, setTables] = useState<DataTable[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    api.get<any>('/api/data/tables')
      .then(res => {
        const list = Array.isArray(res) ? res : res?.data ?? []
        if (list.length > 0) {
          setTables(list.map((item: any) => ({
            id: item.id ?? item.name,
            name: item.name,
            rows: item.rowCount ?? item.rows ?? item.row_count ?? 0,
            columns: item.columns ?? item.column_count ?? 0,
            updatedAt: item.updatedAt ?? item.updated_at ?? '',
            status: item.status === 'synced' ? 'active' : (item.status ?? 'active'),
            columnDetails: (item.columnDetails ?? item.column_details ?? []).map((col: any) => ({
              name: col.name,
              type: col.type,
              nullable: col.nullable ?? false,
            })),
            sampleData: (item.sampleData ?? item.sample_data ?? []).map((row: any) => ({ ...row })),
          })))
        }
      })
      .catch(() => { /* 静默处理，列表为空 */ })
      .finally(() => setLoading(false))
  }, [])

  const filteredTables = tables.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    return matchSearch && matchStatus
  })

  const selectedData = selectedTable
    ? tables.find(t => t.id === selectedTable) ?? null
    : null

  const statusFilters = [
    { value: 'all', label: '全部' },
    { value: 'active', label: '正常' },
    { value: 'error', label: '异常' },
    { value: 'inactive', label: '停用' },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">数据管理</h1>
            <p className="text-slate-500 text-sm mt-1">数据表管理与维护</p>
          </div>
        </div>
      </motion.div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索表名..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-orbit-border bg-orbit-surface2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-orbit-primary/50 transition-colors"
          />
        </div>

        {/* Status filter buttons */}
        <div className="flex items-center gap-1">
          {statusFilters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                filterStatus === f.value
                  ? 'bg-orbit-primary/15 text-orbit-primary-light border border-orbit-primary/30'
                  : 'text-slate-400 bg-orbit-surface2 border border-orbit-border hover:text-slate-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto">
          <Button size="md" icon={<Plus className="w-4 h-4" />}>
            创建数据表
          </Button>
        </div>
      </motion.div>

      {/* Main content: table cards + detail panel */}
      <div className="flex gap-6">
        {/* Table list */}
        <div className="flex-1 min-w-0">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {filteredTables.map((table, i) => {
              const statusInfo = statusConfig[table.status]
              return (
                <motion.button
                  key={table.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  onClick={() => setSelectedTable(selectedTable === table.id ? null : table.id)}
                  className={cn(
                    'text-left bg-orbit-surface rounded-xl border transition-all p-5 hover:border-orbit-border2',
                    selectedTable === table.id
                      ? 'border-orbit-primary/50 ring-1 ring-orbit-primary/30'
                      : 'border-orbit-border'
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-orbit-primary/15 text-orbit-primary-light flex-shrink-0">
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{table.name}</p>
                        <Badge variant={statusInfo.variant} dot>{statusInfo.label}</Badge>
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      'w-4 h-4 text-slate-600 transition-transform flex-shrink-0 mt-1',
                      selectedTable === table.id && 'rotate-90'
                    )} />
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <RowsIcon className="w-3.5 h-3.5" />
                      <span>{table.rows.toLocaleString()} 行</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Columns className="w-3.5 h-3.5" />
                      <span>{table.columns} 列</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-600">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>{table.updatedAt}</span>
                  </div>
                </motion.button>
              )
            })}
          </motion.div>

          {filteredTables.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Database className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">没有匹配的数据表</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <AnimateDetailPanel table={selectedData} onClose={() => setSelectedTable(null)} />
    </div>
  )
}

function AnimateDetailPanel({ table, onClose }: { table: DataTable | null; onClose: () => void }) {
  if (!table) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      key={table.id}
    >
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-orbit-primary/15">
                <Table2 className="w-4 h-4 text-orbit-primary-light" />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-200">{table.name}</span>
                <span className="text-xs text-slate-500 ml-2">
                  {table.rows.toLocaleString()} 行 · {table.columns} 列
                </span>
              </div>
            </div>
          }
          subtitle={table.updatedAt}
          actions={
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              收起
            </button>
          }
        />
        <CardBody>
          {/* Column details */}
          <div className="mb-6">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">列信息</h4>
            <div className="overflow-x-auto rounded-lg border border-orbit-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">列名</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">类型</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">可空</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columnDetails.map((col) => (
                    <tr
                      key={col.name}
                      className="border-b border-orbit-border last:border-0 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-slate-200 font-medium">{col.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn('text-xs font-mono', getTypeColor(col.type))}>{col.type}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={col.nullable ? 'warning' : 'success'}>
                          {col.nullable ? 'YES' : 'NO'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample data */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">示例数据</h4>
            <div className="overflow-x-auto rounded-lg border border-orbit-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    {table.columnDetails.slice(0, 6).map(col => (
                      <th key={col.name} className="text-left text-xs text-slate-500 font-medium px-5 py-3 whitespace-nowrap">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.sampleData.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-orbit-border last:border-0 hover:bg-white/5 transition-colors"
                    >
                      {Object.entries(row).slice(0, 6).map(([key, value]) => (
                        <td key={key} className="px-5 py-3.5 text-slate-300 text-xs whitespace-nowrap">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}