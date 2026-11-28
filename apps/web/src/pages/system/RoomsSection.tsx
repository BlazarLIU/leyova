import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio,
  Plus,
  PenLine,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  X,
  Layers,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'
import { usePlatform } from '@/hooks/usePlatform'
import type { LiveRoom } from '@/types'

interface Props {
  rooms: LiveRoom[]
  onRoomsChange: (rooms: LiveRoom[]) => void
}

const PLATFORM_CODE_TO_NAME: Record<string, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  wechat: '视频号',
}

export function RoomsSection({ rooms, onRoomsChange }: Props) {
  const { currentPlatform } = usePlatform()
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<LiveRoom | null>(null)
  const [form, setForm] = useState({
    name: '',
    platform: (currentPlatform?.platform_code && PLATFORM_CODE_TO_NAME[currentPlatform.platform_code]) || '抖音',
    status: 'active',
  })
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // 监听顶栏平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      const platName = PLATFORM_CODE_TO_NAME[currentPlatform.platform_code]
      if (platName) {
        setForm((prev) => ({ ...prev, platform: platName }))
      }
    }
  }, [currentPlatform?.platform_code])

  const table = useTable<LiveRoom, { platform: string; status: string }>({
    initialFilters: { platform: 'all', status: 'all' },
    initialPageSize: 20,
    fetchData: async ({ search, filters }) => {
      let rawRooms = rooms
      try {
        const res = await api.get<LiveRoom[]>('/system/rooms')
        if (Array.isArray(res)) {
          rawRooms = res
        }
      } catch {
        // fallback to props
      }

      const filtered = rawRooms.filter((r) => {
        if (filters.platform !== 'all' && r.platform !== filters.platform) return false
        if (filters.status !== 'all' && r.status !== filters.status) return false
        if (!search) return true
        const q = search.toLowerCase()
        return r.name.toLowerCase().includes(q) || r.platform.toLowerCase().includes(q)
      })

      return {
        items: filtered,
        total: filtered.length,
      }
    },
  })

  const isMountedRef = React.useRef(false)
  // Synchronize only on subsequent parent updates
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    table.reload()
  }, [rooms.length])

  // Quick stats
  const stats = useMemo(() => {
    const list = table.data
    const total = table.total
    const active = list.filter((r) => r.status === 'active').length
    const inactive = list.filter((r) => r.status !== 'active').length
    const platforms = new Set(list.map((r) => r.platform)).size

    return { total, active, inactive, platforms }
  }, [table.data, table.total])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      alert('请填写直播间名称')
      return
    }
    try {
      const body = { name: form.name.trim(), platform: form.platform, status: form.status }
      if (editingRoom) {
        await api.put(`/system/rooms/${editingRoom.id}`, body)
      } else {
        await api.post<LiveRoom>('/system/rooms', body)
      }
      setShowModal(false)
      setEditingRoom(null)
      setForm({ name: '', platform: '抖音', status: 'active' })
      const updated = await api.get<LiveRoom[]>('/system/rooms')
      if (Array.isArray(updated)) onRoomsChange(updated)
      await table.reload()
    } catch (err: any) {
      alert(err?.message || '保存直播间失败')
    }
  }

  const handleDelete = async () => {
    if (deletingId === null) return
    try {
      await api.delete(`/system/rooms/${deletingId}`)
      setDeletingId(null)
      const updated = await api.get<LiveRoom[]>('/system/rooms')
      if (Array.isArray(updated)) onRoomsChange(updated)
      await table.reload()
    } catch (err: any) {
      alert(err?.message || '删除失败')
    }
  }

  const openNew = () => {
    setEditingRoom(null)
    setForm({ name: '', platform: '抖音', status: 'active' })
    setShowModal(true)
  }

  const openEdit = (r: LiveRoom) => {
    setEditingRoom(r)
    setForm({ name: r.name, platform: r.platform, status: r.status })
    setShowModal(true)
  }

  const columns: ColumnDef<LiveRoom>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'ID',
        width: 80,
        render: (_, r) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">#{r.id}</span>
        ),
      },
      {
        key: 'name',
        header: '直播间名称',
        render: (_, r) => (
          <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-orbit-primary" />
            {r.name}
          </span>
        ),
      },
      {
        key: 'platform',
        header: '归属平台',
        width: 140,
        render: (_, r) => (
          <Badge variant="info">{r.platform}</Badge>
        ),
      },
      {
        key: 'status',
        header: '运行状态',
        width: 120,
        align: 'center',
        render: (_, r) => (
          <Badge variant={r.status === 'active' ? 'success' : 'neutral'}>
            {r.status === 'active' ? '启用开播' : '停用休眠'}
          </Badge>
        ),
      },
      {
        key: 'created_at',
        header: '创建时间',
        width: 160,
        render: (_, r) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '-'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 140,
        align: 'right',
        render: (_, r) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => openEdit(r)}
              className="text-xs text-orbit-primary-light hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <PenLine className="w-3.5 h-3.5" />
              编辑
            </button>
            <button
              onClick={() => setDeletingId(r.id)}
              className="text-xs text-[var(--text-muted)] hover:text-status-danger transition-colors inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {/* 4 大指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">直播间总数</span>
              <Radio className="w-4 h-4 text-orbit-primary" />
            </div>
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">全域各平台已注册播间</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">启用开播中</span>
              <CheckCircle2 className="w-4 h-4 text-status-success" />
            </div>
            <p className="mt-1 text-2xl font-bold text-status-success">{stats.active}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">正参与排班与数据统计</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">停用休眠中</span>
              <XCircle className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
            <p className="mt-1 text-2xl font-bold text-[var(--text-muted)]">{stats.inactive}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">暂时下线或整顿播间</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">覆盖电商平台</span>
              <Layers className="w-4 h-4 text-status-info" />
            </div>
            <p className="mt-1 text-2xl font-bold text-status-info">{stats.platforms} 个</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">多平台阵列协同布局</p>
          </CardBody>
        </Card>
      </div>

      <DataPage<LiveRoom>
        title="直播间实体列表"
        subtitle="集中配置多平台直播间档案、推流渠道及运行生命周期状态"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-orbit-primary border border-orbit-border">
            DataPage + useTable
          </span>
        }
        table={table}
        columns={columns}
        searchPlaceholder="搜索直播间名称或平台..."
        exportFilename="live_rooms_config"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={openNew}
              icon={<Plus className="w-4 h-4" />}
            >
              新增直播间
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
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-muted)]">平台:</span>
              {['all', '抖音', '视频号', '快手'].map((plat) => (
                <button
                  key={plat}
                  onClick={() => table.setFilter('platform', plat)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    table.filters.platform === plat
                      ? 'bg-orbit-primary/20 text-orbit-primary border border-orbit-primary/40 font-medium'
                      : 'bg-orbit-ink hover:bg-orbit-ink/85 text-orbit-snow/70'
                  }`}
                >
                  {plat === 'all' ? '全部' : plat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[var(--text-muted)]">状态:</span>
              {[
                { value: 'all', label: '全部' },
                { value: 'active', label: '启用' },
                { value: 'inactive', label: '禁用' },
              ].map((st) => (
                <button
                  key={st.value}
                  onClick={() => table.setFilter('status', st.value)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    table.filters.status === st.value
                      ? 'bg-orbit-primary/20 text-orbit-primary border border-orbit-primary/40 font-medium'
                      : 'bg-orbit-ink hover:bg-orbit-ink/85 text-orbit-snow/70'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* 新增/编辑直播间弹窗 */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-md p-6 relative text-xs"
            >
              <div className="flex items-center justify-between pb-4 border-b border-orbit-border mb-4">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Radio className="w-5 h-5 text-orbit-primary" />
                  {editingRoom ? '编辑直播间' : '新增直播间'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-[var(--text-muted)] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-[var(--text-secondary)] font-medium mb-1">直播间名称</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary"
                    placeholder="输入直播间名称，如：抖音1号直播间"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] font-medium mb-1">归属平台</label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-xs text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                  >
                    <option value="抖音">抖音</option>
                    <option value="快手">快手</option>
                    <option value="视频号">视频号</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] font-medium mb-1">运行状态</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-xs text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                  >
                    <option value="active">启用开播</option>
                    <option value="inactive">停用禁用</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-orbit-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowModal(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    保存
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {deletingId !== null && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm p-6 text-xs"
            >
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">确认删除直播间</h3>
              <p className="text-[var(--text-muted)] mb-6 leading-relaxed">
                确定要删除该直播间吗？已关联的历史出勤与场次流水将保留，但新排班将无法选择该播间。
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)}>
                  取消
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  确认删除
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default RoomsSection
