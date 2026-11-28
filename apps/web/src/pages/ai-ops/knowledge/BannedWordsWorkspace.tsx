/**
 * 违禁词规则中心：单条录入、批量导入、规则列表（搜索/筛选/Switch 启停/动作调整/删除）、
 * 内置兜底词库查看与实时文案合规扫描
 */

import { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, ListPlus, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { api } from '@/services/api'
import {
  ACTION_LABEL,
  CATEGORY_LABEL,
  INPUT_CLS,
  PLATFORM_LABEL,
  SELECT_CLS,
  SEVERITY_LABEL,
  type BannedWord,
  type DefaultBannedRule,
  type NoticeMessage,
  type ScanResult,
} from './types'

interface BannedWordsWorkspaceProps {
  bannedWords: BannedWord[]
  defaultCount: number
  onReloadAll: () => Promise<void>
  onNotify: (msg: NoticeMessage) => void
}

const SEVERITY_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
}

export function BannedWordsWorkspace({
  bannedWords,
  defaultCount,
  onReloadAll,
  onNotify,
}: BannedWordsWorkspaceProps) {
  // 单条添加
  const [newWord, setNewWord] = useState({
    word: '',
    category: 'absolute',
    severity: 'high',
    action: 'block',
    platform: 'all',
  })
  const [addingWord, setAddingWord] = useState(false)

  // 批量导入弹窗
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [batchConfig, setBatchConfig] = useState({
    category: 'absolute',
    severity: 'high',
    action: 'block',
    platform: 'all',
  })
  const [importingBatch, setImportingBatch] = useState(false)

  // 列表筛选
  const [wordSearch, setWordSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [updatingId, setUpdatingId] = useState<string>('')

  // 内置兜底词库展开查看
  const [defaultsExpanded, setDefaultsExpanded] = useState(false)
  const [defaultsLoading, setDefaultsLoading] = useState(false)
  const [defaultRules, setDefaultRules] = useState<DefaultBannedRule[] | null>(null)
  const [defaultSearch, setDefaultSearch] = useState('')

  // 实时扫描
  const [scanText, setScanText] = useState('')
  const [scanPlatform, setScanPlatform] = useState('all')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)

  const filteredWords = useMemo(() => {
    const q = wordSearch.trim().toLowerCase()
    return bannedWords.filter((w) => {
      if (platformFilter && w.platform !== platformFilter) return false
      if (categoryFilter && w.category !== categoryFilter) return false
      if (q && !w.word.toLowerCase().includes(q)) return false
      return true
    })
  }, [bannedWords, wordSearch, platformFilter, categoryFilter])

  const filteredDefaults = useMemo(() => {
    if (!defaultRules) return []
    const q = defaultSearch.trim().toLowerCase()
    if (!q) return defaultRules
    return defaultRules.filter(
      (r) =>
        r.word.toLowerCase().includes(q) ||
        (CATEGORY_LABEL[r.category] || r.category).toLowerCase().includes(q)
    )
  }, [defaultRules, defaultSearch])

  const handleAddWord = async () => {
    if (!newWord.word.trim() || addingWord) return
    setAddingWord(true)
    try {
      await api.post('/kb/banned-words', {
        ...newWord,
        word: newWord.word.trim(),
      })
      onNotify({ type: 'success', text: `违禁词「${newWord.word.trim()}」已保存` })
      setNewWord((prev) => ({ ...prev, word: '' }))
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '添加违禁词失败' })
    } finally {
      setAddingWord(false)
    }
  }

  const handleBatchImport = async () => {
    const words = Array.from(
      new Set(
        batchText
          .split(/[\n,，、;；]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    )
    if (words.length === 0 || importingBatch) return
    setImportingBatch(true)
    try {
      const res = await api.post<{ count: number }>('/kb/banned-words/batch', {
        words,
        ...batchConfig,
      })
      onNotify({ type: 'success', text: `批量导入完成：共写入 ${res.count} 条违禁词规则` })
      setBatchOpen(false)
      setBatchText('')
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '批量导入失败' })
    } finally {
      setImportingBatch(false)
    }
  }

  const handleToggleEnabled = async (rule: BannedWord, nextEnabled: boolean) => {
    setUpdatingId(rule.id)
    try {
      await api.put(`/kb/banned-words/${rule.id}`, { enabled: nextEnabled })
      onNotify({
        type: 'success',
        text: `规则「${rule.word}」已${nextEnabled ? '启用' : '停用'}`,
      })
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '切换规则状态失败' })
    } finally {
      setUpdatingId('')
    }
  }

  const handleChangeAction = async (rule: BannedWord, action: string) => {
    setUpdatingId(rule.id)
    try {
      await api.put(`/kb/banned-words/${rule.id}`, { action })
      onNotify({
        type: 'success',
        text: `规则「${rule.word}」处置动作已更新为「${ACTION_LABEL[action] || action}」`,
      })
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '更新处置动作失败' })
    } finally {
      setUpdatingId('')
    }
  }

  const handleDeleteWord = async (rule: BannedWord) => {
    setUpdatingId(rule.id)
    try {
      await api.delete(`/kb/banned-words/${rule.id}`)
      onNotify({ type: 'success', text: `已删除违禁词「${rule.word}」` })
      await onReloadAll()
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '删除违禁词失败' })
    } finally {
      setUpdatingId('')
    }
  }

  const toggleDefaultsPanel = async () => {
    const next = !defaultsExpanded
    setDefaultsExpanded(next)
    if (next && defaultRules === null && !defaultsLoading) {
      setDefaultsLoading(true)
      try {
        const res = await api.get<{ items: DefaultBannedRule[] }>('/kb/banned-words/defaults')
        setDefaultRules(res.items || [])
      } catch (err: any) {
        onNotify({ type: 'error', text: err?.message || '加载内置兜底词库失败' })
      } finally {
        setDefaultsLoading(false)
      }
    }
  }

  const handleScan = async () => {
    if (!scanText.trim() || scanning) return
    setScanning(true)
    try {
      const res = await api.post<ScanResult>('/kb/banned-words/scan', {
        text: scanText,
        platform: scanPlatform === 'all' ? undefined : scanPlatform,
      })
      setScanResult(res)
    } catch (err: any) {
      onNotify({ type: 'error', text: err?.message || '文案合规扫描失败' })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 规则管理主卡片 */}
      <Card>
        <CardHeader
          title="违禁词规则中心"
          subtitle="DFA/ACF 确定性匹配，自动识别全角、空格与特殊符号绕过；支持按平台、处置动作与实时开关维护。"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">自定义 {bannedWords.length} 条</Badge>
              <Button size="sm" variant="outline" onClick={() => void toggleDefaultsPanel()}>
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                内置兜底词库 ({defaultRules?.length ?? defaultCount})
                {defaultsExpanded ? (
                  <ChevronUp className="ml-1 h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                )}
              </Button>
              <Button size="sm" variant="primary" onClick={() => setBatchOpen(true)}>
                <ListPlus className="mr-1.5 h-3.5 w-3.5" />
                批量导入
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          {/* 单条快捷录入 */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orbit-border bg-orbit-surface2/30 p-3">
            <input
              placeholder="新增违禁词，如：全网最低价"
              value={newWord.word}
              onChange={(e) => setNewWord((prev) => ({ ...prev, word: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddWord()
              }}
              className="min-w-[180px] flex-1 rounded-lg border border-orbit-border bg-orbit-ink px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:border-orbit-primary/60 focus:outline-none"
            />
            <select
              value={newWord.category}
              onChange={(e) => setNewWord((prev) => ({ ...prev, category: e.target.value }))}
              className={SELECT_CLS}
            >
              <option value="absolute">极限词</option>
              <option value="medical">医疗功效</option>
              <option value="financial">金融承诺</option>
              <option value="platform">平台禁用</option>
              <option value="politics">涉政敏感</option>
              <option value="other">其他</option>
            </select>
            <select
              value={newWord.severity}
              onChange={(e) => setNewWord((prev) => ({ ...prev, severity: e.target.value }))}
              className={SELECT_CLS}
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="critical">严重</option>
            </select>
            <select
              value={newWord.action}
              onChange={(e) => setNewWord((prev) => ({ ...prev, action: e.target.value }))}
              className={SELECT_CLS}
            >
              <option value="block">阻断</option>
              <option value="warn">告警</option>
              <option value="rewrite">改写</option>
            </select>
            <select
              value={newWord.platform}
              onChange={(e) => setNewWord((prev) => ({ ...prev, platform: e.target.value }))}
              className={SELECT_CLS}
            >
              <option value="all">全平台</option>
              <option value="douyin">抖音</option>
              <option value="kuaishou">快手</option>
              <option value="wechat_video">微信视频号</option>
            </select>
            <Button size="sm" variant="primary" loading={addingWord} onClick={() => void handleAddWord()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              添加规则
            </Button>
          </div>

          {/* 内置兜底词库（展开区） */}
          {defaultsExpanded && (
            <div className="space-y-2 rounded-lg border border-orbit-border bg-orbit-ink/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  系统内置兜底违禁词库（未自定义或叠加生效时自动启用）
                </span>
                <input
                  placeholder="筛选兜底词条或分类…"
                  value={defaultSearch}
                  onChange={(e) => setDefaultSearch(e.target.value)}
                  className="w-56 rounded-lg border border-orbit-border bg-orbit-ink px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                />
              </div>
              {defaultsLoading ? (
                <p className="py-3 text-xs text-[var(--text-muted)]">加载内置词库中…</p>
              ) : (
                <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pt-1">
                  {filteredDefaults.map((rule, idx) => (
                    <span
                      key={`${rule.word}-${idx}`}
                      className="inline-flex items-center gap-1.5 rounded border border-orbit-border bg-orbit-surface2/50 px-2 py-1 text-[11px] text-[var(--text-secondary)]"
                    >
                      <span className="font-medium text-[var(--text-primary)]">{rule.word}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {CATEGORY_LABEL[rule.category] || rule.category} · {ACTION_LABEL[rule.action] || rule.action}
                      </span>
                    </span>
                  ))}
                  {filteredDefaults.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)]">无匹配的内置兜底规则</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 列表筛选栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-subtle)]" />
              <input
                placeholder="按关键词搜索规则…"
                value={wordSearch}
                onChange={(e) => setWordSearch(e.target.value)}
                className={`${INPUT_CLS} pl-8`}
              />
            </div>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">全部平台</option>
              <option value="all">全平台通用</option>
              <option value="douyin">抖音</option>
              <option value="kuaishou">快手</option>
              <option value="wechat_video">微信视频号</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">全部分类</option>
              <option value="absolute">极限词</option>
              <option value="medical">医疗功效</option>
              <option value="financial">金融承诺</option>
              <option value="platform">平台禁用</option>
              <option value="politics">涉政敏感</option>
              <option value="other">其他</option>
            </select>
          </div>

          {/* 违禁词规则表格 */}
          <div className="overflow-x-auto rounded-lg border border-orbit-border">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-orbit-border bg-orbit-surface2/60 text-[11px] text-[var(--text-muted)]">
                  <th className="px-3 py-2 font-semibold">违禁词</th>
                  <th className="px-3 py-2 font-semibold">分类</th>
                  <th className="px-3 py-2 font-semibold">级别</th>
                  <th className="px-3 py-2 font-semibold">适用平台</th>
                  <th className="px-3 py-2 font-semibold">处置动作</th>
                  <th className="px-3 py-2 font-semibold">启用状态</th>
                  <th className="px-3 py-2 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orbit-border/60">
                {filteredWords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">
                      {bannedWords.length === 0
                        ? '尚未添加自定义规则（当前自动使用系统内置兜底词库）'
                        : '没有符合当前筛选条件的规则'}
                    </td>
                  </tr>
                ) : (
                  filteredWords.map((rule) => (
                    <tr key={rule.id} className={!rule.enabled ? 'opacity-60' : 'hover:bg-orbit-surface2/30'}>
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                        {rule.word}{' '}
                        <span className="text-[10px] font-normal text-[var(--text-subtle)]">v{rule.wordVersion}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="neutral">{CATEGORY_LABEL[rule.category] || rule.category}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={SEVERITY_VARIANT[rule.severity] || 'neutral'}>
                          {SEVERITY_LABEL[rule.severity] || rule.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">
                        {PLATFORM_LABEL[rule.platform] || rule.platform}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={rule.action}
                          disabled={updatingId === rule.id}
                          onChange={(e) => void handleChangeAction(rule, e.target.value)}
                          className="rounded border border-orbit-border bg-orbit-ink px-2 py-1 text-[11px] text-[var(--text-primary)]"
                        >
                          <option value="block">阻断 (block)</option>
                          <option value="warn">告警 (warn)</option>
                          <option value="rewrite">改写 (rewrite)</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.enabled}
                            disabled={updatingId === rule.id}
                            onCheckedChange={(checked) => void handleToggleEnabled(rule, checked)}
                          />
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {rule.enabled ? '启用' : '禁用'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={updatingId === rule.id}
                          onClick={() => void handleDeleteWord(rule)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* 实时文案扫描与拦截检测 */}
      <Card>
        <CardHeader
          title="实时文案合规扫描"
          subtitle="输入待播话术、商品详情或投流文案，立即检测是否触发当前启用规则及兜底词库。"
        />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">模拟校验平台：</span>
            <select
              value={scanPlatform}
              onChange={(e) => setScanPlatform(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="all">全平台（含通用规则）</option>
              <option value="douyin">抖音</option>
              <option value="kuaishou">快手</option>
              <option value="wechat_video">微信视频号</option>
            </select>
          </div>
          <textarea
            rows={4}
            placeholder="粘贴待审直播话术或短视频文案，例如：今天这款产品绝对全网第一，包治百病，无效全额退款…"
            value={scanText}
            onChange={(e) => setScanText(e.target.value)}
            className={INPUT_CLS}
          />
          <Button
            size="sm"
            variant="primary"
            loading={scanning}
            disabled={!scanText.trim()}
            onClick={() => void handleScan()}
          >
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
            立即扫描合规风险
          </Button>

          {scanResult && (
            <div className="space-y-2 rounded-lg border border-orbit-border bg-orbit-surface2/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={scanResult.blocked ? 'danger' : scanResult.matched.length ? 'warning' : 'success'}>
                  {scanResult.blocked
                    ? '命中阻断规则（禁止发布/播报）'
                    : scanResult.matched.length
                      ? '存在告警/建议改写词条'
                      : '检测通过，未命中违规词'}
                </Badge>
                <span className="text-[11px] text-[var(--text-muted)]">
                  参与校验规则数：{scanResult.ruleCount ?? 0} · 命中 {scanResult.matched.length} 项
                </span>
              </div>
              {scanResult.matched.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {scanResult.matched.map((m, i) => (
                    <div
                      key={`${m.word}-${i}`}
                      className="flex flex-wrap items-center gap-2 rounded border border-orbit-border bg-orbit-ink/50 px-2.5 py-1.5 text-xs"
                    >
                      <Badge variant={m.action === 'block' ? 'danger' : 'warning'}>
                        {ACTION_LABEL[m.action] || m.action}
                      </Badge>
                      <span className="font-semibold text-[var(--text-primary)]">{m.word}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {CATEGORY_LABEL[m.category] || m.category} · {SEVERITY_LABEL[m.severity] || m.severity}
                      </span>
                      {m.excerpt && (
                        <span className="text-[11px] text-[var(--text-secondary)]">片段：「{m.excerpt}」</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 批量导入弹窗 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量导入违禁词规则</DialogTitle>
            <DialogDescription>支持按行、逗号或顿号分隔输入多个违禁词，重复词条将自动去重并更新配置。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">统一分类</label>
                <select
                  value={batchConfig.category}
                  onChange={(e) => setBatchConfig((p) => ({ ...p, category: e.target.value }))}
                  className={`${SELECT_CLS} w-full`}
                >
                  <option value="absolute">极限词</option>
                  <option value="medical">医疗功效</option>
                  <option value="financial">金融承诺</option>
                  <option value="platform">平台禁用</option>
                  <option value="politics">涉政敏感</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">严重级别</label>
                <select
                  value={batchConfig.severity}
                  onChange={(e) => setBatchConfig((p) => ({ ...p, severity: e.target.value }))}
                  className={`${SELECT_CLS} w-full`}
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">严重</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">处置动作</label>
                <select
                  value={batchConfig.action}
                  onChange={(e) => setBatchConfig((p) => ({ ...p, action: e.target.value }))}
                  className={`${SELECT_CLS} w-full`}
                >
                  <option value="block">阻断</option>
                  <option value="warn">告警</option>
                  <option value="rewrite">改写</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-secondary)]">适用平台</label>
                <select
                  value={batchConfig.platform}
                  onChange={(e) => setBatchConfig((p) => ({ ...p, platform: e.target.value }))}
                  className={`${SELECT_CLS} w-full`}
                >
                  <option value="all">全平台</option>
                  <option value="douyin">抖音</option>
                  <option value="kuaishou">快手</option>
                  <option value="wechat_video">微信视频号</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--text-secondary)]">违禁词列表（每行或逗号分隔）</label>
              <textarea
                rows={7}
                placeholder={'全网第一\n绝对有效\n包治百病, 根治'}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBatchOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={importingBatch}
              disabled={!batchText.trim()}
              onClick={() => void handleBatchImport()}
            >
              确认批量导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
