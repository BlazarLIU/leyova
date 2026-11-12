import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Layers,
  RefreshCw,
  UploadCloud,
  FileCheck2,
  Check,
  X,
  Eye,
  ExternalLink,
  ShieldCheck,
  Key,
  Globe2,
  Lock,
} from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'
import { EntityAliasPanel } from '@/components/data/EntityAliasPanel'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

// ── 批次与数据成熟度状态机 Badge ──
function MaturityBadge({ status }: { status: string }) {
  switch (status) {
    case 'FINAL':
      return <Badge variant="success" dot>FINAL 最终正式</Badge>
    case 'PROVISIONAL':
      return <Badge variant="info" dot>PROVISIONAL 暂定待核</Badge>
    case 'BLOCKED':
      return <Badge variant="danger" dot>BLOCKED 致命阻断</Badge>
    case 'PARTIAL':
      return <Badge variant="warning" dot>PARTIAL 部分发布</Badge>
    case 'SUPERSEDED':
      return <Badge variant="neutral">SUPERSEDED 已冲正</Badge>
    case 'PROCESSING':
    default:
      return <Badge variant="neutral" dot>PROCESSING 清洗中</Badge>
  }
}

// ── 严重等级 Badge ──
function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'P0':
      return <Badge variant="danger">P0 致命阻断</Badge>
    case 'P1':
      return <Badge variant="warning">P1 严重待审</Badge>
    case 'P2':
      return <Badge variant="info">P2 一般告警</Badge>
    default:
      return <Badge variant="neutral">P3 提示</Badge>
  }
}

export function DataQualityPage() {
  const [activeTab, setActiveTab] = useState<'batches' | 'workbench' | 'reconciliation' | 'platforms' | 'ingest' | 'aliases'>('batches')
  const [batches, setBatches] = useState<any[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // 审核工作台状态
  const [issues, setIssues] = useState<any[]>([])
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null)
  const [fixedAmount, setFixedAmount] = useState<string>('')
  const [resolveReason, setResolveReason] = useState<string>('')
  const [submittingResolve, setSubmittingResolve] = useState(false)

  // 对账与发布状态
  const [controlRowCount, setControlRowCount] = useState<string>('1')
  const [controlAmount, setControlAmount] = useState<string>('399.00')
  const [reconResults, setReconResults] = useState<any[]>([])
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)

  // 7 平台 API 规范
  const [platformSpecs, setPlatformSpecs] = useState<any[]>([])

  // 手工上传与 API 触发
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadPlatform, setUploadPlatform] = useState('douyin')
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null)
  const [syncingApi, setSyncingApi] = useState(false)

  // 刷新批次列表
  const fetchBatches = async () => {
    try {
      setLoading(true)
      const res: any = await api.get('/governance/batches')
      const list = res?.data?.list ?? res?.list ?? []
      setBatches(list)
      if (list.length > 0 && !selectedBatchId) {
        setSelectedBatchId(list[0].id)
      }
    } catch (err: any) {
      console.error('Failed to fetch batches:', err)
    } finally {
      setLoading(false)
    }
  }

  // 刷新选定批次的异常列表 (四屏同显)
  const fetchIssues = async (batchId: number) => {
    try {
      const res: any = await api.get(`/governance/batches/${batchId}/issues`)
      const list = res?.data ?? res ?? []
      setIssues(list)
      if (list.length > 0) {
        setSelectedIssue(list[0])
        setFixedAmount(String(list[0].comparison?.cleaned?.fieldValue || ''))
      } else {
        setSelectedIssue(null)
      }
    } catch (err: any) {
      console.error('Failed to fetch issues:', err)
    }
  }

  // 获取 7 大平台规范
  const fetchPlatformSpecs = async () => {
    try {
      const res: any = await api.get('/governance/platforms/specs')
      setPlatformSpecs(res?.data ?? res ?? [])
    } catch (err: any) {
      console.error('Failed to fetch platform specs:', err)
    }
  }

  useEffect(() => {
    fetchBatches()
    fetchPlatformSpecs()
  }, [])

  useEffect(() => {
    if (selectedBatchId) {
      fetchIssues(selectedBatchId)
    }
  }, [selectedBatchId])

  // 处理审核确认
  const handleResolveIssue = async (decision: 'CONFIRM_FIX' | 'REJECT' | 'OVERRIDE_ALLOW') => {
    if (!selectedIssue) return
    try {
      setSubmittingResolve(true)
      await api.post(`/governance/issues/${selectedIssue.id}/resolve`, {
        decision,
        reason: resolveReason || '运营人工确认核实',
        fixedValues: fixedAmount ? { paidAmount: Number(fixedAmount) } : undefined,
      })

      // 重新执行独立质量校验
      await api.post(`/governance/batches/${selectedBatchId}/validate`, {})
      await fetchBatches()
      if (selectedBatchId) await fetchIssues(selectedBatchId)
      setResolveReason('')
    } catch (err: any) {
      alert(`处理失败: ${err.message}`)
    } finally {
      setSubmittingResolve(false)
    }
  }

  // 执行多层对账
  const handleReconcile = async () => {
    if (!selectedBatchId) return
    try {
      const res: any = await api.post(`/governance/batches/${selectedBatchId}/reconcile`, {
        expectedRowCount: controlRowCount ? parseInt(controlRowCount) : undefined,
        expectedTotalAmount: controlAmount ? parseFloat(controlAmount) : undefined,
      })
      setReconResults(res?.data ?? res ?? [])
      await fetchBatches()
    } catch (err: any) {
      alert(`对账失败: ${err.message}`)
    }
  }

  // 执行原子发布
  const handlePublish = async () => {
    if (!selectedBatchId) return
    try {
      setPublishing(true)
      setPublishMessage(null)
      const res: any = await api.post(`/governance/batches/${selectedBatchId}/publish`, {})
      setPublishMessage(`✅ 发布成功！已安全原子写入 ${res.data?.recordsPublished ?? 1} 条规范订单记录，状态推进为 FINAL！`)
      await fetchBatches()
    } catch (err: any) {
      setPublishMessage(`❌ ${err.message}`)
    } finally {
      setPublishing(false)
    }
  }

  // 触发 Client 1: 官方 API 同步
  const handleTriggerApiSync = async () => {
    try {
      setSyncingApi(true)
      setUploadStatusMsg(null)
      const res: any = await api.post('/governance/ingest/api', {
        platformCode: uploadPlatform,
        shopId: 1,
        datasetType: 'orders',
      })
      setUploadStatusMsg(`✅ 官方 API 增量拉取成功！批次号: ${res.data?.batchNo}，拉取行数: ${res.data?.recordsCount}`)
      await fetchBatches()
    } catch (err: any) {
      setUploadStatusMsg(`❌ 同步失败: ${err.message}`)
    } finally {
      setSyncingApi(false)
    }
  }

  // 触发 Client 2: 手动文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('platformCode', uploadPlatform)
    formData.append('shopId', '1')
    formData.append('datasetType', 'orders')

    try {
      setUploadStatusMsg('⏳ 正在上传并计算 SHA-256 哈希、执行流式解析与独立校验...')
      const res: any = await fetch('/api/v1/governance/ingest/file', {
        method: 'POST',
        body: formData,
      }).then((r) => r.json())

      if (res.success) {
        setUploadStatusMsg(`✅ 文件导入成功！批次: ${res.data?.batchNo}，解析原始行数: ${res.data?.parsedRowsCount}`)
        await fetchBatches()
      } else {
        setUploadStatusMsg(`❌ ${res.message || '上传处理失败'}`)
      }
    } catch (err: any) {
      setUploadStatusMsg(`❌ 上传失败: ${err.message}`)
    }
  }

  const selectedBatch = batches.find((b) => b.id === selectedBatchId)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1700px]">
      {/* 顶栏标题 */}
      <motion.div {...fadeIn} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-orbit-primary" />
            数据清洗与质量校验治理中心
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            严格遵循规范 V1.0 · 原始数据不覆盖 · 清洗与校验分离 · 规则优于 AI · 结果可追溯 · 入库有闸门
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchBatches} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            刷新批次
          </Button>
        </div>
      </motion.div>

      {/* 顶部 Tab 导航 */}
      <div className="flex border-b border-orbit-border space-x-2">
        <button
          onClick={() => setActiveTab('batches')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'batches'
              ? 'border-orbit-primary text-orbit-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Layers className="w-4 h-4" />
          批次大盘与数据成熟度
        </button>
        <button
          onClick={() => setActiveTab('workbench')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'workbench'
              ? 'border-orbit-primary text-orbit-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Eye className="w-4 h-4" />
          人工审核工作台 (四屏同显)
          {selectedBatch?.open_p0_count > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-rose-500/20 text-rose-300 rounded-full font-bold">
              {selectedBatch.open_p0_count} P0
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'reconciliation'
              ? 'border-orbit-primary text-orbit-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <FileCheck2 className="w-4 h-4" />
          对账中心与原子发布闸门
        </button>
        <button
          onClick={() => setActiveTab('platforms')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'platforms'
              ? 'border-orbit-primary text-orbit-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Globe2 className="w-4 h-4" />
          7 大电商平台 API 技术规范
        </button>
        <button
          onClick={() => setActiveTab('ingest')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'ingest'
              ? 'border-orbit-primary text-orbit-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <UploadCloud className="w-4 h-4" />
          双轨数据接入测试 (API / 手工文件)
        </button>
        <button
          onClick={() => setActiveTab('aliases')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
            activeTab === 'aliases'
              ? 'border-orbit-primary text-orbit-primary'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          )}
        >
          <Key className="w-4 h-4" />
          实体别名与字段映射
        </button>
      </div>

      {/* ── TAB 1: 批次大盘与数据成熟度 ── */}
      {activeTab === 'batches' && (
        <motion.div {...fadeIn} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-orbit-surface p-4 border border-orbit-border">
              <p className="text-xs text-slate-400">接入总批次数</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{batches.length}</p>
            </Card>
            <Card className="bg-orbit-surface p-4 border border-orbit-border">
              <p className="text-xs text-slate-400">不可变原始行总数 (Raw)</p>
              <p className="text-2xl font-bold text-sky-400 mt-1">
                {batches.reduce((s, b) => s + (b.total_raw_rows || 0), 0).toLocaleString()}
              </p>
            </Card>
            <Card className="bg-orbit-surface p-4 border border-orbit-border">
              <p className="text-xs text-slate-400">清洗候选总数 (Candidate)</p>
              <p className="text-2xl font-bold text-indigo-400 mt-1">
                {batches.reduce((s, b) => s + (b.clean_candidate_rows || 0), 0).toLocaleString()}
              </p>
            </Card>
            <Card className="bg-orbit-surface p-4 border border-orbit-border">
              <p className="text-xs text-slate-400">正式入库发布总数 (Final)</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {batches.reduce((s, b) => s + (b.published_rows || 0), 0).toLocaleString()}
              </p>
            </Card>
            <Card className="bg-orbit-surface p-4 border border-orbit-border">
              <p className="text-xs text-slate-400">待处理 P0/P1 异常阻断</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">
                {batches.reduce((s, b) => s + (Number(b.open_p0_count) || 0), 0)} 个
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="导入批次与数据成熟度状态机"
              subtitle="每一批数据从原始采集、清洗、独立校验、对账到正式发布的全生命周期"
            />
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-orbit-border bg-orbit-surface2/60 text-slate-400">
                      <th className="py-3 px-4">批次号 / 时间</th>
                      <th className="py-3 px-4">平台 / 店铺</th>
                      <th className="py-3 px-4">接入通道</th>
                      <th className="py-3 px-4">原始行 (Raw)</th>
                      <th className="py-3 px-4">候选行 (Clean)</th>
                      <th className="py-3 px-4">正式入库 (Pub)</th>
                      <th className="py-3 px-4">质量问题 (P0/P1)</th>
                      <th className="py-3 px-4">数据成熟度状态</th>
                      <th className="py-3 px-4 text-right">快捷操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orbit-border">
                    {batches.map((b) => (
                      <tr
                        key={b.id}
                        className={cn(
                          'hover:bg-orbit-surface2/40 transition-colors cursor-pointer',
                          selectedBatchId === b.id && 'bg-orbit-primary/5'
                        )}
                        onClick={() => setSelectedBatchId(b.id)}
                      >
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                          <div>{b.batch_no}</div>
                          <div className="text-[10px] text-slate-500">{new Date(b.created_at).toLocaleString()}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-200 uppercase">{b.source_platform}</span>
                          <span className="text-slate-400 ml-1.5">({b.shop_name || '默认店铺'})</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {b.source_channel === 'api' ? (
                            <span className="text-sky-400 font-mono">OpenAPI 增量</span>
                          ) : (
                            <span className="text-amber-400 font-mono">报表手动上传</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{b.total_raw_rows}</td>
                        <td className="py-3.5 px-4 text-slate-300">{b.clean_candidate_rows}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">{b.published_rows}</td>
                        <td className="py-3.5 px-4">
                          {b.open_p0_count > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                              {b.open_p0_count} 致命 P0
                            </span>
                          ) : b.open_p1_count > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                              {b.open_p1_count} 待审 P1
                            </span>
                          ) : (
                            <span className="text-slate-500">无异常</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <MaturityBadge status={b.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedBatchId(b.id)
                              setActiveTab('workbench')
                            }}
                          >
                            审核工作台
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedBatchId(b.id)
                              setActiveTab('reconciliation')
                            }}
                          >
                            对账与发布
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 2: 人工审核工作台 (Review Workbench · 四屏同显) ── */}
      {activeTab === 'workbench' && (
        <motion.div {...fadeIn} className="space-y-4">
          <div className="flex items-center justify-between bg-orbit-surface p-4 rounded-xl border border-orbit-border">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">当前审核批次:</span>
              <select
                value={selectedBatchId || ''}
                onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                className="bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-1.5 text-xs text-slate-200"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_no} ({b.source_platform} · {b.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400">
              共检出 <span className="font-bold text-rose-400">{issues.length}</span> 个待审核异常
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* 左侧异常列表 */}
            <div className="col-span-4 space-y-3">
              <Card>
                <CardHeader title="待处理质量问题队列" subtitle="点击查看四屏同显对比与规则证据" />
                <CardBody className="p-3 max-h-[650px] overflow-y-auto space-y-2">
                  {issues.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      🎉 本批次暂无未处理质量异常，全部规则均已通过！
                    </div>
                  ) : (
                    issues.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedIssue(item)
                          setFixedAmount(String(item.comparison?.cleaned?.fieldValue || ''))
                        }}
                        className={cn(
                          'p-3 rounded-lg border text-xs cursor-pointer transition-colors space-y-1.5',
                          selectedIssue?.id === item.id
                            ? 'bg-orbit-primary/10 border-orbit-primary text-slate-100'
                            : 'bg-orbit-surface2/50 border-orbit-border hover:border-orbit-border2 text-slate-300'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-200">{item.ruleId}</span>
                          <SeverityBadge severity={item.severity} />
                        </div>
                        <p className="text-slate-300 font-medium line-clamp-2">{item.issueMessage}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>键: {item.sourceBusinessKey || '单条记录'}</span>
                          <span>{item.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            </div>

            {/* 右侧四屏同显区域 */}
            <div className="col-span-8 space-y-4">
              {selectedIssue ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 屏幕 1: 原始数据 (Raw) */}
                    <Card className="border border-orbit-border">
                      <CardHeader title="1. 原始文件/报文值 (Raw)" subtitle={`第 ${selectedIssue.comparison?.raw?.rowNo || 1} 行`} />
                      <CardBody className="p-4 bg-orbit-surface2/40 rounded-b-xl space-y-2 font-mono text-xs">
                        <div className="text-slate-400">原始字段值:</div>
                        <div className="p-2.5 bg-orbit-surface rounded border border-orbit-border text-amber-300 break-all">
                          {selectedIssue.comparison?.raw?.fieldValue || '空值 (NULL)'}
                        </div>
                        <div className="text-slate-400 mt-2">完整原始行 JSON:</div>
                        <pre className="p-2 bg-orbit-surface rounded border border-orbit-border text-[11px] text-slate-400 max-h-36 overflow-auto">
                          {JSON.stringify(selectedIssue.comparison?.raw?.payload, null, 2)}
                        </pre>
                      </CardBody>
                    </Card>

                    {/* 屏幕 2: 清洗候选 (Clean Candidate) */}
                    <Card className="border border-orbit-border">
                      <CardHeader title="2. 清洗标准化候选 (Clean)" subtitle={selectedIssue.comparison?.cleaned?.status} />
                      <CardBody className="p-4 bg-orbit-surface2/40 rounded-b-xl space-y-2 font-mono text-xs">
                        <div className="text-slate-400">清洗输出值:</div>
                        <div className="p-2.5 bg-orbit-surface rounded border border-orbit-border text-sky-300 break-all">
                          {selectedIssue.comparison?.cleaned?.fieldValue ?? '隔离'}
                        </div>
                        <div className="text-slate-400 mt-2">隔离原因:</div>
                        <div className="p-2 bg-rose-500/10 rounded border border-rose-500/20 text-rose-300 text-[11px]">
                          {selectedIssue.comparison?.cleaned?.quarantineReason || '触发独立校验规则阻断'}
                        </div>
                      </CardBody>
                    </Card>

                    {/* 屏幕 3: 关联主档候选 (Master Sku / Entity) */}
                    <Card className="border border-orbit-border">
                      <CardHeader title="3. 主数据实体解析 (Entity Resolver)" subtitle="内部商品 / SKU 映射" />
                      <CardBody className="p-4 bg-orbit-surface2/40 rounded-b-xl space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-orbit-border/50">
                          <span className="text-slate-400">平台外部 SKU:</span>
                          <span className="font-mono text-slate-200">
                            {selectedIssue.comparison?.cleaned?.payload?._platform_sku_id || '未知'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-orbit-border/50">
                          <span className="text-slate-400">内部系统关联主键:</span>
                          <span className="font-mono text-emerald-400">
                            {selectedIssue.comparison?.cleaned?.payload?._internal_sku_id || '未关联 (需人工映射)'}
                          </span>
                        </div>
                        <div className="p-2 bg-orbit-surface rounded text-[11px] text-slate-400">
                          提示: 若该 SKU 为平台新品，请确认内部关联编码，审核确认后将自动登记至主数据别名库。
                        </div>
                      </CardBody>
                    </Card>

                    {/* 屏幕 4: 校验失败规则证据 (Rule Evidence) */}
                    <Card className="border border-orbit-border">
                      <CardHeader title="4. 失败规则与断言证据 (Rule Evidence)" subtitle={selectedIssue.ruleId} />
                      <CardBody className="p-4 bg-orbit-surface2/40 rounded-b-xl space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={selectedIssue.severity} />
                          <span className="font-mono font-bold text-slate-200">{selectedIssue.ruleId}</span>
                        </div>
                        <div className="p-2.5 bg-rose-500/10 rounded border border-rose-500/20 text-rose-300 text-xs font-medium">
                          {selectedIssue.issueMessage}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          阻断级别: <span className="text-slate-200 font-bold">{selectedIssue.scope} 级</span> (严禁作为 FINAL 写入正式事实表)
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  {/* 决策操作区 */}
                  <Card className="border-t-2 border-t-orbit-primary">
                    <CardBody className="p-5 space-y-4">
                      <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <Key className="w-4 h-4 text-orbit-primary" />
                        人工审核决策操作台
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">纠正实付金额 (元):</label>
                          <input
                            value={fixedAmount}
                            onChange={(e) => setFixedAmount(e.target.value)}
                            className="w-full px-3 py-2 bg-orbit-surface2 border border-orbit-border rounded-lg text-xs text-slate-100 font-mono outline-none focus:border-orbit-primary"
                            placeholder="如需修改请输入正确金额..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">审核处置原因 (审计必填):</label>
                          <input
                            value={resolveReason}
                            onChange={(e) => setResolveReason(e.target.value)}
                            className="w-full px-3 py-2 bg-orbit-surface2 border border-orbit-border rounded-lg text-xs text-slate-100 outline-none focus:border-orbit-primary"
                            placeholder="请输入核实依据，如: 平台后台核对确认为真实数据..."
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={submittingResolve}
                          onClick={() => handleResolveIssue('REJECT')}
                        >
                          <X className="w-4 h-4" />
                          驳回并永久隔离
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={submittingResolve}
                          onClick={() => handleResolveIssue('CONFIRM_FIX')}
                        >
                          <Check className="w-4 h-4" />
                          确认修复并触发重新校验
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </>
              ) : (
                <div className="py-24 text-center text-slate-500 border border-dashed border-orbit-border rounded-xl">
                  请在左侧选择需要审查的质量异常项
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TAB 3: 对账中心与原子发布闸门 ── */}
      {activeTab === 'reconciliation' && (
        <motion.div {...fadeIn} className="space-y-6">
          <Card>
            <CardHeader
              title="多层对账中心 (Reconciliation Center)"
              subtitle="核对文件层行数、记录层主键数、金额控制总额及分组汇总"
            />
            <CardBody className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-6 bg-orbit-surface2/40 p-4 rounded-xl border border-orbit-border">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">选择核对批次:</label>
                  <select
                    value={selectedBatchId || ''}
                    onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                    className="w-full bg-orbit-surface border border-orbit-border rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_no} ({b.source_platform})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">平台控制总行数 (Expected Rows):</label>
                  <input
                    value={controlRowCount}
                    onChange={(e) => setControlRowCount(e.target.value)}
                    className="w-full bg-orbit-surface border border-orbit-border rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                    placeholder="输入平台报表声明的总行数"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">平台控制总金额 (Expected Amount 元):</label>
                  <input
                    value={controlAmount}
                    onChange={(e) => setControlAmount(e.target.value)}
                    className="w-full bg-orbit-surface border border-orbit-border rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                    placeholder="输入平台对账单总金额"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="secondary" size="md" onClick={handleReconcile}>
                  <FileCheck2 className="w-4 h-4" />
                  执行多层对账计算
                </Button>
              </div>

              {/* 对账结果展示 */}
              {reconResults.length > 0 && (
                <div className="border border-orbit-border rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-orbit-surface2/60 text-slate-400 border-b border-orbit-border">
                        <th className="py-2.5 px-4">对账层级</th>
                        <th className="py-2.5 px-4">指标代码</th>
                        <th className="py-2.5 px-4">来源控制基准数</th>
                        <th className="py-2.5 px-4">系统计算实际数</th>
                        <th className="py-2.5 px-4">差额</th>
                        <th className="py-2.5 px-4">对账判定状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orbit-border font-mono">
                      {reconResults.map((r, i) => (
                        <tr key={i} className="hover:bg-orbit-surface2/30">
                          <td className="py-3 px-4 uppercase">{r.reconcileLevel}</td>
                          <td className="py-3 px-4 font-bold text-slate-200">{r.metricCode}</td>
                          <td className="py-3 px-4 text-sky-400">{r.sourceControlValue}</td>
                          <td className="py-3 px-4 text-slate-200">{r.systemCalculatedValue}</td>
                          <td className="py-3 px-4 text-amber-400">{r.difference}</td>
                          <td className="py-3 px-4">
                            {r.status === 'MATCHED' ? (
                              <Badge variant="success">MATCHED 完全匹配</Badge>
                            ) : (
                              <Badge variant="danger">MISMATCH_BLOCKED 差额阻断</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* 原子发布闸门卡片 */}
          <Card className="border-t-4 border-t-emerald-500">
            <CardHeader
              title="正式业务层原子发布闸门 (Publishing Gate)"
              subtitle="严格检查校验阻断规则与对账状态；单事务幂等写入规范事实表，支持余额归底分摊与反向冲正"
            />
            <CardBody className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-orbit-surface2/40 rounded-xl border border-orbit-border">
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    发布目标: 规范事实表 (canonical_orders / canonical_order_items)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    当前批次成熟度: <MaturityBadge status={selectedBatch?.status || 'PROCESSING'} />
                    {selectedBatch?.open_p0_count > 0 && (
                      <span className="text-rose-400 ml-2 font-bold">
                        (⚠️ 存在 {selectedBatch.open_p0_count} 个未解决的 P0 致命错误，发布闸门将拒绝放行！)
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={publishing || selectedBatch?.open_p0_count > 0}
                  onClick={handlePublish}
                >
                  <Lock className="w-4 h-4" />
                  {publishing ? '正在原子发布...' : '满足闸门，正式原子发布'}
                </Button>
              </div>

              {publishMessage && (
                <div
                  className={cn(
                    'p-3.5 rounded-lg text-xs font-mono',
                    publishMessage.startsWith('✅')
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                  )}
                >
                  {publishMessage}
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 4: 7 大电商平台 API 技术规范 ── */}
      {activeTab === 'platforms' && (
        <motion.div {...fadeIn} className="space-y-6">
          <Card>
            <CardHeader
              title="7 大主流电商平台官方 API 技术规范中枢"
              subtitle="严格查阅官方开放平台协议，已落地认证、签名、限流、订单/售后/投放标准适配器"
            />
            <CardBody className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {platformSpecs.map((spec) => (
                  <div
                    key={spec.platformCode}
                    className="p-5 bg-orbit-surface2/40 rounded-xl border border-orbit-border hover:border-orbit-primary/50 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-100">{spec.platformName}</span>
                      <Badge variant="info">{spec.platformCode}</Badge>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="text-slate-400">官方 API 网关:</div>
                      <div className="p-2 bg-orbit-surface rounded border border-orbit-border text-sky-400 break-all">
                        {spec.gatewayUrl}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-xs">
                      <a
                        href={spec.docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-orbit-primary hover:underline flex items-center gap-1"
                      >
                        官方开发文档
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <span className="text-emerald-400 font-semibold">适配器已就绪</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 5: 双轨数据接入测试 ── */}
      {activeTab === 'ingest' && (
        <motion.div {...fadeIn} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* 客户类型 1 */}
            <Card className="border border-orbit-border">
              <CardHeader
                title="客户类型 1: 官方 OpenAPI 增量同步"
                subtitle="拥有平台开发者资质或授权 Token 的商家，自动调度拉取原始报文"
              />
              <CardBody className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">选择同步平台:</label>
                  <select
                    value={uploadPlatform}
                    onChange={(e) => setUploadPlatform(e.target.value)}
                    className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="douyin">抖音电商 (抖店开放平台)</option>
                    <option value="kuaishou">快手电商 (快手开放平台)</option>
                    <option value="taobao">淘宝集市 (TOP 开放平台)</option>
                    <option value="tmall">天猫商城 (天猫商家服务)</option>
                    <option value="jd">京东电商 (宙斯开放平台 JOS)</option>
                    <option value="pdd">拼多多 (MMS 开放平台)</option>
                    <option value="xiaohongshu">小红书电商 (千帆开放平台)</option>
                  </select>
                </div>
                <div className="p-3 bg-orbit-surface rounded border border-orbit-border text-xs text-slate-400">
                  工作机制：系统读取店铺配置的凭证，调用对应平台的 PlatformAdapter 拉取增量订单与退款事件，API 原始 JSON 完整写入不可变原始层 `raw_records`，并自动触发清洗与独立质量校验。
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={syncingApi}
                  onClick={handleTriggerApiSync}
                >
                  <RefreshCw className={cn('w-4 h-4', syncingApi && 'animate-spin')} />
                  {syncingApi ? '正在调用 API 拉取...' : '触发 OpenAPI 增量同步'}
                </Button>
              </CardBody>
            </Card>

            {/* 客户类型 2 */}
            <Card className="border border-orbit-border">
              <CardHeader
                title="客户类型 2: 手动导出报表文件上传"
                subtitle="无 API 开发权限的中小商家，受控上传 Excel / CSV 报表"
              />
              <CardBody className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">选择导入所属平台:</label>
                  <select
                    value={uploadPlatform}
                    onChange={(e) => setUploadPlatform(e.target.value)}
                    className="w-full bg-orbit-surface2 border border-orbit-border rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="douyin">抖音订单导出模板</option>
                    <option value="kuaishou">快手小店导出模板</option>
                    <option value="taobao">淘宝生意参谋导出模板</option>
                    <option value="tmall">天猫旗舰店导出模板</option>
                    <option value="jd">京东京麦导出模板</option>
                    <option value="pdd">拼多多商家后台导出模板</option>
                    <option value="xiaohongshu">小红书千帆导出模板</option>
                  </select>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-orbit-border hover:border-orbit-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-orbit-surface2/30"
                >
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-200">点击或拖拽上传 Excel / CSV 报表</p>
                  <p className="text-[11px] text-slate-500 mt-1">自动 SHA-256 哈希去重 · 防公式注入转义 · 逐行不可变留痕</p>
                </div>
              </CardBody>
            </Card>
          </div>

          {uploadStatusMsg && (
            <div
              className={cn(
                'p-4 rounded-xl text-xs font-mono',
                uploadStatusMsg.startsWith('✅')
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : uploadStatusMsg.startsWith('⏳')
                  ? 'bg-sky-500/10 border border-sky-500/20 text-sky-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              )}
            >
              {uploadStatusMsg}
            </div>
          )}
        </motion.div>
      )}

      {/* ── TAB 6: 实体别名与字段映射 ── */}
      {activeTab === 'aliases' && (
        <motion.div {...fadeIn}>
          <EntityAliasPanel />
        </motion.div>
      )}
    </div>
  )
}
