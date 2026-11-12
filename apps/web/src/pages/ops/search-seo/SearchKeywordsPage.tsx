import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, RefreshCw, AlertTriangle, Hash } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'

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

const WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'operator', 'ops_staff', 'ad_buyer']

export function SearchKeywordsPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole(WRITE_ROLES)

  const [platform, setPlatform] = useState('')
  const [query, setQuery] = useState('')
  const [data, setData] = useState<SearchOverviewResponse | null>(null)
  const [shops, setShops] = useState<Array<{ id: number; platform_code: string; shop_name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    platformCode: 'xiaohongshu',
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, sh] = await Promise.all([
        api.get<SearchOverviewResponse>('/search-keywords', {
          ...(platform ? { platform } : {}),
          ...(query.trim() ? { q: query.trim() } : {}),
        }),
        api.get<any[]>('/omnichannel/shops').catch(() => []),
      ])
      setData(res)
      setShops(Array.isArray(sh) ? sh : [])
    } catch (err: any) {
      setError(err?.message || '加载搜索词卡位数据失败')
    } finally {
      setLoading(false)
    }
  }, [platform, query])

  useEffect(() => {
    load()
  }, [load])

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
      await load()
    } catch (err: any) {
      setError(err?.message || '保存搜索关键词失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" />
            搜索词卡位排名与小红书 SEO 词包联动
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            监测天猫/京东/拼多多/小红书核心类目搜索坑位排名、搜推占比、转化率及种草笔记反搜归因
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="检索关键词或笔记词..."
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-xs text-slate-200 w-44"
          />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-3 text-xs text-slate-200"
          >
            <option value="">全部平台</option>
            <option value="tmall">天猫</option>
            <option value="taobao">淘宝</option>
            <option value="jd">京东</option>
            <option value="pdd">拼多多</option>
            <option value="xiaohongshu">小红书</option>
            <option value="douyin">抖音</option>
          </select>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {canWrite && (
            <Button size="sm" variant="primary" onClick={() => setShowForm((v) => !v)}>
              <Plus className="w-3.5 h-3.5" />
              录入搜索卡位
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="secondary" onClick={load}>重试</Button>
        </div>
      )}

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
                  {['xiaohongshu', 'tmall', 'taobao', 'jd', 'pdd', 'douyin'].map((p) => (
                    <option key={p} value={p}>{p}</option>
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
                    <option key={s.id} value={s.id}>{s.shop_name} (#{s.id})</option>
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
                  <input type="number" placeholder="点击" value={form.clicks} onChange={(e) => setForm({ ...form, clicks: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200" />
                  <input type="number" placeholder="订单" value={form.orders} onChange={(e) => setForm({ ...form, orders: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200" />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">搜索成交 GMV / 笔记 ID</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input type="number" placeholder="GMV" value={form.searchGmv} onChange={(e) => setForm({ ...form, searchGmv: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200" />
                  <input placeholder="note_id(选填)" value={form.noteId} onChange={(e) => setForm({ ...form, noteId: e.target.value })} className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
              <Button size="sm" variant="primary" onClick={submitKeyword}>保存关键词</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card><CardBody>
              <div className="text-xs text-slate-400">追踪关键词数</div>
              <div className="text-xl font-bold text-slate-100 mt-1 tabular-nums">{data.summary.total_keywords}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">Top 5 卡位词</div>
              <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">{data.summary.top_rank_count}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">平均排名 #{data.summary.avg_rank}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">搜索总曝光</div>
              <div className="text-xl font-bold text-cyan-400 mt-1 tabular-nums">{data.summary.total_impressions.toLocaleString()}</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">搜索平均 CVR</div>
              <div className="text-xl font-bold text-slate-200 mt-1 tabular-nums">{data.summary.avg_cvr}%</div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="text-xs text-slate-400">搜索贡献 GMV</div>
              <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">¥{data.summary.total_search_gmv.toLocaleString()}</div>
            </CardBody></Card>
          </div>

          <Card>
            <CardHeader title="全平台搜索词卡位与转化明细" />
            <CardBody className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-orbit-border text-slate-500">
                      <th className="text-left px-4 py-2.5">关键词</th>
                      <th className="text-left px-4 py-2.5">平台/店铺</th>
                      <th className="text-right px-4 py-2.5">卡位排名</th>
                      <th className="text-right px-4 py-2.5">搜推份额</th>
                      <th className="text-right px-4 py-2.5">曝光/点击</th>
                      <th className="text-right px-4 py-2.5">订单</th>
                      <th className="text-right px-4 py-2.5">CVR</th>
                      <th className="text-right px-4 py-2.5">搜索 GMV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.id} className="border-b border-orbit-border/60 hover:bg-white/5">
                        <td className="px-4 py-2.5 font-medium text-slate-100">
                          <span className="inline-flex items-center gap-1"><Hash className="w-3 h-3 text-cyan-400" />{r.keyword}</span>
                          {r.note_id && <span className="ml-2 text-[10px] text-slate-500 font-mono">笔记:{r.note_id}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{r.platform_name} · {r.shop_name}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge variant={r.search_rank <= 3 ? 'success' : r.search_rank <= 10 ? 'info' : 'neutral'}>
                            #{r.search_rank}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-cyan-300">{Number(r.search_share_pct).toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                          {Number(r.impressions).toLocaleString()} / {Number(r.clicks).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{r.orders}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{Number(r.cvr).toFixed(2)}%</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400 font-medium">¥{Number(r.search_gmv).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {data.xhsNotes.length > 0 && (
            <Card>
              <CardHeader title="小红书笔记 search_keywords 词包对齐视图" subtitle="确保站内种草笔记词与搜索排名实时关联，消除断链" />
              <CardBody className="px-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-orbit-border text-slate-500">
                        <th className="text-left px-4 py-2.5">笔记 ID & 标题</th>
                        <th className="text-left px-4 py-2.5">绑定搜索词 (search_keywords)</th>
                        <th className="text-right px-4 py-2.5">搜索曝光</th>
                        <th className="text-right px-4 py-2.5">闭环 / 溢出 GMV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.xhsNotes.map((n) => (
                        <tr key={n.id} className="border-b border-orbit-border/60">
                          <td className="px-4 py-2.5 text-slate-200">
                            <div className="font-medium">{n.title}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{n.note_id} · {n.shop_name}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {n.search_keywords?.length ? n.search_keywords.map((kw) => (
                                <Badge key={kw} variant="info">{kw}</Badge>
                              )) : <span className="text-slate-500">未绑定</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{Number(n.search_impressions).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">
                            ¥{Number(n.onsite_gmv).toLocaleString()} / ¥{Number(n.offsite_gmv).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
