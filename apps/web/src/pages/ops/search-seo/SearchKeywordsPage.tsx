import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Plus, Hash, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataPage, type ColumnDef } from '@/components/common/DataPage'
import { useTable, type TableFetchParams } from '@/components/common/useTable'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { usePlatform } from '@/hooks/usePlatform'

interface KeywordRow {
  id: number
  platform_code: string
  platform_name: string
  shop_id: number
  shop_name: string
  biz_date: string
  keyword: string
  sku_code: string
  note_id: string
  impressions: string
  clicks: string
  search_rank: number
  search_share_pct: string
  orders: number
  search_gmv: string
  cvr: string
}

interface XhsNoteKeywordRow {
  id: number
  biz_date: string
  shop_name: string
  note_id: string
  title: string
  search_impressions: string
  search_keywords: string[]
  onsite_gmv: string
  offsite_gmv: string
}

interface SearchOverviewResponse {
  summary: {
    total_keywords: number
    total_impressions: number
    total_clicks: number
    total_orders: number
    total_search_gmv: number
    top_rank_count: number
    avg_rank: number
    avg_cvr: number
  }
  items: KeywordRow[]
  xhsNotes: XhsNoteKeywordRow[]
}

const WRITE_ROLES = ['super_admin', 'ops_director', 'ops_staff', 'ad_buyer']

export function SearchKeywordsPage() {
  const { hasRole } = useAuth()
  const { currentPlatform } = usePlatform()
  const canWrite = hasRole(WRITE_ROLES)

  const [shops, setShops] = useState<Array<{ id: number; platform_code: string; shop_name: string }>>([])
  const [xhsNotes, setXhsNotes] = useState<XhsNoteKeywordRow[]>([])
  const [summary, setSummary] = useState<SearchOverviewResponse['summary'] | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    platformCode: currentPlatform?.platform_code || 'xiaohongshu',
    shopId: '',
    bizDate: new Date().toISOString().slice(0, 10),
    keyword: '',
    noteId: '',
    searchRank: '3',
    searchSharePct: '12.5',
    impressions: '',
    clicks: '',
    orders: '',
    searchGmv: '',
  })

  // Load shops on mount
  useEffect(() => {
    api.get<any[]>('/omnichannel/shops')
      .then((sh) => setShops(Array.isArray(sh) ? sh : []))
      .catch(() => setShops([]))
  }, [])

  // Provider for useTable
  const fetchKeywords = useCallback(
    async (params: TableFetchParams<{ platform: string }>) => {
      setErrorMsg(null)
      try {
        const res = await api.get<SearchOverviewResponse>('/search-keywords', {
          ...(params.filters.platform ? { platform: params.filters.platform } : {}),
          ...(params.search ? { q: params.search } : {}),
        })

        if (res) {
          setSummary(res.summary)
          setXhsNotes(res.xhsNotes || [])
          return {
            items: res.items || [],
            total: (res.items || []).length,
          }
        }
        return { items: [], total: 0 }
      } catch (err: any) {
        setErrorMsg(err?.message || '加载搜索词卡位数据失败')
        return { items: [], total: 0 }
      }
    },
    []
  )

  const table = useTable<KeywordRow, { platform: string }>({
    fetchData: fetchKeywords,
    initialPageSize: 20,
    initialFilters: { platform: currentPlatform?.platform_code || '' },
    getRowId: (r) => r.id,
  })

  // 监听顶栏平台切换
  useEffect(() => {
    if (currentPlatform?.platform_code) {
      table.setFilter('platform', currentPlatform.platform_code)
      setForm((prev) => ({ ...prev, platformCode: currentPlatform.platform_code }))
    }
  }, [currentPlatform?.platform_code])

  const filteredShops = shops.filter((s) => s.platform_code === form.platformCode)

  const submitKeyword = async () => {
    if (!form.shopId || !form.keyword.trim()) return
    try {
      await api.post('/search-keywords', {
        platformCode: form.platformCode,
        shopId: Number(form.shopId),
        bizDate: form.bizDate,
        keyword: form.keyword.trim(),
        noteId: form.noteId.trim(),
        searchRank: Number(form.searchRank || 99),
        searchSharePct: Number(form.searchSharePct || 0),
        impressions: Number(form.impressions || 0),
        clicks: Number(form.clicks || 0),
        orders: Number(form.orders || 0),
        searchGmv: Number(form.searchGmv || 0),
      })
      setShowForm(false)
      table.reload()
    } catch (err: any) {
      setErrorMsg(err?.message || '保存搜索关键词失败')
    }
  }

  const columns = useMemo<ColumnDef<KeywordRow>[]>(
    () => [
      {
        key: 'keyword',
        header: '关键词',
        sortable: true,
        render: (_, r) => (
          <div>
            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
              <span>{r.keyword}</span>
              {r.note_id && (
                <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800">
                  小红书挂载
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{r.biz_date}</div>
          </div>
        ),
      },
      {
        key: 'platform_name',
        header: '平台 / 店铺',
        render: (_, r) => (
          <div>
            <Badge variant="neutral">{r.platform_name || r.platform_code}</Badge>
            <div className="text-slate-400 text-xs mt-0.5">{r.shop_name}</div>
          </div>
        ),
      },
      {
        key: 'search_rank',
        header: '卡位排名',
        align: 'right',
        sortable: true,
        render: (v) => (
          <span
            className={`font-bold tabular-nums ${
              v <= 3 ? 'text-amber-400' : v <= 10 ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            #{v}
          </span>
        ),
      },
      {
        key: 'search_share_pct',
        header: '搜推份额',
        align: 'right',
        render: (v) => <span className="tabular-nums font-mono">{v}%</span>,
      },
      {
        key: 'impressions',
        header: '曝光 / 点击',
        align: 'right',
        render: (_, r) => (
          <div className="text-right tabular-nums">
            <div className="text-slate-200">{Number(r.impressions || 0).toLocaleString()}</div>
            <div className="text-slate-500 text-[11px]">{Number(r.clicks || 0).toLocaleString()} 点击</div>
          </div>
        ),
      },
      {
        key: 'orders',
        header: '订单',
        align: 'right',
        render: (v) => <span className="tabular-nums text-slate-200">{Number(v || 0).toLocaleString()}</span>,
      },
      {
        key: 'cvr',
        header: 'CVR',
        align: 'right',
        render: (v) => <span className="tabular-nums font-mono text-cyan-400">{v}%</span>,
      },
      {
        key: 'search_gmv',
        header: '搜索 GMV',
        align: 'right',
        sortable: true,
        render: (v) => (
          <span className="font-semibold text-emerald-400 tabular-nums">
            ¥{Number(v || 0).toLocaleString()}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {errorMsg}
          </span>
          <Button size="sm" variant="secondary" onClick={() => table.reload()}>
            重试
          </Button>
        </div>
      )}

      {/* Record Drawer / Form */}
      {showForm && canWrite && (
        <Card>
          <CardHeader title="录入搜索词坑位与小红书笔记联动" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">平台</label>
                <select
                  value={form.platformCode}
                  onChange={(e) => {
                    const p = e.target.value
                    const firstShop = shops.find((s) => s.platform_code === p)?.id
                    setForm({ ...form, platformCode: p, shopId: firstShop ? String(firstShop) : '' })
                  }}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                >
                  {['douyin', 'kuaishou', 'wechat', 'taobao', 'tmall', 'xiaohongshu'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">店铺</label>
                <select
                  value={form.shopId}
                  onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                >
                  <option value="">选择店铺</option>
                  {filteredShops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shop_name} (#{s.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">关键词</label>
                <input
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="例如：防晒衣女夏"
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">自然坑位排名</label>
                <input
                  type="number"
                  value={form.searchRank}
                  onChange={(e) => setForm({ ...form, searchRank: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">搜索占比 (%)</label>
                <input
                  type="number"
                  value={form.searchSharePct}
                  onChange={(e) => setForm({ ...form, searchSharePct: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">曝光量</label>
                <input
                  type="number"
                  value={form.impressions}
                  onChange={(e) => setForm({ ...form, impressions: e.target.value })}
                  className="w-full h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">点击量 / 成交订单</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    placeholder="点击"
                    value={form.clicks}
                    onChange={(e) => setForm({ ...form, clicks: e.target.value })}
                    className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
                  />
                  <input
                    type="number"
                    placeholder="订单"
                    value={form.orders}
                    onChange={(e) => setForm({ ...form, orders: e.target.value })}
                    className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">搜索成交 GMV / 笔记 ID</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    placeholder="GMV"
                    value={form.searchGmv}
                    onChange={(e) => setForm({ ...form, searchGmv: e.target.value })}
                    className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
                  />
                  <input
                    placeholder="note_id(选填)"
                    value={form.noteId}
                    onChange={(e) => setForm({ ...form, noteId: e.target.value })}
                    className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>
                取消
              </Button>
              <Button size="sm" variant="primary" onClick={submitKeyword}>
                保存关键词
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardBody>
              <div className="text-xs text-slate-400">追踪关键词数</div>
              <div className="text-xl font-bold text-slate-100 mt-1 tabular-nums">
                {summary.total_keywords}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-slate-400">Top 5 卡位词</div>
              <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">
                {summary.top_rank_count}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">平均排名 #{summary.avg_rank}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-slate-400">搜索总曝光</div>
              <div className="text-xl font-bold text-cyan-400 mt-1 tabular-nums">
                {summary.total_impressions.toLocaleString()}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-slate-400">搜索平均 CVR</div>
              <div className="text-xl font-bold text-slate-200 mt-1 tabular-nums">
                {summary.avg_cvr}%
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-slate-400">搜索贡献 GMV</div>
              <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">
                ¥{summary.total_search_gmv.toLocaleString()}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Main Table via DataPage */}
      <DataPage<KeywordRow>
        title={
          <span className="flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" />
            <span>搜索词卡位排名与小红书 SEO 词包联动</span>
          </span>
        }
        subtitle="监测天猫/淘宝/京东/拼多多/小红书核心类目搜索坑位排名、搜推占比、转化率及种草笔记反搜归因"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-orbit-surface2 text-slate-400 border border-orbit-border">
            已接入 DataPage
          </span>
        }
        table={table}
        columns={columns}
        searchPlaceholder="检索关键词或笔记词..."
        exportFilename="search_keywords"
        emptyMessage="暂无符合条件的搜索词数据"
        actions={
          canWrite && (
            <Button size="sm" variant="primary" onClick={() => setShowForm((v) => !v)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              录入搜索卡位
            </Button>
          )
        }
        filterControls={
          <select
            value={table.filters.platform}
            onChange={(e) => table.setFilter('platform', e.target.value)}
            className="h-9 px-3 rounded-lg border border-orbit-border bg-orbit-surface2 text-xs text-slate-200 focus:outline-none focus:border-orbit-primary"
          >
            <option value="">全部平台</option>
            <option value="douyin">抖音</option>
            <option value="kuaishou">快手</option>
            <option value="wechat">视频号</option>
            <option value="taobao">淘宝</option>
            <option value="tmall">天猫</option>
            <option value="xiaohongshu">小红书</option>
          </select>
        }
      />

      {/* Xiaohongshu Reverse Search Note Section */}
      {xhsNotes.length > 0 && (
        <Card>
          <CardHeader
            title="小红书种草笔记与搜索回流反搜分析"
            subtitle="监测种草笔记引流词包在站内搜索及全域回流带动的搜索成交"
          />
          <CardBody className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-orbit-border text-slate-500">
                    <th className="text-left px-4 py-2.5">种草笔记</th>
                    <th className="text-left px-4 py-2.5">关联店铺</th>
                    <th className="text-left px-4 py-2.5">核心搜索词包</th>
                    <th className="text-right px-4 py-2.5">搜索回流曝光</th>
                    <th className="text-right px-4 py-2.5">站内直接 GMV</th>
                    <th className="text-right px-4 py-2.5">外溢反搜 GMV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orbit-border/40">
                  {xhsNotes.map((n) => (
                    <tr key={n.id} className="hover:bg-orbit-surface2/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{n.title}</div>
                        <div className="text-slate-500 font-mono text-[11px] mt-0.5">{n.note_id}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{n.shop_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(n.search_keywords || []).map((k) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded bg-orbit-surface2 text-slate-300 border border-orbit-border"
                            >
                              <Hash className="w-3 h-3 text-slate-500" />
                              {k}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                        {Number(n.search_impressions || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-cyan-400 font-medium">
                        ¥{Number(n.onsite_gmv || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-medium">
                        ¥{Number(n.offsite_gmv || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

export default SearchKeywordsPage
