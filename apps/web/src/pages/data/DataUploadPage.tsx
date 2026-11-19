import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Upload, FileText, X, Download, Trash2, Eye, CheckCircle, AlertTriangle,
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

interface UploadRecord {
  id: string
  fileName: string
  fileSize: string
  fileType: string
  uploadTime: string
  status: 'success' | 'processing' | 'failed'
  errorMessage?: string
}

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  success: { variant: 'success', label: '成功' },
  completed: { variant: 'success', label: '已完成' },
  processing: { variant: 'warning', label: '处理中' },
  pending: { variant: 'warning', label: '待处理' },
  failed: { variant: 'danger', label: '失败' },
}

const allowedFormats = ['CSV', 'Excel (.xlsx / .xls)']

const dataTypeOptions = [
  { value: 'auto', label: '自动识别（主播分析 / 渠道分析 / CSV）' },
  { value: 'anchor_analysis', label: '主播分析（抖音日报 XLSX）' },
  { value: 'channel_analysis', label: '渠道分析（抖音日报 XLSX）' },
  { value: 'live_sessions', label: '直播场次数据（CSV）' },
  { value: 'full_session', label: '整场数据（直播间详情页 XLSX）' },
]

interface ValidationIssue {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

interface PreviewData {
  detectedType: string | null
  businessDate: string | null
  totalRows: number
  validRows: number
  issues: ValidationIssue[]
  previewRows: Record<string, unknown>[]
  sessionsForDate?: { id: number; title: string; anchor_name: string }[]
  availableRooms?: { id: number; name: string }[]
  anchorsMissingRooms?: string[]
  isFullSession?: boolean
  sheetNames?: string[]
  unmatchedAnchors?: string[]
  allAnchors?: { id: number; name: string }[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const typeLabelMap: Record<string, string> = {
  anchor_analysis: '主播分析',
  channel_analysis: '渠道分析',
  csv_live_sessions: '直播场次 CSV',
}

export function DataUploadPage() {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [dataType, setDataType] = useState('auto')
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([])
  const [deletingRecord, setDeletingRecord] = useState<UploadRecord | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)

  // Preview state
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [roomAssignments, setRoomAssignments] = useState<Record<string, number>>({})
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [uploadBusinessDate, setUploadBusinessDate] = useState('')
  const [anchorMappings, setAnchorMappings] = useState<Record<string, number | 'create'>>({})

  const fetchHistory = useCallback(() => {
    api.get<any>('/api/data/uploads')
      .then(res => {
        const list = Array.isArray(res) ? res : res?.data ?? []
        setUploadHistory(list.map((item: any) => ({
          id: String(item.id),
          fileName: item.file_name ?? item.filename ?? '',
          fileSize: item.file_size ?? formatFileSize(item.file_size_bytes ?? 0),
          fileType: item.file_type ?? '',
          uploadTime: item.upload_time ?? item.created_at ?? '',
          status: item.status ?? 'success',
          errorMessage: item.error_message ?? undefined,
        })))
      })
      .catch(() => { /* 静默处理 */ })
  }, [])

  const handleDownload = useCallback((record: UploadRecord) => {
    window.open(`/api/data/uploads/${record.id}/download`, '_blank')
  }, [])

  const handleDeleteUploadConfirm = useCallback(async () => {
    if (!deletingRecord) return
    try {
      await api.delete(`/api/data/uploads/${deletingRecord.id}`)
      setUploadHistory(prev => prev.filter(r => r.id !== deletingRecord.id))
      setDeletingRecord(null)
    } catch {
      alert('删除失败')
      setDeletingRecord(null)
    }
  }, [deletingRecord])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setUploadedFile(file)
      setPreview(null)
      setPreviewFile(null)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setPreview(null)
      setPreviewFile(null)
    }
  }, [])

  const handlePreview = useCallback(async () => {
    if (!uploadedFile) return
    setIsPreviewing(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)

      const res = await fetch('/api/data/upload-preview', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const result = await res.json()
      if (result.success) {
        const data = result.data ?? result
        setPreview(data)
        setPreviewFile(uploadedFile)
        setSessionId(null)
        setRoomAssignments({})
        // 初始化不匹配主播的映射：默认设为"创建新主播"
        if (data.unmatchedAnchors && data.unmatchedAnchors.length > 0) {
          const initial: Record<string, number | 'create'> = {}
          data.unmatchedAnchors.forEach((name: string) => { initial[name] = 'create' })
          setAnchorMappings(initial)
        } else {
          setAnchorMappings({})
        }
        if (data.businessDate) {
          setUploadBusinessDate(data.businessDate)
        }
      } else {
        alert('预览失败：' + (result.message || '未知错误'))
      }
    } catch (err) {
      console.error('预览失败', err)
      alert('预览失败，请检查后端服务')
    } finally {
      setIsPreviewing(false)
    }
  }, [uploadedFile])

  const handleUpload = useCallback(async () => {
    if (!uploadedFile) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      const effectiveType = dataType !== 'auto' ? dataType : ''
      if (effectiveType) {
        formData.append('target_table', effectiveType)
      }
      if (sessionId) {
        formData.append('session_id', String(sessionId))
      }
      if (Object.keys(roomAssignments).length > 0) {
        formData.append('room_assignments', JSON.stringify(roomAssignments))
      }
      if (uploadBusinessDate) {
        formData.append('business_date', uploadBusinessDate)
      }
      if (selectedRoomId) {
        formData.append('room_id', String(selectedRoomId))
      }
      if (Object.keys(anchorMappings).length > 0) {
        formData.append('anchor_mappings', JSON.stringify(anchorMappings))
      }

      const res = await fetch('/api/data/uploads', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const result = await res.json()
      if (result.success) {
        fetchHistory()
        setPreview(null)
        setPreviewFile(null)
        setUploadedFile(null)
        if (inputRef.current) inputRef.current.value = ''
      } else {
        alert('上传失败：' + (result.message || '未知错误'))
      }
    } catch (err) {
      console.error('上传失败', err)
      alert('上传失败，请检查后端服务')
    } finally {
      setIsUploading(false)
    }
  }, [uploadedFile, dataType, sessionId, roomAssignments, selectedRoomId, uploadBusinessDate, anchorMappings, fetchHistory])

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null)
    setPreview(null)
    setPreviewFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">数据上传</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">数据文件上传与导入</p>
          </div>
        </div>
      </motion.div>

      {/* Upload zone */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardBody>
            {/* Data type selector */}
            <div className="mb-4 flex items-center gap-3">
              <label className="text-xs text-[var(--text-muted)]">数据类型：</label>
              <select
                value={dataType}
                onChange={e => setDataType(e.target.value)}
                className="text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 text-[var(--text-secondary)] outline-none"
              >
                {dataTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-orbit-surface">{opt.label}</option>
                ))}
              </select>
            </div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'relative flex flex-col items-center justify-center py-16 px-6 rounded-xl border-2 border-dashed transition-all cursor-pointer',
                isDragOver
                  ? 'border-orbit-primary bg-orbit-primary/5'
                  : uploadedFile
                    ? 'border-orbit-accent/50 bg-orbit-accent/5'
                    : 'border-orbit-border hover:border-orbit-border2 hover:bg-white/3'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!uploadedFile ? (
                <>
                  <div className={cn(
                    'p-4 rounded-2xl mb-4 transition-colors',
                    isDragOver ? 'bg-orbit-primary/20' : 'bg-orbit-surface3'
                  )}>
                    <Upload className={cn(
                      'w-10 h-10 transition-colors',
                      isDragOver ? 'text-orbit-primary-light' : 'text-[var(--text-muted)]'
                    )} />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-2">
                    {isDragOver ? '释放文件以上传' : '拖拽文件到此处，或点击上传'}
                  </p>
                  <p className="text-xs text-[var(--text-primary)]">
                    支持 CSV、Excel (.xlsx/.xls) 格式
                  </p>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-2xl bg-orbit-accent/15 mb-4">
                    <FileText className="w-8 h-8 text-orbit-accent-light" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{uploadedFile.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mb-4">
                    {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  <div className="flex items-center gap-3">
                    {!preview && (
                      <Button
                        size="sm"
                        loading={isPreviewing}
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handlePreview() }}
                        icon={<Eye className="w-3.5 h-3.5" />}
                      >
                        预览
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRemoveFile() }}
                      icon={<X className="w-3.5 h-3.5" />}
                    >
                      移除
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* File format hints */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--text-primary)]">
              <span className="font-medium text-[var(--text-muted)]">支持格式：</span>
              {allowedFormats.map(fmt => (
                <span key={fmt} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orbit-surface3">
                  <FileText className="w-3 h-3" />
                  {fmt}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Preview section */}
      {preview && previewFile && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card>
            <CardHeader
              title="数据预览"
              subtitle={
                (typeLabelMap[preview.detectedType ?? ''] ?? preview.detectedType ?? '未知类型')
                + (preview.businessDate ? ` · ${preview.businessDate}` : '')
              }
            />
            <CardBody>
              {/* Validation summary */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <FileText className="w-4 h-4" />
                  <span>共 <strong className="text-[var(--text-secondary)]">{preview.totalRows}</strong> 行</span>
                </div>
                <div className="flex items-center gap-1.5 text-status-success">
                  <CheckCircle className="w-4 h-4" />
                  <span>有效 <strong>{preview.validRows}</strong> 行</span>
                </div>
                {preview.issues.filter(i => i.severity === 'error').length > 0 && (
                  <div className="flex items-center gap-1.5 text-status-danger">
                    <AlertTriangle className="w-4 h-4" />
                    <span>错误 <strong>{preview.issues.filter(i => i.severity === 'error').length}</strong> 项</span>
                  </div>
                )}
                {preview.issues.filter(i => i.severity === 'warning').length > 0 && (
                  <div className="flex items-center gap-1.5 text-status-warning">
                    <AlertTriangle className="w-4 h-4" />
                    <span>警告 <strong>{preview.issues.filter(i => i.severity === 'warning').length}</strong> 项</span>
                  </div>
                )}
              </div>

              {/* Validation issues */}
              {preview.issues.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-orbit-surface2 border border-orbit-border">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-2">校验问题：</p>
                  <ul className="space-y-1">
                    {preview.issues.slice(0, 10).map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className={cn(
                          'shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full',
                          issue.severity === 'error' ? 'bg-orbit-danger' : 'bg-orbit-warning'
                        )} />
                        <span className="text-[var(--text-muted)]">
                          第 {issue.row} 行 · <strong className="text-[var(--text-muted)]">{issue.field}</strong> — {issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Channel analysis: date + session selector */}
              {preview.detectedType === 'channel_analysis' && (
                <div className="mb-4 p-4 rounded-lg bg-orbit-surface2 border border-orbit-border">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-3">渠道分析导入设置：</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-[var(--text-muted)] w-24">业务日期：</label>
                      <input
                        type="date"
                        value={uploadBusinessDate || preview.businessDate || ''}
                        onChange={e => setUploadBusinessDate(e.target.value)}
                        className="text-xs bg-orbit-surface border border-orbit-border rounded-lg px-3 py-1.5 text-[var(--text-secondary)] outline-none"
                      />
                      {!preview.businessDate && (
                        <span className="text-xs text-status-warning">未能从文件名识别日期，请手动选择</span>
                      )}
                    </div>
                    {preview.sessionsForDate && preview.sessionsForDate.length > 0 && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-[var(--text-muted)] w-24">关联场次（可选）：</label>
                        <select
                          value={sessionId ?? ''}
                          onChange={e => setSessionId(e.target.value ? Number(e.target.value) : null)}
                          className="text-xs bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 text-[var(--text-secondary)] outline-none"
                        >
                          <option value="" className="bg-orbit-surface">不关联（仅渠道分析）</option>
                          {preview.sessionsForDate.map(s => (
                            <option key={s.id} value={s.id} className="bg-orbit-surface">
                              {s.title || `场次 #${s.id}`} ({s.anchor_name})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Room assignment for anchors without rooms */}
              {preview.anchorsMissingRooms && preview.anchorsMissingRooms.length > 0 && preview.availableRooms && preview.availableRooms.length > 0 && (
                <div className="mb-4 p-4 rounded-lg bg-orbit-surface2 border border-orbit-border">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-3">以下主播缺少关联直播间，请选择直播间：</p>
                  <div className="space-y-2">
                    {preview.anchorsMissingRooms.map(name => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-secondary)] w-20 shrink-0">{name}</span>
                        <select
                          value={roomAssignments[name] ?? ''}
                          onChange={e => setRoomAssignments(prev => ({ ...prev, [name]: Number(e.target.value) }))}
                          className="flex-1 text-xs bg-orbit-surface border border-orbit-border rounded-lg px-3 py-1.5 text-[var(--text-secondary)] outline-none"
                        >
                          <option value="" className="bg-orbit-surface">请选择直播间</option>
                          {preview.availableRooms?.map(room => (
                            <option key={room.id} value={room.id} className="bg-orbit-surface">
                              {room.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched anchors: let user create or map */}
              {preview.unmatchedAnchors && preview.unmatchedAnchors.length > 0 && (
                <div className="mb-4 p-4 rounded-lg bg-orbit-surface2 border border-orbit-warning/30">
                  <p className="text-xs font-medium text-status-warning mb-3">
                    ⚠️ 以下主播在系统中未找到，请选择「创建新主播」或匹配到已有主播：
                  </p>
                  <div className="space-y-3">
                    {preview.unmatchedAnchors.map(name => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-secondary)] w-20 shrink-0 font-medium">{name}</span>
                        <select
                          value={anchorMappings[name] === 'create' ? 'create' : String(anchorMappings[name])}
                          onChange={e => {
                            const val = e.target.value
                            setAnchorMappings(prev => ({
                              ...prev,
                              [name]: val === 'create' ? 'create' : Number(val),
                            }))
                          }}
                          className="flex-1 text-xs bg-orbit-surface border border-orbit-border rounded-lg px-3 py-1.5 text-[var(--text-secondary)] outline-none"
                        >
                          <option value="create" className="bg-orbit-surface">✨ 创建新主播</option>
                          {preview.allAnchors?.map(a => (
                            <option key={a.id} value={a.id} className="bg-orbit-surface">
                              ↻ 匹配到: {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Session: Date + Room selection */}
              {preview.isFullSession && (
                <div className="mb-4 p-4 rounded-lg bg-orbit-surface2 border border-orbit-border">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-3">整场数据导入设置：</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-[var(--text-muted)] w-24">业务日期：</label>
                      <input
                        type="date"
                        value={uploadBusinessDate}
                        onChange={e => setUploadBusinessDate(e.target.value)}
                        className="text-xs bg-orbit-surface border border-orbit-border rounded-lg px-3 py-1.5 text-[var(--text-secondary)] outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-[var(--text-muted)] w-24">选择直播间：</label>
                      <select
                        value={selectedRoomId ?? ''}
                        onChange={e => setSelectedRoomId(e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 text-xs bg-orbit-surface border border-orbit-border rounded-lg px-3 py-1.5 text-[var(--text-secondary)] outline-none"
                      >
                        <option value="" className="bg-orbit-surface">请选择直播间</option>
                        {preview.availableRooms?.map(room => (
                          <option key={room.id} value={room.id} className="bg-orbit-surface">
                            {room.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {preview.sheetNames && preview.sheetNames.length > 0 && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-[var(--text-muted)] w-24">识别到工作表：</label>
                        <div className="flex flex-wrap gap-1.5">
                          {preview.sheetNames.map(name => (
                            <span key={name} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orbit-surface3 text-[var(--text-muted)] border border-orbit-border">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto border border-orbit-border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-orbit-surface2 border-b border-orbit-border">
                      {preview.previewRows.length > 0 && Object.keys(preview.previewRows[0]).map((key) => (
                        <th key={key} className="text-left px-3 py-2 text-[var(--text-muted)] font-medium whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, ri) => (
                      <tr key={ri} className="border-b border-orbit-border/50 hover:bg-[var(--hover-bg)]">
                        {Object.values(row).map((val, ci) => (
                          <td key={ci} className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-48" title={String(val)}>
                            {String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.totalRows > preview.previewRows.length && (
                <p className="text-xs text-[var(--text-primary)] mt-2">
                  仅显示前 {preview.previewRows.length} 行，共 {preview.totalRows} 行
                </p>
              )}

              {/* Confirm upload */}
              <div className="mt-4 flex items-center justify-end gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); setPreview(null); setPreviewFile(null) }}
                  icon={<X className="w-3.5 h-3.5" />}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  loading={isUploading}
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleUpload() }}
                  icon={<Upload className="w-3.5 h-3.5" />}
                >
                  确认导入
                </Button>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Upload history */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader title="上传历史记录" subtitle="最近的文件上传记录" />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orbit-border">
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">文件名</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">大小</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">类型</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">上传时间</th>
                    <th className="text-left text-xs text-[var(--text-muted)] font-medium px-5 py-3">状态</th>
                    <th className="text-right text-xs text-[var(--text-muted)] font-medium px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadHistory.map((record, i) => {
                    const statusInfo = statusConfig[record.status] ?? statusConfig.success
                    return (
                      <motion.tr
                        key={record.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.35, delay: i * 0.03 }}
                        className="border-b border-orbit-border hover:bg-[var(--hover-bg)] transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0" />
                            <span className="text-[var(--text-secondary)] font-medium truncate max-w-64">
                              {record.fileName}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-muted)]">{record.fileSize}</td>
                        <td className="px-5 py-3.5">{record.fileType}</td>
                        <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{record.uploadTime}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            <Badge variant={statusInfo.variant} dot>
                              {statusInfo.label}
                            </Badge>
                            {record.status === 'failed' && record.errorMessage && (
                              <span className="text-[11px] text-status-danger/80 max-w-48 leading-tight" title={record.errorMessage}>
                                {record.errorMessage.length > 40
                                  ? record.errorMessage.slice(0, 40) + '…'
                                  : record.errorMessage}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleDownload(record)} className="p-1.5 text-[var(--text-primary)] hover:text-status-ai transition-colors rounded-lg hover:bg-[var(--hover-bg)]">
                              <Download className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeletingRecord(record)} className="p-1.5 text-[var(--text-primary)] hover:text-orbit-danger transition-colors rounded-lg hover:bg-[var(--hover-bg)]">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {uploadHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Upload className="w-12 h-12 text-[var(--text-primary)] mb-3" />
                <p className="text-sm text-[var(--text-muted)]">暂无上传记录</p>
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {deletingRecord !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeletingRecord(null)}>
          <div className="bg-orbit-surface border border-orbit-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-2">确认删除</h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">确定要删除上传记录「{deletingRecord.fileName}」吗？此操作不可撤销。</p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeletingRecord(null)}>取消</Button>
              <Button variant="destructive" onClick={handleDeleteUploadConfirm}>确认删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}