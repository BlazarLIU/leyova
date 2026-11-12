import { GovernanceBackedPlatformAdapter } from './base.js'
import type { PlatformCapabilities } from '../types.js'

export class DouyinAdapter extends GovernanceBackedPlatformAdapter {
  readonly platformCode = 'douyin'
  readonly platformName = '抖音电商'
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
}
