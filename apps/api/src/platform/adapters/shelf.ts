import { GovernanceBackedPlatformAdapter } from './base.js'
import type { PlatformCapabilities } from '../types.js'

export class JdAdapter extends GovernanceBackedPlatformAdapter {
  readonly platformCode = 'jd'
  readonly platformName = '京东'
  readonly category = 'shelf' as const

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
        'overview', 'cockpit', 'shop_overview', 'product_center',
        'bi', 'ops_goals', 'ops_activities', 'data_manage',
      ],
    }
  }
}

export class PddAdapter extends GovernanceBackedPlatformAdapter {
  readonly platformCode = 'pdd'
  readonly platformName = '拼多多'
  readonly category = 'shelf' as const

  getCapabilities(): PlatformCapabilities {
    return {
      supportsLive: false,
      supportsShelf: true,
      supportsContent: false,
      supportsAds: true,
      supportsAutoSync: true,
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
}
