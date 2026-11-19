import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, RefreshCw, Edit3, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

interface LiveRecord {
  id: string
  date: string
  anchorName: string
  roomName: string
  operatorName: string
  startTime: string
  endTime: string
  duration: number
  gmv: number
  gsv: number
  status: string
}

const statusVariant: Record<string, 'success' | 'warning' | 'info'> = {
  '已提交': 'warning',
  '已确认': 'success',
}

function formatMoney(val: number) {
  return val ? val.toLocaleString('zh-CN') : '-'
}

export function DataLivePage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<LiveRecord[]>([])
  const [rawData, setRawData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadData = () => {
    api.get<any>('/api/data/live')
      .then(res => {
        const list = Array.isArray(res) ? res : res?.data ?? []
        setRawData(list)
        setRecords(list.map((item: any) => ({
          id: item.id,
          date: item.date ?? '',
          anchorName: item.anchor_name ?? item.anchorName ?? '',
          roomName: item.room_name ?? item.roomName ?? '',
          operatorName: item.operator_name ?? item.operatorName ?? '',
          startTime: item.start_time ?? item.startTime ?? '',
          endTime: item.end_time ?? item.endTime ?? '',
          duration: item.duration_min ?? item.duration ?? 0,
          gmv: item.gmv ?? 0,
          gsv: item.gsv ?? 0,
          status: item.status ?? '已提交',
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const filtered = records.filter(r =>
    !search || r.anchorName.includes(search) || r.roomName.includes(search) || r.operatorName.includes(search) || r.date.includes(search)
  )

  const handleRefresh = () => {
    setLoading(true)
    loadData()
  }

  const handleEdit = (recordId: string) => {
    const item = rawData.find((r: any) => String(r.id) === recordId)
              || records.find(r => r.id === recordId)
    if (!item) return
    const editData = {
      id: item.id,
      date: item.date,
      anchor_id: item.anchor_id ?? item.anchorId ?? 0,
      room_id: item.room_id ?? item.roomId ?? 0,
      operator_id: item.operator_id ?? item.operatorId ?? 0,
      anchor_name: item.anchor_name ?? item.anchorName ?? '',
      room_name: item.room_name ?? item.roomName ?? '',
      operator_name: item.operator_name ?? item.operatorName ?? '',
      start_time: item.start_time ?? item.startTime ?? '',
      end_time: item.end_time ?? item.endTime ?? '',
      duration: item.duration_min ?? item.duration ?? 0,
      gmv: item.gmv ?? 0,
      return_amount: item.return_amount ?? item.returnAmount ?? 0,
      gsv: item.gsv ?? 0,
      remark: item.remark ?? '',
      ad_platform: item.ad_platform ?? item.adPlatform ?? '',
      ad_type: item.ad_type ?? item.adType ?? '',
      ad_cost: item.ad_cost ?? item.adCost ?? 0,
      ad_gsv: item.ad_gsv ?? item.adGsv ?? 0,
      ad_status: item.ad_status ?? item.adStatus ?? 1,
      nightShift: item.nightShift ?? item.night_shift ?? 0,
    }
    navigate('/live/registration', { state: { editData } })
  }

  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    try {
      await api.delete(`/api/data/live/${deletingId}`).catch(() => {})
      setRecords(prev => prev.filter(r => r.id !== deletingId))
      setRawData(prev => prev.filter((r: any) => String(r.id) !== deletingId))
    } catch {
      setRecords(prev => prev.filter(r => r.id !== deletingId))
    }
    setDeletingId(null)
  }

  const columns = [
    { key: 'date', label: '日期', align: 'left' as const },
    { key: 'anchorName', label: '主播', align: 'left' as const },
    { key: 'roomName', label: '直播间', align: 'left' as const },
    { key: 'operatorName', label: '中控', align: 'left' as const },
    { key: 'startTime', label: '时间', align: 'left' as const },
    { key: 'duration', label: '时长(分)', align: 'right' as const },
    { key: 'gmv', label: 'GMV', align: 'right' as const },
    { key: 'gsv', label: 'GSV', align: 'right' as const },
    { key: 'status', label: '状态', align: 'center' as const },
    { key: 'actions', label: '操作', align: 'center' as const },
  ]

  function renderCell(r: LiveRecord, key: string) {
    switch (key) {
      case 'date': return <span className="text-[var(--text-secondary)]">{r.date}</span>
      case 'anchorName': return <span className="text-[var(--text-secondary)] font-medium">{r.anchorName}</span>
      case 'roomName': return <span className="text-[var(--text-secondary)]">{r.roomName}</span>
      case 'operatorName': return <span className="text-[var(--text-secondary)]">{r.operatorName}</span>
      case 'startTime': return <span className="text-[var(--text-secondary)]">{r.startTime}-{r.endTime}</span>
      case 'duration': return <span className="text-[var(--text-secondary)]">{r.duration}</span>
      case 'gmv': return <span className="text-emerald-400 font-medium">{formatMoney(r.gmv)}</span>
      case 'gsv': return <span className="text-[var(--text-secondary)]">{formatMoney(r.gsv)}</span>
      case 'status': return <Badge variant={statusVariant[r.status] || 'info'}>{r.status}</Badge>
      case 'actions': return (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => handleEdit(r.id)} className="text-[var(--text-muted)] hover:text-orbit-primary-light transition-colors" title="编辑">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => setDeletingId(r.id)} className="text-[var(--text-muted)] hover:text-red-400 transition-colors" title="删除">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
      default: return null
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* 页头 */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">登记数据管理</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">管理直播登记模块提交的数据记录</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
        </div>
      </motion.div>

      {/* 搜索栏 */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="搜索主播/直播间/运营..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-orbit-surface2 border border-orbit-border text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-orbit-accent transition-colors"
          />
        </div>
      </motion.div>

      {/* 数据表格 */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text-secondary)]">直播记录</h2>
              <span className="text-xs text-[var(--text-muted)]">共 {filtered.length} 条</span>
            </div>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="text-center py-12 text-[var(--text-muted)] text-sm">加载中...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)] text-sm">暂无数据</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orbit-border text-[var(--text-muted)] text-xs uppercase tracking-wider">
                      {columns.map(col => (
                        <th key={col.key} className={`py-3 px-3 font-medium text-${col.align}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b border-orbit-border/50 hover:bg-white/5 transition-colors">
                        {columns.map(col => (
                          <td key={col.key} className={`py-3 px-3 text-${col.align}`}>
                            {renderCell(r, col.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {deletingId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingId(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-2">确认删除</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">确定要删除这条直播记录吗？此操作不可撤销。</p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingId(null)}>取消</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>确认删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}