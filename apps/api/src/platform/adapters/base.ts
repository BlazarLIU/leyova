import {
  governancePlatformRegistry,
  isRealCredentials,
  type PlatformCredentials,
} from '../../modules/data-governance/adapters/index.js'
import type { CanonicalOrderRecord } from '../../modules/data-governance/types.js'
import type {
  PlatformAdapter,
  PlatformCapabilities,
  PlatformCategory,
  StandardTradeRecord,
  StandardTrafficRecord,
} from '../types.js'

function toPositiveNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 将治理层规范订单明细聚合为 fact_trade_daily 所需的平台日维度交易事实 */
export function aggregateCanonicalOrdersToTrade(
  platformCode: string,
  shopId: number,
  orders: CanonicalOrderRecord[],
): StandardTradeRecord[] {
  const buckets = new Map<string, StandardTradeRecord & { buyers: Set<string> }>()

  for (const order of orders) {
    const bizDate = String(order.bizDate || '').slice(0, 10)
    if (!bizDate) continue
    const key = `${bizDate}:${shopId}`
    let acc = buckets.get(key)
    if (!acc) {
      acc = {
        bizDate,
        platformCode,
        shopId,
        gmv: 0,
        payAmount: 0,
        paidOrderCount: 0,
        paidBuyerCount: 0,
        refundAmount: 0,
        refundCount: 0,
        source: 'api',
        buyers: new Set<string>(),
      }
      buckets.set(key, acc)
    }

    const paid = toPositiveNumber(order.paidAmount)
    const discount = toPositiveNumber(order.totalDiscount)
    const isRefund = String(order.orderStatus || '').toLowerCase().includes('refund') || String(order.rawStatus || '').includes('退款')

    acc.gmv += paid + discount
    if (isRefund) {
      acc.refundAmount += paid
      acc.refundCount = (acc.refundCount || 0) + 1
    } else {
      acc.payAmount += paid
      acc.paidOrderCount += 1
    }
    if (order.buyerUserId) {
      acc.buyers.add(order.buyerUserId)
    }
  }

  return Array.from(buckets.values()).map(({ buyers, ...row }) => ({
    ...row,
    gmv: Number(row.gmv.toFixed(2)),
    payAmount: Number(row.payAmount.toFixed(2)),
    refundAmount: Number(row.refundAmount.toFixed(2)),
    paidBuyerCount: buyers.size > 0 ? buyers.size : row.paidOrderCount,
  }))
}

/** 收敛后的统一 OpenAPI 适配器基类：复用 data-governance 的签名、重试与 HTTP 客户端 */
export abstract class GovernanceBackedPlatformAdapter implements PlatformAdapter {
  abstract readonly platformCode: string
  abstract readonly platformName: string
  abstract readonly category: PlatformCategory

  abstract getCapabilities(): PlatformCapabilities

  async fetchTradeData(
    shopId: number,
    sinceWatermark: string,
    credentials?: PlatformCredentials,
  ): Promise<StandardTradeRecord[]> {
    if (!credentials || !isRealCredentials(credentials)) {
      return []
    }
    const govAdapter = governancePlatformRegistry.get(this.platformCode)
    if (!govAdapter) {
      throw new Error(`未找到平台治理适配器: ${this.platformCode}`)
    }
    const res = await govAdapter.fetchOrders(credentials, { sinceTime: sinceWatermark })
    if (!res.success) {
      throw new Error(res.error || `${this.platformName} OpenAPI 拉取失败`)
    }
    return aggregateCanonicalOrdersToTrade(this.platformCode, shopId, res.records)
  }

  async fetchTrafficData(
    _shopId: number,
    _sinceWatermark: string,
    _credentials?: PlatformCredentials,
  ): Promise<StandardTrafficRecord[]> {
    // 各开放平台流量报表接口需另行申请数据大盘权限，当前未启用前返回空集（不伪造流量数据）
    return []
  }
}

