import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, AlertTriangle, type LucideIcon, Search, Download, ChevronDown } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export interface DedicatedColumn { key: string; label: string; align?: 'left' | 'right' | 'center' }
export interface DedicatedKpi { label: string; value: string | number; hint?: string; accent?: 'primary' | 'success' | 'warn' | 'danger' }
export interface DedicatedTable {
  title: string
  columns: DedicatedColumn[]
  rows: Record<string, unknown>[]
  emptyText?: string
}
export interface DedicatedData {
  range: { from: string; to: string }
  kpis: DedicatedKpi[]
  tables: DedicatedTable[]
  note: string
}

/**
 * 后端专属端点的原生返回结构（P0-C 新建的 /wechat/* /tmall/* 等）
 * 形如 { summary: {...}, brands: [...], note }，与 Shell 的 kpis/tables 不同。
 * 这里做一层通用适配，避免为每个新端点重复写前端渲染。
 */
function adaptNativeShape(raw: any): DedicatedData | null {
  if (!raw || typeof raw !== 'object') return null
  if (Array.isArray(raw.kpis) && Array.isArray(raw.tables)) return raw as DedicatedData

  const summary = raw.summary || {}
  const kpis: DedicatedKpi[] = Object.entries(summary)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .slice(0, 8)
    .map(([k, v]) => ({
      label: k,
      value: typeof v === 'number' && Number.isFinite(v) ? Number(v).toLocaleString('zh-CN') : String(v),
    }))

  // 找出数组字段作为表格（排除已知非表格字段）
  const SKIP = new Set(['range', 'summary', 'note', 'buckets', 'channels', 'daily', 'simulation'])
  const tables: DedicatedTable[] = []
  for (const [key, val] of Object.entries(raw)) {
    if (SKIP.has(key) || !Array.isArray(val) || val.length === 0) continue
    const first = val[0]
    if (typeof first !== 'object' || first === null) continue
    const columns = Object.keys(first).slice(0, 10).map((c) => ({
      key: c,
      label: c,
      align: typeof (first as any)[c] === 'number' ? ('right' as const) : ('left' as const),
    }))
    tables.push({
      title: key,
      columns,
      rows: (val as any[]).map((r) => {
        const o: Record<string, unknown> = {}
        for (const c of columns) {
          const v = r[c.key]
          o[c.key] = typeof v === 'number' ? Number(v).toLocaleString('zh-CN') : (v ?? '—')
        }
        return o
      }),
    })
  }

  return { range: raw.range || { from: '', to: '' }, kpis, tables, note: raw.note || '' }
}

interface Props {
  /** 页面标题 */
  title: string
  /** 副标题（业务解释） */
  subtitle: string
  /** 图标 */
  icon: LucideIcon
  /** 后端端点，如 /insights/douyin/three-pools */
  endpoint: string
  /** 是否显示时间区间选择器（无时间维度的页面传 false） */
  withRange?: boolean
}

/**
 * 平台专属洞察通用渲染器（S7-B）
 *
 * 后端统一返回 { range, kpis[], tables[], note }，本组件负责渲染。
 * 10 个平台专属页共用此壳，避免重复代码。
 */
export function DedicatedInsightShell({ title, subtitle, icon: Icon, endpoint, withRange = true }: Props) {
  const [data, setData] = useState<DedicatedData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      let url = endpoint
      if (withRange) {
        const to = new Date().toISOString().slice(0, 10)
        const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
        url += `?from=${from}&to=${to}`
      }
      const raw: any = await api.get<any>(url)
      setData(adaptNativeShape(raw))
    } catch (e: any) {
      setErr(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [endpoint, days, withRange])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <motion.div {...fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Icon className="w-6 h-6 text-orbit-primary" /> {title}
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1 max-w-3xl">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {withRange && (
            <select value={days} onChange={e => setDays(Number(e.target.value))}
              className="text-xs bg-orbit-bg border border-orbit-border rounded px-2 py-1.5 text-[var(--text-secondary)]">
              <option value={7}>近 7 天</option>
              <option value={30}>近 30 天</option>
              <option value={90}>近 90 天</option>
            </select>
          )}
          <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </motion.div>

      {err && (
        <div className="rounded-lg border border-orbit-danger/30 bg-orbit-danger/10 px-3 py-2 text-xs text-status-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {err}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center p-16">
          <div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {data && (
        <>
          {/* KPI */}
          {data.kpis.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {data.kpis.map((k, i) => (
                <Card key={i}><CardBody>
                  <div className="text-[11px] text-[var(--text-muted)]">{k.label}</div>
                  <div className={`text-lg font-semibold mt-0.5 tabular-nums ${
                    k.accent === 'primary' ? 'text-orbit-primary'
                    : k.accent === 'success' ? 'text-status-success'
                    : k.accent === 'warn' ? 'text-status-warning'
                    : k.accent === 'danger' ? 'text-status-danger'
                    : 'text-[var(--text-primary)]'
                  }`}>{k.value}</div>
                  {k.hint && <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{k.hint}</div>}
                </CardBody></Card>
              ))}
            </div>
          )}

          {/* 表格（P1：加筛选 / 排序 / 导出）*/}
          {data.tables.map((t, ti) => (
            <EnhancedTable key={ti} table={t} title={title} />
          ))}

          {data.note && <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{data.note}</p>}
        </>
      )}
    </div>
  )
}

/**
 * 增强表格（P1：专属页从「只读表格」升级为「运营工具」）
 *
 * 审计断点：20 个专属页此前都是 DedicatedInsightShell 的薄壳（16-17 行），
 *   只有一张静态表格，没有筛选、排序、导出 —— 运营拿到数据没法用。
 *
 * 本组件提供：
 *   · 关键词搜索（全列模糊匹配）
 *   · 点表头排序（升/降/原序三态）
 *   · 每页行数切换（20/50/100/全部）
 *   · CSV 导出（带 BOM，Excel 直接打开不乱码）
 */
function EnhancedTable({
  table,
  title,
}: {
  table: DedicatedTable
  title: string
}) {
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [pageSize, setPageSize] = useState(50)

  const filtered = useMemo(() => {
    let rows = table.rows
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      rows = rows.filter((r) =>
        table.columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(kw)),
      )
    }
    if (sortKey) {
      const isNum = table.columns.find((c) => c.key === sortKey)?.align === 'right'
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (isNum) {
          // 去掉千分位逗号再比较
          const an = Number(String(av ?? '').replace(/,/g, ''))
          const bn = Number(String(bv ?? '').replace(/,/g, ''))
          const x = Number.isNaN(an) ? 0 : an
          const y = Number.isNaN(bn) ? 0 : bn
          return sortDir === 'asc' ? x - y : y - x
        }
        const as = String(av ?? '')
        const bs = String(bv ?? '')
        return sortDir === 'asc' ? as.localeCompare(bs, 'zh-CN') : bs.localeCompare(as, 'zh-CN')
      })
    }
    return rows
  }, [table, keyword, sortKey, sortDir])

  const visible = pageSize >= 999999 ? filtered : filtered.slice(0, pageSize)

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('desc')
    } else if (sortDir === 'desc') {
      setSortDir('asc')
    } else {
      setSortKey(null)
    }
  }

  const exportCsv = () => {
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = table.columns.map((c) => esc(c.label)).join(',')
    const body = filtered
      .map((r) => table.columns.map((c) => esc(r[c.key])).join(','))
      .join('\n')
    // BOM 让 Excel 正确识别 UTF-8 中文
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}_${table.title}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-[var(--text-secondary)] truncate">{table.title}</span>
          <Badge variant="neutral">
            {filtered.length === table.rows.length
              ? `${table.rows.length} 行`
              : `${filtered.length} / ${table.rows.length} 行`}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="筛选…"
              className="w-36 pl-6 pr-2 py-1 text-[11px] bg-orbit-bg border border-orbit-border rounded text-[var(--text-secondary)] placeholder:text-[var(--text-primary)] focus:outline-none focus:border-orbit-primary/50"
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="text-[11px] bg-orbit-bg border border-orbit-border rounded px-1.5 py-1 text-[var(--text-secondary)]"
          >
            <option value={20}>20 行</option>
            <option value={50}>50 行</option>
            <option value={100}>100 行</option>
            <option value={999999}>全部</option>
          </select>
          <Button variant="secondary" onClick={exportCsv} title="导出 CSV">
            <Download className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-orbit-surface border-b border-orbit-border">
              <tr className="text-[var(--text-muted)]">
                {table.columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={`px-3 py-2 cursor-pointer select-none hover:text-[var(--text-primary)] ${
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {c.label}
                      {sortKey === c.key && (
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`}
                        />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, ri) => (
                <tr key={ri} className="border-b border-orbit-border/40 hover:bg-white/[0.02]">
                  {table.columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-1.5 ${
                        c.align === 'right'
                          ? 'text-right text-[var(--text-secondary)] tabular-nums'
                          : c.align === 'center'
                            ? 'text-center text-[var(--text-secondary)]'
                            : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {String(row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={table.columns.length} className="px-4 py-6 text-center text-[var(--text-muted)]">
                    {keyword ? `没有匹配「${keyword}」的数据` : table.emptyText || '暂无数据'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageSize < 999999 && filtered.length > pageSize && (
          <div className="px-3 py-1.5 text-[11px] text-[var(--text-muted)] border-t border-orbit-border/40">
            显示前 {pageSize} 行，共 {filtered.length} 行（可切换「全部」或导出 CSV 查看完整数据）
          </div>
        )}
      </CardBody>
    </Card>
  )
}

export default DedicatedInsightShell
