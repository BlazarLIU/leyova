import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Save, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import type { LiveRegFormData, LiveRegistrationForm } from './types'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

const emptyFormData: LiveRegFormData = {
  anchors: [],
  rooms: [],
  operators: [],
  userRole: '',
  userRoomIds: [],
}

export function LiveRegistrationPage() {
  const location = useLocation()
  const editData = (location.state as any)?.editData
  const isEditing = !!editData

  const [formData, setFormData] = useState<LiveRegFormData>(emptyFormData)
  const [form, setForm] = useState<LiveRegistrationForm>({
    date: new Date().toISOString().split('T')[0],
    anchorId: 0,
    roomId: 0,
    operatorId: 0,
    startTime: '',
    endTime: '',
    duration: 0,
    gmv: 0,
    returnAmount: 0,
    gsv: 0,
    remark: '',
    adPlatform: '',
    adType: '',
    adCost: 0,
    adGsv: 0,
    adStatus: 1,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const isAdminOrManager = formData.userRole === 'admin' || formData.userRole === 'super_admin' || formData.userRole === 'administrator' || formData.userRole === 'manager'
  const isRoomSpecific = formData.userRole === 'room_specific'

  // Load form options (anchors, rooms, operators)
  useEffect(() => {
    api.get<LiveRegFormData>('/livereg/form-data')
      .then((res) => {
        if (res && res.anchors) {
          setFormData(res)
        }
      })
      .catch(() => {
        // keep defaults
      })
  }, [])

  // Pre-fill form when editing
  useEffect(() => {
    if (editData) {
      setForm({
        date: editData.date || new Date().toISOString().split('T')[0],
        anchorId: editData.anchor_id || 0,
        roomId: editData.room_id || 0,
        operatorId: editData.operator_id || 0,
        startTime: editData.start_time ? editData.start_time.substring(0, 5) : '',
        endTime: editData.end_time ? editData.end_time.substring(0, 5) : '',
        duration: editData.duration || 0,
        gmv: Number(editData.gmv) || 0,
        returnAmount: Number(editData.return_amount) || 0,
        gsv: Number(editData.gsv) || 0,
        remark: editData.remark || '',
        adPlatform: editData.ad_platform || '',
        adType: editData.ad_type || '',
        adCost: Number(editData.ad_cost) || 0,
        adGsv: Number(editData.ad_gsv) || 0,
        adStatus: editData.ad_status ?? 1,
      })
    }
  }, [editData])

  const updateField = (field: keyof LiveRegistrationForm, value: string | number) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }

      // Auto calculate duration
      if (field === 'startTime' || field === 'endTime') {
        if (updated.startTime && updated.endTime) {
          const start = new Date(`2000-01-01T${updated.startTime}`)
          const end = new Date(`2000-01-01T${updated.endTime}`)
          if (end < start) {
            end.setDate(end.getDate() + 1) // cross-day support
          }
          updated.duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
        }
      }

      // Auto calculate GSV
      if (field === 'gmv' || field === 'returnAmount') {
        updated.gsv = Math.max(0, (updated.gmv || 0) - (updated.returnAmount || 0))
      }

      return updated
    })

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!form.date) errs.date = '请选择直播日期'
    if (!form.anchorId) errs.anchorId = '请选择主播'
    if (!form.roomId) errs.roomId = '请选择直播间'
    if (!form.operatorId) errs.operatorId = '请选择中控'
    if (!form.startTime) errs.startTime = '请输入开始时间'
    if (!form.endTime) errs.endTime = '请输入结束时间'
    if (form.gmv < 0) errs.gmv = 'GMV不能为负数'
    if (form.returnAmount < 0) errs.returnAmount = '退货金额不能为负数'
    if (form.returnAmount > form.gmv) errs.returnAmount = '退货金额不能大于GMV'

    if (isAdminOrManager) {
      if (form.adCost! < 0) errs.adCost = '投流费用不能为负数'
      if (form.adGsv! < 0) errs.adGsv = '净成交GSV不能为负数'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setSubmitting(true)
    setSuccessMsg('')

    try {
      if (isEditing && editData?.id) {
        await api.put(`/api/data/live/${editData.id}`, form)
        setSuccessMsg('数据更新成功！')
      } else {
        await api.post('/livereg/submit', form)
        setSuccessMsg('数据保存成功！')
      }
      // Reset form
      setForm({
        date: new Date().toISOString().split('T')[0],
        anchorId: 0,
        roomId: 0,
        operatorId: 0,
        startTime: '',
        endTime: '',
        duration: 0,
        gmv: 0,
        returnAmount: 0,
        gsv: 0,
        remark: '',
        adPlatform: '',
        adType: '',
        adCost: 0,
        adGsv: 0,
        adStatus: 1,
      })
    } catch (err) {
      // 透出后端具体报错（如重复登记的 409 提示），无报错信息时保留兜底文案
      const msg = err instanceof Error && err.message ? err.message : '保存失败，请重试'
      setErrors({ general: msg })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredRooms = isRoomSpecific && formData.userRoomIds
    ? formData.rooms.filter((r) => formData.userRoomIds!.includes(r.id))
    : formData.rooms

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1200px]">
      {/* Page header */}
      <motion.div {...fadeIn}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{isEditing ? '编辑直播登记' : '直播登记'}</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">{isEditing ? '修改已提交的直播数据' : '录入直播数据和投流数据'}</p>
          </div>
        </div>
      </motion.div>

      {/* Success message */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm"
        >
          {successMsg}
        </motion.div>
      )}

      {/* General error */}
      {errors.general && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {errors.general}
        </div>
      )}

      {/* Live data form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader title="直播数据" subtitle="填写直播场次基本信息" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  直播日期 <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className={`w-full h-9 px-3 text-sm rounded-lg border ${
                    errors.date ? 'border-red-500' : 'border-orbit-border'
                  } bg-orbit-surface2 text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary/50 transition-colors`}
                />
                {errors.date && <p className="text-red-400 text-[11px] mt-0.5">{errors.date}</p>}
              </div>

              {/* Anchor */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  主播 <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.anchorId}
                  onChange={(e) => updateField('anchorId', Number(e.target.value))}
                  className={`w-full h-9 px-3 text-sm rounded-lg border ${
                    errors.anchorId ? 'border-red-500' : 'border-orbit-border'
                  } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                >
                  <option value={0}>请选择主播</option>
                  {formData.anchors.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {errors.anchorId && <p className="text-red-400 text-[11px] mt-0.5">{errors.anchorId}</p>}
              </div>

              {/* Room */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  直播间 <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.roomId}
                  onChange={(e) => updateField('roomId', Number(e.target.value))}
                  className={`w-full h-9 px-3 text-sm rounded-lg border ${
                    errors.roomId ? 'border-red-500' : 'border-orbit-border'
                  } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                >
                  <option value={0}>请选择直播间</option>
                  {filteredRooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {errors.roomId && <p className="text-red-400 text-[11px] mt-0.5">{errors.roomId}</p>}
              </div>

              {/* Operator */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  中控 <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.operatorId}
                  onChange={(e) => updateField('operatorId', Number(e.target.value))}
                  className={`w-full h-9 px-3 text-sm rounded-lg border ${
                    errors.operatorId ? 'border-red-500' : 'border-orbit-border'
                  } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                >
                  <option value={0}>请选择中控</option>
                  {formData.operators.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                {errors.operatorId && <p className="text-red-400 text-[11px] mt-0.5">{errors.operatorId}</p>}
              </div>

              {/* Start time */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  开始时间 <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  className={`w-full h-9 px-3 text-sm rounded-lg border ${
                    errors.startTime ? 'border-red-500' : 'border-orbit-border'
                  } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                />
                {errors.startTime && <p className="text-red-400 text-[11px] mt-0.5">{errors.startTime}</p>}
              </div>

              {/* End time */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  结束时间 <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField('endTime', e.target.value)}
                  className={`w-full h-9 px-3 text-sm rounded-lg border ${
                    errors.endTime ? 'border-red-500' : 'border-orbit-border'
                  } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                />
                {errors.endTime && <p className="text-red-400 text-[11px] mt-0.5">{errors.endTime}</p>}
              </div>

              {/* Duration (auto) */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">时长（分钟）</label>
                <input
                  type="number"
                  value={form.duration}
                  readOnly
                  className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface3/50 text-[var(--text-muted)] outline-none cursor-not-allowed"
                />
              </div>

              {/* GMV */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  现场GMV <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.gmv}
                  onChange={(e) => updateField('gmv', parseFloat(e.target.value) || 0)}
                  className={`w-full h-9 px-3 text-sm rounded-lg border ${
                    errors.gmv ? 'border-red-500' : 'border-orbit-border'
                  } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                  placeholder="0.00"
                />
                {errors.gmv && <p className="text-red-400 text-[11px] mt-0.5">{errors.gmv}</p>}
              </div>

              {/* Return amount */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  现场退货 <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.returnAmount}
                  onChange={(e) => updateField('returnAmount', parseFloat(e.target.value) || 0)}
                  className={`w-full h-9 px-3 text-sm rounded-lg border ${
                    errors.returnAmount ? 'border-red-500' : 'border-orbit-border'
                  } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                  placeholder="0.00"
                />
                {errors.returnAmount && <p className="text-red-400 text-[11px] mt-0.5">{errors.returnAmount}</p>}
              </div>

              {/* GSV (auto) */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">现场GSV</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.gsv.toFixed(2)}
                  readOnly
                  className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface3/50 text-emerald-400 outline-none cursor-not-allowed"
                />
              </div>

              {/* Remark */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">备注</label>
                <input
                  type="text"
                  value={form.remark}
                  onChange={(e) => updateField('remark', e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary/50 transition-colors"
                  placeholder="可选"
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Ad data form (only for admin/manager) */}
      {isAdminOrManager && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardHeader title="投流数据" subtitle="投流相关信息录入" />
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Platform */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">平台</label>
                  <input
                    type="text"
                    value={form.adPlatform}
                    onChange={(e) => updateField('adPlatform', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary/50 transition-colors"
                    placeholder="可选"
                  />
                </div>

                {/* Ad type */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">类型</label>
                  <input
                    type="text"
                    value={form.adType}
                    onChange={(e) => updateField('adType', e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-secondary)] placeholder:text-[var(--text-subtle)] outline-none focus:border-orbit-primary/50 transition-colors"
                    placeholder="可选"
                  />
                </div>

                {/* Ad cost */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">投流支出</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.adCost}
                    onChange={(e) => updateField('adCost', parseFloat(e.target.value) || 0)}
                    className={`w-full h-9 px-3 text-sm rounded-lg border ${
                      errors.adCost ? 'border-red-500' : 'border-orbit-border'
                    } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                    placeholder="0.00"
                  />
                  {errors.adCost && <p className="text-red-400 text-[11px] mt-0.5">{errors.adCost}</p>}
                </div>

                {/* Ad GSV */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">净成交GSV</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.adGsv}
                    onChange={(e) => updateField('adGsv', parseFloat(e.target.value) || 0)}
                    className={`w-full h-9 px-3 text-sm rounded-lg border ${
                      errors.adGsv ? 'border-red-500' : 'border-orbit-border'
                    } bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors`}
                    placeholder="0.00"
                  />
                  {errors.adGsv && <p className="text-red-400 text-[11px] mt-0.5">{errors.adGsv}</p>}
                </div>

                {/* Ad status */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">投流状态</label>
                  <select
                    value={form.adStatus}
                    onChange={(e) => updateField('adStatus', Number(e.target.value))}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-orbit-border bg-orbit-surface2 text-[var(--text-secondary)] outline-none focus:border-orbit-primary/50 transition-colors"
                  >
                    <option value={1}>启用</option>
                    <option value={0}>关闭</option>
                  </select>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Submit button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="flex items-center justify-center gap-3"
      >
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {submitting ? '保存中...' : isEditing ? '更新数据' : '保存数据'}
        </Button>
      </motion.div>
    </div>
  )
}