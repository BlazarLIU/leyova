import { useState, useEffect, useCallback } from 'react'
import { Calculator, Layers, Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

interface RuleRow {
  id: number
  platform_code: string
  platform_name: string
  rule_layer: number
  rule_name: string
  discount_mode: string
  discount_value: string
  is_exclusive: boolean
  merchant_cost_ratio: string
  platform_cost_ratio: string
}

interface SimResult {
  retailPrice: number
  finalConsumerPrice: number
  totalDiscount: number
  totalMerchantSubsidy: number
  totalPlatformSubsidy: number
  merchantReceipts: number
  platformFee: number
  costMasked: boolean
  netMargin: number | null
  exclusiveConflicts: string[]
  steps: Array<{
    ruleLayer: number
    ruleName: string
    applied: boolean
    discountAmount: number
    merchantCost: number
    platformCost: number
    priceAfter: number
  }>
}

const LAYER_LABELS: Record<number, string> = {
  1: 'L1 官方立减',
  2: 'L2 店铺券',
  3: 'L3 品类券',
  4: 'L4 会员/红包',
  5: 'L5 国补/多件折',
}

export function PromotionLayerSimulator() {
  const [platformCode, setPlatformCode] = useState('tmall')
  const [rules, setRules] = useState<RuleRow[]>([])
  const [retailPrice, setRetailPrice] = useState('299')
  const [costPrice, setCostPrice] = useState('110')
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [newRule, setNewRule] = useState({
    ruleLayer: '1',
    ruleName: '',
    discountMode: 'official_reduction',
    discountValue: '0.85',
    isExclusive: false,
    merchantCostRatio: '1',
  })

  const loadRules = useCallback(async () => {
    try {
      const res = await api.get<RuleRow[]>('/promotions/rules', platformCode ? { platform: platformCode } : undefined)
      setRules(Array.isArray(res) ? res : [])
    } catch {
      // ignore if user lacks module access
    }
  }, [platformCode])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  const runSimulate = async () => {
    const res = await api.post<SimResult>('/promotions/simulate', {
      platformCode,
      retailPrice: Number(retailPrice || 299),
      costPrice: Number(costPrice || 0),
    })
    setSimResult(res)
  }

  const addRule = async () => {
    if (!newRule.ruleName.trim()) return
    await api.post('/promotions/rules', {
      platformCode,
      ruleLayer: Number(newRule.ruleLayer),
      ruleName: newRule.ruleName.trim(),
      discountMode: newRule.discountMode,
      discountValue: Number(newRule.discountValue || 0),
      isExclusive: newRule.isExclusive,
      merchantCostRatio: Number(newRule.merchantCostRatio || 1),
    })
    setNewRule({ ...newRule, ruleName: '' })
    await loadRules()
  }

  const removeRule = async (id: number) => {
    await api.delete(`/promotions/rules/${id}`)
    await loadRules()
  }

  return (
    <Card>
      <CardHeader
        title="2026 大促 5 层优惠叠加规则与折后实收/毛利试算"
        subtitle="L1官方立减 → L2店铺券 → L3品类券 → L4会员/红包 → L5国补与互斥锁"
        actions={
          <select
            value={platformCode}
            onChange={(e) => setPlatformCode(e.target.value)}
            className="h-8 rounded-lg border border-orbit-border bg-orbit-surface2 px-2.5 text-xs text-slate-200"
          >
            {['tmall', 'taobao', 'jd', 'douyin', 'pdd', 'kuaishou', 'xiaohongshu'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <select
            value={newRule.ruleLayer}
            onChange={(e) => setNewRule({ ...newRule, ruleLayer: e.target.value })}
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
          >
            {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{LAYER_LABELS[l]}</option>)}
          </select>
          <input
            value={newRule.ruleName}
            onChange={(e) => setNewRule({ ...newRule, ruleName: e.target.value })}
            placeholder="规则名(如官方85折)"
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
          />
          <select
            value={newRule.discountMode}
            onChange={(e) => setNewRule({ ...newRule, discountMode: e.target.value })}
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
          >
            <option value="official_reduction">official_reduction</option>
            <option value="store_coupon">store_coupon</option>
            <option value="category_coupon">category_coupon</option>
            <option value="vip_discount">vip_discount</option>
            <option value="national_subsidy">national_subsidy</option>
            <option value="red_packet">red_packet</option>
            <option value="multi_piece_exclusive">multi_piece_exclusive</option>
          </select>
          <input
            type="number"
            value={newRule.discountValue}
            onChange={(e) => setNewRule({ ...newRule, discountValue: e.target.value })}
            placeholder="<1折扣 / >1满减"
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
          />
          <input
            type="number"
            value={newRule.merchantCostRatio}
            onChange={(e) => setNewRule({ ...newRule, merchantCostRatio: e.target.value })}
            placeholder="商家承担比例(0-1)"
            className="h-9 rounded-lg border border-orbit-border bg-orbit-surface2 px-2 text-slate-200"
          />
          <Button size="sm" variant="primary" onClick={addRule}>
            <Plus className="w-3.5 h-3.5" /> 添加层级
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-orbit-border text-slate-500">
                <th className="text-left px-3 py-2">层级</th>
                <th className="text-left px-3 py-2">规则名称</th>
                <th className="text-left px-3 py-2">模式</th>
                <th className="text-right px-3 py-2">力度</th>
                <th className="text-right px-3 py-2">商家让利比</th>
                <th className="text-left px-3 py-2">互斥锁</th>
                <th className="text-right px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-orbit-border/60">
                  <td className="px-3 py-2"><Badge variant="info">{LAYER_LABELS[r.rule_layer] || `L${r.rule_layer}`}</Badge></td>
                  <td className="px-3 py-2 text-slate-200">{r.rule_name}</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{r.discount_mode}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-cyan-300">
                    {Number(r.discount_value) < 1 ? `${(Number(r.discount_value) * 10).toFixed(1)} 折` : `-¥${Number(r.discount_value)}`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">{(Number(r.merchant_cost_ratio) * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2">{r.is_exclusive ? <Badge variant="warning">独占互斥</Badge> : <span className="text-slate-500">可叠加</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeRule(r.id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-orbit-border text-xs">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">吊牌/日常价:</span>
            <input type="number" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} className="w-24 h-8 rounded border border-orbit-border bg-orbit-surface2 px-2 text-slate-200" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">商品成本(试算):</span>
            <input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="w-24 h-8 rounded border border-orbit-border bg-orbit-surface2 px-2 text-slate-200" />
          </div>
          <Button size="sm" variant="primary" onClick={runSimulate}>
            <Calculator className="w-3.5 h-3.5" /> 执行 5 层穿透试算
          </Button>
        </div>

        {simResult && (
          <div className="rounded-xl border border-orbit-border bg-orbit-surface2 p-3 text-xs space-y-2">
            <div className="flex flex-wrap gap-4">
              <span>消费者到手价: <strong className="text-cyan-400">¥{simResult.finalConsumerPrice}</strong></span>
              <span>商家让利: <strong className="text-amber-400">¥{simResult.totalMerchantSubsidy}</strong></span>
              <span>平台补贴: <strong className="text-emerald-400">¥{simResult.totalPlatformSubsidy}</strong></span>
              <span>商家实收(扣扣点前): <strong className="text-slate-100">¥{simResult.merchantReceipts}</strong></span>
              <span>预估单件净毛利: <strong className="text-emerald-400">{simResult.costMasked || simResult.netMargin === null ? '*** (无成本权限)' : `¥${simResult.netMargin}`}</strong></span>
            </div>
            {simResult.exclusiveConflicts.length > 0 && (
              <div className="text-amber-300">{simResult.exclusiveConflicts.join('；')}</div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
