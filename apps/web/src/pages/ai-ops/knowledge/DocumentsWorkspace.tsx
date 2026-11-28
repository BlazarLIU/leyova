/**
 * 知识库与文档管理中心：集合 CRUD、文件上传入库、手动录入、搜索筛选与在线编辑/重向量化
 */

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  Database,
  Edit3,
  FileText,
  FileUp,
  FolderPlus,
  Layers,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import {
  BUILTIN_COLLECTION_CODES,
  DOMAIN_LABEL,
  INPUT_CLS,
  SELECT_CLS,
  SOURCE_TYPE_LABEL,
  formatTime,
  type CollectionItem,
  type DocumentDetail,
  type DocumentItem,
  type NoticeMessage,
} from './types'

interface DocumentsWorkspaceProps {
  collections: CollectionItem[]
  documents: DocumentItem[]
  docFilterCollection: string
  docFilterStatus: string
  docSearch: string
  onDocFilterCollectionChange: (val: string) => void
  onDocFilterStatusChange: (val: string) => void
  onDocSearchChange: (val: string) => void
  onSearchDocs: () => Promise<void>
  onReloadAll: () => Promise<void>
  onNotify: (msg: NoticeMessage) => void
}

const ACCEPTED_FILE_EXTS = '.pdf,.docx,.xlsx,.xls,.txt,.md,.markdown,.csv,.json,.log'

const isRuleOnlyCollection = (col: Pick<CollectionItem, 'code' | 'domain'>) =>
  col.code === 'banned_words' || col.domain === 'banned'

export function DocumentsWorkspace({
  collections,
  documents,
  docFilterCollection,
  docFilterStatus,
  docSearch,
  onDocFilterCollectionChange,
  onDocFilterStatusChange,
  onDocSearchChange,
  onSearchDocs,
  onReloadAll,
  onNotify,
}: DocumentsWorkspaceProps) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const defaultCollectionCode = collections.find((c) => !isRuleOnlyCollection(c))?.code || collections[0]?.code || 'products'

  // 新建集合弹窗
  const [createColOpen, setCreateColOpen] = useState(false)
  const [createColForm, setCreateColForm] = useState({
    name: '',
    code: '',
    domain: 'document',
    description: '',
    chunkSize: '800',
    chunkOverlap: '100',
  })
  const [creatingCol, setCreatingCol] = useState(false)

  // 编辑集合基础信息弹窗（向量模型配置已统一迁移至「系统配置与 AI → AI 模型」）
  const [editColTarget, setEditColTarget] = useState<CollectionItem | null>(null)
  const [editColForm, setEditColForm] = useState({
    name: '',
    domain: 'document',
    description: '',
    chunkSize: '800',
    chunkOverlap: '100',
  })
  const [savingCol, setSavingCol] = useState(false)

  // 删除集合确认弹窗
  const [deleteColTarget, setDeleteColTarget] = useState<CollectionItem | null>(null)
  const [deletingCol, setDeletingCol] = useState(false)

  // 上传文件弹窗
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDragging, setUploadDragging] = useState(false)
  const [uploadForm, setUploadForm] = useState({ collectionCode: defaultCollectionCode, title: '', businessKey: '' })
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 手动录入弹窗
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState({
    collectionCode: defaultCollectionCode,
    title: '',
    businessKey: '',
    content: '',
  })
  const [ingesting, setIngesting] = useState(false)

  // 查看 / 编辑文档弹窗
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null)
  const [docDetailOpen, setDocDetailOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [docEditForm, setDocEditForm] = useState({
    collectionCode: '',
    title: '',
    businessKey: '',
    content: '',
  })
  const [savingDoc, setSavingDoc] = useState(false)

  // 删除文档确认弹窗
  const [deleteDocTarget, setDeleteDocTarget] = useState<DocumentItem | null>(null)
  const [deletingDoc, setDeletingDoc] = useState(false)

  const handleCreateCollection = async () => {
    if (!createColForm.name.trim() || creatingCol) return
    setCreatingCol(true)
    try {
      await api.post('/kb/collections', {
        name: createColForm.name.trim(),
        code: createColForm.code.trim() || undefined,
        domain: createColForm.domain,
        description: createColForm.description.trim() || undefined,
        chunkSize: Number(createColForm.chunkSize) || 800,
        chunkOverlap: Number(createColForm.chunkOverlap) || 100,
      })
      onNotify({ type: 'success', text: `知识集合「${createColForm.name.trim()}」已创建` })
      setCreateColOpen(false)
      setCreateColForm({ name: '', code: '', domain: 'document', description: '', chunkSize: '800', chunkOverlap: '100' })
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '创建知识集合失败' })
    } finally {
      setCreatingCol(false)
    }
  }

  const openEditCollection = (col: CollectionItem) => {
    setEditColTarget(col)
    setEditColForm({
      name: col.name || '',
      domain: col.domain || 'document',
      description: col.description || '',
      chunkSize: String(col.chunkSize || 800),
      chunkOverlap: String(col.chunkOverlap || 100),
    })
  }

  const handleSaveCollection = async () => {
    if (!editColTarget || savingCol) return
    setSavingCol(true)
    const ruleOnly = isRuleOnlyCollection(editColTarget)
    try {
      await api.put(`/kb/collections/${editColTarget.code}`, {
        name: editColForm.name.trim() || undefined,
        ...(ruleOnly
          ? {}
          : {
              domain: editColForm.domain,
              chunkSize: Number(editColForm.chunkSize) || 800,
              chunkOverlap: Number(editColForm.chunkOverlap) >= 0 ? Number(editColForm.chunkOverlap) : 100,
            }),
        description: editColForm.description.trim(),
      })
      onNotify({ type: 'success', text: `集合「${editColTarget.name}」基础信息已更新。` })
      setEditColTarget(null)
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '保存集合配置失败' })
    } finally {
      setSavingCol(false)
    }
  }

  const handleDeleteCollection = async () => {
    if (!deleteColTarget || deletingCol) return
    setDeletingCol(true)
    try {
      await api.delete(`/kb/collections/${deleteColTarget.code}`)
      onNotify({ type: 'success', text: `集合「${deleteColTarget.name}」已删除` })
      if (docFilterCollection === deleteColTarget.code) {
        onDocFilterCollectionChange('')
      }
      setDeleteColTarget(null)
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '删除集合失败' })
    } finally {
      setDeletingCol(false)
    }
  }

  const openUploadDialog = () => {
    setUploadFile(null)
    setUploadForm({
      collectionCode: docFilterCollection || defaultCollectionCode,
      title: '',
      businessKey: '',
    })
    setUploadOpen(true)
  }

  const handleUploadSubmit = async () => {
    if (!uploadFile || uploading) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('collectionCode', uploadForm.collectionCode || defaultCollectionCode)
      if (uploadForm.title.trim()) form.append('title', uploadForm.title.trim())
      if (uploadForm.businessKey.trim()) form.append('businessKey', uploadForm.businessKey.trim())
      form.append('file', uploadFile)

      const res = await api.upload<any>('/kb/documents/upload', form)
      onNotify({
        type: 'success',
        text: `文件「${res.title || uploadFile.name}」入库完成：提取 ${res.extractedChars ?? 0} 字，切分 ${res.chunkCount} 个切片，向量化 ${res.embedded} 个${res.embeddingDegraded ? `（降级：${res.embeddingReason}）` : ''}`,
      })
      setUploadOpen(false)
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '文件上传入库失败' })
    } finally {
      setUploading(false)
    }
  }

  const openManualDialog = () => {
    setManualForm({
      collectionCode: docFilterCollection || defaultCollectionCode,
      title: '',
      businessKey: '',
      content: '',
    })
    setManualOpen(true)
  }

  const handleManualSubmit = async () => {
    if (!manualForm.title.trim() || !manualForm.content.trim() || ingesting) return
    setIngesting(true)
    try {
      const res = await api.post<any>('/kb/documents', {
        collectionCode: manualForm.collectionCode,
        title: manualForm.title.trim(),
        content: manualForm.content,
        businessKey: manualForm.businessKey.trim() || undefined,
      })
      onNotify({
        type: 'success',
        text: `文档入库完成：${res.chunkCount} 个切片，向量化 ${res.embedded} 个${res.embeddingDegraded ? `（降级：${res.embeddingReason}）` : ''}`,
      })
      setManualOpen(false)
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '手动入库失败' })
    } finally {
      setIngesting(false)
    }
  }

  const openDocDetail = async (doc: DocumentItem) => {
    setDocDetailOpen(true)
    setLoadingDetail(true)
    setDocDetail(null)
    try {
      const detail = await api.get<DocumentDetail>(`/kb/documents/${doc.id}`)
      setDocDetail(detail)
      setDocEditForm({
        collectionCode: detail.collectionCode,
        title: detail.title,
        businessKey: detail.businessKey || '',
        content: detail.fullContent || '',
      })
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '加载文档详情失败' })
      setDocDetailOpen(false)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSaveDoc = async () => {
    if (!docDetail || !docEditForm.title.trim() || savingDoc) return
    setSavingDoc(true)
    try {
      const res = await api.put<any>(`/kb/documents/${docDetail.id}`, {
        collectionCode: docEditForm.collectionCode,
        title: docEditForm.title.trim(),
        businessKey: docEditForm.businessKey.trim(),
        content: docEditForm.content,
      })
      onNotify({
        type: 'success',
        text: `文档已更新至 v${res.docVersion}：重新切分 ${res.chunkCount} 个切片，向量化 ${res.embedded} 个${res.embeddingDegraded ? `（降级：${res.embeddingReason}）` : ''}`,
      })
      // 刷新详情与外部列表
      const refreshed = await api.get<DocumentDetail>(`/kb/documents/${docDetail.id}`).catch(() => null)
      if (refreshed) setDocDetail(refreshed)
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '更新文档失败' })
    } finally {
      setSavingDoc(false)
    }
  }

  const handleDeleteDoc = async () => {
    if (!deleteDocTarget || deletingDoc) return
    setDeletingDoc(true)
    try {
      await api.delete(`/kb/documents/${deleteDocTarget.id}`)
      onNotify({ type: 'success', text: `文档「${deleteDocTarget.title}」已删除并级联清理切片` })
      setDeleteDocTarget(null)
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '删除文档失败' })
    } finally {
      setDeletingDoc(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 集合管理卡片 */}
      <Card>
        <CardHeader
          title="知识库集合管理"
          subtitle="内置 4 大基础集合（商品 / 脚本 / 违禁词 / 回放）受保护不可删除；点击集合卡片可按集合筛选文档。"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {isSuperAdmin && (
                <Link
                  to="/system/config?tab=ai"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-orbit-border px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-orbit-primary/45 hover:text-orbit-primary"
                >
                  <Bot className="h-3.5 w-3.5 text-status-ai" />
                  <span>向量模型统一配置</span>
                </Link>
              )}
              <Button size="sm" variant="primary" onClick={() => setCreateColOpen(true)}>
                <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                新建集合
              </Button>
            </div>
          }
        />
        <CardBody>
          {collections.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">暂无知识集合</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {collections.map((col) => {
                const isBuiltin = BUILTIN_COLLECTION_CODES.has(col.code)
                const isRuleOnly = isRuleOnlyCollection(col)
                const isSelected = docFilterCollection === col.code
                return (
                  <div
                    key={col.id}
                    onClick={() => onDocFilterCollectionChange(isSelected ? '' : col.code)}
                    className={`cursor-pointer rounded-lg border px-3.5 py-3 transition-colors ${
                      isSelected
                        ? 'border-orbit-primary bg-orbit-primary/5'
                        : 'border-orbit-border bg-orbit-ink/40 hover:border-orbit-border2'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isRuleOnly ? (
                          <ShieldCheck className="h-4 w-4 text-status-ai" />
                        ) : (
                          <Database className="h-4 w-4 text-status-ai" />
                        )}
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{col.name}</span>
                        <code className="rounded bg-orbit-surface2 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                          {col.code}
                        </code>
                        <Badge variant="info">{DOMAIN_LABEL[col.domain] || col.domain}</Badge>
                        {isBuiltin && <Badge variant="neutral">内置</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button size="xs" variant="outline" onClick={() => openEditCollection(col)}>
                          <Settings2 className="mr-1 h-3 w-3" />
                          {isRuleOnly ? '详情' : '配置'}
                        </Button>
                        {!isBuiltin && (
                          <Button size="xs" variant="destructive" onClick={() => setDeleteColTarget(col)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-[11px] text-[var(--text-muted)]">
                      {col.description || '暂无领域描述'}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                      {isRuleOnly ? (
                        <>
                          <span className="text-[var(--text-secondary)]">DFA 确定性匹配规则库</span>
                          <Badge variant="info">规则引擎（无需向量模型）</Badge>
                        </>
                      ) : (
                        <>
                          <span className="text-[var(--text-secondary)]">
                            {col.documentCount} 文档 / {col.chunkCount} 切片
                          </span>
                          <span className="text-[var(--text-subtle)]">
                            分块 {col.chunkSize}/{col.chunkOverlap}
                          </span>
                          {col.embeddingModel ? (
                            <Badge variant="success">
                              {col.embeddingModel}
                              {col.embeddingDim ? ` · ${col.embeddingDim}d` : ''}
                            </Badge>
                          ) : (
                            <Badge variant="neutral">关键词检索（未绑定向量）</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 文档管理综合列表 */}
      <Card>
        <CardHeader
          title="知识文档管理"
          subtitle="支持多格式文件上传自动解析入库、手动录入、全文检索与在线编辑重新向量化。"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={openManualDialog}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                手动录入
              </Button>
              <Button size="sm" variant="primary" onClick={openUploadDialog}>
                <FileUp className="mr-1 h-3.5 w-3.5" />
                上传文件入库
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-3">
          {/* 筛选栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-subtle)]" />
              <input
                placeholder="搜索标题、业务键（如 SPU）或来源文件名…"
                value={docSearch}
                onChange={(e) => onDocSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onSearchDocs()
                }}
                className={`${INPUT_CLS} pl-8`}
              />
            </div>
            <select
              value={docFilterCollection}
              onChange={(e) => onDocFilterCollectionChange(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">全部集合</option>
              {collections.map((col) => (
                <option key={col.id} value={col.code}>
                  {col.name} ({col.code})
                </option>
              ))}
            </select>
            <select
              value={docFilterStatus}
              onChange={(e) => onDocFilterStatusChange(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">全部状态</option>
              <option value="ready">就绪 (ready)</option>
              <option value="processing">处理中 (processing)</option>
              <option value="failed">失败 (failed)</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => void onSearchDocs()}>
              筛选
            </Button>
          </div>

          {/* 文档表格 */}
          <div className="overflow-x-auto rounded-lg border border-orbit-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-orbit-border bg-orbit-surface2/60 text-[11px] text-[var(--text-muted)]">
                  <th className="px-3 py-2 font-semibold">文档标题</th>
                  <th className="px-3 py-2 font-semibold">所属集合</th>
                  <th className="px-3 py-2 font-semibold">业务键</th>
                  <th className="px-3 py-2 font-semibold">来源</th>
                  <th className="px-3 py-2 font-semibold">状态</th>
                  <th className="px-3 py-2 font-semibold">切片</th>
                  <th className="px-3 py-2 font-semibold">更新时间</th>
                  <th className="px-3 py-2 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orbit-border/60">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">
                      暂无匹配的知识文档，点击右上角「上传文件入库」或「手动录入」新增。
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-orbit-surface2/30">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-status-ai" />
                          <button
                            type="button"
                            onClick={() => void openDocDetail(doc)}
                            className="text-left font-medium text-[var(--text-primary)] hover:text-orbit-primary hover:underline"
                          >
                            {doc.title}
                          </button>
                          {doc.docVersion && (
                            <span className="text-[10px] text-[var(--text-subtle)]">v{doc.docVersion}</span>
                          )}
                        </div>
                        {doc.sourceRef && (
                          <p className="mt-0.5 truncate pl-5 text-[10px] text-[var(--text-subtle)]">{doc.sourceRef}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="info">{doc.collectionName || doc.collectionCode}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-secondary)]">{doc.businessKey || '—'}</td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)]">
                        {SOURCE_TYPE_LABEL[doc.sourceType || 'text'] || doc.sourceType || '手动文本'}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={doc.status === 'ready' ? 'success' : doc.status === 'failed' ? 'danger' : 'warning'}>
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-secondary)]">{doc.chunkCount}</td>
                      <td className="px-3 py-2.5 text-[11px] text-[var(--text-subtle)]">
                        {formatTime(doc.updatedAt || doc.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button size="xs" variant="outline" onClick={() => void openDocDetail(doc)}>
                            <Edit3 className="mr-1 h-3 w-3" />
                            查看/编辑
                          </Button>
                          <Button size="xs" variant="destructive" onClick={() => setDeleteDocTarget(doc)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* 弹窗 1：新建集合 */}
      <Dialog open={createColOpen} onOpenChange={setCreateColOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建自定义知识集合</DialogTitle>
            <DialogDescription>创建独立业务知识集合并配置默认分块策略。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">集合名称 *</label>
              <input
                placeholder="例如：售后话术与客诉案例"
                value={createColForm.name}
                onChange={(e) => setCreateColForm((p) => ({ ...p, name: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">集合标识 code（选填）</label>
                <input
                  placeholder="留空自动生成，如 after_sales"
                  value={createColForm.code}
                  onChange={(e) => setCreateColForm((p) => ({ ...p, code: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">业务领域</label>
                <select
                  value={createColForm.domain}
                  onChange={(e) => setCreateColForm((p) => ({ ...p, domain: e.target.value }))}
                  className={`${SELECT_CLS} w-full`}
                >
                  <option value="document">通用文档</option>
                  <option value="product">商品知识</option>
                  <option value="script">直播脚本</option>
                  <option value="replay">复盘回放</option>
                  <option value="banned">合规规则</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">分块长度 (100–4000)</label>
                <input
                  type="number"
                  min={100}
                  max={4000}
                  value={createColForm.chunkSize}
                  onChange={(e) => setCreateColForm((p) => ({ ...p, chunkSize: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">分块重叠 (0–2000)</label>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  value={createColForm.chunkOverlap}
                  onChange={(e) => setCreateColForm((p) => ({ ...p, chunkOverlap: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">描述</label>
              <textarea
                rows={2}
                placeholder="描述该集合收纳的知识范围与用途"
                value={createColForm.description}
                onChange={(e) => setCreateColForm((p) => ({ ...p, description: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateColOpen(false)}>
              取消
            </Button>
            <Button variant="primary" size="sm" loading={creatingCol} onClick={() => void handleCreateCollection()}>
              确认创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 弹窗 2：编辑集合基础信息 */}
      <Dialog open={Boolean(editColTarget)} onOpenChange={(open) => !open && setEditColTarget(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editColTarget && isRuleOnlyCollection(editColTarget) ? '规则集合详情' : '编辑集合信息'} · {editColTarget?.code}
            </DialogTitle>
            <DialogDescription>
              {editColTarget && isRuleOnlyCollection(editColTarget)
                ? '违禁词库使用确定性 DFA 规则引擎进行精准匹配，不经过切片与 AI 向量模型。'
                : '修改集合名称、领域与默认文本分块参数；AI 向量模型请前往「系统配置与 AI → AI 模型」统一配置。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div className={editColTarget && isRuleOnlyCollection(editColTarget) ? '' : 'grid grid-cols-2 gap-3'}>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">集合名称</label>
                <input
                  value={editColForm.name}
                  onChange={(e) => setEditColForm((p) => ({ ...p, name: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
              {editColTarget && !isRuleOnlyCollection(editColTarget) && (
                <div>
                  <label className="mb-1 block font-medium text-[var(--text-secondary)]">业务领域</label>
                  <select
                    value={editColForm.domain}
                    onChange={(e) => setEditColForm((p) => ({ ...p, domain: e.target.value }))}
                    className={`${SELECT_CLS} w-full`}
                  >
                    <option value="document">通用文档</option>
                    <option value="product">商品知识</option>
                    <option value="script">直播脚本</option>
                    <option value="replay">复盘回放</option>
                  </select>
                </div>
              )}
            </div>
            {editColTarget && !isRuleOnlyCollection(editColTarget) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-[var(--text-secondary)]">分块长度</label>
                  <input
                    type="number"
                    min={100}
                    max={4000}
                    value={editColForm.chunkSize}
                    onChange={(e) => setEditColForm((p) => ({ ...p, chunkSize: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[var(--text-secondary)]">分块重叠</label>
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    value={editColForm.chunkOverlap}
                    onChange={(e) => setEditColForm((p) => ({ ...p, chunkOverlap: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            )}
            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">描述</label>
              <textarea
                rows={2}
                value={editColForm.description}
                onChange={(e) => setEditColForm((p) => ({ ...p, description: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>

            {editColTarget && isRuleOnlyCollection(editColTarget) ? (
              <div className="rounded-lg border border-orbit-info/30 bg-orbit-info/10 p-3 text-[11px] text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)]">DFA 确定性合规规则引擎</p>
                <p className="mt-1 text-[var(--text-muted)]">
                  违禁词校验走确定性 Aho-Corasick 自动机，支持全半角与分隔符绕过识别，无需且不支持配置 AI 向量模型。词条增删改与批量导入请在「违禁词规则中心」页签中操作。
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orbit-border bg-orbit-surface2/40 p-3 text-[11px]">
                <div className="space-y-0.5">
                  <p className="font-semibold text-[var(--text-primary)]">
                    当前向量模型：{editColTarget?.embeddingModel || '未配置（仅关键词检索）'}
                  </p>
                  <p className="text-[var(--text-muted)]">
                    AI 大模型、Embedding 供应商密钥与集合向量绑定已统一集中管理。
                  </p>
                </div>
                {isSuperAdmin && (
                  <Link
                    to="/system/config?tab=ai"
                    onClick={() => setEditColTarget(null)}
                    className="inline-flex items-center gap-1 rounded-md border border-orbit-primary/40 bg-orbit-primary/10 px-2.5 py-1 font-semibold text-orbit-primary hover:bg-orbit-primary/15"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    去「AI 模型配置」设置
                  </Link>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditColTarget(null)}>
              取消
            </Button>
            <Button variant="primary" size="sm" loading={savingCol} onClick={() => void handleSaveCollection()}>
              保存信息
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 弹窗 3：删除集合确认 */}
      <Dialog open={Boolean(deleteColTarget)} onOpenChange={(open) => !open && setDeleteColTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除集合「{deleteColTarget?.name}」？</DialogTitle>
            <DialogDescription>
              删除集合将连同清理其下关联文档与切片（仅自定义集合支持删除），操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteColTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" loading={deletingCol} onClick={() => void handleDeleteCollection()}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 弹窗 4：上传文件入库 */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>上传文件入库</DialogTitle>
            <DialogDescription>
              支持 PDF、Word (.docx)、Excel (.xlsx / .xls)、TXT、Markdown、CSV、JSON，自动抽取正文并分块向量化。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setUploadDragging(true)
              }}
              onDragLeave={() => setUploadDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setUploadDragging(false)
                const dropped = e.dataTransfer.files?.[0]
                if (dropped) setUploadFile(dropped)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                uploadDragging
                  ? 'border-orbit-primary bg-orbit-primary/10'
                  : 'border-orbit-border bg-orbit-ink/40 hover:border-orbit-primary/50'
              }`}
            >
              <Upload className="mb-2 h-6 w-6 text-status-ai" />
              {uploadFile ? (
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--text-primary)]">{uploadFile.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {(uploadFile.size / 1024).toFixed(1)} KB · 点击可重新选择
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium text-[var(--text-primary)]">点击选择或拖拽文件到此处</p>
                  <p className="text-[11px] text-[var(--text-muted)]">支持 .pdf / .docx / .xlsx / .xls / .txt / .md / .csv</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_EXTS}
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] || null
                  setUploadFile(chosen)
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">目标集合</label>
                <select
                  value={uploadForm.collectionCode}
                  onChange={(e) => setUploadForm((p) => ({ ...p, collectionCode: e.target.value }))}
                  className={`${SELECT_CLS} w-full`}
                >
                  {collections.map((col) => (
                    <option key={col.id} value={col.code}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">业务键（可选）</label>
                <input
                  placeholder="如 SPU 编码、活动代号"
                  value={uploadForm.businessKey}
                  onChange={(e) => setUploadForm((p) => ({ ...p, businessKey: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">文档标题（留空默认文件名）</label>
              <input
                placeholder="自定义文档标题"
                value={uploadForm.title}
                onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={uploading}
              disabled={!uploadFile}
              onClick={() => void handleUploadSubmit()}
            >
              上传并入库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 弹窗 5：手动录入 */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>手动录入知识文档</DialogTitle>
            <DialogDescription>输入正文后将自动清洗、分块、向量化并写入索引版本。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">目标集合</label>
                <select
                  value={manualForm.collectionCode}
                  onChange={(e) => setManualForm((p) => ({ ...p, collectionCode: e.target.value }))}
                  className={`${SELECT_CLS} w-full`}
                >
                  {collections.map((col) => (
                    <option key={col.id} value={col.code}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">文档标题 *</label>
                <input
                  placeholder="例如：秋季羽绒服卖点卡"
                  value={manualForm.title}
                  onChange={(e) => setManualForm((p) => ({ ...p, title: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">业务键（可选）</label>
                <input
                  placeholder="如 SPU 编码"
                  value={manualForm.businessKey}
                  onChange={(e) => setManualForm((p) => ({ ...p, businessKey: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">文档正文 *</label>
              <textarea
                rows={10}
                placeholder="粘贴文档正文；PDF 纯文本可用换页符 \f 保留页码"
                value={manualForm.content}
                onChange={(e) => setManualForm((p) => ({ ...p, content: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setManualOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={ingesting}
              disabled={!manualForm.title.trim() || !manualForm.content.trim()}
              onClick={() => void handleManualSubmit()}
            >
              开始入库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 弹窗 6：查看 / 在线编辑文档与切片 */}
      <Dialog open={docDetailOpen} onOpenChange={setDocDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-status-ai" />
              <span>查看与编辑文档</span>
              {docDetail?.docVersion && <Badge variant="info">v{docDetail.docVersion}</Badge>}
            </DialogTitle>
            <DialogDescription>
              修改标题、集合、业务键或正文并保存后，系统将自动重新分块清洗并重新向量化。
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <p className="py-8 text-center text-xs text-[var(--text-muted)]">正在加载文档正文与切片明细…</p>
          ) : docDetail ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium text-[var(--text-secondary)]">所属集合</label>
                  <select
                    value={docEditForm.collectionCode}
                    onChange={(e) => setDocEditForm((p) => ({ ...p, collectionCode: e.target.value }))}
                    className={`${SELECT_CLS} w-full`}
                  >
                    {collections.map((col) => (
                      <option key={col.id} value={col.code}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[var(--text-secondary)]">文档标题 *</label>
                  <input
                    value={docEditForm.title}
                    onChange={(e) => setDocEditForm((p) => ({ ...p, title: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[var(--text-secondary)]">业务键</label>
                  <input
                    value={docEditForm.businessKey}
                    onChange={(e) => setDocEditForm((p) => ({ ...p, businessKey: e.target.value }))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">完整正文</label>
                <textarea
                  rows={9}
                  value={docEditForm.content}
                  onChange={(e) => setDocEditForm((p) => ({ ...p, content: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>

              <div className="space-y-2 rounded-lg border border-orbit-border bg-orbit-surface2/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                    <Layers className="h-3.5 w-3.5 text-status-ai" />
                    当前分块切片明细（共 {docDetail.chunks?.length ?? 0} 个）
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    最近更新：{formatTime(docDetail.updatedAt)}
                  </span>
                </div>
                {docDetail.chunks?.length ? (
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {docDetail.chunks.map((chunk) => (
                      <div key={chunk.id} className="rounded border border-orbit-border bg-orbit-ink/50 p-2">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
                          <Badge variant="neutral">#{chunk.seq}</Badge>
                          <span>{chunk.tokenCount} tokens</span>
                          {chunk.pageNo !== null && <span>第 {chunk.pageNo} 页</span>}
                          {chunk.startMs !== null && (
                            <span>
                              {Math.floor(chunk.startMs / 1000)}s–{Math.floor((chunk.endMs ?? chunk.startMs) / 1000)}s
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--text-secondary)]">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--text-muted)]">暂无切片</p>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDocDetailOpen(false)}>
              关闭
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={savingDoc}
              disabled={!docDetail || !docEditForm.title.trim()}
              onClick={() => void handleSaveDoc()}
            >
              保存并重新向量化
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 弹窗 7：删除文档确认 */}
      <Dialog open={Boolean(deleteDocTarget)} onOpenChange={(open) => !open && setDeleteDocTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除文档「{deleteDocTarget?.title}」？</DialogTitle>
            <DialogDescription>删除文档会同时级联清理该文档下的全部向量切片，操作不可恢复。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDocTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" loading={deletingDoc} onClick={() => void handleDeleteDoc()}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
