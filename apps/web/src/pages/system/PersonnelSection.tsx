import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  CheckCircle2,
  Sparkles,
  Layers,
  Plus,
  PenLine,
  Trash2,
  RefreshCw,
  Award,
  UserCheck,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/services/api'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable } from '@/components/common/useTable'

export type ActivePersonnelTab = 'anchor' | 'operator' | 'manager'

export interface PersonnelItem {
  id: number
  name?: string
  username?: string
  realName?: string
  employeeId?: string
  level?: string
  status?: number
  createdAt?: string
  [key: string]: any
}

const personnelSubTabs: { key: ActivePersonnelTab; label: string; visible: (role: string) => boolean }[] = [
  { key: 'anchor', label: '主播管理', visible: () => true },
  { key: 'operator', label: '中控管理', visible: () => true },
  { key: 'manager', label: '运营管理', visible: (r) => r === 'super_admin' },
]

export interface PersonnelSectionProps {
  userRole: string
  anchors: any[]
  operators: any[]
  managers: any[]
  onDataChange: (tab: ActivePersonnelTab, data: any[]) => void
}

export function PersonnelSection({
  userRole,
  anchors,
  operators,
  managers,
  onDataChange,
}: PersonnelSectionProps) {
  const [activeTab, setActiveTab] = useState<ActivePersonnelTab>('anchor')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPerson, setEditingPerson] = useState<PersonnelItem | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Add form state
  const [form, setForm] = useState({
    name: '',
    username: '',
    realName: '',
    employeeId: '',
    level: 'B',
  })

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    realName: '',
    employeeId: '',
    level: 'B',
    status: 1,
  })

  const plural = (t: ActivePersonnelTab) => (t === 'anchor' ? 'anchors' : t === 'operator' ? 'operators' : 'managers')
  const label = (t: ActivePersonnelTab) => (t === 'anchor' ? '主播' : t === 'operator' ? '中控' : '运营')

  // Keep a ref to the active tab for fetchData to avoid closure race conditions
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

  // useTable instance
  const table = useTable<PersonnelItem, { status: string; level: string }>({
    initialFilters: { status: 'all', level: 'all' },
    initialPageSize: 20,
    fetchData: async ({ search, filters }) => {
      const currentTab = activeTabRef.current
      let rawList: PersonnelItem[] = []

      try {
        const res = await api.get<PersonnelItem[]>(`/personnel/${plural(currentTab)}`)
        if (Array.isArray(res)) {
          rawList = res
        }
      } catch {
        // fallback to props
        rawList =
          currentTab === 'anchor' ? anchors : currentTab === 'operator' ? operators : managers
      }

      // Filter locally
      const filtered = (rawList || []).filter((item) => {
        // Status filter
        if (filters.status !== 'all') {
          const targetStatus = filters.status === 'active' ? 1 : 0
          if ((item.status ?? 1) !== targetStatus) return false
        }
        // Level filter (anchors only)
        if (currentTab === 'anchor' && filters.level !== 'all') {
          if ((item.level || 'B').toUpperCase() !== filters.level.toUpperCase()) return false
        }
        // Search filter
        if (!search) return true
        const q = search.toLowerCase()
        const name = (item.name || item.realName || item.username || '').toLowerCase()
        const empId = (item.employeeId || '').toLowerCase()
        const uname = (item.username || '').toLowerCase()
        return name.includes(q) || empId.includes(q) || uname.includes(q)
      })

      return {
        items: filtered,
        total: filtered.length,
      }
    },
  })

  // Synchronize when parent data or activeTab changes
  useEffect(() => {
    table.reload()
  }, [activeTab, anchors.length, operators.length, managers.length])

  // Overview stats
  const stats = useMemo(() => {
    const grandTotal = (anchors?.length || 0) + (operators?.length || 0) + (managers?.length || 0)
    const currentData =
      activeTab === 'anchor' ? anchors : activeTab === 'operator' ? operators : managers
    const currentTabTotal = (currentData || []).length
    const activeCount = (currentData || []).filter((p) => (p.status ?? 1) === 1).length
    const inactiveCount = (currentData || []).filter((p) => (p.status ?? 1) === 0).length

    const saCount = (anchors || []).filter(
      (a) => (a.level || '').toUpperCase() === 'S' || (a.level || '').toUpperCase() === 'A'
    ).length
    const assignedIdCount = (operators || []).filter((o) => Boolean(o.employeeId)).length

    return {
      grandTotal,
      currentTabTotal,
      activeCount,
      inactiveCount,
      saCount,
      assignedIdCount,
    }
  }, [anchors, operators, managers, activeTab])

  // Handlers
  const handleOpenAdd = () => {
    setForm({
      name: '',
      username: '',
      realName: '',
      employeeId: '',
      level: 'B',
    })
    setShowAddModal(true)
  }

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const body: any = {
        name: form.name.trim() || form.realName.trim() || form.username.trim(),
        type: activeTab,
      }
      if (activeTab === 'anchor') {
        if (!form.name.trim()) return alert('请填写主播名称')
        body.name = form.name.trim()
        body.level = form.level
      } else if (activeTab === 'operator') {
        if (!form.name.trim()) return alert('请填写中控名称')
        body.name = form.name.trim()
        body.employeeId = form.employeeId.trim()
      } else {
        if (!form.username.trim()) return alert('请填写登录用户名')
        body.username = form.username.trim()
        body.realName = form.realName.trim() || form.username.trim()
        body.name = form.realName.trim() || form.username.trim()
      }

      await api.post(`/personnel/${plural(activeTab)}`, body)
      const updated = await api.get<any[]>(`/personnel/${plural(activeTab)}`)
      if (Array.isArray(updated)) onDataChange(activeTab, updated)
      setShowAddModal(false)
      await table.reload()
    } catch (err: any) {
      alert(err?.message || `新增${label(activeTab)}失败`)
    }
  }

  const handleOpenEdit = (p: PersonnelItem) => {
    setEditingPerson(p)
    setEditForm({
      name: p.name || p.realName || '',
      username: p.username || '',
      realName: p.realName || '',
      employeeId: p.employeeId || '',
      level: p.level || 'B',
      status: p.status ?? 1,
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPerson) return
    try {
      const body: any = {
        name: editForm.name.trim(),
        status: editForm.status,
      }
      if (activeTab === 'anchor') {
        body.level = editForm.level
      } else if (activeTab === 'operator') {
        body.employeeId = editForm.employeeId.trim()
      } else {
        body.username = editForm.username.trim() || editForm.name.trim()
        body.realName = editForm.realName.trim() || editForm.name.trim()
      }

      await api.put(`/personnel/${plural(activeTab)}/${editingPerson.id}`, body)
      const updated = await api.get<any[]>(`/personnel/${plural(activeTab)}`)
      if (Array.isArray(updated)) onDataChange(activeTab, updated)
      setShowEditModal(false)
      setEditingPerson(null)
      await table.reload()
    } catch (err: any) {
      alert(err?.message || `保存${label(activeTab)}失败`)
    }
  }

  const handleDelete = async () => {
    if (deletingId === null) return
    try {
      await api.delete(`/personnel/${plural(activeTab)}/${deletingId}`)
      const updated = await api.get<any[]>(`/personnel/${plural(activeTab)}`)
      if (Array.isArray(updated)) onDataChange(activeTab, updated)
      setDeletingId(null)
      await table.reload()
    } catch (err: any) {
      alert(err?.message || `删除${label(activeTab)}失败`)
    }
  }

  // Level Badge
  const renderLevelBadge = (level: string = 'B') => {
    const norm = (level || 'B').toUpperCase()
    switch (norm) {
      case 'S':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orbit-primary/15 text-orbit-primary border border-orbit-primary/30">
            S 级金牌
          </span>
        )
      case 'A':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            A 级核心
          </span>
        )
      case 'B':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orbit-info/15 text-orbit-info border border-orbit-info/30">
            B 级骨干
          </span>
        )
      case 'C':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal bg-amber-500/15 text-amber-400 border border-amber-500/30">
            C 级成长
          </span>
        )
      case 'D':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal bg-[var(--surface3)] text-[var(--text-muted)] border border-orbit-border/30">
            D 级储备
          </span>
        )
      default:
        return <Badge variant="neutral">{norm} 级</Badge>
    }
  }

  // Status Badge
  const renderStatusBadge = (status: number = 1) => {
    const isActive = status === 1
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isActive
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-[var(--surface3)] text-[var(--text-muted)] border border-orbit-border/20'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isActive
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
              : 'bg-[var(--text-subtle)]'
          }`}
        />
        {isActive ? '启用生效' : '已禁用'}
      </span>
    )
  }

  // Table Columns
  const columns = useMemo<ColumnDef<PersonnelItem>[]>(() => {
    const cols: ColumnDef<PersonnelItem>[] = [
      {
        key: 'id',
        header: 'ID',
        width: 70,
        render: (_, p) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">#{p.id}</span>
        ),
      },
    ]

    if (activeTab === 'anchor') {
      cols.push(
        {
          key: 'name',
          header: '主播姓名',
          render: (_, p) => (
            <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              {p.name}
            </span>
          ),
        },
        {
          key: 'level',
          header: '评级档位',
          render: (_, p) => renderLevelBadge(p.level),
        }
      )
    } else if (activeTab === 'operator') {
      cols.push(
        {
          key: 'name',
          header: '中控姓名',
          render: (_, p) => (
            <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              {p.name}
            </span>
          ),
        },
        {
          key: 'employeeId',
          header: '工号',
          render: (_, p) => (
            <span className="font-mono text-xs text-orbit-snow/80 bg-orbit-ink/80 px-2 py-0.5 rounded border border-[var(--border)]">
              {p.employeeId || '-'}
            </span>
          ),
        }
      )
    } else {
      cols.push(
        {
          key: 'username',
          header: '登录用户名',
          render: (_, p) => (
            <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-orbit-primary" />
              {p.username || p.name || '-'}
            </span>
          ),
        },
        {
          key: 'realName',
          header: '真实姓名',
          render: (_, p) => (
            <span className="text-[var(--text-secondary)]">{p.realName || p.name || '-'}</span>
          ),
        }
      )
    }

    cols.push(
      {
        key: 'status',
        header: '在职状态',
        width: 120,
        render: (_, p) => renderStatusBadge(p.status ?? 1),
      },
      {
        key: 'createdAt',
        header: '登记时间',
        render: (_, p) => (
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {p.createdAt ? String(p.createdAt).slice(0, 16).replace('T', ' ') : '-'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '操作',
        width: 150,
        render: (_, p) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-orbit-primary hover:text-orbit-primary-light"
              onClick={() => handleOpenEdit(p)}
            >
              <PenLine className="w-3 h-3 mr-1" />
              编辑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              onClick={() => setDeletingId(p.id)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              删除
            </Button>
          </div>
        ),
      }
    )

    return cols
  }, [activeTab])

  // CSV Export configuration
  const csvHeaders = useMemo(() => {
    if (activeTab === 'anchor') {
      return [
        { key: 'id', label: 'ID' },
        { key: 'name', label: '主播姓名' },
        { key: 'level', label: '评级档位' },
        { key: 'status', label: '在职状态' },
        { key: 'createdAt', label: '登记时间' },
      ]
    }
    if (activeTab === 'operator') {
      return [
        { key: 'id', label: 'ID' },
        { key: 'name', label: '中控姓名' },
        { key: 'employeeId', label: '工号' },
        { key: 'status', label: '在职状态' },
        { key: 'createdAt', label: '登记时间' },
      ]
    }
    return [
      { key: 'id', label: 'ID' },
      { key: 'username', label: '登录用户名' },
      { key: 'realName', label: '真实姓名' },
      { key: 'status', label: '在职状态' },
      { key: 'createdAt', label: '登记时间' },
    ]
  }, [activeTab])

  const visibleTabs = personnelSubTabs.filter((t) => t.visible(userRole))

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-orbit-surface/70 backdrop-blur-sm border-orbit-border">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">在册人员总数</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.grandTotal} 人</p>
              </div>
              <div className="p-2.5 rounded-xl bg-orbit-primary/10 border border-orbit-primary/20 text-orbit-primary">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              主播 {anchors.length} · 中控 {operators.length} · 运营 {managers.length}
            </p>
          </CardBody>
        </Card>

        <Card className="bg-orbit-surface/70 backdrop-blur-sm border-orbit-border">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">当前在职生效</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.activeCount} 人</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              禁用 {stats.inactiveCount} 人 · 在职率{' '}
              {stats.currentTabTotal > 0
                ? ((stats.activeCount / stats.currentTabTotal) * 100).toFixed(0)
                : 100}
              %
            </p>
          </CardBody>
        </Card>

        <Card className="bg-orbit-surface/70 backdrop-blur-sm border-orbit-border">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  {activeTab === 'anchor'
                    ? '核心梯队储备'
                    : activeTab === 'operator'
                    ? '工号分配覆盖'
                    : '管理席位配置'}
                </p>
                <p className="text-2xl font-bold text-amber-400 mt-1">
                  {activeTab === 'anchor'
                    ? `${stats.saCount} 位`
                    : activeTab === 'operator'
                    ? `${stats.assignedIdCount} 人`
                    : `${managers.length} 席`}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {activeTab === 'anchor'
                ? 'S/A 级金牌及骨干主播阵容'
                : activeTab === 'operator'
                ? '已录入标准工号的现场中控'
                : '具备超级管理与业务运营权限'}
            </p>
          </CardBody>
        </Card>

        <Card className="bg-orbit-surface/70 backdrop-blur-sm border-orbit-border">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">当前视图筛选</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{table.total} 人</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface3)] border border-[var(--border)] text-[var(--text-secondary)]">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              第 {table.page} / {table.totalPages} 页 · 每页 {table.pageSize} 行
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Main Table Card via DataPage */}
      <Card className="border-orbit-border bg-orbit-surface">
        <CardBody className="p-5">
          {/* Sub-Tabs Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-orbit-border">
            <div className="flex items-center gap-2">
              {visibleTabs.map((sub) => {
                const count =
                  sub.key === 'anchor'
                    ? anchors.length
                    : sub.key === 'operator'
                    ? operators.length
                    : managers.length
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(sub.key)
                      table.clearSelection()
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      activeTab === sub.key
                        ? 'bg-orbit-primary/20 text-orbit-primary-light border border-orbit-primary/40 shadow-sm'
                        : 'text-[var(--text-muted)] bg-orbit-surface2/60 border border-orbit-border hover:text-[var(--text-primary)] hover:bg-orbit-surface2'
                    }`}
                  >
                    <span>{sub.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        activeTab === sub.key
                          ? 'bg-orbit-primary/30 text-orbit-primary-light'
                          : 'bg-[var(--surface3)] text-[var(--text-muted)]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.exportCsv(`人员列表_${label(activeTab)}_${new Date().toISOString().slice(0, 10)}.csv`, csvHeaders)}
                disabled={table.total === 0}
              >
                导出 CSV
              </Button>
              <Button size="sm" variant="primary" onClick={handleOpenAdd}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                新增{label(activeTab)}
              </Button>
            </div>
          </div>

          {/* Standardized DataPage */}
          <DataPage<PersonnelItem>
            title=""
            table={table}
            columns={columns}
            searchPlaceholder={`搜索${label(activeTab)}名称/工号/用户名...`}
            emptyMessage={`暂无${label(activeTab)}数据`}
            filterControls={
              <div className="flex items-center gap-2">
                <select
                  value={table.filters.status}
                  onChange={(e) => table.setFilter('status', e.target.value)}
                  className="h-9 px-3 text-xs rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                >
                  <option value="all">全部在职状态</option>
                  <option value="active">启用生效</option>
                  <option value="inactive">已禁用</option>
                </select>

                {activeTab === 'anchor' && (
                  <select
                    value={table.filters.level}
                    onChange={(e) => table.setFilter('level', e.target.value)}
                    className="h-9 px-3 text-xs rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                  >
                    <option value="all">全部主播评级</option>
                    <option value="S">S级 金牌</option>
                    <option value="A">A级 核心</option>
                    <option value="B">B级 骨干</option>
                    <option value="C">C级 成长</option>
                    <option value="D">D级 储备</option>
                  </select>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => table.reload()}
                  disabled={table.loading}
                  title="刷新表格"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${table.loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            }
          />
        </CardBody>
      </Card>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-orbit-border flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">新增{label(activeTab)}</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAdd} className="p-6 space-y-4">
                {activeTab === 'anchor' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                        主播姓名 <span className="text-rose-400">*</span>
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary"
                        placeholder="例如：陈主播 / 小雅"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                        主播评级档位
                      </label>
                      <select
                        value={form.level}
                        onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                        className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                      >
                        <option value="S">S级 (金牌核心)</option>
                        <option value="A">A级 (核心主力)</option>
                        <option value="B">B级 (常规骨干)</option>
                        <option value="C">C级 (新星成长)</option>
                        <option value="D">D级 (日常储备)</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === 'operator' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                        中控姓名 <span className="text-rose-400">*</span>
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary"
                        placeholder="例如：李中控"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                        工号标识
                      </label>
                      <input
                        value={form.employeeId}
                        onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))}
                        className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary"
                        placeholder="例如：OP-8801"
                      />
                    </div>
                  </>
                )}

                {activeTab === 'manager' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                        登录用户名 <span className="text-rose-400">*</span>
                      </label>
                      <input
                        value={form.username}
                        onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                        className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary"
                        placeholder="例如：ops_zhang"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                        真实姓名
                      </label>
                      <input
                        value={form.realName}
                        onChange={(e) => setForm((p) => ({ ...p, realName: e.target.value }))}
                        className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary"
                        placeholder="例如：张运营"
                      />
                    </div>
                  </>
                )}

                <div className="pt-4 border-t border-orbit-border flex items-center justify-end gap-3">
                  <Button variant="ghost" type="button" onClick={() => setShowAddModal(false)}>
                    取消
                  </Button>
                  <Button variant="primary" type="submit">
                    确认创建
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editingPerson && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-orbit-border flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">编辑{label(activeTab)}</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    {activeTab === 'manager' ? '登录用户名' : '姓名'}
                  </label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                    required
                  />
                </div>

                {activeTab === 'anchor' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                      主播评级档位
                    </label>
                    <select
                      value={editForm.level}
                      onChange={(e) => setEditForm((p) => ({ ...p, level: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                    >
                      <option value="S">S级 (金牌核心)</option>
                      <option value="A">A级 (核心主力)</option>
                      <option value="B">B级 (常规骨干)</option>
                      <option value="C">C级 (新星成长)</option>
                      <option value="D">D级 (日常储备)</option>
                    </select>
                  </div>
                )}

                {activeTab === 'operator' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">工号</label>
                    <input
                      value={editForm.employeeId}
                      onChange={(e) => setEditForm((p) => ({ ...p, employeeId: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                    />
                  </div>
                )}

                {activeTab === 'manager' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">真实姓名</label>
                    <input
                      value={editForm.realName}
                      onChange={(e) => setEditForm((p) => ({ ...p, realName: e.target.value }))}
                      className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">在职状态</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, status: parseInt(e.target.value, 10) }))
                    }
                    className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-sm text-[var(--text-secondary)] outline-none focus:border-orbit-primary"
                  >
                    <option value={1}>启用生效</option>
                    <option value={0}>停用/已禁用</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-orbit-border flex items-center justify-end gap-3">
                  <Button variant="ghost" type="button" onClick={() => setShowEditModal(false)}>
                    取消
                  </Button>
                  <Button variant="primary" type="submit">
                    保存修改
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId !== null && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeletingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">确认移除该{label(activeTab)}？</h3>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                移除后该人员将不再展示于当前列表中。历史关联的出勤登记与排班明细将永久保留，不受影响。
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={() => setDeletingId(null)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  确认删除
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
