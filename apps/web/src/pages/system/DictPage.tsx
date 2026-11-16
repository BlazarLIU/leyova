import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Plus,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  Layers,
  Hash,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'

export interface DictItem {
  id: number
  code: string
  name: string
  item_count: number
  status: string
  created_at?: string
}

export function DictPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState({ code: '', name: '' })
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const table = useTable<DictItem, { status: string }>({
    initialFilters: { status: 'all' },
    initialPageSize: 20,
    fetchData: async ({ search, filters }) => {
      const list = await api.get<DictItem[]>('/system/dict')
      const rawItems: DictItem[] = Array.isArray(list) ? list : []

      const filtered = rawItems.filter((item) => {
        if (filters.status !== 'all' && item.status !== filters.status) return false
        if (!search) return true
        const q = search.toLowerCase()
        return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
      })

      return {
        items: filtered,
        total: filtered.length,
      }
    },
  })

  // Quick stats
  const stats = useMemo(() => {
    const list = table.data
    const total = table.total
    const active = list.filter((i) => i.status === '启用').length
    const totalEntries = list.reduce((sum, i) => sum + (Number(i.item_count) || 0), 0)

    return { total, active, totalEntries }
  }, [table.data, table.total])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      alert('请完整填写编码与名称')
      return
    }
    setCreating(true)
    try {
      await api.post('/system/dict', form)
      setShowCreateModal(false)
      setForm({ code: '', name: '' })
      setMsg('字典分类已成功添加')
      await table.reload()
    } catch (e: any) {
      alert(e?.message || '添加失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确认删除字典「${name}」？此操作不可撤销。`)) return
    try {
      await api.delete(`/system/dict/${id}`)
      setMsg('字典分类已删除')
      await table.reload()
    } catch (e: any) {
      alert(e?.message || '删除失败')
    }
  }

  const columns: ColumnDef<DictItem>[] = useMemo(
    () => [
      {
        key: 'code',
        header: '分类编码',
        width: 220,
        render: (_, it) => (
          <span className="font-mono font-semibold text-cyan-400 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-slate-500" />
            {it.code}
          </span>
        ),
      },
      {
        key: 'name',
        header: '分类名称与说明',
        render: (_, it) => (
          <span className="font-medium text-slate-100">{it.name}</span>
        ),
      },
      {
        key: 'item_count',
        header: '挂接条目数',
        width: 140,
        align: 'right',
        render: (_, it) => (
          <span className="font-mono text-slate-200 tabular-nums">
            {it.item_count} 条
          </span>
        ),
      },
      {
        key: 'status',
        header: '运行状态',
        width: 120,
        align: 'center',
        render: (_, it) => (
          <Badge variant={it.status === '启用' ? 'success' : 'neutral'}>
            {it.status}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 90,
        align: 'right',
        render: (_, it) => (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleDelete(it.id, it.name)}
            title="删除字典分类"
            className="text-slate-500 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px] text-gray-100">
      {msg && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-300">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs text-cyan-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 统计指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">数据字典分类总数</span>
              <BookOpen className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-100">{stats.total}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">系统支持的基础枚举维度分类</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">生效启用分类</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.active}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">供各业务下拉字典引用的分类</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">聚合条目总数</span>
              <Layers className="w-4 h-4 text-orbit-primary-light" />
            </div>
            <p className="mt-1 text-2xl font-bold text-orbit-primary-light">{stats.totalEntries}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">已注册的子枚举项目记录数</p>
          </CardBody>
        </Card>
      </div>

      <DataPage<DictItem>
        title="数据字典管理"
        subtitle="维护系统基础枚举分类与字典条目（平台类型、渠道归属、类目代码等）"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-cyan-400 border border-orbit-border">
            DataPage + useTable
          </span>
        }
        table={table}
        columns={columns}
        searchPlaceholder="搜索字典编码或分类名称..."
        exportFilename="system_dict_categories"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              新增字典分类
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.reload()}
              loading={table.loading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              刷新
            </Button>
          </div>
        }
        filterControls={
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">状态:</span>
            {[
              { value: 'all', label: '全部' },
              { value: '启用', label: '启用' },
              { value: '停用', label: '停用' },
            ].map((st) => (
              <button
                key={st.value}
                onClick={() => table.setFilter('status', st.value)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  table.filters.status === st.value
                    ? 'bg-cyan-600 text-white font-medium'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        }
      />

      {/* 新增字典弹窗 */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
                <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-400" />
                  新增字典分类
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-300 mb-1 font-medium">分类唯一编码</label>
                  <input
                    type="text"
                    required
                    placeholder="如 channel_type 或 settlement_mode"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-1 font-medium">分类展示名称</label>
                  <input
                    type="text"
                    required
                    placeholder="如 流量渠道类型"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={creating}>
                    {creating ? '添加中...' : '确认添加'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DictPage
