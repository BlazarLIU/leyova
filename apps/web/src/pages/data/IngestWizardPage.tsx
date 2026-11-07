import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Upload, FileText, X, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft,
  Layers, Filter, Eye, Database,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'
import { usePlatform } from '@/hooks/usePlatform'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

// ── 后端返回类型 ──
interface FieldDef {
  field: string
  aliases: string[]
  required: boolean
}

interface CleanRuleSet {
  id: number
  name: string
  description: string
  is_system: boolean
  rules: any[]
}

interface SavedMapping {
  id: number
  template_code: string
  file_header_fingerprint: string
  column_mappings: Record<string, string | null>
}

interface TemplateResponse {
  fields: FieldDef[]
  savedMappings: SavedMapping[]
  ruleSets: CleanRuleSet[]
}

interface SampleDiff {
  rowIndex: number
  status: 'passed' | 'modified' | 'dropped' | 'marked'
  reason?: string
  original: Record<string, any>
  cleaned: Record<string, any>
}

interface CleanReport {
  inputRowsCount: number
  successRowsCount: number
  droppedRowsCount: number
  modifiedRowsCount: number
  markedRowsCount: number
  rulesAppliedCount: number
  executionTimeMs: number
  sampleDiffs: SampleDiff[]
}

interface MappedRowPreview {
  bizDate: string
  channelName: string
  values: Record<string, number>
}

interface PreviewResponse {
  fileName: string
  platformCode: string
  dataType: string
  headers: string[]
  totalRows: number
  fingerprint: string
  savedMapping: SavedMapping | null
  suggestedMapping: Record<string, string | null>
  cleanReport: CleanReport | null
  mappedPreview: MappedRowPreview[]
  rejectedCount: number
  rejectedSample: Array<{ rowIndex: number; reason: string; raw: Record<string, any> }>
  rawSample: Record<string, any>[]
}

interface UploadResult {
  jobId: number
  insertedRows: number
  rejectedRows: number
  mapping: Record<string, string | null>
  sampleRejections: Array<{ rowIndex: number; reason: string }>
  fileName: string
  inputRows: number
  cleanedRows: number
}

const STEPS = [
  { key: 'upload', label: '上传文件', icon: Upload },
  { key: 'target', label: '选平台店铺', icon: Layers },
  { key: 'mapping', label: '字段映射', icon: ColumnsIcon },
  { key: 'clean', label: '清洗规则', icon: Filter },
  { key: 'preview', label: '预演对照', icon: Eye },
  { key: 'done', label: '确认入库', icon: Database },
]

function ColumnsIcon(props: any) {
  return <Layers {...props} />
}

const FIELD_LABELS: Record<string, string> = {
  biz_date: '业务日期',
  channel_name: '渠道名称',
  gmv: '成交总额 (GMV)',
  pay_amount: '买家实付金额',
  paid_order_count: '支付订单数',
  paid_buyer_count: '支付买家数',
  refund_amount: '退款金额',
  refund_count: '退款订单数',
  impressions: '展现/曝光量',
  clicks: '点击量',
  visitors: '访客数',
  avg_stay_seconds: '平均停留时长(秒)',
}

export function IngestWizardPage() {
  const { platforms, currentPlatform, currentShop } = usePlatform()

  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const [platformCode, setPlatformCode] = useState('')
  const [shopId, setShopId] = useState<number | null>(null)
  const [dataType, setDataType] = useState<'trade' | 'traffic'>('trade')
  const [businessDate, setBusinessDate] = useState('')

  const [template, setTemplate] = useState<TemplateResponse | null>(null)
  const [mapping, setMapping] = useState<Record<string, string | null>>({})
  const [ruleSetId, setRuleSetId] = useState<number | null>(null)

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 默认带上当前选择的平台/店铺
  useEffect(() => {
    if (!platformCode && currentPlatform) setPlatformCode(currentPlatform.platform_code)
    if (shopId === null && currentShop) setShopId(currentShop.id)
  }, [currentPlatform, currentShop, platformCode, shopId])

  // 拉取模板 / 规则集
  const loadTemplate = useCallback(async (pf: string, dt: string) => {
    if (!pf) return
    try {
      const data = await api.get<TemplateResponse>('/ingest/templates', { platform: pf, dataType: dt })
      setTemplate(data)
    } catch (e: any) {
      setError(e?.message || '加载模板失败')
    }
  }, [])

  useEffect(() => {
    if (platformCode) loadTemplate(platformCode, dataType)
  }, [platformCode, dataType, loadTemplate])

  // 进入「字段映射」步骤时，若还没有列名信息，自动预演一次取 headers
  useEffect(() => {
    if (step === 2 && !preview && file && platformCode && !loading) {
      doPreview(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const currentPlatformObj = platforms.find((p) => p.platform_code === platformCode)
  const shops = currentPlatformObj?.shops || []

  const handleFile = (f: File) => {
    setFile(f)
    setPreview(null)
    setResult(null)
    setError(null)
    setStep(1)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  /** 调用预演接口；jumpToStep 为 true 时才跳转到第 4 步 */
  const doPreview = async (jumpToStep: boolean) => {
    if (!file || !platformCode) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('platform_code', platformCode)
      fd.append('data_type', dataType)
      if (ruleSetId) fd.append('rule_set_id', String(ruleSetId))
      if (businessDate) fd.append('business_date', businessDate)
      if (Object.keys(mapping).length > 0) {
        fd.append('column_mappings', JSON.stringify(mapping))
      }

      const res = await fetch('/api/v1/ingest/preview', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || '预演失败')
      setPreview(json.data)
      // 只在用户还没手动调整过映射时，才采用后端建议
      setMapping((prev) =>
        Object.values(prev).some((v) => v) ? prev : (json.data.suggestedMapping || {}),
      )
      if (jumpToStep) setStep(4)
    } catch (e: any) {
      setError(e?.message || '预演失败')
    } finally {
      setLoading(false)
    }
  }

  /** 预演并跳转到对照步骤 */
  const runPreview = () => doPreview(true)

  // ── 正式导入 ──
  const runImport = async () => {
    if (!file || !platformCode || !shopId) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('platform_code', platformCode)
      fd.append('shop_id', String(shopId))
      fd.append('data_type', dataType)
      if (ruleSetId) fd.append('rule_set_id', String(ruleSetId))
      if (businessDate) fd.append('business_date', businessDate)
      if (Object.keys(mapping).length > 0) {
        fd.append('column_mappings', JSON.stringify(mapping))
      }

      const res = await fetch('/api/v1/ingest/manual-upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || '导入失败')
      setResult(json.data)
      setStep(5)
    } catch (e: any) {
      setError(e?.message || '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setMapping({})
    setRuleSetId(null)
    setBusinessDate('')
    setError(null)
    setStep(0)
  }

  const canNext = () => {
    if (step === 0) return false
    if (step === 1) return !!platformCode && !!shopId
    // 步骤2：只要识别出列名就允许继续（映射可留空，走自动建议）
    if (step === 2) return !!preview && preview.headers.length > 0
    if (step === 3) return true
    return false
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">多平台数据接入</h1>
            <p className="mt-1 text-sm text-slate-400">
              上传各平台后台导出文件，经字段映射与自定义清洗后写入标准事实表
            </p>
          </div>
          {file && (
            <Button variant="ghost" onClick={reset}>
              <X className="mr-1 h-4 w-4" /> 重新开始
            </Button>
          )}
        </div>
      </motion.div>

      {/* 步骤条 */}
      <motion.div {...fadeIn}>
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done = i < step
            return (
              <div key={s.key} className="flex flex-1 items-center gap-1 min-w-0">
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs whitespace-nowrap transition',
                    active && 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40',
                    done && 'bg-emerald-500/10 text-emerald-400',
                    !active && !done && 'text-slate-500',
                  )}
                >
                  {done ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  <span className="font-medium">{i + 1}. {s.label}</span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-700" />}
              </div>
            )
          })}
        </div>
      </motion.div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 0: 上传 */}
      {step === 0 && (
        <motion.div {...fadeIn}>
          <Card>
            <CardBody>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition',
                  isDragOver
                    ? 'border-cyan-500/60 bg-cyan-500/5'
                    : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30',
                )}
              >
                <Upload className="h-10 w-10 text-slate-500" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-200">点击选择或拖拽文件到此处</p>
                  <p className="mt-1 text-xs text-slate-500">支持 CSV / XLSX / XLS，单文件最大 100MB</p>
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.tsv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Step 1: 平台店铺 */}
      {step === 1 && (
        <motion.div {...fadeIn}>
          <Card>
            <CardHeader>选择数据归属</CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <FileText className="h-4 w-4" />
                <span className="text-slate-200">{file?.name}</span>
                <span>({(file!.size / 1024).toFixed(1)} KB)</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">所属平台</label>
                  <select
                    value={platformCode}
                    onChange={(e) => { setPlatformCode(e.target.value); setShopId(null) }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">请选择平台</option>
                    {platforms.filter((p) => p.is_enabled && p.isPermitted !== false).map((p) => (
                      <option key={p.platform_code} value={p.platform_code}>{p.platform_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">所属店铺</label>
                  <select
                    value={shopId ?? ''}
                    onChange={(e) => setShopId(Number(e.target.value) || null)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                    disabled={!platformCode}
                  >
                    <option value="">请选择店铺</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">数据类型</label>
                  <select
                    value={dataType}
                    onChange={(e) => setDataType(e.target.value as 'trade' | 'traffic')}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="trade">交易事实（GMV / 订单 / 退款）</option>
                    <option value="traffic">流量事实（展现 / 点击 / 访客）</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    兜底业务日期（文件无日期列时使用）
                  </label>
                  <input
                    type="date"
                    value={businessDate}
                    onChange={(e) => setBusinessDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Step 2: 字段映射 */}
      {step === 2 && (
        <motion.div {...fadeIn}>
          <Card>
            <CardHeader>字段映射（标准字段 ← 文件列）</CardHeader>
            <CardBody>
              {!template ? (
                <p className="text-sm text-slate-500">加载中…</p>
              ) : (
                <div className="space-y-2">
                  {template.fields.map((f) => (
                    <div key={f.field} className="grid grid-cols-2 items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2">
                      <div className="text-sm text-slate-300">
                        {FIELD_LABELS[f.field] || f.field}
                        {f.required && <span className="ml-1 text-rose-400">*</span>}
                      </div>
                      <select
                        value={mapping[f.field] || ''}
                        onChange={(e) => setMapping((m) => ({ ...m, [f.field]: e.target.value || null }))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                      >
                        <option value="">（不映射）</option>
                        {(preview?.headers || []).map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                        {preview && !preview.headers.includes(f.aliases[0]) && f.aliases.map((a) => (
                          <option key={`alias-${a}`} value={a}>{a}（别名）</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              {!preview && loading && (
                <p className="mt-3 text-xs text-slate-500">正在解析文件列名…</p>
              )}
              {preview && (
                <p className="mt-3 text-xs text-slate-500">
                  已识别 {preview.headers.length} 个列，系统已给出映射建议。留空表示不映射该字段。
                </p>
              )}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Step 3: 清洗规则 */}
      {step === 3 && (
        <motion.div {...fadeIn}>
          <Card>
            <CardHeader>选择清洗规则集</CardHeader>
            <CardBody className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800/40">
                <input
                  type="radio"
                  checked={ruleSetId === null}
                  onChange={() => setRuleSetId(null)}
                />
                <span className="text-sm text-slate-300">不使用清洗规则（原始数据直接映射）</span>
              </label>
              {(template?.ruleSets || []).map((rs) => (
                <label
                  key={rs.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800/40"
                >
                  <input
                    type="radio"
                    className="mt-1"
                    checked={ruleSetId === rs.id}
                    onChange={() => setRuleSetId(rs.id)}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-200">{rs.name}</span>
                      {rs.is_system && <Badge variant="info">官方</Badge>}
                      <span className="text-xs text-slate-500">{rs.rules?.length || 0} 条规则</span>
                    </div>
                    {rs.description && <p className="mt-0.5 text-xs text-slate-500">{rs.description}</p>}
                  </div>
                </label>
              ))}
              {(!template?.ruleSets || template.ruleSets.length === 0) && (
                <p className="text-sm text-slate-500">该平台暂无可用清洗规则集</p>
              )}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Step 4: 预演对照 */}
      {step === 4 && preview && (
        <motion.div {...fadeIn} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="文件总行数" value={preview.totalRows} />
            <StatCard label="清洗后可入库" value={preview.cleanReport?.successRowsCount ?? preview.totalRows} tone="ok" />
            <StatCard label="被剔除行" value={preview.cleanReport?.droppedRowsCount ?? 0} tone="warn" />
            <StatCard label="日期无法识别" value={preview.rejectedCount} tone={preview.rejectedCount > 0 ? 'warn' : 'ok'} />
          </div>

          <Card>
            <CardHeader>映射后标准事实行（前 20 条）</CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-400">
                      <th className="py-2 pr-3">业务日期</th>
                      <th className="py-2 pr-3">渠道</th>
                      {Object.keys(preview.mappedPreview[0]?.values || {}).map((k) => (
                        <th key={k} className="py-2 pr-3">{FIELD_LABELS[k] || k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.mappedPreview.map((r, i) => (
                      <tr key={i} className="border-b border-slate-800/60 text-slate-300">
                        <td className="py-1.5 pr-3 font-mono">{r.bizDate}</td>
                        <td className="py-1.5 pr-3">{r.channelName}</td>
                        {Object.keys(preview.mappedPreview[0]?.values || {}).map((k) => (
                          <td key={k} className="py-1.5 pr-3 font-mono">{r.values[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {preview.rejectedSample.length > 0 && (
            <Card>
              <CardHeader>被拒绝的行（无法识别业务日期）</CardHeader>
              <CardBody className="space-y-1">
                {preview.rejectedSample.map((r, i) => (
                  <div key={i} className="rounded bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                    第 {r.rowIndex + 1} 行：{r.reason}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {preview.cleanReport && preview.cleanReport.sampleDiffs.length > 0 && (
            <Card>
              <CardHeader>清洗 Diff 对照（前 10 条）</CardHeader>
              <CardBody className="space-y-2">
                {preview.cleanReport.sampleDiffs.slice(0, 10).map((d, i) => (
                  <div key={i} className="rounded border border-slate-700/60 p-2 text-xs">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={d.status === 'dropped' ? 'danger' : d.status === 'marked' ? 'warning' : 'success'}>
                        {d.status}
                      </Badge>
                      <span className="text-slate-500">第 {d.rowIndex} 行</span>
                      {d.reason && <span className="text-slate-400">{d.reason}</span>}
                    </div>
                    {d.status !== 'dropped' && (
                      <div className="grid grid-cols-2 gap-2">
                        <pre className="overflow-x-auto rounded bg-slate-900/60 p-1.5 text-[10px] text-slate-500">
                          {JSON.stringify(d.original).slice(0, 200)}
                        </pre>
                        <pre className="overflow-x-auto rounded bg-slate-900/60 p-1.5 text-[10px] text-emerald-400/80">
                          {JSON.stringify(d.cleaned).slice(0, 200)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </motion.div>
      )}

      {/* Step 5: 完成 */}
      {step === 5 && result && (
        <motion.div {...fadeIn}>
          <Card>
            <CardBody className="space-y-3 text-center py-10">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
              <h2 className="text-lg font-semibold text-slate-100">导入完成</h2>
              <div className="mx-auto grid max-w-md grid-cols-3 gap-3 text-sm">
                <StatCard label="输入行数" value={result.inputRows} />
                <StatCard label="成功入库" value={result.insertedRows} tone="ok" />
                <StatCard label="拒绝行数" value={result.rejectedRows} tone={result.rejectedRows > 0 ? 'warn' : 'ok'} />
              </div>
              <p className="text-xs text-slate-500">任务 ID: {result.jobId}</p>
              <Button onClick={reset} className="mt-2">继续上传下一份</Button>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* 底部动作条 */}
      {step >= 1 && step <= 4 && (
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" /> 上一步
          </Button>
          <div className="flex gap-2">
            {step === 2 && (
              <Button variant="ghost" onClick={runPreview} disabled={loading}>
                {loading ? '解析中…' : '预演对照'}
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={!canNext()}>
                下一步 <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={runImport} disabled={loading || !shopId}>
                {loading ? '导入中…' : '确认入库'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-center">
      <div
        className={cn(
          'text-xl font-semibold',
          tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : 'text-slate-200',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
    </div>
  )
}
