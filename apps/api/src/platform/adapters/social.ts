import type { PlatformAdapter, PlatformCapabilities, StandardTradeRecord, StandardTrafficRecord } from '../types.js'

export class KuaishouAdapter implements PlatformAdapter {
  readonly platformCode = 'kuaishou'
  readonly platformName = '快手电商'
  readonly category = 'live' as const

  getCapabilities(): PlatformCapabilities {
    return {
      supportsLive: true,
      supportsShelf: true,
      supportsContent: true,
      supportsAds: true,
      supportsAutoSync: true,
      supportsManualUpload: true,
      availableMetrics: [
        'gmv', 'pay_amount', 'paid_order_count', 'paid_buyer_count',
        'refund_amount', 'refund_rate', 'net_sales', 'ad_spend', 'roi',
        'traffic_views', 'click_count', 'ctr', 'gpm',
      ],
      supportedModules: [
        'overview', 'cockpit', 'live_monitor', 'live_attendance',
        'live_registration', 'live_data', 'review', 'bi', 'anchors', 'ops',
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

export class XiaohongshuAdapter implements PlatformAdapter {
  readonly platformCode = 'xiaohongshu'
  readonly platformName = '小红书电商'
  readonly category = 'content' as const

  getCapabilities(): PlatformCapabilities {
    return {
      supportsLive: false,
      supportsShelf: true,
      supportsContent: true,
      supportsAds: true,
      supportsAutoSync: true,
      supportsManualUpload: true,
      availableMetrics: [
        'gmv', 'pay_amount', 'paid_order_count', 'paid_buyer_count',
        'refund_amount', 'refund_rate', 'net_sales', 'ad_spend', 'roi',
        'traffic_views', 'click_count', 'ctr',
      ],
      supportedModules: [
        'overview', 'cockpit', 'shop_overview', 'content_video_data',
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

