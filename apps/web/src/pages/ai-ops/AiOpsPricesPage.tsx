import { useState, useEffect } from 'react'
import { api } from '@/services/api'
import { Layers, Loader2 } from 'lucide-react'

interface ChannelPriceItem {
  sku: string
  title: string
  market: string
  listPrice: number
  salePrice: number
  channelRules: string
}

export function AiOpsPricesPage() {
  const [items, setItems] = useState<ChannelPriceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    api
      .get('/inventory/channel-listings')
      .then((res: any) => {
        if (!mounted) return
        const list = res?.data || (Array.isArray(res) ? res : [])
        if (Array.isArray(list) && list.length > 0) {
          setItems(
            list.map((it: any) => ({
              sku: it.skuCode || `SKU-${it.id}`,
              title: it.productName || '商品名称',
              market: `${it.platformName || it.platformCode} · ${it.shopName || '官方渠道'}`,
              listPrice: Number(it.baseRetailPrice || it.channelPrice) || 0,
              salePrice: Number(it.channelPrice) || 0,
              channelRules: `配额库存: ${it.allocatedStock ?? 0} 件 · 剩余可售: ${it.availableChannelStock ?? 0} 件`,
            })),
          )
        } else {
          setItems([])
        }
      })
      .catch(() => {
        if (mounted) setItems([])
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="flex-1 bg-orbit-bg text-[var(--text-primary)] min-h-0 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orbit-success/20 text-status-ai border border-orbit-success/30">
              工作面 3 · 价格与渠道
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">建模铁律：价格属市场，不属 SKU</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            多市场统一价目表
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            价目表与渠道 Listing 分离建模，渠道差异在 channel_listing 中沉淀，确保全渠道控价不穿底。
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-status-ai">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-xs font-mono text-[var(--text-muted)]">正在调取全渠道商品挂牌与控价字典...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 p-12 text-center text-orbit-snow/60">
          <Layers className="w-10 h-10 text-[var(--text-primary)] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[var(--text-secondary)]">暂无渠道商品价目记录</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">请在商品管理中完成渠道定价与配额发布</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-orbit-ink/60 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="divide-y divide-[var(--border)]">
            {items.map((it, idx) => (
              <div key={`${it.sku}-${idx}`} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-orbit-ink/20 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-orbit-ink text-orbit-snow/80">
                      {it.sku}
                    </span>
                    <span className="text-sm font-bold text-white">{it.title}</span>
                    <span className="text-xs font-medium text-status-ai">{it.market}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">渠道履约与库存：{it.channelRules}</p>
                </div>

                <div className="flex items-center gap-4 text-sm font-mono">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">划线基准价</span>
                    <span className="text-[var(--text-muted)] line-through">¥{it.listPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">渠道挂牌价</span>
                    <span className="text-status-ai font-bold">¥{it.salePrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
