import type { PlatformAdapter, PlatformCapabilities, StandardTradeRecord, StandardTrafficRecord } from '../types.js'

export class JdAdapter implements PlatformAdapter {
  readonly platformCode = 'jd'
  readonly platformName = '京东'
  readonly category = 'shelf' as const

  getCapabilities(): PlatformCapabilities {
    return {
      supportsLive: false,
      supportsShelf: true,
      supportsContent: true,
      supportsAds: true,
      supportsAutoSync: false,
      supportsManualUpload: true,
      availableMetrics: [
        'gmv', 'pay_amount', 'paid_order_count', 'paid_buyer_count',
        'refund_amount', 'refund_rate', 'net_sales', 'ad_spend', 'roi',
        'traffic_views', 'click_count', 'ctr',
      ],
      supportedModules: [
        'overview', 'cockpit', 'shop_overview', 'product_center',
        'bi', 'ops_goals', 'ops_activities', 'data_manage',
      ],
    }
  }

  async fetchTradeData(shopId: number, sinceWatermark: string): Promise<StandardTradeRecord[]> {
    return []
  }

  async fetchTrafficData(shopId: number, sinceWatermark: string): Promise<StandardTrafficRecord[]> {
    return []
  }
}

export class PddAdapter implements PlatformAdapter {
  readonly platformCode = 'pdd'
  readonly platformName = '拼多多'
  readonly category = 'shelf' as const

  getCapabilities(): PlatformCapabilities {
    return {
      supportsLive: false,
      supportsShelf: true,
      supportsContent: false,
      supportsAds: true,
      supportsAutoSync: false,
      supportsManualUpload: true,
      availableMetrics: [
        'gmv', 'pay_amount', 'paid_order_count', 'paid_buyer_count',
        'refund_amount', 'refund_rate', 'net_sales', 'ad_spend', 'roi',
        'traffic_views', 'click_count', 'ctr',
      ],
      supportedModules: [
        'overview', 'cockpit', 'shop_overview', 'product_center',
        'bi', 'ops_goals', 'data_manage',
      ],
    }
  }

  async fetchTradeData(shopId: number, sinceWatermark: string): Promise<StandardTradeRecord[]> {
    return []
  }

  async fetchTrafficData(shopId: number, sinceWatermark: string): Promise<StandardTrafficRecord[]> {
    return []
  }
}

